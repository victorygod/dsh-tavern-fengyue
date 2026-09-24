// ui_data — HUD/手簿唯一数据泵(前端 runScript 调用;cwd=runtime)。
// op=rev → 节级 rev 心跳;op=full → 全量投影+derived。契约:docs/ui_zh.md 数据流架构。
import { statSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { mod, pb, readFM, parseCombat, XP_THRESHOLDS } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv?.[0] ? JSON.parse(globalThis.argv[0]) : (globalThis.argv ?? {})
const op = a.op ?? 'full'

const secStat = (p) => { try { const s = statSync(p); return `${s.mtimeMs}:${s.size}` } catch { return null } }
// 大 payload 出闸：process.exit 会砍掉管道里未冲刷的 stdout（macOS 管道缓冲 64KB——头像整表它睡醒）。
// 显式等 write 回调落完再退。ui2 面板唯一读口，输出为前端 RPC 消息，无模型上下文成本。
const emit = obj => new Promise(res => process.stdout.write(JSON.stringify(obj) + '\n', res))

if (op === 'avatars') {  // 头像素材槽：preset/ui/avatars/<race>-<gender>.<ext> → dataURL；keys 过滤=前端逐键取（整表 3MB+ 会撞宿主 stdout 上限）
  const ext = f => ({ png: 'png', webp: 'webp', jpg: 'jpeg', jpeg: 'jpeg', gif: 'gif' }[f.split('.').pop().toLowerCase()] ?? null)
  const out = {}
  const keysIn = Array.isArray(a.keys) ? a.keys : Array.isArray(a.scope?.keys) ? a.scope.keys : null
  const want = keysIn ? new Set(keysIn.map(k2 => String(k2))) : null
  try { for (const f of readdirSync('../preset/ui/avatars')) {
    const mime = ext(f); if (!mime) continue
    const id = f.replace(/\.(png|webp|jpe?g|gif)$/i, '')
    if (want && !want.has(id)) continue
    out[id] = `data:image/${mime};base64,${readFileSync(`../preset/ui/avatars/${f}`).toString('base64')}`
  } } catch { }
  await emit({ ok: true, avatars: out }); process.exit(0)
}

if (op === 'rev') {
  const rev = {
    player: secStat('characters/player.json'),
    mates: agg('characters', f => f !== 'player.json'),
    state: secStat('state.md'),  // 战斗节随 state.md 一并监视（combat.json 已废——2026-09-20 定案战斗入 state.md）
  }
  console.log(JSON.stringify({ ok: true, rev })); process.exit(0)
}

// ── full ──
function readJ(p) { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }
function agg(dir, filter) {
  let mx = 0, n = 0, b = 0
  try { for (const f of readdirSync(dir).filter(f => f.endsWith('.json') && (!filter || filter(f)))) {
    const s = statSync(`${dir}/${f}`); mx = Math.max(mx, s.mtimeMs); n++; b += s.size
  } } catch {}
  return `${mx}:${n}:${b}`
}
const player = readJ('characters/player.json')
const companions = []
try { for (const f of readdirSync('characters').filter(f => f.endsWith('.json')).sort()) {
  if (f === 'player.json') continue
  const j = readJ(`characters/${f}`); if (j) { j._file = f; companions.push(j) }
} } catch {}
// 战斗＝state.md「## 战斗」节（combat.json 已废——2026-09-20 定案,解析归 core.parseCombat,语法见 core.mjs）
const combat = parseCombat()
// 先攻 join + 具名敌挂 character 档（HUD ctx 全卡）
for (const e of combat?.enemies ?? []) {
  const hit = (combat.order ?? []).find(o => o.who === e.name || o.who.includes(e.name) || String(e.name).includes(o.who))
  if (hit) e.init = hit.init
  e.character = existsSync(`characters/${e.name}.json`) ? `${e.name}.json` : null
}
let state = { time: '', place: '', main: [], side: [], changes: [], party: [] }
try {
  const md = readFileSync('state.md', 'utf8')
  const grab = (h) => { const i = md.indexOf('## ' + h); if (i < 0) return []; const j = md.indexOf('\n## ', i + 1); return (j < 0 ? md.slice(i) : md.slice(i, j)).split('\n').slice(1).filter(l => l.trim().startsWith('-')).map(l => l.replace(/^\s*-\s*/, '')) }
  const tm = /当前时间：第(\d+)日·(\d+)时/.exec(md)
  const locLines = grab('玩家所在')
  // v8 层级约定：大区/区域/地点/地形/天气 五行 key：value；兼容旧单行（无 key 前缀=地点）
  const locKV = {}
  let legacyPlace = null
  for (const raw of locLines) {
    const m = /^(大区|区域|地点|地形|天气)[：:]\s*(.*)$/.exec(raw.trim())
    if (m) locKV[m[1]] = m[2].trim()
    else if (raw.trim() && legacyPlace === null) legacyPlace = raw.trim()
  }
  const hier = !!locKV['地点'] || !!locKV['大区']
  state = {
    time_day: +(tm?.[1] ?? 1), time_hour: +(tm?.[2] ?? 18),
    region: locKV['大区'] ?? null, area: locKV['区域'] ?? null,
    place: locKV['地点'] ?? legacyPlace ?? '',
    terrain: locKV['地形'] ?? null, weather: locKV['天气'] ?? null,
    hierarchy: hier,
    main: grab('主线'), side: grab('支线'), recent: grab('近期人物'), party: grab('队伍'), changes: grab('上回合变化'),
  }
} catch {}
// 全施法者位表（1-20 级 × 1-9 环槽位）——死规则，SRD 语料无此表（class 文件仅 Class Specific），
// 脚本内嵌为唯一载体。D3 首卡施法者=法师/牧师（皆 full caster）；half caster/warlock 另有表，后续扩展。
const FULL_CASTER_SLOTS = [
  [2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],
  [4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
  [4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],
  [4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],
  [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1],
]
// 18 技能→关键属性（死规则，同 FULL_CASTER_SLOTS 先例内嵌为唯一载体；中文名=前端展示映射）
const SKILL_ATTRS = {
  acrobatics: 'dex', animal_handling: 'wis', arcana: 'int', athletics: 'str',
  deception: 'cha', history: 'int', insight: 'wis', intimidation: 'cha',
  investigation: 'int', medicine: 'wis', nature: 'int', perception: 'wis',
  performance: 'cha', persuasion: 'cha', religion: 'int', sleight_of_hand: 'dex',
  stealth: 'dex', survival: 'wis',
}
const ATTR_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha']
const norm = (s) => String(s ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')

function derive(c) {
  if (!c) return null
  // 缺席保真:AC/被动察觉依赖 dex/wis——键缺席输出 null(战斗面懒生成的 NPC 按 ??? 呈现),不再涂基准值。
  // 甲语义(语料 frontmatter 如实):ac_dex_bonus:true=加敏(light/medium,可带 ac_dex_cap);键缺席=重甲定值,
  // 不依赖 dex——2026-09-22 巡检修正:原逻辑无条件 base+dexM,重甲 AC 虚高 dexM 点。
  const dexM = c.dex == null ? null : Math.floor((c.dex - 10) / 2)
  let ac = dexM == null ? null : 10 + dexM
  if (c.armor) { try { const raw = readFileSync(`dnd5e-srd-lorebook/equipment/${c.armor}.md`, 'utf8'); const m = /ac_base:\s*(\d+)/.exec(raw); if (m) { if (/ac_dex_bonus:\s*true/.test(raw)) { const cap = /ac_dex_cap:\s*(\d+)/.exec(raw)?.[1]; ac = dexM == null ? null : +m[1] + (cap === undefined ? dexM : Math.min(dexM, +cap)) } else ac = +m[1] } } catch {} }
  if (ac != null && (c.shield === true || c.shield === 'true')) ac += 2
  // 以面板字段判施法者——不预设 class 名单（面板填什么值就用什么值）；v9.1 resources 已并入 features，池条随删
  const isCaster = c.caster_attr != null && c.caster_attr !== '' && c.slots_l1 != null
  const bar = isCaster ? 'slots' : 'hd'
  let slotsNow = 0, slotsTotal = null, slotsLv = null
  if (isCaster) {
    const lv = Math.min(Math.max(Number(c.level ?? 1), 1), 20)
    slotsLv = []
    for (let i = 1; i <= 9; i++) {
      const total = FULL_CASTER_SLOTS[lv - 1][i - 1]
      if (total > 0) { slotsLv.push({ lv: i, now: Number(c['slots_l' + i] ?? 0), total }); slotsNow += Number(c['slots_l' + i] ?? 0) }
    }
    slotsTotal = FULL_CASTER_SLOTS[lv - 1].reduce((a, b) => a + b, 0)
  }
  // 熟练面（规则计算归泵）：PB + 属性调整；熟练/专业按面板集合判定，键名大小写/空格归一
  const level = Math.min(Math.max(Number(c.level ?? 1), 1), 20)
  const PB = pb(level)
  const profSet = new Set((Array.isArray(c.skill_prof) ? c.skill_prof : []).map(norm))
  const expSet = new Set((Array.isArray(c.expertise) ? c.expertise : []).map(norm))
  const skills = Object.entries(SKILL_ATTRS).map(([key, attr]) => {
    const exp = expSet.has(key), prof = exp || profSet.has(key)
    return { key, attr, mod: mod(c[attr] ?? 10) + (exp ? PB * 2 : prof ? PB : 0), prof, exp }
  })
  const saveProf = new Set((Array.isArray(c.save_prof) ? c.save_prof : []).map(norm))
  const saves = ATTR_KEYS.map(k => ({ key: k, mod: mod(c[k] ?? 10) + (saveProf.has(k) ? PB : 0), prof: saveProf.has(k) }))
  // 武器 join（同 AC join 先例——伤害/属性从 equipment frontmatter 读，缺席键=键名原样返回）
  const weapons = (Array.isArray(c.weapons) ? c.weapons : []).map(w => {
    let fm = {}
    try { fm = readFM(`equipment/${norm(w)}.md`) } catch {}
    return String(fm.damage ?? '') ? { name: w, damage: fm.damage, damage_type: fm.damage_type ?? '', props: Array.isArray(fm.properties) ? fm.properties : [] } : { name: w, damage: null, damage_type: '', props: [] }
  })
  const casterMod = isCaster ? mod(c[c.caster_attr] ?? 10) : null
  // 成长族（键裁剪律：面板自带 exp 才出条；opening 出生 exp=0）——当前级下限→下一级阈值;20 级 next=null=已满
  const expBar = (c.exp === undefined || c.exp === null) ? null : {
    exp: Number(c.exp), min: XP_THRESHOLDS[(level ?? 1) - 1], next: level >= 20 ? null : XP_THRESHOLDS[level],
  }
  // 缺席保真（2026-09-22 拍板）:hp 族/六维缺席输出 null 而非 0/10 伪值——view 层按 ???/满血/雷达收束消费。
  // 战斗面懒生成的纯场景 NPC 出生即无 hp 族;真 0 血(≥0 且 hp_max>0)照常出数值 0。
  const hasHp = c.hp != null && c.hp_max != null
  return {
    ac: ac, hpPct: hasHp ? (c.hp_max > 0 ? Math.round((c.hp / c.hp_max) * 100) : 0) : null, bar, slotsNow, slotsTotal, slotsLv,
    pb: PB, expBar, skills, saves, weapons, attrMods: ATTR_KEYS.map(k => ({ key: k, mod: c[k] == null ? null : mod(c[k]) })),
    dc: isCaster ? 8 + PB + casterMod : null,          // 法术DC=8+PB+主属性
    atk: isCaster ? PB + casterMod : null,              // 法术攻击=PB+主属性
    passive: c.wis == null ? null : 10 + (skills.find(s2 => s2.key === 'perception')?.mod ?? 0),   // 被动察觉=10+察觉技巧（wis 缺席=未知）
  }
}
// ── 成长流（2026-09-24 定案）:戏法/环术拆行 + 学法术候选择 ──
// cantrip 判定读法术卡 frontmatter level:0;名单里存中文名卡无英文 slug → 归环术行(不误标戏法)。
const _slug = n => String(n ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-')
const _spellCache = new Map()
function spellFm(name) {
  const slug = _slug(name)
  if (_spellCache.has(slug)) return _spellCache.get(slug)
  let fm = null
  try { fm = readFM(`spells/${slug}.md`) } catch {}
  _spellCache.set(slug, fm)
  return fm
}
function splitSpells(c) {
  const known = Array.isArray(c.spells_known) ? c.spells_known : []
  const cantrips = [], leveled = []
  for (const n of known) {
    const lvl = spellFm(n)?.level
    ;(lvl === 0 ? cantrips : leveled).push(n)
  }
  return { cantrips, known: leveled }
}
if (op === 'candidates') {  // 学新法术候选:本职业表 ∩ 环位≤当前可施 ∩ 未收录 ∩ 非戏法（SRD「Learning Spells」限制）
  const c = player
  const isCaster = c && c.caster_attr != null && c.slots_l1 != null
  let candidates = []
  if (isCaster) {
    const lv = Math.min(Math.max(Number(c.level ?? 1), 1), 20)
    const maxLv = FULL_CASTER_SLOTS[lv - 1].reduce((m, t, i) => t > 0 ? i + 1 : m, 0)
    const cls = norm(c.class)
    const known = new Set((Array.isArray(c.spells_known) ? c.spells_known : []).map(n => norm(n)))
    try { for (const f of readdirSync('dnd5e-srd-lorebook/spells').filter(f => f.endsWith('.md'))) {
      const fm = readFM(`spells/${f}`)
      if (!fm.name || fm.level == null) continue
      if (!(fm.level >= 1 && fm.level <= maxLv)) continue
      const classes = Array.isArray(fm.classes) ? fm.classes.map(norm) : []
      if (!classes.includes(cls)) continue
      if (known.has(norm(fm.name)) || known.has(norm(f.replace(/\.md$/, '')))) continue
      candidates.push({ name: String(fm.name), level: Number(fm.level), ritual: fm.ritual === true })
    } } catch (e) { console.error("CAND-DBG", e && e.message) }
    candidates.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  }
  await emit({ ok: true, candidates }); process.exit(0)
}

// ── panel(layout v2 宿主泵):按面板给切片,rev=各自真身文件的 mtime:size 摘要 ──
if (op === 'panel') {
  const enemyNames = new Set((combat?.enemies ?? []).map(e => e.name))
  const mates = companions.filter(c => !enemyNames.has(c.name))
  const avKey = c => {
    const gk = c.gender === 'female' ? 'female' : c.gender === 'male' ? 'male' : 'unknown'
    return `${norm(c.race ?? '').replace(/_/g, '-')}-${gk}`
  }
  const withSpells = c => c ? { ...c, spellSplit: splitSpells(c) } : null
  if (a.name === 'hud-left') {
    await emit({
      ok: true,
      rev: `${secStat('characters/player.json')}:${agg('characters', f => f !== 'player.json')}`,
      data: { player: withSpells(player ? { ...player, derived: derive(player) } : null), companions: mates.map(c => withSpells({ ...c, derived: derive(c) })) },
      avatarKeys: [player, ...mates].filter(Boolean).map(avKey),
    })
    process.exit(0)
  }
  if (a.name === 'hud-right') {
    await emit({ ok: true, rev: secStat('state.md'), data: { state } })
    process.exit(0)
  }
  await emit({ ok: false, error: `未定义面板 ${a.name ?? ''}` }); process.exit(1)
}

console.log(JSON.stringify({
  ok: player !== null, rev: secStat('characters/player.json'),
  player: player ? { ...player, derived: derive(player) } : null,
  companions: companions.map(c => ({ ...c, derived: derive(c) })),
  combat,
  state,
  derived: { companions: {} },
}))
