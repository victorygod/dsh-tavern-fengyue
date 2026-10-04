// {{get_world_state()}} — 【世界面板】:state.md 全文,剥离「上回合变化」节(该节已随直写工具体系退役,
// 2026-09-28——现值=注入快照+回执落盘行;此处剥离仅为存量工作区冻结节防漏渗)。
import { readFileSync } from 'node:fs'
try {
  const md = readFileSync('state.md', 'utf8')
  const i = md.indexOf('## 上回合变化')
  console.log((i >= 0 ? md.slice(0, i) : md).trim())
} catch { console.log('（世界面板缺失——开局未完成？）') }
