// dnd5e ui_data 成长流集成钉(真实脚本,临时 cwd;2026-09-24 定案):
// op=candidates = 本职业表 ∩ 环位≤当前可施 ∩ 未收录 ∩ 非戏法;op=panel 附带 spellSplit 戏法/环术拆行。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
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
  miniSpellCore(spells, base)   // 数据主路(2026-09-30)下 candidates 走 SPELL_CORE 快照——rig 覆写为夹具域
  for (const [slug, md] of Object.entries(spells)) writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'spells', `${slug}.md`), md)
  return { cwd, base }
}

/** 迷你 SPELL_CORE(fixture 域)——同 dnd5e-opening.spec 律。 */
function miniSpellCore(spells: Record<string, string>, base: string) {
  const core: Record<string, { fm: Record<string, unknown>; effect: string }> = {}
  for (const [slug, md] of Object.entries(spells)) {
    const m = /^---\n([\s\S]*?)\n---/.exec(md) ?? { 1: '' }
    const fm: Record<string, unknown> = {}
    let cur: string | null = null
    const coerce = (v: string) => /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : (v === 'true' ? true : v === 'false' ? false : v.replace(/^"|"$/g, ''))
    for (const line of m[1].split('\n')) {
      const li = /^  - (.*)$/.exec(line)
      const kv = /^([a-z_]+):\s*(.*)$/.exec(line)
      if (li && cur) { fm[cur] = [...(fm[cur] as unknown[] ?? []), coerce(li[1])]; continue }
      if (kv) { cur = kv[1]; fm[kv[1]] = kv[2].trim() === '' ? [] : coerce(kv[2].trim()) }
    }
    core[slug] = { fm, effect: '' }
  }
  writeFileSync(join(base, 'preset', 'lib', 'spell-core-data.mjs'), `export const SPELL_CORE = ${JSON.stringify(core)}\n`)
}

const spell = (name: string, level: number, classes: string[], ritual = false) =>
  `---\nname: ${name}\nlevel: ${level}\nritual: ${ritual ? 'true' : 'false'}\nclasses:\n${classes.map(c => `  - ${c}`).join('\n')}\n---\n\n*${name}*`

const WIZ = {
  name: '洛克', class: 'wizard', level: 4, caster_attr: 'int', slots_l1: 4, slots_l2: 3,
  spells_known: ['Magic Missile', 'Fire Bolt'],
}

function runOp(runtime: string, op: Record<string, unknown>): Record<string, unknown> {
  const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(op))}];await import(${JSON.stringify(pathToFileURL(SCRIPT).href)})`
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
      { name: 'Burning Hands', name_cn: '燃烧之手', level: 1, ritual: false },
      { name: 'Shield', name_cn: '护盾术', level: 1, ritual: false },
      { name: 'Web', name_cn: '蛛网术', level: 2, ritual: false },
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
    const split = (out.data as { player: { spellSplit: { cantrips: string[]; known: string[]; tips: Record<string, string> } } }).player.spellSplit
    expect(split.cantrips).toEqual(['Fire Bolt'])
    expect(split.known).toEqual(['Magic Missile'])
    expect(split.tips['Fire Bolt']).toMatch(/攻击检定|目标/)   // hover 浮签(2026-09-30):glossary-cn 全量自喂
    expect(split.tips['Magic Missile']).toMatch(/飞镖|力场/)
    rmSync(dirname(rt), { recursive: true, force: true })
  })
  it('未知卡名的存量(中文名无 slug) → 落环术行,绝不冒充戏法', () => {
    const { cwd: rt } = rig({ ...WIZ, spells_known: ['火球术'] }, {})
    const out = runOp(rt, { op: 'panel', name: 'hud-left' })
    const split = (out.data as { player: { spellSplit: { cantrips: string[]; known: string[]; tips: Record<string, string> } } }).player.spellSplit
    expect(split).toEqual({ cantrips: [], known: ['火球术'], tips: {} })   // 未知卡名查无简介=空 tips,绝不挂空签
    rmSync(dirname(rt), { recursive: true, force: true })
  })
})

describe('ui_data op=panel rev 参数短路(2026-09-25 拉式差量)', () => {
  it('同 rev → 裸 ack {changed:false} 且无 data;rev 变/缺席 → 全量', () => {
    const { cwd: rt } = rig(WIZ, { 'fire-bolt': spell('Fire Bolt', 0, ['Wizard']) })
    const first = runOp(rt, { op: 'panel', name: 'hud-left' })
    expect(first.ok).toBe(true)
    expect(first.changed).toBeUndefined()        // 无 rev 参数 → 照旧全量
    expect((first.data as { player: unknown }).player).toBeTruthy()

    const same = runOp(rt, { op: 'panel', name: 'hud-left', rev: first.rev })
    expect(same.ok).toBe(true)
    expect(same.changed).toBe(false)             // 同值 → 裸 ack
    expect(same.rev).toBe(first.rev)
    expect(same.data).toBeUndefined()            // 无 data:拉式差量省的是传输

    const stale = runOp(rt, { op: 'panel', name: 'hud-left', rev: 'stale:0:0' })
    expect(stale.changed).toBeUndefined()
    expect((stale.data as { player: unknown }).player).toBeTruthy()
    rmSync(dirname(rt), { recursive: true, force: true })
  })
  it('op=rev 已退役(心跳结账):显式报错退出,而非静默回退', () => {
    const { cwd: rt } = rig(WIZ, {})
    expect(() => runOp(rt, { op: 'rev' })).toThrow(/op=rev 已退役/)
    rmSync(dirname(rt), { recursive: true, force: true })
  })
})
