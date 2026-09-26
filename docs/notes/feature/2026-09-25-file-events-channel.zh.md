# 文件变更通知通道:fs.watch → SSE → mount face `files`(纯加法信号通道)

状态:**已实施**(2026-09-25 通宵批,真机冒烟通过) | 日期:2026-09-25 | 关联:[[2026-09-24-tavern-opening-surface-contract]]、[[2026-09-22-furina-galgame-card]]、[[2026-09-25-cards-zero-poll-migration]](第二阶段:逐卡拆迁定时器,零轮询)、`docs/cards/card-presentation.zh.md`、`docs/notes/devlog.zh.md`(2026-09-20 轮询治理)

> **落地记录(2026-09-25)**:七笔提交——`1cb80a1` engine 模块(13 测)/`a4ca574` 接线(loader-composition 零改动活体回归)/`d8fd475` ui 单例(7 测)/`149aeb2` card-ui files face/`08be87a`+`509d1d5`+`2487181` 三卡消费。
> **真机冒烟(dev host 3081,--no-open)**:`text/event-stream` 头/`connected`+hello 帧/member写盘→files 帧 ~300ms(sessionId 反查带 `.tavern-session` 真身)/15s `: ka` 保活;无 cookie→401、POST→405(requestRejection 自担鉴权逐字生效)。全套 404 测试绿(截至此批 385+)。

> **落地裁定 1(2026-09-25,用户拍板)**:监听层用 **Node 内置 `fs.watch(recursive)`**,不引入第三方包(chokidar/@parcel/watcher)。engines 已钉死 `node ^22.19.0 || >=24`,递归 watch 三平台(macOS/Windows/Linux)原生可用;平台语义差异由"信号型通道"设计吸收(见 §0)。
>
> **落地裁定 2(2026-09-25,用户拍板)**:先出设计文档,不开工实施。本文即实施蓝图,批内每步全绿。
>
> **语义铁律**:事件只是**信号**,rev 仍是**真身**——通道只回答"何时拉",rev 门照旧回答"拉不拉、重绘不重绘"。任何一步失效都退化为特征前的盲轮询。
>
> **节拍约束**:现有轮询(芙宁娜 900ms / dnd5e 每面板 2s / 编辑器双档)一律不动;本阶段只加"事件→立即拉"。节拍调优(放宽兜底周期)留真机验证后另批。

## 图解(30 秒版)

### ① 原理:一条单向信号管道

```
  写文件的人(全在服务端)
  模型工具改血量│尾代理记账│writer建卡│手工git
        │
        ▼
┌────────── engine(宿主进程)──────────┐
│ fs.watch(recursive)                 │
│   盯 tavern_workspace/ 全树          │
│        │ 300ms 去抖聚成一帧           │
│        ▼                            │
│  SSE 路由 /tavern/events ─────┐     │  ← 只推一句话:
└──────────────────────────────┼─────┘     "session-X 的这些文件动了"
                               │
                               ▼
┌──────────── 浏览器 ─────────────────┐
│ EventSource 单例(只留本会话的帧)    │
│        ▼                            │
│ tavern.files.subscribe → 卡的收件箱 │
│        ▼                            │
│  卡立刻拉一次:[文件变了?]→ 变了才重绘 │  ← 原有的 rev 门,原样保留
└─────────────────────────────────────┘
```

### ② 业务逻辑:从"定时问"到"变动喊"

```
现状(盲轮询)                      改后(事件 + 兜底)
─────────────────                 ─────────────────
卡 ──每900ms──▶ 跑脚本读盘          文件一落盘 ──▶ 卡立即拉一次
   "变了吗?" → 99%没变,白跑          (即时性:300ms级,不再等下个整拍)
                                   慢兜底轮询仍在(防事件丢失)
                                   本阶段节拍不动,验证后再放宽
```

### ③ 一轮真实业务的走线

```
玩家发消息 → 模型调 attack.mjs 改 hp ─┐
         → 尾代理写 state.md ────────┤ fs.watch 全收到
         → 回合落盘 .chat.snapshot ──┘
                    │ 聚成 {"sessionId":"session-x","paths":["ws-…/runtime/state.md",…]}
                    ▼
        SSE 一帧 → 卡 kick() → 跑一次 ui_data → rev 变了 → HUD 重绘
```

### ④ 高频写盘的泄洪(会不会卡?——不会,六道阀)

```
极端:writer 全速编辑,100 次文件写/秒
  → fs.watch 事件流      内核级合并 + 进程内回调,CPU 忽略不计
  → 300ms 去抖窗  ①      帧率数学上限 ≈ 3.3 帧/秒/会话(1000 写/秒也压不破)
  → CAP 50 + truncated②  单帧体积有界;卡不解析 paths,只是"去拉"暗示
  → 错误退避 1s→30s ③    EPERM/ENOSPC 风暴不空转
  → kickWanted 合并 ④    beat 在途时 N 个 kick 塌缩成 1 个补拍——拉取恒串行,不排队
  → rev 门 ⑤            数据没变的补拍直接赔,不重绘
  → sessionId 过滤 ⑥    writer 会话的帧到不了游戏会话的卡(单例层丢弃)
```

对照:改动后极端高峰 = 3.3 批/秒 × 每批 2 槽 spawn(毫秒级、串行);现状 = **不管有无变化,24h 恒定 1~2 spawn/秒**。高峰有界、静态归零。

护栏一句话:**watcher 当门铃,rev 门当保安**——门铃坏了大不了勤查几次,保安没换过;事件只报"何时",不报内容,丢帧/错帧最多晚一拍,不会错数据。

## 0. 一句话结论

把"文件面无事件源、前端盲轮询"根治为一条**纯加法**的信号通道:engine 用 `fs.watch` 递归监听工作区根 → 300ms 去抖聚合 → 宿主 webserver 的 SSE 路由 `/tavern/events` 推给浏览器 → `packages/ui` EventSource 单例按会话过滤 → mount face 新订阅面 `tavern.files.subscribe`(与 `opening`/`assistantLive` 同型)→ 卡收到事件立即触发既有的 rev 门取数。内核零改动、tavern RPC wire(33 个 @Remote)零触碰、旧卡零迁移。

## 1. 背景:为什么是这条通道

前期全量 review 的结论(证据链:`docs/cards/card-presentation.zh.md`"无独立事件通道——setInterval+runScript 对文件 diff 即事件";devlog 2026-09-20"文件系统无变更推送通道……编辑器只能盲轮询兜底"):

1. **缺的是事件源,不是传输能力**。内核给宿主-浏览器备了三条轨——`/api/remote.mux` WebSocket 流 Remote(`@Remote({mode:'stream'})`)、`$events` 转发事件流(allowlist)、`/plugins/events` SSE(HMR 专用)——chat 流式、回合落定、尾代理解锁、session 列表**全部已是推送**。没有任何事件反映"preset runtime 文件变了"(模型工具、尾代理、writer、hooks 全走 bash/脚本直写盘)。
2. **tavern wire 冻结**(2026-09-20 裁定:typert client 生成器未随仓 vendor)——不能给 tavern 命名空间加流式方法自建推送。
3. 于是每层各自起 interval:卡数据泵(芙宁娜 900ms `gal_data`、dnd5e 每面板 2s `ui_data` 全量)、宿主编辑器双档(2s/8s)、meta 身份轮询、维护 chip 2s。单看每个都小,叠起来就是"这么多轮询"。

通道选型的论据(略述):`@Remote({mode:'stream'})` 骑 WS mux 最"正统"但撞 wire 冻结且客户端面要手写生成器产物;`ctx.webServer.register` 的 SSE 路由有**仓内双先例**(内核 `dsh-client-hmr` 注册 `/plugins/events`;内核 `dsh-api-gateway` 在协议 `/api/remote.mux` 升级路由手跑 `requestRejection`),是插件公开 API,不是内核内部——符合 CLAUDE.md"项目代码里写适配,不改依赖本体"。SSE 对比 upgrade(WebSocket):单向推送用不上双向,EventSource 自带重连与 `last-event-id` 语义,零心跳机械件。

事件源顺带覆盖了此前所有"无事件面":回合**中途**模型调工具改 hp(写盘)、writer 建卡直写、git/手工编辑——一个 watcher 全收。

## 2. 架构与帧格式

```
tavern_workspace/  ──fs.watch(recursive)──▶  engine watcher(300ms 去抖聚合;error 指数退避重启)
                                                    │  按 ws- 首段分组,emit 时刻反查 sessionId
                                                    ▼
                                     SSE hub @ GET /tavern/events(ctx.inject 子域注册)
                                                    │  data 帧
                                                    ▼
                            packages/ui/src/client/file-events.ts(EventSource 单例,按 sessionId 投递)
                                                    │
                                                    ▼
                            mount face tavern.files.subscribe(hint)   ← assistantLive 同型纯加法
                                                    │
                        卡:dnd5e kick()│芙宁娜 poll()│dnd refresh()  ← 既有 rev 门立即拉
```

帧格式(SSE 文本):

```
: connected\n\n
data: {"type":"hello"}\n\n                                 ← 连接即发;ui 单例以「第二次 hello」判重连
data: {"type":"files","sessionId":"session-…","paths":["ws-20260924-224432-833-1/runtime/state.md",…],"truncated":false}\n\n
: ka\n\n                                                   ← 每 15s 注释帧:防腐 + 半死连接探测
```

- `paths`:相对 workspaceBase(含 ws- 目录段)、组内升序去重、上限 50、超量 `truncated:true`。
- 未知会话(删会话进行中/孤儿目录):`sessionId:null` 照带 paths(ui 丢弃);平台 `filename null` 暗帧 → 独立一帧 `paths:[]` 全局 resync 暗示。
- 一帧 = 一个会话 × 一个去抖窗;写卡 agent 一轮十几个文件的 burst 落进同一帧。

## 3. engine 侧设计

### 3.1 新文件 `packages/engine/src/file-events.ts`(纯 Node,无宿主依赖)

三段独立导出、回调组合,互不触 cordis 内部;`watchFactory` 可注入(测试替身入口,缺省 `node:fs` 的 `watch`):

```ts
export const FILES_SSE_PATH = '/tavern/events'    // hmr 用 /plugins/events,无碰撞(grep 已核)
export const FILES_DEBOUNCE_MS = 300              // quiet 感知窗,逐事件重臂;真机可调
export const FILES_FLUSH_MAX_MS = 1_000           // 最大窗:burst 持续写也按时 flush,防半写/无限延迟
export const FILES_KEEPALIVE_MS = 15_000
export const FILES_PATHS_CAP = 50

export interface WorkspaceWatcher {
  onBatch(listener: (batch: { paths: readonly string[]; truncated: boolean }) => void): () => void
  dispose(): void
}
export function createWorkspaceWatcher(deps: {
  baseDir: string; debounceMs?: number; watchFactory?: typeof watch; onError?: (e: Error) => void
}): WorkspaceWatcher

export function createSseHub(): {
  connect(res: ServerResponse): void; broadcast(frame: FilesFrame): void; dispose(): void
}

export function wireFileEvents(deps: {
  ctx: Context
  baseDir: () => string
  resolveSession: (dirName: string) => string | null
  logger: { warn(message: unknown): void }
  watchFactory?: typeof watch
}): void
```

**watcher 行为**(事件只是信号 → 每条设计都允许"不精确但不出错"):

```text
tryOpen():  watcher = watchFactory(baseDir, { recursive: true }, onRaw)
            ENOENT → 不预建目录(保持 engine boot 扫描的 existsSync 语义),退避 poll-appear 重试
watcher.on('error'):  onError(err) 留痕 → close → 指数退避(1s→2s→…cap 30s)重开;
                      EPERM(Windows AV/同步盘)/ENOSPC(Linux inotify 逾限)同路;首个成功事件即退避归零
onRaw(eventType, filename):
            filename 可能为 null(平台语义)→ 记 hintUnknown,不猜路径
            rel = POSIX 相对路径;收集进 pending 集
            重臂去抖窗:清旧臂 → setTimeout(flush, 300ms);若距批首事件已超 1000ms(FILES_FLUSH_MAX_MS)
            则不再重臂(最大窗已到,此拍按时 flush)—— 逐事件重臂保证"quiet 才拉"(不读半写文件),
            最大窗保证持续写盘时也有及时性,二者兼得
flush():    排序 → 截断 CAP → 广播批;hintUnknown 时追加独立一帧 {paths:[]}(全局暗示)
dispose():  清全部定时器(去抖/退避/poll-appear)→ watcher.close() → listeners.clear()
所有 timer unref():测试与进程退出不挂事件环
```

**hub 行为**(逐字对齐内核先例 `dsh-client-hmr/lib/index.js:111-158` 模板):

```text
connect(res):  先 writeHead(200, {'content-type':'text/event-stream','cache-control':'no-cache',
              'connection':'keep-alive'}) 再首次 write          ← 顺序是硬约束:repo 开了 gzip,
                                                                dsh-host-webserver/lib/index.js:110-114
                                                                以 content-type 豁免 转义 事件流;头晚于首写则被 zlib 包住
              → write(': connected\n\n') → write(hello 帧) → connections.add(res)
              → res.on('close', () => connections.delete(res))
broadcast(frame):  对 [...connections] 逐个 res.write(data 帧);write 抛错 → res.destroy() + 摘除
keepalive(15s, unref):  每 res.write(': ka\n\n')——失败即 destroy,兼测半死套接字
dispose():  清 keepalive → destroy 全部连接 → clear
```

**wireFileEvents**(对齐 `@deepseek-ai/dsh-api-gateway/lib/index.js:457-484` 的 `ctx.inject` 先例):

```text
ctx.inject(['connection', 'webServer'], (webCtx) => {
  webCtx.effect(() => {
    const hub = createSseHub()
    const watcher = createWorkspaceWatcher({ baseDir: baseDir(), onError: …logger.warn, watchFactory })
    const unsub = watcher.onBatch((batch) => {
      // 按 ws- 首段分组;组内 emit 时刻解析一次 sessionId(反查见 §3.2)
      for (const [dir, paths] of groupByTopSegment(batch.paths))
        hub.broadcast({ type: 'files', sessionId: resolveSession(dir), paths, truncated: batch.truncated })
      if (batch.paths.length === 0) hub.broadcast({ type: 'files', sessionId: null, paths: [], truncated: false })
    })
    const disposeRoute = webCtx.webServer.register({ kind: 'exact', path: FILES_SSE_PATH, handler: (req, res) => {
      const rejection = webCtx.connection.requestRejection(req)          // 公开方法;register 的路由无全局栏,鉴权自担(api-gateway 同款)
      if (rejection !== undefined) { res.writeHead(rejection); res.end(rejection === 401 ? 'unauthorized' : 'forbidden'); return }
      if (req.method !== 'GET') { res.writeHead(405); res.end(); return }
      hub.connect(res)                                                  // 立即返回——webServer 会 await handler,SSE 不得滞留 Promise
    } })
    return () => { unsub(); disposeRoute(); watcher.dispose(); hub.dispose() }   // hmr 四步回收序:先断源→撤路由→拆两端
  }, 'tavern: /tavern/events 文件事件通道')
})
```

EventSource 可过栏:cookie `Path=/; HttpOnly; SameSite=Strict`(同源自动附带),requestRejection 只读 Host/可选 Origin/cookie,不要求自定义 header(api-gateway upgrade 逐帧同栏已内核实证)。

### 3.2 `packages/engine/src/index.ts` 最小接线(本设计唯一的现行为改动,约 20 行)

- `static inject` 六服务**不动**(`connection`/`webServer` 走动态注入,不进静态表)。
- constructor `restoreBindings()`(:325)之后:

```ts
wireFileEvents({
  ctx: this.ctx,
  baseDir: () => this.workspaceBase,                       // getter :356-359
  resolveSession: dir => this.sessionIdOfDir(join(this.workspaceBase, dir)),
  logger: this.ctx.logger,
})
```

新增私有反查(**emit 时刻**解析、marker 权威、活表兜底、无缓存——每窗每目录一次 stat,成本远小于写盘本身):

```ts
private sessionIdOfDir(root: string): string | null {
  const byMarker = readPersistedMarker(root, SESSION_ID_FILE)      // 盘上真身;load() 换绑先落标记(:1148)后解旧绑(:1156)
  if (byMarker !== null) return byMarker
  for (const [sessionId, bound] of this.workspaces)                 // 进程内活表兜底(:289-290)
    if (resolve(bound) === resolve(root)) return sessionId
  return null                                                      // 删会话进行中/孤儿目录 → 未知帧
}
```

反查放 emit 时(去抖窗收敛)而非 watch 事件时刻的理由:①换绑半态(≪300ms)基本已出窗,marker-first 对半态两侧给一致答案;②批内一次 IO,而非每事件一次。

### 3.3 挂载安全(已亲验 cordis 4.0.2 源码)

`ctx.inject` 缺服务时子纤维停 **PENDING 稳态**(`node_modules/@deepseek-ai/cordis/src/fiber.ts` 构造期 `_checkImpl` + `_refresh`,约 :310-318),`fiber.await()`/`loader.await()` 立即 settle(`fiber.ts:704-710` 等 inertia,无挂起)。推论:**loader-composition 测试(唯一构造 TavernRuntime 的 spec,其 compose 无 webServer/connection)零改动**——全体既有组合规格照跑即"缺服务不挂死"的活体回归;引擎自身生命周期仍全靠 fiber 回收(engine 现零 ctx.effect、零自定义 dispose,保持)。

## 4. ui 侧设计

### 4.1 新文件 `packages/ui/src/client/file-events.ts`(React 树外单例,`pending-session.ts`/`themes.ts` 形态)

```ts
export interface FilesHint { readonly paths: readonly string[] }   // 空数组=纯 resync 暗示
export function subscribeFileEvents(sessionId: string, listener: (hint: FilesHint) => void): () => void
```

行为:

- 懒建 `new EventSource('/tavern/events')`;`typeof EventSource === 'undefined'`(jsdom)→ no-op:订阅照常、事件永不来、卡轮询兜底。jsdom 测试直导不受牵连(card-ui.ts 保持零模块态、零网络副作用)。
- **投递四规则**(本层过滤,face 不带过滤):
  1. `frame.sessionId === 订阅键` → 送达(带 paths);
  2. hello **第二次**(EventSource 断线自动重连后服务端重发 hello)→ 全订户重放 `{paths:[]}`(冷启首 hello 不重放——卡正 boot,避免与 bootPoll 竞态);
  3. `sessionId:null 且 paths 空`(全局暗示)→ 全体 resync;
  4. `sessionId:null 且带真实 paths` / 其他会话 → 丢弃(删会话残影,本端无卡关心)。
- 订户归零 → `source.close()`(零空转);换绑即换键重订阅。

### 4.2 `packages/ui/src/client/card-ui.ts`(face 纯加法,五处接线点)

```ts
export interface TavernFilesFace { subscribe(listener: (hint: FilesHint) => void): () => void }
// 事件型面:无 getter 无当前值;FilesHint 定义在 file-events.ts、card-ui import type(避免反向依赖)
```

1. 类型区(:60-102 assistantLive 同列)加 `TavernFilesFace`;
2. face 实现区(:318-343 紧后):`fileListeners` Set + `files` 对象(纯事件,无快照无 diff);
3. mount face 字面量(:351-379,与 :372 assistantLive 相邻)注入 `files`,注释风格同步:"文件变更信号:宿主把工作区 fs 事件推进来,卡订阅即换立即拉取;旧卡不订阅零影响(纯加法)";
4. `CardUiHandle`(:86-102)加 `files` 字段 + `feedFileEvents(hint)`(`feedAssistantLive` :334-338 同型:广播副本);
5. `dispose`(:392-400)加 `fileListeners.clear()`(第五个 clear)。

### 4.3 `packages/ui/src/client/app/TavernApp.tsx`(喂数 effect)

cardUi effect(:993-1007,deps `[rpc, sessionId]`)旁新增,依赖一致:

```ts
useEffect(() => {
  const unsub = subscribeFileEvents(sessionId, hint => { cardUiRef.current?.feedFileEvents(hint) })
  return unsub
}, [sessionId])     // cardUiRef 房式(:989-992):喂点与加载时序无关;换绑自动换键
```

选 effect+feed 而非 extras 注入:files 是 host→卡信号,与 `setOpeningActive`/`feedAssistantLive` 完全同向;`extras.stop` 是卡→宿主输入面(反向),把事件源伪装成输入面是粒径错位。sessionId 过滤放单例层:订阅天然 keyed,换绑即重订阅;单例层是唯一同时见到 wire 帧与本端订阅表的地方,过滤规则集中一处便于 jsdom 钉死。

## 5. dnd5e vendored runtime:`kick()` 无竞态状态机

现有泵(`tavern_presets/dnd5e/preset/ui/runtime.mjs` :119-135):`loop()` 起 beat,finally 重臂 `setTimeout(loop, hidden?10s:2s)`。kick 的两个必然踩点:①beat 在途时另起 beat → 每面板双 spawn(rev 门只挡重绘不挡拉);②kick 自己重臂而 finally 也重臂 → 双 timer。解法:唯一状态机入口 + 重入闸(只动 :119-135 一段,`:180 loop()` 改调 runBeat,handle :189-202 增 kick;tickPanel/paint/rev 门/refreshOnce/act 委托全部不动):

```javascript
let timer
let beating = false        // 一个 beat 在途
let kickWanted = false     // 在途期间落下的 kick(合并为 1 次尾随补拍)

const schedule = (delay) => {                    // 唯一定臂点:先清后定,天然消重
  if (timer !== undefined) clearTimeout(timer)
  timer = setTimeout(runBeat, delay)
}
const runBeat = () => {                         // 原 loop + 重入闸
  if (disposed || stopped() || beating) return
  beating = true
  void Promise.resolve()
    .then(async () => { for (const panel of deps.panels) { if (stopped()) return; try { await tickPanel(panel) } catch {} } })
    .finally(() => {
      beating = false
      if (disposed || stopped()) return
      if (kickWanted) { kickWanted = false; schedule(0) }              // 在途 kick → 收尾立即补一拍
      else schedule(doc.hidden ? PERIOD_HIDDEN : PERIOD_VISIBLE)      // 降频采样逻辑原样保留
    })
}
const kick = () => {
  if (disposed || stopped()) return
  if (beating) { kickWanted = true; return }    // 合并:绝不并行起 beat
  schedule(0)                                   // 未在途:清掉挂起臂,0ms 即拉
}
```

不变量:无双 timer(schedule 先清后定;kick 从不自行定臂);无双 beat(`beating` 闸;kick 从不自行 spawn);kick 不动 refreshOnce/rev 门——提前的是"拉"的时刻,不破"重绘"的判据(rev 未变照常跳过重绘);补拍内 kickWanted 可再次置位(每次置位对应一次真实文件变化);doc.hidden 下 kick 照常生效(后台一次 beat 成本无害)。

## 6. 三张卡接线(三行模板 + 收进既有清理;optional chaining 全兼容旧形态)

```js
const unsubFiles = tavern.files?.subscribe?.(() => { /* 即拉 */ })
if (typeof unsubFiles === 'function') add(unsubFiles)
```

1. **dnd5e**(`ui/index.js` mountPanels 块 :16-24 之后):回调 `panelsHandle?.kick?.()`——第一重可选链接兜旧 host 无 face,第二重兜旧 vendored runtime 拷贝无 kick。
2. **芙宁娜**(`ui/index.js` bootPoll 成功块,pollTimer 起臂 :557-558 之后):回调 `void poll()`。**不得提前到 :513-521 启动侧**——boot 完成前触发 poll() 会与 bootPoll 的 applyTurn/mode 决策双驱动竞态( poll 依赖 boot 建立的 rev 水位/mode 基线);落在 pollTimer 起臂点后语义恰为"立即再跑一次已就绪的 poll()"。boot 窗口内的事件被丢(下次 900ms 定时拍回收——延迟,非正确性风险)。poll() 无在途闸与现状 setInterval 重叠同级容忍(rev/seq 幂等);极端事件密度(300ms 间拉不完整批)下可能两拍交错多花一次 spawn——**浪费而非错误**,真机若观察到,加一行 in-flight 旗即可(加固项,非本批必做)。
3. **dnd 老卡**(`ui/index.js` start() 内 refresh 建立后):回调 `void refresh()`;此卡清理不走 add 而走 stop 闭包(:169)——sub 摘除收进同处。refresh 两拍幂等(手簿非状态机,data+paint),交错由后写胜出。

## 7. 测试设计(全部沿用现有 harness 模式)

1. **engine** `packages/engine/tests/file-events.spec.ts`(Node 环境,mkdtemp 真目录 + 真 fs.watch;`tools.spec.ts` 手搓风格):
   - watcher:写文件 → `vi.waitFor({ timeout: 10_000, interval: 50 })` 断言**至少一帧**含目标路径前缀——断言存在、不断言批数/形态(Windows rename 双事件、macOS FSEvents 秒级延迟、编辑器原子写多事件,三平台语义天然不齐);cap 截断用例;注入恒 error/恒 ENOENT 的 watchFactory → 退避无 storm、dispose 可终止。
   - hub:fake res(writeHead/write/on/close/destroy)——connect 头与顺序(writeHead 先于首 write)、hello 首帧、broadcast 帧格式 `data: …\n\n`、write 抛错 destroy+摘除、dispose 全销毁。
   - wireFileEvents:fake ctx(`inject(keys,cb)` 测试侧手动执行一次)+ fake webCtx —— 路由恰注册一次、405/401/403 三拒绝面、四步回收序。**不走 Loader。**
2. **loader-composition:零改动**(§3.3 已论证;组内无 webServer/connection 时 inject 回调沉睡即活体回归)。
3. **ui face** `card-ui.client.spec.ts` 扩展:files 订阅纪律复刻 :129-157 模板(双订户/逐个摘/dispose 清);mount face 携 files(:159-185 globalThis 捕获同型)。
4. **ui 单例** `file-events.client.spec.ts`(jsdom):①无 EventSource → no-op 钉(订阅/退订不抛、恒无事件);②`vi.stubGlobal('EventSource', FakeES)`——构造 URL、files 帧按 sessionId 过滤、第二次 hello 全体 resync、订户归零 close()。
5. **dnd5e kick** `dnd5e-panel-runtime.client.spec.ts` 扩展(fake timers,rig 不 advance 2000ms):立拉(kick → advance(0) → calls +panels.length);**在途合并**(callScript 换 Deferred:在途 kick×2 → calls 不变 → resolve → advance(0) → 恰 +panels.length 而非 ×2);无叠臂(kick 收拍后每 2000ms advance 恰 1 beat)。
6. **芙宁娜** `galgame-files.client.spec.ts`(jsdom,直导卡 index.js——dnd5e spec 直导 vendored 件先例):fake tavern(runScript 制式 gal_data payload、views 桩、files 受控 stub);fake timers 走完 waitHost(200ms)+ bootPoll(350ms)后 fire listener → runScript panel 调用 +1(**未 advance 900ms**);反向钉:boot 成功前 fire → 调用不增;unmount → unsub 被调。

## 8. 风险清单(下限语义:任何一步失效 = 回到特征前盲轮询)

| # | 风险 | 缓解 |
|---|---|---|
| R1 | engine 接线挂死组合测试 | static inject 不动;ctx.inject 动态域(PENDING 不挂 await,§3.3 亲验);超时即回滚定位 effect 泄露 |
| R2 | Windows fs.watch 语义差(rename 双事件/filename null/迟到 sporadic) | 信号型通道;去抖聚批;测试只断言存在;error → 指数退避重启 |
| R3 | SSE 过 gzip(minify 不相干,风险本体是缓冲) | webserver 已显式豁免 text/event-stream(源码引证);头必须在首写前(对齐 hmr 模板;若此约束失效,hmr 先挂,共享告警面) |
| R4 | 代理缓冲/直连 | 生产直连 127.0.0.1:3081;exact route 由 handler 直持 res;15s keepalive 注释帧防腐 |
| R5 | CSP 拒 EventSource | webserver 无 header/CSP 中间层(已核源);同源无跨源面 |
| R6 | jsdom 无 EventSource | 单例 no-op 守卫;卡 optional chaining;轮询兜底恒在 |
| R7 | 旧 host 无 face / 旧 runtime 无 kick | `tavern.files?.subscribe?.` + `panelsHandle?.kick?.` 全覆盖 |
| R8 | 芙宁娜 boot 竟态 | 订阅点在 :557 起臂后;正反向双测试钉(§7.6) |
| R9 | 泵双拍/双 spawn | schedule 先清后定 + beating 闸 + kickWanted 合并;三用例钉死(§7.5) |
| R10 | 换绑/删会话帧错配 | emit 时刻 marker-first 反查;解绑后旧帧 sessionId=null;ui 规则 4 丢弃 |
| R11 | 事件风暴(写卡 agent 大批写盘) | 六道泄洪阀(全解见图解④):帧率上限 3.3/秒/会话、帧体截断、错误退避、kick 串行合并、rev 门赔拍、sessionId 过滤 |
| R12 | 半死连接积压 | keepalive write 失败即 destroy;hub 随路由 fiber;单例订户归零关流 |
| R13 | 路由 duplicate 抛错 | `/tavern/events` 无占用方(hmr=`/plugins/events` 已核);路径收敛常量 |
| R14 | 网络盘/sync 盘事件不可靠 | 事件只是信号+轮询兜底,失效即现状;文档记录在案(本条) |

## 9. 分阶段实施建议(开工时照此;每步全绿)

| # | 内容 | 性质 |
|---|---|---|
| 1 | `engine/src/file-events.ts` + engine 单测 | 纯新增不接线,engine 全绿 |
| 2 | `engine/src/index.ts` 接线(wire 调用 + sessionIdOfDir) | 唯一现行为改动;loader-composition 不动照绿 |
| 3 | `ui/src/client/file-events.ts` + 单例测试 | 纯新增,ui 全绿 |
| 4 | `card-ui.ts` face + `TavernApp.tsx` 喂数 effect + face 测试 | face 纯加法;jsdom 走 no-op |
| 5 | dnd5e `runtime.mjs` kick + 三用例 | 只动泵循环段 + handle |
| 6 | 三张卡接线(可细拆 3 commits)+ galgame spec | 三行模板各一次 |
| 7 | 真机验证:`pnpm tavern` 起 dev host(3081,`--no-open`),CDP 观察;`curl -N /tavern/events` 挂流,向活动会话写一文件 → 300ms 级收到帧、面板即时重拉;节拍调优**本批不做** | 观察批 |

顺序理由:可单测件(1/3)先独立落地;2 是唯一全局影响接线,在测试就绪后动;face(4)先于卡消费(5/6);kick(5)先于 dnd5e 接线(6)。

## 附录:内核先例出处(实施时可照抄)

- SSE 路由模板(连接/keepalive/dispose):`node_modules/@deepseek-ai/dsh-client-hmr/lib/index.js:111-158`
- `ctx.inject(['connection','webServer'])` 动态域 + `requestRejection` 自担鉴权:`node_modules/@deepseek-ai/dsh-api-gateway/lib/index.js:457-484`
- gzip 对 `text/event-stream` 的豁免:`node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js:110-114`(repo 部署 `compression: gzip`,见 `packages/bundle/cordis.patch.yml` webserver 行)
- `requestRejection` 公开方法:`node_modules/@deepseek-ai/dsh-client-connection/lib/index.js:553,768-781`
- PENDING 注入不挂 await:`node_modules/@deepseek-ai/cordis/src/fiber.ts:310-318,704-710`
- webserver `register({kind:'exact'|'prefix',path,handler})(req,res)` 返回反注册器;registerUpgrade 另案:`node_modules/@deepseek-ai/dsh-host-webserver/lib/index.js:165-196`

---

**明确不在本设计范围**(另立批次):宿主编辑器/身份行/维护 chip 双档轮询的迁移(C 方案——writer `tool/call` 活动信号或直接消费本通道);`tailRunning` 期间 2s `tailTranscript`(子会话 durable 日志,非文件面);dnd5e `ui_data.mjs` 的 `op:rev` 心跳接线(ui_zh.md 既有契约的漂移,与本通道正交,均可受益)。
