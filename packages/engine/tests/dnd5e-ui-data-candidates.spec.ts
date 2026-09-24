// dnd5e ui_data 成长流集成钉(真实脚本,临时 cwd;2026-09-24 定案):
// op=candidates = 本职业表 ∩ 环位≤当前可施 ∩ 未收录 ∩ 非戏法;op=panel 附带 spellSplit 戏法/环术拆行。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const SCRIPT = join(ROOT, 'tavern_presets', 'dnd5e', 'preset', 'scripts', 'ui_data.mjs')

/** 临时运行树:pump cwd=runtime/,`../preset/lib` 是其**兄弟**(真实部署同构:cwd 与 preset 同层下挂 runtime)。 */
function rig(player: Record<string, unknown>, spells: Record<string, string>) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-ui-data-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  mkdirSync(join(cwd, 'dnd5e-srd-lorebook', 'spells'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(player))
  cpSync(join(ROOT, 'tavern_presets', 'dnd5e', 'preset', 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  for (const [slug, md] of Object.entries(spells)) writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'spells', `${slug}.md`), md)
  return { cwd, base }
}

const spell = (name: string, level: number, classes: string[], ritual = false) =>
  `---\nname: ${name}\nlevel: ${level}\nritual: ${ritual ? 'true' : 'false'}\nclasses:\n${classes.map(c => `  - ${c}`).join('\n')}\n---\n\n*${name}*`

const WIZ = {
  name: '洛克', class: 'wizard', level: 4, caster_attr: 'int', slots_l1: 4, slots_l2: 3,
  spells_known: ['Magic Missile', 'Fire Bolt'],
}

function runOp(runtime: string, op: Record<string, unknown>): Record<string, unknown> {
  const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(op))}];await import(${JSON.stringify(SCRIPT)})`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ui_data ${JSON.stringify(op)} exit ${r.status}: ${r.stderr.slice(0, 400)}`)
  const line = r.stdout.trim().split('\n').filter(Boolean).pop() ?? ''
  return JSON.parse(line)
}

describe('ui_data op=candidates(真实脚本)', () => {
  it('过滤面:本职业(wizard) ∩ 1..2 环(LV4 可施) ∩ 未收录 ∩ 非戏法,按环位+名称排序', () => {
    const { cwd: rt } = rig(WIZ, {
      'magic-missile': spell('Magic Missile', 1, ['Sorcerer', 'Wizard']),
      'fire-bolt': spell('Fire Bolt', 0, ['Wizard']),
      'shield': spell('Shield', 1, ['Sorcerer', 'Wizard']),
      'burning-hands': spell('Burning Hands', 1, ['Sorcerer', 'Wizard']),
      'web': spell('Web', 2, ['Sorcerer', 'Wizard']),
      'fireball': spell('Fireball', 3, ['Wizard']),           // 超可施环
      'sacred-flame': spell('Sacred Flame', 0, ['Cleric']),   // 戏法
      'cure-wounds': spell('Cure Wounds', 1, ['Cleric', 'Druid']),   // 非本职业表
      'spy-game': spell('Silence', 2, ['Cleric', 'Druid', 'Ranger'], true),  // 非本职业表
    })
    const out = runOp(rt, { op: 'candidates' })
    expect(out.ok).toBe(true)
    expect(out.candidates).toEqual([
      { name: 'Burning Hands', level: 1, ritual: false },
      { name: 'Shield', level: 1, ritual: false },
      { name: 'Web', level: 2, ritual: false },
    ])
    rmSync(dirname(rt), { recursive: true, force: true })
  })
  it('非施法者 → 空候选(框层不依赖此分支,保护性)', () => {
    const { cwd: rt } = rig({ ...WIZ, caster_attr: null, slots_l1: null, class: 'fighter' }, {
      'shield': spell('Shield', 1, ['Wizard']),
    })
    const out = runOp(rt, { op: 'candidates' })
    expect(out.candidates).toEqual([])
    rmSync(dirname(rt), { recursive: true, force: true })
  })
})

describe('ui_data op=panel spellSplit(戏法/环术拆行)', () => {
  it('level:0 → 戏法行;缺失语料卡 → 归环术行(不误标)', () => {
    const { cwd: rt } = rig(WIZ, {
      'fire-bolt': spell('Fire Bolt', 0, ['Wizard']),
      'magic-missile': spell('Magic Missile', 1, ['Sorcerer', 'Wizard']),
    })
    const out = runOp(rt, { op: 'panel', name: 'hud-left' })
    expect(out.ok).toBe(true)
    const split = (out.data as { player: { spellSplit: { cantrips: string[]; known: string[] } } }).player.spellSplit
    expect(split.cantrips).toEqual(['Fire Bolt'])
    expect(split.known).toEqual(['Magic Missile'])
    rmSync(dirname(rt), { recursive: true, force: true })
  })
  it('未知卡名的存量(中文名无 slug) → 落环术行,绝不冒充戏法', () => {
    const { cwd: rt } = rig({ ...WIZ, spells_known: ['火球术'] }, {})
    const out = runOp(rt, { op: 'panel', name: 'hud-left' })
    const split = (out.data as { player: { spellSplit: { cantrips: string[]; known: string[] } } }).player.spellSplit
    expect(split).toEqual({ cantrips: [], known: ['火球术'] })
    rmSync(dirname(rt), { recursive: true, force: true })
  })
})
