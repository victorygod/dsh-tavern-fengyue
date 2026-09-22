// 开场页全量落盘:opening.html 任一改动(失焦/新建/删除) → ui/index.js 桥 → 本脚本。
// argv[0] = JSON 字符串 {player:{name,description,body}, characters:[{name,description,body}], locations:[{name,description,body}], openings:[...]}。
// 写:frontmatter(name/description) + 正文 body 原样落盘(「详细设定」,空则空,不自动生成);
//     lore/characters/<名>.md、lore/locations/<名>.md 按名全量同步(写全 + 删多余);
//     openings.json 全量数组。
// cwd = runtime/;成功输出摘要,失败非零退出(前端提示)。
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs'
import { dirname } from 'node:path'

const raw = argv[0] ?? '{}'
let st
try { st = JSON.parse(raw) } catch { console.error('opening_commit: 参数不是合法 JSON'); process.exit(1) }

const cleanName = s => String(s ?? '').trim().replace(/[\\/:*?"<>|\n]/g, '').slice(0, 60)
const oneLine = s => String(s ?? '').replace(/\s+/g, ' ').trim()

/** 写一篇 frontmatter 文档:name/description + 正文 body 原样(空则空)。 */
function writeDoc(file, name, description, body) {
  const lines = ['---', 'name: ' + name, 'description: ' + description, '---']
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, lines.join('\n') + '\n' + String(body ?? ''))
}

/** 删除目录里不在名单中的 .md(开场期无尾代理写入,删除安全)。 */
function prune(dir, keepNames) {
  let entries = []
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue
    if (!keepNames.has(e.name.replace(/\.md$/, ''))) unlinkSync(dir + '/' + e.name)
  }
}

const committed = []

// --- 主角 ---
const p = st.player ?? {}
const pname = cleanName(p.name) || '勇者'
writeDoc('players/player.md', pname, oneLine(p.description), p.body)
committed.push('主角:' + pname)

// --- 其他角色 ---
const chars = (st.characters ?? []).filter(c => cleanName(c.name) !== '')
const charNames = new Set()
for (const c of chars) {
  const nm = cleanName(c.name)
  charNames.add(nm)
  writeDoc('lore/characters/' + nm + '.md', nm, oneLine(c.description), c.body)
}
prune('lore/characters', charNames)
committed.push('角色×' + chars.length)

// --- 地点 ---
const locs = (st.locations ?? []).filter(l => cleanName(l.name) !== '')
const locNames = new Set()
for (const l of locs) {
  const nm = cleanName(l.name)
  locNames.add(nm)
  writeDoc('lore/locations/' + nm + '.md', nm, oneLine(l.description), l.body)
}
prune('lore/locations', locNames)
committed.push('地点×' + locs.length)

// --- 开场白 ---
const openings = (st.openings ?? []).filter(t => String(t ?? '').trim() !== '')
writeFileSync('openings.json', JSON.stringify(openings, null, 2))
committed.push('开场白×' + openings.length)

console.log(committed.join(';'))
