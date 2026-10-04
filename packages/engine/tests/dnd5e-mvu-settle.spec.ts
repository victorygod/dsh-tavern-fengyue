// dnd5e 结算三件钉(2026-10-04):gain_exp/gain_money 从 mvu 块迁为工具(复用 mvu-apply 的 applyExp/applyMoney),
// + HP 归零即死的死亡结算待办回执(attack/cast/damage/hp_change 四件经 core.deathSettleLine 单源)。
// 背景:原 mvu 块的 money/exp 键退役——钱款/经验改由工具落账,死亡当拍提醒 DM 结算 经验/钱款/掉落。
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
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-settle-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  return { cwd, base }
}
function runTool(cwd: string, tool: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', tool + '.mjs')).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, encoding: 'utf8' })
}
const j = (cwd: string, f: string) => JSON.parse(readFileSync(join(cwd, 'characters', f), 'utf8'))
const FIGHTER = { name: '铁武', role: 'npc', class: 'fighter', level: 1, exp: 0, con: 10, hp: 19, hp_max: 19, hd_available: 0, gp: 0, sp: 0, cp: 0, statuses: {} }

describe('dnd5e 结算三件:gain_exp/gain_money 工具 + 死亡结算待办回执', () => {
  it('gain_exp 直值通道: exp 350 → LV2(fighter d10 avg=6, conM=0 → hp_max 19→25)', () => {
    const { cwd, base } = rig()
    writeFileSync(join(cwd, 'characters', '铁武.json'), JSON.stringify(FIGHTER))
    const r = runTool(cwd, 'gain_exp', { context: '第一场胜仗', who: '铁武', exp: 350 })
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain('[经验 · 铁武] 350 XP')
    const w = j(cwd, '铁武.json')
    expect(w.exp).toBe(350); expect(w.level).toBe(2)
    expect(w.hp_max).toBe(25); expect(w.hp).toBe(25); expect(w.hd_available).toBe(1)
    rmSync(base, { recursive: true, force: true })
  })

  it('gain_exp 战果通道: foes 两怪 CR0.25=50×2=100 ÷2 人 → 50/人', () => {
    const { cwd, base } = rig()
    writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify({ name: '玩家', role: 'pc', class: 'fighter', level: 1, exp: 0, con: 10, hp: 10, hp_max: 10, statuses: {} }))
    writeFileSync(join(cwd, 'characters', '铁武.json'), JSON.stringify(FIGHTER))
    writeFileSync(join(cwd, 'characters', '哥布林甲.json'), JSON.stringify({ name: '哥布林甲', role: 'npc', monster_kind: 'goblin', level: 0.25, hp: 0, hp_max: 7, statuses: {} }))
    writeFileSync(join(cwd, 'characters', '哥布林乙.json'), JSON.stringify({ name: '哥布林乙', role: 'npc', monster_kind: 'goblin', level: 0.25, hp: 0, hp_max: 7, statuses: {} }))
    const r = runTool(cwd, 'gain_exp', { context: '清剿哥布林', who: '玩家,铁武', foes: '哥布林甲,哥布林乙' })
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain('战果: 50+50 = 100 XP ÷ 2 人 → 50/人')
    expect(j(cwd, 'player.json').exp).toBe(50)
    expect(j(cwd, '铁武.json').exp).toBe(50)
    rmSync(base, { recursive: true, force: true })
  })

  it('gain_exp 拒无成长面(怪/纯场景 NPC 不挣 XP)', () => {
    const { cwd, base } = rig()
    writeFileSync(join(cwd, 'characters', '哥布林.json'), JSON.stringify({ name: '哥布林', role: 'npc', monster_kind: 'goblin', level: 0.25, hp: 7, hp_max: 7, statuses: {} }))
    const r = runTool(cwd, 'gain_exp', { context: '误发', who: '哥布林', exp: 10 })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('无成长面')
    rmSync(base, { recursive: true, force: true })
  })

  it('gain_money gain: 2gp3sp → gp 0→2 · sp 0→3(统一 cp 核算+三栏规范化)', () => {
    const { cwd, base } = rig()
    writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify({ name: '玩家', role: 'pc', gp: 0, sp: 0, cp: 0 }))
    const r = runTool(cwd, 'gain_money', { context: '拾金', who: '玩家', direction: 'gain', amount: '2gp3sp' })
    expect(r.status, r.stdout).toBe(0)
    const w = j(cwd, 'player.json')
    expect(w.gp).toBe(2); expect(w.sp).toBe(3); expect(w.cp).toBe(0)
    rmSync(base, { recursive: true, force: true })
  })

  it('gain_money spend 超余额: 照落 + ⚠ 负余额(核对失误信号)', () => {
    const { cwd, base } = rig()
    writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify({ name: '玩家', role: 'pc', gp: 1, sp: 0, cp: 0 }))
    const r = runTool(cwd, 'gain_money', { context: '硬买', who: '玩家', direction: 'spend', amount: '5gp' })
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain('⚠ 负余额')
    expect(j(cwd, 'player.json').gp).toBe(-4)
    rmSync(base, { recursive: true, force: true })
  })

  it('死亡结算待办: hp_change 把敌人打到 0HP → 回执带 经验/钱款/掉落', () => {
    const { cwd, base } = rig()
    writeFileSync(join(cwd, 'characters', '哥布林.json'), JSON.stringify({ name: '哥布林', role: 'npc', monster_kind: 'goblin', level: 0.25, hp: 7, hp_max: 7, gp: 2, sp: 5, cp: 0, gear: ['弯刀', '短弓'], statuses: {} }))
    const r = runTool(cwd, 'hp_change', { context: '一剑毙命', target: '哥布林', amount: -7 })
    expect(r.status, r.stdout).toBe(0)
    expect(r.stdout).toContain('0HP——即死')
    expect(r.stdout).toContain('死亡结算待办: 立刻调 gain_exp / gain_money / update_inventory 结算')
    expect(r.stdout).toContain('结算明细')
    expect(r.stdout).toContain('经验 50 XP(CR 0.25)')
    expect(r.stdout).toContain('钱款 GP 2 · SP 5')
    expect(r.stdout).toContain('掉落 弯刀、短弓')
    rmSync(base, { recursive: true, force: true })
  })

  it('死亡结算待办不产: PC 0HP=濒死起算、同伴即死=损失非战利品', () => {
    const { cwd, base } = rig()
    writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify({ name: '玩家', role: 'pc', hp: 10, hp_max: 10, statuses: {} }))
    writeFileSync(join(cwd, 'characters', '同伴.json'), JSON.stringify({ name: '同伴', role: 'companion', hp: 10, hp_max: 10, gp: 5, gear: ['匕首'], statuses: {} }))
    const rp = runTool(cwd, 'hp_change', { context: '玩家重伤', target: '玩家', amount: -10 })
    expect(rp.status, rp.stdout).toBe(0)
    expect(rp.stdout).toContain('濒死计数起算')
    expect(rp.stdout).not.toContain('死亡结算待办')
    const rc = runTool(cwd, 'hp_change', { context: '同伴阵亡', target: '同伴', amount: -10 })
    expect(rc.status, rc.stdout).toBe(0)
    expect(rc.stdout).toContain('即死')
    expect(rc.stdout).not.toContain('死亡结算待办')
    rmSync(base, { recursive: true, force: true })
  })
})
