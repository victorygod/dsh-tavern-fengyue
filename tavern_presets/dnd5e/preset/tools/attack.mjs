/** @tavern-schema
{
  "description": "攻击结算器——一切攻击检定必经本工具（法术走 cast）：攻检→伤害→抗免→扣血，一次走完。何时调：攻击发生即调，每次一掷（多击＝同回合连调）。攻击数据三来源自动取：怪/原创 NPC 照出生档案材料（spawn 时攻击/能力/特征已全材料化在档——attack 传攻击名如 bite、ability 传豁免能力名如 fire-breath）；PC/同伴照面板武器。濒死目标 5 尺内命中自动暴击。细则见各参数；即兴无档目标先 spawn 建档（怪走 spawn_monster、有职业者走 spawn_npc）。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "who": { "type": "string", "description": "攻击者姓名，默认玩家。工具按名读档取攻击数据。" },
    "target": { "type": "string", "required": true, "description": "目标名。AC 与抗免自动读目标档——含其 statuses 机械修正（弃盾类状态走档案，不传数字）。" },
    "attack": { "type": "string", "description": "怪物/原创 NPC 的攻击名，英文原文（如 bite、scimitar）——spawn 回执整卡在档（attacks 键），加值/骰式/类型/触及自动带出。" },
    "ability": { "type": "string", "description": "怪物豁免能力名（如 fire-breath、lightning-breath、wing-attack）——走豁免不走攻检，目标每个生物各调一次，DC/骰式从档案 abilities 自动带出。" },
    "weapon": { "type": "string", "description": "PC/同伴的面板武器名（默认持位第一把）——骰式、灵巧、熟练全自动。" },
    "off_hand": { "type": "boolean", "description": "双持的后手武器——攻检照常，伤害不加属性调整值。" },
    "extra_dice": { "type": "string", "description": "特征骰（偷袭/神圣打击类），暴击同翻；条件是否满足由你判断。" },
    "mode": { "type": "string", "description": "攻击检定：adv＝优势，dis＝劣势，默认 normal。是否有优劣势由你按局面判断（隐形、伏击等）。" },
    "cover_bonus": { "type": "integer", "description": "目标掩体加值 0｜2｜5，由你按站位判断。" },
    "beyond_5ft": { "type": "boolean", "description": "仅长触及（reach 10 尺）武器的例外：濒死（0 HP）目标 5 尺内命中自动暴击，目标实际站在触及边缘（5 尺外）时传此参；其余情况无须传。" },
    "consume": { "type": "string", "description": "消费型状态名（如 Bardic Inspiration）——本攻检用掉它并加其骰值，用掉即从状态表摘除。" },
    "at": { "type": "string", "description": "攻击时刻——怪物攻击带状态骑手（击倒/中毒等）时你手写，如 '第 3 轮'，供自动写状态打时间锚；无骑手攻击不用填。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rnd, rollExpr, mod, pbOf, readChar, findCharFile, equipmentFM, resolveTarget, resolveSave, deathHitFail, rollMods, injure, consumeBonus, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { STATUS_CN } = await import(pathToFileURL(process.cwd() + '/../preset/lib/status.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context(剧情梗概——反作弊铁则)')
a.target || err('缺必填 target')
const who = a.who ?? '玩家'
const char = readChar(who)
const PB = pbOf(char.level ?? 1)

// ── 目标解析(咽喉:数值走档;查无=err;ac 转写仅限有档目标的剧情态覆盖——即兴先 spawn,写盘需要档)──
const tg = resolveTarget(a.target)
tg || err(`查无目标:${a.target}——spawn 建档`)
const acFinal = tg.ac + (a.cover_bonus ?? 0)

// 怪物种键(2026-09-29b 档案自含):monster_kind=身份元数据;旧 path 剥离=存量旧档兼容回退
// ── 怪物豁免能力入口(G1:龙息)——走豁免不走攻检,目标逐次调用(纯档案,无表查) ──
if (a.ability) {
  const abSlug = String(a.ability).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const ability = (char.abilities ?? {})[abSlug]
  ability || err(`能力查不到:${a.ability}(${who})——在档 abilities 键查无(重 spawn 即补齐)`)
  const si = resolveSave(a.target, ability.save)
  si || err(`查无目标:${a.target}`)
  const d = rnd(20); const total = d + si.bonus
  const pass = total >= ability.dc
  let dmg = (rollExpr(ability.dice) || err(`骰式不合法:${ability.dice}`)).total
  if (pass && ability.half !== false) dmg = Math.floor(dmg / 2)
  const stResist = Object.values(si.j.statuses ?? {}).flatMap(s => Array.isArray(s?.resist) ? s.resist : [])
  const stImmune = Object.values(si.j.statuses ?? {}).flatMap(s => Array.isArray(s?.immune) ? s.immune : [])
  let resNote = ''
  if ((si.j.immune ?? []).concat(stImmune).some(x => ability.type.includes(String(x).toLowerCase()))) { dmg = 0; resNote = '(免疫→0)' }
  else if ((si.j.resist ?? []).concat(stResist).some(x => ability.type.includes(String(x).toLowerCase()))) { dmg = Math.floor(dmg / 2); resNote = '(抗性↓)' }
  const inj = injure(si.j, dmg)
  saveChar(si.file, si.j)
  console.log(`[能力 · ${who}→${a.target} · ${a.ability}]`)
  console.log(`  豁免判定: d20${si.bonus >= 0 ? '+' + si.bonus : si.bonus} = ${total} vs DC ${ability.dc} → ${pass ? '成功' + (ability.half !== false ? '(半伤)' : '') : '失败(全额)'}`)
  if (si.parts.length) console.log(`  状态修正: ${si.parts.join(' · ')}`)
  console.log(`  伤害判定: ${ability.dice} = ${dmg} ${ability.type}${resNote}${inj.absorbed ? `(临时吸 ${inj.absorbed})` : ''}`)
  console.log(`  落盘: ${a.target} hp ${inj.before}→${inj.after}${ability.knockProne && !pass ? ' · 倒地' : ''} [${si.file}]`)
  if (inj.after === 0 && inj.before > 0) console.log(`  ◇ 0HP——${si.j.role === 'pc' ? '濒死计数起算' : '即死'}`)
  console.log(`  ◇ 梗概: ${a.context}`)
  console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
  process.exit(0)
}

// ── 攻击数据解析:档案材料(出生登记=spawn 材料化+原创登记) > 语料表(旧档兼容回退) > 面板武器(PC/同伴) ──
let atkBonus, dmgDice, dmgType = '', dmgMod = 0, panelRanged = false, recReach = null
const aSlug = a.attack ? String(a.attack).toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
const born = aSlug ? (char.attacks ?? {})[aSlug] : null
aSlug && !born && err(`!攻击名查不到:${a.attack}(${who})——在档 attacks 键查无(重 spawn 即补齐)`)
if (born) {
  const rec = born
  atkBonus = rec.bonus; dmgDice = rec.dice; dmgType = rec.type
  if (rec.kind === 'melee') recReach = rec.reach ?? 5
  else panelRanged = true
} else {
  const wname = (a.weapon ?? (char.weapons ?? [])[0] ?? '').replace(/\s*[x×]\s*\d+\s*$/, '').trim()
  const fm = equipmentFM(wname)
  fm || err(`!攻击无源:${wname || '(未传)'}——怪物/原创 NPC 传 attack,PC/同伴传 weapon`)
  dmgDice = fm.damage; dmgType = String(fm.damage_type ?? '').toLowerCase()
  const prop = JSON.stringify(fm.properties ?? '').toLowerCase()
  const finesse = prop.includes('finesse'), ranged = prop.includes('range') && !thrownOnly(prop), thrown = prop.includes('thrown')
  panelRanged = ranged
  const st = finesse || thrown ? (mod(char.str ?? 10) >= mod(char.dex ?? 10) ? 'str' : 'dex') : ranged ? 'dex' : 'str'
  const prof = (char.weapon_prof ?? []).some(p => JSON.stringify(fm).toLowerCase().includes(String(p).toLowerCase()))
  atkBonus = mod(char[st] ?? 10) + (prof ? PB : 0)   // 吞零修复:显式 0 也尊重
  dmgMod = a.off_hand === true ? 0 : mod(char[st] ?? 10)        // 后手:伤害不加属性
}
function thrownOnly(prop) { return prop.includes('thrown') && !prop.includes('range') }

// ── 攻击侧机械 buff(rollMods 单源,2026-09-28 审计批 B1):attack/attack_save 双通道,骰式每掷独立 ──
const bm = rollMods(char, ['attack', 'attack_save'])
const buffFlat = bm.flat, buffParts = bm.parts
// 消费型状态(consume,2026-09-28 F2):攻检用掉即摘+加骰(资源消耗=机械事实写盘)
if (a.consume) {
  const cb = consumeBonus(char, a.consume)
  if (cb) { const r = rollExpr(cb) || err(`骰式不合法:${cb}`); buffFlat += r.total; buffParts.push(`${a.consume}:${cb}=${r.total}`); const cf = findCharFile(who); cf && saveChar(cf, char) }
}

// ── 濒死目标命中=自动暴击(RAW:昏迷者 5 尺内受击必暴)──
// 近战带默认暴:reach≤5 恒在 5 尺内;reach>5 默认按贴身打,真站触及边缘才传 beyond_5ft;远程带默认不暴。
const wasDown = (tg.j.hp ?? 0) === 0
const within5 = panelRanged ? false : (recReach == null || recReach <= 5) ? true : a.beyond_5ft !== true
const autoCrit = wasDown && within5

// ── 命中(双骰透明)→ 伤害(暴击翻骰+特征骰)→ 抗免易 → 落盘 ──
const d1 = rnd(20), d2 = rnd(20)
const d = a.mode === 'adv' ? Math.max(d1, d2) : a.mode === 'dis' ? Math.min(d1, d2) : d1
const nat20 = d === 20, nat1 = d === 1
const hit = nat20 || (!nat1 && d + atkBonus + buffFlat >= acFinal)
console.log(`[攻击 · ${who}→${a.target} · ${a.attack ?? a.weapon ?? '面板武器'}]`)
console.log(`  命中判定: d20${atkBonus ? (atkBonus >= 0 ? '+' + atkBonus : atkBonus) : ''}${a.mode === 'adv' ? `(优:${d1},${d2})` : a.mode === 'dis' ? `(劣:${d1},${d2})` : ''}${a.cover_bonus ? '-' + a.cover_bonus + '(掩体)' : ''}${buffFlat ? (buffFlat >= 0 ? '+' + buffFlat : buffFlat) : ''} = ${d + atkBonus + buffFlat} vs AC ${acFinal}(${tg.source}) → ${nat1 ? 'nat1 必失' : nat20 ? 'nat20 必中+暴击' : hit ? '命中' : '未命中'}`)
if (buffParts.length) console.log(`  状态修正: ${buffParts.join(' · ')}`)
if (hit) {
  let dmg = 0; const parts = []
  // 目标 statuses 授予抗性/免疫(F1:rage 钝刺砍等)——合并进抗免名单(rage 者被击时减半)
  const stResist = Object.values(tg.j.statuses ?? {}).flatMap(s => Array.isArray(s?.resist) ? s.resist : [])
  const stImmune = Object.values(tg.j.statuses ?? {}).flatMap(s => Array.isArray(s?.immune) ? s.immune : [])
  const resistList = [...(tg.resist ?? []), ...stResist]
  const immuneList = [...(tg.immune ?? []), ...stImmune]
  for (const ex of [dmgDice, ...(a.extra_dice ? [a.extra_dice] : [])]) {
    const base = (nat20 || autoCrit) ? ex.replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : ex
    const r = rollExpr(base); r || err(`!骰式不合法:${base}`)
    dmg += r.total; parts.push(`${base}=${r.total}${nat20 ? '(暴击已翻骰)' : autoCrit ? '(濒死自动暴击·翻骰)' : ''}`)
  }
  const rider = rollMods(char, 'damage', nat20 || autoCrit)   // 附伤骑手(B1 扩面):divine-favor/branding-smite 的 damage mods——骰式暴击同翻,定值不翻(与 extra_dice 同律)
  dmg += dmgMod + rider.flat
  // 怪物骑手(G2):Weapon 攻击 plus 第二段(龙焰咬)——独立骰+独立类型+独立抗免(档案材料优先,旧档回退表)
  const monRiders = born?.riders ?? null
  for (const rd of (monRiders ?? [])) {
    const rbase = (nat20 || autoCrit) ? String(rd.dice).replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : rd.dice
    const rr = rollExpr(String(rbase)); rr || err(`!骑手骰式不合法:${rbase}`)
    let rdmg = rr.total
    const rtype = String(rd.type).toLowerCase()
    let rnote = ''
    if (rtype && immuneList.some(x => rtype.includes(String(x).toLowerCase()))) { rdmg = 0; rnote = '(免疫)' }
    else if (rtype && resistList.some(x => rtype.includes(String(x).toLowerCase()))) { rdmg = Math.floor(rdmg / 2); rnote = '(抗性↓)' }
    dmg += rdmg
    parts.push(`${rbase}=${rdmg}(骑手 ${rd.type}${rnote})`)
  }
  const typeKey = String(dmgType).toLowerCase()
  let resNote = ''
  if (typeKey && immuneList.some(x => typeKey.includes(String(x).toLowerCase()))) { dmg = 0; resNote = '(免疫→0)' }
  else if (typeKey && resistList.some(x => typeKey.includes(String(x).toLowerCase()))) { dmg = Math.floor(dmg / 2); resNote = '(抗性→↓取整)' }
  else if (typeKey && (tg.vuln ?? tg.vulnerabilities ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) { dmg *= 2; resNote = '(易伤→×2)' }
  console.log(`  伤害判定: ${parts.join(' + ')}${dmgMod ? (dmgMod >= 0 ? '+' + dmgMod : dmgMod) : ''} = ${dmg}${dmgType ? ' ' + dmgType : ''}${resNote}`)
  if (rider.parts.length) console.log(`  附伤: ${rider.parts.join(' · ')}`)
  const inj = injure(tg.j, dmg)
  const before = inj.before, after = inj.after
  if (inj.absorbed) parts[parts.length - 1] += `(临时吸 ${inj.absorbed})`
  let extra = ''
  if (before === 0 && dmg > 0 && tg.j.role === 'pc') {
    const dh = deathHitFail(tg.j, nat20 || autoCrit)
    if (dh.stab) extra += ' · 稳定打破(重开濒死)'
    extra += ` · death_fail ${dh.f0}→${dh.f1}`
  }
  saveChar(tg.file, tg.j)
  console.log(`  落盘: ${a.target} hp ${before}→${after}${extra} [${tg.file}]`)
  if (extra) {
    console.log(`  ◇ 0HP 受击——濒死败+${(nat20 || autoCrit) ? 2 : 1}${nat20 ? '(暴击源)' : autoCrit ? '(濒死·5尺自动暴击)' : ''}`)
    if (tg.j.death_fail >= 3) console.log(`  ◇ 三败——死亡(终局)`)
  }
  else if (after === 0 && dmg > 0) console.log(`  ◇ 0HP——${tg.j.role === 'pc' ? '濒死计数起算' : '即死'}`)
  // 状态骑手(2026-09-29):Weapon 命中后怪物若有 DC 豁免 or 状态,自动掷豁免,失败自动写状态(applied_at=at 或空)
  // 2026-09-29b:档案材料优先(born.status_rider),旧档回退语料表 join
  const sr = born?.status_rider ?? null
  if (sr) {
    const sv = resolveSave(a.target, sr.save)
    if (sv && after > 0) {   // 目标已倒地(0HP)不再叠状态
      const sd = rnd(20); const sTotal = sd + sv.bonus; const sfail = sTotal < sr.dc
      console.log(`  状态骑手: DC ${sr.dc} ${sr.save} 豁免 d20${sv.bonus >= 0 ? '+' + sv.bonus : sv.bonus} = ${sTotal} → ${sfail ? '失败' : '通过'}`)
      if (sfail) {
        const st = (tg.j.statuses && !Array.isArray(tg.j.statuses)) ? { ...tg.j.statuses } : {}
        st[sr.status] = { ...(a.at ? { applied_at: String(a.at) } : {}), effect: `${STATUS_CN[sr.status] ?? sr.status}${sr.duration ? '，持续 ' + sr.duration : ''}` }
        tg.j.statuses = st; saveChar(tg.file, tg.j)
        console.log(`  ◇ 状态: ${a.target} 上「${STATUS_CN[sr.status] ?? sr.status}」${sr.duration ? '（' + sr.duration + '）' : ''}`)
      }
    }
  }
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
