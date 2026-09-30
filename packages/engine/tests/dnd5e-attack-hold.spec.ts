// dnd5e 持有闸钉(2026-09-30 背包律批):attack.mjs panel 武器路径——战斗中可使用的物品必须在
// weapons/gear 行上,查无即拒(回执「!武器没带」+Exit 1,且无「命中判定」行=拒在结算前)。
// 判据三通道:①表目(中/英)经 equipmentFM 归一比对同一 fm.path;②gear 自由文本行含中文名
// (WEAPON_SLUG 反查)——『10 支飞镖』解析不出单件取包含式;③gear 行含英文名 fm.name。
// 默认持位 weapons[0] 天然在列(dnd5e-attack-prof 七景即覆盖,本钉不重复)。
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
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

const PC = { name: '奥里安', role: 'pc', class: 'bard', level: 1, str: 10, dex: 14, hp: 20, hp_max: 20 }

/** 产能路径跑 attack(引擎真实 runner 契约),回执全文+退出码一起交。 */
function runAttack(extra: Record<string, unknown>, weapon: string): { status: number; out: string } {
  const dir = mkdtempSync(join(tmpdir(), 'dnd5e-attack-hold-'))
  cpSync(LIB, join(dir, 'preset', 'lib'), { recursive: true })
  const cwd = join(dir, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  writeFileSync(join(cwd, 'characters', '木桩.json'), JSON.stringify({ name: '木桩', role: 'npc', ac: 16, hp: 999, hp_max: 999 }))
  writeFileSync(join(cwd, 'characters', 'p.json'), JSON.stringify({ ...PC, ...extra }))
  const r = spawnSync(process.execPath, [RUNNER, b64(TOOL), b64(JSON.stringify({ context: '测试', who: '奥里安', target: '木桩', weapon }))], { cwd, encoding: 'utf8', timeout: 30000 })
  return { status: r.status, out: r.stdout ?? '' }
}

describe('dnd5e 持有闸——weapons/gear 行查无即拒(背包律)', () => {
  it('weapons/gear 查无(持剑传弓)→拒: !武器没带 + Exit 1 + 未至结算(无命中判定)', () => {
    const r = runAttack({ weapons: ['rapier'] }, 'longbow')
    expect(r.status).toBe(1)
    expect(r.out).toContain('武器没带:longbow')
    expect(r.out).toContain('update_character')
    expect(r.out).not.toContain('命中判定')
  })
  it('gear 自由文本包含式(CHN): gear「10 支飞镖」传 dart →放行+正常结算', () => {
    const r = runAttack({ weapons: ['shortsword'], gear: ['10 支飞镖'], weapon_prof: ['简易武器'] }, 'dart')
    expect(r.status, r.out.slice(0, 240)).toBe(0)
    expect(r.out).toContain('命中判定')
  })
  it('gear 自由文本包含式(EN): gear「dagger of venon 原型残句」传 dagger →放行', () => {
    const r = runAttack({ weapons: [], gear: ['dagger of venom'] }, 'dagger')
    expect(r.status, r.out.slice(0, 240)).toBe(0)
    expect(r.out).toContain('命中判定')
  })
  it('weapons 中/英归一: 表目「细剑」传 rapier →同一 fm.path 放行', () => {
    const r = runAttack({ weapons: ['细剑'] }, 'rapier')
    expect(r.status, r.out.slice(0, 240)).toBe(0)
    expect(r.out).toContain('命中判定')
  })
})
