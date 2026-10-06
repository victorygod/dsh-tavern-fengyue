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

// ── 开局同伴种子(2026-10-05 dnd5e-combat):两名结伴 NPC——精灵女游侠 艾琳 + 人类女牧师 莉拉 ──
const COMPANION_SEEDS = [
  {
    name: '艾琳', race: 'elf', gender: 'female', class: 'ranger', subclass: 'Hunter', level: 3,
    abilities: { str: 10, dex: 15, con: 13, int: 12, wis: 14, cha: 8 },
    skills: ['perception', 'stealth', 'survival'],
    spells_known: ["Hunter's Mark", 'Cure Wounds', 'Goodberry'],
    persona: {
      appearance: '银白长发编成单条长辫垂到腰际，发间缀着几片风干的槲寄生叶；浅灰绿的眼睛像雾中苔原，看人时微微眯起，左眉骨一道极细的旧箭疤。身形精瘦，披一件洗得发白的墨绿斗篷，内里是深色软皮甲，腰上挂着短弓和一柄带豁口的猎刀，靴帮沾着洗不掉的山泥。',
      lens: '把世界看成一整片彼此相连的森林——每只鸟、每个脚印、每句谎话都长在某个根上，顺着根就能摸到真相。她不信偶然，只信痕迹。',
      reaction: '日常：话不多但接得住话，与人保持半步距离，却默默记住同行者提过的喜好；宿营时会无声地修好别人漏看的马具、补好裂开的箭羽。冒险：进陌生地形先找高处、辨风向、记退路；对陷阱和伏击有近乎本能的不安，总走在队伍外圈。战斗：冷静到近乎冷酷，先射对方的弓手和施法者；同伴有难会一声不吭扑上去挡，事后轻描淡写带过。情感：把在意藏进行动，不擅言辞；被戳破关心会耳朵发红、用「顺手」搪塞；对背叛有极深的旧伤，信任一旦被辜负，就沉默地走远，很难再回头。',
      voice: '嗓音偏低、语速慢，像在陈述事实；句尾常带一个轻轻向上的「……是吧」；喊「小心」时声音会突然拔高；偶尔冒出一句精灵语式的古雅措辞（「风从东边来，带着铁锈味」）。',
      never: '不猎杀怀着幼崽的野兽；不出卖同行者——哪怕对方先背叛，她也只会离开，绝不设局；不碰腐坏的尸体与死灵法术。',
      tension: '向往安稳定居，却总在下一个岔路口找出「非走不可」的理由；对森林有近乎宗教的眷恋，又对放逐自己的那场火灾闭口不谈；渴望被理解，却把软肋都编进一句「我没事」里。',
      alignment: '混乱善良',
    },
    history: '精灵部族的巡林长女，部族森林毁于一场来路不明的夜火，追着箭尾标记离乡做了游侠；[秘]那夜她没能叫醒的人里，有她亲手送走的婚约者。',
    description: '追查故乡大火的精灵游侠，正与主角结伴护送物资去凡戴尔镇。',
  },
  {
    name: '莉拉', race: 'human', gender: 'female', class: 'cleric', subclass: 'Life', level: 3,
    abilities: { str: 13, dex: 8, con: 14, int: 10, wis: 15, cha: 12 },
    skills: ['medicine', 'insight'],
    spells_known: ['Sacred Flame', 'Spare the Dying', 'Guidance', 'Cure Wounds', 'Healing Word', 'Bless', 'Guiding Bolt', 'Prayer of Healing', 'Lesser Restoration'],
    persona: {
      appearance: '一头蓬松的浅金色卷发挽在耳后，用一条褪色的蓝丝带系着，几缕碎发总在额前飘；眼睛是暖褐色，看人时像在笑；脸颊上有几粒淡雀斑。身形丰润，罩一件朴素的米白祭司袍，领口别着一枚小小的日轮圣徽，腰间挎一个鼓鼓囊囊的草药包，袖口和裙摆沾着洗不掉的药渍与旅途尘泥。',
      lens: '把每个人都看成一颗需要照料的种子——伤口会好、心结会解、天总会亮，只要有人愿意蹲下来，耐心地陪一会儿。她相信善良是要动手去做的，光说不算数。',
      reaction: '日常：热络又爱操心，会追着人问「吃了吗」「睡了吗」，把所有人的冷暖记在心上；见人皱眉就伸手探额头。冒险：胆子不大但见不得人疼，越是危险越往伤员身边靠；对黑暗和死灵有本能的厌恶。战斗：不冲锋陷阵，躲在后面给队友挂祝福、驱散伤痛，嘴里念着祈祷；看到有人倒下会不顾一切冲过去。情感：温柔到近乎啰嗦，把「没事的」挂在嘴边；其实自己藏着一段没愈合的往事，越疼越想先安慰别人。',
      voice: '嗓音柔和、语速不紧不慢，像在哄人；说话爱用「乖」「别怕」；紧张时语速会加快，祈祷时会不自觉地放轻；口头禅是「有我在」和「会好起来的」。',
      never: '见死不救（哪怕对方是敌人，倒下后也会止血包扎）；不滥用神术去惩罚或报复；不替别人决定「什么对他最好」。',
      tension: '拼命照顾所有人，却拒绝被任何人照顾；对「救不回来的人」有解不开的愧疚，那串没念完的祷词是她的旧伤；渴望被需要，又害怕自己只是「有用的工具」而非「被爱的人」。',
      alignment: '中立善良',
    },
    history: '边陲小庙里跟着老祭司长大的孤女，老祭司死于一场瘟疫，她接过圣徽与草药包，一路行医济世；[秘]那场瘟疫本不会夺走老祭司，是有人偷走了最后一剂药。',
    description: '四处行医的人类女祭司，正与主角结伴护送物资去凡戴尔镇。',
  },
]
function seedCompanions() {
  return COMPANION_SEEDS.map(s => {
  const c = buildClass(s.class, s.level)
  const hpMax = classHpMax(s.class, c.hit_die, s.abilities.con, s.level, s.subclass)
  const raceFM = RACE_CORE[s.race]?.fm ?? {}
  const eq = c.equipment ?? {}
  const spellDetails = materializeSpellDetails(s.spells_known)
  const j = stripEmptyArrays({
    name: s.name, role: 'companion',
    class: s.class, subclass: s.subclass, level: s.level,
    hp: hpMax, hp_max: hpMax, exp: XP_THRESHOLDS[s.level - 1] ?? 0, hd_available: s.level,
    str: s.abilities.str, dex: s.abilities.dex, con: s.abilities.con, int: s.abilities.int, wis: s.abilities.wis, cha: s.abilities.cha,
    save_prof: c.save_prof, skill_prof: s.skills,
    ...(c.feature_details?.length ? { feature_details: c.feature_details } : {}),
    armor_prof: c.armor_prof, weapon_prof: c.weapon_prof,
    features: c.features,
    caster_attr: c.caster_attr, spells_known: s.spells_known, ...(spellDetails.length ? { spell_details: spellDetails } : {}), concentrating: null,
    ...Object.fromEntries((c.slots ?? []).map((v, i) => [`slots_l${i + 1}`, v])),
    race: s.race, gender: s.gender,
    ...(raceFM.speed ? { speed: raceFM.speed } : {}), ...(raceFM.darkvision ? { darkvision: raceFM.darkvision } : {}), ...(raceFM.languages ? { languages: raceFM.languages } : {}), ...(raceFM.resist ? { resist: raceFM.resist } : {}),
    weapons: [eq.weapon], ...(Array.isArray(eq.gear) && eq.gear.length ? { gear: eq.gear } : {}),
    gp: eq.gp ?? 0, sp: eq.sp ?? 0, cp: eq.cp ?? 0,
    persona: s.persona, history: [s.history], description: s.description,
    pending: [], statuses: {},
  })
    writeFileSync(`characters/${s.name}.json`, JSON.stringify(j, null, 1))
    return s.name
  })
}
const companionNames = seedCompanions()

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
stateMd = stateMd.replace(/(## 附近 NPC[^\n]*\n)[\s\S]*?(?=\n## |$)/, `$1${companionNames.map(n => `- ${n} | 同伴`).join('\n')}`)
writeFileSync('state.md', stateMd)

// ── 返回开场白 ──
const narration = inp.narration ?? scenario.narration ?? '冒险开始了。'
okR({
  narration, scenario: scenarioId, who: ch.name,
  rolled: { level, asi_pend: asiPend.length, cantrips, spells: learned, prepared, subclass, skills: chosenSkills },   // 回执可考——开场白之外的 roll 全透明
})
function okR(r) { console.log(JSON.stringify({ ok: true, ...r })) }