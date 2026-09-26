/** @tavern-schema
{
  "description": "钱款落账器——叙事中任何角色的钱包变动必经本工具：获得（奖励/售卖/拾金）、支出（购买/付账/生活费）。怎么填：金额写法自由（15gp、3sp、1gp5sp 或纯数字=cp），跨币换算与规范化工具内算。预期效果：钱包落盘，回执给旧→新，照它继续叙事；支出超出余额照落不阻断，回执标 ⚠（核对失误信号）。",
  "agents": ["main", "tail"],
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
const { toCp, normWallet, findCharFile, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.who || err('缺必填 who')
a.direction || err('缺必填 direction(gain|spend)')
a.amount || err('缺必填 amount')

const file = findCharFile(a.who) ?? err(`!角色不存在:${a.who}`)
const j = JSON.parse(readFileSync(file, 'utf8'))
const amt = toCp(a.amount); amt > 0 || err('!amount 必须为正')
const oldCp = (j.gp ?? 0) * 100 + (j.sp ?? 0) * 10 + (j.cp ?? 0)
const newCp = a.direction === 'gain' ? oldCp + amt : oldCp - amt
const w = normWallet(newCp)
const before = { gp: j.gp ?? 0, sp: j.sp ?? 0, cp: j.cp ?? 0 }
j.gp = w.gp; j.sp = w.sp; j.cp = w.cp
saveChar(file, j)

console.log(`[钱包 · ${a.who}] ${a.direction === 'gain' ? '+' : '-'}${amt}cp`)
console.log(`  ${before.gp}gp ${before.sp}sp ${before.cp}cp → ${w.gp}gp ${w.sp}sp ${w.cp}cp`)
console.log(`  落盘: gp ${before.gp}→${w.gp} · sp ${before.sp}→${w.sp} · cp ${before.cp}→${w.cp} [${file}]`)
if (newCp < 0) console.log(`  ⚠ 负余额——核对失误信号(叙事前未对照钱包)`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
