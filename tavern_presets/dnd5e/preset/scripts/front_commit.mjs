// front_commit — 前端决策通道(runScript 面,非 LLM 工具):玩家点选→校验→窄写→清 pending→JSON 回执。
// op=asi(恰 2 点/上限20/CON 追溯 hp_max);op=spells(恰 2 个+存在性);op=prepare(⊆known)。
// 每笔成功在 .front-ops.jsonl 落一行「做了什么·产生什么效果」——{{get_player_ops()}} 注给 DM(玩家操作
// 不进 transcript,面板只体现结果现值,行为事件由此单独到桌;tail 无权此文件,maintenancePrompt 未提)。
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
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
    if (st === 'con') { j.hp_max += (j.level ?? 1) * v; j.hp += (j.level ?? 1) * v; eff.push(`HP 上限追溯 +${(j.level ?? 1) * v}（现 ${j.hp}/${j.hp_max}）`) }
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
    existsSync(`dnd5e-srd-lorebook/spells/${slug}.md`) || fail(`法术不存在:${s}`)
    known.push(s)
  }
  j.spells_known = known
  j.pending.splice(j.pending.findIndex(p => String(p).includes('新法术')), 1)
  writeFileSync(file, JSON.stringify(j, null, 1))
  logOp(`学习新法术：${learned.join('、')}`)
  okR({ who, learned, pending: j.pending })
} else if (inp.op === 'prepare') {
  const known = j.spells_known ?? []
  for (const s of (inp.payload?.prepared ?? [])) known.includes(s) || fail(`未收录:${s}(先 learn)`)
  j.spells_prepared = inp.payload?.prepared ?? []
  writeFileSync(file, JSON.stringify(j, null, 1))
  logOp(`设置准备法术：${j.spells_prepared.join('、') || '（清空）'}`)
  okR({ who, prepared: j.spells_prepared })
} else fail('未知 op:' + inp.op)
