///---PLACEHOLDER---
/** One library card as the wire sees it. */
export interface TavernLibraryWire { name: string; title: string; desc: string; cover: string }

/** One save as the wire sees it. */
export interface TavernSaveWire { name: string; type: 'auto' | 'manual'; summary: string }

/** One workspace row as the sidebar sees it (disk scan, newest first). */
export interface TavernWorkspaceWire {
  name: string
  sessionId: string | null
  hasCard: boolean
  title: string
  desc: string
  cover: string
}

/** Empty wire request — every tavern endpoint declares exactly one request slot. */
export type TavernNopRequest = { nop?: undefined }

/** The tavern Remote face this plugin consumes. */
export interface TavernRpc {
  createSession(request: TavernNopRequest, signal?: AbortSignal): Promise<{ sessionId: string }>
  workspaces(request: TavernNopRequest, signal?: AbortSignal): Promise<{ rows: TavernWorkspaceWire[] }>
  state(request: { sessionId: string }, signal?: AbortSignal): Promise<{
    hasCard: boolean
    maintenanceOn: boolean
    narratorToolsOn: boolean
    title: string
    desc: string
    cover: string
    drafting: boolean
    editing: string | null
    tailRunning: boolean
    dialogStarted: boolean
    retryable: boolean
  }>
  library(request: TavernNopRequest, signal?: AbortSignal): Promise<{ cards: TavernLibraryWire[] }>
  deleteCard(request: { name: string }, signal?: AbortSignal): Promise<{ ok: true }>
  deleteSave(request: { sessionId: string; name: string }, signal?: AbortSignal): Promise<{ ok: true }>
  importFromLibrary(request: { sessionId: string; name: string }, signal?: AbortSignal): Promise<{ ok: true }>
  draftCard(request: { sessionId: string }, signal?: AbortSignal): Promise<{ ok: true }>
  editFromLibrary(request: { sessionId: string; name: string }, signal?: AbortSignal): Promise<{ ok: true }>
  cancelEdit(request: { sessionId: string }, signal?: AbortSignal): Promise<{ ok: true }>
  opening(request: { sessionId: string }, signal?: AbortSignal): Promise<{ html: string | null }>
  tree(request: { sessionId: string }, signal?: AbortSignal): Promise<{ entries: { path: string; dir: boolean }[] }>
  readText(request: { sessionId: string; path: string }, signal?: AbortSignal): Promise<{ text: string }>
  writeText(request: { sessionId: string; path: string; text: string }, signal?: AbortSignal): Promise<{ ok: true }>
  fileOp(
    request: { sessionId: string; op: { kind: 'create'; path: string } | { kind: 'mkdir'; path: string } | { kind: 'move'; from: string; to: string } | { kind: 'delete'; path: string } },
    signal?: AbortSignal,
  ): Promise<{ ok: true }>
  saves(request: { sessionId: string }, signal?: AbortSignal): Promise<{ saves: TavernSaveWire[] }>
  save(request: { sessionId: string; name: string; draft: string }, signal?: AbortSignal): Promise<{ ok: true }>
  load(request: { sessionId: string; name: string }, signal?: AbortSignal): Promise<{ sessionId: string; draft: string; anchorSeq: number | null }>
  reset(request: { sessionId: string }, signal?: AbortSignal): Promise<{ sessionId: string; draft: string; anchorSeq: number | null }>
  retryPoint(request: { sessionId: string }, signal?: AbortSignal): Promise<{ sessionId: string; text: string }>
  commitImport(
    request: { sessionId: string; title: string; files: readonly { path: string; content: string }[] },
    signal?: AbortSignal,
  ): Promise<{ name: string }>
  publishCard(request: { sessionId: string }, signal?: AbortSignal): Promise<{ name: string }>
  saveEdit(request: { sessionId: string }, signal?: AbortSignal): Promise<{ name: string }>
  editDirty(request: { sessionId: string }, signal?: AbortSignal): Promise<{ dirty: boolean }>
  runScript(request: { sessionId: string; name: string; args: readonly string[] }, signal?: AbortSignal): Promise<{ text: string; failure?: { reason: string; exitCode?: number } }>
  cancelDraft(request: { sessionId: string }, signal?: AbortSignal): Promise<{ ok: true }>
  readAsset(request: { sessionId: string; path: string }, signal?: AbortSignal): Promise<{ dataUrl: string }>
  writeAsset(request: { sessionId: string; path: string; dataBase64: string }, signal?: AbortSignal): Promise<{ ok: true }>
  ensureWriter(request: { sessionId: string }, signal?: AbortSignal): Promise<{ sessionId: string }>
  readLibraryAsset(request: { name: string; path: string }, signal?: AbortSignal): Promise<{ dataUrl: string }>
  deleteSession(request: { sessionId: string }, signal?: AbortSignal): Promise<{ ok: true }>
  prompt(
    request: { sessionId: string; text: string; requestId: string; clientTimeZone?: string },
    signal?: AbortSignal,
  ): Promise<{ accepted: boolean; scriptFailures?: { name: string; reason: 'missing' | 'exit' | 'timeout' | 'abort'; exitCode?: number }[] }>
  stop(request: { sessionId: string }, signal?: AbortSignal): Promise<{ accepted: true; tailStopped: boolean }>
  tailTranscript(request: { sessionId: string }, signal?: AbortSignal): Promise<{
    tails: {
      childId: string
      at: number
      status: 'completed' | 'stopped' | 'error' | 'archived'
      actions: { tool: string; detail: string; args?: string; result?: string }[]
      reply: string
    }[]
  }>
}

/** One wire result as the namespace service returns it (never rejects). */
type WireResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } }

/**
 * Unwrap one namespace result: values pass through, failures reject with the
 * Host error message — callers get values, not envelopes.
 */
async function unwrap<T>(call: Promise<WireResult<T>>): Promise<T> {
  const result = await call
  if (!result.ok) throw new Error(`tavern rpc failed: ${result.error.code}: ${result.error.message}`)
  return result.value
}

/**
 * Resolve the tavern namespace off the Client Remote carrier and adapt it to
 * the value-shaped {@link TavernRpc}: the runtime namespace returns Remote
 * result envelopes, so every method maps through {@link unwrap}.
 * @param ctx - the browser-half context carrying `ctx.remote`.
 * @returns the typed face, or undefined when the host lacks the api row.
 */
export function tavernRpc(ctx: unknown): TavernRpc | undefined {
  type Raw = Record<string, (request: unknown, signal?: AbortSignal) => Promise<WireResult<never>>>
  const tavern = (ctx as { remote?: { tavern?: Raw } }).remote?.tavern
  if (tavern === undefined) return undefined
  const face = (method: string): ((request: unknown, signal?: AbortSignal) => Promise<never>) => {
    // A missing namespace method (older host bundle) must not break the whole
    // page at face construction — it fails only when actually called.
    const raw = tavern[method]
    if (raw === undefined) {
      return (): Promise<never> => Promise.reject(new Error(`tavern rpc: namespace lacks method "${method}"`))
    }
    return (request, signal) => unwrap(raw(request, signal))
  }
  return {
    createSession: face('createSession'),
    workspaces: face('workspaces'),
    state: face('state'),
    library: face('library'),
    deleteCard: face('deleteCard'),
    deleteSave: face('deleteSave'),
    importFromLibrary: face('importFromLibrary'),
    draftCard: face('draftCard'),
    editFromLibrary: face('editFromLibrary'),
    cancelEdit: face('cancelEdit'),
    opening: face('opening'),
    tree: face('tree'),
    readText: face('readText'),
    writeText: face('writeText'),
    fileOp: face('fileOp'),
    saves: face('saves'),
    save: face('save'),
    load: face('load'),
    reset: face('reset'),
    retryPoint: face('retryPoint'),
    commitImport: face('commitImport'),
    publishCard: face('publishCard'),
    saveEdit: face('saveEdit'),
    editDirty: face('editDirty'),
    runScript: face('runScript'),
    cancelDraft: face('cancelDraft'),
    readAsset: face('readAsset'),
    writeAsset: face('writeAsset'),
    ensureWriter: face('ensureWriter'),
    readLibraryAsset: face('readLibraryAsset'),
    deleteSession: face('deleteSession'),
    prompt: face('prompt'),
    stop: face('stop'),
    tailTranscript: face('tailTranscript'),
  }
}
