// test_main_after.mjs — 卡钩子测试件(main.after):把本轮对话(玩家输入+DM回复)追加进 runtime/testmainafter.md。
// 数据源:.chat.snapshot.jsonl——最后一条 kind:"user" 行与本回合 kind:"assistant" 行;
// 引擎保证钩子触发前快照已重写落盘(docs/cards/card-hooks.zh.md entry #2/#7)。
import { appendFileSync, readFileSync } from 'node:fs'

const fail = (m) => { console.log(JSON.stringify({ ok: false, error: m })); process.exit(1) }
const rows = readFileSync('.chat.snapshot.jsonl', 'utf8').trim().split('\n').map((line) => JSON.parse(line))
const user = rows.filter((row) => row.kind === 'user').at(-1)
const reply = rows.filter((row) => row.kind === 'assistant').at(-1)
if (!reply) fail('快照里没有 assistant 行')
const pair = `【玩家】${user?.plain ?? '(无·开局直入)'}\n【DM】${reply.orig}\n`
appendFileSync('testmainafter.md', `\n\n---\n<!-- main.after · user seq ${user?.seq ?? '—'} · reply seq ${reply.seq} -->\n${pair}`)
console.log(JSON.stringify({ ok: true, appended: pair.length, userSeq: user?.seq ?? null, replySeq: reply.seq }))
