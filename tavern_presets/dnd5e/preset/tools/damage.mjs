/** @tavern-schema
{
  "description": "纯伤害结算（无攻击检定）：坠落/环境/陷阱/手动转写。halve/double 抗性易伤由 DM 判据传入，输出增量。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概（反作弊铁则）。" },
    "dice": { "type": "string", "required": true, "description": "骰式，如 2d6+3。" },
    "modifier": { "type": "integer", "description": "附加调整值。" },
    "type": { "type": "string", "description": "伤害类型（穿刺/火焰等）。" },
    "halve": { "type": "boolean", "description": "抗性减半（向下取整）。" },
    "double": { "type": "boolean", "description": "易伤加倍。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rollExpr, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺 context')
a.dice || err('缺 dice')
const r = rollExpr(a.dice); r || err(`!骰式不合法:${a.dice}`)
let total = r.total + (a.modifier ?? 0); let note = ''
if (a.halve) { total = Math.floor(total / 2); note = '（抗性↓取整）' }
if (a.double) { total = total * 2; note = '（易伤×2）' }
console.log(`[伤害 · ${a.type ?? '未注型'}] ${a.dice}${a.modifier ? (a.modifier >= 0 ? '+' + a.modifier : a.modifier) : ''} = ${total}${note}`)
console.log(`  ◇ 梗概: ${a.context}`)
