/** @tavern-schema
{
  "description": "伤害掷骰器——无攻检、非施法的伤害掷骰并扣血落盘（武器伤害走 attack、法术伤害走 cast）。何时调：坠落/陷阱/火场等环境伤害与同类的世界伤害。只传 dice+target，配 type 好查抗免。细则见各参数。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "dice": { "type": "string", "required": true, "description": "骰式，如 2d6+3；坠落按 10 尺 1d6（上限 20d6＝200 尺封顶）。" },
    "target": { "type": "string", "required": true, "description": "挨打者名——抗免读档、hp 落盘。" },
    "type": { "type": "string", "enum": ["acid","bludgeoning","cold","fire","force","lightning","necrotic","piercing","poison","psychic","radiant","slashing","thunder"], "description": "伤害类型(枚举=SRD 13 型,键=小写英文正典;口径=glossary-cn DAMAGE_TYPE_CN 单源,漂移钉兜同步;错值内核硬拦)——按它匹配抗性免疫。" },
    "modifier": { "type": "integer", "description": "附加调整值。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rollExpr, resolveTarget, deathHitFail, deathSettleLine, injure, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.dice || err('缺必填 dice')
a.target || err('缺必填 target——世界伤害必有挨打者(纯掷已废;生命骰归 rest,药水掷骰恢复归 hp_change=dice)')
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
const inj = injure(j, dmg)
const before = inj.before, after = inj.after
let extra = ''
if (before === 0 && dmg > 0 && tg.j.role === 'pc') {  // 0HP 受击自动落败(RAW,仅玩家;环境伤害无攻检=无暴击源恒+1)
  const dh = deathHitFail(j, false)
  if (dh.stab) extra += ' · 稳定打破(重开濒死)'
  extra += ` · death_fail ${dh.f0}→${dh.f1}`
}
saveChar(tg.file, j)

console.log(`[伤害 · ${a.target} · ${a.type ?? '未注型'}]`)
console.log(`  伤害判定: ${a.dice}${a.modifier ? (a.modifier >= 0 ? '+' + a.modifier : a.modifier) : ''} = ${dmg}${resNote}`)
console.log(`  落盘: hp ${before}→${after}${extra} [${tg.file}]`)
if (extra) {
  console.log(`  ◇ 0HP 受击——濒死败+1`)
  if (j.death_fail >= 3) console.log(`  ◇ 三败——死亡(终局)`)
}
else if (after === 0 && dmg > 0) {
  console.log(`  ◇ 0HP——${tg.j.role === 'pc' ? '濒死计数起算' : '即死'}`)
  const settle = deathSettleLine(tg.j); if (settle) console.log(settle)
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
