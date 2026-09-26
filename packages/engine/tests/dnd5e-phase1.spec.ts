// dnd5e 一期直写工具钉(2026-09-26):spawn_npc(完备律/同名/from 镜像/count/presence)、
// damage/heal/hp_change(落盘/钳上限/苏醒双清/0HP 分叉/0HP 受击落败)、death(计数读写)、
// initiative(物化+未建档报错)、gain_exp(foes 战果通道/直值)、check(save/dc 缺省/专注 damage)、pbOf 边界。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const PLAYER = { name: '梅西雅', role: 'pc', class: 'wizard', level: 3, exp: 816, hp: 10, hp_max: 22, hd_available: 3, str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10, save_prof: ['dex', 'con'], hit_die: 6 }
const GOBLIN_FM = '---\nname: Goblin\ncr: 0.25\nac: 15\nhp: 7\nstr: 8\ndex: 14\ncon: 10\nint: 10\nwis: 8\ncha: 8\n---\n\n正文'
const STATE = ['# 世界状态', '', '## 附近 NPC', '', '## 战斗（宣战物化）', '- （无战斗）', '', '## 上回合变化', '- （无）', ''].join('\n')

function rig(player = PLAYER) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-p1-'))
  const cwd = join(base, 'runtime')
  for (const d of ['characters', 'dnd5e-srd-lorebook/monsters', 'dnd5e-srd-lorebook/spells']) mkdirSync(join(cwd, d), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(player))
  writeFileSync(join(cwd, 'state.md'), STATE)
  writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'monsters', 'goblin.md'), GOBLIN_FM)
  return { cwd, base }
}

function runTool(runtime: string, tool: string, args: Record<string, unknown>) {
  const code = `globalThis.argv=${JSON.stringify(args)};await import(${JSON.stringify(join(CARD, 'tools', `${tool}.mjs`))})`
  return spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
}
const j = (rt: string, f: string) => JSON.parse(readFileSync(join(rt, 'characters', f), 'utf8'))

describe('spawn_npc 角色创建(真实脚本)', () => {
  it('完备律:建档+presence 行+派生摘要;count 天干批量', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_npc', { context: '哥布林小队现身', name: '哥布林', stance: '敌对', level: 0.25, ac: 15, hp: 7, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, count: 2, from: 'monsters/goblin.md' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('[创建 · 哥布林甲 · 敌对]')
    expect(r.stdout).toMatch(/落盘: characters\/哥布林甲\.json 已建档\(level 0\.25 · ac 15 · hp 7\)/)
    expect(r.stdout).toMatch(/◇ level 0\.25 → XP 50 · pb \+2/)
    expect(existsSync(join(rt, 'characters', '哥布林甲.json'))).toBe(true)
    expect(j(rt, '哥布林甲.json')).toMatchObject({ name: '哥布林甲', role: 'npc', level: 0.25, ac: 15, hp: 7, hp_max: 7, dex: 14, path: 'monsters/goblin.md' })
    expect(readFileSync(join(rt, 'state.md'), 'utf8')).toMatch(/- 哥布林甲 \| 敌对/)
    rmSync(base, { recursive: true, force: true })
  })
  it('同名冲突报错不覆盖;必填缺失报错;from 镜像不符列差异', () => {
    const { cwd: rt, base } = rig()
    const dup = runTool(rt, 'spawn_npc', { context: 'x', name: '梅西雅', stance: '中立', level: 1, ac: 10, hp: 4, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
    expect(dup.status).toBe(1)
    expect(dup.stdout).toContain('!同名已存在:梅西雅')
    const miss = runTool(rt, 'spawn_npc', { context: 'x', name: '路人', stance: '中立', ac: 10, hp: 4, str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 })
    expect(miss.status).toBe(1)
    expect(miss.stdout).toContain('缺必填 level')
    const bad = runTool(rt, 'spawn_npc', { context: 'x', name: '畸变体', stance: '敌对', level: 0.25, ac: 12, hp: 7, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, from: 'monsters/goblin.md' })
    expect(bad.status).toBe(1)
    expect(bad.stdout).toContain('!from 校验不符')
    expect(bad.stdout).toContain('ac 卡=15≠传12')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('damage/heal/hp_change 生命直改三件套(真实脚本)', () => {
  it('damage 落盘+0HP 分叉(PC 濒死起算)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'damage', { context: '陷阱激射', dice: '2d6+99', target: '梅西雅', type: 'piercing' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/落盘: hp 10→0 \[characters\/player\.json\]/)
    expect(r.stdout).toContain('0HP——PC/同伴:濒死计数起算')
    expect(j(rt, 'player.json').hp).toBe(0)
    rmSync(base, { recursive: true, force: true })
  })
  it('damage 0HP 受击 → death_fail 自动+1;抗性减半走档', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, death_fail: 1, resist: ['fire'] })
    const r = runTool(rt, 'damage', { context: '火场灼烧', dice: '1d6+95', target: '梅西雅', type: 'fire' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/death_fail 1→2/)
    expect(j(rt, 'player.json').death_fail).toBe(2)
    rmSync(base, { recursive: true, force: true })
  })
  it('heal 钳上限;0HP 苏醒+濒死计数双清', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, death_success: 1, death_fail: 2 })
    const r = runTool(rt, 'heal', { context: '药水回魂', dice: '1d4+50', target: '梅西雅' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/hp 0→22\(钳上限\) · 濒死计数双清/)
    expect(j(rt, 'player.json')).toMatchObject({ hp: 22, death_success: 0, death_fail: 0 })
    rmSync(base, { recursive: true, force: true })
  })
  it('hp_change 直改(负向 0HP 分叉)与 full 回满;二选一校验', () => {
    const { cwd: rt, base } = rig()
    const neg = runTool(rt, 'hp_change', { context: '旧伤崩裂', target: '梅西雅', amount: -12 })
    expect(neg.status).toBe(0)
    expect(neg.stdout).toMatch(/hp 10→0\(-12\)/)
    const full = runTool(rt, 'hp_change', { context: '营地长憩', target: '梅西雅', full: true })
    expect(full.status).toBe(0)
    expect(full.stdout).toMatch(/hp 0→22\(回满\)/)
    const none = runTool(rt, 'hp_change', { context: 'x', target: '梅西雅' })
    expect(none.status).toBe(1)
    expect(none.stdout).toContain('缺 amount')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('death 濒死计数读写(真实脚本)', () => {
  it('计数读档→掷→落盘新值(零转录)', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, death_fail: 2 })
    const r = runTool(rt, 'death', { context: '濒死挣扎' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/濒死判定: raw d20 = \d+（(nat20|nat1 双败|成功\+1|失败\+1)）→ 成 \d\/败 \d/)
    expect(r.stdout).toMatch(/落盘: (hp 0→1 · 濒死计数双清|death_(success|fail) \d→\d+)/)
    rmSync(base, { recursive: true, force: true })
  })
  it('计数已满不再掷', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, death_fail: 3 })
    const r = runTool(rt, 'death', { context: 'x' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!计数已满')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('initiative 开战物化(真实脚本)', () => {
  it('掷全团+战斗节落盘(敌行从 presence 敌对∩参战物化)', () => {
    const { cwd: rt, base } = rig()
    runTool(rt, 'spawn_npc', { context: 'x', name: '哥布林甲', stance: '敌对', level: 0.25, ac: 15, hp: 7, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, from: 'monsters/goblin.md' })
    const r = runTool(rt, 'initiative', { context: '接战', combatants: '梅西雅,哥布林甲' })
    expect(r.status).toBe(0)
    const md = readFileSync(join(rt, 'state.md'), 'utf8')
    expect(md).toMatch(/- 回合：1/)
    expect(md).toMatch(/- 先攻：(梅西雅|哥布林甲):\d+ > (梅西雅|哥布林甲):\d+/)
    expect(md).toMatch(/- 敌行：哥布林甲 \| path:monsters\/goblin\.md/)
    rmSync(base, { recursive: true, force: true })
  })
  it('未建档报错逼 spawn(临时单位转写通道已废)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'initiative', { context: 'x', combatants: '梅西雅,路人甲' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!未建档:路人甲')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('gain_exp 战果通道(真实脚本)', () => {
  it('foes 查表求和均分+落盘(乘数不进发放);直值通道', () => {
    const { cwd: rt, base } = rig()
    runTool(rt, 'spawn_npc', { context: 'x', name: '哥布林', stance: '敌对', level: 0.25, ac: 15, hp: 7, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8, count: 2 })
    const r = runTool(rt, 'gain_exp', { context: '战毕结算', who: '梅西雅', foes: '哥布林甲,哥布林乙' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/战果: 50\+50 = 100 XP ÷ 1 人 → 100\/人（乘数不进发放）/)
    expect(r.stdout).toMatch(/落盘: 梅西雅 exp 816→916/)
    expect(j(rt, 'player.json').exp).toBe(916)
    const direct = runTool(rt, 'gain_exp', { context: '探索发现', who: '梅西雅', exp: 50 })
    expect(direct.status).toBe(0)
    expect(j(rt, 'player.json').exp).toBe(966)
    rmSync(base, { recursive: true, force: true })
  })
  it('exp 与 foes 互斥;无成长面拒入名单;查无亡档给出路', () => {
    const { cwd: rt, base } = rig()
    const both = runTool(rt, 'gain_exp', { context: 'x', who: '梅西雅', exp: 10, foes: 'a' })
    expect(both.status).toBe(1)
    expect(both.stdout).toContain('!exp 与 foes 二选一')
    const ghost = runTool(rt, 'gain_exp', { context: 'x', who: '梅西雅', foes: '已删的怪' })
    expect(ghost.status).toBe(1)
    expect(ghost.stdout).toContain('!查无被击败者档案:已删的怪')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('check 判定件(真实脚本)', () => {
  it('豁免:修正含豁免熟练(save_prof 缺口闭合);对抗 dc 缺省只报总值;专注 damage 入口 DC 内算', () => {
    const { cwd: rt, base } = rig()
    const save = runTool(rt, 'check', { context: '毒侵', who: '梅西雅', stat: 'con', save: true, dc: 13 })
    expect(save.status).toBe(0)
    expect(save.stdout).toMatch(/修正: con\+1 · 豁免熟练\+2/)
    const contest = runTool(rt, 'check', { context: '擒抱', who: '梅西雅', skill: 'acrobatics' })
    expect(contest.status).toBe(0)
    expect(contest.stdout).toMatch(/——无 DC,与对侧比大小/)
    const focus = runTool(rt, 'check', { context: '箭雨护法', who: '梅西雅', damage: 12 })
    expect(focus.status).toBe(0)
    expect(focus.stdout).toMatch(/vs 专注维持 DC10\(=max\(10,⌊12\/2⌋\)\)/)
    expect(focus.stdout).toMatch(/修正: con\+1 · 豁免熟练\+2/)
    rmSync(base, { recursive: true, force: true })
  })
  it('pbOf 边界:level 21(高 CR 怪)豁免熟练 +7——旧 pb 的 20 封顶已修', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, level: 21, save_prof: ['con'] })
    const r = runTool(rt, 'check', { context: 'x', who: '梅西雅', stat: 'con', save: true, dc: 20 })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/豁免熟练\+7/)
    rmSync(base, { recursive: true, force: true })
  })
})

describe('attack/cast 当拍写盘(真实脚本)', () => {
  const HEX = '---\nname: Test Hex\nlevel: 1\nsave: dex\ndamage: 1d6\nconcentration: true\n---\n\n正文'
  const MISSILE = '---\nname: Test Missile\nlevel: 1\n---\n\n正文'
  function rigCaster() {
    const r = rig({ ...PLAYER, caster_attr: 'int', slots_l1: 4, concentrating: 'bless' })
    writeFileSync(join(r.cwd, 'dnd5e-srd-lorebook', 'spells', 'test-hex.md'), HEX)
    writeFileSync(join(r.cwd, 'dnd5e-srd-lorebook', 'spells', 'test-missile.md'), MISSILE)
    return r
  }
  it('attack 命中→hp 落盘+0HP 分叉(怪)', () => {
    const { cwd: rt, base } = rig()
    runTool(rt, 'spawn_npc', { context: 'x', name: '哥布林甲', stance: '敌对', level: 0.25, ac: 15, hp: 7, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 })
    const r = runTool(rt, 'attack', { context: '必中一击', who: '梅西雅', target: '哥布林甲', modifier: 20, dice: '1d6+50', type: 'piercing' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/落盘: 哥布林甲 hp 7→0 \[characters\/哥布林甲\.json\]/)
    expect(r.stdout).toContain('0HP——怪:RAW 默认即死,死活你判')
    expect(j(rt, '哥布林甲.json').hp).toBe(0)
    rmSync(base, { recursive: true, force: true })
  })
  it('cast 豁免型:位检落盘+专注 RAW 覆写(顶替 bless)', () => {
    const { cwd: rt, base } = rigCaster()
    runTool(rt, 'spawn_npc', { context: 'x', name: '哥布林甲', stance: '敌对', level: 0.25, ac: 15, hp: 7, str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 })
    const r = runTool(rt, 'cast', { context: '诅咒之链', spell: 'test-hex', targets: '哥布林甲' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('位检:✓(slots_l1 剩 4)')
    expect(r.stdout).toContain('专注:顶替旧专注「bless」→Test Hex(RAW 覆写,自动弃旧)')
    expect(r.stdout).toMatch(/落盘: slots_l1 4→3 \[characters\/player\.json\]/)
    expect(r.stdout).toMatch(/落盘: concentrating bless→Test Hex \[characters\/player\.json\]/)
    expect(r.stdout).toMatch(/豁免判定 哥布林甲: d20\+2 = \d+ vs DC 13/)
    expect(j(rt, 'player.json')).toMatchObject({ slots_l1: 3, concentrating: 'Test Hex' })
    rmSync(base, { recursive: true, force: true })
  })
  it('cast 治疗型内联(restore:钳上限+苏醒双清)与自动型(dice 直落,路由律禁接龙)', () => {
    const { cwd: rt, base } = rigCaster()
    runTool(rt, 'hp_change', { context: 'x', target: '梅西雅', amount: -99 })
    const cure = runTool(rt, 'cast', { context: '疗伤术', spell: 'test-missile', restore: true, dice: '1d8+50', targets: '梅西雅' })
    expect(cure.status).toBe(0)
    expect(cure.stdout).toMatch(/落盘: 梅西雅 hp 0→22\(钳上限\) · 濒死计数双清/)
    const bolt = runTool(rt, 'cast', { context: '飞弹齐射', spell: 'test-missile', dice: '3d4+90', targets: '梅西雅' })
    expect(bolt.status).toBe(0)
    expect(bolt.stdout).toMatch(/伤害判定: 梅西雅 3d4\+90 = \d+\(自动命中\)/)
    expect(bolt.stdout).toMatch(/落盘: 梅西雅 hp 22→0/)
    expect(j(rt, 'player.json').hp).toBe(0)
    rmSync(base, { recursive: true, force: true })
  })
})
