// @vitest-environment jsdom
// Direct-render spec for the shared ChatComposer (chat-view): a plain
// presentation component, so the ring's occupancy rule is exercised end to
// end without the host module graph. tests-client-plane carries the same
// anchors inside the full TavernApp harness; that directory is a known-gap
// vitest include (see vitest.config.ts), so the live gate lives here.
import { cleanup, fireEvent, render, screen, type RenderResult } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { ReactElement } from 'react'
import { ChatComposer } from '../src/client/chat-view.tsx'

// vitest runs without globals, so testing-library's auto cleanup never
// registers — mounts would pile up on document.body and screen queries would
// hit every previous test's composer.
afterEach(cleanup)

/** Minimal copy map with stock word-for-word templates, enough for the composer surface. */
const COPY: Record<string, string> = {
  'composer.send': '发送',
  'chat.stop': '停止',
  'ctx.aria': '上下文已用 {percent}%',
  'ctx.used': '上下文已用',
  'ctx.system': '系统提示词（卡片）',
  'ctx.tools': '工具',
  'ctx.messages': '对话',
  'stats.input': '输入 {count} tok',
  'stats.output': '输出 {count} tok',
  'stats.cacheHit': '缓存命中 {percent}%',
  'stats.speed': '{tps} tok/s',
}

const t = ((key: string, params?: Record<string, unknown>): string =>
  COPY[key]!.replace(/\{(\w+)\}/gu, (_whole, name: string): string => String(params?.[name] ?? ''))) as TranslateNS<'tavern'>

function element(props: {
  usage?: Record<string, number>
  pressure?: Record<string, number>
  breakdown?: Record<string, number>
  sessionStats?: Record<string, number>
}): ReactElement {
  return (
    <ChatComposer
      directory={undefined}
      usage={props.usage as never}
      pressure={props.pressure as never}
      breakdown={props.breakdown as never}
      sessionStats={props.sessionStats as never}
      draft='你好'
      onDraft={() => undefined}
      onSend={() => undefined}
      stoppable={false}
      onStop={() => undefined}
      placeholder='对 DM 说…'
      t={t}
    />
  )
}

function composer(props: {
  usage?: Record<string, number>
  pressure?: Record<string, number>
  breakdown?: Record<string, number>
  sessionStats?: Record<string, number>
}): RenderResult {
  return render(element(props))
}

/** The settled-projection numbers shared with the tests-client-plane anchors. */
const BILLED = { uncachedInputTokens: 100, outputTokens: 250, cacheReadTokens: 900, cacheWriteTokens: 1000 }
const PRESSURE = { pressureTokens: 1000, projectedTokens: 20000, contextWindow: 131072 }
const BREAKDOWN = { systemTokens: 2600, toolsTokens: 1400, messageTokens: 800 }

describe('chat composer context ring (the composer owns the stock occupancy rule)', () => {
  it('shows the zero usage line and renders no ring before any settlement', () => {
    composer({})
    expect(screen.getByText('输入 0 tok ｜ 输出 0 tok ｜ 缓存命中 0% ｜ 0 tok/s')).toBeDefined()
    // The stock ContextMeter rule: known numerator and window or no meter —
    // never a parked 0% ring.
    expect(screen.queryByTitle(/上下文已用/u)).toBeNull()
  })

  it('does not render the ring while the pressure or window half is missing', () => {
    const first = composer({ breakdown: BREAKDOWN, pressure: { pressureTokens: 1000, projectedTokens: 20000 } })
    expect(screen.queryByTitle(/上下文已用/u)).toBeNull()
    first.unmount()
    composer({ breakdown: BREAKDOWN, pressure: { contextWindow: 131072 } })
    expect(screen.queryByTitle(/上下文已用/u)).toBeNull()
  })

  it('falls back to pressureTokens before a projected sample exists and caps at the window', () => {
    // No usage sample movement since the last sample yet (projectedTokens
    // absent): the stock rule reads the bare provider pressure.
    const pre = composer({ pressure: { pressureTokens: 20000, contextWindow: 131072 } })
    expect(screen.getByTitle('上下文已用 15%')).toBeDefined()
    pre.unmount()
    // A sample far beyond the window clamps at 100 (Math.min), never >100.
    composer({ pressure: { projectedTokens: 999999, contextWindow: 131072 } })
    expect(screen.getByTitle('上下文已用 100%')).toBeDefined()
  })

  it('reports occupancy and lists the breakdown proportions', async () => {
    composer({ usage: BILLED, sessionStats: { decodeMs: 5000, decodeTokens: 250 }, pressure: PRESSURE, breakdown: BREAKDOWN })
    expect(screen.getByText('输入 2K tok ｜ 输出 250 tok ｜ 缓存命中 45% ｜ 50 tok/s')).toBeDefined()
    fireEvent.click(screen.getByTitle('上下文已用 15%'))
    expect(await screen.findByText('~19.5K / 128K')).toBeDefined()
    expect(screen.getByText('~2.5K')).toBeDefined()
    expect(screen.getByText('~1.4K')).toBeDefined()
    expect(screen.getByText('~800')).toBeDefined()
  })

  it('degrades the panel to a neutral total segment per stock when the breakdown is absent or flat', async () => {
    // No breakdown projection: rows stay withheld (no ~0 placeholders) and the
    // bar falls back to one neutral full-width segment at the occupancy width.
    const absent = composer({ pressure: PRESSURE })
    fireEvent.click(screen.getByTitle('上下文已用 15%'))
    const panel = await screen.findByRole('dialog')
    expect(panel.querySelector('span[style*="15%"]')).toBeDefined()
    expect(screen.queryByText('~2.5K')).toBeNull()
    expect(screen.queryByText('~0')).toBeNull()
    absent.unmount()
    // Breakdown present but every bucket zero: stock still draws the rows at ~0
    // next to the same neutral segment.
    const flat = composer({ pressure: PRESSURE, breakdown: { systemTokens: 0, toolsTokens: 0, messageTokens: 0 } })
    fireEvent.click(screen.getByTitle('上下文已用 15%'))
    expect(await screen.findByRole('dialog')).toBeDefined()
    expect(flat.container.querySelectorAll('dd').length).toBe(3)
    flat.unmount()
  })

  it('closes the panel on outside pointerdown and Escape', async () => {
    composer({ pressure: PRESSURE, breakdown: BREAKDOWN })
    fireEvent.click(screen.getByTitle('上下文已用 15%'))
    expect(await screen.findByText('~19.5K / 128K')).toBeDefined()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText('~19.5K / 128K')).toBeNull()
    fireEvent.click(screen.getByTitle('上下文已用 15%'))
    expect(await screen.findByText('~19.5K / 128K')).toBeDefined()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByText('~19.5K / 128K')).toBeNull()
  })

  it('auto-closes the panel while unavailable so the meter does not resurface pre-opened', async () => {
    const view = render(element({ pressure: PRESSURE, breakdown: BREAKDOWN }))
    fireEvent.click(screen.getByTitle('上下文已用 15%'))
    expect(await screen.findByRole('dialog')).toBeDefined()
    view.rerender(element({}))
    expect(screen.queryByTitle(/上下文已用/u)).toBeNull()
    view.rerender(element({ pressure: PRESSURE, breakdown: BREAKDOWN }))
    expect(screen.getByTitle('上下文已用 15%')).toBeDefined()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
