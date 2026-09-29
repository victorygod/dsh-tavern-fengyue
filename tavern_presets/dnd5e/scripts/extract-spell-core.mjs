// extract-spell-core.mjs — 法术全文档抽取(2026-09-30 第二批数据化):cast/front_commit/ui_data/opening
// 运行时零 lorebook 读取。产出 preset/lib/spell-core-data.mjs(SPELL_CORE:{fm 全量+effect 效果段}),
// FM 字段与 lib/core readFM 语义逐式同源(数字/布尔收敛),effect=剥机械头(**N级** 单行粗+`- **X:**` bullets)
// 后的正文段落(含 At Higher Levels)。与 extract-monster-core/extract-class-features/extract-equipment-core 同律:
// 数据主路+md 断档回退(fixture 兼容),assemble 重跑后重抽。
// 运行: node tavern_presets/dnd5e/scripts/extract-spell-core.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CARD = join(HERE, '..')
const PRESET = join(HERE, '..', 'preset')
const SPELLS = join(CARD, 'corpus', 'srd-lorebook', 'spells')
const OUT = join(PRESET, 'lib', 'spell-core-data.mjs')
const slugify = (s) => String(s).replace(/\.[a-z]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const coerce = (v) => {
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (v === 'true') return true
  if (v === 'false') return false
  return v.replace(/^"|"$/g, '')
}
const parseFM = (rawBody) => {
  const fm = {}
  let cur = null
  for (const line of rawBody.split(/\r?\n/)) {
    const li = /^  - (.*)$/.exec(line)
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (li && cur) { fm[cur] = [...(fm[cur] ?? []), coerce(li[1])]; continue }
    if (kv) { cur = kv[1]; fm[kv[1]] = kv[2].trim() === '' ? [] : coerce(kv[2].trim()) }
  }
  return fm
}
const parseEffect = (body) => {
  const keep = []
  for (const raw of body.split(/\n\s*\n/)) {
    const para = raw.trim()
    if (!para) continue
    const lines = para.split('\n')
    const isMachineHead = lines.every(l => /^-\s*\*\*/.test(l.trim()) || /^\*\*[^*]+\*\*$/.test(l.trim()))
    if (isMachineHead) continue
    keep.push(para)
  }
  return keep.join('\n\n').trim()
}

const core = {}
const files = readdirSync(SPELLS).filter(f => f.endsWith('.md') && f !== 'INDEX.md')
for (const f of files) {
  const raw = readFileSync(join(SPELLS, f), 'utf8')
  const fmM = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmM) continue
  const fm = parseFM(fmM[1])
  const body = raw.slice(fmM[0].length)
  core[slugify(f)] = { fm, effect: parseEffect(body) }
}

const sorted = Object.fromEntries(Object.keys(core).sort().map(k => [k, core[k]]))
const header = `// spell-core-data.mjs — ${files.length} 法术全文档(2026-09-30 由 scripts/extract-spell-core.mjs 从语料抽取;
// assemble 重跑后重抽)。cast/front_commit/ui_data/opening 零 lorebook 读取——断档时回退 md 现场解析(行为同源)。
// entry={fm(机械全字段,cast 结算用), effect(效果正文,回执/档案自含)}。勿手改,重抽覆盖。
export const SPELL_CORE = ${JSON.stringify(sorted, null, 1)}
`
writeFileSync(OUT, header)
console.log(`SPELL_CORE: ${Object.keys(sorted).length} entries → ${OUT}`)
