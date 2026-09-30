// opening-meta — 开局创角的死规则单源（2026-09-25 用户令:开局 roll 要"有逻辑"）。
// 语料里没有的创角数(canvas 选择数/戏法数/首环数/主属性序/1 级子职标记/起装表)在此内嵌,
// 先例同 ui_data 的 FULL_CASTER_SLOTS(panel 不读它,只有 opening_data/opening_commit 消费)。
// 口径=SRD 5.1 / PHB 2014(基线同 rules_zh §11)。
import { isCasterClass } from './core.mjs'

export const CLASS_CN = {
  fighter: '战士', rogue: '盗贼', wizard: '法师', cleric: '牧师', barbarian: '野蛮人',
  bard: '吟游诗人', druid: '德鲁伊', monk: '武僧', paladin: '圣骑士', ranger: '游侠',
  sorcerer: '术士', warlock: '契术师',
}
export const RACE_CN = {
  human: '人类', 'half-elf': '半精灵', elf: '精灵', dwarf: '矮人', halfling: '半身人',
  gnome: '地侏', 'half-orc': '半兽人', tiefling: '提夫林', dragonborn: '龙裔',
}

// 施法者名录(创角表单 spellcard 现身/法术池与 slotMax 的构建口)——派生自 core 施法家族判定单源,
// 名单不再手抄(旧案:只抄全施六族,ranger/paladin 被判非施法族,出生无位表无施法属性)。
// 半施法 L1 无施法(圣骑士/游侠 L2 起)是**正确**行为,位表/环位闸自然收口,不算薄。
export const CASTERS = Object.keys(CLASS_CN).filter(isCasterClass)

export const SUBCLASS_LEVEL = {
  cleric: 1, sorcerer: 1, warlock: 1,      // SRD:三职 1 级分岔
  wizard: 2, druid: 2, bard: 3, fighter: 3, monk: 3, paladin: 3, ranger: 3, rogue: 3, barbarian: 3,
}

// 子职 HP 加成(每级 +n):Draconic Resilience 各等级 +1 HP(sorcerer.md LV1 子职特征原文)。
// 只收语料里明文写「hit point maximum increases」的;Hill Dwarf 语料无 Toughness 条文 → 不收。
export const SUBCLASS_HP_BONUS = { sorcerer: { Draconic: 1 } }

// L1 已知戏法数(dead rule;SRD 职业表 Cantrips 列)
export const CANTRIPS_L1 = { wizard: 3, cleric: 3, druid: 2, bard: 2, sorcerer: 4, warlock: 2 }
// L1 进书/已知法术数(wizard 6 进书;sorcerer/bard/warlock 逐级已知;cleric/druid 无已知——准备制整表备选)
export const KNOWN_L1 = { wizard: 6, sorcerer: 2, bard: 4, warlock: 2 }

// ── 逐级施法面(2026-09-29 opening 高等级出生:口径=SRD 5.1 / PHB 2014 职业表列,与上方 L1 表同源同基线)──
// CANTRIPS_BY_LEVEL:6 施法者 1..20 逐级戏法数(表列三段阶梯 1-3/4-9/10+ 展平,L1 行与 CANTRIPS_L1 逐值一致)。
// KNOWN_BY_LEVEL:逐级「Spells Known」列(bard/sorcerer/warlock),L1 行与 KNOWN_L1 逐值一致;wizard 不在此表——
//   进书线=6+2(L-1)(SRD「每次升入本职业新级 +2 进书」,gain_exp LVN·新法术×2 同一增长线,knownSpellsAt 内公式化);
//   cleric/druid 为准备制无已知面——准备数=施法属性调整值+职业等级(SRD「Preparing and Casting Spells」条文,
//   opening_commit 按公式求,L1 时 =1+调整值 与旧侧行为一致)。
// 出处锚:open5e SRD5.1 class API(bard/sorcerer 逐级列直取)+ roll20/wikidot SRD 转载(warlock/wizard/cleric/druid
//   全 20 行比对开卷;wizard 双源 5esrd 再比对;两独立源逐值一致后方可落表)。
const LADDER = (n13, n49, n10) => Array.from({ length: 20 }, (_, i) => (i < 3 ? n13 : i < 9 ? n49 : n10))
export const CANTRIPS_BY_LEVEL = {
  bard: LADDER(2, 3, 4), cleric: LADDER(3, 4, 5), druid: LADDER(2, 3, 4),
  sorcerer: LADDER(4, 5, 6), warlock: LADDER(2, 3, 4), wizard: LADDER(3, 4, 5),
}
export const KNOWN_BY_LEVEL = {
  bard: [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 15, 16, 18, 19, 19, 20, 22, 22, 22],
  sorcerer: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 13, 14, 14, 15, 15, 15, 15],
  warlock: [2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 11, 11, 12, 12, 13, 13, 14, 14, 15, 15],
}
/** 该职业在 level 级应知/应进书的 1+ 环法术数:wizard=4+2·L 进书线;查表者直取;准备制(cleric/druid)返回 null。 */
export function knownSpellsAt(cls, level) {
  return cls === 'wizard' ? 4 + 2 * level : (KNOWN_BY_LEVEL[cls]?.[level - 1] ?? null)
}

// 主属性序(标准数组怎么排才"有逻辑"的依据):前两位吃 15/14,其余属性吃剩值并随机排
export const PRIMARY = {
  fighter: ['str', 'con'], barbarian: ['str', 'con'], ranger: ['dex', 'wis'],
  rogue: ['dex', 'int'], monk: ['dex', 'wis'], wizard: ['int', 'con'],
  cleric: ['wis', 'con'], druid: ['wis', 'con'], bard: ['cha', 'dex'],
  paladin: ['str', 'cha'], sorcerer: ['cha', 'con'], warlock: ['cha', 'con'],
}

// 技能白名单与选数:能从 class md 的 *Proficiencies* 行解析(单词数 two/three/four),
// 此处只放 EN→面板键 的映射与"任选"特例(吟游诗人=全 18 选 3)。
export const SKILL_EN_KEY = {
  acrobatics: 'acrobatics', 'animal handling': 'animal_handling', arcana: 'arcana', athletics: 'athletics',
  deception: 'deception', history: 'history', insight: 'insight', intimidation: 'intimidation',
  investigation: 'investigation', medicine: 'medicine', nature: 'nature', perception: 'perception',
  performance: 'performance', persuasion: 'persuasion', religion: 'religion',
  'sleight of hand': 'sleight_of_hand', stealth: 'stealth', survival: 'survival',
}
export const ALL_SKILL_KEYS = [...new Set(Object.values(SKILL_EN_KEY))]
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4 }

/** class md 的 *Proficiencies* 行 → { skills, count, anySkill }。anySkill=true=全 18 任选(吟游诗人)。
 *  行缺席/形状坏 → null(调用方 fail-loud)。 */
export function parseSkillChoices(profLine) {
  if (typeof profLine !== 'string') return null
  const m = /(?:Choose|choose) (any )?(one|two|three|four)(?: skills)?(?: from ([A-Za-z '’ and ,]+))?/.exec(profLine)
  if (!m) return null
  const anySkill = Boolean(m[1])
  const count = WORD_NUM[m[2].toLowerCase()] ?? 2
  const skills = anySkill
    ? []
    : String(m[3] ?? '').split(/,\s*(?:and\s+)?|\s+and\s+/i).map(s => s.trim().toLowerCase()).filter(Boolean).map(n => SKILL_EN_KEY[n]).filter(Boolean)
  if (!anySkill && !skills.length) return null
  return { skills: anySkill ? ALL_SKILL_KEYS : skills, count, anySkill }
}

/** L1 特征回充时机表(名=语料 class 表 Features 列的 EN 原文;池类才标时机,其他 |— 不造伪池)。 */
export const FEATURES_RECHARGE = {
  'Rage': '长休', 'Second Wind': '短休', 'Bardic Inspiration': '短休', 'Arcane Recovery': '每日',
  'Channel Divinity: Divine Domain': '短休', 'Wild Shape': '短休',
}

// 12 职业起装(简化但全员覆盖;slug=dnd5e-srd-lorebook/equipment 键;武器存面板名,join 缺席自保)
export const EQUIP_BY_CLASS = {
  barbarian: { weapon: 'greataxe',   armor: null,                  shield: false, gear: ['两柄手斧'],            gp: 8,  sp: 0, cp: 0 },
  bard:      { weapon: 'rapier',     armor: 'leather-armor',       shield: false, gear: ['贵族包', '鲁特琴'],     gp: 10, sp: 0, cp: 0 },
  cleric:    { weapon: 'mace',       armor: 'scale-mail',          shield: true,  gear: ['圣徽', '祭服'],         gp: 11, sp: 0, cp: 0 },
  druid:     { weapon: 'quarterstaff', armor: 'leather-armor',     shield: false, gear: ['皮甲(语料除外则缺)', '德鲁伊法器', '草药包'], gp: 9, sp: 0, cp: 0 },
  fighter:   { weapon: 'longsword',  armor: 'chain-mail',          shield: true,  gear: ['轻弩', '弩箭(20)'],     gp: 10, sp: 0, cp: 0 },
  monk:      { weapon: 'shortsword', armor: null,                  shield: false, gear: ['10 支飞镖'],           gp: 1,  sp: 0, cp: 0 },
  paladin:   { weapon: 'longsword',  armor: 'chain-mail',          shield: true,  gear: ['圣徽', '祭服'],         gp: 10, sp: 0, cp: 0 },
  ranger:    { weapon: 'shortsword', armor: 'scale-mail',          shield: false, gear: ['短弓', '箭袋(20)'],     gp: 10, sp: 0, cp: 0 },
  rogue:     { weapon: 'shortsword', armor: 'studded-leather-armor', shield: false, gear: ['短弓', '箭袋(20)', '盗贼工具'], gp: 11, sp: 0, cp: 0 },
  sorcerer:  { weapon: 'quarterstaff', armor: null,                shield: false, gear: ['法器', '两把匕首'],      gp: 10, sp: 0, cp: 0 },
  warlock:   { weapon: 'quarterstaff', armor: 'leather-armor',     shield: false, gear: ['法器', '二把匕首', '学者包'], gp: 15, sp: 0, cp: 0 },
  wizard:    { weapon: 'quarterstaff', armor: null,                shield: false, gear: ['法术书', '墨水与羽毛笔'], gp: 10, sp: 0, cp: 0 },
}

// 桥下发用聚合体(表单拿一份能用的规则包;散件导出供机械层按需引)
export const OPENING_META = { CLASS_CN, RACE_CN, PRIMARY, EQUIP_BY_CLASS, FEATURES_RECHARGE, SKILL_EN_KEY, SUBCLASS_LEVEL, SUBCLASS_HP_BONUS, CANTRIPS_L1, KNOWN_L1, CANTRIPS_BY_LEVEL, KNOWN_BY_LEVEL, CASTERS }
