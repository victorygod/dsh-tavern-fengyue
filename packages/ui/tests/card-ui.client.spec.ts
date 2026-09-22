// @vitest-environment jsdom
// loadCardUi 的卡 UI 挂载探测——回归钉（2026-09-20）。
// 旧探测按「rpc.tree() 里翻得到 preset/ui/*」判定；懒树期（后被回滚）该判定恒 false，
// 卡 UI 整面失挂：HUD 失联 + opening-commit 桥无人接。探测已改直读 preset/ui/ 四件套，
// 从此与树语义无关；本套件把 ①四件套在场 ②全缺 ③空白三个面钉死。
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
    expect(handle?.layout).toEqual({ html: true, panels: [{ name: 'hud', slot: 'left' }] })
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
