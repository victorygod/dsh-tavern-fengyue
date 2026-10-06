// gal_data — galgame 面板唯一数据泵(v2 面板 op:panel)。
// 产出:上一条 player(角落小字)/最近一条 assistant(主文案,已剥指令注释)/当前 CG 组装(manifest 切片)。
// assetKeys = 当前 CG 各层 img(preset 相对路径)——运行时经宿主 readAsset 通道取 dataUrl 缓存(不走 stdout,不受 64KB 限制)。
import { readFileSync, statSync } from 'node:fs'

const a = globalThis.argv?.[0] ? JSON.parse(globalThis.argv[0]) : {}
const op = a.op ?? 'panel'
const manifest = JSON.parse(readFileSync('../preset/assets/cg/manifest.json', 'utf8'))
// CG 层索引:前端按段内 cg 序号即时切换时,按 id 取层切片
if (op === 'manifest') {
  // { id: { layers, intro } } —— 前端段级切 CG 取层 + 画面中央序号情绪词
  const cgs = Object.fromEntries(Object.entries(manifest.cgs).map(([id, cg]) => [id, { layers: cg.layers, intro: cg.intro ?? '' }]))
  process.stdout.write(JSON.stringify({ ok: true, cgs }))
  process.exit(0)
}
if (op !== 'panel' && op !== 'history') { console.log(JSON.stringify({ ok: false, error: `未知 op:${a.op}` })); process.exit(1) }

const stat = (p) => { try { const s = statSync(p); return `${s.mtimeMs}:${s.size}` } catch { return null } }
const strip = (t) => String(t ?? '').replace(/<!--[\s\S]*?-->/g, '').trim()
// 面板单页历史条数(2026-10-05 分页批):panel 热路径只带最近一页,上界=当前轮+15 条;
// 更早历史走 op:history 按 offset/limit 拉,不再全量进 panel(全量曾超 64KB stdout 边界)。
const PAGE = 15

// ── 快照:最近的 player 行与 assistant 行 + 全量历史(backlog 防剧透原料) ──
const stripD = t => String(t ?? '').replace(/<!--[\s\S]*?-->/g, '').trim()
let lastUser = null, lastAssistant = null, history = [], session = null
try {
  const rows = readFileSync('.chat.snapshot.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
  for (const r of rows) {
    if (r.kind === 'user') history.push({ role: 'user', seq: r.seq, text: String(r.plain ?? '') })
    else if (r.kind === 'assistant') history.push({ role: 'assistant', seq: r.seq, text: stripD(r.orig) })
  }
  lastUser = rows.filter(r => r.kind === 'user').at(-1) ?? null
  lastAssistant = rows.filter(r => r.kind === 'assistant').at(-1) ?? null
  // head 行(首行 {type:'head',sessionId}) = 会话身份——卡的「段读位」按它持久化
  // (galgame 读位 2026-09-25 批;缺席 → null,卡侧退化为不持久)。
  session = rows.find(r => r.type === 'head')?.sessionId ?? null
} catch {}

// ── 当前 CG(cg.json 缺席=manifest 默认)与层切片 ──
let id = manifest.default
try { id = JSON.parse(readFileSync('cg.json', 'utf8')).id ?? id } catch {}
const cg = manifest.cgs[id] ?? manifest.cgs[manifest.default] ?? null
const layers = cg?.layers ?? []
const assetKeys = layers.map(l => l.img)

const rev = `${stat('.chat.snapshot.jsonl')}:${stat('cg.json')}:${stat('../preset/assets/cg/manifest.json')}`

// ── op:history(backlog 翻更早):旧轮分页切片,升序;offset 越界空页,total=全量行数 ──
if (op === 'history') {
  const offset = Number.isInteger(a.offset) ? Math.max(0, a.offset) : 0
  const limit = Number.isInteger(a.limit) ? Math.max(1, a.limit) : PAGE
  process.stdout.write(JSON.stringify({ ok: true, rows: history.slice(offset, offset + limit), total: history.length }))
  process.exit(0)
}

// ── op:panel:最近一页 + 总数;lastAssistant 只留 orig(text 由前端 stripDirectives 现算) ──
process.stdout.write(JSON.stringify({
  ok: true,
  rev,
  assetKeys,
  data: {
    session,
    lastUser: lastUser ? { seq: lastUser.seq, text: strip(lastUser.plain) } : null,
    // orig = 保留注释原样(段级 CG 判定必须从 orig 取);去注释展示文本前端 stripDirectives 现算
    lastAssistant: lastAssistant ? { seq: lastAssistant.seq, orig: lastAssistant.orig } : null,
    cg: { id, layers },
    history: history.slice(-PAGE),
    historyTotal: history.length,
  },
}))
