// inject_location.mjs — {{inject_location()}}:读 state.md「## 地点」地点ID → world.md「## 地点编号」映射表
// → ../preset/setup/locations/<file> 全文注入(朗读文本+底牌,主面当 DM 掌握)。无卡旅行段(地点ID 空/未匹配/缺档)=零输出。
// cwd=runtime(脚本注入契约,同 get_world_state);跨区读 ../preset/setup/。
import { readFileSync, existsSync } from 'node:fs'
try {
  const md = readFileSync('state.md', 'utf8')
  const id = /^-\s*地点ID[：:]\s*(.*)$/m.exec(md)?.[1]?.trim()
  if (id) {
    const world = readFileSync('../preset/setup/world.md', 'utf8')
    const sec = /## 地点编号[^\n]*\n([\s\S]*?)(?=\n## |$)/.exec(world)?.[1] ?? ''
    let file = null, name = null
    for (const line of sec.split('\n')) {
      const parts = line.replace(/^\s*-\s*/, '').split('|').map(s => s.trim())
      if (parts.length >= 3 && parts[0] === id) { name = parts[1]; file = parts[2]; break }
    }
    if (file) {
      const p = `../preset/setup/locations/${file}`
      if (existsSync(p)) console.log(`【当前地点卡】${id} ${name ?? ''}(locations/${file})\n\n${readFileSync(p, 'utf8')}`)
    }
  }
} catch { /* 缺档=开局未完成,静默(不注一字) */ }