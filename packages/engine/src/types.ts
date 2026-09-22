import type { SessionId } from '@deepseek-ai/dsh-session'

/** Card metadata carried by `preset/meta.json`. */
export interface TavernCardMeta {
  /** Display title of the card. */
  title: string
  /** One-line description of the card; optional — present when declared or imported. */
  desc?: string
  /**
   * Cover image path workspace-relative (always carrying the `preset/`
   * prefix; uploads land under `preset/assets/`), served to the library grid.
   */
  cover: string
  /** Author credit; present only when the card declares one. */
  creator?: string
  /** Card's own version string; present only when declared. */
  version?: string
  /** Tag strings for library browsing; present only when non-empty. */
  tags?: readonly string[]
  /** Whether the narrator agent starts with its default workspace-visibility
   *  read pair (runtimeRead/runtimeGrep). Explicit JSON on the card identity —
   *  absent/true = on, `false` = the narrator is workspace-blind. */
  narratorTools?: boolean
}

/** One library card directory under the configured library root. */
export interface TavernLibraryCard {
  /** Directory name under the library root — the import identity. */
  name: string
  /** Parsed `preset/meta.json`, or null when the card ships none. */
  meta: TavernCardMeta | null
}

/** One save directory under `<workspace>/savings/`. */
export interface TavernSave {
  /** Directory name — the save identity; autosaves carry a readable local timestamp. */
  name: string
  /** Save kind: `autosave-…` rows are engine-managed. */
  type: 'auto' | 'manual'
  /** The last player message at save time, from the boundary ledger; empty for unstamped rows. */
  summary: string
}

/** Workspace path kinds the user-facing editor may touch. */
export type TavernEditorArea = 'preset' | 'runtime' | 'savings'

/** One node of a workspace file listing. */
export interface TavernTreeEntry {
  /** Path relative to the workspace root; directories end with `/`. */
  path: string
  /** Whether this entry is a directory. */
  dir: boolean
}

/** Session state the client needs to pick its views. */
export interface TavernSessionState {
  /** Whether the workspace has a card (`preset/meta.json` present). */
  hasCard: boolean
  /** Whether the tail agent will run (maintenance prompt non-empty). */
  maintenanceOn: boolean
  /** Whether the main agent keeps its default workspace-visibility read pair
   *  (runtimeRead/runtimeGrep); `false` = the narrator is workspace-blind. */
  narratorToolsOn: boolean
  /** Card title from meta.json, empty when no card. */
  title: string
  /** Card description from meta.json, empty when no card. */
  desc: string
  /** Cover image path from meta.json, empty when none. */
  cover: string
  /** Unpublished card authoring in progress (draft page stays across switches). */
  drafting: boolean
  /** Library card name this workspace edits (`null` = not an editing session). */
  editing: string | null
  /** The tail agent is running right now (turn-end gate in flight). */
  tailRunning: boolean
  /** The conversation has started (a player message exists in the durable
   *  log) — locks the per-card narrator-tools checkbox grey. */
  dialogStarted: boolean
  /** A retry point exists: the newest autosave stamp carries a composer draft. */
  retryable: boolean
}

/** Save-point boundary stamped at save time: which session, which `turn/end` seq, and the save row's summary. */
export interface TavernSaveStamp {
  /** The session whose history the save point belongs to. */
  sessionId: SessionId
  /** The last `turn/end` seq at save time; `null` when no turn had completed. */
  seq: number | null
  /** The last player message text at save time — the save row's summary line. */
  summary: string
  /**
   * The composer text captured at the save point: the submitted message for a
   * send-moment autosave, the on-screen draft for a manual save. Load restores
   * it into the composer; the retry point re-sends it. Absent on stamps written
   * before the field existed — readers coalesce to `''`.
   */
  draft?: string
}

/** One parsed import file landing in the card (workspace-relative under `preset/`). */
export interface TavernImportFile {
  /** Path relative to the card root, e.g. `preset/prompt/systemPrompt`. */
  readonly path: string
  /** Complete text content; binary files are refused by the writer. */
  readonly content: string
}

/** Engagement shaped for the host service registration. */
export interface TavernWorkspaceInfo {
  /** Absolute workspace root (`tavern_workspace/<timestamp>/`). */
  readonly root: string
}

export { type SessionId }
