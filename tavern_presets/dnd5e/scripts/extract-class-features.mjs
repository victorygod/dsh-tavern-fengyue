// extract-class-features.mjs — 职业特征全文抽取(2026-09-30 第二批):spawn/opening 产 feature_details
// (名|释义 连文本入档,假设 agent 运行中无法查 lorebook——与怪物 traits 同律)。
// 产出 preset/lib/class-feature-data.mjs(CLS_FEATURES:{cls:[{name, level, text}]})——取 classes md
// 「## Class Features」下「### Name (Level N)」各节全文;特征行 classRow 名与本表名前缀匹配(buildClass 消费侧)。
// 运行: node tavern_presets/dnd5e/scripts/extract-class-features.mjs
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CARD = join(HERE, '..')
const PRESET = join(HERE, '..', 'preset')
const DIR = join(CARD, 'corpus', 'srd-lorebook', 'classes')
const OUT = join(PRESET, 'lib', 'class-feature-data.mjs')
const slugify = (s) => String(s).replace(/\.[a-z]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const core = {}
const files = readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'INDEX.md')
for (const f of files) {
  const raw = readFileSync(join(DIR, f), 'utf8')
  // 按顶级 '## ' 分块(split 法——多行 lookahead 的 $ 断行陷阱),取「## Class Features」块
  const sec = raw.split(/^\r?## /m).find(c => c.startsWith('Class Features'))
  if (!sec) continue
  const feats = []
  // 节切分:### Name (Level N) —— NAME 允许冒号/括号(如 Spellcasting: Wizard);text=后续至下一节
  const parts = sec.slice('Class Features'.length).split(/^### (.+?)\s*$/m).slice(1)
  for (let i = 0; i < parts.length; i += 2) {
    const head = parts[i].trim()
    const text = parts[i + 1].trim()
    const lm = /^(.*?)\s*\(Level (\d+)\)\s*$/.exec(head)
    feats.push({
      name: lm ? lm[1].trim() : head,
      level: lm ? +lm[2] : null,
      text,
    })
  }
  core[slugify(f)] = feats
}

const sorted = Object.fromEntries(Object.keys(core).sort().map(k => [k, core[k]]))
const header = `// class-feature-data.mjs — 12 职业特征全文(2026-09-30 由 scripts/extract-class-features.mjs 抽取;
// assemble 重跑后重抽)。spawn/opening 产 feature_details 零 lorebook 读取。勿手改,重抽覆盖。
export const CLS_FEATURES = ${JSON.stringify(sorted, null, 1)}
`
writeFileSync(OUT, header)
console.log(`CLS_FEATURES: ${Object.keys(sorted).map(k => `${k}:${core[k].length}`).join(' · ')} → ${OUT}`)
