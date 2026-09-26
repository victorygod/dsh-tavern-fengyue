// file-events — 本地文件变更通知通道(engine 侧:fs.watch 递归 → 去抖批 → SSE hub → /tavern/events)。
// 设计:docs/notes/feature/2026-09-25-file-events-channel.zh.md(图解+泄洪链);
//      零轮询拆迁:docs/notes/feature/2026-09-25-cards-zero-poll-migration.zh.md。
// 语义铁律:事件只是"信号",rev 仍是"真身"——帧不携带数据,消费方的正确姿势永远是
// 触发既有拉取让 rev 门裁决;任何一步失效都退化为特征前的盲轮询(卡轮询兜底恒在)。
// 内核公开 API 的三处先例(均只读引用,不改内核):SSE handler 模板=dsh-client-hmr,
// ctx.inject 动态域=requestRejection 自担鉴权=api-gateway;wire 全挂子 fiber 随宿主回收。

import { watch, type FSWatcher } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { isAbsolute, relative, resolve, sep } from 'node:path'

export const FILES_SSE_PATH = '/tavern/events'
/** quiet 感知窗,逐事件重臂(写侧 burst 静默 ≥300ms 才 flush,不读半写文件)。 */
export const FILES_DEBOUNCE_MS = 300
/** 最大窗:burst 持续写入时也按时 flush,防无限延迟(与去抖窗共同构成双栅)。 */
export const FILES_FLUSH_MAX_MS = 1_000
export const FILES_KEEPALIVE_MS = 15_000
export const FILES_PATHS_CAP = 50
/** watcher 失败的指数退避(1s→30s 封顶);首个成功事件即归零。 */
const WATCH_RETRY_MS = 1_000
const WATCH_RETRY_MAX_MS = 30_000

/** 相对 workspaceBase 的 POSIX 路径(含 ws- 目录段)。 */
export type RelPath = string
export interface FilesBatch { readonly paths: readonly RelPath[]; readonly truncated: boolean }

export type FilesFrame =
  | { readonly type: 'hello' }
  /** watcher 健康翻转:ok=false 时前端应降级为慢拉,ok=true 自动停。 */
  | { readonly type: 'watch'; readonly ok: boolean }
  | { readonly type: 'files'; readonly sessionId: string | null; readonly paths: readonly RelPath[]; readonly truncated: boolean }

type RawWatchFactory = (filename: string, options: { recursive: true }, listener: (event: string, filename: string | null) => void) => FSWatcher
type Timer = ReturnType<typeof setTimeout>

/* ── watcher:fs.watch 递归 + 去抖聚批 ── */

export interface WorkspaceWatcher {
  /** 去抖批订阅(空 paths = 平台 filename-null 的全局暗示);返回退订。 */
  onBatch(listener: (batch: FilesBatch) => void): () => void
  /** watcher 健康翻转(建连/重开成功=true;错误关闭=false);返回退订。 */
  onHealth(listener: (ok: boolean) => void): () => void
  dispose(): void
}

export function createWorkspaceWatcher(deps: {
  baseDir: string
  debounceMs?: number
  maxWindowMs?: number
  /** 测试替身入口;缺省 node:fs watch。 */
  watchFactory?: RawWatchFactory
  onError?: (error: Error) => void
}): WorkspaceWatcher {
  const debounceMs = deps.debounceMs ?? FILES_DEBOUNCE_MS
  const maxWindowMs = deps.maxWindowMs ?? FILES_FLUSH_MAX_MS
  const factory = deps.watchFactory ?? watch
  const listeners = new Set<(batch: FilesBatch) => void>()
  const healthListeners = new Set<(ok: boolean) => void>()
  const pending = new Set<string>()
  let hintUnknown = false
  let windowStart = 0
  let debounceTimer: Timer | undefined
  let retryTimer: Timer | undefined
  let retryMs = WATCH_RETRY_MS
  let watcher: FSWatcher | undefined
  let disposed = false

  /** 起一个不挂进程事件环的定时器(unref:测试/进程退出不因它而悬)。 */
  const armTimer = (callback: () => void, delayMs: number): Timer => {
    const timer = setTimeout(callback, delayMs)
    timer.unref?.()
    return timer
  }

  const emitBatch = (paths: readonly string[], truncated: boolean): void => {
    for (const listener of [...listeners]) listener({ paths, truncated })
  }

  const flush = (): void => {
    debounceTimer = undefined
    windowStart = 0
    const sorted = [...pending].sort()
    const truncated = sorted.length > FILES_PATHS_CAP
    emitBatch(sorted.slice(0, FILES_PATHS_CAP), truncated)
    pending.clear()
    if (hintUnknown) {
      // 平台 filename-null 的暗帧:交给消费方"全局暗示"处理(resync 语义)
      hintUnknown = false
      emitBatch([], false)
    }
  }

  /** 退避排程:1s→2s→…(cap 30s)——当次按当前档排,排完升档;成功哪怕事件即归 1s。 */
  const scheduleReopen = (): void => {
    if (disposed || retryTimer !== undefined) return
    const delayMs = retryMs
    retryMs = Math.min(retryMs * 2, WATCH_RETRY_MAX_MS)
    retryTimer = armTimer(() => {
      retryTimer = undefined
      if (!disposed) open()
    }, delayMs)
  }

  const onOpenError = (error: Error): void => {
    if (disposed) return
    deps.onError?.(error)
    for (const listener of [...healthListeners]) listener(false)
  }

  const open = (): void => {
    try {
      watcher = factory(deps.baseDir, { recursive: true }, onRaw)
    } catch (error) {
      // ENOENT=base 尚不存在(新装环境;不预建目录,保持 boot 扫描 existsSync 语义);
      // EPERM/ENOSPC 同路退避。事件只是信号,轮询兜底在,watcher 不致命。
      onOpenError(error instanceof Error ? error : new Error(String(error)))
      scheduleReopen()
      return
    }
    watcher.on('error', (error: Error) => {
      if (disposed) return
      onOpenError(error)
      try { watcher?.close() } catch { /* 已关 */ }
      watcher = undefined
      scheduleReopen()
    })
    // 注意:退避不在"重开成功"时归零(防 抛错/成功 交替的 1s 风暴),只在收到真实
    // fs 事件时归零(见 onRaw)——事件=watch 真活了,设计语义:"首个成功事件即归零"。
    for (const listener of [...healthListeners]) listener(true)
  }

  function onRaw(_event: string, filename: string | null): void {
    if (disposed) return
    retryMs = WATCH_RETRY_MS // 首个成功事件=退避归零(watch 活着)
    if (typeof filename !== 'string' || filename === '') {
      hintUnknown = true
    } else {
      // fs.watch 的 filename 通常相对监听根;个别平台给绝对路径 → 归一化;统一 POSIX 分隔
      let rel = filename
      if (isAbsolute(rel)) rel = relative(resolve(deps.baseDir), rel)
      rel = rel.split(sep).join('/')
      if (rel !== '') pending.add(rel)
      else hintUnknown = true
    }
    if (windowStart === 0) windowStart = Date.now()
    // 逐事件重臂(quiet 语义)+ 最大窗封顶(burst 持续时按时 flush)
    const remaining = maxWindowMs - (Date.now() - windowStart)
    const delay = remaining <= 0 ? 0 : Math.min(debounceMs, remaining)
    if (debounceTimer !== undefined) clearTimeout(debounceTimer)
    debounceTimer = armTimer(flush, delay)
  }

  open()

  return {
    onBatch(listener: (batch: FilesBatch) => void): () => void {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    onHealth(listener: (ok: boolean) => void): () => void {
      healthListeners.add(listener)
      return () => { healthListeners.delete(listener) }
    },
    dispose(): void {
      disposed = true
      if (debounceTimer !== undefined) clearTimeout(debounceTimer)
      if (retryTimer !== undefined) clearTimeout(retryTimer)
      try { watcher?.close() } catch { /* 已关 */ }
      watcher = undefined
      listeners.clear()
      healthListeners.clear()
    },
  }
}

/* ── SSE hub(hmr 模板逐字对齐:writeHead 先于首 write,gzip 豁免靠 content-type)── */

export interface SseHub {
  /** 建立一条事件流连接:头 + ': connected' + hello 帧;res 断开时自摘。 */
  connect(res: ServerResponse): void
  broadcast(frame: FilesFrame): void
  readonly size: number
  dispose(): void
}

export function createSseHub(): SseHub {
  const connections = new Set<ServerResponse>()
  const sseData = (frame: FilesFrame): string => `data: ${JSON.stringify(frame)}\n\n`
  const writeOrDrop = (res: ServerResponse, chunk: string): void => {
    try { res.write(chunk) } catch { try { res.destroy() } catch { /* 已关 */ } connections.delete(res) }
  }
  const keepalive = setInterval(() => {
    for (const res of [...connections]) writeOrDrop(res, ': ka\n\n')
  }, FILES_KEEPALIVE_MS)
  keepalive.unref?.()
  return {
    connect(res: ServerResponse): void {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        connection: 'keep-alive',
      })
      res.write(': connected\n\n')
      res.write(sseData({ type: 'hello' }))
      connections.add(res)
      res.on('close', () => { connections.delete(res) })
    },
    broadcast(frame: FilesFrame): void {
      const line = sseData(frame)
      for (const res of [...connections]) writeOrDrop(res, line)
    },
    get size(): number { return connections.size },
    dispose(): void {
      clearInterval(keepalive)
      for (const res of [...connections]) { try { res.destroy() } catch { /* 已关 */ } }
      connections.clear()
    },
  }
}

/* ── wire:ctx.inject 动态域里组装 watcher + hub + 路由(先例 api-gateway /api/remote.mux)──
   结构化最小面:engine 的 peer 依赖图不引入 webserver 类型——宿主真实对象天然满足。 */

type WireEffect = (setup: () => () => void, label?: string) => unknown

export interface WireServerFace { register(route: { kind: 'exact' | 'prefix'; path: string; handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void> }): () => void }
export interface WireConnectionFace { requestRejection(req: IncomingMessage): number | undefined }
export interface WireInjectCtx { inject(keys: readonly string[], callback: (webCtx: { effect: WireEffect; webServer: WireServerFace; connection: WireConnectionFace }) => void): unknown }

/** 工作区目录名 → sessionId:盘上 marker 权威,进程内绑定表兜底;未知(孤儿/删除中)=null。 */
export function resolveSessionForDirectory(root: string, deps: {
  readMarker: (root: string, file: string) => string | null
  sessionFile: string
  bound: Iterable<readonly [string, string]>
}): string | null {
  const marker = deps.readMarker(root, deps.sessionFile)
  if (marker !== null && marker !== '') return marker
  for (const [sessionId, boundRoot] of deps.bound)
    if (resolve(boundRoot) === resolve(root)) return sessionId
  return null
}

export function wireFileEvents(deps: {
  ctx: WireInjectCtx
  baseDir: () => string
  resolveSession: (dirName: string) => string | null
  logger: { warn(message: unknown): void }
  watchFactory?: RawWatchFactory
}): void {
  deps.ctx.inject(['connection', 'webServer'], (webCtx) => {
    webCtx.effect(() => {
      const hub = createSseHub()
      const watcher = createWorkspaceWatcher({
        baseDir: deps.baseDir(),
        ...(deps.watchFactory === undefined ? {} : { watchFactory: deps.watchFactory }),
        onError: error => deps.logger.warn(`tavern: workspace watcher 异常(${String(error)})——事件通道退避重启,轮询节拍不受影响`),
      })
      const unsubHealth = watcher.onHealth(ok => { hub.broadcast({ type: 'watch', ok }) })
      const unsubBatch = watcher.onBatch((batch) => {
        // ws- 首段分组:每会话一帧;sessionId 在 emit 时刻解析(marker 权威,见 resolveSessionForDirectory)
        const groups = new Map<string, string[]>()
        for (const path of batch.paths) {
          const seg = path.split('/')[0] ?? ''
          const list = groups.get(seg)
          if (list === undefined) groups.set(seg, [path])
          else list.push(path)
        }
        for (const [dir, paths] of groups)
          hub.broadcast({ type: 'files', sessionId: deps.resolveSession(dir), paths, truncated: batch.truncated })
        if (batch.paths.length === 0) hub.broadcast({ type: 'files', sessionId: null, paths: [], truncated: false })
      })
      const disposeRoute = webCtx.webServer.register({
        kind: 'exact',
        path: FILES_SSE_PATH,
        handler: (req, res) => {
          // register 的路由无全局栏,鉴权自担(api-gateway 同款):Host 栏+cookie 认证
          const rejection = webCtx.connection.requestRejection(req)
          if (rejection !== undefined) {
            res.writeHead(rejection)
            res.end(rejection === 401 ? 'unauthorized' : 'forbidden')
            return
          }
          if (req.method !== 'GET') {
            res.writeHead(405)
            res.end()
            return
          }
          hub.connect(res)   // 立即返回——宿主会 await handler,SSE 不得滞留 Promise
        },
      })
      return () => { unsubBatch(); unsubHealth(); disposeRoute(); watcher.dispose(); hub.dispose() }
    }, `tavern: ${FILES_SSE_PATH} 文件事件通道`)
  })
}
