/** @tavern-schema
{
  "description": "伤害掷骰器——无攻检、无施法的世界伤害一次走完：掷骰、抗性应用、扣血落盘。什么情况调：坠落（每 10 尺 1d6，上限 20d6）、陷阱、火场等环境伤害，以及手动结算的非法术伤害。武器伤害走 attack、法术伤害走 cast——同一事件的伤害只走一件，本工具不与它们连用（连用=双重扣血）。怎么填：基线只传 dice+target，抗性免疫按 type 自动查目标档。预期效果：回执给骰值、抗性应用与落盘行；减到 0 时 PC/同伴濒死计数起算、怪默认即死（死活你判）。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "dice": { "type": "string", "required": true, "description": "骰式，如 2d6+3；坠落按 10 尺 1d6。" },
    "target": { "type": "string", "required": true, "description": "挨打者名——抗免读档、hp 落盘。" },
    "type": { "type": "string", "description": "伤害类型（穿刺/火焰/钝击）——按它匹配抗性免疫。" },
    "modifier": { "type": "integer", "description": "附加调整值。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rollExpr, resolveTarget, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.dice || err('缺必填 dice')
a.target || err('缺必填 target——世界伤害必有挨打者(纯掷已废,生命骰走 heal)')
const tg = resolveTarget(a.target) || err(`!查无目标:${a.target}——先用角色创建工具建档`)
const r = rollExpr(a.dice); r || err(`!骰式不合法:${a.dice}`)

let dmg = r.total + (a.modifier ?? 0)
const typeKey = String(a.type ?? '').toLowerCase()
let resNote = ''
if (typeKey) {
  if ((tg.immune ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) { dmg = 0; resNote = '(免疫→0)' }
  else if ((tg.resist ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) { dmg = Math.floor(dmg / 2); resNote = '(抗性→↓取整)' }
  else if ((tg.vuln ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) { dmg *= 2; resNote = '(易伤→×2)' }
}

const j = tg.j
const before = j.hp ?? 0
const after = Math.max(0, before - dmg)
j.hp = after
let extra = ''
if (before === 0 && dmg > 0 && tg.growth) {          // 0HP 受击自动落败(RAW)
  const f0 = j.death_fail ?? 0
  j.death_fail = Math.min(3, f0 + 1)
  extra = ` · death_fail ${f0}→${j.death_fail}`
}
saveChar(tg.file, j)

console.log(`[伤害 · ${a.target} · ${a.type ?? '未注型'}]`)
console.log(`  伤害判定: ${a.dice}${a.modifier ? (a.modifier >= 0 ? '+' + a.modifier : a.modifier) : ''} = ${dmg}${resNote}`)
console.log(`  落盘: hp ${before}→${after}${extra} [${tg.file}]`)
if (extra) console.log(`  ◇ 0HP 受击——濒死败+1`)
else if (after === 0 && dmg > 0) console.log(`  ◇ 0HP——${tg.growth ? 'PC/同伴:濒死计数起算' : '怪:RAW 默认即死,死活你判'}`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
