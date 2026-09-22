/**
 * Scope every ordinary style rule's selectors under a prefix, browser-side,
 * without a full CSS parser. The input is card-authored CSS that already
 * passed the guard (no `@import`, no absolute urls), so a quote/comment/
 * bracket-aware scan is the whole job. At-rules recurse into their block;
 * `@keyframes` bodies keep `from`/`to`/percent selectors verbatim (animation
 * names stay global — the same trade the retired css-tree pass made). Malformed
 * input is returned byte-identical, never a partial rewrite.
 * @module dsh-tavern-fengyue-ui/scope-css
 */

/** Return the string literal starting at `i` (with its quotes and escapes) and the position after it. */
function readString(css: string, i: number): { text: string; end: number } {
  const quote = css[i]
  let cursor = i + 1
  while (cursor < css.length) {
    if (css[cursor] === '\\') cursor += 2
    else if (css[cursor] === quote) { cursor += 1; break }
    else cursor += 1
  }
  return { text: css.slice(i, cursor), end: cursor }
}

/** Return the block comment starting at `i` (a `/*` opener through its star-slash closer) and the position after it. */
function readComment(css: string, i: number): { text: string; end: number } {
  const end = css.indexOf('*/', i + 2)
  if (end === -1) return { text: css.slice(i), end: css.length }
  return { text: css.slice(i, end + 2), end: end + 2 }
}

/**
 * Find the next top-level `{` (or the closing `}`) from `i`, skipping strings,
 * comments, and parenthesised/bracketed spans. The returned char tells the
 * caller whether a block opens or the current one closes.
 */
function nextBlockChar(css: string, i: number): { char: '{' | '}'; index: number } {
  let depth = 0
  let cursor = i
  while (cursor < css.length) {
    const ch = css[cursor]
    if (ch === '"' || ch === "'") { cursor = readString(css, cursor).end; continue }
    if (ch === '/' && css[cursor + 1] === '*') { cursor = readComment(css, cursor).end; continue }
    if (ch === '(' || ch === '[') { depth += 1; cursor += 1; continue }
    if (ch === ')' || ch === ']') { depth -= 1; cursor += 1; continue }
    if (depth === 0 && ch === '{') return { char: '{', index: cursor }
    if (depth === 0 && ch === '}') return { char: '}', index: cursor }
    cursor += 1
  }
  return { char: '}', index: css.length }
}

/**
 * Copy a balanced `{ … }` block verbatim from the character after its opening
 * brace. Strings and comments keep their braces.
 */
function copyBlock(css: string, openBraceIndex: number): { text: string; end: number } {
  let depth = 1
  let cursor = openBraceIndex + 1
  while (cursor < css.length && depth > 0) {
    const ch = css[cursor]
    if (ch === '"' || ch === "'") { cursor = readString(css, cursor).end; continue }
    if (ch === '/' && css[cursor + 1] === '*') { cursor = readComment(css, cursor).end; continue }
    if (ch === '{') depth += 1
    else if (ch === '}') depth -= 1
    cursor += 1
  }
  // An unclosed block is malformed input, not a scope to rewrite: fail so the
  // caller returns the original text byte-identical.
  if (depth !== 0) throw new Error('unbalanced block')
  return { text: css.slice(openBraceIndex + 1, cursor - 1), end: cursor }
}

/**
 * Prefix every comma-separated selector of one rule head. Commas inside
 * `()`/`[]` (e.g. `:is(a, b)`, `[x=","]`) never split; an already-prefixed
 * selector and `:root`-adjacent `html`/`body` stays as-is.
 */
function prefixSelectorHead(head: string, prefix: string): string {
  const parts: string[] = []
  let depth = 0
  let cursor = 0
  let start = 0
  while (cursor < head.length) {
    const ch = head[cursor]
    if (ch === '"' || ch === "'") { cursor = readString(head, cursor).end; continue }
    if (ch === '(' || ch === '[') { depth += 1; cursor += 1; continue }
    if (ch === ')' || ch === ']') { depth -= 1; cursor += 1; continue }
    if (ch === ',' && depth === 0) {
      parts.push(head.slice(start, cursor))
      cursor += 1
      start = cursor
      continue
    }
    cursor += 1
  }
  parts.push(head.slice(start))
  return parts.map((part) => {
    // Preserve each part's leading indent and the space before `{` — only the
    // selector core gains the prefix.
    const lead = part.match(/^\s*/)?.[0] ?? ''
    const trail = part.match(/\s*$/)?.[0] ?? ''
    const core = part.slice(lead.length, part.length - trail.length)
    if (core === '') return part
    if (core.startsWith(prefix.trim()) || core === ':root' || core === 'html' || core === 'body') return part
    return `${lead}${prefix}${core}${trail}`
  }).join(',')
}

/** Whether the at-rule name at `css[i]` opens a keyframes body (its inner selectors stay unscoped). */
function isKeyframesName(name: string): boolean {
  return name === '@keyframes' || name === '@-webkit-keyframes' || name === '@-moz-keyframes' || name === '@-o-keyframes'
}

/**
 * Scan one stylesheet from `i` to its block end (or the text end), prefixing
 * ordinary rule selectors. `inKeyframes` marks the current block's inner
 * selectors as keyframe stops.
 */
function walk(css: string, i: number, prefix: string, inKeyframes: boolean): { out: string; end: number } {
  let out = ''
  let cursor = i
  while (cursor < css.length) {
    const ch = css[cursor]
    if (ch === '"' || ch === "'") { const s = readString(css, cursor); out += s.text; cursor = s.end; continue }
    if (ch === '/' && css[cursor + 1] === '*') { const c = readComment(css, cursor); out += c.text; cursor = c.end; continue }
    // Read to the next block boundary: an ordinary rule head, or an at-rule
    // head (its `@` may follow the closing brace of the previous rule).
    const block = nextBlockChar(css, cursor)
    if (block.char === '}') {
      // Block end (or text end): keep whatever trails before the `}` — the
      // whitespace before a block's closing brace, or a malformed tail.
      out += css.slice(cursor, block.index)
      return { out, end: block.index + 1 }
    }
    const head = css.slice(cursor, block.index)
    const trimmed = head.trimStart()
    if (trimmed.startsWith('@')) {
      // An at-rule: keep its head, recurse into its body, and re-append the
      // body's closing brace (walk stops at, without emitting, its `}`).
      const nameMatch = /^@[a-zA-Z-]+/.exec(trimmed)
      const name = nameMatch?.[0].toLowerCase() ?? ''
      out += head + '{'
      const inner = walk(css, block.index + 1, prefix, inKeyframes || isKeyframesName(name))
      out += inner.out + '}'
      cursor = inner.end
      continue
    }
    // An ordinary rule: scope the selectors, copy its declarations verbatim.
    out += (inKeyframes ? head : prefixSelectorHead(head, prefix)) + '{'
    const body = copyBlock(css, block.index)
    out += body.text + '}'
    cursor = body.end
  }
  return { out, end: cursor }
}

/**
 * Prefix every ordinary rule selector of one stylesheet, leaving strings,
 * comments, at-rule heads, and keyframe stops intact. Throwing input degrades
 * to the original text.
 * @param css - the card-authored stylesheet.
 * @param prefix - the scope to prepend to each selector (e.g. `.tavern-body `).
 */
export function scopeCssRules(css: string, prefix: string): string {
  try {
    return walk(css, 0, prefix, false).out
  } catch {
    return css
  }
}
