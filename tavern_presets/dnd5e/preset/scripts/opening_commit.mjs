// opening_commit — 出生生成器(前端 runScript 调用,t=0 唯一非转录写盘道)。
// 输入:创角表单 JSON + 场景 id → 裁剪+查表 → 写 characters/player.json + patch state.md → 返回开场白。
// 契约:docs/design_zh.md §6 · character.tpl.json v10(全字段对照骨架+出生器裁剪)。
// 2026-09-20 用户定案:开局只落主角——同伴/场景 NPC 一律不种档,由 DM 在场内按叙事建档。
// 2026-09-25 成长流定案:创角不再"单薄"——技能按语料白名单校验(选数按职业)、施法者出生
//   即有戏法/首环(缺者服务端 roll 兜底,有者校验)、L1 子职落 subclass、训练面按职业白名单出生、
//   特征回充时机按表(池类才标,非池 |—)、description/backstory 中文组装。
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const core = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { mod } = core
const { OPENING_META, CASTERS, SUBCLASS_LEVEL, CANTRIPS_L1, KNOWN_L1, PRIMARY, FEATURES_RECHARGE, EQUIP_BY_CLASS, CLASS_CN, RACE_CN, parseSkillChoices } =
  await import(pathToFileURL(process.cwd() + '/../preset/lib/opening-meta.mjs').href)

const fail = (m, h) => { console.log(JSON.stringify({ ok: false, error: m, hint: h ?? '' })); process.exit(1) }
const inp = JSON.parse(typeof globalThis.argv?.[0] === 'string' ? globalThis.argv[0] : '{}')
const ch = inp.character
ch?.name || fail('缺 name')
ch?.class || fail('缺 class')
ch?.abilities || fail('缺 abilities')
const cls = ch.class.toLowerCase()
if (!(cls in OPENING_META.CLASS_CN)) fail(`未知职业 ${cls}`)
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
const rnd = () => Math.random()
const pick = (arr, n) => {
  const pool = [...arr]
  const out = []
  while (out.length < n && pool.length) out.push(...pool.splice(Math.floor(rnd() * pool.length), 1))
  return out
}

// ── 种族/职业查表 ──
const raceFM = readFM(`races/${race}.md`)
const classMD = readFileSync(`${toolsDir}/classes/${cls}.md`, 'utf8')
const classFM = readFM(`classes/${cls}.md`)
const hitDie = classFM.hit_die ?? 8
const saves = classFM.saves ?? []
const parsed = parseSkillChoices(/\*Proficiencies:\*\s*(.+)/.exec(classMD)?.[1] ?? null)
parsed || fail(`classes/${cls}.md 缺可解析的 Skill Proficiencies 行`, '语料形状坏——不能出生')
const isCaster = CASTERS.includes(cls)
const ab = ch.abilities
const conM = mod(ab.con ?? 10)
const casterAttr = ({ wizard: 'int', cleric: 'wis', sorcerer: 'cha', druid: 'wis', bard: 'cha', warlock: 'cha' })[cls] ?? null

// ── HP/HP上限 ──
const hpMax = hitDie + conM

// ── 技能校验(白名单+选数——表单已按类过滤,此处是机械层最后闸) ──
const skillPool = parsed.anySkill
  ? Object.values(ch.skills ?? []).length ? ch.skills : []
  : parsed.skills
const chosenSkills = Array.isArray(ch.skills) ? ch.skills : []
const allowedSkills = parsed.anySkill ? chosenSkills : skillPool
chosenSkills.every(s => allowedSkills.includes(s)) || fail('技能熟练超出职业白名单', `本职业可选:${allowedSkills.join(', ')}`)
chosenSkills.length === parsed.count || fail(`技能熟练须选 ${parsed.count} 项(本职业技能选数,非法数 ${chosenSkills.length})`)

// ── 法术:payload 有则校验,无则服务端 roll(表单与机械层双源同表——lorebook 才是白名单) ──
function readDirSpells(level, out) {
  try {
    for (const f of readdirSync(`${toolsDir}/spells`).filter(f => f.endsWith('.md'))) {
      const fm = readFM(`spells/${f}`)
      if (!fm.name || fm.level !== level) continue
      const classes = Array.isArray(fm.classes) ? fm.classes.map(c => String(c).toLowerCase()) : []
      if (!classes.includes(cls)) continue
      out.push(String(fm.name))
    }
  } catch { }
  return [...new Set(out)].sort()
}
const pool0 = isCaster ? readDirSpells(0, []) : []
const pool1 = isCaster ? readDirSpells(1, []) : []
const rollFrom = (arr, n) => (arr.length <= n ? [...arr] : pick(arr, n))
let cantrips = [], learned = [], prepared = []
if (isCaster) {
  const wantC = CANTRIPS_L1[cls] ?? 0
  const wantK = KNOWN_L1[cls] ?? 0
  const inC = Array.isArray(ch.spells?.cantrips) ? ch.spells.cantrips : []
  const inK = Array.isArray(ch.spells?.spells) ? ch.spells.spells : []
  const inP = Array.isArray(ch.spells?.prepared) ? ch.spells.prepared : []
  if (wantC > 0) {
    inC.length ? (inC.length === wantC || fail(`戏法须 ${wantC} 个(得 ${inC.length})`), inC.every(s => pool0.includes(s)) || fail('戏法超出职业表'))
      : (pool0.length || fail(`语料无 ${cls} 的戏法卡——不能出生施法族`))
    cantrips = inC.length ? [...inC] : rollFrom(pool0, wantC)
  }
  if (wantK > 0) {
    inK.length ? (inK.length === wantK || fail(`首环法术须 ${wantK} 个(得 ${inK.length})`), inK.every(s => pool1.includes(s)) || fail('首环法术超出职业表'))
      : (pool1.length || fail(`语料无 ${cls} 的 1 环卡——不能出生施法族`))
    learned = inK.length ? [...inK] : rollFrom(pool1, wantK)
  }
  if (cls === 'cleric' || cls === 'druid') {
    // 准备制:整表备选,准备数=职业等级(1)+施法属性调整值——roll 满额给出默认表,长休后整表可换
    const wantP = 1 + Math.max(mod(ab[casterAttr] ?? 10), 0)
    prepared = inP.length ? inP : rollFrom(pool1, Math.min(wantP, pool1.length))
  }
}

// ── 子职业:1 级分岔者必落(表单给出/服务端 roll),其余 null ──
const subAt = SUBCLASS_LEVEL[cls] ?? 99
const subList = Array.isArray(classFM.subclass) ? classFM.subclass.map(String).filter(Boolean) : []
let subclass = null
if (subAt === 1) {
  const inSub = typeof ch.subclass === 'string' && ch.subclass ? ch.subclass : null
  if (inSub !== null) (subList.includes(inSub) || fail(`子职业 ${inSub} 不在本职业语料清单`))
  subclass = inSub ?? (subList.length ? pick(subList, 1)[0] : null)
}

// ── 装备(12 职业全表;slug 与语料 equipment 对齐) ──
const eq = EQUIP_BY_CLASS[cls] ?? fail(`起装表缺 ${cls}`)

// ── 施法族(仅施法职业;warlock Pact Magic L1=1 位) ──
const slots = isCaster ? { slots_l1: cls === 'warlock' ? 1 : 2 } : {}
const casterFields = isCaster
  ? { caster_attr: casterAttr, spells_known: learned, spells_prepared: prepared, concentrating: null, ...slots }
  : {}

// ── features(职业 L1 特征行)——回充时机按表,非池 |— 不造伪池 ──
const row1 = classRow(cls, 1)
const features = (row1.features ?? '').split(',').map(s => s.trim()).filter(Boolean)
  .map(f => {
    const key = Object.keys(FEATURES_RECHARGE).find(k => f.toLowerCase().includes(k.toLowerCase()))
    const recharge = key ? FEATURES_RECHARGE[key] : '—'
    return `${f}|${recharge}|已用0`
  })

// ── 训练面(职业 Proficiencies 行是白给的——此前空数组出生=整族被裁) ──
const PROF_ARMOR = {
  barbarian: ['轻甲', '中甲', '盾牌'], bard: ['轻甲'], cleric: ['轻甲', '中甲', '盾牌'], druid: ['轻甲', '中甲', '盾牌'],
  fighter: ['轻甲', '中甲', '重甲', '盾牌'], monk: [], paladin: ['轻甲', '中甲', '重甲', '盾牌'], ranger: ['轻甲', '中甲', '盾牌'],
  rogue: ['轻甲'], sorcerer: [], warlock: ['轻甲'], wizard: [],
}
const PROF_WEAPON = {
  barbarian: ['简易武器', '军用武器'], bard: ['简易武器', '手弩', '长剑', '细剑', '短剑'], cleric: ['简易武器'],
  druid: ['木棍', '匕首', '飞镖', '矛', '弯刀(语料键对齐)', '镰刀', '投石索'], fighter: ['简易武器', '军用武器'],
  monk: ['简易武器', '短剑'], paladin: ['简易武器', '军用武器'], ranger: ['简易武器', '军用武器'],
  rogue: ['简易武器', '手弩', '长剑', '细剑', '短剑'], sorcerer: ['匕首', '飞镖', '轻弩', '长杖'], warlock: ['简易武器'],
  wizard: ['匕首', '飞镖', '轻弩', '长杖'],
}
const armors = Array.isArray(profArmor(cls)) ? profArmor(cls) : []
function profArmor(c) { return PROF_ARMOR[c] ?? [] }
const weaponsArr = PROF_WEAPON[cls] ?? []

// ── 组装面板(全字段骨架→裁剪) ──
const clsCn = CLASS_CN[cls] ?? cls
const raceCn = RACE_CN[race] ?? race
const persona = ch.persona ?? {}
const description = `${raceCn} ${clsCn}——${persona.personality ?? '来历各异的冒险新手'}`
const biography0 = ch.backstory?.trim() ||
  `${ch.background ?? '无名'}出身,一脚踏进了${clsCn}这行。${persona.personality ? personalityPhrase(persona.personality) : ''}${persona.bonds ? `心里搁着「${persona.bonds}」。` : ''}${persona.ideals ? `认 ${persona.ideals} 这两个字。` : ''}`.trim()
function personalityPhrase(p) { return `一来一往都是${p}的做派。` }

const panel = {
  name: ch.name,
  gender: ['male', 'female', 'unknown'].includes(ch.gender ?? '') ? ch.gender : 'unknown',
  description,
  role: 'pc',
  class: cls, subclass, level: 1, exp: 0,
  race: race, background: ch.background ?? '',
  hp: hpMax, hp_max: hpMax,
  hd_available: 1, temp_hp: 0, exhaustion: 0,
  gp: eq.gp, sp: eq.sp, cp: eq.cp,
  armor: eq.armor ?? '', shield: eq.shield === true,
  speed: raceFM.speed ?? 30, darkvision: raceFM.darkvision ?? null,
  str: ab.str ?? 10, dex: ab.dex ?? 10, con: ab.con ?? 10, int: ab.int ?? 10, wis: ab.wis ?? 10, cha: ab.cha ?? 8,
  save_prof: saves,
  skill_prof: chosenSkills,
  expertise: [], armor_prof: armors, weapon_prof: weaponsArr, tool_prof: [],
  languages: raceFM.languages ?? ['Common'],
  resist: raceFM.resist ?? [], immune: [],
  ...casterFields,
  features: features,
  pending: [], statuses: [],
  persona: persona,
  biography: [biography0],
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
okR({
  narration, scenario: scenarioId, who: ch.name,
  rolled: { cantrips, spells: learned, prepared, subclass, skills: chosenSkills },   // 回执可考——开场白之外的 roll 全透明
})
function okR(r) { console.log(JSON.stringify({ ok: true, ...r })) }