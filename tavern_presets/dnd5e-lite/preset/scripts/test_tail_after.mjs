// test_tail_after.mjs — 卡钩子测试件(tail.after):把本轮尾代理叙述追加进 runtime/testtailafter.md。
// 数据源:.chat.tail.jsonl(仅当前轮,head.turnSeq 判陈旧);引擎保证钩子触发前尾文件已整写(docs/cards/card-hooks.zh.md entry #2/#7)。
import { appendFileSync, readFileSync } from 'node:fs'

const fail = (m) => { console.log(JSON.stringify({ ok: false, error: m })); process.exit(1) }
const lines = readFileSync('.chat.tail.jsonl', 'utf8').trim().split('\n').map((line) => JSON.parse(line))
const head = lines[0]
const narration = lines.filter((row) => row.role === 'assistant').at(-1)
if (!narration) fail(`尾文件里没有 assistant 行(head.turnSeq=${String(head?.turnSeq)})`)
appendFileSync('testtailafter.md', `\n\n---\n<!-- tail.after · turnSeq ${head.turnSeq} -->\n${narration.text}\n`)
console.log(JSON.stringify({ ok: true, appended: narration.text.length, turnSeq: head.turnSeq }))
