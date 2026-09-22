# 发送时刻自动存档、回复重试与草稿恢复

2026-09-16 定案（未实现）。本文固化三个联动语义的最终设计：**自动存档时机从「回合结束/尾代理完成」改为「玩家点击发送的一刻」**；**最近一条回复完成后在其下方提供 ↻ 重试**；**载入任何存档都把存档点输入框内容恢复进 composer**。改动全部落在 tavern 三包，内核零改动。

机制权威：[design.zh.md](../architecture/design.zh.md)（双代理/存档总叙述）、[tail-session-archive.zh.md](../runtime/tail-session-archive.zh.md)（尾代理归档）。本文实现落地时，design_zh.md「状态与存档」「运行流程」两节的 autosave 时机表述需同批反转。

## 1. 语义定案

- **存档三件套**：每次自动存档记录 `(历史边界 seq, runtime/ 快照, 存档点输入框内容 draft)`。自动存档的 draft = 正在发送的消息原文；手动存档的 draft = 保存那一刻输入框里的内容（可为空串）。存档从「回合产物」变为「下一回合的输入锚点」。
- **重试** = 载入最新自动存档（fork 回发送前边界）+ 把保留的原文重新走一遍完整发送管线（wrap 重渲染、新 requestId、独立回合与尾代理）。仅对最近一条回复生效，且其之后玩家未提交任何内容。
- **草稿恢复** = 载入存档（自动或手动）后，`draft` 回填 composer 输入框。玩家载入 `autosave_A` 后输入框出现消息 A，可改字重发或直接重发。

## 2. 机制地基（已逐项对代码取证）

1. **待重跑消息不进 fork 种子**：durable `user/message` 在 `turn/start` 之后落盘（`packages/core/agent-loop/src/agent.ts:278` turn/start → `:375` 首个 step 的 `firstAttempt` 分支 append user/message），而 fork 切点从边界 `turn/end` 推进到**下一个 `turn/start` 之前**为止、种子 = `events.slice(0, cut)`（`packages/api/session-controller/src/commands.ts:240-243, :254`）。因此发送时刻盖章的存档，fork 种子不含本条消息——载入后重发原文不会重复。
2. **账本残项被修复**：消息的 ledger insert 在准住时（切点前）落盘、remove 在 claim 后（turn/start 后）落盘，切点必然切断这对；`load()` 的 `repairSeedInbox(freshSession, livePendingIds(sourceSession))`（`packages/extensions/tavern/src/index.ts:631-634`）对源日志已消费的项合成 `outcome:'canceled'` 移除（`packages/extensions/tavern/src/inbox-repair.ts:103-119`）——已发送消息不会以「未消费待办」复活，重发是唯一副本。
3. **fork 必须锚定 completed `turn/end`**：源日志没有任何完成回合时 fork 抛 `session/fork-unavailable`（`commands.ts:227-243`）——首条消息发送前 `seq: null`，重试改走 `reset()`（新建会话 + 从 `preset/setup/` 重播种，此时 runtime 尚未被任何回合改动过，与快照等价）。
4. **发送时刻 runtime/ 已是维护后状态**：`prompt()` 开头 await 尾代理闸门（`index.ts:346-347`），上一回合的记账写盘已落定。
5. **客户端发送路径可整体复用**：`rpc.prompt` 承载 pending 态、停止键 abort、scriptFailures toast、IME 守卫（`TavernApp.tsx:919-971`）；切会话机制 `switchSession`（退避重试）+ `handleSessionSwitch`（`TavernApp.tsx:266-311`）；`tailRunning` 唯一来源是宿主 `state()` 轮询。

## 3. 引擎（packages/extensions/tavern）

- **`types.ts`**：`TavernSaveStamp` 加 `draft?: string`（存档点输入框内容；可选是因为旧账本条目没有该字段，读取点一律 `?? ''`）。`summary` 语义不变（自动存档 = 发送文本截 200，恰好就是玩家输入；手动存档仍取 `lastPlayerText`）。
- **`prompt()` 盖章**（gate await 之后、pending 快照写入与 wrap 渲染之前）：

  ```ts
  autosaveStamped(root, this.cfg.autosaveKeep, {
    sessionId, seq: this.lastTurnEndSeq(session),
    summary: request.text.slice(0, 200), draft: request.text,
  })
  ```

  放在 wrap 渲染前是刻意的：渲染期 `{{script}}` 对 `runtime/` 的写入重试时会重做，快照只含持久真相。`runtime/.chat.snapshot.jsonl`（含 pendingText 的投影缓存）虽在快照目录内，但每次换绑 `composeMainAgent` 会从新会话日志整体重写，天然自愈。
- **删除两处 turn/end 盖章**：`onSessionEvent` 无尾代理分支（`index.ts:930-935`）与 `startTail` 尾部（`index.ts:971-973`）。`startTail` 保留 `await gate + catch warn + finally 清 map` 结构，只去掉存档行。
- **`save(sessionId, name, draft)`**：手动存档戳加 `draft`（签名加参，wire 同步）；`summary` 仍为 `lastPlayerText`。
- **新方法 `retryPoint(sessionId)`**：① `await this.gates.get(sessionId)`（与 prompt 同款，防点击与尾代理收尾竞态）；② 按 `listSaves` mtime 序取**最新的** `autosave-*` 且 `readSaveStamp(...)?.draft !== undefined`（只认自动存档——手动存档边界任意，不承担重试语义），没有则抛错 fail-loud；③ `seq === null` → `await this.reset(sessionId)`，否则 `await this.load(sessionId, name)`；④ 返回 `{ sessionId: freshId, text: stamp.draft }`。
- **`load()` 返回值加 `draft`**：`stamp?.draft ?? ''`（无戳旧存档路径同样返回 `''`）。
- **`state()` 加 `retryable: boolean`**：最新 `autosave-*` 戳带 `draft` 即 true——旧版本存档、被存档面板删掉的 autosave 都会让按钮消失，不留死按钮。flag 是尽力而为的 UX，不构成契约；`retryPoint` 无点可依时仍抛错。

## 4. wire（packages/api/tavern）

- `TavernStateValue` 加 `retryable`；`TavernSaveRequest` 加 `draft: string`；`TavernRebindValue` 加 `draft: string`；新增 `retryPoint(request, signal): Promise<{ sessionId: string; text: string }>`（request 复用 `TavernSessionRequest`）。
- **双参铁律**：新 `@Remote` 方法必须 `(request, signal)` 双参——单/双参不匹配只在运行时调用时炸（`stop` 事故先例）；`tests/wire-face.spec.ts` 的 `Pick<TavernRemoteFace>` conforms 断言自动钉住。
- 加端点后照例 `pnpm run build:lib:host` 重生成 typert **且** `pnpm --filter @deepseek-ai/dsh-api-tavern bundle` 重建 client bundle（漏后者 = 服务端无此方法，客户端静默吞掉）。

## 5. 客户端（packages/client/ui-tavern）

- **`rpc.ts`**：`TavernRpc.state` 加 `retryable`、`save` 加 `draft`、`load` 返回 `draft`、新增 `retryPoint`；`tavernRpc` face 表加一行。包清单加 `@deepseek-ai/dsh-client-ui-primitives`（`writeClipboard`；client-bundle 纯净包，dev 锚 + tsconfig references 同 token-meter 先例）。
- **草稿采集（手动存档用）**：composer 草稿是 `TavernChatView` 本地 state（`TavernApp.tsx:657`），手动保存的 `confirmSave` 在 `TavernAppBody`——加 `onDraftChange` 回调 prop，`TavernAppBody` 用 ref 镜像（每键 setState 会拖垮整页渲染）。`TavernChatView` 内**所有**草稿变更收口到一个 `updateDraft` 帮助函数（textarea onChange、opening postMessage 回填、reset effect 清空、send 成功清空四个 site 都上报），切会话重置时上报 `''`，保证 ref 永不持陈旧文本。
- **载入草稿恢复**：`SavesPanel` 载入回调把 `value.draft` 传入 `onSessionSwitch(freshId, 'load', draft)`（签名扩参，`TavernView.tsx` 四处声明点同步）；`handleSessionSwitch` 把非空 draft 写入 `restoreDraftRef`（一次性交接）；`TavernChatView` 的 `[sessionId, resetSignal]` 重置 effect（`TavernApp.tsx:675`，现在只会 `setDraft('')`）在 sessionId 匹配时消费 ref 回填草稿，并回调父层清空 ref。
- **就地载入边界**：无 fork 边界的旧存档 `load()` 返回原 sessionId，`[sessionId]` effect 不会重跑——此路径下调用方补一次 `setResetSignal(s => s + 1)`（清空流程既有机制），让重置 effect 重新执行并消费草稿。
- **消息操作行（copy + 重试 ↻）**：对齐 stock web UI 的 `MessageIconActions` 机制（`ui-chat/src/client/chat/MessageIconActions.tsx` + `.module.css`）——每条 user 气泡与 narrative 行尾挂一个**固定高度、恒占布局空间**的操作行，`@media (hover: hover)` 下以 **opacity 0→1** 随所在消息行 `:hover`/`:focus-within` 显隐（触屏设备恒显）；opacity 而非 display 保证显隐零布局跳动。行内：**复制**（`writeClipboard` from `@deepseek-ai/dsh-client-ui-primitives`，新依赖边同 token-meter 先例；成功后图标换 ✓ 1s——stock 同款反馈；复制文本 = 行显示文本，user 为剥离后的玩家原文、narrative 为正文纯文本；think/tool/tail 行不挂操作行）+ **重试 ↻**（仅最后一条 reply 行且满足重试条件时渲染在该行操作行内；`windowLast` 截断下挂在最后一条**可见** narrative 上，恒为最新）。
- **重试按钮条件**（↻ 图标的渲染条件，在操作行内）：按时间序**最后一条 reply 行（`narrative`/`stopped`/`error`）位于最后一条 user 行之后** && `!running && !pending && !tailRunning` && `retryable`——前半是内容条件（停止/报错的回合也算回复完毕），后半**与发送按钮的状态机完全同源**。即：有尾代理等尾代理跑完，没有则回复落定即显示；运行/在途/尾代理期间 ↻ 从操作行消失（操作行本身与 copy 仍在）。「仅最近一条回复」与「user 未提交任何内容」由时序判定承载；已输入未发送的草稿不影响显示。↻ 小尺寸图标（同 stock 15px 字形规格），样式并入消息操作行 CSS（`.msgActions`/`.msgAction`），文案键 `chat.retry`/`chat.copy`/`chat.copied`（locale-owned）。
- **重试编排**（`TavernChatView`，因为它持有 pending/promptAbort/停止语义；给它加 `onSessionSwitch` prop）：点击 → `setPending(true)` → `rpc.retryPoint({ sessionId })` → 拿到 `{freshId, text}` 后**立即** `rpc.prompt({ sessionId: freshId, text, requestId: randomUUID(), clientTimeZone }, controller)`（服务端会话已存在，不等客户端切绑；复用现有 pending/停止/scriptFailures 全套）→ `props.onSessionSwitch(freshId, 'retry')`。切换落地后转写从新会话事件流恢复：旧回复消失、原文气泡重现、running 位接管打字点。`handleSessionSwitch` cause 扩 `'retry'` → 新 toast（locale-owned，新键 `chat.retry`「重新生成」、`toast.retried`「已重新生成」）。
- **失败路径**：`retryPoint` 失败 = 什么都没变，落 `turnError` 行并复位 pending；`prompt` 失败沿用现有 admission 失败处理（stop 触发的 abort 是用户手势，静默复位）。

### 5.1 Esc 快捷键（RP 聊天视图）

监听器挂在 `TavernChatView`（`inChat` 时才挂载，作用域天然限定聊天态），window `keydown`，带与 composer 相同的 IME 守卫（`isComposing`/keyCode 229 忽略）；带修饰键的组合（Shift/Ctrl/Alt/Meta + Esc）不拦，留给浏览器/系统。`event.repeat` **不丢弃**——按住 Esc 的自动重复按同一套单击/双击判定连续走（第一下 no-op 之后的下一个重复按压即构成双击：按住 Esc ≈ 急停连按）。

- **单击 Esc**，优先级自上而下，即时触发（停止零延迟）：① 可停（`running || pending || tailRunning`——与发送按钮停止态同源）→ 调既有 `stop()`（abort 自身提交 + session.cancel + 引擎 stop 双通道 + onStopped 即时刷新，全部复用）；② 有对话框打开（设置模态 / 保存对话框 / key 对话框，父层经 prop 传入）→ 关闭它；③ 都不满足 → no-op。
- **双击 Esc**（400ms 内的第二次按压，**且第一下必须是 no-op**——第一下消费了动作（停了/关了）时第二下重新走单击判定，双击不成立），优先级自上而下：① 输入框有内容 → 清空（走 `updateDraft('')` 单一入口，同步上报父层 ref，保证手动存档戳不持陈旧文本）；② 输入框已空 → 打开加载页（= 头部「加载」按钮同款 `openSettings('saves')`，父层 action prop）。no-op 前置堵死两个误触路径——急停连按、习惯性双按关对话框都不会再连带触发；双击只在纯空闲态成立，此时 Esc 开加载页正是「回退到存档点」语义的自然入口。
- **Esc 归一（防双触发）**：全局监听是模态级 Esc 的唯一所有者——key 对话框自带的局部 Esc 关闭（`TavernApp.tsx:598`）移除，由全局「关闭对话框」动作接管；文件树行内重命名的局部 Esc（`TavernView.tsx:329`、`:1171`）语义保留但补 `stopPropagation()`（嵌套行内编辑优先于模态关闭，且不触发全局动作）。
- **父层接口**：`TavernChatView` 新增三 prop——`escDialogOpen: boolean`（三个对话框任一打开）、`onEscCloseDialog()`、`onEscOpenLoadPage()`；停止与草稿操作不跨层（`stop`/draft 都是视图内部态）。`window.confirm` 原生对话框捕获 Esc，无按键事件到达页面，无冲突。
- 覆盖行为：运行中 Esc×1 = 停止（连按/按住也只反复停，不误开页面）；打字中 Esc×2 = 清空输入框；空输入闲聊态 Esc×2 = 直接开加载页；对话框开着 Esc×2 = 关闭 + 第二下重新判定（不误触发清空/加载页）。

## 6. 边界语义

| 场景 | 行为 |
|---|---|
| 首条消息发送（无完成回合，`seq: null`） | 重试 = `reset()` + 重发；此时 runtime 未被改动，与快照等价 |
| 手动停止（aborted）/ 失败（error）的回合 | 也显示 ↻：重试 = 载入发送时刻存档 + 重发该次提交 |
| 旧版本存档（无 `draft` 字段） | 不作重试点（`retryable=false`）；载入时草稿恢复为空 |
| 快速排队（running/pending 锁发送外的竞态兜底路径） | 存档边界 = 点击时刻真实状态；语义自洽：「重试总是回到点击发送那一刻重跑」 |
| 重试之后再重试 | 重试的发送本身又盖新戳（同边界、新 sessionId），链收敛 |
| 载入后改字重发 | 新发送盖新戳（边界不变、draft 为改后文本），重试点随之更新 |
| 清空（reset）后 | savings 保留但 transcript 为空 → 无按钮；清空不恢复草稿（fresh 语义） |
| `request.text` 为 trim 后文本 | 恢复/重发的是 trim 后原文（客户端 `send()` 即 trim），可接受 |

## 7. 测试与构建

- **workspace.spec**：戳 `draft` 写读、最新 autosave 选取（mtime 序 + 同秒碰撞数字后缀）、手动存档戳带 draft、无 draft 旧条目读取容忍。
- **REAL-composition**：发送即存档且 **turn/end 后不再产生 autosave**（环目录数不变）；`retryPoint` fork 种子不含待重跑消息（child ownEvents 无该 `user/message`）；`seq null` 走 reset；`load` 返回 draft；`save` 传 draft 落戳；重试后 prompt 落在 fresh 会话。
- **ui-tavern client spec**：按钮四条件显隐；重试编排（retryPoint → prompt(freshId) → onSessionSwitch）；载入草稿回填与就地载入 resetSignal 路径；假面注意 **value-返回方法不能 `record()`**（双信封坑，`reset`/`load`/`load 返回值`都命中）。
- **wire-face spec**：conforms 断言自动覆盖新方法双参。
- 既有 16 处 autosave 断言随行为反转改写。
- **构建顺序**：`pnpm run build:lib:host` + api-tavern bundle + ui-tavern bundle → `pnpm run build`（Loader 读 lib/）→ **重启宿主**（bundle 是 boot 快照，不重启看不到新 UI）→ mock-llm + `pnpm dsh tavern` 真机一轮（wire 签名错误只在真机运行时炸，REAL 直调 engine 测不出）。
- **文档与 Agent Note**：实现落地同批更新 design_zh.md 两节 + tail-session-archive_zh.md 时机句 + 三包 README 双语（`verify-translation-pairing --write` 重录）+ Agent Note 三件套。
