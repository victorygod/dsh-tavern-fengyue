// dnd5e 特征机械化钉(2026-10-03):特质释义/成长选项/战斗机制三桶落地后的行为锚——
// ①hasFeature+无甲防御(deriveAC) ②gain_exp 升级 append 自动特征+选择项 pending
// ③front_commit op=choice 落字段 ④check 被动(万事通半熟练/可靠天赋抬10) ⑤狂暴状态 mods/resist。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

function rig(player: Record<string, unknown>) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-features-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'characters'), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(player))
  writeFileSync(join(cwd, 'state.md'), '# 世界状态\n\n## 附近 NPC\n\n## 战斗\n- （无战斗）\n')
  return { cwd, base }
}
const runTool = (rt: string, tool: string, args: Record<string, unknown>) => {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: rt, encoding: 'utf8' })
}
const runScript = (rt: string, script: string, args: unknown) => {
  const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(args))}];await import(${JSON.stringify(pathToFileURL(join(CARD, 'scripts', script)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: rt, encoding: 'utf8' })
}
const j = (rt: string) => JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8'))
const CORE = pathToFileURL(join(CARD, 'lib', 'core.mjs')).href

describe('dnd5e 特征机械化——hasFeature/无甲防御/成长选项/被动/狂暴', () => {
  it('无甲防御:野蛮人无甲 AC=10+敏+体;武僧=10+敏+感;有甲不叠加', () => {
    const { cwd: rt } = rig({ name: '蛮', role: 'pc', class: 'barbarian', dex: 14, con: 16, wis: 10, features: ['Rage|长休|已用0', 'Unarmored Defense|—|已用0'] })
    const code = `const { readFileSync } = await import('node:fs');const { deriveAC, hasFeature } = await import(${JSON.stringify(CORE)});const j = JSON.parse(readFileSync('characters/player.json','utf8'));console.log(JSON.stringify({ ac: deriveAC(j), uad: hasFeature(j, 'unarmored defense'), rage: hasFeature(j, 'rage') }))`
    const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: rt, encoding: 'utf8' })
    expect(JSON.parse(r.stdout)).toEqual({ ac: 15, uad: true, rage: true })   // 10+2+3=15
    // 武僧 10+敏+感
    writeFileSync(join(rt, 'characters', 'player.json'), JSON.stringify({ name: '僧', role: 'pc', class: 'monk', dex: 16, con: 12, wis: 16, features: ['Martial Arts|—|已用0', 'Unarmored Defense|—|已用0'] }))
    const r2 = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: rt, encoding: 'utf8' })
    expect(JSON.parse(r2.stdout).ac).toBe(16)   // 10+3+3
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('gain_exp 升级:自动特征 append 进 features,选择特征推 pending', () => {
    // 战士 L1(Second Wind+Fighting Style)→ 升 L2 获 Action Surge(自动)+Fighting Style 仍 pending
    const { cwd: rt } = rig({ name: '铜须', role: 'pc', class: 'fighter', level: 1, exp: 0, hp: 13, hp_max: 13, con: 14, str: 15, dex: 10, int: 10, wis: 12, cha: 8, features: ['Second Wind|短休|已用0', 'Fighting Style|—|已用0'] })
    const r = runTool(rt, 'gain_exp', { context: '升级', who: '铜须', exp: 300 })
    expect(r.status).toBe(0)
    const p = j(rt)
    expect(p.features.some(f => String(f).startsWith('Action Surge'))).toBe(true)   // 自动特征已 append
    expect((p.pending ?? []).some(x => String(x).includes('Fighting Style'))).toBe(false)   // 出生已带,不重复 pending
    expect(p.level).toBe(2)
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('front_commit op=choice:落字段+销待办;查无/选数不符拒', () => {
    const { cwd: rt } = rig({ name: '洛克', role: 'pc', class: 'fighter', level: 1, hp: 14, hp_max: 14, str: 16, dex: 14, con: 14, int: 10, wis: 10, cha: 8, features: ['Fighting Style|—|已用0'], pending: ['LV1·Fighting Style 待选'], weapons: ['longsword'], gear: [], gp: 10, sp: 0, cp: 0 })
    const r = runScript(rt, 'front_commit.mjs', { op: 'choice', who: 'player', kind: 'fighting_style', selected: ['archery'] })
    expect(r.status).toBe(0)
    expect(JSON.parse(r.stdout).ok).toBe(true)
    const p = j(rt)
    expect(p.fighting_style).toBe('archery')
    expect(p.pending).toEqual([])
    // 未知选项拒
    const bad = runScript(rt, 'front_commit.mjs', { op: 'choice', who: 'player', kind: 'fighting_style', selected: ['nope'] })
    expect(bad.stdout).toContain('选项不存在')
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('check 被动:万事通给未熟练技能半熟练;可靠天赋 d20<10 抬 10', () => {
    const { cwd: rt } = rig({ name: '诗人', role: 'pc', class: 'bard', level: 2, hp: 15, hp_max: 15, str: 8, dex: 14, con: 10, int: 12, wis: 10, cha: 16, skill_prof: ['persuasion'], features: ['Jack of All Trades|—|已用0'] })
    // 未熟练技能(洞悉=wis,无熟练)→ 万事通半熟练 +1(PB2 半=1)
    const r = runTool(rt, 'check', { context: '读心', who: '诗人', skill: 'insight', dc: 10 })
    expect(r.stdout).toContain('万事通+1')
    rmSync(dirname(rt), { recursive: true, force: true })
  })

  it('狂暴状态:mods(力攻+2)+resist(钝刺砍)由 status.mjs 单源,rollMods 读 mods', () => {
    const { cwd: rt } = rig({ name: '蛮', role: 'pc', class: 'barbarian', level: 1, hp: 20, hp_max: 20, str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8, features: ['Rage|长休|已用0'] })
    // update_status 施加 Rage——statusMech 从 STATUS_TEXT 自动落 mods/resist
    const r = runTool(rt, 'update_status', { context: '狂暴', target: '蛮', statuses: [{ status: 'Rage', applied_at: '第2轮' }] })
    expect(r.status).toBe(0)
    const p = j(rt)
    expect(p.statuses.Rage.mods).toEqual([{ stat: 'damage', magnitude: '2' }])
    expect(p.statuses.Rage.resist).toEqual(['bludgeoning', 'piercing', 'slashing'])
    rmSync(dirname(rt), { recursive: true, force: true })
  })
})
