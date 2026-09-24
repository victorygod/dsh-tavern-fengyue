/**
 * The tavern conversation view: the full card workspace surface the design
 * describes — the bookshelf library + import entries while the session still
 * lacks a card; the in-place card editor (tree / README / saves / opening
 * preview) once it has one. Content arrives entirely over the Remote face;
 * `ssi` is the session this view instance serves.
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ModelDirectoryResolver } from '@deepseek-ai/dsh-client-ui-model-selection/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { NS } from './locales.ts'
import { parseTavernCard, type ParsedStImport } from './st-import.ts'
import { useDialogs, type DialogFace } from './dialog.tsx'
import type { ConversationFace } from './chat-view.tsx'
import { WriterColumn } from './WriterColumn.tsx'
import type { TavernLibraryWire, TavernRpc, TavernSaveWire } from './rpc.ts'
import css from './TavernView.module.css'

/**
 * Props injected for one session view instance.
 */
export interface TavernViewProps {
  rpc: TavernRpc
  sessionId: string
  t: TranslateNS<typeof NS>
  /** Faces the card-writing column binds through (its own agent session, model directories, occupancy rule). */
  sessions: ISessions
  models: ModelDirectoryResolver | undefined
  conversation: ConversationFace
  /** Key pre-flight for the writer composer — the RP composer's checkKey. */
  checkKey: () => Promise<boolean>
  onNeedKey: () => void
  /** Host notification: the session just gained a card (load / import / draft). */
  onCardReady?: (() => void) | undefined
  /** Library card this workspace EDITS (engine state.editing); `undefined` = fresh draft. */
  editMode?: string | null | undefined
  /**
   * Host notification: the workspace rebound to a fresh session — 载入存档
   * (`load`), 编辑卡「保存并开始」(`edit`), or 重试 (`retry`). `draft` rides a
   * load: the save stamp's composer text to restore into the input box.
   */
  onSessionSwitch?: ((sessionId: string, cause: 'load' | 'edit' | 'retry', draft?: string) => void) | undefined
  /** Initial workspace page — the settings modal opens straight to saves via 加载. */
  initialTab?: WorkspaceTab | undefined
}

/** One imported PNG cover: where it lands (workspace-relative) and its bytes. */
interface ImportCover {
  path: string
  dataBase64: string
}

type Mode =
  | { kind: 'library' }
  | { kind: 'preview'; title: string; files: Record<string, string>; cover?: ImportCover | undefined }
  | { kind: 'draft' }
  | { kind: 'workspace' }

/**
 * The root tavern view component.
 * @param props - rpc face, session id, chat-view switch, locale seat.
 * @returns the workspace view.
 */
export function TavernView(props: TavernViewProps): ReactNode {
  const { rpc, sessionId, t } = props
  // 路由状态 ＋ 它描述的是哪个会话（loadedFor）。渲染中发现 sessionId 变了，当帧
  // 同步落回「未知」——effect 版重置来不及：React effect 先子后父，携带旧态挂载的
  // DraftPanel 会在父重置前按新 sessionId 重跑 draftCard、覆写现成 preset
  // （2026-09-21 串页覆写案）。渲染期 setState 触发同步重渲，加载门在同一帧内
  // 挡住，携带旧态的子树根本不挂载；页面永远严格跟随 sidebar 当前会话的服务器真值
  // （hasCard=游戏中 / .tavern-draft=建卡 / .tavern-editing=编辑存量卡）。
  const [loadedFor, setLoadedFor] = useState(sessionId)
  const [hasCard, setHasCard] = useState<boolean | null>(null)
  const [drafting, setDrafting] = useState(false)
  if (loadedFor !== sessionId) {
    setLoadedFor(sessionId)
    setHasCard(null)
    setDrafting(false)
  }
  const onLoaded = useCallback(() => {
    void rpc.state({ sessionId }).then((value) => {
      setHasCard(value.hasCard)
      setDrafting(value.drafting)
    }, () => { setHasCard(null) })
  }, [rpc, sessionId])
  useEffect(() => { onLoaded() }, [onLoaded])
  if (hasCard === null) return <div className={css.root}><div className={css.empty}>{t('view.loading')}</div></div>
  const start: Mode = hasCard && !drafting ? { kind: 'workspace' } : { kind: 'library' }
  if (drafting) {
    return (
      <TavernWorkspace
        key={sessionId}
        rpc={rpc}
        sessionId={sessionId}
        start={{ kind: 'draft' }}
        onLoaded={onLoaded}
        onCardReady={props.onCardReady}
        editMode={props.editMode}
        onSessionSwitch={props.onSessionSwitch}
        sessions={props.sessions}
        models={props.models}
        conversation={props.conversation}
        checkKey={props.checkKey}
        onNeedKey={props.onNeedKey}
        t={t}
      />
    )
  }
  return (
    <TavernWorkspace
      key={sessionId}
      rpc={rpc}
      sessionId={sessionId}
      start={start}
      onLoaded={onLoaded}
      onCardReady={props.onCardReady}
      initialTab={props.initialTab}
      editMode={props.editMode}
      onSessionSwitch={props.onSessionSwitch}
      sessions={props.sessions}
      models={props.models}
      conversation={props.conversation}
      checkKey={props.checkKey}
      onNeedKey={props.onNeedKey}
      t={t}
    />
  )
}

interface WorkspaceProps extends TavernViewProps {
  start: Mode
  onLoaded: () => void
}

function TavernWorkspace(props: WorkspaceProps): ReactNode {
  const { rpc, sessionId, t, onLoaded } = props
  const [mode, setMode] = useState<Mode>(props.start)
  const [maintenanceOn, setMaintenanceOn] = useState(false)
  const [narratorToolsOn, setNarratorToolsOn] = useState(true)
  const [dialogStarted, setDialogStarted] = useState(false)
  const [editing, setEditing] = useState<string | null>(props.editMode ?? null)
  // 依赖 onLoaded 本体（上游 useCallback 稳定）而非 props 对象——props 每次父渲染
  // 都是新身份，曾把 reloadState 连带 DraftPanel 的 draftCard effect 打成每次渲染
  // 重跑（2026-09-20 建卡清空案）。
  const reloadState = useCallback(() => {
    onLoaded()
    void rpc.state({ sessionId }).then((value) => {
      setMaintenanceOn(value.maintenanceOn)
      setNarratorToolsOn(value.narratorToolsOn)
      setDialogStarted(value.dialogStarted)
      setEditing(value.editing)
    }, () => { setMaintenanceOn(false) })
  }, [onLoaded, rpc, sessionId])
  useEffect(() => { reloadState() }, [reloadState])
  // 编辑卡的放弃/收尾离开路径（返回弹框「不保存」，或「保存」落库后的离开）：
  // cancelEdit 清编辑戳并卸载工作空间里的卡（编辑从不直写卡库，丢的只是
  // 工作空间副本），页面回到卡库书架；刷新后 hasCard=false，路由如实留在
  // 选卡页而非把卡当游戏直开（2026-09-22 用户裁定）。
  const backToLibrary = useCallback(() => {
    void rpc.cancelEdit({ sessionId }).then(() => {
      reloadState()
      setMode({ kind: 'library' })
    }, () => undefined)
  }, [rpc, sessionId, reloadState])
  return (
    <div className={css.root}>
      {mode.kind === 'library' && (
        <LibraryPanel
          rpc={rpc}
          sessionId={sessionId}
          setMode={setMode}
          reloadState={reloadState}
          onCardReady={props.onCardReady ?? (() => undefined)}
          t={t}
        />
      )}
      {mode.kind === 'preview' && <ImportPreviewPanel rpc={rpc} sessionId={sessionId} setMode={setMode} reloadState={reloadState} onCardReady={props.onCardReady ?? (() => undefined)} t={t} title={mode.title} files={mode.files} cover={mode.cover} />}
      {mode.kind === 'draft' && <DraftPanel rpc={rpc} sessionId={sessionId} setMode={setMode} reloadState={reloadState} onCardReady={props.onCardReady ?? (() => undefined)} editMode={props.editMode ?? null} onSessionSwitch={props.onSessionSwitch} sessions={props.sessions} models={props.models} conversation={props.conversation} checkKey={props.checkKey} onNeedKey={props.onNeedKey} t={t} />}
      {mode.kind === 'workspace' && <WorkspacePanel rpc={rpc} sessionId={sessionId} t={t} maintenanceOn={maintenanceOn} narratorToolsOn={narratorToolsOn} dialogStarted={dialogStarted} initialTab={props.initialTab} onSessionSwitch={props.onSessionSwitch} editing={editing} onBackToLibrary={editing !== null ? backToLibrary : undefined} sessions={props.sessions} models={props.models} conversation={props.conversation} checkKey={props.checkKey} onNeedKey={props.onNeedKey} />}
    </div>
  )
}

interface PanelBase {
  rpc: TavernRpc
  sessionId: string
  setMode: (mode: Mode) => void
  reloadState: () => void
  /** The host flips to the chat view once a card actually loads. */
  onCardReady: () => void
  t: TranslateNS<typeof NS>
}

/** The card identity the header edits — the parsed shape of `preset/meta.json`. */
interface IdentityMeta {
  title: string
  desc: string
  cover: string
  /** Author credit, shown as the small extra line; empty when undeclared. */
  creator: string
  /** Card's own version string, shown beside the credit; empty when undeclared. */
  version: string
}

const META_PATH = 'preset/meta.json'
/** Cover uploads are images only; the engine allowlist is broader, the picker is not. */
const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp)$/i

/**
 * Parse `preset/meta.json` text into the editable identity plus the untouched
 * raw record; `null` = unparseable (the header renders read-only). Save-back
 * merges the identity over the raw record, so fields the header does not edit
 * (`tags`, importer extras) survive every identity edit verbatim.
 */
function parseMeta(text: string): { meta: IdentityMeta; raw: Record<string, unknown> } | null {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { return null }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  return {
    raw: record,
    meta: {
      title: typeof record.title === 'string' ? record.title : '',
      desc: typeof record.desc === 'string' ? record.desc : '',
      cover: typeof record.cover === 'string' ? record.cover : '',
      creator: typeof record.creator === 'string' ? record.creator : '',
      version: typeof record.version === 'string' ? record.version : '',
    },
  }
}

/** Serialize the identity back to meta.json text (two-space JSON, one trailing newline). */
function serializeMeta(raw: Record<string, unknown>, meta: IdentityMeta): string {
  return `${JSON.stringify({ ...raw, title: meta.title, desc: meta.desc, cover: meta.cover }, undefined, 2)}\n`
}

/** Read one file as bare base64 (no `data:` URL prefix) for the writeAsset RPC. */
function readFileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') { reject(new Error('asset read produced no data URL')); return }
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => { reject(reader.error ?? new Error('asset read failed')) }
    reader.readAsDataURL(file)
  })
}

/**
 * Identity state for the disk-backed card pages: meta.json load, save-back,
 * and the cover upload (written straight to `preset/assets/<name>` — a
 * same-named file is overwritten — then the meta write). `meta === null`
 * means loading or unparseable — `broken` tells apart.
 */
function useCardIdentity(rpc: TavernRpc, sessionId: string, t: TranslateNS<typeof NS>, dialogs: DialogFace, poll = false, paused?: () => boolean, pollMs = 2000): {
  meta: IdentityMeta | null
  broken: boolean
  coverUrl: string | undefined
  commitMeta: (next: IdentityMeta) => void
  uploadCover: (file: File) => void
} {
  const [meta, setMeta] = useState<IdentityMeta | null>(null)
  const [broken, setBroken] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | undefined>(undefined)
  /** The untouched meta record behind `meta`; save-back merges the identity over it. */
  const rawRef = useRef<Record<string, unknown>>({})
  /** The cover path the current preview was fetched for; the poll refetches on change only. */
  const coverPath = useRef('')
  const reload = useCallback(() => {
    void rpc.readText({ sessionId, path: META_PATH }).then((value) => {
      const parsed = parseMeta(value.text)
      setBroken(parsed === null)
      setMeta(parsed?.meta ?? null)
      rawRef.current = parsed?.raw ?? {}
      coverPath.current = parsed?.meta.cover ?? ''
      if (parsed === null || parsed.meta.cover === '') { setCoverUrl(undefined); return }
      void rpc.readAsset({ sessionId, path: parsed.meta.cover }).then(
        (asset) => { setCoverUrl(asset.dataUrl) },
        () => { setCoverUrl(undefined) },
      )
    }, () => { setMeta(null); setBroken(false) })
  }, [rpc, sessionId])
  useEffect(() => { reload() }, [reload])
  // Writer-driven meta edits reach the header through this poll. While the
  // user edits an identity line, the poll stands down — the pending line's
  // commit writes the whole meta object and must not race the agent.
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  useEffect(() => {
    if (!poll) return
    const timer = window.setInterval(() => {
      if (pausedRef.current?.() === true) return
      void rpc.readText({ sessionId, path: META_PATH }).then((value) => {
        const parsed = parseMeta(value.text)
        setBroken(parsed === null)
        if (parsed === null) { setMeta(null); rawRef.current = {}; coverPath.current = ''; setCoverUrl(undefined); return }
        setMeta((current) => {
          if (current !== null && current.title === parsed.meta.title
            && current.desc === parsed.meta.desc && current.cover === parsed.meta.cover
            && current.creator === parsed.meta.creator && current.version === parsed.meta.version) return current
          return parsed.meta
        })
        rawRef.current = parsed.raw
        const { cover } = parsed.meta
        if (cover === coverPath.current) return
        coverPath.current = cover
        if (cover === '') { setCoverUrl(undefined); return }
        void rpc.readAsset({ sessionId, path: cover }).then(
          (asset) => { setCoverUrl(asset.dataUrl) },
          () => { setCoverUrl(undefined) },
        )
      }, () => undefined)
    }, pollMs)
    return () => { window.clearInterval(timer) }
  }, [poll, pollMs, rpc, sessionId])
  const commitMeta = useCallback((next: IdentityMeta): void => {
    setMeta(next)
    if (next.cover === '') setCoverUrl(undefined)
    void rpc.writeText({ sessionId, path: META_PATH, text: serializeMeta(rawRef.current, next) })
  }, [rpc, sessionId])
  const uploadCover = useCallback((file: File): void => {
    if (meta === null) return
    if (!IMAGE_EXTENSIONS.test(file.name)) {
      void dialogs.alert({ body: t('id.coverBadType'), okLabel: t('dialog.ok') })
      return
    }
    // Size has no client-side pre-check: the engine's editWriteCap is the one
    // authority, and its rejection surfaces here as the alert. A same-named
    // file in `assets/` is overwritten on purpose — a re-uploaded cover
    // replaces the old bytes instead of accumulating numeric-suffix copies
    // (the engine's writeAsset overwrites freely).
    const dot = file.name.lastIndexOf('.')
    const stem = (dot > 0 ? file.name.slice(0, dot) : file.name).replace(/[\\/:*?"<>|]/g, '') || 'cover'
    const ext = dot > 0 ? file.name.slice(dot).toLowerCase() : ''
    const rel = `preset/assets/${stem}${ext}`
    void readFileBase64(file).then((base64) => {
      void rpc.writeAsset({ sessionId, path: rel, dataBase64: base64 }).then(() => {
        commitMeta({ ...meta, cover: rel })
        // The asset is already on disk — fetch its preview immediately
        // instead of waiting for the next meta reload.
        void rpc.readAsset({ sessionId, path: rel }).then(
          (asset) => { setCoverUrl(asset.dataUrl) },
          () => undefined,
        )
      }, (error: unknown) => {
        void dialogs.alert({
          body: t('id.coverUploadFailed').replace('{message}', error instanceof Error ? error.message : String(error)),
          okLabel: t('dialog.ok'),
        })
      })
    }, () => undefined)
  }, [meta, rpc, sessionId, commitMeta, t, dialogs])
  return { meta, broken, coverUrl, commitMeta, uploadCover }
}

/** One identity line: click to edit in place; Enter/blur commits, Esc restores. */
function IdentityLine(props: {
  value: string
  placeholder: string
  className: string | undefined
  inputClassName: string | undefined
  onCommit: (value: string) => void
  /** Editing-state signal — the meta poll stands down while a line is open. */
  onEditingChange?: ((editing: boolean) => void) | undefined
}): ReactNode {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const setEditingState = (value: boolean): void => {
    setEditing(value)
    props.onEditingChange?.(value)
  }
  if (editing) {
    const commit = (): void => {
      setEditingState(false)
      if (draft !== props.value) props.onCommit(draft)
    }
    return (
      <input
        className={props.inputClassName}
        value={draft}
        autoFocus
        spellCheck={false}
        onChange={(event) => { setDraft(event.target.value) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          // 行内编辑优先于全局 Esc 动作：阻断传播，重命名取消不连带关模态/停回合。
          if (event.key === 'Escape') { event.stopPropagation(); setEditingState(false) }
        }}
        onBlur={commit}
        onClick={(event) => { event.stopPropagation() }}
      />
    )
  }
  const empty = props.value === ''
  return (
    <div
      className={`${props.className} ${empty ? css.idPlaceholder : ''}`}
      title={empty ? undefined : props.value}
      onClick={() => { setDraft(props.value); setEditingState(true) }}
    >{empty ? props.placeholder : props.value}</div>
  )
}

/**
 * The card identity header: the library-shelf cover at a fixed smaller size
 * (same ~19:13 ratio) with the title and description inline-editable beside
 * it; the page's action buttons ride the right side. `meta === null` renders
 * the loading state; `broken` pins the header read-only behind a repair note.
 */
function IdentityHeader(props: {
  meta: IdentityMeta | null
  broken: boolean
  coverUrl: string | undefined
  onMeta: (meta: IdentityMeta) => void
  onCoverUpload?: ((file: File) => void) | undefined
  /** Any identity line is open for editing (the meta poll stands down). */
  onEditingChange?: ((editing: boolean) => void) | undefined
  actions?: ReactNode
  t: TranslateNS<typeof NS>
}): ReactNode {
  const { meta, broken, coverUrl, onMeta, onCoverUpload, actions, t } = props
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [editingCount, setEditingCount] = useState(0)
  useEffect(() => { props.onEditingChange?.(editingCount > 0) }, [editingCount, props.onEditingChange])
  const locked = meta === null || broken
  return (
    <div className={css.idHead}>
      <div
        className={css.idCover}
        style={coverUrl !== undefined ? { backgroundImage: `url(${coverUrl})` } : undefined}
        role="button"
        tabIndex={0}
        title={t('id.coverUpload')}
        onClick={() => { if (!locked && onCoverUpload !== undefined) fileInput.current?.click() }}
        onKeyDown={(event) => { if (event.key === 'Enter' && !locked && onCoverUpload !== undefined) fileInput.current?.click() }}
      >
        {coverUrl === undefined && meta !== null && meta.cover === '' ? t('id.coverEmpty') : ''}
        {coverUrl !== undefined && (
          <button
            type="button" className={css.idCoverDel} title={t('id.coverClear')}
            onClick={(event) => {
              event.stopPropagation()
              if (meta !== null) onMeta({ ...meta, cover: '' })
            }}
          >✕</button>
        )}
      </div>
      <div className={css.idMain}>
        {broken ? <div className={css.idBroken}>{t('id.metaBroken')}</div>
          : meta === null ? <div className={css.idLoading}>{t('view.loading')}</div>
            : (
              <>
                <IdentityLine
                  value={meta.title} placeholder={t('id.titlePlaceholder')}
                  className={css.idTitle} inputClassName={css.idInput}
                  onCommit={(value) => { onMeta({ ...meta, title: value }) }}
                  onEditingChange={(editing) => { setEditingCount(count => count + (editing ? 1 : -1)) }}
                />
                <IdentityLine
                  value={meta.desc} placeholder={t('id.descPlaceholder')}
                  className={css.idDesc} inputClassName={css.idInput}
                  onCommit={(value) => { onMeta({ ...meta, desc: value }) }}
                  onEditingChange={(editing) => { setEditingCount(count => count + (editing ? 1 : -1)) }}
                />
                {(meta.creator !== '' || meta.version !== '') && (
                  <div className={css.idExtra}>{[meta.creator, meta.version].filter(part => part !== '').join(' · ')}</div>
                )}
              </>
            )}
      </div>
      {actions !== undefined && <div className={css.idActions}>{actions}</div>}
      {onCoverUpload !== undefined && (
        <input
          ref={fileInput} type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml,image/bmp" hidden
          onChange={() => {
            const input = fileInput.current
            const file = input?.files?.[0]
            if (input !== null) input.value = ''
            if (file !== undefined) onCoverUpload(file)
          }}
        />
      )}
    </div>
  )
}

function LibraryPanel(base: PanelBase): ReactNode {
  const { rpc, sessionId, setMode, reloadState, t } = base
  const dialogs = useDialogs()
  const [cards, setCards] = useState<readonly TavernLibraryWire[]>([])
  const [covers, setCovers] = useState<Record<string, string>>({})
  const jsonInput = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    void rpc.library({ }).then((value) => {
      setCards(value.cards)
      for (const card of value.cards) {
        if (card.cover === '') continue
        void rpc.readLibraryAsset({ name: card.name, path: card.cover }).then((asset) => {
          setCovers(current => ({ ...current, [card.name]: asset.dataUrl }))
        }, () => undefined)
      }
    }, () => { setCards([]) })
  }, [rpc])
  const openPreview = (parsed: ParsedStImport): void => {
    setMode({ kind: 'preview', title: parsed.title, files: parsed.files, cover: parsed.cover })
  }
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingCard, setLoadingCard] = useState<string | null>(null)
  const load = (name: string): void => {
    setLoadError(null); setLoadingCard(name)
    void rpc.importFromLibrary({ sessionId, name }).then(() => {
      setLoadingCard(null)
      reloadState()
      base.onCardReady()
    }, (e) => {
      setLoadingCard(null)
      setLoadError(e instanceof Error ? e.message : String(e))
    })
  }
  const tint = (index: number): string => `tint${index % 4}`
  return (
    <div className={css.stack}>
      <div className={`${css.head} ${css.libraryCol}`}>
        <div>
          <div className={css.title}>{t('library.title')}</div>
          <div className={css.sub}>{t('library.sub')}</div>
        </div>
        <div className={css.spacer}>
          <button type="button" className={css.btn} onClick={() => { setMode({ kind: 'draft' }) }}>{t('entry.draft')}</button>
          <button type="button" className={css.btn} title={t('entry.jsonTitle')} onClick={() => { jsonInput.current?.click() }}>{t('entry.json')}</button>
        </div>
      </div>
      <div className={`${css.panel} ${css.libraryCol}`}>
        {loadingCard && <div className={css.empty}>正在加载「{loadingCard}」…</div>}
        {loadError && <div className={css.empty} style={{ color: 'var(--t-danger, #c43838)' }}>加载失败：{loadError}</div>}
        {cards.length === 0 && !loadingCard && <div className={css.empty}>{t('library.empty')}</div>}
        <div className={css.grid}>
          {cards.map((card, index) => (
            <div
              key={card.name}
              className={css.book}
              role="button"
              tabIndex={0}
              onClick={() => { load(card.name) }}
              onKeyDown={(event) => { if (event.key === 'Enter') load(card.name) }}
            >
              <div className={css.acts}>
                <button
                  type="button" className={`${css.act} ${css.ed}`} title={t('act.edit')}
                  onClick={(event) => {
                    event.stopPropagation()
                    // 编辑卡：加载进工作空间并盖编辑戳——失焦即写回同一张卡。
                    void rpc.editFromLibrary({ sessionId, name: card.name }).then(() => {
                      reloadState()
                      setMode({ kind: 'workspace' })
                    }, () => undefined)
                  }}
                >✎</button>
                <button
                  type="button" className={`${css.act} ${css.del}`} title={t('act.delete')}
                  onClick={(event) => {
                    event.stopPropagation()
                    void dialogs.confirm({
                      body: t('library.confirmDelete', { name: card.name }),
                      confirmLabel: t('save.delete'),
                      cancelLabel: t('app.cancel'),
                      danger: true,
                    }).then((yes) => {
                      if (!yes) return
                      void rpc.deleteCard({ name: card.name }).then(() => {
                        void rpc.library({ }).then((value) => { setCards(value.cards) }, () => undefined)
                      }, () => undefined)
                    })
                  }}
                >✕</button>
              </div>
              <div
                className={`${css.cover} ${css[tint(index)]}`}
                style={covers[card.name] !== undefined ? { backgroundImage: `url(${covers[card.name]})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
              >{covers[card.name] === undefined ? t('library.coverHint', { name: card.name }) : ''}</div>
              <div className={css.body}>
                <div className={css.name}>{card.title}</div>
                <div className={css.desc}>{card.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className={css.note}>{t('library.note')}</div>
      </div>
      <input
        ref={jsonInput} type="file" accept=".png,.json,application/json" hidden
        onChange={() => {
          const input = jsonInput.current
          if (input === null || input.files === null || input.files.length === 0) return
          const file = input.files[0] as File
          void parseTavernCard(file).then((parsed) => {
            input.value = ''
            if (parsed.error !== undefined) {
              void dialogs.alert({ body: parsed.error, okLabel: t('dialog.ok') })
              return
            }
            openPreview(parsed)
          })
        }}
      />
      {dialogs.dialog}
    </div>
  )
}

function ImportPreviewPanel(
  base: PanelBase & { title: string; files: Record<string, string>; cover?: ImportCover | undefined },
): ReactNode {
  const { rpc, sessionId, setMode, reloadState, onCardReady, t, title, files, cover } = base
  const dialogs = useDialogs()
  const [table, setTable] = useState<Record<string, string>>(files)
  // 身份头编辑内存表里的 meta.json（落库前无磁盘工作空间 — 封面上传不适用）。
  // 每次渲染从表内最新文本重 parse：编辑合并读到的 raw record，未知字段保真。
  const previewParsed = parseMeta(table[META_PATH] ?? '')
  const commitPreviewMeta = (next: IdentityMeta): void => {
    setTable({
      ...table,
      [META_PATH]: serializeMeta(previewParsed?.raw ?? {}, next),
    })
  }
  const commit = (): void => {
    void rpc.commitImport({
      sessionId,
      title,
      files: Object.keys(table).map(path => ({ path, content: table[path] ?? '' })),
    }).then(() => {
      // The PNG cover rides outside the text table: meta.json already points
      // at `preset/assets/cover.png`, the bytes land right after commit.
      const putCover = cover === undefined
        ? Promise.resolve()
        : rpc.writeAsset({ sessionId, path: cover.path, dataBase64: cover.dataBase64 }).catch((error: unknown) => {
          void dialogs.alert({
            body: t('preview.coverFailed').replace('{message}', error instanceof Error ? error.message : String(error)),
            okLabel: t('dialog.ok'),
          })
        })
      void putCover.then(() => {
        reloadState()
        onCardReady()
        setMode({ kind: 'workspace' })
      })
    }, () => undefined)
  }
  return (
    <div className={css.stack}>
      <button type="button" className={css.back} onClick={() => { setMode({ kind: 'library' }) }}>← {t('back.library')}</button>
      <IdentityHeader
        meta={previewParsed?.meta ?? null} broken={previewParsed === null} coverUrl={undefined}
        onMeta={commitPreviewMeta} t={t}
      />
      <div className={css.draftEditor}>
        <CardEditor
          rpc={rpc} sessionId={sessionId} t={t}
          table={{ files: table, onChange: setTable }}
          hint={t('preview.hint')}
          actions={[{ label: t('preview.commit'), primary: true, onClick: commit }]}
        />
      </div>
      {dialogs.dialog}
    </div>
  )
}

function DraftPanel(base: PanelBase & {
  // The editing source card (`null` = a from-scratch draft) and the rebind host.
  editMode?: string | null | undefined
  onSessionSwitch?: ((sessionId: string, cause: 'load' | 'edit' | 'retry', draft?: string) => void) | undefined
  sessions: ISessions
  models: ModelDirectoryResolver | undefined
  conversation: ConversationFace
  checkKey: () => Promise<boolean>
  onNeedKey: () => void
}): ReactNode {
  const { rpc, sessionId, setMode, reloadState, onCardReady, t } = base
  const dialogs = useDialogs()
  const editMode = base.editMode ?? null
  const [ready, setReady] = useState(!editMode ? false : true)
  const [published, setPublished] = useState<string | null>(null)
  // 尾代理状态只由 maintenancePrompt 内容决定（空 = 关）；失焦保存后周期刷新 chip。
  const [tailOn, setTailOn] = useState(false)
  // 叙事agent默认工具 checkbox（与工作空间页同旗）：preset 标记缺席 = 开；
  // 随卡携带 —— 保存并开始后新会话里的 checkbox 即建卡时的选择。
  const [narratorToolsOn, setNarratorToolsOn] = useState(true)
  // 写卡列活动信号：驱动编辑器与 meta 轮询的双档节奏（活动 2s / 空闲 8s）。
  const [writerActive, setWriterActive] = useState(true)
  // 写卡列挂载期间轮询 meta（agent 可改 title/desc/cover）；身份行编辑中暂停。
  const identityEditing = useRef(false)
  const identity = useCardIdentity(rpc, sessionId, t, dialogs, true, () => identityEditing.current, writerActive ? 2000 : 8000)
  // 每会话只起草一次：渲染循环（meta 轮询/活动信号）会重入本 effect，重复调用
  // 会把写卡 agent 已写的内容用空骨架覆写（引擎侧 draftCard 现已幂等兜底，
  // 这里不再无谓打 RPC）。失败时复位闩存允许重试。
  const draftedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (editMode !== null) return
    if (draftedForRef.current === sessionId) return
    draftedForRef.current = sessionId
    void rpc.draftCard({ sessionId }).then(() => {
      reloadState()
      setReady(true)
    }, () => { draftedForRef.current = null; setReady(false) })
  }, [rpc, sessionId, reloadState, editMode])
  useEffect(() => {
    if (!ready) return
    const refresh = (): void => {
      void rpc.readText({ sessionId, path: TAIL_PATH }).then((value) => {
        setTailOn(value.text.trim() !== '')
      }, () => { setTailOn(false) })
      // 旗标在卡身份 meta.json 的 narratorTools 字段上（缺席/解析失败 = 开）。
      void rpc.readText({ sessionId, path: META_PATH }).then((value) => {
        try {
          const parsed = JSON.parse(value.text) as { narratorTools?: unknown }
          setNarratorToolsOn(parsed.narratorTools !== false)
        } catch { setNarratorToolsOn(true) }
      }, () => { setNarratorToolsOn(true) })
    }
    refresh()
    const timer = window.setInterval(refresh, 2000)
    return () => { window.clearInterval(timer) }
  }, [ready, rpc, sessionId])
  // 乐观翻转（失败回滚）；写/删走 flipNarratorToolsRpc 的既有端点。
  const flipNarratorTools = (next: boolean): void => {
    setNarratorToolsOn(next)
    void flipNarratorToolsRpc(rpc, sessionId, next).catch((error: unknown) => {
      setNarratorToolsOn(!next)
      console.warn('[tavern] narrator tools toggle failed', error)
    })
  }
  const publish = (): void => {
    void rpc.publishCard({ sessionId }).then((value) => {
      setPublished(value.name)
      reloadState()
      onCardReady()
      const onSwitch = base.onSessionSwitch
      if (editMode === null || onSwitch === undefined) return
      // 编辑模式保存并开始：卡库同卡已更新，开一个用改后卡的新会话继续。
      // 换绑失败必须可见——静默吞错曾让「保存并开始不跳转」成为无对证的复发 bug。
      void rpc.reset({ sessionId }).then((resetValue) => {
        onSwitch(resetValue.sessionId, 'edit')
      }, (error: unknown) => {
        console.warn('[tavern] reset after publish failed', error)
        void dialogs.alert({
          body: `保存并开始：换绑新会话失败\n${error instanceof Error ? error.message : String(error)}`,
          okLabel: t('dialog.ok'),
        })
      })
    }, (error: unknown) => {
      console.warn('[tavern] publishCard failed', error)
      void dialogs.alert({
        body: `保存并开始：入库失败\n${error instanceof Error ? error.message : String(error)}`,
        okLabel: t('dialog.ok'),
      })
    })
  }
  // 返回即放弃：编辑模式恢复原卡内容；新建模式清空建卡内容。
  const backToLibrary = (): void => {
    if (editMode !== null) {
      void rpc.cancelEdit({ sessionId }).then(() => {
        reloadState()
        setMode({ kind: 'library' })
      }, () => undefined)
      return
    }
    void rpc.cancelDraft({ sessionId }).then(() => {
      reloadState()
      setMode({ kind: 'library' })
    }, () => undefined)
  }
  if (!ready) return <div className={css.stack}><div className={css.panel}><div className={css.empty}>{t('view.loading')}</div></div></div>
  return (
    <div className={css.stack}>
      <button type="button" className={css.back} onClick={backToLibrary}>← {t('back.library')}</button>
      <IdentityHeader
        meta={identity.meta} broken={identity.broken} coverUrl={identity.coverUrl}
        onMeta={(next) => { identity.commitMeta(next) }} onCoverUpload={(file) => { identity.uploadCover(file) }}
        onEditingChange={(editing) => { identityEditing.current = editing }}
        actions={
          <>
            {/* 数据维护指示与 narrator 旗标 checkbox 同一竖列；该列与保存类按钮同一排。 */}
            <div className={css.actionCol}>
              <span className={`${css.chip} ${tailOn ? css.on : ''}`}>
                {tailOn ? t('maintenance.on') : t('maintenance.off')}
              </span>
              <label className={css.optRow} title={t('narrator.toolsHint')}>
                <input
                  type="checkbox"
                  checked={narratorToolsOn}
                  onChange={(event) => { flipNarratorTools(event.currentTarget.checked) }}
                />
                {t('narrator.tools')}
              </label>
            </div>
          </>
        }
        t={t}
      />
      {published !== null && <div className={css.note}>{t('draft.published').replace('{name}', published)}</div>}
      <div className={css.draftEditor}>
        <CardEditor
          rpc={rpc} sessionId={sessionId} t={t}
          hint={t('draft.hint')}
          actions={[{ label: t('preview.commit'), primary: true, onClick: publish }]}
          writerActive={writerActive}
          writer={
            <WriterColumn
              rpc={rpc} sessions={base.sessions} models={base.models} conversation={base.conversation}
              sessionId={sessionId} checkKey={base.checkKey} onNeedKey={base.onNeedKey}
              onActiveChange={setWriterActive} t={t}
            />
          }
        />
      </div>
      {dialogs.dialog}
    </div>
  )
}

type WorkspaceTab = 'files' | 'saves'

function WorkspacePanel(props: {
  rpc: TavernRpc
  sessionId: string
  t: TranslateNS<typeof NS>
  maintenanceOn: boolean
  /** The narrator default-tools flag (engine-owned; the checkbox mirrors it
   *  optimistically and reloadState is the correction path). */
  narratorToolsOn: boolean
  /** The conversation already started — greys the narrator checkbox out: the
   *  flag part of the card's identity, editable only before the first turn. */
  dialogStarted: boolean
  /** The modal opens straight into one page: 设置 → files, 加载 → saves. */
  initialTab?: WorkspaceTab | undefined
  onSessionSwitch?: ((sessionId: string, cause: 'load' | 'edit' | 'retry', draft?: string) => void) | undefined
  /** Library card being edited in place (编辑卡); shows the 仅保存/保存并开始 pair. */
  editing?: string | null | undefined
  /** Leave the edit back to the library WITHOUT saving (cancelEdit 恢复原卡). */
  onBackToLibrary?: (() => void) | undefined
  sessions: ISessions
  models: ModelDirectoryResolver | undefined
  conversation: ConversationFace
  checkKey: () => Promise<boolean>
  onNeedKey: () => void
}): ReactNode {
  const { rpc, sessionId, t, maintenanceOn } = props
  const dialogs = useDialogs()
  const tab: WorkspaceTab = props.initialTab ?? 'files'
  const editing = props.editing !== null && props.editing !== undefined
  // 对话已开始 = 旗标锁定（置灰只读）：卡的身份属性在开局前可改、开局后固定。
  const dialogStarted = props.dialogStarted === true
  const [savedName, setSavedName] = useState<string | null>(null)
  const [confirmBack, setConfirmBack] = useState(false)
  // 叙事agent默认工具 checkbox：本地镜像做乐观翻转（失败回滚），权威值随
  // reloadState 的 props 修正，与数据维护 chip 的「引擎为真、视图跟读」同型。
  const [narratorToolsOn, setNarratorToolsOn] = useState(props.narratorToolsOn)
  const { narratorToolsOn: narratorToolsOnProp } = props
  useEffect(() => { setNarratorToolsOn(narratorToolsOnProp) }, [narratorToolsOnProp])
  const flipNarratorTools = (next: boolean): void => {
    setNarratorToolsOn(next)
    void flipNarratorToolsRpc(rpc, sessionId, next).catch((error: unknown) => {
      setNarratorToolsOn(!next)
      console.warn('[tavern] narrator tools toggle failed', error)
    })
  }
  // 写卡列活动信号：驱动编辑器与 meta 轮询的双档节奏（活动 2s / 空闲 8s）。
  const [writerActive, setWriterActive] = useState(true)
  // 写卡列挂载期间轮询 meta；身份行编辑中暂停（同 DraftPanel）。
  const identityEditing = useRef(false)
  const identity = useCardIdentity(rpc, sessionId, t, dialogs, tab === 'files', () => identityEditing.current, writerActive ? 2000 : 8000)
  // 仅保存：当前工作空间内容覆盖卡库那张卡，编辑态保留，可继续改。
  const saveOnly = (): void => {
    void rpc.saveEdit({ sessionId }).then((value) => {
      setSavedName(value.name)
    }, () => undefined)
  }
  // 返回先问引擎有没有未保存改动：干净直接走，脏（或查询失败，宁稳勿丢）弹三选确认框。
  const requestBack = (): void => {
    void rpc.editDirty({ sessionId }).then((value) => {
      if (value.dirty) setConfirmBack(true)
      else props.onBackToLibrary?.()
    }, () => { setConfirmBack(true) })
  }
  return (
    <div className={css.stack}>
      {editing && props.onBackToLibrary !== undefined && (
        <button type="button" className={css.back} onClick={requestBack}>← {t('back.library')}</button>
      )}
      {tab === 'files' ? (
        /* 文件页 = 身份头（封面 + 标题/简介行内编辑）+ 右侧动作区；存档页保持纯标题。 */
        <IdentityHeader
          meta={identity.meta} broken={identity.broken} coverUrl={identity.coverUrl}
          onMeta={(next) => { identity.commitMeta(next) }} onCoverUpload={(file) => { identity.uploadCover(file) }}
          onEditingChange={(editing) => { identityEditing.current = editing }}
          actions={<>
            {editing && (
              <button type="button" className={css.btn} onClick={saveOnly}>{t('edit.saveOnly')}</button>
            )}
            {editing && props.onSessionSwitch !== undefined && (
              // 编辑卡的「保存并开始」：整卡发布进卡库并结束编辑态，再用改后的
              // 卡 reset 出全新会话开聊。任一环失败必须可见——静默吞错曾让本按钮
              // 变成「点了没反应」，且每次复发都查无对证。
              <button
                type="button" className={`${css.btn} ${css.primary}`}
                onClick={() => {
                  void rpc.publishCard({ sessionId }).then(
                    () => rpc.reset({ sessionId }),
                    (error: unknown) => {
                      console.warn('[tavern] publishCard failed', error)
                      void dialogs.alert({
                        body: `保存并开始：入库失败\n${error instanceof Error ? error.message : String(error)}`,
                        okLabel: t('dialog.ok'),
                      })
                      return undefined
                    },
                  ).then((value) => {
                    if (value === undefined) return
                    props.onSessionSwitch?.(value.sessionId, 'edit')
                  }, (error: unknown) => {
                    console.warn('[tavern] reset after publish failed', error)
                    void dialogs.alert({
                      body: `保存并开始：换绑新会话失败\n${error instanceof Error ? error.message : String(error)}`,
                      okLabel: t('dialog.ok'),
                    })
                  })
                }}
              >{t('preview.commit')}</button>
            )}
            {/* 数据维护指示与 narrator 旗标 checkbox 同一竖列；该列与保存类按钮同一排。 */}
            <div className={css.actionCol}>
              <span className={`${css.chip} ${maintenanceOn ? css.on : ''}`}>
                {maintenanceOn ? t('maintenance.on') : t('maintenance.off')}
              </span>
              {/* 对话一旦开始即锁灰：旗标是卡的身份（还没开始对话才可改）。 */}
              <label
                className={dialogStarted ? `${css.optRow} ${css.optRowLocked}` : css.optRow}
                title={t('narrator.toolsHint')}
              >
                <input
                  type="checkbox"
                  checked={narratorToolsOn}
                  disabled={dialogStarted}
                  onChange={(event) => { flipNarratorTools(event.currentTarget.checked) }}
                />
                {t('narrator.tools')}
              </label>
            </div>
          </>}
          t={t}
        />
      ) : (
        <div className={css.head}>
          <div className={css.title}>{t('tab.saves')}</div>
        </div>
      )}
      {savedName !== null && <div className={css.note}>{t('edit.savedNote').replace('{name}', savedName)}</div>}
      {tab === 'files' ? (
        <CardEditor
          rpc={rpc} sessionId={sessionId} t={t}
          /* 编辑卡默认落 preset（作者此时关心的是卡文件）；跑卡会话默认落
             runtime/（setup 已播种时），否则仍回 preset。 */
          initialArea={editing ? 'preset' : 'runtimeAuto'}
          writerActive={writerActive}
          writer={
            <WriterColumn
              rpc={rpc} sessions={props.sessions} models={props.models} conversation={props.conversation}
              sessionId={sessionId} checkKey={props.checkKey} onNeedKey={props.onNeedKey}
              onActiveChange={setWriterActive} t={t}
            />
          }
        />
      ) : <SavesPanel rpc={rpc} sessionId={sessionId} t={t} onSessionSwitch={props.onSessionSwitch} />}
      {confirmBack && (
        <div className={css.confirmScrim} onClick={() => { setConfirmBack(false) }}>
          <div className={css.confirmBox} onClick={(event) => { event.stopPropagation() }}>
            <h3 className={css.confirmTitle}>{t('edit.backTitle')}</h3>
            <p className={css.confirmBody}>{t('edit.backBody')}</p>
            <div className={css.confirmRow}>
              <button type="button" className={css.btn} onClick={() => { setConfirmBack(false) }}>{t('app.cancel')}</button>
              <button type="button" className={css.btn} onClick={() => { setConfirmBack(false); props.onBackToLibrary?.() }}>{t('edit.discard')}</button>
              <button
                type="button" className={`${css.btn} ${css.primary}`}
                onClick={() => {
                  setConfirmBack(false)
                  // 保存 = 用当前工作空间内容更新卡库那张卡，然后返回书架。
                  void rpc.saveEdit({ sessionId }).then(() => {
                    props.onBackToLibrary?.()
                  }, () => undefined)
                }}
              >{t('header.save')}</button>
            </div>
          </div>
        </div>
      )}
      {dialogs.dialog}
    </div>
  )
}

const DEFAULT_FILE = 'preset/prompt/systemPrompt'
const READONLY_PREFIXES = ['savings/']
const TAIL_PATH = 'preset/prompt/maintenancePrompt'

/**
 * Flip the narrator-tools flag where it lives — an explicit `narratorTools`
 * boolean on the CARD's own `preset/meta.json` (visible, hand-editable JSON).
 * Read → tolerant parse → set field → write back through the frozen wire's
 * existing `writeText` (engine re-syncs the tool face on this exact path). No
 * dedicated wire method — the typert manifest is frozen (2026-09-20 devlog).
 * Every preset whole-copy boundary (发布 / 编辑保存 / 导卡) carries meta.json,
 * so the flag follows the card into every new session.
 * @param rpc - the tavern rpc face.
 * @param sessionId - session identity.
 * @param on - whether the narrator keeps its default read pair.
 * @returns the flip's settlement promise.
 */
async function flipNarratorToolsRpc(rpc: TavernRpc, sessionId: string, on: boolean): Promise<unknown> {
  let record: Record<string, unknown> = {}
  try {
    const { text } = await rpc.readText({ sessionId, path: META_PATH })
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) record = parsed as Record<string, unknown>
  } catch {
    // meta.json 缺席或解析失败：从空身份起写（引擎侧状态读取同此容错）。
  }
  record.narratorTools = on
  return rpc.writeText({ sessionId, path: META_PATH, text: `${JSON.stringify(record, undefined, 2)}\n` })
}
const ASSET_EXTENSIONS = /\.(png|jpe?g|gif|webp|svg|bmp|mp3|wav|ogg|m4a|mp4|webm|mov)$/i
/** Editor poll cadence: fast while the writer session is active, slow once idle. */
const WRITER_POLL_ACTIVE_MS = 2000
const WRITER_POLL_IDLE_MS = 8000
/** Template-mandated paths (mirrors the engine's workspace.ts FIXED_PATHS):
 *  each may be empty but must exist; the menu offers no rename/delete on one.
 *  `preset/prompt/prefixPrompt` is deliberately absent — retired from the
 *  template; existing card files may be deleted or renamed freely. */
const FIXED_PATHS: ReadonlySet<string> = new Set([
  'preset/', 'preset/prompt/', 'preset/scripts/', 'preset/tools/', 'preset/meta.json',
  'preset/prompt/systemPrompt', 'preset/prompt/postPrompt', 'preset/prompt/maintenancePrompt',
  'runtime/', 'savings/',
])

/** One editor toolbar action button. */
export interface EditorAction {
  label: string
  primary?: boolean
  onClick: () => void
}

/**
 * The prototype's unified editor: hint-topped VS Code-pure tree (chevron +
 * name rows, no inline badges, full-row active background) and a path/badge
 * header over a mono textarea or media preview. `table` swaps the workspace
 * RPC backing for an in-memory parsed-file map (the import-edit page edits
 * before anything lands on disk); `controls`/`actions` render the toolbar on
 * authoring pages (the settings-modal workspace renders none). Operations run
 * through the right-click menu; file drags onto directories move with a
 * confirmation.
 */
/** 三分栏默认宽：≈ 240px 树 / 340px 写卡列在常见窗口宽下的百分比。 */
const EDITOR_SPLIT_DEFAULT = { tree: 17, writer: 24 }
const EDITOR_SPLIT_KEY = 'tavern.editorSplits'
const clampSplit = (pct: number): number => Math.min(50, Math.max(8, Math.round(pct * 10) / 10))
/** 读持久化的分栏宽（越界/坏值回默认）。 */
function readEditorSplits(): { tree: number; writer: number } {
  try {
    const raw = JSON.parse(localStorage.getItem(EDITOR_SPLIT_KEY) ?? '') as { tree?: unknown; writer?: unknown }
    const tree = Number(raw.tree); const writer = Number(raw.writer)
    if (Number.isFinite(tree) && Number.isFinite(writer)) return { tree: clampSplit(tree), writer: clampSplit(writer) }
  } catch { /* 缺省/坏 JSON → 默认 */ }
  return { ...EDITOR_SPLIT_DEFAULT }
}
function writeEditorSplits(splits: { tree: number; writer: number }): void {
  try { localStorage.setItem(EDITOR_SPLIT_KEY, JSON.stringify(splits)) } catch { /* storage unavailable — 拖宽不跨刷新而已 */ }
}

/** 三分栏竖向拖拽条：按住横向拖动调邻列宽（pointer capture 自持事件），双击复位。 */
function VSplitter(props: { onMove: (clientX: number) => void; onReset: () => void }): ReactNode {
  const [dragging, setDragging] = useState(false)
  return (
    <div
      className={`${css.splitV} ${dragging ? css.splitOn : ''}`}
      title="拖拽调列宽 · 双击复位"
      onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDragging(true) }}
      onPointerMove={(event) => { if (dragging) props.onMove(event.clientX) }}
      onPointerUp={() => { setDragging(false) }}
      onDoubleClick={props.onReset}
    />
  )
}

function CardEditor(props: {
  rpc: TavernRpc
  sessionId: string
  t: TranslateNS<typeof NS>
  table?: { files: Record<string, string>; onChange(files: Record<string, string>): void } | undefined
  hint?: string | undefined
  actions?: readonly EditorAction[] | undefined
  /** The card-writing column rendered beside the editor (never on the in-memory preview). */
  writer?: ReactNode | undefined
  /** Live signal from the writer column: a turn/stream is in flight. `undefined` = treat as active. */
  writerActive?: boolean | undefined
  /**
   * Initial area the tree lands on (`'preset'` = the authoring default —
   * 编辑卡/建卡/导入预览; `'runtimeAuto'` = show runtime/ once setup seeded
   * it, else fall back to preset). Decided once, from the first tree load.
   */
  initialArea?: 'preset' | 'runtimeAuto' | undefined
}): ReactNode {
  const { rpc, sessionId, t, table, hint, actions } = props
  const dialogs = useDialogs()
  // 懒加载双模：'lazy' = fs_tree.mjs 卡脚本按目录一层层取（真·点开才取，
  // 轮询 levels 批量刷根层+展开层）；'full' = 脚本缺席的回退——整树 RPC 全量
  // 预取，仅渲染层折叠。null = 挂载探测中。listings 按父目录分片缓存
  // （'' = 根层；full 模式整树存于 ''）。
  const [mode, setMode] = useState<'lazy' | 'full' | null>(null)
  const modeRef = useRef<'lazy' | 'full' | null>(null)
  const [listings, setListings] = useState<Record<string, readonly { path: string; dir: boolean }[]>>({})
  const listingsRef = useRef<Record<string, readonly { path: string; dir: boolean }[]>>({})
  const [loadedDirs, setLoadedDirs] = useState<ReadonlySet<string>>(new Set())
  const loadedDirsRef = useRef<ReadonlySet<string>>(new Set())
  const [openDirs, setOpenDirs] = useState<ReadonlySet<string>>(new Set())
  const openDirsRef = useRef<ReadonlySet<string>>(new Set())
  const [selected, setSelected] = useState<string>(DEFAULT_FILE)
  const [text, setText] = useState('')
  const [asset, setAsset] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; path: string; dir: boolean } | undefined>(undefined)
  // VS Code 式行内命名：新建即创建（默认名）并进入命名态；重命名原地编辑。失焦/Enter 提交，Esc 还原。
  const [editing, setEditing] = useState<{ path: string; initial: string } | undefined>(undefined)
  const [editDraft, setEditDraft] = useState('')
  /** The textarea holds focus — the writer poll must not clobber in-progress typing. */
  const textareaFocused = useRef(false)
  /** The initial-area landing applies exactly once, from the first listing load. */
  const landed = useRef(false)
  // 三分栏拖宽：树列/写卡列宽度（editorLayout 总宽的百分比），localStorage 记忆；
  // 中间编辑列 flex:1 吃剩余。拖拽条双击复位默认（≈ 240px 树 / 340px 写卡的百分比化）。
  const layoutRef = useRef<HTMLDivElement | null>(null)
  const [splits, setSplits] = useState<{ tree: number; writer: number }>(readEditorSplits)
  useEffect(() => { writeEditorSplits(splits) }, [splits])
  const moveTreeSplit = (clientX: number): void => {
    const rect = layoutRef.current?.getBoundingClientRect()
    if (rect === null || rect === undefined || rect.width < 200) return
    const pct = Math.min(34, Math.max(12, ((clientX - rect.left) / rect.width) * 100))
    setSplits(s => ({ ...s, tree: pct }))
  }
  const moveWriterSplit = (clientX: number): void => {
    const rect = layoutRef.current?.getBoundingClientRect()
    if (rect === null || rect === undefined || rect.width < 200) return
    const pct = Math.min(44, Math.max(16, ((rect.right - clientX) / rect.width) * 100))
    setSplits(s => ({ ...s, writer: pct }))
  }

  const paths: readonly string[] = table !== undefined
    ? Object.keys(table.files).sort()
    : Object.values(listings).flat().map(entry => entry.path)
  // 顶层三目录的简介：放在目录行名旁作淡色小字（超长截断），而非集中堆在树顶。
  const dirHint = (path: string): string | null =>
    path === 'preset/' ? t('files.hintPreset')
      : path === 'runtime/' ? t('files.hintRuntime')
        : path === 'savings/' ? t('files.hintSavings')
          : null

  const read = useCallback((path: string): void => {
    setSelected(path)
    setText('')
    setAsset(null)
    if (table !== undefined) { setText(table.files[path] ?? ''); return }
    if (ASSET_EXTENSIONS.test(path)) {
      void rpc.readAsset({ sessionId, path }).then((value) => { setAsset(value.dataUrl) }, () => { setAsset(null) })
      return
    }
    void rpc.readText({ sessionId, path }).then((value) => { setText(value.text) }, () => { setText('') })
  }, [rpc, sessionId, table])
  useEffect(() => { read(DEFAULT_FILE) }, [read])

  /** State + ref in one step — the async sequences below read the refs synchronously. */
  const applyOpenDirs = useCallback((next: ReadonlySet<string>): void => {
    openDirsRef.current = next
    setOpenDirs(next)
  }, [])

  /** Merge fetched listings into the cache (ref + state), marking their dirs loaded. */
  const applyListings = useCallback((rows: Record<string, readonly { path: string; dir: boolean }[]>): void => {
    const next = { ...listingsRef.current, ...rows }
    listingsRef.current = next
    setListings(next)
    const loaded = new Set(loadedDirsRef.current)
    for (const key of Object.keys(rows)) loaded.add(key)
    loadedDirsRef.current = loaded
    setLoadedDirs(loaded)
  }, [])

  /** Drop cached rows/listings under a removed-or-moved path (lazy-mode cache hygiene). */
  const parentOf = (path: string): string => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  const pruneSubtree = (dir: string): void => {
    if (modeRef.current !== 'lazy') return
    const nextListings: Record<string, readonly { path: string; dir: boolean }[]> = {}
    for (const [key, rows] of Object.entries(listingsRef.current)) {
      if (key === dir || key.startsWith(dir)) continue
      nextListings[key] = rows.filter(row => row.path !== dir && !row.path.startsWith(dir))
    }
    listingsRef.current = nextListings
    setListings(nextListings)
    const drop = (keys: ReadonlySet<string>): ReadonlySet<string> =>
      new Set([...keys].filter(key => !(key === dir || key.startsWith(dir))))
    loadedDirsRef.current = drop(loadedDirsRef.current)
    setLoadedDirs(loadedDirsRef.current)
  }

  /** One fs_tree.mjs round-trip: `list` for a single dir, `levels` for a batch. `null` = script unavailable. */
  const runFsList = useCallback(async (dirs: readonly string[]): Promise<Record<string, readonly { path: string; dir: boolean }[]> | null> => {
    try {
      const payload = dirs.length === 1 ? { op: 'list', path: dirs[0] } : { op: 'levels', paths: dirs }
      const value = await rpc.runScript({ sessionId, name: 'fs_tree.mjs', args: [JSON.stringify(payload)] })
      const parsed = JSON.parse(value.text) as { ok?: boolean; entries?: { path: string; dir: boolean }[]; levels?: Record<string, { path: string; dir: boolean }[]> }
      if (parsed?.ok !== true) return null
      if (dirs.length === 1) return parsed.entries === undefined ? null : { [dirs[0]!]: parsed.entries }
      return parsed.levels ?? null
    } catch {
      return null
    }
  }, [rpc, sessionId])

  /** Fetch one directory level in lazy mode (no-op when the script already fell back). */
  const fetchDirs = useCallback((dirs: readonly string[]): Promise<void> => new Promise((resolve) => {
    if (modeRef.current !== 'lazy' || dirs.length === 0) { resolve(); return }
    void runFsList(dirs).then((rows) => {
      if (rows !== null) applyListings(rows)
      resolve()
    })
  }), [applyListings, runFsList])

  /** Full-tree load (the fallback mode's only structure source), stored under the root key. */
  const loadFull = useCallback((): Promise<void> => new Promise((resolve) => {
    void rpc.tree({ sessionId }).then((value) => {
      applyListings({ '': value.entries })
      resolve()
    }, () => resolve())
  }), [applyListings, rpc, sessionId])

  /** Refresh structure after a file op: lazy re-lists the affected dirs, full reloads the tree. */
  const refreshStructure = useCallback((affected: readonly string[]): void => {
    if (modeRef.current === 'lazy') void fetchDirs(['', ...affected])
    else void loadFull()
  }, [fetchDirs, loadFull])

  /**
   * 初始落点（只决定一次）：
   * - runtimeAuto（跑卡会话）：runtime/ 已播种（有文件）就把其余默认层全部
   *   折叠、只展开 runtime/ 链并选中首选文件（state.md 优先，否则字典序第一
   *   个）；runtime/ 空着就默认展开 preset，待 setup 播种后的轮询再落。
   * - preset（编辑卡/建卡/导入预览）：默认展开 preset。
   * 玩家一旦点过树行（landed 置位），自动落点不再打扰。
   */
  const tryLand = useCallback((): void => {
    if (landed.current || modeRef.current === null) return
    const landPreset = (): void => {
      if (openDirsRef.current.size === 0) {
        applyOpenDirs(new Set(['preset/', 'preset/prompt/']))
        // 懒加载同刻拉取预展开层的 listing（对齐 runtimeAuto 分支的收尾）：只置
        // openDirs 不取数，walk 的 loadedDirs 门把这些行渲染成「开着却无孩子」的
        // 空壳，第一下点击被当成收起吞掉，第二下才真展开（2026-09-22 建卡页案）。
        if (modeRef.current === 'lazy') void fetchDirs(['preset/', 'preset/prompt/'])
      }
    }
    if (props.initialArea !== 'runtimeAuto' || table !== undefined) {
      landed.current = true
      landPreset()
      return
    }
    const source = modeRef.current === 'lazy'
      ? listingsRef.current['runtime/']
      : listingsRef.current['']?.filter(entry => entry.path.startsWith('runtime/'))
    const files = (source ?? []).filter(entry => !entry.dir)
    if (files.length === 0) { landPreset(); return }
    landed.current = true
    const preferred = files.find(file => file.path === 'runtime/state.md') ?? files[0]!
    // 替换式设置：其余默认层折叠，只留 runtime 链（用户定案）。
    const dirs = new Set<string>()
    let acc = ''
    for (const segment of preferred.path.split('/').filter(Boolean).slice(0, -1)) {
      acc += `${segment}/`
      dirs.add(acc)
    }
    applyOpenDirs(dirs)
    if (modeRef.current === 'lazy') void fetchDirs([...dirs])
    read(preferred.path)
  }, [applyOpenDirs, fetchDirs, props.initialArea, read, table])

  // 挂载：探测 fs_tree.mjs（可用 = lazy；缺席 = full 回退），随后落默认展开层。
  useEffect(() => {
    if (table !== undefined) {
      // 内存表（导入预览）：全部条目都在表里，无懒加载，直接落 preset。
      landed.current = true
      modeRef.current = 'full'
      setMode('full')
      applyOpenDirs(new Set(['preset/', 'preset/prompt/']))
      return
    }
    let disposed = false
    void (async (): Promise<void> => {
      const root = await runFsList([''])
      if (disposed) return
      if (root !== null) {
        applyListings(root)
        modeRef.current = 'lazy'
        setMode('lazy')
        if (props.initialArea === 'runtimeAuto') await fetchDirs(['runtime/'])
        if (disposed) return
      } else {
        modeRef.current = 'full'
        setMode('full')
        await loadFull()
        if (disposed) return
      }
      tryLand()
    })()
    return () => { disposed = true }
  }, [applyListings, applyOpenDirs, fetchDirs, loadFull, props.initialArea, runFsList, table, tryLand])

  // Writer-driven file edits reach the editor through this poll — the agent
  // and the tail write files server-side with no push channel, so polling is
  // how their changes surface here. lazy = ONE fs_tree levels call covering
  // the root level plus the open directories (collapsed levels revalidate at
  // the moment they expand); full = one tree RPC. Cadence: 2s while the writer
  // session is active, 8s once idle and the landing has settled.
  useEffect(() => {
    if (props.writer === undefined) return
    const tick = (): void => {
      void (async (): Promise<void> => {
        if (modeRef.current === 'lazy') {
          await fetchDirs(['', ...openDirsRef.current])
        } else {
          await loadFull()
        }
        tryLand()
        if (textareaFocused.current || table !== undefined || ASSET_EXTENSIONS.test(selected)) return
        void rpc.readText({ sessionId, path: selected }).then((value) => {
          setText(current => current === value.text ? current : value.text)
        }, () => undefined)
      })()
    }
    const idle = props.writerActive === false && landed.current
    const timer = window.setInterval(tick, idle ? WRITER_POLL_IDLE_MS : WRITER_POLL_ACTIVE_MS)
    return () => { window.clearInterval(timer) }
  }, [props.writer, props.writerActive, fetchDirs, loadFull, rpc, sessionId, selected, table, tryLand])

  const write = (path: string, content: string): void => {
    if (table !== undefined) {
      table.onChange({ ...table.files, [path]: content })
      return
    }
    void rpc.writeText({ sessionId, path, text: content })
  }
  const editableOf = (path: string): boolean =>
    table === undefined ? !READONLY_PREFIXES.some(area => path.startsWith(area)) : true
  const save = (): void => {
    if (!editableOf(selected) || ASSET_EXTENSIONS.test(selected)) return
    write(selected, text)
  }
  // 新建默认名对既有条目去重：untitled.md 已占用则递增 untitled-1.md、untitled-2.md……
  const uniqueDefault = (dir: string, kind: 'create' | 'mkdir'): string => {
    const taken = new Set(paths)
    const base = kind === 'mkdir' ? 'untitled/' : 'untitled.md'
    if (!taken.has(`${dir}${base}`)) return base
    for (let index = 1; index < 1000; index++) {
      const candidate = kind === 'mkdir' ? `untitled-${index}/` : `untitled-${index}.md`
      if (!taken.has(`${dir}${candidate}`)) return candidate
    }
    return base
  }
  const beginCreate = (dir: string, kind: 'create' | 'mkdir'): void => {
    const defaultName = uniqueDefault(dir, kind)
    const path = `${dir}${defaultName}`
    if (table !== undefined) {
      table.onChange({ ...table.files, [path]: '' })
      applyOpenDirs(new Set(openDirsRef.current).add(dir))
      setEditing({ path, initial: defaultName })
      setEditDraft(defaultName)
      return
    }
    void rpc.fileOp({ sessionId, op: { kind, path } }).then(() => {
      refreshStructure([dir])
      applyOpenDirs(new Set(openDirsRef.current).add(dir))
      setEditing({ path, initial: defaultName })
      setEditDraft(defaultName)
    }, () => undefined)
  }
  const beginRename = (path: string): void => {
    setEditing({ path, initial: path.split('/').filter(Boolean).at(-1) ?? path })
    setEditDraft(path.split('/').filter(Boolean).at(-1) ?? path)
  }
  const commitEdit = (): void => {
    const edit = editing
    if (edit === undefined) return
    setEditing(undefined)
    const nextName = editDraft.trim()
    if (nextName === '' || nextName === edit.initial) return
    // Directory paths carry a trailing slash — strip it before taking the
    // parent, or the "parent" becomes the directory itself and the rename
    // turns into a move into its own subtree.
    const body = edit.path.endsWith('/') ? edit.path.slice(0, -1) : edit.path
    const parent = body.includes('/') ? body.slice(0, body.lastIndexOf('/') + 1) : ''
    const target = `${parent}${nextName}${edit.path.endsWith('/') ? '/' : ''}`
    if (table !== undefined) {
      const nextFiles: Record<string, string> = {}
      for (const [key, value] of Object.entries(table.files)) nextFiles[key === edit.path ? target : key.replace(edit.path, target)] = value
      table.onChange(nextFiles)
      return
    }
    void rpc.fileOp({ sessionId, op: { kind: 'move', from: edit.path, to: target } }).then(() => {
      // 旧名字的子树缓存作废（移动目录时整棵子树换了家）；新旧父目录各刷一层。
      pruneSubtree(edit.path)
      const parents = new Set<string>(['', parentOf(edit.path), parentOf(target)])
      refreshStructure([...parents])
      if (selected === edit.path) read(target)
    }, () => undefined)
  }
  const remove = (path: string): void => {
    void dialogs.confirm({
      body: t('files.confirmDelete', { path }),
      confirmLabel: t('save.delete'),
      cancelLabel: t('app.cancel'),
      danger: true,
    }).then((yes) => {
      if (!yes) return
      if (table !== undefined) {
        const nextFiles: Record<string, string> = {}
        for (const [key, value] of Object.entries(table.files)) if (key !== path && !key.startsWith(path)) nextFiles[key] = value
        table.onChange(nextFiles)
        return
      }
      void rpc.fileOp({ sessionId, op: { kind: 'delete', path } }).then(() => {
        pruneSubtree(path)
        refreshStructure([parentOf(path)])
        if (selected === path) read(DEFAULT_FILE)
      }, () => undefined)
    })
  }
  const moveTo = (from: string, dir: string): void => {
    if (table !== undefined) {
      const name = from.split('/').filter(Boolean).at(-1) ?? from
      const target = `${dir}${name}`
      void dialogs.confirm({
        body: t('files.moveConfirm', { from, to: target }),
        confirmLabel: t('dialog.move'),
        cancelLabel: t('app.cancel'),
      }).then((yes) => {
        if (!yes) return
        const nextFiles: Record<string, string> = {}
        for (const [key, value] of Object.entries(table.files)) nextFiles[key === from ? target : key] = value
        table.onChange(nextFiles)
      })
      return
    }
    const target = `${dir}${from.split('/').filter(Boolean).at(-1) ?? from}`
    void dialogs.confirm({
      body: t('files.moveConfirm', { from, to: target }),
      confirmLabel: t('dialog.move'),
      cancelLabel: t('app.cancel'),
    }).then((yes) => {
      if (!yes) return
      void rpc.fileOp({ sessionId, op: { kind: 'move', from, to: target } }).then(() => {
        pruneSubtree(from)
        const parents = new Set<string>(['', parentOf(from), parentOf(target)])
        refreshStructure([...parents])
      }, () => undefined)
    })
  }

  // Visible tree: build the hierarchy from the flat path list, then flatten
  // depth-first — directories before files, siblings by name, children only
  // under expanded directories (a flat lexical sort interleaves parents and
  // children at wrong positions).
  interface TreeNode { name: string; path: string; dir: boolean; children: TreeNode[] }
  const roots: TreeNode[] = []
  const byPath = new Map<string, TreeNode>()
  for (const path of paths) {
    const pathDir = path.endsWith('/') || paths.some(other => other.startsWith(path) && other !== path)
    const segments = path.split('/').filter(Boolean)
    let siblings = roots
    let prefix = ''
    for (let index = 0; index < segments.length; index++) {
      const last = index === segments.length - 1
      const nodePath = last && !pathDir ? `${prefix}${segments[index]}` : `${prefix}${segments[index]}/`
      const node: TreeNode = byPath.get(nodePath) ?? {
        name: segments[index] as string,
        path: nodePath,
        dir: !last || pathDir,
        children: [],
      }
      if (byPath.get(nodePath) === undefined) {
        byPath.set(nodePath, node)
        siblings.push(node)
      }
      siblings = node.children
      prefix = nodePath.endsWith('/') ? nodePath : `${nodePath}/`
    }
  }
  const visible: { path: string; dir: boolean; depth: number }[] = []
  const walk = (nodes: TreeNode[], depth: number): void => {
    const sorted = [...nodes].sort((left, right) => left.dir === right.dir ? left.name.localeCompare(right.name) : left.dir ? -1 : 1)
    for (const node of sorted) {
      visible.push({ path: node.path, dir: node.dir, depth })
      if (node.dir && openDirs.has(node.path) && (mode !== 'lazy' || loadedDirs.has(node.path))) walk(node.children, depth + 1)
    }
  }
  walk(roots, 0)
  const toggleDir = (path: string): void => {
    // 懒加载未取层的目录没有可见孩子可折叠：点击一律=打开＋拉取。tryLand 预展开
    // 过、取数尚在途的空壳行也归此路——否则第一下被当「收起」吞掉，第二下才展开。
    if (modeRef.current === 'lazy' && !loadedDirsRef.current.has(path)) {
      applyOpenDirs(new Set(openDirsRef.current).add(path))
      void fetchDirs([path])
      return
    }
    // full 模式（或已取层）的真开合。同一个 applyOpenDirs 口：轮询按 openDirsRef
    // 刷重验层，绕过 ref 的直改会让手动开合的目录漏出轮询集合。
    const next = new Set(openDirsRef.current)
    if (next.has(path)) next.delete(path)
    else next.add(path)
    applyOpenDirs(next)
  }

  return (
    <div className={css.panel} onClick={() => { setMenu(undefined) }}>
      {actions !== undefined && actions.length > 0 ? (
        <div className={css.toolbar}>
          <span className={css.toolbarSpacer} />
          {actions.map(action => (
            <button
              key={action.label} type="button"
              className={`${css.btn} ${action.primary === true ? css.primaryBtn : ''}`}
              onClick={action.onClick}
            >{action.label}</button>
          ))}
        </div>
      ) : null}
      <div className={css.editorLayout} ref={layoutRef}>
        <div className={css.fileTree} style={{ width: `${splits.tree}%` }}>
          {hint !== undefined && <div className={css.treeHint}>{hint}</div>}
          <div className={css.treeList}>
            {visible.map((row) => {
              const readonly = table === undefined && READONLY_PREFIXES.some(area => row.path.startsWith(area))
              const label = row.path.split('/').filter(Boolean).at(-1) ?? row.path
              return (
                <div
                  key={row.path}
                  className={[
                    css.node,
                    row.dir ? css.dir : css.fileNode,
                    !row.dir && row.path === selected ? css.active : '',
                    row.dir && openDirs.has(row.path) ? css.open : '',
                  ].filter(Boolean).join(' ')}
                  style={{ paddingLeft: 8 + row.depth * 14 }}
                  onClick={() => { landed.current = true; if (row.dir) toggleDir(row.path); else read(row.path) }}
                  onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    // A fixed file has no operable rows — no menu at all.
                    if (!row.dir && FIXED_PATHS.has(row.path)) return
                    setMenu({ x: event.clientX, y: event.clientY, path: row.path, dir: row.dir })
                  }}
                  draggable={!readonly && !row.dir}
                  onDragOver={(event) => { if (row.dir) event.preventDefault() }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const from = event.dataTransfer.getData('text/tavern-file')
                    if (from !== '' && from !== row.path) moveTo(from, row.path)
                  }}
                >
                  <span className={css.chev}>{row.dir ? '▸' : ''}</span>
                  {editing !== undefined && editing.path === row.path ? (
                    <input
                      className={css.nameInput}
                      value={editDraft}
                      autoFocus
                      onChange={(event) => { setEditDraft(event.target.value) }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') commitEdit()
                        // 同上：行内编辑的 Esc 阻断传播，不触发全局动作。
                        if (event.key === 'Escape') { event.stopPropagation(); setEditDraft(editing.initial); setEditing(undefined) }
                      }}
                      onBlur={() => { commitEdit() }}
                      onClick={(event) => { event.stopPropagation() }}
                      spellCheck={false}
                    />
                  ) : (
                    <>
                      <span className={css.nm}>{label}</span>
                      {row.dir && dirHint(row.path) !== null && <span className={css.nodeDesc}>{dirHint(row.path)}</span>}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
        <VSplitter onMove={moveTreeSplit} onReset={() => { setSplits(s => ({ ...s, tree: EDITOR_SPLIT_DEFAULT.tree })) }} />
        <div className={css.fileEditor}>
          <div className={css.editorHeader}>
            <span className={css.editorPath}>{selected}</span>
            <span className={`${css.editorBadge} ${editableOf(selected) ? css.badgeEditable : css.badgeRo}`}>
              {ASSET_EXTENSIONS.test(selected) ? t('files.asset') : editableOf(selected) ? t('files.editable') : t('files.readonly')}
            </span>
          </div>
          <div className={css.editorBody}>
            {ASSET_EXTENSIONS.test(selected) && asset !== null
              ? <img className={css.assetPreview} src={asset} alt={selected} />
              : (
                <textarea
                  className={css.editorArea}
                  value={text}
                  readOnly={!editableOf(selected)}
                  onChange={(event) => { setText(event.target.value) }}
                  onFocus={() => { textareaFocused.current = true }}
                  onBlur={() => { textareaFocused.current = false; save() }}
                  spellCheck={false}
                />
              )}
          </div>
        </div>
        {props.writer !== undefined && (
          <>
            <VSplitter onMove={moveWriterSplit} onReset={() => { setSplits(s => ({ ...s, writer: EDITOR_SPLIT_DEFAULT.writer })) }} />
            <div className={css.writerDock} style={{ width: `${splits.writer}%` }}>{props.writer}</div>
          </>
        )}
      </div>
      {menu !== undefined && (
        <div
          className={css.menuScrim}
          onClick={() => { setMenu(undefined) }}
          onContextMenu={(event) => { event.preventDefault(); setMenu(undefined) }}
        >
          <div className={css.menu} style={{ left: menu.x, top: menu.y }} onClick={(event) => { event.stopPropagation() }}>
            {menu.dir && (
              <>
                <button type="button" className={css.menuItem} onClick={() => { beginCreate(menu.path, 'create'); setMenu(undefined) }}>{t('files.menuNewFile')}</button>
                <button type="button" className={css.menuItem} onClick={() => { beginCreate(menu.path, 'mkdir'); setMenu(undefined) }}>{t('files.menuNewDir')}</button>
              </>
            )}
            {FIXED_PATHS.has(menu.path) ? null : (
              <>
                <button type="button" className={css.menuItem} onClick={() => { beginRename(menu.path); setMenu(undefined) }}>{t('ctx.rename')}</button>
                <button type="button" className={`${css.menuItem} ${css.menuDanger}`} onClick={() => { remove(menu.path); setMenu(undefined) }}>{t('ctx.delete')}</button>
              </>
            )}
          </div>
        </div>
      )}
      {dialogs.dialog}
    </div>
  )
}

function SavesPanel(props: {
  rpc: TavernRpc
  sessionId: string
  t: TranslateNS<typeof NS>
  onSessionSwitch?: ((sessionId: string, cause: 'load' | 'edit' | 'retry', draft?: string) => void) | undefined
}): ReactNode {
  const { rpc, sessionId, t } = props
  const dialogs = useDialogs()
  const [saves, setSaves] = useState<readonly TavernSaveWire[]>([])
  // 载入的失败面(2026-09-24):此前拒绝分支是 `() => undefined`——任何失败
  // (引擎换绑中抛错、会话解绑后重试)都被吞成「静默卡死」。现在失败显式上屏:
  // 行内错误行 + console 留痕,载入中禁用按钮(防拿已换绑的旧 id 连点)。
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingSave, setLoadingSave] = useState<string | null>(null)
  const reload = useCallback(() => {
    void rpc.saves({ sessionId }).then((value) => { setSaves(value.saves) }, () => { setSaves([]) })
  }, [rpc, sessionId])
  useEffect(() => { reload() }, [reload])
  const loadSave = useCallback((name: string): void => {
    if (loadingSave !== null) return
    setLoadingSave(name)
    setLoadError(null)
    void rpc.load({ sessionId, name }).then((value) => {
      props.onSessionSwitch?.(value.sessionId, 'load', value.draft)
      reload()
    }, (error: unknown) => {
      console.warn('[tavern] rpc failed', error)
      setLoadError(error instanceof Error ? error.message : String(error))
    }).finally(() => { setLoadingSave(null) })
  }, [loadingSave, props.onSessionSwitch, reload, rpc, sessionId])
  return (
    <div className={css.panel}>
      <div className={css.saves}>
        {loadError !== null && <div className={css.loadError}>{t('header.loadFailed')}：{loadError}</div>}
        {saves.length === 0 && <div className={css.empty}>{t('saves.empty')}</div>}
        {saves.map(save => (
          <div key={save.name} className={css.save}>
            <div className={css.info}>
              <div className={css.n}>{save.name}</div>
              <div className={css.m}>{save.type === 'auto' ? t('save.auto') : t('save.manual')}</div>
              {save.summary !== '' && <div className={css.s} title={save.summary}>{save.summary}</div>}
            </div>
            <div className={css.a}>
              <button
                type="button" className={css.btn}
                disabled={loadingSave === save.name}
                onClick={() => { loadSave(save.name) }}
              >{loadingSave === save.name ? t('view.loading') : t('save.load')}</button>
              <button
                type="button" className={`${css.btn} ${css.danger}`}
                onClick={() => {
                  void dialogs.confirm({
                    body: t('saves.confirmDelete', { name: save.name }),
                    confirmLabel: t('save.delete'),
                    cancelLabel: t('app.cancel'),
                    danger: true,
                  }).then((yes) => {
                    if (!yes) return
                    void rpc.deleteSave({ sessionId, name: save.name }).then(reload, () => undefined)
                  })
                }}
              >{t('save.delete')}</button>
            </div>
          </div>
        ))}
      </div>
      <div className={css.note}>{t('saves.note')}</div>
      {dialogs.dialog}
    </div>
  )
}
