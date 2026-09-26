/** @tavern-schema
{
  "description": "武器攻击链结算器——攻检、命中伤害、抗性应用、扣血落盘一次走完；一切武器攻击必经本工具（法术攻击走 cast）。什么情况调：近战/远程武器攻击——玩家与同伴照面板武器全自动，怪物照 statblock 转写。怎么填：基线只传 who+target+weapon，骰式/属性择取/熟练/AC/抗免全自动；特殊通道——怪物攻击或后手骰式直传 dice+modifier+type（传 dice 即不走面板武器解析），off_hand:true 表后手（攻检照常、伤害不加属性）；目标剧情态与档不符（如弃盾）传 ac 直值（回执标「转写」，目标须有档——即兴目标先 spawn_npc 建档）。预期效果：回执给攻检（双骰透明）、伤害分解、抗性应用与落盘行；目标归 0 时 PC/同伴濒死计数起算、怪默认即死（死活你判）。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "who": { "type": "string", "description": "攻击者姓名（默认玩家），按名读面板。" },
    "target": { "type": "string", "required": true, "description": "目标名——AC/抗免自动读档（敌/友行或角色档 name 兜底），查无且未传 ac 则报错。" },
    "weapon": { "type": "string", "description": "武器名（默认面板持位武器），决定骰式/灵巧/射程——全工具解析。" },
    "dice": { "type": "string", "description": "伤害骰式直传（怪物转写/覆盖），如 1d6+2——传了即不走面板武器解析。" },
    "modifier": { "type": "integer", "description": "攻击加值直传（怪物转写）——只做攻检加值，伤害侧不加属性。" },
    "off_hand": { "type": "boolean", "description": "后手武器（双持后手轻武器）——攻检照常，伤害不加属性调整值。" },
    "type": { "type": "string", "description": "伤害类型（转写时用）：穿刺/挥砍/火焰等。" },
    "extra_dice": { "type": "string", "description": "特征骰（偷袭/神圣打击），暴击同翻；条件是否满足你判。" },
    "mode": { "type": "string", "description": "优劣势 normal|adv|dis，默认 normal。来源判断=DM（空间/隐形/伏击），多源不叠、优+劣抵消。" },
    "cover_bonus": { "type": "integer", "description": "掩体加值 0|2|5——空间判断=DM。" },
    "ac": { "type": "integer", "description": "目标 AC 直值（逃生舱：剧情态与档不符如弃盾——回执标「转写」；即兴目标须先 spawn_npc 建档，无档即报错）。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rnd, rollExpr, mod, pbOf, readChar, equipmentFM, resolveTarget, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context(剧情梗概——反作弊铁则)')
a.target || err('缺必填 target')
const who = a.who ?? '玩家'
const char = readChar(who)
const PB = pbOf(char.level ?? 1)

// ── 目标解析(咽喉:数值走档;查无=err;ac 转写仅限有档目标的剧情态覆盖——即兴先 spawn,写盘需要档)──
const tg = resolveTarget(a.target)
if (!tg && a.ac === undefined) err(`!查无目标 AC:${a.target}——spawn_npc 建档,或传 ac 转写`)
if (!tg && a.ac !== undefined) err(`!即兴目标无档:${a.target}——spawn_npc 建档后再打(ac 转写仅用于有档目标的剧情态覆盖如弃盾)`)
const ac = a.ac ?? tg.ac
const acSource = a.ac !== undefined ? '转写' : tg.source
const acFinal = ac + (a.cover_bonus ?? 0)

// ── 攻击加值+伤害骰式 ──
let atkBonus, dmgDice, dmgMod = 0, dmgType = ''
if (a.dice !== undefined) {                       // 转写(怪物/后手/覆盖):伤害侧永不加属性
  dmgDice = a.dice; atkBonus = a.modifier ?? 0; dmgType = a.type ?? ''
} else {
  const wname = (a.weapon ?? (char.weapons ?? [])[0] ?? '').replace(/\s*[x×]\s*\d+\s*$/, '').trim()
  const fm = equipmentFM(wname)
  fm || err(`!武器查不到:${wname || '(未传)'}——传 dice+modifier 转写,或核对面板`)
  dmgDice = fm.damage; dmgType = String(fm.damage_type ?? '').toLowerCase()
  const prop = JSON.stringify(fm.properties ?? '').toLowerCase()
  const finesse = prop.includes('finesse'), ranged = prop.includes('range') && !thrownOnly(prop), thrown = prop.includes('thrown')
  const st = finesse || thrown ? (mod(char.str ?? 10) >= mod(char.dex ?? 10) ? 'str' : 'dex') : ranged ? 'dex' : 'str'
  const prof = (char.weapon_prof ?? []).some(p => JSON.stringify(fm).toLowerCase().includes(String(p).toLowerCase()))
  atkBonus = a.modifier !== undefined ? a.modifier : mod(char[st] ?? 10) + (prof ? PB : 0)   // 吞零修复:显式 0 也尊重
  dmgMod = a.off_hand === true || a.modifier !== undefined ? 0 : mod(char[st] ?? 10)        // 后手/转写:伤害不加属性
}
function thrownOnly(prop) { return prop.includes('thrown') && !prop.includes('range') }

// ── 命中(双骰透明)→ 伤害(暴击翻骰+特征骰)→ 抗免易 → 落盘 ──
const d1 = rnd(20), d2 = rnd(20)
const d = a.mode === 'adv' ? Math.max(d1, d2) : a.mode === 'dis' ? Math.min(d1, d2) : d1
const nat20 = d === 20, nat1 = d === 1
const hit = nat20 || (!nat1 && d + atkBonus >= acFinal)
console.log(`[攻击 · ${who}→${a.target} · ${a.weapon ?? '转写'}]`)
console.log(`  命中判定: d20${atkBonus ? (atkBonus >= 0 ? '+' + atkBonus : atkBonus) : ''}${a.mode === 'adv' ? `(优:${d1},${d2})` : a.mode === 'dis' ? `(劣:${d1},${d2})` : ''}${a.cover_bonus ? '-' + a.cover_bonus + '(掩体)' : ''} = ${d + atkBonus} vs AC ${acFinal}(${acSource}) → ${nat1 ? 'nat1 必失' : nat20 ? 'nat20 必中+暴击' : hit ? '命中' : '未命中'}`)
if (hit) {
  let dmg = 0; const parts = []
  for (const ex of [dmgDice, ...(a.extra_dice ? [a.extra_dice] : [])]) {
    const base = nat20 ? ex.replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : ex
    const r = rollExpr(base); r || err(`!骰式不合法:${base}`)
    dmg += r.total; parts.push(`${base}=${r.total}${nat20 ? '(暴击已翻骰)' : ''}`)
  }
  dmg += dmgMod
  const typeKey = String(dmgType).toLowerCase()
  let resNote = ''
  if (typeKey && (tg.immune ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) { dmg = 0; resNote = '(免疫→0)' }
  else if (typeKey && (tg.resist ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) { dmg = Math.floor(dmg / 2); resNote = '(抗性→↓取整)' }
  else if (typeKey && (tg.vuln ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) { dmg *= 2; resNote = '(易伤→×2)' }
  console.log(`  伤害判定: ${parts.join(' + ')}${dmgMod ? (dmgMod >= 0 ? '+' + dmgMod : dmgMod) : ''} = ${dmg}${dmgType ? ' ' + dmgType : ''}${resNote}`)
  const before = tg.j.hp ?? 0
  const after = Math.max(0, before - dmg)
  tg.j.hp = after
  let extra = ''
  if (before === 0 && dmg > 0 && tg.growth) { const f0 = tg.j.death_fail ?? 0; tg.j.death_fail = Math.min(3, f0 + (nat20 ? 2 : 1)); extra = ` · death_fail ${f0}→${tg.j.death_fail}` }
  saveChar(tg.file, tg.j)
  console.log(`  落盘: ${a.target} hp ${before}→${after}${extra} [${tg.file}]`)
  if (extra) console.log(`  ◇ 0HP 受击——濒死败+${nat20 ? 2 : 1}${nat20 ? '(暴击源)' : ''}`)
  else if (after === 0 && dmg > 0) console.log(`  ◇ 0HP——${tg.growth ? 'PC/同伴:濒死计数起算' : '怪:RAW 默认即死,死活你判'}`)
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
