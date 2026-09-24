/* oxlint-disable @stylistic/max-len -- 卡片长文案与长模板串按行豁免，上限约束不适用于此文件的长中文字符串 */
/**
 * The card UI host: loads a card's `preset/ui/` presentation pack (theme.css,
 * chat.css, layout.json, index.js), injects the guarded `chat.css` sheet, and
 * mounts the card's `mount(tavern)` module. Installing a card already grants
 * host-level trust (its scripts run host-side bash), so the pack applies
 * without a consent dialog; `theme.css` is NOT injected here — it is returned
 * as `themeCss` and the caller (themes.ts) folds it into the `#tavern-theme`
 * sheet behind the active built-in tokens. The mount face carries the
 * card's data channels (`runScript`/`callScript`/`readAsset`), the
 * admission/stop pair (`submit`/`stop` — the same production paths the
 * native composer drives), and the opening contract (`opening`) —
 * data + signal instead of cards polling host DOM. Styles pass a small guard (no
 * `@import`, no absolute-protocol `url()`), `chat.css` selectors are prefixed
 * to `.tavern-stage`, and layout.json is clamped to the known vocabulary —
 * bad input degrades to the default look with a console note, never breaking
 * the page.
 * @module dsh-tavern-fengyue-ui/card-ui
 */

import type { TavernRpc } from './rpc.ts'
import { scopeCssRules } from './scope-css.ts'

/** A host default cell a card may claim — render-suppress it or dock into its own layout. */
export type SuppressCell = 'opening' | 'composer'

/** The layout.json data-side declaration (positioning stays in the card's CSS). */
export interface CardLayout {
  /** Message-list viewport window: show at most the last N lines (scroll-up loads more). */
  readonly windowLast?: number | undefined
  /** Message-body HTML rendering switch (default on; `false` renders plain text). */
  readonly html: boolean
  /** Declared panel containers: v1 = the card's own DOM fills them (index.js mount); v2 = host-pumped (data+view). */
  readonly panels: readonly CardLayoutPanel[]
  /** Host default cells NOT to render (the card owns them and paints its own). Empty = host renders them. */
  readonly suppress: readonly SuppressCell[]
  /** Host default cells to STILL render, but positioned by the card into its own layout (dock). Composer only today. */
  readonly dock: readonly SuppressCell[]
}

export interface CardLayoutPanel {
  readonly name: string
  readonly slot: 'top' | 'bottom' | 'left' | 'right' | 'overlay'
  readonly size?: string
  /** v2: the data source — the framework pumps it and hands `data` to the view. Absent = v1 container. */
  readonly data?: { readonly script: string; readonly params?: Readonly<Record<string, unknown>> }
  /** v2: the exported function name in `preset/ui/view.mjs` painting this panel. */
  readonly view?: string
  /** v2: hide the container while an opening overlay is on screen. */
  readonly hideDuringOpening?: boolean
}

/**
 * The opening facts the host hands a card (opening-surface contract
 * 2026-09-24): data the card renders itself when it suppresses the
 * host's default opening (`greetings`), plus the authoritative
 * "opening surface is on-screen" signal with change notification —
 * the replacement for cards polling `[class*="openingFrame"]`.
 */
export interface CardOpeningFace {
  /** `preset/greetings.json` entries (host is the only reader); `[]` when absent or malformed. */
  readonly greetings: readonly string[]
  /** The host's authoritative fact: the opening surface is currently on-screen. */
  get active(): boolean
  /** Notified on every `active` flip; returns the unsubscribe. */
  subscribe(listener: () => void): () => void
}

/** * The live assistant stream face: the host pushes the chat view's current
 * transient text (the per-turn narrative deltas) so a docked card can render
 * rows as they stream instead of waiting for the durable settlement. Pure
 * addition — cards that never subscribe are untouched. Reasoning (live think)
 * rides a sibling channel for the card's folded streaming think row.
 */
export interface AssistantLiveFace {
  /** Current accumulated live assistant text (may be empty when idle/replay). */
  get text(): string
  /** Current accumulated live reasoning text (may be empty). */
  get reasoning(): string
  /** Notified with the accumulated text on every push; returns the unsubscribe. */
  subscribe(listener: (text: string) => void): () => void
  /** Notified with the accumulated reasoning on every push; returns the unsubscribe. */
  subscribeReasoning?(listener: (reasoning: string) => void): () => void
}

/** The mounted card UI: layout facts, the guarded card theme, plus the disposer. */
export interface CardUiHandle {
  readonly layout: CardLayout
  /** The guarded `preset/ui/theme.css` (asset urls resolved), or null when the card ships none. */
  readonly themeCss: string | null
  /** The opening face mounted through `tavern.opening`. */
  readonly opening: CardOpeningFace
  /** The live assistant stream face mounted through `tavern.assistantLive`. */
  readonly assistantLive: AssistantLiveFace
  /** Authoritative opening-surface truth; TavernChatView pushes it on every change. */
  setOpeningActive(active: boolean): void
  /** Push the chat view's accumulated live assistant text to the card's stream subscribers. */
  feedAssistantLive(text: string): void
  /** Push the chat view's accumulated live reasoning text to the card's stream subscribers. */
  feedLiveReasoning(reasoning: string): void
  dispose(): void
}

const SLOTS = new Set(['top', 'bottom', 'left', 'right', 'overlay'])
const CHAT_STYLE_ID = 'tavern-card-chat'
const UI_STYLE_ID = 'tavern-card-ui'

async function tryReadText(rpc: TavernRpc, sessionId: string, path: string): Promise<string | null> {
  try {
    const value = await rpc.readText({ sessionId, path })
    return value.text
  } catch {
    return null
  }
}

/** The CSS guard: `@import` and absolute-protocol url()s drop the whole file (fail loud in console, never on the page). */
function guardCss(css: string, label: string): string | null {
  if (/@import\b/.test(css) || /url\(\s*['"]?\s*(?:https?:|ftp:|\/\/)/i.test(css)) {
    console.warn(`[tavern] card ui: ${label} failed the guard (import/absolute url) — dropped`)
    return null
  }
  return css
}

/** Rewrite `url("relative")` targets to preset-asset data URLs through the read channel. */
async function resolveAssetUrls(rpc: TavernRpc, sessionId: string, css: string, baseDir: string): Promise<string> {
  const matches = Array.from(css.matchAll(/url\(\s*['"]?([^'")]+)/g))
  let out = css
  for (const match of matches) {
    const raw = match[1]?.trim() ?? ''
    if (raw === '' || raw.startsWith('data:')) continue
    const rel = raw.replace(/^\.\//, '')
    try {
      const asset = await rpc.readAsset({ sessionId, path: `${baseDir}${rel}` })
      out = out.split(raw).join(asset.dataUrl)
    } catch {
      console.warn(`[tavern] card ui: asset ref "${rel}" unresolved`)
    }
  }
  return out
}

/** Clamp layout.json to the known vocabulary; any bad shape degrades to the default. */
/* oxlint-enable @stylistic/max-len, typescript/no-unnecessary-type-conversion, typescript/no-unnecessary-condition */
function parseLayout(raw: string | null): CardLayout {
  const fallback: CardLayout = { html: true, panels: [], suppress: [], dock: [] }
  if (raw === null) return fallback
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const html = parsed['html'] === undefined ? true : parsed['html'] === true
    const windowValue = parsed['transcript'] instanceof Object ? (parsed['transcript'] as Record<string, unknown>)['window'] : undefined
    let windowLast: number | undefined
    if (typeof windowValue === 'object' && windowValue !== null) {
      const last = (windowValue as Record<string, unknown>)['last']
      if (typeof last === 'number' && Number.isInteger(last) && last >= 1 && last <= 500) windowLast = last
    }
    const panels: CardLayoutPanel[] = []
    if (Array.isArray(parsed['panels'])) {
      for (const entry of parsed['panels']) {
        const record = entry as Record<string, unknown>
        if (typeof record['name'] !== 'string' || !/^[A-Za-z0-9_-]+$/.test(record['name'])) throw new Error('panel name')
        if (!SLOTS.has(String(record['slot']))) throw new Error('panel slot')
        // v2 面板(可选):data+view 成对声明才交给宿主运行时;半声明=fail-visible 的错误 chip,不静默
        const rawData = record['data'] instanceof Object ? record['data'] as Record<string, unknown> : undefined
        const view = record['view']
        const rawParams = rawData !== undefined && rawData['params'] instanceof Object
          ? rawData['params'] as Readonly<Record<string, unknown>> : undefined
        const data = rawData === undefined ? undefined : {
          script: typeof rawData['script'] === 'string' && /^[A-Za-z0-9_-]+\.mjs$/.test(rawData['script'])
            ? rawData['script'] : (() => { throw new Error('panel data script') })(),
          ...(rawParams === undefined ? {} : { params: rawParams }),
        }
        panels.push({
          name: record['name'],
          slot: record['slot'] as CardLayoutPanel['slot'],
          ...(typeof record['size'] === 'string' ? { size: record['size'] } : {}),
          ...(data === undefined ? {} : { data }),
          ...(typeof view === 'string' && /^[A-Za-z0-9_$]+$/.test(view) ? { view } : {}),
          ...(record['hideDuringOpening'] === true ? { hideDuringOpening: true } : {}),
        })
      }
    }
    // suppress(可选):被卡接管的宿主默认格。未知词直接拒——覆盖声明
    // 拼错字号静默通过比 fail-visible 更糟(宿主照样画、卡照旧盖,又一轮互相猜)。
    const suppress: SuppressCell[] = []
    if (parsed['suppress'] !== undefined) {
      if (!Array.isArray(parsed['suppress'])) throw new Error('suppress list')
      for (const cell of parsed['suppress'] as unknown[]) {
        if (cell !== 'opening' && cell !== 'composer') throw new Error(`suppress cell "${String(cell)}"`)
        suppress.push(cell)
      }
    }
    // dock(可选):宿主仍然渲染、卡重新定位进自己的布局。本轮只承认 composer——
    // 未知词 fail 整份(dock 声明拼错会让卡永远量不到目标,宁 fail 醒目)。
    const dock: SuppressCell[] = []
    if (parsed['dock'] !== undefined) {
      if (!Array.isArray(parsed['dock'])) throw new Error('dock list')
      for (const cell of parsed['dock'] as unknown[]) {
        if (cell !== 'composer') throw new Error(`dock cell "${String(cell)}"`)
        dock.push(cell)
      }
    }
    return { ...(windowLast === undefined ? {} : { windowLast }), html, panels, suppress, dock }
  } catch (error) {
    console.warn('[tavern] card ui: layout.json rejected —', error instanceof Error ? error.message : String(error))
    return fallback
  }
}

function setStyleElement(id: string, css: string | null): void {
  document.getElementById(id)?.remove()
  if (css === null || css === '') return
  const element = document.createElement('style')
  element.id = id
  element.textContent = css
  document.head.append(element)
}

/**
 * Load and mount one card's UI pack for a binding.
 * @param rpc - the tavern face.
 * @param sessionId - the binding the pack belongs to.
 * @param extras - faces handed from the chat view (stable refs, see
 *   the stop note in TavernChatView); `stop` is the host's stop
 *   semantics so the card never forwards clicks to host DOM again.
 * @returns the live handle, or null when the card ships no `ui/`.
 */
export async function loadCardUi(
  rpc: TavernRpc,
  sessionId: string,
  extras: { readonly stop?: () => Promise<unknown> | void } = {},
): Promise<CardUiHandle | null> {
  // 存在性靠直读六件套判定——不踩 tree（2026-09-20 懒树期曾按「树里翻得到 preset/ui/*」
  // 判定，恒 false 导致卡 UI 整面失挂；懒树已回滚，直读探测保留：挂载从此与树语义无关）。
  // view.mjs/acts.mjs = v2 声明形态（宿主运行时）；index.js = legacy mount 形态。可并存。
  const [themeRaw, chatRaw, layoutRaw, indexCode, viewCode, actsCode, uiCssRaw, runtimeCode] = await Promise.all([
    tryReadText(rpc, sessionId, 'preset/ui/theme.css'),
    tryReadText(rpc, sessionId, 'preset/ui/chat.css'),
    tryReadText(rpc, sessionId, 'preset/ui/layout.json'),
    tryReadText(rpc, sessionId, 'preset/ui/index.js'),
    tryReadText(rpc, sessionId, 'preset/ui/view.mjs'),
    tryReadText(rpc, sessionId, 'preset/ui/acts.mjs'),
    tryReadText(rpc, sessionId, 'preset/ui/ui.css'),
    tryReadText(rpc, sessionId, 'preset/ui/runtime.mjs'),
  ])
  const present = [themeRaw, chatRaw, layoutRaw, indexCode, viewCode, actsCode, uiCssRaw, runtimeCode].some(raw => raw !== null && raw.trim() !== '')
  if (!present) {
    // 面板整面消失的头号嫌疑就在这行静默里（2026-09-21「芙宁娜草稿会话」事故）——响亮留痕：
    // 没有卡包可挂 != 挂载失败。草稿卡/无 ui 卡都会走到这里。
    console.warn(`[tavern] card ui: session "${sessionId}" has no preset/ui pack — nothing to mount (draft card or ui-less card)`)
    return null
  }
  // Independent read, deliberately NOT part of the presence check
  // above (that answers "does the card ship a ui pack"; greetings is
  // opening data). Tolerant parse: bad JSON / non-string rows = [] —
  // the same semantics the host's own default-opening reader uses.
  let greetings: readonly string[] = []
  try {
    const raw = await tryReadText(rpc, sessionId, 'preset/greetings.json')
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw)
      const declared = typeof parsed === 'object' && parsed !== null
        ? (parsed as { greetings?: unknown }).greetings
        : undefined
      if (Array.isArray(declared)) {
        greetings = declared.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
      }
    }
  } catch {
    greetings = []  // 可选数据文件,静默回退(与默认开场页读侧同口径)
  }
  const guardedTheme = themeRaw === null ? null : guardCss(await resolveAssetUrls(rpc, sessionId, themeRaw, 'preset/ui/'), 'theme.css')
  const guardedChat = chatRaw === null ? null : guardCss(await resolveAssetUrls(rpc, sessionId, chatRaw, 'preset/ui/'), 'chat.css')
  setStyleElement(CHAT_STYLE_ID, guardedChat === null ? null : scopeCssRules(guardedChat, '.tavern-stage '))
  // v2 面板样式(ui.css):全局注入、不作用域重写——面板定位契约(.tavern-stage > .tavern-panel-*)、
  // 卡 token(.dnd-hud 变量)、fixed 模态(fc-ov/bk)都在其中;拆分前内嵌在 index.js 的 style 元素里。
  setStyleElement(UI_STYLE_ID, guardCss(uiCssRaw ?? '', 'ui.css'))

  const layout = parseLayout(layoutRaw)
  const urls: Array<{ url: string }> = []
  const importModule = async <T>(code: string | null, label: string): Promise<T | null> => {
    if (code === null || code.trim() === '') return null
    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
    urls.push({ url })
    try {
      return await (import(/* @vite-ignore */ url) as Promise<T>)
    } catch (error) {
      console.warn(`[tavern] card ui: ${label} import failed —`, error instanceof Error ? error.message : String(error))
      return null
    }
  }

  const views = await importModule<Record<string, (data: unknown, extra: { avatars: Readonly<Record<string, string>>; ui: Readonly<Record<string, unknown>> }) => string>>(viewCode, 'view.mjs')
  const acts = await importModule<Record<string, (ctx: unknown, event: Event) => void>>(actsCode, 'acts.mjs')
  const runtime = await importModule<{ mountPanels?: (deps: Record<string, unknown>) => { dispose(): void } }>(runtimeCode, 'runtime.mjs')

  // The opening-surface truth cell: the chat view pushes `setOpeningActive`
  // (it alone knows 清空/转写), the card reads `active`/`subscribe`.
  // Dispose clears the listeners so a dropped handle never fires.
  let openingActive = false
  const openingListeners = new Set<() => void>()
  const opening: CardOpeningFace = {
    greetings,
    get active(): boolean { return openingActive },
    subscribe(listener: () => void): () => void {
      openingListeners.add(listener)
      return () => { openingListeners.delete(listener) }
    },
  }
  const setOpeningActive = (active: boolean): void => {
    if (openingActive === active) return
    openingActive = active
    for (const listener of [...openingListeners]) listener()
  }
  // Live assistant stream face: host pushes the chat view's accumulated
  // transient text; cards subscribe to render rows as they arrive.
  let liveAsst = ''
  const liveListeners = new Set<(text: string) => void>()
  let liveReasoning = ''
  const reasoningListeners = new Set<(reasoning: string) => void>()
  const assistantLive: AssistantLiveFace = {
    get text(): string { return liveAsst },
    get reasoning(): string { return liveReasoning },
    subscribe(listener: (text: string) => void): () => void {
      liveListeners.add(listener)
      return () => { liveListeners.delete(listener) }
    },
    subscribeReasoning(listener: (reasoning: string) => void): () => void {
      reasoningListeners.add(listener)
      return () => { reasoningListeners.delete(listener) }
    },
  }
  const feedAssistantLive = (text: string): void => {
    if (liveAsst === text) return
    liveAsst = text
    for (const listener of [...liveListeners]) listener(text)
  }
  const feedLiveReasoning = (reasoning: string): void => {
    if (liveReasoning === reasoning) return
    liveReasoning = reasoning
    for (const listener of [...reasoningListeners]) listener(reasoning)
  }

  let unmount: (() => void) | undefined
  if (indexCode !== null && indexCode.trim() !== '') {
    const mod = await importModule<{ mount?: (tavern: unknown) => (() => void) | void }>(indexCode, 'index.js')
    try {
      // 卡入口拿到:数据通道(runScript 文本形/callScript 结构形)+已装载的模块家族+声明。
      // v2 面板的实例化(index.js 组装 runtime+views+acts)是卡自携逻辑——宿主不再是运行时。
      const returned = mod?.mount?.({
        runScript: (name: string, ...args: string[]) =>
          rpc.runScript({ sessionId, name, args }).then(value => value.text),
        callScript: (name: string, ...args: string[]) => rpc.runScript({ sessionId, name, args }),
        // 玩家手势发送:卡自持输入的 Enter/发送键直接走宿主同一 RPC 通道。
        // requestId 每次现生成(不可预测不可复用);与原生 composer 完全同 admission。
        submit: (text: string) => rpc.prompt({
          sessionId,
          text,
          requestId: crypto.randomUUID(),
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
        // 停止:宿主 chat view 的同语义通道(经稳定 ref 转发);卡的
        // waiting 态停止小键由此直达,替代点宿主 send-btn 的 DOM hack。
        stop: () => extras.stop?.(),
        // 开场契约:suppress opening 的卡据此自绘起步(greetings)与
        // 开场结束(active/subscribe)——三卡共享的 [class*="openingFrame"]
        // 轮询探测由此退役的第一块砖。
        opening,
        // 流式通道:宿主聊天视图把 live assistant 瞬态文本推进来,卡按行切分即时渲染。
        // 旧卡不缺省 subscribe 即不受影响(纯加法)。
        assistantLive,
        readAsset: (path: string) =>
          rpc.readAsset({ sessionId, path }).then(value => value.dataUrl).catch(() => undefined),
        layout,
        views,
        acts,
        runtime,
      })
      if (typeof returned === 'function') unmount = returned
    } catch (error) {
      console.warn('[tavern] card ui: mount failed —', error instanceof Error ? error.message : String(error))
    }
  }
  return {
    layout,
    themeCss: guardedTheme,
    opening,
    assistantLive,
    setOpeningActive,    feedAssistantLive,
    feedLiveReasoning,
    dispose(): void {
      try { unmount?.() } catch (error) { console.warn('[tavern] card ui: unmount failed —', error) }
      openingListeners.clear()
      liveListeners.clear()
      reasoningListeners.clear()
      setStyleElement(CHAT_STYLE_ID, null)
      setStyleElement(UI_STYLE_ID, null)
      for (const entry of urls) URL.revokeObjectURL(entry.url)
    },
  }
}
