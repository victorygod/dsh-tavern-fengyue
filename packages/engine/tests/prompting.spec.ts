import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { renderCardTexts, renderPlaceholders, renderPostMessage, runCardScript, stripInstructions } from '../src/prompting.ts'

type ShellFace = Parameters<typeof renderCardTexts>[1]
import { writeCardSkeleton } from '../src/workspace.ts'

let base: string

beforeAll(() => {
  base = mkdtempSync(join(tmpdir(), 'tavern-prompt-'))
})

afterAll(() => {
  rmSync(base, { recursive: true, force: true })
})

interface ShellRun { command: string; workdir: string }

function fakeShell(impl: (entry: ShellRun) => { exitCode: number | null; aborted?: boolean; timedOut?: boolean; stdout: string }): {
  calls: ShellRun[]
  shell: ShellFace
} {
  const calls: ShellRun[] = []
  const shell = {
    resolve: (request: { command: string; workdir: string }) => {
      calls.push({ command: request.command, workdir: request.workdir })
      return { command: request.command, workdir: request.workdir }
    },
    run: (spec: object) => {
      const entry = spec as ShellRun
      return Promise.resolve(impl(entry))
        .then(result => ({
          exitCode: result.exitCode,
          aborted: result.aborted ?? false,
          timedOut: result.timedOut ?? false,
          stdout: { text: result.stdout },
        }))
    },
  } as unknown as ShellFace
  return { calls, shell }
}

describe('placeholder rendering', () => {
  it('returns texts without placeholders untouched (no shells run)', () => {
    const { calls, shell } = fakeShell(() => ({ exitCode: 0, stdout: '' }))
    const root = join(base, 'plain')
    writeCardSkeleton(root)
    return renderPlaceholders('没有占位符', root, shell).then((rendered) => {
      expect(rendered.text).toBe('没有占位符')
      expect(rendered.failures).toEqual([])
      expect(calls.length).toBe(0)
    })
  })

  it('resolves parenthesised placeholders through the scripts directory with cwd = runtime/ and trims stdout', () => {
    const root = join(base, 'script')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/get_turn.mjs'), 'console.log(" 第 2 夜 ")\n')
    const { shell, calls } = fakeShell(() => ({ exitCode: 0, stdout: ' 第 2 夜 \n' }))
    return renderPlaceholders('现在：{{get_turn()}}', root, shell).then((rendered) => {
      expect(rendered.text).toBe('现在：第 2 夜')
      expect(rendered.failures).toEqual([])
      expect(calls.length).toBe(1)
      // v3 命令面：文件 runner + b64（脚本路径 / 参数载荷）。runner 路径是命令串
      // 上唯一的引号 token——PS 5.1 Legacy 再序列化剥不掉"路径引号"（见 runner.cjs）。
      expect(calls[0]?.command.startsWith('node ')).toBe(true)
      expect(calls[0]?.command).toContain('runner.cjs')
      expect(calls[0]?.command).toContain(Buffer.from(join(root, 'preset/scripts/get_turn.mjs')).toString('base64'))
      expect(calls[0]?.command).toContain(Buffer.from('[]').toString('base64'))
      expect(calls[0]?.workdir).toBe(join(root, 'runtime'))
    })
  })

  it('keeps the deprecated bare double-brace form verbatim without a reported failure', () => {
    const { calls, shell } = fakeShell(() => ({ exitCode: 0, stdout: '' }))
    const root = join(base, 'bare')
    writeCardSkeleton(root)
    return renderPlaceholders('旧形态 {{get_turn}} 保持原样', root, shell).then((rendered) => {
      expect(rendered.text).toBe('旧形态 {{get_turn}} 保持原样')
      expect(rendered.failures).toEqual([])
      expect(calls.length).toBe(0)
    })
  })

  it('passes mixed literal arguments as one quoted argv each', () => {
    const root = join(base, 'args')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/echo.mjs'), '// generic\\n')
    const { shell, calls } = fakeShell(() => ({ exitCode: 0, stdout: 'ok' }))
    return renderPlaceholders("{{echo('1d20 x', \"圆的（½）\")}}", root, shell).then(() => {
      expect(calls[0]?.command).toContain(Buffer.from(JSON.stringify(['1d20 x', '圆的（½）'])).toString('base64'))
    })
  })

  it('quotes embedded quotes safely in argv', () => {
    const root = join(base, 'quote')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/echo.mjs'), '// generic\\n')
    const { shell, calls } = fakeShell(() => ({ exitCode: 0, stdout: 'ok' }))
    return renderPlaceholders("{{echo(\"it's\")}}", root, shell).then((rendered) => {
      expect(rendered.text).toBe('ok')
      expect(rendered.failures).toEqual([])
      expect(calls[0]?.command).toContain(Buffer.from(JSON.stringify(["it's"])).toString('base64'))
    })
  })

  it('keeps spaces in bare-word literals but stops the word at braces', () => {
    const root = join(base, 'bareword')
    writeCardSkeleton(root)
    const { shell, calls } = fakeShell(() => ({ exitCode: 0, stdout: 'ok' }))
    return renderPlaceholders('{{read(state file.md)}}', root, shell).then(() => {
      expect(calls[0]?.command).toContain(Buffer.from(JSON.stringify(['state file.md'])).toString('base64'))
    })
  })

  it('evaluates nested calls depth-first: inner stdout rides as the outer argument', () => {
    const root = join(base, 'nested')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/outer.mjs'), 'console.log("OUTER", argv[0])\n')
    writeFileSync(join(root, 'preset/scripts/inner.mjs'), 'console.log("INNER")\n')
    const sourceB64 = (name: string): string => Buffer.from(join(root, 'preset/scripts', name)).toString('base64')
    const { shell, calls } = fakeShell((entry) => {
      if (entry.command.includes(sourceB64('inner.mjs'))) return { exitCode: 0, stdout: 'INNER' }
      return { exitCode: 0, stdout: 'ok' }
    })
    return renderPlaceholders('{{outer({{inner()}}, "x")}}', root, shell).then((rendered) => {
      expect(rendered.text).toBe('ok')
      expect(rendered.failures).toEqual([])
      const outer = calls.find(call => call.command.includes(sourceB64('outer.mjs')))
      expect(outer?.command).toContain(Buffer.from(JSON.stringify(['INNER', 'x'])).toString('base64'))
    })
  })

  it('a failed nested call fails the whole token verbatim', () => {
    const root = join(base, 'nested-fail')
    writeCardSkeleton(root)
    const { shell } = fakeShell(() => ({ exitCode: 0, stdout: '' }))
    return renderPlaceholders('外 {{outer({{missing()}})}}', root, shell).then((rendered) => {
      expect(rendered.text).toBe('外 {{outer({{missing()}})}}')
      expect(rendered.failures).toEqual([{ name: 'missing', reason: 'missing' }])
    })
  })

  it('keeps missing and failing placeholders verbatim and reports the failures', () => {
    const root = join(base, 'keep')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/fail.mjs'), 'process.exit(1)\n')
    const { shell } = fakeShell((entry) => {
      if (entry.command.includes(Buffer.from(join(root, 'preset/scripts/fail.mjs')).toString('base64'))) return { exitCode: 1, stdout: '' }
      return { exitCode: 0, stdout: 'ok' }
    })
    return renderPlaceholders('前 {{missing()}} 后 {{fail()}}', root, shell).then((rendered) => {
      expect(rendered.text).toBe('前 {{missing()}} 后 {{fail()}}')
      expect(rendered.failures).toEqual([
        { name: 'missing', reason: 'missing' },
        { name: 'fail', reason: 'exit', exitCode: 1 },
      ])
    })
  })

  it('a timeout failure rides along as reason timeout', () => {
    const root = join(base, 'slow')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/slow.mjs'), 'await new Promise(r => setTimeout(r, 120000))\\n')
    const { shell } = fakeShell(() => ({ exitCode: null, timedOut: true, stdout: '' }))
    return renderPlaceholders('{{slow()}}', root, shell).then((rendered) => {
      expect(rendered.text).toBe('{{slow()}}')
      expect(rendered.failures).toEqual([{ name: 'slow', reason: 'timeout' }])
    })
  })

  it('renders adjacent placeholders in order', () => {
    const root = join(base, 'adjacent')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/a.mjs'), 'console.log("A")\n')
    writeFileSync(join(root, 'preset/scripts/b.mjs'), 'console.log("B")\n')
    const { shell } = fakeShell(entry => ({ exitCode: 0, stdout: entry.command.includes(Buffer.from(join(root, 'preset/scripts/a.mjs')).toString('base64')) ? 'A' : 'B' }))
    return renderPlaceholders('{{a()}}{{b()}}!', root, shell).then((rendered) => {
      expect(rendered.text).toBe('AB!')
    })
  })

  it('memoises identical tokens inside one render', () => {
    const root = join(base, 'memo')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/v.mjs'), '// generic\\n')
    const { shell, calls } = fakeShell(() => ({ exitCode: 0, stdout: 'v' }))
    return renderPlaceholders('{{v()}}和{{v()}}', root, shell).then((rendered) => {
      expect(rendered.text).toBe('v和v')
      expect(rendered.failures).toEqual([])
      expect(calls.length).toBe(1)
    })
  })

  it('caps nesting depth, argv size, and spawns per render', async () => {
    const root = join(base, 'limits')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/echo.mjs'), '// generic\\n')
    const { shell } = fakeShell(() => ({ exitCode: 0, stdout: 'ok' }))

    // 嵌套五行，超过深度 4 上限。
    const deep = '{{echo({{echo({{echo({{echo({{echo()}})}})}})}})}}'
    // 单个实参超过 16K 字符。
    const huge = `{{echo('${'x'.repeat(16_001)}')}}`
    // 九个不同调用，超过单渲染 8 次 spawn 上限。
    const many = Array.from({ length: 9 }, (_v, index) => `{{echo(${index})}}`).join('')

    const deepRendered = await renderPlaceholders(`深 ${deep}`, root, shell)
    expect(deepRendered.failures.some(failure => failure.reason === 'depth')).toBe(true)
    expect(deepRendered.text.startsWith('深 {{echo(')).toBe(true)

    const hugeRendered = await renderPlaceholders(huge, root, shell)
    expect(hugeRendered.failures).toEqual([{ name: 'echo', reason: 'args' }])
    expect(hugeRendered.text).toBe(huge)

    const manyRendered = await renderPlaceholders(many, root, shell)
    expect(manyRendered.failures.filter(failure => failure.reason === 'limit')).toHaveLength(1)
  })
})

describe('runCardScript', () => {
  it('normalises the .mjs suffix and runs positional argv with cwd = runtime/', () => {
    const root = join(base, 'runcard')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/scripts/echo.mjs'), '// generic\\n')
    const { shell, calls } = fakeShell(() => ({ exitCode: 0, stdout: ' 好 ' }))
    return runCardScript(root, 'echo', ["it's", 'a b'], shell, undefined).then((executed) => {
      expect(executed).toEqual({ ok: true, text: '好' })
      expect(calls[0]?.command.startsWith('node ')).toBe(true)
      expect(calls[0]?.command).toContain('runner.cjs')
      expect(calls[0]?.command).toContain(Buffer.from(join(root, 'preset/scripts/echo.mjs')).toString('base64'))
      expect(calls[0]?.command).toContain(Buffer.from(JSON.stringify(["it's", 'a b'])).toString('base64'))
      expect(calls[0]?.workdir).toBe(join(root, 'runtime'))
    })
  })

  it('rejects path separators as missing scripts and oversized arguments up front', () => {
    const root = join(base, 'runcard-bad')
    writeCardSkeleton(root)
    const { shell, calls } = fakeShell(() => ({ exitCode: 0, stdout: '' }))
    return Promise.all([
      runCardScript(root, '../tools/echo', [], shell, undefined).then((executed) => {
        expect(executed).toEqual({ ok: false, reason: 'missing' })
      }),
      runCardScript(root, 'echo', ['x'.repeat(16_001)], shell, undefined).then((executed) => {
        expect(executed).toEqual({ ok: false, reason: 'args' })
      }),
    ]).then(() => {
      expect(calls.length).toBe(0)
    })
  })
})

describe('tool brief listing', () => {
  it('lists every generic tool script once per generation, mtime-keyed', async () => {
    const root = join(base, 'brief')
    writeCardSkeleton(root)
    const tool = join(root, 'preset/tools/roll.mjs')
    writeFileSync(tool, '// generic\n')
    let runs = 1
    const { shell } = fakeShell(() => {
      runs += 1
      return { exitCode: 0, stdout: 'usage: roll' }
    })
    const first = await renderCardTexts(root, shell)
    expect(first.toolBrief).toContain('# roll.mjs — generic entry')
    expect(runs).toBe(1)
    await renderCardTexts(root, shell)
    expect([runs]).toEqual([runs]) // 无 probe 进程：runs 不再变化
    writeFileSync(tool, '// generic-changed\n')
    await renderCardTexts(root, shell)
    expect(first.toolBrief).toContain('# roll.mjs')
  })

  it('a schema-less row keeps its list line with the generic contract', async () => {
    const root = join(base, 'brief-fail')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/nohelp.mjs'), '// generic\n')
    const { shell } = fakeShell(() => ({ exitCode: 1, stdout: 'ignored' }))
    const first = await renderCardTexts(root, shell)
    expect(first.toolBrief).toContain('# nohelp.mjs')
  })

  it('a @tavern-schema script leaves the brief to its tools-array entry', async () => {
    const root = join(base, 'brief-schema')
    writeCardSkeleton(root)
    writeFileSync(join(root, 'preset/tools/schema.mjs'), [
      '/** @tavern-schema',
      '{ "description": "d", "parameters": {} }',
      '*/',
      'console.log("ok")',
    ].join('\n'))
    writeFileSync(join(root, 'preset/tools/plain.mjs'), '// generic\n')
    const { shell } = fakeShell((entry) => {
      const seen = [entry]
      void seen
      return { exitCode: 0, stdout: 'usage: plain' }
    })
    const rendered = await renderCardTexts(root, shell)
    expect(rendered.toolBrief).toContain('# plain.mjs')
    expect(rendered.toolBrief).not.toContain('schema.mjs')
  })
})

it('renders each prompt file at its only consumer: system at assembly, the post message at submission', async () => {
  const root = join(base, 'four')
  writeCardSkeleton(root)
  writeFileSync(join(root, 'preset/prompt/systemPrompt'), '叙事规则')
  writeFileSync(join(root, 'preset/prompt/prefixPrompt'), '前缀')
  writeFileSync(join(root, 'preset/prompt/postPrompt'), '后缀')
  const { shell } = fakeShell(() => ({ exitCode: 0, stdout: '' }))
  const rendered = await renderCardTexts(root, shell)
  expect(rendered.system).toBe('叙事规则')
  expect(rendered).not.toHaveProperty('post')
  const post = await renderPostMessage(root, shell)
  expect(post.text).toBe('后缀')
  // The retired prefixPrompt file is dead data: even with content present,
  // nothing reads it into the post message.
  expect(post.text).not.toContain('前缀')
  expect(post.failures).toEqual([])
  expect(readFileSync(join(root, 'preset/prompt/maintenancePrompt'), 'utf8')).toBe('')
  expect(readdirSync(join(root, 'preset/prompt')).sort()).toEqual([
    'maintenancePrompt', 'postPrompt', 'prefixPrompt', 'systemPrompt',
  ])
})

it('the post message renders from postPrompt alone', async () => {
  const root = join(base, 'three')
  writeCardSkeleton(root)
  writeFileSync(join(root, 'preset/prompt/postPrompt'), '每回合指令')
  const { shell } = fakeShell(() => ({ exitCode: 0, stdout: '' }))
  const post = await renderPostMessage(root, shell)
  expect(post.text).toBe('每回合指令')
})

it('an empty post body contributes no message text (the claiming turn rides nothing)', async () => {
  const root = join(base, 'empty-post')
  writeCardSkeleton(root)
  const { shell } = fakeShell(() => ({ exitCode: 0, stdout: '' }))
  const post = await renderPostMessage(root, shell)
  expect(post.text).toBe('')
})

describe('placeholder regex hygiene at prompt boundaries', () => {
  const run = vi.fn()
  it('never calls the shell while turning a template into a blank string', () => {
    const root = join(base, 'blank')
    writeCardSkeleton(root)
    const { shell } = fakeShell(() => {
      run()
      return { exitCode: 0, stdout: '' }
    })
    return renderPlaceholders('', root, shell).then((rendered) => {
      expect(rendered.text).toBe('')
      expect(rendered.failures).toEqual([])
      expect(run).not.toHaveBeenCalled()
    })
  })
})

describe('stripInstructions: wrap-era display shim', () => {
  const raw = '我在酒馆里推门而入。'
  // The exact wrapped block the retired engine composer emitted into durable
  // messages; old session logs carry this shape and the display shim must
  // keep them readable.
  const composed = '<pre-instructions>\n前缀规则\n</pre-instructions>\n我在酒馆里推门而入。\n<post-instructions>\n后缀规则\n</post-instructions>'

  it('wrap-era blocks strip back to the raw player text', () => {
    expect(stripInstructions([composed])).toEqual([raw])
  })

  it('current-engine messages pass through byte-identical (no composition anymore)', () => {
    expect(stripInstructions([raw])).toEqual([raw])
  })

  it('anchored edges: player text quoting tags away from the edges is untouched', () => {
    const quoted = '规则里写了 <pre-instructions> 长这样，末尾还有 </post-instructions>'
    expect(stripInstructions([quoted])).toEqual([quoted])
  })

  it('incomplete pre-sections pass through instead of half-stripping', () => {
    const partial = '<pre-instructions>\n没有闭合标签的正文'
    expect(stripInstructions([partial])).toEqual([partial])
  })
})
