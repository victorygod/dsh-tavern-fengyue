// opening_commit — 出生生成器(前端 runScript 调用,t=0 唯一非转录写盘道)。
// 输入:创角表单 JSON + 场景 id → 裁剪+查表 → 写 characters/player.json + patch state.md → 返回开场白。
// 契约:docs/design_zh.md §6 · character.tpl.json v10(全字段对照骨架+出生器裁剪)。
// 2026-09-20 用户定案:开局只落主角——同伴/场景 NPC 一律不种档,由 DM 在场内按叙事建档。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { mod } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)

const fail = (m, h) => { console.log(JSON.stringify({ ok: false, error: m, hint: h ?? '' })); process.exit(1) }
const inp = JSON.parse(typeof globalThis.argv?.[0] === 'string' ? globalThis.argv[0] : '{}')
const ch = inp.character
ch?.name || fail('缺 name')
ch?.class || fail('缺 class')
ch?.abilities || fail('缺 abilities')
const cls = ch.class.toLowerCase()
const race = (ch.race ?? 'human').toLowerCase()
const scenarioId = inp.scenario ?? 'border-town'
const toolsDir = 'dnd5e-srd-lorebook'

// ── 查表 ──
function readFM(rel) {
  try {
    const raw = readFileSync(`${toolsDir}/${rel}`, 'utf8')
    const m = /^---\n([\s\S]*?)\n---/.exec(raw); if (!m) return {}
    const fm = {}; let cur = null
    for (const line of m[1].split('\n')) {
      const li = /^  - (.*)$/.exec(line)
      if (li && cur) { fm[cur] = [...(fm[cur] ?? []), li[1].replace(/^"|"$/g, '')]; continue }
      const kv = /^([a-z_]+):\s*(.*)$/.exec(line)
      if (kv) { cur = kv[1]; fm[cur] = kv[2] === '' ? [] : (kv[2] === 'true' ? true : kv[2] === 'false' ? false : (/^-?\d+(\.\d+)?$/.test(kv[2]) ? Number(kv[2]) : kv[2].replace(/^"|"$/g, ''))) }
    }
    return fm
  } catch { return {} }
}
function classRow(cls, L) {
  try {
    const md = readFileSync(`${toolsDir}/classes/${cls}.md`, 'utf8')
    // 等级列在 SRD 表里是序数词（| 1st | 2nd | 3rd …），纯数字匹配会落空 → features 整列丢。
    // specific 列可能是嵌套 JSON（{"sneak_attack":{"dice_count":1,…}}），\{[^}]*\} 遇嵌套即断——用 [^|]* 抓整列不关心括号。
    const re = new RegExp(`^\\|\\s*${L}(?:st|nd|rd|th)?\\s*\\|\\s*\\+(\\d+)\\s*\\|\\s*([^|]*)\\|\\s*([^|]*)\\|`, 'm')
    const m = re.exec(md)
    return m ? { features: m[2].trim(), specific: m[3] ? JSON.parse(m[3].replace(/'/g, '"')) : {} } : { features: '', specific: {} }
  } catch { return { features: '', specific: {} } }
}

// ── 种族/职业查表 ──
const raceFM = readFM(`races/${race}.md`)
const classFM = readFM(`classes/${cls}.md`)
const hitDie = classFM.hit_die ?? 8
const saves = classFM.saves ?? []
const isCaster = ['wizard', 'cleric', 'sorcerer', 'druid', 'bard'].includes(cls)
const ab = ch.abilities
const conM = mod(ab.con ?? 10)

// ── HP/HP上限 ──
const hpMax = hitDie + conM

// ── 装备(简化:按职业给起装包) ──
const EQUIP = {
  fighter: { weapon: 'longsword', armor: 'chain-mail', shield: true, gear: ['徒手近战武器'], gp: 10, sp: 0, cp: 0 },
  rogue:   { weapon: 'shortsword', armor: 'studded-leather-armor', shield: false, gear: ['短弓', '箭袋(20支)'], gp: 11, sp: 0, cp: 0 },
  wizard:  { weapon: 'quarterstaff', armor: null, shield: false, gear: ['法术书', '墨水与羽毛笔'], gp: 10, sp: 0, cp: 0 },
  cleric:  { weapon: 'mace', armor: 'scale-mail', shield: true, gear: ['圣徽'], gp: 11, sp: 0, cp: 0 }
}
const eq = EQUIP[cls] ?? { weapon: '短棒', armor: null, shield: false, gear: [], gp: 10, sp: 0, cp: 0 }

// ── 施法族(仅施法职业) ──
const casterAttr = { wizard: 'int', cleric: 'wis', sorcerer: 'cha', druid: 'wis', bard: 'cha' }[cls] ?? null
const slots = isCaster ? { slots_l1: 2 } : {}
const casterFields = isCaster
  ? { caster_attr: casterAttr, spells_known: [], spells_prepared: [], concentrating: null, ...slots }
  : {}

// ── features(职业 L1 特征行) ──
const row1 = classRow(cls, 1)
const features = (row1.features ?? '').split(',').map(s => s.trim()).filter(Boolean)
  .map(f => `${f}|长休|已用0`)

// ── 组装面板(全字段骨架→裁剪) ──
const panel = {
  name: ch.name,
  gender: ['male', 'female', 'unknown'].includes(ch.gender ?? '') ? ch.gender : 'unknown',
  description: `${ch.background} 出身的 ${cls}`,
  role: 'pc',
  class: cls, subclass: null, level: 1, exp: 0,
  race: race, background: ch.background ?? '',
  hp: hpMax, hp_max: hpMax,
  hd_available: 1, temp_hp: 0, exhaustion: 0,
  gp: eq.gp, sp: eq.sp, cp: eq.cp,
  armor: eq.armor ?? '', shield: eq.shield === true,
  speed: raceFM.speed ?? 30, darkvision: raceFM.darkvision ?? null,
  str: ab.str ?? 10, dex: ab.dex ?? 10, con: ab.con ?? 10, int: ab.int ?? 10, wis: ab.wis ?? 10, cha: ab.cha ?? 8,
  save_prof: saves,
  skill_prof: ch.skills ?? [],
  expertise: [], armor_prof: [], weapon_prof: [], tool_prof: [],
  languages: raceFM.languages ?? ['Common'],
  resist: raceFM.resist ?? [], immune: [],
  ...casterFields,
  features: features,
  pending: [], statuses: [],
  persona: ch.persona ?? {},
  biography: [ch.backstory ?? ''],
  weapons: [eq.weapon], gear: eq.gear,
}

// ── 写玩家面板 ──
mkdirSync('characters', { recursive: true })  // 种子无此目录（角色未出生时 runtime/ 无 characters/）——t0 首建
// ── 裁剪律落地（模板 _tpl：没有什么能力就没有相关字段）──
// 空数组键整族删除，注入面板(玩家/NPC 原样 stringify)不再带 [] 占位；
// null(无子职/无暗视)与空字符串(无甲)仍有语义，保留。
const stripEmptyArrays = (obj) => {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out
}
writeFileSync(`characters/player.json`, JSON.stringify(stripEmptyArrays(panel), null, 1))

// ── patch state.md ──
// openings.json：种子把它复制在 runtime 根（与 state.md 同层）；旧布局（preset/setup/）兜底。
let OPENINGS
try { OPENINGS = JSON.parse(readFileSync('openings.json', 'utf8')) } catch { }
if (!OPENINGS) { try { OPENINGS = JSON.parse(readFileSync('../preset/setup/openings.json', 'utf8')) } catch { } }
const scenario = (OPENINGS?.scenarios ?? []).find(s => s.id === scenarioId) ?? {}
const st = scenario.state ?? {}

let stateMd = existsSync('state.md') ? readFileSync('state.md', 'utf8') : ''
stateMd = stateMd.replace(/^(## 时间敏感项\n[\s\S]*?)(^- 当前时间：).*$/m, `$1$2第1日·18时`)
stateMd = stateMd.replace(/(## 玩家所在\n)[\s\S]*?(?=\n## |$)/, `$1`
  + `- 大区：${st.大区 ?? '边境边地'}\n`
  + `- 区域：${st.区域 ?? '灰鸦丘陵'}\n`
  + `- 地点：${st.地点 ?? st.所在 ?? '边境小镇·北门'}\n`
  + `- 地形：${st.地形 ?? '温带丘陵'}\n`
  + `- 天气：${st.天气 ?? '小雨'}`)
// 节标题与 setup/state.md 对齐（模板曾叫「当前篇章」,现是「篇章进度」——沿用旧名等于静默 no-op)
stateMd = stateMd.replace(/(## 篇章进度\n- 当前篇章：).*/, `$1${st.篇章 ?? '序章'}`)
stateMd = stateMd.replace(/(## 主线\n- ).*/, `$1${st.主线 ?? '（待定）'}`)
stateMd = stateMd.replace(/(## 队伍\n(?:[^\n]*\n)?- 平均等级：).*/, '$11')
writeFileSync('state.md', stateMd)

// ── 返回开场白 ──
const narration = inp.narration ?? scenario.narration ?? '冒险开始了。'
okR({ narration, scenario: scenarioId, who: ch.name })
function okR(r) { console.log(JSON.stringify({ ok: true, ...r })) }
