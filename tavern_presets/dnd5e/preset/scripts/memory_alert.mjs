// memory_alert.mjs — {{memory_alert()}} 记忆维护提醒(2026-10-06):上一回合 mvu 块若未更新任何
// NPC 的 memory(history/description/thought 三键),注入提醒,DM 本回合按剧情推进补更附近 NPC。
// 读上一轮正文(.chat.snapshot.jsonl 尾 assistant)→ 抽 mvu 块(口径同 mvu_commit.mjs)→ 查 memory 键。
// 无上一轮正文(首回合)/无 mvu 块/块坏 = 静默(不占 prompt 节点;漏 mvu 由 output_alert 点名,不重复)。
// cwd=runtime;跨平台:纯 node:fs,无 shell 构造。
import { readFileSync } from 'node:fs'

let lastAssistant = null
try {
  const rows = readFileSync('.chat.snapshot.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
  lastAssistant = rows.filter(r => r.kind === 'assistant').at(-1)?.orig ?? null
} catch { /* 无快照=静默 */ }
if (!lastAssistant) process.exit(0)

const pre = /<pre\b[^>]*data-mvu[^>]*>([\s\S]*?)<\/pre>/i.exec(lastAssistant)
const fence = /```mvu[^\n]*\n([\s\S]*?)```/.exec(lastAssistant)
const payload = pre ? pre[1] : fence ? fence[1] : null
if (!payload) process.exit(0)   // 无 mvu 块=output_alert 已点名

let memory = null
try { memory = JSON.parse(payload).memory } catch { process.exit(0) }   // 块坏=mvu_commit 已处理

if (Array.isArray(memory) && memory.length > 0) process.exit(0)   // 有更新,静默

console.log('⚠ 上一回合未更新任何 NPC 的 memory——本回合按剧情推进更新附近 NPC 的 memory 三键：history（履历，<10 行 history_append 追加 / ≥10 行 history_overwrite 整表替换）、description（现况一句 ≤40 字）、thought（NPC 内心 ≤400 字，玩家卡不落）。')
