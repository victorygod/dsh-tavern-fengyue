// update_character 人物卡更新器钉(2026-09-30):叙事可变字段的单源落档——statuses 数组(名+applied_at,
// effect/mods 机械按名匹配,替换式未列即摘除)/平铺叙事字段/法术三检+spell_details 重铺/已备法术可施
// (cast 并集)/生成面与结算字段点名拒收(回执 lint 防幻觉静默)/整卡回执。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const CLERIC = {   // 盾+位表:AC=10+敏0+盾2=12; cleric L3 可施 2 环(位表夹具 l1/l2)
  name: '牧师妹', role: 'pc', class: 'cleric', level: 3,
  caster_attr: 'wis', wis: 16, dex: 10, slots_l1: 4, slots_l2: 2,
  hp: 14, hp_max: 14, shield: true,
  languages: ['common'], gear: ['圣徽'], weapons: ['木棒'],
  history: ['村庙学徒出身'], description: '村庙牧师', statuses: {},
}
const FIGHTER = { name: '铁武', role: 'npc', class: 'fighter', level: 2, hp: 19, hp_max: 19, statuses: {} }

/** 临时运行树:tool cwd=runtime/,`../preset/lib` 是其兄弟(真实部署同构)。 */
function rig(entries: [string, unknown][] = [['player.json', CLERIC], ['铁武.json', FIGHTER]]) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-update-char-'))
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
const j = (cwd: string) => JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))

describe('update_character 平铺叙事字段(真实脚本)', () => {
  it('只改传入项:盾翻(AC 报)/装备替换/现况/历史追加;未传键原样;回执带改后整卡', () => {
    const { cwd, base } = rig()
    const r = runTool(cwd, 'update_character', { context: '夺盾失手', target: '牧师妹', shield: false, gear: ['圣徽', '救人索'], description: '负伤巡诊途中', history_append: '第 3 日·遭遇暴雨,添了件湿披风' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/\[人物卡 · 牧师妹 · 更新\]/)
    expect(r.stdout).toMatch(/AC: 12→10/)
    expect(r.stdout).toContain('history: 追加第 2 行')
    expect(r.stdout).toContain('### 牧师妹（pc）')
    const c = j(cwd)
    expect(c.shield).toBe(false)
    expect(c.gear).toEqual(['圣徽', '救人索'])
    expect(c.description).toBe('负伤巡诊途中')
    expect(c.history).toEqual(['村庙学徒出身', '第 3 日·遭遇暴雨,添了件湿披风'])
    expect(c.languages).toEqual(['common'])   // 未传=不改
    expect(c.hp).toBe(14)                     // 结算字段不在场,未被动过
    rmSync(base, { recursive: true, force: true })
  })
})

describe('update_character 法术面(三检+替换+重铺)', () => {
  it('三检四态:非本职业表/查无/环位超/prepared 禁戏法,全部拒绝', () => {
    const { cwd, base } = rig()
    const wrongList = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', spells_known: ['magic-missile'] })
    expect(wrongList.stdout).toContain('!法术非本职业表')
    const ghost = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', spells_known: ['not-a-spell'] })
    expect(ghost.stdout).toContain('!查无法术')
    const highSlot = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', spells_known: ['harm'] })
    expect(highSlot.stdout).toContain('!法术环位超可施')
    const cantripPrep = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', spells_prepared: ['guidance'] })
    expect(cantripPrep.stdout).toContain('!戏法不入 prepared')
    expect(j(cwd).spells_known).toBeUndefined()   // 全拒后未落任何键
    rmSync(base, { recursive: true, force: true })
  })
  it('全量替换+spell_details 重铺;空表=清空', () => {
    const { cwd, base } = rig()
    const ok = runTool(cwd, 'update_character', { context: '抄本入册', target: '牧师妹', spells_known: ['sacred-flame', 'cure-wounds'], spells_prepared: ['Cure Wounds'] })
    expect(ok.status).toBe(0)
    expect(ok.stdout).toMatch(/known 0→2条 · prepared 0→1条 · spell_details 重铺\(2条\)/)
    let c = j(cwd)
    expect(c.spells_known).toEqual(['sacred-flame', 'cure-wounds'])
    expect(c.spells_prepared).toEqual(['Cure Wounds'])
    expect(c.spell_details).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Cure Wounds' })]))
    // 全量替换语义:known 2→1(不残留),spell_details 同步
    const swap = runTool(cwd, 'update_character', { context: '忘却', target: '牧师妹', spells_known: ['sacred-flame'] })
    expect(swap.status).toBe(0)
    c = j(cwd)
    expect(c.spells_known).toEqual(['sacred-flame'])
    expect(c.spell_details).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Cure Wounds' })]))
    expect(c.spell_details?.some(s => s.name === 'Sacred Flame')).toBe(true)
    // 空表=清空(prepared 摘键)
    const clear = runTool(cwd, 'update_character', { context: '换备', target: '牧师妹', spells_prepared: [] })
    expect(clear.status).toBe(0)
    expect(j(cwd).spells_prepared).toBeUndefined()
    rmSync(base, { recursive: true, force: true })
  })
  it('已备法术可施:cast 收录闸=known∪prepared 并集(准备制职业补齐)', () => {
    const { cwd, base } = rig([['player.json', { ...CLERIC, hp: 6 }], ['铁武.json', FIGHTER]])
    const setup = runTool(cwd, 'update_character', { context: '备好', target: '牧师妹', spells_prepared: ['Cure Wounds'] })
    expect(setup.status).toBe(0)
    const c = runTool(cwd, 'cast', { context: '救命', spell: 'cure-wounds', caster: '牧师妹', targets: '牧师妹' })
    expect(c.status).toBe(0)
    expect(c.stdout).toMatch(/治疗判定/)
    expect(JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8')).hp).toBeGreaterThan(6)
    rmSync(base, { recursive: true, force: true })
  })
})

describe('update_character 拒收点名(回执 lint 防幻觉)', () => {
  it('生成面字段拒:persona 五键语义', () => {
    const { cwd, base } = rig()
    const personaP = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', persona: { lens: 'x' } })
    expect(personaP.status).toBe(1)
    expect(personaP.stdout).toContain('persona 不走更新器')
    expect(personaP.stdout).toContain('建档生成面')
    rmSync(base, { recursive: true, force: true })
  })
  it('结算字段拒:hp/slots_l1/gain 面点名所属工具', () => {
    const { cwd, base } = rig()
    const hpP = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', hp: 10 })
    expect(hpP.status).toBe(1)
    expect(hpP.stdout).toContain('hp 不走更新器')
    const slotsP = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', slots_l1: 1 })
    expect(slotsP.stdout).toContain('slots_l1 不走更新器')
    expect(slotsP.stdout).toContain('cast/rest')
    rmSync(base, { recursive: true, force: true })
  })
  it('旧家族参数拒:remove/status/applied_at/effect/mods 全部点名并档', () => {
    const { cwd, base } = rig()
    const oldStyle = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', remove: true })
    expect(oldStyle.stdout).toContain('remove 不走更新器')
    expect(oldStyle.stdout).toContain('未列即摘除')
    const flat = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', effect: '手写' })
    expect(flat.stdout).toContain('effect 不走更新器')
    rmSync(base, { recursive: true, force: true })
  })
  it('未知键点名全部可更新键(防幻觉:以为改了其实落空)', () => {
    const { cwd, base } = rig()
    const typo = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', descrpition: '打错了' })
    expect(typo.status).toBe(1)
    expect(typo.stdout).toContain('不认识的参数:descrpition')
    expect(typo.stdout).toContain('spells_known')
    rmSync(base, { recursive: true, force: true })
  })
  it('非施法职业拒法术参数;查无目标/空调用/role 域', () => {
    const { cwd, base } = rig()
    const noCaster = runTool(cwd, 'update_character', { context: 'x', target: '铁武', spells_known: ['sacred-flame'] })
    expect(noCaster.stdout).toContain('无施法能力')
    const ghost = runTool(cwd, 'update_character', { context: 'x', target: '无此人', gear: ['x'] })
    expect(ghost.stdout).toContain('查无目标:无此人')
    const empty = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹' })
    expect(empty.stdout).toContain('未传任何可更新键')
    const badRole = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', role: '队长' })
    expect(badRole.stdout).toContain('role 不合法')
    const joinParty = runTool(cwd, 'update_character', { context: '入队', target: '铁武', role: 'companion' })
    expect(joinParty.status).toBe(0)
    expect(joinParty.stdout).toContain('「附近 NPC」行改标')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('update_character 当前想法(thought,2026-09-30)', () => {
  it('NPC/怪卡:内心一句落 thought;null=删键', () => {
    const { cwd, base } = rig()
    const r = runTool(cwd, 'update_character', { context: '起疑', target: '铁武', thought: '这伙人图矿道里的东西' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('thought: (缺)→')
    expect(JSON.parse(readFileSync(join(cwd, 'characters', '铁武.json'), 'utf8')).thought).toBe('这伙人图矿道里的东西')
    // 同 target 更新与删键
    runTool(cwd, 'update_character', { context: '改观', target: '铁武', thought: '领头的出手很稳,不动手为妙' })
    expect(JSON.parse(readFileSync(join(cwd, 'characters', '铁武.json'), 'utf8')).thought).toBe('领头的出手很稳,不动手为妙')
    runTool(cwd, 'update_character', { context: '释怀', target: '铁武', thought: null })
    expect(JSON.parse(readFileSync(join(cwd, 'characters', '铁武.json'), 'utf8')).thought).toBeUndefined()
    rmSync(base, { recursive: true, force: true })
  })
  it('玩家卡拒落(内心自主权);超长拒', () => {
    const { cwd, base } = rig()
    const pc = runTool(cwd, 'update_character', { context: 'x', target: '牧师妹', thought: '想家了' })
    expect(pc.status).toBe(1)
    expect(pc.stdout).toContain('thought 不落玩家卡')
    expect(pc.stdout).toContain('内心自主权')
    const long = runTool(cwd, 'update_character', { context: 'x', target: '铁武', thought: '想'.repeat(401) })
    expect(long.status).toBe(1)
    expect(long.stdout).toContain('≤400 字')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('update_character schema 钉(平铺无重复枚举)', () => {
  const src = readFileSync(join(CARD, 'tools', 'update_character.mjs'), 'utf8')
  const schema = JSON.parse(/\/\*\*\s*@tavern-schema([\s\S]*?)\*\//.exec(src)![1])
  it('spells 域无 enum(agent 唯一法术名录=spawn_npc);叙事平铺参数在位;agents=main+tail', () => {
    expect(schema.parameters.spells_known.items.enum).toBeUndefined()
    expect(schema.parameters.spells_prepared.items.enum).toBeUndefined()
    expect(schema.parameters.statuses.items.properties.status.enum.length).toBeGreaterThan(50)   // statuses 名录=工具自带
    expect(schema.agents).toEqual(['main', 'tail'])
    for (const k of ['context', 'target', 'statuses', 'description', 'thought', 'history_append', 'role', 'exhaustion',
      'armor', 'shield', 'weapons', 'gear', 'languages', 'spells_known', 'spells_prepared', 'pending']) {
      expect(schema.parameters[k]).toBeTruthy()
    }
    // 必填双键(context/target)
    const required = schema.parameters.context.required === true && schema.parameters.target.required === true
    expect(required).toBe(true)
  })
})
