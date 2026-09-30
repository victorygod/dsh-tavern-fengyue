// spawn_monster statblock→枚举制钉(2026-09-29b 档案自含批):monster_kind 枚举选型(内核 enum 硬拦,工具读卡),
// HP=语料骰式掷/缺字段回退卡值、钱袋=DMG 个人财宝表按 CR、材料化面(attacks+riders/abilities/features/description)
// 全在档;回执=人物卡同格式整卡 JSON;无 path 键(monster_kind=身份元数据);count 批量天干+每只独立掷。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

function rig() {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-spawn-monster-'))
  const cwd = join(base, 'runtime')
  for (const d of ['characters', 'dnd5e-srd-lorebook/monsters']) mkdirSync(join(cwd, d), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify({ name: '梅西雅', role: 'pc', hp: 10, hp_max: 10 }))
  writeFileSync(join(cwd, 'state.md'), '# 世界状态\n\n## 附近 NPC\n\n## 战斗\n- （无战斗）\n')
  return { cwd, base }
}
function runTool(runtime: string, tool: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
}
const j = (rt: string, f: string) => JSON.parse(readFileSync(join(rt, 'characters', f), 'utf8'))

describe('spawn_monster 枚举选怪+档案自含(真实脚本)', () => {
  it('kobold:monster_kind 直寻+HP 掷骰(1..10)+材料化(attacks/features)+FM description+单列 presence 行', { timeout: 15_000 }, () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_monster', { context: '狗布林哨兵', name: '狗布林哨兵乙', stance: '敌对', monster_kind: 'kobold' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('[创建 · 狗布林哨兵乙 · 敌对]')
    expect(readFileSync(join(rt, 'state.md'), 'utf8')).toContain('- 狗布林哨兵乙 | 敌对')
    expect(r.stdout).toMatch(/hp [1-9]=2d6-2/)   // hp_roll 掷,RAW 生命至少 1,回执带骰式作证
    const p = j(rt, '狗布林哨兵乙.json')
    expect(p).toMatchObject({ level: 0.125, ac: 12, str: 7, dex: 15, con: 9, monster_kind: 'kobold', role: 'npc' })
    expect(p.path).toBeUndefined()              // 旧外链键退役
    expect(['gp', 'sp', 'cp'].some(k => typeof p[k] === 'number' && p[k] > 0)).toBe(true)   // DMG 个人财宝默认钱袋(CR0.125 tier0,必有其一)
    // 材料化面:攻击双条(表)+特征连释义(FM description 落 description)
    expect(Object.keys(p.attacks as Record<string, unknown>).sort()).toEqual(['dagger', 'sling'])
    expect(p.features as string[]).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Sunlight Sensitivity\|/),
      expect.stringMatching(/^Pack Tactics\|/),
    ]))
    expect(String(p.description)).toContain('humanoid')
    expect(readFileSync(join(rt, 'state.md'), 'utf8')).toContain('- 狗布林哨兵乙')
    rmSync(base, { recursive: true, force: true })
  })
  it('zombie:正文 Damage Immunities→immune;count 批量每只独立掷(HP 同界)+钱袋逐只独立', { timeout: 15_000 }, () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_monster', { context: '尸群', name: '行尸', stance: '敌对', count: 2, monster_kind: 'zombie' })
    expect(r.status).toBe(0)
    const a1 = j(rt, '行尸甲.json') as Record<string, unknown>
    const a2 = j(rt, '行尸乙.json') as Record<string, unknown>
    for (const p of [a1, a2]) {
      expect(p).toMatchObject({ immune: ['poison'], save_prof: ['wis'], monster_kind: 'zombie' })
      expect(p.hp).toBeGreaterThanOrEqual(12)   // 3d8+9 语料骰式掷(zombie hp_roll)
      expect(p.hp).toBeLessThanOrEqual(33)
      expect(p.hp_max).toBe(p.hp)
    }
    rmSync(base, { recursive: true, force: true })
  })
  it('龙类能力材料化:adult-red-dragon 档案带 fire-breath(豁免型)+bite riders;查无 kind/缺参错误', { timeout: 15_000 }, () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_monster', { context: '龙袭', name: '老红龙', stance: '敌对', monster_kind: 'adult-red-dragon' })
    expect(r.status).toBe(0)
    const p = j(rt, '老红龙.json') as Record<string, any>
    expect(p.abilities['fire-breath']).toMatchObject({ save: 'dexterity', dc: 21, dice: '18d6', type: 'fire' })
    expect(p.attacks['bite'].riders).toEqual([{ dice: '2d6', type: 'fire' }])   // 龙焰咬=表 RIDERS 材料化
    expect(String(p.description)).toContain('dragon')
    const miss = runTool(rt, 'spawn_monster', { context: 'x', name: '幻影', stance: '敌对', monster_kind: 'nonexistent' })
    expect(miss.status).toBe(1)
    expect(miss.stdout).toContain('!查无怪物档案')
    const nof = runTool(rt, 'spawn_monster', { context: 'x', name: '无卡', stance: '敌对' })
    expect(nof.status).toBe(1)
    expect(nof.stdout).toContain('缺必填 monster_kind')
    const dup = runTool(rt, 'spawn_monster', { context: 'x', name: '梅西雅', stance: '敌对', monster_kind: 'kobold' })
    expect(dup.status).toBe(1)
    expect(dup.stdout).toContain('!同名已存在:梅西雅')
    rmSync(base, { recursive: true, force: true })
  })
  it('怪人设=数据面预生成(2026-09-30 二次裁定):工具不收 persona/history——传参即拒,数据 persona 行在则落', { timeout: 15_000 }, async () => {
    const { cwd: rt, base } = rig()
    const stray = runTool(rt, 'spawn_monster', { context: 'x', name: '被代填', stance: '敌对', monster_kind: 'bugbear', persona: { lens: '敬畏拳头' } })
    expect(stray.status).toBe(1)
    expect(stray.stdout).toContain('!spawn_monster 不收 persona/history')
    const histInject = runTool(rt, 'spawn_monster', { context: 'x', name: '被代填历', stance: '敌对', monster_kind: 'bugbear', history: '外传设定' })
    expect(histInject.status).toBe(1)
    expect(histInject.stdout).toContain('!spawn_monster 不收 persona/history')
    const named = runTool(rt, 'spawn_monster', { context: '怪头领', name: '疤哥', stance: '敌对', monster_kind: 'bugbear' })
    expect(named.status).toBe(0)
    // 数据批已落:怪卡带 MONSTER_PERSONA.bugbear(固定 persona 行,零 LLM 人设通道)
    const { MONSTER_PERSONA } = await import(pathToFileURL(join(CARD, 'lib', 'monster-persona-data.mjs')).href)
    expect(j(rt, '疤哥.json').persona).toEqual(MONSTER_PERSONA.bugbear)
    rmSync(base, { recursive: true, force: true })
  })
  it('schema 漂移钉:spawn_monster 头 enum 集合==MONSTER_CORE 键集(数据加怪不漏改 schema)', async () => {
    const src = readFileSync(join(CARD, 'tools', 'spawn_monster.mjs'), 'utf8')
    const schema = JSON.parse(/\/\*\*\s*@tavern-schema([\s\S]*?)\*\//.exec(src)![1])
    const enumKinds = schema.parameters.monster_kind.enum as string[]
    const { MONSTER_CORE } = await import(pathToFileURL(join(CARD, 'lib', 'monster-core-data.mjs')).href)
    expect(enumKinds).toEqual([...Object.keys(MONSTER_CORE)].sort())   // 单源=monster-core-data(corpus 已退役)
  })
})
