// {{file64(relpath)}} — 文件 → base64（换背景用例）；位置参数见全局 argv 数组。
import { readFileSync } from 'node:fs'
if (!argv[0]) { console.error('file64: missing file argument'); process.exit(1) }
process.stdout.write(readFileSync(argv[0]).toString('base64'))
