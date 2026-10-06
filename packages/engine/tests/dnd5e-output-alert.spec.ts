// dnd5e 收尾漏项提醒注入器钉(2026-10-04):output_alert 真脚本+临时树(cwd=runtime,与 history-alert 同构)。
// 三查——上一轮工具(.chat.tools.jsonl)/mvu 块/行动选项(尾 assistant 正文)——缺哪样点名哪样;
// 全就绪或首回合(无上一轮 assistant)=空输出({{output_alert()}} 渲染原样吞空)。
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const PRE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'tavern_presets', 'dnd5e', 'preset')

const j = (o: unknown) => JSON.stringify(o)
const head = (o: object) => j({ type: 'head', sessionId: 's', turnSeq: 7, ranAt: 't', ...o })
const userRow = (text: string) => j({ seq: 1, kind: 'user', orig: text, plain: text })
const asstRow = (orig: string) => j({ seq: 2, kind: 'assistant', orig, plain: orig })

const FULL = '正文……\n<details class="mvu-block"><summary>本回合结算</summary><pre data-mvu>{}</pre></details>\n<div class="choice-options"><button class="choice">甲</button></div>'

/** 建临时 runtime:snapshot 行(含上一轮 assistant)+ 可选工具快照(tools 数组/undefined=无该文件)。 */
function rig(opts: { assistant?: string; tools?: { name: string; detail: string }[] }): string {
  const cwd = join(mkdtempSync(join(tmpdir(), 'dnd5e-output-alert-')), 'runtime')
  mkdirSync(cwd, { recursive: true })
  const snap = [j({ type: 'head' }), userRow('我去看看。')]
  if (opts.assistant !== undefined) snap.push(asstRow(opts.assistant))
  writeFileSync(join(cwd, '.chat.snapshot.jsonl'), snap.join('\n') + '\n')
  if (opts.tools !== undefined) {
    writeFileSync(join(cwd, '.chat.tools.jsonl'), [head({}), ...opts.tools.map(t => j({ role: 'tool', ...t }))].join('\n') + '\n')
  }
  return cwd
}

function run(cwd: string): string {
  const r = spawnSync(process.execPath, [join(PRE, 'scripts', 'output_alert.mjs')], { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`output_alert exit ${r.status}: ${r.stderr.slice(0, 300)}`)
  return r.stdout
}

describe('dnd5e 收尾漏项提醒注入器(三查——工具/mvu/选项,缺哪样点名哪样)', () => {
  it('首回合(无上一轮 assistant)=静默,不误报', () => {
    expect(run(rig({}))).toBe('')
  })

  it('三缺全点名:无工具+mvu 无块+选项无按钮 → 三条都在', () => {
    const out = run(rig({ assistant: '正文……', tools: [] }))
    expect(out).toContain('上轮收尾漏项')
    expect(out).toContain('未调用任何工具')
    expect(out).toContain('未输出折叠 mvu 块')
    expect(out).toContain('未输出行动选项')
  })

  it('全就绪(工具+mvu+选项齐)=静默', () => {
    expect(run(rig({ assistant: FULL, tools: [{ name: 'attack', detail: 'target' }] }))).toBe('')
  })

  it('部分缺失只点缺的那条:有 mvu 有工具、缺选项 → 只报选项', () => {
    const out = run(rig({ assistant: '正文……\n<pre data-mvu>{}</pre>', tools: [{ name: 'attack', detail: 'target' }] }))
    expect(out).toContain('未输出行动选项')
    expect(out).not.toContain('未调用任何工具')
    expect(out).not.toContain('未输出折叠 mvu 块')
  })

  it('无 .chat.tools.jsonl(引擎未落/首回合)=跳过工具检查,只报 mvu/选项', () => {
    const out = run(rig({ assistant: '正文……' }))
    expect(out).not.toContain('未调用任何工具')
    expect(out).toContain('未输出折叠 mvu 块')
    expect(out).toContain('未输出行动选项')
  })
})
