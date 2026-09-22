#!/usr/bin/env node
// srd-convert.mjs — 把 5e-bits/5e-database 的 SRD JSON 语料渲染为纯文本 markdown 库。
// 用法: node scripts/srd-convert.mjs <db-src-dir> <out-dir>
//   <db-src-dir> = 5e-database 仓库的 src/2014/en(2014 基线)或 src/2024/en
// 渲染目标 = 卡片 lore 的粒度: 每实体一个 <category>/<slug>.md,frontmatter 带 name+一句 description;
// 每类一个 INDEX.md(名称+一句+路径,即「索引进提示词、原文按需读」的注入源)。源 JSON 原样随行保留。

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [dbSrc, outDirArg] = process.argv.slice(2)
if (dbSrc === undefined || !existsSync(dbSrc)) {
  console.error('usage: node scripts/srd-convert.mjs <db-src-dir> <out-dir>')
  console.error('  <db-src-dir>: 5e-database 的 src/2014/en 或 src/2024/en')
  process.exit(1)
}
const outDir = outDirArg ?? 'docs/dnd5e-srd/2014'
mkdirSync(outDir, { recursive: true })

const read = name => JSON.parse(readFileSync(join(dbSrc, name)))
// Windows 保留设备名不能作文件基名（con.md 在 Windows 上无法 checkout）——SRD 缩写 con 改全称，链接随 slug() 保持一致。
const SLUG_OVERRIDES = { con: 'constitution' }
const slug = index => {
  const raw = String(index).replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return SLUG_OVERRIDES[raw] ?? raw
}
// paras(x) 接受三种形态: desc 字符串 / desc 段落数组 / 实体对象(2014 库用 desc,2024 库部分实体改叫 description)
const paras = (source) => {
  if (source == null) return ''
  if (Array.isArray(source)) return source.join('\n\n')
  if (typeof source === 'object') {
    const v = source.desc ?? source.description
    return v == null ? '' : Array.isArray(v) ? v.join('\n\n') : String(v)
  }
  return String(source)
}
const Y = s => String(s ?? '')
const oneLine = desc => paras(desc).replace(/\s+/g, ' ').replace(/^#+\s*/, '').slice(0, 160).trim()

const files = {}
for (const f of readdirSync(dbSrc)) if (f.endsWith('.json')) files[f.replace(/\.json$/, '')] = read(f)

function writeEntity(category, entry, body, descForIndex) {
  const dir = join(outDir, category)
  mkdirSync(dir, { recursive: true })
  const fm = [
    '---',
    `name: ${Y(entry.name).replace(/"/g, "'")}`,
    `description: ${String(descForIndex).replace(/"/g, "'").slice(0, 160)}`,
    '---',
    '',
  ].join('\n')
  writeFileSync(join(dir, `${slug(entry.index)}.md`), fm + body.trim() + '\n')
}

function writeIndex(category, rows) {
  if (rows.length === 0) return
  const lines = [`# ${category} — ${rows.length} entries`, '',
    ...rows.map(r => `- [${r.name}](${slug(r.index)}.md) — ${r.desc}`)]
  writeFileSync(join(outDir, category, 'INDEX.md'), lines.join('\n') + '\n')
}

const fmtStat = v => `${v} (${Math.floor((v - 10) / 2)})`
const acText = (ac) => {
  if (ac === undefined || ac === null) return '?'
  if (typeof ac === 'number') return String(ac)
  const list = Array.isArray(ac) ? ac : [ac]
  return list.map(a => {
    const note = [a.armor?.map(x => x.name).join(', '), a.desc].filter(Boolean).join(' · ')
    return note ? `${a.value} (${note})` : String(a.value)
  }).join(' or ')
}
const acNum = (ac) => (Array.isArray(ac) ? ac[0]?.value ?? '?' : typeof ac === 'number' ? ac : '?')
const sensesText = (s) => {
  if (s === undefined || s === null || s === '') return 'passive Perception 10'
  if (typeof s === 'string') return s
  return Object.entries(s).map(([k, v]) => k === 'passive_perception' ? `passive Perception ${v}` : `${k.replaceAll('_', ' ')} ${v}`).join(', ')
}

// ---- spells ----
if (files['5e-SRD-Spells'] !== undefined) {
  const idx = []
  for (const s of files['5e-SRD-Spells']) {
    const ordinal = ['cantrip', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level', '6th-level', '7th-level', '8th-level', '9th-level'][s.level]
    const dur = `${s.concentration === true ? 'Concentration, up to ' : ''}${s.duration ?? ''}`
    const head = [
      `**${ordinal} ${s.school?.name ?? ''}**` + (s.ritual === true ? ' (ritual)' : ''),
      `- **Casting Time:** ${s.casting_time}`,
      `- **Range:** ${s.range}`,
      `- **Components:** ${Array.isArray(s.components) ? s.components.join(', ') : s.components}` + (s.material !== undefined ? ` (${s.material})` : ''),
      `- **Duration:** ${dur}`,
      `- **Spell Lists:** ${s.classes?.map(c => c.name).join(', ')}`,
    ]
    const body = [head.join('\n'), '', paras(s),
      ...(s.higher_level !== undefined && s.higher_level.length > 0 ? ['', '**At Higher Levels.** ' + paras(s.higher_level)] : [])].join('\n')
    writeEntity('spells', s, body, oneLine(s))
    idx.push({ index: s.index, name: s.name, desc: `${ordinal} ${s.school?.name ?? ''}${s.ritual === true ? ' · ritual' : ''}` })
  }
  writeIndex('spells', idx)
}

// ---- monsters ----
if (files['5e-SRD-Monsters'] !== undefined) {
  const profLine = (prof) => (prof ?? []).map(p => `${p.proficiency?.name}: ${p.value > 0 ? '+' : ''}${p.value}`).join(', ')
  const idx = []
  for (const m of files['5e-SRD-Monsters']) {
    const block = [
      `*${m.size} ${m.type}${m.subtype !== undefined ? ` (${m.subtype})` : ''}, ${m.alignment ?? 'unaligned'}*`,
      `- **Armor Class** ${acText(m.armor_class)}${m.armor_desc !== undefined ? ` (${m.armor_desc})` : ''}`,
      `- **Hit Points** ${m.hit_points} (${m.hit_points_roll ?? m.hit_dice ?? ''})`,
      `- **Speed** ${m.speed.walk ?? ''}${m.speed.climb !== undefined ? `, climb ${m.speed.climb}` : ''}${m.speed.fly !== undefined ? `, fly ${m.speed.fly}` : ''}${m.speed.swim !== undefined ? `, swim ${m.speed.swim}` : ''}${m.speed.burrow !== undefined ? `, burrow ${m.speed.burrow}` : ''}`,
      '',
      `| STR | DEX | CON | INT | WIS | CHA |`,
      `| ${fmtStat(m.strength)} | ${fmtStat(m.dexterity)} | ${fmtStat(m.constitution)} | ${fmtStat(m.intelligence)} | ${fmtStat(m.wisdom)} | ${fmtStat(m.charisma)} |`,
      '',
      (profLine(m.proficiencies) !== '' ? `- **Proficiencies** ${profLine(m.proficiencies)}\n` : '')
      + (m.damage_vulnerabilities !== undefined && m.damage_vulnerabilities.length > 0 ? `- **Damage Vulnerabilities** ${m.damage_vulnerabilities.join(', ')}\n` : '')
      + (m.damage_resistances !== undefined && m.damage_resistances.length > 0 ? `- **Damage Resistances** ${m.damage_resistances.join(', ')}\n` : '')
      + (m.damage_immunities !== undefined && m.damage_immunities.length > 0 ? `- **Damage Immunities** ${m.damage_immunities.join(', ')}\n` : '')
      + (m.condition_immunities !== undefined && m.condition_immunities.length > 0 ? `- **Condition Immunities** ${m.condition_immunities.join(', ')}\n` : '')
      + `- **Senses** ${sensesText(m.senses)}\n`
      + `- **Languages** ${m.languages ?? '—'}\n`
      + `- **Challenge** ${m.challenge_rating} (${m.xp ?? '?'} XP, PB ${m.proficiency_bonus > 0 ? '+' : ''}${m.proficiency_bonus})`,
      '',
      ...(m.special_abilities ?? []).map(a => `**${a.name}.** ${a.desc}`).flatMap(t => [t, '']),
      ...(m.actions ?? []).map(a => `***${a.name}.*** ${a.desc}`).flatMap(t => [t, '']),
      ...(m.legendary_actions ?? []).map(a => `***${a.name} (Legendary).*** ${a.desc}`).flatMap(t => [t, '']),
    ]
    writeEntity('monsters', m, block.join('\n'), `${m.size} ${m.type}, CR ${m.challenge_rating} (${m.xp} XP)`)
    idx.push({ index: m.index, name: m.name, desc: `CR ${m.challenge_rating} · ${m.hit_points} HP · AC ${acNum(m.armor_class)}` })
  }
  writeIndex('monsters', idx)
}

// ---- classes（含等级表 + 职业特征 + 子职业名）----
if (files['5e-SRD-Classes'] !== undefined) {
  const levelsPool = files['5e-SRD-Levels'] ?? []
  for (const c of files['5e-SRD-Classes']) {
    // Levels 含「职业行」与「子职业等级行」(subclasses 各自 3/6/10/14/18 等),class 字段同为父职业——按 subclass 空否分开
    const classRows = levelsPool.filter(l => l.class?.index === c.index && l.subclass == null).sort((a, b) => a.level - b.level)
    const subRows = levelsPool.filter(l => l.class?.index === c.index && l.subclass != null).sort((a, b) => a.subclass.index.localeCompare(b.subclass.index) || a.level - b.level)
    const myFeatures = (files['5e-SRD-Features'] ?? []).filter(f => f.class?.index === c.index).sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name))
    const head = [
      `*Hit Dice:* 1d${c.hit_die} per ${c.name.toLowerCase()} level`,
      `*Saving Throws:* ${c.saving_throws?.map(s => s.name).join(', ') ?? '—'}`,
      `*Subclasses:* ${c.subclasses?.map(s => s.name).join(', ') ?? '—'} `,
      '',
      '| Level | PB | Features | Class Specific |',
      '|---|---|---|---|',
      ...classRows.map(l => `| ${l.level} | +${l.prof_bonus} | ${l.features?.map(f => f.name).join(', ') || '—'} | ${l.class_specific !== undefined && Object.keys(l.class_specific).length > 0 ? JSON.stringify(l.class_specific) : '—'} |`),
      '',
      ...(subRows.length > 0 ? ['## Subclass Levels', '', ...subRows.map(l => `- **${l.subclass.name} LV${l.level}:** ${l.features?.map(f => f.name).join(', ')}`), ''] : []),
      '## Class Features',
      ...(myFeatures.map(f => {
        const pre = f.prerequisites == null || (Array.isArray(f.prerequisites) && f.prerequisites.length === 0) || String(f.prerequisites) === '' ? `Level ${f.level}` : String(f.prerequisites).replace(/"/g, '')
        return `### ${f.name} (${pre})\n\n${paras(f)}`
      }).flatMap(t => [t, ''])),
    ]
    writeEntity('classes', c, head.join('\n'), `${c.name}: d${c.hit_die} HD, saves ${c.saving_throws.map(s => s.name).join('/')}`)
  }
  writeIndex('classes', files['5e-SRD-Classes'].map(c => ({ index: c.index, name: c.name, desc: `d${c.hit_die} HD · saves ${c.saving_throws.map(s => s.name).join('/')}` })))
}

// ---- races / species（含子种族与种族特征内联；2024 的 Species/Subspecies 同接口）----
{
  const raceList = files['5e-SRD-Races'] ?? files['5e-SRD-Species']
  if (raceList !== undefined) {
    const cat = files['5e-SRD-Races'] !== undefined ? 'races' : 'species'
    const subLabel = cat === 'races' ? 'Subrace' : 'Subspecies'
    const traits = new Map((files['5e-SRD-Traits'] ?? []).map(t => [t.index, t]))
    const subMap = new Map((files['5e-SRD-Subraces'] ?? files['5e-SRD-Subspecies'] ?? []).map(s => [s.index, s]))
    const abLine = (list) => (list ?? [])
      .map(a => `${a.ability_score?.name ?? a.ability_score ?? '?'} ${a.bonus > 0 ? '+' : ''}${a.bonus}`).join(', ')
    for (const r of raceList) {
      const traitTexts = (r.traits ?? []).map(tr => typeof tr === 'string' ? undefined : traits.get(tr.index)).filter(Boolean)
        .map(t => `### ${t.name}${t.proficiency !== undefined ? ` (${t.proficiency[0]?.name})` : ''}\n\n${paras(t)}`)
      const subs = (r.subraces ?? r.subspecies ?? []).map(sr => typeof sr === 'string' ? undefined : subMap.get(sr.index)).filter(Boolean)
      const subTexts = subs.flatMap(sr => [`## ${subLabel}: ${sr.name}`, '',
        (abLine(sr.ability_bonuses) || ''), (sr.traits ?? []).map(tr => traits.get(tr.index)).filter(Boolean).map(t => `### ${t.name}\n\n${paras(t)}`).join('\n\n'), ''])
      const abilityLine = abLine(r.ability_bonuses)
      const body = [
        `*Speed:* ${r.speed} ft.${abilityLine !== '' ? ` · *Ability Bonuses:* ${abilityLine}` : ''}`,
        '',
        ...(r.age !== undefined ? [`**Age.** ${paras(r.age)}`] : []),
        ...(r.alignment !== undefined ? [`**Alignment.** ${paras(r.alignment)}`] : []),
        ...(r.size_description !== undefined ? [`**Size.** ${paras(r.size)} ${paras(r.size_description)}`] : []),
        ...(r.language_desc !== undefined ? [`**Languages.** ${paras(r.language_desc)}`] : []),
        ...((paras(r) !== '' && cat === 'species') ? [paras(r)] : []),
        ...(traitTexts.length > 0 ? ['', '## Traits', '', traitTexts.join('\n\n')] : []),
        ...subTexts,
      ]
      writeEntity(cat, r, body.join('\n'), `Speed ${r.speed} ft. · ${abilityLine}`)
    }
    writeIndex(cat, raceList.map(r => ({ index: r.index, name: r.name, desc: `speed ${r.speed}, ${abLine(r.ability_bonuses)}` })))
  }
}

// ---- magic-items ----
if (files['5e-SRD-Magic-Items'] !== undefined) {
  const attText = v => v === true ? 'requires attunement' : typeof v === 'string' && v !== '' ? v : undefined
  const rarityText = r => (typeof r === 'string' ? r : r?.name) ?? ''
  for (const it of files['5e-SRD-Magic-Items']) {
    const desc = paras(it)
    const att = attText(it.attunement)
    const head = `*${[it.equipment_category?.name, it.item_category, rarityText(it.rarity)].filter(Boolean).join(', ')}*${att !== undefined ? ` — **${att}**` : ''}`
    writeEntity('magic-items', it, `${head}\n\n${desc}`, `${rarityText(it.rarity)} ${it.item_category ?? ''}`.trim() || oneLine(it))
  }
  writeIndex('magic-items', files['5e-SRD-Magic-Items'].map(it => ({ index: it.index, name: it.name, desc: `${rarityText(it.rarity) || '?'}${attText(it.attunement) !== undefined ? ' · attunement' : ''}` })))
}

// ---- equipment ----
if (files['5e-SRD-Equipment'] !== undefined) {
  for (const e of files['5e-SRD-Equipment']) {
    const lines = [`*${e.equipment_category?.name}${e.gear_category !== undefined ? ` — ${e.gear_category.name}` : ''} · cost ${e.cost?.quantity} ${e.cost?.unit} · ${e.weight ?? '?'} lb.*`]
    if (e.armor_class !== undefined) {
      lines.push(`- **Armor Class** ${e.armor_class.base}${e.armor_class.dex_bonus === true ? ' + Dex modifier' : ''}${e.armor_class.max_bonus !== undefined ? ` (max +${e.armor_class.max_bonus})` : ''}`)
      if (e.str_minimum !== undefined) lines.push(`- **Strength** ${e.str_minimum} (speed −10 ft if below)`)
      if (e.stealth_disadvantage === true) lines.push('- **Stealth** Disadvantage')
    }
    if (e.weapon_category !== undefined) {
      lines.push(`- **${e.category_range ?? e.weapon_category} weapon${e.weapon_range === 'Ranged' ? ` · range ${e.range?.normal}/${e.range?.long}` : ''}${e.throw_range !== undefined ? ` · thrown ${e.throw_range.normal}/${e.throw_range.long}` : ''}**`)
      if (e.damage !== undefined) lines.push(`- **Damage** ${e.damage.damage_dice} ${e.damage.damage_type.name}`)
      if (e.properties !== undefined) lines.push(`- **Properties** ${e.properties.map(p => p.name).join(', ')}`)
      if (e.special !== undefined) lines.push(`- **Special** ${e.special.map(s => JSON.stringify(s)).join('; ')}`)
    }
    if (e.desc !== undefined) lines.push('', paras(e))
    writeEntity('equipment', e, lines.join('\n'), oneLine(e) || `${e.equipment_category?.name} · ${e.cost?.quantity} ${e.cost?.unit}`)
  }
  writeIndex('equipment', files['5e-SRD-Equipment'].map(e => ({ index: e.index, name: e.name, desc: `${e.equipment_category?.name ?? ''}${e.weapon_category !== undefined ? ` · ${e.damage?.damage_dice ?? ''}` : ''}${e.armor_class !== undefined ? ` · AC ${e.armor_class.base}` : ''}` })))
}

// ---- 泛化类别: 剩余每个 entry 都有 name/desc ----
const generic = {
  '5e-SRD-Skills': 'skills', '5e-SRD-Conditions': 'conditions', '5e-SRD-Damage-Types': 'damage-types',
  '5e-SRD-Ability-Scores': 'ability-scores', '5e-SRD-Alignments': 'alignments', '5e-SRD-Languages': 'languages',
  '5e-SRD-Weapon-Properties': 'weapon-properties', '5e-SRD-Feats': 'feats', '5e-SRD-Backgrounds': 'backgrounds',
  '5e-SRD-Magic-Schools': 'magic-schools', '5e-SRD-Rule-Sections': 'rules', '5e-SRD-Proficiencies': 'proficiencies',
  '5e-SRD-Poisons': 'poisons', '5e-SRD-Weapon-Mastery-Properties': 'weapon-mastery-properties', '5e-SRD-Rules': 'game-rules',
}
for (const [file, cat] of Object.entries(generic)) {
  const list = files[file]
  if (list === undefined) continue
  for (const e of list) writeEntity(cat, e, paras(e), oneLine(e))
  writeIndex(cat, list.map(e => ({ index: e.index, name: e.name, desc: oneLine(e).slice(0, 90) })))
}

// ---- 校点 ----
for (const f of readdirSync(dbSrc)) if (f.endsWith('.json')) mkdirSync(join(outDir, '.src'), { recursive: true }) || cpSync(join(dbSrc, f), join(outDir, '.src', f))
console.log(`srd-convert: rendered corpus at ${outDir}`)
for (const dir of readdirSync(outDir).filter(d => !d.startsWith('.')).sort()) {
  const n = readdirSync(join(outDir, dir)).filter(f => f !== 'INDEX.md').length
  console.log(`  ${dir.padEnd(20)} ${n} files`)
}
