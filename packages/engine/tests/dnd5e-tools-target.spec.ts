// dnd5e 目标结算解析咽喉钉(2026-09-25):玩家名→player.json 的 name 兜底、敌行优先、
// 查无报错不涂默认、ac 转写逃生舱、豁免目标按档算加值、AC 律单源(ui_data 同 17)。
// 事故锚:梅西雅存 characters/player.json,attack 旧手写 existsSync('characters/梅西雅.json')
// 落空 → AC 静默留 10(实测 vs AC 10 命中,应为 17=鳞甲14+敏1+盾2)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const PLAYER = {  // 鳞甲+盾+敏12 → AC 17;wizard L3(int16) → DC 13、PB 2
  name: '梅西雅', class: 'wizard', level: 3, dex: 12, int: 16,
  armor: 'scale-mail', shield: true, caster_attr: 'int', slots_l1: 4,
  save_prof: ['dex'], spells_known: ['fire-bolt', 'burning-hands'],
  attacks: { dagger: { kind: 'melee', bonus: 3, dice: '1d4+1', type: 'piercing', reach: 5 } },
}
const STATE = [
  '## 战斗（宣战物化：回合/先攻/参战行——行只记 名|状态）',
  '- 回合：2',
  '- 先攻：哥布林乙:15 > 梅西雅:13',
  '- 参战行：哥布林乙 | 四分掩体（拐角+岩壁）',
  '',
  '## 附近 NPC',
  '',
].join('\n')
const FM = (fields: string) => `---\n${fields}\n---\n\n正文`
const SCALE_MAIL = FM('name: Scale Mail\nac_base: 14\nac_dex_bonus: true\nac_dex_cap: 2')
const GOBLIN = FM('name: Goblin\ndex: 14\nac: 15\nsave_prof:\n  - dex')
const SPELLS: Record<string, string> = {
  'burning-hands': FM('name: Burning Hands\nlevel: 1\nsave: dex\ndamage: 3d6\ndamage_type: fire\nhalf_on_save: true'),
  'fire-bolt': FM('name: Fire Bolt\nlevel: 0\nattack_type: ranged\ndamage: 1d10\ndamage_type: fire'),
}

/** 临时运行树:tool cwd=runtime/,`../preset/lib` 是其兄弟(真实部署同构)。 */
function rig() {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-target-'))
  const cwd = join(base, 'runtime')
  for (const d of ['characters', 'dnd5e-srd-lorebook/equipment', 'dnd5e-srd-lorebook/monsters', 'dnd5e-srd-lorebook/spells'])
    mkdirSync(join(cwd, d), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(PLAYER))
  writeFileSync(join(cwd, 'characters', '哥布林乙.json'), JSON.stringify({ name: '哥布林乙', level: 0.25, ac: 15, hp: 7, hp_max: 7, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, attacks: { scimitar: { kind: 'melee', bonus: 4, dice: '1d6+2', type: 'piercing', reach: 5 } } }))
  writeFileSync(join(cwd, 'state.md'), STATE)
  writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'equipment', 'scale-mail.md'), SCALE_MAIL)
  writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'monsters', 'goblin.md'), GOBLIN)
  for (const [slug, md] of Object.entries(SPELLS)) writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'spells', `${slug}.md`), md)
  return { cwd, base }
}

function runTool(runtime: string, tool: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
}

function runOp(runtime: string, op: Record<string, unknown>): Record<string, unknown> {
  const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(op))}];await import(${JSON.stringify(pathToFileURL(join(CARD, 'scripts', 'ui_data.mjs')).href)})`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ui_data ${JSON.stringify(op)} exit ${r.status}: ${r.stderr.slice(0, 400)}`)
  return JSON.parse(r.stdout.trim().split('\n').filter(Boolean).pop() ?? '')
}

const ATTACK = { mode: 'normal', cover_bonus: 0, context: '梗概' }

describe('attack 目标解析咽喉(真实脚本)', () => {
  it('事故锚:目标=玩家名,档存 player.json → name 兜底命中,AC 17 带档源标记(不再默 10)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'attack', { who: '哥布林乙', target: '梅西雅', attack: 'scimitar', ...ATTACK })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/vs AC 17\(characters\/player\.json\)/)
    expect(r.stdout).not.toMatch(/vs AC 10/)
    rmSync(base, { recursive: true, force: true })
  })
  it('目标=参战行名 → 数值走档(参战名单化后行不落数值),来源标档', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'attack', { target: '哥布林乙', attack: 'dagger', ...ATTACK })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/vs AC 15\(characters\/哥布林乙\.json\)/)
    rmSync(base, { recursive: true, force: true })
  })
  it('查无目标且未传 ac → 报错退出,绝不静默涂 10', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'attack', { target: '路人甲', attack: 'dagger', ...ATTACK })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!查无目标:路人甲')
    rmSync(base, { recursive: true, force: true })
  })
  it('弃盾=shield 键翻转(装备态,非 status):弃盾 -2 AC,拾回 +2 自动回来', () => {
    const { cwd: rt, base } = rig()
    const pj = JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8'))
    pj.shield = false   // 弃盾——装备键翻转,deriveAC 自动 -2(不占 statuses)
    writeFileSync(join(rt, 'characters', 'player.json'), JSON.stringify(pj))
    const dropped = runTool(rt, 'attack', { target: '梅西雅', attack: 'dagger', ...ATTACK })
    expect(dropped.status).toBe(0)
    expect(dropped.stdout).toMatch(/vs AC 15\(characters\/player\.json\)/)
    pj.shield = true    // 拾回——+2 自动回来
    writeFileSync(join(rt, 'characters', 'player.json'), JSON.stringify(pj))
    const back = runTool(rt, 'attack', { target: '梅西雅', attack: 'dagger', ...ATTACK })
    expect(back.stdout).toMatch(/vs AC 17\(characters\/player\.json\)/)
    rmSync(base, { recursive: true, force: true })
  })
  it('update_status 对象表覆盖式:施加带 mods 状态 → AC 变,摘除还原', () => {
    const { cwd: rt, base } = rig()
    const st = runTool(rt, 'update_status', { context: '盾信术', target: '梅西雅', status: 'Shield of Faith', applied_at: '第 2 轮', effect: 'AC +2，持续 10 分（专注）', mods: [{ stat: 'ac', magnitude: 2 }] })
    expect(st.status).toBe(0)
    expect(st.stdout).toMatch(/AC: 17→19/)
    expect(st.stdout).toContain('完整状态')
    expect(JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8')).statuses['Shield of Faith']).toMatchObject({ applied_at: '第 2 轮', mods: [{ stat: 'ac', magnitude: '2' }] })
    // 增量更新:只改 effect,其余保留(applied_at/mods 不动)
    const patch = runTool(rt, 'update_status', { context: '续专注', target: '梅西雅', status: 'Shield of Faith', applied_at: '第 3 轮' })
    expect(patch.status).toBe(0)
    expect(JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8')).statuses['Shield of Faith']).toMatchObject({ applied_at: '第 3 轮', effect: 'AC +2，持续 10 分（专注）', mods: [{ stat: 'ac', magnitude: '2' }] })
    const rm = runTool(rt, 'update_status', { context: '专注断', target: '梅西雅', status: 'Shield of Faith', remove: true })
    expect(rm.status).toBe(0)
    expect(rm.stdout).toMatch(/AC: 19→17/)
    expect(JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8')).statuses['Shield of Faith']).toBeUndefined()
    rmSync(base, { recursive: true, force: true })
  })
  it('即兴无档目标 → 报错退出(写盘需要档),绝不静默', () => {
    const { cwd: rt, base } = rig()
    const improvised = runTool(rt, 'attack', { target: '酒馆老板', attack: 'dagger', ...ATTACK })
    expect(improvised.status).toBe(1)   // 完备律:即兴目标须先 spawn 建档(写盘需要档)
    expect(improvised.stdout).toContain('!查无目标:酒馆老板')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('cast 目标解析咽喉(真实脚本)', () => {
  it('攻击型:目标=玩家名 → AC 17 带档源(旧实现无角色档退化,恒默 10)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'cast', { spell: 'fire-bolt', targets: '梅西雅', context: '梗概' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/vs AC 17\(characters\/player\.json\)/)
    rmSync(base, { recursive: true, force: true })
  })
  it('豁免型:目标=玩家名 → saveBonus 按档算(敏12+熟练PB2=+3),不再静默 0', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'cast', { spell: 'burning-hands', targets: '梅西雅', context: '梗概' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/豁免判定 梅西雅: d20\+3 = \d+ vs DC 13 → (通过|失败)/)
    rmSync(base, { recursive: true, force: true })
  })
  it('豁免型:查无目标 → 报错退出,不再静默 saveBonus 0', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'cast', { spell: 'burning-hands', targets: '路人甲', context: '梗概' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!查无目标存档:路人甲')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('AC 律单源(ui_data 与 attack 同一 deriveAC)', () => {
  it('op=panel hud-left → player.derived.ac=17(鳞甲14+敏1+盾2),与攻击回执同值', () => {
    const { cwd: rt, base } = rig()
    const out = runOp(rt, { op: 'panel', name: 'hud-left' })
    expect(out.ok).toBe(true)
    const player = (out.data as { player: { derived: { ac: number } } }).player
    expect(player.derived.ac).toBe(17)
    rmSync(base, { recursive: true, force: true })
  })
})

// ── 审计批钉(2026-09-28 docs/audit-fixes_zh.md):语术语义分类/收录闸/A2 多目标/读口三缺 ──
describe('审计批:cast 语义分类+收录闸+读口三缺(真实脚本)', () => {
  const pj = (rt: string) => JSON.parse(readFileSync(join(rt, 'characters', 'player.json'), 'utf8'))
  /** rig 扩展:覆写玩家档 + 拷真实法术页(suppress/buff/healMulti/multi-attack 各钉所需)。 */
  function rigAudit(player: Record<string, unknown> = {}, goblin?: Record<string, unknown>) {
    const r = rig()
    writeFileSync(join(r.cwd, 'characters', 'player.json'), JSON.stringify({ ...PLAYER, ...player }))
    if (goblin) writeFileSync(join(r.cwd, 'characters', '哥布林乙.json'), JSON.stringify({ name: '哥布林乙', level: 0.25, ac: 15, hp: 7, hp_max: 7, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, ...goblin }))
    for (const n of ['teleport.md', 'divine-favor.md', 'mass-cure-wounds.md', 'cure-wounds.md', 'scorching-ray.md'])
      cpSync(join(CARD, '..', 'corpus', 'srd-lorebook', 'spells', n), join(r.cwd, 'dnd5e-srd-lorebook', 'spells', n))
    return r
  }
  it('A1:teleport(suppress)伤害面封死——无掷效果显式回执,只有位耗落盘(修复:位移术把队友打掉 21 血)', () => {
    const { cwd: rt, base } = rigAudit({ slots_l7: 1, spells_known: [...PLAYER.spells_known, 'teleport'] })
    const r = runTool(rt, 'cast', { context: '撤', spell: 'teleport', targets: '哥布林乙' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('◇ 无掷效果——效果归叙事/状态工具')
    expect(r.stdout).not.toMatch(/伤害判定/)
    expect(r.stdout).toMatch(/落盘: slots_l7 1→0 \[characters\/player\.json\]/)
    expect(readFileSync(join(rt, 'characters', '哥布林乙.json'), 'utf8')).toContain('"hp":7')
    rmSync(base, { recursive: true, force: true })
  })
  it('A1:divine-favor 骑手重分类——buff 落盘(附伤 mods),零自伤(修复:祝福自己=自伤 3 血)', () => {
    const { cwd: rt, base } = rigAudit({ hp: 20, spells_known: [...PLAYER.spells_known, 'divine-favor'] })
    const r = runTool(rt, 'cast', { context: '祈', spell: 'divine-favor', targets: '梅西雅' })
    expect(r.status).toBe(0)
    expect(r.stdout).not.toMatch(/伤害判定/)
    expect(pj(rt).statuses['Divine Favor']).toMatchObject({ mods: [{ stat: 'damage', magnitude: '1d4' }] })
    expect(pj(rt).hp).toBe(20)
    expect(pj(rt).concentrating).toBe('Divine Favor')
    rmSync(base, { recursive: true, force: true })
  })
  it('A2:mass-cure 群疗逐人独立掷(修复:3 人只治第 1 人);cure-wounds 单疗多填=响亮报错(修复:静默丢弃)', () => {
    const { cwd: rt, base } = rigAudit({ hp: 5, slots_l5: 1, spells_known: [...PLAYER.spells_known, 'mass-cure-wounds', 'cure-wounds'] }, { hp: 3 })
    const r = runTool(rt, 'cast', { context: '群疗', spell: 'mass-cure-wounds', targets: '梅西雅,哥布林乙' })
    expect(r.status).toBe(0)
    expect(r.stdout.match(/治疗判定: /g)?.length).toBe(2)
    expect(r.stdout.match(/落盘: \S+ hp \d+→\d+/g)?.length).toBe(2)
    expect(pj(rt).hp).toBeGreaterThan(5)
    const single = runTool(rt, 'cast', { context: '单疗多填', spell: 'cure-wounds', targets: '梅西雅,哥布林乙' })
    expect(single.status).toBe(1)
    expect(single.stdout).toContain('!Cure Wounds 是单目标治疗法术')
    rmSync(base, { recursive: true, force: true })
  })
  it('A3:收录闸——表外法术拦死(修复:幻觉施法无拦截,spells_known 纯展示)', () => {
    const { cwd: rt, base } = rigAudit()
    const r = runTool(rt, 'cast', { context: '幻觉', spell: 'fireball', targets: '哥布林乙' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!施法者未收录:fireball 不在 玩家 的 spells_known')
    rmSync(base, { recursive: true, force: true })
  })
  it('B3:豁免型抗免+半伤对总额——半伤值再被抗减半(修复:火抗目标吃全额火伤);B1:目标侧 bless 入豁免值', () => {
    const { cwd: rt, base } = rigAudit({ spells_known: PLAYER.spells_known }, { hp: 30, hp_max: 30, resist: ['fire'] })
    // 火抗+无 bless 基线:回执给 arrow 值与 抗性: 减半↓ 行,hp 掉 floor(arrow/2)
    const r = runTool(rt, 'cast', { context: '烧', spell: 'burning-hands', targets: '哥布林乙' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('抗性: 减半↓')
    const arrow = +(/伤害判定: 哥布林乙 3d6=\d+(\+30)?(\(半伤:对总额减半\))? → (\d+)/.exec(r.stdout)?.[3] ?? -1)
    expect(arrow).toBeGreaterThan(0)
    expect(JSON.parse(readFileSync(join(rt, 'characters', '哥布林乙.json'), 'utf8')).hp).toBe(30 - Math.floor(arrow / 2))
    rmSync(base, { recursive: true, force: true })
  })
  it('B1:cast 攻击型/豁免型双通道吃 attack_save(修复:bless 只在武器攻检生放);B2:check 豁免吃 save 类 mods,旧正则通道死透', () => {
    const blessed = { statuses: { Bless: { applied_at: '第 2 轮', effect: '攻/豁 +1d4', mods: [{ stat: 'attack_save', magnitude: '1d4' }] } } }
    const { cwd: rt, base } = rigAudit(blessed)
    const atk = runTool(rt, 'cast', { context: '祝', spell: 'fire-bolt', targets: '哥布林乙' })
    expect(atk.status).toBe(0)
    expect(atk.stdout).toMatch(/状态修正: Bless:1d4=\d+/)
    const sv = runTool(rt, 'cast', { context: '挨', spell: 'burning-hands', targets: '梅西雅' })
    expect(sv.status).toBe(0)
    expect(sv.stdout).toMatch(/状态修正 梅西雅: Bless:1d4=\d+/)
    // check:save mods 生效、旧 effect 正则('dex+2' 文本)不再有机械效果
    const ck = runTool(rt, 'check', { context: '抗', who: '梅西雅', stat: 'dex', save: true, dc: 15 })
    expect(ck.status).toBe(0)
    expect(ck.stdout).toMatch(/修正: dex\+1 · 豁免熟练\+2 · Bless:1d4=\d+/)
    const old = rigAudit({ statuses: { 旧记: { applied_at: '第 1 轮', effect: 'dex+2' } } })
    const ck2 = runTool(old.cwd, 'check', { context: '旧道', who: '梅西雅', stat: 'dex', save: true, dc: 15 })
    expect(ck2.status).toBe(0)
    expect(ck2.stdout).toMatch(/修正: dex\+1 · 豁免熟练\+2\r?\n/m)   // 旧 effect 文本('dex+2')零机械效果——只有检定固有项
    rmSync(old.base, { recursive: true, force: true })
    rmSync(base, { recursive: true, force: true })
  })
  it('A2:scorching-ray 多攻骰逐目标独立攻检+名额校验(FM 补 attack_type 夹具)', () => {
    // 真语料 scorching-ray.md 无 attack_type(FM 洞,勘误候选)——夹具页补上,走多攻骰循环钉
    const { cwd: rt, base } = rigAudit({ slots_l2: 2, spells_known: [...PLAYER.spells_known, 'scorching-ray'] })
    writeFileSync(join(rt, 'dnd5e-srd-lorebook', 'spells', 'scorching-ray.md'), FM('name: Scorching Ray\nlevel: 2\nattack_type: ranged\ndamage_type: fire'))
    const r = runTool(rt, 'cast', { context: '三连射线', spell: 'scorching-ray', targets: '哥布林乙,哥布林乙,哥布林乙' })
    expect(r.status).toBe(0)
    expect(r.stdout.match(/命中判定: 哥布林乙 d20\+\d+ = \d+ vs AC 15/g)?.length).toBe(3)
    const few = runTool(rt, 'cast', { context: '名额不足', spell: 'scorching-ray', targets: '哥布林乙,哥布林乙' })
    expect(few.status).toBe(1)
    expect(few.stdout).toContain('!多弹份额=targets 重复名单:3 发需 3 个名单位')
    const solo = runTool(rt, 'cast', { context: '单攻多填', spell: 'fire-bolt', targets: '哥布林乙,哥布林乙' })
    expect(solo.status).toBe(1)
    expect(solo.stdout).toContain('!Fire Bolt 是单目标攻击型法术')
    rmSync(base, { recursive: true, force: true })
  })
  it('C1:temp_hp 键复活(RAW 独立缓冲池)——模板与出生机出生落 temp_hp:0', () => {
    expect(readFileSync(join(CARD, 'templates', 'character.tpl.json'), 'utf8')).toContain('temp_hp')
    expect(readFileSync(join(CARD, 'scripts', 'opening_commit.mjs'), 'utf8')).toContain('temp_hp')
  })
})
