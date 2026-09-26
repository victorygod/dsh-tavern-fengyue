// core.mjs — 卡工具共享件（消费者=8 工具,YAGNI 外提条件达成 2026-09-19）。
// 工具经 file:// 绝对引用本件（data-module 相对 import 不可达;cwd=runtime→../preset/lib 可达）。
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { randomInt } from 'node:crypto'

let _seed = null
export function setSeed(s) { _seed = s >>> 0 }
export function rnd(max) { // 1..max
  if (_seed !== null) { _seed = (1103515245 * _seed + 12345) % 2147483648; return (_seed % max) + 1 }
  return randomInt(1, max + 1)
}
export function d20(mode) {
  if (mode === 'adv') return Math.max(rnd(20), rnd(20))
  if (mode === 'dis') return Math.min(rnd(20), rnd(20))
  return rnd(20)
}
export function rollExpr(expr) { // '2d6+3' → {dice:[..], mod, total}
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(expr).replace(/\s/g, ''))
  if (!m) return null
  const dice = Array.from({ length: +m[1] }, () => rnd(+m[2]))
  const mod = m[3] ? +m[3] : 0
  return { dice, mod, total: dice.reduce((a, b) => a + b, 0) + mod }
}
export const mod = (stat) => Math.floor((stat - 10) / 2)
export const pb = (level) => 2 + Math.floor((Math.min(level, 20) - 1) / 4)  // 旧式(消费点迁 pbOf 后退役)
// 单键统一律(2026-09-26):level 一键承载双语义——成长者=等级,怪=CR(0.25 小数合法)。
// pbOf 两端 clamp(1,30):旧 pb 的 min(,20) 双端皆错(0.25 算 +1 虚低;CR21+ 封顶 +6 错杀 +7..+9)。
export const pbOf = (lv) => 2 + Math.floor((Math.min(Math.max(Number(lv) || 1, 1), 30) - 1) / 4)
// CR→XP 查表(BR/SRD 同表,rules_zh §13)——key=level 键值(含小数档);xp 不落档=派生不存。
export const XP_BY_CR = { '0': 10, '0.125': 25, '0.25': 50, '0.5': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300, '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000, '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000, '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000 }
export const xpOf = (lv) => XP_BY_CR[String(Number(lv))] ?? null
export const err = (msg) => { console.log('!' + msg); process.exit(1) }

export function findCharFile(who) {
  if (!who || who === '玩家') return existsSync('characters/player.json') ? 'characters/player.json' : null
  const direct = `characters/${who}.json`
  if (existsSync(direct)) return direct
  for (const f of readdirSync('characters').filter(f => f.endsWith('.json'))) {
    try { if (JSON.parse(readFileSync(`characters/${f}`, 'utf8')).name === who) return `characters/${f}` } catch {}
  }
  return null
}
export function readChar(who) {
  const f = findCharFile(who)
  if (!f) err(`!角色不存在:${who}`)
  return JSON.parse(readFileSync(f, 'utf8'))
}
export function charFileOf(who) { return findCharFile(who) ?? err(`!角色不存在:${who}`) }

// ── 战斗节（state.md「## 战斗」——combat.json 已废,2026-09-20 定案战斗入 state.md）──
// 行语法(2026-09-26 敌行瘦身)：- 回合：N ／ - 先攻：名:init > 名:init ／ - 敌行|友行：名 | path:lorebook相对路径 | 状态文本
// HP/AC 不在行里——一律走各角色档案(单一居所;行只记身份/溯源/情境状态)。
export function combatSectionLines() {
  try {
    const md = readFileSync('state.md', 'utf8')
    const m = /## 战斗[^\n]*\n([\s\S]*?)(?=\n## |$)/.exec(md)
    return (m?.[1] ?? '').split('\n').map(l => l.trim().replace(/^-\s*/, '')).filter(l => l && l !== '（无战斗）')
  } catch { return [] }
}
export function foeRow(seg, kind) {
  const parts = seg.split('|').map(s => s.trim())
  const pa = /path[:：]\s*(\S+)/.exec(seg)
  const statusSeg = parts.filter((p, i) => i > 0 && !/^path[:：]/.test(p)).join(' ')
  return { name: parts[0], kind, path: pa ? pa[1] : null, statuses: statusSeg ? [{ name: statusSeg }] : [] }
}
export function parseCombat() {
  const lines = combatSectionLines()
  const foes = [], allies = []
  for (const l of lines) {
    if (/^敌行[:：]/.test(l)) foes.push(foeRow(l.replace(/^敌行[:：]/, ''), 'enemy'))
    else if (/^友行[:：]/.test(l)) allies.push(foeRow(l.replace(/^友行[:：]/, ''), 'ally'))
  }
  if (!foes.length && !allies.length) return null
  const ord = []
  const im = /^先攻[:：]\s*(.+)$/.exec(lines.find(l => /^先攻[:：]/.test(l)) ?? '')
  if (im) for (const tok of im[1].split('>').map(s => s.trim()).filter(Boolean)) {
    const t = /^([^:：]+)[:：]\s*(\d+)\s*$/.exec(tok); if (t) ord.push({ who: t[1].trim(), init: +t[2] })
  }
  const rd = /^回合[:：]\s*(\d+)/.exec(lines.find(l => /^回合[:：]/.test(l)) ?? '')
  const names = new Set(foes.map(f => f.name))
  return { round: rd ? +rd[1] : null, order: ord.map(o => ({ ...o, side: names.has(o.who) ? 'enemy' : 'pc' })), enemies: foes, allies }
}
export const combatFoe = (target) => parseCombat()?.enemies.find(e => e.name === target) ?? null

// ── 附近 NPC 三态名单(v4,2026-09-25 用户定案复活 state 节——推翻 v3「零名单」案)──
// state.md「## 附近 NPC」节,行式 `- 名 | 同伴/中立/敌对`;名单=唯一在场真源:
// 无 role 兜底(名单漏更=漏,用户拍板)、敌对=持久态(战毕未死者不随敌行清空回落)。
// 消费者:get_npc_state(注入)与 ui_data(前端泵)——同一份解析,前后端人集与三分类镜像。
export function presence() {
  const rows = []
  try {
    const md = readFileSync('state.md', 'utf8')
    const m = /## 附近 NPC[^\n]*\n([\s\S]*?)(?=\n## |$)/.exec(md)
    for (const l of (m?.[1] ?? '').split('\n')) {
      const t = /^-\s*([^|]+?)\s*\|\s*(同伴|中立|敌对)\s*$/.exec(l.trim())
      if (t) rows.push({ name: t[1], stance: t[2] })
    }
  } catch { /* 无 state.md → 空名单 */ }
  // 行在而档缺/坏 → j=null(消费方示警勿采信——裂缝可见,不静默吞);名字撞车不去重,行序即注入序。
  const pools = { mates: [], neutrals: [], foes: [] }
  for (const r of rows) {
    const file = `characters/${r.name}.json`
    let j = null
    try { j = JSON.parse(readFileSync(file, 'utf8')) } catch { /* 缺档/损坏 → null */ }
    pools[r.stance === '同伴' ? 'mates' : r.stance === '中立' ? 'neutrals' : 'foes'].push({ ...r, file, j })
  }
  return pools
}

export function readFM(rel) { // lorebook frontmatter 简易解析（key: value / 二级 list）
  const raw = readFileSync(`dnd5e-srd-lorebook/${String(rel).replace(/^dnd5e-srd-lorebook\//, '')}`, 'utf8')  // 容错全路径（combat path 曾存全前缀→双拼 ENOENT）
  const m = /^---\n([\s\S]*?)\n---/.exec(raw)
  if (!m) return {}
  const fm = {}; let cur = null
  for (const line of m[1].split('\n')) {
    const li = /^  - (.*)$/.exec(line)
    if (li && cur) { fm[cur] = [...(fm[cur] ?? []), coerce(li[1])]; continue }
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line)
    if (kv) { cur = kv[1]; fm[cur] = kv[2] === '' ? [] : coerce(kv[2]) }
  }
  return fm
}
const coerce = (v) => {
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (v === 'true') return true; if (v === 'false') return false
  return v.replace(/^"|"$/g, '')
}

export function statusesMod(char, stat) {
  let s = 0
  for (const st of char.statuses ?? []) {
    const m = /^(str|dex|con|int|wis|cha|all)([+-]\d+)$/.exec(st.effect ?? '')
    if (m && (m[1] === stat || m[1] === 'all')) s += Number(m[2])
  }
  return s
}
export const SKILL_STAT = { acrobatics:'dex', animal_handling:'wis', arcana:'int', athletics:'str', deception:'cha', history:'int', insight:'wis', intimidation:'cha', investigation:'int', medicine:'wis', nature:'int', perception:'wis', performance:'cha', persuasion:'cha', religion:'int', sleight_of_hand:'dex', stealth:'dex', survival:'wis' }
export function toCp(str) {
  const s = String(str).trim()
  if (/^\d+$/.test(s)) return +s
  let cp = 0, m; const re = /(\d+)\s*(pp|gp|ep|sp|cp)/g
  while ((m = re.exec(s))) cp += +m[1] * ({ pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 }[m[2]] ?? 0)
  return cp
}
export const normWallet = (cp) => ({ gp: Math.floor(cp / 100), sp: Math.floor((cp % 100) / 10), cp: cp % 10 })

// 常用武器/护甲 中文名→equipment slug（语料为英文名;开 committed 面板存中文名时的桥）
export const WEAPON_SLUG = { '短剑':'shortsword','长剑':'longsword','短弓':'shortbow','长弓':'longbow','匕首':'dagger','手斧':'handaxe','战斧':'battleaxe','巨斧':'greataxe','巨剑':'greatsword','长枪':'spear','木棒':'club','钉锤':'mace','战锤':'warhammer','弯刀':'scimitar','细剑':'rapier','矛':'spear','三叉戟':'trident','链枷':'flail','战镐':'war-pick','连枷':'flail','轻弩':'light-crossbow','重弩':'heavy-crossbow','手弩':'hand-crossbow','飞镖':'dart','投石索':'sling','标枪':'javelin','大棒':'greatclub' }
export const ARMOR_SLUG = { '镶钉皮甲':'studded-leather-armor','皮甲':'leather-armor','皮甲（镶钉）':'studded-leather-armor','链甲':'chain-mail','链甲衫':'chain-shirt','板甲':'plate-armor','板条甲':'splint-armor','鳞甲':'scale-mail','胸甲':'breastplate','半板甲':'half-plate-armor','环甲':'ring-mail','兽皮甲':'hide-armor','填棉甲':'padded-armor' }
export const slugify = (en) => en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export function equipmentFM(name) {
  const slug = WEAPON_SLUG[name] ?? ARMOR_SLUG[name] ?? slugify(name)
  const p = `equipment/${slug}.md`
  return existsSync(`dnd5e-srd-lorebook/${p}`) ? { ...readFM(p), path: p } : null
}

// ── 目标结算解析咽喉(2026-09-25:attack/cast 共一,斩静默默值——事故:梅西雅存 player.json,
//    attack 手写 existsSync('characters/梅西雅.json') 落空 → AC 静默留 10)──
// 失败策略归调用方:此处一律返回 null,由工具 err() 逼 DM 补敌行/建档/转写,绝不涂默认值。
export const combatRow = (name) => {  // 敌行∪友行(挨打的可能是任意一侧)
  const c = parseCombat()
  return c ? (c.enemies.find(e => e.name === name) ?? c.allies.find(e => e.name === name) ?? null) : null
}
export function deriveAC(j) {
  // AC 律单源(原 ui_data 与 attack 各持一份「同律」注释,分叉即 bug 温床):
  // ac_dex_bonus:true=加敏(带 cap 取 min);键缺席=重甲定值。dex 缺席且需敏 → null
  // (展示层按 ??? 消费;结算层 err 逼 DM 转写)。中文名甲走 equipmentFM 桥。
  const dexM = j.dex == null ? null : mod(j.dex)
  let ac = dexM == null ? null : 10 + dexM
  if (j.armor) {
    const fm = equipmentFM(j.armor)
    if (fm) ac = fm.ac_dex_bonus === true ? (dexM == null ? null : fm.ac_base + (fm.ac_dex_cap ? Math.min(dexM, fm.ac_dex_cap) : dexM)) : fm.ac_base
  }
  if (ac != null && (j.shield === true || j.shield === 'true')) ac += 2
  return ac
}
export function resolveTarget(target) {
  // 敌行瘦身后(2026-09-26):行只供身份与 path 溯源,数值一律走档(完备律:参战者必有档)。
  // 扩展回传 file/j/growth——结算件当拍写的读侧全量入口(growth=exp 键在否,喂 0HP 分叉:有成长面起濒死计数,无则 RAW 即死)。
  const f = findCharFile(target)
  if (!f) return null
  const j = JSON.parse(readFileSync(f, 'utf8'))
  return { file: f, j, ac: j.ac ?? deriveAC(j), resist: j.resist ?? [], immune: j.immune ?? [], vuln: j.vulnerabilities ?? [], source: f, growth: j.exp !== undefined }
}
export function resolveSave(target, save) {
  const f = findCharFile(target)
  if (!f) return null
  const j = JSON.parse(readFileSync(f, 'utf8'))
  return mod(j[save] ?? 10) + ((j.save_prof ?? []).includes(save) ? pbOf(j.level ?? 1) : 0)
}

// PHB XP 阈值表（PHB「Beyond 1st Level」，2014；dm-loop §6.1 校对锚 [BR p.13]）：
// 下标=等级-1，值=到达该等级所需累计 XP；355000 顶到 20 级。单一事实源——gain_exp 与 ui_data 面板共用。
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]

// ── 出生机/写盘助手(2026-09-26 机械层收拢:第二消费者出现,YAGNI 门槛已过)──
// classRow 序数词版单源——SRD 职业表等级列是 | 1st | 2nd |,纯数字正则永不匹配(gain_exp 旧副本之病:特征行恒 '—')。
export function classRow(cls, L) {
  try {
    const md = readFileSync(`dnd5e-srd-lorebook/classes/${cls}.md`, 'utf8')
    const re = new RegExp(`^\\|\\s*${L}(?:st|nd|rd|th)?\\s*\\|\\s*\\+(\\d+)\\s*\\|\\s*([^|]*)\\|\\s*([^|]*)\\|`, 'm')
    const m = re.exec(md)
    if (m) return { pb: +m[1], features: m[2].trim(), specific: m[3] ? JSON.parse(m[3].replace(/'/g, '"')) : {} }
  } catch {}
  return { features: '', specific: {} }
}
// 裁剪律落地(空数组整族删,不留 0/空壳)——spawn_npc 与 opening 共用(opening 本地副本退役)。
export const stripEmptyArrays = (obj) => { const out = {}; for (const [k, v] of Object.entries(obj)) { if (Array.isArray(v) && v.length === 0) continue; out[k] = v } return out }
// 写盘 helper:整档读→改→回写(parse 往返纪律;parse-modify-stringify 保证落盘必是合法 JSON)。
export const saveChar = (file, j) => { writeFileSync(file, JSON.stringify(j, null, 1)) }
// presence 行追加(spawn_npc 用):插在「## 附近 NPC」节首(行序即注入序,新登场在前);节缺则建于「## 战斗」前。
export function presenceAdd(name, stance) {
  let md = readFileSync('state.md', 'utf8')
  const row = `- ${name} | ${stance}`
  md = /## 附近 NPC/.test(md) ? md.replace(/(## 附近 NPC[^\n]*\n)/, `$1${row}\n`) : md.replace(/(## 战斗)/, `## 附近 NPC\n${row}\n\n$1`)
  writeFileSync('state.md', md)
}
// 战斗节整节重写(initiative 物化/尾代清场用):state=null → 清回「（无战斗）」。
export function combatWrite(state) {
  const md = readFileSync('state.md', 'utf8')
  const lines = state ? [
    `- 回合：${state.round}`,
    `- 先攻：${state.order.map(o => `${o.who}:${o.init}`).join(' > ')}`,
    ...state.enemies.map(e => `- 敌行：${e.name}${e.path ? ` | path:${e.path}` : ''}${e.status ? ` | ${e.status}` : ''}`),
  ] : ['（无战斗）']
  writeFileSync('state.md', md.replace(/(## 战斗[^\n]*\n)[\s\S]*?(?=\n## |$)/, `$1${lines.join('\n')}\n`))
}
