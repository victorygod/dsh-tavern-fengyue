---
description: "酒馆世界卡引擎：每会话 preset/runtime/savings 工作空间、卡片提示词组装、面板维护尾代理与 runtime 工具族，供酒馆 profile 的维护者使用。"
kind: "package-reference"
---

# dsh-tavern-fengyue-engine

[English](README.md) | 中文

## 概述

`dsh-tavern` 是酒馆（SillyTavern 式）profile 的宿主引擎。每个酒馆会话拥有一个工作空间目录：`preset/` 存放卡片固定内容，`runtime/` 存放活世界状态，`savings/` 每个目录对应一份存档快照。引擎把卡片的提示词文件组装为 section，为主代理注册卡片工具脚本，并以 fork 方式运行尾代理——面板维护Agent——在回合之间重写 `runtime/`。你几乎不会直接触碰这个包：`dsh tavern` 负责组装，浏览器半侧（`dsh-tavern-fengyue-ui` 经 `dsh-tavern-fengyue-api`）是它唯一的另一消费方。

## 目录

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

引擎经 `packages/bundle/tavern` 挂载到 `tavern` profile，无需手动安装。其 `Config`（可在 cordis.yml 设置）有五个字段：`workspaceBase`（默认 `tavern_workspace`）、`libraryBase`（默认 `tavern_presets`）、`autosaveKeep`（每会话默认保留 10 份快照）、`editReadCap`（编辑器单次读取默认 10 MB）、`editWriteCap`（编辑器单次解码后的资产写入默认 10 MB）。

<a id="understand-the-implementation"></a>
## 理解实现

- **工作空间布局与卡片** — [workspace.ts](./src/workspace.ts) 创建骨架、导入卡片（目录、酒馆 JSON、就地草稿）、从 `preset/setup/` 播种 `runtime/`、快照到 `savings/`，并执行 `FIXED_PATHS`：区域根目录、骨架目录、`preset/meta.json` 与四个提示词文件可为空但绝不可删除或重命名。封面上传经 `writeAsset` 落盘——base64 解码、扩展名白名单（与读取路径的 MIME 表同源）、字节上限、围栏限制在 `preset/` 内。autosave 行名是本地可读、精确到秒的时间（`autosave-2026-09-14-01:22:28`，同秒碰撞加数字后缀）；存档行按目录写入时间排序，命名形态换代不会歪曲 autosave 环形裁剪。每个带戳存档（手动与自动）在边界账本里记录简介与输入框草稿——自动存档两者都是被提交的那条消息，因为引擎在**玩家点击发送的一刻**盖章（尾代理闸门放行后、消息落盘前）：快照即发送前的世界，`retryPoint` 换绑回该边界并重发保留的原文；手动保存盖的是屏幕上的草稿（可为空）且不作重试点。两个字段都展示在存档行上。meta 契约携带可选的 `creator` / `version` / `tags` 身份字段（宽容解析：类型不符或为空即缺席——旧三字段卡读形不变）；客户端保存时把身份行合并回文件里的原始 JSON 对象，身份头不编辑的字段永不因编辑而丢失。
- **提示词组装** — [prompting.ts](./src/prompting.ts) 把卡片的 `preset/prompt/` 文件与 `{{script}}` 模板变成提示词 section，并在 section 边界上做每回合预渲染缓存。
- **工具面** — [tools.ts](./src/tools.ts) 把 `preset/tools/` 下每个 `.mjs` 脚本（node 模块）注册为主代理自己的工具条目：头部 `@tavern-schema` 块注释（JSON 的 `description` + `parameters`）声明具名参数，经全局 `args` 对象到达脚本；无标记脚本自动获得泛化条目，参数字符串收在 `argv` 数组。引擎在 preset 变更点同步该工具面、并在每次组装点重新探测；尾 fork 在自己的 scoped context 上拿读对与写面：`runtimeWrite`（建档/整档覆盖写）+ `runtimeEdit`（old_str→new_str 精确替换＋replace_all）+ `runtimeDelete`（路径围栏 runtime/，.json 落盘前整档 parse 校验）。读对与写对声明 parallel-safe——内核同帧滚动池并发执行，写对另以逐路径串行链保同文件编辑的先后。
- **生命周期** — [index.ts](./src/index.ts) 维护会话到工作空间根目录的映射（持久在 `.tavern-session`，启动时重建），用在途尾运行闸住 `agent/pre-step`，经 `stop` 停掉一个会话的全部在途活动（主回合取消且保留排队输入、尾代理 fork 子会话按 parent 戳取消、在跑卡工具 bash 经转发的执行信号杀死），并供出 remote 命名空间暴露的整个表面。写卡助手会话（持久在 `.tavern-writer`，启动时重建）组合为默认 dsh agent——产品 section 与工具面原样保留——外加 scoped 的 `tavern:writer-guide` section、一个拒绝 shell 与委派族**执行**的 guard（schema 仍可见；被拒调用返回 isError 工具结果）以及审批策略 `never`。
- **种子账本对账** — [inbox-repair.ts](./src/inbox-repair.ts) 勾销 fork 种子切点切断的 inbox 队列账目：玩家在切点前排队的消息以"已入队"记录进种子、其"已认领"记录落在切点之外，子会话否则会把这条已被父会话消费的消息当作自己的第一个回合重跑（载入存档的「被回滚的消息被重发」）。引擎在每个子会话首次认领前追加持久注销——范围严格限定种子区，保留源会话仍真实在途的输入（fork 源的 `livePendingIds`），绝不触碰 own 区送达的内容（尾代理的维护提示词）。

## 开发备注

编辑器文件操作直接跑在宿主 fs 上：`dsh-fs` 能力只暴露文本读写而没有删除/移动操作，且这些路径都不是面向模型的。尾 fork 在首回合从主代理派生，因此对维护提示词的卡片编辑要到下一个会话才到达 fork。

<a id="model-experience"></a>
## 模型体验

### 卡片提示词 section 与模板脚本

#### 模型看到什么

卡片的 `systemPrompt` 与 `postPrompt` 文件原文，加 `{{scriptName(args)}}` 占位符展开为以会话 `runtime/` 为工作目录运行的 node 脚本 `preset/scripts/<name>.mjs` 的 stdout；脚本失败时占位符原样保留。每条玩家消息以**原文纯文本**落账，其后恰好跟着**一条动态注入的 post 消息**：`postPrompt` 渲染体经 pre-step 瀑布以 plugin 归属的 user 消息骑载落账，上一回合的 post 由同位置的空内容 system 节点影子化退场——历史恒为干净的 u/a 交替加一道活态 post。尾 fork 继承同一道 post 的同构视图，加卡片 `maintenancePrompt` 原文作为它的 persona section。

#### Token 影响

直接且随数据变化：三个提示词文件每次请求计一次，脚本输出替代各占位符计数，活态 post 消息每次请求计一次，维护提示词在 fork 请求中计一次。卡片越大，每个酒馆请求都变大。

#### KV Cache 影响

提示词 section 在回合边界缓存内前缀稳定；每回合视图在上一条玩家消息之后分叉（旧 post 原位退场、新 post 尾部追加），prefill 复用顶到上一条 player 消息为止——2026-09-16 设计拍板接受。读取 `runtime/` 的脚本会在状态变化时重渲染其段，替换同位置的更早请求 token。

### 工具面

#### 模型看到什么

`preset/tools/` 下每个 `.mjs` 脚本一条条目——带 `@tavern-schema` 块的用具名参数（全局 args 对象），否则是泛化 `argv` 数组——加六个 `runtime*` 操作，以 schema 描述；完整参数文本在 [tools.ts](./src/tools.ts) 的定义里，不在生成的目录条目中。

#### Token 影响

两个固定 schema 块（runtime 读对）加每卡工具脚本一条，数量随卡片自有工具集伸缩。

#### KV Cache 影响

会话开始时 append-only，其后前缀稳定；编辑卡片不会重写已发送的 schema。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

不发布 invariant companion：所有 tavern 观察面（会话绑定、卡片状态、存档）都从唯一的 `TavernRuntime` 工作空间表与磁盘派生，不存在可分歧的独立侧写。

- **client bundle 重启才刷新** — 模块服务在进程启动时快照 `lib/client.js`；重建的 bundle 只有重启 `pnpm dsh tavern` 后才到达浏览器。
- **`FIXED_PATHS` 存在两份** — 引擎持有策略；客户端只留一份副本用于塑造右键菜单，两者必须同步移动。
- **清空换绑而不改写** — `reset` 保持只追加日志不动：工作空间换绑到全新会话（空历史、`runtime/` 重播种、`savings/` 保留），旧会话的持久日志解绑留档。
- **记账行持久可恢复** — 转写的记账行来自主会话日志的 durable `subagent/catalog`（每 fork 一条）；expanded body（工具调用/收尾文本）在展开时经 `tailTranscript` 从子会话日志派生（in-flight 子会话读注册表、已归档的走 `sessionQuery` 冷读——缺查询面时行为值 `'archived'`，行本身不撒谎）。
- **卡脚本 = node 模块（`.mjs`）** — 经 shell 中立的 `node -e` data-module runner 执行（脚本与参数双 base64），同字节三平台一致;执行失败以结构化 `scriptFailures` 呈现，不静默。旧 bash 卡脚本（v1）不再执行，需迁移为 `.mjs`。存档命名为纯短横线格式，三平台文件系统都安全
- **wrap 时代标签残留于旧日志** — 动态 post 注入（2026-09-16）之前的会话在 durable 玩家消息里携带带标记的指令块；浏览器侧锚定剥离（`wrap-markers.ts`）保留为显示 shim，保证旧日志可读。仅当重新界定历史合成契约本体时才改动它。
- **退役的 `prefixPrompt` 文件是死数据** — 2026-09-16 之前制作的卡可能仍带非空 `preset/prompt/prefixPrompt`；引擎不再读取。手动把内容并入 `postPrompt` 后删除该文件即可。
- **空 system 影子节点持续累积** — 每道注入的 post 都由一条空内容 `system/message` 事件原位影子化其前任（每回合约几十字节），wire 侧投影为零；轨迹类调试视图会显示为空行。
- **新增 agent 事件需再生成 resolver** — 任何位置新增 agent-subject 事件都要 `pnpm run gen-scoped-events` 刷新 `packages/core/scope/src/scoped-events.generated.ts`；`verify-scoped-events`/测试会抓漏。
