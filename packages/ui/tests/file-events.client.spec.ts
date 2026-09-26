// @vitest-environment jsdom
// file-events 单例钉(2026-09-25,通道批)——投递四规则 / hello 语义 (冷启不重放,重连才 resync) /
// watcher 降级 30s 慢拉自动启停 / 订户归零关流。jsdom 无 EventSource:no-op 钉走 stubGlobal(undefined),
// 真路径走 FakeEventSource。每用例尾声全量退订——单例归零复初,例间零泄漏。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { subscribeFileEvents } from '../src/client/file-events.ts'

class FakeEventSource {
  static instances: FakeEventSource[] = []
  readonly url: string
  closed = false
  onmessage: ((event: { data: string }) => void) | null = null
  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }
  close() { this.closed = true }
  emit(frame: unknown): void { this.onmessage?.({ data: JSON.stringify(frame) }) }
}

const cleanups: Array<() => void> = []
const sub = (sessionId: string, listener: (hint: { paths: readonly string[] }) => void): (() => void) => {
  const unsub = subscribeFileEvents(sessionId, listener)
  cleanups.push(unsub)
  return unsub
}

afterEach(() => {
  for (const unsub of cleanups.splice(0)) unsub()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  if ((FakeEventSource.instances.at(-1)?.closed ?? true) === false) throw new Error('EventSource 未随归零关流')
})

describe('subscribeFileEvents(单例)', () => {
  it('无 EventSource(jsdom/非事件源环境)→ 订阅不抛、恒无事件(卡轮询兜底)', () => {
    vi.stubGlobal('EventSource', undefined)
    const hints: readonly string[][] = []
    sub('session-a', hint => { hints.push(hint.paths) })
    expect(hints).toEqual([])
  })

  it('files 帧按 sessionId 过滤:本会话送达带 paths;其他会话不扰', () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const a: readonly string[][] = []
    const b: readonly string[][] = []
    sub('session-a', hint => { a.push(hint.paths) })
    sub('session-b', hint => { b.push(hint.paths) })
    const es = FakeEventSource.instances.at(-1)
    expect(es?.url).toBe('/tavern/events')
    es?.emit({ type: 'hello' })                                   // 冷启首 hello:不重放
    expect(a).toEqual([])
    es?.emit({ type: 'files', sessionId: 'session-a', paths: ['ws-1/runtime/state.md'], truncated: false })
    expect(a).toEqual([['ws-1/runtime/state.md']])
    expect(b).toEqual([])
    es?.emit({ type: 'files', sessionId: 'session-b', paths: ['ws-2/runtime/state.md'], truncated: false })
    expect(b).toEqual([['ws-2/runtime/state.md']])
    expect(a).toHaveLength(1)
  })

  it('hello 第二次(重连)→ 全订户 resync({paths:[]})', () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const a: readonly string[][] = []
    const b: readonly string[][] = []
    sub('session-a', hint => { a.push(hint.paths) })
    sub('session-b', hint => { b.push(hint.paths) })
    const es = FakeEventSource.instances.at(-1)
    es?.emit({ type: 'hello' })
    es?.emit({ type: 'hello' })                                    // 断线重连后的第二次
    expect(a).toEqual([[]])
    expect(b).toEqual([[]])
    es?.emit({ type: 'hello' })                                    // 第三次同样=每次重连都 resync
    expect(a).toEqual([[], []])
  })

  it('sessionId=null:paths 空(全局暗示)→ 全体 resync;带真实 paths(未知会话)→ 丢弃', () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const a: readonly string[][] = []
    sub('session-a', hint => { a.push(hint.paths) })
    const es = FakeEventSource.instances.at(-1)
    es?.emit({ type: 'files', sessionId: null, paths: [], truncated: false })
    expect(a).toEqual([[]])
    es?.emit({ type: 'files', sessionId: null, paths: ['ws-unknown/runtime/state.md'], truncated: false })
    expect(a).toEqual([[]])   // 未知会话残影:不投(卡轮询兜底)
  })

  it('watch 降级:ok:false → 30s 慢拉全体;ok:true → 停', () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    vi.useFakeTimers()
    const a: readonly string[][] = []
    sub('session-a', hint => { a.push(hint.paths) })
    const es = FakeEventSource.instances.at(-1)
    es?.emit({ type: 'hello' })
    es?.emit({ type: 'watch', ok: false })
    vi.advanceTimersByTime(35_000)                                 // 降级一拍
    expect(a).toEqual([[]])
    vi.advanceTimersByTime(30_000)                                 // 降级第二拍
    expect(a).toEqual([[], []])
    es?.emit({ type: 'watch', ok: true })
    vi.advanceTimersByTime(90_000)                                 // 恢复后不再慢拉
    expect(a).toEqual([[], []])
  })

  it('订户归零 → close 事件流;再订阅 → 新连接(重新冷启 hello)', () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const a: readonly string[][] = []
    const unsubA = sub('session-a', hint => { a.push(hint.paths) })
    const first = FakeEventSource.instances.at(-1)
    unsubA()
    expect(first?.closed).toBe(true)
    sub('session-a', hint => { a.push(hint.paths) })
    const second = FakeEventSource.instances.at(-1)
    expect(second).not.toBe(first)
    second?.emit({ type: 'hello' })                                // 新连接首 hello = 冷启,不重放
    expect(a).toEqual([])
  })

  it('单个订户回调抛错 → 隔离,不挡其他订户、不毁通道(留痕 console)', () => {
    vi.stubGlobal('EventSource', FakeEventSource)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const a: readonly string[][] = []
    sub('session-a', () => { throw new Error('卡炸了') })
    sub('session-a', hint => { a.push(hint.paths) })
    const es = FakeEventSource.instances.at(-1)
    es?.emit({ type: 'files', sessionId: 'session-a', paths: ['ws-1/preset/meta.json'], truncated: false })
    expect(a).toEqual([['ws-1/preset/meta.json']])
    expect(warn).toHaveBeenCalled()
  })
})
