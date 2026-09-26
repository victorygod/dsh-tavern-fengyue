/** @tavern-schema
{
  "description": "经验入账与升级级联器——一切 XP 变动必经本工具。什么情况调：两通道二选一——①直值：非战斗成就或你裁定数额（说服化解危机、探索发现）传 exp（每人增量）；②战果：遭遇取胜的**当回合**传 foes（被击败者名单，杀死/击倒/劝降都算、逃跑不算，你判断）——工具查表求和、按名单均分、逐人跑升级级联，乘数不进发放。怎么填：who=分账名单（逗号分隔，活着参战者，你判断；单人直传）；exp 与 foes 二选一。预期效果：回执给战果算式或直值+逐人落盘行；升级时级联衍射（PB/HP/HD/位表/pending）一并落盘并列升级块。",
  "agents": ["main", "tail"],
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
const { readFM, findCharFile, saveChar, classRow, xpOf, pbOf, rollExpr, XP_THRESHOLDS, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)

const THRESH = XP_THRESHOLDS  // 单一事实源:lib/core.mjs(PHB p.13;dm-loop §6.1 校对锚)
const FULL_CASTER = { wizard: true, cleric: true, sorcerer: true, druid: true, bard: true }
const SLOTS = { 1:[2], 2:[3], 3:[4,2], 4:[4,3], 5:[4,3,2], 6:[4,3,3], 7:[4,3,3,1], 8:[4,3,3,2], 9:[4,3,3,3,1], 10:[4,3,3,3,2], 11:[4,3,3,3,2,1], 12:[4,3,3,3,2,1], 13:[4,3,3,3,2,1,1], 14:[4,3,3,3,2,1,1], 15:[4,3,3,3,2,1,1,1], 16:[4,3,3,3,2,1,1,1], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] }
const ASI = { fighter: [4, 6, 8, 12, 14, 16, 19], rogue: [4, 6, 8, 10, 12, 16, 19], default: [4, 8, 12, 16, 19] }

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

// 逐人入账+升级级联
const results = []
for (const name of names) {
  const file = findCharFile(name) ?? err(`!角色不存在:${name}`)
  const j = JSON.parse(readFileSync(file, 'utf8'))
  if (j.exp === undefined) err(`!${name} 无成长面（怪/纯场景 NPC 不挣 XP——从名单移除即可）`)
  const before = { ...j }
  j.exp += inc
  let newLevel = 1
  for (let i = THRESH.length - 1; i >= 0; i--) if (j.exp >= THRESH[i]) { newLevel = i + 1; break }
  const ups = []
  if (newLevel > j.level) {
    const cls = String(j.class ?? '').toLowerCase()
    const conM = Math.floor(((j.con ?? 10) - 10) / 2)
    const hd = +(j.hit_die ?? readClassHitDie(cls) ?? 8)
    for (let L = j.level + 1; L <= newLevel; L++) {
      const row = classRow(cls, L)
      j.level = L
      j.hd_available = (j.hd_available ?? 0) + 1
      const hpGain = (a.hp_mode === 'roll' ? (rollExpr(`1d${hd}`)?.total ?? Math.floor(hd / 2)) : Math.floor(hd / 2) + 1) + conM
      j.hp_max = (j.hp_max ?? 0) + Math.max(1, hpGain); j.hp = (j.hp ?? 0) + Math.max(1, hpGain)
      if (FULL_CASTER[cls]) { const st = SLOTS[L] ?? []; for (let k = 1; k <= 9; k++) j['slots_l' + k] = st[k - 1] ?? (j['slots_l' + k] ?? 0) }
      const asi = (ASI[cls] ?? ASI.default).includes(L)
      if (asi) (j.pending ??= []).push(`LV${L}·ASI 点选`)
      if (cls === 'wizard') (j.pending ??= []).push(`LV${L}·新法术×2`)
      ups.push(`LV${L}: PB+${pbOf(L)} · 特征[${row?.features ?? '—'}] · HP+${Math.max(1, hpGain)}${asi ? ' · ⬜pending:ASI' : ''}${cls === 'wizard' ? ' · ⬜pending:新法术' : ''}`)
    }
  }
  saveChar(file, j)
  results.push({ name, file, j, before, ups, leveled: newLevel > before.level })
}

console.log(a.foes !== undefined ? `[战果 · ${String(a.foes).split(/[,，]/).map(s => s.trim()).filter(Boolean).join('/')} 被击败]` : `[经验 · ${names.join('·')}] ${inc} XP`)
if (warLine) console.log(warLine)
for (const r of results) {
  console.log(`  落盘: ${r.name} exp ${r.before.exp}→${r.j.exp} [${r.file}]`)
  if (r.leveled) {
    console.log(`  升级: ${r.name} LV${r.before.level}→LV${r.j.level}`)
    for (const u of r.ups) console.log(`  · ${u}`)
    const w = [`level ${r.before.level}→${r.j.level}`, `hp_max ${r.before.hp_max}→${r.j.hp_max}`, `hp ${r.before.hp}→${r.j.hp}`, `hd_available ${r.before.hd_available ?? 0}→${r.j.hd_available}`]
    for (let k = 1; k <= 9; k++) if (r.j['slots_l' + k] !== undefined && r.j['slots_l' + k] !== (r.before['slots_l' + k] ?? 0)) w.push(`slots_l${k} ${r.before['slots_l' + k] ?? 0}→${r.j['slots_l' + k]}`)
    console.log(`  落盘: ${w.join(' · ')} [${r.file}]`)
    if ((r.j.pending ?? []).length) console.log(`  ⬜ pending: ${r.j.pending.join(' / ')}`)
  }
}
console.log(`  ◇ 梗概: ${a.context}`)
console.log(`  ◇ 铁则: 后续剧情必须遵守梗概与结果，不得篡改！`)

function readClassHitDie(cls) {
  try { return readFM(`classes/${cls}.md`).hit_die } catch { return 8 }
}
