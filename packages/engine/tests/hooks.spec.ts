import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { cardHooksPath, hookEntries, readCardHooks, runHookPhase } from '../src/hooks.ts'
import type { ShellSeam } from '../src/tools.ts'
import { writeCardSkeleton } from '../src/workspace.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function freshRoot(hooksJson: string | undefined, scripts: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), 'tavern-hooks-'))
  tempDirs.push(root)
  writeCardSkeleton(root)
  for (const name of scripts) {
    writeFileSync(join(root, 'preset', 'scripts', name), `// marker:${name}\nconsole.log('ran')\nprocess.exit(0)\n`)
  }
  if (hooksJson !== undefined) writeFileSync(cardHooksPath(root), hooksJson)
  return root
}

/**
 * Scripted shell: decodes the v2 runner command's base64 script payload back
 * to its marker, so tests key on the script name without a real spawn — the
 * suite stays platform-neutral. Outcome by marker: `flaky.mjs` exits non-zero,
 * everything else succeeds; `onFired` observes each firing mid-phase.
 */
function fakeShell(onFired?: (name: string) => void): ShellSeam & { readonly fired: string[] } {
  const fired: string[] = []
  return {
    fired,
    resolve: (request) => request as never,
    run: async (spec) => {
      const command = (spec as unknown as { command: string }).command
      const payload = /' -- (\S+) \S+$/.exec(command)?.[1] ?? ''
      const source = Buffer.from(payload, 'base64').toString('utf8')
      const name = /^\/\/ marker:(\S+)/m.exec(source)?.[1] ?? '?'
      fired.push(name)
      onFired?.(name)
      if (name === 'flaky.mjs') return { exitCode: 7, timedOut: false, aborted: false, stdout: { text: '' } } as never
      return { exitCode: 0, timedOut: false, aborted: false, stdout: { text: 'ran' } } as never
    },
  }
}

interface PhaseOptions {
  readonly event?: 'main.after' | 'tail.after'
  readonly shell?: ShellSeam
  readonly signal?: AbortSignal
  readonly warns: string[]
}

/** One phase through the runner, with the fake write-queue-flush assertion folded in. */
async function phase(root: string, options: PhaseOptions): Promise<void> {
  let flushed = false
  await runHookPhase({
    root,
    event: options.event ?? 'main.after',
    shell: options.shell ?? fakeShell(),
    signal: options.signal ?? new AbortController().signal,
    quiesce: async () => { flushed = true },
    warn: (message) => { options.warns.push(message) },
  })
  // 执行模型定案:quiesce 先于第一发——快照/尾文件必然先于钩子落盘。
  expect(flushed).toBe(true)
}

describe('hook registry preset/hooks.json', () => {
  it('reads the two faces with list order preserved', () => {
    const root = freshRoot(JSON.stringify({ hooks: {
      'tail.after': ['b.mjs', 'a.mjs'],
      'main.after': ['first.mjs', 'second.mjs', 'third.mjs'],
    } }), [])
    const read = readCardHooks(root)
    expect(read.error).toBeUndefined()
    expect(hookEntries(read.hooks, 'main.after')).toEqual(['first.mjs', 'second.mjs', 'third.mjs'])
    expect(hookEntries(read.hooks, 'tail.after')).toEqual(['b.mjs', 'a.mjs'])
  })

  it('a missing file or a file without the hooks wrapper reads as no hooks', () => {
    expect(readCardHooks(freshRoot(undefined, []))).toEqual({ hooks: {} })
    expect(readCardHooks(freshRoot('{"other":1}', []))).toEqual({ hooks: {} })
  })

  it('invalid JSON and wrong shapes are ignored loudly, never thrown', () => {
    expect(readCardHooks(freshRoot('{broken', []))).toEqual({ hooks: {}, error: 'parse' })
    for (const bad of ['[]', '{"hooks":[]}', '{"hooks":{"main.after":"x.mjs"}}', '{"hooks":{"main.after":[1]}}']) {
      expect(readCardHooks(freshRoot(bad, [])).error).toBe('shape')
    }
    expect(hookEntries(readCardHooks(freshRoot('{"hooks":{"main.after":"x.mjs"}}', [])).hooks, 'main.after')).toEqual([])
  })

  it('script names without the .mjs suffix resolve through the same contract', async () => {
    const root = freshRoot('{ "hooks": { "main.after": ["bare"] } }', ['bare.mjs'])
    const shell = fakeShell()
    await phase(root, { shell })
    expect(shell.fired).toEqual(['bare.mjs'])
  })
})

describe('hook phase execution', () => {
  it('main.after runs its list in order; tail.after stays a no-op when unregistered', async () => {
    const root = freshRoot('{ "hooks": { "main.after": ["s1.mjs", "s2.mjs"] } }', ['s1.mjs', 's2.mjs'])
    const shell = fakeShell()
    await phase(root, { shell })
    expect(shell.fired).toEqual(['s1.mjs', 's2.mjs'])
    await phase(root, { event: 'tail.after', shell })
    expect(shell.fired).toEqual(['s1.mjs', 's2.mjs'])
  })

  it('a failing hook logs once and the chain continues to the remaining entries', async () => {
    const root = freshRoot('{ "hooks": { "main.after": ["flaky.mjs", "after.mjs"] } }', ['flaky.mjs', 'after.mjs'])
    const shell = fakeShell()
    const warns: string[] = []
    await phase(root, { shell, warns })
    expect(shell.fired).toEqual(['flaky.mjs', 'after.mjs'])
    expect(warns).toEqual([expect.stringContaining('hook "flaky.mjs" (main.after) failed (exit, exit 7)')])
  })

  it('an abort fired mid-phase skips the pending entries', async () => {
    const root = freshRoot('{ "hooks": { "tail.after": ["x.mjs", "y.mjs"] } }', ['x.mjs', 'y.mjs'])
    const controller = new AbortController()
    const shell = fakeShell((name) => { if (name === 'x.mjs') controller.abort() })
    await phase(root, { event: 'tail.after', shell, signal: controller.signal })
    expect(shell.fired).toEqual(['x.mjs'])
  })

  it('a pre-aborted signal skips everything', async () => {
    const root = freshRoot('{ "hooks": { "main.after": ["x.mjs"] } }', ['x.mjs'])
    const controller = new AbortController()
    controller.abort()
    const shell = fakeShell()
    await phase(root, { shell, signal: controller.signal })
    expect(shell.fired).toEqual([])
  })

  it('an invalid registry file warns once and runs nothing', async () => {
    const root = freshRoot('{ "hooks": { "main.after": [42] } }', ['never.mjs'])
    const shell = fakeShell()
    const warns: string[] = []
    await phase(root, { shell, warns })
    expect(warns).toEqual([expect.stringContaining('preset/hooks.json ignored (shape)')])
    expect(shell.fired).toEqual([])
  })
})
