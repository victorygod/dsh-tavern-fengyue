// extract-monster-core.mjs — 怪物核心面抽取(2026-09-29b 档案自含批):spawn 运行时零 lorebook 读取。
// 产出 preset/lib/monster-core-data.mjs(MONSTER_CORE:334 statblock 的 FM core+抗免(已扁平化)+暗视+
// 特征释义 `名|text`+description)——monster-build 的 md 现场解析语义逐式同源(数据先行/断档回退)。
// 与 extract-monster(攻击 488 条)/extract-monster-extra(能力+骑手)互补=三张抽取表合起来吃掉 md 全部机读面。
// 运行: node tavern_presets/dnd5e/scripts/extract-monster-core.mjs(assemble 重跑语料后须重抽)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const CARD = join(HERE, '..')
const PRESET = join(HERE, '..', 'preset')
const MON = join(CARD, 'corpus', 'srd-lorebook', 'monsters')
const OUT = join(PRESET, 'lib', 'monster-core-data.mjs')

const slugify = (s) => String(s).replace(/\.[a-z]+$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
const DMG_TYPES = ['piercing', 'bludgeoning', 'slashing', 'fire', 'cold', 'acid', 'poison', 'lightning', 'thunder', 'necrotic', 'radiant', 'force', 'psychic']
const parseDamageTypes = (text) => {
  if (!text) return []
  const lower = String(text).toLowerCase()
  return DMG_TYPES.filter(t => new RegExp(`\\b${t}\\b`).test(lower))
}

const core = {}
const listify = (raw2) => (typeof raw2 === 'string' ? raw2.split(',').map(s => s.trim()).filter(Boolean) : (Array.isArray(raw2) ? raw2.map(String) : []))
const files = readdirSync(MON).filter(f => f.endsWith('.md') && f !== 'INDEX.md')
for (const f of files) {
  const raw = readFileSync(join(MON, f), 'utf8')
  const fmM = raw.match(/^---\n([\s\S]*?)\n---/)
  const fm = {}
  ;(fmM?.[1] ?? '').split('\n').forEach(l => {
    const li = /^  - (.*)$/.exec(l)
    const kv = /^([a-z_]+):\s*(.*)$/.exec(l)
    if (li && fm._cur) { fm[fm._cur] = [...(fm[fm._cur] ?? []), li[1].replace(/^"|"$/g, '')]; return }
    if (kv) { fm._cur = kv[1]; fm[kv[1]] = kv[2] === '' ? [] : (kv[2] === 'true' ? true : kv[2] === 'false' ? false : (/^-?\d+(\.\d+)?$/.test(kv[2]) ? Number(kv[2]) : kv[2].replace(/^"|"$/g, ''))) }
  })
  const body = raw.replace(/^---\n[\s\S]*?\n---/, '')
  const grab = (label) => (new RegExp(`- \\*\\*${label}\\*\\*\\s*(.*)`).exec(body)?.[1] ?? '').trim()
  const dv = /darkvision (\d+)/i.exec(grab('Senses'))
  const traits = [...body.matchAll(/^\*\*([^*\n]+?)\.\*\*\s*(.+)$/gm)].map(m => `${m[1]}|${m[2].trim()}`)
  const description = (typeof fm.description === 'string' && fm.description.trim()) ||
    `${fm.size ?? ''} ${fm.type ?? ''}${fm.alignment ? ` (${fm.alignment})` : ''}`.trim()
  const languages = listify(fm.languages)
  core[slugify(f)] = {
    cr: fm.cr ?? 0,
    ac: fm.ac ?? 10,
    hp: fm.hp ?? 1,
    ...(fm.hp_roll ? { hp_roll: String(fm.hp_roll) } : {}),
    str: fm.str ?? 10, dex: fm.dex ?? 10, con: fm.con ?? 10, int: fm.int ?? 10, wis: fm.wis ?? 10, cha: fm.cha ?? 10,
    speed: /(\d+)/.exec(String(fm.speed ?? '')) ? +(/(\d+)/.exec(String(fm.speed ?? ''))[1]) : 30,
    ...(dv ? { darkvision: +dv[1] } : {}),
    ...(Array.isArray(fm.save_prof) && fm.save_prof.length ? { save_prof: fm.save_prof.map(String) } : {}),
    ...(Array.isArray(fm.skill_prof) && fm.skill_prof.length ? { skill_prof: fm.skill_prof.map(String) } : {}),
    ...(languages.length ? { languages } : {}),
    resist: parseDamageTypes(grab('Damage Resistances')),
    immune: parseDamageTypes(grab('Damage Immunities')),
    vuln: parseDamageTypes(grab('Damage Vulnerabilities')),
    ...(description ? { description } : {}),
    ...(traits.length ? { features: traits } : {}),
  }
}

const sorted = Object.fromEntries(Object.keys(core).sort().map(k => [k, core[k]]))
const header = `// monster-core-data.mjs — 334 statblock 核心面(2026-09-29b 由 scripts/extract-monster-core.mjs 从语料抽取;
// assemble 重跑后重抽)。spawn 运行时零 lorebook 读取——数据断档时 monster-build 回退 md 现场解析(行为同源)。
// 展开写(键序显式排稳)——行可 diff、可审;勿手改,重抽覆盖。
export const MONSTER_CORE = ${JSON.stringify(sorted, null, 1)}
`
writeFileSync(OUT, header)
console.log(`MONSTER_CORE: ${Object.keys(sorted).length} entries → ${OUT}`)
