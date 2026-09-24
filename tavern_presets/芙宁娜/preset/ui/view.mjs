// view.mjs — 芙宁娜 galgame 纯函数件(无 DOM 无状态,node 直测;经 tavern.views 注入)。
// 职责:指令剥离、分段、backlog 渲染——对话框状态机本体在 index.js(v1 直控)。

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

/** 快照行 → backlog 行模型:{role:'user'|'assistant', text}(assistant 剥指令)。 */
export function backlogRows(rows) {
  return (rows ?? []).map(r => ({
    role: r.kind === 'user' ? 'user' : 'assistant',
    text: r.kind === 'user' ? String(r.plain ?? '') : stripDirectives(r.orig),
    seq: r.seq ?? 0,
  })).filter(r => r.text !== '')
}

/** backlog 防剧透渲染:row 传当前轮(最后一条 assistant)时,只画到 readUpTo(含,-1=尚未读)。 */
export function backlogHTML(rows, currentSeq, readUpToSeq) {
  return (rows ?? []).map(row => {
    const isCurrent = row.seq === currentSeq
    if (isCurrent && row.seq > readUpToSeq && readUpToSeq >= 0) return ''   // 未读段不剧透
    const cls = row.role === 'user' ? 'u' : 'a'
    return `<div class="bl-row ${cls}"><div class="bl-name">${row.role === 'user' ? '你' : '芙宁娜'}</div><div class="bl-text">${esc(row.text)}</div></div>`
  }).join('')
}
