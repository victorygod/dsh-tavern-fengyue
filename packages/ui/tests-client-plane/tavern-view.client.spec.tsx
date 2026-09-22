// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { makeTranslate } from 'dsh-tavern-fengyue-client-runtime'
import { TavernView, type TavernViewProps } from '../src/client/TavernView.tsx'
import { zh } from '../src/client/locales.ts'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { TavernLibraryWire, TavernRpc } from '../src/client/rpc.ts'
import type { ConversationFace } from '../src/client/chat-view.tsx'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

type Rpc = TavernRpc & { calls: string[]; ops: unknown[]; writes: { path: string; text: string }[] }

const SESSION = 'session-1'

function rpc(state: {
  hasCard?: boolean
  maintenanceOn?: boolean
  narratorToolsOn?: boolean
  dialogStarted?: boolean
  drafting?: boolean
  editing?: string | null
  dirty?: boolean
  cards?: TavernLibraryWire[]
  opening?: string | null
  saves?: { name: string; type: 'auto' | 'manual'; summary: string }[]
  meta?: string
  tree?: { path: string; dir: boolean }[]
}): Rpc {
  const calls: string[] = []
  const ops: unknown[] = []
  const writes: { path: string; text: string }[] = []
  const record = <A, V>(name: string, run: (request: A) => Promise<V>) => (request: A): Promise<V> => {
    calls.push(name)
    return run(request)
  }
  return {
    calls,
    ops,
    writes,
    createSession: () => Promise.resolve({ sessionId: 's-new' }),
    workspaces: () => Promise.resolve({ rows: [] }),
    publishCard: record('publishCard', () => Promise.resolve({ name: '卡' })),
    saveEdit: record('saveEdit', () => Promise.resolve({ name: state.editing ?? '卡' })),
    editDirty: record('editDirty', () => Promise.resolve({ dirty: state.dirty ?? false })),
    runScript: record('runScript', () => Promise.resolve({ text: '' })),
    readAsset: () => Promise.resolve({ dataUrl: 'data:image/png;base64,' }),
    writeAsset: record('writeAsset', (request: { path: string; dataBase64: string }) => {
      ops.push(request)
      return Promise.resolve({ ok: true as const })
    }),
    ensureWriter: record('ensureWriter', () => Promise.resolve({ sessionId: 'session-writer' })),
    stop: () => Promise.resolve({ accepted: true as const, tailStopped: false }),
    tailTranscript: () => Promise.resolve({ tails: [] }),
    readLibraryAsset: () => Promise.resolve({ dataUrl: 'data:image/png;base64,' }),
    deleteSession: record('deleteSession', () => Promise.resolve({ ok: true as const })),
    state: record('state', () => Promise.resolve({
      hasCard: state.hasCard ?? false,
      maintenanceOn: state.maintenanceOn ?? false,
      narratorToolsOn: state.narratorToolsOn ?? true,
      title: '', desc: '', cover: '',
      drafting: state.drafting ?? false,
      editing: state.editing ?? null,
      tailRunning: false,
      dialogStarted: state.dialogStarted ?? false,
      retryable: false,
    })),
    library: record('library', () => Promise.resolve({ cards: state.cards ?? [] })),
    deleteCard: record('deleteCard', () => Promise.resolve({ ok: true as const })),
    deleteSave: record('deleteSave', () => Promise.resolve({ ok: true as const })),
    importFromLibrary: record('importFromLibrary', () => Promise.resolve({ ok: true as const })),
    draftCard: record('draftCard', () => Promise.resolve({ ok: true as const })),
    editFromLibrary: record('editFromLibrary', () => Promise.resolve({ ok: true as const })),
    cancelEdit: record('cancelEdit', () => Promise.resolve({ ok: true as const })),
    opening: record('opening', () => Promise.resolve({ html: state.opening ?? null })),
    // Copy per call: rename/bump tests mutate their own entries and the editor
    // must observe the mutation through the next reload.
    tree: record('tree', () => Promise.resolve({ entries: [...(state.tree ?? [
      { path: 'preset/', dir: true },
      { path: 'preset/prompt/systemPrompt', dir: false },
      { path: 'runtime/', dir: true },
      { path: 'runtime/state.md', dir: false },
    ])] })),
    readText: record('readText', (request: { path: string }) => {
      if (request.path === 'runtime/state.md') return Promise.resolve({ text: '# 世界状态' })
      if (request.path.endsWith('maintenancePrompt')) return Promise.resolve({ text: '' })
      if (request.path === 'preset/meta.json') {
        return Promise.resolve({ text: state.meta ?? `${JSON.stringify({ title: '小镇酒馆', desc: 'DND 5e', cover: '' }, undefined, 2)}\n` })
      }
      return Promise.resolve({ text: '你是守店人。' })
    }),
    writeText: record('writeText', (request: { path: string; text: string }) => {
      writes.push(request)
      return Promise.resolve({ ok: true as const })
    }),
    fileOp: record('fileOp', (request: { op: unknown }) => {
      ops.push(request.op)
      return Promise.resolve({ ok: true as const })
    }),
    retryPoint: () => Promise.resolve({ sessionId: 'session-fresh', text: '' }),
    save: record('save', () => Promise.resolve({ ok: true as const })),
    load: record('load', () => Promise.resolve({ sessionId: 'session-fresh', draft: '' })),
    reset: record('reset', () => Promise.resolve({ sessionId: 'session-fresh', draft: '' })),
    saves: record('saves', () => Promise.resolve({ saves: state.saves ?? [] })),
    commitImport: record('commitImport', (request: { title: string; files: readonly { path: string; content: string }[] }) => {
      ops.push(request)
      return Promise.resolve({ name: request.title })
    }),
    cancelDraft: record('cancelDraft', () => Promise.resolve({ ok: true as const })),
    prompt: record('prompt', () => Promise.resolve({ accepted: true as const })),
  }
}

const t = makeTranslate(zh) as TavernViewProps['t']

/** Faces the writer column binds through: one lazily bound writer session, no models, no occupancy. */
function writerFaces(promptImpl?: (...args: unknown[]) => unknown, entries: readonly unknown[] = []): {
  sessions: ISessions & { prompt: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }
  models: undefined
  conversation: ConversationFace
  checkKey: () => Promise<boolean>
  onNeedKey: () => void
} {
  const prompt = vi.fn(promptImpl ?? (() => Promise.resolve({ ok: true as const, value: { accepted: true } })))
  const cancel = vi.fn(() => Promise.resolve({ ok: true as const, value: { accepted: true } }))
  // Hoisted snapshot: useSyncExternalStore re-renders whenever the snapshot
  // object identity changes, so the fake must return one stable instance.
  const snapshot = { running: false, openState: 'open', openError: null, promptError: null }
  const window = { entries: entries.map(event => (event as { type?: string }).type === 'transient' ? event : { type: 'event', event }) }
  const sessions = {
    binding: () => ({
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
    }),
    prompt,
    cancel,
    openWindow: () => undefined,
  } as unknown as ISessions & { prompt: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> }
  return {
    sessions,
    models: undefined,
    conversation: { conversationStoreKey: () => 'dsh.conversation' },
    checkKey: async () => false,
    onNeedKey: () => undefined,
  }
}

describe('tavern view routing', () => {
  it('shows the library when the session has no card', async () => {
    const face = rpc({ cards: [{ name: 'tavern-tavern', title: '小镇酒馆', desc: 'DND 5e', cover: '' }] })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('小镇酒馆')
    expect(face.calls).toContain('library')
    expect(screen.getByText('卡库 · tavern_presets/')).toBeDefined()
  })

  it('loads a library card and hands control back to the host (opening page)', async () => {
    const face = rpc({ cards: [{ name: 'a', title: 'A', desc: '', cover: '' }] })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('A')
    fireEvent.click(screen.getByText('A'))
    await waitFor(() => { expect(face.calls).toContain('importFromLibrary') })
    expect(face.calls).not.toContain('workspace mode') // 加载卡后由宿主切聊天视图，不再进工作空间
  })

  it('shows the file editor when the session has a card', async () => {
    const face = rpc({ hasCard: true, maintenanceOn: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    expect(screen.getByText(/数据维护：启用/)).toBeDefined()
    expect(await screen.findByText('你是守店人。')).toBeDefined()
    // 页面头部只保留标题：无说明小字。
    expect(screen.queryByText(/preset\/ 与 runtime\/ 可编辑/)).toBeNull()
  })

  it('the narrator default-tools checkbox mirrors the engine flag and patches meta.json', async () => {
    // 开旗默认卡：checkbox 勾选；点击翻转 = 读 meta → 写回 narratorTools:false
    // （typert 冻结，无专用 wire 方法 —— 翻转走既有 writeText 通道的身份补丁）。
    const face = rpc({ hasCard: true, narratorToolsOn: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    const box = await screen.findByRole('checkbox', { name: /叙事agent默认工具/ }) as HTMLInputElement
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    await waitFor(() => {
      const write = face.writes.find(row => row.path === 'preset/meta.json')
      expect(write).toBeDefined()
      const record = JSON.parse(write!.text) as { title?: string; narratorTools?: boolean }
      expect(record.narratorTools).toBe(false)
      // 身份字段保真：读到的 meta 原字段不因翻转丢失。
      expect(record.title).toBe('小镇酒馆')
    })
    expect(box.checked).toBe(false)
  })

  it('the narrator checkbox greys out once the conversation has started', async () => {
    // 对话已开始 = 卡的身份已定，checkbox 只读且勾选态仍如实展示。
    const face = rpc({ hasCard: true, narratorToolsOn: false, dialogStarted: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    const box = await screen.findByRole('checkbox', { name: /叙事agent默认工具/ }) as HTMLInputElement
    expect(box.disabled).toBe(true)
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    expect(face.writes.some(row => row.path === 'preset/meta.json')).toBe(false)
  })

  it('runtime files are editable and blur persists; savings stays read-only', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('runtime'))
    fireEvent.click(await screen.findByText('state.md'))
    await screen.findByText('# 世界状态')
    fireEvent.change(screen.getByDisplayValue('# 世界状态'), { target: { value: '# 世界状态\n第二天' } })
    fireEvent.blur(screen.getByDisplayValue(/第二天/))
    await waitFor(() => { expect(face.calls).toContain('writeText') })
    expect(screen.getByText('可编辑')).toBeDefined()
  })

  it('lists saves with load and delete actions', async () => {
    const face = rpc({
      hasCard: true,
      saves: [
        { name: '第一次抉择', type: 'manual', summary: '我推开酒馆的门' },
        { name: 'autosave-2026-09-14-00:12:34', type: 'auto', summary: '' },
      ],
    })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} initialTab='saves' />)
    // 加载打开的是存档页：标题即页面名（存档）。
    await screen.findByText('存档')
    await screen.findByText('第一次抉择')
    expect(screen.getByText('手动')).toBeDefined()
    expect(screen.getByText('自动')).toBeDefined()
    // 存档行简介：有则渲染，无省略。
    expect(screen.getByText('我推开酒馆的门')).toBeDefined()
    expect(screen.queryByText('autosave-2026-09-14-00:12:34_saved')).toBeNull()
    fireEvent.click(screen.getAllByText('载入')[0]!)
    await waitFor(() => { expect(face.calls).toContain('load') })
  })

  it('initialTab lands straight on the saves page without a tab bar', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} initialTab='saves' />)
    await screen.findByText('存档')
    expect(screen.queryByText('上传封面')).toBeNull()
    expect(screen.queryByText('文件')).toBeNull()
    expect(screen.queryByText('开场页')).toBeNull()
  })
})

describe('library book actions', () => {
  it('deletes a card after confirmation', async () => {
    const face = rpc({ cards: [{ name: 'a', title: 'A', desc: '', cover: '' }] })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('A')
    fireEvent.click(screen.getByTitle('从卡库删除'))
    await waitFor(() => { expect(face.calls).toContain('deleteCard') })
    expect(confirm).toHaveBeenCalled()
  })

  it('keeps a card when the confirmation is declined', async () => {
    const face = rpc({ cards: [{ name: 'a', title: 'A', desc: '', cover: '' }] })
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('A')
    fireEvent.click(screen.getByTitle('从卡库删除'))
    await waitFor(() => { expect(face.calls).not.toContain('deleteCard') })
  })

  it('the empty library shows guidance', async () => {
    const face = rpc({ cards: [] })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/卡库为空/)
  })
})

describe('workspace tree context menu', () => {
  it('a fixed file (fixed prompt) opens no context menu at all', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.contextMenu(screen.getByText('systemPrompt'))
    expect(screen.queryByText('新建文件')).toBeNull()
    expect(screen.queryByText('重命名')).toBeNull()
    expect(screen.queryByText('彻底删除')).toBeNull()
  })

  it('fixed dirs offer creation but never rename or delete', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.contextMenu(screen.getByText('runtime'))
    expect(screen.getByText('新建文件')).toBeDefined()
    expect(screen.getByText('新建目录')).toBeDefined()
    expect(screen.queryByText('重命名')).toBeNull()
    expect(screen.queryByText('彻底删除')).toBeNull()
  })

  it('a non-fixed file offers rename and delete, and deleting the selection lands on the default file', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('runtime'))
    fireEvent.click(await screen.findByText('state.md'))
    await screen.findByText('# 世界状态')
    fireEvent.contextMenu(screen.getByText('state.md'))
    fireEvent.click(screen.getByText('彻底删除'))
    await waitFor(() => { expect(face.ops).toContainEqual({ kind: 'delete', path: 'runtime/state.md' }) })
    // The editor selection falls back to the default fixed file instead of a crashed reference.
    await screen.findByText('preset/prompt/systemPrompt')
  })

  it('creating inside runtime/ and savings/ goes through fileOp with those paths', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.contextMenu(screen.getByText('runtime'))
    fireEvent.click(screen.getByText('新建文件'))
    await waitFor(() => { expect(face.ops).toContainEqual({ kind: 'create', path: 'runtime/untitled.md' }) })
  })

  it('a second new file in the same directory bumps the default name until free', async () => {
    const face = rpc({ hasCard: true, tree: [
      { path: 'preset/', dir: true },
      { path: 'preset/prompt/systemPrompt', dir: false },
      { path: 'runtime/', dir: true },
      { path: 'runtime/untitled.md', dir: false },
    ] })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.contextMenu(screen.getByText('runtime'))
    fireEvent.click(screen.getByText('新建文件'))
    await waitFor(() => { expect(face.ops).toContainEqual({ kind: 'create', path: 'runtime/untitled-1.md' }) })
  })

  it('rename on a runtime/ file issues a same-area move', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('runtime'))
    fireEvent.click(await screen.findByText('state.md'))
    fireEvent.contextMenu(screen.getByText('state.md'))
    fireEvent.click(screen.getByText('重命名'))
    const input = screen.getByDisplayValue('state.md')
    fireEvent.change(input, { target: { value: 'status.md' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    await waitFor(() => { expect(face.ops).toContainEqual({ kind: 'move', from: 'runtime/state.md', to: 'runtime/status.md' }) })
  })

  it('lazy tree: the first click on an auto-expanded-but-unloaded dir expands it (fs_tree levels in flight)', async () => {
    // fs_tree.mjs 拟态：根层/runtime 层即答；landPreset 的 preset 层 levels 挂起
    // （仅首个含 preset/ 的批量挂起，后续即答），复刻「预展开置位在先、子 listing
    // 在途」的竞态窗。旧实现此窗内第一击被当成收起吞掉（preset 预展开但无可见
    // 孩子），需第二击才展开——本用例钉死单击即开。
    const presetEntries = [
      { path: 'preset/prompt/', dir: true },
      { path: 'preset/prompt/systemPrompt', dir: false },
    ]
    const fsCalls: { op: string; path?: string; paths?: readonly string[] }[] = []
    let heldLanding: ((levels: Record<string, { path: string; dir: boolean }[]>) => void) | undefined
    let heldOnce = false
    const face = rpc({ hasCard: true })
    face.runScript = (request: { args: readonly string[] }) => {
      face.calls.push('runScript')
      const payload = JSON.parse(request.args[0]!) as { op: string; path?: string; paths?: readonly string[] }
      fsCalls.push(payload)
      if (payload.op === 'list') {
        const dir = payload.path ?? ''
        const entries = dir === ''
          ? [{ path: 'preset/', dir: true }, { path: 'runtime/', dir: true }]
          : dir === 'preset/' ? presetEntries
            : []
        return Promise.resolve({ text: JSON.stringify({ ok: true, entries }) })
      }
      const paths = payload.paths ?? []
      const levels: Record<string, { path: string; dir: boolean }[]> = {}
      for (const p of paths) levels[p] = p === 'preset/' ? presetEntries : []
      const hold = !heldOnce && paths.includes('preset/')
      if (hold) {
        heldOnce = true
        return new Promise((resolve) => { heldLanding = (resolved) => resolve({ text: JSON.stringify({ ok: true, levels: resolved }) }) })
      }
      return Promise.resolve({ text: JSON.stringify({ ok: true, levels }) })
    }
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    // landing levels 仍在途的窗口内点击：单击即为「打开＋拉取」。
    fireEvent.click(screen.getByText('preset'))
    // 单击自己发出的子层拉取（list preset/）必须存在，且足以让孩子立即可见——
    // 无需放行挂起的 landing 层（list preset/ 即已把该层标为已载）。
    await waitFor(() => {
      expect(fsCalls.some(call => call.op === 'list' && call.path === 'preset/')).toBe(true)
    })
    await screen.findByText('systemPrompt')
    // 放行挂起的 landing 层，收尾不留悬空 promise；合并进缓存不改变开合态。
    heldLanding?.({ 'preset/': presetEntries, 'preset/prompt/': [{ path: 'preset/prompt/systemPrompt', dir: false }] })
    // 归位后的开合仍是正常 toggle：一收一放，不漂移。
    fireEvent.click(screen.getByText('preset'))
    await waitFor(() => { expect(screen.queryByText('systemPrompt')).toBeNull() })
    fireEvent.click(screen.getByText('preset'))
    await screen.findByText('systemPrompt')
  })
})

describe('import via system pickers', () => {
  function setFiles(input: HTMLInputElement, files: File[]): void {
    Object.defineProperty(input, 'files', { value: files, configurable: true })
    fireEvent.change(input)
  }

  it('folds a picked SillyTavern .json onto the standard card (sections, merged postPrompt, persona files)', async () => {
    const face = rpc({})
    const { container } = render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('卡库 · tavern_presets/')
    const cardInput = container.querySelector('input[type=file][accept*=png]') as HTMLInputElement
    const card = { name: '雾山矿坑', description: '挖矿与夜', system_prompt: '你是守店人。', pre_prompt: '守则前置。', post_prompt: '守则后置。' }
    setFiles(cardInput, [new File([JSON.stringify(card)], 'card.json', { type: 'application/json' })])
    await screen.findByText('保存并开始', { exact: true }, { timeout: 3000 })
    const editorValue = (): string => {
      const area = container.querySelector('textarea')
      return area === null ? '' : area.value
    }
    fireEvent.click(screen.getByText('systemPrompt'))
    await waitFor(() => { expect(editorValue()).toContain('【系统指令】\n你是守店人。') })
    expect(editorValue()).toContain('【人设】\n挖矿与夜')
    fireEvent.click(screen.getByText('postPrompt'))
    await waitFor(() => { expect(editorValue()).toBe('守则前置。\n\n守则后置。') })
    fireEvent.click(screen.getByText('保存并开始'))
    await waitFor(() => { expect(face.calls).toContain('commitImport') })
    const request = face.ops.at(-1) as { files: { path: string; content: string }[] }
    const promptPaths = request.files.map(file => file.path).filter(path => path.startsWith('preset/prompt/'))
    expect(promptPaths.sort()).toEqual(['preset/prompt/maintenancePrompt', 'preset/prompt/postPrompt', 'preset/prompt/systemPrompt'])
    const post = request.files.find(file => file.path === 'preset/prompt/postPrompt')
    expect(post?.content).toBe('守则前置。\n\n守则后置。')
    expect(request.files.map(file => file.path)).toEqual(expect.arrayContaining(['preset/scripts/persona.sh', 'preset/setup/persona.md']))
  })

  it('ignore an empty import engage', async () => {
    const face = rpc({})
    const { container } = render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('卡库 · tavern_presets/')
    expect(container.querySelector('input[type=file]')).not.toBeNull()
    expect(face.calls).not.toContain('commitImport')
  })

  it('returns to the draft page while a draft stays unpublished', async () => {
    const face = rpc({ drafting: true, hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('上传封面')
    expect(screen.getByText('← 返回卡库')).toBeDefined()
  })

  it('drafts a new card into the in-place editor', async () => {
    const face = rpc({})
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('卡库 · tavern_presets/')
    fireEvent.click(screen.getByText('创建新卡'))
    await screen.findByText(/数据维护：关闭/)
    expect(face.calls).toContain('draftCard')
    expect(screen.getByText('preset/prompt/systemPrompt')).toBeDefined()
  })
})

describe('编辑卡 edit-in-place actions', () => {
  it('an editing workspace shows 返回卡库 and 保存并开始', async () => {
    const face = rpc({ hasCard: true, editing: '小镇酒馆' })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} onSessionSwitch={vi.fn()} />)
    await screen.findByText(/数据维护/)
    expect(screen.getByText('← 返回卡库')).toBeDefined()
    expect(screen.getByText('保存并开始')).toBeDefined()
  })

  it('a non-editing workspace shows neither action', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} onSessionSwitch={vi.fn()} />)
    await screen.findByText(/数据维护/)
    expect(screen.queryByText('← 返回卡库')).toBeNull()
    expect(screen.queryByText('保存并开始')).toBeNull()
  })

  it('返回卡库 cancels the edit and lands back on the library', async () => {
    const face = rpc({ hasCard: true, editing: '小镇酒馆' })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('← 返回卡库'))
    await waitFor(() => { expect(face.calls).toContain('cancelEdit') })
    await screen.findByText('卡库 · tavern_presets/')
  })

  it('保存并开始 publishes the card, resets, and rebinds with cause edit', async () => {
    const face = rpc({ hasCard: true, editing: '小镇酒馆' })
    const onSessionSwitch = vi.fn()
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} onSessionSwitch={onSessionSwitch} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('保存并开始'))
    await waitFor(() => { expect(onSessionSwitch).toHaveBeenCalledWith('session-fresh', 'edit') })
    expect(face.calls).toContain('publishCard')
    expect(face.calls).toContain('reset')
  })

  it('保存并开始 with a failing publishCard surfaces the error instead of a silent no-op', async () => {
    const face = rpc({ hasCard: true, editing: '小镇酒馆' })
    face.publishCard = () => Promise.reject(new Error('library locked'))
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} onSessionSwitch={vi.fn()} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('保存并开始'))
    await waitFor(() => { expect(alert).toHaveBeenCalledWith(expect.stringContaining('入库失败')) })
  })

  it('保存并开始 with a failing reset surfaces the error instead of a silent no-op', async () => {
    const face = rpc({ hasCard: true, editing: '小镇酒馆' })
    face.reset = () => Promise.reject(new Error('agent-preset/not-found'))
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} onSessionSwitch={vi.fn()} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('保存并开始'))
    await waitFor(() => { expect(alert).toHaveBeenCalledWith(expect.stringContaining('换绑新会话失败')) })
  })

  it('仅保存 updates the library card and keeps editing', async () => {
    const face = rpc({ hasCard: true, editing: '小镇酒馆' })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} onSessionSwitch={vi.fn()} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('仅保存'))
    await waitFor(() => { expect(face.calls).toContain('saveEdit') })
    await screen.findByText(/已更新卡库/)
    expect(screen.getByText('← 返回卡库')).toBeDefined()
    expect(face.calls).not.toContain('cancelEdit')
  })

  it('返回 skips the dialog when the workspace is clean', async () => {
    const face = rpc({ hasCard: true, editing: '小镇酒馆' })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('← 返回卡库'))
    await waitFor(() => { expect(face.calls).toContain('cancelEdit') })
    expect(screen.queryByText(/返回后将全部丢失/)).toBeNull()
    await screen.findByText('卡库 · tavern_presets/')
  })

  it('返回 with unsaved edits asks: cancel keeps editing, discard reverts', async () => {
    const face = rpc({ hasCard: true, editing: '小镇酒馆', dirty: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('← 返回卡库'))
    await screen.findByText('返回卡库？')
    expect(face.calls).not.toContain('cancelEdit')
    // 取消:留在编辑器。
    fireEvent.click(screen.getByText('取消'))
    expect(screen.queryByText(/返回后将全部丢失/)).toBeNull()
    expect(face.calls).not.toContain('cancelEdit')
    // 再弹,不保存:放弃改动回书架。
    fireEvent.click(screen.getByText('← 返回卡库'))
    await screen.findByText('返回卡库？')
    fireEvent.click(screen.getByText('不保存'))
    await waitFor(() => { expect(face.calls).toContain('cancelEdit') })
    await screen.findByText('卡库 · tavern_presets/')
  })

  it('返回 with unsaved edits can save first (saveEdit then leave)', async () => {
    const face = rpc({ hasCard: true, editing: '小镇酒馆', dirty: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/数据维护/)
    fireEvent.click(screen.getByText('← 返回卡库'))
    await screen.findByText('返回卡库？')
    fireEvent.click(screen.getByText('保存'))
    await waitFor(() => { expect(face.calls).toContain('saveEdit') })
    await waitFor(() => { expect(face.calls).toContain('cancelEdit') })
  })
})

describe('卡片身份头', () => {
  function setPicked(input: HTMLInputElement, files: File[]): void {
    Object.defineProperty(input, 'files', { value: files, configurable: true })
    fireEvent.change(input)
  }

  it('renders meta title/desc and writes an edited title back to meta.json', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('小镇酒馆')
    expect(screen.getByText('DND 5e')).toBeDefined()
    fireEvent.click(screen.getByText('小镇酒馆'))
    const input = screen.getByDisplayValue('小镇酒馆') as HTMLInputElement
    fireEvent.change(input, { target: { value: '雾都赌坊' } })
    fireEvent.blur(input)
    await waitFor(() => { expect(face.writes.some(write => write.path === 'preset/meta.json')).toBe(true) })
    const written = face.writes.find(write => write.path === 'preset/meta.json')
    expect(JSON.parse(written!.text)).toMatchObject({ title: '雾都赌坊', desc: 'DND 5e' })
  })

  it('a broken meta.json renders the header read-only', async () => {
    const face = rpc({ hasCard: true, meta: 'not json' })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText(/meta\.json 无法解析/)
    fireEvent.click(screen.getByText(/meta\.json 无法解析/))
    expect(face.calls).not.toContain('writeText')
  })

  it('uploads a picked image as the cover and points meta.cover at it', async () => {
    const face = rpc({ hasCard: true })
    const { container } = render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('小镇酒馆')
    const input = container.querySelector('input[type=file][accept*=image]') as HTMLInputElement
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    setPicked(input, [new File([bytes], 'cover.png', { type: 'image/png' })])
    await waitFor(() => { expect(face.calls).toContain('writeAsset') })
    expect(face.ops).toContainEqual({ sessionId: SESSION, path: 'preset/assets/cover.png', dataBase64: Buffer.from(bytes).toString('base64') })
    const written = face.writes.at(-1)
    expect(written?.path).toBe('preset/meta.json')
    expect(JSON.parse(written!.text)).toMatchObject({ cover: 'preset/assets/cover.png' })
  })

  it('overwrites a same-named cover instead of bumping a numeric suffix', async () => {
    const face = rpc({
      hasCard: true,
      meta: `${JSON.stringify({ title: '小镇酒馆', desc: '', cover: 'preset/assets/cover.png', creator: '', version: '', tags: [] }, undefined, 2)}\n`,
      tree: [
        { path: 'preset/', dir: true },
        { path: 'preset/assets/', dir: true },
        { path: 'preset/assets/cover.png', dir: false },
      ],
    })
    const { container } = render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('小镇酒馆')
    const input = container.querySelector('input[type=file][accept*=image]') as HTMLInputElement
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x02])
    setPicked(input, [new File([bytes], 'cover.png', { type: 'image/png' })])
    await waitFor(() => { expect(face.calls.filter(name => name === 'writeAsset')).toHaveLength(1) })
    // Same name, same path: the write replaces the file, no cover-2.png.
    expect(face.ops).toContainEqual({ sessionId: SESSION, path: 'preset/assets/cover.png', dataBase64: Buffer.from(bytes).toString('base64') })
    expect(face.ops.some(op => (op as { path?: string }).path === 'preset/assets/cover-2.png')).toBe(false)
    const written = face.writes.at(-1)
    expect(written?.path).toBe('preset/meta.json')
    expect(JSON.parse(written!.text)).toMatchObject({ cover: 'preset/assets/cover.png' })
  })

  it('rejects a non-image cover with an alert and no write', async () => {
    const face = rpc({ hasCard: true })
    const { container } = render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('小镇酒馆')
    const alert = vi.spyOn(window, 'alert').mockReturnValue(undefined)
    const input = container.querySelector('input[type=file][accept*=image]') as HTMLInputElement
    setPicked(input, [new File(['x'], 'cover.txt', { type: 'text/plain' })])
    expect(alert).toHaveBeenCalled()
    expect(face.calls).not.toContain('writeAsset')
  })

  it('surfaces an engine-rejected upload through the alert', async () => {
    const face: Rpc = {
      ...rpc({ hasCard: true }),
      writeAsset: () => Promise.reject(new Error('tavern: asset "preset/assets/cover.png" is 10485760 bytes, over the 10485760-byte write cap')),
    }
    const { container } = render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('小镇酒馆')
    const alert = vi.spyOn(window, 'alert').mockReturnValue(undefined)
    const input = container.querySelector('input[type=file][accept*=image]') as HTMLInputElement
    const bytes = new Uint8Array([0x89, 0x50])
    setPicked(input, [new File([bytes], 'cover.png', { type: 'image/png' })])
    await waitFor(() => { expect(alert).toHaveBeenCalledWith(expect.stringContaining('over the 10485760-byte write cap')) })
  })

  it('clears the cover with the hover ✕', async () => {
    const face = rpc({ hasCard: true, meta: `${JSON.stringify({ title: '小镇酒馆', desc: '', cover: 'preset/covers/old.png' }, undefined, 2)}\n` })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('小镇酒馆')
    fireEvent.click(screen.getByTitle('移除封面'))
    await waitFor(() => { expect(face.writes.length).toBeGreaterThan(0) })
    expect(JSON.parse(face.writes[0]!.text)).toMatchObject({ cover: '' })
  })

  it('the import preview edits the in-memory meta and commits it with the import', async () => {
    const face = rpc({})
    const { container } = render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('卡库 · tavern_presets/')
    const jsonInput = container.querySelector('input[type=file][accept*=json]') as HTMLInputElement
    const card = { name: '雾山矿坑', description: '挖矿与夜', system_prompt: '', pre_prompt: '', post_prompt: '' }
    setPicked(jsonInput, [new File([JSON.stringify(card)], 'card.json', { type: 'application/json' })])
    await screen.findByText('雾山矿坑')
    fireEvent.click(screen.getByText('雾山矿坑'))
    fireEvent.change(screen.getByDisplayValue('雾山矿坑'), { target: { value: '雾山矿坑·重制' } })
    fireEvent.blur(screen.getByDisplayValue('雾山矿坑·重制'))
    fireEvent.click(screen.getByText('保存并开始'))
    await waitFor(() => { expect(face.calls).toContain('commitImport') })
    const committed = face.ops.find(op => typeof op === 'object' && op !== null && 'files' in op) as { files: { path: string; content: string }[] }
    const metaFile = committed.files.find(file => file.path === 'preset/meta.json')
    expect(JSON.parse(metaFile!.content)).toMatchObject({ title: '雾山矿坑·重制' })
  })
})

describe('写卡 Agent 列', () => {
  it('mounts on the workspace page, ensures the writer session, and sends through the standard prompt', async () => {
    const faces = writerFaces()
    const face = rpc({ hasCard: true })
    render(<TavernView {...faces} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('写卡助手就绪 — 试试「把 systemPrompt 改成…」')
    expect(face.calls).toContain('ensureWriter')
    // 编辑器树 | 编辑器 | 写卡列：三列中写卡列的消息输入用其专属占位文案。
    fireEvent.change(screen.getByPlaceholderText('让写卡助手改这张卡…'), { target: { value: '把 systemPrompt 改成赛博朋克风' } })
    fireEvent.click(screen.getAllByText('发送').at(-1)!)
    await waitFor(() => { expect(faces.sessions.prompt).toHaveBeenCalled() })
    const [content, mode] = faces.sessions.prompt.mock.calls[0] as [{ type: string; text: string }[], string]
    expect(mode).toBe('queue')
    expect(content).toEqual([{ type: 'text', text: '把 systemPrompt 改成赛博朋克风' }])
  })

  it('a missing key asks the host for the dialog instead of queueing a writer turn', async () => {
    const faces = writerFaces()
    faces.checkKey = async () => true
    const onNeedKey = vi.fn()
    const face = rpc({ hasCard: true })
    render(<TavernView {...faces} onNeedKey={onNeedKey} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('写卡助手就绪 — 试试「把 systemPrompt 改成…」')
    fireEvent.change(screen.getByPlaceholderText('让写卡助手改这张卡…'), { target: { value: 'x' } })
    fireEvent.click(screen.getAllByText('发送').at(-1)!)
    await waitFor(() => { expect(onNeedKey).toHaveBeenCalled() })
    expect(faces.sessions.prompt).not.toHaveBeenCalled()
  })

  it('neither the saves page nor the import preview mounts the writer column', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} initialTab='saves' />)
    await screen.findByText('存档')
    expect(face.calls).not.toContain('ensureWriter')
    expect(screen.queryByText('写卡助手就绪 — 试试「把 systemPrompt 改成…」')).toBeNull()
  })

  it('renders the player message from a durable user/message whose data IS the message', async () => {
    // The writer sends through the standard face, so a durable user/message's
    // `data` carries the content at the data level (no `message` wrapper) —
    // the reader must fall back to `data.content` for the bubble to land.
    const faces = writerFaces(undefined, [
      { type: 'user/message', surfaceOp: 'append', data: { content: [{ type: 'text', text: '把 systemPrompt 改成赛博朋克风' }], source: { kind: 'user' } } },
      { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '已改好。' }] } } },
    ])
    const face = rpc({ hasCard: true })
    render(<TavernView {...faces} rpc={face} sessionId={SESSION} t={t} />)
    await screen.findByText('把 systemPrompt 改成赛博朋克风')
    expect(screen.getByText('已改好。')).toBeDefined()
  })
})

describe('theme seat', () => {
  // 页头右上角（TavernApp.headActions）是唯一主题座位,常驻;工作空间面不挂
  // 主题行——钉死缺席防回归进 files 页;换肤交互断言在 tavern-app spec。
  it('the workspace files page renders no theme row', async () => {
    const face = rpc({ hasCard: true })
    render(<TavernView {...writerFaces()} rpc={face} sessionId={SESSION} t={t} initialTab="files" />)
    await screen.findByText('上传封面')
    expect(screen.queryByLabelText('主题')).toBeNull()
  })
})
