/** @tavern-schema
{
  "description": "濒死豁免掷骰器——0 HP 的角色每个自己的回合开始时必掷一次（raw d20，无任何修正）。什么情况调：濒死中的 PC/同伴，每轮一次；伤势稳定后不再掷，死亡即止。预期效果：回执给 raw 骰值、新旧计数与判定——继续濒死 / 回 1 HP 苏醒（nat20，计数清零）/ 记双败（nat1）/ 伤势稳定（三成，1d4 小时后自然醒）/ 死亡（三败）；计数自动读档落盘，零转录。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "who": { "type": "string", "description": "濒死者姓名（默认玩家）。" }
  }
}
*/
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { rnd, findCharFile, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')

const name = a.who ?? '玩家'
const file = findCharFile(name) || err(`!角色不存在:${name}`)
const j = JSON.parse(readFileSync(file, 'utf8'))
const s0 = j.death_success ?? 0, f0 = j.death_fail ?? 0
;(s0 >= 3 || f0 >= 3) && err('计数已满——稳定者不再掷/已死亡')

const d = rnd(20)
let s = s0, f = f0, verdict = '继续濒死', note = ''
if (d === 20) { note = 'nat20'; verdict = '回 1 HP 苏醒' }
else if (d === 1) { f = Math.min(3, f + 2); note = 'nat1 双败' }
else if (d >= 10) { s = Math.min(3, s + 1); note = '成功+1' }
else { f = Math.min(3, f + 1); note = '失败+1' }

const writes = []
if (d === 20) { j.hp = 1; j.death_success = 0; j.death_fail = 0; writes.push('hp 0→1', '濒死计数双清') }
else {
  if (s >= 3) verdict = '伤势稳定（1d4 小时后自然醒,不再掷）'
  else if (f >= 3) verdict = '死亡'
  j.death_success = s; j.death_fail = f
  if (s !== s0) writes.push(`death_success ${s0}→${s}`)
  if (f !== f0) writes.push(`death_fail ${f0}→${f}`)
}
saveChar(file, j)

console.log(`[濒死 · ${name}]`)
console.log(`  濒死判定: raw d20 = ${d}（${note}）→ 成 ${d === 20 ? 0 : s}/败 ${d === 20 ? 0 : f}`)
console.log(`  落盘: ${writes.join(' · ')} [${file}]`)
console.log(`  判定: ${verdict}`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
