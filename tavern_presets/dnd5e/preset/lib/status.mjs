// status.mjs — 临时状态单源(叶子模块,无 import):statuses 键名枚举 + 英文→中文译名 + 校验。
// 键名口径(2026-09-29 定案):**英文规范键 + 展示译中文**——工具写的键已是英文规范键
// (cast buff=fm.name Title Case / attack 骑手=小写条件名),display 层拿 STATUS_CN 译中文。
// 临时生命是唯一的机制例外:通用池子键「临时生命」(hp_change 默认,已中文),法术赐临时生命(Fake Life)仍英文。
// 同步纪律:法术/临时条目须与 lib/spell-data.mjs 的 buff/temp 字段 + cast.mjs 的 fm.name 对齐,
// 条件译名以 docs/translation-protocol_zh.md §9 为锚(vitest dnd5e-status-enum 兜同步)。

// 15 条 SRD 条件(对齐 preset/setup/dnd5e-srd-lorebook/conditions/*.md 文件名)
export const CONDITIONS = [
  'blinded', 'charmed', 'deafened', 'exhaustion', 'frightened', 'grappled',
  'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned', 'prone',
  'restrained', 'stunned', 'unconscious',
]

// 合法 statuses 键全量(枚举)——工具自动写 + 叙事施加(update_status)都只许这些键。
export const STATUS_KEYS = new Set([
  ...CONDITIONS,
  // 法术 buff/temp(cast.mjs 写 fm.name;与 spell-data.mjs buff/temp 字段对应)
  'Bless', 'Bane', 'Shield of Faith', 'Haste', 'Divine Favor', 'Branding Smite', 'False Life',
  // 2026-09-29 补录:新施放面(cast pool/judge/onFail 写 fm.name)与 buff 条目(见表尾块)
  'Sleep', 'Color Spray', 'Power Word Stun', 'Power Word Kill', 'Divine Word',
  'Animal Friendship', 'Banishment', 'Blindness/Deafness', 'Calm Emotions', 'Charm Person',
  'Command', 'Compulsion', 'Confusion', 'Dominate Beast', 'Dominate Person',
  'Entangle', 'Enthrall', 'Fear', 'Faerie Fire', 'Flesh to Stone',
  'Grease', 'Hideous Laughter', 'Hold Person', 'Hold Monster', 'Hypnotic Pattern',
  'Irresistible Dance', 'Levitate', 'Mass Suggestion', 'Modify Memory', 'Planar Binding',
  'Polymorph', 'Resilient Sphere', 'Scrying', 'Slow', 'Suggestion',
  'Shield', "Hunter's Mark", 'Warding Bond', 'Resistance', 'Guidance',
  'Longstrider', 'Heroism', 'Beacon of Hope', 'Death Ward',
  // 临时生命通用池(hp_change 默认键)
  '临时生命',
  // 职业特征/消费型机制态(attack.mjs:120 rage 抗性、core.mjs consumeBonus on_use)
  'Rage', 'Bardic Inspiration',
])

// 英文键→中文(get Flask 展示层与工具回执共用;条件译名锚 translation-protocol §9,法术名同 view.mjs SPELL_CN)
export const STATUS_CN = {
  blinded: '目盲', charmed: '魅惑', deafened: '耳聋', exhaustion: '力竭', frightened: '惊惧',
  grappled: '被擒抱', incapacitated: '失能', invisible: '隐形', paralyzed: '麻痹', petrified: '石化',
  poisoned: '中毒', prone: '倒地', restrained: '束缚', stunned: '昏眩', unconscious: '昏迷',
  'Bless': '祝福术', 'Bane': '灾厄术', 'Shield of Faith': '信仰护盾', 'Haste': '加速术',
  'Divine Favor': '神圣恩宠', 'Branding Smite': '烙印斩', 'False Life': '虚假生命',
  'Sleep': '睡眠术', 'Color Spray': '七彩喷射', 'Power Word Stun': '律令昏迷', 'Power Word Kill': '律令死亡', 'Divine Word': '神圣之言',
  'Animal Friendship': '动物友善', 'Banishment': '放逐术', 'Blindness/Deafness': '目盲/耳聋', 'Calm Emotions': '安抚情绪', 'Charm Person': '魅惑人类',
  'Command': '命令术', 'Compulsion': '强制术', 'Confusion': '混乱术', 'Dominate Beast': '支配野兽', 'Dominate Person': '支配人类',
  'Entangle': '纠缠术', 'Enthrall': '迷魂术', 'Fear': '恐惧术', 'Faerie Fire': '精灵之火', 'Flesh to Stone': '石化术',
  'Grease': '油腻术', 'Hideous Laughter': '狂笑术', 'Hold Person': '定身人类', 'Hold Monster': '定身怪物', 'Hypnotic Pattern': '催眠图纹',
  'Irresistible Dance': '无法抗拒之舞', 'Levitate': '漂浮术', 'Mass Suggestion': '群体暗示术', 'Modify Memory': '修改记忆', 'Planar Binding': '异界束缚',
  'Polymorph': '变形术', 'Resilient Sphere': '弹性法球', 'Scrying': '探查术', 'Slow': '缓慢术', 'Suggestion': '暗示术',
  'Shield': '护盾术', "Hunter's Mark": '猎人印记', 'Warding Bond': '守护连结', 'Resistance': '抗性术', 'Guidance': '指引术',
  'Longstrider': '长途步', 'Heroism': '英勇术', 'Beacon of Hope': '希望信标', 'Death Ward': '死亡防护',
  '临时生命': '临时生命', 'Rage': '狂暴', 'Bardic Inspiration': '吟游诗人激励',
}

// 校验 statuses 对象表的键是否都在枚举内;只查键名,值形态不作深校验(apply_at/effect/mods/temp/resist/immune/on_use)。
export function validateStatuses(statuses) {
  if (statuses == null) return { ok: true, bad: [] }
  if (typeof statuses !== 'object' || Array.isArray(statuses)) return { ok: true, bad: [] } // 遗留数组态不拦(键校验只针对对象表)
  const bad = []
  for (const k of Object.keys(statuses)) if (!STATUS_KEYS.has(k)) bad.push(k)
  return { ok: bad.length === 0, bad }
}