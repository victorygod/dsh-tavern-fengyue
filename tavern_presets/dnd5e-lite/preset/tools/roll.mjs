/** @tavern-schema
{
  "description": "掷骰器——唯一骰算入口，一切 d20/伤害/豁免/治疗/骰点判定都由它掷，返回逐骰点值与合计（禁止心算）。骰式 expression 支持：多骰组求和（`3d8`、`2d6+1d4+3`、`1d20+5`）、取高/取低（`2d20kh1` 优势 / `2d20kl1` 劣势）、`d%`/`d100`、`d20` 简写（=1d20）；修饰 `+N`/`-N` 可选——不写就只报裸骰值，写了回执同时打印 骰值+修饰=合计。advantage/disadvantage 布尔为 d20 便捷开关（与 kh/kl 等价，只对单个 d20 骰组生效）。",
  "agents": ["main"],
  "parameters": {
    "expression": { "type": "string", "required": true, "description": "骰式，如 1d20+5 / 2d6 / 3d8+2 / 2d20kh1+5 / d100。" },
    "advantage": { "type": "boolean", "description": "d20 掷骰取双骰高值（=2d20kh1）。仅对单个 d20 骰组生效。" },
    "disadvantage": { "type": "boolean", "description": "d20 掷骰取双骰低值（=2d20kl1）。仅对单个 d20 骰组生效。" },
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：为什么此刻要掷这个骰（如「攻击哥布林」「力量豁免」）——回执把掷骰与结果钉在一起。" }
  }
}
*/
import { randomInt } from 'node:crypto'

const a = globalThis.argv ?? {}
const err = (m) => { console.log('!' + m); process.exit(1) }
const rnd = (max) => randomInt(1, max + 1) // 1..max

// ── 解析单个骰组：`NdM` | `NdMkhK` | `NdMklK`（d 前数字缺省=1）──
const GROUP = /^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/

function parseGroup(tok) {
  const m = GROUP.exec(tok)
  if (!m) return null
  const count = m[1] === '' ? 1 : Number(m[1])
  const sides = Number(m[2])
  if (count < 1 || sides < 1) return null
  const keep = m[3] ? Number(m[4]) : null
  if (keep !== null && (keep < 1 || keep > count)) return null
  return { count, sides, keepHigh: m[3] === 'kh', keep }
}

// ── 展开表达式为若干骰组 + 若干整型修饰 ──
function parse(expr) {
  let s = String(expr).replace(/\s/g, '').toLowerCase().replace(/%/g, '100')
  if (s === '') err('缺必填 expression(骰式)')
  // d20 简写 → 1d20；d100 → 1d100
  s = s.replace(/^d(?=\d)/, '1d')
  const groups = []
  let mod = 0
  // 先按 +/- 切项（`+`/`-` 只出现在项间，骰组内部无符号）
  const terms = s.split(/(?=[+-])/).filter(Boolean)
  for (const raw of terms) {
    const neg = raw[0] === '-'
    const body = raw.replace(/^[+-]/, '')
    if (/^\d+$/.test(body)) { mod += neg ? -Number(body) : Number(body); continue }
    const g = parseGroup(body)
    if (!g) err(`骰式不合法:${body}——应为 NdM / NdMkhK / NdMklK / 整型修饰`)
    groups.push(g)
  }
  if (groups.length === 0) err(`骰式不合法:${expr}——至少需要一个骰组(如 1d20 / 2d6)`)
  return { groups, mod }
}

// ── 优势/劣势布尔 → 对单个 d20 骰组改写为 2d20 取高/取低 ──
function applyAdvDis(groups, adv, dis) {
  if (!adv && !dis) return groups
  if (adv && dis) err('advantage 与 disadvantage 不可同时为 true(优势+劣势抵消=平掷,去掉两者即可)')
  if (groups.length !== 1) return groups // 多骰组(如 3d8)不适用,静默忽略
  const g = groups[0]
  if (g.count !== 1 || g.sides !== 20 || g.keep !== null) return groups
  return [{ count: 2, sides: 20, keepHigh: adv, keep: 1 }]
}

const { groups, mod } = parse(a.expression)
const final = applyAdvDis(groups, a.advantage === true, a.disadvantage === true)

// ── 掷并组装回执 ──
const lines = []
const tag = final.some(g => g.keep !== null && g.count === 2 && g.sides === 20) ? '（优势/劣势）' : ''
lines.push(`掷骰 ${String(a.expression).trim()}${tag}`)

let total = mod
const allRolled = []
for (const g of final) {
  const dice = Array.from({ length: g.count }, () => rnd(g.sides))
  allRolled.push(...dice)
  const sum = dice.reduce((x, y) => x + y, 0)
  if (g.keep !== null) {
    const sorted = dice.map((v, i) => ({ v, i })).sort((x, y) => g.keepHigh ? y.v - x.v : x.v - y.v)
    const keptIdx = new Set(sorted.slice(0, g.keep).map(e => e.i))
    const kept = dice.filter((_, i) => keptIdx.has(i))
    const keptSum = kept.reduce((x, y) => x + y, 0)
    lines.push(`  ${g.count}d${g.sides}${g.keepHigh ? 'kh' : 'kl'}${g.keep}：掷出 [${dice.join(', ')}] → 保留 [${kept.join(', ')}] = ${keptSum}`)
    total += keptSum
  } else {
    lines.push(`  ${g.count}d${g.sides}：掷出 [${dice.join(', ')}]${g.count > 1 ? ` = ${sum}` : ''}`)
    total += sum
  }
}
if (mod !== 0) lines.push(`  修饰：${mod > 0 ? '+' : ''}${mod}`)
lines.push(`  合计：${total}`)

// d20 大成功/大失败注记(仅单骰 d20 平掷时;kh/kl 双骰不判)
for (const g of final) {
  if (g.sides === 20 && g.count === 1 && g.keep === null) {
    const v = allRolled[allRolled.length - 1]
    if (v === 20) lines.push('  ⚠ 大成功！（d20=20）')
    else if (v === 1) lines.push('  ⚠ 大失败…（d20=1）')
  }
}
lines.push(`  ◇ 梗概: ${a.context ?? ''}`)
lines.push('  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！')
console.log(lines.join('\n'))
