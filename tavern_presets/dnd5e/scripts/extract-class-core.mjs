// extract-class-core.mjs — 职业面抽取(2026-09-30 数据化 2b,收掉 classRow 正则——全仓最脆一环):
// buildClass(熟练行/职业表逐级行)/core.classRow/gain_exp 升级链零 lorebook 读取。
// 产出 preset/lib/class-core-data.mjs(CLASS_CORE:{fm 全量(hit_die/saves/subclass),
//   prof_line(*Proficiencies* 行原文,parseSkillChoices 消费), rows[1..20]({pb, features, specific}) })。
// rows 解析与 core.classRow 的正则逐式同源(序数词列);断档回退=classRow/readFM 原路径。
// 运行: node tavern_presets/dnd5e/scripts/extract-class-core.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CARD = join(HERE, '..')
const PRESET = join(HERE, '..', 'preset')
const DIR = join(CARD, 'corpus', 'srd-lorebook', 'classes')
const OUT = join(PRESET, 'lib', 'class-core-data.mjs')
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
  const fm = parseFM(fmM[1])
  const profLine = /\*Proficiencies:\*\s*(.+)/.exec(raw)?.[1]?.trim() ?? null
  const rows = []
  for (const L of Array.from({ length: 20 }, (_, i) => i + 1)) {
    const re = new RegExp(`^\\|\\s*${L}(?:st|nd|rd|th)?\\s*\\|\\s*\\+(\\d+)\\s*\\|\\s*([^|]*)\\|\\s*([^|]*)\\|`, 'm')
    const m = re.exec(raw)
    rows.push(m
      ? { pb: +m[1], features: m[2].trim(), specific: m[3] ? JSON.parse(m[3].replace(/'/g, '"').trim() || '{}') : {} }
      : { pb: null, features: '', specific: {} })
  }
  core[slugify(f)] = { fm, prof_line: profLine, rows }
}

const sorted = Object.fromEntries(Object.keys(core).sort().map(k => [k, core[k]]))
const header = `// class-core-data.mjs — ${files.length} 职业面(2026-09-30 由 scripts/extract-class-core.mjs 抽取;
// assemble 重跑后重抽)。buildClass/classRow 升级链/opening 零 lorebook 读取——断档回退=md 原路径。
// rows[0..19]=L1..L20(逐级行,pb/features/specific——specific 已 JSON 化)。勿手改,重抽覆盖。
export const CLASS_CORE = ${JSON.stringify(sorted, null, 1)}
`
writeFileSync(OUT, header)
console.log(`CLASS_CORE: ${Object.keys(sorted).length} entries → ${OUT}`)
