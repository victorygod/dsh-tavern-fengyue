/** @tavern-schema
{
  "description": "施法链结算器——一切施法必经本工具（武器攻击走 attack）：位闸→效果→写盘，一次走完。何时调：施放任一法术即调，spell 必填，targets 填受影响者；伤害/治疗/升环的骰全部由语料表自动结算，治疗法术自动识别；多弹法术份额=targets 重复名单（几发几个名单位）。细则见各参数。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "spell": { "type": "string", "required": true, "description": "法术名，英文原文（如 fireball）——从 who 的法术面取（spells_known/已备 spells_prepared 在册名，并集施法），不枚举；环位/仪式/专注/豁免/伤害骰与升环增量工具按名自动读，未收录即拒绝。" },
    "caster": { "type": "string", "description": "施法者姓名，默认玩家。工具按名读档，取其施法属性与法术位。" },
    "targets": { "type": "string", "description": "受影响者名单，逗号分隔。豁免型可填多个，每人各掷一次豁免；群疗型逐人独立掷骰；多攻骰/多弹法术（如 scorching-ray、magic-missile）用重复名字表达每发去哪——三发打两个目标写 '甲,乙,甲'；单目标攻击型与单疗型只填一个名字。" },
    "as_level": { "type": "integer", "description": "升环施放时填目标环位，必须不低于法术自身环位，工具消耗对应环位的法术位；不填＝按原环位施放。" },
    "at": { "type": "string", "description": "施法时刻（增益/减益型用）——你按当前叙事时间手写，如 '第 3 日 9 时 30 分'（对齐「当前时间」行精到分）或 '第 2 轮'。" },
    "mode": { "type": "string", "description": "攻击型法术的攻击检定：adv＝优势，dis＝劣势，默认 normal。是否有优劣势由你按局面判断（隐形、伏击等）。" }
  }
}
*/
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { rnd, rollExpr, mod, pbOf, readChar, findCharFile, resolveTarget, resolveSave, deathHitFail, deathSettleLine, dropConcentration, grantTemp, injure, saveChar, rollMods, hasFeature, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { SPELL_DATA } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-data.mjs').href)
const { SPELL_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-core-data.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.spell || err('缺必填 spell')
const casterName = a.caster ?? '玩家'
const char = readChar(casterName)
;(char.caster_attr === undefined || char.caster_attr === null) && err('!无施法能力（该角色无施法族）')
const casterFile = findCharFile(casterName)
// 收录闸(2026-09-28 审计批 A3;2026-09-30 拓宽法术面=known∪prepared 并集施法):法术面是施法族
// 「声明则必全」的既定面,本闸是它迟到已久的读者——幻觉施法(面上没有的法术)在此拦死。
// 准备制职业(cleric/druid 出生如 opening_commit:known=戏法列+prepared 分置)靠并集施放已备法术。
// slug 归一比较,大小写/空格/连字符差异不敏感。
const wanted = a.spell.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const pool = [...(Array.isArray(char.spells_known) ? char.spells_known : []), ...(Array.isArray(char.spells_prepared) ? char.spells_prepared : [])].map(s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')).filter(Boolean)
pool.includes(wanted) || err(`!施法者未收录:${a.spell} 不在 ${casterName} 的法术面(spells_known/已备)${pool.length ? '' : '（现表空——施法族声明不全,查出生登记）'}`)

const spellSlug = a.spell.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const spellCore = SPELL_CORE[spellSlug]
const fm = spellCore?.fm
fm?.name || err(`!法术查不到:${a.spell}`)
const lvl = fm.level ?? 0
const asL = a.as_level ?? lvl
asL < lvl && err(`!升环校验失败:as_level(${asL}) < 法术环位(${lvl})`)

// ── 闸区:位检(戏法/仪式免位)·专注 RAW 覆写 ──
const gate = []
let slotKey = null
if (fm.ritual === true) gate.push('仪式免位(+10 分钟)')
else if (lvl === 0) gate.push('戏法免位')
else {
  slotKey = 'slots_l' + Math.max(asL, 1)
  const have = char[slotKey] ?? 0
  have >= 1 || err(`!无 ${asL} 环位可施(现 ${have})——改日/换低环/玩家决策`)
  gate.push(`位检:✓(${slotKey} 剩 ${have})`)
}
let concLine = '专注:不需'
if (fm.concentration === true) {
  concLine = char.concentrating && char.concentrating !== fm.name
    ? `专注:顶替旧专注「${char.concentrating}」→${fm.name}(RAW 覆写,自动弃旧)`
    : `专注:✓(本术需专注)`
}
const lines = [`[施法 · ${casterName}→${fm.name}${asL > lvl ? '(升 ' + asL + ' 环)' : ''}]`, `  闸区: ${gate.join(' · ')} · ${concLine}`]
// 效果行(2026-09-30 回执补全):本术效果原文随回执进转录——纯叙事法术(飞行/幻术/召唤类)自此有据可依,
// 语义裁决材料=档案 spell_details 与回执双源;超长截断(全档在 spell_details)。
const effectText = (spellCore?.effect ?? '').trim()
if (effectText) lines.push(`  效果: ${effectText.length > 1200 ? effectText.slice(0, 1200) + '…(全文在档案 spell_details)' : effectText}`)
const DC = 8 + pbOf(char.level ?? 1) + mod(char[char.caster_attr] ?? 10)

// ── 选骰:语料表(基础+升环 N 档/戏法角色档/治疗含施法属性内算) > FM damage 字段(手写语料) ──
// 零逃生舱:多弹份额=targets 重复名单;语料变体=改语料数值本身;表外=err 逼补表(语料完备 forcing)
const T = SPELL_DATA[a.spell.toLowerCase().replace(/[^a-z0-9]+/g, '-')]
const dLvl = Math.max(0, asL - lvl)
const charLvl = char.level ?? 1
const cantripTier = 1 + (charLvl >= 5 ? 1 : 0) + (charLvl >= 11 ? 1 : 0) + (charLvl >= 17 ? 1 : 0) // 戏法伤害随角色档(PHB)
const agg = s => { const pool = {}, flat = { n: 0 }; for (const t of String(s).split('+')) { const mm = t.match(/^(\d+)d(\d+)$/); if (mm) pool[mm[2]] = (pool[mm[2]] ?? 0) + +mm[1]; else flat.n += +t } return Object.entries(pool).map(([y, x]) => `${x}d${y}`).concat(flat.n ? [String(flat.n)] : []).join('+') }
const scaleDice = (dice, mult) => { const mm = String(dice).match(/^(\d+)d(\d+)([+-]\d+)?$/); return mm ? `${+mm[1] * mult}d${mm[2]}${mm[3] ? '+' + Math.abs(+mm[3]) * mult : ''}` : Array(mult).fill(dice).join('+') }
const tblDice = T && T.damage && !T.bolts && !T.upcastBolts
  ? (() => {
      if (T.cantripScale) return scaleDice(T.damage, cantripTier)
      const steps = T.upcastStep ? Math.max(0, Math.floor((asL - T.upcastBase) / T.upcastStep)) : dLvl
      return T.upcast && steps > 0 ? agg(`${T.damage}+${Array(steps).fill(T.upcast).join('+')}`) : T.damage
    })()
  : null
// suppress(2026-09-28 审计批 A1):T 级伤害面封死——语料数字属实但非施放时点直伤(mishap/骑手/地形/条件款),
// 表与 FM 兜底双通道都断,结算止于闸区与位耗;后续事件按 RAW 用 damage/check 工具逐次结算。
const dice = T?.suppress === true ? null : tblDice ?? fm.damage
const saveKey = String(fm.save ?? T?.save ?? '').trim().toLowerCase()   // T.save=豁免覆写(修 FM 洞,判决表 §1.3)
const healDice = (T?.heal ? agg([T.heal, ...Array(dLvl > 0 ? dLvl : 0).fill(T.upcast ?? '')].filter(Boolean).join('+')) : null) ?? fm.heal ?? null
const healFlat = (T?.healFlat ?? 0) + (T?.healFlatOnly ?? 0) + (T?.healMod ? mod(char[char.caster_attr] ?? 10) : 0)
  + (T?.healFlatPerLevel ? T.healFlatPerLevel.per * Math.max(0, asL - T.healFlatPerLevel.from) : 0)   // 环位平值成长(heal +10/环·aid +5/环)
const targets = String(a.targets ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean)

// hp 减损落盘(与 damage 同律:抗免由调用方先应用;0HP 受击自动落败=deathHitFail 单源;0HP 分叉)
function hurt(t, dmg, crit = false) {
  const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
  const inj = injure(tg.j, dmg)
  const before = inj.before, after = inj.after
  let extra = ''
  if (before === 0 && dmg > 0 && tg.j.role === 'pc') {
    const dh = deathHitFail(tg.j, crit)
    if (dh.stab) extra += ' · 稳定打破(重开濒死)'
    extra += ` · death_fail ${dh.f0}→${dh.f1}`
  }
  saveChar(tg.file, tg.j)
  lines.push(`  落盘: ${t} hp ${before}→${after}${extra} [${tg.file}]`)
  if (extra) {
    lines.push(`  ◇ 0HP 受击——濒死败+${crit ? 2 : 1}${crit ? '(暴击源)' : ''}`)
    if (tg.j.death_fail >= 3) lines.push(`  ◇ 三败——死亡(终局)`)
  }
  else if (after === 0 && dmg > 0) {
    lines.push(`  ◇ 0HP——${tg.j.role === 'pc' ? '濒死计数起算' : '即死'}`)
    const settle = deathSettleLine(tg.j); if (settle) lines.push(settle)
  }
}
function resistNote(tg, typeKey) {
  // 2026-09-28 审计批 B3:豁免/自动弹分支同律接入(与 attack 同一函数,易伤×2 补齐)。
  if (!typeKey) return dmg => dmg
  const hit = arr => (arr ?? []).some(x => typeKey.includes(String(x).toLowerCase()))
  if (hit(tg.immune)) return () => { lines.push('  抗性: 免疫→0'); return 0 }
  if (hit(tg.resist)) return d => { const h = Math.floor(d / 2); lines.push('  抗性: 减半↓'); return h }
  if (hit(tg.vuln ?? tg.vulnerabilities)) return d => { lines.push('  抗性: 易伤×2'); return d * 2 }
  return d => d
}

// judge 断定面(2026-09-29 补录):施放时点按当前 HP 的阈值档,power-word 族无豁免直断,divine-word 挂在豁免失败者上。
// kill 档走 hurt 单源(0HP 分叉/与 damage 同律),PC 命中再补 death_fail=3(断定即死,非濒死起算);条件档写 statuses(键=法术名,与 buff 分支一致)。
function judgeApply(t, tg) {
  const hp = tg.j.hp ?? 0
  for (const s of T.judge) {
    if (hp > s.hp) continue
    if (s.kill) {
      hurt(t, Math.max(1, hp))
      const fk = findCharFile(t); const jk = JSON.parse(readFileSync(fk, 'utf8'))
      if (jk.role === 'pc' && (jk.death_fail ?? 0) < 3) { jk.death_fail = 3; saveChar(fk, jk); lines.push(`  ◇ ${t} 阈值 ${s.hp} 命中——断定即死,死亡(终局)`) }
      else lines.push(`  ◇ ${t} 阈值 ${s.hp} 命中——0HP(非 PC 即死)`)
    } else {
      const st = (tg.j.statuses && !Array.isArray(tg.j.statuses)) ? tg.j.statuses : {}
      st[fm.name] = { ...(a.at ? { applied_at: String(a.at) } : {}), effect: s.effect }
      tg.j.statuses = st
      const f = findCharFile(t)
      saveChar(f, tg.j)
      lines.push(`  落盘: ${t} statuses「${fm.name}」${s.effect} [${f}]`)
    }
    return
  }
  lines.push(`  ◇ ${t} hp ${hp} 超阈值(阈值 ${T.judge[T.judge.length - 1].hp})——无断定效果`)
}

// onFail 落状态(2026-09-29 补录):豁免失败的机械后果入 statuses——此前只报布尔,失败后果全靠叙事追认。
function onFailApply(r) {
  const st = (r.tg.statuses && !Array.isArray(r.tg.statuses)) ? r.tg.statuses : {}
  st[fm.name] = { ...(a.at ? { applied_at: String(a.at) } : {}), effect: T.onFail.effect, ...(T.onFail.mods ? { mods: T.onFail.mods } : {}) }
  r.tg.statuses = st
  const f = findCharFile(r.t)
  saveChar(f, r.tg)
  lines.push(`  落盘: ${r.t} statuses「${fm.name}」${T.onFail.effect} [${f}]`)
}

if ((healDice || healFlat || T?.healPool || T?.raise || T?.stabilize) && !fm.attack_type && !saveKey) {  // 治疗/翻生型内联(判据=T 显式 healPool/raise/stabilize 或 heal 面;骰自动=语料表;A2=群疗逐人独立掷)
  targets.length || err('!治疗型需 targets')
  const hasSource = !!(healDice || healFlat || T?.healPool || T?.raise || T?.stabilize)
  if (!hasSource) err('!治疗骰无源——语料表缺且未传 dice(照法术正文抄)')
  if (T?.stabilize) {                          // 稳定术:玩家面专享(同伴/怪 0HP 即死,death.mjs 同律)
    targets.length === 1 || err('!稳定术只收一名 0HP 者')
    const tg = resolveTarget(targets[0]); tg || err(`!查无目标存档:${targets[0]}`)
    ;(tg.j.hp ?? 0) === 0 || err(`!${targets[0]} hp≠0——未濒死,不走稳定术`)
    tg.j.role === 'pc' || err(`!${targets[0]} 非 PC(同伴/怪 0HP 即死)——稳定术无对象`)
    tg.j.death_success = 3
    saveChar(tg.file, tg.j)
    lines.push(`  落盘: ${targets[0]} death_success→3(伤势稳定,1d4 小时自然醒) [${tg.file}]`)
  } else if (T?.raise) {                       // 翻生族:revivify/raise-dead/resurrection——死者回 hp 定额;penalty 只回执留痕,账归叙事
    targets.length === 1 || err('!翻生术只收一名死者')
    const tg = resolveTarget(targets[0]); tg || err(`!查无目标存档:${targets[0]}`)
    ;(tg.j.hp ?? 0) === 0 || err(`!${targets[0]} hp≠0——翻生只收已死者`)
    const b = tg.j.hp ?? 0
    const amt = T.raise.hp === 'full' ? (tg.j.hp_max ?? 0) : +(T.raise.hp || 1)
    tg.j.hp = amt
    tg.j.death_success = 0; tg.j.death_fail = 0
    saveChar(tg.file, tg.j)
    lines.push(`  落盘: ${targets[0]} hp ${b}→${amt} · 濒死计数双清${T.raise.penalty ? ` · ⚠ ${T.raise.penalty}` : ''} [${tg.file}]`)
  } else if (T?.healPool) {                    // 总池分配(mass-heal):名单次序逐员补到 hp_max,余池回显
    let pool = +(T.healPool || 0)
    lines.push(`  治疗判定: 总池 ${pool} HP——按名单次序分配(至多补到 hp_max)`)
    for (const t of targets) {
      if (pool <= 0) break
      const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
      const b = tg.j.hp ?? 0
      const amt = Math.min(Math.max(0, (tg.j.hp_max ?? Infinity) - b), pool)
      if (amt <= 0) { lines.push(`  ◇ ${t} 满血——跳过(余池 ${pool})`); continue }
      pool -= amt
      tg.j.hp = b + amt
      saveChar(tg.file, tg.j)
      lines.push(`  落盘: ${t} hp ${b}→${tg.j.hp}(余池 ${pool}) [${tg.file}]`)
    }
    if (pool > 0) lines.push(`  ◇ 余池 ${pool} 未用尽——名单不足即弃置(RAW)`)
  } else {
    if (T?.healMulti !== true && targets.length > 1) err(`!${fm.name} 是单目标治疗法术——只填一人(群疗系才可多人,逐人各掷)`)
    for (const t of targets) {
    const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
    const r = healDice ? (rollExpr(healDice) || err(`!骰式不合法:${healDice}`)) : null
    const amt = (r ? r.total : 0) + healFlat
    const before = tg.j.hp ?? 0
    if (T?.hpMaxBoost === true) tg.j.hp_max = (tg.j.hp_max ?? 0) + amt   // 上限成长族(aid/heroes-feast):补上限再回血
    const after = T?.hpMaxBoost === true ? before + amt : Math.min(tg.j.hp_max ?? Infinity, before + amt)
    const woke = before === 0 && after > 0
    tg.j.hp = after
    let extra = ''
    if (woke) { tg.j.death_success = 0; tg.j.death_fail = 0; extra = ' · 濒死计数双清' }
    saveChar(tg.file, tg.j)
    lines.push(`  治疗判定: ${t} ${healDice ? (healFlat ? `${healDice} 掷 ${r.total} + ${healFlat} = ${amt}` : `${healDice} = ${amt}`) : `平值 ${amt}`}`)
    lines.push(`  落盘: ${t} hp ${before}→${after}${after < before + amt && r ? '(钳上限)' : ''}${extra} [${tg.file}]`)
    if (woke) lines.push(`  ◇ ${t} 已苏醒`)
    }
  }
  if (T?.hpMaxBoost === true) lines.push(`  ◇ 命上限 +——到期回降,倒计时归叙事`)
} else if (fm.attack_type) {                   // 攻击型:命中链(attack.spell 已删,唯一入口);多攻骰型逐目标独立攻检(A2),statuses 攻检修正入掷(B1:每枚各掷各的)
  targets.length || err('!攻击型法术需 targets')
  if (!T?.bolts && targets.length > 1) err(`!${fm.name} 是单目标攻击型法术——只填一人(多攻骰型用重复名单位)`)
  const boltN = (T?.bolts ?? 0) + (T?.upcastBolts ?? 0) * dLvl
  if (T?.bolts && targets.length !== boltN) err(`!多弹份额=targets 重复名单:${boltN} 发需 ${boltN} 个名单位(可重复),现 ${targets.length}`)
  const baseAb = pbOf(char.level ?? 1) + mod(char[char.caster_attr] ?? 10)
  for (const t of targets) {
    const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
    const bm = rollMods(char, ['attack', 'attack_save'])
    const ab = baseAb + bm.flat
    const down0 = (tg.j.hp ?? 0) === 0
    const d1 = rnd(20), d2 = rnd(20)
    const d = a.mode === 'adv' ? Math.max(d1, d2) : a.mode === 'dis' ? Math.min(d1, d2) : d1
    const nat20 = d === 20, nat1 = d === 1
    const hit = nat20 || (!nat1 && d + ab >= tg.ac)
    const autoCrit = down0 && String(fm.attack_type).toLowerCase().includes('melee')  // 濒死自动暴击(RAW·触及类定义上即在5尺内,无需申辩)
    lines.push(`  命中判定: ${t} d20+${ab}${a.mode === 'adv' ? `(优:${d1},${d2})` : a.mode === 'dis' ? `(劣:${d1},${d2})` : ''} = ${d + ab} vs AC ${tg.ac}(${tg.source}) → ${nat1 ? 'nat1 必失' : nat20 ? 'nat20+暴击' : hit ? '命中' : '未命中'}`)
    if (bm.parts.length) lines.push(`  状态修正: ${bm.parts.join(' · ')}`)
    const rayDice = dice ?? (T?.bolts ? T.damage : null)   // 多攻骰型(bolts+attack_type):tblDice 排除 bolts,威胁源=T.damage 每发伤害(如 scorching-ray 2d6/发)
    if (hit && rayDice) {
      const crit = nat20 || autoCrit
      const ex = crit ? String(rayDice).replace(/^(\d+)d/, (m, n) => `${+n * 2}d`) : String(rayDice)
      const r = rollExpr(ex); r || err(`!骰式不合法:${ex}`)
      const typeKey = String(T?.type ?? fm.damage_type ?? '').toLowerCase()
      const dmg = resistNote(tg, typeKey)(r.total)
      lines.push(`  伤害判定: ${ex} = ${dmg} ${fm.damage_type ?? ''}${crit && !nat20 ? '(濒死自动暴击·翻骰)' : ''}`)
      hurt(t, dmg, crit)
    }
    else if (hit && !rayDice) lines.push(`  ◇ ${t} 命中无伤害——本术语料无伤害骰,效果即命中`)
  }
} else if (saveKey) {                          // 豁免型:逐目标(目标侧 save/attack_save 修正入豁免 B1;抗免+平值+半伤对总额 B3;saveKey=T 级覆写修 FM 洞)
  targets.length || err('!豁免型法术需 targets')
  const save = saveKey
  const typeKey = String(T?.type ?? fm.damage_type ?? '').toLowerCase()
  const hitFlat = T?.hitFlat ?? 0              // disintegrate +40/finger-of-death +30——RAW:失败=骰+平值全伤,成功=对总额减半
  const rolls = []
  for (const t of targets) {
    const sv = resolveSave(t, save)
    sv || err(`!查无目标存档:${t}`)
    const d = rnd(20), total = d + sv.bonus, pass = total >= DC
    rolls.push({ t, pass, tg: sv.j })
    lines.push(`  豁免判定 ${t}: d20+${sv.bonus} = ${total} vs DC ${DC} → ${pass ? '通过' : '失败'}`)
    if (sv.parts.length) lines.push(`  状态修正 ${t}: ${sv.parts.join(' · ')}`)
  }
  if (dice) for (const r of rolls) {
    const roll = rollExpr(String(dice)); roll || err(`!骰式不合法:${dice}`)
    const base = roll.total + hitFlat
    // 闪避(2026-10-03):敏豁免半伤型——成功免伤(非半伤),失败半伤(非全伤)。机械进工具。
    const eva = fm.half_on_save === true && String(save).toLowerCase() === 'dex' && hasFeature(r.tg, 'evasion')
    const half = r.pass && fm.half_on_save === true
    const halfDmg = eva ? (r.pass ? 0 : Math.floor(base / 2)) : (half ? Math.floor(base / 2) : base)
    lines.push(`  伤害判定: ${r.t} ${dice}=${roll.total}${hitFlat ? '+' + hitFlat : ''}${eva ? (r.pass ? '(闪避→免伤)' : '(闪避→半伤)') : half ? '(半伤:对总额减半)' : ''} → ${halfDmg} ${fm.damage_type ?? T?.type ?? ''}`)
    if (halfDmg > 0) hurt(r.t, resistNote(r.tg, typeKey)(halfDmg))
  }
  else lines.push(`  ◇ 无伤害骰——豁免即效果`)
  if (T?.onFail) for (const r of rolls) if (!r.pass) onFailApply(r)
  if (T?.judge) for (const r of rolls) if (!r.pass) judgeApply(r.t, r.tg)
} else if (T?.judge) {                         // 断定型(无豁免):当前 HP 直断,power-word 族——阈值首中档即用
  targets.length || err('!断定型法术需 targets')
  for (const t of targets) { const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`); judgeApply(t, tg) }
} else if (T?.pool) {                          // 额度罩池型:掷骰=HP 额度,目标按当前 HP 升序罩(sleep/color-spray 同型)
  targets.length || err('!额度罩池型需 targets')
  const steps = T.pool.upcastStep ? Math.max(0, Math.floor((asL - (T.pool.upcastBase ?? lvl)) / T.pool.upcastStep)) : dLvl
  const expr = T.pool.upcast && steps > 0 ? agg([T.pool.dice, ...Array(steps).fill(T.pool.upcast)].join('+')) : T.pool.dice
  const roll = rollExpr(expr) || err(`!骰式不合法:${expr}`)
  let pool = roll.total
  lines.push(`  额度判定: ${expr} = ${pool}(HP 罩池——按当前 HP 升序罩,装不下即止)`)
  const qs = []
  for (const t of targets) { const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`); qs.push({ t, tg, hp: tg.j.hp ?? 0 }) }
  qs.sort((x, y) => x.hp - y.hp)
  for (const q of qs) {
    if (q.hp <= 0) { lines.push(`  ◇ ${q.t} 已昏迷——罩池跳过(RAW 不占额度)`); continue }
    if (q.hp > pool) { lines.push(`  ◇ 额度不足:${q.t} hp ${q.hp} > 余 ${pool}——后续皆装不下,即止`); break }
    pool -= q.hp
    const st = (q.tg.j.statuses && !Array.isArray(q.tg.j.statuses)) ? q.tg.j.statuses : {}
    st[fm.name] = { ...(a.at ? { applied_at: String(a.at) } : {}), effect: T.pool.effect }
    q.tg.j.statuses = st
    saveChar(q.tg.file, q.tg.j)
    lines.push(`  落盘: ${q.t} hp ${q.hp} 罩入(扣池→余 ${pool}) statuses「${fm.name}」${T.pool.effect} [${q.tg.file}]`)
  }
} else if (T?.buff) {                          // 增益/减益型:statuses 对象 map 覆盖式写(同名 key 直接覆盖);武器附伤骑手(divine-favor/branding-smite)的 damage mods 由 attack 伤害侧掷算
  targets.length || err('!增益/减益型需 targets')
  for (const t of targets) {
    const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
    const st = (tg.j.statuses && !Array.isArray(tg.j.statuses)) ? tg.j.statuses : {}
    st[fm.name] = { ...(a.at ? { applied_at: String(a.at) } : {}), effect: T.buff.effect, ...(T.buff.mods ? { mods: T.buff.mods } : {}) }
    tg.j.statuses = st
    saveChar(tg.file, tg.j)
    lines.push(`  落盘: ${t} statuses「${fm.name}」${T.buff.effect} [${tg.file}]`)
  }
  if (fm.concentration === true) lines.push(`  ◇ 专注类:被打断/顶替时由尾代销毁同名条目(C2 落地后由 cast 顶替自动销毁)`)
} else if (T?.temp) {                          // 临时生命授予(H 线):独立 temp_hp 池写 + 取高不叠(Combining)
  targets.length || err('!临时生命型需 targets')
  const N = /^\d+d\d+/.test(String(T.temp)) ? (rollExpr(String(T.temp)) || err(`!骰式不合法:${T.temp}`)).total : +T.temp
  for (const t of targets) {
    const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
    const g = grantTemp(tg.j, fm.name, N, a.at, `临时生命+${N}，到期回收`)
    saveChar(tg.file, tg.j)
    lines.push(`  落盘: ${t} ${g.note} · hp/hp_max +${g.delta} [${tg.file}]`)
  }
} else if (T?.damage && (T.bolts || T.upcastBolts)) {  // 自动型内联(魔法飞弹类):份额=targets 重复名单,逐弹独立掷+抗免(B3);触发收窄(A1)——仅表内显式 bolts 声明,fm.damage 兜底不再能致自动伤害
  targets.length || err('!自动伤害型需 targets')
  const boltN = (T?.bolts ?? 1) + (T?.upcastBolts ?? 0) * dLvl
  if (T?.bolts && targets.length !== boltN) err(`!多弹份额=targets 重复名单:${boltN} 发需 ${boltN} 个名单位(可重复),现 ${targets.length}`)
  const per = T.hitFlat ? `${T.damage}+${T.hitFlat}` : T.damage
  for (const t of targets) {
    const tg = resolveTarget(t); tg || err(`!查无目标存档:${t}`)
    const roll = rollExpr(String(per)); roll || err(`!骰式不合法:${per}`)
    const dmg = resistNote(tg, String(T.type ?? '').toLowerCase())(roll.total)
    lines.push(`  伤害判定: ${t} ${per} = ${roll.total}(自动命中)`)
    hurt(t, dmg)
  }
} else {                                       // 其余=无掷效果(护盾/隐形/位移类 T.suppress 条件款):只过闸与落位(A1:显式回执,不动数值)
  lines.push('  ◇ 无掷效果——效果归叙事/状态工具(本术语料无施放时点的掷面)')
}

// ── 施法者写盘:位耗 + 专注覆写 ──
// 重读实盘再写:自施法(目标=施法者)时目标写盘先行,用开头的陈旧快照整档回写会把 hp 拍回去(clobber)。
if (slotKey || fm.concentration === true) {
  const oldConc = (fm.concentration === true && char.concentrating && char.concentrating !== fm.name) ? char.concentrating : null
  const dropRemoved = oldConc ? dropConcentration(casterName).removed : []
  const fresh = JSON.parse(readFileSync(casterFile, 'utf8'))
  if (slotKey) { const b = fresh[slotKey] ?? 0; fresh[slotKey] = b - 1; lines.push(`  落盘: ${slotKey} ${b}→${b - 1} [${casterFile}]`) }
  if (fm.concentration === true) { fresh.concentrating = fm.name; lines.push(`  落盘: concentrating ${char.concentrating ?? '无'}→${fm.name} [${casterFile}]`) }
  saveChar(casterFile, fresh)
  for (const r of dropRemoved) lines.push(`  落盘: ${r.name} statuses −「${r.key}」 [${r.file}]`)
}
lines.push(`  ◇ 梗概: ${a.context}`)
lines.push(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
console.log(lines.join('\n'))
