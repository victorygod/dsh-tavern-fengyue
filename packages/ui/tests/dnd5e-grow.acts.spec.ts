// @vitest-environment jsdom
// dnd5e 成长学习对话框（acts.mjs grow 系,fc 模态退役后的回归面,2026-09-24 定案）:
// 弹框居中+token 自携、±分点恰2守卫、保存走 front_commit(fail-visible)、候选清单恰2、
// 取消/外侧/Esc 放弃、模块单例态用 vi.resetModules 隔离。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let acts: Record<string, (ctx: unknown) => unknown>

const PLAYER = {
  name: '洛克', class: 'wizard', level: 4, caster_attr: 'int', slots_l1: 4, slots_l2: 3,
  str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 11,
  pending: ['LV4·ASI 点选', 'LV4·新法术×2'],
}
const CANDS = [{ name: 'Shield', level: 1, ritual: false }, { name: 'Web', level: 2, ritual: false }, { name: 'Burning Hands', level: 1, ritual: false }]

beforeEach(async () => {
  document.body.innerHTML = ''
  vi.resetModules()
  // @ts-expect-error 卡资产 .mjs 直接 import(同 dnd5e-panel-runtime.client.spec 先例)
  acts = await import('../../../tavern_presets/dnd5e/preset/ui/acts.mjs')
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

/** ctx 假件:ui-state 收集 + runScript 按 name/op 出货(front_commit 失败可注入)。 */
function rig(opts: { candidates?: unknown[]; saveReply?: unknown; saveReject?: Error } = {}) {
  const ui: Record<string, unknown> = {}
  const calls: Array<{ name: string; argv: Record<string, unknown> }> = []
  const ctx = {
    panel: 'hud-left',
    actEl: { dataset: {} } as Record<string, Record<string, string>>,
    getUi: (k: string) => ui[k],
    setUi: (k: string, v: unknown) => { ui[k] = v },
    repaint: vi.fn(),
    refresh: vi.fn(),
    runScript: async (name: string, argvJson: string) => {
      const argv = JSON.parse(argvJson)
      calls.push({ name, argv })
      if (name === 'ui_data.mjs' && argv.op === 'panel')
        return JSON.stringify({ ok: true, data: { player: structuredClone(PLAYER) } })
      if (name === 'ui_data.mjs' && argv.op === 'candidates')
        return JSON.stringify({ ok: true, candidates: opts.candidates ?? CANDS })
      if (name === 'front_commit.mjs') {
        if (opts.saveReject) throw opts.saveReject
        return JSON.stringify(opts.saveReply ?? { ok: true, pending: [] })
      }
      throw new Error('unexpected script ' + name)
    },
  }
  return { ctx, ui, calls }
}

const dlg = () => document.querySelector('.g-dlg')

describe('grow · 弹框与布局', () => {
  it('asi 开框:面板切片喂现值,6 行列表行,delta 列 +0 常驻,保存禁用', async () => {
    const { ctx, calls } = rig()
    ctx.actEl.dataset['kind'] = 'asi'
    await acts.grow(ctx)
    await Promise.resolve(); await Promise.resolve()   // panel 切片 promise 排空
    const box = dlg()
    expect(box).not.toBeNull()
    expect(box!.className).toContain('dnd-hud')        // body 直挂 token 自携——透明底回归钉
    expect(box!.dataset['panel']).toBe('hud-left')
    expect(box!.querySelectorAll('.g-att')).toHaveLength(6)
    expect(box!.textContent).toContain('+0')
    const save = box!.querySelector<HTMLButtonElement>('[data-act="growSave"]')
    expect(save?.disabled).toBe(true)
    expect(calls.some(c2 => c2.name === 'ui_data.mjs' && c2.argv.op === 'panel')).toBe(true)
  })

  it('居中定位:50%+translate 自适应(内容增减自动回中)', async () => {
    const { ctx } = rig()
    ctx.actEl.dataset['kind'] = 'asi'
    await acts.grow(ctx)
    await Promise.resolve(); await Promise.resolve()
    const box = dlg() as HTMLElement
    expect(box.style.left).toBe('50%')
    expect(box.style.top).toBe('50%')
    expect(box.style.transform).toBe('translate(-50%, -50%)')
  })

  it('spells 开框:候选清单渲染,选中恰 2 才解锁保存', async () => {
    const { ctx } = rig()
    ctx.actEl.dataset['kind'] = 'spells'
    await acts.grow(ctx)
    await Promise.resolve(); await Promise.resolve()
    expect(dlg()!.querySelectorAll('.gp-row')).toHaveLength(3)
    ctx.actEl.dataset['spell'] = 'Shield'
    await acts.growPick(ctx)
    expect(dlg()!.querySelector('[data-act="growSave"]')?.hasAttribute('disabled')).toBe(true)
    ctx.actEl.dataset['spell'] = 'Web'
    await acts.growPick(ctx)
    expect(dlg()!.querySelector('[data-act="growSave"]')?.hasAttribute('disabled')).toBe(false)
    expect(dlg()!.textContent).toContain('已选 2/2')
  })
})

describe('grow · ±分点与恰 2 守卫', () => {
  async function openReady() {
    const { ctx, calls } = rig()
    ctx.actEl.dataset['kind'] = 'asi'
    await acts.grow(ctx)
    await Promise.resolve(); await Promise.resolve()
    return { ctx, calls }
  }
  const step = (ctx: unknown, act: string, key: string) => {
    const c2 = ctx as { actEl: { dataset: Record<string, string> } }
    c2.actEl.dataset = { [act === 'growInc' ? 'inc' : 'dec']: key }
    return (acts as Record<string, (c: unknown) => void>)[act](ctx)
  }
  it('加→预览与已加值出现;减→回落;恰 2 后加钮 disabled 且 inc 守卫无效', async () => {
    const { ctx } = await openReady()
    step(ctx, 'growInc', 'int')
    expect(dlg()!.textContent).toContain('+1')
    expect(dlg()!.textContent).toContain('→ 17')
    step(ctx, 'growInc', 'dex')
    expect(dlg()!.querySelector('[data-inc="int"]')?.hasAttribute('disabled')).toBe(true)
    const before = JSON.stringify((acts as unknown as { Grow?: { asi: Record<string, number> } }).Grow?.asi)
    step(ctx, 'growInc', 'wis')   // 满档守卫
    expect(JSON.stringify((acts as unknown as { Grow?: { asi: Record<string, number> } }).Grow?.asi)).toBe(before)
    step(ctx, 'growDec', 'dex')
    expect(dlg()!.textContent).toContain('+0')
    step(ctx, 'growInc', 'dex')
    expect(dlg()!.textContent).toContain('+2')   // int1+dex1=sum2,dex 行显示已加2? 不——行内 delta=该行已加 1
    expect(dlg()!.querySelectorAll('.delta.on')).toHaveLength(2)
  })
})

describe('growSave · front_commit 链(fail-visible)', () => {
  async function filled() {
    const r = rig()
    const ctx = r.ctx
    ctx.actEl.dataset['kind'] = 'asi'
    await acts.grow(ctx)
    await Promise.resolve(); await Promise.resolve()
    const step = (key: string) => { ctx.actEl.dataset = { inc: key }; (acts as Record<string, (c: unknown) => void>).growInc(ctx) }
    step('int'); step('dex')
    return { ...r, ctx }
  }
  it('恰 2 保存:argv op=asi inserire stats,total=2;成功后框收+repaint+refresh', async () => {
    const { ctx, calls } = await filled()
    ctx.actEl.dataset['kind'] = 'asi'
    await acts.growSave(ctx)
    const fc = calls.find(c2 => c2.name === 'front_commit.mjs')
    expect(fc?.argv.op).toBe('asi')
    expect(Object.values((fc?.argv.payload as { stats: Record<string, number> }).stats).reduce((a, b) => a + b, 0)).toBe(2)
    expect(dlg()).toBeNull()
    expect(ctx.refresh).toHaveBeenCalledWith('hud-left')
  })
  it('front_commit 拒绝:错误文案上屏,框不收(不吞错)', async () => {
    const { ctx } = rig({ saveReply: { ok: false, error: '!dex 超上限(现15)' } })
    ctx.actEl.dataset['kind'] = 'asi'
    await acts.grow(ctx)
    await Promise.resolve(); await Promise.resolve()
    ctx.actEl.dataset['inc'] = 'int'; (acts as Record<string, (c: unknown) => void>).growInc(ctx)
    ctx.actEl.dataset['inc'] = 'dex'; (acts as Record<string, (c: unknown) => void>).growInc(ctx)
    await acts.growSave(ctx)   // kind 仍在 actEl.dataset(grow 开框时读入)
    expect(dlg()!.querySelector('.g-msg')?.textContent).toContain('超上限')
  })
  it('脚本异常:保存失败上屏(不静默)', async () => {
    const { ctx } = rig({ saveReject: new Error('boom') })
    ctx.actEl.dataset['kind'] = 'spells'
    await acts.grow(ctx)
    await Promise.resolve(); await Promise.resolve()
    ctx.actEl.dataset['spell'] = 'Shield'; await acts.growPick(ctx)
    ctx.actEl.dataset['spell'] = 'Web'; await acts.growPick(ctx)
    await acts.growSave(ctx)
    expect(dlg()!.querySelector('.g-msg')?.textContent).toContain('boom')
  })
})

describe('growClose / 外侧 / Esc · 放弃即弃选', () => {
  async function openAsi() {
    const { ctx, ui, calls } = rig()
    ctx.actEl.dataset['kind'] = 'asi'
    await acts.grow(ctx)
    await Promise.resolve(); await Promise.resolve()
    ctx.actEl.dataset = { inc: 'int' }; (acts as Record<string, (c: unknown) => void>).growInc(ctx)
    return { ctx, ui, calls }
  }
  it('growClose:框收+选区清空+ui 回 null+repaint', async () => {
    const { ctx, ui } = await openAsi()
    acts.growClose(ctx)
    expect(dlg()).toBeNull()
    expect(ui['grow']).toEqual({ open: null })
    expect(ctx.repaint).toHaveBeenCalled()
  })
  it('Esc:keydown 两次接线(跨 resetModules)也不串——框收且不触发 front_commit', async () => {
    const { calls } = await openAsi()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(dlg()).toBeNull()
    expect(calls.some(c2 => c2.name === 'front_commit.mjs')).toBe(false)
  })
  it('框内点击不收框;框外点击=放弃(无 front_commit)', async () => {
    const { ctx, calls } = await openAsi()
    const inside = document.createElement('div')
    dlg()!.append(inside)
    inside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(dlg()).not.toBeNull()
    const outside = document.createElement('div')
    document.body.append(outside)
    outside.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(dlg()).toBeNull()
    expect(calls.some(c2 => c2.name === 'front_commit.mjs')).toBe(false)
  })
})
