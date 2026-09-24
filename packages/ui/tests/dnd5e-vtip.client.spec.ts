// @vitest-environment jsdom
// dnd5e 悬停浮签引擎（runtime.mjs #vtip,2026-09-24 定案）:
// 0.1s 统一延迟出、移开/滚动即收、dispose 连根收——原生 title(~1s 且不可控)的全量替代。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountPanels } from '../../../tavern_presets/dnd5e/preset/ui/runtime.mjs'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

const PANEL = { name: 'hud-left', slot: 'overlay', data: { script: 'ui_data.mjs' }, view: 'heroPanel' }
const CHAPTER = { text: JSON.stringify({ ok: true, rev: 1, data: { n: 'r1' } }) }

function rig() {
  const container = document.createElement('div')
  container.className = 'tavern-panel-hud-left'
  document.body.append(container)
  return mountPanels({
    doc: document,
    callScript: () => Promise.resolve(CHAPTER),
    panels: [PANEL],
    viewModule: { heroPanel: () => `<div class="dnd-hud">x</div>` },
    actModule: null,
  })
}
const hover = (el: Element) => el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
const tipEl = () => document.getElementById('vtip')

describe('dnd5e vtip 引擎', () => {
  it('挂载即建单件(body 级,token 自携),延迟 <100ms 不出、≥100ms 出——0.1s 口径钉', async () => {
    vi.useFakeTimers()
    const handle = rig()
    const tip = tipEl()
    expect(tip).not.toBeNull()
    expect(tip!.className).toContain('dnd-hud')
    const host = document.createElement('span')
    host.setAttribute('data-tip', '六维属性——力量/敏捷/体质/智力/感知/魅力')
    document.body.append(host)
    hover(host)
    await vi.advanceTimersByTimeAsync(50)
    expect(tip!.classList.contains('open')).toBe(false)
    await vi.advanceTimersByTimeAsync(60)
    expect(tip!.classList.contains('open')).toBe(true)
    expect(tip!.textContent).toContain('六维属性——')
    handle.dispose()
  })
  it('移开即收;换目标刷新文案;scroll(capture)强制收', async () => {
    vi.useFakeTimers()
    const handle = rig()
    const a = Object.assign(document.createElement('span'), {}) as HTMLElement
    a.setAttribute('data-tip', 'A 提示')
    const b = Object.assign(document.createElement('span'), {}) as HTMLElement
    b.setAttribute('data-tip', 'B 提示')
    document.body.append(a, b)
    hover(a)
    await vi.advanceTimersByTimeAsync(100)
    expect(tipEl()!.textContent).toBe('A 提示')
    hover(b)   // 未到 100ms → 先收
    expect(tipEl()!.classList.contains('open')).toBe(false)
    await vi.advanceTimersByTimeAsync(100)
    expect(tipEl()!.textContent).toBe('B 提示')
    document.dispatchEvent(new Event('scroll'))
    expect(tipEl()!.classList.contains('open')).toBe(false)
    handle.dispose()
  })
  it('dispose:监听与浮签元素连根收,后续 mouseover 不复活', async () => {
    vi.useFakeTimers()
    const handle = rig()
    handle.dispose()
    expect(tipEl()).toBeNull()
    const host = document.createElement('span')
    host.setAttribute('data-tip', 'dispose 后不该出现')
    document.body.append(host)
    hover(host)
    await vi.advanceTimersByTimeAsync(200)
    expect(tipEl()).toBeNull()
  })
})
