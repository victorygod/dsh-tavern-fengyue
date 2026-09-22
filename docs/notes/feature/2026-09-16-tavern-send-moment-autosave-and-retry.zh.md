# Agent Note：酒馆发送时刻自动存档、回复重试与草稿恢复

Status: implemented

[English](2026-09-16-tavern-send-moment-autosave-and-retry.md) | 中文

## 问题

自动存档挂在回合结束（无尾代理卡在 `turn/end`，有尾代理卡在 fork 收尾）意味着存档永远是「回合的产物」：最新一份快照总是包含刚生成的回复，玩家无法从它回到「这条消息发送之前」。由此重试（重新生成最近一条回复）没有任何可靠支点——没有「发送前」的世界快照，也没有「当时输入框里是什么」的记录；载入存档同样丢输入框内容。

## 决策

**存档点移到「玩家点击发送的一刻」，存档戳加 `draft` 字段。** 引擎 `prompt()` 在尾代理闸门放行之后、pending 快照写入与 wrap 渲染之前调用 `autosaveStamped`，戳记 `{sessionId, seq: lastTurnEndSeq, summary, draft}`——快照是发送前的世界（尾代理已维护完 runtime/），`draft` 是正在发送的消息原文。两处回合结束盖章点整体删除；手动保存签名加 `draft`（输入框当时内容，可为空）。自动存档的 summary 就是提交文本截断——发送时刻它恰好是最后一条玩家消息，`lastPlayerText` 的日志倒查反而取不到它。

**重试 = `retryPoint` 换绑 + 客户端原样重发。** 新引擎方法取最新的带 `draft` 的 `autosave-*` 存档（mtime 序，`listSaves` 既有排序），`seq` 非空走既有 `load()`（fork + 换绑 + runtime 恢复 + 种子账本修复），为 `null`（首条消息）走 `reset()`——fork 无完成回合即抛错，此时 runtime 尚未被改动，重播种与快照等价。返回 `{freshId, text}`，客户端立刻对 freshId 走既有 `rpc.prompt` 管线（wrap 重渲染、新 requestId、独立回合与尾代理），再 `onSessionSwitch(freshId, 'retry')` 切视图。正确性建立在两个内核事实上（均已对源码取证）：durable `user/message` 在 `turn/start` 之后落盘（`agent.ts` 首个 step 的 firstAttempt 分支），而 fork 切点推进到下一个 `turn/start` 前——发送时刻戳的种子不含待重跑消息，重发是唯一副本；种子里的账本残项由既有 `repairSeedInbox` 按 `livePendingIds` 剥除。

**载入恢复草稿与重试共享同一戳字段。** `load`/`reset` 返回值加 `draft`，`SavesPanel` → `onSessionSwitch(cause, draft)` → `restoreDraftRef` 一次性交接 → 聊天视图的会话 effect 消费回填（每轮 effect 无条件清空交接项，杜绝跨访问复活）；就地载入（无边界存档返回原会话 id）借 `resetSignal` bump 让 effect 重跑。手动存档草稿采集走 `onDraftChange` 回调 + 父层 ref 镜像（每键 setState 会拖垮整页渲染），聊天视图四个草稿变更点收口到单一 `updateDraft`。

**UI 三件：操作行、重试按钮、Esc 快捷键。** 每条 user/narrative 行挂恒占布局空间的操作行（copy 带 ✓ 1s 反馈，`writeClipboard` 来自 client-ui-primitives——已在 client external 清单），hover 经 opacity 显隐、`@media (hover: hover)` 门控，与 stock `MessageIconActions` 同机制、与既有 `.stamp` 同口径。↻ 只在最后一条 reply 行（narrative/stopped/error——停止与报错也算回复完毕）渲染，条件与发送按钮状态机同源（`!running && !pending && !tailRunning`）加 `state().retryable`。Esc：单击即时（停 → 关对话框 → no-op，与发送按钮停止态同源）；双击（400ms 内）**仅在第一下 no-op 时成立**——清空输入框 → 开加载页，堵死急停连按与习惯性双按关对话框两个误触路径；`event.repeat` 不丢弃（按住 ≈ 急停连按），IME 组词与修饰键组合不拦；模态级 Esc 归一给全局监听单 owner，key 对话框局部处理器移除、文件树行内重命名的 Esc 补 `stopPropagation`。

## 备选方案的取舍

- **重试走「fork 后让账本残项复活、自动重放」**（利用幽灵重发机制）：否决——与 `repairSeedInbox` 的修复语义正面冲突，且种子已含该消息、重放必然双份。
- **`retryPoint` 内部直接调 prompt（单 RPC）**：否决——部分失败（admission 拒绝）时工作空间已换绑，客户端拿不到一致的错误面；两段式让 pending/停止/scriptFailures 全部复用现有发送路径。
- **存档点留在回合结束、另建「重试快照」**：否决——两套存档链必然漂移；发送时刻一个盖章点同时服务重试、崩溃恢复与存档行展示。
- **每条消息的操作行用绝对定位悬浮**：否决——用户明确要求恒占空间，悬浮层与 `.stamp` 的既有悬浮区冲突。

## 后果

wire 加四小块：`state.retryable`、`save.draft`、`load`/`reset` 的 `draft` 返回值、`retryPoint(request, signal)`——typert host 与 api-tavern/ui-tavern 双 bundle 已同批重建，wire-face conforms 断言自动钉住双参。自动存档环形裁剪（keep 10）语义不变——每次发送消耗一个环位。`state()` 每次轮询多一次存档目录扫描（约 10-20 个 stat/read，本地盘可忽略）。重试语义定为「回到点击发送那一刻重跑该条消息」：快速排队竞态路径下边界即点击时刻状态，规则自洽。设计叙述见 `docs/tavern-prototype/send-moment-autosave-and-retry_zh.md`（定案 + 机制取证），design_zh.md「状态与存档」「运行流程」两节已同批反转。
