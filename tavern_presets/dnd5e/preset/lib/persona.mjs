// persona 三层闸(docs/persona-threelayer_zh.md 定案 4/5,2026-09-30):spawn_npc/opening_commit 专属——人格七键闸(字数不设限,2026-10-04 翻案)
// +alignment 枚举+分级必填(同伴=lens/reaction/voice/tension+history;其余=lens/reaction 行为契约最小对;
// 分级闸对传没传 persona 都生效——spawn_npc 出生的角色必带人设)。机械事实进工具——内容判断归 LLM;
// 返回 tips=缺项软提示名单(回执 ◇ 行用)。怪不走本闸:怪人设=数据面 persona 行预生成(spawn_monster 只读)。
// 分层语义:persona=怎么演 / history 行数组=发生了什么([0]=长期设定,可含[秘]) / description=现在怎么样。
// 校验聚合(2026-09-30):错误**记账不即断**——全字段查完随返回值上账(errors),调用方并入字段账本一次报全
// (spawn_npc 聚合回执一行一错;opening_commit join 成一条 fail,出生面此点无写盘,清账安全)。首错即断会把其余
// 字段问题藏到下一轮调用。逐键账语义:同键只记一罪(在且字符串=已供;缺席才记必填)。
export const PERSONA_KEYS = ['appearance', 'lens', 'reaction', 'voice', 'never', 'tension']
export const PERSONA_LIMITS = { description: 40, history: 120 }   // 人格七键字数不设限(2026-10-04 翻案)——仅 description/history 保留上限
export const PERSONA_ALIGNMENTS = ['守序善良', '中立善良', '混乱善良', '守序中立', '绝对中立', '混乱中立', '守序邪恶', '中立邪恶', '混乱邪恶']

export function personaGate(a, { role = 'npc', requireHistory = false } = {}) {
  const bad = []
  const gate = (ok, msg) => { ok || bad.push(String(msg).replace(/^!+/, '')); return ok }
  // 退役参数守闸(一句话 persona/散参 biography/background 时代的调用,手工通道兜底)
  if (a.biography != null || a.background != null) gate(false, '!biography/background 已退役(2026-09-30 人设三层)——出身并入 history 履历首行')
  const personaIn = a.persona != null && typeof a.persona === 'object' && !Array.isArray(a.persona) ? a.persona : null
  const persona = {}
  if (a.persona != null && !personaIn) {
    gate(false, '!persona 须为人格对象(appearance/lens/reaction/voice/never/tension/alignment)——一句话 persona 已退役')
  } else if (personaIn) {
    if (personaIn.alignment != null) {
      if (gate(PERSONA_ALIGNMENTS.includes(personaIn.alignment), `!persona.alignment 超枚举(9 值):${personaIn.alignment}`) && personaIn.alignment) persona.alignment = personaIn.alignment
    }
    const got = new Set()   // 在且为非空字符串=「已供」——超长记超长,不重复补必填(同键一罪)
    for (const k of PERSONA_KEYS) {
      const v = personaIn[k]
      if (v === undefined || v === null) continue
      if (typeof v === 'string' && v.trim()) {
        got.add(k)
        persona[k] = v.trim()   // 七键字数不设限(2026-10-04 翻案)——质量归判据,长度归 LLM
      } else gate(false, `!persona.${k} 须为非空字符串`)
    }
    // 必填面=分级闸,对传了 persona 的调用逐键点名(缺席键逐个记账,与超枚举/超长并排一次修净)
    const why = role === 'companion' ? '同伴四件 lens/reaction/voice/tension' : '行为契约最小对 lens+reaction'
    const wanted = role === 'companion' ? ['lens', 'reaction', 'voice', 'tension'] : ['lens', 'reaction']
    for (const k of wanted) got.has(k) || gate(false, `!persona.${k} 必填(${why}——写法见键描述)`)
  } else {
    const why = role === 'companion' ? '同伴四件 lens/reaction/voice/tension' : '行为契约最小对 lens+reaction'
    gate(false, `!persona 必填(${why}——每个角色都须建档即带人设,写法见键描述)`)
  }
  const hist0 = typeof a.history === 'string' && a.history.trim() ? a.history.trim() : null
  if (hist0) gate(hist0.length <= PERSONA_LIMITS.history, `!history 超长(≤${PERSONA_LIMITS.history} 字,得 ${hist0.length})`)
  if (requireHistory && !hist0) gate(false, '!history 必填(同伴=长线人物,长期设定出生即知——出身+塑造往事)')
  const desc = typeof a.description === 'string' && a.description.trim() ? a.description.trim() : null
  if (desc) gate(desc.length <= PERSONA_LIMITS.description, `!description 超长(≤${PERSONA_LIMITS.description} 字,得 ${desc.length})`)
  const tips = []
  if (personaIn) for (const k of ['appearance', 'never']) persona[k] || tips.push(k)
  if (!desc) tips.push('description')
  return { persona: personaIn ? persona : null, history: hist0, description: desc, tips, errors: bad }
}
