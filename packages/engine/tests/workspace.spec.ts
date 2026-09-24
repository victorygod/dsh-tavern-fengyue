import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, existsSync, utimesSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  autosave, autosaveStamped, createWorkspaceDirs, deleteSave, fenceIn, hasCard, importCardPreset,
  listLibrary, listSaves, listTree, loadSave, manualSave, newWorkspaceRoot, workspaceFileOp, readCardMeta,
  publishIntoLibraryCard, publishWorkspaceCard, readMaintenancePrompt, readOpeningHtml, readSaveStamp, readAsset,
  seedRuntime, writeAsset, writeCardSkeleton,
  readWorkspaceText, writeWorkspaceText,
  SAVINGS_DIR,
} from '../src/workspace.ts'

let base: string

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'tavern-ws-'))
})

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

function freshRoot(): string {
  return createWorkspaceDirs(join(base, `ws-${Math.random().toString(36).slice(2, 8)}`))
}

describe('workspace skeleton', () => {
  it('writes the three empty prompts, the README signposts, and meta.json', () => {
    const root = freshRoot()
    writeCardSkeleton(root)
    for (const file of ['systemPrompt', 'postPrompt', 'maintenancePrompt']) {
      expect(readFileSync(join(root, 'preset/prompt', file), 'utf8')).toBe('')
    }
    // prefixPrompt retired from the template (2026-09-16): a fresh card does
    // not carry it; the renderer still reads one when present (legacy cards).
    expect(existsSync(join(root, 'preset/prompt', 'prefixPrompt'))).toBe(false)
    expect(readCardMeta(root)).toEqual({ title: '', cover: '' })
    for (const dir of ['assets', 'setup', 'scripts', 'tools']) {
      expect(existsSync(join(root, 'preset', dir, 'README.md'))).toBe(true)
    }
    expect(readMaintenancePrompt(root)).toBe('')
    expect(hasCard(root)).toBe(true)
  })

  it('reads a card\'s maintenance prompt and opening page', () => {
    const root = freshRoot()
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/prompt/maintenancePrompt'), '记账。')
    let opening = readOpeningHtml(root)
    expect(opening).toBeNull()
    expect(readMaintenancePrompt(root)).toBe('记账。')
    writeFileSync(join(root, 'preset/setup/opening.html'), '<p>hi</p>')
    opening = readOpeningHtml(root)
    expect(opening).toBe('<p>hi</p>')
    // 空白文件 = 无开场页：客户端把它当 null 落到默认开场页，而不是两分支都不进。
    writeFileSync(join(root, 'preset/setup/opening.html'), '')
    expect(readOpeningHtml(root)).toBeNull()
    writeFileSync(join(root, 'preset/setup/opening.html'), '  \n ')
    expect(readOpeningHtml(root)).toBeNull()
  })

  it('parses meta.json tolerantly', () => {
    const root = freshRoot()
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/meta.json'), JSON.stringify({ title: '酒馆', desc: 'd', cover: 'c.png', extra: 1 }))
    expect(readCardMeta(root)).toEqual({ title: '酒馆', desc: 'd', cover: 'c.png' })
    expect(hasCard(root)).toBe(true)
  })

  it('reads optional meta identity fields when well-typed and drops malformed ones', () => {
    const root = freshRoot()
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/meta.json'), JSON.stringify({
      title: '酒馆', desc: 'd', cover: '',
      creator: '作者', version: '1.2', tags: ['奇幻', '5e', '', 42],
    }))
    expect(readCardMeta(root)).toEqual({
      title: '酒馆', desc: 'd', cover: '', creator: '作者', version: '1.2', tags: ['奇幻', '5e'],
    })
    // 非字符串 creator / 非数组 tags → 字段整体缺席；旧三字段卡读形不变。
    writeFileSync(join(root, 'preset/meta.json'), JSON.stringify({ title: '酒馆', desc: 'd', cover: '', creator: 7, tags: '奇幻' }))
    expect(readCardMeta(root)).toEqual({ title: '酒馆', desc: 'd', cover: '' })
  })
})

describe('fences', () => {
  it('resolve relative paths inside the root', () => {
    const root = freshRoot()
    expect(fenceIn(root, 'preset/prompt/systemPrompt').startsWith(root)).toBe(true)
  })

  it('reject traversal into siblings and NUL bytes', () => {
    const root = freshRoot()
    expect(() => fenceIn(root, '../escape')).toThrow(/escapes/)
    expect(() => fenceIn(root, 'a\0b')).toThrow(/NUL/)
  })

  it('editor writes reach preset/ and runtime/ but not savings/', () => {
    const root = freshRoot()
    writeWorkspaceText(root, 'runtime/state.md', '第一天')
    expect(readFileSystem(join(root, 'runtime/state.md'))).toBe('第一天')
    writeWorkspaceText(root, 'preset/prompt/systemPrompt', '规则')
    expect(readFileSystem(join(root, 'preset/prompt/systemPrompt'))).toBe('规则')
    expect(() =>{  writeWorkspaceText(root, 'savings/manual-1/state.md', 'x') }).toThrow(/preset\/ and runtime\//)
  })

  it('editor file ops create parents and reach runtime/ and savings/', () => {
    const root = freshRoot()
    workspaceFileOp(root, { kind: 'create', path: 'preset/setup/npcs/a.md' })
    expect(existsSync(join(root, 'preset/setup/npcs/a.md'))).toBe(true)
    workspaceFileOp(root, { kind: 'move', from: 'preset/setup/npcs/a.md', to: 'preset/setup/npcs/b.md' })
    expect(existsSync(join(root, 'preset/setup/npcs/b.md'))).toBe(true)
    expect(existsSync(join(root, 'preset/setup/npcs/a.md'))).toBe(false)
    workspaceFileOp(root, { kind: 'delete', path: 'preset/setup/npcs/b.md' })
    expect(existsSync(join(root, 'preset/setup/npcs/b.md'))).toBe(false)
    workspaceFileOp(root, { kind: 'mkdir', path: 'runtime/panels/' })
    workspaceFileOp(root, { kind: 'create', path: 'runtime/panels/hp.md' })
    expect(readFileSystem(join(root, 'runtime/panels/hp.md'))).toBe('')
    workspaceFileOp(root, { kind: 'delete', path: 'runtime/panels' })
    workspaceFileOp(root, { kind: 'mkdir', path: 'savings/manual-1/' })
    expect(existsSync(join(root, 'savings/manual-1'))).toBe(true)
    workspaceFileOp(root, { kind: 'delete', path: 'savings/manual-1' })
  })
})

describe('asset writes', () => {
  it('decode, cap, and fence into preset/ with parent creation', () => {
    const root = freshRoot()
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    writeAsset(root, 'preset/covers/cover.png', png.toString('base64'), 1_000_000)
    expect(readFileSync(join(root, 'preset/covers/cover.png'))).toEqual(png)
    expect(readAsset(root, 'preset/covers/cover.png', 1_000_000)).toBe(`data:image/png;base64,${png.toString('base64')}`)
  })

  it('rejects writes outside preset/, non-asset extensions, escapes, and over-cap payloads', () => {
    const root = freshRoot()
    const pixel = Buffer.from([0x89, 0x50]).toString('base64')
    expect(() => { writeAsset(root, 'runtime/cover.png', pixel, 1_000_000) }).toThrow(/limited to preset\//)
    expect(() => { writeAsset(root, 'preset/cover.txt', pixel, 1_000_000) }).toThrow(/not a writable asset/)
    expect(() => { writeAsset(root, 'preset/../escape.png', pixel, 1_000_000) }).toThrow(/escapes/)
    expect(() => { writeAsset(root, 'preset/cover.png', pixel, 1) }).toThrow(/write cap/)
  })
})

describe('seed / tree / reads', () => {
  it('seeding replaces the runtime with the setup template', () => {
    const root = freshRoot()
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/setup/state.md'), 'day 1')
    mkdirSync(join(root, 'runtime'), { recursive: true })
    writeFileSync(join(root, 'runtime/stale.md'), 'stale')
    seedRuntime(root)
    expect(readFileSystem(join(root, 'runtime/state.md'))).toBe('day 1')
    expect(existsSync(join(root, 'runtime/stale.md'))).toBe(false)
  })

  it('the tree lists the three roots flattened and hides dotfiles', () => {
    const root = freshRoot()
    writeCardSkeleton(root)
    writeWorkspaceText(root, 'prompt' in {} ? '' : 'preset/prompt/systemPrompt', '规则')
    mkdirSync(join(root, '.hidden'), { recursive: true })
    const paths = listTree(root).map(entry => entry.path)
    expect(paths).toContain('preset/')
    expect(paths).toContain('runtime/')
    expect(paths).toContain('savings/')
    expect(paths).toContain('preset/prompt/systemPrompt')
    expect(paths.some(path => path.includes('.hidden'))).toBe(false)
  })

  it('the narrator-tools flag rides the card through publish / save-edit / import (meta.json field)', () => {
    // 建卡页点掉 checkbox → 保存并开始 → 新会话导入：旗标是卡身份 meta.json 的
    // 显式字段，保真跨过 publish(publishWorkspaceCard) → 编辑回写(publishIntoLibraryCard)
    // → 导入(importCardPreset) 三条 preset 整目录拷贝边界。
    const draft = freshRoot()
    writeCardSkeleton(draft)
    writeWorkspaceText(draft, 'preset/meta.json', `${JSON.stringify({ title: '旗标卡', narratorTools: false }, undefined, 2)}\n`)

    const libraryBase = mkdtempSync(join(base, 'lib-'))
    const name = publishWorkspaceCard(draft, libraryBase)
    expect(readCardMeta(join(libraryBase, name))?.narratorTools).toBe(false)

    // 编辑存量卡再保存：导卡进编辑工作区 → 改旗标 → 回写以编辑工作区 meta 为准。
    const editing = freshRoot()
    writeCardSkeleton(editing)
    importCardPreset(editing, join(libraryBase, name, 'preset'))
    writeWorkspaceText(editing, 'preset/meta.json', `${JSON.stringify({ title: '旗标卡', narratorTools: true }, undefined, 2)}\n`)
    publishIntoLibraryCard(editing, libraryBase, name)
    expect(readCardMeta(join(libraryBase, name))?.narratorTools).toBe(true)

    // 新会话导入：checkbox 即卡片当前身份所声明的状态。
    const imported = freshRoot()
    writeCardSkeleton(imported)
    importCardPreset(imported, join(libraryBase, name, 'preset'))
    expect(readCardMeta(imported)?.narratorTools).toBe(true)
  })

  it('reads are fenced and byte-capped', () => {
    const root = freshRoot()
    writeCardSkeleton(root)
    writeWorkspaceText(root, 'preset/prompt/systemPrompt', '规则')
    expect(readWorkspaceText(root, 'preset/prompt/systemPrompt', 100)).toBe('规则')
    expect(() => readWorkspaceText(root, '../../etc/passwd', 100)).toThrow()
    expect(() => readWorkspaceText(root, 'preset/prompt/systemPrompt', 1)).toThrow(/cap/)
  })
})

describe('saves', () => {
  it('snapshots the runtime, loads it back, and deletes', () => {
    const root = freshRoot()
    seedRuntime(root)
    writeFileSync(join(root, 'runtime/state.md'), 'day 2')
    manualSave(root, '第一次抉择')
    expect(listSaves(root).map(save => save.name)).toEqual(['第一次抉择'])
    writeFileSync(join(root, 'runtime/state.md'), 'day 3')
    loadSave(root, '第一次抉择')
    expect(readFileSystem(join(root, 'runtime/state.md'))).toBe('day 2')
    deleteSave(root, '第一次抉择')
    expect(listSaves(root)).toEqual([])
  })

  it('autosaves keep only the latest ring and never prune manual saves', () => {
    const root = freshRoot()
    writeFileSync(join(root, 'runtime/state.md'), 'x')
    manualSave(root, 'manual-keep')
    for (let i = 0; i < 4; i += 1) {
      writeFileSync(join(root, 'runtime/state.md'), `v${i}`)
      autosave(root, 2)
    }
    const saves = listSaves(root)
    const autos = saves.filter(save => save.type === 'auto')
    expect(autos.length).toBe(2)
    expect(saves.some(save => save.name === 'manual-keep')).toBe(true)
  })

  it('stamps autosaves as readable local time to the second, with same-second suffixes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 14, 0, 12, 34))
    try {
      const root = freshRoot()
      writeFileSync(join(root, 'runtime/state.md'), 'a')
      autosave(root, 10)
      autosave(root, 10)
      vi.setSystemTime(new Date(2026, 8, 14, 0, 12, 35))
      autosave(root, 10)
      const autos = listSaves(root).map(save => save.name)
      expect(autos).toContain('autosave-2026-09-14-00-12-34')
      expect(autos).toContain('autosave-2026-09-14-00-12-34-2')
      expect(autos).toContain('autosave-2026-09-14-00-12-35')
    } finally {
      vi.useRealTimers()
    }
  })

  it('stamps the composer draft on autosaves, tolerates stamp-less entries, and manual stamps carry it verbatim', () => {
    const root = freshRoot()
    writeFileSync(join(root, 'runtime/state.md'), 'a')
    const name = autosaveStamped(root, 10, { sessionId: 'session-a' as never, seq: 7, summary: '我拔剑', draft: '我拔剑' })
    expect(readSaveStamp(root, name)).toMatchObject({ seq: 7, draft: '我拔剑', summary: '我拔剑' })
    // A stamp-less save row (pre-feature legacy) reads as absent, not a throw.
    mkdirSync(join(root, SAVINGS_DIR, '无戳'), { recursive: true })
    expect(readSaveStamp(root, '无戳')).toBeUndefined()
    expect(listSaves(root).find(save => save.name === '无戳')?.summary).toBe('')
  })

  it('orders save rows by directory write time across name eras', () => {
    const root = freshRoot()
    writeFileSync(join(root, 'runtime/state.md'), 'a')
    // A pre-readable-era name: lexically it sorts AFTER every dotted form;
    // directory order must not follow the name.
    manualSave(root, 'autosave-20260910-024100')
    const stale = join(root, SAVINGS_DIR, 'autosave-20260910-024100')
    utimesSync(stale, new Date(2020, 0, 1), new Date(2020, 0, 1))
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 8, 14, 0, 12, 34))
    try {
      autosave(root, 10)
    } finally {
      vi.useRealTimers()
    }
    expect(listSaves(root)[0]?.name).toBe('autosave-2026-09-14-00-12-34')
  })

  it('rejects save names that are not directory names', () => {
    const root = freshRoot()
    expect(() =>{  manualSave(root, 'a/b') }).toThrow()
    expect(() =>{  manualSave(root, '.hidden') }).toThrow()
    expect(() =>{  manualSave(root, '') }).toThrow()
  })

  // 改名换位语义回归(2026-09-24):载入用 rename 让位 + 拷贝回滚,而不是裸
  // rmSync→copy——Windows 上热文件句柄(杀软/索引器)曾让删除中途抛 EPERM,
  // 载入与旧树解绑顺序的组合把世界削成半截。三条性质:拷贝失败退回原位、
  // 成功后无退役残留、退役树对编辑树不可见。
  it('loadSave rolls the live runtime back in place when the snapshot copy fails', () => {
    if (process.getuid?.() === 0) return  // root 读穿权限位,置 0 拦不住 copyFileSync
    const root = freshRoot()
    seedRuntime(root)
    writeFileSync(join(root, 'runtime/state.md'), '载入前真身')
    manualSave(root, '快照')
    writeFileSync(join(root, 'runtime/state.md'), '被改坏的世界')
    chmodSync(join(root, SAVINGS_DIR, '快照', 'state.md'), 0o000)
    try {
      expect(() =>{  loadSave(root, '快照') }).toThrow()
    } finally {
      chmodSync(join(root, SAVINGS_DIR, '快照', 'state.md'), 0o644)
    }
    // 回滚:runtime 原位保留(注意:保留的是载入前状态,不是快照),无退役残留。
    expect(readFileSystem(join(root, 'runtime/state.md'))).toBe('被改坏的世界')
    expect(existsSync(join(root, '.tavern-runtime-retired'))).toBe(false)
  })

  it('a successful load leaves no retired runtime behind and the transition tree stays out of the editor tree', () => {
    const root = freshRoot()
    seedRuntime(root)
    writeFileSync(join(root, 'runtime/state.md'), 'day 2')
    manualSave(root, '快照')
    loadSave(root, '快照')
    expect(readFileSystem(join(root, 'runtime/state.md'))).toBe('day 2')
    expect(existsSync(join(root, '.tavern-runtime-retired'))).toBe(false)
    // 三个顶层项之外不落地:编辑树/模型可见面不会瞥见过渡树。
    expect(listTree(root).some(entry => entry.path.includes('retired'))).toBe(false)
  })
})

describe('library and imports', () => {
  it('lists only directories carrying a preset', () => {
    const lib = join(base, 'lib1')
    mkdirSync(join(lib, 'card-a', 'preset'), { recursive: true })
    mkdirSync(join(lib, 'not-a-card'), { recursive: true })
    expect(listLibrary(lib).map(card => card.name)).toEqual(['card-a'])
    const metaName = listLibrary(lib)[0]?.meta
    expect(metaName).toBeNull()
  })

  it('imports a card from its preset and seeds the runtime', () => {
    const source = join(base, 'src-card', 'preset')
    mkdirSync(join(source, 'setup'), { recursive: true })
    writeFileSync(join(source, 'setup/state.md'), 'day 1')
    writeFileSync(join(source, 'meta.json'), JSON.stringify({ title: 't' }))
    const root = freshRoot()
    importCardPreset(root, source)
    expect(readFileSystem(join(root, 'runtime/state.md'))).toBe('day 1')
    expect(readCardMeta(root)?.title).toBe('t')
  })

})

it('newWorkspaceRoot stamps a fresh name under the base', () => {
  const first = newWorkspaceRoot(join(base, 'a'))
  expect(first.startsWith(join(base, 'a'))).toBe(true)
  const second = newWorkspaceRoot(join(base, 'a'))
  const third = newWorkspaceRoot(join(base, 'a'))
  expect(second).not.toBe(first)
  expect(third).not.toBe(first)
  expect(third).not.toBe(second)
})

function readFileSystem(path: string): string {
  return readFileSync(path, 'utf8')
}

describe('fixed template path protection', () => {
  it('refuses to delete or rename fixed paths, and refuses moves onto them', () => {
    const root = mkdtempSync(join(tmpdir(), 'tavern-fixed-'))
    createWorkspaceDirs(root)
    writeCardSkeleton(root)
    for (const path of ['preset/prompt/systemPrompt', 'preset/meta.json', 'preset/', 'preset/prompt/', 'preset/tools/', 'runtime/', 'savings/']) {
      expect(() =>{  workspaceFileOp(root, { kind: 'delete', path }) }).toThrow(/fixed template path/)
      expect(() =>{  workspaceFileOp(root, { kind: 'move', from: path, to: 'preset/renamed-target' }) }).toThrow(/fixed template path/)
    }
    expect(() =>{  workspaceFileOp(root, { kind: 'move', from: 'preset/prompt/other', to: 'preset/prompt/systemPrompt' }) }).toThrow(/collides/)
    // A directory rename landing on a fixed skeleton dir collides too.
    expect(() =>{  workspaceFileOp(root, { kind: 'move', from: 'preset/elsewhere', to: 'preset/prompt/' }) }).toThrow(/collides/)
    expect(existsSync(join(root, 'preset/prompt/systemPrompt'))).toBe(true)
    expect(existsSync(join(root, 'preset/meta.json'))).toBe(true)
    rmSync(root, { recursive: true, force: true })
  })

  it('treats the legacy prefixPrompt as a normal file: creatable, renamable, deletable', () => {
    const root = mkdtempSync(join(tmpdir(), 'tavern-legacy-prefix-'))
    createWorkspaceDirs(root)
    writeCardSkeleton(root)
    // Fresh skeleton carries no prefixPrompt; the editor may create one and
    // remove it freely — a leftover file is inert data nothing reads.
    expect(existsSync(join(root, 'preset/prompt/prefixPrompt'))).toBe(false)
    workspaceFileOp(root, { kind: 'create', path: 'preset/prompt/prefixPrompt' })
    workspaceFileOp(root, { kind: 'move', from: 'preset/prompt/prefixPrompt', to: 'preset/prompt/prefix-old' })
    expect(existsSync(join(root, 'preset/prompt/prefix-old'))).toBe(true)
    workspaceFileOp(root, { kind: 'delete', path: 'preset/prompt/prefix-old' })
    expect(existsSync(join(root, 'preset/prompt/prefix-old'))).toBe(false)
    rmSync(root, { recursive: true, force: true })
  })

  it('renames a user directory inside preset/ and refuses subtree-targeted moves', () => {
    const root = mkdtempSync(join(tmpdir(), 'tavern-dirmove-'))
    createWorkspaceDirs(root)
    writeCardSkeleton(root)
    workspaceFileOp(root, { kind: 'mkdir', path: 'preset/untitled/' })
    workspaceFileOp(root, { kind: 'move', from: 'preset/untitled/', to: 'preset/my-notes/' })
    expect(existsSync(join(root, 'preset/my-notes'))).toBe(true)
    expect(existsSync(join(root, 'preset/untitled'))).toBe(false)
    expect(() =>{  workspaceFileOp(root, { kind: 'move', from: 'preset/my-notes/', to: 'preset/my-notes/inner/' }) }).toThrow(/own subtree/)
    rmSync(root, { recursive: true, force: true })
  })

  it('refuses a move onto an occupied target instead of merging into it', () => {
    const root = mkdtempSync(join(tmpdir(), 'tavern-move-'))
    createWorkspaceDirs(root)
    writeCardSkeleton(root)
    workspaceFileOp(root, { kind: 'create', path: 'preset/setup/a.md' })
    workspaceFileOp(root, { kind: 'create', path: 'preset/setup/b.md' })
    expect(() =>{  workspaceFileOp(root, { kind: 'move', from: 'preset/setup/a.md', to: 'preset/setup/b.md' }) }).toThrow(/already exists/)
    expect(readFileSystem(join(root, 'preset/setup/a.md'))).toBe('')
    expect(readFileSystem(join(root, 'preset/setup/b.md'))).toBe('')
    rmSync(root, { recursive: true, force: true })
  })

  it('refuses creation at a fixed path and outside the three areas', () => {
    const root = mkdtempSync(join(tmpdir(), 'tavern-create-'))
    createWorkspaceDirs(root)
    expect(() =>{  workspaceFileOp(root, { kind: 'create', path: 'preset/meta.json' }) }).toThrow(/fixed template path/)
    expect(() =>{  workspaceFileOp(root, { kind: 'create', path: 'assets/pic.png' }) }).toThrow(/limited to/)
    expect(() =>{  workspaceFileOp(root, { kind: 'delete', path: 'preset' }) }).toThrow(/limited to/)
    rmSync(root, { recursive: true, force: true })
  })

  it('renames files and directories inside runtime/ within its own area', () => {
    const root = mkdtempSync(join(tmpdir(), 'tavern-runtime-move-'))
    createWorkspaceDirs(root)
    writeCardSkeleton(root)
    workspaceFileOp(root, { kind: 'create', path: 'runtime/panels/hp.md' })
    workspaceFileOp(root, { kind: 'move', from: 'runtime/panels/hp.md', to: 'runtime/panels/mana.md' })
    expect(existsSync(join(root, 'runtime/panels/mana.md'))).toBe(true)
    expect(existsSync(join(root, 'runtime/panels/hp.md'))).toBe(false)
    workspaceFileOp(root, { kind: 'move', from: 'runtime/panels/', to: 'runtime/status/' })
    expect(existsSync(join(root, 'runtime/status/mana.md'))).toBe(true)
    rmSync(root, { recursive: true, force: true })
  })

  it('refuses moves across areas and into savings/', () => {
    const root = mkdtempSync(join(tmpdir(), 'tavern-crossmove-'))
    createWorkspaceDirs(root)
    writeCardSkeleton(root)
    workspaceFileOp(root, { kind: 'create', path: 'preset/setup/a.md' })
    workspaceFileOp(root, { kind: 'create', path: 'runtime/b.md' })
    workspaceFileOp(root, { kind: 'mkdir', path: 'savings/manual-1/' })
    expect(() =>{  workspaceFileOp(root, { kind: 'move', from: 'preset/setup/a.md', to: 'runtime/a.md' }) }).toThrow(/within preset\/ or runtime\//)
    expect(() =>{  workspaceFileOp(root, { kind: 'move', from: 'runtime/b.md', to: 'savings/b.md' }) }).toThrow(/within preset\/ or runtime\//)
    rmSync(root, { recursive: true, force: true })
  })

  it('create and mkdir refuse occupied targets instead of truncating', () => {
    const root = mkdtempSync(join(tmpdir(), 'tavern-occupied-'))
    createWorkspaceDirs(root)
    writeCardSkeleton(root)
    workspaceFileOp(root, { kind: 'create', path: 'preset/setup/a.md' })
    writeWorkspaceText(root, 'preset/setup/a.md', 'keep')
    expect(() =>{  workspaceFileOp(root, { kind: 'create', path: 'preset/setup/a.md' }) }).toThrow(/already exists/)
    expect(readFileSystem(join(root, 'preset/setup/a.md'))).toBe('keep')
    workspaceFileOp(root, { kind: 'mkdir', path: 'runtime/d/' })
    expect(() =>{  workspaceFileOp(root, { kind: 'mkdir', path: 'runtime/d/' }) }).toThrow(/already exists/)
    rmSync(root, { recursive: true, force: true })
  })
})
