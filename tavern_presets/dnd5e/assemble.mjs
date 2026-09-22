#!/usr/bin/env node
// srd-assemble.mjs — SRD 语料装配进卡。（名字是历史：现为卡内构建器）
//   源  : docs/dnd5e-srd/{2014,2024}/.src 的 vendored JSON（5e-bits/5e-database，SRD 5.1）
//   出  : <card>/preset/setup/dnd5e-srd-lorebook/<category>/<slug>.md → 开局播种为 runtime/dnd5e-srd-lorebook/
// 数据出处与钉版：5e-bits/5e-database @ 3b124d8（2026-09-12；git clone https://github.com/5e-bits/5e-database 可复得）。
// 授权：SRD 5.1（WotC，OGL v1.0a / CC-BY 4.0）。对外分发含本语料的产物时须附署名：
//   This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the
//   Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document, licensed under
//   the Creative Commons Attribution 4.0 International License.
// 字段覆盖审计（2026-09-18，对照 .src 原始 schema）：已补齐 monsters.reactions / forms（同目录实体引用：
// 数值+链接解析，Bat/Mist 形态在源库中本就是完整 statblock）、classes 起始装备与装备选项（SRD 原文 desc）、
// equipment.contents。法术升环字段源库本无（"At Higher Levels"正文承载）。
// 定位：模型与玩家**共同可见**的共享数据面（模型 runtimeRead 按需查；书本 UI 已删 2026-09-20，数据面保留），与叙事实体 lore/ 分立；尾代理对此只读。
// 文件双层制：frontmatter = 机读层（结构化字段，索引/脚本结算消费），正文 = 人读原文。
// 合并口径：2014 全量基线（剔除 feats/backgrounds/magic-items 及已内联的中间表），2024 只补 poisons。
// 用法：node tavern_presets/dnd5e/assemble.mjs [cardDir]（默认本卡;env SRD_SRC=<5e-database>/src 指源）

import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// 卡内构建脚本：随卡走（卡根 preset/ 之外，不进运行时——引擎开局只复制 preset/）。
// 从自身位置反解仓库根，任意 cwd 可跑；默认装配目标 = 本卡。
const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const cardDir = process.argv[2] ?? HERE
// 源路径:默认仓内 docs/dnd5e-srd(已删,勿依赖)——重渲染用 env SRD_SRC 指向 5e-bits/5e-database 的 src/ 目录
const SRCBASE = process.env.SRD_SRC ?? join(REPO, 'docs/dnd5e-srd')
const SRC = { 2014: join(SRCBASE, '2014/en'), 2024: join(SRCBASE, '2024/en') }
const OUT = join(cardDir, 'preset/setup/dnd5e-srd-lorebook')

for (const dir of Object.values(SRC)) {
  if (!statSync(join(dir), { throwIfNoEntry: false })?.isDirectory()) {
    console.error(`assembla: 缺源目录 ${dir}（先跑 srd-convert.mjs 或检查 docs/dnd5e-srd）`)
    process.exit(1)
  }
}

const load = (year, key) => JSON.parse(readFileSync(join(SRC[year], `${key}.json`)))
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9-]/g, '-')

// paras(x)：容忍 desc 字符串 / 段落数组 / 实体对象（2014 用 desc，2024 部分实体改叫 description）
const paras = (source) => {
  if (source == null) return ''
  if (Array.isArray(source)) return source.join('\n\n')
  if (typeof source === 'object') {
    const v = source.desc ?? source.description
    return v == null ? '' : Array.isArray(v) ? v.join('\n\n') : String(v)
  }
  return String(source)
}

// ---- YAML frontmatter（数值/布尔裸写，字符串防御性引号，布尔仅在 true 时落键）----
const yScalar = (v) => {
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  const s = String(v)
  if (s !== '' && /^[A-Za-z0-9_./+ (){}[\]-]+$/.test(s) && !/\s$/.test(s)) return s
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}
const frontmatter = (fields) => {
  const lines = ['---']
  for (const [key, v0] of fields) {
    let v = key === 'description' && v0 != null ? String(Array.isArray(v0) ? v0.join(' ') : v0).replace(/\s+/g, ' ').trim() : v0
    if (v === undefined || v === null || v === false || (Array.isArray(v) && v.length === 0)) continue
    if (Array.isArray(v)) {
      lines.push(`${key}:`)
      for (const item of v) lines.push(`  - ${yScalar(item)}`)
    } else lines.push(`${key}: ${yScalar(v)}`)
  }
  return [...lines, '---', ''].join('\n')
}

// ---- 产出与索引 ----
const indexRows = new Map() // category -> [{name, file, desc}]
function writeDoc(category, entry, fields, body, oneLine) {
  const dir = join(OUT, category)
  mkdirSync(dir, { recursive: true })
  const file = `${slug(entry.index)}.md`
  writeFileSync(join(dir, file), frontmatter(fields) + String(body).trim() + '\n')
  const rows = indexRows.get(category) ?? []
  rows.push({ name: entry.name, file, desc: String(oneLine).slice(0, 90) })
  indexRows.set(category, rows)
}
const fmtStat = (v) => `${v} (${Math.floor((v - 10) / 2)})`
const acNum = (ac) => (Array.isArray(ac) ? ac[0]?.value ?? '?' : typeof ac === 'number' ? ac : '?')
const acText = (ac) => {
  if (ac === undefined || ac === null) return '?'
  if (typeof ac === 'number') return String(ac)
  return (Array.isArray(ac) ? ac : [ac]).map(a => {
    const note = [a.armor?.map(x => x.name).join(', '), a.desc].filter(Boolean).join(' · ')
    return note ? `${a.value} (${note})` : String(a.value)
  }).join(' or ')
}
const sensesText = (s) => {
  if (s === undefined || s === null || s === '') return 'passive Perception 10'
  if (typeof s === 'string') return s
  return Object.entries(s).map(([k, v]) => k === 'passive_perception' ? `passive Perception ${v}` : `${k.replaceAll('_', ' ')} ${v}`).join(', ')
}
const listNames = (arr) => (arr ?? []).map(x => x?.name ?? x).filter(Boolean)
const costText = (c) => c === undefined ? undefined : `${c.quantity} ${c.unit}`
// 起始装备选项树的递归平坦化：嵌套 choice/options/equipment 全收（保持次序，丢的是 a/b 分组结构）
const equipmentNames = (node, out = []) => {
  if (node == null) return out
  if (Array.isArray(node)) { for (const n of node) equipmentNames(n, out); return out }
  if (node.equipment?.name) out.push(node.equipment.name)
  for (const key of ['options', 'choice', 'from']) if (node[key] != null) equipmentNames(node[key], out)
  return out
}

// ---- 各类别渲染（正文沿用 srd-convert v1 已验证的形态，frontmatter 加机读层）----

function assembleSpells() {
  const ORD = ['cantrip', '1st-level', '2nd-level', '3rd-level', '4th-level', '5th-level', '6th-level', '7th-level', '8th-level', '9th-level']
  for (const s of load(2014, '5e-SRD-Spells')) {
    const dur = `${s.concentration === true ? 'Concentration, up to ' : ''}${s.duration ?? ''}`
    const head = [
      `**${ORD[s.level]} ${s.school?.name ?? ''}**` + (s.ritual === true ? ' (ritual)' : ''),
      `- **Casting Time:** ${s.casting_time}`,
      `- **Range:** ${s.range}`,
      `- **Components:** ${Array.isArray(s.components) ? s.components.join(', ') : s.components}` + (s.material !== undefined ? ` (${s.material})` : ''),
      `- **Duration:** ${dur}`,
      `- **Spell Lists:** ${listNames(s.classes).join(', ')}`,
    ].join('\n')
    const body = [head, '', paras(s),
      ...(s.higher_level != null && s.higher_level !== '' ? ['', '**At Higher Levels.** ' + paras(s.higher_level)] : [])].join('\n')
    writeDoc('spells', s, [
      ['name', s.name], ['description', `${ORD[s.level]} ${s.school?.name ?? ''}${s.ritual === true ? ' (ritual)' : ''}`],
      ['level', s.level], ['school', String(s.school?.name ?? '').toLowerCase()],
      ['ritual', s.ritual === true], ['concentration', s.concentration === true],
      ['casting_time', s.casting_time], ['range', s.range], ['duration', dur], ['components', s.components],
      ['save', s.dc?.dc_type?.name], ['half_on_save', s.dc?.dc_success === 'half'],
      ['damage', s.damage?.damage_dice], ['damage_type', s.damage?.damage_type?.name],
      ['attack_type', s.attack_type], ['classes', listNames(s.classes)],
    ], body, `${ORD[s.level]} ${s.school?.name ?? ''}${s.concentration === true ? ' · conc' : ''}`)
  }
}

function assembleMonsters() {
  const profLine = (prof) => (prof ?? []).map(p => `${p.proficiency?.name}: ${p.value > 0 ? '+' : ''}${p.value}`).join(', ')
  const all = load(2014, '5e-SRD-Monsters')
  const byIndex = new Map(all.map(m => [m.index, m]))
  for (const m of all) {
    const speedText = Object.entries(m.speed ?? {}).filter(([k]) => k !== 'walk').map(([k, v]) => `, ${k} ${JSON.stringify(v)}`).join('').replaceAll('"', '')
    const block = [
      `*${m.size} ${m.type}${m.subtype !== undefined ? ` (${m.subtype})` : ''}, ${m.alignment ?? 'unaligned'}*`,
      `- **Armor Class** ${acText(m.armor_class)}`,
      `- **Hit Points** ${m.hit_points} (${m.hit_points_roll ?? m.hit_dice ?? ''})`,
      `- **Speed** ${m.speed?.walk ?? '?'}${speedText}`,
      '',
      '| STR | DEX | CON | INT | WIS | CHA |',
      `| ${fmtStat(m.strength)} | ${fmtStat(m.dexterity)} | ${fmtStat(m.constitution)} | ${fmtStat(m.intelligence)} | ${fmtStat(m.wisdom)} | ${fmtStat(m.charisma)} |`,
      '',
      (profLine(m.proficiencies) !== '' ? `- **Proficiencies** ${profLine(m.proficiencies)}\n` : '')
      + (m.damage_vulnerabilities?.length > 0 ? `- **Damage Vulnerabilities** ${m.damage_vulnerabilities.join(', ')}\n` : '')
      + (m.damage_resistances?.length > 0 ? `- **Damage Resistances** ${m.damage_resistances.join(', ')}\n` : '')
      + (m.damage_immunities?.length > 0 ? `- **Damage Immunities** ${m.damage_immunities.join(', ')}\n` : '')
      + (m.condition_immunities?.length > 0 ? `- **Condition Immunities** ${m.condition_immunities.join(', ')}\n` : '')
      + `- **Senses** ${sensesText(m.senses)}\n`
      + `- **Languages** ${m.languages ?? '—'}\n`
      + `- **Challenge** ${m.challenge_rating} (${m.xp ?? '?'} XP, PB ${m.proficiency_bonus > 0 ? '+' : ''}${m.proficiency_bonus})`,
      '',
      ...(m.special_abilities ?? []).map(a => `**${a.name}.** ${a.desc}`).flatMap(t => [t, '']),
      ...(m.actions ?? []).map(a => `***${a.name}.*** ${a.desc}`),
      ...(m.reactions ?? []).map(a => `***${a.name} (Reaction).*** ${a.desc}`),
      ...(m.legendary_actions ?? []).map(a => `***${a.name} (Legendary).*** ${a.desc}`),
      ...(m.forms !== undefined && m.forms.length > 0 ? ['', '## Forms', '',
        '| 形态 | CR | AC | HP |', '|---|---|---|---|',
        ...m.forms.map(f => { const real = byIndex.get(f.index) ?? f; return `| [${f.name}](${slug(f.index)}.md) | ${real.challenge_rating ?? '?'} | ${acNum(real.armor_class)} | ${real.hit_points ?? '?'} |` })] : []),
    ]
    const saveProf = (m.proficiencies ?? []).filter(x => String(x.proficiency?.name).startsWith('Saving Throw')).map(x => String(x.proficiency.name).split(': ')[1]?.toLowerCase()).filter(Boolean)
    const skillProf = (m.proficiencies ?? []).filter(x => String(x.proficiency?.name).startsWith('Skill')).map(x => String(x.proficiency.name).split(': ')[1]?.toLowerCase()).filter(Boolean)
    writeDoc('monsters', m, [
      ['name', m.name], ['description', `${m.size} ${m.type}, CR ${m.challenge_rating} (${m.xp} XP)`],
      ['cr', m.challenge_rating], ['xp', m.xp], ['pb', m.proficiency_bonus],
      ['save_prof', saveProf], ['skill_prof', skillProf],
      ['ac', acNum(m.armor_class)], ['hp', m.hit_points], ['hp_roll', m.hit_points_roll ?? m.hit_dice],
      ['size', m.size], ['type', m.type], ['alignment', m.alignment],
      ['speed', m.speed?.walk], ['languages', m.languages],
      ['str', m.strength], ['dex', m.dexterity], ['con', m.constitution],
      ['int', m.intelligence], ['wis', m.wisdom], ['cha', m.charisma],
    ], block.join('\n'), `CR ${m.challenge_rating} · ${m.hit_points} HP · AC ${acNum(m.armor_class)}`)
  }
}

function assembleClasses() {
  const levelsPool = load(2014, '5e-SRD-Levels')
  const featuresPool = load(2014, '5e-SRD-Features')
  const ORD = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th', '15th', '16th', '17th', '18th', '19th', '20th']
  for (const c of load(2014, '5e-SRD-Classes')) {
    const classRows = levelsPool.filter(l => l.class?.index === c.index && l.subclass == null).sort((a, b) => a.level - b.level)
    const subRows = levelsPool.filter(l => l.class?.index === c.index && l.subclass != null)
      .sort((a, b) => String(a.subclass.index).localeCompare(String(b.subclass.index)) || a.level - b.level)
    const myFeatures = featuresPool.filter(f => f.class?.index === c.index)
      .sort((a, b) => (a.level ?? 0) - (b.level ?? 0) || a.name.localeCompare(b.name))
    const head = [
      `*Hit Dice:* 1d${c.hit_die} per ${c.name.toLowerCase()} level`,
      `*Saving Throws:* ${listNames(c.saving_throws).join(', ')}`,
      `*Subclasses:* ${listNames(c.subclasses).join(', ')}`,
      ...(c.proficiency_choices ?? []).map(pc => `*Proficiencies:* ${pc.desc}`),
      ...((c.starting_equipment ?? []).length > 0 ? [`*Starting Equipment:* ${(c.starting_equipment ?? []).map(se => `${se.equipment?.name}${(se.quantity ?? 1) > 1 ? ` x${se.quantity}` : ''}`).join(', ')}`] : []),
      ...(c.starting_equipment_options ?? []).map((opt, i) => `*Equipment Choice ${i + 1}:* ${opt.desc ?? equipmentNames(opt).join(' or ')}`),
      '',
      `| Level | PB | Features | Class Specific |`,
      `|---|---|---|---|`,
      ...classRows.map(l => `| ${ORD[l.level]} | +${l.prof_bonus} | ${listNames(l.features).join(', ') || '—'} | ${l.class_specific !== undefined && Object.keys(l.class_specific).length > 0 ? JSON.stringify(l.class_specific) : '—'} |`),
      '',
      ...(subRows.length > 0 ? ['## Subclass Levels', '', ...subRows.map(l => `- **${l.subclass.name} LV${l.level}:** ${listNames(l.features).join(', ')}`), ''] : []),
      '## Class Features',
      ...myFeatures.map(f => {
        const pre = f.prerequisites == null || (Array.isArray(f.prerequisites) && f.prerequisites.length === 0) || String(f.prerequisites) === '' ? `Level ${f.level}` : String(f.prerequisites).replace(/"/g, '')
        return `### ${f.name} (${pre})\n\n${paras(f)}`
      }),
    ]
    writeDoc('classes', c, [
      ['name', c.name], ['description', `${c.name}: d${c.hit_die} HD, saves ${listNames(c.saving_throws).join('/')}`],
      ['hit_die', c.hit_die], ['saves', listNames(c.saving_throws)], ['subclass', listNames(c.subclasses)],
    ], head.join('\n'), `d${c.hit_die} HD · saves ${listNames(c.saving_throws).join('/')}`)
  }
}

function assembleRaces() {
  const traits = new Map(load(2014, '5e-SRD-Traits').map(t => [t.index, t]))
  const subraces = new Map(load(2014, '5e-SRD-Subraces').map(s => [s.index, s]))
  const abLine = (list) => (list ?? []).map(a => `${a.ability_score?.name} ${a.bonus > 0 ? '+' : ''}${a.bonus}`).join(', ')
  for (const r of load(2014, '5e-SRD-Races')) {
    const traitTexts = (r.traits ?? []).map(tr => traits.get(tr.index)).filter(Boolean)
      .map(t => `### ${t.name}\n\n${paras(t)}`)
    const subTexts = (r.subraces ?? []).map(sr => subraces.get(sr.index)).filter(Boolean)
      .flatMap(sr => [`## Subrace: ${sr.name}`, '',
        abLine(sr.ability_bonuses),
        (sr.traits ?? []).map(tr => traits.get(tr.index)).filter(Boolean).map(t => `### ${t.name}\n\n${paras(t)}`).join('\n\n'), ''])
    const body = [
      `*Speed:* ${r.speed} ft. · *Ability Bonuses:* ${abLine(r.ability_bonuses) || '—'}`, '',
      `**Age.** ${paras(r.age)}`, `**Alignment.** ${paras(r.alignment)}`,
      `**Size.** ${paras(r.size)} ${paras(r.size_description)}`, `**Languages.** ${paras(r.language_desc)}`,
      ...(traitTexts.length > 0 ? ['', '## Traits', '', traitTexts.join('\n\n')] : []),
      ...subTexts,
    ]
    writeDoc('races', r, [
      ['name', r.name], ['description', `speed ${r.speed} ft. · ${abLine(r.ability_bonuses)}`],
      ['speed', r.speed], ['ability_bonuses', abLine(r.ability_bonuses)],
    ], body.join('\n'), `speed ${r.speed}, ${abLine(r.ability_bonuses)}`)
  }
}

function assembleEquipment() {
  for (const e of load(2014, '5e-SRD-Equipment')) {
    const lines = [`*${[e.equipment_category?.name, e.gear_category?.name].filter(Boolean).join(' — ')} · cost ${costText(e.cost) ?? '?'} · ${e.weight ?? '?'} lb.*`]
    const fields = [['name', e.name], ['description', `${e.equipment_category?.name ?? ''} · ${costText(e.cost) ?? ''}`], ['cost', costText(e.cost)], ['weight', e.weight]]
    if (e.armor_class !== undefined) {
      fields.push(['ac_base', e.armor_class.base], ['ac_dex_bonus', e.armor_class.dex_bonus === true], ['ac_dex_cap', e.armor_class.max_bonus])
      if (e.str_minimum !== undefined) fields.push(['str_min', e.str_minimum])
      if (e.stealth_disadvantage) fields.push(['stealth_disadvantage', true])
      lines.push(`- **Armor Class** ${e.armor_class.base}${e.armor_class.dex_bonus === true ? ' + Dex modifier' : ''}${e.armor_class.max_bonus !== undefined ? ` (max +${e.armor_class.max_bonus})` : ''}`)
      if (e.str_minimum !== undefined) lines.push(`- **Strength** ${e.str_minimum} (speed −10 ft if below)`)
      if (e.stealth_disadvantage === true) lines.push('- **Stealth** Disadvantage')
    }
    if (e.weapon_category !== undefined) {
      fields.push(['weapon', e.category_range ?? e.weapon_category])
      if (e.damage !== undefined) {
        fields.push(['damage', e.damage.damage_dice], ['damage_type', e.damage.damage_type?.name])
        lines.push(`- **Damage** ${e.damage.damage_dice} ${e.damage.damage_type?.name}`)
      }
      if (e.range !== undefined) fields.push(['range', `${e.range.normal}/${e.range.long}`])
      if (e.throw_range !== undefined) fields.push(['thrown_range', `${e.throw_range.normal}/${e.throw_range.long}`])
      if (e.properties !== undefined) fields.push(['properties', listNames(e.properties)])
      lines.push(`- **${e.category_range ?? e.weapon_category} weapon${e.weapon_range === 'Ranged' && e.range !== undefined ? ` · range ${e.range.normal}/${e.range.long}` : ''}${e.throw_range !== undefined ? ` · thrown ${e.throw_range.normal}/${e.throw_range.long}` : ''}**`)
      if (e.properties !== undefined) lines.push(`- **Properties** ${listNames(e.properties).join(', ')}`)
      if (e.special !== undefined) lines.push(`- **Special** ${e.special.map(s => JSON.stringify(s)).join('; ')}`)
    }
    if (e.contents?.length > 0) lines.push(`- **Contents** ${e.contents.map(c => `${c.item?.name}${(c.quantity ?? 1) > 1 ? ` x${c.quantity}` : ''}`).join(', ')}`)
    if (e.contents?.length > 0) fields.push(['contents', e.contents.map(c => `${c.item?.name}${(c.quantity ?? 1) > 1 ? ` x${c.quantity}` : ''}`).join(', ')])
    if (e.desc !== undefined && paras(e) !== '') lines.push('', paras(e))
    writeDoc('equipment', e, fields, lines.join('\n'), `${e.armor_class !== undefined ? `AC ${e.armor_class.base}` : e.damage !== undefined ? e.damage.damage_dice : e.equipment_category?.name ?? ''}`)
  }
}

// 规则章：正文含表格字段时展开为 markdown 表
function assembleRules() {
  const mdTable = (t) => ['', t.caption !== undefined ? `**${t.caption}**` : '', `| ${t.col_headers?.join(' | ') ?? ''} |`, `|${t.col_headers?.map(() => '---').join('|')}|`,
    ...(t.rows ?? []).map(r => `| ${r.map(c => Array.isArray(c) ? c.join(', ') : String(c)).join(' | ')} |`)].join('\n')
  for (const s of load(2014, '5e-SRD-Rule-Sections')) {
    const body = [paras(s), ...(s.tables ?? []).map(mdTable)].filter(Boolean).join('\n')
    writeDoc('rules', s, [['name', s.name], ['description', paras(s).replace(/\s+/g, ' ').slice(0, 90)]], body, paras(s).replace(/\s+/g, ' ').slice(0, 70))
  }
}

// 泛化类：name + description + 引用数组字段淡出为 bullet 列表（proficiencies 的 classes 挂靠等）
function assembleGeneric(year, file, category) {
  const list = load(year, file)
  for (const e of list) {
    const desc = paras(e) || (Array.isArray(e.type) ? e.type.join(' / ') : e.type) || (e.damage_type?.name ?? '')
    const refs = Object.entries(e)
      .filter(([k, v]) => ['classes', 'races', 'subclasses'].includes(k) && Array.isArray(v) && v.length > 0)
      .map(([k, v]) => `**${k}**: ${listNames(v).join(', ')}`)
    const body = [paras(e), '', ...refs].filter(x => x !== '').join('\n')
    writeDoc(category, e, [['name', e.name], ['description', desc]], body, desc)
  }
}

// ---- 装配清单 ----
mkdirSync(OUT, { recursive: true })
assembleSpells()
assembleMonsters()
assembleClasses()
assembleRaces()
assembleEquipment()
assembleRules()
const genericMap = [
  [2014, '5e-SRD-Skills', 'skills'],
  [2014, '5e-SRD-Conditions', 'conditions'],
  [2014, '5e-SRD-Damage-Types', 'damage-types'],
  [2014, '5e-SRD-Ability-Scores', 'ability-scores'],
  [2014, '5e-SRD-Languages', 'languages'],
  [2014, '5e-SRD-Weapon-Properties', 'weapon-properties'],
  [2014, '5e-SRD-Magic-Schools', 'magic-schools'],
  [2014, '5e-SRD-Proficiencies', 'proficiencies'],
  [2014, '5e-SRD-Alignments', 'alignments'],
  [2024, '5e-SRD-Poisons', 'poisons'],
]
for (const [year, file, cat] of genericMap) assembleGeneric(year, file, cat)

// ---- 每类 INDEX.md + 根 INDEX.md ----
// 根索引 = systemPrompt 注入面（srd_index 脚本原样搬运）：BR 简介中文 + includes 全条目英文名（DM 知道有什么,按需两级查询）。
// 路径省略前缀 dnd5e-srd-lorebook/（systemPrompt 头部声明一次,省 token）。
const CAT_SUM = {
  'ability-scores': '六属性(STR/DEX/CON/INT/WIS/CHA)定义与各自管辖的检定',
  alignments: '九宫格阵营',
  classes: '12 职业全档——HD/豁免熟练/1~20 级表(特征与职业资源 JSON 列)/子职业等级/全部职业特征描述;升级与角色构建的查证源',
  conditions: '15 状态的精确语义(施加效果/豁免/解除条件)——施加前先读条',
  'damage-types': '13 伤害类型——抗性/易伤/免疫的适用键',
  equipment: '武器(骰式/属性/射程)/护甲(AC 算式/STR 门槛/隐匿劣势)/冒险装备与价格——交易查价与攻击解析的数据源',
  languages: '语言清单(标准/异族)',
  'magic-schools': '八魔法学派',
  monsters: '怪物 statblock——CR/XP/AC/HP/六维/豁免与技能熟练/抗免(frontmatter 机读)+动作全文;遭遇选怪与敌行动的数据源',
  poisons: '毒物样本(价格/DC/效果)',
  proficiencies: '职业/种族熟练参照',
  races: '9 种族(速度/属性加值/特征,子种内联)——创角数据源',
  rules: '33 章核心规则原文(战斗五步/移动/动作/攻击/掩体/伤害濒死/骑乘/水下/属性/优劣/熟练/检定/豁免/时间/移动/环境/休整/冒险间隙/施法/汇率/物件/毒/同调/穿戴/启用/智慧物品/神系/位面/陷阱/疾病/疯狂)——任何规则疑问的第一查证点',
  skills: '18 技能(关联属性+应用示例)',
  spells: '319 法术(环位/学派/成分/伤害/豁免类型/专注/仪式 frontmatter 机读+全文+升环)——施法解析与升环的数据源',
  'weapon-properties': '武器属性(灵巧/轻/装填/抛掷/触及等)',
}
for (const [cat, rows] of [...indexRows].sort(([a], [b]) => a.localeCompare(b))) {
  writeFileSync(join(OUT, cat, 'INDEX.md'), [`# ${cat} — ${rows.length} entries`, '',
    ...rows.map(r => `- [${r.name}](${r.file}) — ${r.desc}`)].join('\n') + '\n')
}
writeFileSync(join(OUT, 'INDEX.md'), [`# dnd5e-srd-lorebook`, '',
  ...[...indexRows].sort(([a], [b]) => a.localeCompare(b))
    .map(([cat, rows]) => {
      // mega-3 名单折叠(319+334+237 名字 ≈2.5k token,且名字不带效果对查询帮助有限——两级查询第一跳读类 INDEX)
      const inc = ['spells', 'monsters', 'equipment'].includes(cat) ? `（条目详单 runtimeRead ${cat}/INDEX.md）` : `\n  includes: ${rows.map(r => r.name).join(', ')}`
      return `- **${cat}/** (${rows.length}) ${CAT_SUM[cat] ?? ''} → ${cat}/INDEX.md${inc}`
    })].join('\n') + '\n')

console.log(`assembled → ${OUT}`)
for (const [cat, rows] of [...indexRows].sort(([a], [b]) => a.localeCompare(b))) console.log(`  ${cat.padEnd(20)} ${String(rows.length).padStart(4)} 篇`)
