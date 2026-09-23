/**
 * Per-agent tool faces of one tavern workspace. The main agent's face is the
 * card's own `preset/tools/` scripts — every script registers as its own tool
 * entry: a `@tavern-schema` header block gives named parameters and a
 * description, a script without one gets a generic `{args}` entry (the old
 * `executeTools` escape hatch, per-script). The fixed `runtime*` family guards
 * the runtime tree — the write face (`runtimeWrite` full-document upsert,
 * `runtimeEdit` literal str replacement with `replace_all`, plus
 * `runtimeDelete`) rides the tail agent's fork-scoped context (the registry's
 * per-agent variant path); the read pair (`runtimeRead` — line-numbered file
 * reads with `view_range` and two-level directory listings — and
 * `runtimeGrep`) rides both faces — on the main agent's context together with
 * the card tools, toggleable per workspace through the narrator-tools flag so
 * the blind-narrator visibility carries no workspace access, always-on on the
 * tail face. Every model-supplied path is fenced through realpath containment
 * before any I/O, and every .json mutation is parse-checked on the RESULTING
 * document. Concurrency: the read pair and the write pair declare parallel-safe
 * (the kernel pool runs same-step calls concurrently); the write pair
 * additionally serializes same-path mutations through a per-path promise
 * chain, so different files write concurrently while one file's edits keep
 * their model order. `runtimeDelete` and the card tools stay exclusive — the
 * kernel's barrier semantics drain the pool before they run.
 * @module dsh-tavern-fengyue-engine/tools
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { ShellExecRequest, ShellExecSpec, ShellRunResult } from '@deepseek-ai/dsh-shell'
import { defineTool, parameterSchemaSpecToJsonSchema, type ParameterSchemaSpec, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import { fenceIn, PRESET_DIR, RUNTIME_DIR } from './workspace.ts'

/** Byte cap on one runtime document read. */
const READ_CAP = 1_000_000
/** Byte cap on one runtime write payload. */
const WRITE_CAP = 1_000_000
/** Line cap on one grep result. */
const GREP_LINES = 200
/** Byte cap on one tool-script invocation's captured stdout. */
const TOOL_OUTPUT_CAP = 8_000
/** Timeout of one tool-script invocation. */
const TOOL_TIMEOUT_MS = 10_000

/** The shell executor's narrow resolve/run surface. */
export type ShellSeam = {
  resolve: (request: ShellExecRequest) => ShellExecSpec
  run: (spec: ShellExecSpec) => Promise<ShellRunResult>
}

/** A parsed `@tavern-schema` header block of one card tool script. */
export interface CardToolSchema {
  /** Model-facing tool description. */
  description: string
  /** Parameter DSL (implicit object root, per-property `required: true`). */
  parameters: ParameterSchemaSpec
  /**
   * The faces this tool registers on (`'main'` / `'tail'`). Omitted = `['main']`
   * — the fail-safe default (an unmarked write tool must never leak to the
   * tail, and unmarked generic tools stay where the historical face was).
   * 依据:docs/architecture/design.zh.md「工具归属与引擎能力边界」归属声明制。
   */
  agents: readonly string[]
}

/** The `@tavern-schema` marker opens the leading block comment of a card tool script. */
const SCHEMA_MARKER = /\/\*\*?\s*@tavern-schema\b/
const SCHEMA_CLOSE_SEQ = '*/'
/**
 * The node runner line: imports the card script file by absolute path (ESM —
 * top-level await works, relative imports resolve against the script's own
 * directory) and fills the global `args` with the decoded argument value: the
 * parsed object for schema'd tools, the raw string for schema-less ones.
 *
 * Runner AS A FILE, not `-e` inline: the command string passes through the
 * deployment's shell face — POSIX bash keeps single quotes literal, and
 * pwsh ≥ 7.3 passes native arguments Standard-style, but Windows PowerShell
 * 5.1 (dsh's last-resort executor binary) re-serializes native arguments
 * Legacy-style and DESTROYS the embedded double quotes of an inline decoder —
 * node then compiles a mangled `-e` and exits 1 (the 2026-09-23 devlog entry:
 * every card script dead on PS 5.1 hosts while macOS never noticed). A file
 * runner leaves exactly one quoted token on the command line — the runner
 * path itself — and path quotes are unbreakable: `"` is an illegal filename
 * character on Windows, so the double-quote form cannot carry embedded
 * quotes there, and the POSIX form uses the standard `'\''` escape.
 *
 * The two payloads ride as base64 (the shell-neutral alphabet — b64's real
 * job, unbowed): `argv[2]`=b64(absolute script path), `argv[3]`=b64(JSON
 * payload). Tokens cannot start with `-` (base64 alphabet), so the `--`
 * separator the inline face needed is retired.
 *
 * Stdout hardening lives in the runner file (packages/engine/runner/):
 * card scripts end with `process.exit(0)` right after `console.log(...)`,
 * and exit would truncate stdout still queued in the pipe — the runner
 * defers the real exit until streams drain and swallows output past the
 * first exit call. Same contract byte-for-byte as the retired inline form.
 */
const CARD_SCRIPT_RUNNER = fileURLToPath(new URL('../runner/runner.cjs', import.meta.url))
/** b64 助手：路径与参数载荷都走 base64（shell 中立字母表，零引号损耗）。 */
const b64 = (text: string): string => Buffer.from(text).toString('base64')
/** Quote the runner path for the deployment shell face (see the class doc above). */
function quoteRunner(): string {
  return process.platform === 'win32'
    ? `"${CARD_SCRIPT_RUNNER}"`
    : `'${CARD_SCRIPT_RUNNER.replace(/'/g, `'\\''`)}'`
}
/**
 * 卡脚本 v3 的执行命令：`node <runner> <b64脚本路径> <b64参数载荷>`。
 * 参数载荷恒为 JSON 文本 —— 有 schema 块的脚本收到参数**对象**（`args.x`），
 * 无块脚本收到位置参数**数组**（`argv[0]`…）。解码注入全部 shell 中立。
 * @param scriptPath - 卡脚本的绝对路径（调用方已做过存在性检查；脚本在
 *   检查与运行之间被删属于 TOCTOU 窗口，runner 会以开头的 stderr 栈说明
 *   原 exit(1) 面呈现回执）。
 * @param argsPayloadJson - 参数载荷的 JSON 文本（对象或字符串/数组）。
 * @returns the shell command line.
 */
export function cardScriptCommand(scriptPath: string, argsPayloadJson: string): string {
  return `node ${quoteRunner()} ${b64(scriptPath)} ${b64(argsPayloadJson)}`
}

const SCHEMA_CACHE = new Map<string, { mtimeMs: number; schema: CardToolSchema | null }>()

/**
 * Read one card tool script's schema block: `#!` line, then a marker comment
 * `# @tavern-schema`, then `#`-comment lines carrying JSON (leading `#` and
 * one space stripped), ending at the first non-comment line. Parsing never
 * executes the script. A block that fails to parse or violates the parameter
 * DSL throws — misconfiguration fails loud at the earliest resolvable point.
 * @param path - absolute script path.
 * @param mtimeMs - the file's mtime; equal hits reuse the cached parse.
 * @returns the parsed schema, or null when the script carries no block.
 */
export function cardToolSchema(path: string, mtimeMs: number): CardToolSchema | null {
  const hit = SCHEMA_CACHE.get(path)
  if (hit !== undefined && hit.mtimeMs === mtimeMs) return hit.schema
  const schema = parseCardToolSchema(readFileSync(path, 'utf8'), path)
  SCHEMA_CACHE.set(path, { mtimeMs, schema })
  return schema
}

/**
 * Parse one script's text for its schema block.
 * @param text - the script's full text.
 * @param path - absolute script path, for error attribution only.
 * @returns the parsed schema, or null when no marker line is present.
 */
function parseCardToolSchema(text: string, path: string): CardToolSchema | null {
  const marker = SCHEMA_MARKER.exec(text)
  if (marker === null || marker.index === undefined) return null
  // JSON rides from the marker to the comment's closing `*/` (or EOF).
  const after = text.slice(marker.index + marker[0].length)
  const close = after.indexOf(SCHEMA_CLOSE_SEQ)
  const jsonText = (close >= 0 ? after.slice(0, close) : after).trim()
  if (jsonText === '') return null
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (error) {
    throw new Error(`tavern: tool script "${path}" has an invalid @tavern-schema block: ${error instanceof Error ? error.message : String(error)}`)
  }
  const { description, parameters, agents } = (parsed ?? {}) as { description?: unknown; parameters?: unknown; agents?: unknown }
  if (typeof description !== 'string' || description.trim() === '') {
    throw new Error(`tavern: tool script "${path}" @tavern-schema block lacks a non-empty "description"`)
  }
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new Error(`tavern: tool script "${path}" @tavern-schema block lacks a "parameters" object`)
  }
  let faces: readonly string[] = ['main']
  if (agents !== undefined) {
    if (!Array.isArray(agents) || agents.some(entry => typeof entry !== 'string' || entry.trim() === '')) {
      throw new Error(`tavern: tool script "${path}" @tavern-schema "agents" must be an array of face names ("main" / "tail")`)
    }
    faces = agents as string[]
  }
  const spec = parameters as ParameterSchemaSpec
  parameterSchemaSpecToJsonSchema(spec)
  return { description, parameters: spec, agents: faces }
}

/**
 * Run one card tool script through the shell seam. The script source and the
 * argument payload both ride base64-encoded through a `node -e` data-module
 * import — the line is shell-neutral (identical text for every face). The
 * module sees the decoded payload as its global `argv` value; callers state
 * the payload's JSON form here (object for schema'd tools, string for the
 * generic one). The execution's cancellation signal rides into the shell, so
 * a cancelled turn kills the running script
 * @param root - absolute workspace root.
 * @param toolsDir - absolute fenced tools directory.
 * @param name - tool script name (file base name).
 * @param payloadJson - the argument payload, already JSON-encoded.
 * @param shell - the deployment's shell executor.
 * @param signal - the tool execution's cancellation signal.
 * @returns the exit banner plus captured stdout.
 */
async function runCardTool(
  root: string,
  toolsDir: string,
  name: string,
  argv: string | undefined,
  shell: ShellSeam,
  signal: AbortSignal | undefined,
): Promise<string> {
  const path = fenceIn(toolsDir, `${name}.mjs`)
  if (!existsSync(path) || !statSync(path).isFile()) {
    throw new Error(`tavern: card has no tool "${name}"`)
  }
  const spec = shell.resolve({
    command: cardScriptCommand(path, argv ?? 'null'),
    workdir: join(root, RUNTIME_DIR),
    timeoutMs: TOOL_TIMEOUT_MS,
    stdoutMaxBytes: TOOL_OUTPUT_CAP,
    ...(signal === undefined ? {} : { signal }),
  })
  const result = await shell.run(spec)
  const banner = `Exit: ${result.exitCode === null ? 'signal' : result.exitCode}`
  const out = result.stdout.text.replace(/\s+$/, '')
  const errOut = result.stderr.text.replace(/\s+$/, '').slice(0, TOOL_OUTPUT_CAP)
  // stderr（未捕获异常栈等）绝不静默丢弃——失败回执必须带原因，成功时的杂音 stderr 也照登（[stderr] 节标记）
  return errOut === '' ? `${banner}\n${out}` : `${banner}\n${out}${out === '' ? '' : '\n'}[stderr]\n${errOut}`
}

/** The generic output face shared by every card tool entry: plain text. */
const cardToolOutput = {
  output: { schema: { type: 'string' }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: String(value) }] },
} as const

/** The generic entry's single optional parameter, mirroring the retired generic entry's `args`. */
const GENERIC_ARGS_SPEC: ParameterSchemaSpec = {
  args: { type: 'string', description: 'Command line arguments passed to the script.' },
}

/**
 * Register the main agent's tool face: every `preset/tools/*.mjs` script as its
 * own tool entry plus, while the workspace's narrator-tools flag reads on, the
 * read pair over `runtime/`. Registration re-syncs at every assembly from a
 * cheap directory probe — a changed or added script re-registers (its disposer
 * retires the stale entry), a removed script's entry is disposed; an unchanged
 * directory re-registers nothing. The flag re-reads on every sync the same
 * way, so the read pair is disposable and re-registrable mid-session. The
 * kernel collects tool schemas BEFORE the assemble waterfall fires, so a
 * caller that mutates `preset/tools/` or the flag through the engine calls the
 * returned sync function to make the change visible on the CURRENT request;
 * the assembly-point sync remains the net for out-of-band file writes.
 * @param agentCtx - the main agent's scoped context.
 * @param root - absolute workspace root.
 * @param shell - the deployment's shell executor.
 * @param runtimeToolsOn - the workspace's narrator-tools flag (re-read per
 *   sync); omitted means always on — the unconditional historical face.
 * @returns the re-sync; idempotent, free when nothing changed.
 */
export function registerMainAgentTools(agentCtx: Context, root: string, shell: ShellSeam, runtimeToolsOn?: () => boolean): () => void {
  const toolsDir = fenceIn(root, join(PRESET_DIR, 'tools'))
  /** Live per-file registrations: file name → its mtime and registry disposer. */
  const registered = new Map<string, { mtimeMs: number; dispose: () => void }>()
  /** Live read-pair registrations: tool name → its registry disposer. */
  const fixed = new Map<string, () => void>()
  /** Diff-manage one fixed tool behind the flag: registered while on. */
  const manageFixed = (name: 'runtimeRead' | 'runtimeGrep', register: () => () => void): void => {
    const known = fixed.get(name)
    if (runtimeToolsOn === undefined || runtimeToolsOn()) {
      if (known === undefined) fixed.set(name, register())
      return
    }
    if (known !== undefined) {
      known()
      fixed.delete(name)
    }
  }
  const sync = (): void => {
    if (existsSync(toolsDir)) {
      const entries = new Map<string, number>()
      for (const file of readdirSync(toolsDir)) {
        if (!file.endsWith('.mjs')) continue
        entries.set(file, statSync(join(toolsDir, file)).mtimeMs)
      }
      for (const [file, known] of registered) {
        if (entries.get(file) === known.mtimeMs) continue
        known.dispose()
        registered.delete(file)
      }
      for (const [file, mtimeMs] of entries) {
        if (registered.get(file)?.mtimeMs === mtimeMs) continue
        // 归属声明制:schema 读 agents 字段(缺省 ['main'])——本面缺名即不注册。
        // 无 schema 块的 generic 脚本恒归主面(fail-safe)。mtime 变更自然重评估。
        const path = join(toolsDir, file)
        const schema = cardToolSchema(path, mtimeMs)
        if (schema !== null && !schema.agents.includes('main')) continue
        registered.set(file, { mtimeMs, dispose: registerCardTool(agentCtx, toolsDir, root, shell, file) })
      }
    }
    // Card entries first, the pair last — the historical registration order
    // (card diff, then the fixed pair) stays observable in the registry.
    manageFixed('runtimeRead', () => agentCtx.tools.register(runtimeReadTool(root)))
    manageFixed('runtimeGrep', () => agentCtx.tools.register(runtimeGrepTool(root)))
  }
  sync()
  agentCtx.on('system-prompt/assemble', (_assembly, _context, next) => {
    sync()
    return next()
  })
  return sync
}

/**
 * Register one card tool script as its own entry.
 * @param agentCtx - the main agent's scoped context.
 * @param toolsDir - absolute fenced tools directory.
 * @param root - absolute workspace root.
 * @param shell - the deployment's shell executor.
 * @param file - the script's file name under tools/.
 * @returns the registry disposer.
 */
function registerCardTool(
  agentCtx: Context,
  toolsDir: string,
  root: string,
  shell: ShellSeam,
  file: string,
): () => void {
  const name = file.replace(/\.mjs$/, '')
  const path = join(toolsDir, file)
  // An invalid @tavern-schema block throws here — compose-time for a card
  // shipped broken, assembly-time for a mid-session edit; both fail loud.
  const schema = cardToolSchema(path, statSync(path).mtimeMs)
  const schemaless = schema === null
  return agentCtx.tools.register(defineTool({
    name,
    description: schemaless
      ? 'Run this card tool script. Its arguments arrive as the `args` string.'
      : schema.description,
    parameters: schemaless ? GENERIC_ARGS_SPEC : schema.parameters,
    ...cardToolOutput,
    async execute(args: unknown, exec: ToolRunContext) {
      const { args: argv } = args as { args?: string }
      const payload = schemaless ? JSON.stringify([argv]) : JSON.stringify(args)
      return await runCardTool(root, toolsDir, name, payload, shell, exec.signal)
    },
  }))
}

/**
 * Register the tail agent's tool face: the fixed read pair, the write pair
 * (`runtimeWrite`/`runtimeEdit`, sharing one per-path mutation chain) and
 * `runtimeDelete`, plus card tools whose schema declares `'tail'` in `agents`
 * (e.g. the ledger writers gain_exp/gain_money). The tail re-composes every
 * fork, so card changes land on the next turn with no mtime sync.
 * @param agentCtx - the tail fork child's scoped context.
 * @param root - absolute workspace root.
 * @param shell - the deployment's shell executor (card tool spawns).
 */
export function registerTailAgentTools(agentCtx: Context, root: string, shell: ShellSeam): void {
  // 卡面先于固定件——与主面「card entries first」的注册序一致。
  const toolsDir = fenceIn(root, join(PRESET_DIR, 'tools'))
  if (existsSync(toolsDir)) {
    for (const file of readdirSync(toolsDir)) {
      if (!file.endsWith('.mjs')) continue
      // 归属声明制:缺省 ['main'](fail-safe)——只有显式声明 tail 的写盘工具进尾面。
      const schema = cardToolSchema(join(toolsDir, file), statSync(join(toolsDir, file)).mtimeMs)
      if (schema === null || !schema.agents.includes('tail')) continue
      registerCardTool(agentCtx, toolsDir, root, shell, file)
    }
  }
  agentCtx.tools.register(runtimeReadTool(root))
  agentCtx.tools.register(runtimeGrepTool(root))
  // 写对共用一条 path 串行链：同文件按序落盘，跨文件并行。
  const chain = pathChain()
  agentCtx.tools.register(runtimeWriteTool(root, chain))
  agentCtx.tools.register(runtimeEditTool(root, chain))
  agentCtx.tools.register(runtimeDeleteTool(root))
}

function runtimePath(root: string, rel: string): string {
  const path = fenceIn(join(root, RUNTIME_DIR), rel)
  const base = fenceIn(root, RUNTIME_DIR)
  // Path-walk containment (not a string prefix): separator-agnostic, so the
  // fence holds on every platform the harness ships on.
  if (path !== base && !path.startsWith(base + sep)) throw new Error(`tavern: runtime path "${rel}" escapes runtime/`)
  return path
}

function listRuntimeFiles(root: string): string[] {
  const dir = join(root, RUNTIME_DIR)
  if (!existsSync(dir)) return []
  const files: string[] = []
  const walk = (abs: string, rel: string): void => {
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      const childRel = rel === '' ? entry.name : `${rel}/${entry.name}`
      if (entry.isDirectory()) walk(join(abs, entry.name), childRel)
      else files.push(childRel)
    }
  }
  walk(dir, '')
  return files.sort()
}

/** Shared wire face of the single-`path` runtime tool: one relative path in, plain text out. */
const runtimePathFace = {
  parameters: { path: { type: 'string', required: true, description: 'File path relative to runtime/.' } },
  output: { schema: { type: 'string' }, render: (_args: unknown, value: unknown) => [{ type: 'text' as const, text: String(value) }] },
} as const

/**
 * Same-path mutation serializer over the write pair: one call per absolute
 * target path. A failed earlier write must not skip later ones (the recovery
 * swallow), and the map entry self-deletes once its tail settles so the chain
 * never grows across turns. The chain lives per registration — the tail face
 * re-composes every fork, so it resets with it; same-path calls from one
 * assistant step run in model order, different paths run concurrently.
 */
type PathChain = (abs: string, body: () => Promise<string>) => Promise<string>

export function pathChain(): PathChain {
  const tails = new Map<string, Promise<string>>()
  return (abs, body) => {
    const run = (tails.get(abs) ?? Promise.resolve()).catch(() => { }).then(body)
    tails.set(abs, run)
    const drop = (): void => { if (tails.get(abs) === run) tails.delete(abs) }
    void run.then(drop, drop)
    return run
  }
}

function runtimeReadTool(root: string) {
  return defineTool({
    name: 'runtimeRead',
    description: 'Read the world-state tree under runtime/ (NPC state, quests, panels): a file path returns the document with `cat -n` line numbers, a directory path lists files and directories up to 2 levels deep.',
    parameters: {
      path: { type: 'string', required: true, description: 'File or directory path relative to runtime/.' },
      view_range: {
        type: 'array', items: { type: 'integer' },
        description: 'File reads only: [start, end] of 1-based lines to show (end -1 = through the last line). Omit for the whole document.',
      },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    isConcurrencySafe: () => true,
    execute(args: unknown) {
      const { path, view_range: viewRange } = args as { path: string; view_range?: number[] }
      const abs = runtimePath(root, path)
      if (!existsSync(abs)) throw new Error(`tavern: the path "${path}" does not exist under runtime/.`)
      if (statSync(abs).isDirectory()) return Promise.resolve(listDirectory(root, path))
      return Promise.resolve(viewFile(abs, path, viewRange))
    },
  })
}

function runtimeGrepTool(root: string) {
  return defineTool({
    name: 'runtimeGrep',
    description: 'Search a pattern in the world-state documents under runtime/. Returns matching file:line rows.',
    parameters: {
      pattern: { type: 'string', required: true, description: 'Substring to find; case-sensitive.' },
      path: { type: 'string', description: 'Optional subdirectory or file under runtime/ to narrow the search.' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: value }] },
    isConcurrencySafe: () => true,
    execute(args: unknown) {
      const { pattern, path } = args as { pattern: string; path?: string }
      const files = listRuntimeFiles(root).filter(file => path === undefined || file === path || file.startsWith(`${path}/`))
      const rows: string[] = []
      for (const file of files) {
        if (rows.length >= GREP_LINES) break
        const lines = readFileSync(runtimePath(root, file), 'utf8').split('\n')
        for (let i = 0; i < lines.length && rows.length < GREP_LINES; i += 1) {
          const line = lines[i] ?? ''
          if (line.includes(pattern)) rows.push(`${file}:${i + 1}: ${line.slice(0, 240)}`)
        }
      }
      return Promise.resolve(rows.length === 0 ? 'no matches' : rows.join('\n'))
    },
  })
}

function runtimeWriteTool(root: string, chain: PathChain) {
  return defineTool({
    name: 'runtimeWrite',
    description: 'Create or fully replace one world-state document under runtime/ — the whole `content` becomes the file, parent directories are created. Existing files are overwritten: runtimeRead the current document first when updating.',
    parameters: {
      path: { type: 'string', required: true, description: 'File path relative to runtime/.' },
      content: { type: 'string', required: true, description: 'Complete UTF-8 text content to write.' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    isConcurrencySafe: () => true,
    execute(args: unknown) {
      const { path, content } = args as { path: string; content: string }
      const abs = runtimePath(root, path)
      const bytes = Buffer.byteLength(content, 'utf8')
      if (bytes > WRITE_CAP) throw new Error(`tavern: runtime write to "${path}" is ${bytes} bytes, over the ${WRITE_CAP}-byte cap`)
      return chain(abs, () => {
        const existed = existsSync(abs)
        mkdirSync(dirname(abs), { recursive: true })
        writeMutation(abs, path, content)
        return Promise.resolve(existed ? `The file "${path}" has been overwritten successfully.` : `New file created successfully at: ${path}`)
      })
    },
  })
}

function runtimeEditTool(root: string, chain: PathChain) {
  return defineTool({
    name: 'runtimeEdit',
    description: `
Edit one world-state document under runtime/ by replacing literal text.
* \`old_str\` should match EXACTLY one or more consecutive characters/lines of the file — mind the whitespace!
* By default \`old_str\` must appear exactly once; a multi-match edit is refused with the occurrences' line numbers — include more surrounding context, or set \`replace_all\` to true.
* \`new_str\` contains the replacement (empty string = delete the match); a multi-line \`new_str\` splices lines in.
* A \`path\` ending in .json is parse-checked after the mutation — an edit that would corrupt the document is refused (nothing is written).
`.trim(),
    parameters: {
      path: { type: 'string', required: true, description: 'File path relative to runtime/.' },
      old_str: { type: 'string', required: true, description: 'The exact existing text to replace.' },
      new_str: { type: 'string', required: true, description: 'The replacement (empty string deletes the match).' },
      replace_all: { type: 'boolean', description: 'Replace every occurrence. Defaults to false: old_str must appear exactly once.' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    isConcurrencySafe: () => true,
    execute(args: unknown) {
      const { path, old_str: oldStr, new_str: newStr, replace_all: replaceAll } = args as {
        path: string; old_str: string; new_str: string; replace_all?: boolean
      }
      if (oldStr === '') throw new Error('tavern: parameter `old_str` must be a non-empty string (set `new_str` to "" to delete a match)')
      const abs = runtimePath(root, path)
      if (!existsSync(abs)) throw new Error(`tavern: the path "${path}" does not exist under runtime/.`)
      if (statSync(abs).isDirectory()) throw new Error(`tavern: "${path}" is a directory and cannot be edited.`)
      return chain(abs, async () => {
        const before = readFileSync(abs, 'utf8')
        const offsets = matchOffsets(before, oldStr)
        if (offsets.length === 0) throw new Error(`tavern: No replacement was performed, old_str \`${oldStr}\` did not appear verbatim in "${path}".`)
        if (offsets.length > 1 && !replaceAll) {
          throw new Error(`tavern: No replacement was performed. Multiple occurrences of old_str \`${oldStr}\` in lines [${lineNumbersAt(before, offsets).join(', ')}]. Include more context or set \`replace_all\` to true.`)
        }
        const offset = offsets[0] as number
        const after = replaceAll ? before.replaceAll(oldStr, newStr) : before.slice(0, offset) + newStr + before.slice(offset + oldStr.length)
        writeMutation(abs, path, after)
        return `The file "${path}" has been edited successfully.`
      })
    },
  })
}

/**
 * The value-side cap of one `runtimeRead` result. The stock read clips long
 * documents so a huge file cannot eat the model's context; mirror the marker
 * shape so downstream prompt habits read the same.
 */
const VIEW_OUTPUT_CAP = 10_000
const VIEW_CLIP_MARKER = '<response clipped><NOTE>To save on context only part of this file has been shown to you. Retry `view` with a narrower `view_range`.</NOTE>'

/** Clip one read / listing output to the context-economy cap, mirroring the stock marker. */
function maybeTruncate(content: string): string {
  return content.length <= VIEW_OUTPUT_CAP ? content : content.slice(0, VIEW_OUTPUT_CAP) + VIEW_CLIP_MARKER
}

/** Every offset where `search` occurs in `content` (overlap-free, ascending). */
function matchOffsets(content: string, search: string): number[] {
  const offsets: number[] = []
  let offset = 0
  while (true) {
    const match = content.indexOf(search, offset)
    if (match === -1) return offsets
    offsets.push(match)
    offset = match + search.length
  }
}

/** 1-based line numbers for the given character offsets (stock parity: ambiguity errors cite lines). */
function lineNumbersAt(content: string, offsets: readonly number[]): number[] {
  let line = 1
  let cursor = 0
  return offsets.map((offset) => {
    while (cursor < offset) {
      if (content[cursor] === '\n') line += 1
      cursor += 1
    }
    return line
  })
}

/**
 * Write the mutation result after two guards: the runtime/ fence (already
 * applied through `runtimePath`) and, for .json documents, a whole-document
 * parse of the RESULTING text — the maintenance prompt's "写后引擎 parse
 * 校验" lives here, refusing mid-edit instead of corrupting on disk.
 */
function writeMutation(abs: string, rel: string, content: string): void {
  if (rel.toLowerCase().endsWith('.json')) {
    try {
      JSON.parse(content)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      throw new Error(`tavern: "${rel}" would not be valid JSON after this edit and was NOT written — nothing was modified (${reason}). Edit a smaller span or rewrite the whole document via runtimeWrite.`)
    }
  }
  writeFileSync(abs, content)
}

/** `cat -n`-style read: 6-space line numbers, optional 1-based inclusive range (end -1 = EOF). */
function viewFile(abs: string, rel: string, viewRange: readonly number[] | undefined): string {
  const size = statSync(abs).size
  if (size > READ_CAP) throw new Error(`tavern: runtime document "${rel}" is ${String(size)} bytes, over the ${String(READ_CAP)}-byte cap`)
  const allLines = readFileSync(abs, 'utf8').split('\n')
  let prompt = `Here's the result of running \`cat -n\` on the file at runtime/${rel}`
  let lines = allLines
  let first = 1
  if (viewRange !== undefined) {
    if (viewRange.length !== 2 || viewRange.some(value => !Number.isInteger(value))) throw new Error('tavern: Invalid `view_range`. It should be a list of two integers.')
    const [start, end] = viewRange as [number, number]
    if (start < 1 || start > allLines.length) throw new Error(`tavern: Invalid \`view_range\`: its first element \`${String(start)}\` should be within the range of lines of the file: [1, ${String(allLines.length)}].`)
    if (end !== -1 && end < start) throw new Error(`tavern: Invalid \`view_range\`: its second element \`${String(end)}\` should be larger than or equal to its first element \`${String(start)}\`.`)
    lines = end === -1 ? allLines.slice(start - 1) : allLines.slice(start - 1, end)
    first = start
    prompt += ` with view_range=[${String(start)}, ${String(end)}]`
  }
  const numbered = lines.map((line, index) => `${String(first + index).padStart(6, ' ')}  ${line}`).join('\n')
  return maybeTruncate(`${prompt}:\n${numbered}\n`)
}

/**
 * Two-level directory listing in the stock `f\t<path>`/`d\t<path>` taste,
 * hidden entries excluded, rows sorted by path (`readdirSync` alphabetical
 * is close enough — the stock sorts visible output by row path as well).
 */
function listDirectory(root: string, rel: string): string {
  const baseDir = join(root, RUNTIME_DIR, rel === '.' ? '' : rel)
  const displayRel = `runtime/${rel === '.' ? '' : rel}`
  const walk = (dir: string, prefix: string, depth: number): string[] => {
    const rows: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue
      const childRel = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      rows.push(`${entry.isDirectory() ? 'd' : 'f'}\truntime/${childRel}`)
      if (entry.isDirectory() && depth < 2) rows.push(...walk(join(dir, entry.name), childRel, depth + 1))
    }
    return rows
  }
  const rows = [`d\t${displayRel}`, ...walk(baseDir, rel === '.' ? '' : rel, 1)].sort(
    (left, right) => left.slice(left.indexOf('\t') + 1) < right.slice(right.indexOf('\t') + 1) ? -1 : 1,
  )
  return maybeTruncate(`Here're the files and directories up to 2 levels deep in ${displayRel}, excluding hidden items:\n${rows.join('\n')}\n`)
}

function runtimeDeleteTool(root: string) {
  return defineTool({
    name: 'runtimeDelete',
    description: 'Delete one world-state document under runtime/. Directories are not deletable through this tool.',
    ...runtimePathFace,
    async execute(args: unknown) {
      const { path } = args as { path: string }
      const abs = runtimePath(root, path)
      if (!statSync(abs).isFile()) throw new Error(`tavern: "${path}" is not a regular file`)
      const { rmSync } = await import('node:fs')
      rmSync(abs)
      return `deleted ${path}`
    },
  })
}
