/**
 * The tail agent's transcript projection: one row per tavern-tail
 * fork in the session's durable `subagent/catalog`, with its runtime
 * tool calls and closing text derived from the child session's own
 * log — live children read from the registry, archived children
 * through the cold-read query face when mounted.
 *
 * Seeded forks replay the parent's completed-turn prefix into the
 * child log first (`inheritedEventCount`), so derivation skips every
 * event below that boundary — the parent's narrative and tool calls
 * are context, never the row's facts.
 * @module dsh-tavern-fengyue-engine/tail-transcript
 */

import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'

/** One tool invocation the tail agent made, compact for the row body. */
export interface TailAction {
  /** The tool name (`runtimeCreate`/`runtimeUpdate`/…). */
  readonly tool: string
  /** Compact argument digest (the runtime path, or the raw args). */
  readonly detail: string
  /** The raw arguments JSON, bounded — the expanded row's body. */
  readonly args?: string
  /** The paired `tool/result` text, bounded; absent while no result landed. */
  readonly result?: string
}

/** One completed or stopped tail run the player can expand. */
export interface TailRun {
  /** The child session id — stable key for the expanded body. */
  readonly childId: SessionId
  /** The child's creation timestamp (ms). */
  readonly at: number
  /** `stopped` when the run was cancelled; `archived` when the child log is unreadable. */
  readonly status: 'completed' | 'stopped' | 'error' | 'archived'
  /** The tail's closing narrative text (bounded). */
  readonly reply: string
}

/** The tail-agent transcript for one session, oldest first on the wire. */
export interface TailTranscript {
  readonly tails: readonly {
    readonly childId: SessionId
    readonly at: number
    readonly status: TailRun['status']
    readonly actions: readonly TailAction[]
    readonly reply: string
  }[]
}

/** The reply text cap: the row body shows the tail's closing lines, not its whole log. */
const REPLY_CAP = 2_000
/** The raw arguments text cap per tool invocation. */
const ARGS_CAP = 2_000
/** The result text cap per tool invocation. */
const RESULT_CAP = 2_000
/** The tool actions cap per run. */
const ACTIONS_CAP = 40

/** One child log plus the fork-seed boundary its derivation must skip. */
export interface ChildLog {
  readonly events: readonly SessionEvent[]
  /** Child events start at this seq; everything below is replayed parent history. */
  readonly inheritedEventCount: number
}

/** Cap one result string for the wire. */
function capResult(text: string): string {
  return text.length > RESULT_CAP ? `${text.slice(0, RESULT_CAP)}…` : text
}

/** The visible text of one `tool/result` event, errors noted first. */
function resultText(event: SessionEvent): string {
  const data = event.data as {
    message?: { content?: { type?: string; content?: { type?: string; text?: string }[] }[] }
    error?: { name?: string; code?: string }
  }
  if (data.error !== undefined) return `${data.error.name ?? 'error'}: ${data.error.code ?? ''}`
  // message.content = [ToolResultBlock]; the visible text lives in the tool-
  // result block's own content list.
  if (!Array.isArray(data.message?.content)) return ''
  return (data.message!.content ?? [])
    .flatMap(block => Array.isArray(block?.content) ? block.content : [])
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text ?? '')
    .join('')
}

/** The compact argument digest for one tool invocation: keyed paths and sizes. */
function actionDetail(argsJson: string): string {
  try {
    const args = JSON.parse(argsJson) as Record<string, unknown>
    const path = args['path']
    if (typeof path === 'string') return path
    const content = args['content']
    if (typeof content === 'string') return `${content.length} chars`
    return Object.keys(args).slice(0, 3).join(', ')
  } catch {
    // A truncated arguments JSON still deserves the name — show what came.
    return argsJson.slice(0, 40)
  }
}

/**
 * Derive one tail run's projection from the child's OWN events.
 * @param childId - the child session id.
 * @param at - the child's creation timestamp.
 * @param log - the child's events with the inherited (seed) boundary.
 * @returns the run's row.
 */
function deriveRun(childId: SessionId, at: number, log: ChildLog): TailTranscript['tails'][number] {
  // The seed is the replayed parent prefix: the parent's narrative and tool
  // calls are context for the child, never facts of this run.
  const events = log.inheritedEventCount > 0
    ? log.events.filter(event => event.seq >= log.inheritedEventCount)
    : log.events
  const results = new Map<string, string>()
  for (const event of events) {
    if (event.type !== 'tool/result') continue
    const data = event.data as { message?: { content?: { type?: string; toolCallId?: string }[] } }
    const block = (data.message?.content ?? []).find(
      (item): item is { type: 'tool-result'; toolCallId: string } =>
        typeof item === 'object' && item !== null && (item as { type?: unknown }).type === 'tool-result',
    )
    const text = resultText(event)
    if (block !== undefined && text !== '') results.set(block.toolCallId, capResult(text))
  }
  const actions: TailAction[] = []
  let reply = ''
  let status: TailRun['status'] = 'stopped'
  for (const event of events) {
    if (event.type === 'tool/call') {
      if (actions.length < ACTIONS_CAP) {
        const callId = (event.data as { callId?: unknown }).callId as string | undefined
        const result = callId === undefined ? undefined : results.get(callId)
        const rawArgs = typeof event.data.arguments === 'string' ? event.data.arguments : ''
        const args = rawArgs.length > ARGS_CAP ? `${rawArgs.slice(0, ARGS_CAP)}…` : rawArgs
        actions.push({
          tool: event.data.name,
          detail: actionDetail(rawArgs),
          ...(args === '' ? {} : { args }),
          ...(result === undefined ? {} : { result }),
        })
      }
    } else if (event.type === 'assistant/message') {
      const message = (event.data as { message: { content?: { type: string; text?: string }[] } }).message
      const text = message.content
      if (text === undefined) continue
      const part = text.filter(block => block.type === 'text')
        .map(block => (block as { text?: string }).text ?? '')
        .join('')
      if (part !== '') reply = part
    } else if (event.type === 'turn/end') {
      const reason = (event.data as { reason: { kind?: string } }).reason
      const kind = reason.kind
      status = kind === 'aborted' ? 'stopped' : kind === 'error' ? 'error' : 'completed'
      if (reply.length > REPLY_CAP) reply = `${reply.slice(0, REPLY_CAP)}…`
    }
  }
  return { childId, at, status, actions, reply: reply.slice(0, REPLY_CAP + 1) }
}

/** The catalog rows of this session's tavern-tail forks (one per run). */
function tailCatalog(session: Session): { childId: SessionId; at: number }[] {
  const rows: { childId: SessionId; at: number }[] = []
  for (const event of session.snapshotEvents()) {
    if (event.type !== 'subagent/catalog') continue
    const data = event.data as { childId?: unknown; childCreatedAt?: unknown; label?: unknown; mode?: unknown }
    if (data.mode !== 'one-shot' || data.label !== 'tavern-tail') continue
    if (typeof data.childId !== 'string' || typeof data.childCreatedAt !== 'number') continue
    rows.push({ childId: data.childId as SessionId, at: data.childCreatedAt })
  }
  return rows
}

/**
 * The tail transcript of one tavern session, oldest first. Live fork
 * children read from the registry; archived ones through
 * `ctx.get('sessionQuery')`'s cold read when the base composition
 * mounted the query family — without it an archived child keeps its
 * catalog row but derives an honest empty body (status `'archived'`).
 * Both reads carry the fork seed boundary so replayed parent history
 * never leaks into the row.
 * @param session - the OWNER session carrying the catalog.
 * @param resolveChild - one child's log, or undefined when unreadable.
 * @returns the wire rows, oldest first.
 */
export async function tailTranscriptFrom(
  session: Session,
  resolveChild: (childId: SessionId) => Promise<ChildLog | undefined>,
): Promise<TailTranscript> {
  const tails = await Promise.all(tailCatalog(session)
    .map(async ({ childId, at }) => {
      const log = await resolveChild(childId)
      return log === undefined
        ? { childId, at, status: 'archived' as const, actions: [], reply: '' }
        : deriveRun(childId, at, log)
    }))
  return { tails }
}
