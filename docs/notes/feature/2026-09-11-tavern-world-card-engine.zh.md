# Agent Note：酒馆世界卡引擎与网页面

Status: implemented

[English](2026-09-11-tavern-world-card-engine.md) | 中文

## Problem

SillyTavern 式的跑团玩法需要在 harness 上有一种卡片驱动的 RP 模式：卡库、由模型经工具维护的每会话世界状态、存档与读档、开场页，以及一块全屏的游戏界面——这些默认会话 UI 与 agent loop 都不认识。实现必须守住全插件规则：不改 `agent-loop`、不加内核钩子，浏览器半侧还要扛住客户端框架的所有守卫（inject 声明、槽位接管、Remote 信封）。

## Decision

**三包能力缝，由 bundle patch 组装。** [`@deepseek-ai/dsh-tavern`](../../../../packages/extensions/tavern/src/index.ts) 持有工作空间引擎（每会话一个目录：`preset/` 卡片内容、`runtime/` 活世界状态、`savings/` 快照）；它注册主代理的 `executeTools` 与固定 `runtime*` 工具族，并把尾代理——面板维护Agent——作为 fork，其写三件套在回合之间维护 `runtime/`。[`@deepseek-ai/dsh-api-tavern`](../../../../packages/api/tavern/src/index.ts) 把引擎暴露为 `ctx.remote.tavern` 命名空间，并从独立的 client 入口挂载生成好的客户端面，使消费方的 `remote.tavern` inject 是激活边而不是自我等待。[`@deepseek-ai/dsh-client-ui-tavern`](../../../../packages/client/ui-tavern/src/client/app/TavernApp.tsx) 以更低优先级 shadow 内建 `root` 槽，绘制整个游戏页：会话侧栏、卡库、开场页、叙事转写，以及由宿主投影（`tokenUsage`、`contextPressure`、`contextBreakdown`、`sessionStats`）供数的 composer——上下文占用环与一行式用量条。`dsh tavern` 启动该 profile；`packages/bundle/tavern` 把三行叠在 base + web-app 之上。

**固定模板路径是一条策略，只在一个地方执行。** `workspace.ts` 声明 `FIXED_PATHS`——三个区域根目录、卡片骨架目录、`preset/meta.json` 与四个提示词文件。每一项可为空但必须存在；引擎拒绝删除、重命名与以之为移动目标，编辑器右键菜单对固定项不渲染重命名/删除行（固定文件干脆不弹菜单）。新建可达三个区域；移动限定在 `preset/` 内部，且目标已占用或位于自身子树内时拒绝而不是合并。内容编辑可达 `preset/` 与 `runtime/`；`savings/` 快照只读，因为「载入」把它当作恢复的事实来源。

**会话身份以磁盘为准。** 引擎维护会话到工作空间根目录的映射，映射写入 `.tavern-session` 标记文件并在启动时重建（`restoreBindings`），重启不再孤儿化工作空间。草稿编写是 `.tavern-draft` 标记：编辑页在切走再切回后保持，「返回」经 `cancelDraft` 放弃，两条导入路径都会清掉它。尾代理闸门是两个不同的事实——`maintenanceOn`（提示词非空，一枚 chip）与 `tailRunning`（引擎在途闸门，轮询获得）——二者混用曾导致发送被永久禁用。

**Key 对话框只读存在性，永不读值。** `credentials.describe` 返回 `CredentialInfo.configured`；密钥值从不过 remote。对话框按需打开（发送预检、`MISSING_CREDENTIAL` 失败行、侧栏入口），并显示已配置判定。

## Alternatives considered

**扩展 agent loop。** 否决：loop 是文档明令不改的表面；尾代理、经 section 的提示词组装与工具注册已在插件地界覆盖全部行为。

**模型可见状态进会话日志。** 维护代理的写入落在 `runtime/` 文件并经带缓存的 section provider 进入提示词；把它们重放为日志事件只会倍增日志格式而没有回放收益——文件本身就是状态。

**用侧栏 tab 而非 `root` 接管。** 游戏页替换整个外壳（忠于原型）；tab 会在全出血的游戏界面外保留会话外壳。

**预检时把存储的 key 读回来。** 凭据缝刻意不返回任何值；`configured` 是客户端唯一可以问的问题。

## Consequences

酒馆会话依赖 token-meter 与 session-stats 投影单元（base + web-app 已挂载）；缺了它们用量条显示 0、占用环保持空态而不是报错。模块服务在进程启动时快照 client bundle，bundle 重建只在服务重启后到达浏览器——重启是每次升级路径的一部分。命名空间线材返回 `RemoteResult` 信封；`tavernRpc` 统一解包，测试假面必须造假信封而不是解包后的值——照抄客户端误读的假面能让测试全绿却在真实线材上翻车（Key 检查发生过一次，已记入酒馆开发日志）。`FIXED_PATHS` 在引擎与客户端各有一份；引擎是权威，客户端副本只负责菜单形态。
