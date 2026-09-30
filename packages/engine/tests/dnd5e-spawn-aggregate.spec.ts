// dnd5e spawn 字段校验聚合钉(2026-09-30):旧 err 首错即 exit——其余字段的坏被藏到下一轮调用(agent
// 修一个才见下一个);改逐字段记账不即断,全字段查完一次上回执(一行一错、! 前缀、Exit 1 整段转述)。
// persona 闸同步账本化(persona.mjs 返回 errors);同名守护入账(schema「同名已存在则报错不覆盖」承诺落地)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

function rig() {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-spawn-agg-'))
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

describe('spawn_npc 错误聚合回执(真实脚本)', () => {
  it('多字段同坏 → 一张回执全数点名(每行一处),无一建卡', () => {
    const { cwd: rt, base } = rig()
    // 同拍坏五处:职业未知+等级不合法+缺四维+退役参数+人设缺席
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '全坏甲', stance: '敌对', class: 'ninja', level: 0, abilities: { str: 12, dex: 10 }, spells_prepared: ['x'], persona: undefined })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!未知职业:ninja')
    expect(r.stdout).toContain('!level 不合法:0')
    expect(r.stdout).toContain('!缺六维 abilities.con')
    expect(r.stdout).toContain('!缺六维 abilities.int')
    expect(r.stdout).toContain('!缺六维 abilities.wis')
    expect(r.stdout).toContain('!缺六维 abilities.cha')
    expect(r.stdout).toContain('!spells_prepared 已退役')
    expect(r.stdout).toContain('!persona 必填(行为契约最小对 lens+reaction')
    expect(r.stdout).not.toContain('[创建')   // 拒收=不建卡
    expect(existsSync(join(rt, 'characters', '全坏甲.json'))).toBe(false)
    rmSync(base, { recursive: true, force: true })
  })
  it('同字段多罪并排:两条法术同报(旧首错即断只剩一条);单键超长不再补必填(同键一罪)', () => {
    const { cwd: rt, base } = rig()
    // cleric L1:Fireball=非本职业表+超环两罪;not-a-spell=查无——三罪一张回执
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '串表', stance: '敌对', class: 'cleric', level: 1, abilities: { str: 8, dex: 10, con: 12, int: 10, wis: 16, cha: 12 }, spells_known: ['Fireball', 'not-a-spell'], persona: { lens: '一'.repeat(31), reaction: '被质疑→冷笑' } })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!法术非本职业表:Fireball')
    expect(r.stdout).toContain('!法术环位超可施:Fireball')
    expect(r.stdout).toContain('!查无法术:not-a-spell')
    expect(r.stdout).toContain('!persona.lens 超长(≤30 字,得 31)')
    expect(r.stdout).not.toContain('persona.lens 必填')   // 同键一罪:超长记超长,不再补必填
    rmSync(base, { recursive: true, force: true })
  })
  it('同伴多键缺项:逐键点名(voice/tension/history 一并记账)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '缺两件', stance: '同伴', class: 'fighter', level: 1, abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 12, cha: 8 }, persona: { lens: '百事按章程', reaction: '遇袭→列盾' } })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!persona.voice 必填(同伴四件')
    expect(r.stdout).toContain('!persona.tension 必填(同伴四件')
    expect(r.stdout).toContain('!history 必填(同伴=长线人物')
    rmSync(base, { recursive: true, force: true })
  })
  it('同名守护入账:同名(含 player.json)拒建不覆盖(schema 承诺落地)', () => {
    const { cwd: rt, base } = rig()
    const ok = runTool(rt, 'spawn_npc', { context: 'x', name: '铜须', stance: '同伴', class: 'fighter', level: 1, abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 12, cha: 8 }, persona: { lens: '百事按章程', reaction: '遇袭→列盾', voice: '乡音重', tension: '护上头却护不住下头' }, history: '乡下之子,第一次出远门' })
    expect(ok.status).toBe(0)
    const before = readFileSync(join(rt, 'characters', '铜须.json'), 'utf8')
    const r = runTool(rt, 'spawn_npc', { context: 'x', name: '铜须', stance: '敌对', class: 'wizard', level: 1, abilities: { str: 8, dex: 10, con: 10, int: 16, wis: 12, cha: 10 }, persona: { lens: '把人当实验材料', reaction: '被质疑→冷笑' } })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!同名已存在:铜须')
    expect(readFileSync(join(rt, 'characters', '铜须.json'), 'utf8')).toBe(before)   // 原档一字不动
    rmSync(base, { recursive: true, force: true })
  })
  it('单错兼容:既有单点文案逐字保留(技能白名单/子职分岔)', () => {
    const { cwd: rt, base } = rig()
    const bad = runTool(rt, 'spawn_npc', { context: 'x', name: '坏技能', stance: '敌对', class: 'fighter', level: 1, abilities: { str: 12, dex: 10, con: 12, int: 10, wis: 10, cha: 8 }, skills: ['arcana'] })
    expect(bad.status).toBe(1)
    expect(bad.stdout).toContain('技能超出职业白名单')
    const early = runTool(rt, 'spawn_npc', { context: 'x', name: '早子职', stance: '敌对', class: 'fighter', level: 2, abilities: { str: 14, dex: 10, con: 14, int: 10, wis: 10, cha: 8 }, subclass: 'Berserker' })
    expect(early.status).toBe(1)
    expect(early.stdout).toContain('!子职业 Berserker 不在 fighter 语料清单')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('persona 闸账本化(lib 单元 + opening_commit 接线)', () => {
  it('personaGate 返回 errors 聚合(不再即断;记账剥 ! 前缀,回执出口统一加);错档 persona 只记一罪不噪声', async () => {
    const { personaGate } = await import(pathToFileURL(join(CARD, 'lib', 'persona.mjs')).href)
    const multi = (personaGate as (a: unknown, o?: unknown) => { errors: string[] })({ persona: { lens: 'x', alignment: '混沌好' } }, { role: 'companion', requireHistory: true })
    expect(multi.errors).toContain('persona.alignment 超枚举(9 值):混沌好')
    expect(multi.errors).toContain('persona.reaction 必填(同伴四件 lens/reaction/voice/tension——写法见键描述)')
    expect(multi.errors).toContain('persona.voice 必填(同伴四件 lens/reaction/voice/tension——写法见键描述)')
    expect(multi.errors).toContain('history 必填(同伴=长线人物,长期设定出生即知——出身+塑造往事)')
    const malformed = (personaGate as (a: unknown, o?: unknown) => { errors: string[] })({ persona: '话痨' }, { role: 'npc' })
    expect(malformed.errors).toEqual(['persona 须为人格对象(appearance/lens/reaction/voice/never/tension/alignment)——一句话 persona 已退役'])   // 只此一罪
    const ok = (personaGate as (a: unknown, o?: unknown) => { errors: string[] })({ persona: { lens: '看人先看钱包', reaction: '被赊账→记账' } }, { role: 'npc' })
    expect(ok.errors).toEqual([])   // 账平
  })
  it('opening_commit 玩家面:人设多罪 join 成一条 fail(出生面此处无写盘)', () => {
    const base = mkdtempSync(join(tmpdir(), 'dnd5e-spawn-agg-open-'))
    const cwd = join(base, 'runtime')
    cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
    cpSync(join(CARD, 'setup', 'openings.json'), join(cwd, 'openings.json'))
    cpSync(join(CARD, 'setup', 'state.md'), join(cwd, 'state.md'))
    const code = `globalThis.argv=[${JSON.stringify(JSON.stringify({ character: { name: '洛克', race: 'human', class: 'wizard', abilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 }, skills: ['arcana', 'investigation'], persona: { lens: '把知识当命', alignment: '混沌好' }, history: '学者出身' } }))}];await import(${JSON.stringify(pathToFileURL(join(CARD, 'scripts', 'opening_commit.mjs')).href)})`
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, encoding: 'utf8' })
    expect(r.status).toBe(1)
    const out = r.stdout.trim()
    expect(out).toContain('"ok":false')
    expect(out).toContain('超枚举')
    expect(out).toContain('reaction 必填')   // join 成一条——多罪同现
    expect(existsSync(join(cwd, 'characters', 'player.json'))).toBe(false)   // fail 在写盘前清账
    rmSync(base, { recursive: true, force: true })
  })
})
