// {{get_npc_state()}} — 【同伴与附近 NPC 面板】:同伴(role:companion)常驻注入;其余具名 NPC 按
// 「最近叙事点名」注入——读 .chat.snapshot.jsonl,取最后一条 assistant 正文∪最新一条玩家文本,
// characters/<名>.json 的名字出现在该文本即在场。零维护:无名单可忘,误注入(回忆性提及)方向
// 安全,人物志(get_roster)兜底全名册。
import { existsSync, readdirSync, readFileSync } from 'node:fs'
// 快照损坏/缺失按空文本处理——整档缓存,引擎下次重写自愈,此处无需抢救。
const chat = existsSync('.chat.snapshot.jsonl') ? readFileSync('.chat.snapshot.jsonl', 'utf8') : ''
let lastA = ''
let lastU = ''
for (const line of chat.split('\n')) {
  if (!line) continue
  try {
    const row = JSON.parse(line)
    if (row.kind === 'assistant') lastA = row.plain ?? row.orig ?? ''
    else if (row.kind === 'user') lastU = row.plain ?? row.orig ?? ''
  } catch { /* 坏行跳过——head 行与残行都不是对话行 */ }
}
const seen = `${lastA}\n${lastU}`
const out = []
try {
  for (const f of readdirSync('characters').filter(f => f.endsWith('.json')).sort()) {
    if (f === 'player.json') continue
    const name = f.slice(0, -5)
    let j = null
    try { j = JSON.parse(readFileSync(`characters/${f}`, 'utf8')) } catch { /* 下方损坏分支 */ }
    const companion = j !== null && j.role === 'companion'
    // 未点名且非同伴 → 不注入;名字撞车(短名含于场景长名)只多注入不少注入,方向安全。
    if (!companion && !seen.includes(name)) continue
    if (j === null) { out.push(`### ${name}：JSON 损坏——勿采信`); continue }
    out.push(`### ${name}（${companion ? '同伴' : '附近 NPC'}）`)
    out.push(JSON.stringify(j, null, 1))
  }
} catch { /* characters/ 缺失——下方占位兜底 */ }
console.log(out.length ? out.join('\n') : '（无同伴——队伍仅玩家一人；最近叙事亦未点名任何具名 NPC）')
