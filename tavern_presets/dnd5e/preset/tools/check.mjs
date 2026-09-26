/** @tavern-schema
{
  "description": "单次 d20 检定结算器——一切判定类掷骰必经本工具。什么情况调：结果不确定且带后果的当口——①技能检定（说服/察觉/隐匿）；②纯属性检定（破门/掰腕）；③豁免检定（法术/毒素/陷阱/坠崖，传 save:true+stat）；④专注维持：专注中受伤→只传 damage（内部自动按 CON 豁免解析，DC=max(10,⌊伤/2⌋) 自动算，不填 dc）；环境现象（浪打/颠簸）→stat:'con'+save:true+dc；⑤对抗检定（擒抱/隐匿对察觉/抢夺）：双方各调一次，dc 都不填，回执只报骰值，你比大小；⑥群体检定（全队潜行）：每人各调一次（照常填 dc），过半成功=全队成功，你数数。怎么填：context=一句已定型的剧情梗概（必填，骰值只裁成败、不得覆盖走向）；能力来源三选一——用技能→skill（自动解析属性+熟练+专精+状态）、纯属性或豁免→stat（只加属性调整值；save:true 时豁免熟练命中则加）、面板外临时加值→modifier（直值或骰式，祝福类+1d4 写 '1d4'）。预期效果：回执给 d20+修正=总值的完整分解与成败（dc 缺省时只报总值），成败即最终事实、后续剧情必须遵守。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概（反作弊铁则）：从上次玩家消息到本判定点之间你对剧情走向的承诺，骰值只裁定此刻成败、不得覆盖它。" },
    "who": { "type": "string", "description": "检定者姓名（默认玩家），按名读面板。" },
    "skill": { "type": "string", "description": "技能名（隐匿/说服/察觉等）——凡用技能的检定都填它，自动解析属性+熟练+专精+状态。" },
    "stat": { "type": "string", "description": "裸属性 str/dex/con/int/wis/cha——不用技能的检定（破门/掰腕），或豁免时与 save:true 连用。" },
    "save": { "type": "boolean", "description": "豁免标记——法术/毒素/陷阱豁免传 true（配 stat）：修正=属性调整值+豁免熟练（面板 save_prof 命中则加）。" },
    "modifier": { "type": "string", "description": "面板外临时加值——直值（'-2'/'3'）或骰式（'1d4'，祝福/指引类），回执分解单列。" },
    "dc": { "type": "integer", "description": "难度标尺 5极易/10容易/15中等/20困难/25极难/30近乎不可能。两类不填：对抗（比大小）、专注受伤（damage 内算）。" },
    "mode": { "type": "string", "description": "优劣势 normal|adv|dis，默认 normal。来源判断=DM（空间/隐形/伏击），多源不叠、优+劣抵消。" },
    "damage": { "type": "integer", "description": "专注维持·受伤入口：传了本参即专注判定，内部自动按 CON 豁免解析（属性+豁免熟练），DC=max(10,⌊伤/2⌋) 自动算，不填 dc。环境现象（浪打/颠簸）不传本参，改走 stat:'con'+save:true+dc。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rnd, rollExpr, mod, pbOf, readChar, statusesMod, SKILL_STAT, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context(剧情梗概——反作弊铁则)')

const char = readChar(a.who ?? '玩家')
const PB = pbOf(char.level ?? 1)
let bonus = 0; const parts = []
let stat = null, save = false, focus = false

if (a.damage !== undefined) {            // 专注维持·受伤入口：内部=一次 CON 豁免
  stat = 'con'; save = true; focus = true
} else if (a.skill) {
  const st = SKILL_STAT[a.skill] ?? a.stat ?? 'dex'
  const v = char[st]; v === undefined && err(`!角色无属性键 ${st}（键裁剪?）`)
  bonus += mod(v); parts.push(`${st}${mod(v) >= 0 ? '+' + mod(v) : mod(v)}`)
  if ((char.skill_prof ?? []).includes(a.skill)) { bonus += PB; parts.push(`熟练+${PB}`) }
  if ((char.expertise ?? []).includes(a.skill)) { bonus += PB; parts.push(`专精+${PB}`) }
} else if (a.stat) {
  stat = a.stat; save = a.save === true
} else if (a.modifier !== undefined) {
  const r = rollExpr(a.modifier)
  if (r) { bonus += r.total; parts.push(`临时${a.modifier}=${r.total}`) }
  else { const n = +a.modifier; Number.isFinite(n) || err(`!modifier 不合法:${a.modifier}`); bonus += n; parts.push(`临时${n >= 0 ? '+' + n : n}`) }
} else err('缺修正值来源:skill(技能)/stat(属性)或 modifier(直值)三选一')
if (a.save === true && !stat && !focus) err('save:true 须配 stat(豁免走属性,不走技能)')
if (stat) {
  const v = char[stat]; v === undefined && err(`!角色无属性键 ${stat}`)
  const m = mod(v); bonus += m; parts.push(`${stat}${m >= 0 ? '+' + m : m}`)
  if (save && (char.save_prof ?? []).includes(stat)) { bonus += PB; parts.push(`豁免熟练+${PB}`) }
}
bonus += statusesMod(char, stat ?? (a.skill ? (SKILL_STAT[a.skill] ?? a.stat) : null))

let dc, label
if (focus) { dc = Math.max(10, Math.floor(a.damage / 2)); label = `专注维持 DC${dc}(=max(10,⌊${a.damage}/2⌋))` }
else if (a.dc !== undefined) { dc = a.dc; label = `DC ${dc}` }

const d1 = rnd(20), d2 = rnd(20)
const d = a.mode === 'adv' ? Math.max(d1, d2) : a.mode === 'dis' ? Math.min(d1, d2) : d1
const total = d + bonus
const tail = a.mode === 'adv' ? `(优:${d1},${d2})` : a.mode === 'dis' ? `(劣:${d1},${d2})` : ''
const tag = a.skill ? ` · ${a.skill}` : focus ? ' · 专注维持' : save ? ' · 豁免' : ''
console.log(`[判定 · ${char.name ?? a.who ?? '玩家'}${tag}]`)
console.log(`  判定: d20${bonus ? (bonus >= 0 ? '+' + bonus : bonus) : ''}${tail} = ${total} ${dc === undefined ? '——无 DC,与对侧比大小' : `vs ${label} → ${total >= dc ? '成功' : '失败'}`}`)
console.log(`  修正: ${parts.join(' · ') || '无'}`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
