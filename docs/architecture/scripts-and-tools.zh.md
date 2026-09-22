# 卡脚本渲染时机与工具 schema 注入定案

2026-09-14 确认。本文记录两件定案：四个卡提示词文件的 `{{script}}` 渲染时机（含与 wrap 换轨方案三、「渲染完即存档」契约的核对），以及卡工具（`preset/tools/`）的 per-tool schema 注入设计。机制权威在 `packages/extensions/tavern/src/{prompting,tools,index}.ts`（独立仓后为 `packages/engine/src/`）；wrap 换轨的机制决策在 [independence-and-release.zh.md](../release/independence-and-release.zh.md)。「`{{}}` = 脚本执行」的统一语义与 `runtime/.chat.snapshot.jsonl` 会话快照定案（未实现）见 [card-presentation.zh.md](../cards/card-presentation.zh.md)。回合收束的卡钩子（`preset/hooks.json`，2026-09-21 新契约——同一批脚本在 main.after/tail.after 两个边界由引擎机械触发）见 [card-hooks.zh.md](../cards/card-hooks.zh.md)。

## 「渲染完即存档」契约与方案三的核对

玩家侧契约：一条玩家消息在自己的提交时刻取一次 wrap 渲染（`prefixPrompt`/`postPrompt` 的 `{{script}}` 替换结果），此后随消息永久存档；后续任何回合都不得用最新渲染重刷历史消息。方案三「提交时合成、永久留存」恰好实现该契约：渲染发生在新 `prompt` RPC 的提交瞬间，合成块随 durable 日志留存，同一回合内的后续请求与之后的所有回合都不再重渲染。这是与换轨前现状的实质差异——现状每次请求重渲染当前消息的 wrap，而历史消息从不渲染（永远裸文），以本契约衡量反而是不合格态。结论：方案三落地即满足契约，[independence-and-release.zh.md](../release/independence-and-release.zh.md) 无需为此改动。

## 四个提示词文件的渲染时机

| 文件 | 消费点 | 渲染时机 | 是否存档 |
|---|---|---|---|
| `systemPrompt` | 主/尾代理 system prompt（`tavern:card-system` 段） | 每次模型请求重读文件并重跑 `{{script}}` | 不存档 |
| `prefixPrompt`（prePrompt） | wrap prefix | 换轨前：每请求渲染、仅贴本回合最末条玩家消息的请求视图；换轨后：提交瞬间渲染一次 | 换轨后随消息永久存档 |
| `postPrompt` | wrap post | 同 `prefixPrompt` | 同上 |
| `maintenancePrompt` | 尾代理 fork 的 prompt | 现状不渲染（缺口，定案修复见下） | 修复后随子会话日志存档 |

- `systemPrompt` 不是只渲染第一次：组装点在 agent loop 的每次请求（`packages/core/agent-loop/src/agent.ts:245` 调 `systemPrompt.assemble`），tavern 的 assemble 监听器每次重读 `preset/prompt/` 并重跑脚本（`prompting.ts` 的 `renderCardTexts`）。已知后果：`{{script}}` 输出变化会改变 system prompt 前缀，使该请求起的 KV 缓存前缀失效。
- 内核合规核对（2026-09-14）：每请求重渲染不违背内核，恰是内核设计的输入路径——loop 每请求组装后经 `SystemPromptProjection.project` 把渲染结果**变更门控**地落成 durable `system/message`（`agent-loop/src/runtime-context.ts`，`latest.text === rendered` 即零提交），请求再从 admitted surface 派生、system prompt 以 node 0 进 messages（`architecture.md` 「The prompt travels only as `system/message` history」）——「先落日志、再派生请求」，动态渲染由构造满足「模型可见 ⟺ 已记录」，中途变化是一等场景（capable 路由尾部追加保留缓存前缀、incapable 路由首节点合并）。开发期另有逐字节对账不变量（`agent-loop/src/invariant.ts`）机械证明 request ≡ 日志派生；`dsh-invariants` 是开发组合、生产宿主不加载，不构成运行时负担。代价仅性能面：日志增长以渲染真变为界（输出不变零落盘）。
- `prefixPrompt`/`postPrompt` 在换轨后由「每请求刷新」变为「提交时定格」：同一回合内模型发起的后续请求（tool call 之后）也使用提交时刻的渲染，不中途刷新。
- `maintenancePrompt` 现状缺口：`startTail` 把 `readMaintenancePrompt(root)` 的原文直传 fork prompt（`index.ts`），`{{script}}` 会原样进入模型。定案修复：fork 以原文同步启动（`subagents.start` 必须在 turn-end 事件派发窗口内同步调用——必需服务的属性解析出了派发窗口即报 inactive context），`{{script}}` 渲染落在尾代理子会话的 pre-step gate（引擎全局监听器内，loop waterfall 里跑 shell 是既有合法形态）：认领消息即维护提示词，逐文本块过 `renderPlaceholders` 一次，渲染结果随子会话 durable 认领存档；主代理认领永不进该分支（origin 戳判定），玩家原文里的花括号字面量不受影响。维护提示词仍走引擎内部入队，永不参与 wrap 合成。
- 渲染唯一性约束：每个提示词文件只在它的消费点渲染一次，不允许渲染后丢弃的多余执行——`systemPrompt` 与 tool-brief 在组装点、`prefixPrompt`/`postPrompt` 只在 `prompt` RPC 提交点（`renderWrapPair`）、`maintenancePrompt` 在尾代理 pre-step（fork 以原文同步启动——必需服务访问必须留在 turn-end 事件派发窗口内；渲染由引擎全局 gate 监听器对该认领消息做一次，随子会话 durable 认领存档）。
- 渲染执行参数（2026-09-14 定案）：单脚本超时 1 分钟；tavern 层不设输出截断（executor 配置的输出上限是部署级边界，bash-local 缺省 64KB）。失败的结构化上报：`renderPlaceholders` 返回 `ScriptRenderFailure`（missing/exit/timeout/abort），失败占位符仍原样保留（模型侧 fail-visible 不变）；提交路径把失败附在 prompt RPC 结果的 `scriptFailures` 上，客户端 toast 报出失败名单（systemPrompt 与维护路径无客户端界面，失败走宿主日志 warn）。可停（2026-09-14 全链定案）：① 卡工具 bash 贯通 `exec.signal`——取消回合杀死在跑脚本；② 引擎新 `stop(sessionId)`——主回合 `agent.cancel({kind:'user'}, {keepInbox:true})` + 在途尾代理 fork 子会话按 `parent` 取消（`tailRuns` 持 abort 句柄与子会话 id；`stop` 落在 `subagents.start` 解析前的竞态由 start 后的 aborted 复查兜住——刚孵化的子会话即刻取消；无 keepInbox 的子会话取消同时丢弃队列中的维护提示词），空转时 no-op；被取消的主回合以 `aborted` 收束、不排尾代理（onSessionEvent 只认 `completed`，REAL 用例钉死）；③ 提交 signal 与组装回合 signal 贯通 `shell.run`；④ 客户端发送键在运行/在途/尾代理期间即停止键（点击 abort 自身提交 signal + 调 `tavern.stop`），Enter 排队路径依旧锁死。停止的完整链 = LLM 流中止 + pre-step/tools waterfall 信号 + 卡工具 bash 进程杀死 + 尾代理 fork 子回合取消，回合以 `turn/end reason.kind='aborted'` 收束。

## 卡工具 schema 注入（方案 A：`.sh` 内嵌 schema 块）

先解释模型侧的落点：每次模型请求携带一个 tools 数组，每条目 = `{name, description, parameters(JSON schema)}`。tavern 今天注册进该数组的是 `executeTools`——一个泛化入口，它的 parameters schema 只有 `{tool, args}` 两个字符串；卡里每个 `.sh` 脚本**没有**自己的条目，参数约定只以 `-h` 自由文本出现在系统提示词的 `tavern:tool-brief` 段（mtime 缓存，`prompting.ts` 的 `renderToolBrief`），模型要调脚本必须走 `executeTools{tool:"名字", args:"整条命令行字符串"}`。改动后**每个脚本都是 tools 数组里的独立条目**，与 `runtimeRead` 等固定工具平级（不是塞进 `executeTools` 的 schema），模型直接以具名参数调用；`executeTools` 泛化入口整体删除。

定案：schema 内嵌在 `.sh` 文件头部——`#!` 行之后、首个非注释行之前的一个标记注释块（`# @tavern-schema` 起、空行或首个非注释行止，剥行首 `# ` 后解析为 JSON），单文件自足，不引入第二个文件（sidecar 式 `<name>.schema.json` 旁挂文件被否决）。宿主读文件解析，不执行脚本——比「`--schema` 输出 JSON」约定好：注册组合不为取 schema 付 N 次 bash 进程，坏脚本也拖不住组合；`-h` 保持人类可读帮助，不与机器格式混载。

- 内嵌块含 `description` 与 `parameters`；`parameters` 用工具参数 DSL（隐式 object 根、逐属性 `required: true`、`description`/`title`/`default`/`examples` 注解、`enum`/`const`/`items`/`oneOf`/`additionalProperties`/`json`），与 `defineTool` 的 `parameters` 同形。引擎经 `parameterSchemaSpecToJsonSchema`（`packages/core/tools/src/schema.ts:449`）编译并校验：带标记但内容非法 → 注册时抛错（misconfiguration fails loud；组合期抛 = 会话创建失败，会话中途编辑引入 → 该次组装抛、请求失败可见）。无标记的脚本自动获得泛化条目——`{args: string}` 参数 + 静态描述，`-h` 用法说明经收窄后的 tool-brief 段继续承载——老卡零迁移，且调用路径与带 schema 工具完全一致。
- 工具名 = `.sh` 文件名去扩展名，单一事实源，内嵌块不重复声明；与已注册工具（`runtime*` 家族等）重名时注册抛错（`packages/core/tools/src/index.ts:720`）。
- 生效时机：内核在 assemble waterfall **之前**收集 tools 数组（`system-prompt/src/index.ts` 的 `assemble`），组装点重同步天然晚一拍——故生效路径分两层：引擎的所有 preset 变更点（导入/建卡/编辑/取消/`writeText` 命中 `preset/tools/`/`fileOp`）同步调用组合时返回的重同步函数，变更当次请求即可见；每次组装点的廉价目录探测（readdir + mtime，有变才按文件 diff：退场 dispose、新增/变更注册）作为绕过引擎的带外写兜底，下次请求生效。逐请求无条件重注册被否决（抖动换不来收益）；保留 `executeTools` 当中途加脚本的逃生口也被否决（全量条目化后它只剩与真条目重复的面）。
- 输出呈现沿用纯文本（exit banner + stdout）与默认 presenter，不新增卡片面；尾代理工具面（read pair + write trio）不动。

## 测试与执行清单（2026-09-14 已全部落地）

- 单元（`tools.spec`/`prompting.spec`）：合法内嵌块注册出 per-tool 条目且 schema 进请求 tools 数组；无标记脚本自动获得 `{args}` 泛化条目；带标记但非法的块（坏 JSON、坏 DSL、与 runtime 工具族重名）注册抛错；混合目录下 tool-brief 只含无标记脚本；`executeTools` 从请求 tools 数组消失；占位符失败按 reason 结构化上报、超时用例覆盖。
- 变更同步：引擎变更点（导入/建卡/取消/编辑器写 `preset/tools/`）当次请求生效；组装点探测覆盖带外写。
- REAL（`loader-composition`）：带 schema 块卡的请求 header 断言 per-tool schema 模型可见；尾代理认领断言为渲染后文本；组合 fixture 换用 `dsh-subprocess-local`（原抽象类无 spawn——真跑 bash 才暴露）。
- 模板样例：`templates/tavern-tavern/preset/scripts/get_state.sh` + `tools/get_weather.sh`；骨架 tools/README 同步新模型。
