// {{get_changes()}} — 【上回合变化】:state.md 的该节原样(值|原因;尾代每回合整节重写,只保留最近一回合)。
import { readFileSync } from 'node:fs'
try {
  const md = readFileSync('state.md', 'utf8')
  const i = md.indexOf('## 上回合变化')
  console.log((i >= 0 ? md.slice(i).trim() : '') || '（上一回合无面板变化）')
} catch { console.log('（上一回合无面板变化）') }
