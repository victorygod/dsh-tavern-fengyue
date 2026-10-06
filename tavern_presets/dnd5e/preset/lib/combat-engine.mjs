// combat-engine.mjs — 自动战斗结算内核(dnd5e-combat)。
// 从退役工具 attack/cast/damage/death/initiative 抽出的纯结算函数,操作**内存 roster**(name→{j,file}),
// 不再读盘/写盘/process.exit——err()→throw(combat 工具逐动作 try/catch)、console.log→lines 回执。
// 机械律与 attack.mjs/cast.mjs 同源单源:命中→伤害→抗免→扣血→濒死 全链复用 core.mjs 原语,零重写。
import {
  rnd, rollExpr, rollGreatWeapon, VERSATILE_UP, mod, pbOf, equipmentFM, WEAPON_SLUG, slugify,
  hasFeature, rollMods, deriveAC, injure, deathHitFail,
} from './core.mjs'
import { SPELL_DATA } from './spell-data.mjs'
import { SPELL_CORE } from './spell-core-data.mjs'

// 引擎内错误=抛(combat 工具逐动作 catch,不因单次坏账杀整场)——与 core.err(exit)不同语义。
const fail = (m) => { throw new Error('!' + m) }

// 死亡判定(单源,combat 工具与 AI 共用):玩家=death_fail≥3 才死(0HP 进濒死);其余 0HP 即死。
export const isDead = (j) => j.role === 'pc' ? (j.death_fail ?? 0) >= 3 : (j.hp ?? 0) <= 0

// ── roster 目标解析(与 core.resolveTarget 同律,但走内存 roster,不读盘) ──
export function tgt(roster, name) {
  const r = roster[name]
  if (!r) return null
  const j = r.j
  return { j, file: r.file, ac: j.ac ?? deriveAC(j), resist: j.resist ?? [], immune: j.immune ?? [], vuln: j.vulnerabilities ?? [] }
}
// roster 版豁免加值(与 core.resolveSave 同律)
function saveInfo(roster, name, save) {
  const r = roster[name]
  if (!r) return null
  const j = r.j
  const bm = rollMods(j, ['save', 'attack_save'])
  return { bonus: mod(j[save] ?? 10) + ((j.save_prof ?? []).includes(save) ? pbOf(j.level ?? 1) : 0) + bm.flat, parts: bm.parts, j, file: r.file }
}
// roster 版专注断链(cast 顶替旧专注时清同名词条;与 core.dropConcentration 同律,内存化)
function dropConc(roster, casterName) {
  const c = roster[casterName]
  if (!c) return []
  const conc = c.j.concentrating
  if (!conc) return []
  const removed = []
  for (const [nm, r] of Object.entries(roster)) {
    const st = r.j.statuses
    if (st && typeof st === 'object' && !Array.isArray(st) && conc in st) {
      delete st[conc]
      removed.push(`${nm} 摘「${conc}」`)
    }
  }
  c.j.concentrating = null
  return removed
}

// ── 攻击选项枚举(自动战斗随机挑武器用)──
// born=档案 attacks(怪/原创 NPC);weapon=面板武器(PC/同伴)。label 供战报与挑选。
export function listAttacks(roster, name) {
  const r = roster[name]; if (!r) return []
  const out = []
  for (const key of Object.keys(r.j.attacks ?? {})) out.push({ kind: 'born', key, label: key })
  for (const w of (r.j.weapons ?? [])) out.push({ kind: 'weapon', key: w, label: w })
  return out
}

// ── 攻击结算(attack.mjs 内核,内存化) ──
// opts: {weapon, ability, mode, cover_bonus, off_hand, two_handed, beyond_5ft, at}
// 返回 {lines, down}——down=目标本击 0HP(供结束判定);lines=回执行。
export function resolveAttack(roster, attackerName, targetName, opts = {}) {
  const lines = []
  const att = roster[attackerName]; if (!att) fail(`!攻击者不在场:${attackerName}`)
  const char = att.j
  const PB = pbOf(char.level ?? 1)
  const tg = tgt(roster, targetName); if (!tg) fail(`!查无目标:${targetName}`)
  const acFinal = tg.ac + (opts.cover_bonus ?? 0)

  // ── 怪物豁免能力入口(龙息类)——走豁免不走攻检 ──
  if (opts.ability) {
    const abSlug = String(opts.ability).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const ability = (char.abilities ?? {})[abSlug]
    if (!ability) fail(`!能力查不到:${opts.ability}(${attackerName})`)
    const si = saveInfo(roster, targetName, ability.save)
    if (!si) fail(`!查无目标:${targetName}`)
    const d = rnd(20); const total = d + si.bonus
    const pass = total >= ability.dc
    let dmg = (rollExpr(ability.dice) || fail(`!骰式不合法:${ability.dice}`)).total
    if (pass && ability.half !== false) dmg = Math.floor(dmg / 2)
    const stResist = Object.values(si.j.statuses ?? {}).flatMap(s => Array.isArray(s?.resist) ? s.resist : [])
    const stImmune = Object.values(si.j.statuses ?? {}).flatMap(s => Array.isArray(s?.immune) ? s.immune : [])
    let resNote = ''
    if ((si.j.immune ?? []).concat(stImmune).some(x => ability.type.includes(String(x).toLowerCase()))) { dmg = 0; resNote = '(免疫→0)' }
    else if ((si.j.resist ?? []).concat(stResist).some(x => ability.type.includes(String(x).toLowerCase()))) { dmg = Math.floor(dmg / 2); resNote = '(抗性↓)' }
    const inj = injure(si.j, dmg)
    lines.push(`  ${attackerName}「${opts.ability}」→${targetName}: 豁免 d20${si.bonus >= 0 ? '+' + si.bonus : si.bonus}=${total} vs DC${ability.dc} ${pass ? '过(半伤)' : '败(全额)'} · ${ability.dice}=${dmg}${resNote} · hp ${inj.before}→${inj.after}`)
    return { lines, down: inj.after === 0 && inj.before > 0 }
  }

  // ── 攻击数据解析:档案 attacks 优先,查无走面板武器 ──
  let atkBonus, dmgDice, dmgType = '', dmgMod = 0, panelRanged = false, recReach = null, gwf = false, born = null
  const name = opts.weapon ?? ''
  const nSlug = name ? String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
  born = nSlug ? (char.attacks ?? {})[nSlug] : null
  if (born) {
    atkBonus = born.bonus; dmgDice = born.dice; dmgType = born.type
    if (born.kind === 'melee') recReach = born.reach ?? 5
    else panelRanged = true
  } else {
    const wname = (name || (char.weapons ?? [])[0] || '').replace(/\s*[x×]\s*\d+\s*$/, '').trim()
    const fm = equipmentFM(wname)
    if (!fm) fail(`!攻击无源:${wname || '(未传)'}——档案 attacks 与面板 weapons 皆查无`)
    holdGate(char, fm, wname)
    dmgDice = fm.damage; dmgType = String(fm.damage_type ?? '').toLowerCase()
    const prop = JSON.stringify(fm.properties ?? '').toLowerCase()
    const finesse = prop.includes('finesse'), ranged = String(fm.weapon ?? '').toLowerCase().includes('ranged') || (prop.includes('range') && !thrownOnly(prop))
    panelRanged = ranged
    if (prop.includes('reach')) recReach = 10
    if (opts.two_handed === true && prop.includes('versatile')) dmgDice = String(dmgDice).replace(/^(\d+)d(\d+)/, (m, n, d) => `${n}d${VERSATILE_UP[d] ?? d}`)
    const twoHandedGrip = opts.two_handed === true || prop.includes('two-handed')
    gwf = char.fighting_style === 'great_weapon_fighting' && twoHandedGrip && !panelRanged
    const st = finesse ? (mod(char.str ?? 10) >= mod(char.dex ?? 10) ? 'str' : 'dex') : ranged ? 'dex' : 'str'
    const PROF_CAT = { '简易武器': 'simple', '军用武器': 'martial' }
    const fmSlug = slugify(fm.name ?? ''), fmPath = String(fm.path ?? '')
    const prof = (char.weapon_prof ?? []).some(p => {
      const s = String(p).trim()
      if (PROF_CAT[s]) return String(fm.weapon ?? '').toLowerCase().includes(PROF_CAT[s])
      const slug = WEAPON_SLUG[s] ?? WEAPON_SLUG[s.replace(/（.*?）|\(.*?\)/g, '').trim()]
      if (slug) return fmSlug === slug || fmPath.includes(slug)
      return JSON.stringify(fm).toLowerCase().includes(s.toLowerCase())
    })
    atkBonus = mod(char[st] ?? 10) + (prof ? PB : 0) + (char.fighting_style === 'archery' && panelRanged ? 2 : 0)
    dmgMod = opts.off_hand === true ? (char.fighting_style === 'two_weapon_fighting' ? mod(char[st] ?? 10) : 0) : mod(char[st] ?? 10) + (char.fighting_style === 'dueling' && !panelRanged && opts.off_hand !== true ? 2 : 0)
  }
  const bm = rollMods(char, ['attack', 'attack_save'])
  let buffFlat = bm.flat; const buffParts = bm.parts

  const wasDown = (tg.j.hp ?? 0) === 0
  const within5 = panelRanged ? false : (recReach == null || recReach <= 5) ? true : opts.beyond_5ft !== true
  const autoCrit = wasDown && within5

  const d1 = rnd(20), d2 = rnd(20)
  const d = opts.mode === 'adv' ? Math.max(d1, d2) : opts.mode === 'dis' ? Math.min(d1, d2) : d1
  const nat20 = d === 20, nat1 = d === 1
  const hit = nat20 || (!nat1 && d + atkBonus + buffFlat >= acFinal)
  if (hit) {
    let dmg = 0; const parts = []
    const stResist = Object.values(tg.j.statuses ?? {}).flatMap(s => Array.isArray(s?.resist) ? s.resist : [])
    const stImmune = Object.values(tg.j.statuses ?? {}).flatMap(s => Array.isArray(s?.immune) ? s.immune : [])
    const resistList = [...(tg.resist ?? []), ...stResist]
    const immuneList = [...(tg.immune ?? []), ...stImmune]
    for (const ex of [dmgDice]) {
      const base = (nat20 || autoCrit) ? ex.replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : ex
      const r = (gwf && ex === dmgDice) ? rollGreatWeapon(base) : rollExpr(base); if (!r) fail(`!骰式不合法:${base}`)
      dmg += r.total; parts.push(`${base}=${r.total}${(gwf && r.rerolled) ? '(巨武重掷)' : ''}`)
    }
    if ((nat20 || autoCrit) && hasFeature(char, 'brutal critical')) {
      const lv = char.level ?? 1
      const n = lv >= 17 ? 3 : lv >= 13 ? 2 : lv >= 9 ? 1 : 0
      const wm = /^(\d+)d(\d+)/.exec(String(dmgDice))
      if (n > 0 && wm) {
        const extra = `${n}d${wm[2]}`
        const r = gwf ? rollGreatWeapon(extra) : rollExpr(extra); if (!r) fail(`!凶蛮暴击骰不合法:${extra}`)
        dmg += r.total; parts.push(`${extra}=${r.total}(凶蛮暴击)`)
      }
    }
    const rider = rollMods(char, 'damage', nat20 || autoCrit)
    dmg += dmgMod + rider.flat
    if (!panelRanged && hasFeature(char, 'improved divine smite')) {
      const rr = rollExpr('1d8'); if (!rr) fail('!神圣打击骰不合法')
      let rdmg = rr.total; const rtype = 'radiant'
      if (immuneList.some(x => rtype.includes(String(x).toLowerCase()))) rdmg = 0
      else if (resistList.some(x => rtype.includes(String(x).toLowerCase()))) rdmg = Math.floor(rdmg / 2)
      dmg += rdmg; parts.push(`1d8=${rr.total}(神圣打击)`)
    }
    const monRiders = born?.riders ?? null
    for (const rd of (monRiders ?? [])) {
      const rbase = (nat20 || autoCrit) ? String(rd.dice).replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : rd.dice
      const rr = rollExpr(String(rbase)); if (!rr) fail(`!骑手骰式不合法:${rbase}`)
      let rdmg = rr.total; const rtype = String(rd.type).toLowerCase()
      if (rtype && immuneList.some(x => rtype.includes(String(x).toLowerCase()))) rdmg = 0
      else if (rtype && resistList.some(x => rtype.includes(String(x).toLowerCase()))) rdmg = Math.floor(rdmg / 2)
      dmg += rdmg; parts.push(`${rbase}=${rdmg}(骑手)`)
    }
    const typeKey = String(dmgType).toLowerCase()
    let resNote = ''
    if (typeKey && immuneList.some(x => typeKey.includes(String(x).toLowerCase()))) { dmg = 0; resNote = '(免疫→0)' }
    else if (typeKey && resistList.some(x => typeKey.includes(String(x).toLowerCase()))) { dmg = Math.floor(dmg / 2); resNote = '(抗性↓)' }
    else if (typeKey && (tg.vuln ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) { dmg *= 2; resNote = '(易伤×2)' }
    const inj = injure(tg.j, dmg)
    const before = inj.before, after = inj.after
    let down = after === 0 && dmg > 0
    lines.push(`  ${attackerName}→${targetName}「${opts.weapon || '面板武器'}」: ${nat20 ? 'nat20 暴击' : nat1 ? 'nat1 失手' : hit ? '命中' : '未命中'} · 伤害 ${parts.join('+')}${dmgMod ? (dmgMod >= 0 ? '+' + dmgMod : dmgMod) : ''}=${dmg}${dmgType ? ' ' + dmgType : ''}${resNote} · hp ${before}→${after}`)
    if (before === 0 && dmg > 0 && tg.j.role === 'pc') {
      const dh = deathHitFail(tg.j, nat20 || autoCrit)
      lines.push(`  ◇ ${targetName} 0HP 受击——濒死败+${(nat20 || autoCrit) ? 2 : 1}`)
      if (tg.j.death_fail >= 3) lines.push(`  ◇ ${targetName} 三败——死亡(终局)`)
    } else if (down) {
      lines.push(`  ◇ ${targetName} 0HP——${tg.j.role === 'pc' ? '濒死计数起算' : '即死'}`)
    }
    // 怪物状态骑手(命中后豁免失败写状态)
    const sr = born?.status_rider ?? null
    if (sr && after > 0) {
      const sv = saveInfo(roster, targetName, sr.save)
      if (sv) {
        const sd = rnd(20); const sTotal = sd + sv.bonus; const sfail = sTotal < sr.dc
        if (sfail) {
          const st = (tg.j.statuses && !Array.isArray(tg.j.statuses)) ? { ...tg.j.statuses } : {}
          st[sr.status] = { ...(opts.at ? { applied_at: String(opts.at) } : {}) }
          tg.j.statuses = st
          lines.push(`  ◇ ${attackerName} 使 ${targetName} 上「${sr.status}」(DC${sr.dc} 豁免失败)`)
        }
      }
    }
    return { lines, down }
  }
  lines.push(`  ${attackerName}→${targetName}「${opts.weapon || '面板武器'}」: ${nat1 ? 'nat1 失手' : `未命中(d20+${atkBonus + buffFlat} < AC${acFinal})`}`)
  if (buffParts.length) lines.push(`  状态修正: ${buffParts.join(' · ')}`)
  return { lines, down: false }
}
function thrownOnly(prop) { return prop.includes('thrown') && !prop.includes('range') }
// 持有闸(背包律)——panel 武器必须在 weapons/gear 行上(与 attack.mjs 同律)
function holdGate(char, fm, wname) {
  const slug = String(fm.path).replace(/^equipment\//, '').replace(/\.md$/, '')
  const cns = Object.entries(WEAPON_SLUG).filter(([, s]) => s === slug).map(([cn]) => cn)
  const en = String(fm.name ?? '').toLowerCase()
  const held = [...(char.weapons ?? []), ...(char.gear ?? [])].some(row => {
    const t = String(row).replace(/\s*[x×]\s*\d+\s*$/, '').trim()
    if (equipmentFM(t)?.path === fm.path) return true
    return cns.some(cn => t.includes(cn)) || (en && t.toLowerCase().includes(en))
  })
  if (!held) fail(`!武器没带:${wname}——weapons/gear 行查无`)
}

// ── 战斗法术枚举(自动战斗随机挑法术用):SPELL_DATA 有骰式且非 suppress(无施放时点直伤)=可战 ──
export function listCombatSpells(roster, name) {
  const r = roster[name]; if (!r) return []
  const j = r.j
  const pool = [...(Array.isArray(j.spells_known) ? j.spells_known : []), ...(Array.isArray(j.spells_prepared) ? j.spells_prepared : [])]
  const maxSlot = Math.max(0, ...Array.from({ length: 9 }, (_, i) => (+(j[`slots_l${i + 1}`] ?? 0) > 0 ? i + 1 : 0)))
  const out = []
  for (const s of pool) {
    const slug = String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const T = SPELL_DATA[slug]
    if (!T || T.suppress === true) continue
    const fm = SPELL_CORE[slug]?.fm
    if (!fm) continue
    const lvl = fm.level ?? 0
    if (lvl > 0 && lvl > maxSlot) continue   // 环位不够(戏法 lvl=0 恒可)
    // 只收「敌对」法术(伤害/攻检/豁免/阈值/罩池)——治疗/增益/临时生命是友方法术,自动战斗不往敌人身上丢
    // aoe=可多目标(罩池/敏捷豁免范围伤害);bolts=多弹份额(如 scorching-ray/magic-missile)
    // aoe=可多目标:罩池,或效果正文含范围措辞(each creature/creatures within…);单体豁免法术(Sacred Flame/Blights)不含此措辞
    const aoe = T.pool ? true : /each creature|each target|every creature|creatures within|creatures in|creatures that/i.test(String(SPELL_CORE[slug]?.effect ?? ''))
    const bolts = (T.bolts ?? 0) + (T.upcastBolts ?? 0)
    out.push({ spell: s, slug, level: lvl, aoe, bolts, hasMechanic: !!(T.damage || fm.attack_type || fm.save || T.judge || T.pool) })
  }
  return out.filter(s => s.hasMechanic)
}

// 治疗法术枚举(治疗 AI 用):SPELL_DATA 有治疗字段(heal/healFlat/healFlatOnly/healPool/raise/stabilize/healMod)的友方法术。
export function listHealSpells(roster, name) {
  const r = roster[name]; if (!r) return []
  const j = r.j
  const pool = [...(Array.isArray(j.spells_known) ? j.spells_known : []), ...(Array.isArray(j.spells_prepared) ? j.spells_prepared : [])]
  const maxSlot = Math.max(0, ...Array.from({ length: 9 }, (_, i) => (+(j[`slots_l${i + 1}`] ?? 0) > 0 ? i + 1 : 0)))
  const out = []
  for (const s of pool) {
    const slug = String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const T = SPELL_DATA[slug]
    if (!T) continue
    const isHeal = !!(T.heal || T.healFlat || T.healFlatOnly || T.healPool || T.raise || T.stabilize || T.healMod)
    if (!isHeal) continue
    const fm = SPELL_CORE[slug]?.fm
    if (!fm) continue
    const lvl = fm.level ?? 0
    if (lvl > 0 && lvl > maxSlot) continue
    out.push({ spell: s, slug, level: lvl })
  }
  return out
}

// ── 施法结算(cast.mjs 内核,内存化) ──
// opts: {as_level, at, mode}。targets=目标名数组。返回 {lines, down}(down=首个目标击倒)。
export function resolveSpell(roster, casterName, spellName, targets, opts = {}) {
  const lines = []
  const c = roster[casterName]; if (!c) fail(`!施法者不在场:${casterName}`)
  const char = c.j
  const spellSlug = String(spellName).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const spellCore = SPELL_CORE[spellSlug]
  const fm = spellCore?.fm
  if (!fm?.name) fail(`!法术查不到:${spellName}`)
  const lvl = fm.level ?? 0
  const asL = opts.as_level ?? lvl
  if (asL < lvl) fail(`!升环校验失败:as_level(${asL}) < 法术环位(${lvl})`)

  // 施法头行(回执可见「谁放什么」):[施法 · 莉拉 → Sacred Flame(升 3 环)]
  lines.push(`[施法 · ${casterName} → ${fm.name}${asL > lvl ? `(升 ${asL} 环)` : ''}]`)

  let slotKey = null
  if (lvl > 0 && fm.ritual !== true) {   // 仅环术报耗位;戏法/仪式不报
    slotKey = 'slots_l' + Math.max(asL, 1)
    const have = char[slotKey] ?? 0
    if (have < 1) fail(`!无 ${asL} 环位可施(现 ${have})`)
    lines.push(`  消耗${asL}环位 剩${have - 1}`)
  }
  if (fm.concentration === true) {
    const old = char.concentrating
    if (old && old !== fm.name) { const rm = dropConc(roster, casterName); if (rm.length) lines.push(`  专注: 顶替旧「${old}」· 摘 ${rm.join(' / ')}`) }
  }
  const T = SPELL_DATA[spellSlug]
  const DC = 8 + pbOf(char.level ?? 1) + mod(char[char.caster_attr] ?? 10)
  const dLvl = Math.max(0, asL - lvl)
  const agg = s => { const pool = {}, flat = { n: 0 }; for (const t of String(s).split('+')) { const mm = t.match(/^(\d+)d(\d+)$/); if (mm) pool[mm[2]] = (pool[mm[2]] ?? 0) + +mm[1]; else flat.n += +t } return Object.entries(pool).map(([y, x]) => `${x}d${y}`).concat(flat.n ? [String(flat.n)] : []).join('+') }
  const scaleDice = (dice, mult) => { const mm = String(dice).match(/^(\d+)d(\d+)([+-]\d+)?$/); return mm ? `${+mm[1] * mult}d${mm[2]}${mm[3] ? '+' + Math.abs(+mm[3]) * mult : ''}` : Array(mult).fill(dice).join('+') }
  const charLvl = char.level ?? 1
  const cantripTier = 1 + (charLvl >= 5 ? 1 : 0) + (charLvl >= 11 ? 1 : 0) + (charLvl >= 17 ? 1 : 0)
  const tblDice = T && T.damage && !T.bolts && !T.upcastBolts
    ? (T.cantripScale ? scaleDice(T.damage, cantripTier) : (T.upcastStep ? Math.max(0, Math.floor((asL - T.upcastBase) / T.upcastStep)) : dLvl) > 0 && T.upcast ? agg(`${T.damage}+${Array(T.upcastStep ? Math.max(0, Math.floor((asL - T.upcastBase) / T.upcastStep)) : dLvl).fill(T.upcast).join('+')}`) : T.damage)
    : null
  const dice = T?.suppress === true ? null : tblDice ?? fm.damage
  const saveKey = String(fm.save ?? T?.save ?? '').trim().toLowerCase()
  const healDice = (T?.heal ? agg([T.heal, ...Array(dLvl > 0 ? dLvl : 0).fill(T.upcast ?? '')].filter(Boolean).join('+')) : null) ?? fm.heal ?? null
  const healFlat = (T?.healFlat ?? 0) + (T?.healFlatOnly ?? 0) + (T?.healMod ? mod(char[char.caster_attr] ?? 10) : 0) + (T?.healFlatPerLevel ? T.healFlatPerLevel.per * Math.max(0, asL - T.healFlatPerLevel.from) : 0)

  const hurt = (t, dmg, crit = false) => {
    const tg = tgt(roster, t); if (!tg) fail(`!查无目标:${t}`)
    const inj = injure(tg.j, dmg)
    const before = inj.before, after = inj.after
    let extra = ''
    if (before === 0 && dmg > 0 && tg.j.role === 'pc') {
      const dh = deathHitFail(tg.j, crit)
      extra = ` · 濒死败+${crit ? 2 : 1}`
      if (tg.j.death_fail >= 3) lines.push(`  ◇ ${t} 三败——死亡(终局)`)
    }
    lines.push(`  落盘: ${t} hp ${before}→${after}${extra}`)
    if (after === 0 && dmg > 0 && before > 0) lines.push(`  ◇ ${t} 0HP——${tg.j.role === 'pc' ? '濒死计数起算' : '即死'}`)
    return after === 0 && dmg > 0
  }
  const resistNote = (tg, typeKey) => {
    if (!typeKey) return dmg => dmg
    const hit = arr => (arr ?? []).some(x => typeKey.includes(String(x).toLowerCase()))
    if (hit(tg.immune)) return () => 0
    if (hit(tg.resist)) return d => Math.floor(d / 2)
    if (hit(tg.vuln)) return d => d * 2
    return d => d
  }

  let down = false
  if ((healDice || healFlat || T?.healPool || T?.raise || T?.stabilize) && !fm.attack_type && !saveKey) {
    if (T?.stabilize) {
      const tg = tgt(roster, targets[0]); if (!tg) fail(`!查无目标:${targets[0]}`)
      tg.j.death_success = 3
      lines.push(`  落盘: ${targets[0]} 伤势稳定`)
    } else if (T?.raise) {
      const tg = tgt(roster, targets[0]); if (!tg) fail(`!查无目标:${targets[0]}`)
      const amt = T.raise.hp === 'full' ? (tg.j.hp_max ?? 0) : +(T.raise.hp || 1)
      tg.j.hp = amt; tg.j.death_success = 0; tg.j.death_fail = 0
      lines.push(`  落盘: ${targets[0]} 复生 hp→${amt}`)
    } else if (T?.healPool) {
      let pool = +(T.healPool || 0)
      for (const t of targets) {
        if (pool <= 0) break
        const tg = tgt(roster, t); if (!tg) continue
        const amt = Math.min(Math.max(0, (tg.j.hp_max ?? Infinity) - (tg.j.hp ?? 0)), pool)
        if (amt <= 0) continue
        pool -= amt; tg.j.hp = (tg.j.hp ?? 0) + amt
        lines.push(`  治疗: ${t} +${amt}`)
      }
    } else {
      for (const t of targets) {
        const tg = tgt(roster, t); if (!tg) fail(`!查无目标:${t}`)
        const r = healDice ? rollExpr(healDice) : null; if (healDice && !r) fail(`!骰式不合法:${healDice}`)
        const amt = (r ? r.total : 0) + healFlat
        const before = tg.j.hp ?? 0
        if (T?.hpMaxBoost === true) tg.j.hp_max = (tg.j.hp_max ?? 0) + amt
        const after = T?.hpMaxBoost === true ? before + amt : Math.min(tg.j.hp_max ?? Infinity, before + amt)
        tg.j.hp = after
        if (before === 0 && after > 0) { tg.j.death_success = 0; tg.j.death_fail = 0 }
        lines.push(`  治疗: ${t} ${healDice ? `${healDice}=${amt}` : `平值 ${amt}`} · hp ${before}→${tg.j.hp}`)
      }
    }
  } else if (fm.attack_type) {
    const boltN = (T?.bolts ?? 0) + (T?.upcastBolts ?? 0) * dLvl
    const baseAb = pbOf(char.level ?? 1) + mod(char[char.caster_attr] ?? 10)
    for (const t of targets) {
      const tg = tgt(roster, t); if (!tg) fail(`!查无目标:${t}`)
      const bm = rollMods(char, ['attack', 'attack_save'])
      const ab = baseAb + bm.flat
      const d1 = rnd(20), d2 = rnd(20)
      const d = opts.mode === 'adv' ? Math.max(d1, d2) : opts.mode === 'dis' ? Math.min(d1, d2) : d1
      const nat20 = d === 20, nat1 = d === 1
      const hit = nat20 || (!nat1 && d + ab >= tg.ac)
      const rayDice = dice ?? (T?.bolts ? T.damage : null)
      if (hit && rayDice) {
        const crit = nat20
        const ex = crit ? String(rayDice).replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : String(rayDice)
        const r = rollExpr(ex); if (!r) fail(`!骰式不合法:${ex}`)
        const typeKey = String(T?.type ?? fm.damage_type ?? '').toLowerCase()
        const dmg = resistNote(tg, typeKey)(r.total)
        lines.push(`  ${casterName}「${fm.name}」→${t}: ${hit ? '命中' : '失手'} · ${ex}=${dmg}`)
        down = hurt(t, dmg, crit) || down
      } else {
        lines.push(`  ${casterName}「${fm.name}」→${t}: ${nat1 ? 'nat1 失手' : hit ? '命中无骰' : '未命中'}`)
      }
    }
  } else if (saveKey) {
    const typeKey = String(T?.type ?? fm.damage_type ?? '').toLowerCase()
    const hitFlat = T?.hitFlat ?? 0
    const rolls = []
    for (const t of targets) {
      const sv = saveInfo(roster, t, saveKey); if (!sv) fail(`!查无目标:${t}`)
      const d = rnd(20), total = d + sv.bonus, pass = total >= DC
      rolls.push({ t, pass, tg: sv.j })
      lines.push(`  豁免: ${t} d20+${sv.bonus}=${total} vs DC${DC} ${pass ? '过' : '败'}`)
    }
    if (dice) for (const r of rolls) {
      const roll = rollExpr(String(dice)); if (!roll) fail(`!骰式不合法:${dice}`)
      const base = roll.total + hitFlat
      const eva = fm.half_on_save === true && String(saveKey).toLowerCase() === 'dex' && hasFeature(r.tg, 'evasion')
      const half = r.pass && fm.half_on_save === true
      // half_on_save=true=「成功半伤」;缺省=「成功免伤」(save for none)——Sacred Flame/Blights 等通过豁免不受伤
      const halfDmg = eva ? (r.pass ? 0 : Math.floor(base / 2)) : half ? Math.floor(base / 2) : (r.pass ? 0 : base)
      if (halfDmg > 0) down = hurt(r.t, resistNote(tgt(roster, r.t), typeKey)(halfDmg)) || down
    }
    if (T?.onFail) for (const r of rolls) if (!r.pass) {
      const tg = tgt(roster, r.t); if (!tg) continue
      const st = (tg.j.statuses && !Array.isArray(tg.j.statuses)) ? { ...tg.j.statuses } : {}
      st[fm.name] = { ...(opts.at ? { applied_at: String(opts.at) } : {}), effect: T.onFail.effect, ...(T.onFail.mods ? { mods: T.onFail.mods } : {}) }
      tg.j.statuses = st
      lines.push(`  ${r.t} 上「${fm.name}」${T.onFail.effect}`)
    }
    if (T?.judge) for (const r of rolls) if (!r.pass) {
      const hp = r.tg.hp ?? 0
      for (const s of T.judge) {
        if (hp > s.hp) continue
        if (s.kill) { down = hurt(r.t, Math.max(1, hp)) || down; if (r.tg.role === 'pc' && (r.tg.death_fail ?? 0) < 3) { r.tg.death_fail = 3; lines.push(`  ◇ ${r.t} 阈值命中——死亡(终局)`) } }
        else { const st = (r.tg.statuses && !Array.isArray(r.tg.statuses)) ? { ...r.tg.statuses } : {}; st[fm.name] = { effect: s.effect }; r.tg.statuses = st; lines.push(`  ${r.t} 上「${fm.name}」`) }
        break
      }
    }
  } else if (T?.judge) {
    for (const t of targets) {
      const tg = tgt(roster, t); if (!tg) continue
      const hp = tg.j.hp ?? 0
      for (const s of T.judge) {
        if (hp > s.hp) continue
        if (s.kill) { down = hurt(t, Math.max(1, hp)) || down; if (tg.j.role === 'pc' && (tg.j.death_fail ?? 0) < 3) { tg.j.death_fail = 3; lines.push(`  ◇ ${t} 阈值命中——死亡(终局)`) } }
        else { const st = (tg.j.statuses && !Array.isArray(tg.j.statuses)) ? { ...tg.j.statuses } : {}; st[fm.name] = { effect: s.effect }; tg.j.statuses = st; lines.push(`  ${t} 上「${fm.name}」`) }
        break
      }
    }
  } else if (T?.pool) {
    const steps = T.pool.upcastStep ? Math.max(0, Math.floor((asL - (T.pool.upcastBase ?? lvl)) / T.pool.upcastStep)) : dLvl
    const expr = T.pool.upcast && steps > 0 ? agg([T.pool.dice, ...Array(steps).fill(T.pool.upcast)].join('+')) : T.pool.dice
    const roll = rollExpr(expr); if (!roll) fail(`!骰式不合法:${expr}`)
    let pool = roll.total
    const qs = []
    for (const t of targets) { const tg = tgt(roster, t); if (tg) qs.push({ t, tg, hp: tg.j.hp ?? 0 }) }
    qs.sort((x, y) => x.hp - y.hp)
    for (const q of qs) {
      if (q.hp <= 0) continue
      if (q.hp > pool) break
      pool -= q.hp
      const st = (q.tg.j.statuses && !Array.isArray(q.tg.j.statuses)) ? { ...q.tg.j.statuses } : {}
      st[fm.name] = { effect: T.pool.effect }
      q.tg.j.statuses = st
      lines.push(`  ${q.t} 罩入「${fm.name}」(余池 ${pool})`)
    }
  } else if (T?.buff) {
    for (const t of targets) {
      const tg = tgt(roster, t); if (!tg) continue
      const st = (tg.j.statuses && !Array.isArray(tg.j.statuses)) ? { ...tg.j.statuses } : {}
      st[fm.name] = { ...(opts.at ? { applied_at: String(opts.at) } : {}), effect: T.buff.effect, ...(T.buff.mods ? { mods: T.buff.mods } : {}) }
      tg.j.statuses = st
      lines.push(`  ${t} 上「${fm.name}」${T.buff.effect}`)
    }
  } else if (T?.temp) {
    const N = /^\d+d\d+/.test(String(T.temp)) ? (rollExpr(String(T.temp)) || fail(`!骰式不合法:${T.temp}`)).total : +T.temp
    for (const t of targets) {
      const tg = tgt(roster, t); if (!tg) continue
      const cur = tg.j.temp_hp ?? 0
      if (N <= cur) continue
      tg.j.temp_hp = N
      const st = (tg.j.statuses && !Array.isArray(tg.j.statuses)) ? { ...tg.j.statuses } : {}
      const out = {}
      for (const [k, v] of Object.entries(st)) if (!(v?.temp)) out[k] = v
      out[fm.name] = { applied_at: opts.at, effect: `临时生命+${N}`, temp: N }
      tg.j.statuses = out
      lines.push(`  ${t} 临时生命+${N}`)
    }
  } else if (T?.damage && (T.bolts || T.upcastBolts)) {
    const boltN = (T?.bolts ?? 1) + (T?.upcastBolts ?? 0) * dLvl
    const per = T.hitFlat ? `${T.damage}+${T.hitFlat}` : T.damage
    for (const t of targets) {
      const tg = tgt(roster, t); if (!tg) continue
      const roll = rollExpr(String(per)); if (!roll) fail(`!骰式不合法:${per}`)
      const dmg = resistNote(tg, String(T.type ?? '').toLowerCase())(roll.total)
      lines.push(`  ${casterName}「${fm.name}」→${t}: ${per}=${roll.total}(自动命中)`)
      down = hurt(t, dmg) || down
    }
  } else {
    lines.push(`  ◇ 无掷效果——纯叙事(不落数值)`)
  }

  if (slotKey) { char[slotKey] = (char[slotKey] ?? 0) - 1 }
  if (fm.concentration === true) char.concentrating = fm.name
  return { lines, down }
}

// ── 环境伤害(damage.mjs 内核,内存化) ──
export function resolveDamage(roster, targetName, dice, type, modifier = 0) {
  const lines = []
  const tg = tgt(roster, targetName); if (!tg) fail(`!查无目标:${targetName}`)
  const r = rollExpr(dice); if (!r) fail(`!骰式不合法:${dice}`)
  let dmg = r.total + modifier
  const typeKey = String(type ?? '').toLowerCase()
  if (typeKey) {
    if ((tg.immune ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) dmg = 0
    else if ((tg.resist ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) dmg = Math.floor(dmg / 2)
    else if ((tg.vuln ?? []).some(x => typeKey.includes(String(x).toLowerCase()))) dmg *= 2
  }
  const inj = injure(tg.j, dmg)
  if (inj.before === 0 && dmg > 0 && tg.j.role === 'pc') deathHitFail(tg.j, false)
  lines.push(`  ${targetName} 环境伤害: ${dice}=${dmg}${type ? ' ' + type : ''} · hp ${inj.before}→${inj.after}`)
  if (inj.after === 0 && dmg > 0 && inj.before > 0) lines.push(`  ◇ ${targetName} 0HP——${tg.j.role === 'pc' ? '濒死计数起算' : '即死'}`)
  return { lines, down: inj.after === 0 && dmg > 0 }
}

// ── 濒死豁免(death.mjs 内核,内存化)——玩家专属,回合开始掷 ──
export function resolveDeathSave(roster, name) {
  const lines = []
  const tg = tgt(roster, name); if (!tg) fail(`!角色不存在:${name}`)
  const j = tg.j
  if (j.role !== 'pc') fail(`!濒死豁免玩家专属:${name} 非 PC`)
  if ((j.hp ?? 0) !== 0) return { lines, verdict: '未濒死', woke: false, dead: false }
  const s0 = j.death_success ?? 0, f0 = j.death_fail ?? 0
  const d = rnd(20)
  let s = s0, f = f0, verdict = '继续濒死', woke = false, dead = false
  if (d === 20) { j.hp = 1; j.death_success = 0; j.death_fail = 0; verdict = 'nat20 回 1HP 苏醒'; woke = true }
  else if (d === 1) { f = Math.min(3, f + 2); verdict = 'nat1 双败' }
  else if (d >= 10) { s = Math.min(3, s + 1); verdict = s >= 3 ? '伤势稳定' : '成功+1' }
  else { f = Math.min(3, f + 1); verdict = f >= 3 ? '死亡(终局)' : '失败+1' }
  j.death_success = s; j.death_fail = f
  if (f >= 3) dead = true
  lines.push(`  ${name} 濒死: d20=${d} → ${verdict}${f >= 3 ? ' · 三败死亡(终局)' : ''}`)
  return { lines, verdict, woke, dead }
}

// ── 先攻(initiative.mjs 内核,内存化):roll d20+敏(野性本能优势),降序 ──
export function rollInitiative(roster, names) {
  const rows = []
  for (const name of names) {
    const r = roster[name]; if (!r) fail(`!未建档:${name}`)
    const j = r.j
    let roll = rnd(20)
    if (hasFeature(j, 'feral instinct')) roll = Math.max(roll, rnd(20))
    rows.push({ name, init: roll + mod(j.dex ?? 10), j: r.j })
  }
  rows.sort((x, y) => y.init - x.init)
  return rows
}
