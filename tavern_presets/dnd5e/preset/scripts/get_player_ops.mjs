// {{get_player_ops()}} — 玩家工位操作流:前端机械道(front_commit)落盘的行为事件,以自然语句注入
// postPrompt 顶部(【玩家面板】之前,无栏目无标题)。玩家点选不进 transcript、面板只体现结果现值——
// 「玩家做了什么」由此单独到桌,DM 可顺势叙事确认,也可忽略。
// 剩余未分配点数**现读** characters/player.json 的 pending(ASI 档×2)——与面板同一来源,不生产第二真相;
// 日志只存事件,状态归面板。留空=完全零输出。记账律:只许 front_commit 追加,最近 5 条 roll-off。
import { existsSync, readFileSync } from 'node:fs'
try {
  const rows = existsSync('.front-ops.jsonl')
    ? readFileSync('.front-ops.jsonl', 'utf8').split('\n').filter(Boolean)
    : []
  const items = rows.map(l => { try { return JSON.parse(l).text ?? '' } catch { return '' } }).filter(Boolean)
  for (const t of items) console.log(`玩家${t}。`)
  try {
    const p = JSON.parse(readFileSync('characters/player.json', 'utf8'))
    const tiers = (p.pending ?? []).filter(x => String(x).includes('ASI')).length
    if (tiers > 0) console.log(`还剩 ${tiers * 2} 点属性点未分配。`)
  } catch { /* 档案暂缺(未开局)——剩余无法计,略 */ }
} catch { /* 日志损坏按无操作处理——面板仍是唯一事实依据 */ }
