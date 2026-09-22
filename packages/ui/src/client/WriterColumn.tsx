/**
 * The card-writing agent column: standard dsh agent conversations pinned to
 * the current card workspace (their session cwd IS the workspace root),
 * rendered as the editor page's third column under a TAB STRIP — the player
 * keeps several writer sessions per workspace and pages through them
 * (‹ n/m ›), opens fresh ones (＋, the stock `create({cwd})` face — blank by
 * definition), and closes one (×, tombstoned into the registry; the durable
 * log drains at the engine's boot GC). Admission goes through the standard
 * client face (`binding.session.prompt`), NOT the tavern `prompt` RPC; stop
 * goes through `binding.session.cancel`. The engine composes every session
 * whose cwd is the workspace root as a writer (guide section + approval
 * never) — no engine-managed singleton anymore.
 *
 * The per-workspace session registry lives at `runtime/.writer-sessions.json`
 * (dot-prefixed → invisible in the editor tree; fenced like any client write).
 * The transcript and composer render through the shared chat-view layer.
 * @module dsh-tavern-fengyue-ui/writer-column
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { ContextBreakdownProjection, ContextPressureProjection, TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { SessionStatsProjection } from '@deepseek-ai/dsh-session-stats/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import appCss from './app/App.module.css'
import writerCss from './TavernView.module.css'
import {
  ChatComposer, ChatLines, MISSING_CREDENTIAL, TranscriptErrorRow, TranscriptPulse, reasoningOf, textBlocksOf,
  useBottomPinnedScroll, useProjectionValue, useSessionSurface,
  type ChatLine, type ConversationFace,
} from './chat-view.tsx'
import { useDialogs } from './dialog.tsx'
import type { TavernRpc } from './rpc.ts'
import { NS } from './locales.ts'

/** The per-workspace writer-session registry (client state; boot-GC'd by the engine). */
const REGISTRY_PATH = 'runtime/.writer-sessions.json'

/** One live writer tab: session id plus its strip label. */
interface WriterTab {
  readonly id: string
  readonly label: string
}

/** Registry shape — mirrors the engine's boot-GC reader field-wise. */
interface WriterRegistry {
  readonly sessions: readonly WriterTab[]
  readonly deleted: readonly string[]
}

/** Parse the registry file; any corruption degrades to an empty registry (the next write heals it). */
function parseRegistry(text: string): WriterRegistry {
  try {
    const raw = JSON.parse(text) as { sessions?: unknown; deleted?: unknown }
    const sessions = Array.isArray(raw.sessions)
      ? raw.sessions.flatMap(entry => {
        if (typeof entry !== 'object' || entry === null) return []
        const id = (entry as { id?: unknown }).id
        const label = (entry as { label?: unknown }).label
        return typeof id === 'string' && id !== '' ? [{ id, label: typeof label === 'string' ? label : '' }] : []
      })
      : []
    const deleted = Array.isArray(raw.deleted) ? raw.deleted.filter((id): id is string => typeof id === 'string' && id !== '') : []
    return { sessions, deleted }
  } catch {
    return { sessions: [], deleted: [] }
  }
}

/**
 * The writer column body for one editing page mount.
 * @param props - faces, the workspace-owning RP session, and the locale seat.
 * @returns the tab strip over the three-column chat pane, or the loading/failure placeholder.
 */
export function WriterColumn(props: {
  rpc: TavernRpc
  sessions: ISessions
  models: ModelDirectoryResolver | undefined
  conversation: ConversationFace
  /** The workspace-owning RP session making the request; writer tabs bind to its workspace. */
  sessionId: string
  checkKey: () => Promise<boolean>
  onNeedKey: () => void
  /** Activity signal for the editor poll's cadence: true while a turn or a live stream is in flight. */
  onActiveChange?: ((active: boolean) => void) | undefined
  t: TranslateNS<typeof NS>
}): ReactNode {
  const { rpc, sessionId, sessions } = props
  const dialogs = useDialogs()
  /** undefined = registry loading; [] = no tabs (empty state with a ＋ seat). */
  const [tabs, setTabs] = useState<readonly WriterTab[] | undefined>(undefined)
  const tabsRef = useRef<readonly WriterTab[]>([])
  const deletedRef = useRef<readonly string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const setTabsState = useCallback((next: readonly WriterTab[]): void => {
    tabsRef.current = next
    setTabs(next)
  }, [])

  /** The workspace root: the RP session's own cwd rides the stock list summary. */
  const workspaceRoot = useCallback((): string | undefined => {
    try {
      const snapshot = sessions.list.getSnapshot()
      const summary = snapshot.byId[sessionId as unknown as SessionId]
      return summary?.cwd
    } catch {
      return undefined
    }
  }, [sessions, sessionId])

  const writeRegistry = useCallback((registry: WriterRegistry): void => {
    deletedRef.current = registry.deleted
    void rpc.writeText({ sessionId, path: REGISTRY_PATH, text: JSON.stringify(registry) }).then(() => undefined, () => undefined)
  }, [rpc, sessionId])

  /** Mint a fresh writer through the stock face, register it, and switch onto it. */
  const createTab = (registry: WriterRegistry): void => {
    const root = workspaceRoot()
    if (root === undefined) {
      console.warn('[tavern] writer create failed: workspace root unknown')
      setTabsState(registry.sessions)
      return
    }
    void sessions.create({ cwd: root }).then((fresh) => {
      const tab: WriterTab = { id: fresh, label: `会话 ${registry.sessions.length + 1}` }
      const next: WriterRegistry = { sessions: [...registry.sessions, tab], deleted: registry.deleted }
      setTabsState(next.sessions)
      setActiveId(tab.id)
      writeRegistry(next)
    }, (error: unknown) => {
      console.warn('[tavern] writer create failed', error)
      setTabsState(registry.sessions)
      void dialogs.alert({ body: props.t('writer.createFailed'), okLabel: props.t('dialog.ok') })
    })
  }

  // 挂载：读注册表 → 有标签取最新一个，没有就走 ＋ 同款的创建路径。
  // deps 只认 rpc/sessionId（换工作空间必须重读）；createTab 经 ref 取最新
  // 闭包——dialog face 的身份每渲染轮换，进 deps 会把本 effect 变成死循环。
  const createTabRef = useRef(createTab)
  createTabRef.current = createTab
  useEffect(() => {
    let disposed = false
    void rpc.readText({ sessionId, path: REGISTRY_PATH }).then(
      (value) => {
        if (disposed) return
        const registry = parseRegistry(value.text)
        deletedRef.current = registry.deleted
        setTabsState(registry.sessions)
        if (registry.sessions.length > 0) setActiveId(registry.sessions.at(-1)!.id)
        else createTabRef.current(registry)
      },
      () => { if (!disposed) createTabRef.current({ sessions: [], deleted: [] }) },
    )
    return () => { disposed = true }
  }, [rpc, sessionId])

  /** 清空当前标签：原地换一个全新会话（旧会话停 + 墓碑，标签位不变）。 */
  const clearActive = (): void => {
    if (activeId === null) return
    const old = tabsRef.current.find(tab => tab.id === activeId)
    void dialogs.confirm({
      title: props.t('writer.tabClearTitle'),
      body: props.t('writer.tabClearBody'),
      confirmLabel: props.t('header.clear'),
      cancelLabel: props.t('app.cancel'),
      danger: true,
    }).then((yes) => {
      if (!yes || old === undefined) return
      const root = workspaceRoot()
      if (root === undefined) return
      // 先建新——创建失败时旧标签原样保留，不清空。
      void sessions.create({ cwd: root }).then((fresh) => {
        const next = tabsRef.current.map(tab => tab.id === old.id ? { id: fresh, label: tab.label } : tab)
        setTabsState(next)
        setActiveId(fresh)
        void rpc.stop({ sessionId: old.id }).then(() => undefined, () => undefined)
        writeRegistry({ sessions: next, deleted: [...deletedRef.current, old.id] })
        void sessions.refresh().then(() => undefined, () => undefined)
      }, (error: unknown) => {
        console.warn('[tavern] writer create failed (clear kept the old tab)', error)
      })
    })
  }

  /** Close the active tab: stop any in-flight turn, tombstone, reconcile the stock list. */
  const closeActive = (): void => {
    if (activeId === null) return
    const closed = tabsRef.current.find(tab => tab.id === activeId)
    void dialogs.confirm({
      title: props.t('writer.tabCloseTitle'),
      body: props.t('writer.tabCloseBody'),
      confirmLabel: props.t('ctx.delete'),
      cancelLabel: props.t('app.cancel'),
      danger: true,
    }).then((yes) => {
      if (!yes || closed === undefined) return
      const next = tabsRef.current.filter(tab => tab.id !== closed.id)
      setTabsState(next)
      setActiveId(next.at(-1)?.id ?? null)
      // 停在途回合（切走后后台回合没有停止面）→ 墓碑 → stock 列表对账。
      void rpc.stop({ sessionId: closed.id }).then(() => undefined, () => undefined)
      writeRegistry({ sessions: next, deleted: [...deletedRef.current, closed.id] })
      void sessions.refresh().then(() => undefined, () => undefined)
    })
  }

  const activeIndex = tabs === undefined ? -1 : tabs.findIndex(tab => tab.id === activeId)
  const step = (delta: number): void => {
    if (tabs === undefined || activeIndex < 0) return
    const next = tabs[activeIndex + delta]
    if (next !== undefined) setActiveId(next.id)
  }

  if (tabs === undefined) {
    return <div className={writerCss.writerCol}><div className={appCss.loading}>{props.t('view.loading')}</div></div>
  }
  return (
    <div className={writerCss.writerCol}>
      <div className={writerCss.writerTabs}>
        <button
          type="button" className={writerCss.writerTabBtn} disabled={activeIndex <= 0}
          title={props.t('writer.tabPrev')} aria-label={props.t('writer.tabPrev')}
          onClick={() => { step(-1) }}
        >‹</button>
        <span className={writerCss.writerTabPos}>{tabs.length === 0 ? '0/0' : `${activeIndex + 1}/${tabs.length}`}</span>
        <button
          type="button" className={writerCss.writerTabBtn} disabled={activeIndex < 0 || activeIndex >= tabs.length - 1}
          title={props.t('writer.tabNext')} aria-label={props.t('writer.tabNext')}
          onClick={() => { step(1) }}
        >›</button>
        <span className={writerCss.writerTabSpacer} />
        <button
          type="button" className={writerCss.writerTabBtn} disabled={workspaceRoot() === undefined}
          title={props.t('writer.tabNew')} aria-label={props.t('writer.tabNew')}
          onClick={() => { createTab({ sessions: tabsRef.current, deleted: deletedRef.current }) }}
        >＋</button>
        <button
          type="button" className={`${writerCss.writerTabBtn} ${writerCss.writerTabDanger}`} disabled={activeId === null}
          title={props.t('writer.tabClear')} aria-label={props.t('writer.tabClear')}
          onClick={clearActive}
        >↺</button>
        <button
          type="button" className={`${writerCss.writerTabBtn} ${writerCss.writerTabDanger}`} disabled={activeId === null}
          title={props.t('writer.tabClose')} aria-label={props.t('writer.tabClose')}
          onClick={closeActive}
        >×</button>
      </div>
      {activeId === null ? (
        <div className={appCss.loading}>{props.t('writer.none')}</div>
      ) : (
        <WriterChat
          sessions={props.sessions} models={props.models} conversation={props.conversation}
          writerId={activeId} onActiveChange={props.onActiveChange}
          checkKey={props.checkKey} onNeedKey={props.onNeedKey} t={props.t}
        />
      )}
      {dialogs.dialog}
    </div>
  )
}

function WriterChat(props: {
  sessions: ISessions
  models: ModelDirectoryResolver | undefined
  conversation: ConversationFace
  writerId: string
  /** Activity signal for the editor poll's cadence (see WriterColumn). */
  onActiveChange?: ((active: boolean) => void) | undefined
  checkKey: () => Promise<boolean>
  onNeedKey: () => void
  t: TranslateNS<typeof NS>
}): ReactNode {
  const { t } = props
  // A writer id is a plain wire string; the client list store brands ids.
  // Memoized: the binding must be identity-stable across renders — the
  // aggregation effect subscribes through it.
  const binding = useMemo(
    () => props.sessions.binding(props.writerId as unknown as SessionId),
    [props.sessions, props.writerId],
  )
  // The writer is never the current session, so its history window stays cold
  // until someone opens it. Two carriers, same effect (pull the tail page +
  // live tail into this column's own eventSource WITHOUT moving the current
  // selection): fork hosts carry the `openWindow` service method; stock hosts
  // expose the public per-session `open()`
  // ("First open: pull the tail page", idempotent, selection untouched —
  // selection is the separately-addressed manager.select()). Both are read
  // pulls over the writer session's own log; neither appends durable events.
  useEffect(() => {
    const sessions = props.sessions as ISessions & { openWindow?: (id: SessionId) => void }
    if (typeof sessions.openWindow === 'function') {
      sessions.openWindow(props.writerId as unknown as SessionId)
      return
    }
    if (binding === undefined) return
    void (binding.session as { open?: () => Promise<void> }).open?.()
  }, [props.sessions, props.writerId, binding])
  // The Session snapshot drives the stop seat and the admission-failure row,
  // exactly like the stock chat and the RP transcript.
  const { running, openBroken, promptBroken } = useSessionSurface(binding)
  const [lines, setLines] = useState<readonly ChatLine[]>([])
  const [draft, setDraft] = useState('')
  const [turnError, setTurnError] = useState<{ message: string; missingKey: boolean } | null>(null)
  const [pending, setPending] = useState(false)
  /** Live reasoning deltas are streaming right now (the 思考 row carries them). */
  const [thinking, setThinking] = useState(false)
  /** Live narrative deltas are streaming right now (the body row carries them). */
  const [texting, setTexting] = useState(false)
  const promptAbort = useRef<AbortController | undefined>(undefined)

  const usage = useProjectionValue<TokenUsageProjection>(binding, 'tokenUsage')
  const pressure = useProjectionValue<ContextPressureProjection>(binding, 'contextPressure')
  const breakdown = useProjectionValue<ContextBreakdownProjection>(binding, 'contextBreakdown')
  const sessionStats = useProjectionValue<SessionStatsProjection>(binding, 'sessionStats')

  // 换写卡会话时清流式态（读 pass 立即重置，但闪烁窗口内不得误吞打字点）。
  useEffect(() => {
    setThinking(false); setTexting(false); setPending(false)
  }, [props.writerId])
  // 活动信号上报：回合在途或流式中 = active（编辑器轮询用 2s 快档——只有这个
  // 窗口才可能有新写盘）；空闲塌到慢档纯兜底。onActiveChange 缺省 = 无消费者。
  useEffect(() => {
    props.onActiveChange?.(running || pending || thinking || texting)
  }, [running, pending, thinking, texting, props.onActiveChange])

  const directory = useMemo(() => {
    try { return props.models?.directoryFor(props.writerId as unknown as SessionId) } catch (error) {
      console.warn('[tavern] model directory unavailable', error)
      return undefined
    }
  }, [props.models, props.writerId])

  // 底部钉屏：与 RP 转写同一共享钩子（靠近底部跟随更新，打开/刷新落到最新一行）。
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  useBottomPinnedScroll(transcriptRef)

  // Transcript facts from the writer session's event stream. The shapes match
  // the RP aggregation; the tavern-specific faces (opening page, wrap strip,
  // tail rows, sidebar lines) do not apply here.
  useEffect(() => {
    if (binding === undefined) return
    const source = binding.eventSource
    const read = (): void => {
      /* jscpd:ignore-start -- the aggregation loop mirrors the RP transcript's
         reader by contract (same event shapes); the bodies diverge by design
         (no wrap strip, no tail rows, no sidebar lines here). */
      const out: ChatLine[] = []
      let sawOutput = false
      let liveThink = ''
      let liveBody = ''
      for (const entry of source.getSnapshot().entries) {
        if (entry.type === 'transient') {
          const chunk = (entry.event as { data?: { chunk?: { type?: string; text?: string } } }).data?.chunk
          if (chunk?.type === 'reasoning-delta' && typeof chunk.text === 'string') liveThink += chunk.text
          else if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') liveBody += chunk.text
          continue
        }
        const event = entry.event as { type?: string; data?: Record<string, unknown>; time?: unknown; surfaceOp?: unknown }
        const data = event.data ?? {}
        /* jscpd:ignore-end */
        const time = typeof event.time === 'number' ? event.time : undefined
        if (event.type === 'user/message') {
          const sourceKind = (data.source as { kind?: unknown } | undefined)?.kind
          if (sourceKind !== 'user' || event.surfaceOp !== 'append') continue
          // A user/message `data` IS the message (blocks at the data level);
          // some durable shapes wrap it under `data.message` — mirror the RP
          // reader's fallback so the player bubble always lands.
          const rawBlocks = textBlocksOf(data['message'])
          const body = (rawBlocks.length > 0 ? rawBlocks : textBlocksOf(data['content'])).join('')
          if (body !== '') out.push({ kind: 'user', text: body, time, args: undefined, live: false })
        } else if (event.type === 'assistant/message') {
          const reasoning = reasoningOf(data)
          if (reasoning.trim() !== '') out.push({ kind: 'think', text: reasoning, time, args: undefined, live: false })
          const raw = data['node'] !== undefined ? data['node'] : data['message']
          const body = typeof raw === 'string' ? raw : textBlocksOf(raw).join('')
          if (body !== '') { out.push({ kind: 'narrative', text: body, time, args: undefined, live: false }); sawOutput = true }
        } else if (event.type === 'tool/call') {
          const call = (data['root'] ?? data['call'] ?? data) as { name?: unknown; arguments?: unknown }
          if (typeof call.name === 'string') {
            out.push({ kind: 'tool', text: call.name, time, args: typeof call.arguments === 'string' ? call.arguments : undefined, live: false })
          }
        } else if (event.type === 'turn/end') {
          sawOutput = true
          /* jscpd:ignore-start -- the turn-failure line pairs with the writer
             column by contract (same durable reason shape); the RP reader
             adds wrap/tail faces the writer omits. */
          const reason = data['reason'] as { kind?: string; error?: { message?: string; code?: string } } | undefined
          if (reason?.kind === 'error') {
            // A failed turn enters the transcript as a history line so the
            // next message appends after it, not beneath a lingering banner.
            out.push({
              kind: 'error',
              text: reason.error?.code === MISSING_CREDENTIAL ? t('chat.errorKey') : reason.error?.message ?? '',
              time,
              args: undefined,
              live: false,
            })
          }
          /* jscpd:ignore-end */
          setPending(false)
        }
      }
      const live = liveThink.trim() !== ''
      if (live) out.push({ kind: 'think', text: liveThink, time: undefined, args: undefined, live: true })
      // 正文流式：落定后 durable assistant/message 原子换掉该行（同 RP 转写）。
      const liveText = liveBody.trim() !== ''
      if (liveText) {
        out.push({ kind: 'narrative', text: liveBody.trim(), time: undefined, args: undefined, live: true })
        sawOutput = true
      }
      setThinking(live)
      setTexting(liveText)
      if (sawOutput) setPending(false)
      setLines(out)
    }
    read()
    return source.subscribe(read)
  }, [binding])

  const stop = (): void => {
    // The writer owns no card-tool subprocesses or tail forks: cancelling the
    // admission round-trip and the running turn is the whole stop surface.
    if (promptAbort.current !== undefined) promptAbort.current.abort()
    promptAbort.current = undefined
    setPending(false)
    void binding?.session.cancel().then(() => undefined, () => undefined)
  }

  const send = (): void => {
    const text = draft.trim()
    if (text === '' || binding === undefined) return
    if (running || pending) return
    void props.checkKey().then((missing) => {
      if (missing) { props.onNeedKey(); return }
      setTurnError(null)
      setDraft('')
      setPending(true)
      const controller = new AbortController()
      promptAbort.current = controller
      // Standard admission: the writer session is a plain dsh session, so the
      // client face queues the raw text directly (no wrap pair, no engine hop).
      void binding.session.prompt([{ type: 'text', text }], 'queue', controller.signal).then((result) => {
        if (promptAbort.current === controller) promptAbort.current = undefined
        if (!result.ok) {
          setTurnError({ message: result.error.message, missingKey: false })
          setPending(false)
        }
      }, (error: unknown) => {
        /* jscpd:ignore-start -- the admission-failure tail pairs with the RP
           send() by contract: both settle the abort handle, treat a
           stop-triggered abort as the user's gesture, and surface the error. */
        if (promptAbort.current === controller) promptAbort.current = undefined
        // A stop-triggered abort is the user's own gesture, not a failure.
        if (controller.signal.aborted) { setPending(false); return }
        setTurnError({ message: error instanceof Error ? error.message : String(error), missingKey: false })
        setPending(false)
        /* jscpd:ignore-end */
      })
    })
  }

  return (
    <>
      <div ref={transcriptRef} className={appCss.transcript}>
        <div className={appCss.col}>
          <ChatLines lines={lines} t={t} tailDetail={() => undefined} loadTailDetails={() => undefined} />
          <TranscriptErrorRow
            turnError={turnError} openBroken={openBroken} promptBroken={promptBroken}
            onNeedKey={props.onNeedKey} t={t}
          />
          <TranscriptPulse
            running={running} pending={pending} thinking={thinking} texting={texting}
            empty={lines.length === 0 && !running && !pending} emptyText={t('writer.empty')}
          />
        </div>
      </div>
      <ChatComposer
        directory={directory}
        usage={usage} pressure={pressure} breakdown={breakdown} sessionStats={sessionStats}
        draft={draft} onDraft={setDraft}
        onSend={send} stoppable={running || pending} onStop={stop}
        placeholder={t('writer.placeholder')} t={t}
      />
    </>
  )
}
