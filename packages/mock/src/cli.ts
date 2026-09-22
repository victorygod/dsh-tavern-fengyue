/**
 * Dependency-free CLI parsing for the standalone mock LLM server.
 * @module dsh-tavern-fengyue-mock/cli
 */

import { readFileSync } from 'node:fs'
import { parseArgs } from 'node:util'
import { MAX_MOCK_LLM_TIMER_DELAY_MS, MOCK_LLM_BEHAVIORS } from './index.ts'
import type {
  ConcreteMockLlmBehavior,
  MockLlmBehavior,
  MockLlmRandomWeights,
  MockLlmServerEvent,
  MockLlmServerOptions,
} from './index.ts'

/** Listener lifecycle behavior understood only by the standalone CLI. */
export const CONNECTION_REFUSED_BEHAVIOR = 'connection_refused'

/** Terminal log rendering of server events. `jsonl` keeps one compact JSON object per line. */
export type MockLlmLogFormat = 'pretty' | 'jsonl'

/** Parsed CLI configuration, including a pre-listen unavailable interval. */
export interface MockLlmCliConfig {
  /** Server options after removing the lifecycle-only `connection_refused` entry. */
  readonly server: MockLlmServerOptions
  /** Delay before binding the model port; an integer from zero through the Node timer maximum. */
  readonly listenDelayMs: number
  /** Whether the original sequence requested a true pre-listen refusal phase. */
  readonly startsUnavailable: boolean
  /** Standalone-process log rendering; `jsonl` is the machine shape `--help` documents. */
  readonly logFormat: MockLlmLogFormat
  /** Whether pretty request rendering also prints every tool's full schema. */
  readonly showTools: boolean
}

/** Result of parsing `dsh-llm-mock-server` arguments. */
export type MockLlmCliParseResult =
  | { readonly kind: 'help' }
  | { readonly kind: 'run'; readonly config: MockLlmCliConfig }

const BEHAVIORS = new Set<string>(MOCK_LLM_BEHAVIORS)
const DEFAULT_LISTEN_DELAY_MS = 750
const BOM = String.fromCharCode(0xfeff)

/** Command usage written for `--help` and invalid arguments. */
export const MOCK_LLM_CLI_USAGE = `Usage: dsh-llm-mock-server [options]

Required:
  --sequence <a,b,...>       Ordered behaviors; connection_refused is allowed first

Listener:
  --host <host>              Default 127.0.0.1
  --port <port>              Default 8000; required and nonzero for connection_refused
  --api-key <token>          Validate exact Bearer token when present
  --listen-delay-ms <ms>     Unavailable interval (default 750 with connection_refused)
  --repeat-last              Repeat the final request behavior after exhaustion
  --seed <uint32>            Reproduce random selections
  --random-weights <a=n,...> Relative weights for concrete behaviors

Response:
  --success-text <text>      Repeatable; each occurrence joins the random response pool
  --success-text-file <path> One response text per line; blank lines are skipped
  --partial-text <text>
  --reasoning-text <text>
  --chunk-size <count>
  --chunk-delay-ms <ms>
  --reasoning-gap-ms <ms>    Delay between the last reasoning delta and the first content delta
  --disconnect-delay-ms <ms>
  --latency-ms <min>-<max>   Per-request pre-response delay range; a single value pins it
  --retry-after-ms <ms>
  --request-id <id>
  --tool-name <name>
  --tool-arguments <json>

Other:
  --log-format <pretty|jsonl>  Terminal event rendering; default pretty
  --show-tools               Pretty requests also print each tool's full schema
  --help
`

function numberValue(option: string, value: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) throw new Error(`dsh-llm-mock-server: ${option} must be a finite number`)
  return parsed
}

function boundedIntegerValue(option: string, value: string, min: number, max: number): number {
  const parsed = numberValue(option, value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`dsh-llm-mock-server: ${option} must be an integer between ${min} and ${max}`)
  }
  return parsed
}

function parseSequence(raw: string): { startsUnavailable: boolean; sequence: MockLlmBehavior[] } {
  const entries = raw.split(',').map(entry => entry.trim())
  if (entries.some(entry => entry.length === 0)) {
    throw new Error('dsh-llm-mock-server: --sequence must contain non-empty comma-separated behaviors')
  }
  const startsUnavailable = entries[0] === CONNECTION_REFUSED_BEHAVIOR
  if (entries.slice(1).includes(CONNECTION_REFUSED_BEHAVIOR)) {
    throw new Error('dsh-llm-mock-server: connection_refused is allowed only as the first behavior')
  }
  const requestEntries = startsUnavailable ? entries.slice(1) : entries
  if (requestEntries.length === 0) {
    throw new Error('dsh-llm-mock-server: connection_refused must be followed by a request behavior')
  }
  for (const entry of requestEntries) {
    if (!BEHAVIORS.has(entry)) throw new Error(`dsh-llm-mock-server: unknown behavior ${JSON.stringify(entry)}`)
  }
  return { startsUnavailable, sequence: requestEntries as MockLlmBehavior[] }
}

function parseLatencyMs(raw: string): { min: number; max: number } {
  const separator = raw.indexOf('-')
  const min = boundedIntegerValue('--latency-ms', separator === -1 ? raw : raw.slice(0, separator), 0, MAX_MOCK_LLM_TIMER_DELAY_MS)
  const max = boundedIntegerValue('--latency-ms', separator === -1 ? raw : raw.slice(separator + 1), 0, MAX_MOCK_LLM_TIMER_DELAY_MS)
  if (max < min) {
    throw new Error('dsh-llm-mock-server: --latency-ms upper bound must not be below the lower bound')
  }
  return { min, max }
}

function readSuccessTextFile(path: string | undefined): string[] {
  if (path === undefined) return []
  let contents: string
  try {
    contents = readFileSync(path, 'utf8')
  } catch (error: unknown) {
    throw new Error(
      `dsh-llm-mock-server: --success-text-file must be a readable UTF-8 text file: ${error instanceof Error ? error.message : String(error)}`,
    )
  }
  const texts = contents
    // String (not regex) replacement: strip a single leading UTF-8 BOM if the editor wrote one.
    .replace(BOM, '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
  if (texts.length === 0) {
    throw new Error('dsh-llm-mock-server: --success-text-file produced no response texts')
  }
  return texts
}

function parseRandomWeights(raw: string): MockLlmRandomWeights {
  const weights: MockLlmRandomWeights = {}
  for (const entry of raw.split(',')) {
    const [behavior, rawWeight, ...extra] = entry.split('=')
    if (behavior === undefined || behavior === '' || rawWeight === undefined || rawWeight === '' || extra.length > 0) {
      throw new Error('dsh-llm-mock-server: --random-weights expects behavior=weight comma-separated entries')
    }
    if (!BEHAVIORS.has(behavior) || behavior === 'random') {
      throw new Error(`dsh-llm-mock-server: random weight requires a concrete behavior, got ${JSON.stringify(behavior)}`)
    }
    if (Object.hasOwn(weights, behavior)) {
      throw new Error(`dsh-llm-mock-server: duplicate random weight for ${JSON.stringify(behavior)}`)
    }
    weights[behavior as ConcreteMockLlmBehavior] = numberValue('--random-weights', rawWeight)
  }
  return weights
}

/** parseArgs vocabulary: every documented flag; only `--repeat-last` and `--help` are boolean. */
const CLI_OPTIONS = {
  'sequence': { type: 'string' },
  'host': { type: 'string' },
  'port': { type: 'string' },
  'api-key': { type: 'string' },
  'listen-delay-ms': { type: 'string' },
  'repeat-last': { type: 'boolean' },
  'seed': { type: 'string' },
  'random-weights': { type: 'string' },
  'success-text': { type: 'string', multiple: true },
  'success-text-file': { type: 'string' },
  'partial-text': { type: 'string' },
  'reasoning-text': { type: 'string' },
  'chunk-size': { type: 'string' },
  'chunk-delay-ms': { type: 'string' },
  'reasoning-gap-ms': { type: 'string' },
  'disconnect-delay-ms': { type: 'string' },
  'latency-ms': { type: 'string' },
  'retry-after-ms': { type: 'string' },
  'request-id': { type: 'string' },
  'tool-name': { type: 'string' },
  'tool-arguments': { type: 'string' },
  'log-format': { type: 'string' },
  'show-tools': { type: 'boolean' },
} as const

/**
 * Parse standalone server arguments without starting a process or listener.
 * Tokenizing rides `node:util` `parseArgs` (strict, no positionals); numeric
 * coercion, bounds, and cross-option constraints remain manual below it.
 * @param argv - arguments after the executable name.
 * @returns help or validated run configuration.
 */
export function parseMockLlmCliArgs(argv: readonly string[]): MockLlmCliParseResult {
  if (argv.includes('--help')) return { kind: 'help' }

  const { values } = parseArgs({ args: [...argv], options: CLI_OPTIONS, strict: true, allowPositionals: false })

  const host = values.host
  const port = values.port === undefined ? 8_000 : numberValue('--port', values.port)
  const apiKey = values['api-key']
  const listenDelayMs = values['listen-delay-ms'] === undefined
    ? undefined
    : boundedIntegerValue('--listen-delay-ms', values['listen-delay-ms'], 0, MAX_MOCK_LLM_TIMER_DELAY_MS)
  const repeatLast = values['repeat-last'] ?? false
  const randomSeed = values.seed === undefined ? undefined : numberValue('--seed', values.seed)
  const randomWeights = values['random-weights'] === undefined ? undefined : parseRandomWeights(values['random-weights'])
  // --success-text is repeatable and --success-text-file adds one text per
  // non-blank line; both feed the server's successTexts pool in order.
  const successTextFlags = values['success-text'] ?? []
  if (successTextFlags.includes('')) {
    throw new Error('dsh-llm-mock-server: --success-text must not be empty')
  }
  const successTexts = [...successTextFlags, ...readSuccessTextFile(values['success-text-file'])]
  const partialText = values['partial-text']
  const reasoningText = values['reasoning-text']
  const chunkSize = values['chunk-size'] === undefined ? undefined : numberValue('--chunk-size', values['chunk-size'])
  const chunkDelayMs = values['chunk-delay-ms'] === undefined ? undefined : numberValue('--chunk-delay-ms', values['chunk-delay-ms'])
  const reasoningGapMs = values['reasoning-gap-ms'] === undefined ? undefined : numberValue('--reasoning-gap-ms', values['reasoning-gap-ms'])
  const disconnectDelayMs = values['disconnect-delay-ms'] === undefined
    ? undefined
    : numberValue('--disconnect-delay-ms', values['disconnect-delay-ms'])
  const latency = values['latency-ms'] === undefined ? undefined : parseLatencyMs(values['latency-ms'])
  const retryAfterMs = values['retry-after-ms'] === undefined ? undefined : numberValue('--retry-after-ms', values['retry-after-ms'])
  const requestId = values['request-id']
  const toolName = values['tool-name']
  const toolArguments = values['tool-arguments']
  const logFormatRaw = values['log-format'] ?? 'pretty'
  if (logFormatRaw !== 'pretty' && logFormatRaw !== 'jsonl') {
    throw new Error(`dsh-llm-mock-server: --log-format must be pretty or jsonl, got ${JSON.stringify(logFormatRaw)}`)
  }
  const logFormat: MockLlmLogFormat = logFormatRaw
  const showTools = values['show-tools'] ?? false

  if (values.sequence === undefined) throw new Error('dsh-llm-mock-server: --sequence is required')
  const sequenceRaw = values.sequence
  const parsedSequence = parseSequence(sequenceRaw)
  if (parsedSequence.startsUnavailable && port === 0) {
    throw new Error('dsh-llm-mock-server: connection_refused requires an explicit nonzero --port')
  }
  if (!parsedSequence.startsUnavailable && listenDelayMs !== undefined) {
    throw new Error('dsh-llm-mock-server: --listen-delay-ms requires connection_refused first in --sequence')
  }
  if (!parsedSequence.sequence.includes('random') && (randomSeed !== undefined || randomWeights !== undefined)) {
    throw new Error('dsh-llm-mock-server: --seed and --random-weights require random in --sequence')
  }

  return {
    kind: 'run',
    config: {
      server: {
        sequence: parsedSequence.sequence,
        port,
        repeatLast,
        ...randomSeed === undefined ? {} : { randomSeed },
        ...randomWeights === undefined ? {} : { randomWeights },
        ...host === undefined ? {} : { host },
        ...apiKey === undefined ? {} : { apiKey },
        ...successTexts.length === 0 ? {} : { successTexts },
        ...partialText === undefined ? {} : { partialText },
        ...reasoningText === undefined ? {} : { reasoningText },
        ...chunkSize === undefined ? {} : { chunkSize },
        ...chunkDelayMs === undefined ? {} : { chunkDelayMs },
        ...reasoningGapMs === undefined ? {} : { reasoningGapMs },
        ...disconnectDelayMs === undefined ? {} : { disconnectDelayMs },
        ...latency === undefined ? {} : { latencyMinMs: latency.min, latencyMaxMs: latency.max },
        ...retryAfterMs === undefined ? {} : { retryAfterMs },
        ...requestId === undefined ? {} : { requestId },
        ...toolName === undefined ? {} : { toolName },
        ...toolArguments === undefined ? {} : { toolArguments },
      },
      listenDelayMs: parsedSequence.startsUnavailable ? listenDelayMs ?? DEFAULT_LISTEN_DELAY_MS : 0,
      startsUnavailable: parsedSequence.startsUnavailable,
      logFormat,
      showTools,
    },
  }
}

/** One chat-completions message as the wire sends it (loose: parsed JSON). */
interface WireMessage { role?: unknown; content: unknown }

const PRETTY_EVENT_LIMIT = 40
/** Visual fence rendered at both ends of every pretty request block. */
const PRETTY_SEPARATOR = '========================='

/** Render one scalar request field; non-scalar values summarize as `?`. */
function scalar(value: unknown): string {
  const kind = typeof value
  return kind === 'string' || kind === 'number' || kind === 'boolean' || kind === 'bigint'
    ? String(value)
    : '?'
}

function indentBlock(text: string): string {
  return text.split('\n').map(line => `    ${line}`).join('\n')
}

function messageText(message: WireMessage): string {
  const content = message.content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((block) => {
      if (typeof block !== 'object' || block === null) return ''
      const record = block as Record<string, unknown>
      if (typeof record.text === 'string') return record.text
      if (typeof record.id === 'string') {
        return `[tool-call ${record.id}] ${scalar(record.name)} ${scalar(record.arguments)}`
      }
      return `[${scalar(record.type) === '?' ? 'block' : scalar(record.type)}]`
    })
    .join('\n')
}

/**
 * Render one server event for the terminal. `request` lines summarize the
 * wire statistics on one line and then print the model-visible context in
 * full — the system prompt, every message's role and text, and the tool name
 * list — because the point of the log is reading what the model actually
 * received; sampling parameters stay collapsed into the summary line. With
 * `format.showTools` the full wire schema of every listed tool follows the
 * name list. `result` lines render as one outcome line. The returned string
 * carries no trailing newline.
 * @param event - the server event.
 * @param format - standalone-process rendering switches.
 * @returns the pretty terminal rendering.
 */
export function formatMockLlmEvent(event: MockLlmServerEvent, format?: { showTools?: boolean }): string {
  if (event.type === 'result') {
    // The assistant's own output prints here as the reply half of the
    // exchange: thinking wrapped in <thinking>, then the streamed text.
    const lines: string[] = [`── result #${event.attempt} · ${event.behavior} · ${event.outcome} · chunks ${event.chunksSent}`]
    if (event.reasoning !== undefined && event.reasoning !== '') {
      lines.push('  [assistant]')
      lines.push(indentBlock(`<thinking>\n${event.reasoning}\n</thinking>`))
    }
    if (event.assistantText !== undefined && event.assistantText !== '') {
      if (event.reasoning === undefined || event.reasoning === '') lines.push('  [assistant]')
      lines.push(indentBlock(event.assistantText))
    }
    return lines.join('\n')
  }
  const body = (event.body ?? {}) as Record<string, unknown>
  const messages = Array.isArray(body.messages) ? body.messages as WireMessage[] : []
  const tools = Array.isArray(body.tools) ? body.tools as { name?: unknown }[] : []
  const lines: string[] = [
    `── request #${event.attempt} · ${event.behavior} · model ${scalar(body.model)}`
    + ` · stream ${scalar(body.stream)} · messages ${messages.length} · tools ${tools.length}`,
  ]
  for (let index = 0; index < Math.min(messages.length, PRETTY_EVENT_LIMIT); index += 1) {
    const message = messages[index] as WireMessage
    const text = messageText(message)
    lines.push(`  [${scalar(message.role)}]`)
    lines.push(indentBlock(text === '' ? '(no text)' : text))
  }
  // A tool name rides `tool.name` (flat schema) or `tool.function.name`
  // (the OpenAI wire's nested form) — read both.
  const toolName = (tool: Record<string, unknown>): string => {
    const nested = tool.function
    const name = typeof nested === 'object' && nested !== null
      ? (nested as Record<string, unknown>).name
      : tool.name
    return scalar(name)
  }
  if (messages.length > PRETTY_EVENT_LIMIT) lines.push(`  … ${messages.length - PRETTY_EVENT_LIMIT} more messages`)
  if (tools.length > 0) lines.push(`  tools: ${tools.map(tool => toolName(tool as unknown as Record<string, unknown>)).join(', ')}`)
  if (format?.showTools === true && tools.length > 0) {
    for (const tool of tools) {
      const record = tool as unknown as Record<string, unknown>
      lines.push(`  tool ${toolName(record)}:`)
      lines.push(indentBlock(JSON.stringify(record, null, 2)))
    }
  }
  // A visible fence on both ends of every request block keeps consecutive
  // requests (and their trailing result lines) visually separable.
  return [PRETTY_SEPARATOR, ...lines, PRETTY_SEPARATOR].join('\n')
}
