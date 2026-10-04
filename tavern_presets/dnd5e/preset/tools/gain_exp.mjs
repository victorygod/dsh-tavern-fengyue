/** @tavern-schema
{
  "description": "经验结算器——一切 XP 变动必经本工具。何时调：遭遇取胜的当回合走战果通道（传 foes），非战斗成就走直值通道（传 exp）。怎么调：who=活着参战名单；exp 与 foes 二选一。细则见各参数。",
  "agents": ["main"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概：本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起，后续叙事必须遵守。" },
    "who": { "type": "string", "required": true, "description": "分账名单，逗号分隔（如 '梅西雅,缇娜'）——名单=活着参战者，你判断。" },
    "exp": { "type": "integer", "description": "直值通道：XP 增量（正整数，每人）——非战斗成就/你裁定的数额。与 foes 互斥。" },
    "foes": { "type": "string", "description": "战果通道：被击败者名单，逗号分隔（如 '哥布林甲,哥布林乙'）。与 exp 互斥。" },
    "hp_mode": { "type": "string", "description": "升级 HP 算法：avg（默认，取均值）| roll（掷骰）。" }
  }
}
*/
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { findCharFile, saveChar, xpOf, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { applyExp } = await import(pathToFileURL(process.cwd() + '/../preset/lib/mvu-apply.mjs').href)
const a = globalThis.argv ?? {}
a.context?.trim() || err('缺必填 context')
const names = String(a.who ?? '').split(/[,，]/).map(s => s.trim()).filter(Boolean)
names.length || err('缺必填 who(分账名单)')
if ((a.exp === undefined) === (a.foes === undefined)) err('exp 与 foes 二选一')

// 战果通道:档读 level→CR 查表→Σ→均分 floor 弃余(遭遇乘数只评难度,不进发放=RAW)
let inc, warLine = ''
if (a.foes !== undefined) {
  const foes = String(a.foes).split(/[,，]/).map(s => s.trim()).filter(Boolean)
  foes.length || err('foes 名单为空')
  const xpList = []
  for (const foe of foes) {
    const f = findCharFile(foe)
    if (!f) err(`!查无被击败者档案:${foe}——档已删则改走 exp 直值`)
    const fj = JSON.parse(readFileSync(f, 'utf8'))
    const xp = xpOf(fj.level)
    if (xp == null) err(`!无 XP 可查:${foe}(level=${fj.level} 非法)`)
    xpList.push(xp)
  }
  const total = xpList.reduce((x, y) => x + y, 0)
  inc = Math.floor(total / names.length)
  warLine = `  战果: ${xpList.join('+')} = ${total} XP ÷ ${names.length} 人 → ${inc}/人（乘数不进发放）`
} else {
  inc = +a.exp
}
Number.isInteger(inc) && inc > 0 || err('!exp 必须为正整数(或 foes 可解析出正份额)')

// 逐人入账+升级级联(applyExp=单源,与 mvu-apply 同律:阈值/ASI/位表/特征 pending)
const hpMode = a.hp_mode === 'roll' ? 'roll' : 'avg'
const results = []
for (const name of names) {
  const file = findCharFile(name) ?? err(`!角色不存在:${name}`)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  if (j.exp === undefined) err(`!${name} 无成长面（怪/纯场景 NPC 不挣 XP——从名单移除即可）`)
  const b = { exp: j.exp, level: j.level ?? 1, hp_max: j.hp_max ?? 0, hp: j.hp ?? 0, hd: j.hd_available ?? 0, slots: {} }
  for (let k = 1; k <= 9; k++) b.slots[k] = j['slots_l' + k]
  const { ups, leveled } = applyExp(j, inc, hpMode)
  saveChar(file, j)
  results.push({ name, file, j, b, ups, leveled })
}

console.log(a.foes !== undefined ? `[战果 · ${String(a.foes).split(/[,，]/).map(s => s.trim()).filter(Boolean).join('/')} 被击败]` : `[经验 · ${names.join('·')}] ${inc} XP`)
if (warLine) console.log(warLine)
for (const r of results) {
  console.log(`  落盘: ${r.name} exp ${r.b.exp}→${r.j.exp} [${r.file}]`)
  if (r.leveled) {
    console.log(`  升级: ${r.name} LV${r.b.level}→LV${r.j.level}`)
    for (const u of r.ups) console.log(`  · ${u}`)
    const w = [`level ${r.b.level}→${r.j.level}`, `hp_max ${r.b.hp_max}→${r.j.hp_max}`, `hp ${r.b.hp}→${r.j.hp}`, `hd_available ${r.b.hd}→${r.j.hd_available}`]
    for (let k = 1; k <= 9; k++) if (r.j['slots_l' + k] !== undefined && r.j['slots_l' + k] !== r.b.slots[k]) w.push(`slots_l${k} ${r.b.slots[k] ?? 0}→${r.j['slots_l' + k]}`)
    console.log(`  落盘: ${w.join(' · ')} [${r.file}]`)
    if ((r.j.pending ?? []).length) console.log(`  ⬜ pending: ${r.j.pending.join(' / ')}`)
  }
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)
