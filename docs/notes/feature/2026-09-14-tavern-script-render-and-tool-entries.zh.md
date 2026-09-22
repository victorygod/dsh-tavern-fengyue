# Agent Note：卡脚本在唯一消费点渲染一次，每个工具脚本成为一等条目

Status: implemented

[English](2026-09-14-tavern-script-render-and-tool-entries.md) | 中文

## 问题

wrap 换轨到提交时合成之后，`renderCardTexts` 仍在每次组装时渲染 prefix/post 文件并丢弃结果——卡片的 `{{script}}` 模板每请求白白重跑 bash，`get_state.sh` 每请求至少执行两次（一次死功、一次提交点）。`maintenancePrompt` 则从不渲染：`startTail` 把文件原文直传 fork prompt，`{{script}}` 原样到达模型。卡片的 `preset/tools/` 脚本没有自己的模型可见契约：一个泛化 `executeTools{tool, args}` 条目承载所有脚本，用法全靠系统提示词里 `-h` 的自由文本。

## 决策

**每个提示词文件只在唯一消费点渲染一次。** `renderCardTexts` 收窄为 `{system, toolBrief}`——prefix/post 只在提交点由 `renderWrapPair` 渲染。维护提示词在尾代理子会话的 pre-step gate 渲染：fork 以**原文**同步启动（必需服务的属性解析只在 turn-end 事件派发窗口内合法——越过 await 即抛 `inactive context`），子会话认领的维护消息在此解析占位符一次，随子会话 durable 认领存档。主代理的认领永不进该分支（origin 戳判定），玩家原文里的花括号字面量不受影响。

**`preset/tools/` 下每个 `.sh` 脚本注册为自己的工具条目。** 脚本头部注释中的 `# @tavern-schema` 标记块（JSON `description` + `parameters`，解析不执行文件）给条目具名参数，经 `parameterSchemaSpecToJsonSchema` 校验——解析或校验失败在注册时抛错，随卡发布时即会话创建期、会话中途编辑时即该次组装期。无标记脚本自动获得泛化 `{args}` 条目（退役的 `executeTools` 逃生口，按脚本一个），tool-brief 段收窄到无 schema 脚本，任何工具不再被描述两遍。带 schema 的脚本以单个 JSON 字符串接收整个参数对象（`$1`，POSIX 单引号转义）；位置映射被否决——可选参数缺省会整体错位后续参数。

**工具面在引擎变更点重同步，组装点探测兜底。** 内核在 assemble waterfall 触发**之前**收集请求的 tools 数组，waterfall 内的注册天然晚一拍。因此引擎在每次 preset 变更（导入、建卡、取消、`writeText` 命中 `preset/tools/`、`fileOp`）调用 `registerMainAgentTools` 返回的重同步函数，变更当次请求即可见；每次组装点的目录探测（readdir + mtime，有变才 dispose/register）覆盖带外写入，下次请求生效。

**渲染执行：一分钟、无 tavern 层截断、可停。** `SCRIPT_TIMEOUT_MS` 为 60 秒；8KB 截断移除（executor 配置的输出上限——bash-local 缺省 64KB——仍是部署级边界）。`renderPlaceholders` 返回文本加结构化 `ScriptRenderFailure`（missing / exit / timeout / abort），失败的占位符原样保留；提交路径把它们作为 `scriptFailures` 附在 prompt RPC 结果上，客户端对失败名单 toast。提交 signal 与组装回合的 signal 贯通 `shell.run`——取消提交或中止回合会杀死正在运行的脚本。

## 落选替代

- **保留 `executeTools` 当中途加脚本的逃生口**：否决——每个脚本都成条目后，泛化路径只剩与真条目重复的面；变更点同步消除了当初需要它的时效缺口。
- **每工具一个 `<name>.schema.json` sidecar**：否决——注释块同样承载的数据多出一个文件、多出一份要同步的两件套。
- **在引擎里于 `subagents.start` 之前渲染维护提示词**：被机制否决而非偏好——渲染要 await 真 shell，越过该边界后的必需服务访问抛 `inactive context`；fork 必须在派发窗口内同步启动。
- **尾代理子会话自有 ctx 上的 scoped pre-step 监听器**：尝试后回退——监听器注册成功但其 `await next()` 永不解析，waterfall 死锁；改由引擎全局 gate 监听器（每条尾代理链上都被证明运行）承载渲染。

## 后果

wire 多了一个结果字段（`scriptFailures`），typert host 清单与 api-tavern client bundle 在同一变更内重建。loader-composition fixture 开始真跑 bash——暴露其组合注册的是抽象 `SubprocessRuntime`（无 `spawn`）而生产用 `@deepseek-ai/dsh-subprocess-local`；测试组合与 tavern devDependencies 已纠正。失败的卡脚本对玩家不再静默：提交 toast 报出失败的占位符名，宿主日志承载 systemPrompt 与维护路径的失败（请求中途无客户端界面），模型两侧看到的仍是原样占位符。
