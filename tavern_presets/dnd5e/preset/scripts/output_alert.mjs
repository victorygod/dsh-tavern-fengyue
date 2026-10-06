// output_alert.mjs — {{output_alert()}} 收尾漏项提醒:读上一轮正文(.chat.snapshot.jsonl 尾 assistant)
// 与上一轮工具快照(.chat.tools.jsonl),三查——工具/mvu 块/行动选项——缺哪样点名哪样。
// 全就绪或首回合(无上一轮 assistant)=静默(不占 prompt 一个节点,同 history_alert 契约)。
// 引擎侧由 beginTurnSettlement 在收束链落 .chat.tools.jsonl,故本脚本渲染时该文件=上一轮工具。
// cwd=runtime(与 mvu_commit 同律);跨平台:纯 node:fs/path,无 shell 构造。
import { readFileSync } from 'node:fs'

// ── 读上一轮 assistant 正文 ──
let lastAssistant = null
try {
  const rows = readFileSync('.chat.snapshot.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
  lastAssistant = rows.filter(r => r.kind === 'assistant').at(-1)?.orig ?? null
} catch { /* 无快照/坏行=无上一轮,静默 */ }
if (!lastAssistant) process.exit(0) // 首回合,无上一轮可检

const missing = []

// ① 工具:上一轮工具快照存在且零工具 → 漏调;文件不存在(首回合)则跳过
let tools = null
try {
  const lines = readFileSync('.chat.tools.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
  if (lines.some(l => l.type === 'head')) tools = lines.filter(l => l.role === 'tool')
} catch { /* 无工具快照=跳过工具检查 */ }
if (tools !== null && tools.length === 0) {
  missing.push('**未调用任何工具**——战斗/结算/背包/状态/休整/钱款/经验该走工具的,补调对应工具(对照工具 schema),禁止心算或只叙事不落账。')
}

// ② mvu 块:正文无 <pre data-mvu> 也非 ```mvu``` 围栏 → 漏附(口径同 mvu_commit.mjs 的 pick)
const hasMvu = /<pre\b[^>]*data-mvu[^>]*>/i.test(lastAssistant) || /```mvu/.test(lastAssistant)
if (!hasMvu) {
  missing.push('**未输出折叠 mvu 块**——正文后须附 `<details class="mvu-block">`(八键 + memory,格式见【文末输出】)。')
}

// ③ 行动选项:正文无 choice-options → 漏给
if (!/choice-options/.test(lastAssistant)) {
  missing.push('**未输出行动选项**——正文后须给 2~4 个 `.choice-options` 可点按钮。')
}

if (missing.length === 0) process.exit(0)
console.log(['⚠ **上轮收尾漏项**——上一轮正文漏了以下必附内容,本轮先补全:', ...missing.map(m => `- ${m}`)].join('\n'))
process.exit(0)
