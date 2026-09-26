/** @tavern-schema
{
  "description": "生命直改器——不掷骰的生命变动直接落盘。什么情况调：剧情性或规则性的定量变动——旧伤崩裂扣 4 点、恩赐恢复、休整回满。不可与任何掷骰工具（attack/cast/damage/heal）连用：同一事件的生命变动只走一件；本工具更不是修正器——已结算的结果不得用它改写（篡改骰果=违反铁则），只处理从未掷骰的事件。怎么填：target+amount（负=减损，正=恢复）；回满传 full:true。预期效果：落盘行；减损到 0 走濒死/即死分叉，恢复走钳上限与苏醒，与掷骰件同律。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "target": { "type": "string", "required": true, "description": "角色名。" },
    "amount": { "type": "integer", "description": "直改量，正=恢复/负=减损；与 full 二选一。" },
    "full": { "type": "boolean", "description": "回满至 hp_max——与 amount 二选一。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { resolveTarget, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.target || err('缺必填 target')
if (a.full === undefined && a.amount === undefined) err('缺 amount(直改量,正=恢复/负=减损)或 full:true(回满)——二选一')
const tg = resolveTarget(a.target) || err(`!查无目标:${a.target}`)

const j = tg.j
const before = j.hp ?? 0
let after, note
if (a.full === true) { after = j.hp_max ?? before; note = '(回满)' }
else {
  const n = +a.amount; Number.isFinite(n) || err(`!amount 不合法:${a.amount}`)
  after = Math.max(0, Math.min(j.hp_max ?? Infinity, before + n)); note = `(${n >= 0 ? '+' : ''}${n})`
}
const woke = before === 0 && after > 0
j.hp = after
let extra = ''
if (woke) { j.death_success = 0; j.death_fail = 0; extra = ' · 濒死计数双清' }
saveChar(tg.file, j)

console.log(`[生命 · ${a.target} · 直改]`)
console.log(`  落盘: hp ${before}→${after}${note}${extra} [${tg.file}]`)
if (woke) console.log(`  ◇ 已苏醒`)
else if (after === 0 && before > 0) console.log(`  ◇ 0HP——${tg.growth ? 'PC/同伴:濒死计数起算' : '怪:RAW 默认即死,死活你判'}`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
