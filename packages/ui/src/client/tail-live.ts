/**
 * 尾代理直跟通道（2026-09-29 透流改道退役批）。
 *
 * 引擎侧透流派退役后，尾子会话的 assistant 流帧由内核按 session.id 只注给
 * 子会话自己的 follow（dsh-api-session-controller/lib/index.js:1481 的过滤）；
 * 本模块是浏览器侧唯一的接入口：以 subagent 地址 retain 子会话
 * （`sessions.retain({parentSessionId, childSessionId, mode:'one-shot'})`，
 * 生产先例 = dsh-client-ui-subagent 侧栏 chat 的 one-shot 直跟），把子流瞬态
 * 实时帧折进数据维护行。父流从此纯净——尾代是独立 dsh-agent-loop 实例，其
 * frame.revision 用自己的 loop 级计数（dsh-agent-loop/lib/index.js:765,1037），
 * 旧透流把它转挂父流即混序，客户端按「严格 +1 连续」核 revision
 * （dsh-api-session-controller/lib/client.js:449-452）必撕窗重建，主代理该步
 * 瞬态被静默丢弃（真机定罪：dnd5e 第 2 回合起每回合第一步思考不直播）。
 *
 * 直跟的时序坑与对策（走查记：dsh-subagent-in-process-driver:145-159）：
 * 子会话的 subagent/descriptor 只在其首个 agent/pre-step 上账，而该步还被引擎
 * main.after 钩子闸挡着——fork 孵化到首步之间 retain 会以
 * `subagent/catalog-diagnostic`（reason 'unsupported'）失败，且 failed open 永不
 * 自愈（open 只在新 retain 时重试，client.js:1856-1865），故失败必须弃引用重来，
 * 退避至稳拍、由闸门（tailRunning）落 false 兜底终止。中途连上不丢内容：宿主
 * accumulator 基线携带在途 attempt 的压缩流前缀，客户端展开为合成瞬态
 * （client.js:1392-1436 expandAssistantStream），首折即补回半截参数。
 */
import { useEffect, useState } from 'react'
import type { ISessions, SessionReference } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** One tool call folded live from the tail child's own assistant stream
 * (args build up per delta; the block-end settles the canonical name). The
 * settled counterpart with the paired result comes from the tail fetch.
 * Structural mirror of chat-view.tsx's `TailStep` — same shape, no import, so
 * this module stays off the chat-view component graph. */
export interface TailStep {
  readonly tool: string
  readonly args: string
}

/** The stream-chunk slice the fold reads (dsh-llm StreamChunk, structurally). */
export interface StreamChunkLike {
  type?: string
  index?: number
  text?: string
  blockType?: string
  name?: string
  argumentsDelta?: string
  arguments?: string
  block?: { name?: string; arguments?: string }
}

/** Live fold of one tail child's own stream — rebuilt from the event-source
 * snapshot on every pass (exactly the per-pass fold the transposed pipeline
 * ran; retired attempts reappear through the durable tail fetch). */
export interface TailLiveFold {
  /** Open tool-call buckets: chunk index → name/args accumulated so far. */
  readonly open: Map<number, { name: string; args: string }>
  readonly steps: TailStep[]
  reply: string
}

/** The event-source slice the fold reads (the SessionBinding's feed, structurally). */
export interface TailLiveSource {
  getSnapshot(): { entries: readonly { type?: unknown; event?: { data?: { chunk?: unknown } } }[] }
  subscribe(fn: () => void): () => void
}

/**
 * Fold one stream chunk into the tail row's live body: tool-call
 * blocks build their arguments per delta and finalize at block-end (the end
 * block is canonical — name/arguments win over the deltas); text deltas are
 * the closing reply. 原透流管件原样迁自 TavernApp.tsx（fold 分支与判定逐行同源）。
 */
export function foldTailStreamChunk(fold: TailLiveFold, chunk: StreamChunkLike): void {
  switch (chunk.type) {
    case 'block-start':
      if (chunk.blockType === 'tool-call') fold.open.set(chunk.index ?? -1, { name: '', args: '' })
      return
    case 'tool-call-delta': {
      const index = chunk.index ?? -1
      const slot = fold.open.get(index) ?? { name: '', args: '' }
      fold.open.set(index, slot)
      if (typeof chunk.name === 'string' && chunk.name !== '') slot.name = chunk.name
      slot.args += chunk.argumentsDelta ?? ''
      return
    }
    case 'block-end': {
      const index = chunk.index ?? -1
      const slot = fold.open.get(index)
      if (slot === undefined) return
      fold.open.delete(index)
      const name = typeof chunk.block?.name === 'string' && chunk.block.name !== '' ? chunk.block.name : slot.name
      const args = typeof chunk.block?.arguments === 'string' ? chunk.block.arguments : slot.args
      if (name !== '') fold.steps.push({ tool: name, args })
      return
    }
    case 'text-delta':
      fold.reply += chunk.text ?? ''
      return
    default:
      return
  }
}

/** One snapshot refold over the source's current entries: every transient
 * frame on the child stream belongs to the child (no attemptId routing —
 * the child's binding only ever carries its own frames). */
export function tailLiveFoldOf(source: TailLiveSource): TailLiveFold {
  const fold: TailLiveFold = { open: new Map(), steps: [], reply: '' }
  for (const entry of source.getSnapshot().entries) {
    if (entry.type !== 'transient') continue
    const chunk = entry.event?.data?.chunk
    if (chunk !== undefined && chunk !== null && typeof chunk === 'object') foldTailStreamChunk(fold, chunk as StreamChunkLike)
  }
  return fold
}

/** Map hygiene: settled rows render the durable tail fetch, so only the
 * newest folds need to stay folded. */
const TAIL_FOLD_KEEP = 8

/** Structural discrimination against the wire's stable failure codes —
 * no value import, client bundle purity. Retryable = the child's identity
 * facts are simply not durably on file yet. */
function retryableFollowError(error: unknown): boolean {
  const code = (error as { code?: unknown } | null | undefined)?.code
  return code === 'subagent/catalog-diagnostic' || code === 'subagent/not-found'
}

/**
 * Live folds for the parent transcript's tail rows, fed from the CHILD's own
 * follow. 只有最新在跑的一条被直跟：引擎闸门按 session 串行（gates 每父至多
 * 一个活动尾），旧行由 durable tail fetch（rpc.tailTranscript）渲染。
 *
 * 生命周期：catalog 行到（children 增长）→ retain + descriptor 重试退避 →
 * 成连后订阅子流快照重折；闸门落 false / 换绑 / 卸载 → 取订 + release，折行
 * 结果留在 map（该行已 settled，走 detail 全量）。
 */
export function useTailLiveFolds(options: {
  sessions: ISessions
  parent: SessionId
  children: readonly string[]
  running: boolean
}): Map<string, TailLiveFold> {
  const activeChild = options.running && options.children.length > 0 ? options.children[options.children.length - 1] : undefined
  const [folds, setFolds] = useState<Map<string, TailLiveFold>>(() => new Map())
  useEffect(() => {
    if (activeChild === undefined) return
    const childId = activeChild
    const sessions = options.sessions
    const parent = options.parent
    let released = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let unsubscribe: (() => void) | undefined
    let reference: SessionReference | undefined
    let attempt = 0
    const record = (source: TailLiveSource): void => {
      setFolds(previous => {
        const next = new Map(previous)
        next.set(childId, tailLiveFoldOf(source))
        while (next.size > TAIL_FOLD_KEEP) {
          const oldest = next.keys().next().value
          if (oldest === undefined) break
          next.delete(oldest)
        }
        return next
      })
    }
    const scheduleRetry = (error: unknown): void => {
      if (released || !retryableFollowError(error)) {
        // 弃喂降级：行退回 durable fetch（2s 轮询/落定信号取数），一次 warn 留痕。
        if (!released) console.warn('[tavern] tail follow unavailable', childId, error)
        return
      }
      // 0-8 次退避（250ms 起步、封顶 1s，镜像 switchSession 的退避台式），
      // 之后 running 期间的稳拍——闸门由配对 tavern-tail-done 协议保证落 false。
      const delay = attempt <= 8 ? Math.min(1_000, 250 * 2 ** (attempt - 1)) : 1_500
      timer = setTimeout(acquire, delay)
    }
    const acquire = (): void => {
      if (released) return
      attempt += 1
      let ref: SessionReference
      try {
        // childId 来自父日志 subagent/catalog 的 JSON 载荷（string）；品牌型
        // SessionId 是编译期虚构，运行期即真实会话 id——按类型面收窄。
        ref = sessions.retain({ parentSessionId: parent, childSessionId: childId as SessionId, mode: 'one-shot' }, { source: 'tavern-tail' })
      } catch (error) {
        scheduleRetry(error)
        return
      }
      reference = ref
      void ref.ready.then((binding) => {
        if (released) { ref.release(); return }
        const source = binding.eventSource as unknown as TailLiveSource
        unsubscribe = source.subscribe(() => record(source))
        record(source)
      }, (error: unknown) => {
        if (released) return
        ref.release()
        reference = undefined
        scheduleRetry(error)
      })
    }
    acquire()
    return () => {
      released = true
      if (timer !== undefined) clearTimeout(timer)
      unsubscribe?.()
      reference?.release()
    }
  }, [options.sessions, options.parent, activeChild])
  return folds
}
