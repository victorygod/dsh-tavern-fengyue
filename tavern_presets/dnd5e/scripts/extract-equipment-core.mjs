// extract-equipment-core.mjs — 装备/武器全文档抽取(2026-09-30 第二批):attack(每次攻击读)与 core.deriveAC
// (AC 推导)零 lorebook 读取。产出 preset/lib/equip-core-data.mjs(EQ_CORE:{fm 全量}),FM 语义与 core.readFM
// 逐式同源;断档回退=equipmentFM 原样保留。
// 运行: node tavern_presets/dnd5e/scripts/extract-equipment-core.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CARD = join(HERE, '..')
const PRESET = join(HERE, '..', 'preset')
const DIR = join(CARD, 'corpus', 'srd-lorebook', 'equipment')
const OUT = join(PRESET, 'lib', 'equip-core-data.mjs')
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

const core = {}
const files = readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'INDEX.md')
for (const f of files) {
  const raw = readFileSync(join(DIR, f), 'utf8')
  const fmM = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmM) continue
  core[slugify(f)] = { fm: parseFM(fmM[1]) }
}

const sorted = Object.fromEntries(Object.keys(core).sort().map(k => [k, core[k]]))
const header = `// equip-core-data.mjs — ${files.length} 装备/武器全文档(2026-09-30 由 scripts/extract-equipment-core.mjs 抽取;
// assemble 重跑后重抽)。attack/deriveAC 零 lorebook 读取——断档回退=equipmentFM 原路径。勿手改,重抽覆盖。
export const EQ_CORE = ${JSON.stringify(sorted, null, 1)}
`
writeFileSync(OUT, header)
console.log(`EQ_CORE: ${Object.keys(sorted).length} entries → ${OUT}`)
