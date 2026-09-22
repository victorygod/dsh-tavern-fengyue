/**
 * The tavern theme system: three built-in token sets (parchment, dsw light,
 * dsw dark) applied as one stylesheet on the stable `.tavern-root` hook, plus
 * the per-binding card theme resolution. Card `preset/ui/theme.css` rides in
 * behind the parchment base when the choice is `card`; any built-in choice
 * replaces the card theme outright. Tokens live here, not in the module CSS -
 * the sheets below are the only place `--t-*` customs are declared, and every
 * rule in App.module.css / TavernView.module.css consumes them.
 * @module dsh-tavern-fengyue-ui/themes
 */

/** A selectable theme. `card` defers to the bound card's `preset/ui/theme.css`. */
export type ThemeChoice = 'card' | 'parchment' | 'dsw-light' | 'dsw-dark'

/** All settings-page options, in display order. */
export const THEME_CHOICES: readonly ThemeChoice[] = ['card', 'parchment', 'dsw-light', 'dsw-dark']

/** The built-in themes a `card` choice falls back to (and that cards restyle on top of). */
type BuiltinTheme = Exclude<ThemeChoice, 'card'>

const STORAGE_KEY = 'tavern.ui.theme'
const SHEET_ID = 'tavern-theme'

/** The dsh web UI sans stack (packages/client/web/src/base.css body face). */
const DSW_SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif`
const MONO = `"SF Mono", Menlo, Consolas, monospace`

/** Token tables. Keys are the exact custom-property names the CSS consumes. */
const TOKENS: Record<BuiltinTheme, Record<string, string>> = {
  parchment: {
    '--t-bg': '#f7f6f1',
    '--t-bg-deep': '#fdfcf9',
    '--t-surface-2': '#faf9f5',
    '--t-surface-card': '#ffffff',
    '--t-card': '#f1efe8',
    '--t-border': '#e2ded2',
    '--t-border-soft': '#eae7dd',
    '--t-fg-strong': '#29261f',
    '--t-fg': '#3d3a33',
    '--t-veil': 'rgba(255, 255, 255, 0.82)',
    '--t-muted': '#8b877c',
    '--t-muted2': '#a8a49a',
    '--t-gold': '#b3860a',
    '--t-gold-bright': '#d4a017',
    '--t-gold-dim': '#d8c07a',
    '--t-gold-soft': 'rgba(212, 160, 23, 0.12)',
    '--t-gold-wash': '#fdf6e2',
    '--t-gold-deep': '#8a6d1a',
    '--t-gold-grad-a': '#e2b32c',
    '--t-gold-grad-b': '#c69413',
    '--t-gold-ink': '#1b1408',
    '--t-gold-rgb': '212, 160, 23',
    '--t-ok': '#4d7c43',
    '--t-ok-soft': '#e4efdf',
    '--t-ok-border': '#cfe3c9',
    '--t-danger': '#b05548',
    '--t-danger-soft': '#fdf1ef',
    '--t-danger-border': '#e39b93',
    '--t-danger-rgb': '176, 85, 72',
    '--t-bubble-bg': '#f0ead9',
    '--t-bubble-border': '#e7dfc9',
    '--t-bubble-fg': '#35312a',
    '--t-scrim': 'rgba(58, 48, 26, 0.32)',
    '--t-shadow-rgb': '80, 66, 30',
    '--t-serif': `Georgia, "Songti SC", "Noto Serif SC", serif`,
    '--t-mono': MONO,
  },
  'dsw-light': {
    '--t-bg': 'rgb(255, 255, 255)',
    '--t-bg-deep': 'rgb(250, 250, 250)',
    '--t-surface-2': 'rgb(249, 250, 251)',
    '--t-surface-card': 'rgb(255, 255, 255)',
    '--t-card': 'rgb(241, 243, 245)',
    '--t-border': 'rgba(0, 0, 0, 0.10)',
    '--t-border-soft': 'rgba(0, 0, 0, 0.06)',
    '--t-fg-strong': 'rgb(15, 17, 21)',
    '--t-fg': 'rgb(97, 102, 107)',
    '--t-veil': 'rgba(255, 255, 255, 0.85)',
    '--t-muted': 'rgb(129, 133, 140)',
    '--t-muted2': 'rgb(173, 178, 184)',
    '--t-gold': 'rgb(65, 118, 230)',
    '--t-gold-bright': 'rgb(77, 147, 248)',
    '--t-gold-dim': 'rgb(211, 226, 255)',
    '--t-gold-soft': 'rgba(65, 118, 230, 0.12)',
    '--t-gold-wash': 'rgb(228, 237, 253)',
    '--t-gold-deep': 'rgb(30, 64, 175)',
    '--t-gold-grad-a': 'rgb(96, 165, 250)',
    '--t-gold-grad-b': 'rgb(59, 130, 246)',
    '--t-gold-ink': '#ffffff',
    '--t-gold-rgb': '65, 118, 230',
    '--t-ok': 'rgb(34, 197, 94)',
    '--t-ok-soft': 'rgb(230, 250, 237)',
    '--t-ok-border': 'rgba(34, 197, 94, 0.35)',
    '--t-danger': 'rgb(236, 19, 19)',
    '--t-danger-soft': 'rgb(254, 242, 242)',
    '--t-danger-border': 'rgb(254, 226, 226)',
    '--t-danger-rgb': '236, 19, 19',
    '--t-bubble-bg': 'rgb(237, 243, 254)',
    '--t-bubble-border': 'rgb(211, 226, 255)',
    '--t-bubble-fg': 'rgb(15, 17, 21)',
    '--t-scrim': 'rgba(0, 0, 0, 0.24)',
    '--t-shadow-rgb': '15, 17, 21',
    '--t-serif': DSW_SANS,
    '--t-mono': MONO,
  },
  'dsw-dark': {
    '--t-bg': 'rgb(21, 21, 23)',
    '--t-bg-deep': 'rgb(27, 27, 28)',
    '--t-surface-2': 'rgb(44, 44, 46)',
    '--t-surface-card': 'rgb(53, 54, 56)',
    '--t-card': 'rgb(53, 54, 56)',
    '--t-border': 'rgba(255, 255, 255, 0.12)',
    '--t-border-soft': 'rgba(255, 255, 255, 0.06)',
    '--t-fg-strong': 'rgb(249, 250, 251)',
    '--t-fg': 'rgb(207, 211, 214)',
    '--t-veil': 'rgba(44, 44, 46, 0.8)',
    '--t-muted': 'rgb(173, 178, 184)',
    '--t-muted2': 'rgb(151, 157, 166)',
    '--t-gold': 'rgb(103, 158, 254)',
    '--t-gold-bright': 'rgb(96, 165, 250)',
    '--t-gold-dim': 'rgb(86, 134, 254)',
    '--t-gold-soft': 'rgba(103, 158, 254, 0.16)',
    '--t-gold-wash': 'rgb(40, 49, 66)',
    '--t-gold-deep': 'rgb(183, 200, 254)',
    '--t-gold-grad-a': 'rgb(249, 250, 251)',
    '--t-gold-grad-b': 'rgb(249, 250, 251)',
    '--t-gold-ink': 'rgb(15, 17, 21)',
    '--t-gold-rgb': '103, 158, 254',
    '--t-ok': 'rgb(34, 197, 94)',
    '--t-ok-soft': 'rgb(35, 60, 44)',
    '--t-ok-border': 'rgba(78, 209, 126, 0.4)',
    '--t-danger': 'rgb(242, 90, 90)',
    '--t-danger-soft': 'rgb(87, 12, 12)',
    '--t-danger-border': 'rgba(242, 90, 90, 0.45)',
    '--t-danger-rgb': '242, 90, 90',
    '--t-bubble-bg': 'rgb(44, 44, 46)',
    '--t-bubble-border': 'rgb(67, 69, 74)',
    '--t-bubble-fg': 'rgb(249, 250, 251)',
    '--t-scrim': 'rgba(0, 0, 0, 0.5)',
    '--t-shadow-rgb': '0, 0, 0',
    '--t-serif': DSW_SANS,
    '--t-mono': MONO,
  },
}

/** Emit one `.tavern-root { … }` rule from a token table. */
function tokenCss(theme: BuiltinTheme): string {
  const table = TOKENS[theme]
  const body = Object.keys(table).map(name => `${name}: ${table[name]};`).join('\n')
  return `.tavern-root {\n${body}\n}`
}

/**
 * Read the stored theme choice.
 * @returns the choice; `'card'` when absent, unreadable, or an unknown value.
 */
export function readThemeChoice(): ThemeChoice {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored !== null && (THEME_CHOICES as readonly string[]).includes(stored)) return stored as ThemeChoice
  } catch { /* storage unavailable — browser-private mode; the in-run default applies */ }
  return 'card'
}

/**
 * Persist the theme choice for the next app mount.
 * @param choice - the choice to store.
 */
export function writeThemeChoice(choice: ThemeChoice): void {
  try { window.localStorage.setItem(STORAGE_KEY, choice) } catch { /* storage unavailable — same-run applies anyway */ }
}

/**
 * Apply the resolved theme as the one `#tavern-theme` stylesheet.
 * @param choice - the selected theme.
 * @param cardThemeCss - the bound card's guarded `preset/ui/theme.css`, or null; used only when the choice is `card`.
 */
export function applyTheme(choice: ThemeChoice, cardThemeCss: string | null): void {
  const builtin: BuiltinTheme = choice === 'card' ? 'parchment' : choice
  const cardBlock = choice === 'card' && cardThemeCss !== null ? `\n${cardThemeCss}` : ''
  const sheet = document.getElementById(SHEET_ID) ?? document.createElement('style')
  sheet.id = SHEET_ID
  sheet.textContent = `${tokenCss(builtin)}${cardBlock}`
  if (sheet.parentElement === null) document.head.append(sheet)
}

/** Drop the theme sheet (app unmount — nothing outside the tavern consumes the tokens). */
export function clearTheme(): void {
  document.getElementById(SHEET_ID)?.remove()
}
