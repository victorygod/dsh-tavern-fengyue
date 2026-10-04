// dnd5e 开局生成器集成钉(真实脚本,临时树;2026-09-25 用户令:开局 roll 要丰富、有逻辑、对照 SRD):
// opening_data → meta 下发(技能白名单现场解析/子职清单/法术池;2026-09-29b +逐级施法面/slotMax);
// opening_commit → 技能白名单+选数校验、施法者出生即满(RAW L1)、warlock 归施法族、L1 子职、训练面出生、
// 特征回充时机按表(非池 |—)、中文 description/回执透明(rolled);2026-09-29b +等级入参(High-level
// 成长族出生:exp/hd/满血/特征累积/位表整档 + ASI 挂.pending 玩家面板点选——NPC 侧 spawn_npc 同律)。
import { spawnSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync, readdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const SETUP = join(ROOT, 'tavern_presets', 'dnd5e', 'preset')
const LORE = join(SETUP, 'setup', 'dnd5e-srd-lorebook')   // 语料真身在 preset/setup/ 下(部署整体拷 runtime)
const OPENINGS = join(SETUP, 'setup', 'openings.json')

/** 临时运行树:cwd=runtime(与 preset/ 同层——脚本相对引用 ../preset/lib;语料取真身)。 */
function rig(spellsOrOpts: Record<string, unknown> | { spells?: Record<string, string> } = {}) {
  // 兼容两种调用:直接给 spells 映射(本文件惯例)或 { spells } 选项对象
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-opening-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(cwd, 'dnd5e-srd-lorebook', 'classes'), { recursive: true })
  mkdirSync(join(cwd, 'dnd5e-srd-lorebook', 'races'), { recursive: true })
  mkdirSync(join(cwd, 'dnd5e-srd-lorebook', 'spells'), { recursive: true })
  cpSync(join(SETUP, 'lib'), join(base, 'preset', 'lib'), { recursive: true })
  miniSpellCore((spellsOrOpts as { spells?: Record<string, string> })?.spells ?? (spellsOrOpts as Record<string, string>), base)
  cpSync(OPENINGS, join(cwd, 'openings.json'))
  cpSync(join(SETUP, 'setup', 'state.md'), join(cwd, 'state.md'))
  // 语料:CLASS_CORE/RACE_CORE/SPELL_CORE 数据核随 lib 拷贝(smdui)——runtime 零 lorebook
  const spells = (spellsOrOpts as { spells?: Record<string, string> })?.spells ?? (spellsOrOpts as Record<string, string>)
  for (const [slug, fm] of Object.entries(spells)) writeFileSync(join(cwd, 'dnd5e-srd-lorebook', 'spells', `${slug}.md`), fm)
  return { cwd, base }
}

const SPELLS = {
  'magic-missile': '---\nname: Magic Missile\nlevel: 1\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'shield': '---\nname: Shield\nlevel: 1\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'sleep': '---\nname: Sleep\nlevel: 1\nclasses:\n  - Bard\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'detect-magic': '---\nname: Detect Magic\nlevel: 1\nritual: true\nclasses:\n  - Cleric\n  - Druid\n  - Wizard\n---\n\nx',
  'cure-wounds': '---\nname: Cure Wounds\nlevel: 1\nclasses:\n  - Bard\n  - Cleric\n  - Druid\n---\n\nx',
  'bless': '---\nname: Bless\nlevel: 1\nclasses:\n  - Cleric\n  - Paladin\n---\n\nx',
  'thunderwave': '---\nname: Thunderwave\nlevel: 1\nclasses:\n  - Bard\n  - Druid\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'burning-hands': '---\nname: Burning Hands\nlevel: 1\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'grease': '---\nname: Grease\nlevel: 1\nclasses:\n  - Wizard\n---\n\nx',
  'silent-image': '---\nname: Silent Image\nlevel: 1\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'illusory-script': '---\nname: Illusory Script\nlevel: 1\nritual: true\nclasses:\n  - Bard\n  - Warlock\n  - Wizard\n---\n\nx',
  'unseen-servant': '---\nname: Unseen Servant\nlevel: 1\nritual: true\nclasses:\n  - Bard\n  - Warlock\n  - Wizard\n---\n\nx',
  'fire-bolt': '---\nname: Fire Bolt\nlevel: 0\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'light': '---\nname: Light\nlevel: 0\nclasses:\n  - Bard\n  - Cleric\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'prestidigitation': '---\nname: Prestidigitation\nlevel: 0\nclasses:\n  - Bard\n  - Sorcerer\n  - Warlock\n  - Wizard\n---\n\nx',
  'sacred-flame': '---\nname: Sacred Flame\nlevel: 0\nclasses:\n  - Cleric\n---\n\nx',
  'guidance': '---\nname: Guidance\nlevel: 0\nclasses:\n  - Cleric\n  - Druid\n---\n\nx',
  'eldritch-blast': '---\nname: Eldritch Blast\nlevel: 0\nclasses:\n  - Warlock\n---\n\nx',
  'hex': '---\nname: Hex\nlevel: 1\nclasses:\n  - Warlock\n---\n\nx',
  // 高等级出生 fixtures(2026-09-29b):4 号戏法(凑 wizard L4+ 的 4 戏法档)+ 2/3 环(wizard L5 已知 14 恰满、cleric L3 准备 5)
  'mage-hand': '---\nname: Mage Hand\nlevel: 0\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'fireball': '---\nname: Fireball\nlevel: 3\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'fly': '---\nname: Fly\nlevel: 3\nclasses:\n  - Sorcerer\n  - Warlock\n  - Wizard\n---\n\nx',
  'counterspell': '---\nname: Counterspell\nlevel: 3\nclasses:\n  - Sorcerer\n  - Warlock\n  - Wizard\n---\n\nx',
  'haste': '---\nname: Haste\nlevel: 3\nclasses:\n  - Sorcerer\n  - Wizard\n---\n\nx',
  'spiritual-weapon': '---\nname: Spiritual Weapon\nlevel: 2\nclasses:\n  - Cleric\n  - Paladin\n---\n\nx',
  'lesser-restoration': '---\nname: Lesser Restoration\nlevel: 2\nclasses:\n  - Cleric\n  - Druid\n  - Paladin\n  - Ranger\n---\n\nx',
  'spirit-guardians': '---\nname: Spirit Guardians\nlevel: 3\nritual: false\nclasses:\n  - Cleric\n---\n\nx',
}
const SPELL_FIXTURE = { spells: SPELLS }

/** 迷你 SPELL_CORE(fixture 域)——数据主路(2026-09-30)下池子走 lib 数据快照,rig 覆写为夹具域,断言维持既有语义。 */
function miniSpellCore(spells: Record<string, string>, base: string) {
  const core: Record<string, { fm: Record<string, unknown>; effect: string }> = {}
  for (const [slug, md] of Object.entries(spells)) {
    const m = /^---\n([\s\S]*?)\n---/.exec(md) ?? { 1: '' }
    const fm: Record<string, unknown> = {}
    let cur: string | null = null
    const coerce = (v: string) => /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : (v === 'true' ? true : v === 'false' ? false : v.replace(/^"|"$/g, ''))
    for (const line of m[1].split('\n')) {
      const li = /^  - (.*)$/.exec(line)
      const kv = /^([a-z_]+):\s*(.*)$/.exec(line)
      if (li && cur) { fm[cur] = [...(fm[cur] as unknown[] ?? []), coerce(li[1])]; continue }
      if (kv) { cur = kv[1]; fm[kv[1]] = kv[2].trim() === '' ? [] : coerce(kv[2].trim()) }
    }
    core[slug] = { fm, effect: '' }
  }
  writeFileSync(join(base, 'preset', 'lib', 'spell-core-data.mjs'), `export const SPELL_CORE = ${JSON.stringify(core)}\n`)
}

type Res = { ok: boolean;[k: string]: unknown }
function run(cwd: string, script: 'opening_data.mjs' | 'opening_commit.mjs', argv: Record<string, unknown>): Res {
  const code = `globalThis.argv=[${JSON.stringify(JSON.stringify(argv))}];await import(${JSON.stringify(pathToFileURL(join(ROOT, 'tavern_presets', 'dnd5e', 'preset', 'scripts', script)).href)})`
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', code], { cwd, encoding: 'utf8' })
  const out = r.stdout.trim()
  const json = out.split('\n').filter(l => l.startsWith('{')).pop() ?? '{}'
  let parsed: Res = {}
  try { parsed = JSON.parse(json) } catch { /* stdout 无 JSON=真 crash,stderr 冒出 */ }
  if (!('ok' in parsed)) throw new Error(`${script} exit ${r.status}: ${(r.stderr || r.stdout).slice(0, 800)}`)
  return parsed
}

const baseChar = (over: Record<string, unknown> = {}) => ({
  name: '洛克', race: 'human', class: 'wizard', gender: 'male',
  abilities: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
  skills: ['arcana', 'investigation'],
  // 人设三层(2026-09-30 persona-threelayer):同伴四件必填+七键照传;history=履历首行(旧 backstory 通道)
  persona: { appearance: '灰发方脸,青灰眼,旧旅袍', lens: '把知识当命', reaction: '见奇珍→挪不开脚', voice: '咬字清晰如念文书', never: '不烧书', tension: '求真知却接危险委托', alignment: '守序中立' },
  history: '学者出身,家学断在第二次战争',
  ...over,
})

describe('opening_data · meta 整包下发(单源语料解析)', () => {
  it('技能白名单现场解析( cleric=5 白名单选 2 / bard 任选)+ 子职清单 + 施法者法术池', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_data.mjs', {})
    expect(out.ok).toBe(true)
    const meta = out.meta as { classes: Record<string, { skills: string[]; count: number; anySkill: boolean; subclasses: string[] }>; pools: Record<string, Record<string, string[]>>; casters: string[] }
    expect(meta.classes.cleric).toEqual({ skills: ['history', 'insight', 'medicine', 'persuasion', 'religion'], count: 2, anySkill: false, subclasses: ['Life'] })
    expect(meta.classes.bard.anySkill).toBe(true)
    expect(meta.classes.wizard.skills).toEqual(['arcana', 'history', 'insight', 'investigation', 'medicine', 'religion'])
    expect(meta.CASTERS).toContain('warlock')
    expect(meta.pools.cantrips.wizard).toEqual(expect.arrayContaining(['Fire Bolt', 'Light', 'Prestidigitation']))
    expect(meta.pools.lv1.warlock).toEqual(expect.arrayContaining(['Hex', 'Illusory Script', 'Unseen Servant']))
    const lvl = meta as unknown as { cantripsBy: Record<string, number[]>; knownBy: Record<string, number[]>; slotMax: Record<string, number[]> }
    expect(lvl.cantripsBy.wizard).toEqual([3, 3, 3, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5])   // SRD 三段阶梯
    expect(lvl.cantripsBy.sorcerer[0]).toBe(4)
    expect(lvl.knownBy.bard).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22])
    expect(lvl.knownBy.cleric).toBeUndefined()                                                            // 准备制无已知表
    expect(lvl.slotMax.wizard[4]).toBe(3)                                                                 // L5 全施法 ≤3 环
    expect(lvl.slotMax.warlock[4]).toBe(3)                                                                // L5 契术 3 环双位
    expect(lvl.slotMax.wizard[0]).toBe(1)                                                                 // L1 本就有 1 环位
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
})

describe('opening_commit · 施法者出生即满(RAW L1)', () => {
  it('无 payload 法术 → 服务端 roll:法师 3 戏法+6 进书并册 9 件(全本职业池);训练面/特征时机/中文描述齐活', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar(), scenario: 'goblin-ambush' })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.spells_known).toHaveLength(9)                                      // 戏法并册(2026-09-30):0 环+环术同册
    const pool = SPELL_FIXTURE.spells
    for (const s of panel.spells_known) expect(Object.keys(pool).some(k => pool[k].includes(s))).toBe(true)
    const fmOf = (s: string) => pool[Object.keys(pool).find(k => pool[k].includes(s)) as string]
    expect(panel.spells_known.filter(s => fmOf(s).includes('level: 0'))).toHaveLength(3)   // 0 环=戏法并册;戏法/法术行拆分=展示层投影
    expect(panel.features.join('|')).toContain('Arcane Recovery|每日')                // 时机按表,非池 |—
    expect(panel.features.join('|')).toContain('Spellcasting: Wizard|—')
    expect(panel.armor_prof).toBeUndefined()                                         // 法师无甲熟练——空数组整族被键裁剪剥除
    expect(panel.weapon_prof).toContain('匕首')
    expect(panel.description).toContain('人类 法师')
    expect(panel.history[0]).toContain('学者出身')
    expect(panel.persona.lens).toBe('把知识当命')   // 人设三层:七键照落(biography/background 退役,history 接棒)
    expect(panel.biography).toBeUndefined()
    expect(panel.subclass).toBeNull()
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('payload 带法术 → 校验:越职业表/数量不符 fail-loud;戏法不计入 known', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const bad = run(cwd, 'opening_commit.mjs', { character: baseChar({ spells: { cantrips: ['Sacred Flame', 'Light', 'Fire Bolt'], spells: ['Shield'], prepared: [] } }), scenario: 'goblin-ambush' })
    expect(bad.ok).toBe(false)
    expect(bad.error).toContain('超出职业表')
    const tooMany = run(cwd, 'opening_commit.mjs', { character: baseChar({ spells: { cantrips: ['Fire Bolt', 'Light', 'Prestidigitation'], spells: ['Shield'], prepared: [] } }), scenario: 'goblin-ambush' })
    expect(tooMany.ok).toBe(false)
    expect((tooMany as { error: string }).error).toContain('已知法术须 6 个')   // 数量校验先行于表校验(Shield 合法但不满额)
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
})

describe('opening_commit · 白名单/选数/子职/-warlock(三处 SRD 修补)', () => {
  it('技能越白名单 → 拒;选数不符 → 拒( rogue 4 / 法师 2 各按其数)', () => {
    const { cwd } = rig({})
    const illegal = run(cwd, 'opening_commit.mjs', { character: baseChar({ class: 'wizard', skills: ['athletics', 'intimidation'] }), scenario: 'goblin-ambush' })
    expect(illegal.ok).toBe(false)
    expect(illegal.error).toContain('白名单')
    const rogueName = { name: '影', class: 'rogue', skills: ['stealth', 'acrobatics', 'deception', 'intimidation'] }
    const rogueOk = run(cwd, 'opening_commit.mjs', { character: baseChar({ ...rogueName, abilities: { str: 10, dex: 15, con: 12, int: 14, wis: 13, cha: 8 } }), scenario: 'goblin-ambush' })
    expect(rogueOk.ok).toBe(true)
    const wrongCount = run(cwd, 'opening_commit.mjs', { character: baseChar({ class: 'rogue', skills: ['stealth'] }), scenario: 'goblin-ambush' })
    expect(wrongCount.ok).toBe(false)
    expect(wrongCount.error).toContain('4')
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('cleric:1 级子职 Life 落 subclass;prepared=1+体质调整 满额(准备制)', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar({ class: 'cleric', skills: ['history', 'insight'], abilities: { str: 8, dex: 12, con: 13, int: 10, wis: 15, cha: 14 } }), scenario: 'goblin-ambush' })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.subclass).toBe('Life')
    expect(panel.spells_prepared.length).toBe(1 + 2)   // WAL 15→+2
    expect(panel.spells_prepared.every((s: string) => ['Detect Magic', 'Cure Wounds', 'Bless'].includes(s))).toBe(true)
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('warlock 归施法族:出生 slots_l1=1 + 戏法 2 已知 2 取自本职业池(此前漏排=RAW 错)', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar({ class: 'warlock', skills: ['arcana', 'history'] }), scenario: 'goblin-ambush' })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.caster_attr).toBe('cha')
    expect(panel.slots_l1).toBe(1)
    expect(panel.spells_known as string[]).toHaveLength(4)   //RAW L1:2 戏法+2 已知——并册(0 环归 spells_known,与 NPC 口径一致)
    expect(panel.features.join('|')).toContain('Otherworldly Patron|—')
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('回执透明:rolled 全量可考(戏法/法术/子职/技能)', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar(), scenario: 'goblin-ambush' })
    const rolled = out.rolled as { cantrips: string[]; spells: string[]; subclass: null; skills: string[] }
    expect(rolled.cantrips).toHaveLength(3)
    expect(rolled.spells).toHaveLength(6)
    expect(rolled.subclass).toBeNull()
    expect(rolled.skills).toEqual(['arcana', 'investigation'])
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
})

describe('opening_commit · 世界锚定(state.md)', () => {
  it('玩家所在落新世界地名(地点ID/地点名/天气/地形锚定)', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar(), scenario: 'goblin-ambush' })
    expect(out.ok).toBe(true)
    expect(out.narration).toContain('凡戴尔镇')
    const md = readFileSync(join(cwd, 'state.md'), 'utf8')
    expect(md).toContain('- 地点ID：')
    expect(md).toContain('- 地点名：凡戴尔镇外')
    expect(md).toContain('- 阴')
    expect(md).toContain('- 山路')
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
})

describe('opening_commit · 高等级成长族出生(2026-09-29b 等级入参)', () => {
  it('缺省(不传 level)=1 级旧路径:exp 0/hd 1/位表单键 L1/pending 空键被裁剪', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar(), scenario: 'goblin-ambush' })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.level).toBe(1)
    expect(panel.exp).toBe(0)
    expect(panel.hd_available).toBe(1)
    expect(panel.slots_l1).toBe(2)
    expect(panel.slots_l2).toBeUndefined()
    expect(panel.pending).toBeUndefined()                                       // L1 无 ASI 档——空数组整键剥除=旧行为
    expect((out.rolled as { asi_pend: number }).asi_pend).toBe(0)
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('level 非法(0/21/1.5/字符串)→ fail-loud 中械闸', () => {
    const { cwd } = rig({})
    for (const bad of [0, 21, 1.5, '5']) {
      const r = run(cwd, 'opening_commit.mjs', { character: baseChar({ level: bad, class: 'fighter', skills: ['athletics', 'intimidation'] }), scenario: 'goblin-ambush' })
      expect(r.ok).toBe(false)
      expect((r as { error: string }).error).toContain('level 不合法')
    }
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('fighter L6 出生:exp=14000/hd 6/满血 hp=classHpMax(基础 con)/特征累积/子职必落/pending 恰 LV4·LV6', () => {
    const { cwd } = rig({})
    const out = run(cwd, 'opening_commit.mjs', {
      character: baseChar({
        name: '布兰', class: 'fighter', level: 6, skills: ['athletics', 'intimidation'],
        abilities: { str: 15, dex: 13, con: 14, int: 8, wis: 12, cha: 10 },
      }), scenario: 'goblin-ambush',
    })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.level).toBe(6)
    expect(panel.exp).toBe(14000)
    expect(panel.hd_available).toBe(6)
    expect(panel.hp).toBe(52)                    // d10 满值10 + conM2 + 5×(⌊10/2⌋+1+2)=52;出生即满血
    expect(panel.hp_max).toBe(52)
    expect(panel.slots_l1).toBeUndefined()       // 非施法无位表键
    expect(panel.subclass).not.toBeNull()        // L6 ≥ 分岔级 3 → 必落(服务端 roll)
    expect(panel.features.join('|')).toContain('Second Wind|短休')
    expect(panel.features.join('|')).toContain('Ability Score Improvement|—')
    expect(panel.pending).toEqual(['LV4·ASI 点选', 'LV6·ASI 点选'])   // fighter 特表 [4,6,8,…] ≤6
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('fighter L2 出生:未分岔 subclass null/pending 无(ASI 档 4>2)/exp=300/hd 2', () => {
    const { cwd } = rig({})
    const out = run(cwd, 'opening_commit.mjs', {
      character: baseChar({ name: '壮汉', class: 'fighter', skills: ['athletics', 'intimidation'], level: 2 }), scenario: 'goblin-ambush',
    })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.level).toBe(2)
    expect(panel.exp).toBe(300)
    expect(panel.hd_available).toBe(2)
    expect(panel.subclass).toBeNull()
    expect(panel.pending).toBeUndefined()
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('wizard L5 出生:戏法 4+进书 14=并册 18(进书线=4+2·5,1..3 环联合池)/位表 [4,3,2]/exp 6500/subclass Evocation/pending LV4 一档', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', { character: baseChar({ level: 5 }), scenario: 'goblin-ambush' })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.level).toBe(5)
    expect(panel.exp).toBe(6500)
    expect(panel.hd_available).toBe(5)
    expect(panel.spells_known as string[]).toHaveLength(18)   // SRD 进书线=4+2·L=14 + 戏法 4(L4+ 档)并册
    const pool = SPELL_FIXTURE.spells
    for (const s of panel.spells_known) expect(Object.keys(pool).some(k => pool[k].includes(s))).toBe(true)
    const fmOf = (s: string) => pool[Object.keys(pool).find(k => pool[k].includes(s)) as string]
    expect(panel.spells_known.filter(s => fmOf(s).includes('level: 0'))).toHaveLength(4)   // 戏法并册 4 个(L4+ 档)
    for (const c of panel.spells_known) expect(fmOf(c)).not.toContain('level: 4')   // 环位 ≤ L5 可施 3 环
    expect(panel.slots_l1).toBe(4)
    expect(panel.slots_l2).toBe(3)
    expect(panel.slots_l3).toBe(2)
    expect(panel.slots_l4).toBeUndefined()
    expect(panel.subclass).toBe('Evocation')     // L5 ≥ 分岔级 2,单选语料
    expect(panel.pending).toEqual(['LV4·ASI 点选'])
    expect((out.rolled as { asi_pend: number }).asi_pend).toBe(1)
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
  it('cleric L3 出生:准备数=等级+施法调整(3+2=5,1..2 环联合池)/known=3 戏法并册/位表 [4,2]/子职仍落', () => {
    const { cwd } = rig(SPELL_FIXTURE)
    const out = run(cwd, 'opening_commit.mjs', {
      character: baseChar({
        class: 'cleric', level: 3, skills: ['history', 'insight'],
        abilities: { str: 8, dex: 12, con: 13, int: 10, wis: 15, cha: 14 },
      }), scenario: 'goblin-ambush',
    })
    expect(out.ok).toBe(true)
    const panel = JSON.parse(readFileSync(join(cwd, 'characters', 'player.json'), 'utf8'))
    expect(panel.level).toBe(3)
    expect(panel.spells_prepared as string[]).toHaveLength(5)
    for (const s of panel.spells_prepared) expect(['Detect Magic', 'Cure Wounds', 'Bless', 'Spiritual Weapon', 'Lesser Restoration', 'Spirit Guardians'].includes(s)).toBe(true)
    expect(panel.spells_known).toEqual(['Guidance', 'Light', 'Sacred Flame'])   // 准备制无 known 面,但戏法并册在册(夹具池恰 3 个全 roll)
    expect(panel.slots_l1).toBe(4)
    expect(panel.slots_l2).toBe(2)
    expect(panel.slots_l3).toBeUndefined()
    expect(panel.subclass).toBe('Life')
    rmSync(dirname(cwd), { recursive: true, force: true })
  })
})
