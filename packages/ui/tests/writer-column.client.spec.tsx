// @vitest-environment jsdom
// 写卡列 0.1.7 retain 契约回归钉（2026-11-01）。
//
// 0.1.7 把客户端 sessions 服务重写成引用计数：`sessions.binding(id)` 只在
// scope 被 retain 物化后才有值；写卡会话不是「当前会话」，没有人替它持引用。
// 旧实现直接借 binding 并调用已退役的 openWindow，结果恒 undefined——打字正常、
// 发送静默 return、转写永远空白。本套件钉死四件事：
//   ① 挂载必须 retain(writerId, {source:'tavern-writer'})，且不再走 binding(id)；
//   ② 发送经 retain 拿到的 binding.session.prompt（标准通道）；
//   ③ 卸载/换标签 release 旧引用；
//   ④ 未就绪与打开失败都必须上屏，绝不静默吞掉发送。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import { WriterColumn } from '../src/client/WriterColumn.tsx'
import { zh } from '../src/client/locales.ts'
import type { TavernRpc } from '../src/client/rpc.ts'

const SESSION = 'session-main'
const WRITER_A = 'session-writer-a'
const WRITER_B = 'session-writer-b'

const t = ((key: string) => (zh as unknown as Record<string, string>)[key] ?? key) as never

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

interface FakeRef {
  sessionId: string
  ready: Promise<unknown>
  release: ReturnType<typeof vi.fn>
}

interface FakeSessions {
  sessions: ISessions
  retain: ReturnType<typeof vi.fn>
  /** The pre-0.1.7 borrow face — the fix must never call it. */
  bindingSpy: ReturnType<typeof vi.fn>
  refs: FakeRef[]
  prompt: ReturnType<typeof vi.fn>
}

/**
 * One writer session double.
 * @param entries - durable event window rows the transcript folds.
 * @param ready - overrides the retain.ready settlement (pending = not-ready,
 *   rejected = open failure); default resolves with the binding.
 */
function makeSessions(entries: readonly unknown[] = [], ready?: () => Promise<unknown>): FakeSessions {
  // Stable identities: useSyncExternalStore re-renders whenever the snapshot
  // object changes (the old fake re-created it and hung the worker).
  const snapshot = { running: false, openState: 'open', openError: null, promptError: null }
  const window = { entries }
  const prompt = vi.fn(() => Promise.resolve({ ok: true as const, value: { accepted: true } }))
  const cancel = vi.fn(() => Promise.resolve({ ok: true as const, value: { accepted: true } }))
  const binding = {
    eventSource: {
      getSnapshot: () => window,
      subscribe: () => () => undefined,
    },
    session: {
      subscribe: () => () => undefined,
      getSnapshot: () => snapshot,
      prompt,
      cancel,
      projections: { faceOf: () => undefined },
    },
  }
  const refs: FakeRef[] = []
  const retain = vi.fn((target: unknown) => {
    const release = vi.fn()
    const ref: FakeRef = {
      sessionId: String(target),
      ready: ready === undefined ? Promise.resolve(binding) : ready(),
      release,
    }
    refs.push(ref)
    return { sessionId: ref.sessionId, binding, ready: ref.ready, release }
  })
  const bindingSpy = vi.fn(() => undefined)
  const sessions = {
    retain,
    binding: bindingSpy,
    list: {
      subscribe: () => () => undefined,
      getSnapshot: () => ({
        ids: [],
        byId: { [SESSION]: { cwd: '/ws' } },
        phase: 'ready',
        projectionsBySession: {},
      }),
    },
    create: vi.fn(async () => 'session-writer-new'),
    refresh: vi.fn(async () => undefined),
  } as unknown as ISessions
  return { sessions, retain, bindingSpy, refs, prompt }
}

/** Registry row the mount reads before creating a WriterChat. */
function registry(ids: readonly string[]): string {
  return JSON.stringify({
    sessions: ids.map((id, index) => ({ id, label: `会话 ${index + 1}` })),
    deleted: [],
  })
}

function renderColumn(writerSessions: ISessions, ids: readonly string[] = [WRITER_A]): {
  rpc: TavernRpc
  unmount(): void
} {
  const rpc = {
    readText: vi.fn(async () => ({ text: registry(ids) })),
    writeText: vi.fn(async () => ({ ok: true as const })),
    stop: vi.fn(async () => ({ accepted: true as const, tailStopped: false })),
  } as unknown as TavernRpc
  const view = render(
    <WriterColumn
      rpc={rpc}
      sessions={writerSessions}
      models={undefined}
      conversation={{ conversationStoreKey: () => 'dsh.conversation' }}
      sessionId={SESSION}
      checkKey={async () => false}
      onNeedKey={() => undefined}
      t={t}
    />,
  )
  return { rpc, unmount: view.unmount }
}

function userMessage(text: string): unknown {
  return {
    type: 'event',
    event: {
      type: 'user/message',
      time: 1,
      surfaceOp: 'append',
      data: { source: { kind: 'user' }, content: [{ type: 'text', text }] },
    },
  }
}

function assistantMessage(text: string): unknown {
  return {
    type: 'event',
    event: {
      type: 'assistant/message',
      time: 2,
      data: { node: { content: [{ type: 'text', text }] } },
    },
  }
}

describe('写卡列 0.1.7 retain 契约', () => {
  it('挂载即 retain，且发送走 retain 得到的 binding（不再借 binding(id)）', async () => {
    const fake = makeSessions([userMessage('你好，写手'), assistantMessage('收到，开始改卡')])
    renderColumn(fake.sessions)

    const textarea = await screen.findByPlaceholderText(zh['writer.placeholder'])
    // The retain effect runs after paint — assert through waitFor (CI on a
    // slower runner otherwise samples the frame before the effect).
    await waitFor(() => {
      expect(fake.retain).toHaveBeenCalledTimes(1)
      expect(fake.retain).toHaveBeenCalledWith(WRITER_A, { source: 'tavern-writer' })
    })
    // 旧实现的入口：非当前会话借 binding(id) 恒 undefined——钉死不再走它。
    expect(fake.bindingSpy).not.toHaveBeenCalled()

    // 历史窗口由 retain 的 open 带进来：转写真的读得到。
    expect(await screen.findByText('你好，写手')).toBeDefined()
    expect(await screen.findByText('收到，开始改卡')).toBeDefined()

    fireEvent.change(textarea, { target: { value: '把 systemPrompt 改成冷硬风格' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    await waitFor(() => { expect(fake.prompt).toHaveBeenCalledTimes(1) })
    expect(fake.prompt.mock.calls[0]?.[0]).toEqual([{ type: 'text', text: '把 systemPrompt 改成冷硬风格' }])
  })

  it('卸载时释放本列持有的 retain 引用', async () => {
    const fake = makeSessions()
    const { unmount } = renderColumn(fake.sessions)
    await screen.findByPlaceholderText(zh['writer.placeholder'])
    await waitFor(() => { expect(fake.refs).toHaveLength(1) })

    unmount()
    expect(fake.refs[0]?.release).toHaveBeenCalledTimes(1)
  })

  it('换标签：旧引用释放，新标签重新 retain', async () => {
    const fake = makeSessions()
    renderColumn(fake.sessions, [WRITER_A, WRITER_B])

    await screen.findByPlaceholderText(zh['writer.placeholder'])
    // 注册表取最新一个：先钉 B（同样等 effect 落定）。
    await waitFor(() => {
      expect(fake.retain).toHaveBeenLastCalledWith(WRITER_B, { source: 'tavern-writer' })
    })

    fireEvent.click(screen.getByLabelText(zh['writer.tabPrev']))
    await waitFor(() => {
      expect(fake.retain).toHaveBeenLastCalledWith(WRITER_A, { source: 'tavern-writer' })
    })
    expect(fake.refs[0]?.release).toHaveBeenCalledTimes(1)
    // 新引用仍被持有——切换不是「先放后取」的泄漏。
    expect(fake.refs[1]?.release).not.toHaveBeenCalled()
  })

  it('retain 未就绪时发送必须上屏错误，不得静默丢弃', async () => {
    const fake = makeSessions([], () => new Promise(() => undefined))
    renderColumn(fake.sessions)

    const textarea = await screen.findByPlaceholderText(zh['writer.placeholder'])
    fireEvent.change(textarea, { target: { value: '改开场' } })
    fireEvent.keyDown(textarea, { key: 'Enter' })

    expect(await screen.findByText(/写卡会话尚未就绪/)).toBeDefined()
    expect(fake.prompt).not.toHaveBeenCalled()
  })

  it('打开失败：错误行显示宿主原因并释放引用', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const fake = makeSessions([], () => Promise.reject(new Error('open denied')))
    renderColumn(fake.sessions)

    expect(await screen.findByText(/open denied/)).toBeDefined()
    expect(warn).toHaveBeenCalled()
    await waitFor(() => { expect(fake.refs[0]?.release).toHaveBeenCalledTimes(1) })
    expect(fake.prompt).not.toHaveBeenCalled()
  })
})