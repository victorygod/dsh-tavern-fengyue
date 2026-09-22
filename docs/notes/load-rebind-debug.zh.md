# 载入换绑问题：现象、根因与修复进度

记录 2026-09-13 载入/清空链路问题的完整调查：用户报告的现象、探针复现出的三层根因、已落地的修复、当前验证状态与手测清单。机制权威在引擎与客户端源码，本文是排障与验证记录。

## 用户报告的现象

- 点某存档行「载入」后：工作空间对话框刷成只剩「载入中…」，或停留在旧内容；聊天记录没有刷成存档点的聊天历史；手动刷新页面后聊天历史才出现（说明 fork 会话与日志都正确落盘了，是前端视图层没有切过去或被遮挡）。
- 刷新后点「清空」正常；但在点过「载入」未刷新时点「清空」毫无效果。
- 载入后继续对话，模型感觉"还是当前上下文"，不像从存档点 fork 的。

## 根因（三层，探针逐层证实）

1. **前端切会话竞态（主根因）**：rebind（fork + `.tavern-session` 换绑）本身成功，但客户端的会话列表尚未 Hear 到新 fork 会话 id——`api-session/added` 帧晚于 RPC 响应到达。此时 `sessions.open(freshId)` 同步抛 `sessions.select: unknown session`，旧代码的 catch 把它吞成静默失败 → 应用仍停在大旧会话视图：聊天历史"没变"、继续打字的消息从旧线发出（用户看到的"u3 又被发出去"）。
2. **旧弹窗遮罩未关闭（交互面）**：载入只做了 rebind，没有关掉打开着的设置/保存弹窗。`.keyDialog`（`position:fixed; inset:0; z-index:1000`）遮罩拦截了后续所有 header/发送点击 —— 这就是「清空没效果」「保存没反应」的直接机理；手动刷新页面重建 DOM 后遮罩消失，才"恢复正常"。修复前的探针 log 里 58 次重试全部被 `keyDialog intercepts pointer events` 拒绝，逐字吻合。
3. **改后卡编辑/清空的收口缺失**：编辑模式与清空此前依赖旧会话 id 的 RPC，一旦视图停在旧会话上，全部自然失效（清空调 `reset(旧id)` 被引擎拒绝）。

另一独立来源：手动刷新后"agent 记录没跟着载入"的观感之一是**旧存档无历史边界**——戳记机制之前的 autosave 没有 `savings/.tavern-boundaries.json`，载入只能原位恢复 runtime、无法 fork 历史前缀（数据限制，非缺陷；新存档从 2026-09-13 起默认带戳）。

## 已落地的修复

1. **`switchSession`（TavernApp）**：rebind 的唯一入口，清空/载入/编辑保存并开始/开新会话全部经过它。流程：`setSettings(undefined)` + `setSaveOpen(false)`（先关弹窗，消灭遮罩）→ `sessions.refresh()`（主动拉会话列表，让新 id 进快照）→ `sessions.open(freshId)`，open 抛错则 250ms 退避重试（最多 8 次，全失败弹 `app.openFailed`）。旧直接-open 路径整体废弃。
2. **编辑卡同卡更新**：卡库铅笔 → `editFromLibrary(name)`（载卡进工作空间 + `.tavern-editing` 戳）→ 统一编辑器；失焦保存时 `writeText` 同 rel 路径双写进卡库里的那张卡（`tavern_presets/<name>/…`）——"失去焦点就更新"发生在卡库真卡上；返回 = `cancelEdit` 恢复原卡；编辑模式下工作空间头部有「保存并开始」→ `reset` 用改后的卡开新会话。
3. **清空/载入后 UI 收口**：rebind 后 forgetLastLine(旧 id)、refreshRows、转写按新会话事件流全量重读。
4. **输入法 Enter**：composer 按 stock keymap 语义加 IME guard（`isComposing` / `keyCode===229` / compositionend 后 10ms 窗口）——中文确认候选词不再发送。
5. **思考行**：转写聚合 live `assistant/live-chunk` 的 reasoning delta 渲染「思考」折叠行；mock 端 `--reasoning-text` 配置时 `success` 行为也流思考 chunks（此前仅 `reasoning_success`），result 事件携带 `reasoning`/`assistantText`，pretty 日志在 `[assistant]` 下以 `<thinking>…</thinking>` 包裹打印；`scripts/mock-llm.sh` 默认喂三条（思考）行。
6. （更早已提交）`<system-reminder>` 在 gate 过滤、无尾代理回合直接 autosave、载入 fork 换绑内核通道。
7. **（二轮 2026-09-13）编辑卡收口**：修 `writeText` 双写镜像路径——原实现把 `preset/` 段 slice 掉后拼进卡目录，镜像落到了 `tavern_presets/<卡>/prompt/…`（卡根下、卡库树外），卡面文件从未被写过，这就是「改后内容不进卡库」的根因；现镜像路径 = 卡根 + 原 rel 路径。`importFromLibrary`/`draftCard` 现在清陈旧 `.tavern-editing` 戳（换卡加载/建新卡不再把失焦双写指向无关旧卡）。客户端：`editMode`/`onSessionSwitch` 此前在 TavernView→TavernWorkspace 一层丢失、开局页实例也没传——「保存并开始」因此任何页面都渲染不出来，两处已接线；工作空间编辑页新增「← 返回卡库」（cancelEdit 恢复原卡回书架）；编辑态「保存并开始」改为先 `publishCard`（整卡回写卡库 + 清戳，收拢重命名/删除等未镜像改动）再 `reset` 换绑新会话。`switchSession` 补上 `sessions.open` 抛错时的退避重试（本文此前声称有、实现没有——open 抛错曾是未处理 rejection，无重试无提示）。
8. **（二轮 2026-09-13）思考行对齐原型**：流式中的思考行 summary 跟随最新一行（`.follow` 右对齐随流增长）并带 `.running` 扫光动效；思考流式期间隐藏打字点；回合落定后仍回折叠首行摘要。**手测复检发现的真根因（三轮）**：思考数据链路（mock `reasoning_content` → adapter `reasoning-delta` → durable message）一直是通的——坏在前端两处：① 叙事提取把 content 里所有块的 `.text` 都拼进叙事，`reasoning` 块整体漏进正文气泡（用户看到的「（思考）×3 + 叙事」一行）；② 前端监听 `assistant/attempt` 事件聚合 reasoning-chunks，但持久化日志里没有这个事件类型——stream 记录挂在 `assistant/message` 的 `data.stream` 上，durable 思考行因此从未渲染。修复：叙事只取 `type: 'text'` 块；思考行改从 `assistant/message` 的 `data.stream` 聚合（`reasoningOf`）。

## 验证现状

- 门禁：受影响包 585+ 单测全绿、src 门 expected 31/31 双模式、host+client 双构建、lint/doc-sync 16/16。组合测试钉住载入 fork 的请求视图（存档点前缀、无 diverged 内容重发）。
- 浏览器探针（headless Chrome，`/tmp/tavern-probe/full3.mjs`）：全新环境已验证 R1 思考行/叙事/草稿清空、R2 保存对话框开合、R3 两条气泡 [u1,u2]。**R4（载入后弹窗自动关闭 + 转写切到 [u1]）在「关闭弹窗」修复加入后尚未跑完 headless 复验**——修复前逐层现象已全部探针复现并根因定位（见上），修复面覆盖三层根因；`close2` 阶段（探针）在仓库树最终构建上被用户手动接替。
- 历史探针遗留脏会话会让断言失真（同一 workspace 叠加多轮 probe 的 ui 气泡），真机手测请用全新会话。
- 二轮修复后：ui-tavern 客户端 47 测、tavern 引擎 39 测全绿——引擎侧新增 REAL-composition 编辑戳生命周期用例，逐字复现并钉死了双写镜像路径 bug；两包 tsc / oxlint / tsdown 构建 通过。

## 真机手测清单

1. 重启 `pnpm dsh tavern`（client bundle 在进程启动时快照），浏览器硬刷新（避免旧 bundle）。
2. 会话内发 u1 →「保存」命名 p2 → 发 u2 → header「加载」→ p2 行「载入」：预期弹窗自动关闭、转写只剩 [u1,a1]（气泡一行 u1）、继续发 u4 时 mock 日志里该请求的最后一条 user 是 `prefix+u4+post` 且整条请求无 u2/u3 重发。
3. 载入后点「清空」：弹窗应立即关闭并回到开场页（不需要手动刷新）。
4. 中文输入法内按 Enter：只确认候选词，不发送。
5. `sh scripts/mock-llm.sh`：默认含（思考）行；请求日志里 reasoning_configured 场景的前端出现思考折叠行；思考行流式滚动后停顿（REASONING_GAP_MS，默认 800ms）再出正文。
6. 编辑卡：点铅笔进编辑器 → 改内容（卡库此时不动）→「返回」应弹三选框（取消留编辑器；不保存放弃回书架；保存落库回书架）；改内容 →「仅保存」提示已更新卡库且仍在编辑；改内容 →「保存并开始」开新会话玩改后的卡。

## 若手测仍失败

- 打开 DevTools console：`switchSession` 全失败会弹 `app.openFailed` toast；`[tavern] session open failed` warn 说明列表仍缺 id（请记录当时会话列表条目）。
- 记录 mock 日志 result 行是否携带 reasoning 字段；无则确认 `--reasoning-text` 确实传入（pretty 行首 request · 行不含该信息）。
- 旧 autosave（无戳）载入仍会 runtime-only——换新存档测试。


## 用户补充手测问题

为什么现在在开启新会话->编辑卡片之后，页面上没有返回选项，也没有保存并开始选项了？而且改后的内容也没有更改到卡库的卡片上。我说了，在开启新会话编辑卡片、创建新卡片这个页面，所有对卡片的编辑编辑的是卡库里的文件，而不是新生成的工作空间里的文件，你要不给我讲一下从我点击开启新会话以后的执行逻辑，应该是先创建一个工作空间，然后从卡库拉取卡片信息，点了编辑就改卡库里的卡的信息，然后保存并开始才把编辑好的卡复制到当前工作空间！

思考过程现在llm-mock里倒是有了，可是前端展示的不对啊！，thinking你看看原型里是怎么展示的！，他会流式把thinking快速的展示那一条，这些都是默认的webUI会干的，为什么我们这里搞不好！？

还有加载还是有问题！你给我讲一下加载现在的业务逻辑一步一步都会干什么，我们一起分析下！

## 二轮修复记录（2026-09-13）

### 编辑卡：开启新会话之后的执行逻辑（修复后）

1. 「＋ 开启酒馆会话」→ `createSession`：引擎建 `tavern_workspace/ws-<时间戳>/`（preset/runtime/savings 三空目录）并经 sessionController 建会话；前端落开局页（卡库书架）。
2. 点卡面 = `importFromLibrary`：卡库 `preset/` 整树复制进工作空间并播种 runtime/，会话进入聊天。
3. 点铅笔 = `editFromLibrary`：同样复制，再盖 `.tavern-editing` 戳（记录在编辑哪张卡），前端进就地工作空间编辑器。此后编辑的都是工作空间副本，失焦保存时 `writeText` 把 preset/ 内同 rel 路径镜像回卡库那张卡。
4. 编辑页两个出口：「← 返回卡库」= `cancelEdit`（重新载入原卡盖掉改动，回书架）；「保存并开始」= `publishCard`（整卡发布回卡库并清戳）+ `reset`（换绑全新会话、runtime 重新播种），前端切到新会话开聊。

三处断点均已修复：双写镜像路径少拼 `preset/`（写到了卡库树外）；`onSessionSwitch` 在 TavernView→TavernWorkspace 与开局页两处未接线；工作空间编辑页原本没有返回按钮。

### 思考行：与原型对齐

原型行为：回合开始即出现「思考」行，流式期间 summary 跟随最新文本（右对齐、随流增长、扫光动效），落定后折叠为首行摘要、可展开全文。手测复检确认的根因不在 mock 也不在 provider（`reasoning_content` → `reasoning-delta` → durable message 的 `reasoning` 块全程正确），而在前端：叙事提取把 `reasoning` 块文本拼进了正文气泡，且 durable 思考行监听的 `assistant/attempt` 事件在日志格式中不存在（stream 挂在 `assistant/message` 的 `data.stream`）。修复后：叙事只取 `text` 块；思考行 = live reasoning-delta 聚合（流式中，transient 帧在 settle 时原子移除）+ durable `assistant/message` stream 的 reasoning-chunks 折叠行接替。

## 三轮定案（2026-09-13 晚）：「被回滚的消息被重发」「下一条消息执行两次」的根因

用户复现两轮（19:54 与 21:03），症状收敛且稳定：载入存档后，前端转写里额外出现「存档点之后、载入前那几条」被回滚的对话（消息与回复都是**新跑出来的**），并且载入后玩家发出的第一条消息被执行两次。对 `~/.dsh/sessions/<workspace>/session-*/session.v3.jsonl.zstd` 的取证结论如下。

### 证据链（两轮日志逐事件对齐）

1. 会话树：X（根，玩家对话）→ Y（载入 fork 出的新会话，`isSeeded`）→ Y 的两个记账子代；每条 user/message 的持久事件带有 `source.rpcId`（客户端为每次发送铸造的身份）。
2. 幽灵消息（重跑的那条）在 Y 的日志里是一条**新建后追加**的 `user/message`，`source.kind = "user"`、`clientTimeZone = Asia/Shanghai`，且 **rpcId 与 X 上原始那次发送完全相同**——不是浏览器重新发送（浏览器端 prompt 是一次性 RPC，前端无重放代码），而是**服务端把同一条已消费的 prompt 再次接纳了一次**。
3. 决定性证据是 Y 日志里的 `agent/inbox/spliced` 账本：Y 的种子包含 X 上一条 `inserted`（排队插入）事件，而它的配对 `removal` 事件不在种子里。一个队列只进不出的账本 = 子会话首次运行时把该待办重新认领。
4. mock 请求解码与权重吻合：幽灵回合跑在主面上（当前消息被 wrap 规则包裹），其历史 = 存档点前缀、不含任何 diverged 内容——种子本身是干净的，脏的在 inbox。

### 根因（机制）

`sessionController.fork`（`packages/api/session-controller/src/commands.ts`）的种子 = `source.events.slice(0, cut)`，`cut` 停在「边界之后第一个 `turn/start`」处。而 `agent/inbox/spliced`（`packages/core/agent-loop/src/inbox.ts`）账本事件的三段序是：

- `spliced { inserted: [待发消息…], target: "next-turn" }`（玩家/插件把消息排入队列）
- `turn/start`（agent 开始认领该消息）
- `spliced { removedCount: N }`（认领完成，条目从账本报废）

**remove 总是排在对应 turn 的 turn/start 之后**；fork 的切点却停在 turn/start 之前。于是只要 X 在存档点之后有玩家发过消息（insert 已落、remove 在切点之后），种子就带上了一半账本——**排队条目成了只进不出**。子会话从账本回复 inbox 状态，第一个回合就把这条早已被 X 消费的消息重新认领：rpcId 原样随行、文本 = 被回滚的那条 → 这就是「被回滚的消息被重发」。

同一机制在子代上再切一次：Y 的记账 fork（尾代理 `startTail` 的 subagent 内核 fork）切 Y 的日志时，把 Y 上**正在队列里等待认领的 "444"** 的 insert 也切走了 remove → 记账子代把 "444" 认领跑了一遍（尾面请求），Y 主会话随后又正常认领跑了第二遍（主面请求）→ 「下一条消息执行两次」。两轮复现（333 与 22222 场景）与该机制逐字吻合。

影响面与 tavern 无关：任何「切点落在 insert 与 remove 之间」的种子都会复现。tavern 的存档边界固定落 turn/end，玩家存档后只要还发过消息、再载入，就 100% 触发。

### 修复方案

机制图（日志时间序，`agent/inbox/spliced` 三段序）：

```
父会话 X 日志
──────────────────────────────────────────────────────
… turn/end(u1回合)              ← 存档边界（stamp 在这）
   [spliced: INSERT "u2"]       ← 存档后玩家发的消息排队   ┐ insert/remove
   turn/start                   ← 开始认领                 │ 成对账本事件
   [spliced: REMOVED]           ← 认领完成，账本报废       ┘
   turn/end(u2回合)
──────────────────────────────────────────────────────

fork 种子切法（现状，坏）：种子 = …turn/end(u1) + [INSERT "u2"]
  remove 落在切点之后被切掉 → 子会话账本"只进不出"
  → 首回合自动认领 u2（幽灵回合，rpcId 原样随行）
  → 记账 fork 再切一次 → 玩家下一条消息被主会话+子代双重消费
```

**内核契约的精确定义（stock webUI 分叉路径取证后修正）**：stock 面每回合尾部有「分支」按钮（`ui-chat` TurnTailNodeView → `forkAt(末节点 seq)` → 同一个 `sessionController.fork`，文案「在新对话中分支」），且 `core/agent-loop/tests/inbox.spec.ts:129` 用测试钉死了「forked session projects inherited inbox events」——**继承父会话真实在途的队列项是受保护的内核契约**（"durable steering handoff" 的实现载体）。tavern 幽灵消息不是这个特性本身，而是同一账本投影机制被「切在对中间」的切片投喂了假账：insert 在切点前、remove 在切点后（该项在父会话里**早已消费**），投影层误读为 pending。

因此修复语义从「一律剥光」修正为：**种子的 inbox 状态必须与父会话在切点时刻的真实 inbox 一致**——

```
账本配对完整性扫描（种子构造时前缀回放）：
  insert 的 remove 已存在于源日志（哪怕在切点后）→ 该项已被消费
    → 剥掉 insert（或补合成 remove），子会话不得见到 pending
  insert 真无 remove（父会话此刻真实挂着，如 steer 余项）
    → 原样继承，契约不变
```

对 stock 分叉零回归：从最后一个完成回合分叉时父队列本来就空；中间分叉时下一条消息已消费，剥离后子会话不再自动重跑它——这正是「在新对话中分支 = 从干净前缀开始」语义的归位（当前实现里它的自动续跑是同一个切账 bug 的产物）。

**实现点收敛在 session-controller 的种子构造一处**（`packages/api/session-controller/src/commands.ts` 的 `fork`），subagents 的 fork 种子路径（尾代理）同改；`core/agent-loop` 行为不变，只在 inbox 契约处补一条「半对账本不得投影为 pending」的回归测试作护栏。按仓库规则，本项属内核缺陷修复（非新增行为走插件扩展点），合入时须同步 `docs/architecture.md` 的 fork/种子契约描述。

回归测试两条（现有组合测试只钉「请求视图 = 存档点前缀、无 diverged 重发」，够不到 inbox）：

1. 源会话在存档点后已消费一条玩家消息的状态下 fork：子会话首回合**不得**重认领该消息（mock 请求日志按编号断言：无幽灵回合）。
2. 子会话首回合运行中父会话排入新消息、随后触发记账 fork：该消息**只**被主会话消费一次（不发进子代、不双重消费）。

### 修复路线（修订：首选 tavern 内，不动内核）

需求约束：修复收敛在 tavern 三包内。可行性依据：账本是事件流、投影事件驱动实时生效，而 fork 返回后、子会话首回合之前引擎**插得进手**——底盘不用动，对账即可。

**修复点 1（载入后，`TavernRuntime.load()` 内）**：fork 返回 freshId 后、任何 prompt 之前——重放子会话种子（`seq < inheritedEventCount`）的 `agent/inbox/spliced` 账本，收集悬空 insert；对每条悬空项查**源日志切点之后的余部**：remove 存在 = 已被消费 → 对子会话 `session.append` 一条合成 removal（`{target, start, removedCount, inserted: []}` 坐标按重放现值算）勾销；remove 不存在 = 父会话真实在途（steer 余项）→ 保留，契约不破。子会话 inbox 归零，幽灵的 user/message 永不落盘。

**修复点 2（尾代组装时，`composeTailAgent` 内）**：同一函数作用于尾代子会话——种子内悬空的 insert 一律勾销（记账代理只跑维护提示词，玩家消息由主会话消费；主会话侧的排队项不因继承而双消费）。

**方法定稿（2026-09-13，用户拍板）：补账 removal 式**——对账函数按账本契约（`core/agent-loop/src/inbox.ts`）直接向子会话追加合法的注销事件：`session.append('agent/inbox/spliced', { target, start, removedCount, inserted: [], outcome: 'canceled' })`；投影 fold 是逐事件回放 + 坐标/跨表 id 校验（fail-loud），同一 target 内**按下标降序**逐条注销以保坐标有效。

**尾代过度清除审计（结论：无合法项会被误删）**。种子区内可能存在的账本事件只有三类，逐一核对：

1. **维护提示词不在种子区**：`subagent-fork-in-process` 的 fork 种子 = `completedTurnPrefix(parent)`，初始 prompt 由驱动在**建会话之后**投递进子会话 inbox（`subagent/src/index.ts`:"Resolves when the child's inbox accepts that prompt"）——落在 `inheritedEventCount` 之后的 own 区，修复规则按 `seq < inheritedEventCount` 界定，碰不到它。
2. **wrap 快照不是账本事件**：它是 `user/message` append（surfaceOp append），fold 只读 `agent/inbox/spliced`，不受影响。
3. **主会话真实在途的玩家消息**（尾代 fork 瞬间 steer/排队中的项）：尾代种子里是**副本**，主会话自己持有着原件并会在其后续回合消费——勾销尾代副本恰好消除双重消费；这正是不勾会产生 mock #6/#8 双份请求的来源。

修复点 1（主子会话）另有额外保护：悬空项还要**对照源日志切点后的余部**——remove 已存在（源会话已消费）才勾销，源会话真实在途的项原样保留，内核 "inherit genuinely pending" 契约不破。

实现形态：一个共享小函数（重放账本 → 悬空项定位 → 合成 removal append），两条 host 组合测试钉死：① 载入后不输入内容，mock 60 秒内无任何自动请求；② 载入后输入 u4，全链路 444 只出现一次主面请求。

**落地状态（2026-09-13 完成）**：`packages/extensions/tavern/src/inbox-repair.ts`（重放/`livePendingIds`/`repairSeedInbox`）；`load()` 与 `composeTailAgent` 两处接线完成。测试侧三件：`tests/inbox-repair.spec.ts`（5 例单元：切断勾销、真实在途保留、尾代全勾、降序坐标、平衡种子零操作）；`tests/loader-composition.spec.ts` 的 stub fork 补齐了生产切法（推进到下一个 `turn/start`）——现有载入用例因此成为幽灵回归断言，并新增「记账对账」REAL 用例（父会话回合中排队、尾代不重跑、主会话单次）；载入后 own 区断言 = 仅 end-seed 标记 + 注销 splice。**反向验证**：临时禁用修复点，现有测试立即复现幽灵重跑。包内 45/45、ui-tavern 55/55 全绿；测试桩的 stub-fork 修正在文内注明镜像生产锚定规则。Agent Note：`implemented/bug-fix/2026-09-13-tavern-seed-ledger-reconciliation.md`（双语）。前端三项竞态收尾与两个新需求（autosave 可读名、存档简介）按上节列表另行处理。

**如实标注的代价**：合成 removal 是插件写内核词汇的账本事件——append 面是公共 API、事件类型在公共事件图、投影实时生效，机制合法；但账本语义的所有权重在 agent-loop，实现必须对着 `core/agent-loop/src/inbox.ts` 的重放校验写（removal 坐标校验 fail-loud，写错当场报错而非静默烂掉）。内核若调整账本校验，这两处修复需跟随——响、不坏。

**长期归位（可选，非本次）**：内核侧把「种子账本对齐父会话切点时刻真实 inbox」立为契约（session-controller 种子构造一处 + agent-loop 护栏测试 + architecture.md 随批），stock 从中间回合分叉的同一假遗留一并归位。tavern 的两个修复点届时直接删除，不与内核修复冲突。

### 存疑澄清（2026-09-13 补，第三轮 stock 行为查证后修订）

- **不是存档节点选错**：锚 `turn/end` 与 stock 分支（回合末节点）同形状；成因是源会话在锚点后长出 diverged 内容，这是「存档后继续玩再载入」的本质。
- **不是 tail agent 挡路**：尾代只是半截账本的第二个传播面（双重消费），不阻碍载入本身。
- **stock（默认 webUI）分叉的查证事实**：入口 = 每个已完成回合尾部的「分支」（`ui-chat` TurnTailNodeView：`branchUnavailable` 仅要求 closing 是**本回合**内最新内容，历史回合可点）；调用 = `forkAt(closing seq)` → `sessions.fork(atSeq)` → `open(childId)`，标题 +v2；**子会话不自动跑任何东西，排队等待**。若种子里带出悬空 pending（分叉点之后源日志还有已消费内容时才会发生），将在子会话**下一次有输入时被先排空**——新复现的时间序证实了这一点（用户的 444 入队 5ms 后 turn/start，先认领 0 号位的幽灵、再认领 444）。
- **stock 常规体验为什么干净**：其默认用法只在最近的完成回合分叉，切点后源日志为空 → 种子无账本可漏 →丝毫不自动。tavern 的载入锚在历史中间，必然带出内容，所以要靠修复点补齐同一语义（干净前缀、零自动动作）。若在 stock 里「中间回合分叉后再发消息」观察到不同行为，取该次日志重校模型；不影响修复方案与两条验收断言。

### 同批加固（次级，全部 tavern 内）

1. `load()` 缺回滚——fork 成功后 rebind 中途抛错（写 `.tavern-session`/compose/loadSave）会停在「新会话已绑、runtime 未恢复」的中间态，参照 `reset()` 的 try/catch 回滚补对称保护。
2. `load()` 只 delete 原始 sessionId，上一个 fork 子会话在 workspaces 表中的映射不会被清理。
3. 前端三处：`onLoaded` 错误分支置 `hasCard=null`（永久「载入中…」）、存档 tab `reload()` 闭包持旧 sessionId、`switchSession` 成功分支 `open` 抛错无兜底（refresh 的 single-flight 可能复用 fork 落地前的旧快照）。

### 落地顺序与验收

① 内核契约（种子剥离）→ ② 两条回归测试 → ③ tavern 加固 → ④ 新需求（autosave 可读名 `stampedName` + `TavernSaveStamp.summary` 存档简介贯通 `listSaves`/SavesPanel）。每步过相关包单测 + 组合快照 + host/client 双构建；最终手测验收（内核修复落地后）：

1. u1 → 保存 p2 → u2（答完、记账跑完）→ 载入 p2：转写只剩 [u1,a1]；**不开口**，mock 60 秒内无任何自动请求（幽灵回合消灭）。
2. 载入后立即输入 u4：mock 中 444 只出现一次主面请求；其后记账请求 claimed = 维护提示词，无第二次 "444"。
3. 载入 p2 → 清空 → 再载入 p2：两次换绑行为一致，无重复消息、无「载入中…」永久占屏。

### 客户端收尾（三轮现象里仍待修，根因在上一轮分析）

本轮「点载入不再卡死」只是 race 窗口没赶上，不是已修复：`TavernView` 的 `onLoaded` 错误分支把 `hasCard` 重置为 `null` → 模态永久「载入中…」（`view.loading`）；存档 tab 的 `reload()` 闭包持旧 sessionId，rebind 后对旧会话发 RPC 全部抛 `not a tavern session`；`switchSession` 成功分支里 `sessions.open` 抛错仍无兜底（unhandled rejection，静默）。修复方向：错误态与加载态在 UI 上可区分（错误行 + 重试按钮）、`reload()` 在 switch 完成后用新 id 重放、`open` 的稳妥重试挪进 switchSession 其自身分支（`sessions.refresh` 的 single-flight 可能复用一个 fork 落地前发起的旧快照）。

### 手测清单增补（内核修复落地后）

1. u1 → 保存 p2 → u2（模型答完、记账跑完）→ 载入 p2：转写只剩 [u1,a1]；**不输入任何内容**，观察 mock 日志 60 秒内无任何自动请求（幽灵回合消灭）。
2. 载入后立即输入 u4：mock 中 444 只出现一次主面请求；其后的记账请求 claimed = 维护提示词，日志/请求里不出现第二次 "444"。
3. 载入 p2 后清空、再载入 p2：连续两次换绑后行为一致，无重复消息、无「载入中…」 Permanent 占屏。

## 新需求（2026-09-13 记录，待随批实现）

1. **autosave 存档名**：`autosave-<机器时间戳>` 改为本地可读时间、精确到秒、本机时区，如 `autosave-2026-09-14-01:22:28`（`:` 在 POSIX 目录名中合法；Windows 侧无法承载，见引擎 README Known Limitations）；改 `packages/extensions/tavern/src/workspace.ts` 的 `stampedName`，环形裁剪与 `.tavern-boundaries.json` 记账逻辑不变。
2. **存档简介**：每个存档（手动 + autosave）记录「存档时刻最后一条玩家消息」，写入该存档的边界戳（`TavernSaveStamp` 增 `summary` 字段，`save()`/`autosaveStamped` 从会话日志取最后一条玩家消息）；`listSaves` 透出，前端 SavesPanel 与保存对话框列表渲染为存档行简介。旧账本无 `summary` → 简介空缺即可，不做兼容猜测。

### 载入：现在的业务逻辑（逐步）

1. 设置弹窗 → 存档页 → 点某存档「载入」→ `rpc.load(sessionId, name)`。
2. 引擎读该存档的戳记（`savings/.tavern-boundaries.json`：存档时 session id + 最后一个 `turn/end` seq）。
3. 无戳（2026-09-13 之前的旧存档）→ 只原位恢复 runtime/ 并返回原 session id——不 fork 历史（数据限制，非缺陷）。
4. 有戳 → `sessionController.fork(stamp.sessionId, atSeq=stamp.seq)`：内核复制存档点前缀日志为全新会话（append-only 日志永不改写；分叉出的 diverged 会话保留为孤儿）。
5. 换绑：`.tavern-session` 重写为 freshId、workspace 表换 key、给 fresh 会话的 agent 挂卡片组合、旧会话解绑；`loadSave` 用快照覆盖 runtime/。
6. RPC 返回 freshId → 客户端 `handleSessionSwitch`：forgetLastLine(旧 id) + `switchSession(freshId)`。
7. `switchSession`：先关所有弹窗 → `sessions.refresh()`（主动拉会话列表基线）→ `sessions.open(freshId)`；列表仍缺 id（`api-session/added` 帧晚到）则 250ms 退避重试 ≤8 次；全失败弹 `app.openFailed`。
8. `open` 成功 → current 切到 fresh 会话，转写按其事件流全量重读 = 存档点前缀（如 [u1,a1]）；继续发送即从该前缀续写，不含 diverged 内容（组合测试钉住请求视图）。

手测关注点：toast 弹「打开会话失败」说明 refresh 拉回的列表 2 秒内仍没有 freshId（记录当时会话列表条目）；切会话成功但气泡缺失时，对比 mock 日志请求视图与存档点前缀；旧存档（无戳）载入仍是 runtime-only——用新存档验证。
## 四轮定案（2026-09-13 晚）：编辑卡保存语义重定义

用户定稿的行为契约：**编辑期间卡库绝不被动**。失焦双写（二轮修复条目 7 的镜像）整体移除——`writeText` 只写工作空间；卡库只在显式保存动作里更新。原因：双写让「返回」永远回不到初始状态（卡库已被顺手套改）。

- 编辑器改动只落工作空间；`editDirty`（新增 RPC，引擎侧 preset 树逐字节 diff）报告未保存改动。
- 「仅保存」（新增，与「保存并开始」并排）= `saveEdit`：工作空间 preset 覆盖卡库那张卡，**编辑态保留**，可继续改。
- 「返回」：`editDirty` 干净 → 直接 `cancelEdit` 回书架；脏（或查询失败，宁稳勿丢）→ 三选弹框「返回卡库？」：取消（留在编辑器）/ 不保存（`cancelEdit` 恢复原卡，回书架）/ 保存（`saveEdit` 落库后回书架）。
- 「保存并开始」= `publishCard`（整卡回写卡库并清编辑戳）+ `reset` 换绑新会话开聊。

验证：tavern 引擎 39 测（组合用例改钉「编辑不碰卡库 / saveEdit 保留编辑态 / publishCard 清戳」）、ui-tavern 51 测（仅保存、返回干净直通、三选弹框取消/不保存/保存三路）全绿；typert 重生成 + api/ui 双 client bundle 重建。
