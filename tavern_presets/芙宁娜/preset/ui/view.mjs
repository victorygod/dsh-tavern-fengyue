// view.mjs — 芙宁娜 galgame 纯函数件(无 DOM 无状态,node 直测;经 tavern.views 注入)。
// 职责:指令剥离、分段、剧本学(makeScript)、书签规则(三分支恢复/指针包/防剧透口径)、
// live 合流、backlog 渲染——对话框状态机本体在 index.js(v1 直控)。
// 分域规则语义均自现役 index.js 逐条显性化(2026-09-25 域重构批),规格钉在
// packages/ui/tests/galgame-rules.unit.spec.ts:先锁规格,后搬家。

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/** 剥 HTML 注释指令块(协议见 cg_brief.mjs)。 */
export function stripDirectives(text) {
  return String(text ?? '').replace(/<!--[\s\S]*?-->/g, '').trim()
}

/** 解析一行台词:去行内注释得展示文本,并提取该行注释里的 cg 指令。
 *  协议(2026-09-24 用户定形):切 cg 的注释随語段出现、单行、可与台词同句。 */
export function parseLine(line) {
  const raw = String(line ?? '')
  const cgMatch = /<!--[\s\S]*?\bcg\s*[:：]\s*(\d+)/.exec(raw)
  const display = raw.replace(/<!--[\s\S]*?-->/g, '').trim()
  return { text: display, cg: cgMatch ? cgMatch[1] : null }
}

/** 按行切分:回复正文 → 消息分节数组 {text, cg}(遇换行切;空段/连续换行剔除;
 *  text 为去注释的展示文本,cg 为该行随文指令对应的 CG 序号或 null)。
 *  语义(2026-09-24 用户定形):buffer 收到整段后,遇换行切一条展示消息,
 *  只展示非空文本——空段跳过。 */
/** 切行入队,并处理「纯 CG 行」(只有注释没有正文)：
 *   - 段末贴 cg(同段) → 该段带 cg;
 *   - 段间/文末单独 CG 行 → 并入下一个文本段(pending),文末残留则覆盖最后一段——
 *     玩家点到最后一张文本段上屏时切的就是文末那枚 CG。
 *  空文本(各种注释残)仍丢弃。 */
export function splitParagraphs(text) {
  const rows = String(text ?? '').split(/\r?\n/).map(parseLine)
  const out = []
  let pending = null
  for (const row of rows) {
    if (row.text.trim() !== '' && !row.text.startsWith('<!--')) {      out.push({ text: row.text, cg: row.cg ?? pending ?? null })
      pending = null
    } else if (row.cg != null) {
      pending = row.cg
    }
  }
  if (pending != null && out.length > 0) out[out.length - 1].cg = pending
  return out
}

/** 有效行(trim 非空)在原文的行尾偏移——防剧透按已读行截取原文,保留内部换行,
 *  与刷新后完整历史行(整段含换行)一致。偏移按「行文本长度(不含平台换行)」推进。 */
export function lineEndsOf(text) {
  const out = []
  let i = 0
  for (const raw of String(text ?? '').split('\n')) {
    if (raw.trim() !== '') out.push(i + raw.length)
    i += raw.length + 1
  }
  return out
}

/* 死账清点:v10 时期的 backlogRows/backlogHTML(seq 水位截断语义)2026-09-25 域重构批删除——
   生前全仓零调用,且与活版(行偏移截断)语义两轨;现行渲染见 renderHistoryHTML。 */

/* ── 分域规则(2026-09-25 域重构批):以下七族自现役 index.js 显性化提取,
   语义与现行为逐条一致;galgame-rules.unit.spec 即规格。 ── */

/** 剧本快照(不可变值):最近一条 assistant(orig 优先——段级 CG 判定依赖行内注释)
 *  + 快照历史 → {paras 对话队列, raw 剥指令原文, lineEnds 防剧透行偏移, history}。
 *  空/缺席回复 → 空剧本(paras=[], raw=''——输入态/开场判据);新旧轮回=换整个对象。 */
export function makeScript(lastAssistant, history) {
  const text = lastAssistant?.orig ?? lastAssistant?.text ?? ''
  const raw = stripDirectives(text)
  return {
    paras: splitParagraphs(text).map(t => ({ role: 'assistant', text: t.text, cg: t.cg ?? null })),
    raw,
    lineEnds: lineEndsOf(raw),
    history: history ?? [],
  }
}

/** 防剧透口径(backlog 行唯一出处):历史行原样;当前轮(书签水位命中的 assistant 行)
 *  截到已读段——按原文行偏移 slice 保留换行,刷新前后一致。r 超界时 clamp 到末段
 *  (点完全部段=全文显示,末段不丢)。 */
export function visibleHistory(script, bookmark) {
  return (script.history ?? []).map(row => {
    if (row.role === 'assistant' && row.seq === bookmark.asstSeq && script.raw !== '') {
      const readEnd = (script.lineEnds ?? [])[Math.min(bookmark.r, (script.lineEnds ?? []).length - 1)]
      return { role: 'assistant', text: script.raw.slice(0, readEnd === undefined ? script.raw.length : readEnd) }
    }
    return row
  })
}

/** 读位恢复三分支(boot 契约,行为与现役一致):
 *  resume = 同回合有存位且非 input 态 → 回到读到的那段(r 对段数 clamp);
 *  replay = 缺席期已有新回复(水位前进) → 从队头重新演绎(未读);
 *  input  = 无存位/坏存位/存位已是 input 态/水位倒退 → 直落输入态(r=末段,旧契约)。 */
export function decideRestore(saved, asstSeq, parasLen) {
  const hasSaved = saved != null && Number.isInteger(saved.r)
  const last = parasLen - 1
  if (!hasSaved) return { plan: 'input', r: last }
  const savedSeq = Number.isInteger(saved.asstSeq) ? saved.asstSeq : null
  if (savedSeq === asstSeq && saved.mode !== 'input') {
    return { plan: 'resume', r: Math.min(Math.max(saved.r, 0), last) }
  }
  if (savedSeq !== null && asstSeq > savedSeq) return { plan: 'replay', r: 0 }
  return { plan: 'input', r: last }
}

/** live 合流:宿主累计流式文本 → {paras 追加新完整段后, liveTail 活性尾行}。
 *  基线=剧本既有段数(boot/落定建好的完整行数);新到完整行逐条 append(parseLine
 *  去注释取文+行内 cg 注释贴段),空文本与纯注释行跳过;未遇 \n 的活性尾单独交出。
 *  不判 CG 时机——入队不切、段展示时切是演出机的职责。 */
export function mergeLive(script, liveText) {
  const s = String(liveText ?? '')
  const parts = s.split('\n')
  const lastComplete = s.endsWith('\n') ? parts.length : parts.length - 1
  const paras = [...(script.paras ?? [])]
  for (let i = paras.length; i < lastComplete; i++) {
    const parsed = parseLine(parts[i] ?? '')
    if (parsed.text !== '' && !parsed.text.startsWith('<!--')) {
      paras.push({ role: 'assistant', text: parsed.text, cg: parsed.cg ?? null })
    }
  }
  const liveTail = lastComplete < parts.length ? parseLine(parts[lastComplete] ?? '').text : ''
  return { paras, liveTail }
}

/** 指针包打包(单键 LRU ≤16,与宿主 reader-anchor 同口径):新条目删后加=最近用者
 *  殿后;超容量丢最旧(头)。条目形状 {r, paras, asstSeq, mode, ts}。 */
export function packPointers(store, sid, entry) {
  const all = { ...(store ?? {}) }
  const key = `s:${sid}`
  delete all[key]
  all[key] = { r: entry.r, paras: entry.paras, asstSeq: entry.asstSeq, mode: entry.mode, ts: entry.ts }
  return Object.fromEntries(Object.entries(all).slice(-16))
}

/** 指针包读取:坏 JSON/非对象值 → 空包(退化「不持久」,行为零伤)。 */
export function readPointersPack(raw) {
  try {
    const value = JSON.parse(raw ?? '{}')
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {}
  } catch { return {} }
}

/** backlog 渲染:行模型(visibleHistory 口径)→ HTML。user/assistant 类名与名字牌;
 *  正文一律转义(.text 必为字符串——paras 整对象直传必染 [object Object],2026-09-24 量证)。 */
export function renderHistoryHTML(rows) {
  return (rows ?? []).map(row => {
    const cls = row.role === 'user' ? 'u' : 'a'
    return `<div class="bl-row ${cls}"><div class="bl-name">${row.role === 'user' ? '你' : '芙宁娜'}</div><div class="bl-text">${esc(row.text)}</div></div>`
  }).join('')
}
