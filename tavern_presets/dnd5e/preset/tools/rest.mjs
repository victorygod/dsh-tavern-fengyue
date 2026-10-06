/** @tavern-schema
{
  "description": "休整结算器——一次叙事休整事件走完(短休/长休),逐人结算逐人落盘。何时调:你声明休整发生(短休≥1小时/长休≥8小时)即调,一次调用一个休整事件。短休传 kind:'short'+hd(每人花费的生命骰枚数,可不同则分次调);长休传 kind:'long'.what 结算:短休=掷生命骰回血+hd 扣减+短休池回充+契术师位回满;长休=hp 回满+hd 回充一半+法术位回满+短休长休池全充+力竭-1(有饮食)+专注清。",
  "agents": ["main"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "kind": { "type": "string", "required": true, "enum": ["short", "long"], "description": "休整类型(枚举即名录):short(短休)|long(长休)——错值内核硬拦。" },
    "who": { "type": "string", "required": true, "description": "休整名单,逗号分隔(如 '梅西雅,缇娜,老铁')。" },
    "hd": { "type": "integer", "description": "短休每人花费的生命骰枚数(默认 0)。逐步决策分次调用。" },
    "food": { "type": "boolean", "description": "长休有无进食——false 则跳过力竭恢复(饥饿)。" },
    "water": { "type": "boolean", "description": "长休有无饮水——false 则跳过力竭恢复(缺水)。" }
  }
}
*/
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { findCharFile, rollExpr, mod, slotsFor, dropConcentration, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { CLASS_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/class-core-data.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
;(a.kind === 'short' || a.kind === 'long') || err('!kind 须为 short|long')
const names = String(a.who ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean)
names.length || err('缺必填 who(名单)')

const hitDie = (j, cls) => j.hit_die ?? (+CLASS_CORE[cls]?.fm?.hit_die || 8)
// 池回充:features 行 `名|回充时机|已用N` → 已用0
function recharge(j, mode) {
  if (!Array.isArray(j.features)) return
  j.features = j.features.map(f => { const s = String(f); return new RegExp(`^(.+\\|${mode}\\|)已用\\d+$`).test(s) ? s.replace(/已用\d+$/, '已用0') : s })
}

const lines = []

if (a.kind === 'short') {
  const hd = a.hd ?? 0
  lines.push(`[休整 · 短休 · ${names.join(',')}]`)
  for (const name of names) {
    const f = findCharFile(name) || err(`查无角色:${name}`)
    const j = JSON.parse(readFileSync(f, 'utf8'))
    const cls = String(j.class ?? '').toLowerCase()
    const sub = []
    if (hd > 0) {
      const avail = j.hd_available ?? 0
      avail >= hd || err(`!${name} hd_available ${avail} < 花费 ${hd}`)
      if (cls) {
        const die = hitDie(j, cls), conM = mod(j.con ?? 10)
        const before = j.hp ?? 0; let healed = 0; const rolls = []
        for (let i = 0; i < hd; i++) { const r = rollExpr(`1d${die}`); const v = r.total + conM; healed += v; rolls.push(`1d${die}+${conM}=${v}`) }
        j.hp = Math.min(j.hp_max ?? Infinity, before + healed)
        j.hd_available = avail - hd
        sub.push(`生命骰 ${rolls.join(' · ')} → hp ${before}→${j.hp} · hd_available ${avail}→${j.hd_available}`)
      } else sub.push(`无成长面/无职业,跳过掷骰`)
    }
    recharge(j, '短休')
    if (cls === 'warlock') { const st = slotsFor('warlock', j.level); if (st) { for (let k = 1; k <= 9; k++) j['slots_l' + k] = st[k - 1] ?? 0; sub.push('契术师魔契位整池回满') } }
    saveChar(f, j)
    lines.push(`  ${name}: ${sub.join(' · ') || '仅池回冲/无骰'} [${f}]`)
  }
} else {
  lines.push(`[休整 · 长休 · ${names.join(',')}]`)
  // 铁轨一:hp≥1(濒死不能长休)
  const row = []
  for (const name of names) { const f = findCharFile(name); if (f) { const j = JSON.parse(readFileSync(f, 'utf8')); row.push(`${name} hp ${j.hp ?? 0}`); (j.hp ?? 0) < 1 && err(`!${name} hp<1 濒死不能长休(先救醒)`) } }
  lines.push(`  铁轨: hp≥1 ✓(${row.join(' · ')})`)
  for (const name of names) {
    const f = findCharFile(name) || err(`查无角色:${name}`)
    const j = JSON.parse(readFileSync(f, 'utf8'))
    const cls = String(j.class ?? '').toLowerCase()
    const before = { hp: j.hp, hd: j.hd_available ?? 0 }
    j.hp = j.hp_max ?? (j.hp ?? 0)
    j.hd_available = Math.min(j.level ?? 1, (j.hd_available ?? 0) + Math.max(1, Math.floor((j.level ?? 1) / 2)))
    const st = slotsFor(cls, j.level)
    const slotWrites = []
    if (st) for (let k = 1; k <= 9; k++) { const v = st[k - 1] ?? 0; if ((j['slots_l' + k] ?? 0) !== v) { slotWrites.push(`slots_l${k} ${j['slots_l' + k] ?? 0}→${v}`); j['slots_l' + k] = v } }
    recharge(j, '短休'); recharge(j, '长休')
    const fed = a.food !== false && a.water !== false
    const exNote = fed ? '' : ' · ⚠ 无饮食:力竭未减'
    if ((j.exhaustion ?? 0) > 0 && fed) j.exhaustion = (j.exhaustion ?? 0) - 1
    const dc = dropConcentration(name)
    // 临时生命长休消失(RAW "last until depleted or long rest"):temp_hp 归零+删 temp 条目,不动 hp/hp_max(独立池)
    const tempHad = (j.temp_hp ?? 0) > 0
    if (tempHad || Object.values(j.statuses ?? {}).some(s => s?.temp)) {
      j.temp_hp = 0
      const st = {}
      for (const [k, v] of Object.entries(j.statuses ?? {})) if (!(v?.temp)) st[k] = v
      j.statuses = st
    }
    saveChar(f, j)
    const parts = [`hp ${before.hp}→${j.hp}`, `hd_available ${before.hd}→${j.hd_available}`]
    if (slotWrites.length) parts.push(...slotWrites)
    if (tempHad) parts.push('临时生命清')
    lines.push(`  落盘: ${name} ${parts.join(' · ')} [${f}]${exNote}`)
    for (const r of dc.removed) lines.push(`  落盘: ${r.name} statuses −「${r.key}」 [${r.file}]`)
  }
}
lines.push(`  ◇ 梗概: ${a.context}`)
lines.push(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
console.log(lines.join('\n'))