/** @tavern-schema
{
  "description": "钱款落账（尾代理专属，写盘）：写 characters/<who>.json 的 gp/sp/cp 三栏——统一 cp 核算+规范化。不拒绝负余额——忠实落账+回执警示。数额来自叙事声明。",
  "agents": ["tail"],
  "parameters": {
    "who": { "type": "string", "required": true, "description": "角色姓名。" },
    "direction": { "type": "string", "required": true, "description": "gain（获得）| spend（支出）。" },
    "amount": { "type": "string", "required": true, "description": "金额，如 15gp、3sp、1gp5sp 或纯 cp 整数。" }
  }
}
*/
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { toCp, normWallet, findCharFile, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.who || err('缺 who'); a.direction || err('缺 direction(gain|spend)'); a.amount || err('缺 amount')
const file = findCharFile(a.who) ?? err(`!角色不存在:${a.who}`)
const j = JSON.parse(readFileSync(file, 'utf8'))
const amt = toCp(a.amount); amt > 0 || err('!amount 必须为正')
const oldCp = (j.gp ?? 0) * 100 + (j.sp ?? 0) * 10 + (j.cp ?? 0)
const newCp = a.direction === 'gain' ? oldCp + amt : oldCp - amt
const w = normWallet(newCp)
const oldStr = `${j.gp ?? 0}gp ${j.sp ?? 0}sp ${j.cp ?? 0}cp`
j.gp = w.gp; j.sp = w.sp; j.cp = w.cp
writeFileSync(file, JSON.stringify(j, null, 1))
console.log(`[钱包 · ${a.who}] ${a.direction === 'gain' ? '+' : '-'}${amt}cp`)
console.log(`  ${oldStr} → ${w.gp}gp ${w.sp}sp ${w.cp}cp`)
if (newCp < 0) console.log(`  ⚠ 负余额——叙事代理未核对钱包(错误信号)`)
console.log(`  文件: ${file} 已更新`)
