// apply_directives — hooks main.after 机械写手:解析本轮回复末尾的 HTML 注释命令块,分发表执行。
// 协议见 cg_brief.mjs(二者同源:新增命令须同时登记两处)。
// 写权律:本脚本是 runtime 状态的第三支机械写手(LLM 只宣告);无判断、幂等、fail-visible。
// 命令注册表:new 命令 = 加一个 handler。cg → 校验在册 → 幂等写 runtime/cg.json(原子替换)。
import { readFileSync, writeFileSync, existsSync, renameSync } from 'node:fs'

const MANIFEST = '../preset/assets/cg/manifest.json'
const fail = (m) => { console.error(`[directives] ${m}`); }

// ── 读快照最后一条 assistant 正文 ──
let last = null
try {
  const rows = readFileSync('.chat.snapshot.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
  last = rows.filter(r => r.kind === 'assistant').at(-1)?.orig ?? null
} catch { fail('快照不可读,跳过'); process.exit(0) }
if (last === null || last === '') { process.exit(0) }

// ── 扫描全文所有 <!-- ... --> 注释块;块内按换行或分号拆「命令: 值」──
// 协议(2026-09-24 用户定形):cg 注释随语段出现、单行、可多指令分号分隔;
// 只认最终一条 cg(持久回溯取最后画面;段级即时切换已由前端段内解析承担)。
const blocks = [...last.matchAll(/<!--([\s\S]*?)-->/g)]
if (blocks.length === 0) { fail('回复无指令块'); process.exit(0) }
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))

let finalId = null
const receipt = []
for (const [, inner] of blocks) {
  for (const part of inner.split(/[\n;；]+/)) {
    const line = part.trim()
    if (line === '') continue
    const m = /^([a-zA-Z_]+)\s*[:：]\s*(.+)$/.exec(line)
    if (m === null) { fail(`无法解析的指令:"${line.slice(0, 40)}"`); continue }
    const [, name, value] = m
    if (name === 'cg') { finalId = value.trim() } else { fail(`未知命令 "${name}"(未注册)`); }
  }
}

if (finalId !== null) {
  if (manifest.cgs[finalId] === undefined) { fail(`cg 序号不在册:${finalId} — 保持现值`) }
  else {
    const next = { id: finalId }
    let changed = true
    try {
      if (existsSync('cg.json') && JSON.stringify(JSON.parse(readFileSync('cg.json', 'utf8'))) === JSON.stringify(next)) changed = false
    } catch { /* 坏文件照覆写(可弃缓存自愈语义) */ }
    if (changed) { writeFileSync('cg.json.tmp', JSON.stringify(next) + '\n'); renameSync('cg.json.tmp', 'cg.json') }
    receipt.push(`cg → ${finalId}${changed ? '' : '(未变,幂等跳过)'}`)
  }
}

if (receipt.length) process.stdout.write(`[directives] ${receipt.join(' · ')}\n`)
