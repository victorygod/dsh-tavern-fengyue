// cast 新施放面钉(2026-09-29 补录):pool 额度罩池(sleep)/judge 阈值断定(power-word)/onFail 豁免失败落
// statuses(hold-person)/healPool(mass-heal)/raise(revivify)/hpMaxBoost(aid)/buff 读口(shield/hold)。
// 骰与豁免确定性:setSeed 直喷 core(同 registry 共享实例),用例内先钉种子再 import cast。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

function rig(extraChars: Record<string, unknown> = {}, playerExtra: Record<string, unknown> = {}) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-cast-branch-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'dnd5e-srd-lorebook/spells'), { recursive: true })
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify({
    name: '月见', role: 'pc', class: 'wizard', level: 3, hp: 18, hp_max: 18,
    int: 16, caster_attr: 'int', concentrating: null, statuses: {},
    spells_known: ['sleep', 'hold-person', 'mass-heal', 'revivify', 'aid', 'power-word-kill', 'shield'],
    slots_l1: 3, slots_l2: 3, slots_l3: 3, slots_l9: 3,
    ...playerExtra,
  }))
  for (const [n, o] of Object.entries(extraChars)) writeFileSync(join(cwd, 'characters', n), JSON.stringify(o))
  writeFileSync(join(cwd, 'state.md'), '# 世界状态\n\n## 附近 NPC\n\n## 战斗\n- （无战斗）\n')
  return { cwd, base }
}
function cast(rt: string, base: string, args: Record<string, unknown>) {
  const core = pathToFileURL(join(base, 'preset', 'lib', 'core.mjs')).href
  const code = `const { setSeed } = await import(${JSON.stringify(core)});setSeed(${args.seed ?? 9});globalThis.argv=${JSON.stringify({ ...args, seed: undefined })};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', 'cast.mjs')).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: rt, encoding: 'utf8' })
}
const j = (rt: string, f: string) => JSON.parse(readFileSync(join(rt, 'characters', f), 'utf8'))

describe('pool 额度罩池(sleep)', () => {
  it('升序罩 + 装不下即止 + statuses 落档', () => {
    const g1 = { name: '哥布林甲', role: 'npc', hp: 7, hp_max: 7 }
    const g2 = { name: '哥布林乙', role: 'npc', hp: 25, hp_max: 25 }
    const { cwd: rt, base } = rig({ '哥布林甲.json': g1, '哥布林乙.json': g2 })
    const r = cast(rt, base, { context: '晨雾镇井', spell: 'sleep', caster: '月见', targets: '哥布林甲,哥布林乙', seed: 9 })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('额度判定: 5d8')
    expect(r.stdout).toContain('罩入')
    const p = j(rt, '哥布林甲.json')
    expect(p.statuses.Sleep.effect).toContain('昏睡')
    // 乙 hp25 罩不下——即止行 + 无 Sleep 落档
    expect(r.stdout).toContain('额度不足')
    expect(j(rt, '哥布林乙.json').statuses?.Sleep).toBeUndefined()
    rmSync(base, { recursive: true, force: true })
  })
})

describe('onFail 豁免失败落状态(hold-person)', () => {
  it('失败 → statuses「Hold Person」;通过 → 不落', () => {
    const { cwd: rt, base } = rig({ '哥布林丙.json': { name: '哥布林丙', role: 'npc', hp: 7, hp_max: 7, wis: 10 } })
    // LCG 种子:首掷 d20=低(wis 10 → +0,DC 13 必败)
    let failRun: ReturnType<typeof cast> | null = null
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {   // 种子表钉一个必败用例(骰序确定性)
      const r = cast(rt, base, { context: '定身', spell: 'hold-person', caster: '月见', targets: '哥布林丙', seed })
      if (r.stdout.includes('→ 失败')) { failRun = r; break }
    }
    expect(failRun).toBeTruthy()
    expect(failRun!.stdout).toContain('statuses「Hold Person」瘫')
    expect(j(rt, '哥布林丙.json').statuses['Hold Person'].effect).toContain('瘫')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('healPool 总池分配(mass-heal)', () => {
  it('逐员补到 hp_max,满血跳过,余池回显', () => {
    const { cwd: rt, base } = rig({ '格姆.json': { name: '格姆', role: 'companion', hp: 5, hp_max: 40 }, '提娜.json': { name: '提娜', role: 'companion', hp: 40, hp_max: 40 } })
    const r = cast(rt, base, { context: '战后', spell: 'mass-heal', caster: '月见', targets: '格姆,提娜' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('总池 700')
    expect(r.stdout).toContain('余池')
    expect(j(rt, '格姆.json').hp).toBe(40)
    rmSync(base, { recursive: true, force: true })
  })
})

describe('raise 翻生(revivify)', () => {
  it('死者回 1 HP,濒死计数双清;活者拒收', () => {
    const { cwd: rt, base } = rig({ '老村长.json': { name: '老村长', role: 'pc', hp: 0, hp_max: 10, death_success: 1, death_fail: 2 } })
    const r = cast(rt, base, { context: '回生', spell: 'revivify', caster: '月见', targets: '老村长' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('hp 0→1')
    expect(j(rt, '老村长.json')).toMatchObject({ hp: 1, death_success: 0, death_fail: 0 })
    const b = cast(rt, base, { context: '错投', spell: 'revivify', caster: '月见', targets: '老村长' })
    expect(b.status).toBe(1)
    expect(b.stdout).toContain('翻生只收已死者')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('judge 阈值断定(power-word-kill)', () => {
  it('≤100 0HP 即死;>100 无效果', () => {
    const { cwd: rt, base } = rig({ '哥布林丙.json': { name: '哥布林丙', role: 'npc', hp: 7, hp_max: 7 }, '食人魔.json': { name: '食人魔', role: 'npc', hp: 120, hp_max: 120 } })
    const r = cast(rt, base, { context: '律令', spell: 'power-word-kill', caster: '月见', targets: '哥布林丙,食人魔' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('即死')
    expect(j(rt, '哥布林丙.json').hp).toBe(0)
    expect(r.stdout).toContain('超阈值')
    expect(j(rt, '食人魔.json').hp).toBe(120)
    rmSync(base, { recursive: true, force: true })
  })
})

describe('hpMaxBoost 上限成长(aid)', () => {
  it('hp_max 与 hp 各 +5(平值;as_level 覆写按 +5/环)', () => {
    const { cwd: rt, base } = rig({ '格姆.json': { name: '格姆', role: 'companion', hp: 10, hp_max: 40 } })
    const r = cast(rt, base, { context: '援助', spell: 'aid', caster: '月见', targets: '格姆', as_level: 2 })
    expect(r.status).toBe(0)
    expect(j(rt, '格姆.json')).toMatchObject({ hp: 15, hp_max: 45 })
    rmSync(base, { recursive: true, force: true })
  })
})

describe('buff 读口确认版(shield)', () => {
  it('statuses「Shield」ac +5 落档(attack 侧消费面同 bless 律)', () => {
    const { cwd: rt, base } = rig()
    const r = cast(rt, base, { context: '反应护盾', spell: 'shield', caster: '月见', targets: '月见' })
    expect(r.status).toBe(0)
    expect(j(rt, 'player.json').statuses.Shield).toMatchObject({ mods: [{ stat: 'ac', magnitude: 5 }] })
    rmSync(base, { recursive: true, force: true })
  })
})
