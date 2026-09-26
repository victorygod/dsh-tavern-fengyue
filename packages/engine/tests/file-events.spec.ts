// file-events 模块钉(2026-09-25,通道批)——watcher 真盘(fs.watch 平台时序用 waitFor
// 容忍,断言"至少一帧含目标路径"不断言精确形态)/ hub fake res / wire 假 ctx 注入。
// 反查 resolveSessionForDirectory 单独钉(marker 权威+绑定表兜底+未知 null)。设计:
// docs/notes/feature/2026-09-25-file-events-channel.zh.md。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, type FSWatcher } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, sep } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSseHub, createWorkspaceWatcher, FILES_SSE_PATH, resolveSessionForDirectory,
  wireFileEvents, type FilesBatch, type SseHub, type WireInjectCtx, type WorkspaceWatcher,
} from '../src/file-events.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'

const watchers: WorkspaceWatcher[] = []
const hubs: SseHub[] = []
afterEach(() => {
  for (const w of watchers.splice(0)) w.dispose()
  for (const h of hubs.splice(0)) h.dispose()
  vi.useRealTimers()
})

/** 写侧 burst:连续落盘(同一去抖窗内)。 */
function burst(base: string, files: readonly string[]): void {
  for (const rel of files) {
    const path = join(base, ...rel.split('/'))
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, `${rel}\n`)
  }
}

const waitBatch = async (collect: () => readonly FilesBatch[], predicate: (b: FilesBatch) => boolean): Promise<FilesBatch> => {
  return await vi.waitFor(() => {
    const hit = collect().find(predicate)
    if (hit === undefined) throw new Error('batch 未到')
    return hit
  }, { timeout: 10_000, interval: 50 })
}

/* ─────────── watcher ─────────── */

describe('createWorkspaceWatcher(真实 fs.watch)', () => {
  it('quiet 批:burst 落盘聚成一帧,POSIX 相对路径、去重、升序', async () => {
    const base = mkdtempSync(join(tmpdir(), 'fe-watch-'))
    const batches: FilesBatch[] = []
    const watcher = createWorkspaceWatcher({ baseDir: base })
    watchers.push(watcher)
    watcher.onBatch(b => { batches.push(b) })
    burst(base, ['ws-a/runtime/state.md', 'ws-a/preset/meta.json', 'ws-a/runtime/state.md'])
    const hit = await waitBatch(() => batches, b => b.paths.includes('ws-a/runtime/state.md') && b.paths.includes('ws-a/preset/meta.json'))
    // 只断"目标路径在场"(信号型通道铁律):目录条目等平台噪声事件不判形态
    expect(hit.truncated).toBe(false)
    expect(hit.paths).toContain('ws-a/preset/meta.json')
    expect(hit.paths).toContain('ws-a/runtime/state.md')
    expect(hit.paths.every(p => !p.includes('\\') && p !== '')).toBe(true)
  })

  it('CAP 50:大 burst 截断为 truncated 帧', async () => {
    const base = mkdtempSync(join(tmpdir(), 'fe-watch-'))
    const batches: FilesBatch[] = []
    const watcher = createWorkspaceWatcher({ baseDir: base })
    watchers.push(watcher)
    watcher.onBatch(b => { batches.push(b) })
    burst(base, Array.from({ length: 60 }, (_, i) => `ws-cap/preset/f${String(i).padStart(3, '0')}.json`))
    const hit = await waitBatch(() => batches, b => b.truncated)
    expect(hit.paths).toHaveLength(50)
  })
})

describe('watcher(fake factory:暗帧/错误降级/ENOENT poll-appear)', () => {
  /** 假 watch 工厂:每次调用登记一个可从测试驱动的实例(喂 raw 事件 / 触发 error / 数 close)。 */
  const buildFakeFactory = () => {
    const instances: Array<{
      raw: (event: string, filename: string | null) => void
      fail: (message: string) => void
      closed: boolean
    }> = []
    const factory = ((_dir: string, _opts: unknown, listener: (event: string, filename: string | null) => void) => {
      let errorCb: undefined | ((error: Error) => void)
      const inst = {
        closed: false,
        raw: (event: string, filename: string | null) => { listener(event, filename) },
        fail: (message: string) => { errorCb?.(new Error(message)) },
      }
      instances.push(inst)
      return { on: (_event: 'error', cb: (error: Error) => void) => { errorCb = cb; return inst } } as unknown as FSWatcher
    })
    return { instances, factory }
  }

  it('filename null(平台暗帧)→ 独立全局暗示帧 {paths: []}', async () => {
    const batches: FilesBatch[] = []
    const { instances, factory } = buildFakeFactory()
    const watcher = createWorkspaceWatcher({ baseDir: '/tavern-workspace', watchFactory: factory })
    watchers.push(watcher)
    watcher.onBatch(b => { batches.push(b) })
    instances[0]?.raw('change', null)
    const hit = await waitBatch(() => batches, b => b.paths.length === 0)
    expect(hit.truncated).toBe(false)
  })

  it('on(error)→ onError 留痕 + health(false);指数退避重开(1s→2s),防 storm;dispose 透停', async () => {
    vi.useFakeTimers()
    const errors: Error[] = []
    const health: boolean[] = []
    const { instances, factory } = buildFakeFactory()
    const watcher = createWorkspaceWatcher({ baseDir: '/tavern-workspace', watchFactory: factory, onError: e => { errors.push(e) } })
    watchers.push(watcher)
    watcher.onHealth(ok => { health.push(ok) })

    expect(instances).toHaveLength(1)
    instances[0]?.fail('EPERM')
    expect(errors).toHaveLength(1)
    expect(health).toEqual([false])   // 初始 ok 在订阅前已广播——订阅后只收翻转

    await vi.advanceTimersByTimeAsync(1_000)          // 退避 1s → 重开第二实例
    expect(instances).toHaveLength(2)
    instances[1]?.fail('EPERM')
    await vi.advanceTimersByTimeAsync(1_500)           // 退避 2s 未到 → 不重开
    expect(instances).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1_000)           // 到期 → 第三实例
    expect(instances).toHaveLength(3)

    const count = instances.length
    watcher.dispose()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(instances).toHaveLength(count)              // dispose 后不再重开
  })

  it('建连即抛 ENOENT → 退避 poll-appearing,不 pre-建目录;下次重试恢复', async () => {
    vi.useFakeTimers()
    let calls = 0
    let nextSucceeds = false
    const factory = ((_d: string, _o: unknown, listener: (e: string, f: string | null) => void) => {
      calls += 1
      if (!nextSucceeds) {
        nextSucceeds = false
        throw Object.assign(new Error('no such directory'), { code: 'ENOENT' })
      }
      return { on: () => ({ close: () => undefined }), emit: listener } as unknown as FSWatcher
    }) as never
    const errors: Error[] = []
    const health: boolean[] = []
    const watcher = createWorkspaceWatcher({ baseDir: '/tavern-workspace/absent', watchFactory: factory, onError: e => { errors.push(e) } })
    watchers.push(watcher)
    watcher.onHealth(ok => { health.push(ok) })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls).toBe(1)
    expect(errors).toHaveLength(1)
    nextSucceeds = true
    await vi.advanceTimersByTimeAsync(1_000)           // poll-appear 一拍重试
    expect(calls).toBe(2)                             // 第二次开成
    watcher.dispose()
  })
})

/* ─────────── SSE hub ─────────── */

const fakeRes = () => {
  const res = {
    written: [] as string[],
    status: 0,
    headers: undefined as undefined | Record<string, string | number>,
    ended: undefined as undefined | string,
    destroyed: false,
    writeHead: (status: number, headers?: Record<string, string | number>) => { res.status = status; res.headers = headers },
    write: (chunk: string) => {
      if (res.destroyed) throw new Error('write after destroy')
      res.written.push(chunk)
      return true
    },
    end: (body?: string) => { res.ended = body ?? '' },
    on: (event: 'close', cb: () => void) => {
      res.close = cb
      return res
    },
    destroy: () => { res.destroyed = true },
    close: undefined as undefined | (() => void),
  }
  return res
}

describe('createSseHub', () => {
  it('connect:头先于首 write + hello 首帧;res 断开自摘', () => {
    const hub = createSseHub()
    hubs.push(hub)
    const res = fakeRes()
    hub.connect(res as unknown as ServerResponse)
    expect(res.headers).toMatchObject({ 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    expect(res.written[0]).toBe(': connected\n\n')
    expect(res.written[1] ?? '').toContain('"type":"hello"')
    expect(hub.size).toBe(1)
    res.close?.()
    expect(hub.size).toBe(0)
  })

  it('broadcast:data 帧格式;write 前即 destroyed → destroy+摘除,余者不受牵连', () => {
    const hub = createSseHub()
    hubs.push(hub)
    const a = fakeRes(), b = fakeRes()
    hub.connect(a as unknown as ServerResponse)
    hub.connect(b as unknown as ServerResponse)
    hub.broadcast({ type: 'watch', ok: false })
    const line = `data: ${JSON.stringify({ type: 'watch', ok: false })}\n\n`
    expect(a.written).toContain(line)
    expect(b.written).toContain(line)
    a.destroyed = true                                     // 下一拍 write 抛 → 被丢
    hub.broadcast({ type: 'files', sessionId: null, paths: [], truncated: false })
    expect(a.destroyed).toBe(true)
    expect(hub.size).toBe(1)
    expect(b.written).toContain(`data: ${JSON.stringify({ type: 'files', sessionId: null, paths: [], truncated: false })}\n\n`)
  })

  it('keepalive:15s 注释帧乘全部连接', () => {
    vi.useFakeTimers()
    const hub = createSseHub()
    hubs.push(hub)
    const res = fakeRes()
    hub.connect(res as unknown as ServerResponse)
    vi.advanceTimersByTime(15_000)
    expect(res.written.filter(c => c === ': ka\n\n')).toHaveLength(1)
  })

  it('dispose:destroy 全部连接并清空', () => {
    const hub = createSseHub()
    const res = fakeRes()
    hub.connect(res as unknown as ServerResponse)
    hub.dispose()
    expect(res.destroyed).toBe(true)
    expect(hub.size).toBe(0)
  })
})

/* ─────────── wire ─────────── */

const buildWireRig = () => {
  const routeDisposers: boolean[] = []
  const board = {
    injectedKeys: undefined as readonly string[] | undefined,
    teardown: undefined as undefined | (() => void),
    route: undefined as undefined | { kind: string; path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void },
    lastRejection: undefined as undefined | number,
  }
  const serverRegister = (route: { kind: string; path: string; handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void }) => {
    board.route = route
    return () => { routeDisposers.push(true) }
  }
  const wireCtx: WireInjectCtx = {
    inject(keys, callback) {
      board.injectedKeys = keys
      callback({
        effect: (setup: () => () => void) => { board.teardown = setup(); return () => { board.teardown?.() } },
        webServer: { register: serverRegister },
        connection: { requestRejection: () => board.lastRejection },
      })
    },
  }
  const connectClient = () => {
    const res = fakeRes()
    board.route?.handler({ method: 'GET' } as unknown as IncomingMessage, res as unknown as ServerResponse)
    return res
  }
  return { board, wireCtx, connectClient, routeDisposers }
}

describe('wireFileEvents(假 ctx 注入)', () => {
  const watchStubFactory = () => {
    let listener: undefined | ((event: string, filename: string | null) => void)
    let errorCb: undefined | ((error: Error) => void)
    const watcher = {
      closed: false,
      raw: (event: string, filename: string | null) => { listener?.(event, filename) },
      fail: (message: string) => { errorCb?.(new Error(message)) },
    }
    const factory = ((_d: string, _o: unknown, cb: (event: string, filename: string | null) => void) => {
      listener = cb
      return { on: (_event: 'error', cb2: (error: Error) => void) => { errorCb = cb2; return watcher } } as unknown as FSWatcher
    })
    return { watcher, factory }
  }

  it('注入表动态域声明;路由注册于 /tavern/events(exact);鉴权/方法面自担;disposer 撤路由', () => {
    const { board, wireCtx, connectClient, routeDisposers } = buildWireRig()
    const { factory } = watchStubFactory()
    wireFileEvents({
      ctx: wireCtx, baseDir: () => '/tavern-workspace', resolveSession: () => null,
      logger: { warn: () => undefined }, watchFactory: factory as never,
    })
    expect(board.injectedKeys).toEqual(['connection', 'webServer'])
    expect(board.route?.kind).toBe('exact')
    expect(board.route?.path).toBe(FILES_SSE_PATH)

    // 鉴权(401/403 学习于 api-gateway /api/remote.mux 先例)+ 方法面(405)
    board.lastRejection = 401
    const res401 = fakeRes()
    board.route?.handler({ method: 'GET' } as unknown as IncomingMessage, res401 as unknown as ServerResponse)
    expect(res401.status).toBe(401)
    expect(res401.ended).toBe('unauthorized')
    board.lastRejection = 403
    const res403 = fakeRes()
    board.route?.handler({ method: 'GET' } as unknown as IncomingMessage, res403 as unknown as ServerResponse)
    expect(res403.status).toBe(403)
    expect(res403.ended).toBe('forbidden')
    board.lastRejection = undefined
    const res405 = fakeRes()
    board.route?.handler({ method: 'POST' } as unknown as IncomingMessage, res405 as unknown as ServerResponse)
    expect(res405.status).toBe(405)
    const resOK = connectClient()
    expect(resOK.status).toBe(200)
    expect(resOK.written[0]).toBe(': connected\n\n')

    board.teardown?.()
    expect(routeDisposers).toHaveLength(1)
  })

  it('批帧:ws- 首段分组 + emit 时刻反查;平台分隔符归一化;null filename → 全局暗示帧', async () => {
    const { wireCtx, connectClient } = buildWireRig()
    const { watcher, factory } = watchStubFactory()
    wireFileEvents({
      ctx: wireCtx, baseDir: () => '/tavern-workspace',
      resolveSession: dir => (dir === 'ws-a' ? 'session-x' : null),
      logger: { warn: () => undefined }, watchFactory: factory as never,
    })
    const client = connectClient()
    watcher.raw('change', `ws-a${sep}runtime${sep}state.md`)
    watcher.raw('change', `ws-a${sep}preset${sep}meta.json`)
    await vi.waitFor(() => {
      const files = client.written.filter(w => w.includes('"type":"files"') && w.includes('session-x'))
      if (files.length === 0) throw new Error('files 帧未到')
      return files
    }, { timeout: 10_000, interval: 50 })
    const frame = client.written.filter(w => w.includes('"type":"files"') && w.includes('session-x')).at(-1) ?? ''
    expect(frame).toContain('"sessionId":"session-x"')
    expect(frame).toContain('ws-a/preset/meta.json')

    watcher.raw('change', null)
    await vi.waitFor(() => {
      if (!client.written.some(w => w.includes('"type":"files"') && w.includes('"sessionId":null') && w.includes('"paths":[]')))
        throw new Error('全局暗示帧未到')
      return true
    }, { timeout: 10_000, interval: 50 })
  })

  it('健康帧:watcher 错误 → {ok:false};退避重开成功 → {ok:true}', async () => {
    vi.useFakeTimers()
    const { wireCtx, connectClient } = buildWireRig()
    const { watcher, factory } = watchStubFactory()
    wireFileEvents({
      ctx: wireCtx, baseDir: () => '/tavern-workspace', resolveSession: () => null,
      logger: { warn: () => undefined }, watchFactory: factory as never,
    })
    const client = connectClient()
    await vi.advanceTimersByTimeAsync(0)
    watcher.fail('EPERM')
    await vi.advanceTimersByTimeAsync(1_000)   // 退避重开(factory 同款 → ok:true)
    const watches = client.written.filter(w => w.includes('"type":"watch"'))
    expect(watches.some(w => w.includes('"ok":false'))).toBe(true)
    expect(watches.some(w => w.includes('"ok":true'))).toBe(true)
  })
})

/* ─────────── 反查 ─────────── */

describe('resolveSessionForDirectory', () => {
  const readMarker = (root: string, file: string): string | null => {
    try {
      const text = readFileSync(join(root, file), 'utf8').trim()
      return text === '' ? null : text
    } catch { return null }
  }

  it('marker 权威;缺席时绑定表反演兜底;双缺 → null', () => {
    const base = mkdtempSync(join(tmpdir(), 'fe-resolve-'))
    try {
      const dir = join(base, 'ws-1')
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, '.tavern-session'), 'session-mark\n')
      const bound: Array<readonly [string, string]> = [['session-live', join(base, 'ws-2')]]
      expect(resolveSessionForDirectory(dir, { readMarker, sessionFile: '.tavern-session', bound })).toBe('session-mark')
      expect(resolveSessionForDirectory(join(base, 'ws-2'), { readMarker, sessionFile: '.tavern-session', bound })).toBe('session-live')
      expect(resolveSessionForDirectory(join(base, 'ws-3'), { readMarker, sessionFile: '.tavern-session', bound })).toBeNull()
    } finally {
      rmSync(base, { recursive: true, force: true })
    }
  })
})
