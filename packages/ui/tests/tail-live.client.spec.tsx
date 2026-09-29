// @vitest-environment jsdom
// 尾代理直跟通道（2026-09-29 透流改道退役批）的回归钉。
// 链路：catalog 行 → subagent 地址 retain → descriptor 诊断重试 → 子流瞬态
// 折进数据维护行 → 落定 release+退订；skew 护栏（旧引擎+新前端窗口的透流
// 残帧原路吸收）；连败兜底降级 durable fetch。
//
// 台式沿用 transcript-landing.client.spec 的绕行先例：不 import client-runtime
// （makeTranslate 拉进 kernel client.js），locale.bind 用本地查表拼装；
// remote 面按 wire 信封 {ok, value} 出假（tavernRpc 负责解包）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, type RenderResult } from '@testing-library/react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { TavernRoot } from '../src/client/app/TavernApp.tsx'
import { zh } from '../src/client/locales.ts'

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const t = ((key: string) => (zh as unknown as Record<string, string>)[key] ?? key) as never

const userEvent = (seq: number, text: string) => ({ type: 'event', event: { type: 'user/message', seq, data: { role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } }, surfaceOp: 'append' } })
/** 父日志 durable catalog 行：尾行的真身（重放可重建，直跟口的钥匙=childId）。 */
const catalogRow = (seq: number, childId: string) => ({
  type: 'event',
  event: { type: 'subagent/catalog', seq, data: { version: 0, childId, childCreatedAt: 1700000000000, mode: 'one-shot', label: 'tavern-tail' } },
})
/** 子流瞬态帧：子会话自己的 follow 只载自己的帧（无 tavern-tail: 改名）。
 *  第二参为 wire 对齐位（fold 不读 chunk 序——快照重折按帧序自身累积）。 */
const childChunk = (chunk: unknown, _index?: number) => ({
  type: 'transient',
  event: { type: 'assistant/live-chunk', data: { attemptId: 'child-attempt-1', chunk } },
})
/** 形同真 wire 的主代理瞬态帧（attemptId 无前缀=父代理自有）。 */
const mainChunk = (chunk: unknown) => ({
  type: 'transient',
  event: { type: 'assistant/live-chunk', data: { attemptId: 'att-main-1', chunk } },
})
/** 旧引擎+新前端窗口的透流残帧（引擎退役后不再发——护栏须原路吸收）。 */
const skewChunk = (chunk: unknown) => ({
  type: 'transient',
  event: { type: 'assistant/live-chunk', data: { attemptId: 'tavern-tail:session-tail-1:1', chunk } },
})
const settleSignal = (seq: number) => ({ type: 'event', event: { type: 'command/done', seq, data: { commandId: `tavern-tail-done-${seq}`, kind: 'success' } } })

interface RetainRecord { target: unknown; source: unknown }

/**
 * 尾直跟假面：字符串 id 走主会话台账（current 语义照 multiSessions）；
 * subagent 地址对象走 retain 计数 + ready 失败旋钮 + 独立子事件流。
 * useSyncExternalStore 三铁则照 transcript-landing 假面成立。
 */
function tailSessions(initial: { ids: string[]; current: string }, parentEntries: readonly unknown[]) {
  let currentHolder = initial.current
  const makeRow = (id: string): unknown => ({ id, title: id, retainedBy: { tavern: id === currentHolder ? 1 : 0 } })
  let snapshot = {
    ids: initial.ids as string[],
    byId: Object.fromEntries(initial.ids.map(id => [id, makeRow(id)])),
    phase: 'ready' as const,
    projectionsBySession: {},
  }
  const listListeners = new Set<() => void>()
  const parentListeners = new Set<() => void>()
  const parentEntriesStore = [...parentEntries]
  const childEntries: Record<string, unknown[]> = {}
  const childListeners = new Map<string, Set<() => void>>()
  const retainCalls: RetainRecord[] = []
  const releases: { childId: string; release: ReturnType<typeof vi.fn> }[] = []
  let failTimes = 0
  let makeError: (() => unknown) | undefined

  const parentBinding = () => {
    const projectionFaces = new Map<string, unknown>()
    const sourceSnapshot = { entries: parentEntriesStore }
    const sessionSnapshot = { running: false, openState: 'open', openError: null, promptError: null, removed: false }
    return {
      sessionSnapshot,
      eventSource: {
        getSnapshot: () => sourceSnapshot,
        subscribe: (listener: () => void) => {
          parentListeners.add(listener)
          return () => { parentListeners.delete(listener) }
        },
      },
      session: {
        prompt: vi.fn(() => Promise.resolve({ ok: true })),
        cancel: vi.fn(() => Promise.resolve({ ok: true, value: { accepted: true } })),
        subscribe: () => () => undefined,
        getSnapshot: () => sessionSnapshot,
        projections: {
          faceOf: (key: string) => {
            let face = projectionFaces.get(key)
            if (face === undefined) {
              face = { subscribe: () => () => undefined, getSnapshot: () => undefined }
              projectionFaces.set(key, face)
            }
            return face
          },
        },
      },
    }
  }
  const parentBindingCache: { value?: ReturnType<typeof parentBinding> } = {}
  const childBindingOf = (childId: string) => {
    const sourceSnapshot = { entries: childEntries[childId] ?? [] }
    return {
      eventSource: {
        getSnapshot: () => sourceSnapshot,
        subscribe: (listener: () => void) => {
          const set = childListeners.get(childId) ?? new Set()
          set.add(listener)
          childListeners.set(childId, set)
          return () => { childListeners.get(childId)?.delete(listener) }
        },
      },
    }
  }

  return {
    retain: (target: unknown, options?: { source?: string }) => {
      retainCalls.push({ target, source: options?.source })
      if (typeof target !== 'object' || target === null || typeof (target as { childSessionId?: unknown }).childSessionId !== 'string') {
        // 主会话台账 retain（TavernApp 的 current 语义）。
        const id = String(target)
        const ids = snapshot.ids.includes(id) ? snapshot.ids : [...snapshot.ids, id]
        currentHolder = id
        snapshot = { ...snapshot, ids, byId: Object.fromEntries(ids.map(rid => [rid, makeRow(rid)])) }
        for (const listener of listListeners) listener()
        return { release: () => undefined }
      }
      const childId = (target as { childSessionId: string }).childSessionId
      if (!(childId in childEntries)) childEntries[childId] = []
      const release = vi.fn()
      if (failTimes > 0) {
        failTimes -= 1
        const error = makeError?.() ?? new Error('ready rejected')
        const ready = new Promise<never>((_resolve, reject) => { setTimeout(() => reject(error), 0) })
        // ready 拒绝路径由被测钩子调 release——失败引用也进台账可查。
        releases.push({ childId, release })
        return { ready, release, binding: undefined }
      }
      const binding = childBindingOf(childId)
      releases.push({ childId, release })
      return { binding, ready: Promise.resolve(binding), release }
    },
    binding: (id: string) => {
      if (id !== initial.current) return childBindingOf(id)
      parentBindingCache.value ??= parentBinding()
      return parentBindingCache.value
    },
    pushParent: (entry: unknown) => {
      parentEntriesStore.push(entry)
      for (const listener of parentListeners) listener()
    },
    pushChild: (childId: string, entry: unknown) => {
      ;(childEntries[childId] ??= []).push(entry)
      for (const listener of childListeners.get(childId) ?? []) listener()
    },
    seedChild: (childId: string, entry: unknown) => {
      ;(childEntries[childId] ??= []).push(entry)
    },
    failNextReady: (times: number, error?: () => unknown) => { failTimes = times; makeError = error },
    retainCalls,
    lastRelease: (childId: string) => [...releases].reverse().find(row => row.childId === childId),
    list: {
      subscribe: (listener: () => void) => { listListeners.add(listener); return () => { listListeners.delete(listener) } },
      getSnapshot: () => snapshot,
    },
    setCurrent: () => undefined,
    refresh: vi.fn(async () => undefined),
  }
}

type FakeRpc = Record<string, unknown>

/** rpc 假面：state().tailRunning 可变（落定拍就地翻转）；tailTranscript 可覆写。
 *  默认给 catalog 行齐备的台账行——TailFlowRow 的 fetch-once effect 以
 *  `detail === undefined` 为闸，台账缺行会让该 effect 每渲染重取不终止。 */
function fixtureRpc(options: { tailRows?: unknown[] } = {}): { rpc: FakeRpc; setTailRunning: (value: boolean) => void } {
  let tailRunning = true
  const tailRows = options.tailRows ?? [{ childId: 'session-tail-1', at: 1, status: 'completed', actions: [], reply: '' }]
  const rpc: FakeRpc = {
    createSession: () => Promise.resolve({ sessionId: 's-new' }),
    workspaces: () => Promise.resolve({ rows: [{ name: 'ws-a', sessionId: 'session-a', hasCard: true, title: '小镇酒馆', desc: 'DND', cover: '' }] }),
    renameSession: () => Promise.resolve({ ok: true }),
    deleteSession: () => Promise.resolve({ ok: true }),
    readAsset: () => Promise.resolve({ dataUrl: 'data:image/png;base64,' }),
    writeAsset: () => Promise.resolve({ ok: true }),
    state: () => Promise.resolve({ hasCard: true, maintenanceOn: true, narratorToolsOn: true, title: '小镇酒馆', desc: 'DND', cover: '', drafting: false, editing: null, tailRunning, dialogStarted: true, retryable: false }),
    library: () => Promise.resolve({ cards: [] }),
    deleteCard: () => Promise.resolve({ ok: true }),
    deleteSave: () => Promise.resolve({ ok: true }),
    importFromLibrary: () => Promise.resolve({ ok: true }),
    draftCard: () => Promise.resolve({ ok: true }),
    opening: () => Promise.resolve({ html: null }),
    tree: () => Promise.resolve({ entries: [] }),
    readText: (request: { path: string }) => Promise.resolve({
      text: request.path === 'preset/meta.json' ? `${JSON.stringify({ title: '小镇酒馆', desc: 'DND', cover: '' }, undefined, 2)}\n` : '',
    }),
    writeText: () => Promise.resolve({ ok: true }),
    fileOp: () => Promise.resolve({ ok: true }),
    saves: () => Promise.resolve({ saves: [] }),
    retryPoint: () => Promise.resolve({ sessionId: 'session-retried', text: '' }),
    save: () => Promise.resolve({ ok: true }),
    commitImport: () => Promise.resolve({ name: '小镇酒馆' }),
    publishCard: () => Promise.resolve({ name: '小镇酒馆' }),
    saveEdit: () => Promise.resolve({ name: '小镇酒馆' }),
    editDirty: () => Promise.resolve({ dirty: false }),
    load: () => Promise.resolve({ sessionId: 'session-loaded', draft: '' }),
    editFromLibrary: () => Promise.resolve({ ok: true }),
    cancelEdit: () => Promise.resolve({ ok: true }),
    reset: () => Promise.resolve({ sessionId: 'session-fresh', draft: '' }),
    prompt: () => Promise.resolve({ accepted: true }),
    stop: () => Promise.resolve({ accepted: true, tailStopped: false }),
    tailTranscript: () => Promise.resolve({ tails: tailRows }),
  }
  return { rpc, setTailRunning: (value: boolean) => { tailRunning = value } }
}

/** 挂 TavernRoot：rpc 假面逐方法包成 wire 信封（tavernRpc 解包）。 */
function mount(rpc: FakeRpc, sessions: ReturnType<typeof tailSessions>): RenderResult {
  const enveloped = Object.fromEntries(Object.entries(rpc).map(([name, run]) => [name,
    async (...args: unknown[]) => ({ ok: true, value: await (run as (...inner: unknown[]) => Promise<unknown>)(...args) }),
  ]))
  const ctx = {
    remote: {
      tavern: enveloped,
      credentials: {
        describe: vi.fn(async () => ({ ok: true, value: { DEEPSEEK_API_KEY: { configured: true, writable: true } } })),
        set: vi.fn(async () => ({})),
      },
      $on: () => () => undefined,
    },
    sessions,
    locale: { bind: () => t },
    modelDirectories: undefined,
    get: (name: string) => (name === 'uiConversation' ? { conversationStoreKey: () => 'dsh.conversation' } : undefined),
  }
  return render(<TavernRoot ctx={ctx as unknown as ClientContext} />)
}

describe('尾代理直跟（透流改道退役后的维护行直播）', () => {
  it('子会话流折进维护行：retain 一次到位、步骤/参数/收束语直播，主流不互吞、透流残帧被护栏吸收', async () => {
    const sessions = tailSessions({ ids: ['session-a'], current: 'session-a' },
      [userEvent(10, '我推门走进酒馆'), catalogRow(40, 'session-tail-1')])
    const { rpc } = fixtureRpc()
    mount(rpc, sessions)

    // 直跟摄取：one-shot 地址按本会话名下最新尾行发起，source=tavern-tail。
    await waitFor(() => expect(sessions.retainCalls.length).toBeGreaterThanOrEqual(1))
    expect(sessions.retainCalls.at(-1)?.target).toEqual({ parentSessionId: 'session-a', childSessionId: 'session-tail-1', mode: 'one-shot' })
    expect(sessions.retainCalls.at(-1)?.source).toBe('tavern-tail')

    // 成连即折：工具参数跨 delta 累加、block-end 定谳（end 块为准），摘要骑最新调用。
    sessions.pushChild('session-tail-1', childChunk({ type: 'block-start', index: 0, blockType: 'tool-call' }, 0))
    sessions.pushChild('session-tail-1', childChunk({ type: 'tool-call-delta', index: 0, id: 'c1', name: 'runtimeUpdate', argumentsDelta: '{"path":"state.md","content":' }, 1))
    sessions.pushChild('session-tail-1', childChunk({ type: 'tool-call-delta', index: 0, argumentsDelta: '"酒馆加钱"}' }, 2))
    sessions.pushChild('session-tail-1', childChunk({ type: 'block-end', index: 0, block: { type: 'tool-call', id: 'c1', name: 'runtimeUpdate', arguments: '{"path":"state.md","content":"酒馆加钱"}' } }, 3))
    await screen.findByText('runtimeUpdate state.md')

    // 双层展开：外层维护行（数据维护）+ 内层步骤行各持折叠——步骤行点开才见
    // 原始参数（外层点开后「工具 摘要」折行随折叠摘要在 DOM 中让位）。
    fireEvent.click(screen.getByText('数据维护'))
    fireEvent.click(screen.getByText('runtimeUpdate'))
    await screen.findByText('{"path":"state.md","content":"酒馆加钱"}')
    sessions.pushChild('session-tail-1', childChunk({ type: 'text-delta', index: 1, text: '维护完成：钱包落账' }, 4))
    await screen.findByText('维护完成：钱包落账')

    // 主流不互吞：父流主代理 text-delta 照常成 live 叙事行（同屏共存）。
    sessions.pushParent(mainChunk({ type: 'text-delta', index: 0, text: '主线正文仍在流。' }))
    await screen.findByText('主线正文仍在流。')

    // skew 护栏：旧引擎透流残帧（tavern-tail: 前缀）原路吸收——不炸、不入正文。
    sessions.pushParent(skewChunk({ type: 'text-delta', index: 0, text: '透流残帧严禁上屏' }))
    await waitFor(() => expect(screen.queryByText('透流残帧严禁上屏')).toBeNull())
    await waitFor(() => expect(screen.queryByText(/严禁上屏/)).toBeNull())
  })

  it('descriptor 诊断重试：catalog-diagnostic 连败后第 3 次连成，直播恢复', async () => {
    // 子会话 descriptor 只随其首 agent/pre-step 上账——孵化→首步窗口内 retain 必败
    // 且 failed open 永不自愈，必须弃引用重来。旋钮先于挂载：前两次地址 retain
    // 以 catalog 诊断失败（结构化 RemoteError 形状：code+details），第三次落定。
    const sessions = tailSessions({ ids: ['session-a'], current: 'session-a' },
      [userEvent(10, '开回合'), catalogRow(40, 'session-tail-1')])
    sessions.failNextReady(2, () => ({ code: 'subagent/catalog-diagnostic', details: { reason: 'unsupported' } }))
    // 预种子：第 3 次连成时快照重折必须把已流帧扫出（中途连上=基线展开同源语义）。
    sessions.seedChild('session-tail-1', childChunk({ type: 'text-delta', index: 1, text: '重试连成后到达。' }, 5))
    const { rpc } = fixtureRpc()
    mount(rpc, sessions)

    const addrRetains = () => sessions.retainCalls.filter(row => typeof row.target === 'object').length
    await waitFor(() => expect(addrRetains()).toBe(3), { timeout: 3_000 })
    // 失败引用由被测钩子自行 release（failed open 不复用同一引用重试）。
    expect(sessions.retainCalls.filter(row => typeof row.target === 'object').at(-2)?.source).toBe('tavern-tail')

    // 第 3 次连成：快照重折扫出已流帧（直播体在 DisclosureRow 折叠体内——先开行）。
    fireEvent.click(screen.getByText('数据维护'))
    await screen.findByText('重试连成后到达。')

    // 连成后的新帧照常走推送路径（notify 折行；fold.reply 累加——正则锚增量）。
    sessions.pushChild('session-tail-1', childChunk({ type: 'text-delta', index: 1, text: '推送路径照常。' }, 6))
    await screen.findByText(/推送路径照常。/)
  })

  it('落定即释放：tavern-tail-done + tailRunning=false → 直跟引用 release 一次、退订生效', async () => {
    const sessions = tailSessions({ ids: ['session-a'], current: 'session-a' },
      [userEvent(10, '我推门走进酒馆'), catalogRow(40, 'session-tail-1')])
    const { rpc, setTailRunning } = fixtureRpc({
      tailRows: [{ childId: 'session-tail-1', at: 1, status: 'completed',
        actions: [{ tool: 'runtimeCreate', detail: 'deed.md', args: '{"path":"deed.md"}', result: '落盘' }], reply: '已维护。' }],
    })
    mount(rpc, sessions)

    await waitFor(() => expect(sessions.retainCalls.length).toBeGreaterThanOrEqual(1))
    // 直播体在 DisclosureRow 折叠体内（open && children）——先开行再验直播帧。
    fireEvent.click(screen.getByText('数据维护'))
    sessions.pushChild('session-tail-1', childChunk({ type: 'text-delta', index: 1, text: '直播中的收尾语。' }, 6))
    await screen.findByText('直播中的收尾语。')
    const live = sessions.lastRelease('session-tail-1')
    expect(live).toBeDefined()
    expect(live?.release).not.toHaveBeenCalled()

    // 落定拍：闸门落 false + 完成信号过账 → 直跟口清理（release 一次 + 退订）。
    setTailRunning(false)
    sessions.pushParent(settleSignal(61))
    await waitFor(() => expect(live?.release).toHaveBeenCalledTimes(1))

    // 落定后子流再来帧：行已走 durable 分支，直播体不再更新，也无异常逃逸。
    sessions.pushChild('session-tail-1', childChunk({ type: 'text-delta', index: 1, text: '落定后的迟到帧' }, 7))
    await waitFor(() => expect(screen.queryByText('直播中的收尾语。')).toBeNull())
    expect(screen.queryByText('落定后的迟到帧')).toBeNull()
  })

  it('连败兜底：稳拍退避内零异常逃逸，行显 durable 台账；卸载即停不再重试', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const sessions = tailSessions({ ids: ['session-a'], current: 'session-a' },
      [userEvent(10, '我推门走进酒馆'), catalogRow(40, 'session-tail-1')])
    // 旋钮先于挂载：地址 retain 永远 catalog 诊断失败。
    sessions.failNextReady(Number.POSITIVE_INFINITY, () => ({ code: 'subagent/catalog-diagnostic', details: { reason: 'unsupported' } }))
    const { rpc } = fixtureRpc({
      tailRows: [{ childId: 'session-tail-1', at: 1, status: 'completed',
        actions: [{ tool: 'runtimeCreate', detail: 'deed.md', args: '{"path":"deed.md"}', result: '落盘' }], reply: '' }],
    })
    const view = mount(rpc, sessions)

    const addrRetains = () => sessions.retainCalls.filter(row => typeof row.target === 'object').length
    // 退避稳拍期间持续重试，无 unhandled rejection（失败必须可见而非抛飞）。
    await waitFor(() => expect(addrRetains()).toBeGreaterThanOrEqual(4), { timeout: 3_000 })

    // durable 降级路径仍可用：展开维护行见台账动作（2s 增量取数的事实正本）。
    fireEvent.click(screen.getByText('数据维护'))
    await screen.findByText('runtimeCreate')
    expect(screen.getByText(/deed\.md/)).toBeTruthy()

    // 卸载即停：稳拍封顶由闸门/生命周期兜底，unmount 后无新 retain。
    view.unmount()
    const attemptsAtUnmount = sessions.retainCalls.length
    await new Promise((resolve) => { setTimeout(resolve, 1_700) })
    expect(sessions.retainCalls.length).toBe(attemptsAtUnmount)
    // 直跟口自身的弃喂告警不应出现（卡 UI「无 preset/ui」的既有 stderr 与本批无关）。
    expect(warn.mock.calls.some(args => String(args[0]).includes('tail follow unavailable'))).toBe(false)
  })
})
