import { describe, expect, it } from 'vitest'
import { scanSettlement, settlementUnsigned } from '../src/index.ts'

type Ev = { type: string; seq: number; data?: unknown }
const done = (seq: number): Ev => ({ type: 'command/done', seq, data: { commandId: 'tavern-tail-done', kind: 'success' } })

/** 形状取自 2026-09-22 真实幽灵会话的 durable 日志 dump(loader-composition 的 galgame/ghost 家族同款序)。 */
const HEALTHY = [
  { type: 'session', seq: 0 } as Ev,
  { type: 'turn/start', seq: 4 },
  { type: 'user/message', seq: 8 },
  { type: 'turn/end', seq: 14, data: { turn: 1, reason: { kind: 'completed' } } } as Ev,
  done(15),
  { type: 'session/end-seed', seq: 16 } as Ev,
]

const GHOST = [
  ...HEALTHY,
  { type: 'turn/start', seq: 18 },
  { type: 'user/message', seq: 21 },
  { type: 'user/message', seq: 22 },
  { type: 'turn/end', seq: 26, data: { turn: 2, reason: { kind: 'error', error: { message: 'SSE stream ended without [DONE]', code: 'STREAM_CLOSED' } } } } as Ev,
]

const IN_FLIGHT = [
  ...HEALTHY,
  { type: 'turn/start', seq: 28 },
  { type: 'user/message', seq: 29 },
]

describe('settlement scan + heal gate (2026-09-22 ghost-turn root-cause surface)', () => {
  it('healthy: the last signal sits after the last turn/end — no heal', () => {
    const scan = scanSettlement(HEALTHY)
    expect(scan).toEqual({ lastTurnStart: 4, lastTurnEnd: 14, lastDone: 15 })
    expect(settlementUnsigned(scan)).toBe(false)
  })

  it('ghost: an error turn closed without a signal (the live ws-20260922-072028 shape) — heal due', () => {
    const scan = scanSettlement(GHOST)
    expect(scan).toEqual({ lastTurnStart: 18, lastTurnEnd: 26, lastDone: 15 })
    expect(settlementUnsigned(scan)).toBe(true)
  })

  it('in-flight turn (start after end) — cancel will settle it, not the heal', () => {
    expect(settlementUnsigned(scanSettlement(IN_FLIGHT))).toBe(false)
  })

  it('empty session — nothing to heal', () => {
    const scan = scanSettlement([])
    expect(settlementUnsigned(scan)).toBe(false)
  })

  it('other command/done events are invisible to the gate (only tavern-tail-done signs)', () => {
    const noise = [
      { type: 'turn/end', seq: 14, data: { turn: 1, reason: { kind: 'error', error: {} } } } as Ev,
      { type: 'command/done', seq: 15, data: { commandId: 'someone-else', kind: 'success' } } as Ev,
    ]
    expect(settlementUnsigned(scanSettlement(noise))).toBe(true)
  })
})
