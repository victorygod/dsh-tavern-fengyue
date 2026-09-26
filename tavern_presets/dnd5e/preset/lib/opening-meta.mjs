// opening-meta — 开局创角的死规则单源（2026-09-25 用户令:开局 roll 要"有逻辑"）。
// 语料里没有的创角数(canvas 选择数/戏法数/首环数/主属性序/1 级子职标记/起装表)在此内嵌,
// 先例同 ui_data 的 FULL_CASTER_SLOTS(panel 不读它,只有 opening_data/opening_commit 消费)。
// 口径=SRD 5.1 / PHB 2014(基线同 rules_zh §11)。

export const CLASS_CN = {
  fighter: '战士', rogue: '盗贼', wizard: '法师', cleric: '牧师', barbarian: '野蛮人',
  bard: '吟游诗人', druid: '德鲁伊', monk: '武僧', paladin: '圣骑士', ranger: '游侠',
  sorcerer: '术士', warlock: '契术师',
}
export const RACE_CN = {
  human: '人类', 'half-elf': '半精灵', elf: '精灵', dwarf: '矮人', halfling: '半身人',
  gnome: '地侏', 'half-orc': '半兽人', tiefling: '提夫林', dragonborn: '龙裔',
}

// 全施法者(含 warlock——Pact Magic L1=1 位 2 戏法 2 已知;此前漏排,RAW 错)
export const CASTERS = ['wizard', 'cleric', 'sorcerer', 'druid', 'bard', 'warlock']
// 半施法者 L1 无施法(圣骑士 L2 起、游侠 L2 起)——出生无施法族是**正确**行为,不算薄。

export const SUBCLASS_LEVEL = {
  cleric: 1, sorcerer: 1, warlock: 1,      // SRD:三职 1 级分岔
  wizard: 2, druid: 2, bard: 3, fighter: 3, monk: 3, paladin: 3, ranger: 3, rogue: 3, barbarian: 3,
}

// L1 已知戏法数(dead rule;SRD 职业表 Cantrips 列)
export const CANTRIPS_L1 = { wizard: 3, cleric: 3, druid: 2, bard: 2, sorcerer: 4, warlock: 2 }
// L1 进书/已知法术数(wizard 6 进书;sorcerer/bard/warlock 逐级已知;cleric/druid 无已知——准备制整表备选)
export const KNOWN_L1 = { wizard: 6, sorcerer: 2, bard: 4, warlock: 2 }

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
export const OPENING_META = { CLASS_CN, RACE_CN, PRIMARY, EQUIP_BY_CLASS, FEATURES_RECHARGE, SKILL_EN_KEY, SUBCLASS_LEVEL, CANTRIPS_L1, KNOWN_L1, CASTERS }
