// @vitest-environment jsdom
// Pure-folder spec for the tavern card importer: container routes, version
// normalization, the ST five-way fold and the fengyue (风月) dialect fold
// (mapping/st-import-work-order/fengyue-import docs). No React — every
// surface is data-in/data-out (the fengyue cover fetch stays behind the
// async entry, exercised with an empty cover URL).
import { describe, expect, it } from 'vitest'
import {
  buildGreetings, buildLorebook, composeSystemPrompt, importFromJson, normalizeCard, parseTavernCard, verdictRegex,
} from '../src/client/st-import.ts'

const PNG_MAGIC: number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Build a minimal PNG holding tEXt chunks (keyword\0text); no IDAT — probing never decodes pixels. */
function pngWithText(entries: { keyword: string; text: string }[]): Uint8Array {
  const bytes: number[] = [...PNG_MAGIC]
  const latin1 = (text: string): number[] => Array.from(text, char => char.charCodeAt(0) & 0xff)
  for (const { keyword, text } of entries) {
    const data = [...latin1(keyword), 0, ...latin1(text)]
    const length = data.length
    bytes.push((length >>> 24) & 255, (length >>> 16) & 255, (length >>> 8) & 255, length & 255,
      0x74, 0x45, 0x58, 0x74, ...data, 0, 0, 0, 0)
  }
  bytes.push(0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44)
  return new Uint8Array(bytes)
}

function base64(bytes: Uint8Array): string {
  const latin1 = String.fromCharCode(...bytes)
  return Buffer.from(latin1, 'binary').toString('base64')
}

const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

describe('container routes', () => {
  it('reads a PNG card via the chara chunk and carries the PNG bytes as the cover', async () => {
    const card = { spec: 'chara_card_v2', spec_version: '2.0', data: { name: '酒馆の猫', description: '夜里的猫', first_mes: '喵。' } }
    const png = pngWithText([{ keyword: 'chara', text: base64(utf8(JSON.stringify(card))) }])
    const file = new File([png as unknown as BlobPart], 'card.png', { type: 'image/png' })
    const parsed = await parseTavernCard(file)
    expect(parsed.error).toBeUndefined()
    expect(parsed.title).toBe('酒馆の猫')
    expect(parsed.cover).toEqual({ path: 'preset/assets/cover.png', dataBase64: base64(png) })
    expect(parsed.files['preset/greetings.json']).toContain('喵。')
  })

  it('prefers ccv3 over chara when both chunks exist', async () => {
    const v2 = { spec: 'chara_card_v2', data: { name: 'v2 卡' } }
    const v3 = { spec: 'chara_card_v3', spec_version: '3.0', data: { name: 'v3 卡' } }
    const png = pngWithText([
      { keyword: 'chara', text: base64(utf8(JSON.stringify(v2))) },
      { keyword: 'ccv3', text: base64(utf8(JSON.stringify(v3))) },
    ])
    const parsed = await parseTavernCard(new File([png as unknown as BlobPart], 'card.png', { type: 'image/png' }))
    expect(parsed.title).toBe('v3 卡')
  })

  it('rejects a PNG without embedded character data and invalid JSON with clear errors', async () => {
    const bare = await parseTavernCard(new File([pngWithText([]) as unknown as BlobPart], 'x.png', { type: 'image/png' }))
    expect(bare.error).toContain('没有内嵌角色数据')
    const bad = await parseTavernCard(new File(['{oops'], 'x.json', { type: 'application/json' }))
    expect(bad.error).toBe('不是有效的 JSON 文件')
    const unknown = importFromJson({ whatever: 1 }, 'x', undefined)
    // spec-less JSON without name/prompt fields: normalization throws → surfaced as error
    expect(unknown.error).toContain('不认识的卡格式')
  })
})

describe('version normalization', () => {
  it('keeps V2 data.* as the canonical base and V3 extras flow through', () => {
    const { card } = normalizeCard({
      spec: 'chara_card_v3', spec_version: '3.0',
      data: {
        name: 'n', description: 'd', alternate_greetings: ['g1', 'g2'], tags: ['奇幻'],
        character_book: { entries: [{ keys: ['a'], content: 'c', extensions: { probability: 50 } }] },
        extensions: { depth_prompt: { prompt: '总结指令' }, world: 'Aether' },
      },
    })
    expect(card.alternateGreetings).toEqual(['g1', 'g2'])
    expect(card.characterBook?.entries[0]?.probability).toBe(50)
    expect(card.depthPrompt).toBe('总结指令')
    expect(card.worldRef).toBe('Aether')
  })

  it('folds V1 top-level fields and creatorcomment onto the canonical shape', () => {
    const { card } = normalizeCard({ name: 'v1', description: 'd', first_mes: '嗨', creatorcomment: '备注' })
    expect(card.name).toBe('v1')
    expect(card.creatorNotes).toBe('备注')
    expect(card.worldRef).toBe('')
  })

  it('picks up legacy DSH-format pre_prompt/post_prompt for the postPrompt merge', () => {
    const { card } = normalizeCard({ name: '旧卡', pre_prompt: '前段', post_prompt: '后段', system_prompt: 's' })
    expect(card.legacyPrePrompt).toBe('前段')
    expect(card.legacyPostPrompt).toBe('后段')
  })
})

describe('systemPrompt fold (ST assembly order)', () => {
  const card = normalizeCard({
    data: {
      description: 'desc', personality: 'pers', scenario: 'scen', mes_example: 'ex', creator_notes: 'notes', system_prompt: 'sys',
      character_book: {
        entries: [
          { keys: [], content: '世界前·恒定', constant: true, position: 'before_char', insertion_order: 0 },
          { keys: [], content: '世界后·恒定', constant: true, position: 'after_char', insertion_order: 1 },
          { keys: ['x'], content: '触发·不入 systemPrompt', position: 'before_char', insertion_order: 2 },
        ],
      },
    },
  }).card

  it('orders constant sections around the persona stack and drops triggered entries', () => {
    const prompt = composeSystemPrompt(card)
    const positions = ['【世界 · 上】\n世界前·恒定', '【人设】\ndesc', '【性格】\npers', '【场景】\nscen', '【对话示例】\nex', '【创作者备注】\nnotes', '【世界 · 下】\n世界后·恒定', '【系统指令】\nsys']
      .map(fragment => prompt.indexOf(fragment))
    expect(positions.every((value, index) => value >= 0 && (index === 0 || value > positions[index - 1]!))).toBe(true)
    expect(prompt).not.toContain('触发·不入')
  })

  it('splits the world book: triggered entries only in lorebook.json, in order and with st raw', () => {
    const lorebook = buildLorebook(card)
    expect(lorebook).toBeDefined()
    const parsed = JSON.parse(lorebook!) as { entries: { id: string; keys: string[]; st: Record<string, unknown> }[] }
    expect(parsed.entries).toHaveLength(1)
    expect(parsed.entries[0]!.keys).toEqual(['x'])
    expect(parsed.entries[0]!.st).toMatchObject({ content: '触发·不入 systemPrompt' })
  })

  it('greetings carry first_mes first and alternate greetings after', () => {
    const card = normalizeCard({ data: { first_mes: '开场', alternate_greetings: ['备选一', 42, '备选二'] } }).card
    expect(JSON.parse(buildGreetings(card)!)).toEqual({ greetings: ['开场', '备选一', '备选二'] })
  })

  it('an empty book and a purely constant book produce no lorebook mount', () => {
    expect(buildLorebook(normalizeCard({ data: {} }).card)).toBeUndefined()
    const constantOnly = normalizeCard({
      data: { character_book: { entries: [{ keys: [], content: 'c', constant: true, position: 'before_char' }] } },
    }).card
    expect(buildLorebook(constantOnly)).toBeUndefined()
  })
})

describe('regex verdict sort (mapping §5.1)', () => {
  const script = (placement: number[], flags: Partial<Record<'promptOnly' | 'markdownOnly' | 'disabled', boolean>>): Record<string, unknown> =>
    ({ scriptName: 's', placement, ...flags })

  it('maps each placement+flag combination to its landing', () => {
    expect(verdictRegex(script([1], { promptOnly: true })).verdict).toBe('translate')
    expect(verdictRegex(script([1], {})).verdict).toBe('drop')
    expect(verdictRegex(script([1], { markdownOnly: true })).verdict).toBe('pending-render-hook')
    expect(verdictRegex(script([2], { promptOnly: true })).verdict).toBe('drop')
    expect(verdictRegex(script([2], { markdownOnly: true })).verdict).toBe('pending-render-hook')
    expect(verdictRegex(script([5], {})).verdict).toBe('translate')
    expect(verdictRegex(script([3], {})).verdict).toBe('drop')
    expect(verdictRegex(script([], {})).verdict).toBe('drop')
    expect(verdictRegex(script([1], { disabled: true })).reason).toContain('停用')
  })
})

describe('full fold + work order + report', () => {
  it('folds V1/legacy cards with a work order only when there is material to report', () => {
    const pristine = importFromJson({ data: { name: '纯净卡', description: 'd' } }, 'x', undefined)
    expect(pristine.files['preset/st-import/README.md']).toBeUndefined()
    expect(pristine.files['preset/scripts/persona.mjs']).toBeDefined()
    expect(pristine.files['preset/prompt/postPrompt']).toBe('')

    const rich = importFromJson({
      spec: 'chara_card_v3', spec_version: '3.0',
      data: {
        name: '富卡', description: 'd', post_history_instructions: '越狱令',
        character_book: { entries: [{ keys: [], content: 'c', constant: true, position: 'before_char' }, { keys: ['t'], content: 't', extensions: { probability: 40 } }, { keys: ['z'], content: 'off', enabled: false }] },
        extensions: {
          depth_prompt: { prompt: '总结' },
          world: 'AetherWorld',
          regex_scripts: [
            { scriptName: '改输入', placement: [1], promptOnly: true, findRegex: '/a/g', replaceString: 'b' },
            { scriptName: '改输出', placement: [2], findRegex: '/c/g', replaceString: 'd' },
          ],
        },
      },
    }, 'x', undefined)
    expect(rich.files['preset/prompt/postPrompt']).toBe('{{lorebook()}}\n\n越狱令')
    expect(rich.files['preset/lorebook.json']).toContain('"probability": 40')
    expect(rich.files['preset/scripts/lorebook.mjs']).toContain('.includes(')
    expect(rich.files['preset/greetings.json']).toBeUndefined()
    expect(rich.files['preset/meta.json']).toContain('"creator"')
    const readme = rich.files['preset/st-import/README.md']!
    expect(readme).toContain('丢弃：正则「改输出」')
    expect(readme).toContain('depth_prompt')
    expect(readme).toContain('extensions.world "AetherWorld"')
    expect(readme).toContain('禁用世界书条目')
    expect(readme).toContain('| 1 | 改输入')
    const regexJson = JSON.parse(rich.files['preset/st-import/regex.json']!) as { items: { scriptName: string }[] }
    expect(regexJson.items).toHaveLength(1)
    expect(regexJson.items[0]!.scriptName).toBe('改输入')
    const meta = JSON.parse(rich.files['preset/meta.json']!) as Record<string, string>
    expect(meta.cover).toBe('') // no PNG container → no cover path
  })
})

describe('fengyue (风月) dialect: detection + fold', () => {
  // 战争模拟.json 的字段形态裁剪版：pre_prompt 三段、@wb@ 触发键、HTML description。
  const fyCard = {
    name: '东亚怪物房2.0',
    summary: '基于客观态势的战略分析与战争推演系统\n分天推演。',
    description: '<body><style>body{background:#0c1a2d}</style>推演系统</body>',
    pre_prompt: '你是战争推演引擎。',
    pre_text: '我的指令只用于提示。',
    post_text: '先分析再推演，最后更新状态栏。',
    cover: '',
    opening_statement: '选择一段开场白',
    suggested_questions: ['今日战局如何？'],
    world_book: [
      // key_region 位码（1=system/2=user/4=assistant）：6/4/5 各钉一种折叠面，0 钉缺落默认。
      { key: '_or_日本@wb@自卫队', value: '日本军事力量…', group: '', key_region: 6, value_region: 1 },
      { key: '_and_美国@wb@美军', value: '美军…', group: 'x', key_region: 2, value_region: 1 },
      { key: '_or_台湾@wb@台海', value: '台湾军事力量…', group: '', key_region: 5, value_region: 1 },
      { key: '_or_朝鲜@wb@人民军', value: '朝鲜军事力量…', group: '', key_region: 0, value_region: 1 },
      { key: '', value: '无键条目' },
    ],
  }

  it('routes fengyue JSON through the dialect fold (container JSON path, cover URL empty → no fetch)', async () => {
    const file = new File([JSON.stringify(fyCard)], '战争模拟.json', { type: 'application/json' })
    const parsed = await parseTavernCard(file)
    expect(parsed.error).toBeUndefined()
    expect(parsed.title).toBe('东亚怪物房2.0')
    expect(parsed.files['preset/setup/opening.html']).toContain('<style>')
    expect(parsed.cover).toBeUndefined()
  })

  it('folds the three-prompt stack: pre_prompt → systemPrompt; pre_text+post_text → postPrompt behind {{lorebook()}}', () => {
    const parsed = importFromJson({ ...fyCard, world_book: fyCard.world_book, cover: '' }, 'x', undefined)
    expect(parsed.files['preset/prompt/systemPrompt']).toBe('你是战争推演引擎。')
    expect(parsed.files['preset/prompt/postPrompt']).toBe('{{lorebook()}}\n\n我的指令只用于提示。\n\n先分析再推演，最后更新状态栏。')
    expect(parsed.files['preset/prompt/maintenancePrompt']).toBe('')
  })

  it('translates the world book: @wb@ keys split, key_region mask folds to scan.kinds, raw rides fy', () => {
    const parsed = importFromJson(fyCard, 'x', undefined)
    const lorebook = JSON.parse(parsed.files['preset/lorebook.json']!) as {
      entries: { id: string; keys: string[]; content: string; scan: { kinds: string[] }; fy: Record<string, unknown> }[]
    }
    expect(lorebook.entries).toHaveLength(4)
    expect(lorebook.entries[0]!.keys).toEqual(['日本', '自卫队'])
    // 位码 6 = user|assistant；2 = 仅 user；5 = assistant|system；0 缺落 → 默认 user+assistant。
    expect(lorebook.entries[0]!.scan.kinds).toEqual(['user', 'assistant'])
    expect(lorebook.entries[1]!.scan.kinds).toEqual(['user'])
    expect(lorebook.entries[2]!.scan.kinds).toEqual(['assistant', 'system'])
    expect(lorebook.entries[3]!.scan.kinds).toEqual(['user', 'assistant'])
    expect(lorebook.entries[0]!.fy).toMatchObject({ key_region: 6 })
    // 生成脚本带双匹配面：scan.kinds 走「最近一条」，无 scan 的（ST）走窗口。
    const script = parsed.files['preset/scripts/lorebook.mjs']!
    expect(script).toContain('scan')
    expect(script).toContain('kinds.includes')
    expect(script).toContain('slice(-n)')
    const readme = parsed.files['preset/st-import/README.md']!
    expect(readme).toContain('AND 组语义未迁移')
    expect(readme).toContain('group「x」')
    expect(readme).toContain('无键或无内容')
    expect(readme).toContain('system 位')
    expect(readme).toContain('落默认 user+assistant')
    // 体量行明示扫描面与注入位决策（value_region 不另设位）。
    expect(readme).toContain('value_region 不另设位')
  })

  it('greetings carry opening_statement first and suggested questions after; meta desc collapses the summary', () => {
    const parsed = importFromJson(fyCard, 'x', undefined)
    expect(JSON.parse(parsed.files['preset/greetings.json']!)).toEqual({
      greetings: ['选择一段开场白', '今日战局如何？'],
    })
    const meta = JSON.parse(parsed.files['preset/meta.json']!) as Record<string, string | string[]>
    expect(meta.desc).toBe('基于客观态势的战略分析与战争推演系统 分天推演。')
    expect(meta.cover).toBe('')
  })

  it('a fengyue card without a world book folds no lorebook files and still writes the persona scaffold', () => {
    const parsed = importFromJson({ ...fyCard, world_book: [] }, 'x', undefined)
    expect(parsed.files['preset/lorebook.json']).toBeUndefined()
    expect(parsed.files['preset/scripts/lorebook.mjs']).toBeUndefined()
    // 无书即无 {{lorebook()}} 占位——postPrompt 只剩用户层文本。
    const post = parsed.files['preset/prompt/postPrompt'] ?? ''
    expect(post.startsWith('{{lorebook()}}')).toBe(false)
    expect(parsed.files['preset/scripts/persona.mjs']).toBeDefined()
    expect(parsed.files['preset/setup/persona.md']).toBeDefined()
  })

  it('cover material passes through and a URL-without-bytes lands as a manual-upload report row', () => {
    const landed = importFromJson({ ...fyCard, cover: '' }, 'x', { coverPath: 'preset/assets/cover.webp', dataBase64: 'AAECAw==' })
    expect(landed.cover).toEqual({ path: 'preset/assets/cover.webp', dataBase64: 'AAECAw==' })
    expect(JSON.parse(landed.files['preset/meta.json']!).cover).toBe('preset/assets/cover.webp')

    const orphan = importFromJson({ ...fyCard, cover: 'https://example.invalid/cover' }, 'x', undefined)
    expect(orphan.cover).toBeUndefined()
    expect(orphan.files['preset/st-import/README.md']).toContain('URL 未落地')
  })

  it('legacy DSH pre_prompt/post_prompt exports keep the ST route (no fengyue hijack)', () => {
    const parsed = importFromJson({ name: '旧卡', pre_prompt: '前段', post_prompt: '后段', system_prompt: 's', description: 'd' }, 'x', undefined)
    expect(parsed.error).toBeUndefined()
    expect(parsed.files['preset/setup/opening.html']).toBeUndefined()
    expect((parsed.files['preset/prompt/postPrompt'] ?? '')).not.toContain('{{lorebook()}}')
    expect((parsed.files['preset/prompt/systemPrompt'] ?? '')).not.toBe('前段')
  })
})
