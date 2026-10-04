// history_alert.mjs — {{history_alert()}} 维护提示注入器:扫 characters/*.json,history 行数组超过
// 整合线(10 行)的档逐一「欠账点名」——块文本随 maintenancePrompt 渲染进审计员视野,名册彻清后
// 归于静默(无欠账=不注一字,prompt 不多认一个节点)。整合动作的语义=「history 整合律」
// (maintenancePrompt 3.a),本件只负责触发点名+指针,不重复规则正文。
// cwd=runtime(与 get_roster 同律);损坏 JSON 跳过(lint_characters 通道点名,此处无整合对象可谈);
// 无 characters 目录(开局未完成)=静默。跨平台:纯 node:fs/path,无 shell 构造。
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const LIMIT = 10
const owed = []
try {
  for (const f of readdirSync('characters').filter(f => f.endsWith('.json')).sort()) {
    let j
    try { j = JSON.parse(readFileSync(join('characters', f), 'utf8')) } catch { continue }
    const n = Array.isArray(j.history) ? j.history.length : 0
    if (n > LIMIT) owed.push(`- characters/${f}（${n} 行）`)
  }
} catch { /* 无 characters 目录 */ }
if (!owed.length) process.exit(0)
console.log([
  `⚠ **history 超行警报**——以下角色 history 行数组已超过 ${LIMIT} 行（整合线，本回合办）:`,
  ...owed,
  '照 3.a「history 整合律」整合成一条并清账。',
].join('\n'))
