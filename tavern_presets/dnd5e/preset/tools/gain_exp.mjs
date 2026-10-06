/** @tavern-schema
{
  "description": "非战斗经验结算器——解谜/任务/交涉大成功等非战斗成就的经验必经本工具（战斗经验由 combat 工具自动平分结算，勿走此）。怎么调：who=分账名单(逗号分隔)，exp=每人 XP 增量(正整数)。",
  "agents": ["main"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "who": { "type": "string", "required": true, "description": "分账名单，逗号分隔（如 '梅西雅,缇娜'）——名单=获得经验者，你判断。" },
    "exp": { "type": "integer", "description": "非战斗成就每人 XP 增量（正整数）。战斗经验由 combat 工具自动结算，不走此。" },
    "hp_mode": { "type": "string", "description": "升级 HP 算法：avg（默认，取均值）| roll（掷骰）。" }
  }
}
*/
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { findCharFile, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { applyExp } = await import(pathToFileURL(process.cwd() + '/../preset/lib/mvu-apply.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
const names = String(a.who ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean)
names.length || err('缺必填 who(分账名单)')
const inc = +a.exp
Number.isInteger(inc) && inc > 0 || err('!exp 必须为正整数(非战斗成就每人增量)')

// 逐人入账+升级级联(applyExp=单源:玩家挂 pending 前端点、NPC 自动随机——成长细节不由 LLM 过问)
const hpMode = a.hp_mode === 'roll' ? 'roll' : 'avg'
const results = []
for (const name of names) {
  const file = findCharFile(name) ?? err(`!角色不存在:${name}`)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  if (j.exp === undefined) err(`!${name} 无成长面（怪/纯场景 NPC 不挣 XP——从名单移除即可）`)
  const b = { exp: j.exp, level: j.level ?? 1, hp_max: j.hp_max ?? 0, hp: j.hp ?? 0, hd: j.hd_available ?? 0, slots: {} }
  for (let k = 1; k <= 9; k++) b.slots[k] = j['slots_l' + k]
  const { ups, leveled } = applyExp(j, inc, hpMode)
  saveChar(file, j)
  results.push({ name, file, j, b, ups, leveled })
}

console.log(`[非战斗经验 · ${names.join('·')}] ${inc} XP/人`)
for (const r of results) {
  console.log(`  落盘: ${r.name} exp ${r.b.exp}→${r.j.exp} [${r.file}]`)
  if (r.leveled) {
    console.log(`  升级: ${r.name} LV${r.b.level}→LV${r.j.level}`)
    for (const u of r.ups) console.log(`  · ${u}`)
    const w = [`level ${r.b.level}→${r.j.level}`, `hp_max ${r.b.hp_max}→${r.j.hp_max}`, `hp ${r.b.hp}→${r.j.hp}`, `hd_available ${r.b.hd}→${r.j.hd_available}`]
    for (let k = 1; k <= 9; k++) if (r.j['slots_l' + k] !== undefined && r.j['slots_l' + k] !== r.b.slots[k]) w.push(`slots_l${k} ${r.b.slots[k] ?? 0}→${r.j['slots_l' + k]}`)
    console.log(`  落盘: ${w.join(' · ')} [${r.file}]`)
  }
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
