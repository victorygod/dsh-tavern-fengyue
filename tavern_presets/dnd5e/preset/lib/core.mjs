// core.mjs — 卡工具共享件（消费者=8 工具,YAGNI 外提条件达成 2026-09-19）。
// 工具经 file:// 绝对引用本件（data-module 相对 import 不可达;cwd=runtime→../preset/lib 可达）。
import { readFileSync, existsSync, readdirSync } from 'node:fs'
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
export const pb = (level) => 2 + Math.floor((Math.min(level, 20) - 1) / 4)
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
// 行语法：- 回合：N ／ - 先攻：名:init > 名:init ／ - 敌行|友行：名 | HP 现值/上限 | AC n | path:lorebook相对路径 | 状态文本
export function combatSectionLines() {
  try {
    const md = readFileSync('state.md', 'utf8')
    const m = /## 战斗[^\n]*\n([\s\S]*?)(?=\n## |$)/.exec(md)
    return (m?.[1] ?? '').split('\n').map(l => l.trim().replace(/^-\s*/, '')).filter(l => l && l !== '（无战斗）')
  } catch { return [] }
}
export function foeRow(seg, kind) {
  const parts = seg.split('|').map(s => s.trim())
  const hp = /HP\s*(\d+)\s*\/\s*(\d+)/i.exec(seg), ac = /AC\s*(\d+)/i.exec(seg), pa = /path[:：]\s*(\S+)/.exec(seg)
  const statusSeg = parts.filter((p, i) => i > 0 && !/^HP/i.test(p) && !/^AC/i.test(p) && !/^path[:：]/.test(p)).join(' ')
  return { name: parts[0], kind, hp: hp ? +hp[1] : null, hp_max: hp ? +hp[2] : null, ac: ac ? +ac[1] : null, path: pa ? pa[1] : null, statuses: statusSeg ? [{ name: statusSeg }] : [] }
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

// PHB XP 阈值表（PHB「Beyond 1st Level」，2014；dm-loop §6.1 校对锚 [BR p.13]）：
// 下标=等级-1，值=到达该等级所需累计 XP；355000 顶到 20 级。单一事实源——gain_exp 与 ui_data 面板共用。
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]
