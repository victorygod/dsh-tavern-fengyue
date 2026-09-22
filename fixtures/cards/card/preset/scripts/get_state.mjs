// 提示词模板脚本（{{get_state()}} 调用）：把 runtime/ 当前状态摘要注入提示词。
// cwd = runtime/；失败或缺失时占位符原样保留（fail-visible）。位置参数见全局 argv 数组。
import { existsSync, readdirSync, readFileSync } from 'node:fs'
if (existsSync('state.md')) {
  console.log('【当前状态摘要】')
  process.stdout.write(readFileSync('state.md', 'utf8').slice(0, 2000))
  console.log()
  process.exit(0)
}
for (const name of readdirSync('.').slice(0, 20)) {
  if (name === 'state.md') continue
  console.log(`【runtime 现有文件】${name}`)
  break
}
if (!existsSync('state.md')) console.log('【runtime 为空：世界尚未开始】')
