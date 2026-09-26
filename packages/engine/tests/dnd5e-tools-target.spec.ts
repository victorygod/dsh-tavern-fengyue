// dnd5e 目标结算解析咽喉钉(2026-09-25):玩家名→player.json 的 name 兜底、敌行优先、
// 查无报错不涂默认、ac 转写逃生舱、豁免目标按档算加值、AC 律单源(ui_data 同 17)。
// 事故锚:梅西雅存 characters/player.json,attack 旧手写 existsSync('characters/梅西雅.json')
// 落空 → AC 静默留 10(实测 vs AC 10 命中,应为 17=鳞甲14+敏1+盾2)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const PLAYER = {  // 鳞甲+盾+敏12 → AC 17;wizard L3(int16) → DC 13、PB 2
  name: '梅西雅', class: 'wizard', level: 3, dex: 12, int: 16,
  armor: 'scale-mail', shield: true, caster_attr: 'int', slots_l1: 4,
  save_prof: ['dex'], spells_known: [],
}
const STATE = [
  '## 战斗（宣战物化：回合/先攻/敌行——行只记 名|path|状态）',
  '- 回合：2',
  '- 先攻：哥布林乙:15 > 梅西雅:13',
  '- 敌行：哥布林乙 | path:monsters/goblin.md | 四分掩体（拐角+岩壁）',
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
  writeFileSync(join(cwd, 'characters', '哥布林乙.json'), JSON.stringify({ name: '哥布林乙', level: 0.25, ac: 15, hp: 7, hp_max: 7, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 }))
  writeFileSync(join(cwd, 'state.md'), STATE)
  writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'equipment', 'scale-mail.md'), SCALE_MAIL)
  writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'monsters', 'goblin.md'), GOBLIN)
  for (const [slug, md] of Object.entries(SPELLS)) writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'spells', `${slug}.md`), md)
  return { cwd, base }
}

function runTool(runtime: string, tool: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(join(CARD, 'tools', `${tool}.mjs`))})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
}

function runOp(runtime: string, op: Record<string, unknown>): Record<string, unknown> {
  const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(op))}];await import(${JSON.stringify(join(CARD, 'scripts', 'ui_data.mjs'))})`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ui_data ${JSON.stringify(op)} exit ${r.status}: ${r.stderr.slice(0, 400)}`)
  return JSON.parse(r.stdout.trim().split('\n').filter(Boolean).pop() ?? '')
}

const ATTACK = { weapon: 'shortbow', modifier: 4, dice: '1d6+2', type: 'piercing', mode: 'normal', cover_bonus: 0, context: '梗概' }

describe('attack 目标解析咽喉(真实脚本)', () => {
  it('事故锚:目标=玩家名,档存 player.json → name 兜底命中,AC 17 带档源标记(不再默 10)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'attack', { who: '哥布林乙', target: '梅西雅', ...ATTACK })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/vs AC 17\(characters\/player\.json\)/)
    expect(r.stdout).not.toMatch(/vs AC 10/)
    rmSync(base, { recursive: true, force: true })
  })
  it('目标=敌行名 → 数值走档(敌行瘦身后行不落数值),来源标档', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'attack', { target: '哥布林乙', ...ATTACK })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/vs AC 15\(characters\/哥布林乙\.json\)/)
    rmSync(base, { recursive: true, force: true })
  })
  it('查无目标且未传 ac → 报错退出,绝不静默涂 10', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'attack', { target: '路人甲', ...ATTACK })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!查无目标 AC:路人甲')
    rmSync(base, { recursive: true, force: true })
  })
  it('ac 转写逃生舱:传 ac 用直值标「转写」——有档目标(弃盾剧情)与即兴无档目标皆可', () => {
    const { cwd: rt, base } = rig()
    const dropped = runTool(rt, 'attack', { target: '梅西雅', ac: 15, ...ATTACK })
    expect(dropped.status).toBe(0)
    expect(dropped.stdout).toMatch(/vs AC 15\(转写\)/)
    const improvised = runTool(rt, 'attack', { target: '酒馆老板', ac: 12, ...ATTACK })
    expect(improvised.status).toBe(1)   // 完备律:即兴目标须先 spawn_npc(写盘需要档),ac 转写仅限有档目标的剧情态覆盖
    expect(improvised.stdout).toContain('!即兴目标无档:酒馆老板')
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
