# 插件独立性与发布形态：共享面改动处置定案

记录 2026-09-14 对「tavern 发布不依赖 harness 专属改动」目标的完整决策：四项共享面提交逐项处置、preset 的组合级替代（已拍板）、发布形态定案（已拍板）、wrap 换轨提交时合成（已拍板）。机制权威在内核与 app-boot 源码，本文是决策与验证记录。

## 四项共享面提交的处置总表

| 提交 | 内容 | 与 tavern 关系 | 处置 |
|---|---|---|---|
| `85e04e8` | ACP 配置推送幂等 + loader-smoke 环境消毒 | 无依赖：ACP 是 automation-only 传输，tavern 不走 | 保留。revert 会把 expected 套件 6 个红测试打回红（证据见 `.agents/notes/implemented/testing/2026-09-13-expected-suite-races.md`） |
| `be8dc71` | 配置型 agent 的持久化后端竞态修复 | 无依赖：tavern 会话走 `sessionController.create` 显式路径，不经声明式代理启动 | 保留（存量缺陷，tavern 开发期跑期望测试暴露） |
| `bca70fe` | 内核 `'none'` preset 语义 | 依赖：引擎 `create({ agentPreset: 'none' })` | 方案一替代后 revert |
| `b6c28be` | `agent/request-messages` 请求视图扩展点 | 依赖：唯一消费者是 wrap 特性 | wrap 换轨后 revert（方案三） |

## 方案一（已拍板 2026-09-14）：preset 用组合级禁用替代内核 'none'

背景：web-app bundle 把全部产品工具/提示段移入 per-session preset 面（`agent-presets` 行 `default: standard`），不传 agentPreset 的会话默认挂 standard；`bca70fe` 为此给内核加了 `'none'` 字面语义。发布面上 tavern 不应携带内核专属语义。

替代实现，全部走既有公开组合语义：

1. `bundle/tavern/cordis.patch.yml` 追加两行：`- id: agent-presets, disabled: true`（web-app patch 插入的 roster 行）与 `- id: ui-agent-preset, disabled: true`（General 设置里的 preset 选择行）。patch 逐层以 id 定向覆盖是公开语义，用户在自己 profile 层可重新启用。
2. 引擎 `sessionController.create({ sessionId, cwd })` 去掉 `agentPreset: 'none'`（`extensions/tavern/src/index.ts` 两处：create 与 reset/换绑）。
3. revert `bca70fe`（`api/session-controller/src/agent.ts` + `types.ts`）。该提交没有测试断言 `'none'`，revert 零测试债务。

等价性证据——tavern profile（base + web-app + tavern）组合内 `agentPresets` 服务的全部消费者逐一核过：

| 消费者 | 组合位置 | 服务缺席时行为 |
|---|---|---|
| `api/session-controller`（`agent.ts:378`） | web-app | `presets === undefined` 走 installSelection-only 分支——与 `'none'` 同一条代码分支，init 时代既有，非 bca70fe 引入 |
| `subagent/child-agent.ts:144,204` | base（尾代理依赖它） | 全部 `?.` 可选链，undefined 安然通过 |
| `host/plugin-inventory:77` | web-app | 早退返回 entries-only |
| `api/settings-controller:233` | web-app | 仅在打开 preset 目录时抛干净 RemoteError（`ui-agent-preset` 行禁用后不可达） |
| `webhook`（`static inject` 硬依赖该服务） | 不在 base/web-app 组合行 | 不激活，无影响 |
| `client/ui-agent-preset` | web-app | settings 客户端选择行 → 一并禁用 |

边界与代价：

- tavern profile 从此无任何 preset——takeover 后 UI 面无影响；其他入口创建的会话同样为裸 agent（web-app 已把 `tool-bash` 等产品工具行全部 disabled 转入 preset 面，这是 web 模型的既有设计）。
- 旧 dev 会话 observation 里存的 `'none'`：preset 行禁用下 resume 走 undefined 分支照常；若用户重新启用 presets 行，`'none'` 会 resolve fail-loud——dev 数据，可接受。
- 通用性损失：`'none'` 作为「裸内核会话」语义随 revert 退出内核，将来需要者重新提案。

验收：loader-composition 组合测试补一条（presets 行禁用时 create/reset/fork 的会话不挂 preset 面）；`dsh tavern` 手测会话正常、设置页无 preset 行、boot 无失败。

## 发布形态定案（已拍板 2026-09-14）：随 dsh 发布，`dsh tavern` 一行直达

现状事实（非新工程，均已存在）：

- `apps/cli/package.json` 依赖 `@deepseek-ai/dsh-bundle-tavern`（与 `dsh-web-app`、`dsh-webhook` 同列）——bundle 名两锚解析的第一锚即 dsh 安装本体（`app-boot/src/profile.ts` 模块头注释）。
- `PROFILE_TEMPLATES['tavern']` = `[dsh-base, dsh-web-app, dsh-bundle-tavern]`（`profile.ts:118`）。
- `dsh tavern` 子命令，与既有 `web` 别名同型（`apps/cli/src/args.ts`）。

推论：安装了包含本版 dsh 的用户 `dsh tavern` 一行直达、零安装动作（profile 首次使用自动按模板初始化）。tavern 的发布单元 = dsh 版本列车，插件式结构 + 仓库内 private 包，与 web/headless 同级的 shipped app-surface 模式。**「发布插件」的独立性诉求由「不携带内核专属语义」满足（方案一 + wrap 决策），不由「独立于 dsh 版本」满足。**

外部安装（用户自带旧版 dsh）的回退路径（机制推导自 profile.ts 组合契约，未做安装复现；正式外发前需按 README 演练）：

1. `dsh plugin --profile tavern add @deepseek-ai/dsh-bundle-tavern`——profile 首次使用自动初始化；无 shipped 模板时 bundle 列 = `DEFAULT_PROFILE_BUNDLES` = `[dsh-base]`。
2. 手编 profile 的 `package.json` `dsh.profile.bundles` 追加 `@deepseek-ai/dsh-web-app` 与 `@deepseek-ai/dsh-bundle-tavern`（web-app 的 UI 行只经 bundle 层生效，不走依赖发现）。
3. `dsh --profile tavern`。

覆盖通道：profile `node_modules` 里 pnpm 管理的包解析优先于 dsh 自有链接——外装新版本可覆盖随车旧版；换机移植 = `pnpm pack` 三包 + `dsh plugin add <tgz>` 走同一通道。

版本地板：若保留内核缝（见下节），外发插件必须声明最低 dsh 版本并在加载时 fail-loud 探测，三者缺一会静默失效。

## 方案三（已拍板 2026-09-14）：wrap 换轨提交时合成，内核缝退场

wrap 特性保留（`prefixPrompt`/`postPrompt` 文件与卡片导入映射不变），机制换轨：**提交时合成、永久留存、前端剥离**；内核缝 `agent/request-messages` 随 revert `b6c28be` 退场，插件对内核零前置。

机制依据（一句话）：无缝时请求视图恒等于日志派生，一条持久消息在所有请求里形态相同；「只包最末条 + 下一回合还原原文」是逐请求瞬态改写，恰是缝独有的能力。放弃「还原」、接受 wrap 随消息永久留存后，提交时合成即零内核等价达成。

落地形态：

- 发送路径：composer 提交原文 → 新 tavern RPC `prompt`（requestId 由客户端经 `dsh-util-crypto` 铸造、zone 本地采样，与原 session 面 prompt 同型）→ 引擎等尾闸门、宿主侧渲染 pair、单块合成、转发 `sessionController.prompt`（`commands.ts:302`；`source.rpcId = 客户端 requestId`，取证语义不变；queue 模式不变）。引擎内部入队（尾代理维护提示词）不经此路径，永不包裹。
- durable 标记（已按落地实现定形）：整条组合提示压成**单个 text 块**——`<pre-instructions>\n渲染prefix\n</pre-instructions>\n玩家原文\n<post-instructions>\n渲染post\n</post-instructions>`（`composeWrappedText`）。单块的依据：provider 把消息 text 块 `join('')` 直连，块间分隔只能由块文本自带；单块让剥离锚定在 composer 独有的边缘字节上，原文严格恒等还原，玩家引用标签不构成边缘即不分页。空 pair 只写原文。
- 前端剥离：转写渲染、侧栏 last-line、存档 summary（`lastPlayerText`）三处共用一个剥离函数——引擎 `stripInstructions`，客户端 `wrap-markers.ts` 镜像同一契约（FIXED_PATHS 先例）；剥离锚定首开头 + 尾结尾，半截标记/引用标签原样保留。渲染 pair 前先等回合尾闸门（gates），保证面板反映最新维护后的 runtime。
- tavern 删除面：`wraps` 状态机、`wrapSnapshotMessage`/wrap 快照事件、`lastWrapPairInLog`、`registerWrapRewrite`、`registerSeedRetentionWrap`、载入 fork wrap baseline、`onWrap` 链整体退场；pair 渲染逻辑留存为提交时 RPC 面。fork 种子天然携带合成消息，换绑零特判。
- 内核：`git revert b6c28be`——scoped-events 生成行与 architecture 三语段落都在该提交内，revert 一并还原（逐文件证据见下节）。
- 接受的代价：wrap 随消息永久累积在请求里（各回合面板依次留存，最新一份在最末）；FS 搜索会命中注入文本；非 tavern 渲染器（SDK、stock web UI）会显示标记块——tavern profile 下不受影响。

### 内核恢复（已逐文件验证，revert 即逐字节还原）

证据（`git log --oneline -- <file>`，2026-09-14 复核）——下列文件自引入提交后**无任何提交触碰**：

| 引入提交 | 涉及文件 |
|---|---|
| `b6c28be` | `core/agent-loop/src/agent.ts`、`core/agent/src/runtime-types.ts`、`core/scope/src/scoped-events.generated.ts`、`core/scope/tests/invariant.spec.ts`、`docs/architecture.{md,zh.md,i18n.yaml}` |
| `bca70fe` | `api/session-controller/src/agent.ts`、`api/session-controller/src/types.ts` |

两笔 `git revert` 无冲突路径，文件逐字节回到 tavern 前状态。全仓 grep 证实缝的引用面恰好 = 上述内核定义点 + tavern 两个源文件（`extensions/tavern/src/{prompting,index}.ts`），无第三方消费者；session-controller 的 `'none'` 引用面 = tavern 引擎 create 两处。

执行序（避免 revert 打断 tavern 侧引用）：

1. 先改 tavern 侧（方案三删除面 + 新发送路径 + 方案一的去 `'none'`），tavern 双包测试全绿；
2. `git revert bca70fe` → `git revert b6c28be`；
3. 验收门：`pnpm run typecheck` + `pnpm run test`（scope 不变量测试随 revert 复原）+ 终态零命中 grep（`agent/request-messages` 全仓；`agentPreset` 限 `packages/api/session-controller`）；
4. 人工核对：`git diff tavern-baseline-2026-09-14..HEAD -- packages/core packages/api/session-controller docs/architecture*` 应恰为两笔 revert 的逆 diff。

有意不还原（与 tavern 无关的通用修复）：`85e04e8`（ACP 幂等 + loader-smoke 消毒）、`be8dc71`（配置代理持久化竞态）、`fcd4575`（client-modules webServer 直传）三笔保留——revert 前两者会把 expected 套件 6 个修复用例打回红。因此「非 tavern 内容恢复如初」的精确表述：**tavern 专属内核面（`'none'` 语义、request-view 缝）逐字节还原；通用缺陷修复随版本列车保留**。

### tavern 侧架构简化（符号级核对，删除引用面全仓 grep 确认）

删除（仅 `prompting.ts` + `index.ts` 两个源文件）：

- `prompting.ts`：`registerWrapRewrite`、`registerSeedRetentionWrap`、`wrapSnapshotMessage`、`lastWrapPairInLog`、`TavernWrapPair`、`WRAP_SOURCE`/`WRAP_HEADER`/`WRAP_CLEAR_TEXT`、`wrapOne`；
- `index.ts`：`wraps` 双轨状态机（current/materialized）、`materializeWrap`（wrap 快照事件停写）、载入 fork wrap baseline、两处 listener 注册、`registerAssembleRender` 的 `onWrap` 参数；
- 保留：`registerCardSections`/`CARD_SECTION_NAME`（system 提示词路径不动）；pair 的 `{{script}}` 渲染逻辑改挂提交时 RPC。测试面：loader-composition 的请求视图断言改为断言 durable 块形态；prompting.spec 无 wrap 引用，不动。

新增（换轨成本）：tavern `prompt` RPC（api/tavern 类型 + typert 重生成 + client bundle 重建，照例 `build:lib:host`）、引擎 `renderWrapPair` 合成转发、前端共享剥离函数与三消费点接线。

### 目标达成核对

| 目标 | 判定 | 证据 / 验收 |
|---|---|---|
| 发布单元只含 tavern、内核零专属改动 | revert 后成立 | 终态零命中 grep + 只用 init 期原语（`session.append`、`system-prompt/assemble`、`sessionController` 服务面、subagent fork） |
| `dsh tavern` 一行直达 | 现状既有，零改动 | apps/cli:42 依赖 + profile 模板 + 子命令糖 |
| 面板/规则每轮注入、请求最末位 | 成立 | durable 合成消息即请求最末一条 user |
| 前端不可见（含刷新/载入后） | 成立 | 剥离依据全部持久在日志 + 唯一读取入口统一剥离；验收矩阵见下 |
| 功能面保持（载入/清空/存档/编辑卡/思考行） | 不在改动面上 | 改造仅动发送路径与展示剥离；载入换绑反而删特判 |
| 载入幽灵修复（inbox-repair）不回归 | 路径不变 | 转发仍走 `sessionController.prompt` 同一 inbox 入队，rpcId 语义不变 |

### 前端验收矩阵（不可见性）

1. 剥离函数单元：整块首尾完整匹配标签对才丢弃；半截标记保留显示。
2. 刷新形态：带标记的 durable `user/message` 事件流驱动转写重建（`getSnapshot` 与 `subscribe` 双入口），断言气泡/last-line/存档 summary 均含原文不含标记。
3. 载入形态：fork 种子含带标记消息，`switchSession` 全量重读后同样断言。
4. 反向：玩家原文含标签字样但不构成整块匹配 → 照常显示。

## 版本基线

2026-09-14 打 tag `tavern-baseline-2026-09-14`（指向 `7376b54`，工作树全净）：内核缝 wrap + `'none'` preset 时期的最后完整稳定态——载入 seed 账本对账、autosave 可读名与存档简介、回复期间锁发送、hygiene 收敛均已提交。它是独立性改造的对照基准：改造后按「内核恢复」节第 4 步 diff 本 tag，核对内核恢复如初。

## 执行清单（落码顺序）

1. PR-preset：两行禁用 + 引擎去 `'none'` + revert `bca70fe` + 组合测试补例 + Agent Note + 各 README 契约同步。
2. PR-wrap 换轨：发送路径改道 + 引擎按 `<pre-instructions>`/`<post-instructions>` 整块合成（requestId 透传）+ 前端共享剥离三消费点 + tavern 删除面整体退场 + revert `b6c28be`（生成文件与文档都在提交内，无需另行重生成）+ 前端验收矩阵 + 换轨决策 Agent Note。「请求最后一条 user = prefix+原文+post」断言语义不变（durable 消息即合成形态）。revert 前先改完 tavern 侧——按「内核恢复」节执行序。
3. 发布面：随车模型零代码变更；`bundle/tavern/README` 补「发布形态与外部安装」节（本文方案二内容收拢）；外装路径演练复现后再写进 README。
