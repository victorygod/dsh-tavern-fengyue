/** @tavern-schema
{
  "description": "攻击链结算器：命中判定（d20+攻击加值 vs 目标 AC）→ 命中则伤害判定（nat20 自动翻骰）→ 抗性/免疫/易伤应用（↓取整/归零/×2）。输出伤害增量，不落盘、不输出目标绝对值（死活=DM 单步叙述+尾代终写）。怪物攻击由 DM 照 statblock 转写 modifier/dice。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概（反作弊铁则）：你对剧情走向的承诺，骰值只裁定此刻成败、不得覆盖它。" },
    "who": { "type": "string", "description": "攻击者姓名（默认玩家），按名读面板取属性/熟练/持位武器。" },
    "target": { "type": "string", "required": true, "description": "目标名（state.md 战斗节敌行或 characters/<名>.json），AC/抗免自动解析。" },
    "weapon": { "type": "string", "description": "武器名（默认面板持位武器），决定骰式/灵巧/射程属性。" },
    "spell": { "type": "string", "description": "法术攻击型才传：法术名（升环请传 dice 覆盖）。" },
    "dice": { "type": "string", "description": "显式骰式（怪物转写/升环覆盖），如 2d6+3。" },
    "modifier": { "type": "integer", "description": "攻击加值直值（怪物转写时用）。" },
    "type": { "type": "string", "description": "伤害类型（转写时用）。" },
    "extra_dice": { "type": "string", "description": "特征骰（偷袭等），条件是否满足=DM 判断，暴击同翻。" },
    "mode": { "type": "string", "description": "优劣势 normal|adv|dis。" },
    "cover_bonus": { "type": "integer", "description": "掩体加值 0|2|5，空间判断=DM。" }
  }
}
*/
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { d20, rollExpr, mod, pb, readChar, readFM, equipmentFM, combatFoe, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context(反作弊铁则)')
a.target || err('缺 target')
const who = a.who ?? '玩家'
const char = readChar(who)
const PB = pb(char.level ?? 1)

// ── 目标解析:state.md 战斗节敌行优先,退化 character 档派生 ──
let ac = 10, resist = [], immune = [], vuln = []
const row = combatFoe(a.target)
if (row) {
  ac = row.ac ?? 10
  if (row.path) { const fm = readFM(row.path); resist = fm.damage_resistances ?? []; immune = fm.damage_immunities ?? []; vuln = fm.damage_vulnerabilities ?? [] }
}
if (!ac || ac === 10) {
  const f = existsSync(`characters/${a.target}.json`) ? `characters/${a.target}.json` : null
  if (f) {
    const j = JSON.parse(readFileSync(f, 'utf8'))
    // AC 派生与 ui_data derive 同律(2026-09-22 巡检):ac_dex_bonus:true=加敏(带 cap 取 min);
    // 键缺席=重甲定值不加敏——原实现重甲也加 dexM,链甲 AC 虚高。
    const dexM = mod(j.dex ?? 10)
    ac = 10 + dexM
    if (j.armor) { const fm = equipmentFM(j.armor); if (fm) ac = fm.ac_dex_bonus === true ? fm.ac_base + (fm.ac_dex_cap ? Math.min(dexM, fm.ac_dex_cap) : dexM) : fm.ac_base }
    if (j.shield === true) ac += 2
    resist = j.resist ?? []; immune = j.immune ?? []; vuln = j.vulnerabilities ?? []
  }
}
const acFinal = ac + (a.cover_bonus ?? 0)

// ── 攻击加值+伤害骰式解析 ──
let atkBonus, dmgDice, dmgMod = 0, dmgType = ''
if (a.spell) {
  const fm = readFM(`spells/${a.spell.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`)
  fm.damage || err(`!法术无伤害数据:${a.spell}(升环请传 dice)`)
  dmgDice = a.dice ?? fm.damage; dmgType = a.spell
  atkBonus = PB + mod(char[char.caster_attr ?? 'int'] ?? 10)
} else {
  const wname = (a.weapon ?? (char.weapons ?? [])[0] ?? '').replace(/\s*[x×]\s*\d+\s*$/, '').trim()
  const fm = equipmentFM(wname)
  if (a.dice !== undefined && a.modifier !== undefined) {          // 怪物/手动转写
    dmgDice = a.dice; atkBonus = a.modifier; dmgType = a.type ?? ''
  } else if (fm) {
    dmgDice = fm.damage; dmgType = String(fm.damage_type ?? '').toLowerCase()
    const prop = JSON.stringify(fm.properties ?? '').toLowerCase()
    const finesse = prop.includes('finesse'), ranged = prop.includes('range') && !thrownOnly(prop), thrown = prop.includes('thrown')
    const st = finesse || thrown ? (mod(char.str ?? 10) >= mod(char.dex ?? 10) ? 'str' : 'dex') : ranged ? 'dex' : 'str'
    const prof = (char.weapon_prof ?? []).some(p => JSON.stringify(fm).toLowerCase().includes(String(p).toLowerCase()))
    atkBonus = (a.modifier ?? 0) || (mod(char[st] ?? 10) + (prof ? PB : 0))
    dmgMod = a.modifier !== undefined ? 0 : mod(char[st] ?? 10)
    if (ranged && !thrown && (a.cover_bonus ?? 0) === 0) {} // 近身威胁劣势=DM mode 判断,工具不猜
  } else err(`!武器查不到:${wname || '(未传)'}——可传 dice+modifier 转写,或核对装备名`)
}
function thrownOnly(prop) { return prop.includes('thrown') && !prop.includes('range') }

// ── 命中→伤害→抗性 ──
const d = d20(a.mode), nat20 = d === 20, nat1 = d === 1
const hit = nat20 || (!nat1 && d + atkBonus >= acFinal)
console.log(`[攻击 · ${who}→${a.target} · ${a.weapon ?? a.spell ?? '转写'}]`)
console.log(`  命中判定: d20${atkBonus ? (atkBonus >= 0 ? '+' + atkBonus : atkBonus) : ''}${a.cover_bonus ? '-' + a.cover_bonus + '(掩体)' : ''} = ${d + atkBonus} vs AC ${acFinal} → ${nat1 ? 'nat1 必失' : nat20 ? 'nat20 必中+暴击' : hit ? '命中' : '未命中'}`)
if (hit) {
  let dmg = 0, parts = []
  for (const ex of [dmgDice, ...(a.extra_dice ? [a.extra_dice] : [])]) {
    const base = nat20 ? ex.replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : ex
    const r = rollExpr(base); r || err(`!骰式不合法:${base}`)
    dmg += r.total; parts.push(`${base}=${r.total}`)
  }
  dmg += dmgMod
  const typeKey = String(dmgType).toLowerCase()
  if ((immune ?? []).some(r => typeKey.includes(String(r).toLowerCase()))) { dmg = 0; parts.push('免疫→0') }
  else if ((resist ?? []).some(r => typeKey.includes(String(r).toLowerCase()))) { dmg = Math.floor(dmg / 2); parts.push('抗性→↓取整') }
  else if ((vuln ?? []).some(r => typeKey.includes(String(r).toLowerCase()))) { dmg *= 2; parts.push('易伤→×2') }
  console.log(`  伤害判定: ${parts.join(' + ')} = ${dmg}${dmgType ? ' ' + dmgType : ''}（增量——目标现存 HP 由 DM 累计叙述/尾代落账）`)
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 骰值只裁定此刻成败,不得覆盖走向`)
