# Agent Note：酒馆插件独立性——组合级实现而非内核语义

Status: implemented

[English](2026-09-14-tavern-plugin-independence-core-reverts.md) | 中文

## 问题

酒馆插件消费了两个只有它自己用的内核语义：session-controller 的 `'none'` 字面 Agent preset（`bca70fe`）与 `agent/request-messages` 请求视图扩展点（`b6c28be`）。插件发布不携带内核专属语义，两者就必须退场，同时保住它们支撑的产品行为——无 preset 会话与逐回合提示词包裹。

## 决策

**组合级实现无 preset。** 酒馆 bundle 的 patch 禁用整条 per-session preset 面（`agent-presets`、`ui-agent-preset`）。引擎不请求任何 preset；session-controller 经其 `presets === undefined` 分支合成每个会话——这条代码路径比 preset 面还早。tavern 组合内该服务的每个消费者都容忍缺席（可选链、早退或不可达 UI）。

**提交期合成实现包裹。** wrap 特性保留卡片文件与导入映射，但迁移到 `tavern.prompt` RPC：尾闸门之后，引擎渲染 prefix/post 对并合成**单个 durable 内容块**——`<pre-instructions>` / `<post-instructions>` 标记对包住玩家原文——经 session-controller 正常 prompt 准入（客户端铸造 rpcId）。包裹按消息永久留存；每次请求从日志派生同一视图，UI（转写、侧栏摘要、存档摘要）按锚定边缘剥离。选单块是因为 provider 把消息 text 块直接相连、无分隔——块自身字节是唯一稳定锚点。客户端剥离在 `wrap-markers.ts` 逐字节镜像合成器（`FIXED_PATHS` 双份先例）。

**两笔内核提交 revert**（`bca70fe`、`b6c28be`）：agent-loop、agent 类型、scope 生成注册表与 architecture 文档逐字节回到插件出现前的状态；生成文件随 revert 还原，无需再生成。基线 tag `tavern-baseline-2026-09-14` 是 diff 权威。无关缺陷修复（`85e04e8`、`be8dc71`、`fcd4575`）有意随行保留。

## 已考虑的替代

- **保留内核语义**（peer 版本区间 + fail-loud 激活探测）：对随车发布可行，但把插件专属语义留在共享包里，并给每个外部部署埋下静默失效风险（cordis waterfall 监听未知事件时永不触发）。
- **整体砍掉 prefix/post 包裹**：消除插件自身的依赖理由，但丢掉有案可卡的卡片能力（酒馆卡 `pre_prompt`/`post_prompt` 导入），而组合级实现保住了它。

## 后果

玩家每回合都在最末位看到面板与硬规则；UI 永远不显示它们，刷新与存档/载入之后同样如此——剥离的证据就在日志自身。请求携带每一条历史包裹（最新一条即模型应遵从的现状）；收缩交给 compaction。任何渲染原始日志的出口（SDK、非酒馆 UI）会显示标记文本。内核面的核对是机械的：`git diff tavern-baseline-2026-09-14..HEAD -- packages/core packages/api/session-controller docs/architecture*` 恰为两笔 revert 的逆。
