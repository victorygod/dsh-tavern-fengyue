# Agent Note：酒馆写卡 Agent 列

Status: implemented

[English](2026-09-14-tavern-writer-agent-column.md) | 中文

## 问题

卡作者此前只能通过文件编辑器改卡。设计（edit-page-identity-and-writer-agent_zh.md ②）在编辑页右侧新增一个钉死在当前工作空间的普通 dsh agent 对话列——但同一工作空间的第二个会话不能被组合成卡代理、不能破坏 `FIXED_PATHS` 不变量、也不能在被接管的界面上为无处渲染的审批挂死。

## 决策

**第二张 Map 上的第三个组合分支。** `ensureWriter` 惰性创建一个**普通 dsh 会话**（`sessionController.create({cwd: 工作空间根})`），登记进 `writers` 映射并持久为 `.tavern-writer`（启动扫描时恢复）。该会话绝不进 `workspaces` 映射——`onAgentCreated` 的分支顺序（主 → 尾 → 写卡）保证三支互斥，写卡会话组合为默认 dsh agent：产品 section 与继承工具面原样保留，只加三件 scoped 注册——`tavern:writer-guide` section（工作空间布局事实、卡工具 `@tavern-schema` 约定、当前卡概况）、拒绝 shell 与委派族的 guard（`bash`、`pwsh`、`subagent`、`send_message`、`interrupt_agent`、`list_agents`、`list_subagent_models`、`job_output`、`job_kill`）、以及 `setApprovalPolicy('never')`。

**guard 拒执行、不拒可见性。** per-agent guard 无法把工具从模型可见面上摘掉，子进程也没有 per-path 否决缝——固定模板路径不变量靠拒绝 shell 的**执行**来维持：模型看得到继承来的 bash schema，越权调用返回携带拒绝理由的 isError 工具结果，回合照常继续。委派被拒与 shell 同理：委派出的子代理会带着全默认面重新进入 `agent/created`，而 per-agent guard 不随委派传播。

**一份共享对话面。** 转写行渲染、composer（模型席位、上下文占用环、发送/停止、用量行）与投影读取从 RP 聊天抽成共享模块；RP 聊天与写卡列消费同一份实现，stock 对齐类更新一次落地两处。写卡列发送走标准 client face（`binding.session.prompt`）——tavern `prompt` RPC 是 wrap 对专用通道——停止走 `binding.session.cancel`（引擎的会话级 `stop` 是 RP 专属：卡工具子进程与尾代理 fork）。

## 已否决的替代方案

- **用 `tools.restrict({allow})` 代替 guard**：能把 shell schema 从模型视图摘掉，但把 writer 的工具面冻结在今天的白名单上——未来的产品工具将静默地永远到不了 writer。guard 拒执行的同时完整继承产品面的演化。
- **用 fork 形态（尾代理那款）**：fork 是一次性、带种子的；writer 是跨 清空/载入/编辑 换绑持续存在、可交互的会话。

## 后果

writer 的引导文本**按构造不含双大括号**——section 文本里的字面 `{{name}}` 会撞上内核严格插值层直接抛错（卡提示词能活下来是因为主/尾的 assemble 监听先渲染了占位符；writer 没有这个监听）。agent 落盘经 2 秒轮询到达编辑器（树结构、meta.json、以及仅在文本框未聚焦时重读的当前打开文件）；编辑器 RPC 写 `preset/tools/` 同请求重同步主代理工具面，而 writer 用 fs 工具的落盘在下一次组装才重同步——晚一个请求。拒绝清单是维护者契约：新增 shell 或 subagent provider 时必须扩充。
