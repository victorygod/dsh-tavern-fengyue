/** @tavern-schema
{
  "description": "钱款落账器——叙事中任何角色的钱包变动必经本工具：获得（奖励/售卖/拾金）、支出（购买/付账）。怎么填：direction+amount，金额写法自由（15gp、3sp、1gp5sp 或纯数字=cp），跨币换算工具内算。支出超出余额照落不阻断，回执标 ⚠（核对失误信号）。",
  "agents": ["main"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "who": { "type": "string", "required": true, "description": "角色姓名。" },
    "direction": { "type": "string", "required": true, "description": "gain（获得）| spend（支出）。" },
    "amount": { "type": "string", "required": true, "description": "金额，如 15gp、3sp、1gp5sp 或纯数字（cp）。" }
  }
}
*/
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { findCharFile, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { applyMoney } = await import(pathToFileURL(process.cwd() + '/../preset/lib/mvu-apply.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.who || err('缺必填 who')
a.direction || err('缺必填 direction(gain|spend)')
a.amount || err('缺必填 amount')
;(a.direction === 'gain' || a.direction === 'spend') || err(`!direction 非法:${a.direction}——gain|spend`)

const file = findCharFile(a.who) ?? err(`!角色不存在:${a.who}`)
const j = JSON.parse(readFileSync(file, 'utf8'))
const r = applyMoney(j, a.direction, a.amount)
saveChar(file, j)

console.log(`[钱包 · ${a.who}] ${r.direction === 'gain' ? '+' : '-'}${r.amt}cp`)
console.log(`  ${r.before.gp}gp ${r.before.sp}sp ${r.before.cp}cp → ${r.after.gp}gp ${r.after.sp}sp ${r.after.cp}cp`)
console.log(`  落盘: gp ${r.before.gp}→${r.after.gp} · sp ${r.before.sp}→${r.after.sp} · cp ${r.before.cp}→${r.after.cp} [${file}]`)
if (r.negative) console.log(`  ⚠ 负余额——核对失误信号(叙事前未对照钱包)`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
