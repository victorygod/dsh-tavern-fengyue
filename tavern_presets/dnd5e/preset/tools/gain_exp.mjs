/** @tavern-schema
{
  "description": "经验落账+升级级联（尾代理专属，写盘）：写 characters/<who>.json——exp/level/hp族/hd_available/slots族/pending(ASI·新法术)。exp 累加→查阈值表升级→逐级衍射。增量来自叙事声明，本工具不重算怪 XP。",
  "agents": ["tail"],
  "parameters": {
    "who": { "type": "string", "required": true, "description": "角色姓名。" },
    "exp": { "type": "integer", "required": true, "description": "本次经验增量（正整数，照叙事声明）。" },
    "hp_mode": { "type": "string", "description": "升级 HP 算法 roll|均值（默认均值 floor(骰面/2)+1+CON）。" }
  }
}
*/
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const { readFM, findCharFile, err, XP_THRESHOLDS } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)

const THRESH = XP_THRESHOLDS  // 单一事实源：lib/core.mjs（PHB p.13；dm-loop §6.1 校对）
const FULL_CASTER = { wizard: true, cleric: true, sorcerer: true, druid: true, bard: true }
const SLOTS = { 1:[2], 2:[3], 3:[4,2], 4:[4,3], 5:[4,3,2], 6:[4,3,3], 7:[4,3,3,1], 8:[4,3,3,2], 9:[4,3,3,3,2], 10:[4,3,3,3,2], 11:[4,3,3,3,2,1], 12:[4,3,3,3,2,1], 13:[4,3,3,3,2,1,1], 14:[4,3,3,3,2,1,1], 15:[4,3,3,3,2,1,1,1], 16:[4,3,3,3,2,1,1,1], 17:[4,3,3,3,2,1,1,1,1], 18:[4,3,3,3,3,1,1,1,1], 19:[4,3,3,3,3,2,1,1,1], 20:[4,3,3,3,3,2,2,1,1] }
const ASI = { fighter: [4,6,8,12,14,16,19], rogue: [4,6,8,10,12,16,19], default: [4,8,12,16,19] }

const a = globalThis.argv ?? {}
a.who || err('缺 who')
Number.isInteger(+a.exp) && +a.exp > 0 || err('!exp 必须为正整数(增量照叙事声明)')
const file = findCharFile(a.who) ?? err(`!角色不存在:${a.who}`)
const j = JSON.parse(readFileSync(file, 'utf8'))
;(j.exp === undefined) && err(`!${a.who} 无成长面(键裁剪律——gain_exp 不适用)`)

const old = { exp: j.exp, level: j.level }
j.exp += +a.exp
let newLevel = 1
for (let i = THRESH.length - 1; i >= 0; i--) if (j.exp >= THRESH[i]) { newLevel = i + 1; break }
const ups = []
if (newLevel > j.level) {
  const cls = String(j.class ?? '').toLowerCase()
  const conMod = Math.floor(((j.con ?? 10) - 10) / 2)
  const hd = +(j.hit_die ?? readClassHitDie(cls) ?? 8)
  for (let L = j.level + 1; L <= newLevel; L++) {
    const row = classRow(cls, L)
    j.level = L
    j.hd_available = (j.hd_available ?? 0) + 1
    const hpGain = (a.hp_mode === 'roll' ? 0 : Math.floor(hd / 2) + 1) + conMod
    j.hp_max = (j.hp_max ?? 0) + Math.max(1, hpGain); j.hp = (j.hp ?? 0) + Math.max(1, hpGain)
    if (FULL_CASTER[cls]) { const st = SLOTS[L] ?? []; for (let k = 1; k <= 9; k++) j['slots_l' + k] = st[k - 1] ?? (j['slots_l' + k] ?? 0) }
    const asi = (ASI[cls] ?? ASI.default).includes(L)
    if (asi) (j.pending ??= []).push(`LV${L}·ASI 点选`)
    if (cls === 'wizard') (j.pending ??= []).push(`LV${L}·新法术×2`)
    ups.push(`LV${L}: PB+${2 + Math.floor((L - 1) / 4)} · 特征[${row?.features ?? '—'}] · HP+${Math.max(1, hpGain)}${asi ? ' · ⬜pending:ASI' : ''}${cls === 'wizard' ? ' · ⬜pending:新法术' : ''}`)
  }
}
const changes = [`exp ${old.exp}→${j.exp}`]
if (newLevel > old.level) changes.push(`level ${old.level}→${newLevel}`, ...ups)
writeBack(file, j)
console.log(`[经验 · ${j.name ?? a.who}] ${+a.exp} XP`)
console.log(`  exp ${old.exp} → ${j.exp}`)
if (ups.length) { console.log(`  升级: LV${old.level} → LV${newLevel}`); ups.forEach(u => console.log('  · ' + u)) }
console.log(`  文件: ${file} 已更新`)

function classRow(cls, L) {
  try {
    const md = readFileSync(`dnd5e-srd-lorebook/classes/${cls}.md`, 'utf8')
    const re = new RegExp(`^\\|\\s*${L}\\s*\\|\\s*\\+(\\d+)\\s*\\|\\s*([^|]*)\\|\\s*(\\{[^}]*\\})?\\s*\\|`, 'm')
    const m = re.exec(md)
    if (m) return { pb: +m[1], features: m[2].trim(), specific: m[3] ? JSON.parse(m[3].replace(/'/g, '"')) : {} }
  } catch {}
  return { features: '', specific: {} }
}
function readClassHitDie(cls) {
  try { const fm = readFM(`classes/${cls}.md`); return fm.hit_die } catch { return 8 }
}
function writeBack(file, j) { writeFileSync(file, JSON.stringify(j, null, 1)) }
