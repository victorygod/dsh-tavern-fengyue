// update_* 二区工具钉(2026-10-04):update_character 人物卡更新器分拆——update_memory 已迁 mvu 块(记忆层走
// mvu_commit 的 memory 键),叙事工具剩两区:update_status(状态四件 statuses/力竭/已备法术/role)
// / update_inventory(背包 weapons/gear/armor/shield)。本件钉:①背包区盾翻+装备替换+AC 报
// ②状态区法术三检(prepared)+全量替换+spell_details 重铺(known∪prepared)+cast 并集
// ③拒收点名(生成面/结算字段/旧家族参数/未知键路由) ④schema 钉(两工具 agents=main/必填/键在位;languages/spells_known/pending 已摘出叙事面)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const CLERIC = {   // 盾+位表:AC=10+敏0+盾2=12; cleric L3 可施 2 环(位表夹具 l1/l2);戏法=spells_known 建档面(出生即带)
  name: '牧师妹', role: 'pc', class: 'cleric', level: 3,
  caster_attr: 'wis', wis: 16, dex: 10, slots_l1: 4, slots_l2: 2,
  hp: 14, hp_max: 14, shield: true,
  languages: ['common'], gear: ['圣徽'], weapons: ['木棒'],
  spells_known: ['sacred-flame'], history: ['村庙学徒出身'], description: '村庙牧师', statuses: {},
}
const FIGHTER = { name: '铁武', role: 'npc', class: 'fighter', level: 2, hp: 19, hp_max: 19, statuses: {} }

/** 临时运行树:tool cwd=runtime/,`../preset/lib` 是其兄弟(真实部署同构)。 */
function rig(entries: [string, unknown][] = [['player.json', CLERIC], ['铁武.json', FIGHTER]]) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-update-tools-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  for (const [f, v] of entries) writeFileSync(join(cwd, 'characters', f), JSON.stringify(v))
  return { cwd, base }
}
function runTool(cwd: string, tool: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, encoding: 'utf8' })
}
const j = (cwd: string, f = 'player.json') => JSON.parse(readFileSync(join(cwd, 'characters', f), 'utf8'))
const schemaOf = (tool: string) =>
  JSON.parse(/\/\*\*\s*@tavern-schema([\s\S]*?)\*\//.exec(readFileSync(join(CARD, 'tools', `${tool}.mjs`), 'utf8'))![1])

describe('update_inventory 背包区(真实脚本)', () => {
  it('盾翻(AC 报)/装备替换;未传键原样;回执带改后整卡', () => {
    const { cwd, base } = rig()
    const r = runTool(cwd, 'update_inventory', { context: '夺盾失手', target: '牧师妹', shield: false, gear: ['圣徽', '救人索'] })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/\[背包区 · 牧师妹\]/)
    expect(r.stdout).toMatch(/AC: 12→10/)
    expect(r.stdout).toContain('### 牧师妹（pc）')
    const c = j(cwd)
    expect(c.shield).toBe(false)
    expect(c.gear).toEqual(['圣徽', '救人索'])
    expect(c.languages).toEqual(['common'])   // 未传=不改
    expect(c.hp).toBe(14)                     // 结算字段不在场,未被动过
    rmSync(base, { recursive: true, force: true })
  })
})

describe('update_status 法术面(三检+替换+重铺)', () => {
  it('prepared 三检四态:非本职业表/查无/环位超/戏法,全部拒绝', () => {
    const { cwd, base } = rig()
    const wrongList = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', spells_prepared: ['magic-missile'] })
    expect(wrongList.stdout).toContain('!法术非本职业表')
    const ghost = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', spells_prepared: ['not-a-spell'] })
    expect(ghost.stdout).toContain('!查无法术')
    const highSlot = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', spells_prepared: ['harm'] })
    expect(highSlot.stdout).toContain('!法术环位超可施')
    const cantripPrep = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', spells_prepared: ['guidance'] })
    expect(cantripPrep.stdout).toContain('!戏法不入 prepared')
    expect(j(cwd).spells_prepared).toBeUndefined()   // 全拒后未落任何键
    rmSync(base, { recursive: true, force: true })
  })
  it('全量替换+spell_details 重铺(known∪prepared);空表=清空', () => {
    const { cwd, base } = rig()
    const ok = runTool(cwd, 'update_status', { context: '抄本入册', target: '牧师妹', spells_prepared: ['Cure Wounds'] })
    expect(ok.status).toBe(0)
    expect(ok.stdout).toMatch(/prepared 0→1条 · spell_details 重铺\(2条\)/)
    let c = j(cwd)
    expect(c.spells_prepared).toEqual(['Cure Wounds'])
    expect(c.spell_details).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Cure Wounds' }), expect.objectContaining({ name: 'Sacred Flame' })]))
    // 空表=清空(prepared 摘键;spell_details 退化为 known 戏法面)
    const clear = runTool(cwd, 'update_status', { context: '换备', target: '牧师妹', spells_prepared: [] })
    expect(clear.status).toBe(0)
    c = j(cwd)
    expect(c.spells_prepared).toBeUndefined()
    expect(c.spell_details?.some(s => s.name === 'Sacred Flame')).toBe(true)
    rmSync(base, { recursive: true, force: true })
  })
  it('已备法术可施:cast 收录闸=known∪prepared 并集(准备制职业补齐);非施法职业拒 prepared', () => {
    const { cwd, base } = rig([['player.json', { ...CLERIC, hp: 6 }], ['铁武.json', FIGHTER]])
    const setup = runTool(cwd, 'update_status', { context: '备好', target: '牧师妹', spells_prepared: ['Cure Wounds'] })
    expect(setup.status).toBe(0)
    const c = runTool(cwd, 'cast', { context: '救命', spell: 'cure-wounds', caster: '牧师妹', targets: '牧师妹' })
    expect(c.status).toBe(0)
    expect(c.stdout).toMatch(/治疗判定/)
    expect(j(cwd).hp).toBeGreaterThan(6)
    const noCaster = runTool(cwd, 'update_status', { context: 'x', target: '铁武', spells_prepared: ['Cure Wounds'] })
    expect(noCaster.stdout).toContain('无施法能力')
    rmSync(base, { recursive: true, force: true })
  })
  it('力竭 0..6 落盘;role 入队/非法/查无目标/空调用', () => {
    const { cwd, base } = rig()
    const ex = runTool(cwd, 'update_status', { context: '行军', target: '牧师妹', exhaustion: 2 })
    expect(ex.status).toBe(0)
    expect(ex.stdout).toContain('exhaustion: 0→2')
    const joinParty = runTool(cwd, 'update_status', { context: '入队', target: '铁武', role: 'companion' })
    expect(joinParty.status).toBe(0)
    expect(joinParty.stdout).toContain('「附近 NPC」行改标')
    const badRole = runTool(cwd, 'update_status', { context: 'x', target: '铁武', role: '队长' })
    expect(badRole.stdout).toContain('role 不合法')
    const ghost = runTool(cwd, 'update_status', { context: 'x', target: '无此人', exhaustion: 1 })
    expect(ghost.stdout).toContain('查无目标:无此人')
    const empty = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹' })
    expect(empty.stdout).toContain('未传任何可更新键')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('update_* 拒收点名(回执 lint 防幻觉)', () => {
  it('生成面字段拒:persona 建档生成面', () => {
    const { cwd, base } = rig()
    const r = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', persona: { lens: 'x' } })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('persona 不走状态区')
    expect(r.stdout).toContain('建档生成面')
    rmSync(base, { recursive: true, force: true })
  })
  it('结算字段拒:hp/slots_l1 点名所属工具', () => {
    const { cwd, base } = rig()
    const hpP = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', hp: 10 })
    expect(hpP.status).toBe(1)
    expect(hpP.stdout).toContain('hp 不走状态区')
    expect(hpP.stdout).toContain('hp_change')
    const slotsP = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', slots_l1: 1 })
    expect(slotsP.status).toBe(1)
    expect(slotsP.stdout).toContain('slots_l1 不走状态区')
    expect(slotsP.stdout).toContain('cast/rest')
    const gpP = runTool(cwd, 'update_inventory', { context: 'x', target: '牧师妹', gp: 5 })
    expect(gpP.stdout).toContain('gp 不走背包区')
    expect(gpP.stdout).toContain('gain_money')
    rmSync(base, { recursive: true, force: true })
  })
  it('旧家族参数拒:remove/effect 全部点名并档', () => {
    const { cwd, base } = rig()
    const oldStyle = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', remove: true })
    expect(oldStyle.stdout).toContain('remove 不走状态区')
    expect(oldStyle.stdout).toContain('未列即摘除')
    const flat = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', effect: '手写' })
    expect(flat.stdout).toContain('effect 不走状态区')
    rmSync(base, { recursive: true, force: true })
  })
  it('未知键点名全部可更新键(防幻觉:以为改了其实落空)', () => {
    const { cwd, base } = rig()
    const typo = runTool(cwd, 'update_status', { context: 'x', target: '牧师妹', descrpition: '打错了' })
    expect(typo.status).toBe(1)
    expect(typo.stdout).toContain('不认识的参数:descrpition')
    expect(typo.stdout).toContain('spells_prepared')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('update_* schema 钉(两工具在位;languages/spells_known/pending 已摘)', () => {
  it('spells 域无 enum;statuses 名录自带宽;agents=main;两工具必填双键', () => {
    const status = schemaOf('update_status')
    const inv = schemaOf('update_inventory')
    expect(status.parameters.spells_prepared.items.enum).toBeUndefined()
    expect(status.parameters.statuses.items.properties.status.enum.length).toBeGreaterThan(50)   // statuses 名录=工具自带
    for (const s of [status, inv]) expect(s.agents).toEqual(['main'])
    for (const k of ['context', 'target', 'statuses', 'exhaustion', 'spells_prepared', 'role']) expect(status.parameters[k]).toBeTruthy()
    for (const k of ['context', 'target', 'weapons', 'gear', 'armor', 'shield']) expect(inv.parameters[k]).toBeTruthy()
    for (const s of [status, inv]) {
      expect(s.parameters.context.required).toBe(true)
      expect(s.parameters.target.required).toBe(true)
    }
  })
  it('languages/spells_known/pending 已摘出叙事工具(归建档/前端/维护)——两工具 schema 均不收', () => {
    const status = schemaOf('update_status')
    const inv = schemaOf('update_inventory')
    for (const gone of ['languages', 'spells_known', 'pending']) {
      expect(status.parameters[gone]).toBeUndefined()
      expect(inv.parameters[gone]).toBeUndefined()
    }
  })
})