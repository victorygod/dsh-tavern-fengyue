// {{get_world_state()}} — 【世界面板】:state.md 全文,剥离「上回合变化」节(由 get_changes 单独语义呈现)。
import { readFileSync } from 'node:fs'
try {
  const md = readFileSync('state.md', 'utf8')
  const i = md.indexOf('## 上回合变化')
  console.log((i >= 0 ? md.slice(0, i) : md).trim())
} catch { console.log('（世界面板缺失——开局未完成？）') }
