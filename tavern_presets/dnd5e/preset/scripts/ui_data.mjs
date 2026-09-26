// ui_data — HUD/手簿唯一数据泵(前端 runScript 调用;cwd=runtime)。
// v10(2026-09-25 零轮询):op=panel 携带已知 rev——participant stat 同值回裸 ack
// {ok,rev,changed:false}(无 data),变了才全量投影(拉式差量);op=rev 心跳
// 心跳协议就此退役(从未接线,由 rev 参数短路取代,少一跳)。契约:docs/ui_zh.md 数据流架构。
import { statSync, existsSync, readdirSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { mod, pbOf, readFM, parseCombat, deriveAC, XP_THRESHOLDS, presence } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { spellCn } = await import(pathToFileURL(process.cwd() + '/../preset/lib/glossary-cn.mjs').href)
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
  // 2026-09-25 结账:心跳 op 从未接线(ui_zh.md 列了硬要求但 v9 泵每拍全量调用)——由
  // op=panel 的 rev 参数短路取代(事件已答"何时",本 op 的"是否"只剩静默一问,少一跳)。
  console.error('ui_data: op=rev 已退役——改用 op=panel + args.rev(拉式差量,2026-09-25)'); process.exit(1)
}

// ── 拉式差量(2026-09-25 零轮询):面板 rev 公式唯一出处;op=panel 先按此静默短路,
//    同值回裸 ack 直接退——下面的全量急加载(player/companions/combat/state)全不发生。──
function readJ(p) { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }
function agg(dir, filter) {
  let mx = 0, n = 0, b = 0
  try { for (const f of readdirSync(dir).filter(f => f.endsWith('.json') && (!filter || filter(f)))) {
    const s = statSync(`${dir}/${f}`); mx = Math.max(mx, s.mtimeMs); n++; b += s.size
  } } catch {}
  return `${mx}:${n}:${b}`
}
const panelRevOf = (name) =>
  // v4(2026-09-25):人际三池在 state.md「## 附近 NPC」名单元——左栏(同伴/中立)rev 必须挂 state.md,
  // 否则名单一行之差左栏纹丝不动。右栏=敌对卡+环境:敌卡 join 档案,故 characters 也进右栏。
  name === 'hud-left' ? `${secStat('characters/player.json')}:${agg('characters', f => f !== 'player.json')}:${secStat('state.md')}`
  : name === 'hud-right' ? `${secStat('state.md')}:${agg('characters')}`
  : null
if (op === 'panel' && typeof a.rev === 'string' && a.rev !== '') {
  const rev = panelRevOf(a.name)
  if (rev !== null && rev === a.rev) { await emit({ ok: true, rev, changed: false }); process.exit(0) }
}

// ── full ──
const player = readJ('characters/player.json')
// 战斗＝state.md「## 战斗」节（combat.json 已废——2026-09-20 定案,解析归 core.parseCombat,语法见 core.mjs）
const combat = parseCombat()
// 先攻 join + 具名敌挂 character 档（HUD ctx 全卡）——敌行瘦身后 HP/AC 一律从档 join(行只记身份/path/状态)
for (const e of combat?.enemies ?? []) {
  const hit = (combat.order ?? []).find(o => o.who === e.name || o.who.includes(e.name) || String(e.name).includes(o.who))
  if (hit) e.init = hit.init
  e.character = existsSync(`characters/${e.name}.json`) ? `${e.name}.json` : null
  if (e.character) {
    try {
      const ej = JSON.parse(readFileSync(`characters/${e.character}`, 'utf8'))
      e.hp = ej.hp ?? null; e.hp_max = ej.hp_max ?? null; e.ac = ej.ac ?? deriveAC(ej)
    } catch { e.hp = e.hp_max = e.ac = null }  // 档坏 → 缺席保真(???),不涂默认
  }
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
    main: grab('主线'), side: grab('支线'), party: grab('队伍'), changes: grab('上回合变化'),
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
  // AC 律单源(2026-09-25 收拢 core.deriveAC——原内联副本与 attack 各持一份「同律」注释,分叉即 bug 温床;
  // 顺带中文名甲从此走 equipmentFM 桥,旧裸路径读读不到时回落 10+敏)。
  const ac = deriveAC(c)
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
  const PB = pbOf(level)  // 单键统一律:level 双语义(成长者=等级/怪=CR),pbOf 两端 clamp
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

// ── 人际三池投影(v4,2026-09-25):presence()=state.md「附近 NPC」三态名单,注入与前端同源镜像 ──
// 缺档行 → {_missing:true} 占位(前端占位卡;注入侧同判「勿采信」)。敌卡 HP/先攻敌行优先
// (战斗回合的机械快照),无敌行(持久敌对未接战)纯档案口径。
const sel = presence()
const avKey = c => {
  const gk = c.gender === 'female' ? 'female' : c.gender === 'male' ? 'male' : 'unknown'
  return `${norm(c.race ?? '').replace(/_/g, '-')}-${gk}`
}
const withSpells = c => c ? { ...c, spellSplit: splitSpells(c) } : null
const projMate = r => r.j === null
  ? { name: r.name, _file: r.file, _missing: true }
  : withSpells({ ...r.j, _file: r.file, derived: derive(r.j) })
const projFoe = r => {
  if (r.j === null) return { name: r.name, _file: r.file, _missing: true }
  const row = (combat?.enemies ?? []).find(e => e.name === r.name)
  const eff = row && row.hp != null ? { ...r.j, hp: row.hp, hp_max: row.hp_max ?? r.j.hp_max } : r.j
  const init = row && row.init != null ? { init: row.init } : {}
  return withSpells({ ...eff, ...init, _file: r.file, derived: derive(eff) })
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
      candidates.push({ name: String(fm.name), name_cn: spellCn(String(fm.name)), level: Number(fm.level), ritual: fm.ritual === true })
    } } catch (e) { console.error("CAND-DBG", e && e.message) }
    candidates.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
  }
  await emit({ ok: true, candidates }); process.exit(0)
}

// ── panel(layout v2 宿主泵):按面板给切片,rev=各自真身文件的 mtime:size 摘要 ──
// 左=hero+同伴+中立,右=敌对+环境+任务(v4 三态分区)。
if (op === 'panel') {
  if (a.name === 'hud-left') {
    await emit({
      ok: true,
      rev: panelRevOf('hud-left'),
      data: {
        player: withSpells(player ? { ...player, derived: derive(player) } : null),
        companions: sel.mates.map(projMate),
        neutrals: sel.neutrals.map(projMate),
      },
      avatarKeys: [player, ...sel.mates.map(r => r.j), ...sel.neutrals.map(r => r.j)].filter(Boolean).map(avKey),
    })
    process.exit(0)
  }
  if (a.name === 'hud-right') {
    await emit({
      ok: true,
      rev: panelRevOf('hud-right'),
      data: { state, foes: sel.foes.map(projFoe) },
      avatarKeys: sel.foes.map(r => r.j).filter(Boolean).map(avKey),
    })
    process.exit(0)
  }
  await emit({ ok: false, error: `未定义面板 ${a.name ?? ''}` }); process.exit(1)
}

console.log(JSON.stringify({
  ok: player !== null, rev: secStat('characters/player.json'),
  player: player ? { ...player, derived: derive(player) } : null,
  companions: sel.mates.map(projMate),
  neutrals: sel.neutrals.map(projMate),
  foes: sel.foes.map(projFoe),
  combat,
  state,
}))
