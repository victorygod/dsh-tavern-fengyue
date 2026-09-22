/**
 * The conversation snapshot: the card scripts' read view of the session.
 *
 * `runtime/.chat.snapshot.jsonl` holds a whole-file projection of the bound
 * session's durable user/assistant messages — the authoritative text lives in
 * the session log, this file is a disposable cache rewritten from it. Scripts
 * run with cwd = `runtime/`, so history sits at `./.chat.snapshot.jsonl` next
 * to the world files they touch. Every write replaces the entire file (scratch
 * + atomic rename); a corrupted, hand-mangled, or stale copy heals at the next
 * rewrite — nothing here is ever authoritative, so nothing needs guarding.
 * @module dsh-tavern-fengyue-engine/chat-snapshot
 */

import { renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Session } from '@deepseek-ai/dsh-session'
import { stripInstructions } from './prompting.ts'
import { readCardMeta } from './workspace.ts'

/** The snapshot file's name inside `runtime/` — the card scripts' history input. */
export const CHAT_SNAPSHOT_FILE = '.chat.snapshot.jsonl'

/** Absolute path of one workspace's conversation snapshot. */
export function chatSnapshotPath(root: string): string {
  return join(root, 'runtime', CHAT_SNAPSHOT_FILE)
}

/** One projected conversation row; every field is a plain JSON string. */
export interface ChatSnapshotRow {
  /** Durable event position (log offset); the pending row carries the next position instead. */
  readonly seq: number
  /** The presenting role: user or assistant. */
  readonly kind: 'user' | 'assistant'
  /** Text as it entered the durable log (legacy wrap tags included for wrap-era user messages). */
  readonly orig: string
  /** Display text (legacy wrap-tag blocks stripped); equal to `orig` for assistant rows. */
  readonly plain: string
}

/** Snapshot first-line descriptor, rewritten on every cache write. */
export interface ChatSnapshotHead {
  readonly type: 'head'
  readonly sessionId: string
  readonly cardTitle: string
  readonly clientTimeZone: string
}

type SnapshotLine = ChatSnapshotHead | ChatSnapshotRow

/** Text of one content block list: joined `type:'text'` blocks (reasoning excluded). */
export function textOfBlocks(blocks: readonly { type: string; text?: string }[]): string {
  return blocks
    .filter(block => block.type === 'text')
    .map(block => block.text ?? '')
    .join('')
}

/**
 * Project one session's durable log into snapshot rows, in order. Only
 * player-sourced (`source.kind === 'user'`) messages and assistant messages
 * appear — the injected per-turn post messages, engine-joined reminders, and
 * tool traffic are model/display-face derivations, not history, so both the
 * `{{script}}` consumers and the tail agent read only player speech.
 * @param session - the bound session providing the durable events.
 */
export function chatSnapshotRows(session: Session): ChatSnapshotRow[] {
  const rows: ChatSnapshotRow[] = []
  for (const event of session.snapshotEvents()) {
    if (event.type === 'user/message') {
      if (event.data.source.kind !== 'user') continue
      const orig = textOfBlocks(event.data.content)
      // stripInstructions preserves order/length, so index 0 always exists.
      const plain = stripInstructions([orig])[0] ?? orig
      rows.push({ seq: event.seq, kind: 'user', orig, plain })
      continue
    }
    if (event.type === 'assistant/message') {
      const orig = textOfBlocks(event.data.message.content)
      rows.push({ seq: event.seq, kind: 'assistant', orig, plain: orig })
    }
  }
  return rows
}

/**
 * Replace the whole snapshot file from the bound session's durable log. One
 * optional pending row — the player text being submitted, whose durable event
 * has not fired yet — projects first so worldbook-class scripts scanning the
 * file during the wrap render see the current input; the next event-driven
 * rewrite (or a full rewrite on abort) replaces it with the durable truth.
 * @param root - absolute workspace root.
 * @param session - the bound session (log read; may report zero events).
 * @param opts.clientTimeZone - the submitting client's zone, cached for the head line.
 * @param opts.pendingText - player text not yet durable, projected before the render.
 */
export function writeChatSnapshot(
  root: string,
  session: Session | undefined,
  opts: { readonly clientTimeZone?: string; readonly pendingText?: string } = {},
): void {
  const head: ChatSnapshotHead = {
    type: 'head',
    sessionId: session?.id ?? '',
    cardTitle: readCardMeta(root)?.title ?? '',
    clientTimeZone: opts.clientTimeZone ?? '',
  }
  const rows: SnapshotLine[] = [head, ...chatSnapshotRows(session ?? ({
    snapshotEvents: () => [],
  } as unknown as Session))]
  if (opts.pendingText !== undefined) {
    rows.push({
      seq: session?.seq ?? 0,
      kind: 'user',
      orig: opts.pendingText,
      plain: opts.pendingText,
    })
  }
  const body = rows.map(row => JSON.stringify(row)).join('\n') + '\n'
  // Whole-file replace: never observed half-written, never merged with stale
  // content — the disposable-cache contract's entire correctness story.
  const target = chatSnapshotPath(root)
  const scratch = `${target}.tmp-${process.pid}`
  writeFileSync(scratch, body)
  renameSync(scratch, target)
}

/** The tail file's name inside `runtime/` — this turn's tail-agent narration. */
export const TAIL_SNAPSHOT_FILE = '.chat.tail.jsonl'

/** Absolute path of one workspace's tail-output file. */
export function tailSnapshotPath(root: string): string {
  return join(root, 'runtime', TAIL_SNAPSHOT_FILE)
}

/** The tail file's first-line descriptor: which turn the narration belongs to. */
export interface TailSnapshotHead {
  readonly type: 'head'
  readonly sessionId: string
  /** The parent turn's seq — consumers detect a stale (skipped/aborted) run. */
  readonly turnSeq: number
  /** ISO timestamp of the write. */
  readonly ranAt: string
}

/** One projected tail row: the child run's assistant narration text. */
export interface TailSnapshotRow {
  readonly role: 'assistant'
  readonly text: string
}

/**
 * Replace the whole tail file from one settled tail run — the tail child's
 * narration has no other card-readable home: the fork's session is never
 * workspace-bound, so the conversation snapshot never carries it. Same
 * whole-file replace contract as {@link writeChatSnapshot}; a skipped or
 * aborted run writes nothing, leaving the last completed run in place (the
 * head's `turnSeq` is the staleness marker). Runs BEFORE the tail.after hook
 * phase, so the hooks' scripts read this turn's narration, not the previous
 * one's.
 * @param root - absolute workspace root.
 * @param content - the settled run's identity and narration texts.
 */
export function writeTailSnapshot(root: string, content: { sessionId: string; turnSeq: number; texts: readonly string[] }): void {
  const head: TailSnapshotHead = {
    type: 'head',
    sessionId: content.sessionId,
    turnSeq: content.turnSeq,
    ranAt: new Date().toISOString(),
  }
  const lines: (TailSnapshotHead | TailSnapshotRow)[] = [head, ...content.texts.map(text => ({ role: 'assistant' as const, text }))]
  const body = lines.map(line => JSON.stringify(line)).join('\n') + '\n'
  const target = tailSnapshotPath(root)
  const scratch = `${target}.tmp-${process.pid}`
  writeFileSync(scratch, body)
  renameSync(scratch, target)
}
