// @vitest-environment jsdom
// 存档「载入」失败面回归钉(2026-09-24):此前拒绝分支 `() => undefined` 把
// 引擎换绑失败(Windows 热文件竞态抛 EPERM)吞成「弹窗卡死 + 双面板红框」,
// console 全静默,只能 F5 靠猜。现在失败上屏(行内错误行+console 留痕+
// 按钮恢复可点)。独立成文件——tests-client-plane 的 TavernView 套件因宿主
// prelude 缺口从未被 glob 匹配(vitest.config.ts KNOWN GAP);这里绕开
// client-runtime(makeTranslate 会拉进 kernel client.js),用本地 translate stub。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TavernView } from '../src/client/TavernView.tsx'
import { zh } from '../src/client/locales.ts'
import type { TavernRpc } from '../src/client/rpc.ts'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const SESSION = 'session-1'
// 本地 translate(避开 client-runtime 的 kernel 链):key → zh 词表直查。
const t = ((key: string) => (zh as unknown as Record<string, string>)[key] ?? key) as never

/** One interaction face is enough: a save row whose 「载入」 fails. 其余面取
 *  client-plane 套件同款的中性桩——WorkspacePanel 挂载要 readText/tree/library。 */
function failingLoadRpc(reason: string): TavernRpc {
  const meta = `${JSON.stringify({ title: '小镇酒馆', desc: 'DND 5e', cover: '' }, undefined, 2)}\n`
  return {
    createSession: () => Promise.resolve({ sessionId: 's-new' }),
    workspaces: () => Promise.resolve({ rows: [] }),
    saves: () => Promise.resolve({ saves: [{ name: '第一次抉择', type: 'manual', summary: '' }] }),
    load: () => Promise.reject(new Error(reason)),
    save: () => Promise.resolve({ ok: true as const }),
    deleteSave: () => Promise.resolve({ ok: true as const }),
    retryPoint: () => Promise.resolve({ sessionId: 'session-fresh', text: '' }),
    reset: () => Promise.resolve({ sessionId: 'session-fresh', draft: '' }),
    state: () => Promise.resolve({
      hasCard: true, maintenanceOn: false, narratorToolsOn: true, title: '', desc: '', cover: '',
      drafting: false, editing: null, tailRunning: false, dialogStarted: false, retryable: false,
    }),
    tailTranscript: () => Promise.resolve({ tails: [] }),
    readText: (request: { path: string }) => {
      if (request.path === 'preset/meta.json') return Promise.resolve({ text: meta })
      if (request.path.endsWith('maintenancePrompt')) return Promise.resolve({ text: '' })
      return Promise.resolve({ text: '# 世界状态' })
    },
    tree: () => Promise.resolve({ entries: [
      { path: 'preset/', dir: true },
      { path: 'preset/prompt/systemPrompt', dir: false },
      { path: 'runtime/', dir: true },
      { path: 'runtime/state.md', dir: false },
    ] }),
    library: () => Promise.resolve({ cards: [] }),
    opening: () => Promise.resolve({ html: null }),
    readAsset: () => Promise.resolve({ dataUrl: 'data:image/png;base64,' }),
    readLibraryAsset: () => Promise.resolve({ dataUrl: 'data:image/png;base64,' }),
    ensureWriter: () => Promise.resolve({ sessionId: 'session-writer' }),
    stop: () => Promise.resolve({ accepted: true as const, tailStopped: false }),
    runScript: () => Promise.resolve({ text: '' }),
    writeText: () => Promise.resolve({ ok: true as const }),
    writeAsset: () => Promise.resolve({ ok: true as const }),
    fileOp: () => Promise.resolve({ ok: true as const }),
    deleteCard: () => Promise.resolve({ ok: true as const }),
    importFromLibrary: () => Promise.resolve({ ok: true as const }),
    draftCard: () => Promise.resolve({ ok: true as const }),
    editFromLibrary: () => Promise.resolve({ ok: true as const }),
    cancelEdit: () => Promise.resolve({ ok: true as const }),
    publishCard: () => Promise.resolve({ name: '卡' }),
    saveEdit: () => Promise.resolve({ name: '卡' }),
    editDirty: () => Promise.resolve({ dirty: false }),
    commitImport: () => Promise.resolve({ name: '卡' }),
    cancelDraft: () => Promise.resolve({ ok: true as const }),
    deleteSession: () => Promise.resolve({ ok: true as const }),
    prompt: () => Promise.resolve({ accepted: true }),
  } as TavernRpc
}

/** Faces the writer column binds through — the same stub shape the client-plane suite uses. */
function writerFaces(): { sessions: object; models: undefined; conversation: { conversationStoreKey: () => string }; checkKey: () => Promise<boolean>; onNeedKey: () => void } {
  const noop = (): Promise<{ ok: true; value: { accepted: true } }> => Promise.resolve({ ok: true as const, value: { accepted: true } })
  const snapshot = { running: false, openState: 'open', openError: null, promptError: null }
  const sessions = {
    binding: () => ({
      eventSource: { getSnapshot: () => ({ entries: [] }), subscribe: () => () => undefined },
      session: { subscribe: () => () => undefined, getSnapshot: () => snapshot, prompt: noop, cancel: noop, projections: { faceOf: () => undefined } },
    }),
    prompt: noop,
    cancel: noop,
    openWindow: () => undefined,
  }
  return {
    sessions,
    models: undefined,
    conversation: { conversationStoreKey: () => 'dsh.conversation' },
    checkKey: async () => false,
    onNeedKey: () => undefined,
  }
}

describe('存档载入失败不再静默(2026-09-24 Windows 热文件竞态回归钉)', () => {
  it('失败显式上屏:行内错误行带引擎原文,console 留痕,按钮恢复可点', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    render(
      <TavernView
        {...writerFaces()}
        rpc={failingLoadRpc('tavern rpc failed: tavern/save-failed: EPERM: runtime 卸位失败')}
        sessionId={SESSION}
        t={t}
        initialTab='saves'
      />,
    )
    await screen.findByText('第一次抉择')
    fireEvent.click(screen.getAllByText('载入')[0]!)
    await waitFor(() => { expect(screen.getByText(/载入失败.*EPERM/)).toBeDefined() })
    expect(warn).toHaveBeenCalled()
    // 载入中被禁用,失败后按钮回到原文(可重试),不留在「载入中…」死态。
    expect(screen.queryByText('载入中…')).toBeNull()
    expect(screen.getAllByText('载入')[0]).toBeDefined()
  })
})
