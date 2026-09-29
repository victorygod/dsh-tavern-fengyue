// dnd5e 一期直写工具钉(2026-09-26):spawn_monster(完备律/同名/查无 statblock/count/presence)、
// damage/heal/hp_change(落盘/钳上限/苏醒双清/0HP 分叉/0HP 受击落败)、death(计数读写)、
// initiative(物化+未建档报错)、gain_exp(foes 战果通道/直值)、check(save/dc 缺省/专注 damage)、pbOf 边界。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const CARD = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')

const PLAYER = { name: '梅西雅', role: 'pc', class: 'wizard', level: 3, exp: 816, hp: 10, hp_max: 22, hd_available: 3, str: 10, dex: 12, con: 12, int: 16, wis: 10, cha: 10, save_prof: ['dex', 'con'], hit_die: 6 }
const GOBLIN_FM = '---\nname: Goblin\ncr: 0.25\nac: 15\nhp: 7\nstr: 8\ndex: 14\ncon: 10\nint: 10\nwis: 8\ncha: 8\n---\n\n正文'
const STATE = ['# 世界状态', '', '## 附近 NPC', '', '## 战斗（宣战物化）', '- （无战斗）', ''].join('\n')

function rig(player = PLAYER) {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-p1-'))
  const cwd = join(base, 'runtime')
  for (const d of ['characters', 'dnd5e-srd-lorebook/monsters', 'dnd5e-srd-lorebook/spells']) mkdirSync(join(cwd, d), { recursive: true })
  cpSync(join(CARD, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  writeFileSync(join(cwd, 'characters', 'player.json'), JSON.stringify(player))
  writeFileSync(join(cwd, 'state.md'), STATE)
  // fixture 专名入 MONSTER_CORE(数据核注入——语料无 grexling,hp 卡值 7 确定性)
  const goblinFake = JSON.parse(JSON.stringify(JSON.parse(readFileSync(join(dirname(cwd), 'preset', 'lib', 'monster-core-data.mjs'), 'utf8').split('export const MONSTER_CORE = ')[1].trim()).goblin))
  goblinFake.cr = 0.25; goblinFake.hp = 7; goblinFake.hp_roll = null; goblinFake.ac = 15
  injectMonsterCore(join(dirname(cwd), 'preset'), 'grexling', goblinFake)
  return { cwd, base }
}

function runTool(runtime: string, tool: string, args: Record<string, unknown>, seed?: number) {
  // seed 可选：core.mjs 的 setSeed 固定 LCG 流——未播种时 rnd 走 Math.random，nat1 等随缘分支让断言 1/20 概率翻红。
  // URL 必须与工具侧 import 完全同路（工具= process.cwd()+'/../preset/lib'，即 base/preset 拷贝件）：
  // 同文件才同 URL 才同模块实例，seed 才打得进工具用的 LCG——此前 prelude 引仓库原件，seed 打在
  // 没人用的实例上，CI mac 2026-09-27 掷出 nat1 即此根因。
  const TOOL_CORE = join(dirname(runtime), 'preset', 'lib', 'core.mjs')
  const prelude = seed === undefined ? '' : `(await import(${JSON.stringify(pathToFileURL(TOOL_CORE).href)})).setSeed(${seed});`
  const code = `globalThis.argv=${JSON.stringify(args)};${prelude}await import(${JSON.stringify(pathToFileURL(join(CARD, 'tools', `${tool}.mjs`)).href)})`
  const rr = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd: runtime, encoding: 'utf8' })
  if (rr.status !== 0) console.error('[tool-fail]', rr.stdout)
  return rr
}
const j = (rt: string, f: string) => JSON.parse(readFileSync(join(rt, 'characters', f), 'utf8'))
// 卡内夹具助手(2026-09-30 批3:数据核注入,卡片测试工具住卡片)
const { injectMonsterCore, injectSpellCore } = await import(pathToFileURL(join(ROOT, 'tavern_presets', 'dnd5e', 'scripts', 'test-fixtures.mjs')).href)

describe('spawn_monster 怪物创建(真实脚本)', () => {
  it('完备律:读卡自动填+presence 行+派生摘要;count 天干批量', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'spawn_monster', { context: '哥布林小队现身', name: '哥布林', count: 2, stance: '敌对', monster_kind: 'grexling' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('[创建 · 哥布林甲 · 敌对]')
    expect(r.stdout).toMatch(/落盘: characters\/哥布林甲\.json 已建档\(kind grexling · level 0\.25 · ac 15 · hp 7/)   // 断档回退:fixture 无 hp_roll=卡值平均
    expect(r.stdout).toMatch(/◇ level 0\.25 → XP 50 · pb \+2/)
    expect(existsSync(join(rt, 'characters', '哥布林甲.json'))).toBe(true)
    expect(j(rt, '哥布林甲.json')).toMatchObject({ name: '哥布林甲', role: 'npc', level: 0.25, ac: 15, hp: 7, hp_max: 7, dex: 14, monster_kind: 'grexling' })
    expect(readFileSync(join(rt, 'state.md'), 'utf8')).toMatch(/- 哥布林乙 \| 敌对\n- 哥布林甲 \| 敌对/)   // 三态行(新登场插节首)
    rmSync(base, { recursive: true, force: true })
  })
  it('同名冲突报错不覆盖;查无 statblock 报错;出生即满血(hp=卡值,无覆盖后门)', () => {
    const { cwd: rt, base } = rig()
    const dup = runTool(rt, 'spawn_monster', { context: 'x', name: '梅西雅', stance: '敌对', monster_kind: 'goblin'  })
    expect(dup.status).toBe(1)
    expect(dup.stdout).toContain('!同名已存在:梅西雅')
    const miss = runTool(rt, 'spawn_monster', { context: 'x', name: '幻影', stance: '敌对', monster_kind: 'nonexistent'  })
    expect(miss.status).toBe(1)
    expect(miss.stdout).toContain('!查无 statblock:monsters/nonexistent.md')
    rmSync(base, { recursive: true, force: true })
  })
})

describe('damage/heal/hp_change 生命直改三件套(真实脚本)', () => {
  it('damage 落盘+0HP 分叉(PC 濒死起算)', () => {
    const { cwd: rt, base } = rig()
    const r = runTool(rt, 'damage', { context: '陷阱激射', dice: '2d6+99', target: '梅西雅', type: 'piercing' })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/落盘: hp 10→0 \[characters\/player\.json\]/)
    expect(r.stdout).toContain('0HP——濒死计数起算')
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
  it('hp_change 0HP 负改=受伤同律:败+1(修复静默 no-op)', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, death_fail: 1 })
    const r = runTool(rt, 'hp_change', { context: '旧伤崩裂', target: '梅西雅', amount: -1 })
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/death_fail 1→2/)
    expect(j(rt, 'player.json').death_fail).toBe(2)
    rmSync(base, { recursive: true, force: true })
  })
  it('稳定者挨打=稳定打破重开濒死(success 双清,败+1)', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, death_success: 3 })
    const r = runTool(rt, 'damage', { context: '落石再砸', dice: '1d6+50', target: '梅西雅' })
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('稳定打破(重开濒死)')
    expect(j(rt, 'player.json')).toMatchObject({ death_success: 0, death_fail: 1 })
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
  it('掷全团+战斗节落盘(参战名单化,不滤敌我)', () => {
    const { cwd: rt, base } = rig()
    runTool(rt, 'spawn_monster', { context: 'x', name: '哥布林甲', stance: '敌对', monster_kind: 'goblin'  })
    const r = runTool(rt, 'initiative', { context: '接战', combatants: '梅西雅,哥布林甲' })
    expect(r.status).toBe(0)
    const md = readFileSync(join(rt, 'state.md'), 'utf8')
    expect(md).toMatch(/- 回合：1/)
    expect(md).toMatch(/- 先攻：(梅西雅|哥布林甲):\d+ > (梅西雅|哥布林甲):\d+/)
    expect(md).toMatch(/- 参战行：哥布林甲/)
    expect(md).toMatch(/- 参战行：梅西雅/)
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
    runTool(rt, 'spawn_monster', { context: 'x', name: '哥布林', count: 2, stance: '敌对', monster_kind: 'goblin' })
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
  it('级联 L1/L5 执行:rogue 6 级无 ASI;paladin 半施法位表;warlock 魔契整池上移', () => {
    const r1 = rig({ ...PLAYER, class: 'rogue', level: 5, exp: 6500, hit_die: 8 })
    runTool(r1.cwd, 'gain_exp', { context: 'x', who: '梅西雅', exp: 7500 })
    expect(j(r1.cwd, 'player.json').pending ?? []).not.toContain('LV6·ASI 点选')
    rmSync(r1.base, { recursive: true, force: true })
    const r2 = rig({ ...PLAYER, class: 'paladin', level: 1, exp: 300, hit_die: 10 })
    runTool(r2.cwd, 'gain_exp', { context: 'x', who: '梅西雅', exp: 6200 })
    expect(j(r2.cwd, 'player.json')).toMatchObject({ slots_l1: 4, slots_l2: 2 })
    rmSync(r2.base, { recursive: true, force: true })
    const r3 = rig({ ...PLAYER, class: 'warlock', level: 2, exp: 300, hit_die: 8 })
    runTool(r3.cwd, 'gain_exp', { context: 'x', who: '梅西雅', exp: 600 })
    expect(j(r3.cwd, 'player.json')).toMatchObject({ slots_l2: 2 })
    rmSync(r3.base, { recursive: true, force: true })
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
  const MISSILE = '---\nname: Test Missile\nlevel: 1\ndamage: 3d4+90\n---\n\n正文'
  const HEALFM = '---\nname: Test Heal\nlevel: 1\nheal: 1d8+40\n---\n\n正文'
  const TOUCH = '---\nname: Test Touch\nlevel: 1\nattack_type: melee\ndamage: 1d6\n---\n\n正文'
  function rigCaster() {
    const r = rig({ ...PLAYER, caster_attr: 'int', slots_l1: 4, concentrating: 'bless', spells_known: ['test-hex', 'test-heal', 'test-missile'] })
    const parseFm = (md: string) => { const m = /^---\n([\s\S]*?)\n---/.exec(md)!; const fm: Record<string, unknown> = {}; let cur: string | null = null
      for (const line of m[1].split('\n')) { const li = /^  - (.*)$/.exec(line); const kv = /^([a-z_]+):\s*(.*)$/.exec(line)
        if (li && cur) { fm[cur] = [...(fm[cur] as unknown[] ?? []), li[1]]; continue }
        if (kv) { cur = kv[1]; const v = kv[2]; fm[kv[1]] = v === 'true' ? true : v === 'false' ? false : (/^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v) } } return fm }
    injectSpellCore(join(dirname(r.cwd), 'preset'), 'test-hex', parseFm(HEX))
    injectSpellCore(join(dirname(r.cwd), 'preset'), 'test-missile', parseFm(MISSILE))
    injectSpellCore(join(dirname(r.cwd), 'preset'), 'test-heal', parseFm(HEALFM))
    return r
  }
  it('attack 语料表路径:怪照攻击名取骰(哥布林乙砍玩家)', () => {
    const { cwd: rt, base } = rig()
    runTool(rt, 'spawn_monster', { context: 'x', name: '哥布林', count: 2, stance: '敌对', monster_kind: 'goblin' })
    // seed 2 → d20=8: scimitar +4 → 12 vs AC 11 命中;1d6+2 ∈ 3..8,玩家 hp 10 不至 0
    const r = runTool(rt, 'attack', { context: '夜袭', who: '哥布林乙', target: '梅西雅', attack: 'scimitar' }, 2)
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/伤害判定: 1d6\+2=\d+ = \d+ slashing/)
    expect(r.stdout).toMatch(/落盘: 梅西雅 hp 10→[2-7] \[characters\/player\.json\]/)
    rmSync(base, { recursive: true, force: true })
  })
  it('attack 濒死自动暴击(表路径):reach5 咬击 2d4+2 翻 4d4+2,败+2,三败判词', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, death_fail: 1 })
    cpSync(join(CARD, '..', 'corpus', 'srd-lorebook', 'monsters', 'wolf.md'), join(rt, 'dnd5e-srd-lorebook', 'monsters', 'wolf.md'))
    runTool(rt, 'spawn_monster', { context: 'x', name: '狼', stance: '敌对', monster_kind: 'wolf'  })
    const r = runTool(rt, 'attack', { context: '狼牙锁喉', who: '狼', target: '梅西雅', attack: 'bite' }, 2)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('4d4+2')
    expect(r.stdout).toContain('濒死败+2(濒死·5尺自动暴击)')
    expect(r.stdout).toContain('death_fail 1→3')
    expect(r.stdout).toContain('三败——死亡(终局)')
    rmSync(base, { recursive: true, force: true })
  })
  it('attack 出生登记+长触及 beyond_5ft:5 尺外不自动暴击,败+1', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, death_fail: 1 })
    runTool(rt, 'spawn_monster', { context: 'x', name: '大蜥蜴', stance: '敌对', monster_kind: 'goblin', attacks: ['bite|melee|+4|2d4+2|piercing|10'] })
    const r = runTool(rt, 'attack', { context: '十尺外甩尾', who: '大蜥蜴', target: '梅西雅', attack: 'bite', beyond_5ft: true }, 2)
    expect(r.status).toBe(0)
    expect(r.stdout).toContain('濒死败+1')
    expect(r.stdout).toContain('death_fail 1→2')
    expect(r.stdout).not.toContain('濒死·5尺自动暴击')
    rmSync(base, { recursive: true, force: true })
  })
  it('attack 出生定伤必落:怪 0HP 即死', () => {
    const { cwd: rt, base } = rig()
    cpSync(join(CARD, '..', 'corpus', 'srd-lorebook', 'monsters', 'commoner.md'), join(rt, 'dnd5e-srd-lorebook', 'monsters', 'commoner.md'))
    runTool(rt, 'spawn_monster', { context: 'x', name: '蜥蜴人', stance: '敌对', monster_kind: 'goblin', attacks: ['bite|melee|+4|1d10+9|piercing|5'] })
    runTool(rt, 'spawn_monster', { context: 'x', name: '路人甲', stance: '敌对', monster_kind: 'commoner'  })
    const r = runTool(rt, 'attack', { context: '一口定音', who: '蜥蜴人', target: '路人甲', attack: 'bite' }, 2)
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/落盘: 路人甲 hp \d→0 \[characters\/路人甲\.json\]/)   // commoner hp=1d8-4 掷,上限 4
    expect(r.stdout).toContain('0HP——即死')
    rmSync(base, { recursive: true, force: true })
  })
  it('attack 表外攻击名响亮报错', () => {
    const { cwd: rt, base } = rig()
    runTool(rt, 'spawn_monster', { context: 'x', name: '哥布林甲', stance: '敌对', monster_kind: 'goblin'  })
    const r = runTool(rt, 'attack', { context: 'x', who: '哥布林甲', target: '梅西雅', attack: 'nope' })
    expect(r.status).toBe(1)
    expect(r.stdout).toContain('!攻击名查不到:nope')
    rmSync(base, { recursive: true, force: true })
  })
  it('cast 豁免型:位检落盘+专注 RAW 覆写(顶替 bless)', () => {
    const { cwd: rt, base } = rigCaster()
    runTool(rt, 'spawn_monster', { context: 'x', name: '哥布林甲', stance: '敌对', monster_kind: 'goblin'  })
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
  it('cast 治疗型内联(钳上限+苏醒双清)与 FM-only 伤害面的收窄(2026-09-28 审计批:自动伤害仅表内显式 bolts)', () => {
    const { cwd: rt, base } = rigCaster()
    runTool(rt, 'hp_change', { context: 'x', target: '梅西雅', amount: -99 })
    const cure = runTool(rt, 'cast', { context: '疗伤术', spell: 'test-heal', targets: '梅西雅' })
    expect(cure.status).toBe(0)
    expect(cure.stdout).toMatch(/治疗判定: 梅西雅 1d8\+40/)
    expect(cure.stdout).toMatch(/落盘: 梅西雅 hp 0→22\(钳上限\) · 濒死计数双清/)
    // test-missile 仅 FM.damage 无表内 bolts——旧实现走自动伤害(fm 兜底),现为「无掷效果」显式回执(位仍耗)
    const bolt = runTool(rt, 'cast', { context: '飞弹齐射', spell: 'test-missile', targets: '梅西雅' })
    expect(bolt.status).toBe(0)
    expect(bolt.stdout).toContain('◇ 无掷效果——效果归叙事/状态工具')
    expect(bolt.stdout).not.toMatch(/伤害判定/)
    expect(bolt.stdout).toMatch(/落盘: slots_l1 3→2/)
    expect(j(rt, 'player.json').hp).toBe(22)
    rmSync(base, { recursive: true, force: true })
  })
  it('cast 攻击型(触及)打濒死目标=自动暴击:骰翻倍+败+2+三败判词', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, death_fail: 1, caster_attr: 'int', slots_l1: 4, spells_known: ['test-touch'] })
    injectSpellCore(join(dirname(rt), 'preset'), 'test-touch', { name: 'Test Touch', level: 1, attack_type: 'melee', damage: '1d6' })
    const r = runTool(rt, 'cast', { context: '失能之触', spell: 'test-touch', targets: '梅西雅' }, 2)
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/2d6 = \d+ \(濒死自动暴击·翻骰\)/)
    expect(r.stdout).toContain('death_fail 1→3')
    expect(r.stdout).toContain('三败——死亡(终局)')
    expect(j(rt, 'player.json').death_fail).toBe(3)
    rmSync(base, { recursive: true, force: true })
  })
  it('选骰语料表:火球升环自动(8d6+Δ)/治疗属性内算/飞弹弹数展开;dice=逃生舱', () => {
    const { cwd: rt, base } = rig({ ...PLAYER, hp: 0, caster_attr: 'int', slots_l1: 4, slots_l5: 1, spells_known: ['fireball', 'cure-wounds', 'magic-missile'] })
    for (const n of ['fireball.md', 'cure-wounds.md', 'magic-missile.md']) cpSync(join(CARD, '..', 'corpus', 'srd-lorebook', 'spells', n), join(rt, 'dnd5e-srd-lorebook', 'spells', n))
    cpSync(join(CARD, '..', 'corpus', 'srd-lorebook', 'monsters', 'ogre.md'), join(rt, 'dnd5e-srd-lorebook', 'monsters', 'ogre.md'))
    runTool(rt, 'spawn_monster', { context: 'x', name: '食人魔', stance: '敌对', monster_kind: 'ogre'  })
    const ogreHp0 = j(rt, '食人魔.json').hp   // spawn hp=语料骰式掷(hp_roll),相对断言
    const fb = runTool(rt, 'cast', { context: '五环火球', spell: 'fireball', targets: '食人魔', as_level: 5 })
    expect(fb.status).toBe(0)
    expect(fb.stdout).toContain('10d6')
    expect(fb.stdout).toMatch(/slots_l5 1→0/)
    const cw = runTool(rt, 'cast', { context: '疗伤', spell: 'cure-wounds', targets: '梅西雅' })
    expect(cw.status).toBe(0)
    expect(cw.stdout).toMatch(/治疗判定: 梅西雅 1d8 掷 \d+ \+ 3 = \d+/)
    expect(cw.stdout).toContain('已苏醒')
    const mm = runTool(rt, 'cast', { context: '飞弹', spell: 'magic-missile', targets: '食人魔,食人魔,食人魔' })
    expect(mm.status).toBe(0)
    expect(mm.stdout.match(/1d4\+1 = \d+\(自动命中\)/g)?.length).toBe(3)
    expect(j(rt, '食人魔.json').hp).toBeLessThan(ogreHp0)
    rmSync(base, { recursive: true, force: true })
  })
})
