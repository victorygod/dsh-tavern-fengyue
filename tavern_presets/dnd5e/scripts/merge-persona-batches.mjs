// merge-persona-batches.mjs — 怪物 persona 数据批合并器(2026-09-30,persona-threelayer_zh.md 定案 4:
// 怪人设=数据面预生成;怪侧二次翻案=spawn 不收 LLM 人设)。scripts/persona-batches/batch-*.json 分片
// → 校验(slug ∈ MONSTER_CORE/七键白名单/字数硬闸/alignment 9 值)→ 生成 preset/lib/monster-persona-data.mjs
// (sidecar 模块,不碰可再抽的 monster-core-data.mjs——persona 批与抽取链解耦)。
// 用法:仓库根 `node tavern_presets/dnd5e/scripts/merge-persona-batches.mjs`;缺怪/坏值退出 1 并列明细。
// 跨平台:纯 node:fs/path,无 shell 构造。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CARD = resolve(HERE, '..')
const { MONSTER_CORE } = await import(pathToFileURL(join(CARD, 'preset', 'lib', 'monster-core-data.mjs')).href)
const { PERSONA_LIMITS, PERSONA_ALIGNMENTS } = await import(pathToFileURL(join(CARD, 'preset', 'lib', 'persona.mjs')).href)
const P_KEYS = ['appearance', 'lens', 'reaction', 'voice', 'never', 'tension', 'alignment']

const dir = join(HERE, 'persona-batches')
let batches = []
try { batches = readdirSync(dir).filter(f => f.startsWith('batch-') && f.endsWith('.json')).sort() } catch {}
if (!batches.length) { console.log('!persona-batches/ 无 batch-*.json 分片'); process.exit(1) }

const merged = {}
const errors = []
for (const f of batches) {
  let data
  try { data = JSON.parse(readFileSync(join(dir, f), 'utf8')) } catch (e) { errors.push(`!${f}: JSON 损坏(${e.message})`); continue }
  for (const [slug, persona] of Object.entries(data)) {
    if (!MONSTER_CORE[slug]) { errors.push(`!${f}:'${slug}' 不在 MONSTER_CORE`); continue }
    if (typeof persona !== 'object' || Array.isArray(persona)) { errors.push(`!${f}:'${slug}' 值须为对象`); continue }
    const bad = []
    for (const [k, v] of Object.entries(persona)) {
      if (!P_KEYS.includes(k)) { bad.push(`${k}=非法键`); continue }
      if (typeof v !== 'string') { bad.push(`${k}=非字符串`); continue }
      if (k === 'alignment') { PERSONA_ALIGNMENTS.includes(v) || bad.push(`alignment='${v}' 超 9 值枚举`); continue }
      const lim = PERSONA_LIMITS[k]
      if (!v.trim()) bad.push(`${k}=空串`)
      else if (v.length > lim) bad.push(`${k}=超长(${v.length}>${lim})`)
    }
    if (!persona.lens) bad.push('缺 lens')
    if (!persona.reaction) bad.push('缺 reaction')
    if (!persona.appearance) bad.push('缺 appearance')
    if (bad.length) errors.push(`!${f}:'${slug}' ${bad.join(' · ')}`)
    else merged[slug] = persona
  }
}

const covered = Object.keys(merged).length
const all = Object.keys(MONSTER_CORE).length
const missing = Object.keys(MONSTER_CORE).filter(s => !merged[s])

for (const e of errors) console.log(e)
if (missing.length) console.log(`!缺 persona 行(共 ${missing.length}):${missing.join(',')}`)
writeFileSync(
  join(CARD, 'preset', 'lib', 'monster-persona-data.mjs'),
  `// monster-persona-data.mjs — 怪物 persona 数据面(2026-09-30,persona-threelayer_zh.md 定案 4:\n` +
  `// 怪人设=数据面预生成;每怪一份固定 persona 行,由 spawn_monster 机械落卡,零 LLM 人设通道)。\n` +
  `// 单源:scripts/persona-batches/batch-*.json → merge-persona-batches.mjs 合并生成本件——手改会被合并覆盖。\n` +
  `// 校验律:slug ∈ MONSTER_CORE;键 ⊆ 七键白名单;字数 ≤ lib/persona.mjs PERSONA_LIMITS;alignment 9 值枚举。\n` +
  `export const MONSTER_PERSONA = ${JSON.stringify(merged, null, 1)}\n`,
)
console.log(`✓ monster-persona-data.mjs 生成:${covered}/${all} 怪有 persona 行(${errors.length} 项错弃/重名覆盖忽略)`)
if (errors.length || missing.length) process.exit(1)
