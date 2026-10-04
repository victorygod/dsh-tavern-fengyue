// dnd5e spawn 武器掉落自动并入钉(2026-10-02 背包律 B 方案):spawn_monster 把 statblock 攻击键里
// 「武器类」(equipmentFM 查得到 weapon 字段)自动并入 gear 默认掉落——中文名优先(WEAPON_SLUG 反查),
// 查无回退英文名;agent 的 gear 只增不删(去重 merge);天生武器(咬/爪/尾击)EQ_CORE 查无=不落。
// 背景:哥布林用 shortbow 射人却 gear 只声明「弯刀」——掉落物(gear)与持有武器(attacks)脱节,B 方案机械对齐。
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
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-spawn-drop-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'state.md'), ['# 世界状态', '', '## 附近 NPC', ''].join('\n'))
  return { cwd, base }
}
function runTool(cwd: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', 'spawn_monster.mjs')).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, encoding: 'utf8' })
}
const j = (cwd: string, f: string) => JSON.parse(readFileSync(join(cwd, 'characters', f), 'utf8'))

describe('spawn_monster 武器掉落自动并入(背包律 B)', () => {
  it('goblin(statblock 刀+弓)不传 gear → 武器自动入包(中文名反查)', () => {
    const { cwd, base } = rig()
    const r = runTool(cwd, { context: '哥布林现身', name: '哥布林', stance: '敌对', monster_kind: 'goblin' })
    expect(r.status, r.stdout.slice(0, 240)).toBe(0)
    const g = j(cwd, '哥布林.json')
    expect(g.gear).toHaveLength(2)
    expect(g.gear).toEqual(expect.arrayContaining(['弯刀', '短弓']))
    rmSync(base, { recursive: true, force: true })
  })
  it('agent gear 只增不删:传「短弓/几枚铜币」→ 弯刀补入+短弓去重', () => {
    const { cwd, base } = rig()
    const r = runTool(cwd, { context: '哥布林现身', name: '哥布林', stance: '敌对', monster_kind: 'goblin', gear: ['短弓', '几枚铜币'] })
    expect(r.status, r.stdout.slice(0, 240)).toBe(0)
    const g = j(cwd, '哥布林.json')
    expect(g.gear).toHaveLength(3)
    expect(g.gear).toEqual(expect.arrayContaining(['短弓', '几枚铜币', '弯刀']))
    rmSync(base, { recursive: true, force: true })
  })
  it('天生武器不入掉落:wolf(咬)无 gear 键', () => {
    const { cwd, base } = rig()
    const r = runTool(cwd, { context: '狼现身', name: '狼', stance: '敌对', monster_kind: 'wolf' })
    expect(r.status, r.stdout.slice(0, 240)).toBe(0)
    const g = j(cwd, '狼.json')
    expect(g.gear).toBeUndefined()
    rmSync(base, { recursive: true, force: true })
  })
})
