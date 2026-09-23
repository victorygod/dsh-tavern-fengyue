'use strict'
// tavern 卡脚本 runner——命令面上唯一的常量代码，落为真实文件随引擎分发
// （packages/engine/runner/，同 presets/ 一起走 package files；src 直跑与
// bundled lib 双面都经 `../runner/runner.cjs` 相对 import.meta.url 解析）。
//
// 为什么存在：卡脚本按"一条 shell 命令串"过宿主 shell 缝，命令串里的
// 引号跨 shell 不保真（Windows PowerShell 5.1 的 Legacy 再序列化会剥掉
// 解码器内联体中的双引号——POSIX 与 pwsh≥7 的单引号字面承诺覆盖不到它）。
// 解码器从 `-e` 内联改为本文件后，命令串里只剩"路径引号"，而 Windows
// 路径的非法字符集含 `"`，路径引号在任何 PowerShell 世代都打不坏。
//
// argv 契约：`node runner.cjs <b64(脚本绝对路径)> <b64(参数载荷 JSON)>`
// 两枚载荷都是 base64（shell 中立字母表，任何世代都逐字到站）。脚本按
// 真实文件路径 import：相对 import 自然而然成立（data-module 的老嫁接
// 可退役），退出码与 stdout 管道的硬化语义与旧 runner 逐字节一致。
const { pathToFileURL } = require('node:url')

const decode = (value) => Buffer.from(value, 'base64').toString('utf8')

// [node, runner.cjs, 脚本路径, 参数载荷]；载荷缺省解码为 null（防直呼缺参）。
globalThis.argv = JSON.parse(decode(process.argv[3] ?? 'bnVsbA=='))
globalThis.args = globalThis.argv

// 退出硬化：标准 exit 会截断未冲刷完的 stdout 管道（macOS 64KB 缓冲实测）
// ——首个 exit 记账后轮询 writableLength，排空才真退；排空期的新 stdout 一律丢弃。
const realExit = process.exit.bind(process)
const realLog = console.log.bind(console)
let pendingExit = null
process.exit = (code) => {
  if (pendingExit !== null) return
  pendingExit = code ?? 0
  const drain = () => (process.stdout.writableLength === 0 && process.stderr.writableLength === 0
    ? realExit(pendingExit)
    : setTimeout(drain, 1))
  drain()
}
console.log = (...parts) => { if (pendingExit === null) realLog(...parts) }

import(pathToFileURL(decode(process.argv[2] ?? '')).href)
  .catch((error) => {
    process.stderr.write(`tavern card script failed: ${error && error.stack ? error.stack : String(error)}\n`)
    process.exit(1)
  })
  .catch(() => { /* stderr 写失败不再过账——退出硬化已接管 */ })
