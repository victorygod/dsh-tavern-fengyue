import { describe, expect, it } from 'vitest'
import { stripInstructions } from '../src/client/wrap-markers.ts'

/**
 * The strip is the display shim for wrap-era session logs: whatever the old
 * engine composed into a durable message, the client renders back as the raw
 * player text — the refresh/载入 不可见性 contract for old logs. Current
 * submissions carry no tags, so clean text passes through byte-identical.
 * The fixture below restates the legacy composer's exact output shape; the
 * client must not import host engine sources.
 */
describe('client instruction strip clears legacy wrap-era blocks', () => {
  const raw = '我拔剑指向怪物。'
  const compose = (prefix: string, post: string): string => {
    const parts: string[] = []
    if (prefix !== '') parts.push(`<pre-instructions>\n${prefix}\n</pre-instructions>`)
    parts.push(raw)
    if (post !== '') parts.push(`<post-instructions>\n${post}\n</post-instructions>`)
    return parts.join('\n')
  }

  it('full round trip: composed prompt renders back as the raw text', () => {
    expect(stripInstructions([compose('面板：HP 10', '格式约束')])).toEqual([raw])
  })

  it('empty pair and legacy messages pass through byte-identical', () => {
    expect(stripInstructions([raw])).toEqual([raw])
    expect(stripInstructions([compose('', '')])).toEqual([raw])
  })

  it('prefix-only and post-only pairs strip their own side', () => {
    expect(stripInstructions([compose('P', '')])).toEqual([raw])
    expect(stripInstructions([compose('', 'S')])).toEqual([raw])
  })

  it('no partial stripping on unanchored tag mentions', () => {
    const quoted = '标签写作 <post-instructions> 的那行不算引擎注入。'
    expect(stripInstructions([quoted])).toEqual([quoted])
  })
})
