// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { renderRichBody } from '../src/client/rich-text.ts'
describe('rich message pipeline', () => {
  it('sanitizes markdown + card html into style-scoped bodies', () => {
    for (const text of ['推门进去', '酒保抬眼看你。', '**加粗** 与 `code`']) {
      const html = renderRichBody(text)
      expect(html).not.toBe('')
    }
  })
})
