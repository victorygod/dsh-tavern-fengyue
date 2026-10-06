// panel-view.mjs — 叙事画像投影(2026-10-05 dnd5e-combat 缩窄):character.json → LLM 注入面板。
// 原则:LLM=纯叙事 DM——只透「会什么」的能力画像(身份/熟练技能/剧情特征/语言)+背包/钱/人设;
// 「有多少」的战斗数值(六维/HP/AC/环位/法术/状态/待办)全隐,一切战斗结算封进 combat 工具。
// 消费者:get_player_state/get_npc_state(注入)。文件/前端(ui_data)/工具仍读全量原档,零影响。
// 译名单源:glossary-cn(SKILL_CN/FEATURE_KIND/FEATURE_INTRO_CN/CLS_CN/SUBCLASS_CN/LANGUAGE_CN)。
import { cn, norm, CLS_CN, SUBCLASS_CN, LANGUAGE_CN, FEATURE_INTRO_CN, SKILL_CN, FEATURE_KIND } from './glossary-cn.mjs'

// 名单堆叠(2026-10-06):同名物品合并为「名×N」(N=1 仍单列)——背包/武器展示层用;数据层保持逐件原样。
// 已带「×N」后缀的条目先拆开再合计(兼容 update_inventory 手写「弯刀×3」再叠战利品的情况)。
const stackItems = (arr) => {
  const count = new Map()
  for (const t of arr ?? []) {
    const s = String(t).trim()
    if (!s) continue
    const m = /^(.+?)[×x]\s*(\d+)\s*$/.exec(s)
    const base = m ? m[1].trim() : s
    const n = m ? +m[2] : 1
    count.set(base, (count.get(base) ?? 0) + n)
  }
  return [...count.entries()].map(([k, n]) => (n > 1 ? `${k}×${n}` : k))
}

// 特征行「名(级变)|回充|已用N」→ FEATURE_INTRO_CN/FEATURE_KIND 键:剥「|回充|已用」、剥「(级变)」括注;
// 「Spellcasting: X」特判归 spellcasting;其余「X: Y」子特征保留冒号(如 Channel Divinity: Turn Undead)。
const featureKey = (n) => {
  const s = String(n).split('|')[0].split('(')[0].trim()
  if (/^spellcasting\s*:/i.test(s)) return 'spellcasting'
  return norm(s)
}

export function panelView(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return j
  const out = {}
  // 身份(六维/HP/环位/状态/pending 全隐——战斗数值只在 combat 工具内流转)
  for (const k of ['name', 'role', 'level', 'race', 'gender']) {
    if (j[k] !== undefined && j[k] !== null) out[k] = j[k]
  }
  if (j.class != null) out.class = cn(CLS_CN, j.class)
  if (j.subclass != null) out.subclass = cn(SUBCLASS_CN, j.subclass)
  // 擅长(熟练/专精技能→中文短名;熟练修正本身是机械,由 check 读档)
  const prof = new Set((Array.isArray(j.skill_prof) ? j.skill_prof : []).map(norm))
  const exp = new Set((Array.isArray(j.expertise) ? j.expertise : []).map(norm))
  const skills = [...prof].map(k => (exp.has(k) ? '〔专精〕' : '') + (SKILL_CN[k] ?? k))
  if (skills.length) out.skills = skills
  // 特长(剧情特征→一句释义;战斗/成长特征隐,FEATURE_KIND 白名单默认 combat=安全)
  if (Array.isArray(j.features) && j.features.length) {
    const traits = j.features.map(f => featureKey(f)).filter(k => FEATURE_KIND[k] === 'narrative').map(k => FEATURE_INTRO_CN[k]).filter(Boolean)
    if (traits.length) out.traits = traits
  }
  // 语言(中文)
  if (Array.isArray(j.languages) && j.languages.length) out.languages = j.languages.map(l => cn(LANGUAGE_CN, l)).filter(Boolean)
  // 背包/钱包(背包律 + 买得起判断)——weapons/gear 名单堆叠(同物×N),gp/sp/cp 原样
  for (const k of ['weapons', 'gear']) {
    if (Array.isArray(j[k]) && j[k].length) out[k] = stackItems(j[k])
  }
  for (const k of ['gp', 'sp', 'cp']) {
    if (j[k] !== undefined && j[k] !== null) out[k] = j[k]
  }
  // 人设三层 + 内心(推演核心,原样)
  for (const k of ['persona', 'history', 'description', 'thought']) {
    if (j[k] !== undefined && j[k] !== null) out[k] = j[k]
  }
  return out
}
