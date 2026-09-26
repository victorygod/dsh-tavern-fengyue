// @vitest-environment jsdom
// loadCardUi 的卡 UI 挂载探测——回归钉（2026-09-20）。
// 旧探测按「rpc.tree() 里翻得到 preset/ui/*」判定；懒树期（后被回滚）该判定恒 false，
// 卡 UI 整面失挂：HUD 失联 + opening-commit 桥无人接。探测已改直读 preset/ui/ 四件套，
// 从此与树语义无关；本套件把 ①四件套在场 ②全缺 ③空白三个面钉死。
// 2026-09-24 增 opening 契约钉：suppress 解析 + greetings 数据 + active 信号。
// 2026-09-25 增 assistantLive 契约钉：此前该面零测试（调查勘误入账）。files face（文件事件通道批）
// 的订阅纪律将复刻本钉为模板——先有基准，后有克隆。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadCardUi, createComposerDockVault } from '../src/client/card-ui.ts'
import type { TavernRpc } from '../src/client/rpc.ts'

afterEach(() => {
  vi.restoreAllMocks()
})

const SESSION = 'session-1'

/** Wire-shaped readText fake: 列出的路径有货,其余按缺失拒绝(真面 readWorkspaceText 语义)。 */
function rpcWithFiles(files: Record<string, string>): TavernRpc {
  const readText = (request: { path: string }) => request.path in files
    ? Promise.resolve({ text: files[request.path] as string })
    : Promise.reject(new Error(`tavern: file "${String(request.path)}" not found`))
  // tree 快照刻意只报懒树根级的三目录行——探测若仍走 tree 就必然误判缺席。
  const tree = () => Promise.resolve({
    entries: [
      { path: 'preset/', dir: true },
      { path: 'runtime/', dir: true },
      { path: 'savings/', dir: true },
    ],
  })
  return { readText, tree } as unknown as TavernRpc
}

describe('loadCardUi 探测（懒树回归钉）', () => {
  it('卡带 preset/ui/ pack → 活柄:layout 摄入 + 主题透出 + dispose 幂等', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined) // node 环境无 blob 模块 import,mount 失败有兜底
    const rpc = rpcWithFiles({
      'preset/ui/index.js': 'export function mount() {}',
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [{ name: 'hud', slot: 'left' }] }),
      'preset/ui/theme.css': '.dnd-a { color: red }',
    })
    const handle = await loadCardUi(rpc, SESSION)
    expect(handle).not.toBeNull()
    expect(handle?.layout).toEqual({ html: true, panels: [{ name: 'hud', slot: 'left' }], suppress: [], dock: [], modules: [] })
    expect(handle?.themeCss).toContain('.dnd-a')
    handle?.dispose()
    handle?.dispose()
  })

  it('卡没有任何 preset/ui/ 文件 → null——tree 只回三目录也不该影响判定', async () => {
    expect(await loadCardUi(rpcWithFiles({}), SESSION)).toBeNull()
  })

  it('空白文件按缺席算:纯空白的 pack 不挂', async () => {
    expect(await loadCardUi(rpcWithFiles({ 'preset/ui/index.js': '   \n', 'preset/ui/layout.json': '' }), SESSION)).toBeNull()
  })
})

describe('opening 契约（suppress + greetings + active 信号）', () => {
  const PACK = {
    'preset/ui/index.js': `
      let seen
      export function mount(tavern) {
        seen = tavern
        return () => { seen = undefined }
      }
      export const face = () => seen
    `,
  }
  const MOUNTED = async (handle: NonNullable<Awaited<ReturnType<typeof loadCardUi>>>) => {
    // blob 模块 import 在 node/jsdom 无 document.baseURI 的 URL.createObjectURL 面——
    // 现有套件对 mount 失败有兜底(console.warn);face 拿不到 → 断言走 handle。
    return handle
  }

  it('suppress:["opening"] 解析保真;形状坏 → 整份 layout 回退并 console 留痕', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const ok = await loadCardUi(rpcWithFiles({
      'preset/ui/layout.json': JSON.stringify({ html: true, suppress: ['opening'], panels: [{ name: 'galgame', slot: 'overlay' }] }),
    }), SESSION)
    expect(ok?.layout.suppress).toEqual(['opening'])
    const bad = await loadCardUi(rpcWithFiles({
      'preset/ui/layout.json': JSON.stringify({ html: true, suppress: ['keyboard'], panels: [] }),
    }), SESSION)
    expect(bad?.layout).toEqual({ html: true, panels: [], suppress: [], dock: [], modules: [] })
    const nonArray = await loadCardUi(rpcWithFiles({
      'preset/ui/layout.json': JSON.stringify({ html: true, suppress: 'opening', panels: [] }),
    }), SESSION)
    expect(nonArray?.layout).toEqual({ html: true, panels: [], suppress: [], dock: [], modules: [] })
  })

  it('dock:["composer"] 解析保真;未知词 fail 整份;缺省 = []', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const ok = await loadCardUi(rpcWithFiles({
      'preset/ui/layout.json': JSON.stringify({ html: true, dock: ['composer'], panels: [] }),
    }), SESSION)
    expect(ok?.layout.dock).toEqual(['composer'])
    expect(ok?.layout.suppress).toEqual([])
    const bad = await loadCardUi(rpcWithFiles({
      'preset/ui/layout.json': JSON.stringify({ html: true, dock: ['transcript'], panels: [] }),
    }), SESSION)
    expect(bad?.layout).toEqual({ html: true, panels: [], suppress: [], dock: [], modules: [] })
    const absent = await loadCardUi(rpcWithFiles({
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [] }),
    }), SESSION)
    expect(absent?.layout.dock).toEqual([])
  })

  it('greetings.json 合法 → face.greetings 出货;坏 JSON / 非串条目 / 缺文件 → []', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const good = await loadCardUi(rpcWithFiles({
      ...PACK,
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [] }),
      'preset/greetings.json': JSON.stringify({ greetings: ['你好', '  ', 42, '再来'] }),
    }), SESSION)
    expect(good?.opening.greetings).toEqual(['你好', '再来'])
    const badJson = await loadCardUi(rpcWithFiles({
      ...PACK,
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [] }),
      'preset/greetings.json': '{oops',
    }), SESSION)
    expect(badJson?.opening.greetings).toEqual([])
    const missing = await loadCardUi(rpcWithFiles({
      ...PACK,
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [] }),
    }), SESSION)
    expect(missing?.opening.greetings).toEqual([])
  })

  it('active 信号:默认 false;setOpeningActive 翻转 → getter 即时 + subscribe 通知;dispose 摘 listener', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const handle = await MOUNTED(await loadCardUi(rpcWithFiles({
      ...PACK,
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [] }),
    }), SESSION))
    if (handle === null) throw new Error('handle missing')
    expect(handle.opening.active).toBe(false)
    // 两个订阅者各自记账:sub2 在 false 翻转前才订阅,只收到 false/true 两拍。
    const sub1: boolean[] = []
    const sub2: boolean[] = []
    const unsub = handle.opening.subscribe(() => { sub1.push(handle.opening.active) })
    handle.setOpeningActive(true)
    expect(handle.opening.active).toBe(true)
    handle.opening.subscribe(() => { sub2.push(handle.opening.active) })
    handle.setOpeningActive(false)
    expect(sub1).toEqual([true, false])
    expect(sub2).toEqual([false])
    expect(handle.opening.active).toBe(false)
    unsub()  // 只摘 sub1:sub2 仍应收到
    handle.setOpeningActive(true)
    expect(sub1).toEqual([true, false])
    expect(sub2).toEqual([false, true])
    handle.dispose()
    handle.setOpeningActive(false)  // dispose 后通知静默(listener 已清),getter 仍真值
    expect(sub1).toEqual([true, false])
    expect(sub2).toEqual([false, true])
    expect(handle.opening.active).toBe(false)
  })

  it('mount face 拿到 opening:suppress 卡由 tavern 声明面接线(stop 转发)', async () => {
    const caught: unknown[] = []
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const handle = await loadCardUi(rpcWithFiles({
      // capture 面写进 globalThis,外层读(node 环境无真 blob import,mount 常兜底——
      // 能跑通则真实断言,跑不通则由上一条 active 用例覆盖 face 本体)
      'preset/ui/index.js': [
        'export function mount(tavern) {',
        '  globalThis.__tavernFace = tavern',
        '  tavern.stop?.()',
        '}',
      ].join('\n'),
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [], suppress: ['opening'] }),
      'preset/greetings.json': JSON.stringify({ greetings: ['开场白一'] }),
    }), SESSION, { stop: () => { caught.push('stopped') } })
    if (handle === null) throw new Error('handle missing')
    const face = (globalThis as { __tavernFace?: Record<string, unknown> }).__tavernFace
    if (face !== undefined) {
      expect(face.stop).toBeTypeOf('function')
      expect((face.opening as { greetings: string[] }).greetings).toEqual(['开场白一'])
      expect(caught).toEqual(['stopped'])
    } else {
      console.warn('node 环境无 blob import——face 断言由 jsdom 真机 CDP 承担')
    }
    delete (globalThis as { __tavernFace?: unknown }).__tavernFace
    handle.dispose()
  })
})

describe('assistantLive 契约（text/reasoning 双路 + files face 模板基准）', () => {
  const SUPPORT = {
    'preset/ui/index.js': 'export function mount() {}',
    'preset/ui/layout.json': JSON.stringify({ html: true, panels: [] }),
  }

  it('live 文本:同值去重不广播;双订阅收齐;单摘后只发余者;dispose 后通知静默而 getter 仍真', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const handle = await loadCardUi(rpcWithFiles(SUPPORT), SESSION)
    if (handle === null) throw new Error('handle missing')
    expect(handle.assistantLive.text).toBe('')
    const a1: string[] = []
    const a2: string[] = []
    const unsub = handle.assistantLive.subscribe(text => { a1.push(text) })
    handle.feedAssistantLive('第一段')
    handle.feedAssistantLive('第一段')   // 同值去重:feed 侧 diff,订阅者不见重复拍
    expect(handle.assistantLive.text).toBe('第一段')
    expect(a1).toEqual(['第一段'])
    handle.assistantLive.subscribe(text => { a2.push(text) })
    handle.feedAssistantLive('第二段')
    expect(a1).toEqual(['第一段', '第二段'])
    expect(a2).toEqual(['第二段'])
    unsub()                              // 只摘 a1:a2 仍应收到
    handle.feedAssistantLive('第三段')
    expect(a1).toEqual(['第一段', '第二段'])
    expect(a2).toEqual(['第二段', '第三段'])
    handle.dispose()
    handle.feedAssistantLive('第四段')   // dispose 后广播静默(listener 已清),getter 仍真值
    expect(a1).toEqual(['第一段', '第二段'])
    expect(a2).toEqual(['第二段', '第三段'])
    expect(handle.assistantLive.text).toBe('第四段')
  })

  it('live reasoning 独立通路:subscribeReasoning 同构(getter/去重/单摘/dispose 静默)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const handle = await loadCardUi(rpcWithFiles(SUPPORT), SESSION)
    if (handle === null) throw new Error('handle missing')
    expect(handle.assistantLive.reasoning).toBe('')
    const r1: string[] = []
    const unsub = handle.assistantLive.subscribeReasoning(text => { r1.push(text) })
    handle.feedLiveReasoning('思考开头')
    handle.feedLiveReasoning('思考开头')   // 去重
    handle.assistantLive.subscribeReasoning(() => undefined)
    handle.feedLiveReasoning('思考继续')
    expect(r1).toEqual(['思考开头', '思考继续'])
    expect(handle.assistantLive.reasoning).toBe('思考继续')
    unsub()
    handle.feedLiveReasoning('思考末尾')
    expect(r1).toEqual(['思考开头', '思考继续'])
    handle.dispose()
    handle.feedLiveReasoning('dispose 后静默')
    expect(r1).toEqual(['思考开头', '思考继续'])
    expect(handle.assistantLive.reasoning).toBe('dispose 后静默')
  })
})

describe('files face 契约(文件事件通道,2026-09-25 通道批)', () => {
  const SUPPORT = {
    'preset/ui/index.js': 'export function mount() {}',
    'preset/ui/layout.json': JSON.stringify({ html: true, panels: [] }),
  }

  it('纯事件面:不做去重(同 hint 连发都送达)、双订阅收齐、单摘只发余者、dispose 后静默', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const handle = await loadCardUi(rpcWithFiles(SUPPORT), SESSION)
    if (handle === null) throw new Error('handle missing')
    const a1: number[] = []
    const a2: number[] = []
    const unsub = handle.files.subscribe(() => { a1.push(a1.length + 1) })
    handle.feedFileEvents({ paths: [] })
    handle.feedFileEvents({ paths: [] })   // 无去重:纯事件,每次都广播(与 assistantLive 的 diff 面相反)
    expect(a1).toEqual([1, 2])
    handle.files.subscribe(() => { a2.push(a2.length + 1) })
    handle.feedFileEvents({ paths: ['ws-1/runtime/state.md'] })
    expect(a1).toEqual([1, 2, 3])
    expect(a2).toEqual([1])
    unsub()
    handle.feedFileEvents({ paths: [] })
    expect(a1).toEqual([1, 2, 3])
    expect(a2).toEqual([1, 2])
    handle.dispose()
    handle.feedFileEvents({ paths: [] })
    expect(a2).toEqual([1, 2])   // dispose 后广播静默(listener 已清)
  })
})

describe('composerDock vault 契约(G3: 卡供槽,宿主搬运,2026-09-25 停靠批)', () => {
  const SUPPORT = {
    'preset/ui/index.js': 'export function mount() {}',
    'preset/ui/layout.json': JSON.stringify({ html: true, dock: ['composer'], panels: [] }),
  }

  it('未声明 dock 即调用 → fail-visible 拒绝(console 留痕,slot 恒 null,解停幂等)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const vault = createComposerDockVault([])
    const el = document.createElement('div')
    const undock = vault.dockComposer(el)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no dock:["composer"]'))
    expect(vault.composerDock.slot).toBeNull()
    undock()
  })

  it('非元素槽 → 同样 fail-visible', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const vault = createComposerDockVault(['composer'])
    vault.dockComposer(undefined as unknown as Element)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('non-element slot'))
    expect(vault.composerDock.slot).toBeNull()
  })

  it('注册生效+订阅通知;解停回落 null;换槽替换留痕;clear(dispose) 清空', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const vault = createComposerDockVault(['composer'])
    const el = document.createElement('div')
    const seen: Array<Element | null> = []
    const unsub = vault.composerDock.subscribe(() => { seen.push(vault.composerDock.slot) })
    const undock = vault.dockComposer(el)
    expect(vault.composerDock.slot).toBe(el)
    expect(seen).toEqual([el])
    undock()
    expect(vault.composerDock.slot).toBeNull()
    expect(seen).toEqual([el, null])
    unsub()
    vault.dockComposer(el)          // 同槽重注册幂等
    const el2 = document.createElement('div')
    vault.dockComposer(el2)         // 换槽:替换(卡重建 DOM 场景),留痕
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('slot replaced'))
    expect(vault.composerDock.slot).toBe(el2)
    vault.clear()
    expect(vault.composerDock.slot).toBeNull()
  })

  it('handle 出货读面:初始槽 null(注册接线由卡侧行为钉+真机 shallow钉覆盖)', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const handle = await loadCardUi(rpcWithFiles(SUPPORT), SESSION)
    if (handle === null) throw new Error('handle missing')
    expect(handle.composerDock).toBeDefined()
    expect(handle.composerDock.slot).toBeNull()
    handle.dispose()
  })
})

describe('modules 声明装载(manifest,2026-09-25):layout 声明 → 宿主按单装载 → tavern.mods', () => {
  const SUPPORT = {
    'preset/ui/index.js': 'export function mount() {}',
    'preset/ui/layout.json': JSON.stringify({ html: true, panels: [] }),
  }

  it('解析保真:合法名通关;保留名/大写/重复/非数组/超上限 → 整单 fallback + warn(modules 恒 [])', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const ok = await loadCardUi(rpcWithFiles({
      ...SUPPORT,
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [], modules: ['feed', 'ptr'] }),
    }), SESSION)
    expect(ok?.layout.modules).toEqual(['feed', 'ptr'])
    expect(ok).not.toBeNull()
    const badLayoutOf = async (modules: unknown) => (await loadCardUi(rpcWithFiles({
      'preset/ui/index.js': 'export function mount() {}',
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [], modules }),
    }), SESSION))?.layout
    const fallback = { html: true, panels: [], suppress: [], dock: [], modules: [] }
    expect(await badLayoutOf(['view'])).toEqual(fallback)            // 撞四槽保留名
    expect(await badLayoutOf(['Feed'])).toEqual(fallback)            // 违名字规则(大写)
    expect(await badLayoutOf(['feed', 'feed'])).toEqual(fallback)    // 重复
    expect(await badLayoutOf('feed')).toEqual(fallback)              // 非数组
    expect(await badLayoutOf(Array.from({ length: 9 }, (_, i) => `m${i}`))).toEqual(fallback) // 超上限 8
    expect(warn).toHaveBeenCalled()
    void warn.mock.calls
    warn.mockRestore()
  })

  it('声明了但文件缺 → 读侧响亮(新纪律):warn 带完整路径,单名缺席不拖死整卡', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const handle = await loadCardUi(rpcWithFiles({
      ...SUPPORT,
      'preset/ui/layout.json': JSON.stringify({ html: true, panels: [], modules: ['feed'] }),
    }), SESSION)
    if (handle === null) throw new Error('handle missing')
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('preset/ui/feed.mjs'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('fail-visible'))
    handle.dispose()
  })

  it('装载隔离 + revoke 结账:单名 import 失败各自留痕;dispose 全 revoke 建立过的 blob URL', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // 桩成 import 必败的伪 URL(这恰是要测的隔离面);原值备份、finally 恢复——不许污染后续用例
    const U = URL as unknown as Record<string, unknown>
    const origCreate = U.createObjectURL
    const origRevoke = U.revokeObjectURL
    const created: string[] = []
    const revoked: string[] = []
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (_blob: Blob) => { const url = `blob:card-fake-${created.length + 1}`; created.push(url); return url },
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: (url: string) => { revoked.push(url) },
    })
    try {
      const handle = await loadCardUi(rpcWithFiles({
        ...SUPPORT,
        'preset/ui/layout.json': JSON.stringify({ html: true, panels: [], modules: ['feed', 'ptr'] }),
        'preset/ui/feed.mjs': 'export const x = 1',
        'preset/ui/ptr.mjs': 'export const y = 2',
      }), SESSION)
      if (handle === null) throw new Error('handle missing')
      // 单名 import 失败各自的留痕(importModule 双参 warn 面),整卡照常出活柄
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('module feed import failed'), expect.anything())
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('module ptr import failed'), expect.anything())
      // 装载尝试确实发生:index.js + 两模块 = 3 个 blob
      expect(created).toHaveLength(3)
      handle.dispose()
      expect(revoked).toEqual(created)
    } finally {
      if (origCreate === undefined) delete U.createObjectURL
      else Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: origCreate })
      if (origRevoke === undefined) delete U.revokeObjectURL
      else Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: origRevoke })
    }
  })

  it('face 注入(真装载):data: URL 桩打通全链路——声明模块的 namespace 进 mount face', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    // jsdom 的 Blob 拿不出同步文本——桩成可读的 CodeBlob,createObjectURL 直接产出
    // node 可 import 的 data: URL:装载→mount→face 捕获全链路真跑,vite-node 不吞则真机 CDP 兜。
    class CodeBlob { code: string; constructor(parts: unknown[]) { this.code = parts.join('') } }
    const U = URL as unknown as Record<string, unknown>
    const origCreate = U.createObjectURL
    const origRevoke = U.revokeObjectURL
    const revokes: string[] = []
    vi.stubGlobal('Blob', CodeBlob)
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: (blob: CodeBlob) => `data:text/javascript,${encodeURIComponent((blob as unknown as CodeBlob).code)}`,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: (url: string) => { revokes.push(url) },
    })
    try {
      const handle = await loadCardUi(rpcWithFiles({
        'preset/ui/index.js': [
          'export function mount(tavern) {',
          '  globalThis.__tavernFace = tavern',
          '}',
        ].join('\n'),
        'preset/ui/layout.json': JSON.stringify({ html: true, panels: [], modules: ['feed'] }),
        'preset/ui/feed.mjs': 'export const who = "feed"',
      }), SESSION)
      if (handle === null) throw new Error('handle missing')
      handle.dispose()
      // 结账:装载/挂载经历过,URL 全回收(index.js + feed.mjs 至少各一枚)
      expect(revokes.length).toBeGreaterThanOrEqual(2)
      const face = (globalThis as { __tavernFace?: Record<string, unknown> }).__tavernFace
      if (face !== undefined) {
        const mods = face.mods as Record<string, { who?: string }>
        expect(mods.feed?.who).toBe('feed')
      } else {
        console.warn('vite-node 不吞 data: URL——mods face 断言由真机 CDP 承担(装载/回收面已钉)')
      }
      delete (globalThis as { __tavernFace?: unknown }).__tavernFace
    } finally {
      vi.unstubAllGlobals()
      if (origCreate === undefined) delete U.createObjectURL
      else Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: origCreate })
      if (origRevoke === undefined) delete U.revokeObjectURL
      else Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: origRevoke })
    }
    void warn
  })
})
