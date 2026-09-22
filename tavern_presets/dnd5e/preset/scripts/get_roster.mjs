// {{get_roster()}} — 【人物志】(人际关系简图):扫描 characters/ 全部人物,逐条「name — description」
// (frontmatter 简介,尾代建档/更新时维护)。全名册一眼在握,面板只注入玩家+同伴+叙事点名者。
import { readdirSync, readFileSync } from 'node:fs'
const rows = []
try {
  for (const f of readdirSync('characters').filter(f => f.endsWith('.json')).sort()) {
    try {
      const j = JSON.parse(readFileSync(`characters/${f}`, 'utf8'))
      const role = j.role === 'pc' ? '玩家' : j.role === 'companion' ? '同伴' : 'NPC'
      rows.push(`- ${j.name ?? f}（${role}）— ${j.description ?? ''}`)
    } catch { rows.push(`- ${f}：JSON 损坏`) }
  }
} catch { /* 无 characters 目录 */ }
console.log(rows.length ? rows.join('\n') : '（人物志空——开局未完成？）')
