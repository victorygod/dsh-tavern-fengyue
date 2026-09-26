/** @tavern-schema
{
  "description": "施法链结算器——一次施法（攻击型/豁免型/治疗型/自动型）的闸区+效果+写盘一次走完；一切施法必经本工具。什么情况调：角色施放法术——玩家与同伴照面板施法族全自动，施法怪照 statblock 声明（spawn 时已备施法族）。怎么填：基线=spell（英文原名）+caster；targets=受击/受影响者（攻击型与治疗型单名、豁免型多人逗号分隔）；升环传 as_level，源库无升环字段传 dice 覆盖；治疗型传 restore:true + dice（照法术正文抄，如 1d8+施法属性）；自动命中型（魔法飞弹类）传 dice（多发合写如 3d4+3）+targets，逐目标独立掷。预期效果：闸区自动过（位可用/升环/仪式免位/戏法免位）；攻击型走命中链、豁免型逐目标豁免（half_on_save 自动半伤）、治疗钳上限苏醒双清、自动型直接落血；法术位、专注（再施专注法术自动顶替旧的，RAW）、目标生命当拍落盘并给落盘行；目标归 0 时 PC/同伴濒死计数起算、怪默认即死（死活你判）。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "spell": { "type": "string", "required": true, "description": "法术名（英文原文，如 fireball）——按名读 lorebook frontmatter（环位/仪式/专注/豁免/伤害/攻击型）。" },
    "caster": { "type": "string", "description": "施法者姓名（默认玩家）——按名读施法族（施法属性/位表）。" },
    "targets": { "type": "string", "description": "受击/受影响者名单，逗号分隔——攻击型与治疗型单名，豁免型可多名（逐目标豁免）；写盘定位。" },
    "as_level": { "type": "integer", "description": "升环环位（≥法术原环位）——耗该环位。" },
    "dice": { "type": "string", "description": "骰式覆盖——升环增值（源库无升环字段时照法术正文转写）、治疗型与自动型必传。" },
    "restore": { "type": "boolean", "description": "治疗型标记——治疗数值由本工具内联结算（来源路由律：法术治疗不走 heal 接龙）；配 dice+targets。" },
    "mode": { "type": "string", "description": "攻击型法术的优劣势 normal|adv|dis，默认 normal；来源你判。" }
  }
}
*/
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { rnd, rollExpr, mod, pbOf, readChar, findCharFile, readFM, resolveTarget, resolveSave, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.spell || err('缺必填 spell')
const casterName = a.caster ?? '玩家'
const char = readChar(casterName)
;(char.caster_attr === undefined || char.caster_attr === null) && err('!无施法能力（该角色无施法族）')
const casterFile = findCharFile(casterName)

const fm = readFM(`spells/${a.spell.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`)
fm.name || err(`!法术查不到:${a.spell}`)
const lvl = fm.level ?? 0
const asL = a.as_level ?? lvl
asL < lvl && err(`!升环校验失败:as_level(${asL}) < 法术环位(${lvl})`)

// ── 闸区:位检(戏法/仪式免位)·专注 RAW 覆写 ──
const gate = []
let slotKey = null
if (fm.ritual === true) gate.push('仪式免位(+10 分钟)')
else if (lvl === 0) gate.push('戏法免位')
else {
  slotKey = 'slots_l' + Math.max(asL, 1)
  const have = char[slotKey] ?? 0
  have >= 1 || err(`!无 ${asL} 环位可施(现 ${have})——改日/换低环/玩家决策`)
  gate.push(`位检:✓(${slotKey} 剩 ${have})`)
}
let concLine = '专注:不需'
if (fm.concentration === true) {
  concLine = char.concentrating && char.concentrating !== fm.name
    ? `专注:顶替旧专注「${char.concentrating}」→${fm.name}(RAW 覆写,自动弃旧)`
    : `专注:✓(本术需专注)`
}
const lines = [`[施法 · ${casterName}→${fm.name}${asL > lvl ? '(升 ' + asL + ' 环)' : ''}]`, `  闸区: ${gate.join(' · ')} · ${concLine}`]
const DC = 8 + pbOf(char.level ?? 1) + mod(char[char.caster_attr] ?? 10)
const dice = a.dice ?? fm.damage
const targets = String(a.targets ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean)

// hp 减损落盘(与 damage 同律:抗免由调用方先应用;0HP 受击自动落败;0HP 分叉)
function hurt(t, dmg) {
  const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
  const before = tg.j.hp ?? 0, after = Math.max(0, before - dmg)
  tg.j.hp = after
  let extra = ''
  if (before === 0 && dmg > 0 && tg.growth) { const f0 = tg.j.death_fail ?? 0; tg.j.death_fail = Math.min(3, f0 + 1); extra = ` · death_fail ${f0}→${tg.j.death_fail}` }
  saveChar(tg.file, tg.j)
  lines.push(`  落盘: ${t} hp ${before}→${after}${extra} [${tg.file}]`)
  if (extra) lines.push(`  ◇ 0HP 受击——濒死败+1`)
  else if (after === 0 && dmg > 0) lines.push(`  ◇ 0HP——${tg.growth ? 'PC/同伴:濒死计数起算' : '怪:RAW 默认即死,死活你判'}`)
}
function resistNote(tg, typeKey) {
  if (!typeKey) return dmg => dmg
  if ((tg.immune ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) return () => { lines.push('  抗性: 免疫→0'); return 0 }
  if ((tg.resist ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) return d => { const h = Math.floor(d / 2); lines.push('  抗性: 减半↓'); return h }
  return d => d
}

if (a.restore === true) {                      // 治疗型内联(路由律:法术治疗不走 heal 接龙)
  const t = targets[0]; t || err('!治疗型需 targets(单目标)')
  dice || err('!治疗型传 dice(照法术正文抄,如 1d8+施法属性)')
  const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
  const r = rollExpr(dice); r || err(`!骰式不合法:${dice}`)
  const before = tg.j.hp ?? 0
  const after = Math.min(tg.j.hp_max ?? Infinity, before + r.total)
  const woke = before === 0 && after > 0
  tg.j.hp = after
  let extra = ''
  if (woke) { tg.j.death_success = 0; tg.j.death_fail = 0; extra = ' · 濒死计数双清' }
  saveChar(tg.file, tg.j)
  lines.push(`  治疗判定: ${dice} = ${r.total}`)
  lines.push(`  落盘: ${t} hp ${before}→${after}${after < before + r.total ? '(钳上限)' : ''}${extra} [${tg.file}]`)
  if (woke) lines.push(`  ◇ 已苏醒`)
} else if (fm.attack_type) {                   // 攻击型:命中链(attack.spell 已删,唯一入口)
  const t = targets[0]; t || err('!攻击型法术需 targets(单目标)')
  const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
  const ab = pbOf(char.level ?? 1) + mod(char[char.caster_attr] ?? 10)
  const d1 = rnd(20), d2 = rnd(20)
  const d = a.mode === 'adv' ? Math.max(d1, d2) : a.mode === 'dis' ? Math.min(d1, d2) : d1
  const nat20 = d === 20, nat1 = d === 1
  const hit = nat20 || (!nat1 && d + ab >= tg.ac)
  lines.push(`  命中判定: d20+${ab}${a.mode === 'adv' ? `(优:${d1},${d2})` : a.mode === 'dis' ? `(劣:${d1},${d2})` : ''} = ${d + ab} vs AC ${tg.ac}(${tg.source}) → ${nat1 ? 'nat1 必失' : nat20 ? 'nat20+暴击' : hit ? '命中' : '未命中'}`)
  if (hit && dice) {
    const ex = nat20 ? String(dice).replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : String(dice)
    const r = rollExpr(ex); r || err(`!骰式不合法:${ex}`)
    const typeKey = String(fm.damage_type ?? '').toLowerCase()
    const dmg = resistNote(tg, typeKey)(r.total)
    lines.push(`  伤害判定: ${ex} = ${dmg} ${fm.damage_type ?? ''}`)
    hurt(t, dmg)
  }
} else if (fm.save) {                          // 豁免型:逐目标(half_on_save 自动半伤)
  targets.length || err('!豁免型法术需 targets')
  const save = String(fm.save).toLowerCase()
  const rolls = []
  for (const t of targets) {
    const saveBonus = resolveSave(t, save)
    saveBonus != null || err(`!查无目标存档:${t}`)
    const d = rnd(20), total = d + saveBonus, pass = total >= DC
    rolls.push({ t, pass })
    lines.push(`  豁免判定 ${t}: d20+${saveBonus} = ${total} vs DC ${DC} → ${pass ? '通过' : '失败'}`)
  }
  if (dice) for (const r of rolls) {
    const roll = rollExpr(String(dice)); roll || err(`!骰式不合法:${dice}`)
    const half = r.pass && fm.half_on_save === true
    lines.push(`  伤害判定: ${r.t} ${dice}=${roll.total}${half ? '(半伤)' : ''} → ${half ? Math.floor(roll.total / 2) : roll.total} ${fm.damage_type ?? ''}`)
    hurt(r.t, half ? Math.floor(roll.total / 2) : roll.total)
  }
} else if (dice !== undefined) {               // 自动型内联(路由律:魔法飞弹类不走 damage 接龙)——自动命中,逐目标独立掷
  targets.length || err('!自动伤害型需 targets')
  for (const t of targets) {
    const roll = rollExpr(String(dice)); roll || err(`!骰式不合法:${dice}`)
    lines.push(`  伤害判定: ${t} ${dice} = ${roll.total}(自动命中)`)
    hurt(t, roll.total)
  }
}                                             // 其余=无掷效果(护盾/隐形):只过闸与落位

// ── 施法者写盘:位耗 + 专注覆写 ──
// 重读实盘再写:自施法(目标=施法者)时目标写盘先行,用开头的陈旧快照整档回写会把 hp 拍回去(clobber)。
if (slotKey || fm.concentration === true) {
  const fresh = JSON.parse(readFileSync(casterFile, 'utf8'))
  if (slotKey) { const b = fresh[slotKey] ?? 0; fresh[slotKey] = b - 1; lines.push(`  落盘: ${slotKey} ${b}→${b - 1} [${casterFile}]`) }
  if (fm.concentration === true) { const old = fresh.concentrating ?? '无'; fresh.concentrating = fm.name; lines.push(`  落盘: concentrating ${old}→${fm.name} [${casterFile}]`) }
  saveChar(casterFile, fresh)
}
lines.push(`  ◇ 梗概: ${a.context}`)
lines.push(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
console.log(lines.join('\n'))
