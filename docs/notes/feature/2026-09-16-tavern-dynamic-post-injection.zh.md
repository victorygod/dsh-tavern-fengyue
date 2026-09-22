# Agent Note: 酒馆 wrap 退役——动态 post 注入

Status: implemented

[English](2026-09-16-tavern-dynamic-post-injection.md) | 中文

## 问题

卡作者每回合的指令文本在提交期被合成进玩家的 durable 消息：`<pre-instructions>` / `<post-instructions>` 标签块在单个 content 块内包住原文，且每条提示永久携带各自回合的渲染对。后果：过期指令永远无法退出模型视图、展示侧要在四处做锚定剥离、玩家的原文在 provider 边界与作者指令无法分离。SillyTavern 语义（depth-0 注入——每回合一条新鲜、独立的指令 user 消息）没有原生缝。同批收敛两个卡契约问题：`prefixPrompt` 找不到「user 轮之前」的原生对应位（DSH 插件只能附加在最后一条 user 之后），而固定文件集强保的文件在新设计下将不再作为位置渲染。

## 定案

**一条动态注入的 post 消息取代 wrap。** 引擎在提交期渲染 post 体（`renderPostMessage`——legacy `prefixPrompt` 前段拼在 `postPrompt` 之前，两段各自独立占位符渲染，预算与 `scriptFailures` 归属按文件分开）进每会话 FIFO，玩家**原文**经控制器转发。每个有 claims 的 step，一个全局 `agent/pre-step` 监听器（仅主代理分支；scoped agentCtx 的 pre-step 监听器曾把瀑布链卡死）做两件事：把每个活态 post 节点**原位影子化**——由空内容 `system/message` 事件 replace 顶位，这是内核 `SystemPromptProjection` 自己的单活节点模式（入账、wire 零投影、对投影的 `text !== ''` 过滤惰性）；再把 stash 里的渲染值追加进 `decision.messages`，由 loop 紧跟认领的玩家消息落账。结果是定案视图 `[system, u1, a1, …, un, postn]`：历史恒为干净 u/a 交替、恰好一道活态 post；`surfaceOp: replace` 是公开缝（"any surface-replacing producer may use it"），模型可见内容全部有 durable 支撑。

`prefixPrompt` 退出固定件集（现为三件固定提示词），降级为渲染器仍会读取的普通可选文件——退役前的卡内容零迁移继续生效。ST 导入把 `pre_prompt` + `post_prompt` 合并进单一 `postPrompt` 文件（pre 前置、空行分隔）。显示消费点从标签剥离改为 `source.kind === 'plugin'` 过滤；剥离函数保留为让 wrap 时代日志可读的 shim。REAL 套件钉死全部被质疑的机制：回合 N+1 驱逐、fork 种子的单活 post 尾视图、存档点载入的活态 post 复原、清空、停止三态，以及记账对账从 wrap 修复职责脱钩。

## 已否决的替代

- **只骑载新 post、不做影子化**（time-context 的累积形态）：否——过期的面板指令会堆进之后每次请求，偏离每回合定案语义。
- **用有实义的替换内容占据旧位置**：否——replace 是原位替换（`surface.ts` 的 `nodes.splice`），新 post 会重现于上一回合的槽位，永远追不上当前 claim。
- **渲染期合并 prefix 内容进单文件、彻底删除 `prefixPrompt`**：暂否——存量卡的 prefix 内容会静默丢失；legacy 可选读取让迁移面保持为零。
- **保留 2026-09-14 之前的请求视图改写缝**：早已否决——模型可见内容必须自日志派生；新方案由构造成立。

## 后果

内核零改动；wire 面不动（`prompt` RPC 签名与 `scriptFailures` 不变）。durable 日志每回合增长一条 plugin post 事件与（首条 post 之后）一条空 system 影子——几十字节、wire 不可见。注入 step 的 `request/header` 多一条 `reason:'series'` 行（影子化 bump `replaceGeneration` 所致）；无语义影响（酒馆无 prepared-call 的 in-history 重定基）。每回合 KV 缓存复用顶到上一条 claim 为止、不再延伸穿过上一条回复——定案时接受。旧会话经剥离 shim 回放可读；新会话全程无标签。快照行本就只投影玩家来源消息，世界书脚本与尾代理无需改动即读到干净历史。
