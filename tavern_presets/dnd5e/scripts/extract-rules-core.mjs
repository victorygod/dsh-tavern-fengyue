// extract-rules-core.mjs — rules 章全文抽取(2026-09-30 批3:runtime 零 lorebook——rules 成 RULES_CORE 数据模块,
// LLM 查证走 rule 查章工具,不再 runtimeRead md)。产出 preset/lib/rules-core-data.mjs(RULES_CORE:{slug:{name,text}})。
// text=去 frontmatter 后的 md 正文原样(章内标题/北物保留,rule 工具整章返回)。
// 运行: node tavern_presets/dnd5e/scripts/extract-rules-core.mjs(语料=卡根 corpus/;assemble 重跑后重抽)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CARD = join(HERE, '..')
const DIR = join(CARD, 'corpus', 'srd-lorebook', 'rules')
const OUT = join(CARD, 'preset', 'lib', 'rules-core-data.mjs')
const slugify = (s) => String(s).replace(/\.[a-z]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const core = {}
const files = readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'INDEX.md')
for (const f of files) {
  const raw = readFileSync(join(DIR, f), 'utf8')
  const fmM = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const body = fmM ? raw.slice(fmM[0].length) : raw
  const name = /^name:\s*(.+)$/m.exec(fmM?.[1] ?? '')?.[1]?.replace(/^"|"$/g, '') ?? slugify(f)
  core[slugify(f)] = { name, text: body.trim() }
}

const sorted = Object.fromEntries(Object.keys(core).sort().map(k => [k, core[k]]))
const header = `// rules-core-data.mjs — ${files.length} 规则章全文(2026-09-30 由 scripts/extract-rules-core.mjs 抽取;
// 语料=卡根 corpus/srd-lorebook/rules;assemble 重跑后重抽)。LLM 查证走 rule 查章工具(章枚举),runtime 零 lorebook。
// entry={name, text(原正文)}。勿手改,重抽覆盖。
export const RULES_CORE = ${JSON.stringify(sorted, null, 1)}
`
writeFileSync(OUT, header)
console.log(`RULES_CORE: ${Object.keys(sorted).length} entries → ${OUT}`)
