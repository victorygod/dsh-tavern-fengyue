// view.mjs — 芙宁娜 galgame 纯函数件(无 DOM 无状态,node 直测;经 tavern.views 注入)。
// 职责:指令剥离、分段、backlog 渲染——对话框状态机本体在 index.js(v1 直控)。

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

/** 剥 HTML 注释指令块(协议见 cg_brief.mjs)。 */
export function stripDirectives(text) {
  return String(text ?? '').replace(/<!--[\s\S]*?-->/g, '').trim()
}

/** 空行分段:回复正文 → 段落数组(段内换行保留;空段剔除;指令注释剥离)。 */
export function splitParagraphs(text) {
  return stripDirectives(text).split(/\n\s*\n/).map(p => p.trim()).filter(p => p !== '')
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
