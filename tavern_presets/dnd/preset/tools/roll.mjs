/** @tavern-schema
{
  "description": "地下城主掷骰结算器,本卡所有骰值的唯一来源。调用时机:结果不确定且带后果的当口(行动/攻击/豁免/对抗检定,伤害·治疗·附加结算,升级成长);必成、必败、纯叙事推进不调用。判定步=传 dc 不传 dice(恒 1d20);结算步=传 dice 不传 dc;对抗检定双方各调一次;用途含『升级』或『成长』即走 1d6 随机成长分支。成败、暴击、难度措辞都以返回行为准——绝不凭空写骰值、不复用历史骰值、不改写返回结果;正文把『[掷骰 #N · …]』结果行原样织入对应交锋处。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "已构思定型的剧情梗概(从上次玩家消息或上次掷骰→本判定点):你对剧情走向的承诺,骰值只裁定此刻成败、不得覆盖它;连续判定时以最新进度重新概括。一句话、勿换行" },
    "purpose": { "type": "string", "required": true, "description": "本次掷骰用途:攻击命中/行动检定/豁免检定/对抗检定/伤害结算/治疗结算/升级成长(含『升级』『成长』字样即走成长分支,恒 1d6)" },
    "dice": { "type": "string", "description": "结算步骰式 NdM(1d8、2d6;徒手/临时武器 1d4)。判定步不传(恒 1d20)" },
    "modifier": { "type": "integer", "description": "你唯一要自己算的参数=相关属性调整值+技能等级加值+临时状态加值,可负,默认 0。属性调整值=(属性值−10) 向下取整(−5~+5);力量→近战/力量判定,敏捷→远程/先攻/闪避,体质→生命,智力→法术/知识,感知→洞察/察觉,魅力→说服/欺瞒/威吓" },
    "dc": { "type": "integer", "description": "判定步必填,难度标尺 5 极易/10 容易/15 中等/20 困难/25 极难/30 近乎不可能。结算步不传" }
  }
}
*/
// 结算器内部规则(nat 1/20、Crit 翻倍、DC 标尺、成长映射、rolls.log 流水)全部封装于此,
// 提示词只负责调用协议。v2:参数对象在全局 args(由 @tavern-schema 块注入);cwd = runtime/。
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const LOG = 'rolls.log'

const bad = msg => { console.log('!' + msg); process.exit(1) }
const norm = v => String(v ?? '').replaceAll('', '').trim()

// ---- 参数校验(v2:args 为 @tavern-schema 注入的对象) ----
const ctx = norm(args.context)
const pur = norm(args.purpose)
if (ctx === '') bad('缺少必填参数 context:把从上次玩家消息(或上次掷骰)到本判定点之间已构思定型的剧情梗概写进 context(一句话、勿换行)——它是你对后续剧情走向的承诺,骰值不得覆盖它')
if (pur === '') bad('缺少必填参数 purpose:本次掷骰用途(攻击命中/行动检定/豁免检定/对抗检定/伤害结算/治疗结算/升级成长)')
let mod = args.modifier === undefined || args.modifier === null || args.modifier === '' ? 0 : Number(args.modifier)
if (!Number.isInteger(mod)) bad('modifier 必须是整数(可为负)')
let dc = ''
if (args.dc !== undefined && args.dc !== null && args.dc !== '') {
  const n = Number(args.dc)
  if (!Number.isInteger(n)) bad('dc 必须是整数(5 极易 ~ 30 近乎不可能)')
  dc = String(n)
}
const dice = String(args.dice ?? '').trim().toLowerCase()

// ---- rolls.log 掷骰流水(Crit 翻倍链回扫用):字段 = 序号/类型/用途/骰式/调整/DC/骰值明细/总计/结果/标记/剧情梗概 ----
const readLog = () => existsSync(LOG) ? readFileSync(LOG, 'utf8').trimEnd().split('\n').filter(Boolean) : []
const nextSeq = () => {
  const log = readLog()
  return log.length === 0 ? 0 : Number(log[log.length - 1].split('\t')[0])
}
const SEQ = nextSeq() + 1

// 自最近一次结算向前找最近的判定:其间未被消费的攻击 nat20 命中 → 本次结算骰子翻倍
function critPending() {
  const log = readLog()
  for (let i = log.length - 1; i >= 0; i -= 1) {
    const fields = log[i].split('\t')
    const type = fields[1]
    if (type === '结算') return false
    if (type === '判定') return (fields[9] ?? '').includes('crit')
  }
  return false
}

function dcLabel(n) {
  if (n <= 5) return '极易'
  if (n <= 10) return '容易'
  if (n <= 15) return '中等'
  if (n <= 20) return '困难'
  if (n <= 25) return '极难'
  if (n <= 30) return '近乎不可能'
  return '超越常规'
}

function signMod() {
  if (mod === 0) return ''
  if (mod > 0) return `+${mod}`
  return `${mod}`
}
const modPart = signMod()

function appendLog(type, diceForm, dc, vals, total, result, flags) {
  const row = [SEQ, type, pur, diceForm, mod, dc, vals, total, result, flags ?? '-', ctx].join('\t')
  let log = readLog()
  log.push(row)
  if (log.length > 400) log = log.slice(log.length - 200)
  writeFileSync(LOG, log.join('\n') + '\n')
}

function footer() {
  console.log(`◇ 已锁定剧情梗概:${ctx}\n◇ 铁则:后续剧情必须承接上述梗概,把本次骰值编织进去;骰值只裁定此刻结果,不得改写已构思的剧情走向与利害。`)
}

// ---- 升级成长:1d6 → 属性 +1,映射封装在脚本内 ----
if (pur.includes('升级') || pur.includes('成长')) {
  const nat = Math.floor(Math.random() * 6) + 1
  const attrs = ['力量(STR)', '敏捷(DEX)', '体质(CON)', '智力(INT)', '感知(WIS)', '魅力(CHA)']
  const attr = attrs[nat - 1]
  appendLog('成长', '1d6', '-', String(nat), String(nat), `成长:${attr} +1`, '-')
  console.log(`[掷骰 #${SEQ} · ${pur}] 1d6 → 骰出 ${nat} → ${attr} +1`)
  footer()
  process.exit(0)
}

// ---- 判定步:DC 在场即判定,恒 1d20 ----
if (dc !== '') {
  if (dice !== '1d20' && dice !== '') console.log(`- 判定步恒 1d20:忽略传入骰式 ${dice}`)
  const nat = Math.floor(Math.random() * 20) + 1
  const total = nat + mod
  const lbl = dcLabel(Number(dc))
  let arc, note
  if (nat === 1) { arc = '大失败(反噬)'; note = '- 自然 1:行动反噬,逆向后果由叙事裁量。' }
  else if (nat === 20) { arc = '大成功(额外收益)'; note = '- 自然 20:额外收益由叙事裁量。' }
  else if (total >= Number(dc)) { arc = '成功'; note = '' }
  else { arc = '失败'; note = '' }
  let critFlag = '-'
  if (nat === 20 && (pur.includes('攻击') || pur.includes('命中'))) {
    critFlag = 'crit-pending'
    note = '- 命中掷出自然 20:下一次结算步的伤害骰将自动翻倍。'
  }
  appendLog('判定', '1d20', dc, String(nat), String(total), arc, critFlag)
  console.log(`[掷骰 #${SEQ} · ${pur} · DC ${dc}(${lbl})] 1d20${modPart} → 自然骰 ${nat},合计 ${total} → ${arc}`)
  if (note !== '') console.log(note)
  footer()
  process.exit(0)
}

// ---- 结算步:伤害/治疗/附加骰 ----
const settle = /^(\d{1,2})d(\d{1,3})$/.exec(dice)
if (settle === null) {
  console.log('!结算步(伤害/治疗/附加)必须提供骰式参数 dice(如 1d8、2d6;徒手/临时武器 1d4);判定步才省略 dice 改传 dc。')
  process.exit(1)
}
let n = Number(settle[1])
const m = Number(settle[2])
if (n < 1 || n > 20) { console.log(`!骰数须在 1~20 之间(收到 ${n}d${m})`); process.exit(1) }
if (m < 2) { console.log(`!骰面数须 ≥2(收到 ${n}d${m})`); process.exit(1) }
let critNote = ''
if (critPending()) {
  n *= 2
  critNote = ' · 前掷命中的自然 20 生效,骰子翻倍'
}
const vals = []
let sum = 0
for (let i = 1; i <= n; i += 1) {
  const r = Math.floor(Math.random() * m) + 1
  sum += r
  vals.push(String(r))
}
const total = sum + mod
appendLog('结算', `${n}d${m}`, '-', vals.join('+'), String(total), `结果 ${total}`, '-')
console.log(`[掷骰 #${SEQ} · ${pur}${critNote}] ${n}d${m}${modPart} → 骰出 ${vals.join('+')},合计 ${sum}${modPart} = ${total}`)
footer()
process.exit(0)
