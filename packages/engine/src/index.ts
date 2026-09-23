/**
 * The tavern engine service: workspace lifecycle, per-agent card composition,
 * the turn-tail maintenance agent, and the pre-step gate that keeps one
 * narrative turn's audited state ahead of the next.
 *
 * Sessions bind to a workspace through creation (api/tavern creates them with
 * the workspace cwd); `agent/created` then composes the agent'sScoped world —
 * card prompts and its tool face — through `agent.ctx`, the registry's
 * sanctioned per-agent registration point. Engine listeners themselves stay
 * global and consult the workspace table, so non-tavern sessions in the same
 * process hear nothing.
 * @module dsh-tavern-fengyue-engine
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { brandString } from '@deepseek-ai/dsh-brand'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
import { setApprovalPolicy } from '@deepseek-ai/dsh-user-approval'
import type { Agent, AssistantStreamFrame, PreStepDecision } from '@deepseek-ai/dsh-agent'
import type { LlmAttemptId } from '@deepseek-ai/dsh-llm'
import { createSystemMessage, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type {} from '@deepseek-ai/dsh-subagent'
import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionPromptValue, SessionRequestId } from '@deepseek-ai/dsh-api-session-controller'
import type { CommandId } from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-shell'
import type { TavernImportFile, TavernLibraryCard, TavernSave, TavernSessionState, TavernTreeEntry } from './types.ts'
import type { ScriptRenderFailure } from './prompting.ts'
import { runHookPhase, type HookEvent } from './hooks.ts'
import { textOfBlocks, writeChatSnapshot, writeTailSnapshot } from './chat-snapshot.ts'
import {
  autosaveStamped, commitImportedCard, createWorkspaceDirs, deleteSave, deleteSaveStamp, hasCard, importCardPreset,
  listLibrary, listSaves, listTree, loadSave, manualSave, newWorkspaceRoot, PRESET_DIR, presetDiffers,
  publishWorkspaceCard, readAsset, readCardMeta, readLibraryAsset, readSaveStamp, readMaintenancePrompt, readSystemPrompt,
  readOpeningHtml, readWorkspaceText, seedRuntime, wipeWorkspaceDirs, writeAsset, writeCardSkeleton, writeSaveStamp,
  writeWorkspaceText, workspaceFileOp,
  publishIntoLibraryCard,
} from './workspace.ts'
import {
  registerAssembleRender, registerCardSections, registerWriterGuide, renderPlaceholders,
  renderPostMessage, runCardScript, stripInstructions,
} from './prompting.ts'
import { registerMainAgentTools, registerTailAgentTools } from './tools.ts'
import { noticeCompatRecord, withHostGuidance } from './compat-notice.ts'
import { livePendingIds, repairSeedInbox } from './inbox-repair.ts'
import { tailTranscriptFrom, type TailTranscript } from './tail-transcript.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** The tavern engine: workspace table, card composition, tail scheduling. */
    tavernService: TavernRuntime
  }
}

/** The settlement scan's outcome positions (seq values, -1 = absent). */
export interface SettlementScan {
  readonly lastTurnStart: number
  readonly lastTurnEnd: number
  readonly lastDone: number
}

/**
 * One pass event scan feeding the ghost-turn heal: the seqs of the last
 * turn/start, the last turn/end, and the last `tavern-tail-done` signal.
 * Pure — unit-testable against event fixtures (real shapes from the
 * 2026-09-22 ghost dump).
 */
export function scanSettlement(events: Iterable<{ type: string; seq: number; data?: unknown }>): SettlementScan {
  let lastTurnStart = -1
  let lastTurnEnd = -1
  let lastDone = -1
  for (const event of events) {
    if (event.type === 'turn/start') lastTurnStart = event.seq
    else if (event.type === 'turn/end') lastTurnEnd = event.seq
    else if (event.type === 'command/done'
      && (event.data as { commandId?: unknown } | undefined)?.commandId === 'tavern-tail-done') lastDone = event.seq
  }
  return { lastTurnStart, lastTurnEnd, lastDone }
}

/** The heal gate: a fully-closed turn whose settlement signal is missing. */
export function settlementUnsigned(scan: SettlementScan): boolean {
  // 幂等门:回合已闭(end 晚于 start)且签名落在 end 之后 → 无事可补。
  // turn/start 晚于 end = 回合在跑(cancel 会让它收束,新落定路径自会发信号)。
  return scan.lastTurnEnd >= 0 && scan.lastTurnStart <= scan.lastTurnEnd && scan.lastDone < scan.lastTurnEnd
}

/** Deployment-tunable roots and limits. */
export interface Config {
  /** Base directory of per-session workspaces; resolved against the process cwd when relative. */
  workspaceBase: string
  /** Base directory of the shared card library. */
  libraryBase: string
  /** How many `autosave-<timestamp>` saves each workspace keeps. */
  autosaveKeep: number
  /** Inclusive byte cap for one editor read (text or asset preview). */
  editReadCap: number
  /** Inclusive byte cap for one editor asset write (decoded size). */
  editWriteCap: number
}

/** Runtime schema for the config above. */
export const Config: z<Config> = z.object({
  workspaceBase: z.string().default('tavern_workspace'),
  libraryBase: z.string().default('tavern_presets'),
  autosaveKeep: z.number().default(10),
  editReadCap: z.number().default(10_000_000),
  editWriteCap: z.number().default(10_000_000),
})

const SESSION_ID_FILE = '.tavern-session'
const DRAFT_FILE = '.tavern-draft'
const EDIT_MARKER_FILE = '.tavern-editing'
/** deleteSession's rm budget: ~12 × 250 ms of open-handle settle window before
 *  the denial resurfaces (Windows EPERM on just-cancelled agents; see
 *  {@link removeTree} and the 2026-09-23 devlog entry). */
const DELETE_RM_RETRIES = 12
const DELETE_RM_BACKOFF_MS = 250
/** Persists each workspace's card-writing agent session id (see {@link ensureWriter}). */
const WRITER_FILE = '.tavern-writer'
/** The client-managed writer-session registry (tab strip): live sessions plus
 *  tombstones awaiting the boot GC (see {@link writerLogGC}). Hidden from the
 *  editor tree (dot-prefixed) and fenced inside runtime/ like any client write. */
const WRITER_REGISTRY_FILE = 'runtime/.writer-sessions.json'
/** Message-source plugin token on every engine-injected post message (composer and scanner share it). */
const PLUGIN_SOURCE = 'dsh-tavern-fengyue-engine'
/** Where a card's narrator-tools flag lives: an explicit boolean field on the
 *  card identity itself (`preset/meta.json`), not a hidden side-file — every
 *  preset whole-copy boundary (发布 / 编辑保存 / 导卡) carries meta.json, so
 *  the flag follows the card into every new session, and the user can read or
 *  hand-edit it in the card's own JSON. */
const CARD_META_FILE = `${PRESET_DIR}/meta.json`

/** The writer-session registry the client keeps per workspace. */
interface WriterRegistry {
  /** Live writer sessions, newest last (the tab strip's order). */
  readonly sessions: readonly { readonly id: string; readonly label: string }[]
  /** Tombstoned ids: closed tabs whose durable logs the boot GC still owes. */
  readonly deleted: readonly string[]
}

/** AttemptId prefix the stream transposer stamps onto tail-child frames — the UI's
 *  only key for routing the parent stream's transient chunks into the tail row. */
const TAIL_STREAM_PREFIX = 'tavern-tail:'
/** Marks this module's own re-emissions so {@link TavernRuntime.transposeTailStream} never re-enters itself. */
const TRANSPOSED: unique symbol = Symbol('tavern-tail-transposed')

/** Read one session id persisted in a marker file, if any. */
function readPersistedMarker(root: string, file: string): string | null {
  try {
    const raw = readFileSync(join(root, file), 'utf8').trim()
    return raw === '' ? null : raw
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/** Read one workspace's narrator-tools flag from the CARD's meta.json (see
 *  {@link CARD_META_FILE}): `narratorTools` absent or true = on — every stock
 *  card needs no migration — `false` = the narrator is workspace-blind.
 *  Re-read per call; 零隐藏态：要找旗标，打开 meta.json 就看得见。 */
function narratorToolsOn(root: string): boolean {
  return readCardMeta(root)?.narratorTools !== false
}

/**
 * Read one workspace's writer-session registry, tolerant of absence and
 * client-era corruption — `undefined` means "no usable registry" (the GC then
 * touches nothing). Session rows keep their id and tab label; unknown shapes
 * degrade field-wise.
 */
function readWriterRegistry(root: string): WriterRegistry | undefined {
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(join(root, WRITER_REGISTRY_FILE), 'utf8'))
  } catch {
    return undefined
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const record = raw as { sessions?: unknown; deleted?: unknown }
  const sessions = Array.isArray(record.sessions)
    ? record.sessions.flatMap(entry => {
      if (typeof entry !== 'object' || entry === null) return []
      const id = (entry as { id?: unknown }).id
      const label = (entry as { label?: unknown }).label
      return typeof id === 'string' && id !== '' ? [{ id, label: typeof label === 'string' ? label : '' }] : []
    })
    : []
  const deleted = Array.isArray(record.deleted) ? record.deleted.filter((id): id is string => typeof id === 'string' && id !== '') : []
  return { sessions, deleted }
}

/** Write the writer-session registry back (GC consumption and client reads share the one shape). */
function writeWriterRegistry(root: string, registry: WriterRegistry): void {
  const path = join(root, WRITER_REGISTRY_FILE)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ sessions: registry.sessions, deleted: registry.deleted }, undefined, 2)}\n`)
}

/** Read the editing-source card name stamped for one workspace, if any. */
function readEditingMarker(root: string): string | null {
  try {
    const raw = readFileSync(join(root, EDIT_MARKER_FILE), 'utf8').trim()
    return raw === '' ? null : raw
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
}

/**
 * The hoisted agent-preset root the bundle patch points the `empty` preset at:
 * `$DSH_HOME/profiles/tavern-fengyue/presets`. Profile-scoped so the shipped
 * preset reaches every launch of the tavern-fengyue profile regardless of the
 * process cwd (the cwd-relative convention only worked inside the harness
 * repo). TANDEM: the literal 'tavern-fengyue' here MUST match the bundle
 * patch's dshHomePath row and the profile directory name — three spellings
 * of one identity; change all three together.
 */
const PRESET_ROOT = () => dshHomePath('profiles', 'tavern-fengyue', 'presets')

/**
 * Mirror the engine's shipped preset directories onto the profile preset root.
 * Runs at engine mount so every install channel (dev bootstrap, `dsh plugin
 * add`, a future installer) materializes the `empty` preset without a separate
 * copy step; byte-comparison keeps restarts idempotent.
 */
function syncShippedPresets(): void {
  // fileURLToPath 而非 URL.pathname：Windows 的 pathname 带前导 `/`（/C:/…），fs 调用必炸。
  const sourceRoot = fileURLToPath(new URL('../presets', import.meta.url))
  if (!existsSync(sourceRoot)) throw new Error(`tavern engine: shipped presets dir is missing at ${sourceRoot}`)
  for (const name of readdirSync(sourceRoot)) {
    const sourceDir = join(sourceRoot, name)
    const destDir = join(PRESET_ROOT(), name)
    for (const file of readdirSync(sourceDir)) {
      const source = join(sourceDir, file)
      const dest = join(destDir, file)
      let current: string | undefined
      try {
        current = readFileSync(dest, 'utf8')
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      const next = readFileSync(source, 'utf8')
      if (current === next) continue
      mkdirSync(destDir, { recursive: true })
      writeFileSync(dest, next)
    }
  }
}

/**
 * One completed turn's settlement run: the strict chain main → main.after →
 * tail → tail.after, tracked so the pre-step gate can bar the tail child's
 * first step on the hook phase and stop() can abort the whole chain.
 */
interface TurnRun {
  /** Aborts the in-flight hook children and (through stop()) the tail child. */
  readonly controller: AbortController
  /** Resolves once the main.after phase settled (hooks done or none) — the tail's first step waits here. */
  readonly mainAfterDone: Promise<void>
  /** The tail child's assistant narration, buffered in event order for the tail file. */
  readonly tailTexts: string[]
  /** The spawned tail's phase promise (play-through → tail file → tail.after); undefined when tail disabled. */
  tailPhase?: Promise<void>
  /** The fork child's session id, once hatched. */
  childId?: SessionId
}

/**
 * Engine of the tavern profile. One instance per dsh process.
 */
export class TavernRuntime extends Service {
  static inject = ['agents', 'sessions', 'sessionController', 'systemPrompt', 'shell', 'subagents'] as const

  /** Loader-facing config schema; module-level `Config` alone is never read for Service plugins. */
  static Config: z<Config> = Config

  private readonly cfg: Config
  /** Session id → workspace root, set at session creation. */
  private readonly workspaces = new Map<SessionId, string>()
  /** Card-writing agent session id → workspace root (see {@link ensureWriter}); never a main/tail session. */
  private readonly writers = new Map<SessionId, string>()
  /** Session id → in-flight tail run; the pre-step gate awaits it. */
  private readonly gates = new Map<SessionId, Promise<void>>()
  /** Sessions whose active turn the player stopped — the turn-end must not schedule the tail. */
  private readonly stopped = new Set<SessionId>()
  /** Session id → the in-flight tail run's abort handle and child session. */
  private readonly tailRuns = new Map<SessionId, TurnRun>()
  /** Tail-child session id → its parent's settlement run (narration buffering; the child is never workspace-bound). */
  private readonly tailChildRuns = new Map<SessionId, TurnRun>()
  /** Agents already composed (idempotence for manual post-fork composition). */
  private readonly composed = new WeakSet<Agent>()
  /** Last seen client time zone per session — the snapshot head line's zone field. */
  private readonly clientTimeZones = new Map<SessionId, string>()
  /**
   * Per-session FIFO of rendered per-turn post texts, one entry per submission
   * (an entry may carry `''` when the card renders nothing — the claiming turn
   * then gets no post). Each submission pushes a fresh wrapper object, so a
   * failed admission can remove exactly its own entry by identity even when
   * another submission's identical text sits in the queue. The pre-step
   * injector shifts one entry per claim; entries live only for the
   * queue-to-turn window.
   */
  private readonly postStash = new Map<SessionId, { readonly text: string }[]>()
  /** Per-workspace FIFO chain serializing engine-side writes (editor RPC, file ops, snapshot rewrites). */
  private readonly writeQueues = new Map<string, Promise<unknown>>()
  /** Per-main-agent card-tool re-sync; the engine's preset mutation points call it so the change lands on the current request. */
  private readonly toolSyncs = new WeakMap<Agent, () => void>()

  constructor(ctx: Context, config: Config) {
    super(ctx, 'tavernService')
    this.cfg = config
    noticeCompatRecord(ctx.logger)
    syncShippedPresets()
    this.restoreBindings()
    // 尾代理透流改道：子会话的 assistant 流帧只进子会话的 follow，浏览器永远
    // 跟的是父会话流——不转道，数据维护行只能等落定后取数。见 transposeTailStream。
    this.ctx.on('agent/assistant-stream', ({ agent, frame }: { agent: Agent; frame: AssistantStreamFrame }) => {
      this.transposeTailStream(agent, frame)
    })
    this.ctx.on('agent/created', ({ agent }: { agent: Agent }) => { this.onAgentCreated(agent) })
    this.ctx.on('session/event', (session: Session, event: SessionEvent) => { this.onSessionEvent(session, event) })
    this.ctx.on('agent/pre-step', (payload: {
      agent: Agent
      messages: UserMessage[]
      turn: number
      step: number
      signal: AbortSignal
    }, next: () => Promise<PreStepDecision>): Promise<PreStepDecision> => this.gate(payload, next))
  }

  /**
   * Chain one write onto the workspace's FIFO. Everything the engine itself
   * writes (editor RPC text, file ops, conversation-snapshot rewrites) serializes
   * here instead of interleaving against the tail agent's bash writes; the
   * tail's own writes keep the file-level last-writer-wins contract. The
   * returned promise still rejects with the write's own failure.
   */
  private enqueueWrite<T>(root: string, write: () => T): Promise<T> {
    const previous = this.writeQueues.get(root) ?? Promise.resolve()
    const next = previous.then(write, write)
    this.writeQueues.set(root, next.catch(() => undefined))
    return next
  }

  /** Absolute workspace base (config value resolved against the process cwd). */
  get workspaceBase(): string {
    return isAbsolute(this.cfg.workspaceBase) ? this.cfg.workspaceBase : resolve(this.cfg.workspaceBase)
  }

  /**
   * Rebuild the session→workspace table from disk: every workspace directory
   * persists its bound session id in `.tavern-session`, so bindings survive
   * process restarts (the in-memory map alone would orphan every resumed
   * session after a reboot).
   */
  private restoreBindings(): void {
    const base = this.workspaceBase
    for (const entry of existsSync(base) ? readdirSync(base, { withFileTypes: true }) : []) {
      if (!entry.isDirectory()) continue
      const root = join(base, entry.name)
      const sessionId = readPersistedMarker(root, SESSION_ID_FILE)
      if (sessionId !== null) this.workspaces.set(brandString<SessionId>(sessionId), root)
      const writerId = readPersistedMarker(root, WRITER_FILE)
      if (writerId !== null) this.writers.set(brandString<SessionId>(writerId), root)
    }
    this.sweepOrphanSessionLogs()
    this.writerLogGC()
  }

  /**
   * Boot-time GC of durable session logs whose workspace is gone. Deletions
   * taken by an older build (before {@link deleteSession} removed the log
   * project dir too) left the log side of every deleted workspace behind —
   * one `listSessions` record per turn, forever, slowing every sidebar
   * refresh. The sweep mirrors the delete-time rule: a sessions-root project
   * dir keyed to a tavern workspace path with no workspace directory on disk
   * is an orphan. Non-tavern project dirs are never touched.
   */
  private sweepOrphanSessionLogs(): void {
    const sessionsRoot = this.sessionsRoot()
    if (sessionsRoot === undefined) return
    const base = this.workspaceBase
    const liveKeys = new Set(existsSync(base)
      ? readdirSync(base, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => this.projectKeyOf(join(base, entry.name)))
      : [])
    for (const entry of readdirSync(sessionsRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (!entry.name.startsWith('--') || !entry.name.endsWith('--')) continue
      if (!entry.name.includes('tavern_workspace')) continue
      if (liveKeys.has(entry.name)) continue
      rmSync(join(sessionsRoot, entry.name), { recursive: true, force: true })
      this.ctx.logger.warn(`tavern: 已清理孤儿会话日志（对应工作空间已删除）: ${entry.name}`)
    }
  }

  /**
   * Boot-time GC of closed writer-session logs. The client-managed writer tabs
   * tombstone their closed session ids into `runtime/.writer-sessions.json`;
   * the browser cannot touch the durable store, so this boot drain (the kernel's
   * only GC moment — no live agent can hold a log open) removes exactly the
   * tombstoned ids' log directories and consumes the tombstones. Ids are
   * matched precisely — main/tail/fork logs in the same project dir are never
   * touched, and a tombstone whose rm failed (file-lock races on Windows) stays
   * tombstoned for the next boot.
   */
  private writerLogGC(): void {
    const sessionsRoot = this.sessionsRoot()
    const base = this.workspaceBase
    if (sessionsRoot === undefined || !existsSync(base)) return
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const root = join(base, entry.name)
      let registry = readWriterRegistry(root)
      if (registry === undefined) {
        // Legacy migration seed: an ensureWriter-era writer with no registry
        // file yet surfaces as tab 1, so its existing history stays reachable.
        const legacy = [...this.writers.entries()].find(([, writerRoot]) => writerRoot === root)
        if (legacy !== undefined) {
          registry = { sessions: [{ id: legacy[0], label: '会话 1' }], deleted: [] }
          writeWriterRegistry(root, registry)
        }
      }
      if (registry === undefined || registry.deleted.length === 0) continue
      const projectDir = join(sessionsRoot, this.projectKeyOf(root))
      if (existsSync(projectDir)) {
        for (const id of registry.deleted) {
          if (registry.sessions.some(session => session.id === id)) continue
          rmSync(join(projectDir, id), { recursive: true, force: true })
        }
      }
      // Consume the drained tombstones; an rm that failed above survives for
      // the next boot (existence, not success, is the drain criterion).
      const remaining = registry.deleted.filter(id => existsSync(join(projectDir, id)))
      writeWriterRegistry(root, { sessions: registry.sessions, deleted: remaining })
    }
  }

  /** The durable session-log store root (dsh home's `sessions/`), when present. */
  private sessionsRoot(): string | undefined {
    const root = dshHomePath('sessions')
    return existsSync(root) ? root : undefined
  }

  /** Absolute library base. */
  get libraryBase(): string {
    return isAbsolute(this.cfg.libraryBase) ? this.cfg.libraryBase : resolve(this.cfg.libraryBase)
  }

  /**
   * Create a fresh workspace directory and a session bound to it.
   * @returns the new session id.
   */
  /**
   * List tavern workspaces from disk with their bound session and card state.
   * Workspaces whose session has no durable record are hidden: a marker can
   * outlive its session when the process dies inside the create→persist
   * window (kill mid-start leaves the marker, the store never materializes
   * the folder), and clicking such a row fails loud client-side
   * (`sessions.select: unknown session`). Live sessions created in this
   * process bypass the probe; the query face decides the rest.
   * @returns one row per workspace directory, newest first.
   */
  async sessionsOverview(): Promise<{ name: string; sessionId: string | null; hasCard: boolean; title: string; desc: string; cover: string }[]> {
    const scanned: { name: string; sessionId: string | null; hasCard: boolean; title: string; desc: string; cover: string }[] = []
    const base = this.workspaceBase
    for (const entry of existsSync(base) ? readdirSync(base, { withFileTypes: true }) : []) {
      if (!entry.isDirectory()) continue
      const root = join(base, entry.name)
      const meta = readCardMeta(root)
      scanned.push({
        name: entry.name,
        sessionId: readPersistedMarker(root, SESSION_ID_FILE),
        hasCard: hasCard(root),
        title: meta?.title !== undefined && meta.title !== '' ? meta.title : entry.name,
        desc: meta?.desc ?? '',
        cover: meta?.cover ?? '',
      })
    }
    const kept: typeof scanned = []
    // One durable-store query for the whole scan — the previous per-row probe
    // ran a full listSessions() per workspace, so deleting a row (which
    // triggers refreshRows → sessionsOverview) re-scanned the durable store
    // N times and cost seconds on even an empty workspace list.
    const { available, ids: durableIds } = await this.durableSessionIds()
    for (const row of scanned) {
      if (row.sessionId === null) {
        kept.push(row)
        continue
      }
      const id = brandString<SessionId>(row.sessionId)
      if (!available || this.ctx.sessions.get(id) !== undefined || durableIds.has(id)) {
        kept.push(row)
      } else if (!this.orphanWarned.has(row.sessionId)) {
        this.orphanWarned.add(row.sessionId)
        this.ctx.logger.warn(new Error(`tavern: workspace ${row.name} 的会话 ${row.sessionId} 没有 durable 记录（停机窗口竞态的孤儿工作空间），已从会话列表隐藏`))
      }
    }
    kept.sort((left, right) => right.name.localeCompare(left.name))
    return kept
  }

  /** Workspace session ids already reported as orphans — one warn, never spam. */
  private readonly orphanWarned = new Set<string>()

  /**
   * The durable store's persisted session ids in one query. `sessionQuery` is
   * an optional base-bundle face: when absent (REAL test compositions) or on
   * probe error the answer is `available: false` — the caller then keeps every
   * row, because hiding a row on a missing probe is the worse failure.
   */
  private async durableSessionIds(): Promise<{ available: boolean; ids: Set<SessionId> }> {
    const query = this.ctx.get('sessionQuery') as {
      listSessions(signal?: AbortSignal): Promise<ReadonlyArray<{ header: { id: SessionId }, persisted: boolean }>>
    } | undefined
    if (query === undefined) return { available: false, ids: new Set() }
    try {
      const records = await query.listSessions()
      const ids = new Set<SessionId>()
      for (const record of records) if (record.persisted) ids.add(record.header.id)
      return { available: true, ids }
    } catch {
      return { available: false, ids: new Set() }
    }
  }

  async createSession(): Promise<SessionId> {
    const root = createWorkspaceDirs(newWorkspaceRoot(this.workspaceBase))
    const sessionId = brandString<SessionId>(`session-${randomUUID()}`)
    this.workspaces.set(sessionId, root)
    writeFileSync(join(root, SESSION_ID_FILE), `${sessionId}\n`)
    // Create through the session controller so the session registers with the
    // same listing/persistence path as every other client session — creating
    // the agent directly would never surface in the sidebar. No preset is
    // requested: the tavern bundle disables the host's preset plane, so the
    // controller's no-preset branch composes the session — the card stays the
    // whole world (no default preset's product tools, persona, or injected
    // contexts enter the agent).
    await this.ctx.sessionController.create({ sessionId, cwd: root, agentPreset: 'empty' })
    return sessionId
  }

  /**
   * Delete a tavern session's workspace outright (savings included) and
   * unbind it. The agent teardown capability stays with the session
   * controller, which owns the creation handle; the durable session log is
   * not removed.
   *
   * Cancellation is advisory (stop() returns before agents release their
   * file handles on later ticks), and Windows refuses to unlink a file that
   * anyone still holds open where POSIX buries the race — so the rm runs
   * behind a bounded backoff, and a workspace that STILL cannot be removed
   * keeps its binding (the player can simply retry). The log side is not
   * load-bearing: its project dir is GC'd at boot by the orphan sweep, so a
   * residual lock there degrades to a logged warning, never a failed round.
   * @param sessionId - session identity.
   */
  async deleteSession(sessionId: SessionId): Promise<void> {
    const root = this.root(sessionId)
    this.stop(sessionId)
    await this.removeTree(root)
    this.workspaces.delete(sessionId)
    this.postStash.delete(sessionId)
    // The workspace's card-writing agent binds to the ROOT, not to this
    // session — its marker dies with the directory, so the map row must go
    // too or the next ensureWriter would return a session with no workspace.
    // It is stopped before the rm alongside the main session: a live writer
    // turn (edit page open) holds workspace handles the same way.
    for (const [writerId, writerRoot] of this.writers) {
      if (writerRoot === root) {
        this.stop(writerId)
        this.writers.delete(writerId)
      }
    }
    try {
      await this.removeTree(join(this.sessionsRoot() ?? '', this.projectKeyOf(root)))
    } catch (error) {
      this.ctx.logger.warn(`tavern: 会话日志清理失败（启动孤儿清理将兜底）: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * rm -rf with a bounded retry: the transient denial codes are the Windows
   * open-handle family (Access is denied reaches us as EPERM or EACCES, and
   * the holders' parents cascade into ENOTEMPTY), and the holders here are
   * our own just-cancelled agents plus the usual ambient suspects (antivirus,
   * indexer) that hold freshly written files for tens to hundreds of
   * milliseconds. `fs.rmSync` ships retry-with-backoff only behind an
   * explicit `maxRetries`, and `force: true` ignores ENOENT alone — without
   * retries, one lock fails the whole delete.
   * @param path - the tree root to remove.
   */
  private async removeTree(path: string, attempt = 0): Promise<void> {
    const DENIALS = new Set(['EBUSY', 'EACCES', 'EPERM', 'EMFILE', 'ENFILE', 'ENOTEMPTY'])
    try {
      rmSync(path, { recursive: true, force: true })
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code === undefined || !DENIALS.has(code) || attempt >= DELETE_RM_RETRIES) throw error
      await sleep(DELETE_RM_BACKOFF_MS)
      await this.removeTree(path, attempt + 1)
    }
  }

  /**
   * The durable session-log project directory key for one workspace cwd —
   * every session that ever ran against this workspace (main sessions across
   * load/reset rebinds, tail fork children, the card-writing agent) persists
   * under ONE project dir keyed by its cwd, leaking one record per turn into
   * `sessionQuery.listSessions` forever. Deleting a workspace therefore also
   * deletes that whole project dir; without it the sidebar-refresh scan grows
   * unbounded and every 删除 round-trip slows down.
   *
   * The layout and this encoder are dsh-persistence internals: the pinned
   * host (`config/dsh-compatibility.json`) stores logs at
   * `<dshHome>/sessions/<projectKey(cwd)>/<sessionId>/`, where projectKey maps
   * separators to `-` and other unsafe units to `~XXXX` escapes, wrapped in
   * `--…--` (verified against the live home). If a future host renames the
   * scheme, this rm misses (force:true no-op) and deletion degrades to
   * workspace-only behavior — logs orphan, nothing breaks.
   * @param root - absolute workspace root (the sessions' cwd).
   * @returns the project-key directory name under the sessions root.
   */
  projectKeyOf(root: string): string {
    let readable = ''
    let separatorRun = false
    for (let index = 0; index < root.length; index += 1) {
      const code = root.charCodeAt(index)
      const ch = String.fromCharCode(code)
      if (ch === '/' || ch === '\\' || ch === ':') {
        if (!separatorRun) readable += '-'
        separatorRun = true
      } else if (ch !== '~' && /^[A-Za-z0-9._-]$/.test(ch)) {
        readable += ch
        separatorRun = false
      } else {
        readable += `~${code.toString(16).toUpperCase().padStart(4, '0')}`
        separatorRun = false
      }
    }
    return `--${(readable.replace(/^-+/, '') || 'root').slice(0, 251)}--`
  }

  /**
   * The workspace's card-writing agent session: a NORMAL dsh session whose
   * cwd is the workspace root, created lazily on first edit-page mount and
   * reused for the workspace's lifetime. The session is deliberately kept OUT
   * of the `workspaces` map — that map composes the card agent's world, while
   * this one composes a default dsh agent (plus the writer guide and the
   * tool guard). An idle/rebound main session never touches it: the writer
   * binds to the root, not to any RP session.
   * @param sessionId - the workspace-owning session making the request.
   * @returns the writer session id, stable per workspace.
   */
  async ensureWriter(sessionId: SessionId): Promise<SessionId> {
    const root = this.root(sessionId)
    for (const [existing, writerRoot] of this.writers) {
      if (writerRoot === root) return existing
    }
    const writerId = brandString<SessionId>(`session-${randomUUID()}`)
    // Bind BEFORE create so the fresh agent's `agent/created` composition
    // sees the writer map; a failed create rolls the binding and marker back.
    this.writers.set(writerId, root)
    writeFileSync(join(root, WRITER_FILE), `${writerId}\n`)
    try {
      await this.ctx.sessionController.create({ sessionId: writerId, cwd: root, agentPreset: 'standard' })
    } catch (error) {
      // Pre-preset workspaces persist a writer session that recorded no agent
      // preset; adopting it under 'standard' fails the identity assertion.
      // Retry once preset-free — the resume path then composes from the stored
      // projection (the profile default) instead of failing the editor column.
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('cannot be adopted')) {
        this.writers.delete(writerId)
        rmSync(join(root, WRITER_FILE), { force: true })
        throw error
      }
      this.ctx.logger.warn(`tavern: writer ${String(writerId)} predates the preset plane — resuming it without an explicit preset`)
      await this.ctx.sessionController.create({ sessionId: writerId, cwd: root })
    }
    return writerId
  }

  /**
   * One workspace's root, or undefined when the session is not a tavern session.
   * @param sessionId - session identity.
   */
  workspaceOf(sessionId: SessionId): string | undefined {
    return this.workspaces.get(sessionId)
  }

  /**
   * Client-facing session state.
   * @param sessionId - session identity.
   */
  state(sessionId: SessionId): TavernSessionState {
    const root = this.root(sessionId)
    const meta = readCardMeta(root)
    return {
      hasCard: hasCard(root),
      maintenanceOn: readMaintenancePrompt(root) !== '',
      narratorToolsOn: narratorToolsOn(root),
      title: meta?.title ?? '',
      desc: meta?.desc ?? '',
      cover: meta?.cover ?? '',
      drafting: existsSync(join(root, DRAFT_FILE)),
      editing: readEditingMarker(root),
      tailRunning: this.gates.has(sessionId),
      dialogStarted: this.hasPlayerTurn(this.ctx.agents.get(sessionId)?.session),
      retryable: this.retryStamp(root) !== undefined,
    }
  }

  /**
   * The card library list.
   * @returns one entry per card directory under the library base.
   */
  library(): TavernLibraryCard[] {
    return listLibrary(this.libraryBase)
  }

  /**
   * Admit one player prompt: render the card's per-turn post message (after
   * the turn-tail gate, so it carries the freshly maintained runtime) into the
   * submission stash and forward the RAW text through the session controller's
   * normal admission (inbox, rpcId persistence, queue mode). The turn's
   * pre-step injector shadows the previous live post and rides the stashed
   * value into the turn's admitted batch — the durable player message itself
   * is always the bare text (see docs/tavern-prototype/dynamic-post-injection_zh.md).
   * @param request - session identity, raw player text, the client-minted
   *   request identity, and the optional client time zone (forwarded verbatim
   *   so the accepted message keeps the client's rpcId provenance).
   * @param signal - cancels the admission round-trip AND the post render's
   *   running scripts (a cancelled submission kills its bash children).
   * @returns the controller's acceptance plus the post render's script
   *   failures, when any — the rendered text keeps failed placeholders
   *   verbatim, so the failures are user-facing news, not a silent state.
   */
  async prompt(
    request: {
      readonly sessionId: SessionId
      readonly text: string
      readonly requestId: string
      readonly clientTimeZone?: string
    },
    signal: AbortSignal,
  ): Promise<SessionPromptValue & { scriptFailures?: ScriptRenderFailure[] }> {
    const { sessionId } = request
    const root = this.root(sessionId)
    const gate = this.gates.get(sessionId)
    if (gate !== undefined) await gate
    const session = this.ctx.agents.get(sessionId)?.session
    if (request.clientTimeZone !== undefined) this.clientTimeZones.set(sessionId, request.clientTimeZone)
    const timeZone = this.clientTimeZones.get(sessionId)
    // The send-moment autosave — the retry point. The tail gate has settled
    // (runtime/ fully maintained) and the submitted message is not durable yet
    // (user/message lands inside the turn, past the fork cut), so snapshot +
    // boundary re-derive exactly the pre-send state; `draft` keeps the composer
    // text for load-restore and retry re-send.
    autosaveStamped(root, this.cfg.autosaveKeep, {
      sessionId, seq: this.lastTurnEndSeq(session), summary: request.text.slice(0, 200), draft: request.text,
    })
    // The pending snapshot rewrite lands BEFORE the post render: worldbook-class
    // scripts scanning `.chat.snapshot.jsonl` during the render's {{script}}
    // calls must see the input being submitted, whose durable event has not
    // fired yet.
    if (session !== undefined) {
      await this.enqueueWrite(root, () => {
        writeChatSnapshot(root, session, { ...(timeZone === undefined ? {} : { clientTimeZone: timeZone }), pendingText: request.text })
        return true
      })
    }
    let pushed: { readonly text: string } | undefined
    try {
      const rendered = await renderPostMessage(root, this.ctx.shell, signal)
      pushed = { text: rendered.text }
      this.postStash.set(sessionId, [...(this.postStash.get(sessionId) ?? []), pushed])
      const accepted = await this.ctx.sessionController.prompt({
        requestId: brandString<SessionRequestId>(request.requestId),
        sessionId,
        mode: 'queue',
        content: [{ type: 'text', text: request.text }],
        ...(request.clientTimeZone === undefined ? {} : { clientTimeZone: request.clientTimeZone }),
      }, signal)
      return rendered.failures.length === 0 ? accepted : { ...accepted, scriptFailures: rendered.failures }
    } catch (error) {
      // The submission died (abort, rejected render, controller failure): the
      // pending row projected before the render must not linger as if the
      // message had been sent — one clean rewrite restores the durable truth.
      // The stashed post has no consuming turn either (admission rejects
      // before any pre-step runs), so it leaves the FIFO by identity and
      // cannot pair with the next message.
      const stash = pushed === undefined ? undefined : this.postStash.get(sessionId)
      const index = stash === undefined || pushed === undefined ? -1 : stash.indexOf(pushed)
      if (index >= 0) stash?.splice(index, 1)
      if (session !== undefined) {
        await this.enqueueWrite(root, () => {
          writeChatSnapshot(root, session, ...(timeZone === undefined ? [{}] : [{ clientTimeZone: timeZone }]))
          return true
        })
      }
      throw error
    }
  }
  importFromLibrary(sessionId: SessionId, name: string): void {
    importCardPreset(this.root(sessionId), this.resolveLibraryCard(name))
    // 载入真卡即结束任何草稿状态（残留标记会把后续路由锁在建卡页）。
    rmSync(join(this.root(sessionId), DRAFT_FILE), { force: true })
    // 换卡加载同样结束编辑上下文：残留的编辑戳会把本工作空间的失焦双写
    // 指向无关的旧卡。editFromLibrary 在本调用之后重新盖戳。
    rmSync(join(this.root(sessionId), EDIT_MARKER_FILE), { force: true })
    this.syncCardTools(sessionId)
  }

  private resolveLibraryCard(name: string): string {
    if (name.includes('/') || name.startsWith('.')) throw new Error(`tavern: card name "${name}" must be a library directory name`)
    const preset = resolve(this.libraryBase, name, 'preset')
    if (!existsSync(preset)) throw new Error(`tavern: library card "${preset}" has no preset/`)
    return preset
  }

  /**
   * Publish the workspace's card into the library under a unique name, or —
   * when the workspace EDITS a library card — replace that card in place and
   * end the editing context (保存并开始's first half; 仅保存 keeps the context
   * via {@link saveEdit} instead).
   * @param sessionId - the authoring session.
   * @returns the library card directory name.
   */
  publishCard(sessionId: SessionId): string {
    const root = this.root(sessionId)
    // An empty narrator prompt publishes a "blank card": the library accepts
    // it, the opening page renders an empty title/desc with zero greetings —
    // every surface then LOOKS broken ("保存并开始 did nothing"). Empty
    // test-run skeletons shipped this way and burned rounds of debugging;
    // publishing requires the one file a card cannot lack.
    if (readSystemPrompt(root) === '') {
      throw new Error('tavern: systemPrompt 为空——先在卡里写好叙事者提示词，再保存并开始')
    }
    const editing = readEditingMarker(root)
    if (editing !== null) {
      rmSync(join(root, DRAFT_FILE), { force: true })
      rmSync(join(root, EDIT_MARKER_FILE), { force: true })
      return publishIntoLibraryCard(root, this.libraryBase, editing)
    }
    const name = publishWorkspaceCard(root, this.libraryBase)
    rmSync(join(root, DRAFT_FILE), { force: true })
    return name
  }

  /**
   * Save the editing workspace's card INTO the library card it edits and keep
   * the editing context (仅保存): the workspace stays an editing session and
   * later edits keep being saveable. Editing never touches the library on its
   * own — this and {@link publishCard} are the only write paths back.
   * @param sessionId - the editing session.
   * @returns the library card directory name.
   */
  saveEdit(sessionId: SessionId): string {
    const root = this.root(sessionId)
    const editing = readEditingMarker(root)
    if (editing === null) throw new Error(`tavern: session ${String(sessionId)} is not editing a library card`)
    return publishIntoLibraryCard(root, this.libraryBase, editing)
  }

  /**
   * Whether the editing workspace's preset tree differs from the library card
   * it edits — the 返回 unsaved-changes check.
   * @param sessionId - the editing session.
   * @returns true when unsaved card edits exist.
   */
  editDirty(sessionId: SessionId): boolean {
    const root = this.root(sessionId)
    const editing = readEditingMarker(root)
    if (editing === null) throw new Error(`tavern: session ${String(sessionId)} is not editing a library card`)
    return presetDiffers(root, join(this.libraryBase, editing))
  }

  /**
   * Start editing a library card: load it into the workspace (runtime seeded)
   * and stamp which card edits publish back into.
   * @param sessionId - the session that becomes the editing session.
   * @param name - the library card directory name.
   */
  editFromLibrary(sessionId: SessionId, name: string): void {
    this.importFromLibrary(sessionId, name)
    const root = this.root(sessionId)
    writeFileSync(join(root, EDIT_MARKER_FILE), `${name}\n`)
  }

  /**
   * Abandon an edit: clear the editing stamp and restore the fresh empty
   * workspace (back to the library page) — the same unload as
   * {@link cancelDraft}. Editing never touches the library on its own
   * ({@link saveEdit} and {@link publishCard} are the only write paths back),
   * so discarding loses only the workspace copy. 曾案:这里曾把原卡重新载入
   * 工作空间"恢复原卡内容"——hasCard 仍为 true,返回卡库后刷新的路由三元组
   * (hasCard, drafting, editing) 与"游戏中"同构,会话被当游戏直开
   * (2026-09-22 用户裁定:返回卡库后刷新应留在选卡页)。
   * @param sessionId - the editing session.
   */
  cancelEdit(sessionId: SessionId): void {
    const root = this.root(sessionId)
    wipeWorkspaceDirs(root)
    rmSync(join(root, EDIT_MARKER_FILE), { force: true })
    rmSync(join(root, DRAFT_FILE), { force: true })
    this.syncCardTools(sessionId)
  }

  /**
   * Commit one parsed import (browser-read files): land the card in the
   * library under a unique title-derived directory, then load it into the
   * workspace and seed the runtime.
   * @param sessionId - the receiving session.
   * @param title - the card title the preview page shows.
   * @param files - card files with paths relative to the card root.
   * @returns the library card directory name.
   */
  commitImport(sessionId: SessionId, title: string, files: TavernImportFile[]): string {
    const base = this.libraryBase
    const safeTitle = title.trim().replace(/[\\/:*?"<>|]/g, '') || 'card'
    let name = safeTitle
    let n = 2
    while (existsSync(join(base, name))) name = `${safeTitle}-${String(n++)}`
    const cardName = commitImportedCard(files, join(base, name), this.root(sessionId))
    rmSync(join(this.root(sessionId), DRAFT_FILE), { force: true })
    this.syncCardTools(sessionId)
    return cardName
  }

  /**
   * Delete one card from the library.
   * @param name - library card directory name.
   */
  deleteCard(name: string): void {
    const preset = this.resolveLibraryCard(name)
    rmSync(dirname(preset), { recursive: true, force: true })
  }

  /**
   * Author a new card in place: write the preset skeleton into the workspace.
   * Idempotent on re-entry — a draft already in progress (marker present) is
   * NEVER re-skeletoned: the client's render churn re-calls this RPC, and an
   * unconditional overwrite would wipe everything the writer agent authored
   * (2026-09-20 建卡清空案). The skeleton writes only on first entry.
   * @param sessionId - the fresh session that becomes an authoring session.
   */
  draftCard(sessionId: SessionId): void {
    const root = this.root(sessionId)
    const draftMarker = join(root, DRAFT_FILE)
    if (!existsSync(draftMarker)) writeCardSkeleton(root)
    // 草稿标记：未发布的建卡会话跨切换保持建卡页；发布/取消时移除。
    writeFileSync(draftMarker, '')
    // 建新卡不是编辑卡库卡：清掉陈旧编辑戳，编辑态双写不再指向旧卡。
    rmSync(join(root, EDIT_MARKER_FILE), { force: true })
    this.syncCardTools(sessionId)
  }

  /**
   * Abandon a draft: wipe everything the authoring session wrote and restore
   * the fresh empty workspace (back to the library page).
   * @param sessionId - the authoring session.
   */
  cancelDraft(sessionId: SessionId): void {
    const root = this.root(sessionId)
    wipeWorkspaceDirs(root)
    rmSync(join(root, DRAFT_FILE), { force: true })
    this.syncCardTools(sessionId)
  }

  /**
   * An opening page for the empty-history state.
   * @param sessionId - session identity.
   * @returns the opening page HTML, or null when the card ships none.
   */
  opening(sessionId: SessionId): string | null {
    return readOpeningHtml(this.root(sessionId))
  }

  /**
   * Settled saves of one workspace, newest first.
   * @param sessionId - session identity.
   */
  saves(sessionId: SessionId): TavernSave[] {
    return listSaves(this.root(sessionId))
  }

  /**
   * The session's tail-agent transcript, oldest first: one row per
   * tavern-tail fork in the owner's durable catalog, each carrying
   * the child's own tool calls, their paired results, the closing
   * text, and end status. Live children read from the registry;
   * archived children cold-read through `sessionQuery` when the base
   * composition mounted it — without it the row stays honest
   * (`status: 'archived'`, empty body). Both reads carry the fork
   * seed boundary (`inheritedEventCount`) so replayed parent history
   * never leaks into a row.
   * @param sessionId - session identity.
   */
  async tailTranscript(sessionId: SessionId): Promise<TailTranscript> {
    const session = this.ctx.sessions.get(sessionId)
    if (session === undefined) throw new Error(`tavern: session ${String(sessionId)} has no live session for a tail transcript`)
    // Tail children are fork one-shots: their sessions leave the
    // registry when the run disposes them, so archived logs come
    // through the query face's cold read; its absence degrades to
    // the honest archived row.
    return await tailTranscriptFrom(session, async (childId) => {
      const live = this.ctx.sessions.get(childId)
      if (live !== undefined) return { events: live.snapshotEvents(), inheritedEventCount: live.inheritedEventCount ?? 0 }
      const query = this.ctx.get('sessionQuery') as {
        readSession(id: SessionId): Promise<{ events: readonly SessionEvent[]; inheritedEventCount?: number }>
      } | undefined
      if (query === undefined) return undefined
      try {
        const loaded = await query.readSession(childId)
        return { events: loaded.events, inheritedEventCount: loaded.inheritedEventCount ?? 0 }
      } catch {
        return undefined
      }
    })
  }

  /**
   * Save manually (named, never pruned) and stamp the save-point boundary:
   * the save-time session id, its last `turn/end` seq, the save row's
   * summary (the last player message), and the composer's on-screen draft,
   * so loading can fork the workspace back to EXACTLY this history through
   * the kernel's prefix-copy (`sessionController.fork`) — append-only logs
   * are never rewritten — and restore the draft into the composer.
   * @param sessionId - session identity.
   * @param name - save directory name.
   * @param draft - the composer text at save time (may be empty).
   */
  save(sessionId: SessionId, name: string, draft: string): void {
    const root = this.root(sessionId)
    manualSave(root, name)
    const session = this.ctx.sessions.get(sessionId)
    writeSaveStamp(root, name, {
      sessionId, seq: this.lastTurnEndSeq(session), summary: this.lastPlayerText(session), draft,
    })
  }

  /**
   * Load a save: restore `runtime/` from the snapshot and REBIND the
   * workspace to a session forked at the save-point boundary — the model's
   * history returns to the moment of the save without touching any
   * append-only log. The rebound session is fresh for composition; the
   * diverged descendant stays archived unbound. Saves taken before the stamp
   * existed carry no boundary and fall back to restoring `runtime/` in place.
   * @param sessionId - session identity.
   * @param name - save directory name.
   * @returns the fresh session id now bound to the workspace (the same id
   *   when the save carries no fork boundary) and the stamp's composer draft
   *   for the client to restore into the input box (empty when unstamped).
   */
  async load(sessionId: SessionId, name: string): Promise<{ sessionId: SessionId; draft: string }> {
    const root = this.root(sessionId)
    const stamp = readSaveStamp(root, name)
    if (stamp === undefined || stamp.seq === null) {
      // No durable point to fork from (a save taken before any turn — an
      // empty-history checkpoint). The old behavior kept the previous session
      // bound, so "loading" visibly did nothing. Match the reset rebind: a
      // fresh empty agent session takes the workspace and the marker, the old
      // session is unbound, and the save restores the workspace files — the
      // client sees an empty transcript under a switched session id.
      const rootNow = root
      const freshId = brandString<SessionId>(`session-${randomUUID()}`)
      this.workspaces.set(freshId, rootNow)
      writeFileSync(join(rootNow, SESSION_ID_FILE), `${freshId}\n`)
      try {
        await this.ctx.sessionController.create({ sessionId: freshId, cwd: rootNow, agentPreset: 'empty' })
      } catch (error) {
        this.workspaces.delete(freshId)
        writeFileSync(join(rootNow, SESSION_ID_FILE), `${sessionId}\n`)
        throw error
      }
      this.postStash.delete(sessionId)
      this.postStash.delete(freshId)
      this.workspaces.delete(sessionId)
      loadSave(rootNow, name)
      return { sessionId: freshId, draft: stamp?.draft ?? '' }
    }
    const { sessionId: freshId } = await this.ctx.sessionController.fork({
      sessionId: stamp.sessionId,
      atSeq: stamp.seq,
    })
    // The fork command already created and announced the child agent (seeded
    // with the prefix), so its creation announcement ran before the workspace
    // rebind — compose it here (the WeakSet guard keeps this idempotent). The
    // seed carries the composed prompt messages verbatim, so the wrapped
    // world needs no baseline re-derivation.
    this.workspaces.set(freshId, root)
    const freshSession = this.ctx.sessions.get(freshId)
    // The seed can carry a severed inbox ledger pair (a post-boundary message
    // queued before the fork's cut, claimed after it) — without repair the
    // child's first claim re-runs the parent's consumed input. Cancellations
    // run before the load RPC returns, so no claim can race them; the source's
    // full log decides which pending entries are genuinely alive.
    if (freshSession !== undefined) {
      const sourceSession = this.ctx.sessions.get(stamp.sessionId)
      repairSeedInbox(freshSession, sourceSession === undefined ? undefined : livePendingIds(sourceSession))
    }
    writeFileSync(join(root, SESSION_ID_FILE), `${freshId}\n`)
    const freshAgent = this.ctx.agents.get(freshId)
    if (freshAgent !== undefined) this.composeMainAgent(freshAgent, root)
    // Both stash faces die with the rebind: the old session's queue is dead,
    // and the fresh session must start empty — its first posts come from the
    // next submission only.
    this.postStash.delete(sessionId)
    this.postStash.delete(freshId)
    this.workspaces.delete(sessionId)
    loadSave(root, name)
    return { sessionId: freshId, draft: stamp.draft ?? '' }
  }

  /**
   * Enter the retry point: rebind the workspace to the send-moment autosave —
   * the newest `autosave-*` save whose stamp carries a composer draft — and
   * return that draft for the caller to re-send through the normal prompt
   * face (a fresh wrap render, a fresh admission). A stamp without a fork
   * boundary (no completed turn at send time) resets the workspace to a fresh
   * session instead: the runtime was seeded and untouched there, so the fresh
   * seed equals the snapshot. Manual saves never qualify — their boundary is
   * arbitrary and their draft was never submitted.
   * @param sessionId - session identity.
   * @returns the rebound session id and the preserved composer text.
   */
  async retryPoint(sessionId: SessionId): Promise<{ sessionId: SessionId; text: string }> {
    const root = this.root(sessionId)
    const gate = this.gates.get(sessionId)
    if (gate !== undefined) await gate
    const found = this.retryStamp(root)
    if (found === undefined) throw new Error(`tavern: session ${String(sessionId)} has no retry point`)
    let freshId: SessionId
    if (found.seq === null) {
      freshId = await this.reset(sessionId)
    } else {
      freshId = (await this.load(sessionId, found.name)).sessionId
    }
    return { sessionId: freshId, text: found.draft }
  }

  /**
   * Delete one save.
   * @param sessionId - session identity.
   * @param name - save directory name.
   */
  removeSave(sessionId: SessionId, name: string): void {
    deleteSave(this.root(sessionId), name)
    deleteSaveStamp(this.root(sessionId), name)
  }

  /**
   * Clear to the initial card state: the workspace REBINDS to a fresh session
   * — an append-only log is never rewritten, so "chat history cleared" means
   * the workspace's active session is a brand-new one whose history starts
   * empty — `runtime/` re-seeds from `preset/setup/`, and `savings/` are kept.
   * The old session's durable log remains archived; it is no longer bound to
   * any workspace.
   * @param sessionId - the session whose workspace resets.
   * @returns the fresh session id now bound to the same workspace.
   */
  async reset(sessionId: SessionId): Promise<SessionId> {
    const root = this.root(sessionId)
    const freshId = brandString<SessionId>(`session-${randomUUID()}`)
    // Bind BEFORE create so the fresh agent's `agent/created` composition sees
    // the workspace; a failed create rolls the binding and marker back.
    this.workspaces.set(freshId, root)
    writeFileSync(join(root, SESSION_ID_FILE), `${freshId}\n`)
    try {
      await this.ctx.sessionController.create({ sessionId: freshId, cwd: root, agentPreset: 'empty' })
    } catch (error) {
      this.workspaces.delete(freshId)
      writeFileSync(join(root, SESSION_ID_FILE), `${sessionId}\n`)
      throw error
    }
    this.postStash.delete(sessionId)
    this.postStash.delete(freshId)
    this.workspaces.delete(sessionId)
    seedRuntime(root)
    return freshId
  }

  /**
   * The workspace file tree for the editor.
   * @param sessionId - session identity.
   */
  tree(sessionId: SessionId): TavernTreeEntry[] {
    return listTree(this.root(sessionId))
  }

  /**
   * Read one workspace text file (fenced, cap-limited).
   * @param sessionId - session identity.
   * @param path - workspace-relative path.
   */
  readText(sessionId: SessionId, path: string): string {
    return readWorkspaceText(this.root(sessionId), path, this.cfg.editReadCap)
  }

  /**
   * Read one workspace asset as a data URL (fenced, MIME-sniffed, cap-limited).
   * @param sessionId - session identity.
   * @param path - workspace-relative path.
   */
  /**
   * Read one library card asset as a data URL (cover images for the shelf).
   * @param name - library card directory name.
   * @param rel - card-relative path (the meta `cover` value).
   */
  readLibraryAsset(name: string, rel: string): string {
    return readLibraryAsset(this.libraryBase, name, rel, this.cfg.editReadCap)
  }

  readAsset(sessionId: SessionId, path: string): string {
    return readAsset(this.root(sessionId), path, this.cfg.editReadCap)
  }

  /**
   * Write one binary asset into the workspace's preset area (the
   * identity-header cover upload); meta.json itself keeps going through
   * {@link writeText} — the client serializes it.
   * @param sessionId - session identity.
   * @param path - workspace-relative path; must sit under `preset/`.
   * @param dataBase64 - base64-encoded content (no `data:` URL prefix).
   */
  writeAsset(sessionId: SessionId, path: string, dataBase64: string): void {
    writeAsset(this.root(sessionId), path, dataBase64, this.cfg.editWriteCap)
  }

  /**
   * Write one preset text file (editor save-on-blur). Edits land in the
   * WORKSPACE only — the library card is never touched while editing; it
   * updates only through {@link saveEdit} / {@link publishCard}.
   * @param sessionId - session identity.
   * @param path - preset-relative path.
   * @param text - complete replacement text.
   */
  writeText(sessionId: SessionId, path: string, text: string): void {
    writeWorkspaceText(this.root(sessionId), path, text)
    if (path.startsWith(`${PRESET_DIR}/tools/`)) this.syncCardTools(sessionId)
    // The narrator-tools flag lives on meta.json — a client flip (or identity
    // edit) re-syncs the tool face so the read pair follows the flag on the
    // CURRENT request boundary.
    if (path === CARD_META_FILE) this.syncCardTools(sessionId)
  }

  /**
   * Create / move / delete a workspace file through the editor.
   * @param sessionId - session identity.
   * @param op - the editor operation.
   */
  fileOp(
    sessionId: SessionId,
    op: { kind: 'create'; path: string } | { kind: 'mkdir'; path: string } | { kind: 'move'; from: string; to: string } | { kind: 'delete'; path: string },
  ): void {
    workspaceFileOp(this.root(sessionId), op)
    this.syncCardTools(sessionId)
  }

  /**
   * Run one preset script on behalf of the card's frontend: the prompt face's
   * spawn contract (cwd = `runtime/`, timeout, abort) applied to explicit
   * argv, so `runScript('read.sh', 'state.md')` and the prompt's
   * `{{read('state.md')}}` behave byte-for-byte the same.
   * @param sessionId - session identity.
   * @param name - `preset/scripts/` base name (with or without `.sh`); no separators.
   * @param args - string arguments, one quoted argv each (16KB cap per argument).
   * @param signal - the caller's abort signal.
   * @returns the script's stdout, trimmed, plus the structured failure when the
   *   run failed (script failures ride the value instead of a rejection — the
   *   prompt face's `scriptFailures` philosophy, ported to the frontend face;
   *   infra errors like an unbound session still throw).
   */
  async runScript(sessionId: SessionId, name: string, args: readonly string[], signal: AbortSignal): Promise<{ text: string; failure?: { reason: 'missing' | 'args' | 'exit' | 'timeout' | 'abort'; exitCode?: number } }> {
    const root = this.root(sessionId)
    const executed = await runCardScript(root, name, args, this.ctx.shell, signal)
    if (!executed.ok) {
      return { text: '', failure: { reason: executed.reason, ...(executed.exitCode === undefined ? {} : { exitCode: executed.exitCode }) } }
    }
    return { text: executed.text }
  }

  /**
   * The last player-sourced message text in one session's durable log — the
   * save row's summary line. Composed instruction blocks (the tagged
   * prefix/post pair) never qualify; a long message is bounded to one display
   * line's worth.
   * @param session - the session whose log to read, if live.
   * @returns the joined visible text blocks, or empty when no player message exists.
   */
  private lastPlayerText(session: Session | undefined): string {
    if (session === undefined) return ''
    const events = session.snapshotEvents()
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event?.type !== 'user/message' || event.data.source.kind !== 'user') continue
      return stripInstructions(event.data.content
        .filter((block): block is { type: 'text'; text: string } => block.type === 'text')
        .map(block => block.text))
        .join('')
        .slice(0, 200)
    }
    return ''
  }

  /** Whether any player-sourced message exists in the live session's durable
   *  log — the editability line for the per-card narrator-tools flag: before
   *  the first turn (开局选卡 / 建卡 / 编辑卡) the checkbox is live and every
   *  click persists through writeText/fileOp; once the conversation started it
   *  greys out (a loaded save's snapshot claims count as started). */
  private hasPlayerTurn(session: Session | undefined): boolean {
    if (session === undefined) return false
    return session.snapshotEvents().some(event => event.type === 'user/message' && event.data.source.kind === 'user')
  }

  /** The last completed-turn boundary seq; `null` before any turn ended. */
  private lastTurnEndSeq(session: Session | undefined): number | null {
    if (session === undefined) return null
    const events = session.snapshotEvents()
    for (let index = events.length - 1; index >= 0; index -= 1) {
      const event = events[index]
      if (event?.type === 'turn/end') return event.seq
    }
    return null
  }

  /**
   * The newest autosave stamp that carries a composer draft — the retry point.
   * `listSaves` is mtime-newest-first, so the first qualifying `autosave-*` row
   * is the latest send. An empty draft does not qualify: the client never
   * submits empty text, and re-sending one would dead-end on the send guard.
   * @param root - absolute workspace root.
   */
  private retryStamp(root: string): { name: string; seq: number | null; draft: string } | undefined {
    for (const save of listSaves(root)) {
      if (save.type !== 'auto') continue
      const stamp = readSaveStamp(root, save.name)
      if (stamp === undefined || stamp.draft === undefined || stamp.draft === '') continue
      return { name: save.name, seq: stamp.seq, draft: stamp.draft }
    }
    return undefined
  }

  private root(sessionId: SessionId): string {
    const root = this.workspaces.get(sessionId)
    if (root === undefined) throw new Error(`tavern: session ${String(sessionId)} is not a tavern session`)
    return root
  }

  /**
   * Re-sync the session's main-agent card tools after an engine-side preset
   * mutation, so a new or removed tool script is visible on the CURRENT
   * request rather than one assembly later.
   */
  private syncCardTools(sessionId: SessionId): void {
    const agent = this.ctx.agents.get(sessionId)
    if (agent !== undefined) this.toolSyncs.get(agent)?.()
  }

  private onAgentCreated(agent: Agent): void {
    const main = this.workspaces.get(agent.session.id)
    if (main !== undefined) {
      this.composeMainAgent(agent, main)
      return
    }
    // Only a real subagent driver child is the tail (durable origin stamp);
    // a BFF-forked ordinary child (孵化的存档分支) must NOT compose as one.
    const parent = agent.session.header.origin === 'subagent' ? agent.session.header.parentSession : undefined
    if (parent !== undefined && this.workspaces.has(parent)) {
      this.composeTailAgent(agent, this.workspaces.get(parent) as string)
      return
    }
    const writer = this.writers.get(agent.session.id) ?? this.writerRootOf(agent.session)
    if (writer !== undefined) this.composeWriterAgent(agent, writer)
  }

  /**
   * Resolve a client-minted writer session to its workspace root. Writer tabs
   * bind through the stock `create({cwd})` face — no engine map row exists —
   * so composition recognizes them by the kernel header: the session's cwd IS
   * a workspace root, and it carries no fork lineage (parentSession covers
   * both subagent children and BFF-forked archive branches, which share the
   * cwd but are not writers). Main sessions never reach here (the workspaces
   * map branch returned above).
   */
  private writerRootOf(session: Session): string | undefined {
    if (session.header.parentSession !== undefined) return undefined
    const cwd = session.header.cwd
    if (cwd === undefined) return undefined
    const resolved = resolve(cwd)
    for (const root of this.workspaces.values()) {
      if (resolve(root) === resolved) return root
    }
    return undefined
  }

  /**
   * The card-writing agent: a default dsh agent (product sections and tool
   * face intact) plus three scoped additions — the writer guide section, a
   * guard denying the shell and delegation families (a shell break-out could
   * delete the fixed template paths; a delegated child would re-enter with
   * bash), and approval policy `never` (the stock approval surface does not
   * exist under the tavern root takeover, so an ask would hang invisibly).
   * @param agent - the writer session's agent.
   * @param root - the workspace root the writer is pinned to.
   */
  private composeWriterAgent(agent: Agent, root: string): void {
    if (this.composed.has(agent)) return
    this.composed.add(agent)
    registerWriterGuide(agent.ctx, root)
    // 全开放（2026-09-16）：写卡 agent 持有 standard 的完整工具面（含 shell 与
    // 委派），无 guard。唯一保留的边界是审批策略 never——审批面在酒馆接管下
    // 不存在，需审批的动作（如工作空间外的沙箱升级）会被静默拒绝。
    setApprovalPolicy(agent.session, 'never')
  }

  private composeMainAgent(agent: Agent, root: string): void {
    // agent/created may be followed by a manual composition (a forked child
    // whose creation announcement ran before the workspace rebind); guard so
    // the second call never double-registers.
    if (this.composed.has(agent)) return
    this.composed.add(agent)
    registerCardSections(agent.ctx, root)
    registerAssembleRender(agent.ctx, { root, shell: this.ctx.shell })
    // The narrator-tools flag rides the same sync handle as the card tools —
    // it re-reads per sync (the client's writeText/fileOp flip), so a flag
    // flip lands on the current request boundary without extra bookkeeping.
    this.toolSyncs.set(agent, registerMainAgentTools(agent.ctx, root, this.ctx.shell, () => narratorToolsOn(root)))
    // A fresh binding rewrites the card's history snapshot from this session's
    // durable log — the disposable cache heals whatever the runtime carried in
    // (a loaded save's stale copy, a hand-mangled one, anything).
    {
      const bindTimeZone = this.clientTimeZones.get(agent.session.id)
      void this.enqueueWrite(root, () => {
        writeChatSnapshot(root, agent.session, ...(bindTimeZone === undefined ? [{}] : [{ clientTimeZone: bindTimeZone }]))
        return true
      })
    }
    // The card owns the world: no preset product tools (the own-scoped trio
    // stays — restrictions govern the inherited layers only), no product
    // runtime-context prose in the snapshot, and the assemble listener keeps
    // ONLY the card sections in the system prompt.
    agent.ctx.tools.restrict({ allow: [] })
    agent.ctx.systemPrompt.suppressRuntimeContext()
  }

  private composeTailAgent(agent: Agent, root: string): void {
    // The tail fork's completed-turn cut can sever an inbox pair (a message
    // queued during the parent's final turn, claimed just after it): without
    // repair the tail's first claim runs the parent's player message and the
    // parent re-runs it later — one message, two model turns. The tail owns
    // bookkeeping only; the parent claims its own queue. Seed-scoped, so the
    // tail's own maintenance prompt (delivered after the seed) is untouched.
    repairSeedInbox(agent.session)
    // Same card source as the main agent; the maintenance prompt arrives as
    // the fork's user message. The seed's composed player messages keep their
    // durable tag blocks, so the tail sees exactly the wrapped shape the main
    // agent answered from — no retention rewrite needed.
    registerCardSections(agent.ctx, root)
    registerAssembleRender(agent.ctx, { root, shell: this.ctx.shell })
    registerTailAgentTools(agent.ctx, root, this.ctx.shell)
    agent.ctx.tools.restrict({ allow: [] })
    agent.ctx.systemPrompt.suppressRuntimeContext()
  }

  private onSessionEvent(session: Session, event: SessionEvent): void {
    // The tail child is never workspace-bound, so interception must precede
    // the gate below: its assistant narration buffers for runtime/.chat.tail.jsonl.
    if (event.type === 'assistant/message') {
      const run = this.tailChildRuns.get(session.id)
      if (run !== undefined) run.tailTexts.push(textOfBlocks(event.data.message.content))
    }
    const root = this.workspaces.get(session.id)
    if (root === undefined) return
    // Every durable player/assistant message changes the conversation snapshot
    // the card scripts read; the disposable cache heals on each rewrite.
    if (event.type === 'user/message' || event.type === 'assistant/message') {
      const timeZone = this.clientTimeZones.get(session.id)
      void this.enqueueWrite(root, () => {
        writeChatSnapshot(root, session, ...(timeZone === undefined ? [{}] : [{ clientTimeZone: timeZone }]))
        return true
      })
    }
    // A fresh turn clears any pending stop marker: the stopped turn (if any)
    // already ended, and this turn's bookkeeping proceeds normally.
    if (event.type === 'turn/start') {
      this.stopped.delete(session.id)
      return
    }
    // Only a completed narrative turn produces world facts worth archiving.
    // A stop that raced the completion still cancels the tail here — the
    // player stopped the turn, so no bookkeeping fork may follow it.
    if (event.type !== 'turn/end') return
    // An in-flight gate belongs to an earlier turn and appends the settlement
    // signal in its own finally; a second one here would double-unlock the
    // client's poll into a mid-run stale read.
    if (this.gates.has(session.id)) return
    const stoppedThisTurn = this.stopped.delete(session.id)
    // 幽灵回合根因(2026-09-22):落定信号只覆盖 completed——error/中止回合结束后
    // command/done 永不到达,客户端乐观锁跨重启死等(压错回合的 durable 视图再无新事件)。
    // 修法:每个回合边界都欠恰一条落定信号;完成(未被停赛竞速)走记账链(链尾发),
    // 其余(error/aborted/停赛竞速的完成)无记账——微任务直发,立即解锁。
    if (event.data.reason.kind === 'completed' && !stoppedThisTurn) {
      this.beginTurnSettlement(session, root, event.seq)
      return
    }
    queueMicrotask(() => { this.notifyTailSettled(session) })
  }

  /**
   * The tail gate's settlement signal, appended after EVERY completed turn:
   * a fork's finish through {@link beginTurnSettlement}'s chain, or the disabled
   * tail's zero-work pass-through in {@link onSessionEvent}. The client
   * unlocks its composer solely on this non-turn event — one signal per
   * completed turn is what keeps the optimistic lock from outliving the turn
   * when maintenance is off.
   *
   * 尾代理完成 → 向前端 push 一个非回合事件（command/done）。不能用 turn/end：
   * 它是回合边界事件，会改写 lastTurnEndSeq、污染 fork seed，导致下一次尾代理
   * fork 的 seed 重放错位、子会话 inbox 残留 pending 而循环。command/done 无投影、
   * 非 splice、非 turn 边界，各投影均忽略，安全。
   */
  private notifyTailSettled(session: Session): void {
    try {
      session.append('command/done', {
        commandId: brandString<CommandId>('tavern-tail-done'),
        kind: 'success',
      })
    } catch (error) {
      this.ctx.logger.warn(withHostGuidance('尾代理完成通知', error))
    }
  }

  /**
   * The tail fork's live assistant stream, re-attributed to the PARENT agent so
   * the browser's existing parent follow receives it: child frames go to the
   * child's stream, which no browser follows (one-shot forks are invisible), so
   * without this hop the 数据维护 row can only learn a run's tool calls after the
   * whole run settles. Chunk frames pass through the same wire pipeline as the
   * parent's own (wireAssistantStreamFrame passes raw start/end frames through),
   * and no durable event is written — transients are replay-never, so the
   * parent's log and fork seeds stay untouched.
   *
   * Frame contract: attemptId is namespaced `tavern-tail:<childId>:<attempt>`
   * (collision-free against the parent's own attempts; the UI parses the
   * childId back out); the terminal frame publishes `abandoned` — this stream
   * never carries the child's durable settlement, and a `committed` outcome
   * would trip the client's pending-settlement match into a full rebaseline.
   */
  private transposeTailStream(agent: Agent, frame: AssistantStreamFrame): void {
    const payload = { agent, frame } as { agent: Agent; frame: AssistantStreamFrame; [TRANSPOSED]?: boolean }
    if (payload[TRANSPOSED] === true) return
    const header = agent.session.header
    const parentId = header.origin === 'subagent' ? header.parentSession : undefined
    if (parentId === undefined || !this.workspaces.has(parentId)) return
    const parent = this.ctx.agents.get(parentId)
    if (parent === undefined) return
    const attemptId = brandString<LlmAttemptId>(`${TAIL_STREAM_PREFIX}${String(agent.session.id)}:${String(frame.attemptId)}`)
    const rewritten: AssistantStreamFrame = frame.type === 'end'
      ? { ...frame, attemptId, outcome: { kind: 'abandoned' } }
      : { ...frame, attemptId }
    // The extra symbol prop is the echo guard; cordis listeners read only agent/frame.
    this.ctx.emit('agent/assistant-stream', { agent: parent, frame: rewritten, [TRANSPOSED]: true } as { agent: Agent; frame: AssistantStreamFrame })
  }

  /**
   * A completed turn's strict settlement chain: main → main.after → tail →
   * tail.after, run as one promise held open for the next submission through
   * {@link gates}, and settled with the one tavern-tail-done signal after
   * everything (hooks included — the composer unlocks on finished chain, not
   * mid-hooks). Replaces the previous tail-only gate; called only from
   * {@link onSessionEvent}'s completed branch.
   * @param session - the finished main session.
   * @param root - its workspace root.
   * @param turnSeq - the turn/end event's seq — the tail file's staleness marker.
   */
  private beginTurnSettlement(session: Session, root: string, turnSeq: number): void {
    const controller = new AbortController()
    let release!: () => void
    const mainAfterDone = new Promise<void>(resolve => { release = resolve })
    const run: TurnRun = { controller, mainAfterDone, tailTexts: [] }
    this.tailRuns.set(session.id, run)
    const tailPhase = readMaintenancePrompt(root) === ''
      ? undefined
      : this.spawnTailPhase(session, root, run, turnSeq)
    const settled = (async (): Promise<void> => {
      try {
        try {
          await this.settlePhase('main.after', root, controller.signal)
        } finally {
          // The tail's first step bars on this: released only after the
          // main.after phase settled, hooks done or none. stop() aborts the
          // phase, so no stop ever leaves the child blocked behind the bar.
          release()
        }
        if (tailPhase !== undefined) await tailPhase
      } catch (error) {
        // A tail/hook failure is logged; the chain still settles so the next
        // turn never deadlocks on the gate or the client's optimistic lock.
        this.ctx.logger.warn(withHostGuidance('回合收束链(main.after/尾代理/tail.after)', error))
      } finally {
        this.tailRuns.delete(session.id)
        for (const [childId, entry] of this.tailChildRuns) {
          if (entry === run) this.tailChildRuns.delete(childId)
        }
        this.gates.delete(session.id)
        // The settlement signal is the shared protocol surface (see
        // {@link notifyTailSettled}): the gated-fork path now emits it here too.
        this.notifyTailSettled(session)
      }
    })()
    this.gates.set(session.id, settled)
  }

  /** One hook phase through the shared runner, wired to this engine's seams. */
  private settlePhase(event: HookEvent, root: string, signal: AbortSignal): Promise<void> {
    return runHookPhase({
      root,
      event,
      shell: this.ctx.shell,
      signal,
      // Awaited write-queue item = every prior engine write (snapshot, tail
      // file) is flushed before the first hook script spawns.
      quiesce: () => this.enqueueWrite(root, () => true).then(() => undefined),
      warn: (message) => { this.ctx.logger.warn(message) },
    })
  }

  /**
   * Hatch the tail fork synchronously — this closure is invoked inside the
   * turn-end event dispatch, where required service access is legal — and
   * chain its settlement: child play-through, tail narration file, tail.after
   * phase. The child's first step itself bars on mainAfterDone in the
   * pre-step gate, so the fork hatches here but does no work until the hook
   * phase finished.
   * @returns the tail phase promise; a rejection (child failure/abort) drops
   *   the narration file and tail.after — a tail that did not settle owes no hooks.
   */
  private spawnTailPhase(session: Session, root: string, run: TurnRun, turnSeq: number): Promise<void> {
    const parent = this.ctx.agents.get(session.id)
    if (parent === undefined) return Promise.resolve()
    const phase = (async (): Promise<void> => {
      // The fork starts synchronously with the RAW maintenance prompt: the
      // {{script}} placeholders render in the child's pre-step gate (after the
      // main.after bar) — one render, archived with the child session's log;
      // a failing script keeps its placeholder verbatim.
      const started = await this.ctx.subagents.start('fork', {
        label: 'tavern-tail',
        prompt: [{ type: 'text', text: readMaintenancePrompt(root) }],
        parent,
        signal: run.controller.signal,
      })
      run.childId = started.id
      this.tailChildRuns.set(started.id, run)
      // A stop landing while start() was resolving recorded no childId yet:
      // the fork hatched anyway, so cancel the freshly published child here —
      // the player's stop must not leave a tail running behind it.
      if (run.controller.signal.aborted) {
        this.ctx.agents.get(started.id)?.cancel({ kind: 'parent' })
      }
      await started.result
      // The tail settled: project the buffered narration, then chain tail.after.
      // Queued on the write queue head so the phase's quiesce (first step of
      // runHookPhase) sees it on disk.
      this.tailChildRuns.delete(started.id)
      await this.enqueueWrite(root, () => {
        writeTailSnapshot(root, { sessionId: String(session.id), turnSeq, texts: run.tailTexts })
        return true
      })
      await this.settlePhase('tail.after', root, run.controller.signal)
    })()
    return phase
  }

  /**
   * Stop every in-flight activity of one tavern session, however the player
   * reaches this: the main agent's active turn (cancelled, pending inbox
   * preserved) and the in-flight tail run (its fork child cancelled through
   * its durable parent-address stamp). An idle session stops as a no-op, so
   * the client can fire the stop unconditionally. A mid-flight submission
   * render dies through the caller's own prompt signal.
   */
  stop(sessionId: SessionId): { accepted: true; tailStopped: boolean } {
    // Mark BEFORE cancelling: a turn that completes anyway (the model already
    // finished when the stop landed) must not schedule the tail.
    this.stopped.add(sessionId)
    const main = this.ctx.agents.get(sessionId)
    main?.cancel({ kind: 'user' }, { keepInbox: true })
    const tail = this.tailRuns.get(sessionId)
    let tailStopped = false
    if (tail !== undefined) {
      tailStopped = true
      tail.controller.abort()
      const child = tail.childId === undefined ? undefined : this.ctx.agents.get(tail.childId)
      child?.cancel({ kind: 'parent' })
    } else {
      // 对账补签(2026-09-22 幽灵回合自愈):空闲(无在跑收束链/活性回合)但 durable 视图里
      // 末个 turn/end 之后没有落定信号 → 补发一条。健康会话(签名齐)保持 no-op 不变;
      // Pressing stop on a ghost session is the player-side unlock lever.
      this.healUnsignedSettlement(sessionId)
    }
    return { accepted: true, tailStopped }
  }

  /**
   * Idempotent ghost-turn repair: append the missing settlement signal when
   * the last fully-closed turn has no `tavern-tail-done` after it. 前置(
   * 2026-09-22 引入落定信号全覆盖之前)产生的 error/aborted 回合没有签名,客户端乐观锁
   * 跨重启死等——stop() 在此一次性补签,会话即时解锁。
   */
  private healUnsignedSettlement(sessionId: SessionId): void {
    const session = this.ctx.sessions.get(sessionId)
    if (session === undefined) return
    try {
      if (settlementUnsigned(scanSettlement(session.snapshotEvents()))) this.notifyTailSettled(session)
    } catch (error) {
      this.ctx.logger.warn(withHostGuidance('幽灵回合补签', error))
    }
  }

  private async gate(
    payload: { agent: Agent; messages: UserMessage[]; turn: number; step: number; signal: AbortSignal },
    next: () => Promise<PreStepDecision>,
  ): Promise<PreStepDecision> {
    const gate = this.gates.get(payload.agent.session.id)
    if (gate !== undefined) await gate
    // The tail fork's claimed input is the engine-queued maintenance prompt:
    // resolve its `{{script}}` placeholders here — one render per one-shot
    // tail, archived with the child session's durable claim; a failing script
    // keeps its placeholder verbatim. The main agent's claims never enter this
    // branch (origin stamp), so player text with literal braces is untouched.
    const header = payload.agent.session.header
    const parentId = header.origin === 'subagent' ? header.parentSession : undefined
    const tailRoot = parentId !== undefined ? this.workspaces.get(parentId) : undefined
    // Strict chain: the tail child's first step waits for the main.after
    // phase. When no hooks are registered the bar resolves instantly; a stop
    // during the hooks releases it from the phase's own finally, and the
    // cancelled child never models anyway.
    if (tailRoot !== undefined && parentId !== undefined) {
      const parentRun = this.tailRuns.get(parentId)
      if (parentRun !== undefined) await parentRun.mainAfterDone
    }
    const decision = await next()
    if (decision.kind !== 'enter') return decision
    const claimed = new Set(payload.messages)
    const rendered = await Promise.all(decision.messages.map(async (message) => {
      if (tailRoot === undefined || !claimed.has(message)) return message
      const content = await Promise.all(message.content.map(async (block) => {
        if (block.type !== 'text') return block
        const text = await renderPlaceholders(block.text, tailRoot, this.ctx.shell, payload.signal)
        for (const failure of text.failures) {
          this.ctx.logger.warn(new Error(`tavern: maintenance prompt script "{{${failure.name}}}" failed (${failure.reason})`))
        }
        return { type: 'text' as const, text: text.text }
      }))
      return { ...message, content }
    }))
    // Tavern agents carry no skill/agent-instruction plumbing: strip any
    // `<system-reminder>` injections other pre-step listeners appended
    // (tool-skill catalog, agent-instructions reminders) — tavern listens
    // later, so this filter sees the composed decision and is authoritative.
    const messages = rendered.filter(message => !(
      (message.source as { kind?: unknown }).kind !== 'user'
      && typeof message.content[0] === 'object'
      && 'text' in message.content[0]
      && (message.content[0] as { text?: string }).text?.startsWith('<system-reminder>')
    ))
    // The dynamic-post injector rides last so its messages sit at the tail of
    // the admitted batch, right after the claimed player messages.
    const rides = this.injectPosts(payload)
    return { ...decision, messages: [...messages, ...rides] }
  }

  /**
   * The dynamic-post injector — main tavern agents only. It shadows every
   * live post node of the surface (each is replaced IN POSITION by an
   * empty-content system message: the kernel's own single-live-node pattern —
   * the node stays in the log, projects to no wire message) and returns one
   * rendered post per claim (FIFO from the submission stash) for the loop to
   * append after the claimed player messages. Steps without claims ride
   * nothing: the previous post stays live, so every request of the turn —
   * including later tool-loop steps — still sees it. Tail, writer, and foreign
   * sessions skip both halves (their ids are not main-session ids here); a
   * depleted stash skips the ride visibly instead of pairing off-order.
   * @param payload - the pre-step payload; its turn/step stamp the shadow events.
   * @returns the fresh post messages to append after the step's claims.
   */
  private injectPosts(
    payload: { agent: Agent; messages: UserMessage[]; turn: number; step: number },
  ): UserMessage[] {
    const session = payload.agent.session
    if (payload.messages.length === 0 || this.workspaces.get(session.id) === undefined) return []
    try {
      for (const seq of session.surface.nodes) {
        const event = session.eventAt(seq)
        if (event?.type !== 'user/message') continue
        if (event.data.source.kind !== 'plugin' || event.data.source.plugin !== PLUGIN_SOURCE) continue
        session.append('system/message', {
          turn: payload.turn,
          step: payload.step,
          message: createSystemMessage('', PLUGIN_SOURCE),
        }, {
          surfaceOp: { op: 'replace', startSeq: seq, endSeq: seq },
          sourceEventSeqs: [seq],
        })
      }
    } catch (error) {
      // The ride itself still proceeds: worst case the previous post stays
      // live one extra turn (accumulation on the wire), never a broken turn.
      this.ctx.logger.warn(withHostGuidance('post 影子化退场', error))
    }
    const stash = this.postStash.get(session.id)
    if (stash === undefined) return []
    const rides: UserMessage[] = []
    for (let index = 0; index < payload.messages.length; index += 1) {
      const entry = stash.shift()
      if (entry === undefined) {
        this.ctx.logger.warn(new Error(`tavern: post stash depleted for session ${String(session.id)} — claiming without the instruction message`))
        break
      }
      if (entry.text === '') continue
      rides.push(createUserMessage({
        content: [{ type: 'text', text: entry.text }],
        source: { kind: 'plugin', plugin: PLUGIN_SOURCE, form: 'snapshot', sections: [{ name: 'post', text: entry.text }] },
      }))
    }
    if (stash.length === 0) this.postStash.delete(session.id)
    return rides
  }
}

export default TavernRuntime
export { PRESET_DIR, RUNTIME_DIR, SAVINGS_DIR } from './workspace.ts'
export type { TavernCardMeta, TavernLibraryCard, TavernSave, TavernSessionState, TavernTreeEntry, TavernWorkspaceInfo } from './types.ts'
