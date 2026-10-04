// mvu_commit.mjs — main.after 钩子:读 .chat.snapshot.jsonl 尾 assistant 正文 → 抽 ```mvu``` 块 →
// JSON.parse → 合并写 state.md(八节) + 应用 memory(经 lib/mvu-apply.mjs)。money/exp 已迁 gain_money/gain_exp 工具。
// cwd=runtime(钩子 spawn 契约,同 history_alert);无块/坏块=本回合无维护,只留一行 stdout 摘要,不 exit 非零。
// 逐条 try/catch:warn 到 stderr 后继续,不因单条坏账杀整轮。state.md 只覆盖 mvu 块**点名**的节,
// 未点名的节保留旧值(全量声明是契约,缺键是模型失误——保留旧值>清空)。
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { findCharFile, saveChar } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { applyMemory } = await import(pathToFileURL(process.cwd() + '/../preset/lib/mvu-apply.mjs').href)

// ── 读快照尾 assistant 正文 ──
let orig = null
try {
  const rows = readFileSync('.chat.snapshot.jsonl', 'utf8').trim().split('\n').map(l => JSON.parse(l))
  const asst = rows.filter(r => r.kind === 'assistant').at(-1)
  if (asst) orig = asst.orig ?? ''
} catch (e) { console.error('mvu_commit: 读快照失败 ' + e.message) }
if (!orig) { console.log('mvu: 无可读正文'); process.exit(0) }

// ── 抽 mvu 块:优先 <pre data-mvu>…</pre>(HTML 折叠形态),回退 ```mvu …``` 围栏 ──
const pick = () => {
  const pre = /<pre\b[^>]*data-mvu[^>]*>([\s\S]*?)<\/pre>/i.exec(orig)
  if (pre) return pre[1]
  const fence = /```mvu[^\n]*\n([\s\S]*?)```/.exec(orig)
  return fence ? fence[1] : null
}
const payload = pick()
if (payload == null) { console.log('mvu: 无块(本回合无维护)'); process.exit(0) }
let data
try { data = JSON.parse(payload) } catch (e) { console.log('mvu: 解析失败,跳过(本回合不写)——' + e.message); process.exit(0) }
if (!data || typeof data !== 'object' || Array.isArray(data)) { console.log('mvu: 块非对象,跳过'); process.exit(0) }

const warn = (msg) => console.error('mvu_commit: ' + msg)

// ── state.md 写(合并:只覆盖点名节,缺键保留旧值) ──
const readSection = (md, heading) => {
  const i = md.indexOf('## ' + heading)
  if (i < 0) return ''
  const j = md.indexOf('\n## ', i + 1)
  const raw = j < 0 ? md.slice(i) : md.slice(i, j)
  const nl = raw.indexOf('\n')
  return nl < 0 ? '' : raw.slice(nl + 1).replace(/\s+$/g, '')
}
const renderNearby = (list) => {
  const rows = (Array.isArray(list) ? list : []).map(n => `- ${String(n?.name ?? '').trim()} | ${n?.stance ?? '中立'}`).filter(r => r !== '-  | 中立')
  return rows.length ? rows.join('\n') : '- （无）'
}
const renderCombat = (c) => {
  if (!c) return '- （无战斗）'
  const lines = []
  if (c.round != null) lines.push(`- 回合：${c.round}`)
  if (Array.isArray(c.order) && c.order.length) lines.push(`- 先攻：${c.order.map(o => typeof o === 'string' ? o : `${o.who}:${o.init}`).join(' > ')}`)
  for (const f of (Array.isArray(c.fighters) ? c.fighters : [])) lines.push(`- 参战行：${f.name}${f.status ? ' | ' + f.status : ''}`)
  return lines.length ? lines.join('\n') : '- （无战斗）'
}
let md = ''
try { md = readFileSync('state.md', 'utf8') } catch { /* 缺档=首回合前,按空处理 */ }
function buildState() {
  const time = 'time' in data ? `- 当前时间：${data.time ?? ''}` : readSection(md, '时间')
  const location = 'location' in data ? `- 地点ID：${data.location?.id ?? ''}\n- 地点名：${data.location?.name ?? ''}` : readSection(md, '地点')
  const weather = 'weather' in data ? `- ${data.weather ?? ''}` : readSection(md, '天气')
  const terrain = 'terrain' in data ? `- ${data.terrain ?? ''}` : readSection(md, '地形')
  const nearby = 'nearby' in data ? renderNearby(data.nearby) : readSection(md, '附近 NPC')
  const quests = 'quests' in data ? (Array.isArray(data.quests) ? data.quests.map(q => `- ${q}`).join('\n') : '') : readSection(md, '任务')
  const foreshadow = 'foreshadow' in data ? (Array.isArray(data.foreshadow) ? data.foreshadow.map(q => `- ${q}`).join('\n') : '') : readSection(md, '伏笔')
  const combat = 'combat' in data ? renderCombat(data.combat) : readSection(md, '战斗')
  return [
    '# 世界状态',
    `## 时间\n${time}`,
    `## 地点\n${location}`,
    `## 天气\n${weather}`,
    `## 地形\n${terrain}`,
    `## 附近 NPC\n${nearby}`,
    `## 任务\n${quests}`,
    `## 伏笔\n${foreshadow}`,
    `## 战斗\n${combat}`,
  ].join('\n\n') + '\n'
}
writeFileSync('state.md', buildState())

// ── 应用 memory(逐条 try/catch;money/exp 已迁 gain_money/gain_exp 工具) ──
let nMemory = 0
for (const e of (Array.isArray(data.memory) ? data.memory : [])) {
  try {
    const f = findCharFile(e.who)
    if (!f) { warn(`memory: 查无角色 ${e.who}`); continue }
    const j = JSON.parse(readFileSync(f, 'utf8'))
    const lines = applyMemory(j, e)
    if (!lines.length) { warn(`memory: ${e.who} 未传任何可更新键(history_append/history_overwrite/description/thought)`); continue }
    saveChar(f, j); nMemory++
  } catch (err) { warn('memory ' + JSON.stringify(e) + ' → ' + err.message) }
}

console.log(`mvu: 已落盘 state.md · memory ${nMemory}`)
process.exit(0)