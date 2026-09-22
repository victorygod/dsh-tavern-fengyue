// {{player_panel()}}:本回合状态摘要,注入 post 消息(勇者面板 + 世界时间/所在)。
// cwd = runtime/。文件缺失时输出占位说明而不失败(脚本一旦非零退出,
// 提示词占位符会原样保留,所以本脚本宁可降级自愈)。位置参数见全局 argv 数组。
import { existsSync, readFileSync } from 'node:fs'
if (existsSync('players/player.md')) {
  process.stdout.write(readFileSync('players/player.md', 'utf8'))
} else {
  console.log('(面板缺失:runtime/players/player.md 不存在,按开局面板处理)')
}
console.log()
console.log('—— 世界 ——')
if (existsSync('state.md')) {
  for (const line of readFileSync('state.md', 'utf8').split('\n')) {
    if (line.startsWith('## ') && /篇章进度|主线|支线|伏笔|玩家所在|游戏时间/.test(line)) console.log(line.slice(3))
  }
} else {
  console.log('(故事态缺失:runtime/state.md 不存在)')
}
