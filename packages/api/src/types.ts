import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** Session identity every tavern call carries. */
export interface TavernSessionRequest {
  /** The tavern session being addressed. */
  readonly sessionId: SessionId
}

/** Rebind result: the workspace now binds to this fresh session (清空 empties history; 载入 restores the save-point fork). */
export interface TavernRebindValue {
  /** The fresh session id now bound to the workspace. */
  readonly sessionId: SessionId
  /** The stamp's composer draft at save time; the client restores it into the input box. Empty when unstamped. */
  readonly draft: string
  /** The load's fork-cut seq（存档刻）— the fresh session's replay stops at this
   *  boundary, so its tail IS the save point. `null` for 清空/无边界载入 (empty
   *  history). The landing contract (2026-09-25) carries it as the engine-side
   *  attestation of the save-point landing. */
  readonly anchorSeq: number | null
}

/** One tavern workspace row for the sidebar. */
export interface TavernSessionRowWire {
  /** Workspace directory name. */
  readonly name: string
  /** The session bound to this workspace, or null while none started. */
  readonly sessionId: string | null
  /** Whether the workspace already carries a card. */
  readonly hasCard: boolean
  /** Card title from meta.json, or the directory name. */
  readonly title: string
  /** Card description from meta.json, or empty. */
  readonly desc: string
}

/** Workspace-list result. */
export interface TavernWorkspacesValue {
  /** Rows newest-first. */
  readonly rows: readonly TavernSessionRowWire[]
}

/** Create-session call; the engine mints both the workspace and the session. */
export interface TavernCreateSessionRequest { readonly nop?: undefined }

/** One library card as the wire sees it. */
export interface TavernLibraryCardWire {
  /** Library directory name — the import identity. */
  readonly name: string
  /** Card title from `preset/meta.json`. */
  readonly title: string
  /** Card description from `preset/meta.json`. */
  readonly desc: string
  /** Cover image path from `preset/meta.json`, empty when none. */
  readonly cover: string
}

/** Library-asset read call (cover images for the shelf). */
export interface TavernReadLibraryAssetRequest {
  /** Library card directory name. */
  readonly name: string
  /** Card-relative asset path. */
  readonly path: string
}

/** Library-asset read result. */
export interface TavernReadLibraryAssetValue {
  /** A `data:` URL carrying the base64-encoded asset. */
  readonly dataUrl: string
}

/** Library-list result. */
export interface TavernLibraryValue {
  /** Every card directory under the library base. */
  readonly cards: readonly TavernLibraryCardWire[]
}

/** Create-session result. */
export interface TavernCreateSessionValue {
  /** The created session; its cwd is the fresh workspace. */
  readonly sessionId: SessionId
}

/** Card-state flags the client picks its views from. */
export interface TavernStateValue {
  /** Whether the workspace already carries a card. */
  readonly hasCard: boolean
  /** Whether the maintenance prompt is non-empty (tail agent on). */
  readonly maintenanceOn: boolean
  /** Whether the main agent keeps its default workspace-visibility read pair
   *  (runtimeRead/runtimeGrep); `false` = the narrator is workspace-blind. */
  readonly narratorToolsOn: boolean
  /** Card title from meta.json, empty when no card. */
  readonly title: string
  /** Card description from meta.json, empty when no card. */
  readonly desc: string
  /** Cover image path from meta.json, empty when none. */
  readonly cover: string
  /** Unpublished card authoring in progress (draft page stays across switches). */
  readonly drafting: boolean
  /** Library card name this workspace edits (`null` = not an editing session). */
  readonly editing: string | null
  /** The tail agent is running right now (turn-end gate in flight). */
  readonly tailRunning: boolean
  /** The conversation has started (a player message exists in the durable
   *  log) — locks the per-card narrator-tools checkbox grey. */
  readonly dialogStarted: boolean
  /** A retry point exists: the newest autosave stamp carries a composer draft. */
  readonly retryable: boolean
}

/** Retry-point result: the rebound session and the preserved composer text. */
export interface TavernRetryPointValue {
  /** The session id the workspace rebinds to (fork at the send-moment boundary, or a fresh reset). */
  readonly sessionId: SessionId
  /** The stamped composer text to re-send through the prompt face. */
  readonly text: string
}

/** Parsed-import commit call: files land in the library, then load into the session. */
export interface TavernCommitImportRequest {
  /** The receiving session. */
  readonly sessionId: SessionId
  /** The card title shown on the preview page. */
  readonly title: string
  /** Card files with paths relative to the card root. */
  readonly files: readonly { readonly path: string; readonly content: string }[]
}

/** Parsed-import commit result. */
export interface TavernCommitImportValue {
  /** The library card directory name the import landed under. */
  readonly name: string
}

/** Draft-abandon call: wipe authored content, restore the fresh workspace. */
export interface TavernCancelDraftRequest extends TavernSessionRequest {}

/** Draft-page publish call: the workspace card lands in the library. */
export interface TavernPublishRequest extends TavernSessionRequest {}

/** Publish result. */
export interface TavernPublishValue {
  /** The library card directory name. */
  readonly name: string
}

/** Save-edit call (仅保存): the workspace preset replaces the edited library card, editing continues. */
export interface TavernSaveEditRequest extends TavernSessionRequest {}

/** Edit-dirty call: whether the editing workspace's preset differs from the edited library card. */
export interface TavernEditDirtyRequest extends TavernSessionRequest {}

/** Edit-dirty result. */
export interface TavernEditDirtyValue {
  /** True when unsaved card edits exist. */
  readonly dirty: boolean
}

/** Library-delete call. */
export interface TavernDeleteCardRequest {
  /** Library card directory name. */
  readonly name: string
}

/** Library-import call. */
export interface TavernImportLibraryRequest {
  /** The fresh session receiving the card. */
  readonly sessionId: SessionId
  /** Library card directory name. */
  readonly name: string
}

/** Opening-page fetch result. */
export interface TavernOpeningValue {
  /** The opening page HTML, or null when the card ships none. */
  readonly html: string | null
}

/** One save row as the wire sees it. */
export interface TavernSaveWire {
  /** Save directory name; autosaves carry a readable local timestamp. */
  readonly name: string
  /** `auto` for engine-managed `autosave-…` rows, else `manual`. */
  readonly type: 'auto' | 'manual'
  /** The last player message at save time — the row's summary line (empty for unstamped rows). */
  readonly summary: string
}

/** Saves-list result. */
export interface TavernSavesValue {
  /** Saves newest-first. */
  readonly saves: readonly TavernSaveWire[]
}

/** Manual save call. */
export interface TavernSaveRequest {
  /** The session whose runtime is snapshotted. */
  readonly sessionId: SessionId
  /** Save directory name (the save identity). */
  readonly name: string
  /** The composer text at save time (may be empty) — stamped for load-restore. */
  readonly draft: string
}

/** Save-load call. */
export interface TavernLoadRequest {
  /** The session whose runtime is replaced. */
  readonly sessionId: SessionId
  /** The save to load. */
  readonly name: string
}

/** Tree-list result. */
export interface TavernTreeValue {
  /** Entries in lexical order; directory paths end with `/`. */
  readonly entries: readonly {
    /** Path relative to the workspace root. */
    readonly path: string
    /** Whether this entry is a directory. */
    readonly dir: boolean
  }[]
}

/** File-read call. */
export interface TavernReadTextRequest {
  /** The session whose workspace resolves `path`. */
  readonly sessionId: SessionId
  /** Workspace-relative path. */
  readonly path: string
}

/** File-read result. */
export interface TavernReadTextValue {
  /** The complete file text. */
  readonly text: string
}

/** File-write call (preset area only). */
export interface TavernWriteTextRequest {
  /** The session whose workspace resolves `path`. */
  readonly sessionId: SessionId
  /** Preset-relative path. */
  readonly path: string
  /** Complete replacement text. */
  readonly text: string
}

/** One editor file operation. */
export type TavernFileOp =
  | { readonly kind: 'create'; readonly path: string }
  | { readonly kind: 'mkdir'; readonly path: string }
  | { readonly kind: 'move'; readonly from: string; readonly to: string }
  | { readonly kind: 'delete'; readonly path: string }

/** File-operation call. */
export interface TavernFileOpRequest {
  /** The session whose workspace owns the file. */
  readonly sessionId: SessionId
  /** The operation. */
  readonly op: TavernFileOp
}

/** No-payload success result. */
export interface TavernAckValue {
  /** Always true; failures travel as Remote errors. */
  readonly ok: true
}

/** Prompt-admission call: the engine composes the card's wrap pair around the text. */
/** Run one `preset/scripts/` script for the card's frontend (`tavern.runScript`). */
export interface TavernRunScriptRequest extends TavernSessionRequest {
  /** `preset/scripts/` base name (with or without `.sh`); no separators. */
  readonly name: string
  /** Positional argv; one quoted shell argument each (16KB cap per argument). */
  readonly args: readonly string[]
}

/** The script's stdout, trimmed — plus the structured failure when the run failed. */
export interface TavernRunScriptValue {
  /** The collected stdout after trimming trailing whitespace; empty string on failure. */
  readonly text: string
  /** Present only when the script failed: the same taxonomy the prompt face reports (`scriptFailures`). */
  readonly failure?: { readonly reason: 'missing' | 'args' | 'exit' | 'timeout' | 'abort'; readonly exitCode?: number }
}

export interface TavernPromptRequest {
  /** The tavern session receiving the prompt. */
  readonly sessionId: SessionId
  /** Raw player text, sent verbatim as the middle content block. */
  readonly text: string
  /** Client-minted identity persisted on the accepted durable message. */
  readonly requestId: string
  /** Browser IANA zone forwarded for prompt provenance. */
  readonly clientTimeZone?: string
}

/**
 * One failed `{{script}}` resolution during the submission-time wrap render.
 * The rendered text keeps the placeholder verbatim; the failure rides the RPC
 * result so the client can surface it.
 */
export interface TavernScriptFailure {
  /** The placeholder name whose script failed. */
  readonly name: string
  /** Grammar/budget refusals (parse, depth, oversized arg, spawn cap) or the run's own outcome. */
  readonly reason: 'parse' | 'depth' | 'args' | 'limit' | 'missing' | 'exit' | 'timeout' | 'abort'
  /** Exit code, present only for `reason: 'exit'`. */
  readonly exitCode?: number
}

/** Prompt admission result. */
export interface TavernPromptValue {
  /** Whether the agent inbox accepted the composed prompt. */
  readonly accepted: boolean
  /** Wrap-render script failures, present only when at least one occurred. */
  readonly scriptFailures?: TavernScriptFailure[]
}

/** Stop call: cancel one session's in-flight turn, tail run, and pending admission. */
export interface TavernStopRequest {
  /** The tavern session to stop. */
  readonly sessionId: SessionId
}

/** One tool invocation a tail run made, compact for the row body. */
export interface TavernTailActionWire {
  /** The tool name (`runtimeWrite`/`runtimeEdit`/`runtimeDelete`/…). */
  readonly tool: string
  /** Compact argument digest (the runtime path, or the raw args). */
  readonly detail: string
  /** The raw arguments JSON (bounded) — the expanded row's body. */
  readonly args?: string
  /** The paired `tool/result` text (bounded); omitted while no result landed. */
  readonly result?: string
}

/** One tail run the bookkeeping row can expand. */
export interface TavernTailRunWire {
  /** The child session id — stable key for the expanded body. */
  readonly childId: string
  /** The child's creation timestamp (ms). */
  readonly at: number
  /** `stopped` when cancelled; `archived` when the cold read is unavailable. */
  readonly status: 'completed' | 'stopped' | 'error' | 'archived'
  /** The runtime tool calls, in call order. */
  readonly actions: readonly TavernTailActionWire[]
  /** The tail's closing narrative text (bounded). */
  readonly reply: string
}

/** The tail-agent transcript of one session, oldest first. */
export interface TavernTailTranscriptValue {
  /** One row per tavern-tail fork in the owner session's catalog. */
  readonly tails: readonly TavernTailRunWire[]
}

/** Stop result: the stop is always accepted; an idle session stops as a no-op. */
export interface TavernStopValue {
  readonly accepted: true
  /**
   * Whether this call cancelled an in-flight tail run — the client
   * surfaces it, so a stop that raced a finished tail reads as idle.
   */
  readonly tailStopped: boolean
}

/** Asset-read call (images / media preview, size-capped). */
export interface TavernReadAssetRequest {
  /** The session whose workspace resolves `path`. */
  readonly sessionId: SessionId
  /** Workspace-relative path. */
  readonly path: string
}

/** Asset-read result. */
export interface TavernReadAssetValue {
  /** A `data:` URL carrying the base64-encoded asset. */
  readonly dataUrl: string
}

/** Asset-write call (the identity-header cover upload). */
export interface TavernWriteAssetRequest {
  /** The session whose workspace receives the asset. */
  readonly sessionId: SessionId
  /** Workspace-relative path; must sit under `preset/`. */
  readonly path: string
  /** Base64-encoded file content (no `data:` URL prefix). */
  readonly dataBase64: string
}

/** Writer-ensure call: lazily create (or fetch) the workspace's card-writing agent session. */
export interface TavernEnsureWriterRequest extends TavernSessionRequest {}

/** Writer-ensure result. */
export interface TavernEnsureWriterValue {
  /** The writer session id, stable per workspace. */
  readonly sessionId: SessionId
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** The addressed session is not a tavern session (workspace table miss). */
    'tavern/not-session': {}
    /** A card import failed (bad library name or malformed card JSON). */
    'tavern/import-failed': {}
    /** A save list / save / load / delete refused the request. */
    'tavern/save-failed': {}
    /** A fenced editor read or write refused the request. */
    'tavern/edit-failed': {}
    /** A preset script refused or failed to run (missing name, oversized argv, nonzero exit, timeout, abort). */
    'tavern/script-failed': {}
    /** An engine call the api could not classify. */
    'tavern/error': {}
  }
}
