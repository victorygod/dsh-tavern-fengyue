/**
 * The shared conversation surface of the tavern page: transcript line facts
 * and rendering, the composer (model seat, context ring, send/stop, usage
 * line), and the projection reader. Both consumers — the RP chat
 * (app/TavernApp.tsx) and the card-writing column (WriterColumn.tsx) — render
 * through this one implementation, so a stock-parity visual or interaction
 * update lands on both with one edit. Styles come from the app module (the
 * tavern chrome these views share).
 *
 * The components here are presentation + composer mechanics only: admission
 * (what a send actually calls) and per-view state (opening page, pending)
 * stay with the caller.
 * @module dsh-tavern-fengyue-ui/chat-view
 */
import { Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore, type RefObject, type ReactNode } from 'react'
import {
  DisclosureRow, IconCheckOutline16, IconCopyOutline16, IconRefreshOutline16, IconThinkOutline14, writeClipboard,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { ModelDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { ContextBreakdownProjection, ContextPressureProjection, TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { SessionStatsProjection } from '@deepseek-ai/dsh-session-stats/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import css from './app/App.module.css'
import { NS } from './locales.ts'
import { renderRichBody } from './rich-text.ts'

/** Stable provider-neutral LLM failure code for a missing credential (llm vocabulary). */
export const MISSING_CREDENTIAL = 'MISSING_CREDENTIAL'

/**
 * The runtime fact the page takes from the Conversation service: the shared
 * store key (a FORK addition absent from stock dsh hosts, 0.1.5 line; the
 * call site guards for its absence and falls back to the stock literal
 * `dsh.conversation`). The occupancy rule used to be designed in as a second
 * member, but stock hosts expose none and a sibling client face cannot be a
 * runtime import — so the ring derives occupancy locally instead (see
 * `contextOccupancyOf`).
 */
export interface ConversationFace {
  conversationStoreKey?(): string
}

/** One transcript error row fact: why the last turn failed and whether it is the key. */
export interface TurnError { message: string; missingKey: boolean }

/**
 * One tool call folded live from the tail fork's transposed assistant stream
 * (args build up per delta; the block-end settles the canonical name). The
 * settled counterpart with the paired result comes from the tail fetch.
 */
export interface TailStep {
  readonly tool: string
  readonly args: string
}

/** One rendered transcript line: user bubble, narrative, a gray flow row, or a failed-turn line. */
export interface ChatLine {
  kind: 'user' | 'narrative' | 'tool' | 'think' | 'tail' | 'stopped' | 'error'
  text: string
  time: number | undefined
  /** Tool call arguments — the collapsible flow-row body. */
  args: string | undefined
  /** Still streaming (live reasoning deltas); the summary follows the newest line. */
  live: boolean
  /** tool rows: the durable call id — pairs the tool/result into the row body (internal). */
  callId?: string
  /** tool rows: the paired durable result text (bounded). */
  result?: string
  /** tail rows: streamed steps of a live run (transposed stream). */
  steps?: readonly TailStep[]
  /** tail rows: the streamed closing reply while the run is live. */
  reply?: string
}

/** Ring geometry shared with the prototype and DSH ContextMeter: 14px viewBox, r=5.5, 2px stroke. */
export const RING_CIRCUMFERENCE = 2 * Math.PI * 5.5

/**
 * The occupancy rule of the stock ContextMeter, mirrored locally: the
 * provider-anchored numerator (`projectedTokens` over `pressureTokens`) over
 * the route's `contextWindow`; `undefined` until both are known — the ring
 * renders nothing, matching stock. Stock computes the same arithmetic inline
 * in its own bundle and exposes no service face for it, and a sibling client
 * face cannot be a runtime import, so this mirrors the public
 * `dsh-client-ui-conversation` context-occupancy contract (`undefined` in the
 * file's absent-capability idiom instead of stock's `null`).
 */
function contextOccupancyOf(pressure: ContextPressureProjection | undefined): { percent: number; usedTokens: number; contextWindow: number } | undefined {
  const usedTokens = pressure?.projectedTokens ?? pressure?.pressureTokens
  if (usedTokens === undefined || pressure?.contextWindow === undefined) return undefined
  return {
    percent: Math.min(100, Math.round(usedTokens / pressure.contextWindow * 100)),
    usedTokens,
    contextWindow: pressure.contextWindow,
  }
}

/**
 * Read one host projection for a session (the raw `ProjectionsFace` seat).
 * `undefined` uniformly means capability absent — the host unit is not mounted
 * or no baseline has carried the key yet; faces are identity-stable per key.
 */
/** The structural slice of a session binding the projection reader needs. */
type ProjectionSource = {
  session: { projections: {
    faceOf(key: string): { subscribe(notify: () => void): () => void; getSnapshot(): unknown } | undefined
  } }
} | undefined

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- T is the caller's projection domain, applied by the body cast.
export function useProjectionValue<T>(binding: ProjectionSource, key: string): T | undefined {
  const face = binding?.session.projections.faceOf(key)
  const subscribe = useCallback(
    (notify: () => void) => face?.subscribe(notify) ?? (() => undefined),
    [face],
  )
  const getSnapshot = useCallback(
    () => face?.getSnapshot() as T | undefined,
    [face],
  )
  return useSyncExternalStore(subscribe, getSnapshot)
}

/** Prototype `fmtK`: integers below 1024, otherwise one decimal in K (1024-based). */
export function fmtK(value: number): string {
  if (value < 1024) return String(Math.round(value))
  return `${Math.round(value / 102.4) / 10}K`
}

export function stampOf(time: number | undefined): string | undefined {
  if (time === undefined || Number.isNaN(time)) return undefined
  const at = new Date(time)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/**
 * Flow-row summary rule (prototype parity): a streaming row follows the
 * newest non-empty line; a settled row pins the first line.
 */
export function summaryOf(text: string, live: boolean): string {
  const lines = text.split('\n')
  if (!live) return lines[0] ?? ''
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index]
    if (line !== undefined && line.trim() !== '') return line
  }
  return ''
}

/**
 * Aggregate a durable assistant stream's reasoning records into one text —
 * the settled 思考折叠行 body. There is no separate `assistant/attempt` log
 * event: the packed stream rides the `assistant/message` event's `data`.
 */
export function reasoningOf(data: Record<string, unknown>): string {
  const stream = Array.isArray(data['stream']) ? data['stream'] as { type?: string; texts?: unknown }[] : []
  return stream
    .filter(record => record.type === 'reasoning-chunks' && Array.isArray(record.texts))
    .flatMap(record => record.texts as string[])
    .join('')
}

/** One collapsible flow row (think / tool): a quiet label line that expands to its body. */
export function FlowRow(props: {
  label: string
  mono?: boolean
  summary: string
  body?: string | undefined
  monoBody?: boolean | undefined
  live?: boolean | undefined
  /** The stable tavern-* hook this row exposes to card CSS. */
  hook?: string | undefined
}): ReactNode {
  const [open, setOpen] = useState(false)
  const expandable = props.body !== undefined && props.body !== ''
  const live = props.live === true
  return (
    <div className={`${css.flowRow} ${open ? css.open : ''} ${expandable ? css.expandable : ''} ${live ? css.running : ''} ${props.hook ?? ''}`}>
      <div
        className={css.rowline}
        onClick={() => { if (expandable) setOpen(value => !value) }}
      >
        {expandable && <span className={css.chev}>▶</span>}
        <span className={props.mono === true ? css.lbMono : css.lb}>{props.label}</span>
        {props.summary !== '' && <span className={css.sep} />}
        <span className={`${css.sum} ${live ? css.follow : ''}`}><span className={css.st}>{props.summary}</span></span>
      </div>
      {expandable && open && (
        props.monoBody === true
          ? <div className={css.flowBodyMono}>{props.body}</div>
          : <div className={css.flowBody}>{props.body}</div>
      )}
    </div>
  )
}

/**
 * The thinking disclosure — stock-chat ReasoningRow parity (user ask
 * 2026-09-17): the same DisclosureRow primitive with the think glyph, 24px
 * row, 13/20 tertiary body, hover chevron, and the running sweep. Chrome
 * colors come from the primitive's own dsw steps (they resolve against the
 * shell); only the sweep and body ride tavern tokens.
 * @param props - the locale seat, the full or streaming reasoning text, and whether this row is the live tail.
 * @returns the reasoning disclosure row.
 */
function ThinkRow(props: { t: TranslateNS<typeof NS>; text: string; live: boolean }): ReactNode {
  const [open, setOpen] = useState(false)
  const expandable = props.text !== ''
  return (
    <div
      className={`${css.flowRow} tavern-thinking`}
      data-state={props.live ? 'running' : 'ok'}
    >
      <DisclosureRow
        className={css.thinkRow}
        rowClassName={css.thinkLine}
        leadingClassName={css.thinkLead}
        titleClassName={css.thinkTitle}
        icon={<IconThinkOutline14 size={14} />}
        title={props.t('chat.thinkRow')}
        open={open}
        expandable={expandable}
        expandOnRowClick
        onToggle={(): void => { setOpen(value => !value) }}
        collapsedContent={expandable ? (
          <>
            <span className={css.sep} aria-hidden />
            <span className={`${css.sum} ${props.live ? css.follow : ''}`}><span className={css.st}>{summaryOf(props.text, props.live)}</span></span>
          </>
        ) : undefined}
      >
        <div className={css.thinkBody}>{props.text}</div>
      </DisclosureRow>
    </div>
  )
}

/**
 * The session snapshot facts both transcript views render: the running bit
 * (stop seat) and the two admission-failure rows the event stream never
 * carries. Subscribe identity follows the binding; the snapshot object is the
 * client store's hoisted instance.
 */
type SessionSnapshot = {
  running?: boolean
  openState?: string
  openError?: { message: string } | null | undefined
  promptError?: { error: { message: string } } | null | undefined
}
type SessionSurfaceSource = { session: { subscribe(listener: () => void): () => void; getSnapshot(): SessionSnapshot } } | undefined

export function useSessionSurface(binding: SessionSurfaceSource): {
  running: boolean
  openBroken: { message: string } | null
  promptBroken: { error: { message: string } } | null
} {
  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => binding?.session.subscribe(listener) ?? (() => undefined), [binding]),
    useCallback(() => binding?.session.getSnapshot(), [binding]),
  )
  return {
    running: snapshot?.running ?? false,
    openBroken: snapshot?.openState === 'error' ? snapshot.openError ?? null : null,
    promptBroken: snapshot?.promptError ?? null,
  }
}

/**
 * Distance from the scrollport floor within which updates keep pulling the
 * view down to the newest line; past it the reading position is respected.
 */
const BOTTOM_SNAP_PX = 80

/**
 * Pin a transcript scroll container to its bottom edge. Every update re-glues
 * the view while the user rests within `BOTTOM_SNAP_PX` of the floor; reading
 * back through history releases the pin, scrolling back near the floor
 * re-engages it, and a fresh mount starts pinned — a page refresh or session
 * open always lands on the newest line.
 *
 * The pin state samples every scroll event (including our own glue writes); a
 * dependency-free effect re-glues on every commit, so any growth source — a
 * new line, a streaming delta, the typing pulse, an error row — sticks while
 * pinned, and an unpinned render costs one boolean check.
 * @param ref - ref on the scroll container (the `.transcript` element).
 */
export function useBottomPinnedScroll(ref: RefObject<HTMLDivElement | null>): void {
  const pinnedRef = useRef(true)
  useEffect(() => {
    const el = ref.current
    if (el === null) return
    const onScroll = (): void => {
      pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SNAP_PX
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll) }
  }, [ref])
  useEffect(() => {
    if (!pinnedRef.current) return
    const el = ref.current
    if (el !== null) el.scrollTop = el.scrollHeight
  })
}

/** The transcript's error row: turn failure, open failure, or prompt-admission failure. */
export function TranscriptErrorRow(props: {
  turnError: TurnError | null
  openBroken: { message: string } | null
  promptBroken: { error: { message: string } } | null
  onNeedKey: () => void
  t: TranslateNS<typeof NS>
}): ReactNode {
  const { turnError, openBroken, promptBroken, t } = props
  if (turnError === null && openBroken === null && promptBroken === null) return null
  return (
    <div className={css.errRow}>
      {turnError !== null && (
        <>
          <span>{turnError.missingKey ? t('chat.errorKey') : `${t('chat.error')}：${turnError.message}`}</span>
          {turnError.missingKey && (
            <button type="button" className={css.btn} onClick={props.onNeedKey}>{t('chat.errorConfigure')}</button>
          )}
        </>
      )}
      {turnError === null && openBroken !== null && <span>{`${t('chat.error')}：${openBroken.message}`}</span>}
      {turnError === null && openBroken === null && promptBroken !== null && (
        <span>{`${t('chat.error')}：${promptBroken.error.message}`}</span>
      )}
    </div>
  )
}

/** The transcript's live rows: the typing dots and the empty-state loader. */
export function TranscriptPulse(props: {
  running: boolean
  pending: boolean
  thinking: boolean
  /** Narrative deltas are streaming right now (the body row carries them). */
  texting?: boolean | undefined
  /** Show the empty-state loader (its own conditions stay with the caller). */
  empty: boolean
  emptyText: string
}): ReactNode {
  return (
    <>
      {/* 思考/正文流式期间不显示打字点（原型：思考行自带流式态，回复等待期才出现打字点） */}
      {(props.running || props.pending) && !props.thinking && props.texting !== true && <div className={css.typing}><i /><i /><i /></div>}
      {props.empty && <div className={css.loading}>{props.emptyText}</div>}
    </>
  )
}

/** Visible text blocks of one message fact (reasoning blocks never render as prose). */
export function textBlocksOf(value: unknown): string[] {
  const blocks = Array.isArray(value)
    ? value
    : typeof value === 'object' && value !== null && Array.isArray((value as { content?: unknown }).content)
      ? (value as { content: unknown[] }).content
      : []
  return blocks
    .map((block) => {
      const record = block as { type?: unknown; text?: unknown }
      return record.type === 'text' && typeof record.text === 'string' ? record.text : ''
    })
    .filter(text => text !== '')
}

/** Cheap bounded text for a result echo inside a row body. */
export function capResultText(text: string): string {
  return text.length > 2_000 ? `${text.slice(0, 2_000)}…` : text
}

/**
 * Main transcript tool-row body: the raw arguments and, when the paired durable
 * result has landed, the result text beneath them.
 */
function toolRowBody(args: string | undefined, result: string | undefined): string | undefined {
  if (result === undefined || result === '') return args
  const capped = capResultText(result)
  return args === undefined || args === '' ? capped : `${args}\n\n↳ ${capped}`
}

/**
 * One message body: rich mode renders markdown + card HTML through the
 * sanitized pipeline; plain mode is the raw escaped text. Both expose the
 * `.tavern-body` style-scope hook card `<style>` blocks select with.
 */
function RichBody({ text, rich }: { text: string; rich?: boolean }): ReactNode {
  if (rich !== true) return <div className="tavern-body">{text}</div>
  const escaped = text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  const html = renderRichBody(text)
  return <div className="tavern-body" dangerouslySetInnerHTML={{ __html: html === '' ? escaped : html }} />
}

/** Render the transcript's line facts (user bubble / narrative / flow rows), nothing else. */
/** One tail run the maintenance row can expand (durable-derived). */
export interface TailRunDetail {
  readonly status: 'completed' | 'stopped' | 'error' | 'archived' | 'unavailable'
  readonly actions: readonly { readonly tool: string; readonly detail: string; readonly args?: string; readonly result?: string }[]
  readonly reply: string
}

/** The cached detail when the transcript fetch itself failed (stale host). */
export const TAIL_UNAVAILABLE: TailRunDetail = { status: 'unavailable', actions: [], reply: '' }

/**
 * The step-row digest (prototype `actionDetail` rule, client mirror): the
 * runtime path, the content size, or the first argument keys.
 */
function stepDigestOf(argsJson: string): string {
  try {
    const args = JSON.parse(argsJson) as Record<string, unknown>
    const path = args['path']
    if (typeof path === 'string') return path
    const content = args['content']
    if (typeof content === 'string') return `${content.length} chars`
    return Object.keys(args).slice(0, 3).join(', ')
  } catch {
    return argsJson.slice(0, 40)
  }
}

/**
 * One tail-run tool call inside the expanded maintenance row: the same quiet
 * expandable shape as a main-agent tool row — collapsed shows the compact
 * digest, expanded shows the raw arguments and (once settled) the paired
 * tool result beneath them.
 */
function TailStepRow(props: { tool: string; digest: string; args: string | undefined; result: string | undefined }): ReactNode {
  const [open, setOpen] = useState(false)
  const expandable = (props.args !== undefined && props.args !== '') || (props.result !== undefined && props.result !== '')
  return (
    <div className={`${css.flowRow} ${open ? css.open : ''} ${expandable ? css.expandable : ''} ${css.tailStep}`}>
      <div
        className={css.rowline}
        onClick={() => { if (expandable) setOpen(value => !value) }}
      >
        {expandable && <span className={css.chev}>▶</span>}
        <span className={css.lbMono}>{props.tool}</span>
        {props.digest !== '' && <span className={css.sep} />}
        <span className={css.sum}><span className={css.st}>{props.digest}</span></span>
      </div>
      {expandable && open && (
        <>
          {props.args !== undefined && props.args !== '' && <div className={css.flowBodyMono}>{props.args}</div>}
          {props.result !== undefined && props.result !== '' && <div className={css.flowBodyMono}>{props.result}</div>}
        </>
      )}
    </div>
  )
}

/**
 * The maintenance row — think-row chrome (DisclosureRow, running sweep) around
 * the child's own facts. A live run renders the STREAMED steps folded from the
 * transposed child stream (the summary rides the newest call); a settled run
 * renders the durable fetch, whose rows carry the paired tool results. The
 * parent stream never replays transients, so the durable fetch stays the
 * settle-time truth and the recoverable body after a reload.
 * @param props - the row's child id, the detail cache face, the loader, the
 *   live fold, and whether the host currently holds the tail gate.
 */
function TailFlowRow(props: {
  childId: string
  t: TranslateNS<typeof NS>
  detail: TailRunDetail | undefined
  load(): void
  steps: readonly TailStep[] | undefined
  reply: string | undefined
  running: boolean
}): ReactNode {
  // Body not fetched yet: one fetch per missing row's detail cache.
  useEffect(() => {
    if (props.detail === undefined) props.load()
  })
  const [open, setOpen] = useState(false)
  const detail = props.detail
  // 2026-09-20 用户裁定：工具结果必须及时渲染。运行中把两路来源按序合并——
  // durable 子日志的已落账动作（带结果，2s 增量刷新）是前缀真相；透流步骤补出
  // 尚未落账的「生成中」调用（仅参数）。吞配 = (tool,args) 逐条对齐；日志超前于
  // 流（多 attempt 重放缺口）时以落账整表为准，流式缺失不影响结果可见性。
  const settled: readonly { tool: string; digest: string; args: string | undefined; result: string | undefined }[] = (detail?.actions ?? []).map(action => ({
    tool: action.tool,
    digest: action.detail,
    args: action.args,
    result: action.result,
  }))
  let rows: readonly { tool: string; digest: string; args: string | undefined; result: string | undefined }[]
  let liveReply: string | undefined
  if (props.running !== true) {
    rows = settled
  } else {
    const live = props.steps ?? []
    let j = 0
    const merged: { tool: string; digest: string; args: string | undefined; result: string | undefined }[] = []
    for (const step of live) {
      const s = j < settled.length ? settled[j] : undefined
      if (s !== undefined && s.tool === step.tool && (s.args ?? '') === step.args) { merged.push(s); j += 1 }
      else merged.push({ tool: step.tool, digest: stepDigestOf(step.args), args: step.args, result: undefined })
    }
    if (j < settled.length) rows = settled  // 流只重放当前 attempt：日志有流没有的 → 落账整表
    else rows = merged
    liveReply = props.reply !== undefined && props.reply !== '' ? props.reply : undefined
  }
  const lastStep = rows.length > 0 ? rows[rows.length - 1] : undefined
  const reply = props.running && liveReply !== undefined ? liveReply : detail?.reply ?? ''
  const summary = props.running
    ? (lastStep !== undefined ? `${lastStep.tool} ${lastStep.digest}` : props.t('chat.tailRunning'))
    : detail === undefined
      ? ''
      : detail.status === 'stopped'
        ? props.t('chat.tailStatusStopped')
        : detail.status === 'error'
          ? props.t('chat.tailStatusError')
          : rows.length > 0
            ? props.t('chat.tailActions').replace('{n}', String(rows.length))
            : ''
  const archived = detail !== undefined && detail.status === 'archived' && !props.running
  const expandable = rows.length > 0 || reply !== '' || archived
    || (detail !== undefined && (detail.status === 'stopped' || detail.status === 'error' || detail.status === 'unavailable'))
  return (
    <div
      className={`${css.flowRow} tavern-thinking`}
      data-state={props.running ? 'running' : 'ok'}
    >
      <DisclosureRow
        className={css.thinkRow}
        rowClassName={css.thinkLine}
        leadingClassName={css.thinkLead}
        titleClassName={css.thinkTitle}
        icon={<IconThinkOutline14 size={14} />}
        title={props.t('chat.tailRow')}
        open={open}
        expandable={expandable}
        expandOnRowClick
        onToggle={(): void => { setOpen(value => !value) }}
        collapsedContent={expandable ? (
          <>
            <span className={css.sep} aria-hidden />
            <span className={`${css.sum} ${props.running ? css.follow : ''}`}><span className={css.st}>{summary}</span></span>
          </>
        ) : undefined}
      >
        <div className={css.thinkBody}>
          {archived && <div className={css.tailNote}>{props.t('chat.tailStatusArchived')}</div>}
          {rows.map((row, index) => (
            <TailStepRow key={`${index}-${row.tool}`} tool={row.tool} digest={row.digest} args={row.args} result={row.result} />
          ))}
          {/* 运行中 → 主对话同款打字点；落定且无内容 → 行体留空（绝不放文案
              占位——「本回合无变化」式句子读起来像运行中的歧义，用户裁定 2026-09-20）。 */}
          {props.running && <div className={css.typing}><i /><i /><i /></div>}
          {reply !== '' && <div className={css.tailReply}>{reply}</div>}
        </div>
      </DisclosureRow>
    </div>
  )
}

/**
 * Per-message action row: copy with the stock check-swap feedback, plus the
 * retry control on the transcript's last reply. The row always occupies its
 * layout space (opacity-gated reveal — never a display toggle), so appearing
 * or disappearing controls never shift the transcript.
 */
function MessageActionsRow(props: {
  /** The plain text the copy action writes. */
  text: string
  /** Whether the retry control renders on this row. */
  retry: boolean
  onRetry: (() => void) | undefined
  t: TranslateNS<typeof NS>
}): ReactNode {
  // Same success chrome as the stock MessageIconActions: a short check swap
  // after the write, gated so re-clicks neither re-copy nor stack timers.
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])
  const onCopy = (): void => {
    if (copied) return
    void writeClipboard(props.text).then((ok) => {
      if (!ok) return
      setCopied(true)
      timer.current = setTimeout(() => { timer.current = null; setCopied(false) }, 1000)
    })
  }
  return (
    <div className={css.msgActions}>
      <button
        type="button" className={css.msgAction}
        aria-label={copied ? props.t('chat.copied') : props.t('chat.copy')}
        title={copied ? props.t('chat.copied') : props.t('chat.copy')}
        onClick={onCopy}
      >
        {copied ? <IconCheckOutline16 size={13} /> : <IconCopyOutline16 size={13} />}
      </button>
      {props.retry && props.onRetry !== undefined && (
        <button
          type="button" className={css.msgAction}
          aria-label={props.t('chat.retry')} title={props.t('chat.retry')}
          onClick={props.onRetry}
        >
          <IconRefreshOutline16 size={13} />
        </button>
      )}
    </div>
  )
}

export function ChatLines(props: {
  lines: readonly ChatLine[]
  t: TranslateNS<typeof NS>
  tailDetail: (childId: string) => TailRunDetail | undefined
  loadTailDetails: () => void
  /** The host currently holds the tail gate — the newest tail line renders live (streamed steps). */
  tailRunning?: boolean | undefined
  /** Message bodies render markdown + card HTML when the layout enables it. */
  rich?: boolean
  /** Line index (within `lines`) carrying the retry control; omitted when retry is unavailable. */
  retryIndex?: number | undefined
  /** Retry click; consulted only when `retryIndex` is set. */
  onRetry?: (() => void) | undefined
}): ReactNode {
  // One tail gate serializes runs, so the NEWEST tail line is the live one.
  let lastTailIndex = -1
  if (props.tailRunning === true) {
    for (let index = 0; index < props.lines.length; index += 1) {
      if (props.lines[index]?.kind === 'tail') lastTailIndex = index
    }
  }
  return (
    <>
      {props.lines.map((line, index) => {
        const stamp = stampOf(line.time)
        if (line.kind === 'user') {
          /* jscpd:ignore-start -- the user and narrative foot rows pair by
             contract (one row: timestamp + actions); the wrappers diverge. */
          return (
            <div key={index} className={`${css.msgUser} tavern-message tavern-message-user`}>
              <div className={`${css.bubbleUser} tavern-bubble`}>
                <RichBody text={line.text} rich={props.rich === true} />
              </div>
              <div className={css.msgFoot}>
                {stamp !== undefined && <span className={`${css.stamp} tavern-timestamp`}>{stamp}</span>}
                <MessageActionsRow
                  text={line.text} retry={index === props.retryIndex} onRetry={props.onRetry} t={props.t}
                />
              </div>
            </div>
          )
          /* jscpd:ignore-end */
        }
        if (line.kind === 'narrative') {
          return (
            <div key={index} className={css.msgGroup}>
              <div className={`${css.narrative} tavern-message tavern-message-assistant`}>
                <RichBody text={line.text} rich={props.rich === true} />
              </div>
              <div className={css.msgFoot}>
                <MessageActionsRow
                  text={line.text} retry={index === props.retryIndex} onRetry={props.onRetry} t={props.t}
                />
                {stamp !== undefined && <span className={`${css.stamp} tavern-timestamp`}>{stamp}</span>}
              </div>
            </div>
          )
        }
        if (line.kind === 'think') {
          return <ThinkRow key={index} t={props.t} text={line.text} live={line.live} />
        }
        if (line.kind === 'tail') {
          // The body comes from the child's own durable log — the
          // same aborted/finished facts the transcript carries — and,
          // while the gate runs, from the transposed live stream.
          return (
            <TailFlowRow
              key={index} childId={line.text} t={props.t}
              detail={props.tailDetail(line.text)} load={props.loadTailDetails}
              steps={line.steps} reply={line.reply}
              running={index === lastTailIndex}
            />
          )
        }
        if (line.kind === 'stopped') {
          return <FlowRow key={index} label={props.t('chat.stoppedRow')} summary={props.t('chat.stoppedSummary')} />
        }
        if (line.kind === 'error') {
          return (
            <div key={index} className={css.errMsg}>
              {line.text}
              {stamp !== undefined && <span className={css.stamp}>{stamp}</span>}
            </div>
          )
        }
        return <FlowRow key={index} label={line.text} mono summary="" body={toolRowBody(line.args, line.result)} monoBody hook='tavern-tool' />
      })}
    </>
  )
}

/**
 * The shared composer: text area over a control row (model seat → context
 * ring → send/stop) plus the usage line. Draft is controlled — the caller
 * owns admission (`onSend`), clearing on success, and the stop semantics;
 * this component owns the input mechanics (IME guard, popovers) and the
 * per-session model directory + projections rendering.
 */
export function ChatComposer(props: {
  directory: ModelDirectory | undefined
  usage: TokenUsageProjection | undefined
  pressure: ContextPressureProjection | undefined
  breakdown: ContextBreakdownProjection | undefined
  sessionStats: SessionStatsProjection | undefined
  draft: string
  onDraft(value: string): void
  onSend(): void
  /** While true the send seat renders as the stop button (send is not offered mid-turn). */
  stoppable: boolean
  onStop(): void
  placeholder: string
  t: TranslateNS<typeof NS>
}): ReactNode {
  const [modelOpen, setModelOpen] = useState(false)
  const [modelPane, setModelPane] = useState<'root' | 'model' | 'effort'>('root')
  const [ctxOpen, setCtxOpen] = useState(false)
  /** Composition watch for the composer textarea (Safari's late closing Enter). */
  const composingUntilAt = useRef(0)
  /** The meter root: inside clicks keep the detail panel open (stock ContextMeter's dismissal set). */
  const ctxRootRef = useRef<HTMLSpanElement | null>(null)
  const modelState = useSyncExternalStore(
    (listener: () => void) => props.directory?.store.subscribe(listener) ?? (() => undefined),
    () => props.directory?.store.getSnapshot(),
  )

  const current = modelState?.current
  const group = current === null || current === undefined ? undefined : modelState?.groups.find(g => g.id === current.provider)
  const model = group?.models.find(m => m.id === current?.model)
  const effort = model?.reasoning?.efforts.find(e => e.id === current?.reasoningEffort)

  const selectModel = (provider: string, id: string, effortId: string | undefined): void => {
    const dir = props.directory
    if (dir === undefined) return
    void dir.select({
      provider,
      model: id,
      ...(effortId === undefined ? {} : { reasoningEffort: effortId }),
    }).then(() => { setModelOpen(false) }, (error: unknown) => { console.warn('[tavern] rpc failed', error) })
  }

  // 上下文占用：本地镜像 stock ContextMeter 的规则（contextOccupancyOf）——未知的占用
  // 不渲染环形（stock 同款 hide-until-available）；分段占比条有 breakdown 配比时按比
  // 画段（配比之和 ≠ provider 占用，原型同款只画比例），缺席/全零退化为一条中性整段，
  // 明细行仅 breakdown 在场时渲染（stock 同款）。
  const occupancy = contextOccupancyOf(props.pressure)
  const breakdownTotal = props.breakdown === undefined
    ? 0
    : props.breakdown.systemTokens + props.breakdown.toolsTokens + props.breakdown.messageTokens
  const ctxSegments = occupancy === undefined
    ? [] // 未知的占用不渲染环形，段自然为空
    : props.breakdown === undefined || breakdownTotal === 0
      ? [{ key: 'total', color: css.ctxSegAll, width: occupancy.percent }]
      : ([
        { key: 'system', color: css.segS, width: occupancy.percent * props.breakdown.systemTokens / breakdownTotal },
        { key: 'tools', color: css.segT, width: occupancy.percent * props.breakdown.toolsTokens / breakdownTotal },
        { key: 'messages', color: css.segM, width: occupancy.percent * props.breakdown.messageTokens / breakdownTotal },
      ] as const).filter(segment => segment.width > 0)
  useEffect(() => { if (occupancy === undefined && ctxOpen) setCtxOpen(false) }, [occupancy, ctxOpen])
  // stock ContextMeter 的收起集合：面板外 pointerdown 与 Escape 各自关闭；触发钮与
  // 面板本体在 root 内，交给自身 onClick 不受影响。
  useEffect(() => {
    if (!ctxOpen) return
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Node && ctxRootRef.current?.contains(event.target) === true) return
      setCtxOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setCtxOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [ctxOpen])

  // 底部用量行：tokenUsage 三桶计费输入 + 输出；tok/s 用 sessionStats 的解码时长口径。
  const usage = props.usage
  const billed = usage === undefined ? 0 : usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
  const output = usage?.outputTokens ?? 0
  const hitPercent = billed > 0 ? Math.round((usage?.cacheReadTokens ?? 0) / billed * 100) : 0
  const tps = props.sessionStats !== undefined && props.sessionStats.decodeMs > 0
    ? Math.round(props.sessionStats.decodeTokens / (props.sessionStats.decodeMs / 1000))
    : 0
  const statsText = [
    props.t('stats.input', { count: fmtK(billed) }),
    props.t('stats.output', { count: fmtK(output) }),
    props.t('stats.cacheHit', { percent: hitPercent }),
    props.t('stats.speed', { tps }),
  ].join(' ｜ ')

  return (
    <div className={`${css.composerWrap} tavern-composer`}>
      <div className={`${css.composer} tavern-composer-inner`}>
        <textarea
          className='tavern-textarea'
          value={props.draft}
          placeholder={props.placeholder}
          onChange={(event) => { props.onDraft(event.target.value) }}
          onKeyDown={(event) => {
            // IME guard (stock keymap semantics): a composition-closing Enter
            // confirms the candidate, it never sends. isComposing covers most
            // engines; 229 is the legacy signal; the 10ms window covers
            // Safari's compositionend-then-Enter ordering.
            // keyCode 229 is the legacy IME signal engines emit without
            // isComposing; the stock keymap reads it for exactly this guard.
            // oxlint-disable-next-line typescript/no-deprecated -- deprecated-read is the point of this guard.
            const composing = event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || Date.now() < composingUntilAt.current
            if (event.key === 'Enter' && !event.shiftKey && !composing) { event.preventDefault(); props.onSend() }
          }}
          onCompositionStart={() => { composingUntilAt.current = Number.MAX_SAFE_INTEGER }}
          onCompositionEnd={() => { composingUntilAt.current = Date.now() + 10 }}
        />
        {/* 控制行：模型席位 + 上下文占用环 + 发送/停止（DSH InputBar 的 .row/.trailing 结构） */}
        <div className={`${css.composerRow} tavern-composer-row`}>
          {props.directory !== undefined && modelState !== undefined && (
            <span className={`${css.modelWrap} tavern-model-seat`}>
              <button
                type="button"
                className={`${css.modelBtn} ${modelOpen ? css.modelBtnOpen : ''}`}
                aria-label={props.t('model.pick')} aria-haspopup="menu" aria-expanded={modelOpen}
                title={props.t('model.pick')}
                onClick={(event) => {
                  event.stopPropagation()
                  setModelPane('root')
                  setModelOpen(open => !open)
                }}
              >
                <span className={css.modelNm}>{model?.name ?? props.t('model.none')}</span>
                {effort !== undefined && <span className={css.modelEf}> · {effort.name}</span>}
                <span className={css.modelCv}>▾</span>
              </button>
              {modelOpen && (
                <div className={css.modelPop} role="menu" aria-label={props.t('model.pick')} onClick={(event) => { event.stopPropagation() }}>
                  {modelPane === 'root' && (
                    <>
                      <button type="button" className={css.mpCell} onClick={() => { setModelPane('model') }}>
                        <span className={css.mpLab}>{props.t('model.menuModel')}</span>
                        <span className={css.mpVal}>{model?.name ?? props.t('model.none')}</span>
                        <span className={css.mpArr}>▸</span>
                      </button>
                      {model?.reasoning !== undefined && (
                        <button type="button" className={css.mpCell} onClick={() => { setModelPane('effort') }}>
                          <span className={css.mpLab}>{props.t('model.effort')}</span>
                          <span className={css.mpVal}>
                            {effort?.name ?? model.reasoning.efforts.find(e => e.id === model.reasoning?.defaultEffort)?.name ?? ''}
                          </span>
                          <span className={css.mpArr}>▸</span>
                        </button>
                      )}
                    </>
                  )}
                  {modelPane === 'model' && (
                    <>
                      <button type="button" className={css.mpBack} onClick={() => { setModelPane('root') }}>
                        <span>‹</span><span>{props.t('model.menuModel')}</span>
                      </button>
                      {modelState.groups.map(g => (
                        <Fragment key={g.id}>
                          <div className={css.mpGroup}>{g.name}</div>
                          {g.models.map(m => (
                            <button
                              key={m.id} type="button" title={m.description}
                              className={`${css.mpOption} ${current?.provider === g.id && current.model === m.id ? css.mpOptionSelected : ''}`}
                              onClick={() => { selectModel(g.id, m.id, m.reasoning?.defaultEffort ?? m.reasoning?.efforts[0]?.id) }}
                            >
                              <span className={css.mpCopy}>{m.name}</span>
                              <span className={css.mpChk}>✓</span>
                            </button>
                          ))}
                        </Fragment>
                      ))}
                    </>
                  )}
                  {modelPane === 'effort' && model?.reasoning !== undefined && (
                    <>
                      <button type="button" className={css.mpBack} onClick={() => { setModelPane('root') }}>
                        <span>‹</span><span>{props.t('model.effort')}</span>
                      </button>
                      {model.reasoning.efforts.map(e => (
                        <button
                          key={e.id} type="button" title={e.description}
                          className={`${css.mpOption} ${current?.reasoningEffort === e.id ? css.mpOptionSelected : ''}`}
                          onClick={() => {
                            if (current !== null && current !== undefined) selectModel(current.provider, current.model, e.id)
                          }}
                        >
                          <span className={css.mpCopy}>{e.name}</span>
                          <span className={css.mpChk}>✓</span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </span>
          )}
          {occupancy !== undefined && (
          <span ref={ctxRootRef} className={`${css.ctxWrap} tavern-context-meter`}>
            <button
              type="button"
              className={`${css.ctxBtn} ${ctxOpen ? css.ctxBtnOpen : ''}`}
              aria-label={props.t('ctx.aria', { percent: occupancy.percent })} aria-haspopup="dialog" aria-expanded={ctxOpen}
              title={props.t('ctx.aria', { percent: occupancy.percent })}
              onClick={(event) => { event.stopPropagation(); setCtxOpen(open => !open) }}
            >
              <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden>
                <circle className={css.ctxTk} cx="7" cy="7" r="5.5" />
                <circle
                  className={css.ctxFl} cx="7" cy="7" r="5.5"
                  strokeDasharray={`${(RING_CIRCUMFERENCE * occupancy.percent / 100).toFixed(3)} ${RING_CIRCUMFERENCE.toFixed(3)}`}
                  transform="rotate(-90 7 7)"
                />
              </svg>
            </button>
            {ctxOpen && (
              <div className={css.ctxPop} role="dialog" aria-label={props.t('ctx.used')} onClick={(event) => { event.stopPropagation() }}>
                <div className={css.ctxHead}>
                  <span>{props.t('ctx.used')}</span>
                  <span className={css.ctxPct}>{occupancy.percent}%</span>
                  <span className={css.ctxFigs}>{`~${fmtK(occupancy.usedTokens)} / ${fmtK(occupancy.contextWindow)}`}</span>
                </div>
                <div className={css.ctxBar}>
                  {ctxSegments.map(segment => (
                    <span key={segment.key} className={`${css.ctxSeg} ${segment.color}`} style={{ width: `${segment.width}%` }} />
                  ))}
                </div>
                {props.breakdown !== undefined && (
                <dl className={css.ctxRows}>
                  <div className={css.ctxRow}>
                    <dt><i className={`${css.ctxSw} ${css.segS}`} />{props.t('ctx.system')}</dt>
                    <dd>~{fmtK(props.breakdown.systemTokens)}</dd>
                  </div>
                  <div className={css.ctxRow}>
                    <dt><i className={`${css.ctxSw} ${css.segT}`} />{props.t('ctx.tools')}</dt>
                    <dd>~{fmtK(props.breakdown.toolsTokens)}</dd>
                  </div>
                  <div className={css.ctxRow}>
                    <dt><i className={`${css.ctxSw} ${css.segM}`} />{props.t('ctx.messages')}</dt>
                    <dd>~{fmtK(props.breakdown.messageTokens)}</dd>
                  </div>
                </dl>
                )}
              </div>
            )}
          </span>
          )}
          {props.stoppable ? (
            <button
              type="button" className={`${css.send} ${css.sendStop} tavern-send-btn`}
              onClick={() => { props.onStop() }} title={props.t('chat.stop')} aria-label={props.t('chat.stop')}
            >
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden><rect x="2" y="2" width="8" height="8" rx="1.5" /></svg>
            </button>
          ) : (
            <button type="button" className={`${css.send} tavern-send-btn`} onClick={() => { props.onSend() }} disabled={props.draft.trim() === ''}>{props.t('composer.send')}</button>
          )}
        </div>
      </div>
      {/* 底部用量状态行：一行 ｜ 分隔纯文本（不可点），占位常显、无数据写 0 */}
      <div className={`${css.statsLine} tavern-usage-line`}>{statsText}</div>
    </div>
  )
}
