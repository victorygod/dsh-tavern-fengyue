// class-build.mjs — class 制角色(玩家 + class-NPC)数值派生单源(2026-09-29 从 opening_commit 抽出)。
// 职责:构数值知识源(职业表 classes/*.md 的 hit_die/saves/subclass + opening-meta 死规则表) → 确定性派生。
// **不含** roll / fail-loud 校验 / spells 表单白名单 / 中文组装 / player.json·state.md 写——那些归 opening(玩家)/spawn_npc(NPC)。
// hp 因依赖子职(Draconic +1/级)单独成 classHpMax——buildClass 只出与子职无关的确定性数值。
import { mod, slotsFor, classRow, ASI_LEVELS } from './core.mjs'
import { CASTERS, SUBCLASS_LEVEL, SUBCLASS_HP_BONUS, FEATURES_RECHARGE, EQUIP_BY_CLASS, parseSkillChoices, ALL_SKILL_KEYS, PRIMARY } from './opening-meta.mjs'
import { CLS_FEATURES } from './class-feature-data.mjs'
import { CLASS_CORE } from './class-core-data.mjs'

// 施法主属性映射(class FM 无此键;死规则内嵌)
export const CASTER_ATTR = { wizard: 'int', cleric: 'wis', sorcerer: 'cha', druid: 'wis', bard: 'cha', warlock: 'cha' }
// 12 职业甲/武熟练(语料 classes/*.md 无 armor/weapon 键;迁自 opening_commit 原表)
export const PROF_ARMOR = {
  barbarian: ['轻甲', '中甲', '盾牌'], bard: ['轻甲'], cleric: ['轻甲', '中甲', '盾牌'], druid: ['轻甲', '中甲', '盾牌'],
  fighter: ['轻甲', '中甲', '重甲', '盾牌'], monk: [], paladin: ['轻甲', '中甲', '重甲', '盾牌'], ranger: ['轻甲', '中甲', '盾牌'],
  rogue: ['轻甲'], sorcerer: [], warlock: ['轻甲'], wizard: [],
}
export const PROF_WEAPON = {
  barbarian: ['简易武器', '军用武器'], bard: ['简易武器', '手弩', '长剑', '细剑', '短剑'], cleric: ['简易武器'],
  druid: ['木棍', '匕首', '飞镖', '矛', '弯刀(语料键对齐)', '镰刀', '投石索'], fighter: ['简易武器', '军用武器'],
  monk: ['简易武器', '短剑'], paladin: ['简易武器', '军用武器'], ranger: ['简易武器', '军用武器'],
  rogue: ['简易武器', '手弩', '长剑', '细剑', '短剑'], sorcerer: ['匕首', '飞镖', '轻弩', '长杖'], warlock: ['简易武器'],
  wizard: ['匕首', '飞镖', '轻弩', '长杖'],
}

/**
 * cls(小写) + level → 与子职无关的 class 确定性派生。
 * 返回: hit_die / save_prof(**小写**——class FM 大写 STR/CON,resolveSave 按小写查,必须转) /
 *   skillCount / skillWhitelist / anySkill / isCaster / caster_attr /
 *   slots(数组,null=非施法;slotsFor 全文 1-20 级)· features(classRow at level → `名|回充|已用0`) /
 *   subclass_list / subclass_level / armor_prof / weapon_prof / equipment。
 * 子职相关只影响 hp(见 classHpMax),不进本函数。
 */
export function buildClass(cls, level = 1) {
  // 职业面纯数据(CLASS_CORE 快照,零 lorebook 零回退);查无快照即爆
  const core = CLASS_CORE[cls]
  if (!core) throw new Error(`!查无职业快照:${cls}(重跑 extract-class-core.mjs)`)
  const classFM = core.fm
  const parsed = parseSkillChoices(core.prof_line)
  const isCaster = CASTERS.includes(cls)
  // 特征累积 L1..level(去重);每级 classRow 只吐本级特征列,单 L 会漏早级特征(L3 战士缺 Second Wind)
  const features = []
  const seen = new Set()
  for (let i = 1; i <= level; i++) {
    for (const f of (classRow(cls, i).features ?? '').split(',').map(s => s.trim()).filter(Boolean)) {
      if (seen.has(f)) continue
      seen.add(f)
      const key = Object.keys(FEATURES_RECHARGE).find(k => f.toLowerCase().includes(k.toLowerCase()))
      features.push(`${f}|${key ? FEATURES_RECHARGE[key] : '—'}|已用0`)
    }
  }
  return {
    hit_die: classFM.hit_die ?? 8,
    save_prof: (classFM.saves ?? []).map(s => String(s).toLowerCase()),
    skillCount: parsed?.count ?? 0,
    skillWhitelist: parsed ? (parsed.anySkill ? ALL_SKILL_KEYS : parsed.skills) : [],
    anySkill: parsed?.anySkill ?? false,
    isCaster,
    caster_attr: CASTER_ATTR[cls] ?? null,
    slots: isCaster ? slotsFor(cls, level) : null,
    features,
    feature_details: materializeFeatureDetails(cls, features),
    subclass_list: Array.isArray(classFM.subclass) ? classFM.subclass.map(String).filter(Boolean) : [],
    subclass_level: SUBCLASS_LEVEL[cls] ?? 99,
    armor_prof: PROF_ARMOR[cls] ?? [],
    weapon_prof: PROF_WEAPON[cls] ?? [],
    equipment: EQUIP_BY_CLASS[cls] ?? null,
  }
}

/** 特征行(`名|回充|已用0`)→ [{name, text}] 全文材料化(CLS_FEATURES 按名前缀匹配;缺者 text='')。 */
function materializeFeatureDetails(cls, features) {
  const table = CLS_FEATURES[cls] ?? []
  const baseOf = (n) => String(n).split('(')[0].split(':')[0].trim()
  const out = []
  const seen = new Set()
  for (const row of features ?? []) {
    const name = String(row).split('|')[0].trim()
    if (!name || seen.has(name)) continue
    seen.add(name)
    const hit = table.find(f => f.name === name) ?? table.find(f => f.name === baseOf(name))
    out.push({ name, text: hit?.text ?? '' })
  }
  return out
}

/** class HP 公式:hit_die(满) + 体调 + (L−1)·(⌊hd/2⌋+1+体调) + 子职加成·L。subclass 传 null 即无子职。 */
export function classHpMax(cls, hit_die, con, level, subclass = null) {
  const conM = mod(con ?? 10)
  const fixed = Math.floor(hit_die / 2) + 1 + conM
  return hit_die + conM + (level - 1) * fixed + (SUBCLASS_HP_BONUS[cls]?.[subclass] ?? 0) * level
}

const SIX = ['str', 'dex', 'con', 'int', 'wis', 'cha']

/**
 * 1 级基础六维 roll(spawn_npc 未传 abilities 时的自动底):PHB 标准数组 15/14/13/12/10/8,
 * 前两值钉职业 PRIMARY 前二主属性,其余四值随机派——opening 创角「有逻辑 roll」同律(rnd 可 seed)。
 */
export function rollBaseArray(cls, rnd = Math.random) {
  const primary = PRIMARY[cls] ?? SIX
  const out = {}
  out[primary[0]] = 15
  out[primary[1]] = 14
  const pool = [13, 12, 10, 8]
  // core.rnd(max)=掷 1..max(带参)——取下标一律 -1;无参调用在 seeded 路径返 NaN、unseeded 直接抛(rnd max 须给)
  for (const k of SIX.filter(k => k !== primary[0] && k !== primary[1])) out[k] = pool.splice(rnd(pool.length) - 1, 1)[0]
  return out
}

/**
 * class-NPC 出生历史成长(2026-09-29):按 ASI 档位表把「活到 level 级」该有的属性值提升一次性补上。
 * abilities=1 级基础值;每档 RAW ASI 固定 +1+1——第一点从职业 PRIMARY 前二随机(有逻辑:战士不长魅),
 * 第二点全六维随机(去重)。rnd 默认 Math.random,测试传 core.rnd(seeded)。
 * 返回 { str..cha(成长后), gains: ['LV4:str+1·con+1', ...] }——回执透明列明细。
 */
export function applyAsiGrowth(cls, level, abilities, rnd = Math.random) {
  const out = { ...abilities }
  const gains = []
  if (level >= 4) {
    const levels = (ASI_LEVELS[cls] ?? ASI_LEVELS.default).filter(l => l <= level)
    const primary = PRIMARY[cls] ?? SIX
    for (const L of levels) {
      // core.rnd(max)=掷 1..max(带参)——取下标 -1;无参调用 seeded 返 NaN/unseeded 抛(2026-09-29 实锤修)
      const first = primary[Math.min(rnd(Math.min(2, primary.length)) - 1, primary.length - 1)] ?? 'str'
      const rest = SIX.filter(k => k !== first)
      const second = rest[rnd(rest.length) - 1]
      out[first] = (out[first] ?? 10) + 1
      out[second] = (out[second] ?? 10) + 1
      gains.push(`LV${L}:${first}+1·${second}+1`)
    }
  }
  return { ...out, gains }
}