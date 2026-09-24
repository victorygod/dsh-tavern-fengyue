import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import { chatSnapshotRows, CHAT_SNAPSHOT_FILE, chatSnapshotPath, TAIL_SNAPSHOT_FILE, tailSnapshotPath, writeChatSnapshot, writeTailSnapshot } from '../src/chat-snapshot.ts'
import { writeCardSkeleton } from '../src/workspace.ts'

const tempDirs: string[] = []

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function freshRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'tavern-snapshot-'))
  tempDirs.push(root)
  writeCardSkeleton(root)
  writeFileSync(join(root, 'preset/meta.json'), JSON.stringify({ title: '测试卡', desc: '', cover: '' }))
  return root
}

function userEvent(seq: number, text: string): SessionEvent {
  return {
    type: 'user/message',
    seq,
    data: { source: { kind: 'user' }, content: [{ type: 'text', text }] },
  } as unknown as SessionEvent
}

function assistantEvent(seq: number, text: string): SessionEvent {
  return {
    type: 'assistant/message',
    seq,
    data: { message: { id: `m${seq}`, role: 'assistant', content: [
      { type: 'reasoning', text: '不该出现' },
      { type: 'text', text },
    ] } },
  } as unknown as SessionEvent
}

function fakeSession(events: SessionEvent[], seq: number): Session {
  return { id: 'session-x', snapshotEvents: () => events, seq } as unknown as Session
}

function readLines(root: string): Record<string, unknown>[] {
  return readFileSync(chatSnapshotPath(root), 'utf8').trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
}

describe('conversation snapshot projection', () => {
  it('projects player/assistant rows with orig and stripped plain, ignoring reasoning and engine reminders', () => {
    freshRoot()
    const session = fakeSession([
      userEvent(3, '<pre-instructions>\nP\n</pre-instructions>\n我推门'),
      { type: 'user/message', seq: 4, data: { source: { kind: 'system' }, content: [{ type: 'text', text: '<system-reminder>x</system-reminder>' }] } } as unknown as SessionEvent,
      assistantEvent(7, '酒保抬头。'),
    ], 8)
    const rows = chatSnapshotRows(session)
    expect(rows).toEqual([
      { seq: 3, kind: 'user', orig: '<pre-instructions>\nP\n</pre-instructions>\n我推门', plain: '我推门' },
      { seq: 7, kind: 'assistant', orig: '酒保抬头。', plain: '酒保抬头。' },
    ])
  })

  it('drops non-string text blocks: an object must not stringify into "[object Object]" in the backlog', () => {
    freshRoot()
    // 某些 provider/数据把 text 块塞成对象;textOfBlocks 必须丢弃而非 String() 泄漏
    const session = fakeSession([
      userEvent(1, 'hi'),
      { type: 'assistant/message', seq: 2, data: { message: { content: [
        { type: 'text', text: { hello: 'world' } },
        { type: 'text', text: '正常正文。' },
      ] } } } as unknown as SessionEvent,
    ], 3)
    const rows = chatSnapshotRows(session)
    expect(rows[1]?.kind).toBe('assistant')
    expect(rows[1]?.orig).not.toContain('object Object')
    expect(rows[1]?.orig).toBe('正常正文。')
    expect(rows[1]?.plain).toBe('正常正文。')
  })

  it('writes the whole file with a head line and heals a previously mangled copy', () => {
    const root = freshRoot()
    const snapshot = chatSnapshotPath(root)
    writeFileSync(snapshot, 'garbage that must heal')
    const session = fakeSession([userEvent(1, '你好'), assistantEvent(2, '欢迎。')], 2)
    writeChatSnapshot(root, session, { clientTimeZone: 'Asia/Shanghai' })
    const lines = readLines(root)
    expect(lines[0]).toMatchObject({ type: 'head', sessionId: 'session-x', cardTitle: '测试卡', clientTimeZone: 'Asia/Shanghai' })
    expect(lines[1]).toMatchObject({ seq: 1, kind: 'user', plain: '你好' })
    expect(lines[2]).toMatchObject({ seq: 2, kind: 'assistant', plain: '欢迎。' })

    // 错了就错了：任何坏内容都会在下一次整写时被治愈。
    writeFileSync(snapshot, 'mangled again')
    writeChatSnapshot(root, session, {})
    expect(JSON.parse(readFileSync(snapshot, 'utf8').split('\n')[2] as string)).toMatchObject({ kind: 'assistant' })
  })

  it('the pending row projects the submitting input before its durable event exists', () => {
    const root = freshRoot()
    const session = fakeSession([userEvent(1, '第一句')], 2)
    writeChatSnapshot(root, session, { pendingText: '我刚刚输入的话' })
    const rows = readLines(root)
    expect(rows.at(-1)).toMatchObject({ seq: 2, kind: 'user', orig: '我刚刚输入的话', plain: '我刚刚输入的话' })
    // 随后的权威重写（durable 事件 fires）替换掉 pending 行。
    const confirmed = fakeSession([userEvent(1, '第一句'), userEvent(2, '我刚刚输入的话')], 3)
    writeChatSnapshot(root, confirmed, {})
    expect(readLines(root).at(-1)).toMatchObject({ seq: 2, kind: 'user', orig: '我刚刚输入的话' })
    expect(readLines(root).some(row => row.pending === true)).toBe(false)
  })

  it('an empty or absent session writes just the head line, and the file sits in runtime/', () => {
    const root = freshRoot()
    writeChatSnapshot(root, undefined, {})
    expect(existsSync(join(root, 'runtime', CHAT_SNAPSHOT_FILE))).toBe(true)
    expect(readLines(root)).toHaveLength(1)
    expect(readLines(root)[0]).toMatchObject({ type: 'head' })
    expect(readFileSync(chatSnapshotPath(root), 'utf8').endsWith('\n')).toBe(true)
  })
})

describe('tail output file', () => {
  function tailLines(root: string): Record<string, unknown>[] {
    return readFileSync(tailSnapshotPath(root), 'utf8').trim().split('\n').map(line => JSON.parse(line) as Record<string, unknown>)
  }

  it('writes head + narration rows into runtime/, carrying the turn marker', () => {
    const root = freshRoot()
    writeTailSnapshot(root, { sessionId: 'session-x', turnSeq: 42, texts: ['维护叙述一。', '维护叙述二。'] })
    expect(existsSync(join(root, 'runtime', TAIL_SNAPSHOT_FILE))).toBe(true)
    const lines = tailLines(root)
    expect(lines).toHaveLength(3)
    expect(lines[0]).toMatchObject({ type: 'head', sessionId: 'session-x', turnSeq: 42 })
    expect(typeof lines[0].ranAt).toBe('string')
    expect(lines[1]).toEqual({ role: 'assistant', text: '维护叙述一。' })
    expect(lines[2]).toEqual({ role: 'assistant', text: '维护叙述二。' })
    expect(readFileSync(tailSnapshotPath(root), 'utf8').endsWith('\n')).toBe(true)
  })

  it('whole-file replacement discards the previous turn and an empty run leaves head only', () => {
    const root = freshRoot()
    writeTailSnapshot(root, { sessionId: 'session-x', turnSeq: 1, texts: ['上一轮。'] })
    writeTailSnapshot(root, { sessionId: 'session-x', turnSeq: 2, texts: [] })
    const lines = tailLines(root)
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({ type: 'head', turnSeq: 2 })
    expect(JSON.stringify(tailLines(root))).not.toContain('上一轮')
  })
})
