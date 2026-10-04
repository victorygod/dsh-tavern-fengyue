// 世界书扫描 v1.6（导入生成，可编辑）：条目两种匹配面——
// ① 带scan.kinds（风月卡，key_region 位码 1=system/2=user/4=assistant 折叠而来）：
//    取该种类集合「最近一条」消息做键匹配；kinds 是空数组 = key_region 缺位，视为
//    不触发（条目仍在书里，恒不命中）。快照没有 system 行，system 位恒不命中；
//    发送期最近一条 user 常是引擎预投影的本回合输入。
// ② 无scan（ST 卡）：沿用最近 N 条 user/assistant 拼合窗口，argv[0] 可调（默认 12）。
// 命中判定：mode:"and" 全含（风月 _and_ 组合键），否则任一子串命中；
// 含 constant 条目，按 id 序输出 content；prob<100 掷次骰。
// 数据 ../preset/lorebook.json；文件或快照缺席时静默退出，世界书即失效。
// 不含递归/分组/预算（映射 §4 的 v1 简化）；重折叠由导入器重生成，别在本文件堆逻辑。
// cwd = runtime/；全局 argv = 位置参数数组（[窗口条数]，仅②生效）。
import { existsSync, readFileSync } from "node:fs"
const n = Number(argv[0] ?? 12) || 12
const book = "../preset/lorebook.json"
const snap = ".chat.snapshot.jsonl"
if (!existsSync(book) || !existsSync(snap)) process.exit(0)
const data = JSON.parse(readFileSync(book, "utf8"))
const rows = []
for (const line of readFileSync(snap, "utf8").trimEnd().split("\n")) {
  try {
    const e = JSON.parse(line)
    if (e.kind === "user" || e.kind === "assistant" || e.kind === "system") rows.push(e)
  } catch {}
}
const window = rows.slice(-n).map(e => e.plain ?? "").join("")
const latest = kinds => {
  for (let i = rows.length - 1; i >= 0; i -= 1) if (kinds.includes(rows[i].kind)) return rows[i].plain ?? ""
  return ""
}
for (const entry of data.entries ?? []) {
  if (!entry.content) continue
  const kinds = entry.scan?.kinds
  let text
  if (Array.isArray(kinds)) {
    if (kinds.length === 0) continue
    text = latest(kinds)
  } else {
    text = window
  }
  const keys = entry.keys ?? []
  const hit = entry.constant === true || (entry.mode === "and"
    ? keys.every(k => text.includes(k))
    : keys.some(k => text.includes(k)))
  if (!hit) continue
  const prob = entry.probability ?? 100
  if (prob < 100 && Math.floor(Math.random() * 100) >= prob) continue
  console.log(String(entry.content).replaceAll("\\n", "\n"))
}
