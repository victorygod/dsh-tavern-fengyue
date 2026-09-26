// @vitest-environment jsdom
// dnd5e 卡自携面板运行时(runtime.mjs)的行为钉:挂载即画、rev 门跳过同帧、
// 失败显错误 chip(结构化死因)、dispose 后泵彻底停摆(帧界纪律——
// 串台/TDZ 两课的回归面)。运行时按卡主权 vendoring(2026-09-22 拍板),
// 本套件直接对卡资产文件本身回归——逻辑搬动即测试跟随。
// v10(2026-09-25 零轮询):时序断言随泵语义迁移——原 2s 重臂例改 kick 驱动,
// 新增 无钟证明/kick 立拉/在途合并/MutationObserver 容器补拍;op=panel 携 rev
// (拉式差量)在 argv 断言中钉住。设计:docs/notes/feature/2026-09-25-cards-zero-poll-migration.zh.md。
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

const mount = (rigged: ReturnType<typeof rig>, panel = PANEL) =>
  mountPanels({ doc: document, callScript: rigged.callScript, panels: [panel], viewModule: rigged.viewModule, actModule: null })

describe('dnd5e vendored panel runtime(v10 零轮询)', () => {
  it('挂载即画;后续拍经 kick 触发,argv 携带已知 rev(拉式差量);rev 同值跳过重绘、变更才重绘', async () => {
    vi.useFakeTimers()
    const { calls, container, callScript, viewModule } = rig([payload(1), payload(1), payload(2)])
    const handle = mount({ calls, container, callScript, viewModule })
    await vi.advanceTimersByTimeAsync(0)
    expect(container.textContent).toContain('hero:"r1"')
    expect(calls).toHaveLength(1)
    handle.kick()
    await vi.advanceTimersByTimeAsync(0)
    expect(container.textContent).toContain('hero:"r1"')   // rev 同值:重绘被门截住
    expect(calls).toHaveLength(2)
    expect(calls[1]?.argv.rev).toBe(1)                    // 已知 rev 进 argv(拉式差量协议)
    handle.kick()
    await vi.advanceTimersByTimeAsync(0)
    expect(container.textContent).toContain('hero:"r2"')
    expect(calls).toHaveLength(3)
    handle.dispose()
  })

  it('a failing script renders the error chip with the structured reason, never silence', async () => {
    vi.useFakeTimers()
    const { calls, container, callScript, viewModule } = rig([{ failure: { reason: 'exit', exitCode: 7 } }])
    const handle = mount({ calls, container, callScript, viewModule })
    await vi.advanceTimersByTimeAsync(0)
    expect(container.querySelector('.tavern-panel-err')?.textContent).toContain('exit 7')
    handle.dispose()
  })

  it('dispose stops the pump even with an in-flight beat (帧界纪律);dispose 后 kick 全静默', async () => {
    vi.useFakeTimers()
    const { calls, container, callScript, viewModule } = rig([payload(1), payload(2), payload(3)])
    const handle = mount({ calls, container, callScript, viewModule })
    await vi.advanceTimersByTimeAsync(0)
    expect(container.textContent).toContain('r1')
    handle.dispose()
    const count = calls.length
    handle.kick()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(calls).toHaveLength(count)
    expect(container.textContent).toContain('r1')
  })

  it('acts receive their context (actEl/panel/views) and re-render through ui state', async () => {
    vi.useFakeTimers()
    const { calls, container, callScript, viewModule } = rig([payload(1)])
    const seen: Array<{ target?: string; panel?: string; hasViews: boolean }> = []
    const handle = mountPanels({
      doc: document, callScript, viewModule,
      panels: [PANEL],
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

  it('无钟证明:零 kick 时 20s 无一拍(空闲零请求)——零轮询主语义', async () => {
    vi.useFakeTimers()
    const { calls, container, callScript, viewModule } = rig([payload(1)])
    const handle = mount({ calls, container, callScript, viewModule })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(20_000)             // 旧 2s 重臂在此期间该打 10 拍
    expect(calls).toHaveLength(1)                          // v10:kick 不来,一拍不发
    handle.dispose()
  })

  it('总开关 setPanelsHidden:类驱动(--off)且 kick 重绘永不复活', async () => {
    vi.useFakeTimers()
    const panel = { ...PANEL, hideDuringOpening: true }
    const { calls, container, callScript, viewModule } = rig([payload(1), payload(2), payload(3)])
    const handle = mount({ calls, container, callScript, viewModule }, panel)
    await vi.advanceTimersByTimeAsync(0)
    handle.setPanelsHidden(true)
    expect(container.classList.contains('tavern-panel--off')).toBe(true)
    expect((container as HTMLElement).style.display).toBe('')   // 不用 display——留给开幕硬藏
    // 跨两次 kick 重绘(rev 变更)用户隐藏仍被尊重——曾案:hideDuringOpening 强制 display:'' 2 秒内复活
    handle.kick()
    await vi.advanceTimersByTimeAsync(0)
    handle.kick()
    await vi.advanceTimersByTimeAsync(0)
    expect(container.classList.contains('tavern-panel--off')).toBe(true)
    expect(container.textContent).toContain('r3')   // rig 轮换到 r3=重绘确已发生(innerHTML 换新),类仍未被踩
    handle.setPanelsHidden(false)
    expect(container.classList.contains('tavern-panel--off')).toBe(false)
    handle.dispose()
  })

  it('opening 在场:hideDuringOpening display 硬藏并压过用户态;散场经 kick 回显并回归用户态', async () => {
    vi.useFakeTimers()
    const panel = { ...PANEL, hideDuringOpening: true }
    const { calls, container, callScript, viewModule } = rig([payload(1), payload(2)])
    const handle = mount({ calls, container, callScript, viewModule }, panel)
    const opening = document.createElement('div')
    opening.className = 'openingWrap'
    document.body.append(opening)
    await vi.advanceTimersByTimeAsync(0)
    expect((container as HTMLElement).style.display).toBe('none')
    handle.setPanelsHidden(true)
    opening.remove()
    handle.kick()                                       // 开场散场信号→kick 一拍重评(原蹭 2s 整拍)
    await vi.advanceTimersByTimeAsync(0)
    expect((container as HTMLElement).style.display).toBe('')
    expect(container.classList.contains('tavern-panel--off')).toBe(true)   // 散场=回归用户隐藏
    handle.dispose()
  })

  it('kick 在途合并:beat 进行中连击塌缩为恰一次尾随补拍(绝不并行起 beat)', async () => {
    vi.useFakeTimers()
    const calls: Array<Record<string, unknown>> = []
    let gate: Array<(value: { text: string }) => void> | null = null
    const callScript = (name: string, argvJson: string) => {
      calls.push(JSON.parse(argvJson))
      if (gate === null) return Promise.resolve(payload(1))
      return new Promise(resolve => { ;(gate ?? []).push(resolve) })
    }
    const container = document.createElement('div')
    container.className = 'tavern-panel-hud-left'
    document.body.append(container)
    const viewModule = { heroPanel: (data: unknown) => `hero:${JSON.stringify((data as { n: string }).n)}` }
    const handle = mountPanels({ doc: document, callScript, panels: [PANEL], viewModule, actModule: null })
    await vi.advanceTimersByTimeAsync(0)             // beat1 快路画 r1
    expect(calls).toHaveLength(1)
    gate = []
    handle.kick()                                   // beat2 在途(挂起)
    handle.kick()
    handle.kick()                                    // 在途两次 → kickWanted 合并
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(2)                    // 只有 beat2 的拉取在途,未起第三拍
    for (const release of (gate ?? []).splice(0)) release(payload(5))   // 放行 beat2
    await vi.advanceTimersByTimeAsync(0)            // beat2 落定;kickWanted 补拍起臂
    await vi.advanceTimersByTimeAsync(0)            // 补拍 callScript 也挂在 deferred gate 上
    expect(calls).toHaveLength(3)                    // 恰一次补拍(不是 2+1×在途次数)
    for (const release of (gate ?? []).splice(0)) release(payload(6))
    await vi.advanceTimersByTimeAsync(0)
    handle.dispose()
  })

  it('容器后置落地:MutationObserver 事件化补拍(waitHost 轮询自旋退役)', async () => {
    vi.useFakeTimers()
    const { calls, container, callScript, viewModule } = rig([payload(1), payload(2)])
    container.remove()                               // mount 时容器缺席(老卡 waitHost 的实证场景)
    const handle = mountPanels({ doc: document, callScript, panels: [PANEL], viewModule, actModule: null })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toHaveLength(1)                    // 首拍照拉(fetch 不因容器缺席停摆)
    expect(container.textContent).toBe('')          // paint 被容器缺席挡
    document.body.append(container)                 // 宿主稍后渲染面板容器
    await vi.advanceTimersByTimeAsync(0)            // observer 微任务 → kick → 补拍
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.length).toBeGreaterThanOrEqual(2)
    expect(container.textContent).not.toBe('')
    handle.dispose()
  })
})
