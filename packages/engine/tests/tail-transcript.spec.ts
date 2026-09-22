/**
 * The tail transcript projection: catalog rows derive the
 * runs; the child's own events decide the status and body;
 * an unreadable child stays an honest archived row; the fork
 * seed (replayed parent history) never leaks into a row; tool
 * calls pair their durable results by callId.
 * @module tail-transcript
 */
import { describe, expect, it } from 'vitest'
import { tailTranscriptFrom } from '../src/tail-transcript.ts'
import type { SessionEvent } from '@deepseek-ai/dsh-session'

const catalog = (childId: string): SessionEvent => ({
  type: 'subagent/catalog',
  seq: 9,
  data: { version: 0, childId, childCreatedAt: 1700000000000, mode: 'one-shot', label: 'tavern-tail' },
}) as unknown as SessionEvent

const turnEnd = (kind: string, seq = 20): SessionEvent =>
  ({ type: 'turn/end', seq, data: { turn: 1, reason: { kind } } }) as unknown as SessionEvent

const toolCall = (name: string, args: string, callId = 'c1', seq = 12): SessionEvent =>
  ({ type: 'tool/call', seq, data: { turn: 1, step: 1, callId, name, arguments: args } }) as unknown as SessionEvent

const toolResult = (callId: string, text: string, seq = 13): SessionEvent =>
  ({
    type: 'tool/result',
    seq,
    data: { turn: 1, step: 1, message: { role: 'user', content: [{ type: 'tool-result', toolCallId: callId, content: [{ type: 'text', text }] }] } },
  }) as unknown as SessionEvent

const assistant = (text: string, seq = 18): SessionEvent =>
  ({ type: 'assistant/message', seq, data: { message: { content: [{ type: 'text', text }] } } }) as unknown as SessionEvent

describe('tail transcript projection', () => {
  it('a completed child carries its tool calls, reply, and status', async () => {
    const session = { snapshotEvents: () => [catalog('child-1')] } as never
    const rows = await tailTranscriptFrom(session, async (childId) => {
      expect(childId).toBe('child-1')
      return {
        events: [
          toolCall('runtimeCreate', JSON.stringify({ path: 'deed.md', content: 'x' })),
          assistant('已记账。'),
          turnEnd('completed'),
        ],
        inheritedEventCount: 0,
      }
    })
    expect(rows.tails).toHaveLength(1)
    expect(rows.tails[0]?.status).toBe('completed')
    expect(rows.tails[0]?.actions).toEqual([
      { tool: 'runtimeCreate', detail: 'deed.md', args: '{"path":"deed.md","content":"x"}' },
    ])
    expect(rows.tails[0]?.reply).toBe('已记账。')
  })

  it('tool results pair by callId onto the action row (bounded args included)', async () => {
    const session = { snapshotEvents: () => [catalog('child-4')] } as never
    const rows = await tailTranscriptFrom(session, async () => ({
      events: [
        toolCall('gain_exp', '{"who":"洛克","exp":50}'),
        toolResult('c1', '经验 +50 已入账：洛克 exp 150→200'),
        assistant('维护完成：经验与账目落盘'),
        turnEnd('completed'),
      ],
      inheritedEventCount: 0,
    }))
    const action = rows.tails[0]?.actions[0]
    expect(rows.tails[0]?.reply).toBe('维护完成：经验与账目落盘')
    expect(action?.tool).toBe('gain_exp')
    expect(action?.result).toBe('经验 +50 已入账：洛克 exp 150→200')
    expect(action?.args).toBe('{"who":"洛克","exp":50}')
  })

  it('the fork seed never leaks into a row: parent narrative and parent tool calls are excluded', async () => {
    const session = { snapshotEvents: () => [catalog('child-5')] } as never
    // The fork seed replays the parent's completed-turn prefix at seq 0..7
    // (its narrative and its own casts); the child's OWN events start at 10.
    const seed = [
      toolCall('cast', '{"spell":"fireball"}', 'p9', 1),
      toolResult('p9', '火球命中', 2),
      assistant('父正文：哥布林乙倒下……', 4),
      turnEnd('completed', 7),
    ]
    const rows = await tailTranscriptFrom(session, async () => ({
      events: [
        ...seed,
        toolCall('runtimeUpdate', '{"path":"player.json"}', 'c1', 12),
        assistant('维护完成：本回合世界无变化', 18),
        turnEnd('completed', 20),
      ],
      inheritedEventCount: 8,
    }))
    expect(rows.tails[0]?.status).toBe('completed')
    expect(rows.tails[0]?.actions).toEqual([
      { tool: 'runtimeUpdate', detail: 'player.json', args: '{"path":"player.json"}' },
    ])
    expect(rows.tails[0]?.reply).toBe('维护完成：本回合世界无变化')
  })

  it('an unknown boundary keeps the legacy whole-log behavior', async () => {
    const session = { snapshotEvents: () => [catalog('child-6')] } as never
    const rows = await tailTranscriptFrom(session, async () => ({
      events: [assistant('旧日志正文'), turnEnd('completed')],
      inheritedEventCount: 0,
    }))
    expect(rows.tails[0]?.reply).toBe('旧日志正文')
  })

  it('a cancelled child reports stopped', async () => {
    const session = { snapshotEvents: () => [catalog('child-2')] } as never
    const rows = await tailTranscriptFrom(session, async () => ({ events: [turnEnd('aborted')], inheritedEventCount: 0 }))
    expect(rows.tails[0]?.status).toBe('stopped')
  })

  it('an unreadable child stays an honest archived row', async () => {
    const session = { snapshotEvents: () => [catalog('child-3')] } as never
    const rows = await tailTranscriptFrom(session, async () => undefined)
    expect(rows.tails[0]?.status).toBe('archived')
    expect(rows.tails[0]?.actions).toEqual([])
  })

  it('non-tavern catalog rows are skipped', async () => {
    const session = { snapshotEvents: () => [
      { type: 'subagent/catalog', seq: 3, data: { version: 0, childId: 'w', mode: 'one-shot', label: 'writer' } },
    ] as unknown as SessionEvent[] } as never
    const rows = await tailTranscriptFrom(session, async () => ({ events: [turnEnd('completed')], inheritedEventCount: 0 }))
    expect(rows.tails).toHaveLength(0)
  })
})
