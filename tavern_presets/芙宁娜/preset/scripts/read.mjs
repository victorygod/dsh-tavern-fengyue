// 默认读取脚本：{{read("state.md")}} 或 runScript("read.mjs", "state.md") → 文件内容。
// cwd = runtime/；跨区读 ../preset/<file>；位置参数见全局 argv 数组。
import { readFileSync } from "node:fs"
const file = argv[0]
if (!file) { console.error("read: missing file argument"); process.exit(1) }
process.stdout.write(readFileSync(file))
