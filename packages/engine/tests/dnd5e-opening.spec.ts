// dnd5e 开局生成器集成钉(真实脚本,临时树;2026-09-25 用户令:开局 roll 要丰富、有逻辑、对照 SRD):
// opening_data → meta 下发(技能白名单现场解析/子职清单/法术池);opening_commit →
// 技能白名单+选数校验、施法者出生即满(RAW L1)、warlock 归施法族、L1 子职、训练面出生、
// 特征回充时机按表(非池 |—)、中文 description/回执透明(rolled)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const SETUP = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')
const LORE = join(SETUP, 'setup', 'dnd5e-srd-lorebook')   // 语料真身在 preset/setup/ 下(部署整体拷 runtime)
const OPENINGS = join(SETUP, 'setup', 'openings.json')

/** 临时运行树:cwd=runtime(与 preset/ 同层——脚本相对引用 ../preset/lib;语料取真身)。 */
function rig(opts: { spells?: Record<string, string> } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-opening-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'dnd5e-srd-lorebook', 'classes'), { recursive: true })
  mkdirSync(join(cwd, 'dnd5e-srd-lorebook', 'races'), { recursive: true })
  mkdirSync(join(cwd, 'dnd5e-srd-lorebook', 'spells'), { recursive: true })
  cpSync(join(SETUP, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  cpSync(OPENINGS, join(cwd, 'openings.json'))
  // 语料:classes 用真身整目录(meta 迭代 12 职业——缺一份即 ENOENT),races 取 human;tiefling 造一个
  cpSync(join(LORE, 'classes'), join(cwd, 'dnd5e-srd-lorebook', 'classes'), { recursive: true })
  cpSync(join(LORE, 'races', 'human.md'), join(cwd, 'dnd5e-srd-lorebook', 'races', 'human.md'))
  writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'races', 'tiefling.md'),
    '---\nname: Tiefling\nspeed: 30\ndarkvision: 60\nlanguages:\n  - Common\n  - Infernal\nresist:\n  - Fire\n---\n\nx')
  for (const [slug, fm] of Object.entries(opts.spells ?? {})) writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'spells', `${slug}.md`), fm)
  return { cwd, base }
}

const SPELLS = {
  'magic-missile': '---\nname: Magic Missile\nlevel: 1\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'shield': '---\nname: Shield\nlevel: 1\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'sleep': '---\nname: Sleep\nlevel: 1\nclasses:\n  - Bard\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'detect-magic': '---\nname: Detect Magic\nlevel: 1\nritual: true\nclasses:\n  - Cleric\n  - Druid\n  - Wizard\n---\n\nx',
  'cure-wounds': '---\nname: Cure Wounds\nlevel: 1\nclasses:\n  - Bard\n  - Cleric\n  - Druid\n---\n\nx',
  'bless': '---\nname: Bless\nlevel: 1\nclasses:\n  - Cleric\n  - Paladin\n---\n\nx',
  'fire-bolt': '---\nname: Fire Bolt\nlevel: 0\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'light': '---\nname: Light\nlevel: 0\nclasses:\n  - Bard\n  - Cleric\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'prestidigitation': '---\nname: Prestidigitation\nlevel: 0\nclasses:\n  - Bard\n  - Sorcerer\n  - Warlock\n  - Wizard\n---\n\nx',
  'sacred-flame': '---\nname: Sacred Flame\nlevel: 0\nclasses:\n  - Cleric\n---\n\nx',
  'guidance': '---\nname: Guidance\nlevel: 0\nclasses:\n  - Cleric\n  - Druid\n---\n\nx',
  'eldritch-blast': '---\nname: Eldritch Blast\nlevel: 0\nclasses:\n  - Warlock\n---\n\nx',
  'hex': '---\nname: Hex\nlevel: 1\nclasses:\n  - Warlock\n---\n\nx',
}
const SPELL_FIXTURE = { spells: SPELLS }

type Res = { ok: boolean;[k: string]: unknown }
function run(cwd: string, script: 'opening_data.mjs' | 'opening_commit.mjs', argv: Record<string, unknown>): Res {
  const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(argv))}];await import(${JSON.stringify(join(ROOT, 'tavern_presets', 'dnd5e', 'preset', 'scripts', script))})`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, encoding: 'utf8' })
  const out = r.stdout.trim()
  const json = out.split('\n').filter(l => l.startsWith('{')).pop() ?? '{}'
  let parsed: Res = {}
  try { parsed = JSON.parse(json) } catch { /* 解析失败把 stderr 冒出 */ }
  if (r.status !== 0 || parsed.ok === false && 'error' in parsed === false)
    throw new Error(`${script} exit ${r.status}: ${(r.stderr || r.stdout).slice(0, 400)}`)
  return parsed
}

const baseChar = (over: Record<string, unknown> = {}) => ({
  name: '洛克', race: 'human', class: 'wizard', gender: 'male', background: '学者',
  abilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
  skills: ['arcana', 'investigation'],
  ...over,
})

describe('opening_data · meta 整包下发(单源语料解析)', () => {
  it('技能白名单现场解析( cleric=5 白名单选 2 / bard 任选)+ 子职清单 + 施法者法术池', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_data.mjs', {})
    expect(out.ok).toBe(true)
    const meta = out.meta as { classes: Record<string, { skills: string[]; count: number; anySkill: boolean; subclasses: string[] }>; pools: Record<string, Record<string, string[]>>; casters: string[] }
    expect(meta.classes.cleric).toEqual({ skills: ['history', 'insight', 'medicine', 'persuasion', 'religion'], count: 2, anySkill: false, subclasses: ['Life'] })
    expect(meta.classes.bard.anySkill).toBe(true)
    expect(meta.classes.wizard.skills).toEqual(['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'])
    expect(meta.casters).toContain('warlock')
    expect(meta.pools.cantrips.wizard).toEqual(expect.arrayContaining(['Fire Bolt', 'Light', 'Prestidigitation']))
    expect(meta.pools.lv1.warlock).toEqual(['Hex'])
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
})

describe('opening_commit · 施法者出生即满(RAW L1)', () => {
  it('无 payload 法术 → 服务端 roll:法师 3 戏法+6 进书(全在本职业池内);训练面/特征时机/中文描述齐活', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar(), scenario: 'border-town' })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.spells_known).toHaveLength(6)
    const pool = SPELL_FIXTURE.spells
    for (const s of panel.spells_known) expect(Object.keys(pool).some(k => pool[k].includes(s))).toBe(true)
    const fmOf = (s: string) => pool[Object.keys(pool).find(k => pool[k].includes(s)) as string]
    for (const c of panel.spells_known) expect(fmOf(c)).not.toContain('level: 0')   // 进书=首环,戏法不混
    expect(panel.features.join('|')).toContain('Arcane Recovery|每日')                // 时机按表,非池 |—
    expect(panel.features.join('|')).toContain('Spellcasting: Wizard|—')
    expect(panel.armor_prof).toEqual([])                                             // 法师无甲熟练(键裁剪剥除)
    expect(panel.weapon_prof).toContain('匕首')
    expect(panel.description).toContain('人类 法师')
    expect(panel.biography[0]).toContain('学者出身')
    expect(panel.subclass).toBeNull()
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('payload 带法术 → 校验:越职业表/数量不符 fail-loud;戏法不计入 known', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const bad = run(cwd, 'opening_commit.mjs', { character: baseChar({ spells: { cantrips: ['Sacred Flame', 'Light', 'Fire Bolt'], spells: ['Shield'], prepared: [] } }), scenario: 'border-town' })
    expect(bad.ok).toBe(false)
    expect(bad.error).toContain('超出职业表')
    const tooMany = run(cwd, 'opening_commit.mjs', { character: baseChar({ spells: { cantrips: ['Fire Bolt', 'Light', 'Prestidigitation'], spells: ['Shield'], prepared: [] } }), scenario: 'border-town' })
    expect(tooMany.ok).toBe(false)
    expect((tooMany as { error: string }).error).toContain('首环法术须 6 个')   // 数量校验先行于表校验(Shield 合法但不满额)
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
})

describe('opening_commit · 白名单/选数/子职/-warlock(三处 SRD 修补)', () => {
  it('技能越白名单 → 拒;选数不符 → 拒( rogue 4 / 法师 2 各按其数)', () => {
    const { cwd } = rig({})
    const illegal = run(cwd, 'opening_commit.mjs', { character: baseChar({ class: 'wizard', skills: ['athletics', 'intimidation'] }), scenario: 'border-town' })
    expect(illegal.ok).toBe(false)
    expect(illegal.error).toContain('白名单')
    const rogueName = { name: '影', class: 'rogue', skills: ['stealth', 'acrobatics', 'deception', 'intimidation'] }
    const rogueOk = run(cwd, 'opening_commit.mjs', { character: baseChar({ ...rogueName, abilities: { str: 10, dex: 15, con: 12, int: 14, wis: 13, cha: 8 } }), scenario: 'border-town' })
    expect(rogueOk.ok).toBe(true)
    const wrongCount = run(cwd, 'opening_commit.mjs', { character: baseChar({ class: 'rogue', skills: ['stealth'] }), scenario: 'border-town' })
    expect(wrongCount.ok).toBe(false)
    expect(wrongCount.error).toContain('4')
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('cleric:1 级子职 Life 落 subclass;prepared=1+体质调整 满额(准备制)', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar({ class: 'cleric', skills: ['history', 'insight'], abilities: { str: 8, dex: 12, con: 13, int: 10, wis: 15, cha: 14 } }), scenario: 'border-town' })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.subclass).toBe('Life')
    expect(panel.spells_prepared.length).toBe(1 + 2)   // WAL 15→+2
    expect(panel.spells_prepared.every((s: string) => ['Detect Magic', 'Cure Wounds', 'Bless'].includes(s))).toBe(true)
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('warlock 归施法族:出生 slots_l1=1 + 戏法 2 已知 2 取自本职业池(此前漏排=RAW 错)', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar({ class: 'warlock', skills: ['arcana', 'history'] }), scenario: 'border-town' })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.caster_attr).toBe('cha')
    expect(panel.slots_l1).toBe(1)
    expect(panel.spells_known as string[]).toEqual(['Hex'])   // 语料里 warlock 首环只有 Hex(2 槽但池不满额=有多少给多少)
    expect(panel.features.join('|')).toContain('Otherworldly Patron|—')
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('回执透明:rolled 全量可考(戏法/法术/子职/技能)', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar(), scenario: 'border-town' })
    const rolled = out.rolled as { cantrips: string[]; spells: string[]; subclass: null; skills: string[] }
    expect(rolled.cantrips).toHaveLength(3)
    expect(rolled.spells).toHaveLength(6)
    expect(rolled.subclass).toBeNull()
    expect(rolled.skills).toEqual(['arcana', 'investigation'])
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
})
