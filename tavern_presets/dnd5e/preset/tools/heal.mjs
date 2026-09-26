/** @tavern-schema
{
  "description": "治疗掷骰器——掷骰回血一次走完：掷骰、钳上限、落盘。什么情况调：非法术来源的掷骰治疗——药水、短休生命骰（掷一枚落一枚，想再掷再调）；法术治疗的数值由 cast 一并结算，本工具不与 cast 连用。怎么填：基线只传 dice+target。预期效果：回执给骰值与落盘行，自动钳 hp 上限；治疗 0 HP 者则苏醒并清濒死计数。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "dice": { "type": "string", "required": true, "description": "骰式，如 2d4+2（药水）；生命骰按职业骰面+CON（如 1d10+2）。" },
    "target": { "type": "string", "required": true, "description": "恢复者名——钳上限、hp 落盘。" },
    "modifier": { "type": "integer", "description": "附加调整值。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rollExpr, resolveTarget, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.dice || err('缺必填 dice')
a.target || err('缺必填 target')
const tg = resolveTarget(a.target) || err(`!查无目标:${a.target}`)
const r = rollExpr(a.dice); r || err(`!骰式不合法:${a.dice}`)

const amt = r.total + (a.modifier ?? 0)
const j = tg.j
const before = j.hp ?? 0
const after = Math.min(j.hp_max ?? Infinity, before + amt)
const woke = before === 0 && after > 0
j.hp = after
let extra = ''
if (woke) {                                           // 任意治疗≥1HP 即醒,计数双清(RAW)
  const s0 = j.death_success ?? 0, f0 = j.death_fail ?? 0
  j.death_success = 0; j.death_fail = 0
  extra = ` · 濒死计数双清(${s0}/${f0}→0/0)`
}
saveChar(tg.file, j)

console.log(`[治疗 · ${a.target}]`)
console.log(`  治疗判定: ${a.dice}${a.modifier ? (a.modifier >= 0 ? '+' + a.modifier : a.modifier) : ''} = ${amt}`)
console.log(`  落盘: hp ${before}→${after}${after < before + amt ? '(钳上限)' : ''}${extra} [${tg.file}]`)
if (woke) console.log(`  ◇ 已苏醒(0 HP→${after})`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
