// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from 'dsh-tavern-fengyue-client-runtime'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import { TavernRoot } from '../src/client/app/TavernApp.tsx'
import { zh } from '../src/client/locales.ts'
import type { TavernRpc } from '../src/client/rpc.ts'
import type { CredentialsFace } from '../src/client/app/TavernApp.tsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const SESSION = 'session-1'
let lastOpenSpy: ReturnType<typeof vi.fn> | undefined

/** TavernRpc with every method resolving ok; `calls` records invocations.
 *  Methods fake the WIRE envelope ({ok, value}) — tavernRpc unwraps it. */
function rpc(overrides: Partial<TavernRpc> = {}): TavernRpc & { calls: string[] } {
  const ok = () => Promise.resolve({ ok: true as const, value: { ok: true } })
  const calls: string[] = []
  const record = <A, V>(name: string, run: (request: A) => Promise<V>) => (request: A): Promise<{ ok: true; value: V }> => {
    calls.push(name)
    return run(request).then(value => ({ ok: true as const, value }))
  }
  const impls = {
    createSession: () => Promise.resolve({ sessionId: 's-new' }),
    workspaces: () => Promise.resolve({ rows: [{ name: 'ws-1', sessionId: SESSION, hasCard: true, title: '小镇酒馆', desc: 'DND 5e' }] }),
    renameSession: ok,
    deleteSession: ok,
    readAsset: () => Promise.resolve({ dataUrl: 'data:image/png;base64,' }),
    writeAsset: ok,
    state: () => Promise.resolve({ hasCard: true, maintenanceOn: false, narratorToolsOn: true, title: '小镇酒馆', desc: 'DND 5e', cover: '', drafting: false, tailRunning: false, retryable: false }),
    library: () => Promise.resolve({ cards: [{ name: 'tavern-tavern', title: '小镇酒馆', desc: 'DND 5e' }] }),
    deleteCard: ok,
    deleteSave: ok,
    importFromLibrary: ok,
    draftCard: ok,
    opening: () => Promise.resolve({ html: null }),
    tree: () => Promise.resolve({ entries: [] }),
    readText: (request: { path: string }) => Promise.resolve({
      text: request.path === 'preset/meta.json' ? `${JSON.stringify({ title: '', desc: '', cover: '' }, undefined, 2)}\n` : '',
    }),
    writeText: ok,
    fileOp: ok,
    // Value-returning method: bare value — record() would double-envelope
    // and land undefined in the panel state (the documented fake trap).
    saves: () => { calls.push('saves'); return Promise.resolve({ saves: [] as never[] }) },
    retryPoint: () => Promise.resolve({ sessionId: 'session-retried', text: '' }),
    save: record('save', () => Promise.resolve({ ok: true as const })),
    commitImport: record('commitImport', () => Promise.resolve({ name: '小镇酒馆' })),
    publishCard: record('publishCard', () => Promise.resolve({ name: '小镇酒馆' })),
    saveEdit: () => Promise.resolve({ name: '小镇酒馆' }),
    editDirty: () => Promise.resolve({ dirty: false }),
    load: () => Promise.resolve({ sessionId: 'session-loaded', draft: '' }),
    editFromLibrary: record('editFromLibrary', () => Promise.resolve({ ok: true as const })),
    cancelEdit: record('cancelEdit', () => Promise.resolve({ ok: true as const })),
    reset: () => Promise.resolve({ sessionId: 'session-fresh', draft: '' }),
    prompt: record('prompt', () => Promise.resolve({ accepted: true as const })),
    stop: record('stop', () => Promise.resolve({ accepted: true as const, tailStopped: true })),
    // A value-returning method: the enveloped wrapper adds the
    // wire envelope, so this fake returns the bare value (no record()).
    tailTranscript: () => {
      calls.push('tailTranscript')
      return Promise.resolve({
        tails: [{
          childId: 'child-1', at: 1700000000000, status: 'completed' as const,
          actions: [{ tool: 'runtimeCreate', detail: 'deed.md' }], reply: '已维护。',
        }, {
          childId: 'child-2', at: 1700000005000, status: 'completed' as const,
          actions: [], reply: '',
        }],
      })
    },
  }
  // Envelope AFTER the merge so overrides speak the same raw TavernRpc value
  // shape as the defaults; tavernRpc unwraps every method uniformly.
  const merged = { ...impls, ...overrides }
  const enveloped = Object.fromEntries(
    Object.entries(merged).map(([name, run]) => [name,
      (...args: unknown[]): Promise<{ ok: true; value: unknown }> =>
        (run as (...inner: unknown[]) => Promise<unknown>)(...args).then(value => ({ ok: true as const, value }))]),
  )
  return { ...enveloped, calls } as unknown as TavernRpc & { calls: string[] }
}

function credentialFace(stored: string | undefined): CredentialsFace & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    // Real wire shape: CredentialInfo carries `configured`, never the secret value.
    describe: vi.fn(async () => ({
      ok: true,
      value: { DEEPSEEK_API_KEY: { configured: stored !== undefined && stored !== '', writable: true } },
    })),
    set: vi.fn(async (_ref: string, value: string) => { calls.push(`set:${value}`); return {} }),
  }
}

const MODEL_STATE: ModelDirectoryState = {
  current: { provider: 'deepseek', model: 'deepseek-chat' },
  routable: true,
  groups: [{
    id: 'deepseek', name: 'DeepSeek',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', reasoning: {
        efforts: [{ id: 'off', name: '关闭' }, { id: 'high', name: '高' }], defaultEffort: 'high',
      } },
    ],
  }],
  failures: [], status: 'ready', error: null,
}

/** Fake sessions: one session with a controllable event snapshot, prompt spy,
 *  and projection values served through identity-stable per-key faces. The
 *  session snapshot mirrors the real SessionSnapshot half (running clears
 *  the typing indicator; openState/promptError render as error rows). */
function sessions(options: {
  entries?: readonly unknown[]
  projections?: Record<string, unknown>
  running?: boolean
  promptResult?: { ok: boolean; error?: { code?: string; message?: string } }
} = {}) {
  const prompt = vi.fn(() => Promise.resolve(options.promptResult ?? { ok: true }))
  const cancel = vi.fn(() => Promise.resolve({ ok: true as const, value: { accepted: true as const } }))
  const openSpy = vi.fn()
  // The real event window carries SessionEventLikeEntry rows: `{ type: 'event', event }`
  // (plus 'transient' live-chunk frames). Wrap the natural fixture events so
  // the fake mirrors the server projection; pre-wrapped transient rows pass through.
  const entries = (options.entries ?? []).map(event => (event as { type?: string }).type === 'transient'
    ? event
    : { type: 'event', event })
  const projectionFaces = new Map<string, { value: unknown }>()
  const sessionSnapshot = {
    running: options.running ?? false,
    openState: 'open',
    openError: null,
    promptError: null,
    removed: false,
  }
  const listeners = new Set<() => void>()
  const binding = {
    eventSource: {
      getSnapshot: () => ({ entries }),
      subscribe: (listener: () => void) => {
        listeners.add(listener)
        return () => { listeners.delete(listener) }
      },
    },
    session: {
      prompt,
      cancel,
      subscribe: () => () => undefined,
      getSnapshot: () => sessionSnapshot,
      projections: {
        faceOf: (key: string) => {
          let face = projectionFaces.get(key)
          if (face === undefined) {
            face = { value: options.projections?.[key] }
            projectionFaces.set(key, face)
          }
          return {
            getSnapshot: () => face?.value,
            subscribe: () => () => undefined,
          }
        },
      },
    },
  }
  // Stable identity: useSyncExternalStore re-renders whenever the snapshot
  // object changes, so the fake must return one hoisted instance.
  const listSnapshot = { ids: [SESSION], byId: { [SESSION]: { title: '小镇酒馆' } }, current: SESSION }
  return {
    prompt,
    cancel,
    open: openSpy,
    openWindow: () => undefined,
    refresh: vi.fn(async () => undefined),
    list: {
      subscribe: () => () => undefined,
      getSnapshot: () => listSnapshot,
    },
    byId: {},
    openSpy,
    /** Append one live entry and notify subscribers — mirrors a real stream push. */
    push: (event: unknown): void => {
      entries.push((event as { type?: string }).type === 'transient' ? event : { type: 'event', event })
      for (const listener of listeners) listener()
    },
    binding: () => binding,
  }
}

/** Render TavernRoot against a plain structural fake of the client context. */
function app(options: {
  credentials?: CredentialsFace
  models?: { directoryFor: (id: unknown) => unknown }
  entries?: readonly unknown[]
  projections?: Record<string, unknown>
  rpcOverrides?: Partial<TavernRpc>
  hasCard?: boolean
  drafting?: boolean
  running?: boolean
  promptResult?: { ok: boolean; error?: { code?: string; message?: string } }
}) {
  const face = rpc({
    // Overrides fake the RAW value face (TavernRpc), not the wire envelope —
    // only the enveloped default impls below go through tavernRpc's unwrap.
    state: () => Promise.resolve({
      hasCard: options.hasCard ?? true, maintenanceOn: false,
      title: '小镇酒馆', desc: 'DND 5e', cover: '',
      drafting: false, editing: null, tailRunning: false, retryable: false,
    }),
    ...options.rpcOverrides,
  })
  const sessionsFace = sessions({
    ...(options.entries === undefined ? {} : { entries: options.entries }),
    ...(options.projections === undefined ? {} : { projections: options.projections }),
    ...(options.running === undefined ? {} : { running: options.running }),
    ...(options.promptResult === undefined ? {} : { promptResult: options.promptResult }),
  })
  lastOpenSpy = sessionsFace.openSpy
  const ctx = {
    remote: {
      tavern: face,
      credentials: options.credentials,
      $on: () => () => undefined,
    },
    sessions: sessionsFace,
    locale: { bind: () => makeTranslate(zh) },
    modelDirectories: options.models,
    get: (name: string) => (name === 'uiConversation' ? conversationFace() : undefined),
  }
  return { ...render(<TavernRoot ctx={ctx as unknown as ClientContext} />), calls: face.calls, openSpy: lastOpenSpy, sessionsFace }
}

/** The Conversation service face: the store key. The ring's occupancy rule is
 * the composer's own — no stub here, so the meter tests exercise the real
 * projection fold end to end. */
const conversationFace = () => ({
  conversationStoreKey: () => 'dsh.conversation',
})

function directoryFace(state: Partial<ModelDirectoryState> = {}) {
  const select = vi.fn(() => Promise.resolve())
  const snapshot = { ...MODEL_STATE, ...state }
  const store = { getSnapshot: () => snapshot, subscribe: () => () => undefined }
  return { select, directoryFor: () => ({ store, select }) }
}

describe('key dialog policy', () => {
  it('stays closed on boot while the key is missing', async () => {
    app({ credentials: credentialFace(undefined) })
    await screen.findAllByText('小镇酒馆')
    expect(screen.queryByText('配置 DeepSeek API Key')).toBeNull()
  })

  it('opens on send pre-flight when the key is missing, and the draft survives', { timeout: 10000 }, async () => {
    const face = app({ credentials: credentialFace(undefined) })
    await screen.findAllByText('小镇酒馆')
    fireEvent.change(screen.getByPlaceholderText('你的行动…'), { target: { value: '推门进去' } })
    fireEvent.click(screen.getByText('发送'))
    // The dialog opens through the async pre-flight chain (describe → missing
    // → open): give the busy-runner the full assertion budget instead of the
    // default 1s poll, which intermittently expired under load.
    await screen.findByText('配置 DeepSeek API Key', {}, { timeout: 5000 })
    expect(screen.getByDisplayValue('推门进去')).toBeDefined()
    expect(face.container.textContent).not.toContain('回合失败')
  })

  it('sends without the dialog when the key is stored', async () => {
    const face = rpc()
    const ctx = {
      remote: { tavern: face, credentials: credentialFace('sk-test'), $on: () => () => undefined },
      sessions: sessions(),
      locale: { bind: () => makeTranslate(zh) },
      modelDirectories: undefined,
      get: () => conversationFace(),
    }
    render(<TavernRoot ctx={ctx as unknown as ClientContext} />)
    await screen.findAllByText('小镇酒馆')
    fireEvent.change(screen.getByPlaceholderText('你的行动…'), { target: { value: '推门进去' } })
    fireEvent.click(screen.getByText('发送'))
    await waitFor(() => { expect(face.calls).toContain('prompt') })
    expect(screen.queryByText('配置 DeepSeek API Key')).toBeNull()
  })

  it('the key dialog shows the configured verdict', async () => {
    app({ credentials: credentialFace('sk-test') })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getAllByText('API Key').at(-1)!)
    await screen.findByText('✓ 已配置 — 下方粘贴新值可替换')
  })

  it('saves through the credentials face from the settings API Key tab and closes', async () => {
    const credentials = credentialFace(undefined)
    app({ credentials })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getAllByText('设置').at(-1)!)
    await screen.findByText('卡片标题')
    fireEvent.click(screen.getByText('API Key'))
    await screen.findByText('配置 DeepSeek API Key')
    fireEvent.change(screen.getByPlaceholderText('sk-…'), { target: { value: 'sk-abc' } })
    fireEvent.click(screen.getByText('保存并开始'))
    await waitFor(() => { expect(credentials.calls).toContain('set:sk-abc') })
    expect(screen.queryByText('配置 DeepSeek API Key')).toBeNull()
  })

  it('keeps the key config out of the settings modal (sidebar entry only)', async () => {
    const credentials = credentialFace(undefined)
    app({ credentials })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getAllByText('设置').at(-1)!)
    await screen.findByText('卡片标题')
    expect(screen.queryByText('配置 DeepSeek API Key')).toBeNull()
    fireEvent.click(screen.getByText('API Key'))
    await screen.findByText('配置 DeepSeek API Key')
    fireEvent.click(screen.getByText('稍后配置'))
    expect(screen.queryByText('配置 DeepSeek API Key')).toBeNull()
    expect(credentials.calls).toHaveLength(0)
  })
})

describe('settings modal opens straight into one page', () => {
  it('加载 lands on the saves page titled 存档; 设置 on the workspace page', async () => {
    // `saves` is a value-returning method: the override inlines the RAW value
    // shape (the enveloped wrapper adds the single wire envelope) — a record()
    // fake would double-envelope and setSaves(undefined).
    app({ rpcOverrides: { saves: () => Promise.resolve({ saves: [] as never[] }) } })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getAllByText('加载').at(-1)!)
    await screen.findByText('存档')
    expect(screen.queryByText('卡片标题')).toBeNull()
    fireEvent.click(screen.getByLabelText('关闭'))
    fireEvent.click(screen.getAllByText('设置').at(-1)!)
    await screen.findByText('卡片标题')
    expect(screen.queryByText('存档')).toBeNull()
  })
})

describe('turn failure row', () => {
  it('renders a missing-credential turn failure as a history line', async () => {
    const credentials = credentialFace('sk-test')
    app({
      credentials,
      entries: [{ type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error: { message: 'no key', code: 'MISSING_CREDENTIAL' } } } }],
    })
    // The failed turn is a transcript history line, not a lingering banner —
    // the key-missing copy stands alone (the pre-flight re-prompts on send).
    await screen.findByText('未配置 API Key，无法发起模型请求')
  })

  it('renders other turn failures verbatim as a history line', async () => {
    app({
      credentials: credentialFace('sk-test'),
      entries: [{ type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error: { message: 'boom', code: 'PROVIDER_DOWN' } } } }],
    })
    await screen.findByText('boom')
    expect(screen.queryByText('配置 API Key')).toBeNull()
  })

  it('renders durable user and assistant rows but never plugin-sourced snapshots', async () => {
    app({
      credentials: credentialFace('sk-test'),
      entries: [
        // Real durable shapes: a user/message `data` IS the message (content
        // and source at the data level); assistant content rides `data.message`.
        {
          type: 'user/message',
          data: { role: 'user', content: [{ type: 'text', text: '我推门走进酒馆' }], source: { kind: 'user' } },
          surfaceOp: 'append',
        },
        {
          type: 'user/message',
          data: { role: 'user', content: [{ type: 'text', text: 'Current runtime context…' }], source: { kind: 'plugin', plugin: '@deepseek-ai/dsh-system-prompt', form: 'snapshot' } },
          surfaceOp: 'append',
        },
        { type: 'assistant/message', data: { message: { role: 'assistant', content: [{ type: 'text', text: '酒保抬眼看你。' }] } }, surfaceOp: 'append' },
      ],
    })
    await screen.findByText('酒保抬眼看你。')
    // The user bubble renders the player's raw text (the sidebar's last-line
    // cache matches too — scope the bubble assertion by its CSS-module class).
    expect(document.querySelector('[class*="bubbleUser"]')?.textContent).toContain('我推门走进酒馆')
    expect(screen.queryByText(/Current runtime context/)).toBeNull()
  })

  it('shows the typing indicator while the host reports the session running', async () => {
    app({ credentials: credentialFace('sk-test'), running: true })
    await screen.findAllByText('小镇酒馆')
    // CSS-module class names keep their source substring (`_typing_<hash>`).
    expect(document.querySelector('[class*="typing"]')).not.toBeNull()
  })

  it('surfaces a rejected prompt admission as an error row', async () => {
    app({
      credentials: credentialFace('sk-test'),
      rpcOverrides: { prompt: () => Promise.reject(new Error('agent is busy')) },
    })
    await screen.findAllByText('小镇酒馆')
    fireEvent.change(screen.getByPlaceholderText('你的行动…'), { target: { value: '推门' } })
    fireEvent.click(screen.getByText('发送'))
    await screen.findByText(/回合失败：agent is busy/)
  })
})

describe('live narrative streaming and the maintenance row', () => {
  /** One transient live-chunk entry shaped like the real wire row. */
  const chunk = (attemptId: string, chunkBlob: unknown, index: number): unknown => ({
    type: 'transient',
    event: {
      type: 'assistant/live-chunk',
      seq: 20 + index / 32,
      time: 1700000000000 + index,
      data: { attemptId, turn: 1, step: 1, chunk: chunkBlob },
    },
  })

  const PLAYER = {
    type: 'user/message',
    data: { role: 'user', content: [{ type: 'text', text: '我推门走进酒馆' }], source: { kind: 'user' } },
    surfaceOp: 'append',
  }

  it('正文流式：主代理 text-delta 累加成 live 叙事行，流式期间打字点隐藏', async () => {
    const view = app({ credentials: credentialFace('sk-test'), running: true })
    await screen.findAllByText('小镇酒馆')
    expect(document.querySelector('[class*="typing"]')).not.toBeNull()
    view.sessionsFace.push(chunk('att-main-1', { type: 'text-delta', index: 0, text: '酒保抬眼，' }, 0))
    await screen.findByText('酒保抬眼，')
    view.sessionsFace.push(chunk('att-main-1', { type: 'text-delta', index: 0, text: '慢慢放下酒杯。' }, 1))
    await screen.findByText('酒保抬眼，慢慢放下酒杯。')
    // The body streams in place; the typing dots stay hidden while it does.
    expect(document.querySelector('[class*="typing"]')).toBeNull()
  })

  it('数据维护行：转道的子流帧折叠为 live 步骤（可展开看参数），答复流式出现', async () => {
    const view = app({
      credentials: credentialFace('sk-test'),
      entries: [PLAYER, {
        type: 'subagent/catalog',
        seq: 5,
        data: { version: 0, childId: 'session-tail-1', childCreatedAt: 1700000000000, mode: 'one-shot', label: 'tavern-tail' },
      }],
      rpcOverrides: {
        state: () => Promise.resolve({
          hasCard: true, maintenanceOn: true, title: '小镇酒馆', desc: 'DND 5e', cover: '',
          drafting: false, editing: null, tailRunning: true, retryable: false,
        }),
        tailTranscript: () => Promise.resolve({ tails: [{ childId: 'session-tail-1', at: 1, status: 'completed', actions: [], reply: '' }] }),
      },
    })
    await screen.findAllByText('小镇酒馆')
    // The gate runs: the newest tail row shows the waiting copy…
    expect(screen.getByText('数据维护')).toBeTruthy()
    expect(screen.getByText('正在维护数据…')).toBeTruthy()
    // …then the transposed child stream folds: a tool call accumulates its
    // arguments across deltas and finalizes at block-end; the summary rides
    // the newest call (prototype digest rule: the runtime path).
    const ATTEMPT = 'tavern-tail:session-tail-1:1'
    view.sessionsFace.push(chunk(ATTEMPT, { type: 'block-start', index: 0, blockType: 'tool-call' }, 0))
    view.sessionsFace.push(chunk(ATTEMPT, { type: 'tool-call-delta', index: 0, id: 'c1', name: 'runtimeUpdate', argumentsDelta: '{"path":"state.md","content":' }, 1))
    view.sessionsFace.push(chunk(ATTEMPT, { type: 'tool-call-delta', index: 0, argumentsDelta: '"酒馆加钱"}' }, 2))
    view.sessionsFace.push(chunk(ATTEMPT, { type: 'block-end', index: 0, block: { type: 'tool-call', id: 'c1', name: 'runtimeUpdate', arguments: '{"path":"state.md","content":"酒馆加钱"}' } }, 3))
    await screen.findByText('runtimeUpdate state.md')
    // Expanding the row (think-row parity: expandOnRowClick) shows the raw
    // arguments, and the closing reply streams in live.
    fireEvent.click(screen.getByText('数据维护'))
    await screen.findByText('{"path":"state.md","content":"酒馆加钱"}')
    view.sessionsFace.push(chunk(ATTEMPT, { type: 'text-delta', index: 1, text: '维护完成：钱包落账' }, 4))
    await screen.findByText('维护完成：钱包落账')
  })
})

describe('composer model picker', () => {
  it('drills into the model pane and selects a model with its default effort', async () => {
    const models = directoryFace()
    app({ credentials: credentialFace('sk-test'), models })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getByTitle('模型与思考强度'))
    fireEvent.click(screen.getByText('模型'))
    await screen.findByText('DeepSeek Reasoner')
    fireEvent.click(screen.getByText('DeepSeek Reasoner'))
    await waitFor(() => { expect(models.select).toHaveBeenCalledWith({ provider: 'deepseek', model: 'deepseek-reasoner', reasoningEffort: 'high' }) })
  })

  it('drills into the effort pane and picks an effort', async () => {
    const models = directoryFace({ current: { provider: 'deepseek', model: 'deepseek-reasoner', reasoningEffort: 'off' } })
    app({ credentials: credentialFace('sk-test'), models })
    await screen.findByTitle('模型与思考强度')
    fireEvent.click(screen.getByTitle('模型与思考强度'))
    fireEvent.click(screen.getByText('思考强度'))
    await screen.findByText('高')
    fireEvent.click(screen.getByText('高'))
    await waitFor(() => { expect(models.select).toHaveBeenCalledWith({ provider: 'deepseek', model: 'deepseek-reasoner', reasoningEffort: 'high' }) })
  })
})

describe('composer usage line and context meter', () => {
  it('shows zero placeholders before any settlement and hides the ring (stock parity)', async () => {
    app({ credentials: credentialFace('sk-test') })
    await screen.findAllByText('小镇酒馆')
    expect(screen.getByText('输入 0 tok ｜ 输出 0 tok ｜ 缓存命中 0% ｜ 0 tok/s')).toBeDefined()
    // The occupancy rule mirrors the stock ContextMeter: unknown pressure or
    // window renders no meter at all — never a parked 0% ring.
    expect(screen.queryByTitle(/上下文已用/)).toBeNull()
  })

  it('renders settled token usage, cache hit, and speed from the projections', async () => {
    app({
      credentials: credentialFace('sk-test'),
      projections: {
        tokenUsage: { uncachedInputTokens: 100, outputTokens: 250, cacheReadTokens: 900, cacheWriteTokens: 1000 },
        sessionStats: { turns: 2, steps: 3, llmMs: 0, toolMs: 0, ttftMs: 0, ttftSteps: 0, decodeMs: 5000, decodeTokens: 250 },
      },
    })
    await screen.findAllByText('小镇酒馆')
    expect(screen.getByText('输入 2K tok ｜ 输出 250 tok ｜ 缓存命中 45% ｜ 50 tok/s')).toBeDefined()
  })

  it('the context meter reports occupancy, the panel lists the breakdown, and Escape closes it', async () => {
    app({
      credentials: credentialFace('sk-test'),
      projections: {
        contextPressure: { pressureTokens: 1000, projectedTokens: 20000, contextWindow: 131072 },
        contextBreakdown: { systemTokens: 2600, toolsTokens: 1400, messageTokens: 800 },
      },
    })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getByTitle('上下文已用 15%'))
    await screen.findByText('~19.5K / 128K')
    expect(screen.getByText('~2.5K')).toBeDefined()
    expect(screen.getByText('~1.4K')).toBeDefined()
    expect(screen.getByText('~800')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => { expect(screen.queryByText('~19.5K / 128K')).toBeNull() })
  })
})

describe('header save dialog', () => {
  it('lists saves, fills the name on click, and saves through Enter', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const view = app({
      credentials: credentialFace('sk-test'),
      rpcOverrides: { saves: () => Promise.resolve({ saves: [{ name: '第一次抉择', type: 'manual' as const, summary: '我推开酒馆的门' }] }) },
    })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getByText('保存'))
    await screen.findByText('第一次抉择')
    // 存档行简介在保存对话框同排渲染。
    expect(screen.getByText('我推开酒馆的门')).toBeDefined()
    fireEvent.change(screen.getByPlaceholderText('存档名（同名覆盖）'), { target: { value: '第一次抉择' } })
    fireEvent.keyDown(screen.getByPlaceholderText('存档名（同名覆盖）'), { key: 'Enter' })
    await waitFor(() => { expect(view.calls).toContain('save') })
    expect(screen.queryByText('点击上方条目即填入该名称 — 再次保存将覆盖该存档（有确认）。')).toBeNull()
  })
})

describe('清空 rebinds the workspace to a fresh session', () => {
  it('calls reset, opens the returned session, and drops the old last-line cache', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    localStorage.setItem('tavern.lastLines', JSON.stringify({ 'session-1': '旧的最后一行' }))
    const view = app({ credentials: credentialFace('sk-test') })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getByText('清空'))
    await screen.findByText('已回到初始卡片状态')
    expect(view.openSpy).toHaveBeenCalledWith('session-fresh')
    const stored = JSON.parse(localStorage.getItem('tavern.lastLines') ?? '{}') as Record<string, string>
    expect(stored['session-1']).toBeUndefined()
  })

  it('keeps the session when the player declines the confirm dialog', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const view = app({ credentials: credentialFace('sk-test') })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getByText('清空'))
    await new Promise((resolve) => { setTimeout(resolve, 120) })
    expect(view.openSpy).not.toHaveBeenCalled()
    expect(view.calls).not.toContain('reset')
  })
})

describe('in-place onboarding and tail gate', () => {
  it('renders the card library in the main area while the session has no card', async () => {
    app({ credentials: credentialFace('sk-test'), hasCard: false })
    await screen.findByText('卡库 · tavern_presets/')
    expect(screen.getByText('创建新卡')).toBeDefined()
    expect(screen.getByText('从酒馆卡导入')).toBeDefined()
    expect(screen.queryByPlaceholderText('你的行动…')).toBeNull()
  })

  it('the send button becomes the stop button while the tail agent holds the gate', async () => {
    const view = app({
      credentials: credentialFace('sk-test'),
      rpcOverrides: {
        state: () => Promise.resolve({
          hasCard: true, maintenanceOn: true, title: '', desc: '', cover: '',
          drafting: false, editing: null, tailRunning: true, retryable: false,
        }),
      },
    })
    await screen.findAllByText('小镇酒馆')
    // 闸门态落定标记：state 轮询送达后，发送键已变形为停止键（横幅已退役）。
    await screen.findByRole('button', { name: '停止' }, { timeout: 5000 })
    fireEvent.change(screen.getByPlaceholderText('你的行动…'), { target: { value: '推门进去' } })
    // 运行期发送键即停止键：可点、点击请引擎停掉尾代理。
    const stop = screen.getByRole('button', { name: '停止' }) as HTMLButtonElement
    expect(stop.disabled).toBe(false)
    fireEvent.click(stop)
    await screen.findByRole('button', { name: '停止' }, { timeout: 5000 })
    expect(view.calls).toContain('stop')
    expect(view.sessionsFace.cancel).toHaveBeenCalled()
  })

  it('running shows the stop button and Enter still never queues a prompt', async () => {
    const view = app({ credentials: credentialFace('sk-test'), running: true })
    await screen.findAllByText('小镇酒馆')
    fireEvent.change(screen.getByPlaceholderText('你的行动…'), { target: { value: '推门进去' } })
    const send = screen.queryByText('发送')
    expect(send).toBeNull()
    // running 时 send() 早退：Enter 不触达 prompt（排队路径被锁死）。
    fireEvent.keyDown(screen.getByPlaceholderText('你的行动…'), { key: 'Enter' })
    expect(view.calls).not.toContain('prompt')
    // 停止键可点，点击请引擎取消当前回合。
    fireEvent.click(screen.getByRole('button', { name: '停止' }))
    await screen.findByRole('button', { name: '停止' }, { timeout: 5000 })
    expect(view.calls).toContain('stop')
    expect(view.sessionsFace.cancel).toHaveBeenCalled()
  })
})

describe('尾代理闸门即时同步', () => {
  const tailState = (tailRunning: boolean) => ({
    hasCard: true, maintenanceOn: true, title: '', desc: '', cover: '',
    drafting: false, editing: null, tailRunning, retryable: false,
  })

  it('locks the composer as soon as the app mounts while the tail gate is already held', async () => {
    app({
      credentials: credentialFace('sk-test'),
      rpcOverrides: { state: () => Promise.resolve(tailState(true)) },
    })
    await screen.findAllByText('小镇酒馆')
    await new Promise((resolve) => { setTimeout(resolve, 30) })
    fireEvent.change(screen.getByPlaceholderText('你的行动…'), { target: { value: '推门进去' } })
    // 挂载即同步：30ms 沉降后（首个 2s 轮询 tick 远未到）按钮必须已切到停止；
    // 旧的纯轮询实现在此时刻必然还亮着。同步断言不依赖任何 waitFor 预算。
    expect(screen.queryByText('发送')).toBeNull()
    expect(screen.getByRole('button', { name: '停止' })).toBeDefined()
  })

  it('tail ON: a completed turn engages the optimistic lock synchronously and the settlement signal unlocks it', async () => {
    let tailOn = false
    const state = vi.fn(() => Promise.resolve(tailState(tailOn)))
    const sessionsFace = sessions()
    const ctx = {
      remote: { tavern: rpc({ state }), credentials: credentialFace('sk-test'), $on: () => () => undefined },
      sessions: sessionsFace,
      locale: { bind: () => makeTranslate(zh) },
      modelDirectories: undefined,
      get: () => conversationFace(),
    }
    render(<TavernRoot ctx={ctx as unknown as ClientContext} />)
    await screen.findAllByText('小镇酒馆')
    fireEvent.change(screen.getByPlaceholderText('你的行动…'), { target: { value: '推门进去' } })
    const before = state.mock.calls.length
    tailOn = true // 宿主闸门随 fork 落地；客户端只能在 turn/end 到达时得知
    sessionsFace.push({ type: 'turn/end', seq: 9, time: 2, data: { turn: 2, reason: { kind: 'completed' } } })
    // 乐观锁同步变形：零 state 查询、不等任何 tick（此刻读 state 是 fork 置位前的
    // stale race，锁的意义所在）。
    expect(state.mock.calls.length).toBe(before)
    expect(screen.queryByText('发送')).toBeNull()
    expect(screen.getByRole('button', { name: '停止' })).toBeDefined()
    // 完成信号到达 → pollTail 落真实值：tailRunning 仍真（尾代理在写盘窗口），锁保持。
    sessionsFace.push({ type: 'command/done', seq: 10, time: 3, data: { commandId: 'tavern-tail-done', kind: 'success' } })
    await new Promise((resolve) => { setTimeout(resolve, 30) })
    expect(state.mock.calls.length).toBe(before + 1)
    expect(screen.getByRole('button', { name: '停止' })).toBeDefined()
    // 尾代理收尾 → 下一条完成信号（每 completed 回合恰一条）解锁真实值 false → 复原。
    tailOn = false
    sessionsFace.push({ type: 'command/done', seq: 11, time: 4, data: { commandId: 'tavern-tail-done', kind: 'success' } })
    await new Promise((resolve) => { setTimeout(resolve, 30) })
    expect(state.mock.calls.length).toBe(before + 2)
    expect(screen.queryByRole('button', { name: '停止' })).toBeNull()
    expect(screen.getByRole('button', { name: '发送' })).toBeDefined()
  })

  it('tail OFF: a completed turn ends on the plain path — no lock, the composer restores at once', async () => {
    const state = vi.fn(() => Promise.resolve({
      hasCard: true, maintenanceOn: false, title: '', desc: '', cover: '',
      drafting: false, editing: null, tailRunning: false, retryable: false,
    }))
    const sessionsFace = sessions()
    const ctx = {
      remote: { tavern: rpc({ state }), credentials: credentialFace('sk-test'), $on: () => () => undefined },
      sessions: sessionsFace,
      locale: { bind: () => makeTranslate(zh) },
      modelDirectories: undefined,
      get: () => conversationFace(),
    }
    render(<TavernRoot ctx={ctx as unknown as ClientContext} />)
    await screen.findAllByText('小镇酒馆')
    fireEvent.change(screen.getByPlaceholderText('你的行动…'), { target: { value: '推门进去' } })
    const before = state.mock.calls.length
    sessionsFace.push({ type: 'turn/end', seq: 9, time: 2, data: { turn: 2, reason: { kind: 'completed' } } })
    // 关闭态不发乐观锁：turn/end 同步触发一次 state 查询（onTurnEnd → pollTail 落真实值，
    // 恒 false）。引擎对关闭回合同样担保的完成信号只是协议兜底，正常路径无需等待。
    expect(state.mock.calls.length).toBe(before + 1)
    await new Promise((resolve) => { setTimeout(resolve, 30) })
    // 按钮始终是发送键：无锁、无停止闪烁——llm 说完话立刻恢复（写卡列同款最普通链路）。
    expect(screen.queryByRole('button', { name: '停止' })).toBeNull()
    expect(screen.getByRole('button', { name: '发送' })).toBeDefined()
  })

  it('the maintenance row is recovered from the durable catalog after a refresh', async () => {
    const view = app({
      credentials: credentialFace('sk-test'),
      entries: [
        {
          type: 'subagent/catalog',
          data: { version: 0, childId: 'child-1', childCreatedAt: 1700000000000, mode: 'one-shot', label: 'tavern-tail' },
        },
        {
          type: 'subagent/catalog',
          data: { version: 0, childId: 'child-2', childCreatedAt: 1700000005000, mode: 'one-shot', label: 'tavern-tail' },
        },
      ],
    })
    await screen.findAllByText('小镇酒馆')
    // The durable catalog rebuilt the row — no live gate needed.
    expect((await screen.findAllByText('数据维护')).length).toBe(2)
    // The row's details fetch on first render; once the summary
    // carries the action count the row is expandable.
    await waitFor(() => { expect(view.calls).toContain('tailTranscript') })
    const summary = await screen.findByText(/个工具调用/)
    fireEvent.click(summary)
    // The expanded body carries the tool call line and the reply.
    const body = await screen.findByText(/runtimeCreate deed\.md/)
    expect(body.textContent).toContain('已维护。')
    // The idle second run expands to an EMPTY body — settled idle rows carry
    // no placeholder copy at all (a sentence there reads as a running state).
    const idleRow = screen.getAllByText('数据维护')[1] as HTMLElement
    fireEvent.click(idleRow)
    const bodies = await screen.findAllByText((_, element) =>
      element?.className != null && String(element.className).includes('thinkBody'), {}, { timeout: 2000 })
    expect(bodies.at(-1)!.textContent).toBe('')
  })

  it('treats turn/end rows replayed from history as baseline, not as live settles', async () => {
    const state = vi.fn(() => Promise.resolve(tailState(false)))
    const view = app({
      credentials: credentialFace('sk-test'),
      rpcOverrides: { state },
      entries: [{ type: 'turn/end', seq: 4, time: 2, data: { turn: 1, reason: { kind: 'completed' } } }],
    })
    await screen.findAllByText('小镇酒馆')
    await new Promise((resolve) => { setTimeout(resolve, 30) })
    // 重放的 seq 4 只建立基线；更旧的 seq 3 是已见历史，不触发；更大的 seq 9 才是活到的回合。
    const before = state.mock.calls.length
    view.sessionsFace.push({ type: 'turn/end', seq: 3, time: 3, data: { turn: 1, reason: { kind: 'completed' } } })
    expect(state.mock.calls.length).toBe(before)
    view.sessionsFace.push({ type: 'turn/end', seq: 9, time: 4, data: { turn: 2, reason: { kind: 'completed' } } })
    expect(state.mock.calls.length).toBe(before + 1)
  })
})

describe('思考 streaming rows', () => {
  const liveChunk = {
    type: 'transient',
    event: {
      type: 'assistant/live-chunk', seq: 1, time: 1,
      data: { attemptId: 'a1', turn: 1, step: 1, chunk: { type: 'reasoning-delta', index: 0, text: '第一行思考\n第二行思考' } },
    },
  }

  it('the live reasoning stream follows the newest line in the 思考 summary', async () => {
    app({ credentials: credentialFace('sk-test'), entries: [liveChunk] })
    await screen.findByText('思考')
    // Prototype parity: the streaming summary hugs the newest line, not the first.
    expect(screen.getByText('第二行思考')).toBeDefined()
  })

  it('a settled message renders the 思考 row from its stream and keeps reasoning out of the narrative', async () => {
    app({
      credentials: credentialFace('sk-test'),
      entries: [{
        type: 'assistant/message',
        surfaceOp: 'append',
        data: {
          // Real durable shape: reasoning and text ride the SAME message's
          // content blocks, and the packed stream rides the event data.
          message: { role: 'assistant', content: [
            { type: 'reasoning', text: '第一行思考\n第二行思考' },
            { type: 'text', text: '酒保抬眼看你。' },
          ] },
          stream: [{ type: 'reasoning-chunks', time0: 0, index: 0, dt: [], texts: ['第一行思考\n第二行思考'] }],
        },
      }],
    })
    await screen.findByText('第一行思考')
    // The narrative is the text block ALONE — the reasoning block never leaks in.
    expect(screen.getByText('酒保抬眼看你。')).toBeDefined()
    // The body stays collapsed after settlement — later lines never render.
    expect(screen.queryByText('第二行思考')).toBeNull()
  })
})

describe('编辑卡 保存并开始 from the opening page', () => {
  /** 编辑生命周期的磁盘真值镜像:编辑从卡库载入即把卡绑进工作空间
   *  (hasCard=true)并盖编辑戳;cancelEdit 放弃后工作空间卸载回空白。
   *  曾案:静态 mock 把编辑中会话写成 hasCard=false,与真实引擎不符——
   *  刷新后的路由推导 (hasCard, drafting, editing) 从未被测到。 */
  function editingLifecycle(): { overrides: Partial<TavernRpc>; calls: string[] } {
    let phase: 'blank' | 'editing' | 'cancelled' = 'blank'
    const calls: string[] = []
    const base = { maintenanceOn: false, title: '小镇酒馆', desc: 'DND 5e', cover: '', drafting: false, tailRunning: false, retryable: false }
    return {
      calls,
      overrides: {
        state: () => Promise.resolve(phase === 'editing'
          ? { ...base, hasCard: true, editing: '小镇酒馆' }
          : { ...base, hasCard: false, editing: null }),
        editFromLibrary: () => { calls.push('editFromLibrary'); phase = 'editing'; return Promise.resolve({ ok: true as const }) },
        cancelEdit: () => { calls.push('cancelEdit'); phase = 'cancelled'; return Promise.resolve({ ok: true as const }) },
      },
    }
  }

  it('the library edit lands in the workspace editor with both actions, and saving rebinds', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const view = app({ credentials: credentialFace('sk-test'), rpcOverrides: editingLifecycle().overrides })
    await screen.findByText('卡库 · tavern_presets/')
    fireEvent.click(screen.getByTitle('编辑卡'))
    await screen.findByText('保存并开始')
    expect(screen.getByText('← 返回卡库')).toBeDefined()
    fireEvent.click(screen.getByText('保存并开始'))
    await waitFor(() => { expect(view.openSpy).toHaveBeenCalledWith('session-fresh') })
    expect(view.calls).toContain('publishCard')
    await screen.findByText('编辑已收入卡库，新会话已开始')
  })

  it('返回卡库 cancels the edit back into the library', async () => {
    const life = editingLifecycle()
    app({ credentials: credentialFace('sk-test'), rpcOverrides: life.overrides })
    await screen.findByText('卡库 · tavern_presets/')
    fireEvent.click(screen.getByTitle('编辑卡'))
    await screen.findByText('← 返回卡库')
    fireEvent.click(screen.getByText('← 返回卡库'))
    await waitFor(() => { expect(life.calls).toContain('cancelEdit') })
    await screen.findByText('卡库 · tavern_presets/')
  })

  it('返回卡库后刷新留在选卡页——放弃编辑已卸载工作空间的卡', async () => {
    const life = editingLifecycle()
    app({ credentials: credentialFace('sk-test'), rpcOverrides: life.overrides })
    await screen.findByText('卡库 · tavern_presets/')
    fireEvent.click(screen.getByTitle('编辑卡'))
    await screen.findByText('← 返回卡库')
    fireEvent.click(screen.getByText('← 返回卡库'))
    await waitFor(() => { expect(life.calls).toContain('cancelEdit') })
    await screen.findByText('卡库 · tavern_presets/')
    // 刷新=重挂载:state 此刻是 cancelEdit 后的 (hasCard=false, editing=null),
    // inChat 门如实落在选卡页。曾案:cancelEdit 把原卡留在工作空间,刷新读到
    // (hasCard=true, editing=null) 与"游戏中"同构——直开聊天,卡库标题永不出现。
    cleanup()
    app({ credentials: credentialFace('sk-test'), rpcOverrides: life.overrides })
    await screen.findByText('卡库 · tavern_presets/')
  })
})

describe('side collapse toggle', () => {
  it('collapses to width 0, persists the preference, and reopens from the same button', async () => {
    localStorage.removeItem('tavern.sidebar.open')
    app({ credentials: credentialFace('sk-test') })
    await screen.findAllByText('小镇酒馆')
    const aside = document.querySelector('aside') as HTMLElement
    expect(aside.className).not.toContain('sideClosed')
    expect(aside.getAttribute('aria-hidden')).toBe('false')
    fireEvent.click(screen.getByTitle('收起侧栏'))
    expect(aside.className).toContain('sideClosed')
    expect(aside.getAttribute('aria-hidden')).toBe('true')
    expect(localStorage.getItem('tavern.sidebar.open')).toBe('0')
    fireEvent.click(screen.getByTitle('展开侧栏'))
    expect(aside.className).not.toContain('sideClosed')
    expect(localStorage.getItem('tavern.sidebar.open')).toBe('1')
  })

  it('restores the collapsed state on remount and keeps 新会话 reachable in the header', async () => {
    localStorage.setItem('tavern.sidebar.open', '0')
    try {
      app({ credentials: credentialFace('sk-test') })
      await screen.findAllByText('小镇酒馆')
      const aside = document.querySelector('aside') as HTMLElement
      expect(aside.className).toContain('sideClosed')
      expect(aside.getAttribute('aria-hidden')).toBe('true')
      // 收起态头部保留 ＋ 新会话入口（title 与侧栏 foot 那颗无 title 的按钮区分开）。
      expect(screen.getByTitle('开启酒馆会话')).toBeDefined()
    } finally {
      localStorage.removeItem('tavern.sidebar.open')
    }
  })
})

describe('transcript bottom pin', () => {
  const userLine = {
    type: 'user/message', surfaceOp: 'append',
    data: { source: { kind: 'user' }, message: [{ type: 'text', text: '推门进去' }] },
  }
  const narrative = {
    type: 'assistant/message', surfaceOp: 'append',
    data: { message: { role: 'assistant', content: [{ type: 'text', text: '酒保抬眼看你。' }] } },
  }

  /** Fake the layout metrics jsdom cannot compute: element-level accessors
   *  serve the controlled figures, `writes` records every glue write, and
   *  `scrollTo` moves the reading position through the scroll event the way
   *  a real scroll lands on the hook. The reader's opening scroll position
   *  is announced once, before the hook can read any layout. */
  function fakeScrollMetrics(
    el: HTMLElement,
    metrics: { scrollHeight: number; clientHeight: number },
    initialTop: number,
  ): { writes: number[]; scrollTo: (top: number) => void } {
    const writes: number[] = []
    let scrollTop = initialTop
    Object.defineProperty(el, 'scrollHeight', { configurable: true, get: () => metrics.scrollHeight })
    Object.defineProperty(el, 'clientHeight', { configurable: true, get: () => metrics.clientHeight })
    Object.defineProperty(el, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => { writes.push(value); scrollTop = value },
    })
    el.dispatchEvent(new Event('scroll'))
    return { writes, scrollTo: (top: number): void => { scrollTop = top; el.dispatchEvent(new Event('scroll')) } }
  }

  it('lands glued to the bottom after a fresh open, and later lines re-glue', async () => {
    const view = app({
      credentials: credentialFace('sk-test'),
      entries: [userLine, narrative],
    })
    await screen.findByText('酒保抬眼看你。')
    // Viewport 400px over 1000px of content, opened scrolled to the floor: the
    // mount pin holds, so the next streamed line pulls the floor to 1300.
    const metrics = { scrollHeight: 1000, clientHeight: 400 }
    const { writes } = fakeScrollMetrics(document.querySelector('[class*="transcript"]') as HTMLElement, metrics, 600)
    metrics.scrollHeight = 1300
    view.sessionsFace.push(narrative)
    await waitFor(() => { expect(writes.at(-1)).toBe(1300) })
  })

  it('an arriving line never yanks the view while the reader is far from the bottom', async () => {
    const view = app({
      credentials: credentialFace('sk-test'),
      entries: [userLine, narrative],
    })
    await screen.findByText('酒保抬眼看你。')
    // The reader sits at the top of a 600px-deep transcript — reading back
    // through history — so the streamed line must not drag the view down.
    const metrics = { scrollHeight: 1000, clientHeight: 400 }
    const { writes } = fakeScrollMetrics(document.querySelector('[class*="transcript"]') as HTMLElement, metrics, 0)
    view.sessionsFace.push(narrative)
    await new Promise((resolve) => { setTimeout(resolve, 30) })
    expect(writes).toEqual([])
  })

  it('re-engages the pin once the reader returns near the bottom', { timeout: 30_000 }, async () => {
    const view = app({
      credentials: credentialFace('sk-test'),
      entries: [userLine],
    })
    // Sidebar-last-line collision-proof: scope both text reads to their rows.
    await screen.findAllByText('推门进去', {}, { timeout: 10000 })
    const metrics = { scrollHeight: 1000, clientHeight: 400 }
    const { writes, scrollTo } = fakeScrollMetrics(document.querySelector('[class*="transcript"]') as HTMLElement, metrics, 0)
    view.sessionsFace.push(narrative)
    await new Promise((resolve) => { setTimeout(resolve, 30) })
    expect(writes).toEqual([])
    // The reader returns within the 80px snap band; a scroll alone writes
    // nothing, and the next arriving line glues to the new floor.
    scrollTo(640)
    expect(writes).toEqual([])
    metrics.scrollHeight = 1300
    view.sessionsFace.push(narrative)
    await waitFor(() => { expect(writes.at(-1)).toBe(1300) })
  })
})

describe('retry row and message actions', () => {
  const convoEntries = [
    { type: 'user/message', data: { role: 'user', content: [{ type: 'text', text: '我推门走进酒馆' }], source: { kind: 'user' } }, surfaceOp: 'append' },
    { type: 'assistant/message', data: { message: { role: 'assistant', content: [{ type: 'text', text: '酒保抬眼看你。' }] } }, surfaceOp: 'append' },
  ]
  type StateValue = Awaited<ReturnType<TavernRpc['state']>>
  const retryableState = (): Promise<StateValue> => Promise.resolve({
    hasCard: true, maintenanceOn: false, title: '小镇酒馆', desc: 'DND 5e', cover: '',
    drafting: false, editing: null, tailRunning: false, retryable: true,
  })

  it('renders copy on every message and the retry control on the last reply, then re-sends through retryPoint+prompt', async () => {
    const prompt = vi.fn(() => Promise.resolve({ accepted: true as const }))
    const retryPointRequests: unknown[] = []
    app({
      credentials: credentialFace('sk-test'),
      entries: convoEntries,
      rpcOverrides: {
        state: retryableState,
        prompt,
        retryPoint: (request: { sessionId: string }) => {
          retryPointRequests.push(request)
          return Promise.resolve({ sessionId: 'session-retried', text: '我推门走进酒馆' })
        },
      },
    })
    await screen.findByText('酒保抬眼看你。')
    expect(screen.getAllByLabelText('复制')).toHaveLength(2)
    fireEvent.click(screen.getByLabelText('重新生成回复'))
    await waitFor(() => { expect(retryPointRequests).toEqual([{ sessionId: SESSION }]) })
    await waitFor(() => {
      expect(prompt).toHaveBeenCalledWith(
        expect.objectContaining({ sessionId: 'session-retried', text: '我推门走进酒馆' }),
        expect.anything(),
      )
    })
  })

  it('hides the retry control while the session is running', async () => {
    app({
      credentials: credentialFace('sk-test'), entries: convoEntries, running: true,
      rpcOverrides: { state: retryableState },
    })
    await screen.findByText('酒保抬眼看你。')
    expect(screen.queryByLabelText('重新生成回复')).toBeNull()
  })

  it('hides the retry control when a user line follows the reply', async () => {
    app({
      credentials: credentialFace('sk-test'),
      entries: [...convoEntries, {
        type: 'user/message', data: { role: 'user', content: [{ type: 'text', text: '第二条' }], source: { kind: 'user' } }, surfaceOp: 'append',
      }],
      rpcOverrides: { state: retryableState },
    })
    await screen.findAllByText('第二条')
    expect(screen.queryByLabelText('重新生成回复')).toBeNull()
  })

  it('copies the message text through the host clipboard', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    app({ credentials: credentialFace('sk-test'), entries: convoEntries })
    await screen.findByText('酒保抬眼看你。')
    fireEvent.click(screen.getAllByLabelText('复制')[1] as HTMLElement)
    await waitFor(() => { expect(writeText).toHaveBeenCalledWith('酒保抬眼看你。') })
  })
})

describe('Esc shortcuts', () => {
  it('a single Esc stops the running session', async () => {
    const { calls } = app({ credentials: credentialFace('sk-test'), running: true })
    await screen.findAllByText('小镇酒馆')
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => { expect(calls).toContain('stop') })
  })

  it('a double Esc clears a non-empty composer when idle and fires no stop', async () => {
    const { calls } = app({ credentials: credentialFace('sk-test') })
    await screen.findAllByText('小镇酒馆')
    const textarea = screen.getByPlaceholderText('你的行动…') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '草稿' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(textarea.value).toBe('')
    expect(calls).not.toContain('stop')
  })

  it('a double Esc with an empty composer opens the load page', async () => {
    app({ credentials: credentialFace('sk-test') })
    await screen.findAllByText('小镇酒馆')
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await screen.findByText('（暂无存档）')
  })

  it('a consumed first press blocks the double: stop again, never the load page', async () => {
    const { calls } = app({ credentials: credentialFace('sk-test'), running: true })
    await screen.findAllByText('小镇酒馆')
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => { expect(calls.filter(name => name === 'stop').length).toBe(2) })
    expect(screen.queryByText('（暂无存档）')).toBeNull()
  })
})

describe('meta identity fields survive identity edits (field-faithful save-back)', () => {
  const richMeta = (over: Record<string, unknown> = {}): string =>
    `${JSON.stringify({
      title: '', desc: '', cover: '', creator: '原作者', version: '2.1', tags: ['奇幻'], custom: 7, ...over,
    }, undefined, 2)}\n`

  it('shows the creator · version credit line under the identity lines', async () => {
    app({ rpcOverrides: { readText: (request: { path: string }) => Promise.resolve({ text: request.path === 'preset/meta.json' ? richMeta() : '' }) } })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getAllByText('设置').at(-1)!)
    await screen.findByText('原作者 · 2.1')
  })

  it('keeps tags/creator/version/unknown fields when the title is edited', async () => {
    const writeText = vi.fn((_request: { sessionId: string; path: string; text: string }) =>
      Promise.resolve({ ok: true as const, value: { ok: true } }))
    app({
      rpcOverrides: {
        readText: (request: { path: string }) => Promise.resolve({ text: request.path === 'preset/meta.json' ? richMeta() : '' }),
        writeText,
      },
    })
    await screen.findAllByText('小镇酒馆')
    fireEvent.click(screen.getAllByText('设置').at(-1)!)
    await screen.findByText('原作者 · 2.1')
    fireEvent.click(screen.getByText('卡片标题'))
    // 背景页的 composer 也是空值可编辑元素 — 只挑 header 的 <input> 编辑行。
    const target = screen.getAllByDisplayValue('').find(el => el.tagName === 'INPUT')!
    fireEvent.change(target, { target: { value: '新标题' } })
    fireEvent.blur(target)
    await waitFor(() => { expect(writeText).toHaveBeenCalled() })
    const saved = writeText.mock.calls.at(0)?.[0]?.text
    expect(saved).toContain('"title": "新标题"')
    expect(saved).toContain('"creator": "原作者"')
    expect(saved).toContain('"version": "2.1"')
    expect(saved).toContain('"tags"')
    expect(saved).toContain('"custom": 7')
  })
})

describe('default opening page greetings (preset/greetings.json)', () => {
  it('renders well-typed options that fill the composer without sending', async () => {
    const face = app({
      rpcOverrides: {
        readText: (request: { path: string }) => Promise.resolve({
          text: request.path === 'preset/greetings.json'
            // '   ' 空白与 42 非字符串被滤掉；'你走向吧台。' 保留。
            ? JSON.stringify({ greetings: ['你推开酒馆大门。', '   ', 42, '你走向吧台。'] })
            : '',
        }),
      },
    })
    await screen.findAllByText('小镇酒馆')
    await screen.findByText('开场选项')
    fireEvent.click(screen.getByText('你推开酒馆大门。'))
    const composer = screen.getByPlaceholderText('你的行动…') as HTMLTextAreaElement
    expect(composer.value).toBe('你推开酒馆大门。')
    expect(face.calls).not.toContain('prompt')
  })

  it('stays on title+desc when the greetings file is missing or invalid', async () => {
    // 缺省 readText 对非 meta 路径返回 '' → JSON.parse 抛错 → 无选项。
    app({})
    await screen.findAllByText('小镇酒馆')
    await screen.findByText('DND 5e')
    expect(screen.queryByText('开场选项')).toBeNull()
  })
})

describe('header theme select', () => {
  it('rides the always-mounted top-right action row with four localized options and swaps the sheet live', async () => {
    window.localStorage.removeItem('tavern.ui.theme')
    app({})
    const select = await screen.findByLabelText('主题')
    expect(select).toBeInstanceOf(HTMLSelectElement)
    // 顶右 select 即主题座位（库页/聊天页都在）；四选项走 locale 逐项可见。
    for (const option of ['卡片主题（如有）', '羊皮纸（默认）', 'DSH 亮色', 'DSH 暗色']) {
      expect(screen.getByText(option)).toBeDefined()
    }
    const sheet = () => document.getElementById('tavern-theme')?.textContent ?? ''
    expect(sheet()).toContain('--t-bg: #f7f6f1;')
    fireEvent.change(select, { target: { value: 'dsw-dark' } })
    await waitFor(() => { expect(sheet()).toContain('--t-bg: rgb(21, 21, 23);') })
    expect(window.localStorage.getItem('tavern.ui.theme')).toBe('dsw-dark')
    window.localStorage.removeItem('tavern.ui.theme')
  })
})
