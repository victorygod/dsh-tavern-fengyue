// mvu-apply.mjs — mvu 块落盘的核心应用件(纯 per-character 变更器,mvu_commit 与测试共用)。
// 自 gain_money / gain_exp / update_memory 抽出的同源逻辑(原 dnd5e 卡三工具退役,此处收拢单源):
// applyMoney(钱包 toCp/normWallet)、applyExp(经验升级级联 XP_THRESHOLDS/ASI_LEVELS/特征/位表)、
// applyMemory(记忆三层 history 专用 append/overwrite + description/thought 恒覆写)。
// 校验失败一律 throw(非 process.exit)——mvu_commit 按条 try/catch,warn 后继续,不因单条坏账杀整轮。
import { toCp, normWallet, classRow, pbOf, rollExpr, XP_THRESHOLDS, ASI_LEVELS, slotsFor } from './core.mjs'
import { CLASS_CORE } from './class-core-data.mjs'
import { FEATURES_RECHARGE } from './opening-meta.mjs'
import { resolveChoice, pendingKind } from './choice-data.mjs'
import { PERSONA_LIMITS } from './persona.mjs'

const fail = (m) => { throw new Error(m) }

const readClassHitDie = (cls) => CLASS_CORE[cls]?.fm?.hit_die ?? 8

// ── 钱包(原 gain_money):direction gain|spend,amount 金额自由写法(15gp/纯数字 cp) ──
export function applyMoney(j, direction, amount) {
  const amt = toCp(amount); amt > 0 || fail('!amount 必须为正')
  const oldCp = (j.gp ?? 0) * 100 + (j.sp ?? 0) * 10 + (j.cp ?? 0)
  const newCp = direction === 'spend' ? oldCp - amt : oldCp + amt
  const w = normWallet(newCp)
  const before = { gp: j.gp ?? 0, sp: j.sp ?? 0, cp: j.cp ?? 0 }
  j.gp = w.gp; j.sp = w.sp; j.cp = w.cp
  return { before, after: w, negative: newCp < 0, amt, direction }
}

// ── 经验升级级联(原 gain_exp):inc 每人增量;hp 默认 avg。返回 ups 列表+是否升级 ──
export function applyExp(j, inc, hpMode = 'avg') {
  Number.isInteger(inc) && inc > 0 || fail('!exp 变更量必须为正整数')
  const beforeLevel = j.level ?? 1
  j.exp += inc
  let newLevel = 1
  for (let i = XP_THRESHOLDS.length - 1; i >= 0; i--) if (j.exp >= XP_THRESHOLDS[i]) { newLevel = i + 1; break }
  const ups = []
  if (newLevel > beforeLevel) {
    const cls = String(j.class ?? '').toLowerCase()
    const conM = Math.floor(((j.con ?? 10) - 10) / 2)
    const hd = +(j.hit_die ?? readClassHitDie(cls) ?? 8)
    for (let L = beforeLevel + 1; L <= newLevel; L++) {
      const row = classRow(cls, L)
      j.level = L
      j.hd_available = (j.hd_available ?? 0) + 1
      const hpGain = (hpMode === 'roll' ? (rollExpr(`1d${hd}`)?.total ?? Math.floor(hd / 2)) : Math.floor(hd / 2) + 1) + conM
      j.hp_max = (j.hp_max ?? 0) + Math.max(1, hpGain); j.hp = (j.hp ?? 0) + Math.max(1, hpGain)
      const st = slotsFor(cls, L)
      if (st && st.length) for (let k = 1; k <= 9; k++) j['slots_l' + k] = st[k - 1] ?? (j['slots_l' + k] ?? 0)
      const asi = (ASI_LEVELS[cls] ?? ASI_LEVELS.default).includes(L)
      if (asi) (j.pending ??= []).push(`LV${L}·ASI 点选`)
      if (cls === 'wizard') (j.pending ??= []).push(`LV${L}·新法术×2`)
      // 特征入库(与 spawn 同格式 `名|回充|已用0`;选择特征推 pending 待选)
      const featNames = String(row?.features ?? '').split(',').map(s => s.trim()).filter(Boolean)
      if (featNames.length) {
        const feats = Array.isArray(j.features) ? j.features.slice() : []
        for (const f of featNames) {
          const dup = feats.some(e => String(e).split('|')[0].trim() === f)
          const key = Object.keys(FEATURES_RECHARGE).find(k => f.toLowerCase().includes(k.toLowerCase()))
          const rowStr = `${f}|${key ? FEATURES_RECHARGE[key] : '—'}|已用0`
          const kind = resolveChoice(f)
          if (kind === 'spells') {
            if (!(j.pending ?? []).some(p => String(p).includes('新法术'))) (j.pending ??= []).push(`LV${L}·新法术×2`)
          } else if (kind) {
            if (!(j.pending ?? []).some(p => pendingKind(p) === kind)) (j.pending ??= []).push(`LV${L}·${f} 待选`)
          } else if (!dup) {
            feats.push(rowStr)
          }
        }
        j.features = feats
      }
      ups.push(`LV${L}: PB+${pbOf(L)} · 特征[${row?.features ?? '—'}] · HP+${Math.max(1, hpGain)}${asi ? ' · ASI 待选' : ''}${cls === 'wizard' ? ' · 新法术待选' : ''}`)
    }
  }
  return { ups, leveled: newLevel > beforeLevel }
}

// ── 记忆三层(原 update_memory):history 专用 append(<10 追加)/overwrite(≥10 整表总结替换);
//    description/thought 单值恒覆写(不传=不改、传 null=删键)。互斥/超长/玩家拒 thought 均 throw。 ──
export function applyMemory(j, entry) {
  const lines = []
  const hasAppend = entry.history_append !== undefined && entry.history_append !== null
  const hasOverwrite = entry.history_overwrite !== undefined && entry.history_overwrite !== null
  if (hasAppend && hasOverwrite) fail('history_append 与 history_overwrite 互斥')
  if (hasAppend) {
    const row = String(entry.history_append).trim()
    row || fail('history_append 须非空(无追加=不传)')
    row.length <= (PERSONA_LIMITS.history ?? 120) || fail(`history_append 超长(≤${PERSONA_LIMITS.history} 字,得 ${row.length})`)
    Array.isArray(j.history) || (j.history = [])
    j.history.push(row)
    lines.push(`history: 追加第 ${j.history.length} 行`)
  } else if (hasOverwrite) {
    const row = String(entry.history_overwrite).trim()
    row || fail('history_overwrite 须非空(整体总结单行)')
    row.length <= (PERSONA_LIMITS.history ?? 120) || fail(`history_overwrite 超长(≤${PERSONA_LIMITS.history} 字,得 ${row.length})`)
    j.history = [row]
    lines.push('history: 整表总结替换为 1 行')
  }
  if (entry.description !== undefined && entry.description !== null) {
    const d = String(entry.description).trim()
    d && d.length <= (PERSONA_LIMITS.description ?? 40) || fail(`description 须非空且 ≤${PERSONA_LIMITS.description} 字`)
    lines.push(`description: ${j.description ?? '(缺)'}→${d}`)
    j.description = d
  } else if (entry.description === null) {
    delete j.description
    lines.push('description: 删键(还原缺省)')
  }
  if (entry.thought !== undefined && entry.thought !== null) {
    j.role === 'pc' && fail('thought 不落玩家卡——玩家内心自主权')
    const t = String(entry.thought).trim()
    t && t.length <= 400 || fail('thought 须非空且 ≤400 字')
    lines.push(`thought: ${j.thought ?? '(缺)'}→${t}`)
    j.thought = t
  } else if (entry.thought === null) {
    j.role === 'pc' && fail('thought 不落玩家卡——玩家内心自主权')
    delete j.thought
    lines.push('thought: 删键(还原缺省)')
  }
  return lines
}