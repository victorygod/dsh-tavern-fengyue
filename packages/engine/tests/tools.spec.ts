import { existsSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { pathChain, registerMainAgentTools, registerTailAgentTools, type ShellSeam } from '../src/tools.ts'
import type { ShellExecSpec } from '@deepseek-ai/dsh-shell'
import { writeCardSkeleton } from '../src/workspace.ts'
import type { Context } from '@deepseek-ai/cordis'

let base: string

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'tavern-tools-'))
})

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

/** Registration sink: name → definition; captures the assemble listener for re-sync triggers. */
function registry(): {
  defs: Map<string, {
    description: string
    isConcurrencySafe?(args: unknown): boolean
    execute(args: unknown, exec?: { signal: AbortSignal | undefined }): Promise<unknown>
  }>
  assembleListeners: Array<(assembly: unknown, context: unknown, next: () => Promise<unknown>) => Promise<unknown>>
  ctx: Context
} {
  const defs = new Map<string, { description: string; execute(args: unknown): Promise<unknown> }>()
  const assembleListeners: Array<(assembly: unknown, context: unknown, next: () => Promise<unknown>) => Promise<unknown>> = []
  const ctx = {
    tools: {
      register: (definition: {
        name: string
        description: string
        isConcurrencySafe?(args: unknown): boolean
        execute(args: unknown, exec?: { signal: AbortSignal | undefined }): Promise<unknown>
      }) => {
        if (defs.has(definition.name)) throw new Error(`tool "${definition.name}" is already registered in this scope`)
        defs.set(definition.name, definition)
        return () => { defs.delete(definition.name) }
      },
    },
    on: (event: string, listener: (assembly: unknown, context: unknown, next: () => Promise<unknown>) => Promise<unknown>) => {
      if (event === 'system-prompt/assemble') assembleListeners.push(listener)
      return () => { }
    },
  } as unknown as Context
  return { defs, assembleListeners, ctx }
}

/** Fire the captured assemble listener once — the registration re-sync point. */
async function assemble(listeners: ReturnType<typeof registry>['assembleListeners']): Promise<void> {
  const next = async (): Promise<unknown> => undefined
  for (const listener of listeners) await listener(undefined, undefined, next)
}

// Structural fake: the fake's resolve round-trips only the command, which is
// all the fake run() needs back — the casts keep the fixture off the
// provider's full ShellExecSpec shape without weakening the seam types.
const fakeShell = (stdout: (command: string) => string): ShellSeam => ({
  resolve: request => ({ command: request.command }) as unknown as ShellExecSpec,
  run: spec => Promise.resolve({
    exitCode: 0, aborted: false, timedOut: false, signal: null, timeoutMs: 10_000,
    stdout: { text: stdout((spec as unknown as { command: string }).command), truncated: false },
    stderr: { text: '', truncated: false },
  }),
})

describe('card tools', () => {
  /** A schema'd sample: named parameters declared in the script's own header block. */
  const SCHEMA_BLOCK = [
    '/** @tavern-schema',
    '{',
    '  "description": "查询城市天气",',
    '  "parameters": { "city": { "type": "string", "required": true } }',
    '}',
    '*/',
    'console.log("ok")',
  ].join('\n')

  it('registers every script as its own entry and retires executeTools', () => {
    const root = join(base, 'entries')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/roll.mjs'), SCHEMA_BLOCK)
    writeFileSync(join(root, 'preset/tools/legacy.mjs'), '// generic\n')
    const { defs, ctx } = registry()
    registerMainAgentTools(ctx, root, fakeShell(() => ''))
    expect([...defs.keys()].sort()).toEqual(['legacy', 'roll', 'runtimeGrep', 'runtimeRead'])
  })

  it('a schema block gives the entry its description and named parameters', () => {
    const root = join(base, 'schema')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/roll.mjs'), SCHEMA_BLOCK)
    const { defs, ctx } = registry()
    registerMainAgentTools(ctx, root, fakeShell(() => ''))
    expect(defs.get('roll')?.description).toBe('查询城市天气')
  })

  it('a schema-less script gets the generic {args} entry and a raw command-line tail', async () => {
    const root = join(base, 'generic')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/legacy.mjs'), '// generic\n')
    const seen: string[] = []
    const { defs, ctx } = registry()
    registerMainAgentTools(ctx, root, fakeShell((command) => {
      seen.push(command)
      return 'done'
    }))
    const value = await defs.get('legacy')?.execute({ args: '1d20' }, { signal: undefined }) as string
    expect(seen[0]).toContain('node -e')
    expect(seen[0]).toContain(Buffer.from(JSON.stringify(['1d20'])).toString('base64'))
    expect(value).toBe('Exit: 0\ndone')
  })

  it('a schema\'d script receives its whole argument object as one JSON string', async () => {
    const root = join(base, 'json')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/roll.mjs'), SCHEMA_BLOCK)
    const seen: string[] = []
    const { defs, ctx } = registry()
    registerMainAgentTools(ctx, root, fakeShell((command) => {
      seen.push(command)
      return 'ok'
    }))
    await defs.get('roll')?.execute({ city: 'xi\'an' }, { signal: undefined })
    expect(seen[0]).toContain(Buffer.from(JSON.stringify({ city: 'xi\'an' })).toString('base64'))
  })

  it('the execution\'s cancellation signal rides into the shell request', async () => {
    const root = join(base, 'signal')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/roll.mjs'), '// generic\n')
    const seen: Array<{ command: string; signal: AbortSignal | undefined }> = []
    const { defs, ctx } = registry()
    registerMainAgentTools(ctx, root, {
      resolve: (request) => {
        seen.push({ command: request.command, signal: request.signal })
        return { command: request.command } as unknown as ShellExecSpec
      },
      run: () => Promise.resolve({
        exitCode: 0, aborted: false, timedOut: false, signal: null, timeoutMs: 10_000,
        stdout: { text: 'ok', truncated: false }, stderr: { text: '', truncated: false },
      }),
    })
    const controller = new AbortController()
    await defs.get('roll')?.execute({ args: '' }, { signal: controller.signal })
    expect(seen[0]?.signal).toBe(controller.signal)
  })

  it('a marker block that fails to parse or validate throws at registration', () => {
    const root = join(base, 'invalid')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/bad.mjs'), '/** @tavern-schema\n{ not json\n*/\n')
    const { ctx } = registry()
    expect(() => registerMainAgentTools(ctx, root, fakeShell(() => ''))).toThrow(/invalid @tavern-schema block/)
    const root2 = join(base, 'invalid2')
    writeCardSkeleton(root2)
    writeFileSync(join(root2, 'preset/tools/bad.mjs'), '/** @tavern-schema\n{ "description": "d", "parameters": 3 }\n*/\n')
    const { ctx: ctx2 } = registry()
    expect(() => registerMainAgentTools(ctx2, root2, fakeShell(() => ''))).toThrow(/"parameters" object/)
  })

  it('a card tool named like a fixed runtime tool fails loud on the collision', () => {
    const root = join(base, 'collision')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/runtimeRead.mjs'), '// generic\n')
    const { ctx } = registry()
    expect(() => registerMainAgentTools(ctx, root, fakeShell(() => ''))).toThrow(/already registered/)
  })

  it('re-syncs at the assembly point: adds, re-registers changed, disposes removed', async () => {
    const root = join(base, 'resync')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/keep.mjs'), '// generic\n')
    writeFileSync(join(root, 'preset/tools/gone.mjs'), '// generic\n')
    const { defs, assembleListeners, ctx } = registry()
    registerMainAgentTools(ctx, root, fakeShell(() => ''))
    expect([...defs.keys()].sort()).toEqual(['gone', 'keep', 'runtimeGrep', 'runtimeRead'])

    writeFileSync(join(root, 'preset/tools/added.mjs'), SCHEMA_BLOCK)
    const changed = join(root, 'preset/tools/keep.mjs')
    writeFileSync(changed, SCHEMA_BLOCK)
    utimesSync(changed, new Date(), new Date(1_000_000_000_005))
    rmSync(join(root, 'preset/tools/gone.mjs'))
    await assemble(assembleListeners)
    expect(defs.has('added')).toBe(true)
    expect(defs.has('gone')).toBe(false)
    expect(defs.get('keep')?.description).toBe('查询城市天气')
    expect([...defs.keys()].sort()).toEqual(['added', 'keep', 'runtimeGrep', 'runtimeRead'])
  })

  it('the narrator-tools flag gates the read pair: off blinds it, the assemble re-sync flips both ways', async () => {
    const root = join(base, 'flag')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/roll.mjs'), SCHEMA_BLOCK)
    let on = false
    const { defs, assembleListeners, ctx } = registry()
    registerMainAgentTools(ctx, root, fakeShell(() => ''), () => on)
    // 卡条目照常在场，固定 pair 被收走 —— 盲叙事面。
    expect([...defs.keys()].sort()).toEqual(['roll'])
    on = true
    await assemble(assembleListeners)
    expect([...defs.keys()].sort()).toEqual(['roll', 'runtimeGrep', 'runtimeRead'])
    on = false
    await assemble(assembleListeners)
    expect([...defs.keys()].sort()).toEqual(['roll'])
  })

  it('a tool-less card with the flag off carries no entries at all', async () => {
    const root = join(base, 'toolless')
    writeCardSkeleton(root)
    rmSync(join(root, 'preset/tools'), { recursive: true, force: true })
    let on = false
    const { defs, assembleListeners, ctx } = registry()
    registerMainAgentTools(ctx, root, fakeShell(() => ''), () => on)
    expect([...defs.keys()]).toEqual([])
    on = true
    await assemble(assembleListeners)
    expect([...defs.keys()].sort()).toEqual(['runtimeGrep', 'runtimeRead'])
  })
})

describe('runtime tools', () => {
  it('the tail face is the read pair plus write/edit/delete when the card declares no tail tools', () => {
    const root = join(base, 'tail-face')
    writeCardSkeleton(root)
    const { defs, ctx } = registry()
    registerTailAgentTools(ctx, root, fakeShell(() => ''))
    expect([...defs.keys()].sort()).toEqual(['runtimeDelete', 'runtimeEdit', 'runtimeGrep', 'runtimeRead', 'runtimeWrite'])
  })

  it('card tool faces: agents:[tail] rides the tail face only; default and generic stay main', () => {
    const root = join(base, 'face-tail')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/ledger.mjs'), [
      '/** @tavern-schema',
      '{"description":"落账（尾代理专属，写盘）：写 characters/<who>.json 的钱包三栏。","agents":["tail"],',
      ' "parameters":{"who":{"type":"string","required":true}}}',
      '*/',
    ].join('\n'))
    writeFileSync(join(root, 'preset/tools/calc.mjs'), '/** @tavern-schema\n{"description":"纯计算器（主面）","parameters":{"x":{"type":"string","required":true}}}\n*/\n')
    writeFileSync(join(root, 'preset/tools/legacy.mjs'), '// schema-less generic\n')
    const main = registry()
    registerMainAgentTools(main.ctx, root, fakeShell(() => ''))
    expect([...main.defs.keys()].sort()).toEqual(['calc', 'legacy', 'runtimeGrep', 'runtimeRead'])
    const tail = registry()
    registerTailAgentTools(tail.ctx, root, fakeShell(() => ''))
    expect([...tail.defs.keys()].sort()).toEqual(['ledger', 'runtimeDelete', 'runtimeEdit', 'runtimeGrep', 'runtimeRead', 'runtimeWrite'])
  })

  it('a malformed agents value fails loud at registration', () => {
    const root = join(base, 'face-bad')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/broken.mjs'), '/** @tavern-schema\n{"description":"x","agents":"tail","parameters":{}}\n*/\n')
    const { ctx } = registry()
    expect(() => registerMainAgentTools(ctx, root, fakeShell(() => ''))).toThrow(/agents/)
  })

  it('reads resolve inside runtime/ only', async () => {
    const root = join(base, 'read')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'runtime/state.md'), 'day 2')
    const { defs, ctx } = registry()
    registerTailAgentTools(ctx, root, fakeShell(() => ''))
    expect(await defs.get('runtimeRead')?.execute({ path: 'state.md' })).toContain('day 2')
    await expect(defs.get('runtimeRead')?.execute({ path: '../preset/prompt/systemPrompt' })).rejects.toThrow(/escapes/)
  })

  it('runtimeWrite creates and fully overwrites documents; paths stay fenced and capped', async () => {
    const root = join(base, 'write')
    writeCardSkeleton(root)
    const { defs, ctx } = registry()
    registerTailAgentTools(ctx, root, fakeShell(() => ''))
    const write = defs.get('runtimeWrite')
    expect(await write?.execute({ path: 'npc/a.md', content: 'first\nsecond\nthird' })).toContain('New file created')
    expect(readFileSync(join(root, 'runtime/npc/a.md'), 'utf8')).toBe('first\nsecond\nthird')
    expect(await write?.execute({ path: 'npc/a.md', content: 'dup' })).toContain('overwritten successfully')
    expect(readFileSync(join(root, 'runtime/npc/a.md'), 'utf8')).toBe('dup')
    await expect(write?.execute({ path: 'npc/../../state.md', content: 'x' })).rejects.toThrow(/escapes/)
    await expect(write?.execute({ path: 'big.md', content: 'x'.repeat(1_000_001) })).rejects.toThrow(/byte cap/)
    expect(existsSync(join(root, 'runtime/big.md'))).toBe(false)
  })

  it('runtimeEdit enforces uniqueness with line citations; replace_all takes every match', async () => {
    const root = join(base, 'edit')
    writeCardSkeleton(root)
    const { defs, ctx } = registry()
    registerTailAgentTools(ctx, root, fakeShell(() => ''))
    const edit = defs.get('runtimeEdit')
    const write = defs.get('runtimeWrite')
    await write?.execute({ path: 'state.md', content: 'hp: 10\ncount: 3\nhp: 10\nnight: long' })
    await expect(edit?.execute({ path: 'state.md', old_str: 'hp: 10', new_str: 'hp: 11' }))
      .rejects.toThrow(/Multiple occurrences[\s\S]*lines \[1, 3\]/)
    await expect(edit?.execute({ path: 'state.md', old_str: 'hp: 12', new_str: 'hp: 11' }))
      .rejects.toThrow(/did not appear verbatim/)
    expect(await edit?.execute({ path: 'state.md', old_str: 'count: 3', new_str: 'count: 4' }))
      .toContain('edited successfully')
    expect(readFileSync(join(root, 'runtime/state.md'), 'utf8')).toBe('hp: 10\ncount: 4\nhp: 10\nnight: long')
    // replace_all takes every match; an empty new_str deletes; empty old_str refuses.
    expect(await edit?.execute({ path: 'state.md', old_str: 'hp: 10', new_str: 'hp: 12', replace_all: true }))
      .toContain('edited successfully')
    expect(readFileSync(join(root, 'runtime/state.md'), 'utf8')).toBe('hp: 12\ncount: 4\nhp: 12\nnight: long')
    await edit?.execute({ path: 'state.md', old_str: 'night: long', new_str: '' })
    expect(readFileSync(join(root, 'runtime/state.md'), 'utf8')).toBe('hp: 12\ncount: 4\nhp: 12\n')
    await expect(edit?.execute({ path: 'state.md', old_str: '', new_str: 'x' })).rejects.toThrow(/non-empty/)
  })

  it('.json mutations are parse-checked on the RESULT; invalid edits and writes change nothing', async () => {
    const root = join(base, 'json-guard')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'runtime/player.json'), '{"hp": 10}')
    const { defs, ctx } = registry()
    registerTailAgentTools(ctx, root, fakeShell(() => ''))
    const edit = defs.get('runtimeEdit')
    const write = defs.get('runtimeWrite')
    await expect(edit?.execute({ path: 'player.json', old_str: '{"hp": 10}', new_str: '"hp": 9}' }))
      .rejects.toThrow(/would not be valid JSON[\s\S]*NOT written/)
    expect(readFileSync(join(root, 'runtime/player.json'), 'utf8')).toBe('{"hp": 10}')
    expect(await edit?.execute({ path: 'player.json', old_str: '"hp": 10', new_str: '"hp": 9' }))
      .toContain('edited successfully')
    expect(readFileSync(join(root, 'runtime/player.json'), 'utf8')).toBe('{"hp": 9}')
    await expect(write?.execute({ path: 'player.json', content: '{"hp":' })).rejects.toThrow(/would not be valid JSON/)
    expect(readFileSync(join(root, 'runtime/player.json'), 'utf8')).toBe('{"hp": 9}')
    await expect(write?.execute({ path: 'bad.json', content: '{"a":' })).rejects.toThrow(/would not be valid JSON/)
    expect(existsSync(join(root, 'runtime/bad.json'))).toBe(false)
  })

  it('runtimeRead lists directories, numbers lines, slices view_range and clips long output; edit refuses directories', async () => {
    const root = join(base, 'read-view')
    writeCardSkeleton(root)
    const { defs, ctx } = registry()
    registerTailAgentTools(ctx, root, fakeShell(() => ''))
    const read = defs.get('runtimeRead')
    const write = defs.get('runtimeWrite')
    await write?.execute({ path: 'npc/a.md', content: 'a' })
    await write?.execute({ path: 'npc/deep/b.md', content: 'b' })
    const listing = await read?.execute({ path: '.' }) as string
    expect(listing).toContain('up to 2 levels deep')
    expect(listing).toContain('f\truntime/npc/a.md')
    expect(listing).toContain('d\truntime/npc')
    expect(listing).not.toContain('b.md')
    await write?.execute({ path: 'lines.md', content: 'one\ntwo\nthree' })
    const whole = await read?.execute({ path: 'lines.md' }) as string
    expect(whole).toContain('     1  one')
    expect(whole).toContain('     3  three')
    const slice = await read?.execute({ path: 'lines.md', view_range: [2, -1] }) as string
    expect(slice).toContain('view_range=[2, -1]')
    expect(slice).not.toContain(' 1  one')
    expect(slice).toContain(' 2  two')
    await write?.execute({ path: 'big.md', content: 'line\n'.repeat(3000) })
    expect(await read?.execute({ path: 'big.md' }) as string).toContain('<response clipped>')
    const edit = defs.get('runtimeEdit')
    await expect(edit?.execute({ path: 'npc', old_str: 'a', new_str: 'b' })).rejects.toThrow(/directory/)
  })

  it('the write pair declares parallel-safe and delete stays exclusive', () => {
    const root = join(base, 'concurrency-decl')
    writeCardSkeleton(root)
    const { defs, ctx } = registry()
    registerTailAgentTools(ctx, root, fakeShell(() => ''))
    // Valid args classify parallel; invalid args fail closed to exclusive.
    const valid: Record<string, unknown> = {
      runtimeRead: { path: 'x' },
      runtimeGrep: { pattern: 'x' },
      runtimeWrite: { path: 'x', content: 'y' },
      runtimeEdit: { path: 'x', old_str: 'a', new_str: 'b' },
    }
    for (const [name, args] of Object.entries(valid)) {
      expect(defs.get(name)?.isConcurrencySafe?.(args)).toBe(true)
      expect(defs.get(name)?.isConcurrencySafe?.({})).toBe(false)
    }
    expect(defs.get('runtimeDelete')?.isConcurrencySafe).toBeUndefined()
  })

  it('same-path edits chain behind each other; a failed write does not skip the next', async () => {
    const root = join(base, 'write-chain')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'runtime/state.md'), 'v0')
    const { defs, ctx } = registry()
    registerTailAgentTools(ctx, root, fakeShell(() => ''))
    const edit = defs.get('runtimeEdit') as { execute(args: unknown): Promise<unknown> }
    // Both fire in the same frame: the second reads the first's result, so the
    // dependent old_str matches and the file lands at 'v2'.
    const [first] = await Promise.all([
      edit.execute({ path: 'state.md', old_str: 'v0', new_str: 'v1' }),
      edit.execute({ path: 'state.md', old_str: 'v1', new_str: 'v2' }),
    ])
    expect(first).toContain('edited successfully')
    expect(readFileSync(join(root, 'runtime/state.md'), 'utf8')).toBe('v2')
    // A rejected earlier body must not skip the later one on the same path.
    await expect(edit.execute({ path: 'state.md', old_str: 'missing-anchor', new_str: 'x' })).rejects.toThrow(/did not appear verbatim/)
    expect(await edit.execute({ path: 'state.md', old_str: 'v2', new_str: 'v3' })).toContain('edited successfully')
    expect(readFileSync(join(root, 'runtime/state.md'), 'utf8')).toBe('v3')
  })

  it('the path chain serializes same-path bodies, lets other paths run beside, and survives failures', async () => {
    const chain = pathChain()
    const events: string[] = []
    let releaseA = (): void => { }
    const gateA = new Promise<void>((resolve) => { releaseA = resolve })
    const a1 = chain('/a', async () => { await gateA; events.push('a1'); return 'a1' })
    const a2 = chain('/a', async () => { events.push('a2'); return 'a2' })
    const b1 = chain('/b', async () => { events.push('b1'); return 'b1' })
    await new Promise(resolve => setTimeout(resolve, 0))
    // b1 runs while a1 is gated; a2 queues behind a1.
    expect(events).toEqual(['b1'])
    releaseA()
    expect(await a1).toBe('a1')
    expect(await a2).toBe('a2')
    expect(await b1).toBe('b1')
    expect(events).toEqual(['b1', 'a1', 'a2'])
    const failing = chain('/c', async () => { throw new Error('boom') })
    const after = chain('/c', async () => 'ok')
    await expect(failing).rejects.toThrow(/boom/)
    expect(await after).toBe('ok')
  })

  it('grep reports file:line rows and caps output', async () => {
    const root = join(base, 'grep')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'runtime/state.md'), 'day 2\nnight tenth 1\n')
    writeFileSync(join(root, 'runtime/note.md'), 'night\n')
    const { defs, ctx } = registry()
    registerTailAgentTools(ctx, root)
    const value = await defs.get('runtimeGrep')?.execute({ pattern: 'night', path: 'state.md' }) as string
    expect(value).toBe('state.md:2: night tenth 1')
    const none = await defs.get('runtimeGrep')?.execute({ pattern: 'nothing-here' }) as string
    expect(none).toBe('no matches')
  })
})
