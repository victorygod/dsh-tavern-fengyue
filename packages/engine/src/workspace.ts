/**
 * Workspace filesystem operations for one tavern workspace: layout creation,
 * card library import, seeding, saves, and fenced file edits. Every path the
 * model or the wire can name is resolved through a containing-root check —
 * the fences here are the validation point for those boundaries.
 *
 * Directory-tree operations (mkdir / seed copy / snapshot / delete) run on
 * the host fs directly: the `dsh-fs` capability exposes text read/write but
 * no removal or move ops, and none of these paths are model-facing.
 * @module dsh-tavern-fengyue-engine/workspace
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, type Dirent } from 'node:fs'
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from 'node:path'
import type { TavernCardMeta, TavernLibraryCard, TavernSave, TavernSaveStamp, TavernTreeEntry } from './types.ts'

/** The card-fixed half of a workspace. */
export const PRESET_DIR = 'preset'
/** The derived runtime half the tail agent maintains. */
export const RUNTIME_DIR = 'runtime'
/** The save area: one directory per save, holding a full runtime snapshot. */
export const SAVINGS_DIR = 'savings'
/** Monotonic in-process disambiguator for same-millisecond stamps. */
let stampSequence = 0

function stampedName(prefix: string, stamp: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${prefix}${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}`
    + `-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`
    + `-${String(stamp.getMilliseconds()).padStart(3, '0')}-${stampSequence += 1}`
}

/**
 * The next free autosave directory name for one stamp — user-facing, so it
 * reads as local wall-clock date and time to the second
 * (`autosave-2026-09-14-01-22-28`). Same-second saves take a numeric suffix:
 * readable first, disambiguated only on collision. Every field is separated by
 * a dash and never by a colon: this string becomes a directory name, and `:`
 * is illegal inside a Windows path segment (mkdirSync fails with ENOENT there).
 * @param root - absolute workspace root (the savings area is checked for occupancy).
 * @param stamp - the save-time date.
 * @returns the save directory name.
 */
function readableSaveName(root: string, stamp: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const base = `autosave-${stamp.getFullYear()}-${pad(stamp.getMonth() + 1)}-${pad(stamp.getDate())}`
    + `-${pad(stamp.getHours())}-${pad(stamp.getMinutes())}-${pad(stamp.getSeconds())}`
  let name = base
  let index = 2
  while (existsSync(join(root, SAVINGS_DIR, name))) name = `${base}-${String(index++)}`
  return name
}

/**
 * Copy the contents of directory `from` into directory `to`, creating `to` and
 * any missing parents first.
 *
 * Hand-rolled instead of `cpSync(..., { recursive: true })`: on Windows that
 * call copies *nothing at all* when the destination path carries non-ASCII
 * characters, and it fails silently — no throw, no files. Destinations here are
 * routinely user text (a card title, a manual save name, an editor path), so
 * the destination is exactly where non-ASCII lands. Verified on Node 24.14.0;
 * on POSIX the two are equivalent. Entries are typed by `statSync`, so a
 * symlinked directory is descended into rather than copied as a link.
 * @param from - absolute source directory.
 * @param to - absolute destination directory (created when missing).
 */
function copyTree(from: string, to: string): void {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from)) {
    const src = join(from, entry)
    const dst = join(to, entry)
    if (statSync(src).isDirectory()) copyTree(src, dst)
    else copyFileSync(src, dst)
  }
}

/**
 * Copy one path — file or directory — to a destination that must not exist yet
 * (the copy half of a rename).
 * @param from - absolute source path.
 * @param to - absolute destination path.
 */
function copyPath(from: string, to: string): void {
  if (statSync(from).isDirectory()) copyTree(from, to)
  else copyFileSync(from, to)
}

/**
 * The three fixed prompt files of a card, in `preset/prompt/` — the skeleton
 * creates exactly these. `prefixPrompt` is not among them and is never read:
 * it retired with the wrap scheme (2026-09-16), and a leftover file is
 * ordinary inert data a card author may delete or merge by hand.
 */
export const PROMPT_FILES = ['systemPrompt', 'postPrompt', 'maintenancePrompt'] as const

/** Any card prompt file the engine reads. */
export type CardPromptFile = (typeof PROMPT_FILES)[number]

/**
 * Create the preset skeleton for authoring a card: empty prompt files plus
 * README signposts for the sibling directories (setup/scripts/tools), and the
 * empty runtime/savings roots.
 * @param root - absolute workspace root, already created.
 */
export function writeCardSkeleton(root: string): void {
  mkdirSync(join(root, PRESET_DIR, 'prompt'), { recursive: true })
  for (const file of PROMPT_FILES) writeFileSync(promptPath(root, file), '')
  writeFileSync(join(root, PRESET_DIR, 'meta.json'), JSON.stringify({
    title: '', desc: '', cover: '', creator: '', version: '', tags: [],
  }, undefined, 2))
  writeCardDirReadme(root, 'assets', [
    '# assets/ — 媒体资产（封面/背景/立绘/音频/视频）',
    '',
    '卡内引用一律走 preset 相对路径：meta.json 的 cover、',
    '卡 CSS/JS 经 runScript 的 ../preset/assets/…（上传封面自动落入本目录并回写 meta.cover）。',
  ].join('\n'))
  writeCardDirReadme(root, 'setup', [
    '# setup/ — 初始可变状态模板',
    '',
    '会话开始时本目录整体复制为 runtime/，作为尾代理维护的基线。',
    '建议放置：state.md（世界总状态）、player.md（角色表）、npcs/、scenes/、opening.html（开场白页面）。',
  ].join('\n'))
  writeCardDirReadme(root, 'scripts', [
    '# scripts/ — 提示词模板脚本（前后端共用的函数库）',
    '',
    '引用形态：提示词里 {{scriptName(args)}}（圆括号必带，参数为字面量或嵌套调用）；',
    '前端 preset/ui/index.js 里 tavern.runScript("scriptName", "参数…")。',
    '脚本 = node 模块（.mjs），cwd = runtime/：读世界数据用相对路径',
    "（readFileSync('state.md')），读会话快照 readFileSync('.chat.snapshot.jsonl')，",
    '跨区读 ../preset/…；stdout（trim）即返回值；失败时占位符原样保留；',
    '位置参数经全局 argv 数组进入（argv[0] 起为按序参数）。',
    '骨架已带 read.mjs（读单个文件）。',
  ].join('\n'))
  writeFileSync(join(root, PRESET_DIR, 'scripts', 'read.mjs'), [
    '// 默认读取脚本：{{read("state.md")}} 或 runScript("read.mjs", "state.md") → 文件内容。',
    '// cwd = runtime/；跨区读 ../preset/<file>；位置参数见全局 argv 数组。',
    'import { readFileSync } from "node:fs"',
    'const file = argv[0]',
    'if (!file) { console.error("read: missing file argument"); process.exit(1) }',
    'process.stdout.write(readFileSync(file))',
    '',
  ].join('\n'))
  writeCardDirReadme(root, 'tools', [
    '# tools/ — 主代理工具脚本',
    '',
    '每个 .mjs 即一个独立工具（node 模块，stdout 即回执）。头部 /** @tavern-schema … */',
    '注释块（JSON：description + parameters）注册为具名参数工具，参数对象在全局 `args`；',
    '无标记脚本自动获得 {args} 泛化条目，参数收作字符串数组 `argv`。',
    '本目录只服务主代理；尾代理的 runtime* 工具由引擎写死。',
  ].join('\n'))
  mkdirSync(join(root, RUNTIME_DIR), { recursive: true })
  mkdirSync(join(root, SAVINGS_DIR), { recursive: true })
}

function writeCardDirReadme(root: string, dir: 'assets' | 'setup' | 'scripts' | 'tools', body: string): void {
  mkdirSync(join(root, PRESET_DIR, dir), { recursive: true })
  writeFileSync(join(root, PRESET_DIR, dir, 'README.md'), body + '\n')
}

/** Absolute path of one prompt file. */
export function promptPath(root: string, file: CardPromptFile): string {
  return join(root, PRESET_DIR, 'prompt', file)
}

/**
 * Read one prompt file's text; missing cards (fresh workspaces) read as empty.
 * @param root - absolute workspace root.
 * @param file - prompt file basename.
 * @returns the file text, or the empty string when absent.
 */
function readPrompt(root: string, file: CardPromptFile): string {
  try {
    return readFileSync(promptPath(root, file), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
  }
}

/**
 * The tail agent's persona text: the maintenance prompt, empty meaning the
 * tail step is fully disabled for this card.
 * @param root - absolute workspace root.
 * @returns the maintenance prompt text.
 */
export function readMaintenancePrompt(root: string): string {
  return readPrompt(root, 'maintenancePrompt').trim()
}

/**
 * The narrator's system prompt text — a non-empty value is the publish floor
 * for any card (`publishCard` refuses a blank one, since an empty skeleton
 * becomes a "blank card" whose whole surface reads as broken).
 * @param root - absolute workspace root.
 * @returns the trimmed system prompt text.
 */
export function readSystemPrompt(root: string): string {
  return readPrompt(root, 'systemPrompt').trim()
}

/**
 * Parse a card's `preset/meta.json` metadata. Optional fields (`creator`,
 * `version`, `tags`) stay absent unless the card declares a well-typed,
 * non-empty value — hand-edited or older three-field metas read unchanged.
 * @param root - absolute workspace root.
 * @returns the metadata, or null when the card ships no metadata file.
 */
export function readCardMeta(root: string): TavernCardMeta | null {
  const path = join(root, PRESET_DIR, 'meta.json')
  if (!existsSync(path)) return null
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const record = raw as Record<string, unknown>
  const meta: TavernCardMeta = {
    title: typeof record.title === 'string' ? record.title : '',
    cover: typeof record.cover === 'string' ? record.cover : '',
  }
  if (typeof record.desc === 'string' && record.desc !== '') meta.desc = record.desc
  if (typeof record.creator === 'string' && record.creator !== '') meta.creator = record.creator
  if (typeof record.version === 'string' && record.version !== '') meta.version = record.version
  if (typeof record.narratorTools === 'boolean') meta.narratorTools = record.narratorTools
  if (Array.isArray(record.tags)) {
    const tags = record.tags.filter((tag): tag is string => typeof tag === 'string' && tag !== '')
    if (tags.length > 0) meta.tags = tags
  }
  return meta
}

/**
 * Whether this workspace already carries a card (a preset with metadata).
 * @param root - absolute workspace root.
 * @returns true when the client should show chat instead of onboarding.
 */
export function hasCard(root: string): boolean {
  return existsSync(join(root, PRESET_DIR, 'meta.json'))
}

/**
 * Seed the runtime from the card's setup template: a plain recursive copy.
 * @param root - absolute workspace root.
 */
export function seedRuntime(root: string): void {
  const src = join(root, PRESET_DIR, 'setup')
  const dst = join(root, RUNTIME_DIR)
  rmSync(dst, { recursive: true, force: true })
  mkdirSync(dst, { recursive: true })
  if (existsSync(src)) copyTree(src, dst)
}

/**
 * Read the card's opening page HTML.
 * @param root - absolute workspace root.
 * @returns the opening page text, or null when the card ships none.
 */
export function readOpeningHtml(root: string): string | null {
  const path = join(root, PRESET_DIR, 'setup', 'opening.html')
  if (!existsSync(path)) return null
  const text = readFileSync(path, 'utf8')
  // A blank file counts as no opening page: the client renders the default
  // opening for `null`, while `''` falls between the two render branches and
  // blanks the stage.
  return text.trim() === '' ? null : text
}

/**
 * Stamp a fresh workspace directory name under the base directory.
 * @param base - workspace base directory (usually `tavern_workspace`).
 * @returns the absolute new workspace root.
 */
export function newWorkspaceRoot(base: string): string {
  mkdirSync(base, { recursive: true })
  return join(base, stampedName('ws-', new Date()))
}

/**
 * Create the three empty roots of a fresh workspace.
 * @param root - absolute workspace root.
 * @returns the same root, for chaining.
 */
export function createWorkspaceDirs(root: string): string {
  mkdirSync(join(root, PRESET_DIR), { recursive: true })
  mkdirSync(join(root, RUNTIME_DIR), { recursive: true })
  mkdirSync(join(root, SAVINGS_DIR), { recursive: true })
  return root
}

/**
 * Restore a workspace to the fresh empty state: wipe the three roots and
 * recreate them. The abandon-paths (cancelDraft / cancelEdit) share this so
 * neither can drift back into leaving a card bound (hasCard stays false).
 * @param root - absolute workspace root.
 */
export function wipeWorkspaceDirs(root: string): void {
  for (const dir of [PRESET_DIR, RUNTIME_DIR, SAVINGS_DIR]) {
    rmSync(join(root, dir), { recursive: true, force: true })
    mkdirSync(join(root, dir), { recursive: true })
  }
}

/**
 * List the card library: every directory with a `preset/` under the root.
 * @param libRoot - absolute library directory (usually `tavern_presets`).
 * @returns one entry per card directory, directory-name sorted.
 */
export function listLibrary(libRoot: string): TavernLibraryCard[] {
  if (!existsSync(libRoot)) return []
  const cards: TavernLibraryCard[] = []
  for (const entry of readdirSync(libRoot, { withFileTypes: true })) {
    if (!entry.isDirectory() || !existsSync(join(libRoot, entry.name, PRESET_DIR))) continue
    const meta = readCardMeta(join(libRoot, entry.name))
    cards.push({ name: entry.name, meta })
  }
  cards.sort((a, b) => a.name.localeCompare(b.name))
  return cards
}

/**
 * Import a card into a workspace: copy the card's whole `preset/` tree over
 * the workspace's, then seed the runtime from its setup.
 * @param root - absolute workspace root.
 * @param sourcePreset - absolute source directory whose contents become `preset/`.
 */
export function importCardPreset(root: string, sourcePreset: string): void {
  rmSync(join(root, PRESET_DIR), { recursive: true, force: true })
  mkdirSync(join(root, PRESET_DIR), { recursive: true })
  copyTree(sourcePreset, join(root, PRESET_DIR))
  seedRuntime(root)
}

/**
 * Import a SillyTavern card's three prompt fields into a fresh workspace and
 * bank the card into the library. Only `system_prompt`, `pre_prompt`, and
 * `post_prompt` are read; the maintenance prompt stays empty, so the tail
 * agent stays off until the author writes one.
 * @param cardText - the raw `.json` card text.
 * @param root - absolute workspace root receiving the card.
 * @param libraryCardDir - library directory to also write the card into.
 * @returns the parsed card title for the session.
 */
/**
 * Commit one parsed import: write every file under a fresh library card
 * directory, copy it into the workspace, and seed the runtime.
 * @param files - card files with paths relative to the card root.
 * @param libraryCardDir - absolute destination directory under the library base.
 * @param root - absolute workspace root receiving the card.
 * @returns the library card directory name.
 */
/**
 * Publish the workspace's card into the library under a unique
 * title-derived directory (draft-page「保存并开始」/编辑卡收卡库).
 * @param root - absolute workspace root whose `preset/` is published.
 * @param libraryBase - absolute library base.
 * @returns the library card directory name.
 */
/**
 * Publish the workspace preset INTO an existing library card (编辑卡): the
 * card's whole `preset/` tree is replaced by the workspace's, keeping the
 * name. Returns the (unchanged) card name.
 * @param root - absolute workspace root whose `preset/` replaces the card's.
 * @param libraryBase - absolute library base.
 * @param name - existing library card directory name.
 */
export function publishIntoLibraryCard(root: string, libraryBase: string, name: string): string {
  if (name.includes('/') || name.startsWith('.')) throw new Error(`tavern: card name "${name}" must be a library directory name`)
  const destination = join(libraryBase, name)
  if (!existsSync(join(destination, PRESET_DIR))) throw new Error(`tavern: library card "${name}" has no preset/`)
  rmSync(join(destination, PRESET_DIR), { recursive: true, force: true })
  copyTree(join(root, PRESET_DIR), join(destination, PRESET_DIR))
  return name
}

export function publishWorkspaceCard(root: string, libraryBase: string): string {
  const meta = readCardMeta(root)
  const safeTitle = (meta?.title ?? '').trim().replace(/[\\/:*?"<>|]/g, '') || 'card'
  let name = safeTitle
  let n = 2
  while (existsSync(join(libraryBase, name))) name = `${safeTitle}-${String(n++)}`
  const destination = join(libraryBase, name)
  mkdirSync(join(destination, PRESET_DIR), { recursive: true })
  copyTree(join(root, PRESET_DIR), join(destination, PRESET_DIR))
  return name
}

export function commitImportedCard(files: readonly { path: string; content: string }[], libraryCardDir: string, root: string): string {
  const presetDir = join(libraryCardDir, PRESET_DIR)
  for (const file of files) {
    if (file.path.includes('..') || isAbsolute(file.path)) throw new Error(`tavern: import path "${file.path}" escapes the card`)
    const target = join(libraryCardDir, file.path)
    if (!target.startsWith(resolve(libraryCardDir) + sep)) throw new Error(`tavern: import path "${file.path}" escapes the card`)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, file.content)
  }
  mkdirSync(presetDir, { recursive: true })
  importCardPreset(root, presetDir)
  seedRuntime(root)
  return basename(libraryCardDir)
}

/**
 * Write a manual save: copy the whole runtime tree into `savings/<name>/`.
 * @param root - absolute workspace root.
 * @param name - save directory name (validated by the caller).
 */
function writeSave(root: string, name: string): void {
  const dst = savingsChild(root, name)
  rmSync(dst, { recursive: true, force: true })
  mkdirSync(dst, { recursive: true })
  copyTree(join(root, RUNTIME_DIR), dst)
}

/**
 * Autosave the runtime and prune the autosave ring.
 * @param root - absolute workspace root.
 * @param keep - how many `autosave-*` saves to keep.
 */
export function autosave(root: string, keep: number): void {
  writeSave(root, readableSaveName(root, new Date()))
  const autos = listSaves(root).filter(save => save.type === 'auto')
  for (const doomed of autos.slice(keep)) {
    rmSync(join(root, SAVINGS_DIR, doomed.name), { recursive: true, force: true })
  }
}

/**
 * Save manually (named, never pruned).
 * @param root - absolute workspace root.
 * @param name - save directory name.
 */
export function manualSave(root: string, name: string): void {
  writeSave(root, name)
}

/**
 * List the saves of a workspace, newest-first by directory write time (the
 * name formats have changed shape over time, so directory order is the
 * era-independent authority — the autosave ring prunes through this order).
 * Autosave kind comes from the name prefix; summary comes from the boundary
 * ledger (empty for unstamped rows).
 * @param root - absolute workspace root.
 * @returns saves newest-first; mtime ties fall back to name order.
 */
export function listSaves(root: string): TavernSave[] {
  const dir = join(root, SAVINGS_DIR)
  if (!existsSync(dir)) return []
  const entries = readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory())
  const rows: (TavernSave & { mtimeMs: number })[] = entries.map(entry => ({
    name: entry.name,
    type: (entry.name.startsWith('autosave-') ? 'auto' : 'manual'),
    summary: readSaveStamp(root, entry.name)?.summary ?? '',
    mtimeMs: statSync(join(dir, entry.name)).mtimeMs,
  }))
  rows.sort((a, b) => b.mtimeMs - a.mtimeMs || b.name.localeCompare(a.name))
  return rows
}

/**
 * Load a save: replace the runtime with the save's snapshot.
 *
 * 改名换位(2026-09-24,Windows 语义):裸的 rmSync→copy 在 Windows 上是脆断
 * 的——被删的 runtime 里有几秒前刚写过的热文件(回合+记账落盘的 state/角色/
 * 快照),杀软与索引器的关闭态句柄让 unlink/rmdir 报 EPERM/EBUSY;POSIX 上
 * 这些删除合法,开发机永远看不见。新序:先把 live runtime 原地改名让位
 * (rename 不受 cwd 占用/热句柄影响)→ 从快照重建 → 兜底退役旧树。
 * 好性质:删除失败再也拖不垮载入(快照已生效,旧树留给下次清扫);
 * 拷贝失败则退回原位,世界无损。
 * @param root - absolute workspace root.
 * @param name - save directory name.
 */
export function loadSave(root: string, name: string): void {
  const src = savingsChild(root, name)
  const runtime = join(root, RUNTIME_DIR)
  // 隐藏名约定(同 .tavern-boundaries.json):编辑树只看 preset/runtime/savings
  // 三个顶层项,这块过渡树对编辑器/模型不可见;固定名 + 前置清扫支持重入。
  const retired = join(root, '.tavern-runtime-retired')
  rmSync(retired, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  renameSync(runtime, retired)
  try {
    copyTree(src, runtime)
  } catch (error) {
    // 拷贝失败:新风不完整,退回原位(引擎侧 load 的回滚会话绑定仍需 self-care)。
    rmSync(runtime, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
    renameSync(retired, runtime)
    throw error
  }
  try {
    rmSync(retired, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  } catch (error) {
    // 退役失败不再拖垮载入(面板泵 cwd 钉住旧树的窗口or杀软锁):载入已生效,
    // 躯壳留给下一次 loadSave 的前置清扫。
    console.warn(`tavern: retired runtime cleanup deferred: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Delete one save directory.
 * @param root - absolute workspace root.
 * @param name - save directory name.
 */
export function deleteSave(root: string, name: string): void {
  rmSync(savingsChild(root, name), { recursive: true, force: true })
}

/**
 * The boundary ledger is one hidden JSON file per workspace's savings area —
 * hidden entries are invisible to the editor tree and unwritable through the
 * editor seam, so the stamps are engine-owned metadata, not user files.
 */
const BOUNDARIES_FILE = '.tavern-boundaries.json'

function boundariesPath(root: string): string {
  return join(root, SAVINGS_DIR, BOUNDARIES_FILE)
}

/**
 * Record the save-point boundary for one save.
 * @param root - absolute workspace root.
 * @param name - save directory name.
 * @param stamp - the save-time session id and `turn/end` seq.
 */
export function writeSaveStamp(root: string, name: string, stamp: TavernSaveStamp): void {
  const path = boundariesPath(root)
  let ledger: Record<string, TavernSaveStamp> = {}
  try {
    ledger = JSON.parse(readFileSync(path, 'utf8')) as Record<string, TavernSaveStamp>
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  ledger[name] = stamp
  mkdirSync(join(root, SAVINGS_DIR), { recursive: true })
  writeFileSync(path, `${JSON.stringify(ledger, undefined, 2)}\n`)
}

/**
 * Read one save's stamped boundary; absent (pre-stamp saves) reads as
 * `undefined`.
 * @param root - absolute workspace root.
 * @param name - save directory name.
 */
export function readSaveStamp(root: string, name: string): TavernSaveStamp | undefined {
  try {
    const ledger = JSON.parse(readFileSync(boundariesPath(root), 'utf8')) as Record<string, TavernSaveStamp>
    return ledger[name]
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw error
  }
}

/** Drop one save's boundary entry; a missing ledger or entry is fine. */
export function deleteSaveStamp(root: string, name: string): void {
  try {
    const path = boundariesPath(root)
    const ledger = JSON.parse(readFileSync(path, 'utf8')) as Record<string, TavernSaveStamp>
    if (ledger[name] === undefined) return
    const next = Object.fromEntries(Object.entries(ledger).filter(([saved]) => saved !== name))
    writeFileSync(path, `${JSON.stringify(next, undefined, 2)}\n`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

/**
 * Write the autosave ring snapshot AND stamp its boundary; returns the
 * autosave directory name so the engine can pair the stamp to the exact
 * `turn/end` it follows.
 * @param root - absolute workspace root.
 * @param keep - how many `autosave-*` saves to keep.
 * @param stamp - the save-time boundary.
 * @returns the autosave directory name.
 */
export function autosaveStamped(root: string, keep: number, stamp: TavernSaveStamp): string {
  const name = readableSaveName(root, new Date())
  writeSave(root, name)
  writeSaveStamp(root, name, stamp)
  const autos = listSaves(root).filter(save => save.type === 'auto')
  for (const doomed of autos.slice(keep)) {
    rmSync(join(root, SAVINGS_DIR, doomed.name), { recursive: true, force: true })
    const path = boundariesPath(root)
    try {
      const ledger = JSON.parse(readFileSync(path, 'utf8')) as Record<string, TavernSaveStamp>
      const next = Object.fromEntries(Object.entries(ledger).filter(([saved]) => saved !== doomed.name))
      writeFileSync(path, `${JSON.stringify(next, undefined, 2)}\n`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  return name
}

/** A fenced child path of the savings area. */
function savingsChild(root: string, name: string): string {
  if (name.includes('/') || name.startsWith('.') || name.length === 0) {
    throw new Error('tavern: save name becomes a directory name — no separators, no leading dot')
  }
  return fenceIn(join(root, SAVINGS_DIR), name)
}

/**
 * Ensure `child` resolves inside `dir` (both may be relative to cwd).
 * @param dir - containing absolute directory.
 * @param child - absolute or root-relative candidate path.
 * @returns the fenced absolute path.
 */
export function fenceIn(dir: string, child: string): string {
  if (child.includes('\0')) throw new Error('tavern: path contains NUL')
  const base = resolve(dir)
  const target = isAbsolute(child) ? resolve(child) : resolve(base, child)
  if (target !== base && !target.startsWith(base + sep)) {
    throw new Error(`tavern: path "${child}" escapes ${base}`)
  }
  return target
}

/**
 * List a workspace tree (bounded), one flat entry per file or directory.
 * Hidden entries and files above the byte cap are skipped by the caller's policy.
 * @param root - absolute workspace root.
 * @returns entries in lexical order; directory paths end with `/`.
 */
export function listTree(root: string): TavernTreeEntry[] {
  const entries: TavernTreeEntry[] = [ { path: 'preset/', dir: true }, { path: RUNTIME_DIR + '/', dir: true }, { path: SAVINGS_DIR + '/', dir: true } ]
  const walk = (abs: string, rel: string): void => {
    if (!existsSync(abs)) return
    for (const entry of readdirSync(abs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.name.startsWith('.')) continue
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`
      if (entry.isDirectory()) {
        entries.push({ path: childRel + '/', dir: true })
        walk(join(abs, entry.name), childRel)
      } else {
        entries.push({ path: childRel, dir: false })
      }
    }
  }
  for (const top of [PRESET_DIR, RUNTIME_DIR, SAVINGS_DIR]) {
    walk(join(root, top), top)
  }
  return entries
}

/**
 * Read one workspace text file (fenced, byte-capped).
 * @param root - absolute workspace root.
 * @param rel - path relative to the workspace root.
 * @param maxBytes - inclusive byte cap.
 * @returns the file text.
 */
export function readWorkspaceText(root: string, rel: string, maxBytes: number): string {
  const path = fenceIn(root, rel)
  const size = statSync(path).size
  if (size > maxBytes) throw new Error(`tavern: file "${rel}" is ${size} bytes, over the ${maxBytes}-byte read cap`)
  return readFileSync(path, 'utf8')
}

/** Previewable asset extensions → MIME; anything else the editor refuses. */
const ASSET_MIME: ReadonlyMap<string, string> = new Map([
  ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.gif', 'image/gif'],
  ['.webp', 'image/webp'], ['.svg', 'image/svg+xml'], ['.bmp', 'image/bmp'],
  ['.mp3', 'audio/mpeg'], ['.wav', 'audio/wav'], ['.ogg', 'audio/ogg'], ['.m4a', 'audio/mp4'],
  ['.mp4', 'video/mp4'], ['.webm', 'video/webm'], ['.mov', 'video/quicktime'],
])

/**
 * Read one workspace asset as a data URL for preview (fenced, MIME-sniffed,
 * byte-capped). Text files go through {@link readWorkspaceText} instead.
 * @param root - absolute workspace root.
 * @param rel - path relative to the workspace root.
 * @param maxBytes - inclusive preview cap.
 */
/**
 * Read one library card asset as a data URL (fenced inside that card's
 * directory, MIME-sniffed, byte-capped) — the library shelf renders
 * `meta.cover` images through this.
 * @param libRoot - absolute library base.
 * @param card - library card directory name.
 * @param rel - path relative to the card root (e.g. the meta `cover` value).
 * @param maxBytes - inclusive preview cap.
 */
export function readLibraryAsset(libRoot: string, card: string, rel: string, maxBytes: number): string {
  if (card.includes('/') || card.startsWith('.')) throw new Error(`tavern: card name "${card}" must be a library directory name`)
  const cardDir = join(libRoot, card)
  if (!existsSync(join(cardDir, PRESET_DIR))) throw new Error(`tavern: library card "${card}" has no preset/`)
  return readAsset(cardDir, rel, maxBytes)
}

export function readAsset(root: string, rel: string, maxBytes: number): string {
  const path = fenceIn(root, rel)
  const mime = ASSET_MIME.get(extname(path).toLowerCase())
  if (mime === undefined) throw new Error(`tavern: file "${rel}" is not a previewable asset`)
  const size = statSync(path).size
  if (size > maxBytes) throw new Error(`tavern: file "${rel}" is ${size} bytes, over the ${maxBytes}-byte preview cap`)
  return `data:${mime};base64,${readFileSync(path).toString('base64')}`
}

/**
 * Write one binary asset into the workspace's `preset/` area (the
 * identity-header cover upload): base64-decoded, extension-allowlisted,
 * byte-capped, fenced. `runtime/` and `savings/` stay out — preset/ is the
 * card author's surface, and the cover is card content.
 * @param root - absolute workspace root.
 * @param rel - path relative to the workspace root; must sit under `preset/`.
 * @param dataBase64 - base64-encoded file content (no `data:` URL prefix).
 * @param maxBytes - inclusive byte cap for the decoded content.
 */
export function writeAsset(root: string, rel: string, dataBase64: string, maxBytes: number): void {
  if (!rel.startsWith(PRESET_DIR + '/')) throw new Error('tavern: asset writes are limited to preset/')
  const path = fenceIn(join(root, PRESET_DIR), rel.slice(PRESET_DIR.length + 1))
  if (!ASSET_MIME.has(extname(path).toLowerCase())) throw new Error(`tavern: file "${rel}" is not a writable asset`)
  const bytes = Buffer.from(dataBase64, 'base64')
  if (bytes.length > maxBytes) throw new Error(`tavern: asset "${rel}" is ${bytes.length} bytes, over the ${maxBytes}-byte write cap`)
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, bytes)
}

/**
 * Whether the workspace's `preset/` tree differs from a library card's —
 * the 编辑卡 unsaved-changes check. Comparison covers relative paths and
 * bytes under `preset/` only (`runtime/` is live state, `savings/` holds
 * snapshots); a path present on one side only counts as a difference.
 * @param root - absolute workspace root.
 * @param libraryCardDir - absolute library card directory to compare against.
 * @returns true when the two preset trees differ.
 */
export function presetDiffers(root: string, libraryCardDir: string): boolean {
  return diffTree(join(root, PRESET_DIR), join(libraryCardDir, PRESET_DIR))
}

/** Byte-and-structure comparison of two directory trees; true on any difference. */
function diffTree(left: string, right: string): boolean {
  const readEntries = (dir: string): Dirent[] => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }) : []
  const byName = (a: Dirent, b: Dirent): number => a.name.localeCompare(b.name)
  const leftEntries = readEntries(left)
  const rightEntries = readEntries(right)
  if (leftEntries.length !== rightEntries.length) return true
  const sortedLeft = [...leftEntries].sort(byName)
  const sortedRight = [...rightEntries].sort(byName)
  for (let index = 0; index < sortedLeft.length; index += 1) {
    const leftEntry = sortedLeft[index]
    const rightEntry = sortedRight[index]
    if (leftEntry === undefined || rightEntry === undefined || leftEntry.name !== rightEntry.name) return true
    if (leftEntry.isDirectory() !== rightEntry.isDirectory()) return true
    const leftPath = join(left, leftEntry.name)
    const rightPath = join(right, rightEntry.name)
    if (leftEntry.isDirectory()) {
      if (diffTree(leftPath, rightPath)) return true
      continue
    }
    if (!leftEntry.isFile() || !rightEntry.isFile() || !readFileSync(leftPath).equals(readFileSync(rightPath))) return true
  }
  return false
}

/**
 * Write one workspace text file for the user editor (preset area only —
 * runtime is the tail agent's, savings is snapshot-stores).
 * @param root - absolute workspace root.
 * @param rel - path relative to the workspace root.
 * @param text - the complete new text.
 */
export function writeWorkspaceText(root: string, rel: string, text: string): void {
  // preset/ is the card author's surface; runtime/ is live world state the
  // user may tune by hand between the maintenance agent's passes. savings/
  // stays out: snapshots are the load path's source of truth.
  const area = rel.startsWith(PRESET_DIR + '/') ? PRESET_DIR : rel.startsWith(RUNTIME_DIR + '/') ? RUNTIME_DIR : undefined
  if (area === undefined) throw new Error('tavern: user edits are limited to preset/ and runtime/')
  const path = fenceIn(join(root, area), rel.slice(area.length + 1))
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, text)
}

/**
 * Template-mandated paths: each may be empty but must exist, and the editor
 * never removes or renames one. Covers the workspace's three root areas, the
 * standard card's skeleton directories, its metadata file, and the three
 * prompt files a standard card must always carry. `preset/prompt/prefixPrompt`
 * is deliberately absent: retired with the wrap scheme (2026-09-16) and never
 * read — an ordinary optional file the editor may delete or rename freely.
 */
export const FIXED_PATHS: ReadonlySet<string> = new Set([
  'preset/',
  'preset/prompt/',
  'preset/scripts/',
  'preset/tools/',
  'preset/meta.json',
  'preset/prompt/systemPrompt',
  'preset/prompt/postPrompt',
  'preset/prompt/maintenancePrompt',
  'runtime/',
  'savings/',
])

/** True when `rel` sits strictly inside one of the editor-writable areas. */
function insideEditableArea(root: string, rel: string): boolean {
  const path = fenceIn(root, rel)
  return [PRESET_DIR, RUNTIME_DIR, SAVINGS_DIR].some(area => path.startsWith(resolve(root, area) + sep))
}

/** The editable area `rel` sits strictly inside, for same-area move pairing. */
function editableAreaOf(root: string, rel: string): 'preset' | 'runtime' | undefined {
  const path = fenceIn(root, rel)
  if (path.startsWith(resolve(root, PRESET_DIR) + sep)) return 'preset'
  if (path.startsWith(resolve(root, RUNTIME_DIR) + sep)) return 'runtime'
  return undefined
}

/**
 * Create, move, or delete a workspace file through the editor.
 *
 * Creation reaches `preset/`, `runtime/`, and `savings/` and refuses occupied
 * targets (an overwrite would truncate a live file); moves stay within one
 * editable area — `preset/` and `runtime/` rename freely, `savings/` snapshots
 * never move (they are the load path's source of truth). Fixed paths are never
 * a move's endpoints and never deleted; a move onto an occupied target refuses
 * instead of merging.
 * @param root - absolute workspace root.
 * @param op - one of create / mkdir / move / delete, all with root-relative paths.
 */
export function workspaceFileOp(
  root: string,
  op: { kind: 'create'; path: string } | { kind: 'mkdir'; path: string } | { kind: 'move'; from: string; to: string } | { kind: 'delete'; path: string },
): void {
  if (op.kind === 'create') {
    if (FIXED_PATHS.has(op.path)) throw new Error(`tavern: "${op.path}" is a fixed template path`)
    if (!insideEditableArea(root, op.path)) throw new Error('tavern: editor creates are limited to preset/, runtime/, and savings/')
    const path = fenceIn(root, op.path)
    if (existsSync(path)) throw new Error(`tavern: "${op.path}" already exists — creating needs a free name`)
    mkdirSync(join(path, '..'), { recursive: true })
    writeFileSync(path, '')
    return
  }
  if (op.kind === 'mkdir') {
    if (FIXED_PATHS.has(op.path)) throw new Error(`tavern: "${op.path}" is a fixed template path`)
    if (!insideEditableArea(root, op.path)) throw new Error('tavern: editor mkdir is limited to preset/, runtime/, and savings/')
    const path = fenceIn(root, op.path)
    if (existsSync(path)) throw new Error(`tavern: "${op.path}" already exists — mkdir needs a free name`)
    mkdirSync(path, { recursive: true })
    return
  }
  if (op.kind === 'move') {
    if (FIXED_PATHS.has(op.from)) throw new Error(`tavern: "${op.from}" is a fixed template path and cannot be renamed`)
    const toCollision = FIXED_PATHS.has(op.to) || FIXED_PATHS.has(`${op.to}/`)
    if (toCollision) throw new Error(`tavern: "${op.to}" collides with a fixed template path`)
    const from = fenceIn(root, op.from)
    const to = fenceIn(root, op.to)
    const fromArea = editableAreaOf(root, op.from)
    if (fromArea === undefined || fromArea !== editableAreaOf(root, op.to)) {
      throw new Error('tavern: editor moves stay within preset/ or runtime/')
    }
    if (existsSync(to)) throw new Error(`tavern: "${op.to}" already exists — rename needs a free target`)
    if (from === to || to.startsWith(from + sep)) throw new Error(`tavern: "${op.to}" sits inside "${op.from}" — a move cannot target its own subtree`)
    mkdirSync(join(to, '..'), { recursive: true })
    copyPath(from, to)
    rmSync(from, { recursive: true, force: true })
    return
  }
  if (FIXED_PATHS.has(op.path)) throw new Error(`tavern: "${op.path}" is a fixed template path and cannot be deleted`)
  if (!insideEditableArea(root, op.path)) throw new Error('tavern: editor deletes are limited to preset/, runtime/, and savings/')
  rmSync(fenceIn(root, op.path), { recursive: true, force: true })
}
