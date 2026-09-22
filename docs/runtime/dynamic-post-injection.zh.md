# wrap 退役 → 动态 post 注入

2026-09-16 定案（已实现）。本文固化四项拍板：**wrap 方案（提交期把 prefix+原文+post 合成单块 durable 消息）退役**；**`prefixPrompt` 提示词文件退役且引擎不再读取**（ST 导入的 `pre_prompt` 与 `post_prompt` 合并写进 `postPrompt` 文件——「原 pre 内容进 post 消息」由导入合并承建）；**postPrompt 保留**，成为 DSH 原生「最后一个 user 轮后动态附加 user 消息」机制的渲染模板；**KV 缓存影响明确接受**（每回合视图在上一条 user 之后分叉，prefill 命中范围回退）。改动全落 tavern 三包，内核零改动。

机制权威：[design.zh.md](../architecture/design.zh.md)（总叙述）、[scripts-and-tools.zh.md](../architecture/scripts-and-tools.zh.md)（`{{script}}` 契约）。本文落地时需同批反转：design_zh.md 的提示词表（四张→三张）、`prefixPrompt`/`postPrompt` 行、「运行流程」请求视图段、`[system, u1, a1, …]` 表述；st-card-field-mapping_zh.md 的注入落点表述（§2/§4.2/§4.3）已随本文先行修订。

## 1. 为什么换

wrap 把卡作者指令**烘焙进玩家的 durable 消息文本**：历史里每条玩家消息永久携带各回合的标签段（模型旧指令无法退场）、前端四处内容都要锚定剥离、玩家原文与作者指令在 provider 视图里混于一体。ST 语义本无重概念——`post_history_instructions`（depth-0 注入）是**每次请求新鲜渲染的独立 user 消息**，不进玩家消息、旧指令不留存。动态注入把这两个彻底分开：玩家 durable 消息恒为原文，post 每回合独立成段、贴在最后一条 user 之后、上一回合的 post 退场。另外 ST 的 `pre_prompt`（玩家消息前的指令）在同机制下没有独立落点（DSH 无「user 轮之前」的插件缝），并入 postPrompt 头部。

## 2. 机制地基（逐项对代码取证）

1. **注入缝 = `agent/pre-step` waterfall**：loop 每步开局 `inbox.claim` 后派发（`packages/core/agent-loop/src/agent.ts:244-250`），payload 含 `messages`（本次 claims）、`turn`、`step`、`signal`；监听器返回的 `decision.messages` 由 loop 逐条 durable 追加 `user/message` + `surfaceOp:'append'`（`agent.ts:373-377`），请求从 admitted surface 派生——「模型可见 ⟺ 已记录」构造成立。**claims 的追加发生在 step() 内、pre-step 结束之后**，因此注入器里直接 `session.append` 的任何消息都会排在玩家消息**之前**——post 想贴在最后一条 user 之后，必须骑 `decision.messages`，这是本协议的锚点事实。
2. **`user/message` 直接追加时机**（同上 `agent.ts:374-377`）：`firstAttempt` 每步一条批，批内顺序 = `decision.messages` 数组顺序 → `[claims…, posts…]` 的 ride 次序即落账次序。
3. **`surfaceOp: replace` 是原位替换**：`state.nodes.splice(plan.startIdx, plan.endIdx - plan.startIdx + 1, plan.seq)`（`packages/core/session/src/surface.ts:469`）——替换节点**顶替旧节点在 surface 序列中的位置**，不是追加到尾。上文已 revert 的请求视图改写缝与此无关：replace 的影子范围、替换节点全部入账，任何重放按同一 fold 复原视图。
4. **空内容 `system/message` = 内核自有的影子删除器**：空内容消息「keeps surface position, projects to no wire message」（`surface.ts:113-117`）；`SystemPromptProjection.project` 维护唯一活跃 system 节点用的就是这招——head 原位 replace、其余旧节点 replace 成空内容（`packages/core/agent-loop/src/runtime-context.ts:88-102`）。该投影对空节点惰性（`findLast`/`filter` 均按 `text !== ''` 排除，head 永远是位序第一的真实 system 节点），插件产出的空 system 节点对其不可见。`createSystemMessage('', plugin)` 公开可用（`packages/llm/llm/src/message.ts:238`）。
5. **fork 种子原样拷贝**：`seed: source.events.slice(0, cut)`（`packages/api/session-controller/src/commands.ts:263`），含全部 surfaceOp 标记；子会话按同一 fold 重折叠，**已有的影子关系（旧 post 已删除）与活态（最新 post）原样重现**。时序锁：fork #N 的种子捕获（`subagent-fork-in-process/src/index.ts:48-53`，`slice(0, findLast(turn/end).seq + 1)`）必然先于回合 N+1 的影子化——影子化事件在 `turn/start N+1` 之后的 turn N+1 区段内，整个落在 cut 之外；且 `startTail` 在 `turn/end` 派发内同步 `gates.set`（`index.ts:1034`）、每条提交都 await 闸门（`index.ts:356-357`），父会话开不了晚于种子捕获的新回合（结构性保证，非时序侥幸）；种子本身是一次性拷贝（`index.ts:85-88` 契约注释），父会话后续变化不传播。
6. **注入触发 = 本步有 claims**（`payload.messages.length > 0`），不仅 step 1——中途排队（steering）消息在后续 step 被认领时同样获得 post（wrap 时代每条提交都带 wrap，此处对齐）；无 claims 的工具循环 step 跳过注入，已有的 post 节点继续 live、后续请求仍然可见（等价 ST depth 注入的「每次请求都在」）。
7. **注册必须全局 + 运行时分支**：scoped agentCtx 的 pre-step 监听器曾把 waterfall 链卡死在 `await next()`（devlog 2026-09-14 e20cc70 遗留），现役引擎 gate 监听器即全局注册（`packages/extensions/tavern/src/index.ts:141`）。注入器同款：`workspaces.has(session.id)` 且非 subagent origin 才是主代理；尾代理/写卡 agent 分支原样放行。
8. **尾代理的 system 恒唯一**：子会话种子携带父代 system 节点；子代装配 renders 同一张卡 → `SystemPromptProjection` 把 head 文本与当前渲染比对，一致零提交、不一致原位刷新（`runtime-context.ts:88-92`）——尾代理请求视图永远只有一条 system。唯一字节级不确定因素：systemPrompt 的 `{{script}}` 值在父末次装配与子装配间可能变化，此时发生的是 head 原位刷新而非追加。
9. **`maintenancePrompt` 链路不变**：`subagents.start('fork', { prompt })` 投递原始文本（`index.ts:1019-1024`）→ 尾子会话 claims 由全局 gate 监听器渲染 `{{script}}`（`index.ts:1090-1098`）→ 尾代理回合不强求 post（注入器分支不命中）。

## 3. 注入协议（改造后行为）

引擎每会话新增一个状态：**stash（FIFO 队列）**，随会话建绑、换绑/清空与 `clientTimeZones` 同款清理。每次 `tavern.prompt` 通过尾闸门后：**渲染 post 消息体 = `postPrompt` 文件的单一 `{{script}}` 渲染**（`prefixPrompt` 完全退役——引擎不读取，遗留文件是普通死数据，旧内容手动并入 `postPrompt` 或删除；「原 pre 内容进 post 消息」由 ST 导入的文件合并承建），玩家原文**原样**转发 `sessionController.prompt`（durable 消息恒为单块原文，无标签），渲染值入 stash 队尾（含空文本条目占位，保 FIFO 与 claims 对齐）。

全局 pre-step 监听器（主代理分支）在每个**有 claims** 的 step，对 decision 收尾前执行：

1. **影子化旧 post**：扫 `session.surface.nodes` 尾部向前收集所有活态 post 节点（`user/message` 且 `source.kind === 'plugin'` 且 `plugin` 为引擎名——影子化节点已不在 `surface.nodes`，扫描天然只见活态；fork/载入后扫描同样成立）。对每个活态节点直接 `session.append('system/message', { turn, step, message: createSystemMessage('', 引擎名) }, { surfaceOp: { op: 'replace', startSeq, endSeq }, sourceEventSeqs: [seq] })`——节点留在 log（可复原），从 wire 视图消失。实际恒 ≤1 个；循环写法防搬运历史异常态。
2. **post 骑载**：按 claims 顺序从 stash 队首各取一条渲染值（FIFO 对齐——两条排队提交在一步被认领时各带各的 post），构造 `createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'plugin', plugin: 引擎名, form: 'snapshot', sections: [{ name: 'post', text }] } })`，追加进 `decision.messages` 尾部；返回原 decision（loop 统一落账）。stash 为空则该 claim 不带 post（fail-soft，log warn）——正常路径不发生（每条 player 提交必经 `prompt()` 入队）。

source 形态对齐 time-context 现例（`packages/context/time-context/src/index.ts` 末段）；前端按 `source.kind === 'plugin'` 过滤即可跳过 post 行，同时又不会误伤 `agent-instructions` 的 baseline（其 `source.kind` 同为 plugin，但酒馆转写只关心玩家/叙事行，plugin 消息一律过滤是正确口径——与 stock ui-chat 的 ContextMessageNode 分类同构）。

## 4. 请求视图（N → N+1 全模拟）

设回合 N 已完成（post 已注入、回复已落地、尾代理已记账），玩家提交回合 N+1 原文 `t`，`postPrompt` 渲染值 `q`。逐步对照（log = 追加式原始账本；surface = 模型可见视图；`〔s〕` = 空 system 影子节点）：

| 拍点 | log 事件追加 | surface（wire 视图） |
|------|-------------|----------------------|
| 回合 N 已完成 | `… uN, pN(_append), aN, turn/end N` | `[system, u1, 〔s1〕, a1, …, uN, pN, aN]` |
| 尾代理 fork（#N） | 子会话种子 = 上述事件原样 | `[system, u1, 〔s1〕, a1, …, uN, pN, aN, mN]`（与主代理回答时刻同构） |
| 玩家提交 N+1 | `prompt()`：盖章 autosave（draft = t）→ 快照 pending 行 → 渲染 q 入 stash → 转发原文 | 会话无变化 |
| `turn/start N+1` → claim | `turn/start` | 同上 |
| pre-step（注入器） | **直线 append** 空节点 `sN`（replace pN → 占 pN 原位） | `[system, u1, 〔s1〕, a1, …, uN, 〔sN〕, aN]`——旧 post 退场 |
| step() 提交批 | system 原位刷新（同文零事）→ claims `uN+1` → 骑载 `pN+1` | `[system, u1, 〔s1〕, a1, …, uN, 〔sN〕, aN, uN+1, pN+1]` |
| 回复 N+1 | `aN+1` 落账 | `[…, uN+1, pN+1, aN+1]` |

回合 N+1 的请求视图 = `[system, u1, a1, …, uN, aN, uN+1, q(rendered)]`——历史恒为干净 u/a 交替、当前回合唯一一道 post 贴在最后一条 user 之后，即拍板视图。再下一回合完全同理（pN+1 被 `sN+1` 影子化）。影子节点的空 system 事件在 log 中持续累积（每回合一条，数十字节级），其唯一可见面是轨迹类调试视图里的空行。

**尾代理（fork #N+1）**：种子截至 `turn/end N+1` → 视图 `[system, u1, 〔s1〕, a1, …, uN, aN, uN+1, pN+1, aN+1, mN+1]`——仍与主代理回答时刻同构，仍只一道 post。已归档的旧尾子会话（fork #N）带的是当时的 pN，互不干扰（一次性会话，无后续）。

## 5. 相关行为影响（逐项核过）

- **发送时刻 autosave / 重试点**：不变（盖章仍在 `prompt()` 内、durable 落账前；`draft` 恒为玩家原文）。
- **重试 ↻ / 载入存档**：fork 边界语义不变；边界前的旧 post 在种子中维持**活态或影子态与其被切时刻一致**（发送时刻边界切在 turn 内消息落账前，§4 第三行），重发原文后新回合正常影子化。**渲染时刻唯一 = 发送**：载入本身不渲染任何 post（fork + runtime/ 恢复 + draft 回填三件事），种子带来的活态旧 post（如 p_{N-1}）保持原样、无害于无请求状态；重发在发送时刻**新鲜渲染**（读恢复后的 `runtime/`，非确定性脚本重掷——wrap 时代重试本来就是重渲染，无行为差异），注入器在本轮首个注入点影子化旧活态、骑载新渲染值。存档不携带已渲染值（渲染值只存在于 stash 与 durable 事件两处）。**wrap 修复逻辑下线**：`repairSeedInbox` 不再承担标签剥离，账本残项修复保留（与 wrap 无关的 inbox 对切断修复仍在）。
- **保存 / 清空 / 草稿恢复**：无 wrap 拼字，`lastPlayerText`/summary/转写全是原文；旧 wrap 时代日志的 `stripInstructions` **保留为纯显示兼容 shim**（锚定正则对干净文本 no-op）。
- ** stops 键 / abort**：post 渲染仍在提交期（abort 杀 bash 不变）；回合 abort 与影子化无交互（影子化发生在下一步注入点）。
- **startsSeries 头事件噪声**：影子化 replace 会 bump `replaceGeneration` → 该 step 的 `request/header` 以 `reason:'series'` 追记一条（`agent.ts:568-581`）。无语义影响（tavern 无 preparedCall，series 只影响 in-history 重定基），属于可见 log 噪声，接受。
- **尾代理/写卡 agent**：注入分支不命中（§2.7）；各自回合与组装链路零变化。

## 6. 改动清单

- **引擎（packages/extensions/tavern）**：① `prompt()` 删 `composeWrappedText` 组装，内容恒原文；`renderWrapPair` 收窄为 `renderPostMessage`（`postPrompt` 单一渲染；`prefixPrompt` 完全退役不读，§3 原则），`scriptFailures` 返回链不动。② 新 pre-step 全局监听器（主代理分支：影子化 + stash 骑载）。③ `FIXED_PATHS` 四件→三件；`prefixPrompt` 降级为普通可删文件，**引擎零读取**（新卡/新导入不再生成它）。④ stash FIFO per session，换绑/清空时与 `clientTimeZones` 同款清理。
- **客户端（packages/client/ui-tavern）**：`stripInstructions` 消费点改 `source.kind === 'plugin'` 过滤（shim 保留兜旧日志）；转写/侧栏/存档 summary/快照 `plain` 四处同口径。ST 导入映射（`TavernView.tsx:646`）：`pre_prompt` + `post_prompt` → 同一 `preset/prompt/postPrompt` 文件（pre 前后空行分隔），prefixPrompt 映射行删除；模板骨架 `templates/tavern-tavern/preset/prompt/prefixPrompt` 删除。
- **wire（packages/api/tavern）**：无变更（`prompt` RPC 签名与 `scriptFailures` 不动）。
- **测试**：`prompting.spec` 的 compose/strip round-trip 改为「影子化 + 骑载」形态断言（空 system 事件、骑载次序、FIFO 消费、abort、legacy 前段拼接口径）；`loader-composition.spec` 的 durable 块形态断言改 post 事件形态；recorded-session snapshot 重录；新增 REAL 用例钉死 §4 的回合 N+1 视图与尾代理种子视图（当前无测试覆盖「尾代理看到的形状」）。
- **文档随批**（本轮全仓扫描补齐）：`packages/extensions/tavern/src/prompts/writer-guide.md`（写卡引导对提示词结构的描述）、tavern 包双语 README 的 Model Experience 机制段、`st-import-work-order_zh.md` 的 USER_INPUT 挂点措辞（prefill/post → 单一 post 注入段）、design_zh.md 反转（实现落地同批）。
- **波及面核对结论**：快照行派生（`writeChatSnapshot` 扫 durable 日志）必须过滤 plugin post 行——过滤后的 `plain` 是主代理 `{{script}}` 与尾代理读档的共同口径；ContextMeter/用量数字会把 post 计入 user token（观感差异，无动作）；复合记账行 `tailTranscript`（子会话 durable 派生 tool 动作+收尾文本）与 `subagent/catalog` 事件不受影响；停止/abort/Esc/草稿/卡编辑/工具注册/api wire/typert 全部无交互。
