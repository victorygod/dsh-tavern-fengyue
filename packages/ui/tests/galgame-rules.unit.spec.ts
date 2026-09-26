// galgame-rules unit —— 芙宁娜 galgame 纯函数件规格(2026-09-25 域重构批)。
// 锁规格:七族规则语义自现役 index.js 逐条显性化提取,本套即规格——重构搬家
// 前后都必须全绿(先锁后搬家)。清单见 docs/notes/feature/2026-09-25-gal-domain-refactor.zh.md §4。
import { describe, expect, it } from 'vitest'
import {
  makeScript, visibleHistory, decideRestore, mergeLive,
  packPointers, readPointersPack, renderHistoryHTML,
} from '../../../tavern_presets/芙宁娜/preset/ui/view.mjs'

describe('makeScript:剧本学', () => {
  it('切段+CG 归并:行内 cg 贴段、纯 CG 行结转下一段、文末残留覆盖末段;raw/行偏移随拍在案', () => {
    const s = makeScript({ seq: 7, orig: '早上好 <!-- cg: 3 -->\n<!-- cg: 5 -->\n欢迎回来' }, [{ role: 'user', seq: 6, text: '嗨' }])
    expect(s.paras).toEqual([
      { role: 'assistant', text: '早上好', cg: '3' },
      { role: 'assistant', text: '欢迎回来', cg: '5' },   // 纯 CG 行结转下一段
    ])
    expect(s.raw).toBe('早上好 \n\n欢迎回来')             // 指令剥净、行尾随空格保留、内部换行保留
    expect(s.lineEnds).toEqual([4, 10])                    // 空行不计偏移
    expect(s.history).toEqual([{ role: 'user', seq: 6, text: '嗨' }])
    const tailCg = makeScript({ seq: 8, orig: '第一句\n第二句\n<!-- cg: 9 -->' }, [])
    expect(tailCg.paras).toEqual([
      { role: 'assistant', text: '第一句', cg: null },
      { role: 'assistant', text: '第二句', cg: '9' },       // 文末残留覆盖末段
    ])
  })

  it('空/纯指令回复 → 空剧本:paras=[], raw=""(输入态/开场判据)', () => {
    expect(makeScript(null, [])).toEqual({ paras: [], raw: '', lineEnds: [], history: [] })
    const onlyCg = makeScript({ seq: 9, orig: '<!-- cg: 2 -->' }, [])
    expect(onlyCg.paras).toEqual([])
    expect(onlyCg.raw).toBe('')
  })

  it('orig 缺席时退 text;同一输入产同一形状(orig→text 决不双轨)', () => {
    const byOrig = makeScript({ seq: 3, orig: '你好' }, [])
    const byText = makeScript({ seq: 3, text: '你好' }, [])
    expect(byOrig.paras).toEqual(byText.paras)
  })
})

describe('visibleHistory:防剧透口径(backlog 行唯一出处)', () => {
  const script = makeScript({ seq: 7, orig: '第一段\n第二段\n第三段' }, [
    { role: 'user', seq: 6, text: '继续呀' },
    { role: 'assistant', seq: 7, text: '第一段 第二段 第三段' },
  ])

  it('当前轮截到已读段(含当前段);换行按原文偏移保留', () => {
    const rows = visibleHistory(script, { r: 1, asstSeq: 7 })
    expect(rows[1]).toEqual({ role: 'assistant', text: '第一段\n第二段' })
    expect(rows[0]).toEqual({ role: 'user', seq: 6, text: '继续呀' })   // 其他行原样
  })

  it('r=末段 → 全文显示(末段不丢);r 超界 → clamp 到末段', () => {
    expect(visibleHistory(script, { r: 2, asstSeq: 7 })[1].text).toBe('第一段\n第二段\n第三段')
    expect(visibleHistory(script, { r: 99, asstSeq: 7 })[1].text).toBe('第一段\n第二段\n第三段')
  })

  it('水位不命中的历史行不截断(缺席期旧轮次照原样全量)', () => {
    const rows = visibleHistory(script, { r: 0, asstSeq: 8 })
    expect(rows[1]).toEqual({ role: 'assistant', seq: 7, text: '第一段 第二段 第三段' })
  })
})

describe('decideRestore:读位恢复三分支(boot 契约)', () => {
  it('resume:同回合存位且非 input 态 → 回到读到的那段,r 上下 clamp', () => {
    const saved = { r: 1, asstSeq: 7, mode: 'reading' }
    expect(decideRestore(saved, 7, 3)).toEqual({ plan: 'resume', r: 1 })
    expect(decideRestore({ ...saved, r: -2 }, 7, 3)).toEqual({ plan: 'resume', r: 0 })
    expect(decideRestore({ ...saved, r: 9 }, 7, 3)).toEqual({ plan: 'resume', r: 2 })
  })

  it('input 存位不重播:点完过的(存位 mode=input)直落输入态, r=末段', () => {
    expect(decideRestore({ r: 2, asstSeq: 7, mode: 'input' }, 7, 3)).toEqual({ plan: 'input', r: 2 })
  })

  it('replay:缺席期新回复(水位前进)→ 从队头从头演绎(未读)', () => {
    expect(decideRestore({ r: 1, asstSeq: 5, mode: 'reading' }, 7, 4)).toEqual({ plan: 'replay', r: 0 })
  })

  it('无存位/坏存位/水位倒退 → input 兜底(旧契约)', () => {
    expect(decideRestore(null, 7, 3)).toEqual({ plan: 'input', r: 2 })
    expect(decideRestore({}, 7, 3)).toEqual({ plan: 'input', r: 2 })
    expect(decideRestore({ r: 1, asstSeq: 9, mode: 'reading' }, 7, 3)).toEqual({ plan: 'input', r: 2 })
  })
})

describe('mergeLive:live 合流(遇 \\n 切行/活性尾/入队不判 CG)', () => {
  const base = () => makeScript({ seq: 7, orig: '行一\n行二' }, [])

  it('无新完整行:paras 原样,活性尾单独交出', () => {
    const out = mergeLive(base(), '行一\n行二\n行三尾')
    expect(out.paras).toHaveLength(2)
    expect(out.liveTail).toBe('行三尾')
  })

  it('新完整行到账:行内 cg 注释贴段;空行与纯注释行不入队', () => {
    const out = mergeLive(base(), '行一\n行二\n行三 <!-- cg: 2 -->\n\n行四尾')
    expect(out.paras.map(p => p.text)).toEqual(['行一', '行二', '行三'])
    expect(out.paras[2].cg).toBe('2')
    expect(out.liveTail).toBe('行四尾')
  })

  it('空剧本首拍:首条完整行即入队,无换行则只有活性尾', () => {
    expect(mergeLive(makeScript(null, []), '第一段\n第二段尾').paras).toEqual([
      { role: 'assistant', text: '第一段', cg: null },
    ])
    const noBreak = mergeLive(makeScript(null, []), '尚无换行的一句')
    expect(noBreak.paras).toEqual([])
    expect(noBreak.liveTail).toBe('尚无换行的一句')
  })

  it('空串/全换行:无新增,活性尾为空', () => {
    expect(mergeLive(base(), '')).toEqual({ paras: base().paras, liveTail: '' })
    expect(mergeLive(base(), '\n\n').paras).toEqual(base().paras)
  })
})

describe('packPointers/readPointersPack:指针包(单键 LRU ≤16)', () => {
  it('新键插尾;同键刷新移尾;超容量丢最旧(头)', () => {
    const store: Record<string, unknown> = {}
    for (let i = 1; i <= 16; i++) store[`s:${i}`] = { r: i, paras: 1, asstSeq: i, mode: 'reading', ts: i }
    const refreshed = packPointers(store, '1' as never, { r: 0, paras: 1, asstSeq: 1, mode: 'reading', ts: 99 })
    expect(Object.keys(refreshed).at(-1)).toBe('s:1')                       // 刷新移尾
    expect(Object.keys(refreshed)).toHaveLength(16)
    const grown = packPointers(store, '17' as never, { r: 2, paras: 3, asstSeq: 17, mode: 'input', ts: 100 })
    expect(Object.keys(grown).at(-1)).toBe('s:17')
    expect(Object.keys(grown)).toHaveLength(16)
    expect(Object.keys(grown)[0]).toBe('s:2')                               // 最旧被丢
    expect(grown['s:17']).toEqual({ r: 2, paras: 3, asstSeq: 17, mode: 'input', ts: 100 })
  })

  it('读包:坏 JSON / 非对象值 / 空串 → 空包(退化不持久,行为零伤)', () => {
    expect(readPointersPack('{oops')).toEqual({})
    expect(readPointersPack('42')).toEqual({})
    expect(readPointersPack('null')).toEqual({})
    expect(readPointersPack('["a"]')).toEqual({})
    expect(readPointersPack(undefined as unknown as string)).toEqual({})
    expect(readPointersPack('{"s:1":{"r":1}}')).toEqual({ 's:1': { r: 1 } })
  })
})

describe('renderHistoryHTML:行渲染', () => {
  it('类名/名字牌/全量转义(正文永不直进 HTML)', () => {
    const html = renderHistoryHTML([
      { role: 'user', text: '走开<svg onload=x>' },
      { role: 'assistant', text: '<b>加粗</b>' },
    ])
    expect(html).toContain('class="bl-row u"')
    expect(html).toContain('class="bl-row a"')
    expect(html).toContain('你')
    expect(html).toContain('芙宁娜')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('<b>')
    expect(html).toContain('&lt;svg')
  })

  it('组合钉(v10.1 事故防回潮):当前轮截断行必是字符串切片——整段对象直传即 [object Object]', () => {
    const script = makeScript({ seq: 7, orig: '第一段\n第二段' }, [{ role: 'assistant', seq: 7, text: '第一段 第二段' }])
    const html = renderHistoryHTML(visibleHistory(script, { r: 0, asstSeq: 7 }))
    expect(html).toContain('第一段')
    expect(html).not.toContain('第二段')       // 未读的半截不上屏
    expect(html).not.toContain('[object Object]')
  })
})
