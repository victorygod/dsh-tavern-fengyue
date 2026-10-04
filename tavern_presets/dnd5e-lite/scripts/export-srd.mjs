// export-srd.mjs — SRD 语料 → 可查 markdown 文档（一次性/可重跑生成脚本，dev 工具，随卡根 scripts/ 存放）。
// 读 preset/lib/ 六个域数据模块，落到 preset/setup/srd/（seedRuntime 时复制进 runtime/，供 runtimeRead/runtimeGrep 查询）。
// 纯 node:fs/path + file URL 导入，无 shell 构造——跨平台。跑法：node scripts/export-srd.mjs（cwd 任意）。
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const lib = (f) => pathToFileURL(join(here, '../preset/lib', f)).href
const outRoot = join(here, '../preset/setup', 'srd')

const { RULES_CORE } = await import(lib('rules-core-data.mjs'))
const { SPELL_CORE } = await import(lib('spell-core-data.mjs'))
const { MONSTER_CORE } = await import(lib('monster-core-data.mjs'))
const { MONSTER_ATTACKS, ABILITIES, RIDERS, STATUS_RIDERS } = await import(lib('monster-extra-data.mjs'))
const { CLASS_CORE, CLS_FEATURES } = await import(lib('class-core-data.mjs'))
const { RACE_CORE } = await import(lib('race-core-data.mjs'))
const { EQ_CORE } = await import(lib('equip-core-data.mjs'))

const sorted = (obj) => Object.keys(obj).sort()
const joinList = (v) => (Array.isArray(v) && v.length ? v.join(', ') : '—')
const titleCase = (s) => String(s).split('-').map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(' ')

function write(rel, text) {
  const p = join(outRoot, rel)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, text)
}

// ── 规则 ──
function rules() {
  for (const slug of sorted(RULES_CORE)) {
    const { name, text } = RULES_CORE[slug]
    write(`rules/${slug}.md`, `# ${name}\n\n${text}\n`)
  }
}

// ── 法术 ──
function spells() {
  for (const slug of sorted(SPELL_CORE)) {
    const { fm, effect } = SPELL_CORE[slug]
    const name = fm?.name ?? slug
    const lines = [`# ${name}`, '', `*${fm?.description ?? ''}*`, '']
    if (fm?.casting_time) lines.push(`- **Casting Time:** ${fm.casting_time}`)
    if (fm?.range) lines.push(`- **Range:** ${fm.range}`)
    if (Array.isArray(fm?.components) && fm.components.length) lines.push(`- **Components:** ${fm.components.join(', ')}`)
    if (fm?.duration) lines.push(`- **Duration:** ${fm.duration}`)
    if (Array.isArray(fm?.classes) && fm.classes.length) lines.push(`- **Classes:** ${fm.classes.join(', ')}`)
    if (fm?.save) lines.push(`- **Saving Throw:** ${fm.save}`)
    if (fm?.attack_type) lines.push(`- **Attack Type:** ${fm.attack_type}`)
    lines.push('', effect ?? '')
    write(`spells/${slug}.md`, `${lines.join('\n')}\n`)
  }
}

// ── 怪物 ──
function monsters() {
  for (const slug of sorted(MONSTER_CORE)) {
    const m = MONSTER_CORE[slug]
    const lines = [`# ${slug}`, '', `*${m.description ?? ''}*`, '']
    lines.push(`- **Armor Class:** ${m.ac}`)
    lines.push(`- **Hit Points:** ${m.hp} (${m.hp_roll ?? ''})`)
    lines.push(`- **Speed:** ${m.speed} ft.`)
    lines.push(`- **Ability Scores:** STR ${m.str} · DEX ${m.dex} · CON ${m.con} · INT ${m.int} · WIS ${m.wis} · CHA ${m.cha}`)
    lines.push(`- **Saving Throws:** ${joinList(m.save_prof)}`)
    lines.push(`- **Skills:** ${joinList(m.skill_prof)}`)
    lines.push(`- **Damage Resistances:** ${joinList(m.resist)}`)
    lines.push(`- **Damage Immunities:** ${joinList(m.immune)}`)
    lines.push(`- **Damage Vulnerabilities:** ${joinList(m.vuln)}`)
    if (m.darkvision != null) lines.push(`- **Senses:** darkvision ${m.darkvision} ft.`)
    lines.push(`- **Languages:** ${joinList(m.languages)}`)
    lines.push(`- **Challenge:** ${m.cr}`)
    // 特质
    if (Array.isArray(m.features) && m.features.length) {
      lines.push('', '## Traits')
      for (const f of m.features) {
        const [fn, ft] = String(f).split('|')
        lines.push(`- **${fn}:** ${ft ?? ''}`)
      }
    }
    // 动作（MONSTER_ATTACKS/RIDERS/STATUS_RIDERS）
    const prefix = `${slug}/`
    const atks = Object.keys(MONSTER_ATTACKS).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length))
    if (atks.length) {
      lines.push('', '## Actions')
      for (const atk of atks) {
        const a = MONSTER_ATTACKS[`${slug}/${atk}`]
        const toHit = a.bonus != null ? `+${a.bonus} to hit` : ''
        const reach = a.reach != null ? `${a.reach} ft.` : ''
        const rider = RIDERS[`${slug}/${atk}`]?.map(r => `${r.dice} ${r.type}`)
        const sr = STATUS_RIDERS[`${slug}/${atk}`]
        let line = `- **${atk}** (${a.kind}): ${toHit}${toHit && a.dice ? ', ' : ''}${a.dice ?? ''}${a.type ? ` ${a.type}` : ''}${a.dice || a.type ? ' damage' : ''}${reach ? `, ${reach}` : ''}`
        if (rider) line += ` plus ${rider.join(' + ')}`
        if (sr) line += `; on hit target must succeed on a DC ${sr.dc} ${sr.save} saving throw or be ${sr.status}${sr.duration ? ` (${sr.duration})` : ''}`
        lines.push(line)
      }
    }
    // 特殊能力（ABILITIES：吐息/传奇等）
    const abils = Object.keys(ABILITIES).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length))
    if (abils.length) {
      lines.push('', '## Special Abilities')
      for (const ab of abils) {
        const a = ABILITIES[`${slug}/${ab}`]
        const half = a.half === false ? ', no damage on save' : ''
        const prone = a.knockProne ? ', knocks prone' : ''
        lines.push(`- **${ab}**: ${a.save} saving throw DC ${a.dc}, ${a.dice} ${a.type} damage${half}${prone}`)
      }
    }
    write(`monsters/${slug}.md`, `${lines.join('\n')}\n`)
  }
}

// ── 职业 ──
function classes() {
  for (const slug of sorted(CLASS_CORE)) {
    const c = CLASS_CORE[slug]
    const fm = c.fm ?? {}
    const lines = [`# ${fm.name ?? slug}`, '', `*${fm.description ?? ''}*`, '']
    if (fm.hit_die) lines.push(`- **Hit Die:** d${fm.hit_die}`)
    lines.push(`- **Saving Throws:** ${joinList(fm.saves)}`)
    lines.push(`- **Subclasses:** ${joinList(fm.subclass)}`)
    if (c.prof_line) lines.push(`- **Skill Proficiencies:** ${c.prof_line}`)
    if (Array.isArray(c.rows) && c.rows.length) {
      lines.push('', '## Level Progression', '', '| Level | Proficiency | Features |', '|---|---|---|')
      c.rows.forEach((r, i) => {
        lines.push(`| ${i + 1} | +${r.pb} | ${String(r.features ?? '').replace(/\|/g, '/')} |`)
      })
    }
    const feats = CLS_FEATURES[slug]
    if (Array.isArray(feats) && feats.length) {
      lines.push('', '## Class Features')
      for (const f of feats) {
        lines.push('', `### ${f.name} (level ${f.level})`, '', f.text ?? '')
      }
    }
    write(`classes/${slug}.md`, `${lines.join('\n')}\n`)
  }
}

// ── 种族 ──
function races() {
  for (const slug of sorted(RACE_CORE)) {
    const fm = RACE_CORE[slug].fm ?? {}
    const lines = [`# ${fm.name ?? slug}`, '', `*${fm.description ?? ''}*`, '']
    if (fm.speed != null) lines.push(`- **Speed:** ${fm.speed} ft.`)
    if (fm.ability_bonuses) lines.push(`- **Ability Bonuses:** ${fm.ability_bonuses}`)
    write(`races/${slug}.md`, `${lines.join('\n')}\n`)
  }
}

// ── 装备（单文件，按类别分组；武器/护甲带机械字段）──
function equipMechanics(fm) {
  const p = []
  if (fm.weapon) p.push(fm.weapon) // "Martial Melee" 等
  if (fm.damage) p.push(`${fm.damage}${fm.damage_type ? ` ${fm.damage_type}` : ''}`)
  if (fm.range) {
    const [near, far] = String(fm.range).split('/')
    p.push(far && far !== 'undefined' ? `range ${near}/${far} ft.` : `reach ${near} ft.`)
  }
  if (fm.thrown_range) p.push(`thrown ${fm.thrown_range} ft.`)
  if (Array.isArray(fm.properties) && fm.properties.length) p.push(fm.properties.join(', '))
  if (fm.ac_base != null) {
    let ac = `AC ${fm.ac_base}`
    if (fm.ac_dex_bonus != null) ac += ` + DEX${fm.ac_dex_cap != null && fm.ac_dex_cap > 0 ? ` (max ${fm.ac_dex_cap})` : ''}`
    p.push(ac)
    if (fm.str_min) p.push(`Str ${fm.str_min} req.`)
    if (fm.stealth_disadvantage) p.push('stealth disadv.')
  }
  if (Array.isArray(fm.contents) && fm.contents.length) p.push(`contains: ${fm.contents.join(', ')}`)
  return p.length ? ` — ${p.join(' · ')}` : ''
}
function equipment() {
  const groups = new Map()
  for (const [slug, e] of Object.entries(EQ_CORE)) {
    const fm = e.fm ?? {}
    const desc = String(fm.description ?? '')
    // 武器按 fm.weapon（Martial Melee 等）细分，其余按描述类别（Armor/Adventuring Gear/Tools…）
    const cat = fm.weapon ?? desc.split(' · ')[0] ?? 'Other'
    if (!groups.has(cat)) groups.set(cat, [])
    groups.get(cat).push({ slug, fm })
  }
  const lines = ['# Equipment', '']
  for (const cat of [...groups.keys()].sort()) {
    lines.push(`## ${cat}`, '')
    for (const { slug, fm } of groups.get(cat).sort((a, b) => String(a.fm.name ?? a.slug).localeCompare(String(b.fm.name ?? b.slug)))) {
      lines.push(`- **${fm.name ?? slug}**${equipMechanics(fm)} — ${fm.cost ?? '—'}, ${fm.weight ?? '—'} lb (\`${slug}\`)`)
    }
    lines.push('')
  }
  write('equipment.md', `${lines.join('\n')}\n`)
}

// ── 索引 ──
function index() {
  const L = []
  L.push('# SRD 5.1 语料索引', '')
  L.push('> 生成自 lib/ 六个域数据模块。查询走 runtimeRead（单条）或 runtimeGrep（全文检索）。', '')
  L.push('## 规则 Rules（34 章）', '')
  for (const slug of sorted(RULES_CORE)) L.push(`- \`srd/rules/${slug}.md\` — ${RULES_CORE[slug].name}`)
  L.push('', '## 法术 Spells（按环位）', '')
  const byLv = new Map()
  for (const slug of sorted(SPELL_CORE)) {
    const lv = SPELL_CORE[slug]?.fm?.level ?? -1
    if (!byLv.has(lv)) byLv.set(lv, [])
    byLv.get(lv).push(`${SPELL_CORE[slug]?.fm?.name ?? slug} (\`${slug}\`)`)
  }
  const lvLabel = { '-1': '未知环位', '0': '戏法 Cantrip', '1': '1 环', '2': '2 环', '3': '3 环', '4': '4 环', '5': '5 环', '6': '6 环', '7': '7 环', '8': '8 环', '9': '9 环' }
  for (const lv of [...byLv.keys()].sort((a, b) => a - b)) {
    L.push(`### ${lvLabel[String(lv)] ?? `${lv} 环`}`, '')
    L.push(byLv.get(lv).join('；'), '')
  }
  L.push('## 怪物 Monsters（按 CR）', '')
  const byCr = new Map()
  for (const slug of sorted(MONSTER_CORE)) {
    const cr = MONSTER_CORE[slug].cr
    const key = String(cr)
    if (!byCr.has(key)) byCr.set(key, [])
    byCr.get(key).push(`${titleCase(slug)} (\`${slug}\`)`)
  }
  const crNum = (k) => (k.includes('.') ? Number(k) : Number(k))
  for (const k of [...byCr.keys()].sort((a, b) => crNum(a) - crNum(b))) {
    L.push(`### CR ${k}`, '')
    L.push(byCr.get(k).join('、'), '')
  }
  L.push('## 职业 Classes', '')
  for (const slug of sorted(CLASS_CORE)) L.push(`- \`srd/classes/${slug}.md\` — ${CLASS_CORE[slug]?.fm?.name ?? slug}`)
  L.push('', '## 种族 Races', '')
  for (const slug of sorted(RACE_CORE)) L.push(`- \`srd/races/${slug}.md\` — ${RACE_CORE[slug]?.fm?.name ?? slug}`)
  L.push('', '## 装备 Equipment', '')
  L.push(`- \`srd/equipment.md\` — ${Object.keys(EQ_CORE).length} 件（按类别分组）`)
  L.push('', '## 查法', '')
  L.push('- 规则原文：`runtimeRead srd/rules/<slug>.md`；章节全集见上表。')
  L.push('- 法术：`runtimeRead srd/spells/<slug>.md`；按名检索 `runtimeGrep "Fireball" srd/spells`。')
  L.push('- 怪物：`runtimeRead srd/monsters/<slug>.md`；按名检索 `runtimeGrep "Goblin" srd/monsters`。')
  L.push('- 职业：`runtimeRead srd/classes/<slug>.md`；种族：`runtimeRead srd/races/<slug>.md`；装备：`runtimeRead srd/equipment.md`。')
  L.push('- 全文检索：`runtimeGrep "关键词" srd/`。')
  write('INDEX.md', `${L.join('\n')}\n`)
}

rmSync(outRoot, { recursive: true, force: true })
mkdirSync(outRoot, { recursive: true })
rules(); spells(); monsters(); classes(); races(); equipment(); index()

console.log(`SRD 导出完成 → setup/srd/`)
console.log(`  rules:   ${sorted(RULES_CORE).length}`)
console.log(`  spells:  ${sorted(SPELL_CORE).length}`)
console.log(`  monsters:${sorted(MONSTER_CORE).length}`)
console.log(`  classes: ${sorted(CLASS_CORE).length}`)
console.log(`  races:   ${sorted(RACE_CORE).length}`)
console.log(`  equip:   ${Object.keys(EQ_CORE).length}`)
