/**
 * REAL-composition coverage for the tavern engine: a test-only `cordis.yml`
 * composes the real engine with the shipping core loop through the real
 * Loader (`packages/CLAUDE.md` policy). Only the external LLM is mocked — a
 * scripted adapter drives the main agent's narrative turns and the tail
 * agent's bookkeeping tool round by call order. The `sessionController` the
 * engine injects is a thin test stub (the BFF assembly layer it stands in for
 * has its own owner, `packages/api/session-controller`); it forwards `create`
 * to the real `agents` factory so session creation, `agent/created`
 * composition, the turn-end tail fork, and the pre-step gate all run on the
 * shipped loop, asserted through model-visible and durable surfaces.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import LlmRuntime, { LlmAdapter, LlmError, createUserMessage } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt'
import SubagentRuntime from '@deepseek-ai/dsh-subagent'
import SubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'
import { ToolRuntime } from '@deepseek-ai/dsh-tools'
import * as forkProvider from '@deepseek-ai/dsh-subagent-fork-in-process'
import BashLocalShell from '@deepseek-ai/dsh-bash-local'
import * as BashTool from '@deepseek-ai/dsh-tool-bash'
import * as SubagentTool from '@deepseek-ai/dsh-tool-subagent'
import * as ShellEnv from '@deepseek-ai/dsh-shell-env'
import TavernRuntime from '../src/index.ts'
import { dshHomePath } from '@deepseek-ai/dsh-home-paths'
/** One recorded model call: the request facts the adapter observed. */
interface RecordedCall {
  tools: { name: string; parameters: unknown }[]
  userTexts: string[]
  lastUserText: string
  priorUserText: string
  system: string
}

/** One scripted model behavior, consumed by call order. */
type ScriptStep = { kind: 'text'; text: string } | { kind: 'tool-call'; name: string; arguments: string } | { kind: 'fail' } | { kind: 'hang' }

const CARD_SYSTEM = '世界规则：组合测试卡。'
const CARD_PREFIX = '前缀X'
const CARD_POST = '后缀Y'
const MAINTENANCE = '维护提示词正文：{{tail_state()}} 更新 runtime/deed.md。'
/** The maintenance prompt's rendered form: the tail script's stdout replaces the placeholder at fork time. */
const RENDERED_MAINTENANCE = '维护提示词正文：第三天 更新 runtime/deed.md。'
/** The card-writing agent's marker file inside a workspace root. */
const WRITER_MARKER = '.tavern-writer'

/** The scripted external LLM: one behavior per request, recording the request view. */
class ScriptedTavernAdapter extends LlmAdapter {
  readonly calls: RecordedCall[] = []
  /** For each hang step: whether the loop's own phase signal ended it. */
  readonly hangsAborted: boolean[] = []
  private step = 0
  constructor(private readonly script: readonly ScriptStep[]) { super() }

  async * stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    const step = this.script[this.step]
    this.step += 1
    const textOf = (message: { role: string; content: { type: string; text?: string }[] }): string =>
      message.content.map(block => block.type === 'text' ? block.text ?? '' : '').join('')
    const users = options.messages.filter(message => message.role === 'user')
    const systemMessage = options.messages.find(message => message.role === 'system')
    const system = systemMessage === undefined ? '' : textOf(systemMessage)
    this.calls.push({
      tools: (options.tools ?? []).map(tool => ({ name: tool.name, parameters: tool.parameters as unknown })),
      userTexts: users.map(user => textOf(user)),
      lastUserText: users.length > 0 ? textOf(users.at(-1) as typeof users[number]) : '',
      priorUserText: users.length > 1 ? textOf(users.at(-2) as typeof users[number]) : '',
      system,
    })
    if (step === undefined) throw new LlmError('script exhausted', 'SERVER')
    if (step.kind === 'fail') throw new LlmError('provider outage', 'SERVER')
    if (step.kind === 'hang') {
      // Park the request like a slow provider would, until the loop's
      // phase signal aborts — the stop path must end this turn.
      await new Promise<void>((resolve) => {
        const signal = options.signal
        if (signal?.aborted) { resolve(); return }
        signal?.addEventListener('abort', () => { resolve() }, { once: true })
      })
      this.hangsAborted.push(options.signal?.aborted === true)
      throw new LlmError('cancelled by stop', 'CANCELLED')
    }
    if (step.kind === 'text') {
      yield { type: 'block-start', index: 0, blockType: 'text' }
      yield { type: 'text-delta', index: 0, text: step.text }
      yield { type: 'block-end', index: 0, block: { type: 'text', text: step.text } }
      yield { type: 'finish', reason: { kind: 'stop' } }
      return
    }
    yield { type: 'block-start', index: 0, blockType: 'tool-call' }
    yield { type: 'tool-call-delta', index: 0, id: 'call-tail' as never, name: step.name, argumentsDelta: step.arguments }
    yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: 'call-tail' as never, name: step.name, arguments: step.arguments } }
    yield { type: 'finish', reason: { kind: 'tool-calls' } }
  }
}

/** Test-only BFF stub: the engine's sessionController seam, forwarded to the real factory. */
class SessionControllerStub extends Service {
  /** Every create the engine issued — the preset-free assertion reads it. */
  readonly creations: { sessionId: SessionId; agentPreset?: string }[] = []

  constructor(ctx: Context) { super(ctx, 'sessionController') }

  async create(request: { sessionId: SessionId; cwd: string; agentPreset?: string }): Promise<{ agent: unknown }> {
    const preset = request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset }
    this.creations.push({ sessionId: request.sessionId, ...preset })
    return await (this.ctx.agents as unknown as {
      create(options: Record<string, unknown>): Promise<{ agent: unknown }>
    }).create({
      sessionId: request.sessionId,
      agentOptions: { provider: 'tavern-mock', model: 'mock-a' },
      meta: { cwd: request.cwd },
    })
  }

  /**
   * Mirror of the BFF prompt admission for text-only content: the composed
   * content is persisted verbatim as the accepted user message (rpcId kept),
   * then handed to the real loop's queue edge.
   */
  async prompt(request: {
    sessionId: SessionId
    requestId: string
    mode: 'queue' | 'steer'
    content: readonly { type: string; text?: string }[]
    clientTimeZone?: string
  }): Promise<{ accepted: true }> {
    const agent = (this.ctx.agents as unknown as {
      get(id: SessionId): { followup(message: unknown): void; steer?(message: unknown): void } | undefined
    }).get(request.sessionId)
    if (agent === undefined) throw new Error(`stub prompt: session ${String(request.sessionId)} has no live agent`)
    const message = createUserMessage({
      content: request.content.map(part => ({ type: 'text', text: part.text ?? '' })),
      source: {
        kind: 'user',
        rpcId: request.requestId,
        ...(request.clientTimeZone === undefined ? {} : { clientTimeZone: request.clientTimeZone }),
      },
    })
    if (request.mode === 'steer') agent.steer?.(message)
    else agent.followup(message)
    return { accepted: true }
  }

  /**
   * Mirror of the BFF fork anchor rule: atSeq lands on the first `turn/end` at
   * or after it, and the cut advances to the NEXT `turn/start` so inter-turn
   * events (wrap snapshots, queue ledger commits) ride along in the seed —
   * including, when the source has diverged turns, a ledger commit whose claim
   * the cut leaves behind.
   */
  async fork(request: { sessionId: SessionId; atSeq?: number }): Promise<{ sessionId: SessionId }> {
    const sessionsFace = this.ctx.sessions as unknown as {
      get(id: SessionId): {
        header: { cwd?: string; id: SessionId }
        snapshotEvents(): { type: string; seq: number }[]
      } | undefined
    }
    const source = sessionsFace.get(request.sessionId)
    if (source === undefined) throw new Error(`stub fork: source ${String(request.sessionId)} is not live`)
    const events = source.snapshotEvents()
    const atSeq = request.atSeq
    const anchored = atSeq === undefined
      ? undefined
      : events.find(event => event.type === 'turn/end' && event.seq >= atSeq)
    const boundaryEvent = anchored ?? [...events].reverse().find(event => event.type === 'turn/end')
    if (boundaryEvent === undefined) throw new Error('stub fork: source has no completed turn')
    let cut = boundaryEvent.seq + 1
    while (cut < events.length && events[cut]?.type !== 'turn/start') cut += 1
    const seed = events.slice(0, cut)
    const registry = this.ctx.agents as unknown as {
      create(options: Record<string, unknown>): Promise<{ agent: unknown }>
    }
    const freshId = SessionId(`session-${randomUUID()}`)
    await registry.create({
      sessionId: freshId,
      seed,
      inheritedEventCount: seed.length,
      meta: { ...(source.header.cwd === undefined ? {} : { cwd: source.header.cwd }), parentSession: source.header.id, isSeeded: true },
      agentOptions: { provider: 'tavern-mock', model: 'mock-a' },
    })
    return { sessionId: freshId }
  }
}

const sessionControllerStub = {
  name: 'test-session-controller-stub',
  inject: ['agents'],
  Config: z.object({}),
  apply(ctx: Context): void {
    new SessionControllerStub(ctx)
  },
}

let context: Context | undefined
let root: string | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) rmSync(root, { recursive: true, force: true })
  root = undefined
})

/** Compose the real plugin tree from a test-only cordis.yml with isolated roots. */
async function compose(options: { workspaceBase: string; libraryBase: string }): Promise<Context> {
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-llm', LlmRuntime],
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@deepseek-ai/dsh-system-prompt', SystemPrompt],
    ['@deepseek-ai/dsh-tools', ToolRuntime],
    ['@deepseek-ai/dsh-agent', AgentRegistry],
    ['@deepseek-ai/dsh-agent-loop', AgentLoop],
    ['@deepseek-ai/dsh-subprocess-local', SubprocessRuntime],
    ['@deepseek-ai/dsh-bash-local', BashLocalShell],
    ['@deepseek-ai/dsh-shell-env', ShellEnv],
    ['@deepseek-ai/dsh-tool-bash', BashTool],
    ['@deepseek-ai/dsh-tool-subagent', SubagentTool],
    ['@deepseek-ai/dsh-subagent', SubagentRuntime],
    ['@deepseek-ai/dsh-subagent-fork-in-process', forkProvider],
    ['test-session-controller-stub', sessionControllerStub],
    ['tavern-engine-test', TavernRuntime],
  ])
  // `@deepseek-ai/dsh-shell` is the abstract capability declaration: the
  // provider (bash-local) registers the `shell` service itself.
  const lines = [
    "- name: '@deepseek-ai/dsh-llm'",
    "- name: '@deepseek-ai/dsh-session'",
    "- name: '@deepseek-ai/dsh-session-projection'",
    "- name: '@deepseek-ai/dsh-system-prompt'",
    "- name: '@deepseek-ai/dsh-tools'",
    "- name: '@deepseek-ai/dsh-agent'",
    "- name: '@deepseek-ai/dsh-agent-loop'",
    "- name: '@deepseek-ai/dsh-subprocess-local'",
    "- name: '@deepseek-ai/dsh-bash-local'",
    "- name: '@deepseek-ai/dsh-shell-env'",
    "- name: '@deepseek-ai/dsh-tool-bash'",
    '- name: \'@deepseek-ai/dsh-tool-subagent\'',
    '  config:',
    '    provider: fork',
    "- name: '@deepseek-ai/dsh-subagent'",
    "- name: '@deepseek-ai/dsh-subagent-fork-in-process'",
    "- name: 'test-session-controller-stub'",
    "- name: 'tavern-engine-test'",
    '  config:',
    `    workspaceBase: ${options.workspaceBase}`,
    `    libraryBase: ${options.libraryBase}`,
  ]
  const configPath = join(root as string, 'cordis.yml')
  writeFileSync(configPath, [...lines, ''].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root as string).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

/** Seed the isolated library with one playable card. */
function seedCard(libraryBase: string): void {
  const card = join(libraryBase, 'probe-card', 'preset')
  for (const dir of ['prompt', 'setup', 'tools', 'scripts']) mkdirSync(join(card, dir), { recursive: true })
  writeFileSync(join(card, 'prompt', 'systemPrompt'), CARD_SYSTEM)
  // A retired non-empty prefixPrompt must stay inert data: no request reads it.
  writeFileSync(join(card, 'prompt', 'prefixPrompt'), CARD_PREFIX)
  writeFileSync(join(card, 'prompt', 'postPrompt'), CARD_POST)
  writeFileSync(join(card, 'prompt', 'maintenancePrompt'), MAINTENANCE)
  writeFileSync(join(card, 'scripts', 'tail_state.mjs'), 'console.log(\'第三天\')\n')
  writeFileSync(join(card, 'tools', 'weather.mjs'), [
    '/** @tavern-schema',
    '{',
    '  "description": "查询城市天气",',
    '  "parameters": { "city": { "type": "string", "required": true } }',
    '}',
    '*/',
    'console.log(`weather for ${args.city}`)',
  ].join('\n'))
  writeFileSync(join(card, 'meta.json'), JSON.stringify({ title: '组合卡', desc: '', cover: '' }))
  writeFileSync(join(card, 'setup', 'state.md'), 'day 1')
}

/**
 * The hooks fixture card: both hook faces registered in `preset/hooks.json`,
 * the maintenance prompt rendering a `{{script}}` that reads the main hook's
 * write — the rendered claim therefore proves the first-step bar ordering.
 */
/**
 * The Furina galgame fixture: REAL card files copied byte-for-byte from
 * tavern_presets/芙宁娜 (scripts, manifest, prompts, hooks) plus a tiny 1x1
 * jpg stand-in for the CG image (readAsset is not in the engine plane).
 * The REAL composition then drives one scripted turn whose reply carries the
 * trailing directive comment block — asserting the whole chain: post render
 * (cg_brief through real bash) → turn → main.after hook → runtime/cg.json.
 */
function seedGalgameCard(libraryBase: string): void {
  const real = join(import.meta.dirname, '..', '..', '..', 'tavern_presets', '芙宁娜', 'preset')
  const card = join(libraryBase, 'galgame-card', 'preset')
  for (const dir of ['prompt', 'scripts', 'assets/cg']) mkdirSync(join(card, dir), { recursive: true })
  for (const f of ['scripts/cg_brief.mjs', 'scripts/apply_directives.mjs', 'scripts/gal_data.mjs', 'assets/cg/manifest.json', 'hooks.json', 'prompt/postPrompt']) {
    writeFileSync(join(card, f), readFileSync(join(real, f), 'utf8'))
  }
  writeFileSync(join(card, 'prompt', 'systemPrompt'), '你是芙宁娜。')
  writeFileSync(join(card, 'prompt', 'maintenancePrompt'), '')
  writeFileSync(join(card, 'meta.json'), JSON.stringify({ title: 'galgame 卡', desc: '', cover: '' }))
}

function seedHooksCard(libraryBase: string): void {
  const card = join(libraryBase, 'hooks-card', 'preset')
  for (const dir of ['prompt', 'setup', 'tools', 'scripts']) mkdirSync(join(card, dir), { recursive: true })
  writeFileSync(join(card, 'prompt', 'systemPrompt'), '卡系统。\n')
  writeFileSync(join(card, 'prompt', 'postPrompt'), '后注。\n')
  writeFileSync(join(card, 'prompt', 'maintenancePrompt'), '维护:{{hook_seen()}}\n')
  writeFileSync(join(card, 'scripts', 'hook_main.mjs'), [
    "import { appendFileSync, readFileSync } from 'node:fs'",
    "const rows = readFileSync('.chat.snapshot.jsonl', 'utf8').trim().split('\\n').map(line => JSON.parse(line))",
    "const last = rows.filter(row => row.kind === 'assistant').at(-1)",
    "appendFileSync('mainhook.txt', `MAIN:${last?.plain ?? '(none)'}\\n`)",
    "console.log('ok')",
  ].join('\n'))
  writeFileSync(join(card, 'scripts', 'hook_seen.mjs'), [
    "import { existsSync, readFileSync } from 'node:fs'",
    "console.log(existsSync('mainhook.txt') ? readFileSync('mainhook.txt', 'utf8').trim() : '(missing)')",
  ].join('\n'))
  writeFileSync(join(card, 'scripts', 'hook_tail.mjs'), [
    "import { appendFileSync, readFileSync } from 'node:fs'",
    "const rows = readFileSync('.chat.tail.jsonl', 'utf8').trim().split('\\n').map(line => JSON.parse(line))",
    "const last = rows.filter(row => row.role === 'assistant').at(-1)",
    "appendFileSync('tailhook.txt', `TAIL:${last?.text ?? '(none)'}\\n`)",
    "console.log('ok')",
  ].join('\n'))
  writeFileSync(join(card, 'hooks.json'), JSON.stringify({
    hooks: { 'main.after': ['hook_main.mjs'], 'tail.after': ['hook_tail.mjs'] },
  }))
  writeFileSync(join(card, 'meta.json'), JSON.stringify({ title: '钩子卡', desc: '', cover: '' }))
  writeFileSync(join(card, 'setup', 'state.md'), '状态\n')
}

describe('写卡助手 agent REAL composition', () => {
  it('ensureWriter 幂等且跨重启恢复;组合为普通 agent——引导 section、无卡/尾工具、approval never;shell 守卫放行（委派族仍拦）', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-comp-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([
      // writer turn 1, then the denied bash attempt, then the continuation.
      { kind: 'text', text: '写卡代理回合。' },
      { kind: 'tool-call', name: 'bash', arguments: 'rm -rf preset/prompt' },
      { kind: 'text', text: '被拒后继续。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)
    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    const rootPath = engine.workspaceOf(sessionId) as string

    // ensureWriter: idempotent per workspace, persisted in the marker.
    const writerId = await engine.ensureWriter(sessionId)
    expect(await engine.ensureWriter(sessionId)).toBe(writerId)
    expect(readFileSync(join(rootPath, WRITER_MARKER), 'utf8').trim()).toBe(writerId)

    interface AgentHandle { followup(message: unknown): void; whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const controller = ctx.get('sessionController') as unknown as {
      prompt(request: { sessionId: SessionId; requestId: string; mode: 'queue'; content: { type: string; text: string }[] }): Promise<{ accepted: true }>
    }
    const writerAgent = agents.get(writerId)
    expect(writerAgent).toBeDefined()

    // Writer turn 1: a default dsh agent plus the guide section — the card's
    // own system, the card tool, and the tail trio are all absent from the face.
    await controller.prompt({ sessionId: writerId, requestId: 'writer-1', mode: 'queue', content: [{ type: 'text', text: '帮我打磨 systemPrompt' }] })
    await writerAgent!.whenIdle()
    const call = adapter.calls.at(0)
    expect(call).toBeDefined()
    expect(call?.system).toContain('card-writing assistant')
    expect(call?.system).toContain('preset/prompt/')
    expect(call?.lastUserText).toBe('帮我打磨 systemPrompt')
    const names = call?.tools.map(tool => tool.name) ?? []
    expect(names).not.toContain('weather')
    expect(names).not.toContain('runtimeCreate')
    expect(names).not.toContain('runtimeUpdate')
    expect(names).not.toContain('runtimeWrite')
    expect(names).not.toContain('runtimeEdit')
    // 全开放（2026-09-16）：无守卫。host 层 tool-bash/tool-subagent 全局注册，
    // writer 无 restrict 全部可见（真实 app 的 standard preset 再叠 fs/web/todo）。
    expect(names).toContain('bash')
    expect(names).toContain('subagent')

    // approval/policy never landed durably on the writer session.
    const sessionsFace = ctx.sessions as unknown as {
      get(id: SessionId): { snapshotEvents(): { type: string; data: Record<string, unknown> }[] } | undefined
    }
    expect(sessionsFace.get(writerId)!.snapshotEvents().some(event =>
      event.type === 'approval/policy' && (event.data as { policy?: string }).policy === 'never',
    )).toBe(true)

    // 放开（2026-09-15）：shell 工具不再被守卫拦截——本地单用户、卡作者即宿主，
    // fs 的 workspace-write 围栏对 bash 本来不设防，双层防线只需守委派族；
    // 固定提示词依旧存活（模型此轮并未真的执行删除，仅为走通回合）。
    await controller.prompt({ sessionId: writerId, requestId: 'writer-2', mode: 'queue', content: [{ type: 'text', text: '试试删掉固定提示词' }] })
    await writerAgent!.whenIdle()
    expect(existsSync(join(rootPath, 'preset', 'prompt', 'systemPrompt'))).toBe(true)
    expect(adapter.calls.length).toBeGreaterThanOrEqual(3)
    expect(adapter.calls[2]?.userTexts).toContain('试试删掉固定提示词')

    // Restart restore: a fresh engine on the same roots rebuilds both maps
    // from the markers, and ensureWriter returns the SAME writer id without
    // creating a session (no stub creation row beyond the replayed main one).
    const first = context
    context = undefined
    await first?.fiber.dispose()
    const ctx2 = await compose({ workspaceBase, libraryBase })
    const engine2 = ctx2.tavernService
    expect(await engine2.ensureWriter(sessionId)).toBe(writerId)
  })

  it('客户端自建的 cwd=工作空间 会话按写卡合成（stock create({cwd}) 路径）', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-cwdwriter-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([{ kind: 'text', text: '好的。' }])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)
    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    const rootPath = engine.workspaceOf(sessionId) as string

    // stock 会话面的 create({cwd})：绕过 ensureWriter，不经 writers 映射——
    // 合成必须按 cwd 识别（标签条的建会话路径）。
    const controller = ctx.get('sessionController') as unknown as {
      create(request: { sessionId: SessionId; cwd: string }): Promise<unknown>
      prompt(request: { sessionId: SessionId; requestId: string; mode: 'queue'; content: { type: string; text: string }[] }): Promise<{ accepted: true }>
    }
    const freshId = SessionId(`session-cwdwriter-${randomUUID()}`)
    await controller.create({ sessionId: freshId, cwd: rootPath })
    const agents = ctx.agents as unknown as { get(id: SessionId): { whenIdle(): Promise<void> } | undefined }
    const agent = agents.get(freshId)
    expect(agent).toBeDefined()

    await controller.prompt({ sessionId: freshId, requestId: 'cwd-writer-1', mode: 'queue', content: [{ type: 'text', text: '帮我看看卡' }] })
    await agent!.whenIdle()
    // 引导 section 与 approval never 都按写卡落地——cwd 识别生效。
    const call = adapter.calls.at(-1)
    expect(call?.system).toContain('card-writing assistant')
    expect(call?.system).toContain('preset/prompt/')
    const sessionsFace = ctx.sessions as unknown as {
      get(id: SessionId): { snapshotEvents(): { type: string; data: Record<string, unknown> }[] } | undefined
    }
    expect(sessionsFace.get(freshId)!.snapshotEvents().some(event =>
      event.type === 'approval/policy' && (event.data as { policy?: string }).policy === 'never',
    )).toBe(true)
  })

  it('writerLogGC：boot 排空墓碑写卡日志（精确按 id，活会话不动）', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-wgc-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    const rootPath = engine.workspaceOf(sessionId) as string

    // 注册表：一个活 writer + 一个墓碑；durable 存储里伪造两个日志目录。
    const liveId = `session-gclive-${randomUUID()}`
    const deadId = `session-gcdead-${randomUUID()}`
    writeFileSync(join(rootPath, 'runtime', '.writer-sessions.json'), JSON.stringify({
      sessions: [{ id: liveId, label: '会话 1' }],
      deleted: [deadId],
    }))
    // 新会话的 durable 目录惰性落盘——项目目录由引擎的 projectKeyOf 编码直接定位。
    const sessionsRoot = dshHomePath('sessions')
    const projectDir = join(sessionsRoot, engine.projectKeyOf(rootPath))
    mkdirSync(join(projectDir, liveId), { recursive: true })
    mkdirSync(join(projectDir, deadId), { recursive: true })

    // 重启 = boot GC 排空：墓碑目录消失、活目录原样、墓碑已消费。
    const first = context
    context = undefined
    await first?.fiber.dispose()
    const ctx2 = await compose({ workspaceBase, libraryBase })
    void ctx2
    expect(existsSync(join(projectDir, deadId))).toBe(false)
    expect(existsSync(join(projectDir, liveId))).toBe(true)
    const registry = JSON.parse(readFileSync(join(rootPath, 'runtime', '.writer-sessions.json'), 'utf8')) as { deleted: string[] }
    expect(registry.deleted).toEqual([])
  })
})

describe('tavern engine REAL composition through the shipping loop', () => {
  /**
   * The one dynamically injected post message every claimed step carries: the
   * rendered `postPrompt` body. The card also ships a non-empty retired
   * `prefixPrompt` file (see `seedCard`) as a negative fixture — nothing may
   * read it into the message.
   */
  const postMessage = CARD_POST
  let rpcSeq = 0
  /** Admit one composed prompt through the engine's real submission path. */
  const submit = async (engine: TavernRuntime, sessionId: SessionId, text: string): Promise<void> => {
    rpcSeq += 1
    await engine.prompt({ sessionId, text, requestId: `rpc-${String(rpcSeq)}`, clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
  }

  it('composes card prompts, persists the wrap in the composed prompt, and runs the tail agent behind the gate', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-comp-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    expect(ctx.get('tavernService')).toBeDefined()

    const adapter = new ScriptedTavernAdapter([
      // main turn 1 → tail fork 1 (tool round + continuation) → main turn 2
      // → tail fork 2 (update round + continuation) → main turn 3 fails.
      { kind: 'text', text: '叙事一。' },
      { kind: 'tool-call', name: 'runtimeWrite', arguments: JSON.stringify({ path: 'deed.md', content: '回合一记账' }) },
      { kind: 'text', text: '已记账。' },
      { kind: 'text', text: '叙事二。' },
      { kind: 'tool-call', name: 'runtimeEdit', arguments: JSON.stringify({ path: 'deed.md', old_str: '回合一记账', new_str: '回合二记账' }) },
      { kind: 'text', text: '已记完。' },
      { kind: 'fail' },
      // Post-reset turn on the fresh session, then its bookkeeping.
      { kind: 'text', text: '重启叙事。' },
      { kind: 'tool-call', name: 'runtimeWrite', arguments: JSON.stringify({ path: 'deed.md', content: '重启后记账' }) },
      { kind: 'text', text: '已记。' },
      // Post-load turn continuing from the save-point fork, then bookkeeping.
      { kind: 'text', text: '从存档点继续。' },
      { kind: 'tool-call', name: 'runtimeEdit', arguments: JSON.stringify({ path: 'state.md', old_str: 'day 1', new_str: '存档后续' }) },
      { kind: 'text', text: '已续。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    // The session was just created through the engine, so the root is present.
    const rootPath = engine.workspaceOf(sessionId) as string

    interface AgentHandle { followup(message: unknown): void; whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)
    expect(agent).toBeDefined()

    await submit(engine, sessionId, '第一回合')
    await agent!.whenIdle()
    // The tail fork runs async behind the completed turn; its deed lands before the next request passes the gate.
    await vi.waitFor(() => {
      expect(readFileSync(join(rootPath, 'runtime', 'deed.md'), 'utf8')).toBe('回合一记账')
    }, { timeout: 20_000, interval: 100 })
    // Protocol pairing: the completed turn settles with exactly ONE
    // tavern-tail-done after its turn/end — the client unlocks on this event
    // alone, so the fork path owes one per completed turn too.
    const settled = (ctx.sessions as unknown as {
      get(id: SessionId): { snapshotEvents(): { type: string; seq: number; data: Record<string, unknown> }[] } | undefined
    }).get(sessionId)!.snapshotEvents()
    const turnEnds = settled.filter(event => event.type === 'turn/end')
    const dones = settled.filter(event => event.type === 'command/done'
      && (event.data as { commandId?: unknown }).commandId === 'tavern-tail-done')
    expect(turnEnds).toHaveLength(1)
    expect(dones).toHaveLength(1)
    expect(dones[0]!.seq).toBeGreaterThan(turnEnds[0]!.seq)

    await submit(engine, sessionId, '第二回合')
    await agent!.whenIdle()
    // Checkpoint AFTER the round's bookkeeping lands (a player's 存档 includes
    // the tail's write): the save stamps its boundary (session + last
    // turn/end) so a later 载入 can fork history back to EXACTLY this point.
    await vi.waitFor(() => {
      expect(readFileSync(join(rootPath, 'runtime', 'deed.md'), 'utf8')).toBe('回合二记账')
    }, { timeout: 20_000, interval: 100 })
    engine.save(sessionId, 'checkpoint', '')
    // A failed turn must not schedule another tail round.
    await submit(engine, sessionId, '第三回合')
    await agent!.whenIdle()


    // 清空: the workspace rebinds to a fresh session — empty history, runtime
    // re-seeded, savings kept — and the fresh world composes identically.
    const freshId = await engine.reset(sessionId)
    expect(freshId).not.toBe(sessionId)
    expect(engine.workspaceOf(freshId)).toBe(rootPath)
    expect(engine.workspaceOf(sessionId)).toBeUndefined()
    expect(readFileSync(join(rootPath, 'runtime', 'state.md'), 'utf8')).toBe('day 1')
    expect(existsSync(join(rootPath, 'runtime', 'deed.md'))).toBe(false)
    const freshAgent = agents.get(freshId)
    expect(freshAgent).toBeDefined()
    await submit(engine, freshId, '第四回合')
    await freshAgent!.whenIdle()

    // Main-agent tool face: the card's own tool entries plus the read pair —
    // no preset product tools, no generic escape hatch.
    expect((adapter.calls[0]?.tools ?? []).map(tool => tool.name).sort()).toEqual(['runtimeGrep', 'runtimeRead', 'weather'])
    // The schema'd tool's parameters reach the wire: the model sees the named
    // parameter contract, not free-text usage notes.
    const weather = adapter.calls[0]?.tools.find(tool => tool.name === 'weather')
    expect(weather?.parameters).toMatchObject({ type: 'object', required: ['city'], properties: { city: { type: 'string' } } })
    // Tail-agent tool face: exactly the fixed five.
    expect((adapter.calls[1]?.tools ?? []).map(tool => tool.name).sort()).toEqual(['runtimeDelete', 'runtimeEdit', 'runtimeGrep', 'runtimeRead', 'runtimeWrite'])

    // The card IS the whole system prompt — byte-exact, no product lines,
    // and no product snapshot prose rides along.
    expect(adapter.calls[0]?.system).toBe(CARD_SYSTEM)
    expect(adapter.calls[1]?.system).toBe(CARD_SYSTEM)
    // Turn 1's view: the claim plus the one ridden post.
    expect(adapter.calls[0]?.userTexts).toHaveLength(2)

    // The dynamic post rides after the claim: turn 1's view = raw claim + one
    // post message (the player message itself is the bare text).
    expect(adapter.calls[0]?.userTexts).toEqual(['第一回合', postMessage])
    // Turn 2: turn 1's post is shadowed out of the view; the fresh one rides.
    expect(adapter.calls[3]?.userTexts).toEqual(['第一回合', '第二回合', postMessage])
    expect(adapter.calls[3]?.userTexts[0]).toBe('第一回合')

    // The tail fork's seed carried the claim and the LIVE post verbatim — the
    // exact shape the main agent answered from; its own maintenance message
    // stays the last user text.
    const tailUsers = adapter.calls[1]?.userTexts ?? []
    expect(tailUsers.at(-1)).toContain(RENDERED_MAINTENANCE)
    expect(tailUsers).toContain('第一回合')
    expect(tailUsers).toContain(postMessage)

    // The failed third turn reached the model as the seventh call.
    expect(adapter.calls[6]?.userTexts).toEqual(['第一回合', '第二回合', '第三回合', postMessage])

    const freshTurn = adapter.calls[7]
    expect(freshTurn?.system).toBe(CARD_SYSTEM)
    expect(freshTurn?.userTexts).toEqual(['第四回合', postMessage])
    // No pre-reset history survives in the fresh session's request view.
    expect(freshTurn?.userTexts.some(text => text.includes('第三回合') || text.includes('第一回合'))).toBe(false)
    await vi.waitFor(() => {
      expect(readFileSync(join(rootPath, 'runtime', 'deed.md'), 'utf8')).toBe('重启后记账')
    }, { timeout: 20_000, interval: 100 })

    // Call order: main(1), fork(1) tool-call, fork(1) continuation, main(2),
    // fork(2) tool-call, fork(2) continuation, main(3) fail, [清空 → fresh
    // session] main(4), fork(3) tool-call, fork(3) continuation.
    expect(adapter.calls).toHaveLength(10)

    // 载入: rebind the workspace to a fork of the SAVE-POINT session —
    // history rolls back to the checkpoint (turn 1+2 only), runtime/ returns
    // to the snapshot, and the diverged fresh session stays archived unbound.
    const loadedId = (await engine.load(freshId, 'checkpoint')).sessionId
    expect(loadedId).not.toBe(freshId)
    expect(engine.workspaceOf(loadedId)).toBe(rootPath)
    expect(engine.workspaceOf(freshId)).toBeUndefined()
    expect(readFileSync(join(rootPath, 'runtime', 'deed.md'), 'utf8')).toBe('回合二记账')
    expect(readFileSync(join(rootPath, 'runtime', 'state.md'), 'utf8')).toBe('day 1')
    const loadedAgent = agents.get(loadedId)
    expect(loadedAgent).toBeDefined()
    const sessionsFace = ctx.sessions as unknown as {
      get(id: SessionId): {
        ownEvents(): { type: string; data: Record<string, unknown> }[]
        snapshotEvents(): { type: string; data: Record<string, unknown> }[]
      } | undefined
    }
    // The seed's severed ledger commit (第三回合's queue entry, claimed by the
    // source after the checkpoint) must be reconciled: zero automatic activity
    // between 载入 and the player's first input — no claim, no request.
    expect(adapter.calls).toHaveLength(10)
    const loadedOwned = sessionsFace.get(loadedId)!.ownEvents()
    // The child's own region holds the kernel's end-seed marker and nothing
    // but reconciliation splices — no claim, no message, no turn.
    expect(loadedOwned.every(event => event.type === 'agent/inbox/spliced' || event.type === 'session/end-seed')).toBe(true)
    expect(loadedOwned.some(event =>
      event.type === 'agent/inbox/spliced' && (event.data as { outcome?: string }).outcome === 'canceled',
    )).toBe(true)
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(adapter.calls).toHaveLength(10)
    await submit(engine, loadedId, '第五回合')
    await loadedAgent!.whenIdle()
    const loadedTurn = adapter.calls[10]
    expect((loadedTurn?.tools ?? []).map(tool => tool.name).sort()).toEqual(['runtimeGrep', 'runtimeRead', 'weather'])
    // The checkpoint fork seed kept turn 1+2 as plain claims with turn 2's
    // post live (its shadow had not fired by the boundary); turn 5's injector
    // shadowed that live post and rode a fresh one.
    expect(loadedTurn?.userTexts).toEqual(['第一回合', '第二回合', '第五回合', postMessage])
    // History is the checkpoint prefix: turn 1+2 present, nothing after.
    expect(loadedTurn?.userTexts.some(text => text.includes('第一回合'))).toBe(true)
    expect(loadedTurn?.userTexts.some(text => text.includes('第二回合'))).toBe(true)
    expect(loadedTurn?.userTexts.some(text => text.includes('第三回合') || text.includes('第四回合'))).toBe(false)
    await vi.waitFor(() => {
      expect(readFileSync(join(rootPath, 'runtime', 'state.md'), 'utf8')).toBe('存档后续')
    }, { timeout: 20_000, interval: 100 })

    // Durable: player claims land as the bare text (no tags, no strip), every
    // claimed step carries exactly one plugin-attributed post message, each
    // post after the first is shadowed by an in-position empty system node
    // (the model-visible view carries one), and the product runtime-context
    // snapshot stays suppressed in both sessions.
    for (const [index, id] of [sessionId, freshId].entries()) {
      const events = sessionsFace.get(id)!.snapshotEvents()
      const userMessages = events.filter(event => event.type === 'user/message')
      const postMessages = userMessages.filter(event => (event.data.source as { plugin?: string } | undefined)?.plugin === 'dsh-tavern-fengyue-engine')
      const raws = index === 0 ? ['第一回合', '第二回合', '第三回合'] : ['第四回合']
      expect(postMessages).toHaveLength(raws.length)
      for (const row of postMessages) {
        const blocks = (row.data.content as { type: string; text?: string }[]).map(block => block.type === 'text' ? block.text ?? '' : '')
        expect(blocks).toEqual([postMessage])
      }
      const shadows = events.filter(event => event.type === 'system/message'
        && Array.isArray((event.data as { message?: { content?: unknown[] } }).message?.content)
        && ((event.data as { message?: { content?: unknown[] } }).message?.content ?? []).length === 0)
      expect(shadows).toHaveLength(index === 0 ? raws.length - 1 : 0)
      const runtimeContext = userMessages.filter(event => (event.data.source as { plugin?: string } | undefined)?.plugin === '@deepseek-ai/dsh-system-prompt')
      expect(runtimeContext).toHaveLength(0)
      const playerMessages = userMessages.filter(event => (event.data.source as { kind?: string } | undefined)?.kind === 'user')
      expect(playerMessages).toHaveLength(raws.length)
      for (const [i, row] of playerMessages.entries()) {
        const blocks = (row.data.content as { type: string; text?: string }[]).map(block => block.type === 'text' ? block.text ?? '' : '')
        expect(blocks).toEqual([raws[i] as string])
      }
    }

    // Main-agent sessions run on the `empty` preset (no product tools /
    // persona / context — the card composes its own tools and restricts the
    // inherited surface empty); the card-writing agent runs on `standard`.
    // 模型可见工具边界（2026-09-16 钉死）：主请求 = 卡工具 + runtimeRead/Grep，
    // 无 minimal/host 产品的 bash/subagent（restrict({allow:[]}) 剥全部继承层）；
    // 尾请求 = runtime* 五件，同无。写卡 agent 的全开放断言在 ensureWriter 用例。
    const mainNames = adapter.calls[0]?.tools.map(tool => tool.name) ?? []
    expect(mainNames).toContain('weather')
    expect(mainNames).toContain('runtimeRead')
    expect(mainNames).toContain('runtimeGrep')
    expect(mainNames).not.toContain('bash')
    expect(mainNames).not.toContain('subagent')
    const tailNames = adapter.calls[1]?.tools.map(tool => tool.name) ?? []
    expect(tailNames).toEqual(expect.arrayContaining(['runtimeRead', 'runtimeGrep', 'runtimeWrite', 'runtimeEdit', 'runtimeDelete']))
    expect(tailNames).not.toContain('bash')
    expect(tailNames).not.toContain('subagent')

    const controller = ctx.get('sessionController') as unknown as { creations: { agentPreset?: string }[] }
    expect(controller.creations.length).toBe(2)
    expect(controller.creations.every(row => row.agentPreset === 'empty')).toBe(true)

    // The engine autosaves at the SEND moment now — one snapshot per submitted
    // message (five sends: 第一…第五回合), none at turn ends or tail rounds
    // (four bookkeeping runs happened; none added a save). Names read as local
    // time to the second, and each row's summary is the submitted text.
    const rows = engine.saves(loadedId)
    const autos = rows.filter(row => row.type === 'auto')
    expect(autos).toHaveLength(5)
    for (const row of autos) {
      expect(row.name).toMatch(/^autosave-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2}(-\d+)?$/)
    }
    // Newest first: one row per send, newest = the load-continuation turn.
    expect(autos.map(row => row.summary)).toEqual(['第五回合', '第四回合', '第三回合', '第二回合', '第一回合'])
    expect(rows.find(row => row.name === 'checkpoint')?.summary).toBe('第二回合')
    // The stamps carry the composer draft (the retry-point payload) and a fork
    // boundary — except the sends with no completed turn behind them (the very
    // first send and the first send after 清空), whose retry path resets.
    const stamps = JSON.parse(readFileSync(join(rootPath, 'savings', '.tavern-boundaries.json'), 'utf8')) as Record<string, { seq: number | null; draft?: string }>
    const autoStamps = autos.map(row => stamps[row.name]).filter(stamp => stamp !== undefined)
    expect(autoStamps.map(stamp => stamp.draft)).toEqual(['第五回合', '第四回合', '第三回合', '第二回合', '第一回合'])
    expect(autoStamps[0]?.seq).not.toBeNull()
    expect(autoStamps[1]?.seq).toBeNull()
    expect(autoStamps[4]?.seq).toBeNull()
    // The checkpoint's manual stamp carries the boundary but an empty draft
    // (nothing was in the composer) — it never qualifies as a retry point.
    expect(stamps['checkpoint']?.seq).not.toBeNull()
    expect(stamps['checkpoint']?.draft).toBe('')
    // retryPoint: the newest autosave (第五回合, forkable) rebinds to a fresh
    // fork of the same boundary and hands back the submitted text verbatim.
    const retry = await engine.retryPoint(loadedId)
    expect(retry.text).toBe('第五回合')
    expect(retry.sessionId).not.toBe(loadedId)
    expect(engine.workspaceOf(retry.sessionId)).toBe(rootPath)
    expect(engine.workspaceOf(loadedId)).toBeUndefined()
  })

  it('hooks:严格串行链 main→main.after→tail(首步闸)→tail.after,正文文件先于钩子落盘', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-hookscore-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedHooksCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([
      { kind: 'text', text: '叙事甲。' },    // main turn: the hook reads it from the snapshot.
      { kind: 'text', text: '维护一轮。' },  // tail fork: one narration step, buffered for the tail file.
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)
    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'hooks-card')
    const rootPath = engine.workspaceOf(sessionId) as string

    const agents = ctx.agents as unknown as { get(id: SessionId): { whenIdle(): Promise<void> } | undefined }
    const agent = agents.get(sessionId)
    expect(agent).toBeDefined()

    await submit(engine, sessionId, '第一回合')
    await agent!.whenIdle()
    const runtimeDir = join(rootPath, 'runtime')
    // main.after: 本轮主代理正文已在快照里,钩子逐字拿到。
    await vi.waitFor(() => {
      expect(readFileSync(join(runtimeDir, 'mainhook.txt'), 'utf8')).toBe('MAIN:叙事甲。\n')
    }, { timeout: 20_000, interval: 50 })
    // tail.after: 尾代叙述经 .chat.tail.jsonl 到达钩子。
    await vi.waitFor(() => {
      expect(readFileSync(join(runtimeDir, 'tailhook.txt'), 'utf8')).toBe('TAIL:维护一轮。\n')
    }, { timeout: 20_000, interval: 50 })

    const events = (ctx.sessions as unknown as {
      get(id: SessionId): { snapshotEvents(): { type: string; seq: number; data: Record<string, unknown> }[] } | undefined
    }).get(sessionId)!.snapshotEvents()
    const turnEndSeq = events.filter(event => event.type === 'turn/end').at(-1)!.seq
    // 尾文件的 head 带的就是本回合的 seq——陈旧判定面。
    const tailHead = JSON.parse(readFileSync(join(runtimeDir, '.chat.tail.jsonl'), 'utf8').split('\n')[0] as string) as { type: string; turnSeq: number; ranAt: string }
    expect(tailHead).toMatchObject({ type: 'head', turnSeq: turnEndSeq })
    expect(typeof tailHead.ranAt).toBe('string')
    // 首步闸证据:维护提示词在 main.after 写盘之后渲染,归档认领里必须看到钩子产物。
    const tailUsers = adapter.calls[1]?.userTexts ?? []
    expect(tailUsers.at(-1)).toContain('MAIN:叙事甲。')
    // The chain settles with exactly one tavern-tail-done, after its turn/end.
    // 落定信号晚于钩子产物半拍(链 finally 里的 append 异步回读)——同 gate 等待,防读早。
    await vi.waitFor(() => {
      const current = (ctx.sessions as unknown as {
        get(id: SessionId): { snapshotEvents(): { type: string; seq: number; data: Record<string, unknown> }[] } | undefined
      }).get(sessionId)!.snapshotEvents()
      const localTurnEndSeq = current.filter(event => event.type === 'turn/end').at(-1)!.seq
      const dones = current.filter(event => event.type === 'command/done'
        && (event.data as { commandId?: unknown }).commandId === 'tavern-tail-done')
      expect(dones).toHaveLength(1)
      expect(dones[0]!.seq).toBeGreaterThan(localTurnEndSeq)
    }, { timeout: 20_000, interval: 50 })
  })

  it('galgame:回复末尾指令块→main.after 机械落盘 cg.json;postPrompt 渲染出 CG 菜单(真卡脚本逐字节)', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-galgame-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedGalgameCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([
      // 回复正文 + 末尾指令块(Manifest 在册序号 1)——协议契约见 cg_brief.mjs。
      { kind: 'text', text: '水色灯光亮起,她提起裙摆。终究,今晚的舞台只属于你一个人。\n<!--\ncg: 1\n-->' },
      { kind: 'text', text: '她收起笑意。\n<!--\ncg: 1\n-->' },
      { kind: 'text', text: '再一轮(幂等)。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)
    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'galgame-card')
    const rootPath = engine.workspaceOf(sessionId) as string

    const agents = ctx.agents as unknown as { get(id: SessionId): { whenIdle(): Promise<void> } | undefined }
    const agent = agents.get(sessionId)
    expect(agent).toBeDefined()

    await submit(engine, sessionId, '今晚的舞台真美')
    await agent!.whenIdle()
    // 全链:回合完成 →钩子解析末块 → 幂等写 runtime/cg.json(在册 id)。
    // 钩子在回合收束链上异步落盘(与既有 hooks 用例同款节奏)——waitFor 而非直读。
    await vi.waitFor(() => {
      expect(JSON.parse(readFileSync(join(rootPath, 'runtime', 'cg.json'), 'utf8'))).toEqual({ id: '1' })
    }, { timeout: 15_000, interval: 100 })
    // postPrompt 渲染面:提交的 post 消息携带 CG 菜单与当前态(真 bash 跑 cg_brief 的产物)。
    const posts = adapter.calls[0]?.userTexts ?? []
    expect(posts.at(-1)).toContain('[视觉演出·指令协议]')
    expect(posts.at(-1)).toContain('正常——平常对话的默认神态')
    // gal_data 面板 op(真 bash):数据泵契约三件(rev/data/assetKeys)与台词剥离。
    // F1 结构面:runScript 返回 {text, failure?},脚本失败不抛——这里顺带断言 failure 缺席。
    const panelValue = await engine.runScript(sessionId, 'gal_data.mjs', [JSON.stringify({ op: 'panel' })], new AbortController().signal)
    expect(panelValue.failure).toBeUndefined()
    const panel = JSON.parse(panelValue.text) as { ok: boolean; assetKeys: string[]; data: { lastAssistant: { text: string } } }
    expect(panel.ok).toBe(true)
    expect(panel.assetKeys).toEqual(['preset/assets/cg/1.jpg'])
    expect(panel.data.lastAssistant.text).toContain('水色灯光亮起')
    expect(panel.data.lastAssistant.text).not.toContain('<!--')
    // 指令块不在册的软化路径:钩子 warn 后保留现值,回合照常收束(下面的第二轮用 1 号重复幂等)。
    await submit(engine, sessionId, '换个场景')
    await agent!.whenIdle()
    await vi.waitFor(() => {
      expect(JSON.parse(readFileSync(join(rootPath, 'runtime', 'cg.json'), 'utf8'))).toEqual({ id: '1' })
    }, { timeout: 15_000, interval: 100 })
  })

  it('幽灵回合·error 落定:provider 断流的回合也欠恰一条 tavern-tail-done(无记账链,立即解锁)', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-ghost-err-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([
      { kind: 'text', text: '叙事一。' },
      { kind: 'fail' },       // provider 断流(SSE broken)→ 回合以 error 收束
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)
    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    const agents = ctx.agents as unknown as { get(id: SessionId): { whenIdle(): Promise<void> } | undefined }
    const agent = agents.get(sessionId)
    expect(agent).toBeDefined()

    await submit(engine, sessionId, '第一回合')
    await agent!.whenIdle()

    await submit(engine, sessionId, '断流回合')
    await agent!.whenIdle()
    const events = () => (ctx.sessions as unknown as {
      get(id: SessionId): { snapshotEvents(): { type: string; seq: number; data: Record<string, unknown> }[] } | undefined
    }).get(sessionId)!.snapshotEvents()
    const turnEnds = events().filter(event => event.type === 'turn/end')
    expect(turnEnds.at(-1)!.data['reason']).toMatchObject({ kind: 'error' })
    // 落定信号恰落在 error turn/end 之后——修复前这里永不到达(跨重启锁死 composer)。
    await vi.waitFor(() => {
      const dones = events().filter(event => event.type === 'command/done'
        && (event.data as { commandId?: unknown }).commandId === 'tavern-tail-done')
      expect(dones).toHaveLength(2)
      expect(dones.at(-1)!.seq).toBeGreaterThan(turnEnds.at(-1)!.seq)
    }, { timeout: 15_000, interval: 100 })
    // error 回合无记账:尾代理不排(无新的 turn/start 超出两回合)。
    expect(events().filter(event => event.type === 'turn/start')).toHaveLength(2)
  })

  it('幽灵回合·对账补签:健康会话空闲 stop 保持 no-op(零新事件)', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-ghost-noop-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedGalgameCard(libraryBase)   // maintenance 空、无尾代——收束链短,真空闲可等

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([{ kind: 'text', text: '叙事一。\n<!--\ncg: 1\n-->' }])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)
    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'galgame-card')
    const agents = ctx.agents as unknown as { get(id: SessionId): { whenIdle(): Promise<void> } | undefined }

    await submit(engine, sessionId, '第一回合')
    await agents.get(sessionId)!.whenIdle()
    const events = () => (ctx.sessions as unknown as {
      get(id: SessionId): { snapshotEvents(): { type: string; seq: number }[] } | undefined
    }).get(sessionId)!.snapshotEvents()
    // 真空闲 = 回合收束链已发落定信号(main.after 钩子链走完)。
    await vi.waitFor(() => {
      expect(events().filter(e => e.type === 'command/done').length).toBeGreaterThanOrEqual(1)
    }, { timeout: 15_000, interval: 100 })
    const before = events().length

    engine.stop(sessionId)   // 空闲且签名齐——补签门判无事
    await new Promise(resolve => setTimeout(resolve, 600))
    expect(events().length).toBe(before)
  })

  it('透流改道:尾子代理的助手流帧以父 agent 名义流出（tavern-tail: 前缀 attemptId，end=abandoned）', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-tail-stream-'))
    const ctx = await compose({ workspaceBase: join(root, 'workspaces'), libraryBase: join(root, 'presets') })
    seedCard(join(root, 'presets'))

    // Record every stream frame the root dispatch sees: the transposer
    // re-emits child frames under the PARENT agent, so parent-attributed
    // frames carrying the tavern-tail: prefix are the transpose's receipt.
    interface FrameRecord { agentId: string; frame: { type: string; attemptId?: string; outcome?: unknown; chunk?: { type?: string; text?: string } } }
    const frames: FrameRecord[] = []
    ctx.on('agent/assistant-stream', (payload: { agent: { session: { id: SessionId } }; frame: FrameRecord['frame'] }) => {
      frames.push({ agentId: String(payload.agent.session.id), frame: payload.frame })
    })

    const adapter = new ScriptedTavernAdapter([
      { kind: 'text', text: '叙事一。' },
      { kind: 'tool-call', name: 'runtimeWrite', arguments: JSON.stringify({ path: 'deed.md', content: '回合一记账' }) },
      { kind: 'text', text: '已记账。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    const rootPath = engine.workspaceOf(sessionId) as string
    interface AgentHandle { whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)

    await engine.prompt({ sessionId, text: '第一回合', requestId: 'rpc-ts-1', clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    await agent!.whenIdle()
    await vi.waitFor(() => { expect(engine.state(sessionId).tailRunning).toBe(false) }, { timeout: 20_000, interval: 50 })

    const transposed = frames.filter(row => row.agentId === sessionId && typeof row.frame.attemptId === 'string'
      && row.frame.attemptId.startsWith('tavern-tail:'))
    expect(transposed.length).toBeGreaterThan(0)
    // The live reply text of the tail fork streamed through, folded from the
    // parent-attributed transient frames.
    const streamedText = transposed
      .filter(row => row.frame.type === 'chunk' && row.frame.chunk?.type === 'text-delta')
      .map(row => row.frame.chunk?.text ?? '')
      .join('')
    expect(streamedText).toContain('已记账')
    // The parent stream has no durable settlement for a child attempt —
    // the terminal frame must publish `abandoned` (never `committed`, which
    // would trip the client's pending-settlement match into a rebaseline).
    const end = transposed.find(row => row.frame.type === 'end')
    expect(end?.frame.outcome).toEqual({ kind: 'abandoned' })
    expect(readFileSync(join(rootPath, 'runtime', 'deed.md'), 'utf8')).toBe('回合一记账')
  })

  it('尾代理关闭：completed 回合照发落定信号——解锁协议成对、闸门全程不置', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-tail-off-'))
    const ctx = await compose({ workspaceBase: join(root, 'workspaces'), libraryBase: join(root, 'presets') })
    seedCard(join(root, 'presets'))

    // 无维护可跑：脚本里没有尾回合的份——每个叙事回合后引擎走零工作关闭分支。
    const adapter = new ScriptedTavernAdapter([
      { kind: 'text', text: '叙事一。' },
      { kind: 'text', text: '叙事二。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    const rootPath = engine.workspaceOf(sessionId) as string
    // 明确关闭 = maintenancePrompt 缺席（ENOENT → ''，与空文件同一条关闭分支）。
    rmSync(join(rootPath, 'preset', 'prompt', 'maintenancePrompt'))

    interface AgentHandle { whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)
    const sessionsFace = ctx.sessions as unknown as {
      get(id: SessionId): { snapshotEvents(): { type: string; seq: number; data: Record<string, unknown> }[] } | undefined
    }
    const tailDones = (events: { type: string; seq: number; data: Record<string, unknown> }[]): { seq: number }[] =>
      events.filter(event => event.type === 'command/done'
        && (event.data as { commandId?: unknown }).commandId === 'tavern-tail-done')

    await engine.prompt({ sessionId, text: '第一回合', requestId: 'rpc-off-1', clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    await agent!.whenIdle()

    const events = sessionsFace.get(sessionId)!.snapshotEvents()
    const turnEnd = [...events].reverse().find(event => event.type === 'turn/end')
    expect(turnEnd).toBeDefined()
    // 成对性：本 completed 回合恰一条落定信号，且 seq 晚于 turn/end——前端解锁
    // 只认这一条非回合事件，维护关闭时零工作也必须如约发送（旧行为在此静默
    // return，乐观锁永悬）。
    expect(tailDones(events)).toHaveLength(1)
    expect(tailDones(events)[0]!.seq).toBeGreaterThan(turnEnd!.seq)
    // 关闭态：turn/end 分发内同步返回、不置闸门——state() 全程读不到 true。
    expect(engine.state(sessionId).tailRunning).toBe(false)

    await engine.prompt({ sessionId, text: '第二回合', requestId: 'rpc-off-2', clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    await agent!.whenIdle()
    // 第二回合再次成对：零工作路径按回合照发，前端永远等得到解锁信号。
    expect(tailDones(sessionsFace.get(sessionId)!.snapshotEvents())).toHaveLength(2)
  })

  it('记账对账:尾代理不重跑父会话排队中的玩家消息', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-tail-repair-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([
      // main turn 1 → tail fork 1 (tool round + continuation) → main turn 2
      // → tail fork 2 (update round + continuation).
      { kind: 'text', text: '叙事一。' },
      { kind: 'tool-call', name: 'runtimeWrite', arguments: JSON.stringify({ path: 'deed.md', content: '回合一记账' }) },
      { kind: 'text', text: '已记账。' },
      { kind: 'text', text: '主线二。' },
      { kind: 'tool-call', name: 'runtimeEdit', arguments: JSON.stringify({ path: 'deed.md', old_str: '回合一记账', new_str: '回合二记账' }) },
      { kind: 'text', text: '已记完。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    const rootPath = engine.workspaceOf(sessionId) as string

    interface AgentHandle { followup(message: unknown): void; whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)
    expect(agent).toBeDefined()

    // Queue the second player message while the first turn runs: its ledger
    // commit lands inside the completed-turn prefix the tail fork seeds, its
    // claim lands after it — the severed shape the尾代理 must not replay.
    await submit(engine, sessionId, '开场')
    await submit(engine, sessionId, '玩家二')
    await agent!.whenIdle()
    await vi.waitFor(() => {
      expect(readFileSync(join(rootPath, 'runtime', 'deed.md'), 'utf8')).toBe('回合二记账')
    }, { timeout: 20_000, interval: 100 })

    // Six requests: main(1), tail(1) tool+continuation, main(2), tail(2)
    // tool+continuation. No tail request carries 玩家二 — the tail's seed
    // ledger reconciliation cancels its severed copy while the main claims
    // and runs it exactly once.
    expect(adapter.calls).toHaveLength(6)
    expect(adapter.calls[0]?.userTexts).toEqual(['开场', postMessage])
    const tailUsers = adapter.calls[1]?.userTexts ?? []
    expect(tailUsers.at(-1)).toContain(RENDERED_MAINTENANCE)
    expect(tailUsers.every(text => !text.includes('玩家二'))).toBe(true)
    expect(adapter.calls[3]?.userTexts.filter(text => text === '玩家二')).toHaveLength(1)
    // Exactly ONE durable player claim exists for 玩家二 in the main log —
    // the queued copy the tail seed inherited was reconciled away, never
    // re-claimed (its later appearances in tail views are inherited history).
    const facedSessions = ctx.sessions as unknown as {
      get(id: SessionId): { snapshotEvents(): { type: string; data: Record<string, unknown> }[] } | undefined
    }
    const mainEvents = facedSessions.get(sessionId)!.snapshotEvents()
    const queuedClaims = mainEvents.filter((event) => {
      if (event.type !== 'user/message') return false
      const source = (event.data as { source?: { kind?: string } }).source
      if (source?.kind !== 'user') return false
      const blocks = (event.data as { content?: { type: string; text?: string }[] }).content ?? []
      return blocks.filter(block => block.type === 'text').map(block => block.text ?? '').join('') === '玩家二'
    })
    expect(queuedClaims).toHaveLength(1)
  })

  it('叙事agent默认工具:meta.json 旗标关掉后当前请求即盲面(尾面五件不动),写回开启即复得', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-narrator-tools-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([
      { kind: 'text', text: '盲叙事。' },
      { kind: 'text', text: '尾注一。' },
      { kind: 'text', text: '明叙事。' },
      { kind: 'text', text: '尾注二。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    const rootPath = engine.workspaceOf(sessionId) as string

    interface AgentHandle { whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)
    expect(agent).toBeDefined()

    // dialogStarted 是 checkbox 的锁灰线：开局（选卡/建卡/编辑）未对话 = false。
    expect(engine.state(sessionId).dialogStarted).toBe(false)

    // 旗标写进卡身份 meta.json（真实 writeText 客户端通道）—— 引擎在该路径上
    // re-sync 工具面（与 preset 变更同路），当前请求边界即收走 read pair。
    // typert 契约冻结，开关没有专用 wire 方法：翻转 = meta.json 的读改写。
    engine.writeText(sessionId, 'preset/meta.json', `${JSON.stringify({ title: 'probe', narratorTools: false }, undefined, 2)}\n`)
    expect(engine.state(sessionId).narratorToolsOn).toBe(false)
    expect(existsSync(join(rootPath, 'preset', 'meta.json'))).toBe(true)

    await submit(engine, sessionId, '第一回')
    await agent!.whenIdle()
    // 首回合落账后对话框线越线 —— UI 据此把 checkbox 置灰。
    expect(engine.state(sessionId).dialogStarted).toBe(true)
    await vi.waitFor(() => {
      expect(adapter.calls.length).toBeGreaterThanOrEqual(2)
    }, { timeout: 20_000, interval: 100 })
    // 盲面：主请求只剩卡自带的 weather，read pair 缺席；尾代理维护面五件不动。
    expect((adapter.calls[0]?.tools ?? []).map(tool => tool.name).sort()).toEqual(['weather'])
    expect((adapter.calls[1]?.tools ?? []).map(tool => tool.name).sort())
      .toEqual(['runtimeDelete', 'runtimeEdit', 'runtimeGrep', 'runtimeRead', 'runtimeWrite'])

    // meta 写回开启（narratorTools: true）—— 下一主请求在 tools 收集点即见 read pair。
    engine.writeText(sessionId, 'preset/meta.json', `${JSON.stringify({ title: 'probe', narratorTools: true }, undefined, 2)}\n`)
    expect(engine.state(sessionId).narratorToolsOn).toBe(true)

    await submit(engine, sessionId, '第二回')
    await agent!.whenIdle()
    // 收尾等齐：第二回合的尾代理 fork 是异步的，dispose 前必须见到全部四个
    // 请求（主1/尾1/主2/尾2）且尾闸释放，否则 hook 的 fiber.dispose 会吊死。
    await vi.waitFor(() => {
      expect(adapter.calls.length).toBe(4)
      expect(engine.state(sessionId).tailRunning).toBe(false)
    }, { timeout: 20_000, interval: 100 })
    const seen = adapter.calls.filter(call => (call.userTexts ?? []).some(text => text.includes('第二回')))
    expect((seen[0]?.tools ?? []).map(tool => tool.name).sort()).toEqual(['runtimeGrep', 'runtimeRead', 'weather'])
  })

  it('停止:引擎 stop 杀死在跑的卡工具 bash，回合以 aborted 收束且代理存活可续聊', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-stop-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([
      // Turn 1 blocks inside the card tool's bash; turn 2 proves the agent
      // survived the cancellation and accepts a fresh composed prompt.
      { kind: 'tool-call', name: 'slow', arguments: JSON.stringify({ args: '' }) },
      { kind: 'text', text: '不应到达。' },
      { kind: 'text', text: '第二回合叙事。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    // Engine-side write = a preset mutation point: the slow tool must be
    // visible on the very first request's tools collection.
    engine.writeText(sessionId, 'preset/tools/slow.mjs', 'await new Promise(r => setTimeout(r, 30000))\n')

    interface AgentHandle { followup(message: unknown): void; whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)
    expect(agent).toBeDefined()

    const rpcSeq = { value: 100 }
    const submit = async (text: string): Promise<void> => {
      rpcSeq.value += 1
      await engine.prompt({ sessionId, text, requestId: `rpc-${String(rpcSeq.value)}`, clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    }

    const started = Date.now()
    await submit('触发慢工具')
    // The model call precedes the blocking bash: once it is recorded, the
    // tool execution is in flight inside the turn.
    await vi.waitFor(() => { expect(adapter.calls.length).toBe(1) }, { timeout: 20_000, interval: 50 })
    expect(engine.stop(sessionId)).toEqual({ accepted: true, tailStopped: false })
    // The aborted turn must converge while slow.sh would still be sleeping —
    // a live bash child would hold whenIdle for ≥30 s.
    await agent!.whenIdle()
    const elapsed = Date.now() - started
    expect(elapsed).toBeLessThan(20_000)

    // The turn closed as aborted, and the agent accepts the next prompt.
    const session = (ctx as unknown as {
      sessions: { get(id: SessionId): { snapshotEvents(): { type: string; data: { reason?: { kind: string } } }[] } | undefined }
    }).sessions.get(sessionId)
    const ends = (session?.snapshotEvents() ?? []).filter(event => event.type === 'turn/end')
    expect(ends.at(-1)?.data.reason?.kind).toBe('aborted')
    expect(adapter.calls).toHaveLength(1)

    await submit('第二回合')
    await agent!.whenIdle()
    // The aborted turn's claim stays in history (with its tool-result row
    // projecting as an empty user text); turn 2's view carries exactly ONE
    // post — turn 1's was shadowed.
    expect((adapter.calls[1]?.userTexts ?? []).filter(text => text !== '')).toEqual(['触发慢工具', '第二回合', postMessage])
    // Dispose 前（与其他用例同款）：等回合 2 的尾代理收束，避免 teardown 等待在途 fork。
    await vi.waitFor(() => { expect(engine.state(sessionId).tailRunning).toBe(false) }, { timeout: 20_000, interval: 100 })
  })

  it('载入无边界首存档：换绑全新空会话（transcript 清空语义）', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-load-empty-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([{ kind: 'text', text: '开场叙事。' }])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const oldId = await engine.createSession()
    engine.importFromLibrary(oldId, 'probe-card')

    // 零回合直接存档：stamp 落下时无 turn/end → seq = null（用户手测的
    //「第一个存档」形态——无 fork 目标的空历史档）。
    engine.save(oldId, 'empty-first', '')

    const agents = ctx.agents as unknown as { get(id: SessionId): { whenIdle(): Promise<void> } | undefined }
    const rpcSeq = { value: 200 }
    const submit = async (text: string): Promise<void> => {
      rpcSeq.value += 1
      await engine.prompt({ sessionId: oldId, text, requestId: `rpc-${String(rpcSeq.value)}`, clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    }
    await submit('载入前ShouldBeGone')
    await agents.get(oldId)!.whenIdle()
    const face = () => (ctx.sessions as unknown as { get(id: SessionId): { ownEvents(): { type: string }[] } | undefined })
    expect(face().get(oldId)!.ownEvents().some(e => e.type === 'user/message')).toBe(true)

    // 载入空档：必须换绑全新空会话（旧行为 = 原样保留旧会话与转写）。
    const loadedId = (await engine.load(oldId, 'empty-first')).sessionId
    expect(loadedId).not.toBe(oldId)
    expect(engine.workspaceOf(loadedId)).toBeTruthy()
    expect(engine.workspaceOf(oldId)).toBeUndefined()
    const fresh = face().get(loadedId)!
    const dialogue = fresh.ownEvents().filter(e => e.type === 'user/message' || e.type === 'assistant/message')
    expect(dialogue).toHaveLength(0)
    expect(readFileSync(join(engine.workspaceOf(loadedId)!, '.tavern-session'), 'utf8').trim()).toBe(loadedId)
    await vi.waitFor(() => { expect(engine.state(loadedId).tailRunning).toBe(false) }, { timeout: 20_000, interval: 100 })
  })

  it('重试点:发送时刻即盖章,首条消息无边界时 retryPoint 走 reset 并交还原文', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-retry-reset-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([{ kind: 'text', text: '开场叙事。' }])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    const rootPath = engine.workspaceOf(sessionId) as string

    // 首条消息发送:发送时刻即盖章(seq null = 尚无已完成回合),回合结束不再补盖。
    await engine.prompt({ sessionId, text: '第一句', requestId: 'rpc-retry-1', clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    interface AgentHandle { whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    await agents.get(sessionId)!.whenIdle()
    await vi.waitFor(() => { expect(engine.state(sessionId).tailRunning).toBe(false) }, { timeout: 20_000, interval: 100 })

    const autos = engine.saves(sessionId).filter(row => row.type === 'auto')
    expect(autos).toHaveLength(1)
    expect(autos[0]?.summary).toBe('第一句')
    expect(engine.state(sessionId).retryable).toBe(true)

    // 无边界的重试点走 reset:工作空间换绑全新会话,原文逐字交还。
    const retry = await engine.retryPoint(sessionId)
    expect(retry.text).toBe('第一句')
    expect(retry.sessionId).not.toBe(sessionId)
    expect(engine.workspaceOf(retry.sessionId)).toBe(rootPath)
    expect(engine.workspaceOf(sessionId)).toBeUndefined()
    const freshSession = (ctx.sessions as unknown as {
      get(id: SessionId): { snapshotEvents(): { type: string }[] } | undefined
    }).get(retry.sessionId)
    expect(freshSession).toBeDefined()
    expect(freshSession!.snapshotEvents().every(event => event.type !== 'user/message' && event.type !== 'assistant/message')).toBe(true)
  })

  it('停止:主回合被取消则回合以 aborted 收束且尾代理绝不启动', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-stop-no-tail-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([
      { kind: 'tool-call', name: 'slow', arguments: JSON.stringify({ args: '' }) },
      { kind: 'text', text: '不应到达。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    engine.writeText(sessionId, 'preset/tools/slow.mjs', 'await new Promise(r => setTimeout(r, 30000))\n')

    interface AgentHandle { followup(message: unknown): void; whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)
    expect(agent).toBeDefined()

    await engine.prompt({ sessionId, text: '触发后停止', requestId: 'rpc-stop-1', clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    await vi.waitFor(() => { expect(adapter.calls.length).toBe(1) }, { timeout: 20_000, interval: 50 })
    engine.stop(sessionId)
    await agent!.whenIdle()
    expect(engine.state(sessionId).tailRunning).toBe(false)
    // 安置窗口：若 aborted 回合错误地排了尾代理，这里会出现第二个模型调用。
    await new Promise((resolve) => { setTimeout(resolve, 300) })
    expect(adapter.calls).toHaveLength(1)
    expect(engine.state(sessionId).tailRunning).toBe(false)
  })

  it('停止:尾代理执行中可停——记账渲染 bash 被杀，闸门快速释放', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-stop-tail-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([{ kind: 'text', text: '叙事一。' }])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    // 慢记账渲染：尾代理的 pre-step 渲染 bash 睡 5 秒——stop 必须杀掉它而不是等它。
    engine.writeText(sessionId, 'preset/scripts/tail_state.mjs', 'await new Promise(r => setTimeout(r, 5000)); console.log("done")\n')

    interface AgentHandle { followup(message: unknown): void; whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)

    await engine.prompt({ sessionId, text: '第一回合', requestId: 'rpc-stop-2', clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    await agent!.whenIdle()
    // 回合完成后尾代理即刻在途（gates 同步置位）。
    await vi.waitFor(() => { expect(engine.state(sessionId).tailRunning).toBe(true) }, { timeout: 20_000, interval: 50 })
    const stoppedAt = Date.now()
    engine.stop(sessionId)
    // 记账渲染本会占住闸门 5 秒：被杀则远早于此释放。
    await vi.waitFor(() => { expect(engine.state(sessionId).tailRunning).toBe(false) }, { timeout: 20_000, interval: 50 })
    expect(Date.now() - stoppedAt).toBeLessThan(4_500)
  })

  it('停止:尾代理模型流挂起中 stop——child 回合以 aborted 收束并快速释放闸门', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-stop-hang-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const adapter = new ScriptedTavernAdapter([
      { kind: 'text', text: '叙事一。' },
      // The tail's model call parks until its phase signal aborts.
      { kind: 'hang' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')

    interface AgentHandle { whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)

    await engine.prompt({ sessionId, text: '第一回合', requestId: 'rpc-stop-hang', clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    await agent!.whenIdle()
    await vi.waitFor(() => { expect(engine.state(sessionId).tailRunning).toBe(true) }, { timeout: 20_000, interval: 50 })
    // Deterministic window: the tail's FIRST model call is parked
    // inside the hang before the stop lands (the earliest windows —
    // render, pre-step — are covered by the sibling tests).
    await vi.waitFor(() => { expect(adapter.calls.length).toBe(2) }, { timeout: 20_000, interval: 50 })

    const stopAt = Date.now()
    expect(engine.stop(sessionId).tailStopped).toBe(true)
    await vi.waitFor(() => { expect(engine.state(sessionId).tailRunning).toBe(false) }, { timeout: 20_000, interval: 50 })
    expect(Date.now() - stopAt).toBeLessThan(10_000)
    // The stop reached the CHILD's model call: its park ended through
    // the loop's own phase signal, not a timeout.
    expect(adapter.hangsAborted).toEqual([true])
    // The transcript projection reports the run as stopped — the
    // bookkeeping row never claims a write that did not happen.
    const stoppedTranscript = await engine.tailTranscript(sessionId)
    expect(stoppedTranscript.tails).toHaveLength(1)
    expect(stoppedTranscript.tails[0]?.status).toBe('stopped')
  })

  it('tailTranscript 从子会话日志派生记账内容（工具调用/收尾文本/状态）', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-tt-'))
    const ctx = await compose({ workspaceBase: join(root, 'workspaces'), libraryBase: join(root, 'presets') })
    seedCard(join(root, 'presets'))

    const adapter = new ScriptedTavernAdapter([
      { kind: 'text', text: '叙事一。' },
      { kind: 'tool-call', name: 'runtimeWrite', arguments: JSON.stringify({ path: 'deed.md', content: '回合一记账' }) },
      { kind: 'text', text: '已记账。' },
    ])
    ctx.llm.registerAdapter(['tavern-mock'], adapter)

    const engine = ctx.tavernService
    const sessionId = await engine.createSession()
    engine.importFromLibrary(sessionId, 'probe-card')
    interface AgentHandle { whenIdle(): Promise<void> }
    const agents = ctx.agents as unknown as { get(id: SessionId): AgentHandle | undefined }
    const agent = agents.get(sessionId)

    await engine.prompt({ sessionId, text: '第一回合', requestId: 'rpc-tt-1', clientTimeZone: 'Asia/Shanghai' }, new AbortController().signal)
    await agent!.whenIdle()
    await vi.waitFor(() => { expect(engine.state(sessionId).tailRunning).toBe(false) }, { timeout: 20_000, interval: 50 })

    const transcript = await engine.tailTranscript(sessionId)
    expect(transcript.tails).toHaveLength(1)
    const run = transcript.tails[0]
    expect(run?.status).toBe('completed')
    // Actions carry the bounded raw args (the expanded row's body) and the
    // paired durable result (runtimeWrite create answers its receipt).
    expect(run?.actions).toEqual([
      expect.objectContaining({
        tool: 'runtimeWrite',
        detail: 'deed.md',
        args: JSON.stringify({ path: 'deed.md', content: '回合一记账' }),
        result: 'New file created successfully at: deed.md',
      }),
    ])
    expect(run?.reply).toContain('已记账')
  })

  it('编辑卡:编辑不碰卡库,仅保存/保存并开始才回写,换卡加载与建新卡清陈旧编辑戳', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-edit-stamp-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const engine = ctx.tavernService
    const sessionId = await engine.createSession()

    // 编辑卡盖戳;换卡加载(载入任何卡)即结束编辑上下文。
    engine.editFromLibrary(sessionId, 'probe-card')
    expect(engine.state(sessionId).editing).toBe('probe-card')
    engine.importFromLibrary(sessionId, 'probe-card')
    expect(engine.state(sessionId).editing).toBeNull()
    expect(engine.state(sessionId).drafting).toBe(false)

    // 建新卡同样清掉陈旧编辑戳——建卡不是编辑卡库卡。
    engine.editFromLibrary(sessionId, 'probe-card')
    engine.draftCard(sessionId)
    expect(engine.state(sessionId).editing).toBeNull()
    expect(engine.state(sessionId).drafting).toBe(true)

    // 编辑不碰卡库:writeText 只落工作空间,editDirty 报告未保存改动。
    engine.editFromLibrary(sessionId, 'probe-card')
    expect(engine.editDirty(sessionId)).toBe(false)
    engine.writeText(sessionId, 'preset/prompt/systemPrompt', '改后的系统提示词')
    expect(readFileSync(join(libraryBase, 'probe-card', 'preset', 'prompt', 'systemPrompt'), 'utf8')).toBe(CARD_SYSTEM)
    expect(engine.editDirty(sessionId)).toBe(true)
    // 仅保存:工作空间内容覆盖卡库那张卡,编辑态保留,脏标记清零。
    expect(engine.saveEdit(sessionId)).toBe('probe-card')
    expect(readFileSync(join(libraryBase, 'probe-card', 'preset', 'prompt', 'systemPrompt'), 'utf8')).toBe('改后的系统提示词')
    expect(engine.state(sessionId).editing).toBe('probe-card')
    expect(engine.editDirty(sessionId)).toBe(false)
    // 保存并开始:publishCard 发布整卡(带上发布前的工作空间内容)并清戳。
    engine.writeText(sessionId, 'preset/prompt/systemPrompt', '发布前的最后改动')
    expect(engine.publishCard(sessionId)).toBe('probe-card')
    expect(engine.state(sessionId).editing).toBeNull()
    expect(readFileSync(join(libraryBase, 'probe-card', 'preset', 'prompt', 'systemPrompt'), 'utf8')).toBe('发布前的最后改动')
    // 清戳后同一写入不再外溢到卡库。
    engine.writeText(sessionId, 'preset/prompt/systemPrompt', '清戳后再改')
    expect(readFileSync(join(libraryBase, 'probe-card', 'preset', 'prompt', 'systemPrompt'), 'utf8')).toBe('发布前的最后改动')
  })

  it('编辑卡:放弃编辑卸载工作空间(同 cancelDraft)——返回卡库后刷新留在选卡页', { timeout: 60_000 }, async () => {
    root = mkdtempSync(join(tmpdir(), 'tavern-cancel-edit-'))
    const workspaceBase = join(root, 'workspaces')
    const libraryBase = join(root, 'presets')
    seedCard(libraryBase)

    const ctx = await compose({ workspaceBase, libraryBase })
    const engine = ctx.tavernService
    const sessionId = await engine.createSession()

    // 编辑中:卡载入工作空间 + 编辑戳,脏改动只落工作空间副本。
    engine.editFromLibrary(sessionId, 'probe-card')
    expect(engine.state(sessionId).hasCard).toBe(true)
    expect(engine.state(sessionId).editing).toBe('probe-card')
    engine.writeText(sessionId, 'preset/prompt/systemPrompt', '放弃掉的改动')

    // 放弃编辑:工作空间恢复空白三件套,卡库原卡分毫未动——
    // 刷新后的路由三元组 (hasCard, drafting, editing)=(false, false, null) 如实落在选卡页。
    engine.cancelEdit(sessionId)
    expect(engine.state(sessionId).hasCard).toBe(false)
    expect(engine.state(sessionId).editing).toBeNull()
    expect(engine.state(sessionId).drafting).toBe(false)
    expect(readFileSync(join(libraryBase, 'probe-card', 'preset', 'prompt', 'systemPrompt'), 'utf8')).toBe(CARD_SYSTEM)

    // 空白会话上重复 cancelEdit 幂等不炸(返回路径不校验编辑戳在场)。
    engine.cancelEdit(sessionId)
    expect(engine.state(sessionId).hasCard).toBe(false)
  })
})
