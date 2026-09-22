/* oxlint-disable @stylistic/max-len -- 卡片长文案与长模板串按行豁免，上限约束不适用于此文件的长中文字符串 */
/**
 * The card-facing message renderer: markdown (+ card-authored HTML) →
 * sanitized, style-scoped HTML. Pipeline order is fixed: `stripInstructions`
 * runs before this module (the caller owns it) → `<style>` blocks wrap into
 * the `custom-style` carrier so sanitization keeps them → micromark turns the
 * rest into HTML (GFM + math) → DOMPurify's default allowlist sanitizes it
 * (scripts and event handlers die, external media srcs are cut, class tokens
 * gain the `custom-` prefix so card output cannot address host styles) →
 * the surviving `custom-style` blocks decode back into `<style>` elements with
 * every selector prefixed to the narrative container (`.tavern-body `).
 * @module dsh-tavern-fengyue-ui/rich-text
 */

import * as DOMPurifyModule from 'dompurify'
import { micromark } from 'micromark'
import { gfm, gfmHtml } from 'micromark-extension-gfm'
import { math, mathHtml } from 'micromark-extension-math'
import { scopeCssRules } from './scope-css.ts'

/** The class-prefix token every card-authored class name carries after sanitizing. */
const CARD_CLASS_PREFIX = 'custom-'
/** Selectors inside card `<style>` blocks scope to this container. */
export const RICH_BODY_SCOPE = '.tavern-body '

const markdownOptions: Parameters<typeof micromark>[1] = {
  extensions: [gfm(), math()],
  htmlExtensions: [gfmHtml(), mathHtml()],
}

/** Preview the text through markdown with card HTML enabled. */
/* oxlint-disable @stylistic/max-len, typescript/no-unnecessary-type-conversion, typescript/no-unnecessary-condition -- 卡长文案行与字面表达按需豁免（范围内） */
function toHtml(text: string): string {
  const wrapped = text.replace(/<style>([\s\S]*?)<\/style>/gi, (_match, css: string) => {
    return `<custom-style>${encodeURIComponent(css)}</custom-style>`
  })
  return micromark(wrapped, markdownOptions)
}

/** Strip non-data URLs from media sources — cards render no off-device media. */
function externalMediaSrc(node: Element): boolean {
  const tag = node.tagName.toLowerCase()
  if (!['img', 'video', 'audio', 'source', 'track', 'embed', 'object'].includes(tag)) return false
  const src = node.getAttribute('src') ?? node.getAttribute('data') ?? ''
  return src !== '' && !src.startsWith('data:')
}

/**
 * DOMPurify's ESM/CJS interop varies by bundler; both shapes settle into one
 * instance object here (v3 ships `default` plus named re-exports).
 */
type PurifyInstance = {
  addHook(hook: string, fn: (...args: unknown[]) => void): void
  sanitize(dirty: string, config?: Record<string, unknown>): string
}
const purifyShape = (DOMPurifyModule as unknown as { default?: unknown }).default ?? DOMPurifyModule
/** The build may export the instance or the window factory; both converge here (lazy: no window at import in plain-Node tooling). */
let purify: PurifyInstance | undefined
function purifyInstance(): PurifyInstance {
  if (purify === undefined) {
    purify = typeof purifyShape === 'function'
      ? (purifyShape as unknown as (scope: object) => PurifyInstance)(window)
      : (purifyShape as PurifyInstance)
  }
  return purify
}

let hooksInstalled = false
function installHooks(): void {
  if (hooksInstalled) return
  hooksInstalled = true
  purifyInstance().addHook('afterSanitizeAttributes', (node) => {
    if (!(node instanceof Element)) return
    const className = node.getAttribute('class')
    if (className !== null && className !== '') {
      const prefixed = className.split(/\s+/)
        .map(token => token === '' || token.startsWith(CARD_CLASS_PREFIX) || token.startsWith('fa-') ? token : `${CARD_CLASS_PREFIX}${token}`)
        .join(' ')
      node.setAttribute('class', prefixed)
    }
  })
  purifyInstance().addHook('uponSanitizeElement', (...hookArgs: unknown[]) => {
    const element = hookArgs[0] as Element | null
    const tag = (hookArgs[1] as { tagName?: string } | undefined)?.tagName
    if (element instanceof Element && tag !== 'custom-style' && externalMediaSrc(element)) {
      element.remove()
    }
  })
}

/**
 * Sanitize + render one settled message text into the message-body HTML.
 * Fails closed: a thrown step degrades to the escaped plain text (React's
 * own escaping on the fallback keeps the player reading, never blank).
 * @param text - the message body text after `stripInstructions`.
 * @returns the html string for `dangerouslySetInnerHTML`.
 */
const renderCache = new Map<string, string>()

export /* oxlint-enable @stylistic/max-len, typescript/no-unnecessary-type-conversion, typescript/no-unnecessary-condition */
function renderRichBody(text: string): string {
  const cached = renderCache.get(text)
  if (cached !== undefined) return cached
  try {
    installHooks()
    const clean = purifyInstance().sanitize(toHtml(text), { ADD_TAGS: ['custom-style'] })
    const dom = new DOMParser().parseFromString(`<body>${clean}</body>`, 'text/html')
    for (const carrier of Array.from(dom.body.querySelectorAll('custom-style'))) {
      // jsdom/lib.dom types textContent non-nullable for these carriers.
      const css = decodeURIComponent(carrier.textContent)
      const scoped = scopeCssRules(css, RICH_BODY_SCOPE)
      const style = dom.createElement('style')
      style.setAttribute('data-tavern-card-style', '')
      style.textContent = scoped
      carrier.replaceWith(style)
    }
    const inner = dom.body.innerHTML
    renderCache.set(text, inner)
    return inner
  } catch {
    return ''
  }
}
