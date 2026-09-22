/** @tavern-schema
{
  "description": "濒死豁免：raw d20 vs DC10，nat20 回 1HP 苏醒（计数清零）/ nat1 双败；3 成=稳定 / 3 败=死亡。读面板计数不陈旧，回执新计数（封顶 3）。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概（反作弊铁则）。" },
    "who": { "type": "string", "description": "濒死者姓名（默认玩家）。" },
    "success": { "type": "integer", "description": "已累计成功数（面板 death_success，默认 0）。" },
    "fail": { "type": "integer", "description": "已累计失败数（面板 death_fail，默认 0）。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { d20, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺 context')
const s0 = a.success ?? 0, f0 = a.fail ?? 0
;(s0 >= 3 || f0 >= 3) && err('计数已满——不掷（稳定者不再掷/已死亡）')
const d = d20()
let s = s0, f = f0, verdict = '继续濒死', extra = ''
if (d === 20) { verdict = '回 1 HP 苏醒（计数清零）'; extra = 'nat20' }
else if (d === 1) { f += 2; extra = 'nat1 双败' }
else if (d >= 10) { s += 1; extra = '成功+1' }
else { f += 1; extra = '失败+1' }
s = Math.min(s, 3); f = Math.min(f, 3)
if (s >= 3) verdict = '伤势稳定（1d4 小时后自然醒;不再掷）'
if (f >= 3) verdict = '死亡'
console.log(`[濒死 · ${a.who ?? '玩家'}]`)
console.log(`  濒死判定: raw d20 = ${d}（${extra}）→ 成 ${s}/败 ${f}`)
console.log(`  判定: ${verdict}`)
console.log(`  ◇ 梗概: ${a.context}`)
