# Agent Note：酒馆请求视图包裹与双代理组合

Status: implemented

[English](2026-09-12-tavern-request-view-wrap.md) | 中文

## Problem

随酒馆引擎发布的四个真实缺陷全部只在真实组合下现身（单测全绿掩盖）：（1）主代理首回合装配出空卡 —— 预渲染缓存在建会话时（卡尚未导入）就预热成空串，唯一刷新点在 `agent/pre-step` 闸门里且晚于装配本身；（2）会话控制器挂载了默认编码代理预设 —— 三十件产品工具与 coding persona 进入酒馆世界，尾代理 fork 继承同一面，写三件从未注册上；（3）浏览器转写把 `eventSource` 的 **entry** 对象当成事件本体读 —— 用户发的任何内容都不渲染；（4）`tailRunning` 未过 wire（`state` 投影漏字段）—— 记账横幅、发送闸门与尾行永不出现。另有一个定案需求：prefix/post 改为请求级包裹（只包当前回合 user 消息、历史裸文），运行时上下文快照机制完全表达不了。

## Decision

**通用、对酒馆零知识的请求视图扩展点。** `agent/request-messages`（声明于 `packages/core/agent/src/runtime-types.ts`，派发于 `packages/core/agent-loop/src/agent.ts` 的 `buildRequest`，在 `deriveMessages()` 之后）：awaited scoped waterfall，改的只是**请求视图**、不触 durable；`payload.current` 携带本 step 被接受输入的 durable `(seq, message)` 对，调用方按 durable 身份认领在途消息而非按位置。重建不变量（派发 JSDoc 为权威）：返回的每条消息必须可从 durable 状态重建，外部派生文本须在用它的请求之前落成 durable 快照事件。fused dispatcher 自动注入 `agent`，loop 只传其余字段 —— 该细节由 scope invariant spec 在事件出现的一刻当场抓住。

**酒馆的包裹：先物化后改写。** 渲染移入 `system-prompt/assemble` waterfall listener（`packages/extensions/tavern/src/prompting.ts`）：raw-file section provider 保持同步签名，listener 内解析 `{{script}}`、探测 `-h` 工具自述（保留 mtime 缓存）后就地改写 assembly —— 预渲染缓存类整体删除，首回合烙空与闸门差一回合的时序问题同时消失。listener 把渲染出的 prefix/post 对回调给引擎，引擎在**值变化时**追加一条 durable `tavern:wrap` 快照 user 消息（双双为空时落清除标记 —— 与 runtime-context 同款 supersedes 语义）。scoped `agent/request-messages` listener 再把**当前被认领的 user 消息**重建为 `prefix\ntext\tpost` 单条请求视图消息。结果：`[s, u1, a1, …, p+uN+p, aN]`，历史恒裸文、UI 恒裸文、任何历史请求可从日志重建。

**世界里没有产品工具。** 酒馆会话经 `session.create({ agentPreset: 'none' })` 创建 —— `packages/api/session-controller/src/agent.ts` 新增的显式无预设路径（`'none'` 不挂任何预设；显式要求的冷恢复保持 `none` 而非回落配置默认）。双代理再各自 `tools.restrict({ allow: [] })`（restrict 只管继承层，agent 自己 scoped 注册的幸存）与 `systemPrompt.suppressRuntimeContext()`（快照里去掉策略文案、不影响执行侧 enforcement）。主代理请求工具恰为 `executeTools / runtimeRead / runtimeGrep`；尾代理恰为写死五件。

**卡文是唯一的 system。** 三个全局产品 section——`harness:identity`、`harness:source`（实现库位置行）、`app:web-surface`（Web GUI 说明）——注册在根 scope，会乘进每次酒馆装配。每个酒馆代理 scope 用同名**空** section shadow 三者（文档化的 scoped shadowing），装配出的 system 恰为卡文加 `-h` 工具自述、别无他物；进程内其他会话不受影响。组合测试把请求的 system 钉为逐字节等于卡文——产品 section 改名会在那里响亮失败，而非悄悄混回提示词。

**尾代理的种子保留包裹。** 保留规则：`p+uN+p` 视图只在它是「当前消息」时存在——主代理一认领新输入即解除。但尾代理读的是刚结束的回合，所以其种子内最后一条玩家来源 user 消息**保留**包裹视图（由父会话的持久 wrap 快照对重建，同源可重建）；尾代理自己的维护消息永不包裹。组合测试验证：尾请求的 user 文本含被记账回合的 `prefix+text+post`，维护文本居末。

**清空是工作空间换绑，不改写历史。** 日志只追加，因此「聊天记录清空」的做法是把工作空间绑到全新会话（`agentPreset: 'none'`、同 cwd）：玩家面对空历史与开场页，`runtime/` 从 `preset/setup/` 重播种、`savings/` 保留，旧会话的持久日志解绑留档。`engine.reset` 返回新会话 id（api `reset` 投影它；客户端打开它并清掉侧栏旧末行缓存）。组合测试驱动清空后回合：新请求视图无任何清空前文本、卡面 system 一致、尾部照常记账、第三次 autosave。

**尾代理是主代理的对等件，不是 persona。** 只有 `reason.kind === 'completed'` 的 `turn/end` 派生 fork（错误/中断回合不记账）。fork 请求不再传 persona；维护提示词全文即 fork 的首条 user 消息（引擎前缀一行固定引子）。`agent/created` 用与主代理**同一源卡牌 sections** 组合子代理（fork 种子已带父会话 system 历史 —— 双代理 system 同源）、五件 `runtime*` 工具与同款 restrict/suppress。父会话查找直接读 `agent.session.header.parentSession`（旧的 session store 查找正是写三件丢失的机理）。

**wire 从此说实话。** `tailRunning` 贯通全链（引擎 state → api 投影 → 客户端垫片，客户端假面对着**服务器投影**重造 —— 教训恒在）。转写解包 `entry.event`（跳过 `transient` 行）、user 气泡只渲染 `source.kind === 'user'` 的 append 面、typing 指示改由 session snapshot 的 `running` 位驱动、`promptError`/`openError` 渲染为错误行。侧栏封面走 `readAsset(sessionId, …)` —— 工作空间封面在工作空间里，不在卡库。modules server 启动时对 `src` 晚于 `lib/client.js` 的包打 WARN：最初「所有按钮失效」的报障是静默的过期构建，不是现行代码。

**Mock LLM 日志按转写可读化。** `dsh-llm-mock-server` 默认 `--log-format pretty`：每请求一行统计（behavior/model/stream/消息数/工具数）后跟完整模型可见上下文 —— system 全文、逐条消息、工具名清单；每 result 一行 outcome。`--log-format jsonl` 保持逐行 JSON 的机器形态（管道/jq 用），酒馆测试文档按此教法更新。

## Alternatives considered

**每回合三条 durable 消息（`p, uN, p`）。** 弃：历史每回合堆积包裹行，前缀「在消息之前」只靠事件顺序而非组合表达。

**prefix/post 走运行时上下文快照（上线机制）。** 按定案弃：快照落在用户消息之后、与产品策略文案同乘，包不了当前消息，且与无关变更互相去重。

**profile 行禁用产品工具。** 弃：那是全 host 面、非每 agent；`restrict({ allow: [] })` 在 agent scope 用注册表自己的词汇声明同一不变量，且用户 patch 重启用行也拦得住。

**尾代理走 `delegation` persona。** 弃：delegation 上下文是对 subagent 的权限说明；尾代理的职责是一条具体 user 指令，system 本就与主代理同源。

## Consequences

新增 agent-subject 事件必须再生成 `packages/core/scope/src/scoped-events.generated.ts`（`pnpm run gen-scoped-events`）；漏跑即 scope invariant 套件当轮红。真实组合测试（`packages/extensions/tavern/tests/loader-composition.spec.ts`）承担组合语义的覆盖门——双代理工具面、包裹形状、同源 system、completed-only 尾代理调度、autosave、wrap 快照计数、runtime 工具写入——其中的 `sessionController` 是转发到真实 `agents` factory 的测试薄桩（BFF 装配层自身的覆盖归 `packages/api/session-controller`）。任何插件现在都能经 `agent/request-messages` 按 step 改写模型可见请求视图；loop 对派发本身不落日志，外部派生文本必须先落成 durable 快照事件，否则重建不变量被破坏——由测试与评审钉住，而非 loop 强制。修复前的旧酒馆会话被恢复时会合法重组其旧预设面（durable 历史同时驱动 `system/message` 与已存的 `agentPreset`），因此新语义的验证必须用新会话。session controller 接受字面量 `'none'` 作为显式无预设请求、类型是普通 `string`——文档化约定，不是品牌。变更模型可见面的 keyless recorded-session snapshot 仍为缺口；本轮相同事件面已由组合测试的 durable 断言覆盖。
