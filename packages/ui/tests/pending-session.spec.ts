// @vitest-environment jsdom
/** pending-session 标记的存取与清理：选卡页刷新保持的数据面（TavernApp 接线见 app 层）。 */
import { beforeEach, describe, expect, it } from 'vitest'
import { clearPendingSession, readPendingSession, setPendingSession } from '../src/client/pending-session.ts'

describe('pending-session', () => {
  beforeEach(() => { localStorage.clear() })

  it('未设置时读出 null', () => {
    expect(readPendingSession()).toBeNull()
  })

  it('set 后读回同值；clear 后归 null', () => {
    setPendingSession('session-abc')
    expect(readPendingSession()).toBe('session-abc')
    clearPendingSession()
    expect(readPendingSession()).toBeNull()
  })

  it('重复 set 覆盖旧值（最新空白会话为准）', () => {
    setPendingSession('session-1')
    setPendingSession('session-2')
    expect(readPendingSession()).toBe('session-2')
  })
})
