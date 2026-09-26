// @vitest-environment jsdom
// 转写着陆体系第 1/2/3 层的单元钉（2026-09-25 落地批）：reader-anchor 锚存层、
// landing 着陆决策表、transcript-scroll 滚动机械层。组件级换绑整链另见
// transcript-landing.client.spec。
import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { captureAnchor, createReaderAnchorStore, findAnchorRow } from '../src/client/reader-anchor.ts'
import { decideLanding } from '../src/client/landing.ts'
import { useTranscriptScroller } from '../src/client/transcript-scroll.ts'
import type { ReaderAnchor } from '../src/client/reader-anchor.ts'

/* ---------------------------------------------------------------- 锚存层 */

describe('reader-anchor store — 会话阅读锚的存取与持久', () => {
  const anchor: ReaderAnchor = { seq: 42, offsetPx: 96, follow: false }
  const followAnchor: ReaderAnchor = { seq: 42, offsetPx: 0, follow: true }

  it('capture 后按会话读回原值，会话之间互不串线', () => {
    const store = createReaderAnchorStore()
    store.capture('session-a', anchor)
    store.capture('session-b', followAnchor)
    expect(store.read('session-a')).toEqual(anchor)
    expect(store.read('session-b')).toEqual(followAnchor)
    expect(store.read('session-c')).toBeNull()
  })

  it('null capture = 清锚（发送新消息后不再恢复旧位置）', () => {
    const store = createReaderAnchorStore()
    store.capture('session-a', anchor)
    store.capture('session-a', null)
    expect(store.read('session-a')).toBeNull()
  })

  it('刷新重启后仍在：localStorage 持久（同 pending-session 的家庭常法）——一个新实例 == 一次页面加载', () => {
    const store = createReaderAnchorStore()
    store.capture('session-a', anchor)
    const reloaded = createReaderAnchorStore()
    expect(reloaded.read('session-a')).toEqual(anchor)
  })

  it('超出容量按“最近使用在后”淘汰最老会话', () => {
    const store = createReaderAnchorStore({ capacity: 2 })
    store.capture('session-a', { ...anchor, seq: 1 })
    store.capture('session-b', { ...anchor, seq: 2 })
    store.capture('session-c', { ...anchor, seq: 3 })
    expect(store.read('session-a')).toBeNull()
    expect(store.read('session-b')).not.toBeNull()
    expect(store.read('session-c')).not.toBeNull()
  })

  it('读到旧会话会续命（LRU 以最近读取为准）', () => {
    const store = createReaderAnchorStore({ capacity: 2 })
    store.capture('session-a', { ...anchor, seq: 1 })
    store.capture('session-b', { ...anchor, seq: 2 })
    expect(store.read('session-a')).not.toBeNull() // a 转为最近使用
    store.capture('session-c', { ...anchor, seq: 3 }) // b 被淘汰，a 保命
    expect(store.read('session-a')).not.toBeNull()
    expect(store.read('session-b')).toBeNull()
  })

  it('存储不可用时退化为内存态：本页行为照旧，只失去跨重启的记忆', () => {
    const throwing = { getItem: () => { throw new Error('quota') }, setItem: () => { throw new Error('quota') }, removeItem: () => { throw new Error('quota') } }
    const store = createReaderAnchorStore({ storage: throwing as unknown as Storage })
    store.capture('session-a', anchor)
    expect(store.read('session-a')).toEqual(anchor)
    const reloaded = createReaderAnchorStore({ storage: throwing as unknown as Storage })
    expect(reloaded.read('session-a')).toBeNull()
  })

  it('持久化里的坏 JSON 按无锚处理，非法数值条目不写入也不抛', () => {
    const junk = { getItem: (key: string) => (key.startsWith('tavern.readerAnchor.') ? '{oops' : null), setItem: () => undefined, removeItem: () => undefined }
    const store = createReaderAnchorStore({ storage: junk as unknown as Storage })
    expect(store.read('session-a')).toBeNull()
    expect(() => store.capture('session-a', { seq: Number.NaN, offsetPx: -1, follow: true })).not.toThrow()
  })
})

/* ------------------------------------------------------------ DOM 捕获 */

/** 摆一列带 data-seq 的转写行：每行高 rowHeight 顺序铺开，几何走伪造的
 *  getBoundingClientRect（jsdom 不排版）。rect.top 一律视口坐标。 */
function layoutTranscript(rowSeqs: readonly number[], scrollTop: number, clientHeight: number, rowHeight = 120): HTMLElement {
  const el = document.createElement('div')
  document.body.append(el)
  const rows = rowSeqs.map((seq) => {
    const row = document.createElement('div')
    row.dataset['seq'] = String(seq)
    el.append(row)
    return row
  })
  Object.defineProperty(el, 'scrollTop', { configurable: true, value: scrollTop })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight })
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: rowSeqs.length * rowHeight })
  const containerRect = { top: 0, bottom: clientHeight, height: clientHeight } as DOMRect
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(containerRect as DOMRect)
  const rowsRects = new Map<Element, DOMRect>(
    rows.map((row, index) => [row, { top: index * rowHeight - scrollTop, bottom: index * rowHeight - scrollTop + rowHeight, height: rowHeight } as DOMRect]),
  )
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    return rowsRects.get(this) ?? (containerRect as DOMRect)
  })
  return el
}

describe('captureAnchor — 从转写 DOM 读出阅读位置', () => {
  it('锚=骑在视口顶缘上的那行（保住上半截可见条），offset 可为负，恢复后像素级回原位', () => {
    // 总高 4×120=480，视口 200，scrollTop=170：距底 110 > 80 带外；第 2 行占内容
    // 120–240，骑住顶缘（视口 top=−50）。
    const el = layoutTranscript([10, 11, 12, 13], 170, 200)
    expect(captureAnchor(el)).toEqual({ seq: 11, offsetPx: -50, follow: false })
  })

  it('已贴底/内容不足一屏：follow 锚（seq 取最后一行，offset 归零）', () => {
    // 内容 3×120=360 < 视口 500 —— 不算离底，聚焦底即全量。
    const shortEl = layoutTranscript([10, 11, 12], 0, 500)
    expect(captureAnchor(shortEl)).toEqual({ seq: 12, offsetPx: 0, follow: true })
    // 长内容贴底：总高 480，视口 360，scrollTop=120 → 距底 0 ≤ 80 → follow。
    const tailEl = layoutTranscript([10, 11, 12, 13], 120, 360)
    expect(captureAnchor(tailEl)).toEqual({ seq: 13, offsetPx: 0, follow: true })
  })

  it('离底 80px 带外阅读才存位置锚', () => {
    // 总高 480，视口 200，scrollTop=0 → 距底 280 > 80。
    const el = layoutTranscript([10, 11, 12, 13], 0, 200)
    expect(captureAnchor(el)).toEqual({ seq: 10, offsetPx: 0, follow: false })
  })

  it('空转写与非转写容器安全返回 null', () => {
    const empty = layoutTranscript([], 0, 500)
    expect(captureAnchor(empty)).toBeNull()
    const bare = document.createElement('section')
    document.body.append(bare)
    expect(captureAnchor(bare)).toBeNull()
  })

  it('findAnchorRow 按 seq 重新定位行——重放完成后恢复的靶点', () => {
    const el = layoutTranscript([10, 11, 12], 0, 500)
    expect(findAnchorRow(el, 11)?.dataset['seq']).toBe('11')
    expect(findAnchorRow(el, 99)).toBeNull()
  })
})

/* ------------------------------------------------------------ 着陆决策 */

describe('decideLanding — 换绑 cause 到着地方案的纯函数表', () => {
  it('boot/侧栏点开无存锚：跟随底部（现状语义保持）', () => {
    expect(decideLanding('boot', { stored: null })).toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
    expect(decideLanding('manual-open', { stored: null })).toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
  })

  it('切走再回来（exit-return）有位置锚：恢复锚，流式不拽走视口', () => {
    expect(decideLanding('exit-return', { stored: { seq: 42, offsetPx: -50, follow: false } }))
      .toEqual({ follow: false, anchorSeq: 42, offsetPx: -50 })
  })

  it('切走时正贴底：回来继续跟随（贴底语义的位置锚）', () => {
    expect(decideLanding('exit-return', { stored: { seq: 42, offsetPx: 0, follow: true } }))
      .toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
  })

  it('载入存档（load）：fork 切短的回放底部即存档点；wire 的 anchorSeq 供低层校验，不改变视觉着陆', () => {
    expect(decideLanding('load', { stored: null, loadAnchorSeq: 420 })).toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
    expect(decideLanding('load', { stored: null, loadAnchorSeq: null })).toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
  })

  it('重试/编辑重开（retry/edit-start）：跟随——时序开始的地方', () => {
    expect(decideLanding('retry', { stored: null })).toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
    expect(decideLanding('edit-start', { stored: null })).toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
  })

  it('清空（clear）：空转写回开场页；着陆恒跟随，无害', () => {
    expect(decideLanding('clear', { stored: null, hasContent: false })).toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
    expect(decideLanding('clear', { stored: null, hasContent: true })).toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
  })

  it('exit-return 无存锚 = 首次接触的会话：跟随底部（与现状一致）', () => {
    expect(decideLanding('exit-return', { stored: null })).toEqual({ follow: true, anchorSeq: null, offsetPx: 0 })
  })
})

/* ------------------------------------------------------------ 机械层 */

/** 摆一个滚动容器（总高 1000 / 视口 400）+ 两个可锚行（内容坐标 A=260、B=700），
 *  返回重排入口与视口写入记录。 */
function scrollFixture(): {
  ref: { current: HTMLElement | null }
  rowA: HTMLElement
  rowB: HTMLElement
  writes: number[]
  scrollTo: (top: number) => void
} {
  const el = document.createElement('div')
  document.body.append(el)
  const rowA = document.createElement('div')
  rowA.dataset['seq'] = '7'
  const rowB = document.createElement('div')
  rowB.dataset['seq'] = '8'
  el.append(rowA, rowB)
  const writes: number[] = []
  let scrollTop = 0
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: 1000 })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: 400 })
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => { writes.push(value); scrollTop = value },
  })
  const rect = (contentTop: number): DOMRect => ({ top: contentTop - scrollTop, bottom: contentTop - scrollTop + 120, height: 120 } as DOMRect)
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 400, height: 400 } as DOMRect)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this === rowA) return rect(260)
    if (this === rowB) return rect(700)
    return { top: 0, bottom: 400, height: 400 } as DOMRect
  })
  return {
    ref: { current: el },
    rowA, rowB, writes,
    scrollTo: (top) => { scrollTop = top; el.dispatchEvent(new Event('scroll')) },
  }
}

describe('useTranscriptScroller — 滚动机械层', () => {
  it('挂载即跟随（首 commit 贴底）；读者离底 ≥80px 解除跟随且不再写视口', () => {
    const fx = scrollFixture()
    const { result, rerender } = renderHook(() => useTranscriptScroller(fx.ref as { current: HTMLElement | null }))
    expect(fx.writes).toEqual([1000]) // 初始 armed：挂载 commit 已贴底
    fx.scrollTo(1000) // 贴底写入自身触发的 scroll 事件：仍在带内，保持跟随
    fx.scrollTo(0) // 读者回看历史：距底 1000-0-400=600 > 80 → 解除
    rerender()
    expect(fx.writes).toEqual([1000]) // 解除后 commit 不再拽走视口
    expect(result.current.isFollowing()).toBe(false)
  })

  it('回到 80px 带内重新接上跟随', () => {
    const fx = scrollFixture()
    const { rerender } = renderHook(() => useTranscriptScroller(fx.ref as { current: HTMLElement | null }))
    fx.scrollTo(0)
    rerender()
    fx.scrollTo(560) // 560=1000-400-80：恰在带缘 → 重新接上
    rerender()
    expect(fx.writes[fx.writes.length - 1]).toBe(1000)
  })

  it('land：把锚行的顶送到 offset 指定的视口位置，一次性、不接管后续 commit', () => {
    const fx = scrollFixture()
    const { result, rerender } = renderHook(() => useTranscriptScroller(fx.ref as { current: HTMLElement | null }))
    fx.scrollTo(0) // 离底解除（挂载的那次贴底发生在更早的 commit）
    result.current.land(fx.rowB, -50)
    // rowB 内容坐标 700：scrollTop = 700 − (−50) = 750。
    expect(fx.writes[fx.writes.length - 1]).toBe(750)
    rerender()
    expect(fx.writes[fx.writes.length - 1]).toBe(750) // land 是一次性的
  })

  it('onFollowChange 只在翻转时通知（供“回到底部”按钮显隐）', () => {
    const fx = scrollFixture()
    const flips: boolean[] = []
    const { rerender } = renderHook(() => useTranscriptScroller(fx.ref as { current: HTMLElement | null }, { onFollowChange: (value) => { flips.push(value) } }))
    fx.scrollTo(0)
    expect(flips).toEqual([false])
    fx.scrollTo(600)
    expect(flips).toEqual([false, true])
    rerender()
    rerender()
    expect(flips).toEqual([false, true])
  })
})
