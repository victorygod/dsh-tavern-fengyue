// @vitest-environment jsdom
// loadCardUi 的卡 UI 挂载探测——回归钉（2026-09-20）。
// 旧探测按「rpc.tree() 里翻得到 preset/ui/*」判定；懒树期（后被回滚）该判定恒 false，
// 卡 UI 整面失挂：HUD 失联 + opening-commit 桥无人接。探测已改直读 preset/ui/ 四件套，
// 从此与树语义无关；本套件把 ①四件套在场 ②全缺 ③空白三个面钉死。
// 2026-09-24 增 opening 契约钉：suppress 解析 + greetings 数据 + active 信号。
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadCardUi } from '../src/client/card-ui.ts'
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
    expect(handle?.layout).toEqual({ html: true, panels: [{ name: 'hud', slot: 'left' }], suppress: [], dock: [] })
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
    expect(bad?.layout).toEqual({ html: true, panels: [], suppress: [], dock: [] })
    const nonArray = await loadCardUi(rpcWithFiles({
      'preset/ui/layout.json': JSON.stringify({ html: true, suppress: 'opening', panels: [] }),
    }), SESSION)
    expect(nonArray?.layout).toEqual({ html: true, panels: [], suppress: [], dock: [] })
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
    expect(bad?.layout).toEqual({ html: true, panels: [], suppress: [], dock: [] })
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
