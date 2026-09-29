// spawn_npc class 制钉(2026-09-29):数值按 class+level 规则自动派生(HP 公式/豁免小写化/甲武熟练/
// 起装/特征累积/施法位表),不再手抄;怪物 statblock 归 spawn_monster。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

function rig() {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-spawn-npc-'))
  const cwd = join(base, 'runtime')
  for (const d of ['characters']) mkdirSync(join(cwd, d), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify({ name: '梅西雅', role: 'pc', hp: 10, hp_max: 10 }))
  writeFileSync(join(cwd, 'state.md'), '# 世界状态\n\n## 附近 NPC\n\n## 战斗\n- （无战斗）\n')
  return { cwd, base }
}
function runTool(runtime: string, tool: string, args: Record<string, unknown>, seed?: number) {
  // seed 可选:setSeed 打工具 import 的同一 core 拷贝实例(同 URL 才同模块实例)——ASI 随机分配即可断言。
  const TOOL_CORE = join(dirname(runtime), 'preset', 'lib', 'core.mjs')
  const prelude = seed === undefined ? '' : `(await import(${JSON.stringify(pathToFileURL(TOOL_CORE).href)})).setSeed(${seed});`
  const code = `globalThis.argv=${JSON.stringify(args)};${prelude}await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
}
const j = (rt: string, f: string) => JSON.parse(readFileSync(join(rt, 'characters', f), 'utf8'))

describe('spawn_npc class 制派生(真实脚本)', () => {
  it('战士 L3:HP 公式 + 豁免小写化 + 甲武熟练 + 起装 + 特征累积(含早级 Second Wind/Action Surge)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_npc', { context: '矿卫', name: '铜须', stance: '同伴',class: 'fighter', level: 3, abilities: { str: 15, dex: 10, con: 14, int: 10, wis: 12, cha: 8 }, skills: ['athletics', 'intimidation'] })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('[创建 · 铜须 · 同伴]')
    // HP 公式:hitDie10 + con2 + (3-1)*(5+1+2)=28
    const p = j(rt, '铜须.json')
    expect(p).toMatchObject({ name: '铜须', role: 'companion', class: 'fighter', level: 3, hp: 28, hp_max: 28, save_prof: ['str', 'con'], skill_prof: ['athletics', 'intimidation'] })
    expect(p.armor_prof).toEqual(['轻甲', '中甲', '重甲', '盾牌'])
    expect(p.weapon_prof).toContain('军用武器')
    expect(p.features.join('|')).toContain('Second Wind|短休')
    expect(p.features.join('|')).toContain('Action Surge')
    expect(p.features.join('|')).toContain('Martial Archetype|—')
    expect(p.armor).toBe('chain-mail'); expect(p.shield).toBe(true)
    // 回执带面板(get_npc_state 同格式)
    expect(r.stdout).toContain('### 铜须（同伴）')
    expect(r.stdout).toContain('"save_prof"')
    // AC 派生不落显式 ac
    expect(p.ac).toBeUndefined()
    rmSync(base, { recursive: true, force: true })
  })
  it('法师 L5(seeded):施法位表自动落 + caster_attr;spells agent 声明;hp 按成长后 con(L4 ASI 档已补)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_npc', { context: '对手法师', name: '法师', stance: '敌对', class: 'wizard', level: 5, abilities: { str: 9, dex: 14, con: 11, int: 17, wis: 12, cha: 10 }, spells_known: ['fire-bolt', 'mage-armor', 'magic-missile'] }, 7)
    expect(r.status).toBe(0)
    const p = j(rt, '法师.json')
    expect(p).toMatchObject({ caster_attr: 'int', slots_l1: 4, slots_l2: 3, slots_l3: 2, spells_known: ['fire-bolt', 'mage-armor', 'magic-missile'] })
    expect(p.exp).toBe(6500)
    expect(p.hp).toBe(6 + Math.floor((p.con - 10) / 2) + 4 * (3 + 1 + Math.floor((p.con - 10) / 2)))  // 公式按成长后 con
    expect(p.hp).toBeGreaterThanOrEqual(22)
    rmSync(base, { recursive: true, force: true })
  })
  it('技能超出职业白名单 / 选数不符 / 未知职业 → 报错', () => {
    const { cwd: rt, base } = rig()
    const bad = runTool(rt, 'spawn_npc', { context: 'x', name: '坏技能', stance: '敌对', class: 'fighter', level: 1, abilities: { str: 12, dex: 10, con: 12, int: 10, wis: 10, cha: 8 }, skills: ['arcana'] })
    expect(bad.status).toBe(1)
    expect(bad.stdout).toContain('技能超出职业白名单')
    const few = runTool(rt, 'spawn_npc', { context: 'x', name: '少技能', stance: '敌对', class: 'cleric', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 12 }, skills: ['insight'] })
    expect(few.status).toBe(1)
    expect(few.stdout).toContain('技能须选 2 项')
    const unk = runTool(rt, 'spawn_npc', { context: 'x', name: '无业', stance: '敌对', class: 'ninja', level: 1, abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 8 } })
    expect(unk.status).toBe(1)
    expect(unk.stdout).toContain('未知职业')
    rmSync(base, { recursive: true, force: true })
  })
  it('子职等级闸:未到分岔级传子职报错', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '早子职', stance: '敌对', class: 'fighter', level: 2, abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 10, cha: 8 }, subclass: 'Champion' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('到 3 级才分岔')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('spawn_npc 成长族+ASI 历史成长+法术三检(真实脚本)', () => {
  it('L1:exp=0/hd_available=1/六维=传入值(零 ASI 档),无历史成长行', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '新兵', stance: '同伴',class: 'fighter', level: 1, abilities: { str: 15, dex: 10, con: 14, int: 10, wis: 10, cha: 8 } })
    expect(r.status).toBe(0)
    expect(r.stdout).not.toContain('历史成长')
    const p = j(rt, '新兵.json')
    expect(p).toMatchObject({ exp: 0, hd_available: 1, str: 15, con: 14, cha: 8 })
    rmSync(base, { recursive: true, force: true })
  })
  it('L6 fighter(seeded):exp=当前级下限/hd_available=6/fighter 特表 L4+L6 两档恰 +4 总增量,明细上回执,hp 按成长后 con', () => {
    const { cwd: rt, base } = rig()
    const ab = { str: 15, dex: 10, con: 14, int: 10, wis: 10, cha: 8 }
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '老斗士', stance: '同伴',class: 'fighter', level: 6, abilities: ab }, 7)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('历史成长(ASI 档自动分配')
    expect(r.stdout).toMatch(/LV4:.+LV6:.+/)
    const p = j(rt, '老斗士.json')
    expect(p.exp).toBe(14000)         // XP_THRESHOLDS[5]:L6 下限
    expect(p.hd_available).toBe(6)
    const sum = ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((x, k) => x + (p[k] ?? 0), 0) - Object.values(ab).reduce((x, y) => x + y, 0)
    expect(sum).toBe(4)               // 两档×两点
    expect(p.hp_max).toBe(10 + Math.floor((p.con - 10) / 2) + 5 * (Math.floor(10 / 2) + 1 + Math.floor((p.con - 10) / 2)))  // 公式按成长后 con
    // 成长闭环:gain_exp 可入账(async:只要 exp 键在,不再「无成长面」)
    const g = runTool(rt, 'gain_exp', { context: 'x', who: '老斗士', exp: 100 })
    expect(g.status).toBe(0)
    expect(JSON.parse(readFileSync(join(rt, 'characters', '老斗士.json'), 'utf8')).exp).toBe(14100)
    rmSync(base, { recursive: true, force: true })
  })
  it('L8 rogue(seeded):rogue 特表 L4/L8 两档(10 档未到)', () => {
    const { cwd: rt, base } = rig()
    const ab = { str: 8, dex: 15, con: 10, int: 14, wis: 12, cha: 10 }
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '老贼', stance: '敌对', class: 'rogue', level: 8, abilities: ab }, 3)
    expect(r.status).toBe(0)
    const p = j(rt, '老贼.json')
    expect(p.exp).toBe(34000)         // XP_THRESHOLDS[7]
    const sum = ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((x, k) => x + (p[k] ?? 0), 0) - Object.values(ab).reduce((x, y) => x + y, 0)
    expect(sum).toBe(4)
    rmSync(base, { recursive: true, force: true })
  })
  it('不传 abilities:标准数组按职业主属性自动 roll(15/14 钉前二主属性,余四随机派),成长族照常', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '自动六维', stance: '同伴',class: 'fighter', level: 1 }, 5)
    expect(r.status).toBe(0)
    const p = j(rt, '自动六维.json')
    expect(p.str).toBe(15)            // PRIMARY fighter [str, con] 前二钉 15/14
    expect(p.con).toBe(14)
    const sum = ['str', 'dex', 'con', 'int', 'wis', 'cha'].reduce((x, k) => x + (p[k] ?? 0), 0)
    expect(sum).toBe(72)              // 标准数组总机 15+14+13+12+10+8
    expect(p.exp).toBe(0); expect(p.hd_available).toBe(1)
    rmSync(base, { recursive: true, force: true })
  })
  it('法术三检:非施法职业拒/查无 err/非本职业表 err/环位超 err/prepared 禁戏法;合法通过', () => {
    const { cwd: rt, base } = rig()
    const notCaster = runTool(rt, 'spawn_npc', { context: 'x', name: '武夫', stance: '敌对', class: 'fighter', level: 1, abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 10, cha: 8 }, spells_known: ['magic-missile'] })
    expect(notCaster.status).toBe(1)
    expect(notCaster.stdout).toContain('非施法职业')
    const ghost = runTool(rt, 'spawn_npc', { context: 'x', name: '幻觉师', stance: '敌对', class: 'wizard', level: 1, abilities: { str: 8, dex: 10, con: 10, int: 16, wis: 12, cha: 10 }, spells_known: ['not-a-spell'] })
    expect(ghost.status).toBe(1)
    expect(ghost.stdout).toContain('!查无法术:not-a-spell')
    const wrongList = runTool(rt, 'spawn_npc', { context: 'x', name: '串表', stance: '敌对', class: 'cleric', level: 1, abilities: { str: 8, dex: 10, con: 12, int: 10, wis: 16, cha: 12 }, spells_known: ['magic-missile'] })
    expect(wrongList.status).toBe(1)
    expect(wrongList.stdout).toContain('!法术非本职业表')
    const highSlot = runTool(rt, 'spawn_npc', { context: 'x', name: '越环', stance: '敌对', class: 'wizard', level: 1, abilities: { str: 8, dex: 10, con: 10, int: 16, wis: 12, cha: 10 }, spells_known: ['fireball'] })
    expect(highSlot.status).toBe(1)
    expect(highSlot.stdout).toContain('!法术环位超可施')
    const okCleric = runTool(rt, 'spawn_npc', { context: 'x', name: '正牧', stance: '同伴',class: 'cleric', level: 1, abilities: { str: 8, dex: 10, con: 12, int: 10, wis: 16, cha: 12 }, spells_known: ['guidance'], spells_prepared: ['cure-wounds'] })
    expect(okCleric.status).toBe(0)
    const badPrep = runTool(rt, 'spawn_npc', { context: 'x', name: '错备', stance: '同伴',class: 'cleric', level: 1, abilities: { str: 8, dex: 10, con: 12, int: 10, wis: 16, cha: 12 }, spells_prepared: ['guidance'] })
    expect(badPrep.status).toBe(1)
    expect(badPrep.stdout).toContain('!戏法不入 prepared')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('spawn_npc schema 漂移钉(2026-09-29b 枚举=死规则单源)', () => {
  const src = readFileSync(join(CARD, 'tools', 'spawn_npc.mjs'), 'utf8')
  const schema = JSON.parse(/\/\*\*\s*@tavern-schema([\s\S]*?)\*\//.exec(src)![1])
  const P = schema.parameters
  it('class/race/gender/level/skills 枚举=死规则单源(opening-meta);subclass 枚举=语料并集', async () => {
    const meta = await import(pathToFileURL(join(CARD, 'lib', 'opening-meta.mjs')).href)
    expect(P.class.enum).toEqual([...Object.keys(meta.CLASS_CN)].sort())
    expect(P.race.enum).toEqual([...Object.keys(meta.RACE_CN)].sort())
    expect(P.gender.enum).toEqual(['male', 'female', 'unknown'])
    expect(P.level.enum).toEqual(Array.from({ length: 20 }, (_, i) => i + 1))   // XP/位表/职业表 1..20 同口径
    expect(P.skills.items.enum).toEqual(meta.ALL_SKILL_KEYS)
    const fmUnion = Object.keys(meta.CLASS_CN).sort().flatMap(cls => {
      const md = readFileSync(join(CARD, '..', 'corpus', 'srd-lorebook', 'classes', `${cls}.md`), 'utf8')
      const m = /^subclass:\r?\n((?:\s*-[ ]+.*\r?\n?)+)/m.exec(md)
      return (m?.[1] ?? '').trim().split('\n').map(x => x.replace(/^\s*-\s*/, '').trim()).filter(Boolean)
    })
    expect(P.subclass.enum).toEqual(fmUnion.sort())
  })
  it('kernel schema 通道可编译(不会被枚举值型踩坑)', () => {
    expect(P.stance.enum).toEqual(['同伴', '中立', '敌对'])
    expect(P.abilities.type).toBe('object')
    expect(P.abilities.additionalProperties).toBe(false)
  })
})