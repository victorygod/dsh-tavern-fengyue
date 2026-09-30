// dnd5e 攻击加值百人钉(2026-09-30 攻击链勘验批):attack.mjs 真工具+真 runner 契约(b64 载荷)跑临时树——
// 断言回执「命中判定: d20+N」的 N,与掷骰无关(骰值可变,N 面定死)。四修全钉:
// ①熟练桥——weapon_prof 全中文(PROF_WEAPON 单源)曾对英文 fm includes 永假,全职业攻检无 PB;
//   类目对 fm.weapon(简易武器→simple/军用武器→martial),武器名走 WEAPON_SLUG 对 slugify(fm.name)。
// ②弩系 slug——'手弩' 曾映射 hand-crossbow 而 EQ 键 crossbow-hand,查无即「攻击无源」。
// ③属性律 RAW——灵巧←STR/DEX 择高;无灵巧远程(弩)←DEX 纯取(STR 高也不蚕食);投掷无灵巧(矛/标枪)←STR。
// ④远程面——fm.weapon '…Ranged' 字段为权威(弩 fm properties 无 Range 条,旧 prop 探测漏判)。
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const RUNNER = join(ROOT, 'packages', 'engine', 'runner', 'runner.cjs')
const TOOL = join(ROOT, 'tavern_presets', 'dnd5e', 'preset', 'tools', 'attack.mjs')
const LIB = join(ROOT, 'tavern_presets', 'dnd5e', 'preset', 'lib')
const b64 = (s: string) => Buffer.from(s).toString('base64')

interface Rig { cwd: string; dir: string }
function rig(pc: Record<string, unknown>): Rig {
  const dir = mkdtempSync(join(tmpdir(), 'dnd5e-attack-prof-'))
  cpSync(LIB, join(dir, 'preset', 'lib'), { recursive: true })
  const cwd = join(dir, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  writeFileSync(join(cwd, 'characters', '木桩.json'), JSON.stringify({ name: '木桩', role: 'npc', ac: 16, hp: 999, hp_max: 999 }))
  writeFileSync(join(cwd, 'characters', 'p.json'), JSON.stringify(pc))
  return { cwd, dir }
}

/** 产能路径跑 attack(引擎真实 runner 契约),回执抓「命中判定: d20±N」。 */
function hitBonus(pc: Record<string, unknown>): string {
  const { cwd, dir } = rig(pc)
  const r = spawnSync(process.execPath, [RUNNER, b64(TOOL), b64(JSON.stringify({ context: '测试', who: '奥里安', target: '木桩' }))], { cwd, encoding: 'utf8', timeout: 30000 })
  expect(r.status, `${r.stderr?.slice(0, 240)}`).toBe(0)
  const line = (r.stdout ?? '').split('\n').find(l => l.includes('命中判定'))
  expect(line).toBeDefined()
  return /d20([-+]\d+)/.exec(line!)?.[1] ?? ''
}

const PC = { name: '奥里安', role: 'pc', class: 'bard', level: 1, str: 10, dex: 14, hp: 20, hp_max: 20 }

describe('dnd5e 武器攻检加值——熟练桥/弩 slug/属性律/远程面(2026-09-30)', () => {
  it('CN 具名熟练(细剑)→ PB 生效: d20+4', () => {
    expect(hitBonus({ ...PC, weapons: ['rapier'], weapon_prof: ['简易武器', '手弩', '长剑', '细剑', '短剑'] })).toBe('+4')
  })
  it('CN 类目熟练(简易武器→simple)→ PB 生效: d20+4', () => {
    expect(hitBonus({ ...PC, weapons: ['dagger'], weapon_prof: ['简易武器'] })).toBe('+4')
  })
  it('手弩存活(slug 修)且 CN 具名熟练: d20+4', () => {
    expect(hitBonus({ ...PC, weapons: ['手弩'], weapon_prof: ['手弩'] })).toBe('+4')
  })
  it('标枪无灵巧→STR 纯取(str12/dex16): d20+3', () => {
    expect(hitBonus({ ...PC, str: 12, dex: 16, weapons: ['javelin'], weapon_prof: ['简易武器', '标枪'] })).toBe('+3')
  })
  it('飞镖有灵巧→STR/DEX 择高(str14/dex10): d20+4', () => {
    expect(hitBonus({ ...PC, str: 14, dex: 10, weapons: ['dart'], weapon_prof: ['简易武器'] })).toBe('+4')
  })
  it('重弩无灵巧远程→DEX 纯取(STR16 不蚕食): d20+4', () => {
    expect(hitBonus({ ...PC, str: 16, weapons: ['重弩'], weapon_prof: ['简易武器', '重弩'] })).toBe('+4')
  })
  it('英文名武器(逗号形)+军用类目: d20+4', () => {
    expect(hitBonus({ ...PC, weapons: ['Crossbow, hand'], weapon_prof: ['军用武器'] })).toBe('+4')
  })
  it('consume 分支不崩(let 修:消费型状态+= 曾撞 const 重赋即 TypeError)', () => {
    const pc = { ...PC, weapons: ['rapier'], weapon_prof: ['简易武器', '细剑'], statuses: { 'Bardic Inspiration (d6)': { applied_at: '第1轮', mods: [{ stat: 'attack_save', magnitude: '1d6' }] } } }
    const { cwd, dir } = rig(pc)
    const r = spawnSync(process.execPath, [RUNNER, b64(TOOL), b64(JSON.stringify({ context: '测试', who: '奥里安', target: '木桩', consume: 'Bardic Inspiration (d6)' }))], { cwd, encoding: 'utf8', timeout: 30000 })
    expect(r.status).toBe(0)
    expect((r.stdout ?? '')).toContain('状态修正')
    rmSync(dir, { recursive: true, force: true })
  })
})
