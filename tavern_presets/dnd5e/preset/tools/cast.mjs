/** @tavern-schema
{
  "description": "施法链结算器：闸区三检（位表可用性/升环校验/专注冲突，仪式免位）→ 攻击型走命中链 / 豁免型逐目标 save（half_on_save 自动半伤）→ 伤害增量。DC=8+PB+施法属性调整值 内算。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概（反作弊铁则）。" },
    "spell": { "type": "string", "required": true, "description": "法术名（英文原文，如 fireball）。" },
    "caster": { "type": "string", "description": "施法者姓名（默认玩家）。" },
    "as_level": { "type": "integer", "description": "升环环位（≥ 法术原环位）。" },
    "budget_offset": { "type": "integer", "description": "本回合已耗同环位数（回执中继，施法连发时传）。" },
    "targets": { "type": "string", "description": "目标名逗号分隔（攻击型单目标/豁免型多目标）。" },
    "dice": { "type": "string", "description": "升环覆盖骰式（源库无升环字段时 DM 转写）。" },
    "mode": { "type": "string", "description": "攻击型法术的优劣势 normal|adv|dis。" }
  }
}
*/
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { d20, rollExpr, mod, pb, readChar, readFM, combatFoe, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.spell || err('缺 spell')
const casterName = a.caster ?? '玩家'
const char = readChar(casterName)

// ── 族头检查(键裁剪律:族头缺席=报错) ──
;(char.caster_attr === undefined || char.caster_attr === null) && err('!无施法能力（该角色无施法族）')

// ── 法术解析 ──
const fm = readFM(`spells/${a.spell.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`)
fm.name || err(`!法术查不到:${a.spell}`)
const lvl = fm.level ?? 0
const asL = a.as_level ?? lvl
asL < lvl && err(`!升环校验失败:as_level(${asL}) < 法术环位(${lvl})`)

// ── 闸区三检 ──
const gate = []
if (fm.ritual === true) gate.push('位检:仪式施法免位(+10 分钟)')
else {
  const k = 'slots_l' + Math.max(asL, 1)
  const have = char[k] ?? 0, used = a.budget_offset ?? 0
  have - used >= 1 || err(`!无 ${asL} 环位可施(现 ${have},本回合已耗 ${used})——改日/换低环/玩家决策`)
  gate.push(`位检:✓(${k} 剩 ${have - used})`)
}
if (fm.concentration === true && char.concentrating && char.concentrating !== a.spell) {
  err(`!专注冲突:当前专注「${char.concentrating}」——弃旧(叙述后重调)或改施其他法术`)
}
gate.push(`专注:✓${fm.concentration === true ? '(本术需专注)' : '(不需)'}`)

// ── 效果:攻击型→内联攻击链;豁免型→逐目标循环 ──
const DC = 8 + pb(char.level ?? 1) + mod(char[char.caster_attr] ?? 10)
const lines = [`[施法 · ${casterName}→${fm.name}${asL > lvl ? '(升 ' + asL + ' 环)' : ''}]`, ...gate.map(g => '  闸区: ' + g)]
const dice = a.dice ?? fm.damage

if (fm.attack_type) {
  const t = (a.targets ?? '').split(',')[0]?.trim()
  t || err('!攻击型法术需 targets(单目标)')
  let ac = 10, resist = [], immune = [], vuln = []
  const row = combatFoe(t)
  if (row) { ac = row.ac ?? 10; if (row.path) { const m = readFM(row.path); resist = m.damage_resistances ?? []; immune = m.damage_immunities ?? []; vuln = m.damage_vulnerabilities ?? [] } }
  const ab = pb(char.level ?? 1) + mod(char[char.caster_attr] ?? 10)
  const d = d20(a.mode), nat20 = d === 20, nat1 = d === 1
  const hit = nat20 || (!nat1 && d + ab >= ac)
  lines.push(`  命中判定: d20+${ab} = ${d + ab} vs AC ${ac} → ${nat1 ? 'nat1 必失' : nat20 ? 'nat20+暴击' : hit ? '命中' : '未命中'}`)
  if (hit) {
    const ex = nat20 ? dice.replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : dice
    const r = rollExpr(ex)
    let dmg = r.total
    const typeKey = String(fm.damage_type ?? '').toLowerCase()
    if (immune.some(x => typeKey.includes(String(x).toLowerCase())) && fm.damage_type) { dmg = 0; lines.push('  免疫:→0') }
    else if (resist.some(x => typeKey.includes(String(x).toLowerCase())) && fm.damage_type) { dmg = Math.floor(dmg / 2); lines.push('  抗性:↓取整') }
    else if (vuln.some(x => typeKey.includes(String(x).toLowerCase())) && fm.damage_type) { dmg *= 2; lines.push('  易伤:×2') }
    lines.push(`  伤害判定: ${ex} = ${dmg} ${fm.damage_type ?? ''}(增量)`)
  }
} else if (fm.save) {
  const save = String(fm.save).toLowerCase()
  ;(a.targets ?? '').split(',').map(s => s.trim()).filter(Boolean).forEach(t => {
    let saveBonus = 0
    const row = combatFoe(t)
    if (row?.path) { const m = readFM(row.path); saveBonus = mod(m[save] ?? 10) + ((m.save_prof ?? []).includes(save) ? (m.pb ?? pb(1)) : 0) }
    else if (existsSync(`characters/${t}.json`)) {
      const j = JSON.parse(readFileSync(`characters/${t}.json`, 'utf8'))
      saveBonus = mod(j[save] ?? 10) + ((j.save_prof ?? []).includes(save) ? pb(j.level ?? 1) : 0)
    }
    const d = d20(), total = d + saveBonus
    const pass = total >= DC
    lines.push(`  豁免判定 ${t}: d20+${saveBonus} = ${total} vs DC ${DC} → ${pass ? '通过' : '失败'}`)
    const half = fm.half_on_save === true
    if (dice && (!pass)) {
      const r = rollExpr(dice); lines.push(`  伤害判定: ${r.total}${half ? '(通过则已减半)' : ''} ${fm.damage_type ?? ''}(增量)`)
    } else if (dice && pass && half) {
      const r = rollExpr(dice); lines.push(`  伤害判定: ${Math.floor(r.total / 2)}(半伤)`)
    }
  })
}
lines.push(`  ◇ 梗概: ${a.context}`)
console.log(lines.join('\n'))
