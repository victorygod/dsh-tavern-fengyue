// dnd5e 武器机械补全钉(2026-10-04):attack.mjs panel 武器面四缺口——
// ①多用升骰(two_handed+versatile→d6→d8/d8→d10) ②触及透出(Reach 属性→recReach=10,濒死自动暴击的
// beyond_5ft 判据) ③巨武战斗(fighting_style=great_weapon_fighting,双手近战武器伤害骰 1/2 重掷)
// ④双武器战斗(off_hand 后手恢复加属性)。seed 重放钉骰值(LCG 确定),断言与骰面文本/加值文本锚定。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const PC = { name: '战士', role: 'pc', class: 'fighter', level: 1, str: 16, dex: 10, hp: 20, hp_max: 20 }

function rig(pc: Record<string, unknown>, target: Record<string, unknown>) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-wpn-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(pc))
  writeFileSync(join(cwd, 'characters', '木桩.json'), JSON.stringify(target))
  return { cwd, base }
}
function runTool(runtime: string, args: Record<string, unknown>, seed?: number) {
  const TOOL_CORE = join(dirname(runtime), 'preset', 'lib', 'core.mjs')
  const prelude = seed === undefined ? '' : `(await import(${JSON.stringify(pathToFileURL(TOOL_CORE).href)})).setSeed(${seed});`
  const code = `globalThis.argv=${JSON.stringify(args)};${prelude}await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', 'attack.mjs')).href)})`
  const rr = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
  if (rr.status !== 0) console.error('[tool-fail]', rr.stdout)
  return rr
}

describe('dnd5e 武器机械补全——多用/触及/巨武/双武器(2026-10-04)', () => {
  it('多用升骰: longsword two_handed→1d10,缺省→1d8(seed 钉,骰面文本)', () => {
    const tgt = { name: '木桩', role: 'npc', ac: 1, hp: 999, hp_max: 999 }
    let { cwd, base } = rig({ ...PC, weapons: ['longsword'] }, tgt)
    let r = runTool(cwd, { context: '测试', who: '战士', target: '木桩', weapon: 'longsword' }, 0)
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain('1d8=')
    expect(r.stdout).not.toContain('1d10=')
    rmSync(base, { recursive: true, force: true })
    ;({ cwd, base } = rig({ ...PC, weapons: ['longsword'] }, tgt))
    r = runTool(cwd, { context: '测试', who: '战士', target: '木桩', weapon: 'longsword', two_handed: true }, 0)
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain('1d10=')
    expect(r.stdout).not.toContain('1d8=')
    rmSync(base, { recursive: true, force: true })
  })

  it('触及透出: glaive 打 0HP 目标,缺省 beyond_5ft 自动暴击(2d10+标注),传参不暴(1d10)', () => {
    const tgt = { name: '木桩', role: 'npc', ac: 1, hp: 0, hp_max: 999 }
    let { cwd, base } = rig({ ...PC, weapons: ['glaive'] }, tgt)
    let r = runTool(cwd, { context: '测试', who: '战士', target: '木桩', weapon: 'glaive' }, 0)
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain('2d10=')
    expect(r.stdout).toContain('濒死自动暴击·翻骰')
    rmSync(base, { recursive: true, force: true })
    ;({ cwd, base } = rig({ ...PC, weapons: ['glaive'] }, tgt))
    r = runTool(cwd, { context: '测试', who: '战士', target: '木桩', weapon: 'glaive', beyond_5ft: true }, 0)
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain('1d10=')
    expect(r.stdout).not.toContain('濒死自动暴击·翻骰')
    rmSync(base, { recursive: true, force: true })
  })

  it('巨武战斗: greatsword(fighting_style) 双手近战 1/2 重掷,回执带「巨武重掷」', () => {
    const tgt = { name: '木桩', role: 'npc', ac: 1, hp: 999, hp_max: 999 }
    const { cwd, base } = rig({ ...PC, weapons: ['greatsword'], fighting_style: 'great_weapon_fighting' }, tgt)
    const r = runTool(cwd, { context: '测试', who: '战士', target: '木桩', weapon: 'greatsword' }, 0)  // seed 0 → d20=6 命中,伤害 2d6 首骰 2→重掷 3
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain('2d6=8')
    expect(r.stdout).toContain('巨武重掷')
    rmSync(base, { recursive: true, force: true })
  })

  it('双武器战斗: shortsword off_hand 后手恢复加属性(+3),无风格则无', () => {
    const tgt = { name: '木桩', role: 'npc', ac: 1, hp: 999, hp_max: 999 }
    const dmgLine = (out: string) => out.split('\n').find(l => l.includes('伤害判定')) ?? ''
    let { cwd, base } = rig({ ...PC, weapons: ['shortsword'], fighting_style: 'two_weapon_fighting' }, tgt)
    let r = runTool(cwd, { context: '测试', who: '战士', target: '木桩', weapon: 'shortsword', off_hand: true }, 0)
    expect(r.status, r.stdout).toBe(0)
    expect(dmgLine(r.stdout)).toContain('1d6=')
    expect(dmgLine(r.stdout)).toContain('+3')
    rmSync(base, { recursive: true, force: true })
    ;({ cwd, base } = rig({ ...PC, weapons: ['shortsword'] }, tgt))
    r = runTool(cwd, { context: '测试', who: '战士', target: '木桩', weapon: 'shortsword', off_hand: true }, 0)
    expect(r.status, r.stdout).toBe(0)
    expect(dmgLine(r.stdout)).toContain('1d6=')
    expect(dmgLine(r.stdout)).not.toContain('+3')
    rmSync(base, { recursive: true, force: true })
  })

  it('巨武重掷函数(单测): 同一 seed 下 rollGreatWeapon 把 1/2 重掷取新值', async () => {
    const core = await import(pathToFileURL(join(CARD, 'lib', 'core.mjs')).href)
    core.setSeed(2)
    const g = core.rollGreatWeapon('2d6')   // 首骰 2→重掷 3
    expect(g.rerolled).toBe(true)
    expect(g.dice).toEqual([3, 5])
    expect(g.total).toBe(8)
    core.setSeed(2)
    const e = core.rollExpr('2d6')          // 对照: 不重掷,首骰 2 保留
    expect(e.dice).toEqual([2, 5])
    expect(e.total).toBe(7)
    core.setSeed(0)
    expect(core.rollGreatWeapon('2d6').rerolled).toBe(false)   // 首骰 4 不触发
  })
})
