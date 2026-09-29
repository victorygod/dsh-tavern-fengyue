// rest 件钉(2026-09-28,audit-fixes §8 G 线):短休掷骰+池+契术师 / 长休 hd 公式 / slots 三位表回满 /
// 力竭 food 闸 / hp0 err + 24h 铁轨 err。位表 slotsFor 已迁 core 单源(gain_exp 回归绿由现有 suite 保证)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const WIZARD = { name: '梅西雅', role: 'pc', class: 'wizard', level: 5, hp: 10, hp_max: 30, hd_available: 3, str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10, slots_l1: 1, slots_l2: 0, slots_l3: 0, features: ['奥法回复|短休|已用1'] }
const STATE = ['# 世界状态', '', '## 时间敏感项（活值登记）', '- 当前时间：第3日·10时', '- 长休窗口：无 last_long_rest 记录＝随时可长休', '', '## 附近 NPC', ''].join('\n')

function rig(player = WIZARD) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-rest-'))
  const cwd = join(base, 'runtime')
  for (const d of ['characters']) mkdirSync(join(cwd, d), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  cpSync(join(CARD, '..', 'corpus', 'srd-lorebook'), join(cwd, 'dnd5e-srd-lorebook'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(player))
  writeFileSync(join(cwd, 'state.md'), STATE)
  return { cwd, base }
}
function runTool(runtime: string, tool: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
}
const j = (rt: string) => JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8'))

describe('rest 休整件(真实脚本)', () => {
  it('短休:掷生命骰回血+hd 扣减+短休池回充', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'rest', { context: '扎营短憩', kind: 'short', who: '梅西雅', hd: 2 })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/生命骰 1d6\+1=\d+ · 1d6\+1=\d+/)
    expect(r.stdout).toMatch(/hd_available 3→1/)
    expect(r.stdout).toContain('短休')
    expect(j(rt)).toMatchObject({ hd_available: 1, features: ['奥法回复|短休|已用0'] })
    rmSync(base, { recursive: true, force: true })
  })
  it('长休:hp 回满+hd 公式(3→min(5,3+2))+slots 三位表回满', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'rest', { context: '营地长憩', kind: 'long', who: '梅西雅' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/hp 10→30/)
    expect(r.stdout).toMatch(/slots_l1 1→4/)        // wizard L5 全施法
    expect(r.stdout).toMatch(/slots_l2 0→3/)
    expect(r.stdout).toMatch(/slots_l3 0→2/)
    expect(j(rt)).toMatchObject({ hp: 30, slots_l1: 4, slots_l2: 3, slots_l3: 2 })
    expect(j(rt).hd_available).toBe(5)              // 3 + max(1,⌊5/2⌋)=3 → min(5,5)=5
    expect(readFileSync(join(rt, 'state.md'), 'utf8')).toContain('last_long_rest=第3日·10时')
    rmSync(base, { recursive: true, force: true })
  })
  it('长休清临时生命(RAW "last until long rest"):temp_hp 归零,hp/hp_max 不动', () => {
    const p = JSON.parse(JSON.stringify(WIZARD)); p.temp_hp = 5; p.statuses = { 虚假生命: { temp: 5 } }
    const { cwd: rt, base } = rig(p)
    const r = runTool(rt, 'rest', { context: '长憩', kind: 'long', who: '梅西雅' })
    expect(r.status).toBe(0)
    const p2 = j(rt)
    expect(p2.temp_hp).toBe(0)
    expect(p2.statuses['虚假生命']).toBeUndefined()
    expect(p2.hp).toBe(30); expect(p2.hp_max).toBe(30)   // 独立池,不碰真血
    rmSync(base, { recursive: true, force: true })
  })
  it('长休:力竭按 food 闸恢复(food:false 跳过并注明)', () => {
    const { cwd: rt, base } = rig({ ...WIZARD, exhaustion: 2 })
    const r = runTool(rt, 'rest', { context: '无粮长憩', kind: 'long', who: '梅西雅', food: false })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('无饮食:力竭未减')
    expect(j(rt).exhaustion).toBe(2)
    rmSync(base, { recursive: true, force: true })
  })
  it('长休铁轨:hp0 濒死 err + 24h 窗口 err', () => {
    const a1 = rig({ ...WIZARD, hp: 0 })
    const dead = runTool(a1.cwd, 'rest', { context: '濒死长休', kind: 'long', who: '梅西雅' })
    expect(dead.status).toBe(1)
    expect(dead.stdout).toContain('hp<1 濒死不能长休')
    rmSync(a1.base, { recursive: true, force: true })

    const a2 = rig()
    writeFileSync(join(a2.cwd, 'state.md'), STATE.replace('无 last_long_rest 记录＝随时可长休', 'last_long_rest=第3日·0时'))
    const early = runTool(a2.cwd, 'rest', { context: '刚醒又睡', kind: 'long', who: '梅西雅' })
    expect(early.status).toBe(1)
    expect(early.stdout).toContain('距上次长休仅 10 小时')
    rmSync(a2.base, { recursive: true, force: true })
  })
  it('半施法/契术师位表回满(slotsFor 单源)', () => {
    const p = rig({ name: '老铁', role: 'npc', class: 'paladin', level: 5, hp: 10, hp_max: 40, hd_available: 2, str: 14, dex: 10, con: 12, int: 10, wis: 12, cha: 14, slots_l1: 0, slots_l2: 0 })
    const r = runTool(p.cwd, 'rest', { context: '长憩', kind: 'long', who: '老铁' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/slots_l1 0→4/)         // paladin L5 半施法 [4,2]
    expect(r.stdout).toMatch(/slots_l2 0→2/)
    rmSync(p.base, { recursive: true, force: true })

    const w = rig({ name: '契', role: 'npc', class: 'warlock', level: 3, hp: 10, hp_max: 20, hd_available: 2, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16, slots_l1: 0, slots_l2: 0 })
    const rr = runTool(w.cwd, 'rest', { context: '短憩', kind: 'short', who: '契' })
    expect(rr.status).toBe(0)
    expect(rr.stdout).toContain('契术师魔契位整池回满')
    rmSync(w.base, { recursive: true, force: true })
  })
})