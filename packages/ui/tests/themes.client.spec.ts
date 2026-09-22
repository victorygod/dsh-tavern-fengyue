// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { applyTheme, clearTheme, readThemeChoice, THEME_CHOICES, writeThemeChoice } from '../src/client/themes.ts'

function sheetText(): string {
  return document.getElementById('tavern-theme')?.textContent ?? ''
}

afterEach(() => {
  clearTheme()
  window.localStorage.clear()
})

describe('applyTheme', () => {
  it('declares the parchment tokens on the .tavern-root hook', () => {
    applyTheme('parchment', null)
    const text = sheetText()
    expect(text).toContain('.tavern-root {')
    expect(text).toContain('--t-bg: #f7f6f1;')
    expect(text).toContain('--t-serif: Georgia, "Songti SC", "Noto Serif SC", serif;')
  })

  it('appends the card css after the token base only under the card choice', () => {
    applyTheme('card', '.tavern-root { --t-bg: #000000; }')
    const text = sheetText()
    expect(text.indexOf('--t-bg: #f7f6f1;')).toBeLessThan(text.indexOf('--t-bg: #000000;'))

    applyTheme('dsw-light', '.tavern-root { --t-bg: #000000; }')
    const overridden = sheetText()
    expect(overridden).toContain('--t-bg: rgb(255, 255, 255);')
    expect(overridden).not.toContain('#000000;')
  })

  it('resolves a card choice without card css to the parchment base', () => {
    applyTheme('card', null)
    expect(sheetText()).toContain('--t-bg: #f7f6f1;')
  })

  it('replaces the one sheet on re-application instead of stacking', () => {
    applyTheme('parchment', null)
    applyTheme('dsw-dark', null)
    expect(document.querySelectorAll('#tavern-theme')).toHaveLength(1)
    expect(sheetText()).toContain('--t-bg: rgb(21, 21, 23);')
  })

  it('clearTheme removes the sheet', () => {
    applyTheme('parchment', null)
    clearTheme()
    expect(document.getElementById('tavern-theme')).toBeNull()
  })
})

describe('theme choices', () => {
  it('lists the card option and the three built-ins in settings-row order', () => {
    expect(THEME_CHOICES).toEqual(['card', 'parchment', 'dsw-light', 'dsw-dark'])
  })
})

describe('theme choice storage', () => {
  it('defaults to card and roundtrips a stored choice', () => {
    expect(readThemeChoice()).toBe('card')
    writeThemeChoice('dsw-dark')
    expect(readThemeChoice()).toBe('dsw-dark')
  })

  it('falls back to card on an unknown stored value', () => {
    window.localStorage.setItem('tavern.ui.theme', 'neon-rainbow')
    expect(readThemeChoice()).toBe('card')
  })
})
