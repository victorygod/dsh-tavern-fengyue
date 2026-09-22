/**
 * Seed-ledger reconciliation for tavern's forked children. The kernel seed
 * slices — the session fork's advance to the next turn boundary, and the tail
 * fork's completed-turn cut — can sever an inbox ledger pair: a message
 * committed to the parent's queue before the cut whose claim lands just after
 * it. The child replays the half pair as a pending message it never
 * legitimately owed; its first claim then re-runs that message (载入存档的
 * 「被回滚的消息被重发」). The seed itself is built inside the kernel and not
 * editable from a plugin, but the engine owns each child before its first
 * claim: it appends durable cancellation splices to the seed-region ledger,
 * which the inbox projection folds on every later read.
 *
 * Scope guard: only events below `inheritedEventCount` (the seed region) are
 * reconciled. Own-region deliveries are out of reach — the tail fork's
 * maintenance prompt arrives through `child.followup` after creation, and a
 * genuinely pending parent message belongs to the parent until it claims it.
 * @module dsh-tavern-fengyue-engine/inbox-repair
 */

import type { UserMessage } from '@deepseek-ai/dsh-llm'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'

/** The two pending lists the durable inbox ledger maintains. */
type LedgerTarget = 'next-turn' | 'next-step'

/** One message the seed-region replay still holds, with its splice coordinates. */
interface PendingEntry {
  target: LedgerTarget
  index: number
  id: string
}

/** The replayed ledger state: the pending messages of both lists. */
type LedgerState = Record<LedgerTarget, UserMessage[]>

/** The fold's start state, mirroring the inbox projection's init. */
function emptyLedger(): LedgerState {
  return { 'next-turn': [], 'next-step': [] }
}

/**
 * Fold one spliced event into a replay state with the projection's own
 * coordinate validation (fail-loud on the same conditions the projection
 * rejects at boot, so a corrupted log cannot diverge silently).
 * @param state - replay state to mutate.
 * @param event - the durable splice event.
 */
function foldSplice(state: LedgerState, event: SessionEvent): void {
  if (event.type !== 'agent/inbox/spliced') return
  const { target, start, removedCount, inserted } = event.data
  const list = state[target]
  const count = removedCount ?? 0
  if (!Number.isSafeInteger(start) || start < 0 || start > list.length
    || !Number.isSafeInteger(count) || start + count > list.length) {
    throw new Error(`tavern: invalid inbox ledger coordinates at session seq ${String(event.seq)}`)
  }
  state[target] = list.toSpliced(start, count, ...inserted)
}

/**
 * Pending messages the seed prefix still holds after replaying its ledger.
 * @param session - the forked child session.
 * @returns entries in fold order; empty when the seed is ledger-balanced.
 */
export function seedPendingInbox(session: Session): PendingEntry[] {
  const state = emptyLedger()
  const events = session.snapshotEvents()
  for (let index = 0; index < session.inheritedEventCount; index += 1) {
    foldSplice(state, events[index] as SessionEvent)
  }
  const pending: PendingEntry[] = []
  for (const target of ['next-turn', 'next-step'] as const) {
    state[target].forEach((message, index) => pending.push({ target, index, id: message.id }))
  }
  return pending
}

/**
 * Message ids the whole durable ledger of one session still holds pending —
 * the kernel's "inherit genuinely pending input" set a repaired seed must
 * preserve (a spliced message whose claim is absent from the log entirely).
 * @param session - the fork source session (its log is the pairing authority).
 * @returns the still-pending message ids.
 */
export function livePendingIds(session: Session): Set<string> {
  const state = emptyLedger()
  for (const event of session.snapshotEvents()) foldSplice(state, event)
  return new Set([...state['next-turn'], ...state['next-step']].map(message => message.id))
}

/**
 * Append durable cancellations for seed-pending messages the child must not
 * carry. Coordinates replay from the seed region, so removals never address
 * own-region entries; removals within one target run in descending index
 * order, keeping earlier coordinates stable as each event folds. `keep`
 * preserves source-owned pending input; `undefined` drops every seed-pending
 * entry (tail children — the parent claims its own queue).
 * @param session - the forked child, repaired before its first claim.
 * @param keep - source-still-pending message ids to leave in place; `undefined`
 *   (tail children) drops every seed-pending entry.
 * @returns how many pending entries were cancelled.
 */
export function repairSeedInbox(session: Session, keep?: ReadonlySet<string>): number {
  const drops = new Map<LedgerTarget, number[]>()
  let cancelled = 0
  for (const entry of seedPendingInbox(session)) {
    if (keep?.has(entry.id) === true) continue
    const indexes = drops.get(entry.target) ?? []
    indexes.push(entry.index)
    drops.set(entry.target, indexes)
    cancelled += 1
  }
  for (const [target, indexes] of drops) {
    for (const start of [...indexes].sort((left, right) => right - left)) {
      session.append('agent/inbox/spliced', { target, start, removedCount: 1, inserted: [], outcome: 'canceled' })
    }
  }
  return cancelled
}
