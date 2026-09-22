// {{get_state()}} 模板脚本：stdout 原文替换提示词里的占位符（每消费点渲染一次）。
// 文件名即引用名；失败或缺失时占位符原样保留。cwd = runtime/；位置参数见全局 argv 数组。
import { existsSync, readdirSync, readFileSync } from 'node:fs'
if (existsSync('state.md')) {
  console.log('【当前状态摘要】')
  process.stdout.write(readFileSync('state.md', 'utf8').slice(0, 2000))
  console.log()
  process.exit(0)
}
const files = readdirSync('.').slice(0, 20).join('、')
console.log(files ? `【runtime 现有文件】${files}（无 runtime/state.md）` : '【runtime 为空：世界尚未开始】')
