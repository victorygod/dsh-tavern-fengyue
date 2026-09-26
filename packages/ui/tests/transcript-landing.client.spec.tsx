// @vitest-environment jsdom
// 转写着陆体系第 4 层（着陆仲裁）+ 组件换绑整链的回归钉（2026-09-25 落地批）。
// 链路：boot 跟随底 → 读者上滚 → 切走捕获锚 → 切回恢复位置 → 刷新恢复 →
// 发送清锚+重新跟随 → 载入存档落存档点 → 不跟随时的「回到底部」灯。
//
// 入场方式沿用 saves-load.client.spec 的绕行先例：不 import client-runtime
// （makeTranslate 拉进 kernel client.js），locale.bind 用本地查表拼装；
// remote 面按 wire 信封 {ok, value} 出假（tavernRpc 负责解包）。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { TavernRoot } from '../src/client/app/TavernApp.tsx'
import { zh } from '../src/client/locales.ts'
import { createReaderAnchorStore } from '../src/client/reader-anchor.ts'

// 锚存层走 localStorage：每个用例一个干净仓库。
beforeEach(() => { localStorage.clear() })
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const t = ((key: string) => (zh as unknown as Record<string, string>)[key] ?? key) as never

const ROW_H = 120

/** 原型级滚动几何假面：React 首帧 effects（glue 贴底）在 mount() 内同步跑完，
 *  任何“挂载后再绑定”的拍子都来不及——所以在原型层就位，全测试文件装一次，
 *  activeGeo 切换每个用例的度量。scrollTop/scrollHeight/clientHeight 逐属性
 *  覆盖（读写双通）、rect 走「内容坐标 − 当前 scrollTop」。 */
interface GeoState { metrics: { scrollHeight: number; clientHeight: number }; writes: number[]; top: number }
let activeGeo: GeoState | undefined
const ORIGINALS: Partial<Record<'scrollTop' | 'scrollHeight' | 'clientHeight', PropertyDescriptor>> = {}
let installed = false
function installGeometryShim(): void {
  if (installed) return
  installed = true
  for (const name of ['scrollTop', 'scrollHeight', 'clientHeight'] as const) {
    ORIGINALS[name] = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name)
    const original = ORIGINALS[name]
    Object.defineProperty(HTMLElement.prototype, name, {
      configurable: true,
      get(this: HTMLElement): number {
        if (activeGeo !== undefined && typeof this.className === 'string' && this.className.includes('transcript')) {
          if (name === 'scrollTop') return activeGeo.top
          if (name === 'scrollHeight') return activeGeo.metrics.scrollHeight
          return activeGeo.metrics.clientHeight
        }
        return original?.get?.call(this) ?? 0
      },
      set(this: HTMLElement, value: number) {
        if (activeGeo !== undefined && typeof this.className === 'string' && this.className.includes('transcript')) {
          activeGeo.writes.push(value)
          activeGeo.top = value
          return
        }
        original?.set?.call(this, value)
      },
    })
  }
  if (ORIGINAL_RECT === undefined) ORIGINAL_RECT = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect')
  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: function (this: HTMLElement) {
      if (activeGeo !== undefined && typeof this.className === 'string' && this.className.includes('transcript')) {
        return { top: 0, bottom: activeGeo.metrics.clientHeight, height: activeGeo.metrics.clientHeight } as DOMRect
      }
      const rows = [...(this.parentElement?.querySelectorAll<HTMLElement>('[data-seq]') ?? [])]
      const index = rows.indexOf(this)
      const top = activeGeo?.top ?? 0
      const viewportTop = index === -1 ? 0 : index * ROW_H - top
      return { top: viewportTop, bottom: viewportTop + ROW_H, height: ROW_H } as DOMRect
    },
  })
}
let ORIGINAL_RECT: PropertyDescriptor | undefined
// 垫片一次安装、跨用例存续：所有路径都以 activeGeo 是否在场决定委托，卸载反而不必。
afterEach(() => { activeGeo = undefined })

/** 用例入口：装配原型假面并返回本用例的度量手柄。 */
function fakeTranscriptGeometry(scrollHeight: number, clientHeight: number): {
  writes: number[]
  scrollTop: () => number
  scrollTo: (top: number) => void
  grow: (height: number) => void
} {
  installGeometryShim()
  const geo: GeoState = { metrics: { scrollHeight, clientHeight }, writes: [], top: 0 }
  activeGeo = geo
  const el = (): HTMLElement | null => document.querySelector('[class*="transcript"]')
  return {
    writes: geo.writes,
    scrollTop: () => geo.top,
    scrollTo: (value) => {
      geo.top = value
      el()?.dispatchEvent(new Event('scroll'))
    },
    grow: (height) => { geo.metrics.scrollHeight = height },
  }
}

const userEvent = (seq: number, text: string) => ({ type: 'event', event: { type: 'user/message', seq, data: { role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } }, surfaceOp: 'append' } })
const assistantEvent = (seq: number, text: string) => ({ type: 'event', event: { type: 'assistant/message', seq, data: { message: { role: 'assistant', content: [{ type: 'text', text }] } }, surfaceOp: 'append' } })
const turnEnd = (seq: number, turn: number) => ({ type: 'event', event: { type: 'turn/end', seq, data: { turn } } })

/** 多会话假面：列表快照可控切 current；每会话独立事件流；open 兜底注册新 id。 */
function multiSessions(initial: { ids: string[]; current: string }, entriesBySession: Record<string, readonly unknown[]>) {
  let snapshot = { ids: initial.ids as string[], byId: Object.fromEntries(initial.ids.map(id => [id, { title: id }])), current: initial.current }
  const listListeners = new Set<() => void>()
  const sessionListeners = new Map<string, Set<() => void>>()
  const entries: Record<string, unknown[]> = {}
  for (const [id, rows] of Object.entries(entriesBySession)) entries[id] = [...rows]
  const running: Record<string, boolean> = {}
  const bindingOf = (id: string) => {
    // useSyncExternalStore 的三条铁则要在假面成立：绑定/face 身份稳定、
    // getSnapshot 返回稳定对象（变化 = 原地改字段 + notify）、subscribe 幂等。
    // 任何一条破——forceStoreRerender 无限循环。真宿主同款契约。
    const projectionFaces = new Map<string, unknown>()
    const sourceSnapshot = { entries: entries[id] ?? [] }
    const sessionSnapshot = { running: false, openState: 'open', openError: null, promptError: null, removed: false }
    return {
      sourceSnapshot,
      sessionSnapshot,
      eventSource: {
        getSnapshot: () => sourceSnapshot,
        subscribe: (listener: () => void) => {
          const set = sessionListeners.get(id) ?? new Set()
          set.add(listener)
          sessionListeners.set(id, set)
          return () => { sessionListeners.get(id)?.delete(listener) }
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
  const bindingCache = new Map<string, unknown>()
  return {
    open: (id: string) => {
      if (!snapshot.ids.includes(id)) snapshot = { ...snapshot, ids: [...snapshot.ids, id] }
      snapshot = { ...snapshot, current: id }
      for (const listener of listListeners) listener()
    },
    setCurrent: (id: string) => {
      snapshot = { ...snapshot, current: id }
      for (const listener of listListeners) listener()
    },
    setRunning: (id: string, value: boolean) => {
      const record = bindingCache.get(id) as { sessionSnapshot?: { running: boolean } } | undefined
      if (record?.sessionSnapshot !== undefined) record.sessionSnapshot.running = value
      for (const listener of sessionListeners.get(id) ?? []) listener()
    },
    push: (id: string, event: unknown) => {
      entries[id]?.push(event)
      for (const listener of sessionListeners.get(id) ?? []) listener()
    },
    list: {
      subscribe: (listener: () => void) => { listListeners.add(listener); return () => { listListeners.delete(listener) } },
      getSnapshot: () => snapshot,
    },
    binding: (id: string) => {
      let record = bindingCache.get(id)
      if (record === undefined) {
        record = bindingOf(id)
        bindingCache.set(id, record)
      }
      return record
    },
    refresh: vi.fn(async () => undefined),
    openWindow: () => undefined,
    byId: {},
  }
}

type FakeRpc = Record<string, unknown>

/** 标准 rpc 假面：两工作区、各两行转写、存档行齐备。overrides 直落原始值面。 */
function fixtureRpc(overrides: FakeRpc = {}): FakeRpc {
  const rows = [
    { name: 'ws-a', sessionId: 'session-a', hasCard: true, title: '海港小镇', desc: 'DND', cover: '' },
    { name: 'ws-b', sessionId: 'session-b', hasCard: true, title: '雪峰驿站', desc: 'DND', cover: '' },
  ]
  return {
    createSession: () => Promise.resolve({ sessionId: 's-new' }),
    workspaces: () => Promise.resolve({ rows }),
    renameSession: () => Promise.resolve({ ok: true }),
    deleteSession: () => Promise.resolve({ ok: true }),
    readAsset: () => Promise.resolve({ dataUrl: 'data:image/png;base64,' }),
    writeAsset: () => Promise.resolve({ ok: true }),
    state: () => Promise.resolve({ hasCard: true, maintenanceOn: false, narratorToolsOn: true, title: '海港小镇', desc: 'DND', cover: '', drafting: false, editing: null, tailRunning: false, dialogStarted: true, retryable: false }),
    library: () => Promise.resolve({ cards: [] }),
    deleteCard: () => Promise.resolve({ ok: true }),
    deleteSave: () => Promise.resolve({ ok: true }),
    importFromLibrary: () => Promise.resolve({ ok: true }),
    draftCard: () => Promise.resolve({ ok: true }),
    opening: () => Promise.resolve({ html: null }),
    tree: () => Promise.resolve({ entries: [] }),
    readText: (request: { path: string }) => Promise.resolve({
      text: request.path === 'preset/meta.json' ? `${JSON.stringify({ title: '海港小镇', desc: 'DND', cover: '' }, undefined, 2)}\n` : '',
    }),
    writeText: () => Promise.resolve({ ok: true }),
    fileOp: () => Promise.resolve({ ok: true }),
    saves: () => Promise.resolve({ saves: [{ name: '第一次抉择', type: 'manual', summary: '我推门走进酒馆' }] }),
    retryPoint: () => Promise.resolve({ sessionId: 'session-retried', text: '' }),
    save: () => Promise.resolve({ ok: true }),
    commitImport: () => Promise.resolve({ name: '海港小镇' }),
    publishCard: () => Promise.resolve({ name: '海港小镇' }),
    saveEdit: () => Promise.resolve({ name: '海港小镇' }),
    editDirty: () => Promise.resolve({ dirty: false }),
    load: () => Promise.resolve({ sessionId: 'session-loaded', draft: '' }),
    editFromLibrary: () => Promise.resolve({ ok: true }),
    cancelEdit: () => Promise.resolve({ ok: true }),
    reset: () => Promise.resolve({ sessionId: 'session-fresh', draft: '' }),
    prompt: () => Promise.resolve({ accepted: true }),
    stop: () => Promise.resolve({ accepted: true, tailStopped: false }),
    tailTranscript: () => Promise.resolve({ tails: [] }),
    ...overrides,
  }
}

/** 挂 TavernRoot：rpc 假面逐方法包成 wire 信封（tavernRpc 解包）。 */
function mount(rpc: FakeRpc, sessions: ReturnType<typeof multiSessions>): void {
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
  render(<TavernRoot ctx={ctx as unknown as ClientContext} />)
}

describe('换绑着陆整链（第 4 层裁定 + 三层效应在 TavernChatView 编译）', () => {
  it('boot 无存锚：落到最新一行（跟随态，现行为保持）', async () => {
    // 会话 a 的两可见行 + turn/end（不出行）；fake 总高 780，视口 400。
    const geo = fakeTranscriptGeometry(780, 400)
    const sessions = multiSessions({ ids: ['session-a', 'session-b'], current: 'session-a' },
      { 'session-a': [userEvent(10, '我推门走进酒馆'), assistantEvent(20, '酒保抬眼看你。'), turnEnd(30, 1)] })
    mount(fixtureRpc(), sessions)
    await screen.findByText('酒保抬眼看你。')
    await waitFor(() => { expect(geo.writes.length).toBeGreaterThan(0) })
    expect(geo.writes.at(-1)).toBe(780)
  })

  it('切走捕获阅读锚 → 切回恢复位置；不跟随时流式不拽视口；回底灯接回跟随', async () => {
    // 两行（内容坐标 0/120），fake 总高 600、视口 160：顶缘距底 440 > 80 → 带外。
    const geo = fakeTranscriptGeometry(600, 160)
    const sessions = multiSessions({ ids: ['session-a', 'session-b'], current: 'session-a' },
      { 'session-a': [userEvent(10, '我推门走进酒馆'), assistantEvent(20, '酒保抬眼看你。')],
        'session-b': [userEvent(40, '去雪峰驿站'), assistantEvent(50, '守卫拦住了你。')] })
    mount(fixtureRpc(), sessions)
    await screen.findByText('酒保抬眼看你。')
    console.log('BOOTROWS>', [...document.querySelectorAll('[data-seq]')].map(n => n.getAttribute('data-seq')).join(','), '| bodyclasses:', (document.querySelector('[class*="msgUser"]')?.outerHTML ?? 'NONE').slice(0, 200))
    await waitFor(() => expect(geo.writes.length).toBeGreaterThan(0)) // boot 贴底
    geo.writes.length = 0

    // 读者回看到 scrollTop=30：锚行=骑顶缘的第 1 行（seq 10，offset −30）。
    geo.scrollTo(30)
    sessions.setCurrent('session-b')
    await screen.findByText('守卫拦住了你。')

    await waitFor(() => expect(geo.writes.length).toBeGreaterThan(0)) // b 会话跟随落底
    geo.writes.length = 0
    expect(createReaderAnchorStore().read('session-a')).toEqual({ seq: 10, offsetPx: -30, follow: false })

    // 切回：恢复锚 → scrollTop 回到 30（= 行内容 0 − offset −30）。
    sessions.setCurrent('session-a')
    await screen.findByText('酒保抬眼看你。')
    await waitFor(() => expect(geo.scrollTop()).toBe(30))

    // 不跟随：流式增量与行增长都不拽视口。
    const before = geo.scrollTop()
    sessions.setRunning('session-a', true)
    sessions.push('session-a', { type: 'transient', event: { type: 'assistant/live-chunk', data: { attemptId: 'a', chunk: { type: 'text-delta', text: '夜雨落下。' } } } })
    await screen.findByText('夜雨落下。')
    geo.grow(640)
    await new Promise((resolve) => { setTimeout(resolve, 20) })
    expect(geo.scrollTop()).toBe(before)

    // 回底灯：点击接回跟随（写入新的 scrollHeight）。
    fireEvent.click(screen.getByRole('button', { name: '回到底部' }))
    await waitFor(() => { expect(geo.writes.at(-1)).toBe(640) })
  })

  it('刷新（重挂载）后从 localStorage 恢复阅读位置', async () => {
    // 预置锚：曾读过第 2 行（seq 20，内容坐标 120），offset −20。
    createReaderAnchorStore().capture('session-a', { seq: 20, offsetPx: -20, follow: false })
    const geo = fakeTranscriptGeometry(600, 160)
    const sessions = multiSessions({ ids: ['session-a'], current: 'session-a' },
      { 'session-a': [userEvent(10, '我推门走进酒馆'), assistantEvent(20, '酒保抬眼看你。')] })
    mount(fixtureRpc(), sessions)
    await screen.findByText('酒保抬眼看你。')
    // scrollTop = 行内容 120 − offset(−20) = 140。
    await waitFor(() => { expect(geo.scrollTop()).toBe(140) })
  })

  it('发送清掉锚并重新贴底跟随', async () => {
    createReaderAnchorStore().capture('session-b', { seq: 50, offsetPx: -20, follow: false })
    const geo = fakeTranscriptGeometry(600, 160)
    const sessions = multiSessions({ ids: ['session-a', 'session-b'], current: 'session-b' },
      { 'session-b': [userEvent(40, '去雪峰驿站'), assistantEvent(50, '守卫拦住了你。')] })
    mount(fixtureRpc(), sessions)
    await screen.findByText('守卫拦住了你。')
    await waitFor(() => { expect(geo.scrollTop()).toBe(140) }) // 锚恢复（第 2 行内容 120）
    fireEvent.change(screen.getByPlaceholderText('你的行动…'), { target: { value: '拔剑' } })
    fireEvent.click(screen.getByRole('button', { name: '发送' }))
    await waitFor(() => { expect(geo.writes.at(-1)).toBe(600) }) // 重新贴底
    await waitFor(() => { expect(createReaderAnchorStore().read('session-b')).toBeNull() })
  })

  it('载入存档：换绑到 fork 出的新会话，回放贴底落在存档点；anchorSeq 随 wire 带回', async () => {
    const load = vi.fn(() => Promise.resolve({ sessionId: 'session-loaded', draft: '', anchorSeq: 30 }))
    const geo = fakeTranscriptGeometry(600, 160)
    const sessions = multiSessions({ ids: ['session-a', 'session-b'], current: 'session-a' },
      { 'session-a': [userEvent(10, '我推门走进酒馆'), assistantEvent(20, '酒保抬眼看你。')],
        'session-loaded': [userEvent(10, '第一次抉择'), assistantEvent(20, '存档点的那句。'), turnEnd(30, 1)] })
    mount(fixtureRpc({ load }), sessions)
    await screen.findByText('酒保抬眼看你。')

    // 头部「加载」打开存档页 → 点存档行「载入」。
    fireEvent.click(screen.getAllByText('加载').at(-1)!)
    await screen.findByText('第一次抉择')
    fireEvent.click(screen.getAllByText('载入').at(-1)!)
    expect(load).toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('存档点的那句。')).toBeDefined())
    await waitFor(() => { expect(geo.writes.at(-1)).toBe(600) }) // 跟随到底 == fork 切点（存档点）
  })
})
