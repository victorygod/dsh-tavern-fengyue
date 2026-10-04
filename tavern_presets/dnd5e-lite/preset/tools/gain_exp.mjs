/** @tavern-schema
{
  "description": "经验结算器——一切 XP 变动必经本工具。何时调：遭遇取胜的当回合走战果通道（传 foes），非战斗成就走直值通道（传 exp）。怎么调：who=活着参战名单；exp 与 foes 二选一。细则见各参数。",
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
const { findCharFile, saveChar, classRow, xpOf, pbOf, rollExpr, XP_THRESHOLDS, ASI_LEVELS, slotsFor, err } = await import(pathToFileURL(process.cwd() + '/../preset/lib/core.mjs').href)
const { CLASS_CORE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/class-core-data.mjs').href)
const { FEATURES_RECHARGE } = await import(pathToFileURL(process.cwd() + '/../preset/lib/opening-meta.mjs').href)
const { resolveChoice, pendingKind } = await import(pathToFileURL(process.cwd() + '/../preset/lib/choice-data.mjs').href)

const THRESH = XP_THRESHOLDS  // 单一事实源:lib/core.mjs(PHB p.13;dm-loop §6.1 校对锚)
const ASI = ASI_LEVELS        // ASI 档位表(2026-09-29 迁 core 单源;class-build.applyAsiGrowth 同源)

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
      const st = slotsFor(cls, L)
      if (st && st.length) for (let k = 1; k <= 9; k++) j['slots_l' + k] = st[k - 1] ?? (j['slots_l' + k] ?? 0)
      const asi = (ASI[cls] ?? ASI.default).includes(L)
      if (asi) (j.pending ??= []).push(`LV${L}·ASI 点选`)
      if (cls === 'wizard') (j.pending ??= []).push(`LV${L}·新法术×2`)
      // 特征入库(2026-10-03):升级新获特征——自动特征 append 进 j.features(与 spawn 同格式 `名|回充|已用0`),
      // 选择特征推 pending 待选(阶段1 前端点选)。此前只喊不写,升级特征随回执一闪而逝(养成闭环断)。
      const featNames = String(row?.features ?? '').split(',').map(s => s.trim()).filter(Boolean)
      if (featNames.length) {
        const feats = Array.isArray(j.features) ? j.features.slice() : []
        for (const f of featNames) {
          const dup = feats.some(e => String(e).split('|')[0].trim() === f)
          const key = Object.keys(FEATURES_RECHARGE).find(k => f.toLowerCase().includes(k.toLowerCase()))
          const rowStr = `${f}|${key ? FEATURES_RECHARGE[key] : '—'}|已用0`
          const kind = resolveChoice(f)
          if (kind === 'spells') {   // 法术选择(魔法秘辛/秘法奥秘/法术精通/招牌法术)→复用学法术流 op=spells
            if (!(j.pending ?? []).some(p => String(p).includes('新法术'))) (j.pending ??= []).push(`LV${L}·新法术×2`)
          } else if (kind) {
            if (!(j.pending ?? []).some(p => pendingKind(p) === kind)) (j.pending ??= []).push(`LV${L}·${f} 待选`)
          } else if (!dup) {
            feats.push(rowStr)   // 未机械化选择项兜底(理论已全覆盖——子职/祈唤/法术选择/游侠子选择均已进 CHOICES/特判)
          }
        }
        j.features = feats
      }
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
  return CLASS_CORE[cls]?.fm?.hit_die ?? 8
}
