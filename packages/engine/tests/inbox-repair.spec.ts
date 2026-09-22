/**
 * Unit coverage for the seed-ledger reconciliation the tavern engine applies
 * to its forked children. The fork slices can sever an inbox ledger pair — a
 * message committed to the parent's queue before the cut, claimed just after
 * it — and the child replays the half pair as pending. These tests pin the
 * `repairSeedInbox` decision rules on a plain session store: cancel
 * source-consumed entries, preserve genuinely pending ones, drop everything
 * in tail mode, and emit same-target cancel coordinates in descending order.
 */
import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session, UserMessage } from '@deepseek-ai/dsh-session'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { livePendingIds, repairSeedInbox, seedPendingInbox } from '../src/inbox-repair.ts'

/** Append one queue commit for each message (all at the list tail). */
function enqueue(session: Session, messages: UserMessage[]): void {
  session.append('agent/inbox/spliced', { target: 'next-turn', start: 0, inserted: messages })
}

/** Consume the first `count` queued messages from the front. */
function claimFromFront(session: Session, count: number): void {
  session.append('agent/inbox/spliced', { target: 'next-turn', start: 0, removedCount: count, inserted: [] })
}

const messageOf = (text: string): UserMessage =>
  createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })

/** The pending next-turn count the child's whole ledger (seed + own) folds to. */
function livePendingCount(session: Session): number {
  let pending = 0
  for (const event of session.snapshotEvents()) {
    if (event.type !== 'agent/inbox/spliced') continue
    const { removedCount, inserted } = event.data as { removedCount?: number; inserted: unknown[] }
    pending -= removedCount ?? 0
    pending += inserted.length
  }
  return pending
}

/** A bare session-store context: the ledger fold needs no agent runtime. */
async function sessionCtx(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  return ctx
}

describe('seed ledger reconciliation', () => {
  it('cancels a severed seed pair whose claim the source logged after the cut', async () => {
    const ctx = await sessionCtx()
    const parent = ctx.sessions.create(SessionId('tavern-repair-severed'))
    enqueue(parent, [messageOf('存档后的消息')])
    const child = ctx.sessions.fork(parent, undefined, SessionId('tavern-repair-severed-child'))
    expect(seedPendingInbox(child)).toHaveLength(1)

    // The source claims the message only after the fork: the child's seed now
    // carries the commit whose claim it will never see.
    claimFromFront(parent, 1)
    const cancelled = repairSeedInbox(child, livePendingIds(parent))
    expect(cancelled).toBe(1)

    expect(livePendingCount(child)).toBe(0)
    const owned = child.ownEvents().filter(event => event.type === 'agent/inbox/spliced')
    expect(owned).toHaveLength(1)
    expect(((owned[0]?.data ?? {}) as { outcome?: string }).outcome).toBe('canceled')
  })

  it('preserves genuinely pending source input under the keep rule', async () => {
    const ctx = await sessionCtx()
    const parent = ctx.sessions.create(SessionId('tavern-repair-keep'))
    enqueue(parent, [messageOf('真实在途')])
    const child = ctx.sessions.fork(parent, undefined, SessionId('tavern-repair-keep-child'))
    expect(repairSeedInbox(child, livePendingIds(parent))).toBe(0)

    // Still pending on the source, untouched in the child: no cancel event.
    expect(seedPendingInbox(child)).toHaveLength(1)
    expect(livePendingCount(child)).toBe(1)
    expect(child.ownEvents().filter(event => event.type === 'agent/inbox/spliced')).toHaveLength(0)
  })

  it('drops every seed-pending entry in tail mode', async () => {
    const ctx = await sessionCtx()
    const parent = ctx.sessions.create(SessionId('tavern-repair-tail'))
    enqueue(parent, [messageOf('父会话的项')])
    const child = ctx.sessions.fork(parent, undefined, SessionId('tavern-repair-tail-child'))
    expect(repairSeedInbox(child)).toBe(1)
    expect(livePendingCount(child)).toBe(0)
    expect(child.ownEvents().filter(event => event.type === 'agent/inbox/spliced')).toHaveLength(1)
  })

  it('emits same-target cancellations in descending index order', async () => {
    const ctx = await sessionCtx()
    const parent = ctx.sessions.create(SessionId('tavern-repair-order'))
    enqueue(parent, [messageOf('甲'), messageOf('乙')])
    const child = ctx.sessions.fork(parent, undefined, SessionId('tavern-repair-order-child'))
    claimFromFront(parent, 2)
    expect(repairSeedInbox(child, livePendingIds(parent))).toBe(2)

    const cancels = child.ownEvents()
      .filter(event => event.type === 'agent/inbox/spliced')
      .map(event => (event.data as { start?: number }).start)
    expect(cancels).toEqual([1, 0])
    expect(livePendingCount(child)).toBe(0)
  })

  it('reports zero cancellations for a balanced seed', async () => {
    const ctx = await sessionCtx()
    const parent = ctx.sessions.create(SessionId('tavern-repair-balanced'))
    enqueue(parent, [messageOf('已消费')])
    claimFromFront(parent, 1)
    const child = ctx.sessions.fork(parent, undefined, SessionId('tavern-repair-balanced-child'))
    expect(repairSeedInbox(child, livePendingIds(parent))).toBe(0)
    expect(livePendingCount(child)).toBe(0)
    expect(child.ownEvents().filter(event => event.type === 'agent/inbox/spliced')).toHaveLength(0)
  })
})
