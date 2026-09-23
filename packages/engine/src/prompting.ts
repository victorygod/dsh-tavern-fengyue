/* oxlint-disable @stylistic/max-len -- 卡片长文案与长模板串按行豁免，上限约束不适用于此文件的长中文字符串 */
/**
 * Card prompt assembly: the card's prompt sections read fresh from
 * `preset/prompt/` at every assembly — section providers return raw file text
 * (their signatures are synchronous by contract), and the scoped
 * `system-prompt/assemble` waterfall listener resolves `{{scriptName(args)}}`
 * placeholders in place, where async shell work is legal.
 *
 * The placeholder grammar is ONE thing: a script call. `{{name}}` without
 * parentheses is deprecated and stays a literal; `{{name(a, b)}}` evaluates
 * its literal and nested-call arguments first, then runs
 * `preset/scripts/name.mjs` with explicit positional argv, taking
 * stdout (trimmed) as the value. There are no variables and no builtins —
 * every dynamic input lives in reachable files (`runtime/`, the conversation
 * snapshot, `../preset/`), which each script reads itself with cwd = `runtime/`.
 *
 * The card's per-turn instruction text is ONE dynamically injected user
 * message: the engine renders it at submission (`renderPostMessage` — the
 * `postPrompt` body through one placeholder render) and the submission stash
 * hands it to the pre-step injector, which shadows the previous turn's live
 * post and rides the fresh value into the turn's admitted batch. The player's
 * durable message is always the bare text; see the engine's `gate` for the
 * injector.
 * @module dsh-tavern-fengyue-engine/prompting
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { PromptAssembly } from '@deepseek-ai/dsh-system-prompt'
import { cardScriptCommand, cardToolSchema, type ShellSeam } from './tools.ts'
import { PRESET_DIR, RUNTIME_DIR, promptPath, readCardMeta, readMaintenancePrompt } from './workspace.ts'

/** The card's own system-prompt section (`preset/prompt/systemPrompt`). */
export const CARD_SECTION_NAME = 'tavern:card-system'
/** The per-assembly `-h` self-description block of the card's tools. */
export const TOOL_BRIEF_SECTION_NAME = 'tavern:tool-brief'
/** The card-writing assistant's guidance section (the writer agent's own scope only). */
export const WRITER_GUIDE_SECTION_NAME = 'tavern:writer-guide'

/**
 * Remove the legacy wrap-era instruction sections from one message's text
 * blocks — the tagged blocks around the raw player text that wrap-era sessions
 * (`<pre-instructions>` / `<post-instructions>`) carried in their durable
 * messages. New submissions compose no tags, so the anchored edge pattern is a
 * no-op on current text; it stays as the display shim that keeps old session
 * logs readable. The transcript, the sidebar summary, the save rows, and the
 * conversation snapshot's `plain` field share it.
 * @param texts - the message's text blocks.
 * @returns the visible texts, in order and byte-identical where untagged.
 */
export function stripInstructions(texts: readonly string[]): string[] {
  return texts.map(text => text
    .replace(/^<pre-instructions>\n[\s\S]*?\n<\/pre-instructions>\n/, '')
    .replace(/\n<post-instructions>\n[\s\S]*?\n<\/post-instructions>$/, ''))
}

/** How one `{{…}}` resolution failed. The rendered text keeps the token verbatim (fail-visible). */
export type ScriptRenderFailure = {
  /** The called script's name (or the raw malformed token's head). */
  readonly name: string
  /**
   * `parse`/`depth` failed before any script ran; `args`/`limit` are
   * structural budgets (>16KB argument, >8 scripts per render); the rest are
   * the script run's own outcomes (`exitCode` present only for `exit`).
   */
  readonly reason: 'parse' | 'depth' | 'args' | 'limit' | 'missing' | 'exit' | 'timeout' | 'abort'
  /** Exit code, present only for `reason: 'exit'`. */
  readonly exitCode?: number
}

/** Rendered text plus the script failures encountered while producing it. */
export interface RenderedText {
  /** The rendered text; failed placeholders stay verbatim. */
  readonly text: string
  /** One entry per failed placeholder, in encounter order. */
  readonly failures: ScriptRenderFailure[]
}

/** Placeholder evaluation budgets: nesting depth, argv size, scripts per render, script timeout. */
export const MAX_PLACEHOLDER_DEPTH = 4
export const MAX_PLACEHOLDER_ARG = 16_000
export const MAX_PLACEHOLDER_SPAWNS = 8
const SCRIPT_TIMEOUT_MS = 60_000

/** Quote one argv value for bash: POSIX single-quote with the standard escape. */
export function quoteArg(value: string): string {
  return `'${value.replaceAll("'", '\'\\\'\'')}'`
}

/**
 * Run one card script through the shell seam with cwd = `runtime/` (the card's
 * writable world: bare paths in scripts touch runtime state; sibling areas
 * resolve as `../preset/…`). No tavern-layer output cap — the executor's own
 * configured cap stays the deployment bound. The caller's abort signal kills
 * the process.
 * @param shell - the deployment's shell executor.
 * @param command - the command line to run.
 * @param workdir - absolute working directory (the workspace's `runtime/`).
 * @param signal - caller's abort signal; fired means the run was cancelled.
 * @returns the collected stdout text, or the structured failure.
 */
async function runScript(
  shell: ShellSeam,
  command: string,
  workdir: string,
  signal: AbortSignal | undefined,
): Promise<{ ok: true; text: string } | { ok: false; reason: 'exit' | 'timeout' | 'abort'; exitCode?: number }> {
  const result = await shell.run(shell.resolve({
    command,
    workdir,
    timeoutMs: SCRIPT_TIMEOUT_MS,
    ...(signal === undefined ? {} : { signal }),
  }))
  if (result.aborted) return { ok: false, reason: 'abort' }
  if (result.timedOut) return { ok: false, reason: 'timeout' }
  if (result.exitCode !== 0) {
    return { ok: false, reason: 'exit', ...(result.exitCode === null ? {} : { exitCode: result.exitCode }) }
  }
  return { ok: true, text: result.stdout.text }
}

/** End index (exclusive, after the closing `}}`) of the `{{…}}` token opening at `start`, or null when unterminated. Quote spans are skipped so brace-y literals do not derange the scan. */
function matchTokenEnd(text: string, start: number): number | null {
  let depth = 0
  let quote: string | null = null
  for (let index = start; index < text.length; index++) {
    const char = text[index]
    if (quote !== null) {
      if (char === '\\') index++
      else if (char === quote) quote = null
      continue
    }
    if (char === '\'' || char === '"') {
      quote = char
      continue
    }
    if (char === '{') {
      if (text.startsWith('{{', index)) {
        depth++
        index++
      }
      continue
    }
    if (char === '}') {
      if (text.startsWith('}}', index)) {
        depth--
        index++
        if (depth === 0) return index + 1
      }
    }
  }
  return null
}

/** Skip inline whitespace; returns the advanced index. */
function skipWs(src: string, index: number): number {
  while (index < src.length && /\s/.test(src[index] ?? '')) index++
  return index
}

interface CallOk {
  readonly ok: true
  readonly value: string
}
interface CallFail {
  readonly ok: false
  readonly name: string
  readonly reason: 'parse' | 'depth' | 'args' | 'limit' | 'missing' | 'exit' | 'timeout' | 'abort'
  readonly exitCode?: number
  /** Set for the deprecated bare form: kept verbatim WITHOUT a user-facing failure row. */
  readonly silent?: boolean
}
type CallResult = CallOk | CallFail

/**
 * Evaluate one full `{{…}}` token. Budgets and the spawn counter ride the
 * per-render closure; quoted/bare/nested-call arguments evaluate depth-first
 * so outer scripts receive inner stdout as plain argv strings.
 */
async function evalToken(
  token: string,
  root: string,
  shell: ShellSeam,
  signal: AbortSignal | undefined,
  depth: number,
  budget: { spawns: number },
): Promise<CallResult> {
  const fail = (reason: CallFail['reason'], extra: Partial<CallFail> = {}): CallFail => {
    const name = /^[A-Za-z0-9_-]+/.exec(token.slice(2))?.[0] ?? ''
    return { ok: false, name, reason, ...extra }
  }
  if (depth > MAX_PLACEHOLDER_DEPTH) return fail('depth')
  let index = 2 // past '{{'
  const nameMatch = /^[A-Za-z0-9_-]+/.exec(token.slice(index))
  if (nameMatch === null) return fail('parse')
  const name = nameMatch[0]
  index = skipWs(token, index + name.length)
  if (token[index] !== '(') {
    // Deprecated bare form: the contract is one grammar, so it stays an
    // unparsed literal without a user-facing failure row.
    if (token.startsWith('}}', index)) return { ok: false, name, reason: 'parse', silent: true }
    return fail('parse')
  }
  index = skipWs(token, index + 1)
  const args: string[] = []
  for (;;) {
    index = skipWs(token, index)
    if (token.startsWith('}}', index)) return fail('parse')
    if (token[index] === ')') {
      index++
      break
    }
    if (args.length > 0) {
      if (token[index] !== ',') return fail('parse')
      index = skipWs(token, index + 1)
      if (token[index] === ')') return fail('parse')
    }
    if (token.startsWith('{{', index)) {
      const end = matchTokenEnd(token, index)
      if (end === null) return fail('parse')
      const nested = await evalToken(token.slice(index, end), root, shell, signal, depth + 1, budget)
      if (!nested.ok) return nested
      args.push(nested.value)
      index = end
    } else {
      const quote = token[index]
      if (quote === '\'' || quote === '"') {
        let value = ''
        let cursor = index + 1
        for (;;) {
          if (cursor >= token.length) return fail('parse')
          const char = token[cursor]
          if (char === '\\') {
            const next = token[cursor + 1]
            value += next === undefined ? '' : next
            cursor += 2
            continue
          }
          if (char === quote) {
            cursor++
            break
          }
          value += char ?? ''
          cursor++
        }
        args.push(value)
        index = cursor
      } else {
        let value = ''
        while (index < token.length) {
          const char = token[index] ?? ''
          if (char === ',' || char === '(' || char === ')' || char === '{' || char === '}' || char === '\'' || char === '"') break
          value += char
          index++
        }
        value = value.trim()
        if (value === '') return fail('parse')
        args.push(value)
      }
    }
    index = skipWs(token, index)
  }
  index = skipWs(token, index)
  if (!token.startsWith('}}', index)) return fail('parse')
  const oversized = args.find(arg => arg.length > MAX_PLACEHOLDER_ARG)
  if (oversized !== undefined) return fail('args')
  const script = join(root, PRESET_DIR, 'scripts', `${name}.mjs`)
  if (!existsSync(script)) return fail('missing')
  budget.spawns += 1
  if (budget.spawns > MAX_PLACEHOLDER_SPAWNS) return fail('limit')
  const executed = await runScript(
    shell,
    cardScriptCommand(script, JSON.stringify(args)),
    join(root, RUNTIME_DIR),
    signal,
  )
  if (!executed.ok) {
    return executed.reason === 'exit'
      ? { ok: false, name, reason: 'exit', ...(executed.exitCode === undefined ? {} : { exitCode: executed.exitCode }) }
      : { ok: false, name, reason: executed.reason }
  }
  return { ok: true, value: executed.text.trim() }
}

/**
 * Resolve every `{{scriptName(args)}}` placeholder of one prompt text. The
 * grammar admits only parenthesised calls; deprecated bare `{{name}}` tokens
 * and malformed ones stay verbatim — a visible artifact for the author — and
 * failures are reported through the returned list for caller-side surfacing.
 * Identical tokens inside one render resolve once (the card's world cannot
 * change mid-render, so the memo is pure).
 * @param text - the raw prompt text.
 * @param root - absolute workspace root (scripts run with cwd = `runtime/`).
 * @param shell - the deployment's shell executor.
 * @param signal - caller's abort signal; fired kills the running script.
 * @returns the rendered text and the structured failures.
 */
export async function renderPlaceholders(
  text: string,
  root: string,
  shell: ShellSeam,
  signal?: AbortSignal,
): Promise<RenderedText> {
  if (!text.includes('{{')) return { text, failures: [] }
  const failures: ScriptRenderFailure[] = []
  const memo = new Map<string, string>()
  const budget = { spawns: 0 }
  let out = ''
  let cursor = 0
  for (;;) {
    const start = text.indexOf('{{', cursor)
    if (start === -1) {
      out += text.slice(cursor)
      break
    }
    const end = matchTokenEnd(text, start)
    if (end === null) {
      out += text.slice(cursor)
      break
    }
    const token = text.slice(start, end)
    out += text.slice(cursor, start)
    const cached = memo.get(token)
    if (cached !== undefined) {
      out += cached
    } else {
      const result = await evalToken(token, root, shell, signal, 1, budget)
      if (result.ok) {
        memo.set(token, result.value)
        out += result.value
      } else {
        if (result.silent !== true) {
          failures.push({ name: result.name, reason: result.reason, ...(result.exitCode === undefined ? {} : { exitCode: result.exitCode }) })
        }
        out += token
      }
    }
    cursor = end
  }
  return { text: out, failures }
}

/**
 * Probe every schema-less tool script's `-h` output once per file generation
 * (mtime-keyed cache, so a steady state costs nothing at request time). A
 * script with a `@tavern-schema` block is a first-class tool entry — its
 * description travels in the tools array, so the `-h` text would duplicate it.
 * @param root - absolute workspace root.
 * @param shell - the deployment's shell executor.
 * @returns the self-description block, or the empty string when the card has no schema-less tools.
 */
export async function renderToolBrief(
  root: string,
  shell: ShellSeam,
): Promise<string> {
  void shell
  const toolsDir = join(root, PRESET_DIR, 'tools')
  if (!existsSync(toolsDir)) return ''
  const rows: string[] = []
  for (const name of readdirSync(toolsDir).filter(entry => entry.endsWith('.mjs')).sort()) {
    const path = join(toolsDir, name)
    if (cardToolSchema(path, statSync(path).mtimeMs) !== null) continue
    // v2：schema 即用途说明；无块脚本的用法说明走 preset/tools/README 约定。
    rows.push(`# ${name} — generic entry: script receives an \`argv\` array (see preset/tools/README).`)
  }
  return rows.join('\n\n')
}

/**
 * Run one `preset/scripts/` script for the frontend's `tavern.runScript`: the
 * prompt face's spawn contract (cwd = `runtime/`, timeout, abort) applied to
 * explicit argv. The name is a `preset/scripts/` base name — no separators,
 * so the card cannot reach outside its own script library; each argument
 * rides as one quoted argv under the 16KB cap.
 */
export async function runCardScript(
  root: string,
  name: string,
  args: readonly string[],
  shell: ShellSeam,
  signal: AbortSignal | undefined,
): Promise<{ ok: true; text: string } | { ok: false; reason: 'missing' | 'args' | 'exit' | 'timeout' | 'abort'; exitCode?: number }> {
  const base = name.endsWith('.mjs') ? name.slice(0, -4) : name
  if (!/^[A-Za-z0-9_-]+$/.test(base)) return { ok: false, reason: 'missing' }
  if (args.some(arg => arg.length > MAX_PLACEHOLDER_ARG)) return { ok: false, reason: 'args' }
  const script = join(root, PRESET_DIR, 'scripts', `${base}.mjs`)
  if (!existsSync(script) || !statSync(script).isFile()) return { ok: false, reason: 'missing' }
  const executed = await runScript(
    shell,
    cardScriptCommand(script, JSON.stringify(args)),
    join(root, RUNTIME_DIR),
    signal,
  )
  return executed.ok ? { ok: true, text: executed.text.trim() } : executed
}

/**
 * Read one card prompt file synchronously.
 * @param root - absolute workspace root.
 * @param file - prompt file basename.
 * @returns the file text, or the empty string when absent.
 */
export function readCardPrompt(root: string, file: 'systemPrompt' | 'postPrompt'): string {
  try {
    return readFileSync(promptPath(root, file), 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
  }
}

/**
 * Render the card's model-facing texts for one assembly: the system prompt
 * file through `{{script}}` resolution plus the tools' `-h` block. The
 * per-turn instruction message renders ONLY at submission
 * (`renderPostMessage`) — assembling it here would re-run its scripts per
 * request and discard the result.
 * @param root - absolute workspace root.
 * @param shell - the deployment's shell executor.
 * @param signal - the requesting turn's abort signal; fired kills the running script.
 * @returns the rendered values with the system prompt's script failures; empty strings contribute nothing.
 */
export async function renderCardTexts(
  root: string,
  shell: ShellSeam,
  signal?: AbortSignal,
): Promise<{ system: string; toolBrief: string; failures: ScriptRenderFailure[] }> {
  const [rendered, toolBrief] = await Promise.all([
    renderPlaceholders(readCardPrompt(root, 'systemPrompt'), root, shell, signal),
    renderToolBrief(root, shell),
  ])
  return { system: rendered.text, toolBrief, failures: rendered.failures }
}

function replaceSectionText(assembly: PromptAssembly, name: string, text: string): void {
  const section = assembly.sections.find(candidate => candidate.name === name)
  if (section !== undefined) section.text = text
}

/**
 * Register the card-writing assistant's guidance section on the writer
 * agent's own scoped context. The text re-reads the card's metadata at every
 * assembly, so the guide reflects the current card; the workspace-layout,
 * card-UI-system, and tool-convention facts are fixed engine policy. Product
 * sections stay untouched — the writer is a default dsh agent plus this one
 * section.
 * @param agentCtx - the writer agent's scoped context.
 * @param root - absolute workspace root.
 */
export function registerWriterGuide(agentCtx: Context, root: string): void {
  agentCtx.systemPrompt.section({ name: WRITER_GUIDE_SECTION_NAME, order: -50, text: () => writerGuide(root) })
}

/** Compose the writer guide: fixed workspace/UI facts plus the current card's identity. */
/* oxlint-disable @stylistic/max-len, typescript/no-unnecessary-type-conversion, typescript/no-unnecessary-condition -- 卡长文案行与字面表达按需豁免（范围内） */
/**
 * The writer-guide document: `prompts/writer-guide.md` inside this package,
 * loaded fresh at every assembly (a small file; reads keep the
 * "provider text is always current" contract) with the card's identity
 * substituted for the three placeholder slots. The template must never carry
 * literal `{{…}}` sequences — writer-guide output joins the harness's strict
 * prompt-interpolation layer, and unknown names there throw.
 */
const WRITER_GUIDE_TEMPLATE_PATH = 'prompts/writer-guide.md'

function loadWriterGuideTemplate(): string {
  // `lib/` and `src/` both sit one level under the package root, one depth
  // either way — negotiated by walking up until the file appears.
  let dir = dirname(fileURLToPath(import.meta.url))
  for (let step = 0; step < 4; step += 1) {
    const candidate = join(dir, WRITER_GUIDE_TEMPLATE_PATH)
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8')
    dir = join(dir, '..')
  }
  throw new Error(`tavern: writer guide template missing at ${WRITER_GUIDE_TEMPLATE_PATH}`)
}

function writerGuide(root: string): string {
  const meta = readCardMeta(root)
  const maintenance = readMaintenancePrompt(root) !== '' ? 'enabled (maintenancePrompt non-empty)' : 'off (maintenancePrompt empty)'
  return loadWriterGuideTemplate()
    .replaceAll('__CARD_TITLE__', meta?.title === undefined || meta.title === '' ? '(unset)' : meta.title)
    .replaceAll('__CARD_DESC__', meta?.desc === undefined || meta.desc === '' ? '(unset)' : meta.desc)
    .replaceAll('__TAIL_MODE__', maintenance)
}
export /* oxlint-enable @stylistic/max-len, typescript/no-unnecessary-type-conversion, typescript/no-unnecessary-condition */
function registerCardSections(agentCtx: Context, root: string): void {
  agentCtx.systemPrompt.section({ name: CARD_SECTION_NAME, order: -50, text: () => readCardPrompt(root, 'systemPrompt') })
  agentCtx.systemPrompt.section({ name: TOOL_BRIEF_SECTION_NAME, order: 10_050, text: () => '' })
}

/**
 * Register the scoped `system-prompt/assemble` listener that turns the raw
 * providers into rendered text — `{{script}}` resolution and the `-h` brief
 * run here, per assembly, where async shell work is legal.
 * @param agentCtx - the agent-scoped context of the session's agent.
 * @param opts.root - absolute workspace root.
 * @param opts.shell - the deployment's shell executor.
 */
export function registerAssembleRender(
  agentCtx: Context,
  opts: { root: string; shell: ShellSeam },
): void {
  agentCtx.on('system-prompt/assemble', async (assembly, context, next): Promise<PromptAssembly> => {
    const rendered = await renderCardTexts(opts.root, opts.shell, context.signal)
    for (const failure of rendered.failures) {
      agentCtx.logger.warn(new Error(`tavern: system prompt script "{{${failure.name}}}" failed (${failure.reason})`))
    }
    // The card owns the whole system prompt: keep ONLY the card's two
    // sections and drop every product section (identity, persona, checkout
    // source, Web-GUI surface, deliverable guidance, working directory…)
    // regardless of which plugin contributed it — new product sections then
    // cannot silently rejoin tavern prompts, and no name list needs chasing.
    assembly.sections = assembly.sections.filter(section => (
      section.name === CARD_SECTION_NAME || section.name === TOOL_BRIEF_SECTION_NAME
    ))
    replaceSectionText(assembly, CARD_SECTION_NAME, rendered.system)
    replaceSectionText(assembly, TOOL_BRIEF_SECTION_NAME, rendered.toolBrief)
    return await next()
  })
}

/**
 * Render the card's per-turn instruction message for one submission: the
 * `postPrompt` body through one `{{script}}` placeholder render. The value
 * rides the submission stash into the pre-step injector; it never enters the
 * player's durable message. The retired `prefixPrompt` file (2026-09-16) is
 * dead data — nothing reads it; card authors who still carry one merge its
 * content into `postPrompt` themselves.
 * @param root - absolute workspace root.
 * @param shell - the deployment's shell executor.
 * @param signal - the submission's abort signal; fired kills the running script.
 * @returns the rendered message text with the post file's script failures.
 */
export async function renderPostMessage(
  root: string,
  shell: ShellSeam,
  signal?: AbortSignal,
): Promise<RenderedText> {
  return renderPlaceholders(readCardPrompt(root, 'postPrompt'), root, shell, signal)
}
