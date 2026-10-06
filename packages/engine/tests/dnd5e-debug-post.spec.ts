// dnd5e postPrompt 调试流水钉(2026-10-04):debug_post 真钩子脚本+临时树(cwd=runtime,preset 兄弟——部署同构)。
// 钩子自读 ../preset/prompt/postPrompt、展开零参 {{script()}}(逐脚本 node 直跑 stdout 替换,失败保留占位符),
// 每回合 append 一段 markdown(## 回合 N · 时戳 + 渲染全文 + --- 分隔)到 runtime/debug/post-history.md;
// 回合标记优先 .chat.tools.jsonl head.turnSeq,回退快照尾 assistant seq。
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PRE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tavern_presets', 'dnd5e', 'preset')

/** 建临时树:base/preset/{prompt,scripts} + base/runtime(cwd)。files=scripts 目录下的假脚本。 */
function rig(template: string, files: Record<string, string>): { cwd: string; base: string } {
  const base = mkdtempSync(join(tmpdir(), 'dnd5e-debug-post-'))
  const cwd = join(base, 'runtime')
  mkdirSync(join(base, 'preset', 'prompt'), { recursive: true })
  mkdirSync(join(base, 'preset', 'scripts'), { recursive: true })
  mkdirSync(cwd, { recursive: true })
  writeFileSync(join(base, 'preset', 'prompt', 'postPrompt'), template)
  for (const [f, body] of Object.entries(files)) writeFileSync(join(base, 'preset', 'scripts', f), body)
  return { cwd, base }
}

function run(cwd: string): void {
  const r = spawnSync(process.execPath, [join(PRE, 'scripts', 'debug_post.mjs')], { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`debug_post exit ${r.status}: ${r.stderr.slice(0, 300)}`)
}

function readLog(cwd: string): string {
  return readFileSync(join(cwd, 'debug', 'post-history.md'), 'utf8')
}

describe('dnd5e postPrompt 调试流水(钩子重渲染→markdown 直读 append)', () => {
  it('展开零参占位符、append 一段 markdown、回合标记取 .chat.tools.jsonl head.turnSeq', () => {
    const { cwd, base } = rig('头部\n{{probe()}}\n尾部', { 'probe.mjs': "console.log('探针输出')" })
    writeFileSync(join(cwd, '.chat.tools.jsonl'), JSON.stringify({ type: 'head', sessionId: 's', turnSeq: 42, ranAt: 't' }) + '\n')
    run(cwd)
    const md = readLog(cwd)
    expect(md).toContain('## 回合 42 ·')
    expect(md).toContain('探针输出')
    expect(md).not.toContain('{{probe()}}')
    expect(md).toContain('---')
    rmSync(base, { recursive: true, force: true })
  })

  it('缺脚本/非零退出=占位符原样保留(fail-visible 同款)', () => {
    const { cwd, base } = rig('{{missing()}}', {})
    run(cwd)
    expect(readLog(cwd)).toContain('{{missing()}}')
    rmSync(base, { recursive: true, force: true })
  })

  it('空输出脚本=替换为空(不留占位符)', () => {
    const { cwd, base } = rig('甲{{empty()}}乙', { 'empty.mjs': '' })
    run(cwd)
    expect(readLog(cwd)).toContain('甲乙')
    expect(readLog(cwd)).not.toContain('{{empty()}}')
    rmSync(base, { recursive: true, force: true })
  })

  it('回合标记回退:无 .chat.tools.jsonl → 取快照尾 assistant seq', () => {
    const { cwd, base } = rig('{{probe()}}', { 'probe.mjs': "console.log('探针输出')" })
    writeFileSync(join(cwd, '.chat.snapshot.jsonl'), [
      JSON.stringify({ type: 'head' }),
      JSON.stringify({ seq: 98, kind: 'user', orig: 'u', plain: 'u' }),
      JSON.stringify({ seq: 99, kind: 'assistant', orig: 'a', plain: 'a' }),
    ].join('\n') + '\n')
    run(cwd)
    expect(readLog(cwd)).toContain('## 回合 99 ·')
    rmSync(base, { recursive: true, force: true })
  })

  it('append 不覆盖:连跑两回合 → 两个 ## 回合标题块', () => {
    const { cwd, base } = rig('{{probe()}}', { 'probe.mjs': "console.log('探针输出')" })
    run(cwd)
    run(cwd)
    expect(readLog(cwd).match(/## 回合 /g)).toHaveLength(2)
    rmSync(base, { recursive: true, force: true })
  })
})
