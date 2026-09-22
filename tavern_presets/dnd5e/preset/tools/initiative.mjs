/** @tavern-schema
{
  "description": "先攻排序（开战一次）：combatants 逐名 d20+DEX 自动解析（PC/同伴读面板，敌人用 名:调整值 转写），同值标注同刻组。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概（反作弊铁则）。" },
    "combatants": { "type": "string", "required": true, "description": "参战者逗号分隔，敌人写 名:调整值（如 哥布林甲:2）。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { d20, mod, readChar, findCharFile, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺 context')
a.combatants || err('缺 combatants 名单')
const rows = []
for (const raw of a.combatants.split(',').map(s => s.trim()).filter(Boolean)) {
  const [name, dmMod] = raw.split(':')
  let dexMod
  if (findCharFile(name)) {
    const j = readChar(name); dexMod = mod(j.dex ?? 10)
  } else if (dmMod !== undefined) {
    dexMod = +dmMod
  } else {
    err(`!无法解析先攻:${name}（不在 characters/;敌人用 名:调整值 转写）`)
  }
  rows.push({ name, init: d20() + dexMod, dexMod })
}
rows.sort((x, y) => y.init - x.init)
console.log('[先攻序]（同刻组内次序由你裁定）')
rows.forEach((r, i) => console.log(`  ${i + 1}. ${r.name} — ${r.init}`))
const ties = {}
for (const r of rows) (ties[r.init] = ties[r.init] ?? []).push(r.name)
for (const [v, names] of Object.entries(ties)) if (names.length > 1) console.log(`  ⟦同刻 ${v}⟧ ${names.join(' · ')}`)
console.log(`  ◇ 梗概: ${a.context}`)
