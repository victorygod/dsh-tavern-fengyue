// front_commit — 前端决策通道(runScript 面,非 LLM 工具):玩家点选→校验→窄写→清 pending→JSON 回执。
// op=asi(恰 2 点/上限20/CON 追溯 hp_max);op=spells(恰 2 个+存在性)。
// （op=prepare 已删 2026-09-27:「长休换准备表」UI 从未建成;spells_prepared 写入者=出生 roll + update_status(叙事期已备表,长休换备)。）
// 每笔成功在 .front-ops.jsonl 落一行「做了什么·产生什么效果」——{{get_player_ops()}} 注给 DM(玩家操作
// 不进 transcript,面板只体现结果现值,行为事件由此单独到桌;tail 无权此文件,maintenancePrompt 未提)。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { SPELL_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-core-data.mjs').href)
const { materializeSpellDetails } = await import(pathToFileURL(process.cwd() + '/../preset/lib/spell-build.mjs').href)
const { CHOICES, pendingKind } = await import(pathToFileURL(process.cwd() + '/../preset/lib/choice-data.mjs').href)
const { CLASS_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/class-core-data.mjs').href)
const inp = JSON.parse(globalThis.argv?.[0] ?? globalThis.argv ?? '{}')
const who = inp.who
const file = `characters/${who}.json`
const fail = (m, h) => { console.log(JSON.stringify({ ok: false, error: m, hint: h ?? '' })); process.exit(1) }
const okR = (r) => console.log(JSON.stringify({ ok: true, ...r }))

// 操作日志:时态无关行存最近 5 条(读方 get_player_ops 打整节;留空=无段落)。
const OPS_LOG = '.front-ops.jsonl'
function logOp(text) {
  const prior = existsSync(OPS_LOG) ? readFileSync(OPS_LOG, 'utf8').split('\n').filter(Boolean) : []
  writeFileSync(OPS_LOG, [...prior, JSON.stringify({ text })].slice(-5).join('\n') + '\n')
}
const STAT_CN = { str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力' }

existsSync(file) || fail('角色不存在', who)
let j
try { j = JSON.parse(readFileSync(file, 'utf8')) } catch (e) { fail('JSON 损坏:' + e.message) }

if (inp.op === 'asi') {
  ;(j.pending ?? []).some(p => String(p).includes('ASI')) || fail('无 ASI 待办——升级未发生或已点过')
  const stats = inp.payload?.stats ?? {}; const sum = Object.values(stats).reduce((x, y) => x + y, 0)
  // 一档一次(2026-09-22 叠档丢点修正):每次提交=恰一档 ASI,合计恰 2(+2 单属性/+1×2,RAW);
  // 只销一条标记——多档待分时其余档留待后续提交,不再一笔 filter 清光。
  Object.values(stats).every(v => Number.isInteger(v) && v >= 0) || fail('加点值须为非负整数')
  sum === 2 || fail(`本档 ASI 合计须恰为 2(现 ${sum}):+2 单属性或 +1×2——余档请下次提交`)
  const eff = []
  for (const [st, v] of Object.entries(stats)) {
    if (v === 0) continue
    const cur = j[st] ?? 10; cur + v <= 20 || fail(`${st} 超上限(现${cur})`)
    j[st] = cur + v
    eff.push(`${STAT_CN[st] ?? st} +${v}（${cur}→${j[st]}）`)
    if (st === 'con') { const d = Math.floor((cur + v - 10) / 2) - Math.floor((cur - 10) / 2); if (d > 0) { j.hp_max += (j.level ?? 1) * d; j.hp += (j.level ?? 1) * d; eff.push(`HP 上限追溯 +${(j.level ?? 1) * d}（CON 调整值 ${Math.floor((cur - 10) / 2)}→${Math.floor((cur + v - 10) / 2)}）`) } }
  }
  j.pending.splice(j.pending.findIndex(p => String(p).includes('ASI')), 1)
  writeFileSync(file, JSON.stringify(j, null, 1))
  logOp(`分配了属性点：${eff.join('，')}`)
  okR({ who, updated: stats, pending: j.pending })
} else if (inp.op === 'spells') {
  ;(j.pending ?? []).some(p => String(p).includes('新法术')) || fail('无新法术待办')
  const known = j.spells_known ?? []
  const learned = inp.payload?.learned ?? []
  learned.length === 2 || fail(`每档恰学 2 个新法术(现 ${learned.length})——学不满请整档悬置`)
  for (const s of learned) {
    const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    // 法术纯数据(SPELL_CORE 快照,2026-09-30——学法术零 lorebook 零回退);查无即拒
    const fm = SPELL_CORE[slug]?.fm
    fm || fail(`法术不存在:${s}`)
    // L3 三检:①本职业表 ②非戏法 ③环位≤可施
    const cls = String(j.class ?? '').toLowerCase()
    const classes = (Array.isArray(fm.classes) ? fm.classes : typeof fm.classes === 'string' ? fm.classes.split(',').map(c => c.trim()) : []).map(c => String(c).toLowerCase())
    classes.length && classes.includes(cls) || fail(`法术非本职业表:${s}`)
    const lvl = +fm.level
    lvl >= 1 || fail(`戏法不占新术配额:${s} 是 0 环`)
    const maxSlot = Math.max(0, ...Array.from({ length: 9 }, (_, i) => +(j[`slots_l${i + 1}`] ?? 0)).filter(v => v > 0))
    lvl <= maxSlot || fail(`环位超可施:${s}(${lvl} 环 > 可施 ${maxSlot} 环)`)
    known.push(s)
  }
  j.spells_known = known
  // 档案自含(2026-09-30):学进的新法术详情 append——spell_details 与名单双写,注入卡语义自足
  const details = materializeSpellDetails(learned)
  j.spell_details = [...(Array.isArray(j.spell_details) ? j.spell_details : []), ...details]
  j.pending.splice(j.pending.findIndex(p => String(p).includes('新法术')), 1)
  writeFileSync(file, JSON.stringify(j, null, 1))
  logOp(`学习新法术：${learned.join('、')}`)
  okR({ who, learned, pending: j.pending })
} else if (inp.op === 'choice') {   // 成长选项(2026-10-03):静态(战斗风格/宿敌/专精/祈唤/游侠子选择)选落字段;子职特判落 j.subclass
  const kind = String(inp.kind ?? '').trim()
  if (kind === 'subclass') {
    const cls = String(j.class ?? '').toLowerCase()
    const subs = (CLASS_CORE[cls]?.fm?.subclass ?? []).map(s => String(s))
    subs.length || fail(`职业 ${cls} 无子职可选`)
    const sel = (Array.isArray(inp.selected) ? inp.selected : []).map(s => String(s).trim()).filter(Boolean)
    sel.length === 1 || fail('子职恰选 1 个')
    const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const hit = subs.find(s => slug(s) === slug(sel[0]))
    hit || fail(`子职不存在:${sel[0]}(${cls})——合法 ${subs.join(' / ')}`)
    j.subclass = hit
    const pi = (j.pending ?? []).findIndex(p => pendingKind(p) === 'subclass')
    if (pi >= 0) j.pending.splice(pi, 1)
    writeFileSync(file, JSON.stringify(j, null, 1))
    logOp(`选择了子职：${hit}`)
    okR({ who, kind, subclass: j.subclass, pending: j.pending })
  } else {
    const c = CHOICES[kind] || fail(`未知成长选项:${kind}——合法 ${Object.keys(CHOICES).join(' / ')}`)
    const sel = (Array.isArray(inp.selected) ? inp.selected : []).map(s => String(s).trim()).filter(Boolean)
    sel.length >= c.min && sel.length <= c.max || fail(`选数须 ${c.min}~${c.max}(现 ${sel.length})`)
    for (const s of sel) (s in c.options) || fail(`选项不存在:${s}(${kind})——合法 ${Object.keys(c.options).join(' / ')}`)
    const uniq = [...new Set(sel)]
    uniq.length === sel.length || fail('选项重复')
    j[c.field] = c.max === 1 ? uniq[0] : uniq
    const pi = (j.pending ?? []).findIndex(p => pendingKind(p) === kind)
    if (pi >= 0) j.pending.splice(pi, 1)
    writeFileSync(file, JSON.stringify(j, null, 1))
    logOp(`选择了「${kind}」：${sel.join('、')}`)
    okR({ who, kind, [c.field]: j[c.field], pending: j.pending })
  }
} else fail('未知 op:' + inp.op)
