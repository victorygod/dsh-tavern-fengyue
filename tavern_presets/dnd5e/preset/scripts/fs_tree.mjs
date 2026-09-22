// fs_tree.mjs — 工作空间编辑器的懒加载列目录协议（op: list | levels）。
// 浏览器编辑器按目录增量取层：根层挂载时取一次，展开某目录那一刻取该层，
// 轮询用 levels 一次批量刷「根层 + 展开层」——替代整树全量预取。
// 数据面 = 工作空间三个固定区域（preset/ runtime/ savings/）+ 根层；路径
// 围栏只认这三区（拒 .. / 绝对路径 / 非区域前缀）。模型不可感知此脚本
// （tools/ 不声明、postPrompt 不引用）——编辑器数据通道是纯前端门面。
// 跨平台约定：入参反斜杠归一为 /；围栏用 resolve 后的包含判断（分隔符与
// 大小写安全）；输出恒 POSIX 风格相对路径（与引擎 listTree 的 wire 约定
// 一致）；目录判定用 dirent（不 stat 跟随符号链接）。
import { readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, sep } from 'node:path'

const AREAS = ['preset', 'runtime', 'savings']
// runScript 的 spawn 契约 cwd = runtime/，工作空间根即其父目录。
const ROOT = resolve('..')

const a = JSON.parse(globalThis.argv?.[0] ?? '{}')

/** 反斜杠归一 + 折叠重复斜杠 + 去首尾斜杠。 */
function normalize(p) {
  return String(p ?? '').replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

/** 路径围栏：'' = 根层；否则必须是三区之一或其子路径（resolve 包含判断）。 */
function fenced(rel) {
  if (rel === '') return { abs: ROOT, rel: '' }
  const clean = normalize(rel)
  if (clean.includes('..') || clean.includes('\0')) return null
  if (!AREAS.some(area => clean === area || clean.startsWith(`${area}/`))) return null
  const abs = resolve(ROOT, clean)
  if (abs !== ROOT && !abs.startsWith(ROOT + sep)) return null
  return { abs, rel: clean }
}

/** 列一层：子目录带尾斜杠，隐藏条目跳过，空目录合法地空。 */
function listOne(rel) {
  const f = fenced(rel)
  if (f === null) return []
  if (f.rel === '') return AREAS.map(area => ({ path: `${area}/`, dir: true }))
  if (!existsSync(f.abs) || !statSync(f.abs).isDirectory()) return []
  const out = []
  for (const entry of readdirSync(f.abs, { withFileTypes: true }).sort((x, y) => x.name.localeCompare(y.name))) {
    if (entry.name.startsWith('.')) continue
    out.push(entry.isDirectory() ? { path: `${f.rel}/${entry.name}/`, dir: true } : { path: `${f.rel}/${entry.name}`, dir: false })
  }
  return out
}

if (a.op === 'levels') {
  // 批量：一次调用返回多目录各一层（轮询用，省 spawn）。
  const paths = Array.isArray(a.paths) ? a.paths.map(normalize) : []
  const levels = {}
  for (const p of paths) levels[p] = listOne(p)
  console.log(JSON.stringify({ ok: true, levels }))
} else {
  console.log(JSON.stringify({ ok: true, entries: listOne(String(a.path ?? '')) }))
}
