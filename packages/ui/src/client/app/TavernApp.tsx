/* oxlint-disable @stylistic/max-len -- 卡片长文案与长模板串按行豁免，上限约束不适用于此文件的长中文字符串 */
/**
 * The tavern application page: the full-viewport surface the prototype draws
 * (docs/tavern-prototype/prototype/ui-mockup.html; authoritative UI spec in
 * design_zh.md「Web 界面」). It shadows the built-in `root` slot (lower
 * priority), so on the tavern profile this page replaces the stock web
 * chrome entirely.
 *
 * Behavior follows the prototype exactly: the card library and its import
 * flows are IN-PLACE main-area views (never modals); 保存 opens the save
 * dialog; 加载 opens the settings modal straight to the saves tab; 设置
 * opens the settings modal; the tail-agent gate disables sending while it
 * runs; the opening page posts `tavern-insert` options into the composer.
 *
 * All services resolve INSIDE the component body: slot callbacks run during
 * the loader's dynamic phase, when sessions/remote may not be activated yet —
 * reading them at apply time silently loses the whole page. After boot the
 * audit guarantees every injected service exists, so render is the only
 * trustworthy resolution point.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type MutableRefObject } from 'react'
import { createPortal } from 'react-dom'
import { randomUUID } from '@deepseek-ai/dsh-util-crypto'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { ModelDirectory, ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client'
// Type-only: merges the tokenUsage / contextPressure / contextBreakdown / sessionStats
// keys into SessionProjectionMap for the projection reader below.
import type { ContextBreakdownProjection, ContextPressureProjection, TokenUsageProjection } from '@deepseek-ai/dsh-token-meter/client'
import type { SessionStatsProjection } from '@deepseek-ai/dsh-session-stats/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { loadCardUi, type CardUiHandle } from '../card-ui.ts'
import { applyTheme, clearTheme, readThemeChoice, THEME_CHOICES, writeThemeChoice, type ThemeChoice } from '../themes.ts'
import { clearPendingSession, readPendingSession, setPendingSession } from '../pending-session.ts'
import { subscribeFileEvents } from '../file-events.ts'
import css from './App.module.css'
import {
  ChatComposer, ChatLines, MISSING_CREDENTIAL, TranscriptErrorRow, TranscriptPulse, capResultText, reasoningOf, textBlocksOf,
  TAIL_UNAVAILABLE, type TailRunDetail, type TailStep,
  useProjectionValue, useSessionSurface,
  type ChatLine, type ConversationFace, type TurnError,
} from '../chat-view.tsx'
import { decideLanding, type LandingCause, type LandingPlan } from '../landing.ts'
import { captureAnchor, createReaderAnchorStore, findAnchorRow } from '../reader-anchor.ts'
import { useTranscriptScroller } from '../transcript-scroll.ts'
import { TavernView, type TavernViewProps } from '../TavernView.tsx'
import { tavernRpc, type TavernRpc, type TavernSaveWire, type TavernWorkspaceWire } from '../rpc.ts'
import { stripInstructions } from '../wrap-markers.ts'
import { useDialogs } from '../dialog.tsx'
import { NS } from '../locales.ts'

export type { ConversationFace } from '../chat-view.tsx'

/** The header theme select's option faces (locale keys; the select itself is always mounted). */
const THEME_LABEL: Record<ThemeChoice, 'theme.card' | 'theme.parchment' | 'theme.dswLight' | 'theme.dswDark'> = {
  card: 'theme.card',
  parchment: 'theme.parchment',
  'dsw-light': 'theme.dswLight',
  'dsw-dark': 'theme.dswDark',
}

/** Narrow the credentials setter the key dialog stores through. */
export interface CredentialsFace {
  set(ref: string, value: string): Promise<unknown>
  describe(refs: readonly string[]): Promise<unknown>
}

/**
 * The browser IANA zone attached to every prompt for RPC provenance — the local
 * mirror of the host client's resolver (a runtime import would break bundle purity).
 * @returns the browser-provided canonical zone.
 */
function clientTimeZone(): string {
  const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone
  if (typeof timeZone !== 'string' || timeZone === '') throw new Error('browser time zone is unavailable')
  return timeZone
}

/** Render-time service resolution: every member is guaranteed post-boot. */
interface AppFaces {
  rpc: TavernRpc
  sessions: ISessions
  credentials: CredentialsFace | undefined
  models: ModelDirectoryResolver | undefined
  conversation: ConversationFace
  onCredentialsChanged: (listener: () => void) => () => void
  t: TranslateNS<typeof NS>
}

/**
 * AttemptId prefix the engine's stream transposer stamps onto tail-child
 * frames (TANDEM with the engine's TAIL_STREAM_PREFIX): the parent stream's
 * transient chunks route into the tail row by this marker, the childId rides
 * the attemptId body.
 */
const TAIL_STREAM_PREFIX = 'tavern-tail:'

/** The stream-chunk slice the fold reads (dsh-llm StreamChunk, structurally). */
interface StreamChunkLike {
  type?: string
  index?: number
  text?: string
  blockType?: string
  name?: string
  argumentsDelta?: string
  arguments?: string
  block?: { name?: string; arguments?: string }
}

/** Live fold of one tail child's transposed stream, rebuilt per transcript read. */
interface TailLiveFold {
  /** Open tool-call buckets: chunk index → name/args accumulated so far. */
  readonly open: Map<number, { name: string; args: string }>
  readonly steps: TailStep[]
  reply: string
}

/**
 * Fold one transposed stream chunk into the tail row's live body: tool-call
 * blocks build their arguments per delta and finalize at block-end (the end
 * block is canonical — name/arguments win over the deltas); text deltas are
 * the closing reply.
 */
function foldTailStreamChunk(fold: TailLiveFold, chunk: StreamChunkLike): void {
  switch (chunk.type) {
    case 'block-start':
      if (chunk.blockType === 'tool-call') fold.open.set(chunk.index ?? -1, { name: '', args: '' })
      return
    case 'tool-call-delta': {
      const index = chunk.index ?? -1
      const slot = fold.open.get(index) ?? { name: '', args: '' }
      fold.open.set(index, slot)
      if (typeof chunk.name === 'string' && chunk.name !== '') slot.name = chunk.name
      slot.args += chunk.argumentsDelta ?? ''
      return
    }
    case 'block-end': {
      const index = chunk.index ?? -1
      const slot = fold.open.get(index)
      if (slot === undefined) return
      fold.open.delete(index)
      const name = typeof chunk.block?.name === 'string' && chunk.block.name !== '' ? chunk.block.name : slot.name
      const args = typeof chunk.block?.arguments === 'string' ? chunk.block.arguments : slot.args
      if (name !== '') fold.steps.push({ tool: name, args })
      return
    }
    case 'text-delta':
      fold.reply += chunk.text ?? ''
      return
    default:
      return
  }
}

function faces(ctx: ClientContext): AppFaces | undefined {
  // Every key below is declared in `inject`, so property access is
  // proxy-safe; apply runs only after all of them exist, so faces cannot
  // silently lose the page.
  const rpc = tavernRpc(ctx)
  const sessions = ctx.sessions as ISessions | undefined
  // The audited context types these as always present, but the browser half
  // only truly has them when their mounts landed; the partial views keep the
  // runtime absence honest without tripping the static guards.
  const credentials = (ctx.remote as { credentials?: CredentialsFace } | undefined)?.credentials
  const models = (ctx as { modelDirectories?: ModelDirectoryResolver | undefined }).modelDirectories
  // The Conversation service is the web base's always-on shell owner; a
  // missing mount means the base never booted, so the page refuses to run
  // rather than degrade the saved-view fallback semantics.
  const conversation = ctx.get('uiConversation') as ConversationFace | undefined
  if (rpc === undefined || sessions === undefined || conversation === undefined) return undefined
  return {
    rpc,
    sessions,
    credentials,
    models,
    conversation,
    onCredentialsChanged: listener => ctx.remote.$on('credentials/reference-updated', listener),
    t: ctx.locale.bind(NS),
  }
}


const UNAVAILABLE = 'tavern: engine unavailable — check the tavern bundle rows'

/** The application root registered into the shadowed `root` slot.
 *  @param props - the client context; faces resolve at render time.
 *  @returns the app page. */
export function TavernRoot(props: { ctx: ClientContext }): ReactNode {
  const app = faces(props.ctx)
  useEffect(() => {
    console.info('[tavern] 应用页面已挂载（root shadow）— tavern application page mounted')
  }, [])
  if (app === undefined) {
    console.warn('[tavern]', UNAVAILABLE)
    return <div className={css.loading}>{UNAVAILABLE}</div>
  }
  return <TavernAppBody {...app} />
}

function TavernAppBody(props: AppFaces): ReactNode {
  const { rpc, sessions, credentials, models, conversation, onCredentialsChanged, t } = props
  const list = useSyncExternalStore(
    (listener: () => void) => sessions.list.subscribe(listener),
    () => sessions.list.getSnapshot(),
  )
  const current = list.current
  const [hasCard, setHasCard] = useState<boolean | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [editing, setEditing] = useState<string | null>(null)
  const [tailRunning, setTailRunning] = useState(false)
  // 尾代理是否启用（maintenancePrompt 非空）的宿主缓存：state() 每次顺带刷新。
  // completed 乐观锁只在开启态需要——关闭态回合落定即最普通链路，不发锁。初值
  // true（过长锁无害：引擎对每个 completed 回合担保一条完成信号，必能解锁）。
  const maintenanceOnRef = useRef(true)
  /** A retry point exists (the newest autosave stamp carries a draft) — ↻ may show on the last reply. */
  const [retryable, setRetryable] = useState(false)
  const [cardMeta, setCardMeta] = useState<{ title: string; desc: string; cover: string }>({ title: '', desc: '', cover: '' })
  // 每会话最后一句用户消息（截断展示在侧栏第三行）：localStorage 派生缓存，当前会话由事件流实时更新。
  const [lastLines, setLastLines] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('tavern.lastLines') ?? '{}') as Record<string, string> } catch { return {} }
  })
  // Key presence is a cache, not a modal trigger: the dialog opens on demand
  // (pre-flight before a send, or a failed turn) and from the settings entry.
  const [keyMissing, setKeyMissing] = useState<boolean | null>(null)
  const [keyDialogOpen, setKeyDialogOpen] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  // Settings modal (工作空间 / API Key) and the header save dialog.
  const [settings, setSettings] = useState<{ initialTab: TavernViewProps['initialTab'] } | undefined>(undefined)
  // 主题选择：localStorage 直存（同 lastLines 模式）；sheet effect 按它 + 当前
  // 绑定卡的主题 css 落 #tavern-theme——页头右上角 select 即换肤、不刷新。
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>(readThemeChoice)
  const selectTheme = useCallback((choice: ThemeChoice): void => {
    writeThemeChoice(choice)
    setThemeChoice(choice)
  }, [])
  // 卡主题上报位（TavernChatView 唯一上报口）。sheet 执笔在本体：聊天视图条件挂载，
  // #tavern-theme 须在 library / 设置模态也常开；选内建主题时忽略卡 css（覆盖语义）。
  const [cardThemeCss, setCardThemeCss] = useState<string | null>(null)
  useLayoutEffect(() => { applyTheme(themeChoice, cardThemeCss) }, [themeChoice, cardThemeCss])
  // 卸载离场才摘 sheet——换绑与换主题走上面的重注入，不清。
  useEffect(() => clearTheme, [])
  const [saveOpen, setSaveOpen] = useState(false)
  const [saves, setSaves] = useState<readonly TavernSaveWire[]>([])
  const [saveName, setSaveName] = useState('')
  // The sidebar lists WORKSPACE rows from disk (one row per tavern_workspace
  // directory), not the raw session list — a row can exist before its session
  // started, and its title/desc come from the card's meta.json.
  const [rows, setRows] = useState<readonly TavernWorkspaceWire[]>([])
  const [toast, setToast] = useState<{ text: string; kind: 'success' | 'info' | 'error' } | undefined>(undefined)
  // 自绘确认框席位：原 window.confirm 的三个调用点（删会话 / 覆盖存档 / 清空）。
  const dialogs = useDialogs()
  // 清空后的开场回跳信号（就地重置转写）；in-place 载入同 id 时也借用它重跑会话 effect。
  const [resetSignal, setResetSignal] = useState(0)
  // Composer 文本镜像（手动存档戳用）：ref 而非 state——每键 setState 会拖垮整页渲染。
  const composerDraftRef = useRef<string>('')
  // 一次性换绑交接：目标会话 id + 要恢复进输入框的草稿（载入存档时来自存档戳）。
  const restoreDraftRef = useRef<{ sessionId: string; text: string } | undefined>(undefined)
  // 一次性着陆交接（2026-09-25 着陆合约）：换绑 cause + 载入 fork 切刻——着陆
  // 仲裁的 cause 通道；TavernChatView 按会话进场时消费一次即清空。无交接 =
  // 自然进场（boot / 侧栏点行 / 切回），按 exit-return 口径仲裁。
  const rebindCauseRef = useRef<{ sessionId: string; cause: LandingCause; anchorSeq: number | null } | undefined>(undefined)
  const onComposerDraftChange = useCallback((text: string): void => { composerDraftRef.current = text }, [])
  // 侧栏收起态：localStorage 持久（同 lastLines 的直存模式）。收起止于 width 0，
  // toggle 常驻聊天头部（两种状态都在），收起态另有 ＋ 保住新会话入口；
  // 冻结宽过渡见 App.module.css .sideInner。
  const [sideOpen, setSideOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('tavern.sidebar.open') !== '0' } catch { return true }
  })
  const toggleSide = useCallback((): void => {
    setSideOpen((open) => {
      try { localStorage.setItem('tavern.sidebar.open', open ? '0' : '1') } catch { /* storage unavailable — only the cross-reload memory of the preference is lost */ }
      return !open
    })
  }, [])

  const refreshKey = useCallback((): Promise<boolean> => {
    // Resolves whether the key is missing; `false` on describe failure keeps
    // the composer unblocked (a failed turn surfaces the real cause).
    if (credentials === undefined) return Promise.resolve(false)
    return credentials.describe(['DEEPSEEK_API_KEY']).then((response) => {
      // CredentialInfo carries `configured`, never the secret value itself
      // (the credentials remote never returns one) — read the flag, not a value.
      const described = response as { ok?: boolean; value?: Record<string, { configured?: boolean }> }
      const view = described.ok === true ? described.value?.DEEPSEEK_API_KEY : undefined
      const missing = view?.configured !== true
      setKeyMissing(missing)
      return missing
    }, () => { setKeyMissing(null); return false })
  }, [credentials])
  useEffect(() => { void refreshKey() }, [refreshKey])
  useEffect(() => onCredentialsChanged(() => { void refreshKey() }), [onCredentialsChanged, refreshKey])

  useEffect(() => {
    if (current === undefined) { setHasCard(null); setEditing(null); setSettings(undefined); setSaveOpen(false); return }
    void rpc.state({ sessionId: current }).then((value) => {
      setHasCard(value.hasCard)
      setDrafting(value.drafting)
      setEditing(value.editing)
      setCardMeta({ title: value.title, desc: value.desc, cover: value.cover })
      setRetryable(value.retryable)
    }, () => { setHasCard(null); setEditing(null) })  // 换绑后旧 id 报错：编辑标记不得跨会话渗漏
  }, [current, hasCard, rpc])
  // 选卡页刷新保持（2026-09-20 用户裁定）：宿主 reconcile 每次加载按「最近活跃」
  // 自动开会话，空白会话（无消息、updatedAt 空）抢不过玩过的会话——用
  // pendingSession 把宿主劫持走的会话拉回选卡用的空白会话。等 list ready 再动作；
  // 一次性闩存；open 直调 sessions（不走 openSession，避免恢复即自清）。
  const pendingRestoredRef = useRef(false)
  useEffect(() => {
    if (pendingRestoredRef.current || list.phase !== 'ready') return
    pendingRestoredRef.current = true
    const pending = readPendingSession()
    if (pending === null) return
    if (!list.ids.includes(pending as SessionId)) { clearPendingSession(); return }
    if (list.current === pending) return
    try { sessions.open(pending as SessionId) } catch { clearPendingSession() }
  }, [list, sessions])
  // 尾代理运行态：锁值唯一来源是宿主 state().tailRunning，前端不做推断。刷新时机 =
  // 挂载/切换会话立即一次 + 每个活到的 turn/end 立即一次（TavernChatView onTurnEnd）
  // + 完成信号 command/done 到达时一次（onTurnEnd(false)）。无固定周期轮询。
  const pollTail = useCallback((): void => {
    if (current === undefined) { setTailRunning(false); return }
    void rpc.state({ sessionId: current }).then((value) => {
      maintenanceOnRef.current = value.maintenanceOn
      setTailRunning(value.tailRunning)
      setRetryable(value.retryable)
    }, () => { setTailRunning(false) })
  }, [current, rpc])
  // completed 乐观锁只服务尾代理开启态：闸门随 fork 派生同步置位，但宿主 state() 与
  // 前端事件流是两个异步消费方，直接 pollTail 可能读到置位前的 stale false 而在尾代理
  // 写盘窗口内提前解锁——先置 true，等引擎的 command/done 落定信号解锁（引擎对每个
  // completed 回合恰发一条，fork 路径与维护关闭路径都担保）。
  // 维护关闭（maintenanceOn=false，state() 同源缓存）：无 fork、无写盘窗口，回合落定
  // 即最普通链路——直接 pollTail 落真实值（恒 false），按钮立刻复原，不发锁不闪停。
  const handleTurnEnd = useCallback((lock: boolean): void => {
    if (lock && maintenanceOnRef.current) { setTailRunning(true); return }
    pollTail()
  }, [pollTail])
  useEffect(() => {
    // 尾代理闸门刷新：挂载/切换立即一次 + 主会话 turn/end 活到时乐观锁（onTurnEnd(true)）
    // 或关闭态查询（onTurnEnd(false)）+ 完成信号 command/done 落真实值解锁。无轮询。
    pollTail()
  }, [current, pollTail])
  const rememberLastLine = useCallback((sessionId: string, line: string): void => {
    setLastLines((current) => {
      if (current[sessionId] === line) return current
      const next = { ...current, [sessionId]: line }
      try { localStorage.setItem('tavern.lastLines', JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }, [])
  const forgetLastLine = useCallback((sessionId: string): void => {
    setLastLines((current) => {
      const next = Object.fromEntries(Object.entries(current).filter(([id]) => id !== sessionId))
      if (Object.keys(next).length === Object.keys(current).length) return current
      try { localStorage.setItem('tavern.lastLines', JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }, [])

  const remember = (sessionId: SessionId): void => {
    try {
      // pre-rename fork hosts answer conversationStoreKey(); stock hosts use
      // the same literal the stock shell writes (`dsh.conversation`).
      const storeKey = conversation.conversationStoreKey?.() ?? 'dsh.conversation'
      localStorage.setItem(`${storeKey}.${sessionId}`, JSON.stringify({ view: 'tavern' }))
    } catch { /* storage unavailable — the session opens on the chat fallback */ }
  }
  const [rowCovers, setRowCovers] = useState<Record<string, string>>({})

  const directory = useMemo(() => {
    if (models === undefined || current === undefined) return undefined
    try { return models.directoryFor(current) } catch (error) {
      console.warn('[tavern] model directory unavailable', error)
      return undefined
    }
  }, [models, current])

  const openSession = (sessionId: SessionId): void => {
    clearPendingSession()  // 侧栏显式点行＝弃用选卡页上的空白会话
    try {
      sessions.open(sessionId)
    } catch (error) {
      // An unknown id in the client list must not vanish as an unhandled rejection.
      console.warn('[tavern] session open failed', error)
      setToast({ text: t('app.openFailed'), kind: 'info' })
      window.setTimeout(() => { setToast(undefined) }, 2600)
      refreshRows()
    }
  }
  const refreshRows = useCallback((): void => {
    void rpc.workspaces({ }).then((value) => {
      setRows(value.rows)
      for (const row of value.rows) {
        if (row.cover === '' || row.sessionId === null || rowCovers[row.name] !== undefined) continue
        // Workspace covers live in the WORKSPACE (meta.cover relative to its
        // root), not the card library — readAsset, not readLibraryAsset.
        void rpc.readAsset({ sessionId: row.sessionId, path: row.cover }).then((asset) => {
          setRowCovers(current => ({ ...current, [row.name]: asset.dataUrl }))
        }, () => undefined)
      }
    }, (error: unknown) => { console.warn('[tavern] rpc failed', error) })
  }, [rpc, rowCovers])
  /**
   * Switch the active session even when the client list hasn't heard of the
   * id yet: 清空/载入/编辑 create a fresh session server-side, and the
   * api-session/added frame can lag the rpc response — retry the
   * refresh+open cycle on a short backoff (the manager throws on unknown ids,
   * both from `refresh` rejections and from a still-missing id at `open`)
   * so the switch always lands instead of silently keeping the OLD session bound.
   */
  const switchSession = useCallback((freshId: SessionId, toastText: string): void => {
    let attempts = 0
    const giveUp = (): void => {
      setToast({ text: t('app.openFailed'), kind: 'info' })
      window.setTimeout(() => { setToast(undefined) }, 2600)
      refreshRows()
    }
    const attempt = (): void => {
      attempts += 1
      void sessions.refresh().then(() => {
        // A rebind (载入/清空/编辑) closes any open modal first: the old
        // session's dialog must not overlay the rebound conversation (it kept
        // 保存对话框 open and made 清空 look dead until a manual refresh).
        setSettings(undefined)
        setSaveOpen(false)
        try {
          sessions.open(freshId)
        } catch {
          // The refreshed list can still lack the id — back off and retry.
          if (attempts >= 8) { giveUp(); return }
          window.setTimeout(attempt, 250)
          return
        }
        refreshRows()
        setToast({ text: toastText, kind: 'success' })
        window.setTimeout(() => { setToast(undefined) }, 2600)
      }, () => {
        // refresh failed: the id may still appear via the added frame.
        if (attempts >= 8) { giveUp(); return }
        window.setTimeout(attempt, 250)
      })
    }
    attempt()
  }, [sessions, refreshRows, t])

  /**
   * Shared rebind landing for the modal views and the chat view (载入存档 /
   * 编辑卡保存并开始 / 重试): hand the composer-restore draft to the fresh
   * session, forget the old session's sidebar line, remember the view on the
   * fresh one, and switch. An in-place rebind (the fresh id equals the
   * current one — a boundary-less save) bumps the reset signal so the chat
   * view's session effect re-runs and still consumes the handoff.
   */
  const handleSessionSwitch = useCallback((freshId: string, cause: 'load' | 'edit' | 'retry', draft?: string, anchorSeq?: number | null): void => {
    const fresh = freshId as unknown as SessionId
    restoreDraftRef.current = { sessionId: freshId, text: draft ?? '' }
    rebindCauseRef.current = {
      sessionId: freshId,
      cause: cause === 'load' ? 'load' : cause === 'edit' ? 'edit-start' : 'retry',
      anchorSeq: anchorSeq ?? null,
    }
    if (fresh === current) setResetSignal(signal => signal + 1)
    remember(fresh)
    clearPendingSession()  // 载入/重试/保存并开始＝游戏意图落地，选卡追踪终止
    if (current !== undefined && fresh !== current) forgetLastLine(current)
    switchSession(fresh, cause === 'edit' ? t('toast.editStarted') : cause === 'retry' ? t('toast.retried') : t('header.loaded'))
  }, [current, forgetLastLine, remember, switchSession, t])
  /** Esc 关闭态判定的三个对话框任一打开即为真（判定在聊天视图，动作在这里）。 */
  const escDialogOpen = settings !== undefined || saveOpen || keyDialogOpen
  const closeDialogs = useCallback((): void => {
    setSettings(undefined)
    setSaveOpen(false)
    setKeyDialogOpen(false)
  }, [])
  /** 双击 Esc（输入框已空）= 头部「加载」同款直达存档页。 */
  const openLoadPage = useCallback((): void => { openSettings('saves') }, [])

  useEffect(() => { refreshRows() }, [refreshRows])
  const createSession = (): void => {
    void rpc.createSession({ }).then((value) => {
      // The wire carries a plain string; the client list store brands ids.
      const sessionId = value.sessionId as unknown as SessionId
      remember(sessionId)
      // 先 set 再 switchSession（switch 不清 pending）：刷新在选卡前发生时，
      // 恢复效果把宿主 reconcile 劫持走的会话拉回这张空白选卡（pending-session.ts）。
      setPendingSession(sessionId)
      switchSession(sessionId, t('footer.created'))
    }, (error: unknown) => { console.warn('[tavern] rpc failed', error) })
  }
  const deleteRow = (row: TavernWorkspaceWire): void => {
    // 摘出 id 再进对话框：await 之后 TS 不再保留 row.sessionId 的非空收窄。
    const sessionId = row.sessionId
    if (sessionId === null) return
    void dialogs.confirm({
      body: t('sidebar.deleteConfirm').replace('{name}', row.name),
      confirmLabel: t('ctx.delete'),
      cancelLabel: t('app.cancel'),
      danger: true,
    }).then((yes) => {
      if (!yes) return
      void rpc.deleteSession({ sessionId })
        .then(() => {
          refreshRows()
          if (current !== undefined && sessionId === current) setHasCard(null)
        }, (error: unknown) => { console.warn('[tavern] rpc failed', error) })
    })
  }
  const openKeyDialog = (): void => {
    setKeyDraft('')
    setKeyDialogOpen(true)
    void refreshKey()
  }
  const closeKeyDialog = (): void => { setKeyDialogOpen(false) }
  const saveKey = (): void => {
    if (credentials === undefined || keyDraft.trim() === '') return
    void credentials.set('DEEPSEEK_API_KEY', keyDraft.trim()).then(() => {
      setKeyDialogOpen(false)
      setSettings(undefined)
      setToast({ text: t('toast.keySaved'), kind: 'success' })
      window.setTimeout(() => { setToast(undefined) }, 2600)
      void refreshKey()
    }, (error: unknown) => { console.warn('[tavern] rpc failed', error) })
  }
  // Pre-flight check for the composer: cached verdict, or describe when unknown.
  const checkKey = useCallback((): Promise<boolean> => {
    if (keyMissing !== null) return Promise.resolve(keyMissing)
    return refreshKey()
  }, [keyMissing, refreshKey])

  const openSaveDialog = (): void => {
    setSaveName('')
    setSaveOpen(true)
    void rpc.saves({ sessionId: current ?? ('') }).then((value) => { setSaves(value.saves) }, () => { setSaves([]) })
  }
  const confirmSave = (): void => {
    const name = saveName.trim()
    if (name === '' || current === undefined) return
    const save = (): void => {
      void rpc.save({ sessionId: current, name, draft: composerDraftRef.current }).then(() => {
        setSaveOpen(false)
        setToast({ text: t('toast.saved').replace('{name}', name), kind: 'success' })
        window.setTimeout(() => { setToast(undefined) }, 2600)
      }, (error: unknown) => { console.warn('[tavern] rpc failed', error) })
    }
    if (!saves.some(entry => entry.name === name)) { save(); return }
    void dialogs.confirm({
      body: t('save.overwrite').replace('{name}', name),
      confirmLabel: t('dialog.overwrite'),
      cancelLabel: t('app.cancel'),
      danger: true,
    }).then((yes) => {
      if (!yes) return
      save()
    })
  }
  const openSettings = (initialTab: TavernViewProps['initialTab']): void => {
    setSettings({ initialTab })
  }
  const confirmClear = (): void => {
    if (current === undefined) return
    const clearedId = current
    void dialogs.confirm({
      body: t('app.clearConfirm'),
      confirmLabel: t('header.clear'),
      cancelLabel: t('app.cancel'),
      danger: true,
    }).then((yes) => {
      if (!yes) return
      // 清空 rebinds the workspace to a FRESH session (durable logs are never
      // rewritten): the player lands on an empty history — the opening page —
      // and `runtime/` re-seeds server-side. The old session stays archived.
      void rpc.reset({ sessionId: clearedId }).then((value) => {
        const freshId = value.sessionId as unknown as SessionId
        rebindCauseRef.current = { sessionId: freshId, cause: 'clear', anchorSeq: null }
        forgetLastLine(clearedId)
        remember(freshId)
        clearPendingSession()  // 清空＝游戏意图落地（不经 handleSessionSwitch，需自清）
        switchSession(freshId, t('toast.cleared'))
        setResetSignal(signal => signal + 1)
      }, (error: unknown) => { console.warn('[tavern] rpc failed', error) })
    })
  }

  // 编辑态不进聊天：editing=引擎磁盘标记（.tavern-editing），刷新后如实返回——
  // 缺这个门，编辑中刷新会把工作区里的卡当游戏直开（2026-09-20 用户裁定）。
  const inChat = current !== undefined && hasCard === true && !drafting && editing === null
  const listRef = useRef<HTMLDivElement | null>(null)
  const [thumb, setThumb] = useState({ top: 0, h: 0, on: false })
  const thumbTimer = useRef<number | undefined>(undefined)
  /** 读列表几何并点亮自绘指示条（idle 1s 后淡出）。 */
  const refreshThumb = (): void => {
    const el = listRef.current
    if (el === null) return
    const view = el.clientHeight
    const content = el.scrollHeight
    if (content <= view + 2) { setThumb(t => ({ ...t, h: 0, on: false })); return }
    const h = Math.max(28, Math.round((view / content) * view))
    // 列表在侧栏内有 sideHead 偏移：指示条以 sideInner 为坐标系，需叠加 el.offsetTop。
    const top = el.offsetTop + Math.round((el.scrollTop / (content - view)) * (view - h))
    setThumb({ top, h, on: true })
    if (thumbTimer.current !== undefined) window.clearTimeout(thumbTimer.current)
    thumbTimer.current = window.setTimeout(() => setThumb(t => ({ ...t, on: false })), 1100)
  }
  // 行集合变化/容器尺寸变化都会改几何：顺带刷新一次（scroll 事件由 onScroll 承担）。
  useEffect(() => {
    refreshThumb()
    const el = listRef.current
    if (el === undefined || el === null || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => refreshThumb())
    ro.observe(el)
    return () => { ro.disconnect(); if (thumbTimer.current !== undefined) window.clearTimeout(thumbTimer.current) }
  }, [rows.length, sideOpen])
  return (
    <div className={`${css.app} tavern-root`}>
      <aside className={`${css.side} ${sideOpen ? '' : css.sideClosed}`} aria-hidden={!sideOpen}>
        <div className={css.sideInner}>
          <div className={css.sideHead}>
            <span className={css.sideTitle}>{t('sidebar.title')}</span>
            <span className={css.sideCount}>{rows.length} {t('sidebar.count')}</span>
            <button type="button" className={css.sideGear} title={t('settings.tabKey')} onClick={openKeyDialog}>{t('settings.tabKey')}</button>
          </div>
          <div
            className={css.list}
            ref={listRef}
            onScroll={refreshThumb}
          >
            {rows.map(row => (
              <button
                key={row.name} type="button"
                className={`${css.sessionCard} ${row.sessionId !== null && row.sessionId === current ? css.active : ''}`}
                onClick={() => { if (row.sessionId !== null) openSession(row.sessionId as SessionId) }}
              >
                {row.sessionId !== null && (
                  <button
                    type="button" className={css.cardDel} title={t('ctx.delete')}
                    onClick={(event) => { event.stopPropagation(); deleteRow(row) }}
                  >✕</button>
                )}
                <span className={css.avatar}>
                  {row.cover !== '' && rowCovers[row.name] !== undefined
                    ? <img className={css.avatarImg} src={rowCovers[row.name]} alt="" />
                    : <span>{(row.title !== '' ? row.title : t('view.label')).trim().charAt(0)}</span>}
                </span>
                <span className={css.cardMain}>
                  <span className={css.cardName} title={row.hasCard ? row.title : t('sidebar.pickCard')}>{row.hasCard ? row.title : t('sidebar.pickCard')}</span>
                  <span className={css.cardState}>
                    {row.sessionId !== null && lastLines[row.sessionId] !== undefined && (
                      <span className={css.lastLine} title={lastLines[row.sessionId]}>{lastLines[row.sessionId]}</span>
                    )}
                  </span>
                </span>
              </button>
            ))}
            {rows.length === 0 && <div className={css.loading}>{t('app.noSessions')}</div>}
          </div>
          {/* 自绘滚动指示：原生条隐藏，滚动/悬停淡入的金细条（不拦截指针）。 */}
          <div className={css.listThumb} style={{ top: `${thumb.top}px`, height: `${thumb.h}px` }} data-on={thumb.on || undefined} />
          <div className={css.sideFoot}>
            <button type="button" className={css.newBtn} onClick={createSession}>＋ {t('app.newSession')}</button>
          </div>
        </div>
      </aside>
      <main className={css.main}>
        <header className={css.chatHead}>
          {/* 收起止于 width 0，唤回全靠这颗常驻 toggle；收起态 ＋ 保住新会话入口。 */}
          <button
            type="button" className={css.sideToggle}
            aria-label={sideOpen ? t('sidebar.toggleClose') : t('sidebar.toggleOpen')}
            title={sideOpen ? t('sidebar.toggleClose') : t('sidebar.toggleOpen')}
            aria-expanded={sideOpen}
            onClick={toggleSide}
          >
            <PanelLeftGlyph size={16} />
          </button>
          {!sideOpen && (
            <button
              type="button" className={css.sideToggle}
              aria-label={t('app.newSession')} title={t('app.newSession')}
              onClick={createSession}
            >＋</button>
          )}
          <h1 className={css.chatTitle}>
            {inChat ? (cardMeta.title || rows.find(row => row.sessionId === current)?.title || current) : current !== undefined ? (rows.find(row => row.sessionId === current)?.title ?? current) : t('empty.title')}
          </h1>
          {/* 页头动作区常驻（库页也换肤）：主题选择打头，聊天态再接 保存/加载/清空/设置。 */}
          <div className={css.headActions}>
            <select
              className={css.themeSelect}
              aria-label={t('theme.label')}
              title={t('theme.hint')}
              value={themeChoice}
              onChange={(event) => {
                const value = event.target.value
                if ((THEME_CHOICES as readonly string[]).includes(value)) selectTheme(value as ThemeChoice)
              }}
            >
              {THEME_CHOICES.map(choice => <option key={choice} value={choice}>{t(THEME_LABEL[choice])}</option>)}
            </select>
            {inChat && (
              <>
                <button type="button" className={`${css.textBtn} ${css.primary}`} onClick={openSaveDialog}>{t('header.save')}</button>
                <button type="button" className={css.textBtn} onClick={() => { openSettings('saves') }}>{t('header.load')}</button>
                <button type="button" className={`${css.textBtn} ${css.danger}`} onClick={confirmClear}>{t('header.clear')}</button>
                <button type="button" className={css.textBtn} onClick={() => { openSettings('files') }}>{t('settings.title')}</button>
              </>
            )}
          </div>
        </header>
        {current === undefined ? (
          <div className={css.obWrap}>
            <div className={css.obTitle}>{t('empty.title')}</div>
            <div className={css.obSub}>{t('empty.sub')}</div>
          </div>
        ) : inChat ? (
          <TavernChatView
            rpc={rpc} sessions={sessions} sessionId={current} directory={directory}
            onCardTheme={setCardThemeCss}
            cardMeta={cardMeta} resetSignal={resetSignal} rememberLastLine={rememberLastLine}
            tailRunning={tailRunning} onTurnEnd={handleTurnEnd} onStopped={pollTail} conversation={conversation}
            rowTitle={rows.find(row => row.sessionId === current)?.title ?? ''}
            retryable={retryable}
            escDialogOpen={escDialogOpen} onEscCloseDialog={closeDialogs} onEscOpenLoadPage={openLoadPage}
            onSessionSwitch={handleSessionSwitch}
            onDraftChange={onComposerDraftChange} restoreDraftRef={restoreDraftRef}
            rebindCauseRef={rebindCauseRef}
            t={t}
            checkKey={checkKey}
            onNeedKey={openKeyDialog}
            onToast={setToast}
          />
        ) : (
          /* 开局页：卡库与导入/建卡流程就地切换，无弹窗（design_zh.md「开局页」）。
             编辑卡也要收到 onSessionSwitch——「保存并开始」按钮以它为渲染前提。 */
          <div className={css.onboardHost}>
            <TavernView
              rpc={rpc} sessionId={current} t={t} editMode={editing}
              sessions={sessions} models={models} conversation={conversation}
              checkKey={checkKey} onNeedKey={openKeyDialog}
              onCardReady={() => { clearPendingSession(); setHasCard(true); refreshRows() }}
              onSessionSwitch={handleSessionSwitch}
            />
          </div>
        )}
      </main>
      {settings !== undefined && current !== undefined && (
        <div className={css.keyDialog} onClick={() => { setSettings(undefined) }}>
          <div className={css.keyCard} style={{ width: 'min(1320px, calc(100vw - 32px))', height: 'min(92vh, calc(100vh - 32px))', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }} onClick={(event) => { event.stopPropagation() }}>
            <div className={css.modalHead}>
              {/* The card's meta title is the stable identity — the session's
                  auto-title can carry the wrap tags (`<pre-instructions>`). */}
              <h2 className={css.modalTitle}>{cardMeta.title !== '' ? cardMeta.title : (rows.find(row => row.sessionId === current)?.title ?? current)}</h2>
              <button type="button" className={css.modalClose} aria-label={t('app.close')} onClick={() => { setSettings(undefined) }}>×</button>
            </div>
            <div className={css.modalBody}>
              <TavernView
                rpc={rpc} sessionId={current} t={t} initialTab={settings.initialTab} editMode={editing}
                sessions={sessions} models={models} conversation={conversation}
                checkKey={checkKey} onNeedKey={openKeyDialog}
                onSessionSwitch={handleSessionSwitch}
              />
            </div>
          </div>
        </div>
      )}
      {saveOpen && current !== undefined && (
        <div className={css.keyDialog} onClick={() => { setSaveOpen(false) }}>
          <div className={css.keyCard} style={{ width: 'min(420px, calc(100vw - 48px))' }} onClick={(event) => { event.stopPropagation() }}>
            <div className={css.modalHead} style={{ padding: 0, marginBottom: 10 }}>
              <h2 className={css.modalTitle}>{t('header.save')}</h2>
              <button type="button" className={css.modalClose} aria-label={t('app.close')} onClick={() => { setSaveOpen(false) }}>×</button>
            </div>
            <div className={css.svList}>
              {saves.length === 0 && <div className={css.svEmpty}>{t('saves.empty')}</div>}
              {saves.map(save => (
                <button
                  key={save.name} type="button" className={css.svItem}
                  onClick={() => { setSaveName(save.name) }}
                >
                  <span className={css.svName}>{save.name}</span>
                  {save.summary !== '' && <span className={css.svSum} title={save.summary}>{save.summary}</span>}
                  <span className={css.svMeta}>{save.type === 'auto' ? t('save.auto') : t('save.manual')}</span>
                </button>
              ))}
            </div>
            <div className={css.keyRow}>
              <input
                value={saveName}
                placeholder={t('header.saveNamePlaceholder')}
                onChange={(event) => { setSaveName(event.target.value) }}
                onKeyDown={(event) => { if (event.key === 'Enter') confirmSave() }}
              />
              <button type="button" className={`${css.btn} ${css.primary}`} onClick={confirmSave}>{t('header.save')}</button>
            </div>
            <div className={css.svHint}>{t('save.dialogHint')}</div>
          </div>
        </div>
      )}
      {toast !== undefined && (
        <div className={css.toasts}>
          <div className={`${css.toast} ${toast.kind === 'success' ? css.toastSuccess : ''} ${toast.kind === 'error' ? css.toastError : ''}`}>{toast.text}</div>
        </div>
      )}
      {dialogs.dialog}
      {keyDialogOpen && (
        <div className={css.keyDialog} onClick={closeKeyDialog}>
          <div className={css.keyCard} onClick={(event) => { event.stopPropagation() }}>
            <KeyForm
              t={t}
              draft={keyDraft}
              onDraft={setKeyDraft}
              onSave={saveKey}
              onLater={closeKeyDialog}
              laterLabel={t('key.later')}
              configured={keyMissing === null ? null : !keyMissing}
            />
          </div>
        </div>
      )}
    </div>
  )
}

/** The shared key form: title, body, input row, primary save, skip/close. */
function KeyForm(props: {
  t: TranslateNS<typeof NS>
  draft: string
  onDraft(value: string): void
  onSave: () => void
  onLater: () => void
  laterLabel: string
  /** null = the describe verdict has not landed yet. */
  configured: boolean | null
}): ReactNode {
  return (
    <>
      <h2>{props.t('key.title')}</h2>
      <p>{props.t('key.body')}</p>
      {props.configured !== null && (
        <div className={css.keyState}>
          {props.configured ? props.t('key.configured') : props.t('key.notConfigured')}
        </div>
      )}
      <div className={css.keyRow}>
        <input
          value={props.draft}
          placeholder={props.t('key.placeholder')}
          onChange={(event) => { props.onDraft(event.target.value) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') props.onSave()
            // Esc 关闭归全局监听（聊天视图的单一所有者），这里只管 Enter 提交。
          }}
        />
        <button type="button" className={`${css.btn} ${css.primary}`} onClick={props.onSave}>{props.t('key.save')}</button>
        <button type="button" className={css.btn} onClick={props.onLater}>{props.laterLabel}</button>
      </div>
    </>
  )
}

/** 侧栏开关的单色 panel-left 字形。内联而不 import ui-primitives：本页是运行时
 *  fetch 的动态 client bundle，purity gate 只放行已声明的 module-table 行
 *  （静态装配通道的包才能裸引 primitives）；单色字形也贴合本页图标口径。 */
function PanelLeftGlyph(props: { size?: number }): ReactNode {
  return (
    <svg
      width={props.size ?? 16} height={props.size ?? 16}
      viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false"
    >
      <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="6.25" y1="3" x2="6.25" y2="13" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

function TavernChatView(props: {
  rpc: TavernRpc
  sessions: ISessions
  sessionId: SessionId
  directory: ModelDirectory | undefined
  /** Reports the bound card's theme css (null = none) to the sheet writer in TavernAppBody. */
  onCardTheme(css: string | null): void
  cardMeta: { title: string; desc: string; cover: string }
  /** Bumped by 清空 — the transcript clears back to the opening page. */
  resetSignal: number
  /** The tail agent is mid-bookkeeping right now (banner + send gate). */
  tailRunning: boolean
  /** A live turn/end settled in this session's event stream — lock=true optimistically
   *  gates the tail for a completed turn (the tail is about to fork), false polls the
   *  real tail state (the tail-finished command/done signal). */
  onTurnEnd(lock: boolean): void
  /** Immediate tail-state refresh after a stop lands (inside the 2s poll interval). */
  onStopped(): void
  /** The Conversation service face: store key and the occupancy rule. */
  conversation: ConversationFace
  rememberLastLine(sessionId: string, line: string): void
  /** Workspace display title fallback for the default opening. */
  rowTitle: string
  t: TranslateNS<typeof NS>
  checkKey: () => Promise<boolean>
  onNeedKey: () => void
  /** Host-level toast surface (the toast state lives in TavernAppBody). */
  onToast(toast: { text: string; kind: 'success' | 'info' | 'error' }): void
  /** A retry point exists (state().retryable) — the last reply may offer ↻. */
  retryable: boolean
  /** Any modal (settings / save / key) is open — single Esc closes it. */
  escDialogOpen: boolean
  onEscCloseDialog: () => void
  /** Double-Esc with an empty composer opens the load page (saves tab). */
  onEscOpenLoadPage: () => void
  /** Rebind landing shared with the modal views (载入 / 编辑 / 重试). */
  onSessionSwitch: (sessionId: string, cause: 'load' | 'edit' | 'retry', draft?: string) => void
  /** Composer text mirror for the manual-save stamp (a ref write, not state — per-keystroke). */
  onDraftChange: (text: string) => void
  /** One-shot rebind handoff: target session id plus the composer text to restore. */
  restoreDraftRef: MutableRefObject<{ sessionId: string; text: string } | undefined>
  /** One-shot landing handoff: the rebind cause plus the load's fork-cut seq (着陆合约 2026-09-25). */
  rebindCauseRef: MutableRefObject<{ sessionId: string; cause: LandingCause; anchorSeq: number | null } | undefined>
}): ReactNode {
  const { rpc, sessions, sessionId, t } = props
  const binding = sessions.binding(sessionId)
  // The Session snapshot drives pending/error surfaces exactly like the stock
  // chat: the host running-bit clears typing, promptError/openError are the
  // visible admission failures the event stream never carries.
  const { running, openBroken, promptBroken } = useSessionSurface(binding)
  const [lines, setLines] = useState<readonly ChatLine[]>([])
  // undefined = loading, null = the card ships no opening.html, string = its HTML
  const [opening, setOpening] = useState<string | null | undefined>(undefined)
  const [draft, setDraft] = useState('')
  const [turnError, setTurnError] = useState<TurnError | null>(null)
  const [pending, setPending] = useState(false)
  /** Live reasoning deltas are streaming right now (the 思考 row carries them). */
  const [thinking, setThinking] = useState(false)
  /** Live narrative deltas are streaming right now (the body row carries them). */
  const [texting, setTexting] = useState(false)
  /** The in-flight submission's abort handle: the stop button kills the wrap render and the admission round-trip. */
  const promptAbort = useRef<AbortController | undefined>(undefined)
  // 着陆合约的视图侧三件套（2026-09-25）：转写滚动容器 ref、本页锚存层
  // （localStorage 兜重启）、未决着陆计划（gate 与一次性应用均以它在场为准）。
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const anchorMemory = useMemo(() => createReaderAnchorStore(), [])
  const pendingLanding = useRef<{ plan: LandingPlan; tries: number } | undefined>(undefined)
  // 图片漂移复贴令牌：玩家接管（发送/新着陆/换会话）即作废——复贴永不与人对卷。
  const restoreTokenRef = useRef<symbol | undefined>(undefined)
  // 清空后的开场回跳：前端清空转写并显示开场页；下一次发送恢复正常历史视图。
  const [cleared, setCleared] = useState(false)
  const [coverAsset, setCoverAsset] = useState<string | undefined>(undefined)
  // Composer 文本唯一入口：同步本地镜像（Esc 双击判定读 ref，不进渲染闭包）
  // 与父层 ref（手动存档戳的采集源）。
  const draftMirror = useRef('')
  const updateDraft = useCallback((value: string): void => {
    setDraft(value)
    draftMirror.current = value
    props.onDraftChange(value)
  }, [props.onDraftChange])

  // 用量与上下文占用：宿主投影（token-meter / session-stats），能力缺席时读 undefined。
  // statsLine 落 0 占位常显；环形对齐 stock ContextMeter——占用未知（pressure 或
  // contextWindow 缺席）时整个不渲染，数据到达后出现真实百分比。
  const usage = useProjectionValue<TokenUsageProjection>(binding, 'tokenUsage')
  const pressure = useProjectionValue<ContextPressureProjection>(binding, 'contextPressure')
  const breakdown = useProjectionValue<ContextBreakdownProjection>(binding, 'contextBreakdown')
  const sessionStats = useProjectionValue<SessionStatsProjection>(binding, 'sessionStats')

  useEffect(() => {
    setTurnError(null); setPending(false); setThinking(false); setTexting(false); setCleared(false); setCoverAsset(undefined); setExtraShown(0)
    // Consume the rebind handoff once per run: a 载入 carries the save stamp's
    // draft (the composer text at the save point); every other rebind lands
    // with an empty composer. The entry is always cleared — no cross-visit
    // staleness on later switches back to this session.
    const restore = props.restoreDraftRef.current
    props.restoreDraftRef.current = undefined
    const text = restore !== undefined && restore.sessionId === sessionId ? restore.text : ''
    setDraft(text)
    props.onDraftChange(text)
    // 着陆仲裁（2026-09-25 着陆合约）：进场 cause（一次性交接，消费即清）+ 锚存层
    // 读数 → 恰好一条着陆计划。计划未决的 commit 由 gate 压住 glue（boot 恢复链
    // 是两段式 commit：先重放、后恢复）。
    const rebind = props.rebindCauseRef.current
    if (rebind !== undefined && rebind.sessionId === sessionId) props.rebindCauseRef.current = undefined
    const cause = rebind !== undefined && rebind.sessionId === sessionId ? rebind.cause : 'exit-return'
    restoreTokenRef.current = undefined
    pendingLanding.current = {
      plan: decideLanding(cause, {
        stored: anchorMemory.read(sessionId),
        loadAnchorSeq: rebind !== undefined && rebind.sessionId === sessionId ? rebind.anchorSeq : null,
        // hasContent 只读当次渲染快照（lines 不入依赖），仅为调用点可读。
        hasContent: lines.length > 0,
      }),
      tries: 0,
    }
  }, [sessionId, props.resetSignal, anchorMemory, props.rebindCauseRef])
  // 尾随的滚动栈：scroller 的影响顺序（glue effect）必须排在着陆计划添置之后，
  // 计划未决的首个 commit 才被 gate 压住。
  const [following, setFollowing] = useState(true)
  const scroller = useTranscriptScroller(transcriptRef, {
    onFollowChange: setFollowing,
    // 着陆计划未决的 commit 不许 glue 抢写视口（boot 恢复链的两段式 commit）。
    gate: () => pendingLanding.current !== undefined,
  })
  // 离场捕获（第 2 层写入口）：清理段必须跑在 layout 阶段——先于新会话的
  // 重放与 glue（passive），否则几何已被下一会话污染。此时 DOM 仍带着旧行，
  // 读出的就是离开那一刻的阅读位置；发送链路显式 capture(null) 清锚。
  useLayoutEffect(() => {
    const leaving = sessionId
    return () => {
      restoreTokenRef.current = undefined
      anchorMemory.capture(leaving, captureAnchor(transcriptRef.current))
    }
  }, [sessionId, anchorMemory])
  // 着陆应用：lines 定案的 commit 里一次性执行（跟随 / 锚恢复 / 兜底跟随）。
  // 锚行缺席（重放未完 / 窗口截断）时最多等三个 commit，随后按跟随落底。
  useLayoutEffect(() => {
    const pending = pendingLanding.current
    if (pending === undefined) return
    pending.tries += 1
    const anchorSeq = pending.plan.anchorSeq
    const row = pending.plan.follow || anchorSeq === null
      ? null
      : findAnchorRow(transcriptRef.current, anchorSeq)
    // 锚行缺席先留计划等下个 commit（两段式恢复：先重放、后恢复），三跳后兜底跟随。
    if (pending.plan.follow || row === null || anchorSeq === null) {
      if (pending.plan.follow || pending.tries >= 3) {
        pendingLanding.current = undefined
        scroller.follow()
      }
      return
    }
    {
      const plan = pending.plan
      pendingLanding.current = undefined
      scroller.land(row, plan.offsetPx)
      // 晚到的图片会把锚行上方内容撑高（一次性 land 的已知漂移源）：所有
      // 转写图 decode 定案后按同一 offset 复贴一次。会话已离开 / 玩家已接管
      // （发送清锚、新着陆、回底灯）只要 token 不在场即放弃。
      const el = transcriptRef.current
      const images = Array.from(el?.querySelectorAll('img') ?? [])
      if (images.length === 0) return
      const token = Symbol()
      restoreTokenRef.current = token
      const recorrect = (): void => {
        if (restoreTokenRef.current !== token || scroller.isFollowing()) return
        const fresh = findAnchorRow(transcriptRef.current, anchorSeq)
        if (fresh !== null) scroller.land(fresh, plan.offsetPx)
        restoreTokenRef.current = undefined
      }
      const imagesDecoded = Promise.all(images.map(img =>
        typeof img.decode === 'function' ? img.decode().catch(() => undefined) : Promise.resolve(),
      ))
      void Promise.race([imagesDecoded, new Promise(resolve => { setTimeout(resolve, 3000) })]).then(recorrect)
    }
  }, [lines, sessionId, scroller])
  useEffect(() => {
    if (props.cardMeta.cover === '') { setCoverAsset(undefined); return }
    void rpc.readAsset({ sessionId, path: props.cardMeta.cover }).then(
      (value) => { setCoverAsset(value.dataUrl) },
      () => { setCoverAsset(undefined) },
    )
  }, [rpc, sessionId, props.cardMeta.cover])
  // 默认开场页的开场选项（preset/greetings.json，可选文件 — 导入的 first_mes 与
  // alternate_greetings 的数据落点）。文件缺席或 JSON 无效 = 无选项，默认页退回
  // 标题+简介。点击只填输入框：与 opening.html 选项共用 updateDraft 入口，发送
  // 仍由玩家按键触发。opening.html 卡不走这里（有卡自绘开场页时选项不加载）。
  const [greetings, setGreetings] = useState<readonly string[]>([])
  useEffect(() => {
    if (opening !== null) { setGreetings([]); return }
    let cancelled = false
    void rpc.readText({ sessionId, path: 'preset/greetings.json' }).then((value) => {
      if (cancelled) return
      let list: readonly string[] = []
      try {
        const parsed: unknown = JSON.parse(value.text)
        const declared = typeof parsed === 'object' && parsed !== null
          ? (parsed as { greetings?: unknown }).greetings
          : undefined
        if (Array.isArray(declared)) {
          list = declared.filter((entry): entry is string => typeof entry === 'string' && entry.trim() !== '')
        }
      } catch { list = [] /* 坏 JSON 视为无选项 — 可选数据文件，静默回退 */ }
      setGreetings(list)
    }, () => { if (!cancelled) setGreetings([]) })
    return () => { cancelled = true }
  }, [rpc, sessionId, opening])
  // 卡片界面：绑定/换绑时加载 preset/ui/（授权一次、样式注入、mount(tavern)）。
  const [cardUi, setCardUi] = useState<CardUiHandle | null>(null)
  const [extraShown, setExtraShown] = useState(0)
  // 卡的 stop face 载体：stop 每渲染重建（闭包吃当前 binding/闸门态），
  // loadCardUi 只在换绑时调一次——经 ref 间接换入最新闭包（同 escHandler.current 房式）。
  const cardStopRef = useRef<() => void>(() => undefined)
  // 卡的 live 流载体：read() 订阅回调在 dose/liveBody 发生时才跑,经 ref 拿最新句柄
  // push live assistant 文本(同 cardStopRef 房式,避免 effect 闭包过期)。
  const cardUiRef = useRef<CardUiHandle | null>(null)
  cardUiRef.current = cardUi
  useEffect(() => {
    let disposed = false
    let handle: CardUiHandle | null = null
    void loadCardUi(rpc, sessionId, { stop: () => cardStopRef.current() }).then((loaded) => {
      if (disposed) { loaded?.dispose(); return }
      handle = loaded
      setCardUi(loaded)
    }, () => undefined)
    return () => {
      disposed = true
      handle?.dispose()
      handle = null
      setCardUi(null)
    }
  }, [rpc, sessionId])
  // 文件事件喂数(2026-09-25 通道批):单例已按本会话过滤,换绑自动换键重订阅;
  // hint 经 cardUiRef 房式推给 face(与加载时序无关)。信号只是"去拉一次"的暗示,
  // 卡侧 rev 门裁决一切;jsdom/无 EventSource 时订阅 no-op(轮询兜底恒在)。
  useEffect(() => subscribeFileEvents(sessionId, hint => { cardUiRef.current?.feedFileEvents(hint) }), [sessionId])
  // 上报本绑定卡的主题 css（唯一上报口）：Body 持有它执笔 #tavern-theme sheet——
  // 聊天视图是条件挂载的，sheet 必须在 library/设置模态也常开；卸载即上报清空。
  useEffect(() => {
    props.onCardTheme(cardUi?.themeCss ?? null)
    return () => { props.onCardTheme(null) }
  }, [cardUi, props.onCardTheme])
  // 卡停靠槽（G3，2026-09-25）：卡经 dockComposer face 注册的几何。有槽 =
  // composer 经 portal 挂进卡面板（同一 React 子树换挂载点，草稿/IME/模型座
  // 全保留），无槽 = transcript 下方流内常位。回落由 card-ui 清空槽态（注册
  // 解停 / handle dispose）结构性驱动——不存在「卡忘了还原」这个状态空间
  // （2026-09-25 换绑内联样式泄漏立案的根因拆除）。
  const [dockSlot, setDockSlot] = useState<Element | null>(null)
  useEffect(() => {
    const dock = cardUi?.composerDock
    if (dock === undefined) { setDockSlot(null); return }
    setDockSlot(dock.slot)
    return dock.subscribe(() => { setDockSlot(dock.slot) })
  }, [cardUi])
  const layout = cardUi?.layout
  const windowLast = layout?.windowLast
  const visibleLines = windowLast === undefined ? lines : lines.slice(Math.max(0, lines.length - windowLast - extraShown))
  const hiddenOlder = windowLast === undefined ? 0 : Math.max(0, lines.length - windowLast - extraShown)
  // 重试 ↻ 的渲染位：最后一条 reply 行（narrative/stopped/error）位于最后一条
  // user 行之后（该回复之后玩家未提交过）且会话空闲——与发送按钮状态机同源
  // （停止/报错的回合也算回复完毕）。挂最后一条可见 narrative：windowLast 截断
  // 下可见窗的末尾即最新回复；整个 reply 被截出可见窗时不显示。
  let lastUserAt = -1
  let lastReplyAt = -1
  for (let index = 0; index < lines.length; index += 1) {
    const kind = lines[index]?.kind
    if (kind === 'user') lastUserAt = index
    if (kind === 'narrative' || kind === 'stopped' || kind === 'error') lastReplyAt = index
  }
  const retryAt = lastReplyAt > lastUserAt && !running && !pending && !props.tailRunning && props.retryable
    ? lastReplyAt - (lines.length - visibleLines.length)
    : -1
  const retryVisibleIndex = retryAt >= 0 ? retryAt : undefined
  const panels = (slot: 'top' | 'bottom' | 'left' | 'right' | 'overlay'): ReactNode[] =>
    (layout?.panels ?? []).filter(entry => entry.slot === slot).map(entry => (
      <div
        key={entry.name}
        // overlay 槽补 tavern-panel-overlay 类：App.module.css 的 absolute 定位规则要求双类，
        // 此前 TSX 从不输出该类 → 宿主 overlay 样式为死代码，overlay 面板退化为流内空 div。
        className={`tavern-panel tavern-panel-${entry.name} tavern-panel-slot-${slot}${slot === 'overlay' ? ' tavern-panel-overlay' : ''}`}
        style={entry.size === undefined ? undefined
          : { [slot === 'left' || slot === 'right' ? 'width' : 'height']: entry.size }}
      />
    ))
  // 开场页选项 → 填入输入框（opening.html 经 postMessage 与父页通信）。
  useEffect(() => {
    const onMessage = (event: MessageEvent): void => {
      const data = event.data as { t?: unknown; text?: unknown } | undefined
      if (data === undefined || data.t !== 'tavern-insert') return
      updateDraft(typeof data.text === 'string' ? data.text : '')
    }
    window.addEventListener('message', onMessage)
    return () => { window.removeEventListener('message', onMessage) }
  }, [updateDraft])
  // 维护行出现条件：turn/end 收尾时宿主正处尾代理闸门（由轮询的 tailRunning 反映）。
  useEffect(() => {
    if (binding === undefined) return
    const source = binding.eventSource
    // 活到的 turn/end 才触发 onTurnEnd：首次 read()（挂载重放/重订阅）先建立
    // turn/end seq 基线，其后 seq 更大的 turn/end 才是本订阅期内新落定的回合。
    // 用 seq 而非条目下标：历史窗口 prepend/replace 会整体换血，只有 seq 单调可靠。
    let primed = false
    let seenTurnEnd = Number.NEGATIVE_INFINITY
    let seenCmdDone = Number.NEGATIVE_INFINITY
    const read = (): void => {
      if (cleared) { setLines([]); return }
      const out: ChatLine[] = []
      let sawOutput = false
      let liveThink = ''
      let liveBody = ''
      // Per-pass folds: the tail's transposed stream by childId, and the main
      // agent's durable callId → paired result for the expanded tool rows.
      const tailFolds = new Map<string, TailLiveFold>()
      const toolResults = new Map<string, string>()
      /* jscpd:ignore-start -- the aggregation loop mirrors the writer column's
         reader by contract (same event shapes); the bodies diverge by design
         (wrap strip, tail rows, sidebar lines live only here). */
      for (const entry of source.getSnapshot().entries) {
        // Live stream frames: reasoning/text deltas feed the turn's live 思考/正文
        // rows (the durable assistant/message carries neither); frames whose
        // attemptId carries the tail marker belong to the transposed tail-child
        // stream — they fold into that maintenance row instead of the transcript.
        if (entry.type === 'transient') {
          const data = (entry.event as { data?: { attemptId?: unknown; chunk?: StreamChunkLike } }).data
          const attemptId = typeof data?.attemptId === 'string' ? data.attemptId : undefined
          const chunk = data?.chunk
          if (attemptId !== undefined && attemptId.startsWith(TAIL_STREAM_PREFIX)) {
            const childId = attemptId.slice(TAIL_STREAM_PREFIX.length).split(':')[0] ?? ''
            if (childId !== '' && chunk !== undefined) {
              let fold = tailFolds.get(childId)
              if (fold === undefined) {
                fold = { open: new Map(), steps: [], reply: '' }
                tailFolds.set(childId, fold)
              }
              foldTailStreamChunk(fold, chunk)
            }
            continue
          }
          if (chunk?.type === 'reasoning-delta' && typeof chunk.text === 'string') liveThink += chunk.text
          else if (chunk?.type === 'text-delta' && typeof chunk.text === 'string') liveBody += chunk.text
          continue
        }
        const event = entry.event as { type?: string; seq?: number; data?: Record<string, unknown>; time?: unknown; surfaceOp?: unknown }
        const data = event.data ?? {}
        {/* jscpd:ignore-end */}
        const time = typeof event.time === 'number' ? event.time : undefined
        // 行的阅读锚身份（着陆合约 2026-09-25）：durable 事件的 seq；瞬态无锚不参与。
        const seq = typeof event.seq === 'number' ? event.seq : undefined
        const textAt = (key: string): string => {
          const value = data[key]
          if (typeof value === 'string') return value
          // A user/message `data` IS the message (blocks at the data level);
          // assistant and system events wrap theirs under `data.message`.
          // Only `text` blocks are visible prose: a `reasoning` block is the
          // model's thinking and renders as the 思考行, never as narrative.
          const blocksOf = (candidate: unknown): string => Array.isArray(candidate)
            ? candidate.map((block) => {
              const record = block as { type?: unknown; text?: unknown }
              return record.type === 'text' && typeof record.text === 'string' ? record.text : ''
            }).join('')
            : ''
          if (Array.isArray(value)) return blocksOf(value)
          if (typeof value === 'object' && value !== null && Array.isArray((value as { content?: unknown }).content)) {
            return blocksOf((value as { content?: unknown[] }).content)
          }
          return ''
        }
        if (event.type === 'user/message') {
          // Plugin-sourced snapshots (runtime context) never render as player
          // bubbles; replacement copies are model-only history. Append-origin
          // test mirrors dsh-session's isAppendSurfaceEvent (a value import
          // would break client bundle purity; the wire passes the marker
          // through as `surfaceOp`).
          const sourceKind = (data.source as { kind?: unknown } | undefined)?.kind
          const isAppendOrigin = event.surfaceOp === 'append'
          if (sourceKind !== 'user' || !isAppendOrigin) continue
          // Player text renders as the bubble. Plugin-sourced user messages
          // (the engine's per-turn post instruction) and replacement copies
          // never reach here. The strip hits only wrap-era session logs — the
          // current engine composes the bare player text, so it is a no-op.
          const rawBlocks = textBlocksOf(data['message'])
          const body = stripInstructions(rawBlocks.length > 0 ? rawBlocks : textBlocksOf(data['content'])).join('')
          if (body !== '') {
            out.push({ kind: 'user', text: body, time, args: undefined, live: false, ...(seq === undefined ? {} : { seq }) })
            props.rememberLastLine(sessionId, body)
          }
        } else if (event.type === 'assistant/message') {
          // 思考折叠行：本回合 durable stream 里的 reasoning-chunks 聚合为
          // 一行灰色摘要（可展开）；reasoning 内容块不再漏进叙事。
          const reasoning = reasoningOf(data)
          if (reasoning.trim() !== '') out.push({ kind: 'think', text: reasoning, time, args: undefined, live: false, ...(seq === undefined ? {} : { seq }) })
          const body = textAt('node') || textAt('message')
          if (body !== '') { out.push({ kind: 'narrative', text: body, time, args: undefined, live: false, ...(seq === undefined ? {} : { seq }) }); sawOutput = true }
        } else if (event.type === 'tool/call') {
          const call = (data['root'] ?? data['call'] ?? data) as { name?: unknown; arguments?: unknown; callId?: unknown }
          if (typeof call.name === 'string') {
            out.push({
              kind: 'tool', text: call.name, time,
              args: typeof call.arguments === 'string' ? call.arguments : undefined,
              ...(typeof call.callId === 'string' ? { callId: call.callId } : {}),
              ...(seq === undefined ? {} : { seq }),
              live: false,
            })
          }
        } else if (event.type === 'tool/result') {
          // 配对 durable 回执 → 展开工具行时参数 + 返回值同显。可见文本在
          // tool-result 块的 content 里（message.content = [ToolResultBlock]）；
          // 错误回执优先标注，客户端截断防长回执挤爆行体。
          const message = data['message'] as { content?: unknown } | undefined
          const failure = data['error'] as { name?: unknown; code?: unknown } | undefined
          const block = Array.isArray(message?.content)
            ? (message!.content as Record<string, unknown>[]).find(item => item !== null && typeof item === 'object' && item['type'] === 'tool-result')
            : undefined
          const callId = typeof block?.['toolCallId'] === 'string' ? block['toolCallId'] as string : undefined
          const text = failure !== undefined && failure.name !== undefined
            ? `${String(failure.name)}${failure.code === undefined ? '' : `: ${String(failure.code)}`}`
            : capResultText(textBlocksOf(block?.['content']).join(''))
          if (callId !== undefined && text !== '') toolResults.set(callId, text)
        } else if (event.type === 'subagent/catalog') {
          // Every tavern-tail fork owns one durable catalog row — the
          // bookkeeping line renders from it, so a refresh or tab
          // switch recovers the line (the maintenancePrompt-per-turn
          // hint would live only until the next replay).
          const tail = data as { mode?: unknown; label?: unknown; childId?: unknown }
          if (tail.mode === 'one-shot' && tail.label === 'tavern-tail' && typeof tail.childId === 'string') {
            out.push({ kind: 'tail', text: tail.childId, time, args: undefined, live: false, ...(seq === undefined ? {} : { seq }) })
          }
        } else if (event.type === 'command/done') {
          // 尾代理落定信号：引擎对每个回合边界 commit 恰一条 command/done
          // （commandId=tavern-tail-done；completed 走记账链链尾发,error/中止/停赛
          // 竞速回合无记账、微任务即发——2026-09-22 幽灵回合修复后的全覆盖契约），解锁协议
          // 成对——上锁必有与之配对的解除信号。前端据此即时 pollTail。与 turn/end 同用
          // seq 门槛：只响应本订阅期内活到的完成信号，历史重放不触发（否则重放会在主
          // 代理刚结束、尾代理闸门尚未置位的窗口里读到 tailRunning=false 而提前解锁）。
          if ((data['commandId'] as unknown) === 'tavern-tail-done' && typeof event.seq === 'number') {
            if (primed && event.seq > seenCmdDone) {
              props.onTurnEnd(false)
              // 尾行换血：清 detail 缓存让各行重取落定事实（event 触发，不带轮询）——
              // 行体从流式步骤切回 durable 全量（参数 + 配对回执 + 状态）。
              setTailDetail({})
            }
            if (event.seq > seenCmdDone) seenCmdDone = event.seq
          }
        } else if (event.type === 'turn/end') {
          sawOutput = true
          const reason = data['reason'] as { kind?: string; error?: { message?: string; code?: string } } | undefined
          // 活到的回合落定 → completed 交 handleTurnEnd 裁决：维护开启 = 乐观锁（尾代理即将
          // fork，pollTail 会读到 stale false），维护关闭 = 直接查询复原（无 fork 无写盘窗口，
          // 最普通链路）；非 completed（aborted/error/…）落真实状态。重放的历史 turn/end 不触发。
          if (typeof event.seq === 'number') {
            if (primed && event.seq > seenTurnEnd) props.onTurnEnd(reason?.kind === 'completed')
            if (event.seq > seenTurnEnd) seenTurnEnd = event.seq
          }
          /* jscpd:ignore-start -- the turn-failure line pairs with the writer
             column by contract (same durable reason shape); the RP reader
             adds wrap/tail faces the writer omits. */
          if (reason?.kind === 'error') {
            // A failed turn enters the transcript as a history line so the
            // next message appends after it, not beneath a lingering banner.
            out.push({
              kind: 'error',
              text: reason.error?.code === MISSING_CREDENTIAL ? t('chat.errorKey') : reason.error?.message ?? '',
              time,
              args: undefined,
              ...(seq === undefined ? {} : { seq }),
              live: false,
            })
          }
          {/* jscpd:ignore-end */}
          setPending(false)
          if (reason?.kind === 'aborted') {
            // A stopped turn keeps its partial narrative; the label
            // says why the reply just ends without a completion row.
            out.push({ kind: 'stopped', text: '', time, args: undefined, live: false, ...(seq === undefined ? {} : { seq }) })
          }
        }
      }
      primed = true
      // Pair the durable results into their call rows, and the live tail folds
      // into their catalog rows (the fold fills after the catalog entry passes).
      for (const line of out) {
        if (line.kind === 'tool' && line.callId !== undefined) {
          const result = toolResults.get(line.callId)
          if (result !== undefined) line.result = result
        } else if (line.kind === 'tail') {
          const fold = tailFolds.get(line.text)
          if (fold !== undefined) { line.steps = fold.steps; line.reply = fold.reply }
        }
      }
      const thinking = liveThink.trim() !== ''
      if (thinking) out.push({ kind: 'think', text: liveThink, time: undefined, args: undefined, live: true })
      // 正文流式：transient text-delta 聚合成 live 叙事行，落定后 durable
      // assistant/message 原子换掉该行（settleAssistant 清掉全部瞬态）。
      const liveNarrative = liveBody.trim() !== ''
      if (liveNarrative) {
        out.push({ kind: 'narrative', text: liveBody.trim(), time: undefined, args: undefined, live: true })
        sawOutput = true
      }
      setThinking(thinking)
      setTexting(liveNarrative)
      if (sawOutput) setPending(false)
      // live 流桥:把聚合出的当前 assistant 瞬态文本推给卡(dock 的卡按行切分即时渲染)。
      // 非瞬时(重放/idle)liveBody 为空,卡侧 diff 判定无新行即不动作。
      cardUiRef.current?.feedAssistantLive(liveBody)
      cardUiRef.current?.feedLiveReasoning(liveThink)
      setLines(out)
    }
    read()
    return source.subscribe(read)
  }, [binding, cleared, t])
  useEffect(() => {
    void rpc.opening({ sessionId }).then((value) => { setOpening(value.html) }, () => { setOpening(null) })
  }, [rpc, sessionId])
  // 底部钉屏：靠近底部时纲要更新持续跟随，打开/刷新必落到最新一行（chat-view 共享钩子）。
  // Tail-run details (durable child logs), fetched once per session
  // open; rows without a detail degrade to a neutral line.
  const [tailDetail, setTailDetail] = useState<Record<string, TailRunDetail>>({})
  const tailDetailInFlight = useRef(false)
  const loadTailDetails = useCallback((): void => {
    if (tailDetailInFlight.current) return
    tailDetailInFlight.current = true
    void rpc.tailTranscript({ sessionId }).then((value) => {
      const next: Record<string, TailRunDetail> = {}
      for (const row of value.tails) {
        next[row.childId] = { status: row.status, actions: row.actions, reply: row.reply }
      }
      tailDetailInFlight.current = false
      setTailDetail(next)
    }, (error: unknown) => {
      // A stale host without the method must not retrig per
      // render: cache the unavailable detail once per session.
      console.warn('[tavern] tailTranscript unavailable', error)
      tailDetailInFlight.current = false
      setTailDetail((prev) => {
        if (Object.keys(prev).length > 0) return prev
        return { __unavailable__: TAIL_UNAVAILABLE }
      })
    })
  }, [rpc, sessionId])
  // 维护运行中：子会话持久日志 2s 增量刷新——已完成的工具调用（带配对回执）即时
  // 可见，不必等整个维护落定（2026-09-20 用户裁定「工具结果及时渲染」）。空闲零
  // 轮询；落定终取仍由 tavern-tail-done 事件清缓存驱动。
  useEffect(() => {
    if (props.tailRunning !== true) return
    const timer = setInterval(loadTailDetails, 2_000)
    return () => clearInterval(timer)
  }, [props.tailRunning, loadTailDetails])

  const stop = (): void => {
    // 发送键在运行/在途/尾代理期间就是停止键。主回合走 session.cancel——与写卡列
    // 和 stock UI 同一条生产路径（session 命名空间，老宿主进程也有）；引擎 stop
    // 负责另一侧：尾代理 fork 取消与 stopped 标记（竞态 completed 不排尾）。
    // 两条通道失败都不能静默：旧 api bundle 没有 tavern.stop 时这里必须可见。
    if (promptAbort.current !== undefined) promptAbort.current.abort()
    promptAbort.current = undefined
    void binding?.session.cancel().then(
      () => { setPending(false) },
      (error: unknown) => {
        console.warn('[tavern] session cancel failed', error)
        setPending(false)
      },
    )
    void rpc.stop({ sessionId }).then(
      (result) => {
        setPending(false)
        // The stop lands inside the 2s polling interval — refresh the
        // tail state immediately so the lock banner clears at once.
        props.onStopped()
        if (result.tailStopped) {
          props.onToast({ text: t('chat.tailStopped'), kind: 'info' })
        }
      },
      (error: unknown) => {
        console.warn('[tavern] engine stop failed (tail may keep running on a stale host)', error)
        setPending(false)
      },
    )
  }
  // 卡 stop face 的最新闭包（card-ui.ts 经 extras.stop 间接调用）——
  // stop 每渲染重建，ref 每渲染换入，卡永远打到当前绑定/闸门态。
  cardStopRef.current = stop

  // 重试：retryPoint 完成换绑与 runtime 回滚（载入发送时刻存档），随后立刻把
  // 存下的原文按正常发送管线重发到新会话——wrap 重渲染、新 requestId、独立
  // 回合与尾代理。prompt 在客户端会话切换落地前就发出（服务端会话已存在），
  // 切换完成后转写从新会话事件流恢复：旧回复消失、原文气泡重现、running 位
  // 接管打字点。retryInFlight 挡住切换瞬间 running 位尚未置真时的二次点击。
  const retryInFlight = useRef(false)
  const retry = (): void => {
    if (running || pending || props.tailRunning || retryInFlight.current) return
    if (retryVisibleIndex === undefined) return
    setTurnError(null)
    setPending(true)
    retryInFlight.current = true
    void rpc.retryPoint({ sessionId }).then(({ sessionId: freshId, text }) => {
      const controller = new AbortController()
      promptAbort.current = controller
      void rpc.prompt({
        sessionId: freshId, text, requestId: randomUUID(), clientTimeZone: clientTimeZone(),
      }, controller.signal).then((result) => {
        if (promptAbort.current === controller) promptAbort.current = undefined
        retryInFlight.current = false
        const failures = result.scriptFailures
        if (failures !== undefined && failures.length > 0) {
          props.onToast({ text: t('toast.scriptFailed').replace('{names}', failures.map(f => f.name).join(', ')), kind: 'error' })
        }
      }, (error: unknown) => {
        if (promptAbort.current === controller) promptAbort.current = undefined
        retryInFlight.current = false
        // A stop-triggered abort is the user's own gesture, not a failure.
        if (controller.signal.aborted) { setPending(false); return }
        setTurnError({ message: error instanceof Error ? error.message : String(error), missingKey: false })
        setPending(false)
      })
      props.onSessionSwitch(freshId, 'retry')
    }, (error: unknown) => {
      retryInFlight.current = false
      setPending(false)
      setTurnError({ message: error instanceof Error ? error.message : String(error), missingKey: false })
    })
  }

  // Esc 快捷键（定案文档 §5.1）：单击即时——停 → 关对话框 → no-op；双击仅在
  // 第一下 no-op 时成立——清空输入框 → 开加载页。event.repeat 不丢弃（按住
  // ≈ 急停连按）；IME 组词中与带修饰键的组合不拦。监听只注册一次，经 ref
  // 每次渲染换入读取最新状态的闭包。
  const escTap = useRef({ at: 0, consumed: true })
  const escHandler = useRef<(event: KeyboardEvent) => void>(() => undefined)
  escHandler.current = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') return
    // IME guard（composer 同款口径）：组词确认/取消的 Esc 不进本快捷键。
    // oxlint-disable-next-line typescript/no-deprecated -- keyCode 229 是无 isComposing 引擎的遗留信号。
    if (event.isComposing || event.keyCode === 229) return
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return
    const now = Date.now()
    const tap = escTap.current
    if (now - tap.at <= 400 && !tap.consumed) {
      tap.at = now
      tap.consumed = true
      if (draftMirror.current.trim() !== '') updateDraft('')
      else props.onEscOpenLoadPage()
      return
    }
    tap.at = now
    if (running || pending || props.tailRunning) { tap.consumed = true; stop(); return }
    if (props.escDialogOpen) { tap.consumed = true; props.onEscCloseDialog(); return }
    tap.consumed = false
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => { escHandler.current(event) }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey) }
  }, [])

  const send = (): void => {
    const text = draft.trim()
    if (text === '' || binding === undefined) return
    // 发送即新意图（着陆合约 2026-09-25）：待恢复的锚就地作废——恢复与发送的
    // 竞态由此消失——并立即接回跟随（时序开始的地方落底）。
    anchorMemory.capture(sessionId, null)
    pendingLanding.current = undefined
    restoreTokenRef.current = undefined
    scroller.follow()
    // 尾代理闸门：运行期间不排新消息，输入不受影响（design_zh.md）——
    // 但按钮不锁死：它此刻是停止键（见下方按钮渲染）。
    if (props.tailRunning) return
    // 回复中锁发送：主代理回合进行中的输入一律不排队 —— 排队会让消息以「真在途」
    // 身份落进尾代理 fork 种子（种子继承真在途项是内核钉死的契约），被维护子代理
    // 误认领后主代理还会再处理一次。'queue' 模式保留，作快速连点的竞态兜底。
    if (running || pending) return
    // Pre-flight: a missing key opens the dialog instead of queueing a turn
    // that can only fail; the draft is kept so the user can resend as-is.
    void props.checkKey().then((missing) => {
      if (missing) { props.onNeedKey(); return }
      setTurnError(null)
      setCleared(false)
      updateDraft('')
      setPending(true)
      const controller = new AbortController()
      promptAbort.current = controller
      // The prompt admits through the tavern namespace: the ENGINE renders the
      // card's instruction pair around `text` and persists the composed message,
      // so the model's view and the log agree without a request-view rewrite.
      // Admission failures reject here (busy, model unavailable) instead of
      // vanishing silently; the raw text leaves this module exactly once.
      void rpc.prompt({
        sessionId,
        text,
        requestId: randomUUID(),
        clientTimeZone: clientTimeZone(),
      }, controller.signal).then((result) => {
        if (promptAbort.current === controller) promptAbort.current = undefined
        // Accepted: pending clears on the turn/end transcript read, exactly
        // like every previously queued turn. A wrap-render script failure
        // does NOT block admission — the placeholder went verbatim into the
        // prompt — but the author must see it.
        const failures = result.scriptFailures
        if (failures !== undefined && failures.length > 0) {
          props.onToast({ text: t('toast.scriptFailed').replace('{names}', failures.map(f => f.name).join(', ')), kind: 'error' })
        }
      }, (error: unknown) => {
        /* jscpd:ignore-start -- the admission-failure tail pairs with the writer
           column's send() by contract: both settle the abort handle, treat a
           stop-triggered abort as the user's gesture, and surface the error. */
        if (promptAbort.current === controller) promptAbort.current = undefined
        // A stop-triggered abort is the user's own gesture, not a failure.
        if (controller.signal.aborted) { setPending(false); return }
        setTurnError({ message: error instanceof Error ? error.message : String(error), missingKey: false })
        setPending(false)
        {/* jscpd:ignore-end */}
      })
    })
  }

  // 开场面事实（face 信号，不依赖 opening.html 拉取态——含加载期）：转写空/清空即开场期。
  const openingActive = cleared || lines.length === 0
  // 卡 opening face 的通知口：suppress opening 的卡据此自绘开场/退场（宿主权威
  // 信号，替代三张卡各自轮询 [class*="openingFrame"] 的时代）。
  useEffect(() => { cardUi?.setOpeningActive(openingActive) }, [cardUi, openingActive])
  // 默认开场页仅供宿主自己渲染——suppress opening 的卡接管开场视觉（含
  // greetings），宿主整块不画（条件渲染，非 display:none）。stage 封面背景同门。
  const honorOpening = !(cardUi?.layout.suppress ?? []).includes('opening')
  const defaultOpeningOn = openingActive && opening === null

  return (
    <div
      className={`${css.cardStage} tavern-stage`}
      style={
        // 封面模式的默认开场页把封面画在 stage 这一层：元素自身 background 垫在
        // 一切子孙之下（顶栏/输入卡保持各自表面浮在图上，磨砂/实底都自洽），
        // 图得以一路延伸到窗口底部、不再停在输入框上沿，也能透进输入卡四周的留白。
        // suppress opening 的卡接管开场视觉——封面背景也不画（卡的开场即画面）。
        openingActive && honorOpening && opening === null && coverAsset !== undefined
          ? { backgroundImage: `url(${coverAsset})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : undefined
      }
    >
      {panels('top')}
      <div className={css.cardStageMid}>
        {panels('left')}
        <div ref={transcriptRef} className={`${css.transcript} tavern-transcript`}>
          <div className={css.col}>
            {(cleared || lines.length === 0) && opening !== null && opening !== '' && (
              <div className={css.openingFull}>
                <iframe className={css.openingFrame} title={t('opening.title')} sandbox="allow-scripts" srcDoc={opening} />
              </div>
            )}
            {defaultOpeningOn && honorOpening && (
              <div className={css.openingFull}>
                <div className={`${css.defaultOpening} ${coverAsset !== undefined ? css.coverPage : ''}`}>
                  <div className={`${css.defaultOpeningTitle} ${coverAsset !== undefined ? css.onCover : ''}`}>
                    {props.cardMeta.title !== '' ? props.cardMeta.title : props.rowTitle}
                  </div>
                  {props.cardMeta.desc !== '' && <div className={`${css.defaultOpeningDesc} ${coverAsset !== undefined ? css.onCover : ''}`}>{props.cardMeta.desc}</div>}
                  {greetings.length > 0 && (
                    <div className={css.greetBlock}>
                      <div className={`${css.greetLabel} ${coverAsset !== undefined ? css.onCover : ''}`}>{t('opening.greetings')}</div>
                      {greetings.map((text, index) => (
                        <button
                          key={`${index}-${text}`}
                          type="button" className={css.greetBtn}
                          onClick={() => { updateDraft(text) }}
                        >{text}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* jscpd:ignore-start -- the transcript head pairs with the writer
          column's by contract: the same four shared pieces with each
          view's own empty-state condition and copy. */}
            {hiddenOlder > 0 && (
              <button type="button" className={css.btn} onClick={() => { setExtraShown(value => value + (windowLast ?? 10)) }}>
                {t('ui.loadOlder')}
              </button>
            )}
            <ChatLines
              lines={visibleLines} t={t}
              tailDetail={childId => tailDetail[childId]} loadTailDetails={loadTailDetails}
              tailRunning={props.tailRunning}
              rich={layout?.html === false ? false : true}
              retryIndex={retryVisibleIndex} onRetry={retry}
            />
            <TranscriptErrorRow
              turnError={turnError} openBroken={openBroken} promptBroken={promptBroken}
              onNeedKey={props.onNeedKey} t={t}
            />
            <TranscriptPulse
              running={running} pending={pending} thinking={thinking} texting={texting}
              empty={lines.length === 0 && opening === undefined && !running && !pending} emptyText={t('view.loading')}
            />
            {/* jscpd:ignore-end */}
          </div>
        </div>
        {panels('right')}
      </div>
      {/* 回到底部灯（着陆合约 2026-09-25）：不跟随且转写有内容时浮现。挂在
          .cardStage（position:absolute 的锚）而非滚动容器里——灯不随内容滚动。 */}
      {!following && lines.length > 0 && (
        <button
          type="button"
          className={css.toTail}
          aria-label={t('chat.toTail')} title={t('chat.toTail')}
          onClick={() => { scroller.follow() }}
        >↓ {t('chat.toTail')}</button>
      )}
      {panels('bottom')}
      {panels('overlay')}
      {/* jscpd:ignore-start -- the composer call sites pair with the writer
      column's on purpose: the props encode each view's own admission and
      stop semantics (engine wrap RPC vs standard session face). */}
      {(() => {
        const composer: ReactNode = (
          <ChatComposer
            directory={props.directory}
            usage={usage} pressure={pressure} breakdown={breakdown} sessionStats={sessionStats}
            draft={draft} onDraft={updateDraft}
            onSend={send} stoppable={running || pending || props.tailRunning} onStop={stop}
            placeholder={t('composer.placeholder')}
            t={t}
          />
        )
        // G3 停靠（2026-09-25）：卡经 face 注册槽 → portal 进卡面板；同一个
        // React 子树换挂载点（草稿/IME/焦点/模型座全保留），回落 = 槽态清空，
        // 不是「还原」——composer 从未离开宿主树，卡对它零写入。
        return dockSlot === null ? composer : createPortal(composer, dockSlot)
      })()}
      {/* jscpd:ignore-end */}
    </div>
  )
}
