// @vitest-environment jsdom
// dnd5e 卡自携面板运行时(runtime.mjs)的行为钉:挂载即画、rev 门跳过同帧、
// 失败显错误 chip(结构化死因)、dispose 后泵彻底停摆(帧界纪律——
// 串台/TDZ 两课的回归面)。运行时按卡主权 vendoring(2026-09-22 拍板),
// 本套件直接对卡资产文件本身回归——逻辑搬动即测试跟随。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountPanels } from '../../../tavern_presets/dnd5e/preset/ui/runtime.mjs'

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

const PANEL = {
  name: 'hud-left', slot: 'overlay',
  data: { script: 'ui_data.mjs' },
  view: 'heroPanel',
}

function rig(responses: Array<{ text?: string; failure?: { reason: string; exitCode?: number } }>) {
  const calls: Array<{ name: string; argv: Record<string, unknown> }> = []
  let cursor = 0
  const callScript = (name: string, argvJson: string) => {
    calls.push({ name, argv: JSON.parse(argvJson) })
    const next = responses[Math.min(cursor, responses.length - 1)]
    cursor += 1
    return next === undefined ? Promise.reject(new Error('no data')) : Promise.resolve(next as { text: string })
  }
  const container = document.createElement('div')
  container.className = 'tavern-panel-hud-left'
  document.body.append(container)
  const viewModule = {
    heroPanel: (data: unknown) => `<div class="dnd-hud">hero:${JSON.stringify((data as { n: string }).n)}</div>`,
  }
  return { calls, container, callScript, viewModule }
}

const payload = (rev: number) => ({ text: JSON.stringify({ ok: true, rev, data: { n: `r${rev}` } }) })

describe('dnd5e vendored panel runtime', () => {
  it('paints on the first beat, skips equal-rev repaints, repaints on rev change', async () => {
    vi.useFakeTimers()
    const { calls, container, callScript, viewModule } = rig([payload(1), payload(1), payload(2)])
    const handle = mountPanels({ doc: document, callScript, panels: [PANEL], viewModule, actModule: null })
    await vi.advanceTimersByTimeAsync(0)
    expect(container.textContent).toContain('hero:"r1"')
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(2000)
    expect(container.textContent).toContain('hero:"r1"')
    await vi.advanceTimersByTimeAsync(2000)
    expect(container.textContent).toContain('hero:"r2"')
    expect(calls).toHaveLength(3)
    handle.dispose()
  })

  it('a failing script renders the error chip with the structured reason, never silence', async () => {
    vi.useFakeTimers()
    const { container, callScript, viewModule } = rig([{ failure: { reason: 'exit', exitCode: 7 } }])
    const handle = mountPanels({ doc: document, callScript, panels: [PANEL], viewModule, actModule: null })
    await vi.advanceTimersByTimeAsync(0)
    expect(container.querySelector('.tavern-panel-err')?.textContent).toContain('exit 7')
    handle.dispose()
  })

  it('dispose stops the pump even with an in-flight beat (帧界纪律)', async () => {
    vi.useFakeTimers()
    const { calls, container, callScript, viewModule } = rig([payload(1), payload(2), payload(3)])
    const handle = mountPanels({ doc: document, callScript, panels: [PANEL], viewModule, actModule: null })
    await vi.advanceTimersByTimeAsync(0)
    expect(container.textContent).toContain('r1')
    handle.dispose()
    const count = calls.length
    await vi.advanceTimersByTimeAsync(10_000)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(count)
    expect(container.textContent).toContain('r1')
  })

  it('acts receive their context (actEl/panel/views) and re-render through ui state', async () => {
    vi.useFakeTimers()
    const { container, callScript, viewModule } = rig([payload(1)])
    const seen: Array<{ target?: string; panel?: string; hasViews: boolean }> = []
    const handle = mountPanels({
      doc: document, callScript, panels: [PANEL], viewModule,
      actModule: {
        pick: ctx => {
          seen.push({ target: ctx.actEl.dataset['target'], panel: ctx.panel, hasViews: typeof ctx.views === 'object' })
          ctx.setUi('picked', true)
          ctx.repaint()
        },
      },
    })
    await vi.advanceTimersByTimeAsync(0)
    container.innerHTML += '<button data-act="pick" data-target="player"></button>'
    container.querySelector<HTMLButtonElement>('button[data-act="pick"]')?.click()
    expect(seen).toEqual([{ target: 'player', panel: 'hud-left', hasViews: true }])
    handle.dispose()
  })

  it('总开关 setPanelsHidden:类驱动(--off)且泵拍/rev 重绘永不复活', async () => {
    vi.useFakeTimers()
    const panel = { ...PANEL, hideDuringOpening: true }
    const { container, callScript, viewModule } = rig([payload(1), payload(2), payload(3)])
    const handle = mountPanels({ doc: document, callScript, panels: [panel], viewModule, actModule: null })
    await vi.advanceTimersByTimeAsync(0)
    handle.setPanelsHidden(true)
    expect(container.classList.contains('tavern-panel--off')).toBe(true)
    expect((container as HTMLElement).style.display).toBe('')   // 不用 display——留给开幕硬藏
    // 跨两拍(rev 变更重绘)用户隐藏仍被尊重——曾案:hideDuringOpening 强制 display:'' 2 秒内复活
    await vi.advanceTimersByTimeAsync(4000)
    expect(container.classList.contains('tavern-panel--off')).toBe(true)
    expect(container.textContent).toContain('r3')   // rig 轮换到 r3=重绘确已发生(innerHTML 换新),类仍未被踩
    handle.setPanelsHidden(false)
    expect(container.classList.contains('tavern-panel--off')).toBe(false)
    handle.dispose()
  })

  it('opening 在场:hideDuringOpening display 硬藏并压过用户态;散场后回到用户态', async () => {
    vi.useFakeTimers()
    const panel = { ...PANEL, hideDuringOpening: true }
    const { container, callScript, viewModule } = rig([payload(1), payload(2)])
    const handle = mountPanels({ doc: document, callScript, panels: [panel], viewModule, actModule: null })
    const opening = document.createElement('div')
    opening.className = 'openingWrap'
    document.body.append(opening)
    await vi.advanceTimersByTimeAsync(0)
    expect((container as HTMLElement).style.display).toBe('none')
    handle.setPanelsHidden(true)
    opening.remove()
    await vi.advanceTimersByTimeAsync(2000)
    expect((container as HTMLElement).style.display).toBe('')
    expect(container.classList.contains('tavern-panel--off')).toBe(true)   // 散场=回归用户隐藏
    handle.dispose()
  })
})
