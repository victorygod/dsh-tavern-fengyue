/** Tavern Remote owner: the browser face over the host engine service. */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, RemoteError, TypertRemoteService, type RemoteErrorCode } from '@deepseek-ai/dsh-typert-protocol'
import type {} from 'dsh-tavern-fengyue-engine'
import type {
  TavernAckValue, TavernCreateSessionRequest, TavernCreateSessionValue, TavernEditDirtyRequest, TavernEditDirtyValue,
  TavernFileOpRequest, TavernCancelDraftRequest, TavernCommitImportRequest, TavernCommitImportValue,
  TavernDeleteCardRequest, TavernImportLibraryRequest, TavernLibraryValue, TavernLoadRequest, TavernPublishRequest,
  TavernPublishValue, TavernReadAssetRequest, TavernReadAssetValue, TavernReadLibraryAssetRequest,
  TavernReadLibraryAssetValue, TavernOpeningValue, TavernPromptRequest, TavernPromptValue, TavernReadTextRequest,
  TavernRunScriptRequest, TavernRunScriptValue,
  TavernReadTextValue, TavernSaveEditRequest, TavernSaveRequest, TavernSavesValue, TavernRebindValue,
  TavernSessionRequest, TavernStateValue, TavernStopRequest, TavernStopValue, TavernTailTranscriptValue, TavernTreeValue,
  TavernRetryPointValue,
  TavernEnsureWriterRequest, TavernEnsureWriterValue,
  TavernWorkspacesValue, TavernWriteAssetRequest,
  TavernWriteTextRequest,
} from './types.ts'

export type * from './types.ts'

/**
 * The typed client face the generated remote-client implements (`./remote`).
 * Component code receives (and tests fake) this shape; deriving it here keeps
 * the wire contract and the client typing one declaration.
 */
export interface TavernRemoteFace {
  /** Create a workspace plus its session.
   * @param signal - cancels the call.
   * @returns the new session id. */
  createSession(signal?: AbortSignal): Promise<TavernCreateSessionValue>
  /** Workspace rows for the sidebar.
   * @param signal - cancels the call. */
  workspaces(signal?: AbortSignal): Promise<TavernWorkspacesValue>
  /** Card-state flags of one session.
   * @param request - session identity.
   * @param signal - cancels the call. */
  state(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernStateValue>
  /** The card library.
   * @param signal - cancels the call. */
  library(signal?: AbortSignal): Promise<TavernLibraryValue>
  /** Delete one card from the library.
   * @param request - the card to delete.
   * @param signal - cancels the call. */
  deleteCard(request: TavernDeleteCardRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Import a library card into a fresh session.
   * @param request - the card and its receiving session.
   * @param signal - cancels the call. */
  importFromLibrary(request: TavernImportLibraryRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Author a new card in place.
   * @param request - session identity.
   * @param signal - cancels the call. */
  draftCard(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Start editing a library card: load into workspace + stamp the edit target.
   * @param request - session and card name.
   * @param signal - cancels the call. */
  editFromLibrary(request: TavernImportLibraryRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Abandon an edit: re-load the untouched card, clear the stamp.
   * @param request - session identity.
   * @param signal - cancels the call. */
  cancelEdit(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** The opening page of one session's card.
   * @param request - session identity.
   * @param signal - cancels the call. */
  opening(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernOpeningValue>
  /** The saves of one session's workspace.
   * @param request - session identity.
   * @param signal - cancels the call. */
  saves(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernSavesValue>
  /** Save manually.
   * @param request - session and save name.
   * @param signal - cancels the call. */
  save(request: TavernSaveRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Load a save into the runtime.
   * @param request - session and save name.
   * @param signal - cancels the call. */
  load(request: TavernLoadRequest, signal?: AbortSignal): Promise<TavernRebindValue>
  /** Delete a save.
   * @param request - session and save name.
   * @param signal - cancels the call. */
  deleteSave(request: TavernLoadRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Enter the retry point: rebind to the send-moment autosave and return its draft for re-send.
   * @param request - session identity.
   * @param signal - cancels the call. */
  retryPoint(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernRetryPointValue>
  /** Clear to the initial card state.
   * @param request - session identity.
   * @param signal - cancels the call. */
  reset(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** The workspace tree.
   * @param request - session identity.
   * @param signal - cancels the call. */
  tree(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernTreeValue>
  /** Read one workspace text file.
   * @param request - session and path.
   * @param signal - cancels the call. */
  readText(request: TavernReadTextRequest, signal?: AbortSignal): Promise<TavernReadTextValue>
  /** Write one preset text file.
   * @param request - session, path, and text.
   * @param signal - cancels the call. */
  writeText(request: TavernWriteTextRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Create / move / delete a preset file.
   * @param request - session and operation.
   * @param signal - cancels the call. */
  fileOp(request: TavernFileOpRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Read one workspace asset as a data URL (preview-capped).
   * @param request - session and path.
   * @param signal - cancels the call. */
  readAsset(request: TavernReadAssetRequest, signal?: AbortSignal): Promise<TavernReadAssetValue>
  /** Write one binary asset into the workspace preset area (cover upload).
   * @param request - session, path (under `preset/`), and base64 content.
   * @param signal - cancels the call. */
  writeAsset(request: TavernWriteAssetRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Lazily create (or fetch) the workspace's card-writing agent session.
   * @param request - the workspace-owning session.
   * @param signal - cancels the call. */
  ensureWriter(request: TavernEnsureWriterRequest, signal?: AbortSignal): Promise<TavernEnsureWriterValue>
  /** Commit one parsed import: land the card in the library, then load it.
   * @param request - session, title, and card files.
   * @param signal - cancels the call. */
  commitImport(request: TavernCommitImportRequest, signal?: AbortSignal): Promise<TavernCommitImportValue>
  /** Read one library card asset (cover images).
   * @param request - card name and asset path.
   * @param signal - cancels the call. */
  readLibraryAsset(request: TavernReadLibraryAssetRequest, signal?: AbortSignal): Promise<TavernReadLibraryAssetValue>
  /** Publish the workspace card into the library (draft-page 保存并开始).
   * @param request - session identity.
   * @param signal - cancels the call. */
  publishCard(request: TavernPublishRequest, signal?: AbortSignal): Promise<TavernPublishValue>
  /** Save the editing workspace's card into the edited library card and keep editing (仅保存).
   * @param request - session identity.
   * @param signal - cancels the call. */
  saveEdit(request: TavernSaveEditRequest, signal?: AbortSignal): Promise<TavernPublishValue>
  /** Whether the editing workspace carries unsaved card edits.
   * @param request - session identity.
   * @param signal - cancels the call. */
  editDirty(request: TavernEditDirtyRequest, signal?: AbortSignal): Promise<TavernEditDirtyValue>
  /** Abandon an unpublished draft (wipe authored content).
   * @param request - session identity.
   * @param signal - cancels the call. */
  cancelDraft(request: TavernCancelDraftRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Delete a tavern workspace outright.
   * @param request - session identity.
   * @param signal - cancels the call. */
  deleteSession(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernAckValue>
  /** Send one player prompt: the engine renders the card's wrap pair around the text and admits it.
   * @param request - session, raw text, client-minted identity, and optional zone.
   * @param signal - cancels the call. */
  prompt(request: TavernPromptRequest, signal?: AbortSignal): Promise<TavernPromptValue>
  stop(request: TavernStopRequest): TavernStopValue
  tailTranscript(request: TavernSessionRequest, signal?: AbortSignal): Promise<TavernTailTranscriptValue>
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Host owner of the `tavern` Remote namespace. */
    tavernApi: TavernApi
  }
}

/** Wrap engine failures as Remote errors instead of rejections. */
async function wrap<T>(work: () => T | Promise<T>, code: RemoteErrorCode = 'tavern/error'): Promise<T> {
  try {
    return await work()
  } catch (error) {
    throw new RemoteError(code, error instanceof Error ? error.message : String(error), {})
  }
}

/** Host service backing `ctx.remote.tavern` over the tavern engine. */
export class TavernApi extends TypertRemoteService {
  static inject = ['tavernService']

  /** @param ctx - host context carrying the tavern engine service. */
  constructor(ctx: Context) {
    super(ctx, 'tavernApi', { namespace: 'tavern' })
  }

  /** @param signal – cancels the call. */
  @Remote
  async workspaces(_request: Record<never, never>, signal: AbortSignal): Promise<TavernWorkspacesValue> {
    void signal
    return await wrap(async () => ({ rows: await this.ctx.tavernService.sessionsOverview() }))
  }

  /** @param signal – caller lifetime; the engine's session create retains its own semantics. */
  @Remote
  async createSession(_request: TavernCreateSessionRequest, signal: AbortSignal): Promise<TavernCreateSessionValue> {
    void signal
    return await wrap(async () => ({ sessionId: await this.ctx.tavernService.createSession() }))
  }

  /** @param request - session identity. @param signal – cancels the call. */
  @Remote
  async state(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernStateValue> {
    void signal
    return await wrap(() => {
      const state = this.ctx.tavernService.state(request.sessionId)
      return {
        hasCard: state.hasCard, maintenanceOn: state.maintenanceOn, narratorToolsOn: state.narratorToolsOn,
        title: state.title, desc: state.desc, cover: state.cover, drafting: state.drafting, editing: state.editing,
        tailRunning: state.tailRunning, dialogStarted: state.dialogStarted, retryable: state.retryable,
      }
    })
  }

  /** @param signal – cancels the call. */
  @Remote
  async library(_request: Record<never, never>, signal: AbortSignal): Promise<TavernLibraryValue> {
    void signal
    return await wrap(() => ({
      cards: this.ctx.tavernService.library().map(card => ({
        cover: card.meta?.cover ?? '',
        name: card.name,
        title: card.meta?.title ?? card.name,
        desc: card.meta?.desc ?? '',
      })),
    }))
  }

  /** @param request - the card and its receiving session. @param signal – cancels the call. */
  @Remote
  async importFromLibrary(request: TavernImportLibraryRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.importFromLibrary(request.sessionId, request.name)
      return { ok: true as const }
    }, 'tavern/import-failed')
  }

  /** @param request - the card to delete. @param signal – cancels the call. */
  @Remote
  async deleteCard(request: TavernDeleteCardRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.deleteCard(request.name)
      return { ok: true as const }
    }, 'tavern/import-failed')
  }

  /** @param request - session identity. @param signal – cancels the call. */
  @Remote
  async draftCard(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.draftCard(request.sessionId)
      return { ok: true as const }
    })
  }

  /** @param request - the card and its receiving session. @param signal – cancels the call. */
  @Remote
  async editFromLibrary(request: TavernImportLibraryRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.editFromLibrary(request.sessionId, request.name)
      return { ok: true as const }
    }, 'tavern/import-failed')
  }

  /** @param request - session identity. @param signal – cancels the call. */
  @Remote
  async cancelEdit(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.cancelEdit(request.sessionId)
      return { ok: true as const }
    }, 'tavern/edit-failed')
  }

  /** @param request - session identity. @param signal – cancels the call. */
  @Remote
  async opening(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernOpeningValue> {
    void signal
    return await wrap(() => ({ html: this.ctx.tavernService.opening(request.sessionId) }))
  }

  /** @param request - session identity. @param signal – cancels the call. */
  @Remote
  async saves(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernSavesValue> {
    void signal
    return await wrap(() => ({ saves: this.ctx.tavernService.saves(request.sessionId) }))
  }

  /** @param request - session, save name, and composer draft. @param signal – cancels the call. */
  @Remote
  async save(request: TavernSaveRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.save(request.sessionId, request.name, request.draft)
      return { ok: true as const }
    }, 'tavern/save-failed')
  }

  /** @param request - session and save name. @param signal – cancels the call. */
  @Remote
  async load(request: TavernLoadRequest, signal: AbortSignal): Promise<TavernRebindValue> {
    void signal
    return await wrap(async () => {
      const loaded = await this.ctx.tavernService.load(request.sessionId, request.name)
      return { sessionId: loaded.sessionId, draft: loaded.draft }
    }, 'tavern/save-failed')
  }

  /** @param request - session identity. @param signal - cancels the rebind. */
  @Remote
  async retryPoint(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernRetryPointValue> {
    void signal
    return await wrap(async () => {
      const retry = await this.ctx.tavernService.retryPoint(request.sessionId)
      return { sessionId: retry.sessionId, text: retry.text }
    }, 'tavern/save-failed')
  }

  /** @param request - session and save name. @param signal – cancels the call. */
  @Remote
  async deleteSave(request: TavernLoadRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.removeSave(request.sessionId, request.name)
      return { ok: true as const }
    }, 'tavern/save-failed')
  }

  /** @param request - session identity. @param signal – cancels the call.
   * @returns the fresh session id the workspace rebinds to; a cleared workspace
   *   restores no composer draft. */
  @Remote
  async reset(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernRebindValue> {
    void signal
    return await wrap(async () => ({ sessionId: await this.ctx.tavernService.reset(request.sessionId), draft: '' }))
  }

  /** @param request - session identity. @param signal – cancels the call. */
  @Remote
  async tree(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernTreeValue> {
    void signal
    return await wrap(() => ({ entries: this.ctx.tavernService.tree(request.sessionId) }))
  }

  /** @param request - session and path. @param signal – cancels the call. */
  @Remote
  async readText(request: TavernReadTextRequest, signal: AbortSignal): Promise<TavernReadTextValue> {
    void signal
    return await wrap(() => ({ text: this.ctx.tavernService.readText(request.sessionId, request.path) }), 'tavern/edit-failed')
  }

  /** @param request - session, path, and text. @param signal – cancels the call. */
  @Remote
  async writeText(request: TavernWriteTextRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.writeText(request.sessionId, request.path, request.text)
      return { ok: true as const }
    }, 'tavern/edit-failed')
  }

  /** @param request - session and operation. @param signal – cancels the call. */
  @Remote
  async fileOp(request: TavernFileOpRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.fileOp(request.sessionId, request.op)
      return { ok: true as const }
    }, 'tavern/edit-failed')
  }

  /** @param request - session and path. @param signal - cancels the call. */
  @Remote
  async readAsset(request: TavernReadAssetRequest, signal: AbortSignal): Promise<TavernReadAssetValue> {
    void signal
    return await wrap(() => ({ dataUrl: this.ctx.tavernService.readAsset(request.sessionId, request.path) }), 'tavern/edit-failed')
  }

  /** @param request - session, path, and base64 content. @param signal - cancels the call. */
  @Remote
  async writeAsset(request: TavernWriteAssetRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.writeAsset(request.sessionId, request.path, request.dataBase64)
      return { ok: true as const }
    }, 'tavern/edit-failed')
  }

  /** @param request - the workspace-owning session. @param signal - cancels the call. */
  @Remote
  async ensureWriter(request: TavernEnsureWriterRequest, signal: AbortSignal): Promise<TavernEnsureWriterValue> {
    void signal
    return await wrap(async () => ({ sessionId: await this.ctx.tavernService.ensureWriter(request.sessionId) }), 'tavern/error')
  }

  /** @param request - session, title, and files. @param signal - cancels the call. */
  @Remote
  async commitImport(request: TavernCommitImportRequest, signal: AbortSignal): Promise<TavernCommitImportValue> {
    void signal
    return await wrap(
      () => ({
        name: this.ctx.tavernService.commitImport(
          request.sessionId, request.title,
          request.files.map(file => ({ path: file.path, content: file.content })),
        ),
      }),
      'tavern/import-failed',
    )
  }

  /** @param request - card name and asset path. @param signal - cancels the call. */
  @Remote
  async readLibraryAsset(request: TavernReadLibraryAssetRequest, signal: AbortSignal): Promise<TavernReadLibraryAssetValue> {
    void signal
    return await wrap(() => ({ dataUrl: this.ctx.tavernService.readLibraryAsset(request.name, request.path) }), 'tavern/edit-failed')
  }

  /** @param request - session identity. @param signal - cancels the call. */
  @Remote
  async cancelDraft(request: TavernCancelDraftRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.cancelDraft(request.sessionId)
      return { ok: true as const }
    }, 'tavern/error')
  }

  /** @param request - session identity. @param signal - cancels the call. */
  @Remote
  async publishCard(request: TavernPublishRequest, signal: AbortSignal): Promise<TavernPublishValue> {
    void signal
    return await wrap(() => ({ name: this.ctx.tavernService.publishCard(request.sessionId) }), 'tavern/import-failed')
  }

  /** @param request - session identity. @param signal - cancels the call. */
  @Remote
  async saveEdit(request: TavernSaveEditRequest, signal: AbortSignal): Promise<TavernPublishValue> {
    void signal
    return await wrap(() => ({ name: this.ctx.tavernService.saveEdit(request.sessionId) }), 'tavern/edit-failed')
  }

  /** @param request - session identity. @param signal - cancels the call. */
  @Remote
  async editDirty(request: TavernEditDirtyRequest, signal: AbortSignal): Promise<TavernEditDirtyValue> {
    void signal
    return await wrap(() => ({ dirty: this.ctx.tavernService.editDirty(request.sessionId) }), 'tavern/edit-failed')
  }

  /** @param request - session identity. @param signal - cancels the call. */
  @Remote
  async deleteSession(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernAckValue> {
    void signal
    return await wrap(() => {
      this.ctx.tavernService.deleteSession(request.sessionId)
      return { ok: true as const }
    }, 'tavern/error')
  }

  /** @param request - session, raw text, client-minted identity, and optional zone. @param signal – cancels the call. */
  @Remote
  async prompt(request: TavernPromptRequest, signal: AbortSignal): Promise<TavernPromptValue> {
    const result = await wrap(() => this.ctx.tavernService.prompt(request, signal))
    return { accepted: result.accepted, ...(result.scriptFailures === undefined ? {} : { scriptFailures: result.scriptFailures }) }
  }

  /**
   * @param request - the session whose in-flight turn, tail run, and pending admission all stop.
   * @param signal - unused; the method returns synchronously.
   */
  /**
   * @param request - session identity, the script base name, and positional argv.
   * @param signal - cancels the running script (the spawn contract matches the prompt face).
   */
  @Remote
  async runScript(request: TavernRunScriptRequest, signal: AbortSignal): Promise<TavernRunScriptValue> {
    const result = await wrap(() => this.ctx.tavernService.runScript(request.sessionId, request.name, request.args, signal), 'tavern/script-failed')
    return { text: result.text, ...(result.failure === undefined ? {} : { failure: result.failure }) }
  }

  @Remote
  stop(request: TavernStopRequest, signal: AbortSignal): TavernStopValue {
    void signal
    return this.ctx.tavernService.stop(request.sessionId)
  }

  /**
   * @param request - the session whose tail catalog to project.
   * @param signal - unused; the method awaits only local reads.
   */
  @Remote
  async tailTranscript(request: TavernSessionRequest, signal: AbortSignal): Promise<TavernTailTranscriptValue> {
    void signal
    return await this.ctx.tavernService.tailTranscript(request.sessionId)
  }
}

export default TavernApi
