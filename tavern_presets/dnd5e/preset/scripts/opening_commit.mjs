// opening_commit — 出生生成器(前端 runScript 调用,t=0 唯一非转录写盘道)。
// 输入:创角表单 JSON + 场景 id → 裁剪+查表 → 写 characters/player.json + patch state.md → 返回开场白。
// 契约:docs/design_zh.md §6 · character.tpl.json v10(全字段对照骨架+出生器裁剪)。
// 2026-09-20 用户定案:开局只落主角——同伴/场景 NPC 一律不种档,由 DM 在场内按叙事建档。
// 2026-09-25 成长流定案:创角不再"单薄"——技能按语料白名单校验(选数按职业)、施法者出生
//   即有戏法/首环(缺者服务端 roll 兜底,有者校验)、L1 子职落 subclass、训练面按职业白名单出生、
//   特征回充时机按表(池类才标,非池 |—)、description/backstory 中文组装。
// 2026-09-29 class 派生体抽出 lib/class-build.mjs(buildClass/classHpMax)——本件只留玩家特有面:
//   能力 roll、spells 表单白名单+roll、子职 roll、中文组装、player.json/state.md 写。
// 2026-09-29b 等级入参(ch.level,缺省 1):buildClass/classHpMax/位表/exp/hd 全按出生等级;
//   高等级出生**不**机械随机补历史 ASI——按 ASI 档位表挂 pending,玩家在面板册子逐档点选
//   (front_commit 窄写 + CON 追溯 HP;与 gain_exp 升级挂 pending 同一条闭环)。施法面逐级对表
//   (opening-meta CANTRIPS_BY_LEVEL/knownSpellsAt;准备数=level+施法调整)。
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const core = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { mod, stripEmptyArrays, XP_THRESHOLDS, ASI_LEVELS } = core
const { SPELL_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-core-data.mjs').href)
const { RACE_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/race-core-data.mjs').href)
const { materializeSpellDetails } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-build.mjs').href)
const { CANTRIPS_BY_LEVEL, knownSpellsAt, CLASS_CN, RACE_CN, ALL_SKILL_KEYS } = await import(pathToFileURL(process.cwd() + '/../preset/lib/opening-meta.mjs').href)
const { buildClass, classHpMax } = await import(pathToFileURL(process.cwd() + '/../preset/lib/class-build.mjs').href)
const { personaGate } = await import(pathToFileURL(process.cwd() + '/../preset/lib/persona.mjs').href)

const fail = (m, h) => { console.log(JSON.stringify({ ok: false, error: m, hint: h ?? '' })); process.exit(1) }
const inp = JSON.parse(typeof globalThis.argv?.[0] === 'string' ? globalThis.argv[0] : '{}')
const ch = inp.character
ch?.name || fail('缺 name')
ch?.class || fail('缺 class')
ch?.abilities || fail('缺 abilities')
const cls = ch.class.toLowerCase()
CLASS_CN[cls] || fail(`未知职业 ${cls}`)
// 出生等级(缺省 1——旧入参不传 level 行为逐字节不变):1..20 闸,20=XP/位表/职业表长度上限
const level = ch.level ?? 1
Number.isInteger(level) && level >= 1 && level <= 20 || fail(`level 不合法:${level}`, '出生等级须为 1..20 的整数(本卡口径:XP 表/位表/职业表都开到 20)')
const race = (ch.race ?? 'human').toLowerCase()
const scenarioId = inp.scenario ?? 'goblin-ambush'

// ── 机械层单源:class 派生体走 lib/class-build.mjs(buildClass 出命中骰/豁免小写/技能白名单/施法位/特征/甲武熟练/起装;hp 走 classHpMax)──
const rnd = () => Math.random()
const pick = (arr, n) => {
  const pool = [...arr]
  const out = []
  while (out.length < n && pool.length) out.push(...pool.splice(Math.floor(rnd() * pool.length), 1))
  return out
}

// 种族面数据主路(RACE_CORE 快照,2026-09-30 零 lorebook)→ md 断档回退
const raceFM = RACE_CORE[race]?.fm ?? {}
const c = buildClass(cls, level)   // 特征 L1..level 正向累积+位表整档(机械层一函数,与 spawn_npc 同源)
const isCaster = c.isCaster
const casterAttr = c.caster_attr
const ab = ch.abilities

// ── 技能校验(白名单+选数——表单已按类过滤,此处是机械层最后闸) ──
const chosenSkills = Array.isArray(ch.skills) ? ch.skills : []
const allowedSkills = c.anySkill ? ALL_SKILL_KEYS : c.skillWhitelist
chosenSkills.every(s => allowedSkills.includes(s)) || fail('技能熟练超出职业白名单', `本职业可选:${allowedSkills.join(', ')}`)
chosenSkills.length === c.skillCount || fail(`技能熟练须选 ${c.skillCount} 项(本职业技能选数,非法数 ${chosenSkills.length})`)

// ── 法术:payload 有则校验,无则服务端 roll(表单与机械层双源同表——SPELL_CORE 单源,零 lorebook fs) ──
// 逐级对表:戏法数=CANTRIPS_BY_LEVEL[cls][level-1],已知数=knownSpellsAt(wizard 进书线/cleric·druid 准备制无已知);
// known/prepared 池=本职业 1..maxSlot 联合(SRD:「须为可施环位的法术」;maxSlot 由位表派生)。
function readDirSpells(ring, out) {
  for (const [, e] of Object.entries(SPELL_CORE)) {
    const fm = e.fm ?? e
    if (!fm.name || fm.level !== ring) continue
    const classes = Array.isArray(fm.classes) ? fm.classes.map(c2 => String(c2).toLowerCase()) : []
    if (!classes.includes(cls)) continue
    out.push(String(fm.name))
  }
  return [...new Set(out)].sort()
}
const pool0 = isCaster ? readDirSpells(0, []) : []
const maxSlot = Math.max(0, ...(c.slots ?? []).map((v, i) => (v > 0 ? i + 1 : 0)))
const poolKRaw = []
if (isCaster) for (let l = 1; l <= maxSlot; l++) readDirSpells(l, poolKRaw)
const poolK = [...new Set(poolKRaw)].sort()
const rollFrom = (arr, n) => (arr.length <= n ? [...arr] : pick(arr, n))
let cantrips = [], learned = [], prepared = []
if (isCaster) {
  const wantC = CANTRIPS_BY_LEVEL[cls]?.[level - 1] ?? 0
  const wantK = knownSpellsAt(cls, level) ?? 0
  const inC = Array.isArray(ch.spells?.cantrips) ? ch.spells.cantrips : []
  const inK = Array.isArray(ch.spells?.spells) ? ch.spells.spells : []
  const inP = Array.isArray(ch.spells?.prepared) ? ch.spells.prepared : []
  if (wantC > 0) {
    inC.length ? (inC.length === wantC || fail(`戏法须 ${wantC} 个(得 ${inC.length})`), inC.every(s => pool0.includes(s)) || fail('戏法超出职业表'))
      : (pool0.length || fail(`语料无 ${cls} 的戏法卡——不能出生施法族`))
    cantrips = inC.length ? [...inC] : rollFrom(pool0, wantC)
  }
  if (wantK > 0) {
    inK.length ? (inK.length === wantK || fail(`已知法术须 ${wantK} 个(得 ${inK.length})`), inK.every(s => poolK.includes(s)) || fail('已知法术超出职业表或环位超可施'))
      : (poolK.length || fail(`语料无 ${cls} 的 1..${maxSlot} 环卡——不能出生施法族`))
    learned = inK.length ? [...inK] : rollFrom(poolK, wantK)
  }
  if (['cleric', 'druid', 'paladin', 'ranger'].includes(cls) && maxSlot > 0) {
    // 准备制:整表备选,准备数=职业等级+施法属性调整值(SRD;1 级=1+调整与旧口径一致)——roll 满额默认表,长休整表可换。
    // 准备制四职(SRD 准备施法族;半施法圣骑士/游侠 L2 起才有施法——L1 maxSlot=0 不进此支,重生无施法面是正确行为)
    const wantP = level + Math.max(mod(ab[casterAttr] ?? 10), 0)
    const pEff = Math.min(wantP, poolK.length)
    inP.length ? (inP.length === pEff || fail(`已准备须 ${pEff} 个(等级+施法调整,受语料池上限)、得 ${inP.length}`), inP.every(s => poolK.includes(s)) || fail('已准备超出本职业语料或环位超可施'))
      : (poolK.length || fail(`语料无 ${cls} 的 1..${maxSlot} 环卡——不能出生准备制`))
    prepared = inP.length ? [...inP] : rollFrom(poolK, pEff)
  }
}

// ── 子职业:已到分岔级者必落(表单给出/服务端 roll),未分岔 null(classHpMax 的子职加成依赖此解)──
const subAt = c.subclass_level
const subList = c.subclass_list
let subclass = null
if (subAt <= level) {
  const inSub = typeof ch.subclass === 'string' && ch.subclass ? ch.subclass : null
  if (inSub !== null) (subList.includes(inSub) || fail(`子职业 ${inSub} 不在本职业语料清单`))
  subclass = inSub ?? (subList.length ? pick(subList, 1)[0] : null)
}

// ── HP/HP上限(class 公式;Draconic Resilience 每级 +1 在 classHpMax 内;**基础 con**——
//    历史 ASI 由玩家点选,front_commit 的 CON 追溯按 level×调整增量补齐,与 classHpMax 逐级线性严格一致) ──
const hpMax = classHpMax(cls, c.hit_die, ab.con, level, subclass)

// ── 装备(12 职业全表) ──
const eq = c.equipment ?? fail(`起装表缺 ${cls}`)

// ── 施法族(仅施法职业;位表整档按等级直落;spell_details=档案自含全文) ──
// 戏法并册(2026-09-30 翻案):spells_known 一张名单,0 环+环术同册——与 NPC 口径(spawn_npc「0 环归
// spells_known」)、官方纸卡(同表 0 环行竖标 cantrips)、原型正本(hud-proto-grow mock)三方对齐;
// 戏法行/法术行拆分是展示层投影(ui_data splitSpells 按卡 level:0 拆)。
const slots = Object.fromEntries((c.slots ?? []).map((v, i) => [`slots_l${i + 1}`, v]))
const spellDetails = materializeSpellDetails([...cantrips, ...learned, ...prepared])
const casterFields = isCaster
  ? {
      caster_attr: casterAttr,
      spells_known: [...cantrips, ...learned].sort(), spells_prepared: prepared,
      ...(spellDetails.length ? { spell_details: spellDetails } : {}),
      concentrating: null, ...slots,
    }
  : {}

// ── 特征(职业 L1 特征行)——回充时机按表,非池 |— 不造伪池 ──
const features = c.features

// ── 训练面(职业 Proficiencies 白给的) ──
const armors = c.armor_prof
const weaponsArr = c.weapon_prof

// ── 人设三层(2026-09-30,persona-threelayer_zh.md 定案 1):persona 七键照表单落——形量硬闸与
//    同伴四件必填复用 lib/persona.mjs(PC=长线人物;空串=缺席,可选键不硬拦);history[0]=玩家写
//    的履历首行(旧 backstory 死通道以别名收编);description=出生现况(身份+底色),此后随
//    history 追加同拍刷新(维护面=maintenancePrompt,组装句退役)。 ──
const clsCn = CLASS_CN[cls] ?? cls
const raceCn = RACE_CN[race] ?? race
const personaIn = typeof ch.persona === 'object' && ch.persona
  ? Object.fromEntries(Object.entries(ch.persona).filter(([, v]) => typeof v === 'string' && v.trim()))
  : undefined
const pg = personaGate({ persona: personaIn, history: ch.history ?? ch.backstory, description: undefined }, { role: 'companion', requireHistory: false })
// 人设闸账本化(2026-09-30):errors 聚合空跳;非空 fail(join——出生面此处无写盘,清账点安全)
pg.errors.length && fail(pg.errors.join(' / '))
const description = `${raceCn} ${clsCn}——${pg.persona?.lens ?? '来历各异的冒险新手'}`

// ── 历史 ASI pending(2026-09-29b):高等级出生该有的属性提升不机械随机补——逐档挂待办,
//    玩家在面板册子 Ability Scores 节逐档点选(恰 2 点/上限 20/CON 追溯——front_commit 既有闸全适用);
//    字符串与 gain_exp 升级 pending 严格同格式(LVn·ASI 点选)。 ──
const asiPend = (ASI_LEVELS[cls] ?? ASI_LEVELS.default).filter(l => l <= level).map(l => `LV${l}·ASI 点选`)

const panel = {
  name: ch.name,
  gender: ['male', 'female', 'unknown'].includes(ch.gender ?? '') ? ch.gender : 'unknown',
  description,
  role: 'pc',
  class: cls, subclass, level, exp: XP_THRESHOLDS[level - 1] ?? 0,
  race: race,
  hp: hpMax, hp_max: hpMax, temp_hp: 0,
  hd_available: level, exhaustion: 0,
  gp: eq.gp, sp: eq.sp, cp: eq.cp,
  armor: eq.armor ?? '', shield: eq.shield === true,
  speed: raceFM.speed ?? 30, darkvision: raceFM.darkvision ?? null,
  str: ab.str ?? 10, dex: ab.dex ?? 10, con: ab.con ?? 10, int: ab.int ?? 10, wis: ab.wis ?? 10, cha: ab.cha ?? 8,
  save_prof: c.save_prof,
  skill_prof: chosenSkills,
  expertise: [], armor_prof: armors, weapon_prof: weaponsArr, tool_prof: [],
  languages: raceFM.languages ?? ['Common'],
  resist: raceFM.resist ?? [], immune: [],
  ...casterFields,
  features: features,
  ...(c.feature_details?.length ? { feature_details: c.feature_details } : {}),
  pending: asiPend, statuses: {},
  persona: pg.persona,
  ...(pg.history ? { history: [pg.history] } : {}),
  weapons: [eq.weapon], gear: eq.gear,
}

// ── 写玩家面板 ──
mkdirSync('characters', { recursive: true })  // 种子无此目录（角色未出生时 runtime/ 无 characters/）——t0 首建
// ── 裁剪律落地（模板 _tpl：没有什么能力就没有相关字段；stripEmptyArrays 单源 core.mjs）──
writeFileSync(`characters/player.json`, JSON.stringify(stripEmptyArrays(panel), null, 1))

// ── patch state.md ──
let OPENINGS
try { OPENINGS = JSON.parse(readFileSync('openings.json', 'utf8')) } catch { }
if (!OPENINGS) { try { OPENINGS = JSON.parse(readFileSync('../preset/setup/openings.json', 'utf8')) } catch { } }
const scenario = (OPENINGS?.scenarios ?? []).find(s => s.id === scenarioId) ?? {}
const st = scenario.state ?? {}

let stateMd = existsSync('state.md') ? readFileSync('state.md', 'utf8') : ''
stateMd = stateMd.replace(/(## 时间\n)- 当前时间：.*/, '$1- 当前时间：第1日·18时00分')
stateMd = stateMd.replace(/(## 地点\n)[\s\S]*?(?=\n## |$)/, `$1`
  + `- 地点ID：${st.地点ID ?? ''}\n`
  + `- 地点名：${st.地点名 ?? st.地点 ?? st.所在 ?? '凡戴尔镇外'}`)
stateMd = stateMd.replace(/(## 天气\n)[\s\S]*?(?=\n## |$)/, `$1- ${st.天气 ?? '晨雾'}`)
stateMd = stateMd.replace(/(## 地形\n)[\s\S]*?(?=\n## |$)/, `$1- ${st.地形 ?? '缓丘'}`)
writeFileSync('state.md', stateMd)

// ── 返回开场白 ──
const narration = inp.narration ?? scenario.narration ?? '冒险开始了。'
okR({
  narration, scenario: scenarioId, who: ch.name,
  rolled: { level, asi_pend: asiPend.length, cantrips, spells: learned, prepared, subclass, skills: chosenSkills },   // 回执可考——开场白之外的 roll 全透明
})
function okR(r) { console.log(JSON.stringify({ ok: true, ...r })) }