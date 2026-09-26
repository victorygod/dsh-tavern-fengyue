/** @tavern-schema
{
  "description": "先攻掷骰器——掷全团、排序、开战落账一次走完；正式开战必经。什么情况调：接战当口（铺场完毕、玩家给出策略）——掷先攻、定行动序。预期效果：回执给先攻序（同刻组标出，组内次序你裁）；战斗节落盘——回合 1、先攻行、参战敌对者建敌行（HP/AC 都在各自档案，行只记名与状态）。参战者必须先完成角色创建，未建档报错。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "combatants": { "type": "string", "required": true, "description": "参战者名单，逗号分隔（如 '梅西雅,缇娜,哥布林甲,哥布林乙'）——全部读档掷 d20+敏捷。" }
  }
}
*/
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { rnd, mod, findCharFile, presence, combatWrite, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
const names = String(a.combatants ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean)
names.length || err('缺必填 combatants(参战名单)')

const rows = []
for (const name of names) {
  const f = findCharFile(name)
  if (!f) err(`!未建档:${name}——先用角色创建工具建档再开战`)
  const j = JSON.parse(readFileSync(f, 'utf8'))
  rows.push({ name, j, init: rnd(20) + mod(j.dex ?? 10) })
}
rows.sort((x, y) => y.init - x.init)

// 敌行物化:在场敌对名单 ∩ 参战名单(HP/AC 都在档,行只记名与 path 溯源)
const foeSet = new Set(presence().foes.map(p => p.name))
const enemies = rows.filter(r => foeSet.has(r.name)).map(r => ({ name: r.name, path: r.j.path ?? null }))
combatWrite({ round: 1, order: rows.map(r => ({ who: r.name, init: r.init })), enemies })

console.log('[先攻]')
rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} — ${r.init}`))
const ties = {}
for (const r of rows) (ties[r.init] = ties[r.init] ?? []).push(r.name)
for (const [v, ns] of Object.entries(ties)) if (ns.length > 1) console.log(`  ⟦同刻 ${v}⟧ ${ns.join(' · ')}（组内次序你裁）`)
console.log(`  落盘: state.md 战斗节——回合:1 · 先攻行 · 敌行×${enemies.length}`)
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
