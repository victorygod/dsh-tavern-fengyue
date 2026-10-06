// debug_post.mjs — main.after 钩子:把本回合渲染面的 postPrompt 记成历史流水(runtime/debug/post-history.md,
// 2026-10-05 起非隐藏目录,便于直接浏览)。供调试「模型每回合实际注入了什么」。钩子读不到引擎渲染产物,
// 故自行读 ../preset/prompt/postPrompt、展开零参 {{script()}} 占位符(逐脚本 node 直跑、stdout 替换,
// 失败保留占位符原样=引擎 fail-visible 同款)。
// 已知边界:钩子在 main.after 渲染,看到的是回合后的 runtime(工具已写/mvu 可能已 commit),与模型当回合
// 看到的(回合前)有状态漂移——debug 用途足够,不追求逐字节还原。读不到 postPrompt 则静默。
// 落盘=markdown 直读(每回合一个 ## 标题块 + --- 分隔),非 JSON——人肉翻起来即所见即所得。
// cwd=runtime(钩子 spawn 契约);跨平台:node:child_process 显式 args,无 shell 构造。
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const SCRIPT_DIR = resolve(process.cwd(), '..', 'preset', 'scripts')
const LOG_PATH = resolve(process.cwd(), 'debug', 'post-history.md')

// ── 读 postPrompt 模板(缺档=静默) ──
let template
try {
  template = readFileSync(resolve(process.cwd(), '..', 'preset', 'prompt', 'postPrompt'), 'utf8')
} catch { process.exit(0) }

// ── 展开零参 {{script()}} :逐脚本 spawn,stdout(trim)替换,失败/超时/非零=占位符原样 ──
const renderOne = (name) => {
  const script = join(SCRIPT_DIR, `${name}.mjs`)
  const r = spawnSync(process.execPath, [script], { cwd: process.cwd(), encoding: 'utf8', timeout: 30_000 })
  if (r.status !== 0 || r.error) return null
  return (r.stdout ?? '').trim()
}
const rendered = template.replace(/\{\{([a-zA-Z_]\w*)\(\)\}\}/g, (token, name) => {
  const out = renderOne(name)
  return out === null ? token : out // 成功即替换(含空输出=替换为空);失败保留占位符原样
})

// ── 回合标记:优先 .chat.tools.jsonl 的 head.turnSeq(引擎刚为收束回合落盘),回退快照尾 assistant seq ──
let turnSeq = null
try {
  const lines = readFileSync('.chat.tools.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
  const head = lines.find(l => l.type === 'head')
  if (head?.turnSeq != null) turnSeq = head.turnSeq
} catch { /* 无工具快照 */ }
if (turnSeq == null) {
  try {
    const rows = readFileSync('.chat.snapshot.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
    turnSeq = rows.filter(r => r.kind === 'assistant').at(-1)?.seq ?? null
  } catch { /* 无快照 */ }
}

mkdirSync(dirname(LOG_PATH), { recursive: true })
const stamp = new Date().toISOString()
appendFileSync(LOG_PATH, `\n---\n\n## 回合 ${turnSeq ?? '?'} · ${stamp}\n\n${rendered}\n`)
process.exit(0)
