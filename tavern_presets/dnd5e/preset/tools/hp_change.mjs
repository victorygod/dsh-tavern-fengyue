/** @tavern-schema
{
  "description": "生命结算器(恢复四态+直改)——不掷骰的 HP 变动直接落账;传 dice 则代掷恢复骰(药水/外部掷骰回血)。何时调:恢复面归户本件——掷骰回血传 dice(短休生命骰归 rest 内嵌,不在此)、剧情恩赐传 amount(正)、回满传 full、临时生命传 temp;减损(不掷骰、无攻检)传 amount(负)。四选一。本件只登记全新事件——已结算的骰果不得用它涂改。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "target": { "type": "string", "required": true, "description": "角色名。" },
    "dice": { "type": "string", "description": "恢复骰式,如 2d4+2(药水)——代掷,钳 hp_max,0HP 恢复≥1 即苏醒;与 amount/full/temp 四选一。" },
    "modifier": { "type": "integer", "description": "恢复骰的附加调整值(仅 dice 在时有意义)。" },
    "amount": { "type": "integer", "description": "直改量,正=恢复/负=减损;与 dice/full/temp 四选一。" },
    "full": { "type": "boolean", "description": "回满至 hp_max;四选一。" },
    "temp": { "type": "integer", "description": "临时生命量(正整数)——写独立 temp_hp 池,取高不叠,不动 hp/hp_max;四选一。" },
    "name": { "type": "string", "description": "临时生命条目标签(默认「临时生命」)——存 statuses 对象表的键。" },
    "at": { "type": "string", "description": "施加时间(临时生命用)——你按当前叙事时间手写,如 '第 3 日 9 时 30 分'(对齐「当前时间」行精到分)。" }
  }
}
*/
import { pathToFileURL } from 'node:url'
const { rollExpr, resolveTarget, deathHitFail, deathSettleLine, grantTemp, injure, saveChar, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
a.target || err('缺必填 target')
if (a.temp === undefined && a.full === undefined && a.amount === undefined && a.dice === undefined) err('缺 dice(掷骰恢复)/amount(直改)/full(回满)/temp(临时生命)——四选一')
const tg = resolveTarget(a.target) || err(`查无目标:${a.target}`)
const j = tg.j

if (a.temp !== undefined) {                       // 临时生命授予(H 线):独立 temp_hp 池写+取高不叠
  const N = +a.temp; Number.isFinite(N) && N > 0 || err(`temp 不合法:${a.temp}`)
  const g = grantTemp(j, a.name ?? '临时生命', N, a.at, `临时生命+${N}，到期回收`)
  saveChar(tg.file, j)
  console.log(`[生命 · ${a.target} · 临时生命]`)
  console.log(`  落盘: ${g.note} · hp/hp_max +${g.delta} [${tg.file}]`)
} else {
  const before = j.hp ?? 0
  let after, note
  if (a.dice !== undefined) {                     // 掷骰恢复(heal 并入 2026-09-30):钳上限/苏醒双清语义与恢复路径同款
    const hr = rollExpr(a.dice); hr || err(`!骰式不合法:${a.dice}`)
    const amt = hr.total + (a.modifier ?? 0)
    if (amt < 0) err(`!恢复骰出负值:${a.dice}=${amt}——恢复不得为负,减损走 amount(负)`)
    after = Math.min(j.hp_max ?? Infinity, before + amt)
    note = `(${a.dice}=${amt}${after < before + amt ? '，钳上限' : ''})`
  }
  else if (a.full === true) { after = j.hp_max ?? before; note = '(回满)' }
  else {
    const n = +a.amount; Number.isFinite(n) || err(`amount 不合法:${a.amount}`)
    if (n < 0) { const inj = injure(j, -n); after = inj.after; note = `(${n})${inj.absorbed ? ` · 临时吸 ${inj.absorbed}` : ''}` }
    else { after = Math.min(j.hp_max ?? Infinity, before + n); note = `(+${n})` }
  }
  const woke = before === 0 && after > 0          // 任意恢复≥1HP 即醒,计数双清(RAW;dice/full/amount 三态同享)
  j.hp = after
  let extra = ''
  if (woke) { j.death_success = 0; j.death_fail = 0; extra = ' · 濒死计数双清' }
  else if (before === 0 && after === 0 && (a.amount ?? 0) < 0 && tg.j.role === 'pc') {
    // 0HP 负改=受伤同律(无掷骰=无暴击源,恒+1;稳定者重开)——同一事件禁止与掷骰件连用补计(铁则)
    const dh = deathHitFail(j, false)
    if (dh.stab) extra += ' · 稳定打破(重开濒死)'
    extra += ` · death_fail ${dh.f0}→${dh.f1}`
  }
  saveChar(tg.file, j)
  console.log(`[生命 · ${a.target} · ${a.dice !== undefined ? '掷骰恢复' : a.full === true ? '回满' : '直改'}]`)
  console.log(`  落盘: hp ${before}→${after}${note}${extra} [${tg.file}]`)
  if (woke) console.log(`  ◇ 已苏醒`)
  else if (extra && (j.death_fail ?? 0) >= 3) console.log(`  ◇ 三败——死亡(终局)`)
  else if (after === 0 && before > 0) {
    console.log(`  ◇ 0HP——${tg.j.role === 'pc' ? '濒死计数起算' : '即死'}`)
    const settle = deathSettleLine(tg.j); if (settle) console.log(settle)
  }
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
