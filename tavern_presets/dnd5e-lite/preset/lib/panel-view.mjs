// panel-view.mjs — 叙事投影(2026-10-02):character.json → LLM 注入面板的简洁 RP 视图。
// 原则:注入面板只留「演绎需要的事实」——机械数值(AC/熟练/环位/抗免/命计数/精确 hp)与规则原文
// (feature_details/spell_details 全文)由工具读盘自取、回执按需供,面板不教怎么用、不背数值。
// 消费者:get_player_state/get_npc_state(注入)。文件/前端(ui_data)/工具仍读全量原档,零影响。
// 译名单源:glossary-cn(CLS_CN/SUBCLASS_CN/LANGUAGE_CN/FEATURE_CN);法术/武器/技能名保持存储原文
// ——它们是 cast/attack/check 的入参(英文正典),译成中文会造成「面板读中文、工具要英文」的往返断层。
import { cn, norm, CLS_CN, SUBCLASS_CN, LANGUAGE_CN, FEATURE_INTRO_CN } from './glossary-cn.mjs'

// 特征行「名(级变)|回充|已用N」→ FEATURE_INTRO_CN 键:剥「|回充|已用」、剥「(级变)」括注;
// 「Spellcasting: X」特判归 spellcasting;其余「X: Y」子特征保留冒号(如 Channel Divinity: Turn Undead)。
const featureKey = (n) => {
  const s = String(n).split('|')[0].split('(')[0].trim()
  if (/^spellcasting\s*:/i.test(s)) return 'spellcasting'
  return norm(s)
}

export function panelView(j) {
  if (!j || typeof j !== 'object' || Array.isArray(j)) return j
  const out = {}
  // 身份 + RP 锚(六维保留:工具 check/attack 读档,面板留数值供定性判断;力竭是「疲惫」的叙事态)
  for (const k of ['name', 'role', 'level', 'race', 'gender', 'exhaustion', 'str', 'dex', 'con', 'int', 'wis', 'cha']) {
    if (j[k] !== undefined && j[k] !== null) out[k] = j[k]
  }
  if (j.class != null) out.class = cn(CLS_CN, j.class)
  if (j.subclass != null) out.subclass = cn(SUBCLASS_CN, j.subclass)
  // HP 数值(用户定案:面板必须数值,不能血条档)——hp/hp_max/temp_hp 原样
  for (const k of ['hp', 'hp_max', 'temp_hp']) {
    if (j[k] !== undefined && j[k] !== null) out[k] = j[k]
  }
  // 能力名单:features 投「名：一句话」释义(特质=叙事面总结/战斗机制=是什么·结算走工具/成长选项=选什么);
  // spells 只留名(英文正典=cast 入参),drop spell_details
  if (Array.isArray(j.features) && j.features.length) {
    const lines = j.features.map(f => cn(FEATURE_INTRO_CN, featureKey(f))).filter(Boolean)
    if (lines.length) out.features = lines
  }
  if (Array.isArray(j.spells_known) && j.spells_known.length) out.spells_known = j.spells_known
  if (Array.isArray(j.spells_prepared) && j.spells_prepared.length) out.spells_prepared = j.spells_prepared
  // 背包/钱包(背包律 + 买得起判断)——名单原样
  for (const k of ['weapons', 'gear', 'gp', 'sp', 'cp']) {
    if (j[k] !== undefined && j[k] !== null) out[k] = j[k]
  }
  // 语言(中文)
  if (Array.isArray(j.languages) && j.languages.length) out.languages = j.languages.map(l => cn(LANGUAGE_CN, l)).filter(Boolean)
  // 擅长(what she's good at = RP 画像;熟练修正本身是机械,由 check 读档)——英文键=check 入参
  if (Array.isArray(j.skill_prof) && j.skill_prof.length) out.skill_prof = j.skill_prof
  // 未分配成长(叙事宣告用)
  if (Array.isArray(j.pending) && j.pending.length) out.pending = j.pending
  // 状态:只留 effect 文本(mods/temp/applied_at 是机械/维护面)
  if (j.statuses && typeof j.statuses === 'object' && !Array.isArray(j.statuses)) {
    const st = {}
    for (const [k, v] of Object.entries(j.statuses)) {
      if (v && typeof v === 'object') { if (v.effect) st[k] = v.effect }
      else st[k] = v
    }
    if (Object.keys(st).length) out.statuses = st
  }
  // 人设三层 + 内心(推演核心,原样)
  for (const k of ['persona', 'history', 'description', 'thought']) {
    if (j[k] !== undefined && j[k] !== null) out[k] = j[k]
  }
  return out
}
