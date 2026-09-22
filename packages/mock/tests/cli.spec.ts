import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  formatMockLlmEvent,
  MOCK_LLM_CLI_USAGE,
  parseMockLlmCliArgs,
} from '../src/cli.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function tempTextsFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'mock-llm-cli-'))
  tempDirs.push(dir)
  const file = join(dir, 'texts.txt')
  writeFileSync(file, contents, 'utf8')
  return file
}

describe('mock LLM server CLI parser', () => {
  it('returns help without requiring a sequence', () => {
    expect(parseMockLlmCliArgs(['--help'])).toEqual({ kind: 'help' })
    expect(MOCK_LLM_CLI_USAGE).toContain('--sequence')
  })

  it('parses every request and listener option', () => {
    expect(parseMockLlmCliArgs([
      '--sequence', 'connection_refused,partial_disconnect,success',
      '--host', 'localhost',
      '--port', '9010',
      '--api-key', 'mock-key',
      '--listen-delay-ms', '100',
      '--repeat-last',
      '--success-text', 'done',
      '--partial-text', 'half',
      '--reasoning-text', 'think',
      '--chunk-size', '2',
      '--chunk-delay-ms', '3',
      '--reasoning-gap-ms', '700',
      '--disconnect-delay-ms', '4',
      '--latency-ms', '1000-3000',
      '--retry-after-ms', '5000',
      '--request-id', 'request-1',
      '--tool-name', 'lookup',
      '--tool-arguments', '{"id":1}',
    ])).toEqual({
      kind: 'run',
      config: {
        startsUnavailable: true,
        listenDelayMs: 100,
        logFormat: 'pretty',
        showTools: false,
        server: {
          sequence: ['partial_disconnect', 'success'],
          host: 'localhost',
          port: 9010,
          apiKey: 'mock-key',
          repeatLast: true,
          successTexts: ['done'],
          partialText: 'half',
          reasoningText: 'think',
          chunkSize: 2,
          chunkDelayMs: 3,
          reasoningGapMs: 700,
          disconnectDelayMs: 4,
          latencyMinMs: 1000,
          latencyMaxMs: 3000,
          retryAfterMs: 5000,
          requestId: 'request-1',
          toolName: 'lookup',
          toolArguments: '{"id":1}',
        },
      },
    })
  })

  it('uses standalone defaults for an ordinary sequence', () => {
    expect(parseMockLlmCliArgs(['--sequence', 'success'])).toEqual({
      kind: 'run',
      config: {
        startsUnavailable: false,
        listenDelayMs: 0,
        logFormat: 'pretty',
        showTools: false,
        server: {
          sequence: ['success'],
          port: 8000,
          repeatLast: false,
        },
      },
    })
  })

  it('uses the default unavailable interval', () => {
    const result = parseMockLlmCliArgs(['--sequence', 'connection_refused,success', '--port', '8001'])
    expect(result).toMatchObject({
      kind: 'run',
      config: { startsUnavailable: true, listenDelayMs: 750 },
    })
  })

  it('parses a reproducible weighted random profile', () => {
    expect(parseMockLlmCliArgs([
      '--sequence', 'random',
      '--repeat-last',
      '--seed', '42',
      '--random-weights', 'success=8,partial_disconnect=2',
    ])).toEqual({
      kind: 'run',
      config: {
        startsUnavailable: false,
        listenDelayMs: 0,
        logFormat: 'pretty',
        showTools: false,
        server: {
          sequence: ['random'],
          port: 8000,
          repeatLast: true,
          randomSeed: 42,
          randomWeights: { success: 8, partial_disconnect: 2 },
        },
      },
    })
  })

  it('accumulates repeatable success texts and merges file lines in order', () => {
    const file = tempTextsFile('from file\n\n  spaced line  \n')
    expect(parseMockLlmCliArgs([
      '--sequence', 'success',
      '--success-text', 'first',
      '--success-text', 'second',
      '--success-text-file', file,
    ])).toEqual({
      kind: 'run',
      config: {
        startsUnavailable: false,
        listenDelayMs: 0,
        logFormat: 'pretty',
        showTools: false,
        server: {
          sequence: ['success'],
          port: 8000,
          repeatLast: false,
          successTexts: ['first', 'second', 'from file', 'spaced line'],
        },
      },
    })
  })

  it('omits the pool when no success-text source is given', () => {
    expect(parseMockLlmCliArgs(['--sequence', 'success'])).toEqual({
      kind: 'run',
      config: {
        startsUnavailable: false,
        listenDelayMs: 0,
        logFormat: 'pretty',
        showTools: false,
        server: { sequence: ['success'], port: 8000, repeatLast: false },
      },
    })
  })

  it('reports the file path when it cannot be read', () => {
    const missing = join(tmpdir(), `mock-llm-cli-missing-${process.pid}.txt`)
    expect(() => parseMockLlmCliArgs(['--sequence', 'success', '--success-text-file', missing]))
      .toThrow(/readable UTF-8 text file/)
  })

  it.each([
    [['--sequence', 'success', '--success-text', ''], /--success-text must not be empty/],
    [['--sequence', 'success', '--success-text-file', ''], /readable UTF-8 text file/],
  ])('rejects invalid success-text sources %#', (argv, expected) => {
    expect(() => parseMockLlmCliArgs(argv)).toThrow(expected)
  })

  it('rejects a success-text file that only contains blank lines', () => {
    const file = tempTextsFile('\n   \n\t\n')
    expect(() => parseMockLlmCliArgs(['--sequence', 'success', '--success-text-file', file]))
      .toThrow(/produced no response texts/)
  })

  it('pins the latency range when a single value is given', () => {
    expect(parseMockLlmCliArgs(['--sequence', 'success', '--latency-ms', '500'])).toMatchObject({
      kind: 'run',
      config: { server: { latencyMinMs: 500, latencyMaxMs: 500 } },
    })
  })

  it.each([
    [[], /--sequence is required/],
    // Tokenizer-level failures carry node:util parseArgs's own messages.
    [['--wat'], /Unknown option '--wat'/],
    [['--wat', 'x'], /Unknown option '--wat'/],
    [['--port'], /Option '--port <value>' argument missing/],
    [['--sequence', 'success', 'stray'], /Unexpected argument 'stray'/],
    [['--port', 'NaN', '--sequence', 'success'], /finite number/],
    [['--sequence', 'success', '--log-format', 'csv'], /--log-format must be pretty or jsonl/],
    [['--sequence', 'success,connection_refused'], /only as the first/],
    [['--sequence', 'connection_refused'], /must be followed/],
    [['--sequence', 'unknown'], /unknown behavior/],
    [['--sequence', 'connection_refused,success', '--port', '0'], /nonzero/],
    [['--sequence', 'success', '--listen-delay-ms', '5'], /requires connection_refused/],
    // `=` syntax: a space-separated leading-dash value is a tokenizer error, not a bounds probe.
    [['--sequence', 'connection_refused,success', '--listen-delay-ms=-1'], /integer between 0 and 2147483647/],
    [['--sequence', 'connection_refused,success', '--listen-delay-ms', '1.5'], /integer between 0 and 2147483647/],
    [['--sequence', 'connection_refused,success', '--listen-delay-ms', '2147483648'], /integer between 0 and 2147483647/],
    [['--sequence', 'success', '--latency-ms', '3000-1000'], /upper bound must not be below/],
    [['--sequence', 'success', '--latency-ms', 'abc'], /finite number/],
    [['--sequence', 'success', '--seed', '1'], /require random/],
    [['--sequence', 'random', '--random-weights', 'success'], /expects behavior=weight/],
    [['--sequence', 'random', '--random-weights', 'random=1'], /concrete behavior/],
    [['--sequence', 'random', '--random-weights', 'success=1,success=2'], /duplicate/],
    [['--sequence', 'random', '--random-weights', 'success=nope'], /finite number/],
  ])('rejects invalid argv %#', (argv, expected) => {
    expect(() => parseMockLlmCliArgs(argv)).toThrow(expected)
  })
})

describe('pretty terminal rendering', () => {
  it('accepts --log-format jsonl alongside the pretty default', () => {
    const parsed = parseMockLlmCliArgs(['--sequence', 'success', '--log-format', 'jsonl'])
    expect(parsed.kind).toBe('run')
    if (parsed.kind !== 'run') return
    expect(parsed.config.logFormat).toBe('jsonl')
    expect(MOCK_LLM_CLI_USAGE).toContain('--log-format')
  })

  it('accepts --show-tools and defaults it off', () => {
    const defaults = parseMockLlmCliArgs(['--sequence', 'success'])
    if (defaults.kind !== 'run') return
    expect(defaults.config.showTools).toBe(false)
    const enabled = parseMockLlmCliArgs(['--sequence', 'success', '--show-tools'])
    if (enabled.kind !== 'run') return
    expect(enabled.config.showTools).toBe(true)
    expect(MOCK_LLM_CLI_USAGE).toContain('--show-tools')
  })

  it('summarizes one request and prints the model-visible context in full', () => {
    const rendered = formatMockLlmEvent({
      type: 'request', attempt: 2, scriptBehavior: 'random', behavior: 'success',
      path: '/v1/chat/completions',
      body: {
        model: 'deepseek-chat', stream: true,
        messages: [
          { role: 'system', content: [{ type: 'text', text: '世界规则' }] },
          { role: 'user', content: [{ type: 'text', text: '推门' }] },
          { role: 'assistant', content: [{ type: 'text', text: '酒保抬眼' }] },
          { role: 'user', content: [{ type: 'text', text: '再来' }, { type: 'tool-call', id: 'c1', name: 'roll', arguments: '{}' }] },
        ],
        tools: [{ name: 'executeTools' }, { type: 'function', function: { name: 'runtimeRead' } }],
      },
    })
    expect(rendered).toContain('── request #2 · success · model deepseek-chat · stream true · messages 4 · tools 2')
    // Fenced on both ends of every request block.
    expect(rendered.startsWith('=========================')).toBe(true)
    expect(rendered.endsWith('=========================')).toBe(true)
    expect(rendered).toContain('[system]\n    世界规则')
    expect(rendered).toContain('[user]\n    推门')
    expect(rendered).toContain('[tool-call c1] roll {}')
    expect(rendered).toContain('tools: executeTools, runtimeRead')
  })

  it('collapses message lists beyond forty entries', () => {
    const messages = Array.from({ length: 43 }, (_value, index) => ({ role: 'user', content: `m${index}` }))
    const rendered = formatMockLlmEvent({
      type: 'request', attempt: 1, scriptBehavior: 'random', behavior: 'success',
      path: '/v1/chat/completions', body: { model: 'x', messages },
    })
    expect(rendered).toContain('messages 43')
    expect(rendered).toContain('… 3 more messages')
  })

  it('renders one result as a single line', () => {
    const rendered = formatMockLlmEvent({
      type: 'result', attempt: 2, scriptBehavior: 'random', behavior: 'success', outcome: 'completed', chunksSent: 7,
    })
    expect(rendered).toBe('── result #2 · success · completed · chunks 7')
  })

  it('renders an empty-body request without throwing', () => {
    const rendered = formatMockLlmEvent({
      type: 'request', attempt: 1, scriptBehavior: 'random', behavior: 'success', path: '/v1/chat/completions', body: undefined,
    })
    expect(rendered).toContain('── request #1')
    expect(rendered).toContain('messages 0 · tools 0')
  })

  it('prints the full tools schema only when --show-tools asks for it', () => {
    const showToolsEvent = (): Parameters<typeof formatMockLlmEvent>[0] => ({
      type: 'request', attempt: 1, scriptBehavior: 'random', behavior: 'success', path: '/v1/chat/completions',
      body: { model: 'deepseek-chat', messages: [], tools: [
        { name: 'roll', description: '掷骰', parameters: { type: 'object', properties: { sides: { type: 'integer', description: '面数' } } } },
      ] },
    })
    const plain = formatMockLlmEvent(showToolsEvent())
    expect(plain).toContain('tools: roll')
    expect(plain).not.toContain('"sides"')
    expect(plain).not.toContain('tool roll:')
    const rendered = formatMockLlmEvent(showToolsEvent(), { showTools: true })
    expect(rendered).toContain('tool roll:')
    expect(rendered).toContain('"sides"')
    expect(rendered).toContain('"type": "object"')
    expect(rendered).toContain('"description": "掷骰"')
  })
})
