import { describe, expect, it } from 'vitest'
import { scopeCssRules } from '../src/client/scope-css.ts'

describe('scopeCssRules', () => {
  it('prefixes every top-level selector of one rule', () => {
    expect(scopeCssRules('.msg { color: red; }', '.tavern-body '))
      .toBe('.tavern-body .msg { color: red; }')
  })

  it('prefixes each selector of a comma-separated list, without splitting commas inside :is()/[]', () => {
    const css = ':is(a, b).x, [data-x=","] .y, p > q { m: 0; }'
    expect(scopeCssRules(css, '.tavern-body ')).toBe(
      '.tavern-body :is(a, b).x, .tavern-body [data-x=","] .y, .tavern-body p > q { m: 0; }',
    )
  })

  it('leaves an already-prefixed selector and root/body untouched', () => {
    expect(scopeCssRules('.tavern-body .msg, :root, html, body { a: b; }', '.tavern-body '))
      .toBe('.tavern-body .msg, :root, html, body { a: b; }')
  })

  it('recurses into @media / @supports blocks and leaves their heads intact', () => {
    const css = '@media (min-width: 10px) { .x { a: b; } @supports (display: grid) { .y { c: d; } } }'
    expect(scopeCssRules(css, '.tavern-body ')).toBe(
      '@media (min-width: 10px) { .tavern-body .x { a: b; } @supports (display: grid) { .tavern-body .y { c: d; } } }',
    )
  })

  it('keeps @keyframes stops verbatim and still scopes the rule that animates them', () => {
    const css = '@keyframes fade { from { opacity: 0; } 50% { opacity: 0.5; } to { opacity: 1; } } .m { animation: fade 1s; }'
    expect(scopeCssRules(css, '.tavern-body ')).toBe(
      '@keyframes fade { from { opacity: 0; } 50% { opacity: 0.5; } to { opacity: 1; } } .tavern-body .m { animation: fade 1s; }',
    )
  })

  it('ignores braces inside strings and comments', () => {
    const css = '.a { content: "}"; /* { */ }'
    expect(scopeCssRules(css, '.tavern-body ')).toBe('.tavern-body .a { content: "}"; /* { */ }')
  })

  it('returns malformed input byte-identical instead of half-rewriting', () => {
    const bad = '.a { color: red;'
    expect(scopeCssRules(bad, '.tavern-body ')).toBe(bad)
  })

  it('scopes to .tavern-stage the same way chat.css uses it', () => {
    expect(scopeCssRules('.message { p: 0; }', '.tavern-stage ')).toBe('.tavern-stage .message { p: 0; }')
  })
})
