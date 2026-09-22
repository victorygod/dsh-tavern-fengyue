/** @tavern-schema
{
  "description": "单次 d20 检定结算器（判定/豁免/专注维持/对抗）。调用时机：结果不确定且带后果的当口——能力检定、豁免检定、对抗检定、专注维持。修正值三选一：skill（技能引用，自动解析属性调整值+熟练+专精+状态）优先于 stat（裸属性）优先于 modifier（直值临时项）。专注维持传 auto:'专注维持' + damage，DC 内算。成败以返回行为准，绝不凭空写骰值。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概（反作弊铁则）：从上次玩家消息到本判定点之间你对剧情走向的承诺，骰值只裁定此刻成败、不得覆盖它。" },
    "who": { "type": "string", "description": "检定者姓名（默认玩家），按名读 characters/<名>.json。" },
    "stat": { "type": "string", "description": "裸属性引用 str/dex/con/int/wis/cha；skill 与 modifier 皆缺时用。" },
    "skill": { "type": "string", "description": "技能名（隐匿/巧手/察觉等）：自动解析对应属性调整值+熟练+专精+状态。推荐优先。" },
    "modifier": { "type": "integer", "description": "直值修正（临时环境项，可负）；skill/stat 皆缺时必填。" },
    "dc": { "type": "integer", "description": "难度标尺 5极易/10容易/15中等/20困难/25极难/30近乎不可能；auto=专注维持 时不传（damage 内算）。" },
    "mode": { "type": "string", "description": "优劣势 normal|adv|dis，默认 normal。来源判断=DM（空间/隐形/伏击），多源不叠、优+劣抵消。" },
    "auto": { "type": "string", "description": "固定传 '专注维持' 走专注分支（配合 damage 参数）。" },
    "damage": { "type": "integer", "description": "专注维持分支：本次受击伤害，DC=max(10,⌊伤害/2⌋) 内算。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { d20, mod, pb, readChar, statusesMod, SKILL_STAT, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填参数 context:剧情梗概(反作弊铁则)')

const char = readChar(a.who ?? '玩家')
const level = char.level ?? 1, PB = pb(level)
let bonus = 0; const parts = []
if (a.skill) {
  const st = SKILL_STAT[a.skill] ?? a.stat ?? 'dex'
  const v = char[st]; v === undefined && err(`!角色无属性键 ${st}（键裁剪?）`)
  bonus += mod(v); parts.push(`${st}${mod(v) >= 0 ? '+' + mod(v) : mod(v)}`)
  if ((char.skill_prof ?? []).includes(a.skill)) { bonus += PB; parts.push(`熟练+${PB}`) }
  if ((char.expertise ?? []).includes(a.skill)) { bonus += PB; parts.push(`专精+${PB}`) }
} else if (a.stat) {
  const v = char[a.stat]; v === undefined && err(`!角色无属性键 ${a.stat}`)
  bonus += mod(v); parts.push(`${a.stat}${mod(v) >= 0 ? '+' + mod(v) : mod(v)}`)
} else if (a.modifier !== undefined) {
  bonus += a.modifier; parts.push(`直值${a.modifier >= 0 ? '+' + a.modifier : a.modifier}`)
} else err('缺修正值来源:stat/skill(引用)或 modifier(直值)')
bonus += statusesMod(char, a.stat ?? (a.skill ? SKILL_STAT[a.skill] : null))

let dc, label
if (a.auto === '专注维持') {
  const dmg = a.damage; dmg === undefined && err('专注维持需 damage 参数')
  dc = Math.max(10, Math.floor(dmg / 2)); label = `专注维持 DC${dc}(=max(10,⌊${dmg}/2⌋))`
} else {
  a.dc === undefined && err('缺 dc')
  dc = a.dc; label = `DC ${dc}`
}
const d = d20(a.mode), total = d + bonus, ok = total >= dc
console.log(`[判定 · ${char.name ?? a.who}${a.skill ? ' · ' + a.skill : ''}]`)
console.log(`  判定: d20${bonus ? (bonus >= 0 ? '+' + bonus : bonus) : ''} = ${total} vs ${label} → ${ok ? '成功' : '失败'}`)
console.log(`  修正: ${parts.join(' · ') || '无'}`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守本 context——骰值只裁定此刻成败`)
