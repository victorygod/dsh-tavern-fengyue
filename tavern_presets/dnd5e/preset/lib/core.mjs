// core.mjs — 卡工具共享件（消费者=8 工具,YAGNI 外提条件达成 2026-09-19）。
// 工具经 file:// 绝对引用本件（data-module 相对 import 不可达;cwd=runtime→../preset/lib 可达）。
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { randomInt } from 'node:crypto'
import { validateStatuses } from './status.mjs'
import { EQ_CORE } from './equip-core-data.mjs'
import { CLASS_CORE } from './class-core-data.mjs'

let _seed = null
export function setSeed(s) { _seed = s >>> 0 }
export function rnd(max) { // 1..max
  if (_seed !== null) { _seed = (1103515245 * _seed + 12345) % 2147483648; return (_seed % max) + 1 }
  return randomInt(1, max + 1)
}
export function rollExpr(expr) { // '2d6+3' → {dice:[..], mod, total}
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(expr).replace(/\s/g, ''))
  if (!m) return null
  const dice = Array.from({ length: +m[1] }, () => rnd(+m[2]))
  const mod = m[3] ? +m[3] : 0
  return { dice, mod, total: dice.reduce((a, b) => a + b, 0) + mod }
}
// 多用升骰映射(2026-10-04 武器机械进工具):versatile 双手握持时骰面 +2 档(d6→d8/d8→d10)。
export const VERSATILE_UP = { 6: 8, 8: 10 }
// GWF 重掷(2026-10-04 巨武战斗进工具):双手握持近战武器伤害骰,1/2 重掷一次(必须用新值,新值仍 1/2 也认)。
// 与 rollExpr 同形多回 rerolled(是否真发生过重掷,供回执标注不虚标);seed 可重放(重掷也吃 rnd,单测钉)。
// 仅武器伤害骰调用(主骰+凶蛮暴击追加),附伤骑手/神圣打击/extra_dice 不调。
export function rollGreatWeapon(expr) {
  const m = /^(\d+)d(\d+)([+-]\d+)?$/.exec(String(expr).replace(/\s/g, ''))
  if (!m) return null
  const dice = Array.from({ length: +m[1] }, () => rnd(+m[2]))
  let rerolled = false
  for (let i = 0; i < dice.length; i++) if (dice[i] <= 2) { dice[i] = rnd(+m[2]); rerolled = true }
  const mod = m[3] ? +m[3] : 0
  return { dice, mod, total: dice.reduce((a, b) => a + b, 0) + mod, rerolled }
}
export const mod = (stat) => Math.floor((stat - 10) / 2)
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

// 特征判据(2026-10-03):j.features 行「名(级变)|回充|已用N」是否含某特征——按基础名比对
// (剥「|回充|已用」与「(级变)」括注,大小写不敏)。战斗机制进工具的地基:被动特征由工具按此自检,
// 无需 LLM 读特征文本心算(机械进工具)。如 hasFeature(j, 'unarmored defense')。
export function hasFeature(j, name) {
  const base = String(name).toLowerCase().split('(')[0].split(':')[0].trim()
  return (j?.features ?? []).some(f => {
    const s = String(f).split('|')[0].trim().toLowerCase().split('(')[0].split(':')[0].trim()
    return s === base
  })
}

// ── 附近 NPC 三态名单(2026-09-30 stance 回锅:在场关系快照——三态列驱动前端分区/注入标注;
//    行式 `- 名 | 同伴/中立/敌对`,兼容读单列旧行=中立(敌对必须显式))──
// 名单=唯一在场真源(v4,2026-09-25);无 role 兜底(漏更=漏);消费者:get_npc_state(注入)与 ui_data(前端泵)。
export function presence() {
  const rows = []
  try {
    const md = readFileSync('state.md', 'utf8')
    const m = /## 附近 NPC[^\n]*\n([\s\S]*?)(?=\n## |$)/.exec(md)
    const seen = new Set()
    for (const l of (m?.[1] ?? '').split('\n')) {
      const t = /^-\s*([^|]+?)\s*(?:\|\s*(同伴|中立|敌对))?\s*$/.exec(l.trim())
      if (!t?.[1]) continue
      const nm = t[1].trim()
      if (nm === '（无）' || seen.has(nm)) continue   // 占位行跳过;同名重复行=首行胜出(行序即注入序,新登场在前)
      seen.add(nm)
      rows.push({ name: nm, stance: t[2] ?? '中立' })   // 单列旧行=中立
    }
  } catch { /* 无 state.md → 空名单 */ }
  // 行在而档缺/坏 → j=null(消费方示警勿采信——裂缝可见,不静默吞);同名读到即去重(见上),行序即注入序。
  const pools = { mates: [], neutrals: [], foes: [] }
  for (const r of rows) {
    const file = `characters/${r.name}.json`
    let j = null
    try { j = JSON.parse(readFileSync(file, 'utf8')) } catch { /* 缺档/损坏 → null */ }
    pools[r.stance === '同伴' ? 'mates' : r.stance === '敌对' ? 'foes' : 'neutrals'].push({ ...r, file, j })
  }
  return pools
}

const coerce = (v) => {
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v)
  if (v === 'true') return true; if (v === 'false') return false
  return v.replace(/^"|"$/g, '')
}

// statusesMod 旧正则通道(解析 effect 文本 'dex+2' 式)已于 2026-09-28 审计批退役——mods 结构化通道
// (statMods/rollMods)为唯一读口,展示文案不再承载机械语义(误读旧通道=检查/攻击两处分叉的暗渠)。
export const SKILL_STAT = { acrobatics:'dex', animal_handling:'wis', arcana:'int', athletics:'str', deception:'cha', history:'int', insight:'wis', intimidation:'cha', investigation:'int', medicine:'wis', nature:'int', perception:'wis', performance:'cha', persuasion:'cha', religion:'int', sleight_of_hand:'dex', stealth:'dex', survival:'wis' }
export function toCp(str) {
  const s = String(str).trim()
  if (/^\d+$/.test(s)) return +s
  let cp = 0, m; const re = /(\d+)\s*(pp|gp|ep|sp|cp)/g
  while ((m = re.exec(s))) cp += +m[1] * ({ pp: 1000, gp: 100, ep: 50, sp: 10, cp: 1 }[m[2]] ?? 0)
  return cp
}
export const normWallet = (cp) => ({ gp: Math.floor(cp / 100), sp: Math.floor((cp % 100) / 10), cp: cp % 10 })

// 常用武器/护甲 中文名→equipment slug（语料为英文名;开 committed 面板存中文名时的桥）。
// 弩系三值对齐 EQ 键(crossbow-hand/-light/-heavy,2026-09-30 修——旧值 hand/light/heavy-crossbow 全查无);
// 镰刀/长杖/木棍 补齐(PROF_WEAPON druid/sorcerer/wizard 在役文档,桥接前全查无)。
export const WEAPON_SLUG = { '短剑':'shortsword','长剑':'longsword','短弓':'shortbow','长弓':'longbow','匕首':'dagger','手斧':'handaxe','战斧':'battleaxe','巨斧':'greataxe','巨剑':'greatsword','长枪':'spear','木棒':'club','木棍':'club','钉锤':'mace','战锤':'warhammer','弯刀':'scimitar','细剑':'rapier','矛':'spear','三叉戟':'trident','链枷':'flail','战镐':'war-pick','连枷':'flail','镰刀':'sickle','长杖':'quarterstaff','轻弩':'crossbow-light','重弩':'crossbow-heavy','手弩':'crossbow-hand','飞镖':'dart','投石索':'sling','标枪':'javelin','大棒':'greatclub' }
export const ARMOR_SLUG = { '镶钉皮甲':'studded-leather-armor','皮甲':'leather-armor','皮甲（镶钉）':'studded-leather-armor','链甲':'chain-mail','链甲衫':'chain-shirt','板甲':'plate-armor','板条甲':'splint-armor','鳞甲':'scale-mail','胸甲':'breastplate','半板甲':'half-plate-armor','环甲':'ring-mail','兽皮甲':'hide-armor','填棉甲':'padded-armor' }
export const slugify = (en) => en.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
// slugify 产物的别名兜底(EN 别名 'hand crossbow' 类输入;EQ 键是 'Crossbow, hand' 逗号形)
export const SLUG_ALIAS = { 'hand-crossbow': 'crossbow-hand', 'light-crossbow': 'crossbow-light', 'heavy-crossbow': 'crossbow-heavy' }
export function equipmentFM(name) {
  const raw = WEAPON_SLUG[name] ?? ARMOR_SLUG[name] ?? slugify(name)
  const slug = SLUG_ALIAS[raw] ?? raw
  // 纯数据(EQ_CORE 快照,2026-09-30——attack/deriveAC 零 lorebook 零回退);查无即 null
  return EQ_CORE[slug] ? { ...EQ_CORE[slug].fm, path: `equipment/${slug}.md` } : null
}

// ── 目标结算解析咽喉(2026-09-25:attack/cast 共一,斩静默默值——事故:梅西雅存 player.json,
//    attack 手写 existsSync('characters/梅西雅.json') 落空 → AC 静默留 10)──
// 失败策略归调用方:此处一律返回 null,由工具 err() 逼 DM 补敌行/建档/转写,绝不涂默认值。
// statuses 机械面统一读口(2026-09-28):任何最终值=基础计算+Σ statMods(j,stat)。消费面渐开(ac/attack/damage/…),读口唯一,无 per-stat 特权。
// statuses 形态=对象 map,key=状态名,value={applied_at, effect?, mods?:[{stat,magnitude}]}——applied_at 由 agent 手写(时间真相在叙事,非 state.md 尾代延迟落盘)。
export function statMods(j, stat) {
  return Object.values(j.statuses ?? {}).flatMap(s => Array.isArray(s?.mods) ? s.mods.filter(m => m?.stat === stat) : [])
}
// statuses 机械修正**掷算**口(2026-09-28 审计批,B1 单源):把 mods 条目折成一个数——数值直加、
// 骰式每次独立掷(bless 1d4 每掷一枚)。消费面=attack 攻检/伤害侧、cast 攻检侧、豁免侧(resolveSave/check)。
// doubleDice=true 时骰式骑手掷两次加总(RAW:暴击翻伤害骰,附伤骑手同翻;定值不翻)。parts 带状态名出处——回执可见性
// (agent 视野内可判「谁在生效」,而非干净得像没有这回事)。同名对象表天然去重,条目名直接进 parts。
export function rollMods(j, stats, doubleDice = false) {
  const wanted = Array.isArray(stats) ? stats : [stats]
  let flat = 0; const parts = []
  for (const [nm, stv] of Object.entries(j.statuses ?? {})) {
    for (const m of Array.isArray(stv?.mods) ? stv.mods : []) {
      if (!wanted.includes(m.stat)) continue
      const mag = String(m.magnitude ?? '')
      if (/^-?\d+d\d+$/.test(mag)) {
        let v = 0
        for (let i = 0; i < (doubleDice ? 2 : 1); i++) { const r = rollExpr(mag.replace('-', '')) || err(`!骰式不合法:${mag}`); v += r.total }
        if (mag.startsWith('-')) v = -v
        flat += v; parts.push(`${nm}:${mag}${doubleDice ? '×2' : ''}=${v}`)
      }
      else if (Number.isFinite(+mag)) { flat += +mag; parts.push(`${nm}:${+mag >= 0 ? '+' + mag : mag}`) }
    }
  }
  return { flat, parts }
}
export function deriveAC(j, skipBuffs = false) {
  // AC 律单源(原 ui_data 与 attack 各持一份「同律」注释,分叉即 bug 温床):
  // ac_dex_bonus:true=加敏(带 cap 取 min);键缺席=重甲定值。dex 缺席且需敏 → null
  // (展示层按 ??? 消费;结算层 err 逼 DM 转写)。中文名甲走 equipmentFM 桥。
  // AC 的 buff 侧=statMods('ac') 一行——非专属机制;skipBuffs=基值视图(ui_data 最终(基) 展示)。
  const dexM = j.dex == null ? null : mod(j.dex)
  let ac = dexM == null ? null : 10 + dexM
  if (!j.armor) {
    // 无甲被动特征(2026-10-03 战斗机制进工具):无甲时按特征改 AC 底——barbarian 10+敏+体/monk 10+敏+感/
    // draconic resilience 13+敏。有甲则走甲 AC,不叠加。
    const uad = hasFeature(j, 'unarmored defense')
    const dra = hasFeature(j, 'draconic resilience')
    if (uad || dra) {
      const cls = String(j.class ?? '').toLowerCase()
      if (dra && !uad) ac = dexM == null ? null : 13 + dexM
      else if (cls === 'monk') ac = dexM == null ? null : 10 + dexM + mod(j.wis ?? 10)
      else ac = dexM == null ? null : 10 + dexM + mod(j.con ?? 10)
    }
  }
  if (j.armor) {
    const fm = equipmentFM(j.armor)
    if (fm) ac = fm.ac_dex_bonus === true ? (dexM == null ? null : fm.ac_base + (fm.ac_dex_cap ? Math.min(dexM, fm.ac_dex_cap) : dexM)) : fm.ac_base
  }
  if (ac != null && (j.shield === true || j.shield === 'true')) ac += 2
  if (ac != null && j.fighting_style === 'defense' && j.armor) ac += 1   // 战斗风格·防御(穿甲 AC+1,2026-10-03)
  if (ac != null && !skipBuffs) for (const m of statMods(j, 'ac')) if (Number.isFinite(+m.magnitude)) ac += +m.magnitude
  return ac
}
export function resolveTarget(target) {
  // 敌行瘦身后(2026-09-26):行只供身份与 path 溯源,数值一律走档(完备律:参战者必有档)。
  // 扩展回传 file/j——结算件当拍写的读侧全量入口。0HP 分叉键=role==='pc'(2026-09-28 定案濒死豁免玩家专属:
  // 同伴/npc/怪一律 0HP 即死;exp 成长面只归 gain_exp 的 XP 闸,不再喂 0HP 分叉——growth 字段随之废除)。
  const f = findCharFile(target)
  if (!f) return null
  const j = JSON.parse(readFileSync(f, 'utf8'))
  return { file: f, j, ac: j.ac ?? deriveAC(j), resist: j.resist ?? [], immune: j.immune ?? [], vuln: j.vulnerabilities ?? [], source: f }
}
// 豁免加值解析(2026-09-28 审计批升级,B1):目标侧 statuses 的 save/attack_save 双通道进豁免值
// (bless 之 d4 从此豁免有效——白名单承诺的读者迟到补上);parts 供回执「状态修正」行(骰式每掷独立)。
export function resolveSave(target, save) {
  const f = findCharFile(target)
  if (!f) return null
  const j = JSON.parse(readFileSync(f, 'utf8'))
  const bm = rollMods(j, ['save', 'attack_save'])
  return { bonus: mod(j[save] ?? 10) + ((j.save_prof ?? []).includes(save) ? pbOf(j.level ?? 1) : 0) + bm.flat, parts: bm.parts, file: f, j }
}
// 0HP 受击统一落败通道(2026-09-28:濒死豁免玩家专属——attack/cast/damage/hp_change 四件同律单源，
// 同律注释分叉即 bug 温床故收 core；判词全库一语「三败——死亡(终局)」由各件回执说出口)。
// 稳定者(success>=3)先清 success 重开濒死(RAW:受新伤害即失稳定)；crit=暴击源(nat20 或濒死自动暴击)则败+2,否则+1；满三=dead。
export function deathHitFail(j, crit = false) {
  const stab = (j.death_success ?? 0) >= 3
  const f0 = j.death_fail ?? 0
  if (stab) j.death_success = 0 // 稳定打破：重开濒死,败从当前+1起算
  j.death_fail = Math.min(3, f0 + (crit ? 2 : 1))
  return { stab, f0, f1: j.death_fail, dead: j.death_fail >= 3 }
}
// 死亡结算提醒(2026-10-04):非 PC 敌人(npc)即死时,挤出 DM 需落账的三件套机械事实,并点名对应工具——
// 经验=xpOf(level,与 foes 战果通道同源)→gain_exp·钱款=档 gp/sp/cp→gain_money·掉落=档 gear→update_inventory。
// 只产回执不落账;同伴(companion)阵亡=损失非战利品、PC 走濒死→三败,均不产本提醒;空串=无事可结。
export function deathSettleLine(j) {
  if ((j.role ?? '') !== 'npc') return ''
  const parts = [], tools = []
  const cr = j.level ?? j.cr
  const xp = xpOf(cr)
  if (xp != null) { parts.push(`经验 ${xp} XP(${j.monster_kind != null ? 'CR ' + cr : 'LV ' + cr})`); tools.push('gain_exp') }
  const coins = [['gp', j.gp], ['sp', j.sp], ['cp', j.cp]].filter(([, v]) => Number(v) > 0).map(([k, v]) => `${k.toUpperCase()} ${v}`)
  if (coins.length) { parts.push(`钱款 ${coins.join(' · ')}`); tools.push('gain_money') }
  const gear = Array.isArray(j.gear) ? j.gear.filter(Boolean) : []
  if (gear.length) { parts.push(`掉落 ${gear.join('、')}`); tools.push('update_inventory') }
  if (!parts.length) return ''
  return `  ◇ 死亡结算待办: 立刻调 ${tools.join(' / ')} 结算\n  ◇ 结算明细: ${parts.join(' · ')}`
}
// 专注断链当拍级联(2026-09-28 audit-fixes §7 定案 F 线):判词即写——判定件零写盘律的唯一显式例外。
// 孤儿 statuses 条目是工具读域,回合尾弱清理=每次掷骰被过期 bless 污染(§3.1 自立法的既案)。
// 幂等:concentrating 空→返回空;扫描 characters 全档删键名全等于 concentrating 的条目(含施法者自身),坏档跳过不炸。
export function dropConcentration(casterName) {
  const f = findCharFile(casterName)
  if (!f) return { old: null, removed: [] }
  let cj
  try { cj = JSON.parse(readFileSync(f, 'utf8')) } catch { return { old: null, removed: [] } }
  const conc = cj.concentrating
  if (!conc) return { old: null, removed: [] }
  const removed = []
  for (const cf of readdirSync('characters').filter(x => x.endsWith('.json'))) {
    const pf = `characters/${cf}`
    try {
      const j = JSON.parse(readFileSync(pf, 'utf8'))
      if (j.statuses && typeof j.statuses === 'object' && !Array.isArray(j.statuses) && conc in j.statuses) {
        delete j.statuses[conc]
        saveChar(pf, j)
        removed.push({ file: pf, key: conc, name: j.name ?? cf.replace(/\.json$/, '') })
      }
    } catch {}
  }
  cj.concentrating = null
  saveChar(f, cj)
  return { old: conc, removed, casterFile: f }
}
// 临时生命(2026-09-28 audit-fixes §6 H 线 —— RAW 独立缓冲池版,用户裁定 A):
// 载体=temp_hp 独立键(RAW "aren't actual hit points; buffer against damage; separate from actual, can exceed max")。
// grantTemp=取高不叠(RAW "12 or 10, not 22"),只写 temp_hp+statuses 记录,不动 hp/hp_max。injure=受伤先扣临时,剩余扣真 hp。
// 到期回收=temp_hp 归零+删 temp 条目(取高不叠保证单值,零多来源问题)——由 rest 长休/尾代执行,勿动 hp/hp_max(独立池)。
export function grantTemp(j, name, N, appliedAt, effect) {
  const cur = j.temp_hp ?? 0
  if (N <= cur) return { delta: 0, note: `已有临时生命 ${cur}≥${N}，不叠` }
  j.temp_hp = N
  const st = (j.statuses && !Array.isArray(j.statuses)) ? { ...j.statuses } : {}
  const out = {}
  for (const [k, v] of Object.entries(st)) if (!(v?.temp)) out[k] = v
  out[name] = { applied_at: appliedAt, effect, temp: N }
  j.statuses = out
  return { delta: N - cur, note: `临时生命+${N}` }
}
// 受伤统一入口(RAW 独立缓冲池):先扣 temp_hp,剩余扣真 hp——六条扣血通道共用,先扣临时的 RAW 语义一处收口。
export function injure(j, dmg) {
  const d = Math.max(0, dmg)
  const tmp = j.temp_hp ?? 0
  const absorbed = Math.min(tmp, d)
  j.temp_hp = tmp - absorbed
  const real = d - absorbed
  const before = j.hp ?? 0
  j.hp = Math.max(0, before - real)
  return { absorbed, real, before, after: j.hp }
}
// 消费型状态(bardic inspiration 持有 d6 用掉即摘,2026-09-28 F2):读 on_use 骰式删条目,返回骰式供掷点侧消费。
export function consumeBonus(j, key) {
  const st = j.statuses ?? {}
  const entry = st[key]
  if (!entry || !entry.on_use) return null
  delete st[key]
  j.statuses = st
  return String(entry.on_use)
}

// PHB XP 阈值表（PHB「Beyond 1st Level」，2014；dm-loop §6.1 校对锚 [BR p.13]）：
// 下标=等级-1，值=到达该等级所需累计 XP；355000 顶到 20 级。单一事实源——gain_exp 与 ui_data 面板共用。
export const XP_THRESHOLDS = [0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000]

// ASI(属性值提升)档位表(PHB 职业表;2026-09-29 从 gain_exp 内联迁单源)——fighter/rogue 多两档。
// 消费者=gain_exp 升级 pending 标记 + class-build.applyAsiGrowth(class-NPC 出生历史成长)。
export const ASI_LEVELS = { fighter: [4, 6, 8, 12, 14, 16, 19], rogue: [4, 8, 10, 12, 16, 19], commoner: [], default: [4, 8, 12, 16, 19] }

// ── 施法位表三族(2026-09-28 G 线迁 core 单源):gain_exp 升级级联 + rest 长休回满共用一个位表。──
// slotsFor(cls,level)=该职业该级位表数组(下标 0 起=1 环;值为该环位格数,0=该环无位);非施法职业 null。
export const FULL_CASTER = { wizard: true, cleric: true, sorcerer: true, druid: true, bard: true }
export const HALF_CASTER = { paladin: true, ranger: true }
// 全施法位表(PHB 全施法进度)
export const SLOTS_FULL = { 1:[2], 2:[3], 3:[4,2], 4:[4,3], 5:[4,3,2], 6:[4,3,3], 7:[4,3,3,1], 8:[4,3,3,2], 9:[4,3,3,3,1], 10:[4,3,3,3,2], 11:[4,3,3,3,2,1], 12:[4,3,3,3,2,1], 13:[4,3,3,3,2,1,1], 14:[4,3,3,3,2,1,1], 15:[4,3,3,3,2,1,1,1], 16:[4,3,3,3,2,1,1,1], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] }
// 半施法位表(PHB 半施法进度;1 级无环位=行缺省)
export const SLOTS_HALF = { 2:[2], 3:[3], 4:[3], 5:[4,2], 6:[4,2], 7:[4,3], 8:[4,3], 9:[4,3,2], 10:[4,3,2], 11:[4,3,3], 12:[4,3,3], 13:[4,3,3,1], 14:[4,3,3,1], 15:[4,3,3,1,1], 16:[4,3,3,1,1], 17:[4,3,3,1,1,1], 18:[4,3,3,1,1,1], 19:[4,3,3,1,1,1,1], 20:[4,3,3,1,1,1,1] }
// 契术师魔契位表:全环位集中同阶(L11 起 3 发、L17 起 4 发,皆 5 环);低环清零=整池随级上移;回充走短休。
export const SLOTS_PACT = { 1:[1], 2:[2], 3:[0,2], 4:[0,2], 5:[0,0,2], 6:[0,0,2], 7:[0,0,0,2], 8:[0,0,0,2], 9:[0,0,0,0,2], 10:[0,0,0,0,2], 11:[0,0,0,0,3], 12:[0,0,0,0,3], 13:[0,0,0,0,3], 14:[0,0,0,0,3], 15:[0,0,0,0,3], 16:[0,0,0,0,3], 17:[0,0,0,0,4], 18:[0,0,0,0,4], 19:[0,0,0,0,4], 20:[0,0,0,0,4] }
export function slotsFor(cls, level) {
  const c = String(cls ?? '').toLowerCase()
  if (FULL_CASTER[c]) return SLOTS_FULL[level] ?? null
  if (HALF_CASTER[c]) return SLOTS_HALF[level] ?? null
  if (c === 'warlock') return SLOTS_PACT[level] ?? null
  return null
}
// 施法者家族判定单源(三族:全施/半施/契术)——buildClass.isCaster 与创角面 CASTERS 名单皆由本表派生,
// 名单另一处手抄即漂移(旧案:CASTERS 只抄全施六族,ranger/paladin 被判非施法,带法术的 spawn 整体拒)。全施 L1 就有位表;半施 L1 无(行缺省,null)。
export function isCasterClass(cls) {
  const c = String(cls ?? '').toLowerCase()
  return Boolean(FULL_CASTER[c] || HALF_CASTER[c] || c === 'warlock')
}

// ── 出生机/写盘助手(2026-09-26 机械层收拢:第二消费者出现,YAGNI 门槛已过)──
// classRow 序数词版单源——SRD 职业表等级列是 | 1st | 2nd |,纯数字正则永不匹配(gain_exp 旧副本之病:特征行恒 '—')。
export function classRow(cls, L) {
  // 纯数据(CLASS_CORE rows 快照,2026-09-30——升级链/buildClass 零 lorebook 零回退)。名称/回执只吃 features/specific。
  const row = CLASS_CORE[cls]?.rows?.[L - 1]
  if (row?.pb != null) return { pb: row.pb, features: row.features, specific: row.specific }
  if (row?.features) return { features: row.features, specific: row.specific }
  return { features: '', specific: {} }
}
// 裁剪律落地(空数组整族删,不留 0/空壳)——spawn_npc 与 opening 共用(opening 本地副本退役)。
export const stripEmptyArrays = (obj) => { const out = {}; for (const [k, v] of Object.entries(obj)) { if (Array.isArray(v) && v.length === 0) continue; out[k] = v } return out }
// 写盘 helper:整档读→改→回写(parse 往返纪律;parse-modify-stringify 保证落盘必是合法 JSON)。
export const saveChar = (file, j) => {
  // statuses 键写盘当拍 lint(2026-09-29):非法键(临时状态枚举外)拒写——剧情态不当临时状态漏进 Conditions。
  const v = validateStatuses(j?.statuses)
  if (!v.ok) err(`!statuses 非法键(临时状态枚举外):${v.bad.join(',')}`)
  writeFileSync(file, JSON.stringify(j, null, 1))
}
// presence 行追加(spawn 工具用):插在「## 附近 NPC」节首(行序即注入序,新登场在前);节缺则缀于文末。
// 2026-09-30 三态回锅——`- 名 | 同伴/中立/敌对`(在场关系快照)。
// 2026-10-03 幂等:同名已上榜则就地改态(单列旧行补态列),不追加第二行。补档场景=spawn 的 saveChar+presenceAdd
// 双写,而该名已因「缺档」在册——再插一遍会因 presence() 不去重(见上注)而前端同名双卡。
export function presenceAdd(name, stance) {
  const nm = String(name).trim()
  const st = stance === '同伴' ? '同伴' : stance === '敌对' ? '敌对' : '中立'
  const row = `- ${nm} | ${st}`
  let md = readFileSync('state.md', 'utf8')
  const secRe = /## 附近 NPC[^\n]*\n([\s\S]*?)(?=\n## |$)/
  const secM = secRe.exec(md)
  if (!secM) {  // 节缺:缀于文末
    md = md.replace(/\s*$/, `\n## 附近 NPC\n${row}\n`)
    writeFileSync('state.md', md)
    return
  }
  const header = secM[0].slice(0, secM[0].indexOf('\n') + 1)   // `## 附近 NPC…\n`
  let hit = false
  const body = secM[1].split('\n').map(l => {
    if (hit) return l
    const m = /^-\s*([^|]+?)\s*(?:\|\s*(同伴|中立|敌对))?\s*$/.exec(l.trim())
    if (m && m[1].trim() === nm) { hit = true; return row }    // 同名在册→就地改态,幂等不重复
    return l
  }).join('\n')
  md = md.slice(0, secM.index) + header + (hit ? body : row + '\n' + body) + md.slice(secM.index + secM[0].length)
  writeFileSync('state.md', md)
}
