/** @tavern-schema
{
  "description": "判定结算器——一切判定类掷骰必经本工具。何时调：结果不确定且带后果的当口，npc对话和做决定绝对不要调用本工具！怎么调：用技能传 skill；裸属性或豁免传 stat（豁免加 save:true）；对抗比大小双方各调、不传 dc；环境现象传 stat+save+dc；专注维持受伤只传 damage；群体检定每人各调，过半成功＝全队成功。细则见各参数。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概（反作弊铁则）：从上次玩家消息到本判定点之间你对剧情走向的承诺，骰值只裁定此刻成败、不得覆盖它。" },
    "who": { "type": "string", "description": "检定者姓名（默认玩家），按名读面板。" },
    "skill": { "type": "string", "description": "技能名（隐匿/说服/察觉等）——凡用技能的检定都填它，自动解析属性+熟练+专精+状态。" },
    "stat": { "type": "string", "description": "裸属性 str/dex/con/int/wis/cha——不用技能的检定（破门/掰腕），或豁免时与 save:true 连用。" },
    "save": { "type": "boolean", "description": "豁免标记——法术/毒素/陷阱豁免传 true（配 stat）：修正=属性调整值+豁免熟练（面板 save_prof 命中则加）。" },
    "modifier": { "type": "string", "description": "面板外临时加值——直值（'-2'/'3'）或骰式（'1d4'，祝福/指引类），回执分解单列。" },
    "dc": { "type": "integer", "description": "难度标尺 5极易/10容易/15中等/20困难/25极难/30近乎不可能。两类不填：对抗（比大小）、专注受伤（damage 内算）。" },
    "mode": { "type": "string", "description": "优劣势 normal|adv|dis，默认 normal。来源判断=DM（空间/隐形/伏击），多源不叠、优+劣抵消。" },
    "damage": { "type": "integer", "description": "专注维持·受伤入口：传了本参即专注判定，内部自动按 CON 豁免解析（属性+豁免熟练），DC=max(10,⌊伤/2⌋) 自动算，不填 dc。环境现象（浪打/颠簸）不传本参，改走 stat:'con'+save:true+dc。" },
    "consume": { "type": "string", "description": "消费型状态名（如 Bardic Inspiration）——本检定用掉它并加其骰值，用掉即从状态表摘除。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rnd, rollExpr, mod, pbOf, readChar, findCharFile, saveChar, rollMods, dropConcentration, consumeBonus, hasFeature, SKILL_STAT, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
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
  const prof = (char.skill_prof ?? []).includes(a.skill)
  const exp = (char.expertise ?? []).includes(a.skill)
  if (prof) { bonus += PB; parts.push(`熟练+${PB}`) }
  if (exp) { bonus += PB; parts.push(`专精+${PB}`) }
  else if (!prof && hasFeature(char, 'jack of all trades')) { const h = Math.floor(PB / 2); bonus += h; parts.push(`万事通+${h}`) }   // 未熟练技能半熟练(2026-10-03)
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
  if (save && ((char.save_prof ?? []).includes(stat) || hasFeature(char, 'diamond soul') || (stat === 'wis' && hasFeature(char, 'slippery mind')))) { bonus += PB; parts.push(`豁免熟练+${PB}`) }   // 钻石之魂/油滑心智=特征补熟练(2026-10-03)
  if (save) {  // B1/B2(2026-09-28):豁免掷吃 save/attack_save 修正——statusesMod 旧正则通道(effect 文本式)退役
    const bm = rollMods(char, ['save', 'attack_save'])
    bonus += bm.flat; parts.push(...bm.parts)
  }
}
// 消费型状态(consume,2026-09-28 F2):用掉即摘+加骰——写盘第二例外(资源消耗是机械事实,与专注断链同型)
if (a.consume) {
  const cb = consumeBonus(char, a.consume)
  if (cb) {
    const r = rollExpr(cb) || err(`骰式不合法:${cb}`)
    bonus += r.total; parts.push(`${a.consume}:${cb}=${r.total}`)
    const cf = findCharFile(a.who ?? '玩家'); cf && saveChar(cf, char)
  }
}

let dc, label
if (focus) { dc = Math.max(10, Math.floor(a.damage / 2)); label = `专注维持 DC${dc}(=max(10,⌊${a.damage}/2⌋))` }
else if (a.dc !== undefined) { dc = a.dc; label = `DC ${dc}` }

const d1 = rnd(20), d2 = rnd(20)
let d = a.mode === 'adv' ? Math.max(d1, d2) : a.mode === 'dis' ? Math.min(d1, d2) : d1
// 可靠天赋(2026-10-03):熟练技能的检定 d20<10 抬到 10(骰面,非加值)——机械进工具
let rt = false
if (a.skill && hasFeature(char, 'reliable talent') && ((char.skill_prof ?? []).includes(a.skill) || (char.expertise ?? []).includes(a.skill))) {
  if (d < 10) { d = 10; rt = true }
}
const total = d + bonus
const tail = a.mode === 'adv' ? `(优:${d1},${d2})` : a.mode === 'dis' ? `(劣:${d1},${d2})` : ''
const tag = a.skill ? ` · ${a.skill}` : focus ? ' · 专注维持' : save ? ' · 豁免' : ''
console.log(`[判定 · ${char.name ?? a.who ?? '玩家'}${tag}]`)
console.log(`  判定: d20${bonus ? (bonus >= 0 ? '+' + bonus : bonus) : ''}${tail}${rt ? '(可靠天赋抬10)' : ''} = ${total} ${dc === undefined ? '——无 DC,与对侧比大小' : `vs ${label} → ${total >= dc ? '成功' : '失败'}`}`)
if (focus && dc !== undefined && total < dc) {   // 专注维持失败→断链级联(唯一写盘例外,audit-fixes §7:判词即写)
  const dr = dropConcentration(char.name ?? a.who ?? '玩家')
  for (const r of dr.removed) console.log(`  落盘: ${r.name} statuses −「${r.key}」 [${r.file}]`)
  if (dr.old) console.log(`  落盘: concentrating ${dr.old}→无 [${dr.casterFile}]`)
}
console.log(`  修正: ${parts.join(' · ') || '无'}`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
