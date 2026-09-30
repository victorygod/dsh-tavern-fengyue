// dnd5e 半施法家族钉(2026-09-30):旧 CASTERS 名单只抄全施六族——ranger/paladin 被判非施法,
// 带法术的 spawn 整体被拒(「!ranger 非施法职业」读作「游侠不让创建」)。改:core.isCasterClass 三族
// 位表判定单源(opening-meta CASTERS 派生自此,名单不再手抄)、CASTER_ATTR 补圣骑士=魅/游侠=感知、
// opening_commit 准备制扩四职(半施 L1 无施法面=位表行缺省,RAW 正确不算薄)、spell-build slugOf
// 撇号先弃再断对齐三检键法(Hunter's Mark 词条旧落 0 环空文)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')
const SETUP = join(CARD, 'setup')
const libUrl = (m: string) => pathToFileURL(join(CARD, 'lib', m)).href

function rig() {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-halfcaster-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify({ name: '梅西雅', role: 'pc', hp: 10, hp_max: 10 }))
  writeFileSync(join(cwd, 'state.md'), '# 世界状态\n\n## 附近 NPC\n\n## 战斗\n- （无战斗）\n')
  return { cwd, base }
}
function runTool(rt: string, tool: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: rt, encoding: 'utf8' })
}
const j = (rt: string, f: string) => JSON.parse(readFileSync(join(rt, 'characters', f), 'utf8'))

describe('半施法家族判定(core 单源派生)', () => {
  it('isCasterClass:全施六族+契术 true;半施 paladin/ranger true;fighter/commoner false', async () => {
    const { isCasterClass } = await import(libUrl('core.mjs'))
    for (const c of ['wizard', 'cleric', 'sorcerer', 'druid', 'bard', 'warlock', 'paladin', 'ranger']) expect(isCasterClass(c)).toBe(true)
    expect(isCasterClass('fighter')).toBe(false)
    expect(isCasterClass('commoner')).toBe(false)
    expect(isCasterClass('RANGER')).toBe(true)   // 大小写归一
  })
  it('buildClass:ranger L5=施法者(caster_attr wis,位表[4,2]);ranger L1=无位表(行缺省);paladin L3=cha/[3];fighter 恒非施法', async () => {
    const { buildClass } = await import(libUrl('class-build.mjs'))
    const r5 = buildClass('ranger', 5)
    expect(r5.isCaster).toBe(true); expect(r5.caster_attr).toBe('wis'); expect(r5.slots).toEqual([4, 2])
    expect(buildClass('ranger', 1).slots).toBeNull()   // 半施 L1 无环位=RAW 正确,不算薄
    const p3 = buildClass('paladin', 3)
    expect(p3.isCaster).toBe(true); expect(p3.caster_attr).toBe('cha'); expect(p3.slots).toEqual([3])
    const f = buildClass('fighter', 5)
    expect(f.isCaster).toBe(false); expect(f.caster_attr).toBeNull(); expect(f.slots).toBeNull()
  })
  it('opening-meta CASTERS=派生名单:含 paladin/ranger(半施)与 warlock(旧钉仍在)', async () => {
    const { CASTERS } = await import(libUrl('opening-meta.mjs'))
    expect(CASTERS).toEqual(expect.arrayContaining(['paladin', 'ranger', 'warlock', 'wizard']))
    expect(CASTERS).not.toContain('fighter')
  })
  it('spell-build slugOf 撇号先弃再断:Hunter\'s Mark 词条=1 环带文(旧键法落 0 环空文)', async () => {
    const { materializeSpellDetails } = await import(libUrl('spell-build.mjs'))
    const d = materializeSpellDetails(["Hunter's Mark", "Arcanist's Magic Aura"])
    expect(d.map(x => x.level)).toEqual([1, 2])   // 断档才降 fallback——命中语料必带真环位
    expect(d[0].effect.length).toBeGreaterThan(0)
  })
})

describe('spawn_npc 半施法建档(真实脚本)', () => {
  const persona = { lens: '看人先看脚印', reaction: '被冒犯→按刀' }
  it('ranger L5 带 Hunter\'s Mark:建档成功,卡带 caster_attr wis/位表 l1·l2/词条 1 环;回执带准备制提示', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_npc', { context: '游侠登场', name: '游侠甲', stance: '敌对', class: 'ranger', level: 5, skills: ['survival', 'nature', 'perception'], spells_known: ["Hunter's Mark"], persona })
    expect(r.status).toBe(0)
    const p = j(rt, '游侠甲.json')
    expect(p.caster_attr).toBe('wis')
    expect(p.slots_l1).toBe(4); expect(p.slots_l2).toBe(2)
    expect(p.spells_known).toEqual(["Hunter's Mark"])
    expect(p.spell_details[0]).toMatchObject({ name: "Hunter's Mark", level: 1 })
    expect(r.stdout).toContain('准备制职业:spells_prepared 出生为空')
    rmSync(base, { recursive: true, force: true })
  })
  it('ranger L1 带 1 环法术:拒但文案=环位超可施(半施 L1 无施法=RAW),不再「非施法职业」', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '小游侠', stance: '敌对', class: 'ranger', level: 1, skills: ['survival', 'nature', 'perception'], spells_known: ["Hunter's Mark"], persona })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!法术环位超可施')
    expect(r.stdout).not.toContain('非施法职业')
    rmSync(base, { recursive: true, force: true })
  })
  it('paladin L3 带 Cure Wounds:cha/位表 l1;fighter+法术仍「非施法职业」(回归钉)', () => {
    const { cwd: rt, base } = rig()
    const ok = runTool(rt, 'spawn_npc', { context: 'x', name: '圣武士', stance: '同伴', class: 'paladin', level: 3, skills: ['athletics', 'intimidation'], spells_known: ['Cure Wounds'], persona: { lens: '重诺', reaction: '见不义→直言', voice: '庄重', tension: '守律却心软' }, history: '侍从出身' })
    expect(ok.status).toBe(0)
    const p = j(rt, '圣武士.json')
    expect(p.caster_attr).toBe('cha'); expect(p.slots_l1).toBe(3)
    const f = runTool(rt, 'spawn_npc', { context: 'x', name: '武夫', stance: '敌对', class: 'fighter', level: 1, abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 10, cha: 8 }, spells_known: ['Magic Missile'], persona })
    expect(f.status).toBe(1)
    expect(f.stdout).toContain('!fighter 非施法职业')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('opening_commit 半施法玩家出生(真实脚本)', () => {
  function rigOpen() {
    const base = mkdtempSync(join(tmpdir(), 'dnd5e-halfcaster-open-'))
    const cwd = join(base, 'runtime')
    cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
    cpSync(join(SETUP, 'openings.json'), join(cwd, 'openings.json'))
    cpSync(join(SETUP, 'state.md'), join(cwd, 'state.md'))
    return { cwd, base }
  }
  function run(cwd: string, argv: Record<string, unknown>) {
    const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(argv))}];await import(${JSON.stringify(pathToFileURL(join(CARD, 'scripts', 'opening_commit.mjs')).href)})`
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, encoding: 'utf8' })
    const out = r.stdout.trim()
    const json = out.split('\n').filter(l => l.startsWith('{')).pop() ?? '{}'
    return JSON.parse(json) as { ok: boolean;[k: string]: unknown }
  }
  const baseChar = (over: Record<string, unknown> = {}) => ({
    name: '林望', race: 'human', class: 'ranger', level: 3, gender: 'male',
    abilities: { str: 12, dex: 14, con: 12, int: 8, wis: 14, cha: 10 },
    skills: ['survival', 'nature', 'perception'],
    persona: { lens: '看人先看脚印', reaction: '被冒犯→按刀', voice: '话少', tension: '护队却独行' },
    history: '边荒猎手', ...over,
  })
  it('ranger L3:caster_attr wis+位表 l1=3+准备表 roll(等级+感调=5)+无戏法(半施无 0 环表)', () => {
    const { cwd, base } = rigOpen()
    const out = run(cwd, { character: baseChar(), scenario: 'hamlet' })
    expect(out.ok).toBe(true)
    const p = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(p.caster_attr).toBe('wis')
    expect(p.slots_l1).toBe(3)
    expect(p.spells_prepared).toHaveLength(5)      // 等级3+感调+2(SRD 准备制同式)
    expect(p.spells_known).toBeUndefined()         // 半施无戏法表,known 空=键裁剪
    expect((p.spell_details ?? []).length).toBe(5) // 词条自含全文
    rmSync(base, { recursive: true, force: true })
  })
  it('paladin L1:无施法面=正确行为(不炸不落法术/位表);L2 起位表+准备表', () => {
    const { cwd, base } = rigOpen()
    const pAb = { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 13 }
    const l1 = run(cwd, { character: baseChar({ name: '布兰', class: 'paladin', level: 1, abilities: pAb, skills: ['athletics', 'intimidation'] }), scenario: 'hamlet' })
    expect(l1.ok).toBe(true)
    const p1 = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(p1.caster_attr).toBe('cha')
    expect(p1.spells_known).toBeUndefined(); expect(p1.spells_prepared).toBeUndefined(); expect(p1.slots_l1).toBeUndefined()
    const l2 = run(cwd, { character: baseChar({ name: '布兰二', class: 'paladin', level: 2, abilities: pAb, skills: ['athletics', 'intimidation'] }), scenario: 'hamlet' })
    expect(l2.ok).toBe(true)
    const p2 = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(p2.slots_l1).toBe(2)
    expect(p2.spells_prepared).toHaveLength(3)     // 2+魅调1
    rmSync(base, { recursive: true, force: true })
  })
})
