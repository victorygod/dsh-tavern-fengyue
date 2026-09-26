// file-events — 页面级文件事件单例(React 树外,同 pending-session.ts/themes.ts 形态)。
// 订阅 engine 的 SSE(/tavern/events,见 packages/engine/src/file-events.ts),把
// "工作区文件动了"的信号投给本会话的订阅者(卡 mount face / 将来的宿主编辑面)。
// 语义铁律:事件只是信号——回调里永远只触发既有拉取,rev 门裁决一切。
// 零轮询拆迁设计:docs/notes/feature/2026-09-25-cards-zero-poll-migration.zh.md。
//
// 投递规则(全住本层,消费方无感):
//   ① frame.sessionId === 订阅键 → 送达(带 paths);
//   ② hello 第二次(EventSource 断线重连)→ 全订户 resync({paths:[]};首次冷启不重放——
//      卡正 boot,重放会与其 bootPoll 竞态);
//   ③ sessionId=null 且 paths 空(全局暗示)→ 全体 resync;
//   ④ sessionId=null 且带真实 paths(未知会话)或其他会话 → 丢弃。
// watcher 降级:{"type":"watch","ok":false} → 30s 慢拉(hint 全体);ok:true → 停。
// jsdom/无 EventSource 环境:订阅照常、事件永不来(卡轮询兜底恒在)。

export interface FilesHint {
  /** 相对 workspaceBase 且含 ws- 目录段的路径;空数组=纯 resync 暗示(不解析内容)。 */
  readonly paths: readonly string[]
}

/** watcher 降级时的兜底慢拉节拍(事件只是信号——降级语义:auto back to polling)。 */
const FILES_DEGRADE_POLL_MS = 30_000

type Listener = (hint: FilesHint) => void

const subs = new Map<string, Set<Listener>>()
let source: EventSource | null = null
let sawHello = false
let degradeTimer: ReturnType<typeof setInterval> | undefined

const deliver = (listener: Listener, hint: FilesHint): void => {
  try {
    listener(hint)
  } catch (error) {
    console.warn('[tavern] files 订阅回调抛错(已隔离,不影响其他订户) —', error)
  }
}

const resyncAll = (): void => {
  for (const set of subs.values())
    for (const listener of [...set]) deliver(listener, { paths: [] })
}

const stopDegrade = (): void => {
  if (degradeTimer !== undefined) {
    clearInterval(degradeTimer)
    degradeTimer = undefined
  }
}

const startDegrade = (): void => {
  if (degradeTimer !== undefined) return
  degradeTimer = setInterval(() => { resyncAll() }, FILES_DEGRADE_POLL_MS)
}

const closeSource = (): void => {
  stopDegrade()
  if (source !== null) {
    try { source.close() } catch { /* already closes */ }
    source = null
  }
  sawHello = false
}

interface WireFrame {
  readonly type?: unknown
  readonly sessionId?: unknown
  readonly paths?: unknown
  readonly ok?: unknown
}

const ensureSource = (): void => {
  if (source !== null || typeof EventSource === 'undefined') return   // jsdom → no-op
  source = new EventSource('/tavern/events')
  source.onmessage = (event: MessageEvent): void => {
    let frame: WireFrame
    try {
      frame = JSON.parse(String(event.data)) as WireFrame
    } catch (error) {
      console.warn('[tavern] files 事件帧解析失败 —', error)
      return
    }
    if (frame.type === 'hello') {
      if (sawHello) resyncAll()   // Reconnect: missed events all made up via resync ({paths:[]} hint full pull)
      sawHello = true
      return
    }
    if (frame.type === 'watch') {
      if (frame.ok === false) startDegrade()
      else stopDegrade()
      return
    }
    if (frame.type !== 'files') return
    const paths = Array.isArray(frame.paths) ? frame.paths.filter((p): p is string => typeof p === 'string') : []
    if (typeof frame.sessionId === 'string' && frame.sessionId !== '') {
      const set = subs.get(frame.sessionId)
      if (set === undefined) return
      for (const listener of [...set]) deliver(listener, { paths })
      return
    }
    if (paths.length === 0) {
      resyncAll()
      return
    }
    // Unknown session carrying real paths: residual session-being-deleted phantom → dropped (cards poll as fallback)
  }
}

/** 订阅本会话的文件变更信号;返回退订。全部退订时自动关掉事件流连接。 */
export function subscribeFileEvents(sessionId: string, listener: (hint: FilesHint) => void): () => void {
  let set = subs.get(sessionId)
  if (set === undefined) {
    set = new Set()
    subs.set(sessionId, set)
  }
  set.add(listener)
  ensureSource()
  return () => {
    const current = subs.get(sessionId)
    if (current === undefined) return
    current.delete(listener)
    if (current.size === 0) subs.delete(sessionId)
    if (subs.size === 0) closeSource()
  }
}
