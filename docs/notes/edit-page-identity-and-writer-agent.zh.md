# 编辑页身份头与写卡 Agent 列——方案可行性

2026-09-14 分析定案。两件需求：① 各编辑卡入口页面顶部加**卡片身份头**——左上封面图（与卡库书架封面同比例、缩小一号）+ 右侧标题与简介两行、点击即可编辑，现有页头「工作空间」标题与编辑类控件为此让位；② 编辑工作空间右侧新增第三列成三列布局——一个**普通默认 dsh agent 对话框**（写卡助手），仅 workspace 固定为当前工作空间根，提示词注入写卡引导，权限为工作空间内可写，输入框带模型/思考强度调配。结论先行：**两项均可行，改动全部落在 tavern 三包**（`packages/extensions/tavern`、`packages/api/tavern`、`packages/client/ui-tavern`），内核零改动，唯一新增的是一条包依赖边。机制权威见 [design.zh.md](../architecture/design.zh.md)。

## 一、卡片身份头

### 布局与让位

身份头 = 左侧封面图 + 右侧两行（标题、简介），点击文本即进入行内编辑（提交形态复用树上已有的 VS Code 式行内命名输入 `nameInput`，`packages/client/ui-tavern/src/client/TavernView.module.css`）。现有 `.head` 区（「工作空间/存档」页标题、尾代理 chip、「仅保存/保存并开始」按钮）让位：标题区由身份头取代，动作按钮与 chip 收进身份头右侧动作区，不再单独占一行。

封面比例：书架封面为流宽 × 固定 130px（`.grid` 列 minmax(190px,1fr) + `.cover` height 130px，`TavernView.module.css:125-156`），比例随卡宽浮动、近似 19:13。身份头取同一观感的固定缩小尺寸（建议 120×82）；比例值提取为共享常量（CSS 自定义属性或 module 常量），书架与身份头两处不漂移。

### 入口矩阵

| 页面 | 身份头 | title/desc 数据载体 | 封面上传 |
|---|---|---|---|
| 编辑卡页（编辑态 workspace） | 有 | 工作空间 `preset/meta.json`（`readText`/`writeText`） | 有 |
| 制作卡片页（draft 骨架起步） | 有 | 同上 | 有 |
| 导入预览页 | 有 | 浏览器内存 `table.files['preset/meta.json']` | 无（见下） |
| 设置→工作空间页（当前会话） | 有 | 工作空间 `preset/meta.json` | 有 |

### 数据流

- title/desc 编辑**零新 RPC**：挂载时 `readText('preset/meta.json')` 解析；保存 = 客户端改字段后重新 `JSON.stringify` 走既有 `writeText`。解析失败（历史手改坏档）时身份头转只读展示并提示，不阻塞编辑器其余部分；引擎侧 `library()`/`sessionsOverview()` 对坏 meta 已有回退。
- 封面上传是唯一新能力：现有 RPC 面没有任何二进制写入（`readAsset`/`readLibraryAsset` 均只读）。新增 tavern RPC `writeAsset`：base64 载荷、扩展名白名单（对齐客户端 `ASSET_EXTENSIONS`）、单文件 ≤10MB（`editWriteCap`，与 `editReadCap` 预览上限同源放宽——两个上限必须同步动，否则大图传得上去、各渲染点却拒绝预览；客户端不做字节预检，引擎拒绝即弹错误，引擎是唯一权威；仍保有上限是因为 RPC 完整结果的界是仓库约定）、`fenceIn` 围栏限制在 `preset/` 内（host 半面 node:fs，与目录操作同款）；写后客户端把 `meta.cover` 置为相对路径，随 title/desc 一起回写。预览复用 `readAsset`；清除封面 = `cover` 置空串（文件可保留）。
- 导入预览页不带封面上传：该页文件表是文本 map（`commitImport` 只收文本内容），二进制无载体；落库后在编辑卡页补传。

## 二、写卡 Agent 列

### 三列布局

`CardEditor` 的 `editorLayout`（文件树 | 编辑器）扩为三列：文件树 | 编辑器 | 写卡对话列。适用 = 编辑卡页、制作卡片页、设置→工作空间页（设置模态从 880px 加宽到约 1200px，三处共用同一组件、无分叉）。**导入预览页不挂写卡列**：它的文件表在浏览器内存里，`commitImport` 落库前不存在磁盘工作空间，agent 的磁盘写入与预览表互不相通，挂了必然出现两套真相。

**挂载可见性**：列只在这三类编辑页挂载期间存在——卡库书架、导入预览、叙事聊天/开场页、存档页均不渲染、不轮询、不创建。writer 会话随首次挂载惰性创建；离开编辑页（切聊天/切会话）列随之消失，但会话在服务端存活：重新进入同一工作空间的编辑页，写卡列带着之前的对话历史回来——**对话跟工作空间走，不跟 RP 会话走**（编辑卡「保存并开始」reset 换绑 RP 会话，写卡列照旧）。

### 会话形态：普通会话，工作空间钉死

- 创建：新 RPC `ensureWriter(sessionId)`——引擎惰性创建一个**普通 dsh 会话**：`sessionController.create({ sessionId: 新 id, cwd: 工作空间根 })`，与主会话同款创建路径（`packages/extensions/tavern/src/index.ts:191`）。cwd 即工作空间根，实现「workspace 固定死的当前工作空间」。
- 红线：writer 会话**绝不写入引擎 `workspaces` Map**。`onAgentCreated`（`packages/extensions/tavern/src/index.ts:641-653`）按该 Map 把会话组合成卡代理（卡 system + `tools.restrict({allow:[]})` 收空继承面）；不进 Map 的进程内会话保持普通 dsh agent 语义（引擎模块头注释钉死：「non-tavern sessions in the same process hear nothing」）。引擎另立一张 writer 映射（sessionId→root，惯例同 `workspaces`/`gates`），落盘标记 `.tavern-writer`（镜像 `.tavern-session`，`restoreBindings` 扫描时一并恢复）。
- 组合分支：`onAgentCreated` 变三支——主（`workspaces` 命中）→ 尾（`parentSession` 归属）→ 写卡（writer 映射命中）。写卡分支只做三件事，全部注册在该 agent 自己的 `agent.ctx`（per-agent scope，其他会话零感知）：
  1. **写卡引导 section**：`tavern:writer-guide` scoped system prompt section（scoped 注册遮蔽同名全局，机制 `packages/core/system-prompt/src/index.ts:448-457`），内容 = 工作空间布局事实（四提示词是卡的主体与各自写法、`meta.json` 三字段、`setup/scripts/tools` 分工、`runtime/` 由尾代理维护勿手改、`savings/` 只读、固定四件不可删改名）+ 当前卡 title/desc 概况 + 写卡手法引导（叙事风格、面板约定、`{{script}}` 模板用法）。引导文本必须覆盖 2026-09-14 落地的卡工具 schema 约定：`preset/tools/*.sh` 头部 `@tavern-schema` 注释块（JSON `description` + `parameters`）注册具名参数工具、无标记脚本落 `{args}` 泛化条目——writer 不知晓该约定就会写出只有 `-h` 的过时形态。
  2. **审批策略**之外的守卫已全部拆除（2026-09-16，本地单用户定位）：shell 工具放行（fs 的 workspace-write 围栏对 bash 本不设防），委派族（subagent/send_message 等 7 个）也不再拒——写卡 agent 持有完整工具面、可干任何事；唯一保留的边界是审批策略 `never`（审批面在酒馆接管下不存在，需审批的动作如工作空间外的沙箱升级被静默拒绝）。
  3. **审批策略**：`setApprovalPolicy(session, 'never')`（`packages/interaction/user-approval/src/index.ts:92`，合法值 `'ask'|'never'`），理由见权限一节。
- 产品 section（`harness:identity` 等）保留不抹：写卡列就是「默认 dsh agent + 一段写卡引导」，与需求一致。wrap 渲染（`registerAssembleRender` 的两 section 过滤）与 `agent/pre-step` 尾闸门均按主/尾 agent scope 注册，writer 天然不沾；尾代理运行闸门（tailRunning）也只锁 RP 发送，不影响写卡列。

### 权限：工作空间内可写

- fs 写工具（产品默认面自带）走 sandbox `workspace-write`——这是 base bundle 的默认策略（`packages/bundle/base/cordis.patch.yml` sandbox-policy mode 默认 `'workspace-write'`，workspaceRoot = `session.header.cwd` = 工作空间根）：**工作空间内写免审批直接落盘，外部写被 `FS_SANDBOX_DENIED` 拒绝**。「工作空间内可写」零新机制，就是默认行为；读不受限（普通 agent 语义）。
- bash 为什么收掉：fs 能力只有文本读写（无删除/改名），「固定四件不可删/改名」的引擎不变量今天只由编辑器 RPC 边界（`presetFileOp`）保证；writer 若带 bash，`rm preset/prompt/systemPrompt` 一句话破防，且**无拦截点可补**——bash 是子进程，内核没有 per-path 否决缝（fs 沙箱只管能否写进工作空间，管不了工作空间内哪几个文件神圣）。guard 拒 shell 后，writer 的破坏面上限与人工编辑器同款——可改写文件内容，不可删改结构。
- 子代理委派为什么一并收：委派出去的子代理会以全默认面重新组合（含 bash），而 guard 注册在 writer 自己的 scope、不随委派传播——留委派 = bash 的后门。写卡不需要子代理，writer 按单兵设计。shell 族与委派工具的确切注册名在实现时从组合面枚举钉进 guard。
- 审批面为什么钉 `'never'`：stock 审批 UI 的呈现层住在被 ui-tavern root 接管的外壳里（ui-approval 注册的 composer 链项），writer 会话一旦触发审批会**隐形挂起**——宿主监听已认领瀑布、面板无处渲染。钉 `'never'` 后升级请求（escalation）在任何 UI 分发前被确定性拒绝并落转写错误行，fail loud 而非挂死；被拒的只有越权升级场景，对卡编辑无实际损失。备选方案（ui-tavern 自挂 `approval/request` 监听、在写卡列渲染自有审批卡）保留为后续项，需先处理与 stock ui-approval 监听的瀑布接力次序。

### 工具面：与 stock web 主 agent 的对照

writer ≈ stock 主 agent − bash − 子代理委派 + 写卡引导段；审批从 `ask` 改 `never`。

| 面 | stock 主 agent | writer | 说明 |
|---|---|---|---|
| fs 读 | ✓ | ✓ 同 | — |
| fs 写 | ✓ workspace-write（cwd 内免审批，外升级→审批） | ✓ 同机制，cwd = 工作空间根 | 「工作空间内可写」就是 stock 默认行为 |
| bash/shell | ✓ | schema 可见、**执行被 guard 拒** | FIXED_PATHS 无 per-path 否决缝；拒绝以 isError 工具结果回灌，回合继续 |
| 子代理委派 | ✓ | ✗ guard 拒 | 防绕过：子代理带全默认面（含 bash）回来 |
| web 搜索/抓取、todo 等产品工具 | ✓ | ✓ 全部继承 | — |
| 审批策略 | `ask`（默认预设） | `never` | 仅影响升级场景；日常工作空间内写与 stock 体感一致 |
| system prompt | 产品默认 | 产品默认 + `tavern:writer-guide` | — |
| 模型席位 | `directoryFor(sessionId)` 每会话 | ✓ 同 | — |

### 前端写卡列

- 会话绑定全部现成：`sessions.binding(writerId)` 对非当前会话懒创建（`packages/api/session-controller/src/client/sessions/service.ts:545-560`），事件流与投影（`tokenUsage`/`contextPressure`/`modelSelection`）同款读取——`TavernApp.tsx` 对 RP 会话已有完整先例。**不调用 `sessions.open(writerId)`、不抢 current**：写卡列与侧栏当前会话完全无关化，`lastLines` 按 sessionId 记键也零污染。
- 转写：从 `TavernChatView` 抽出通用行渲染（user 气泡 / 叙事 / think / tool FlowRow）复用，去掉酒馆特有面（开场页、wrap 标签剥离、尾代理行、开场选项 postMessage）。发送走**标准通道** `binding.session.prompt(...)`（prompt 自开 session，`packages/api/session-controller/src/client/sessions/session.ts:469`），不走 tavern `rpc.prompt`——那是 wrap 合成专用。
- composer：模型席位复用现有两级钻取菜单（`models.directoryFor(writerId)`，每会话独立目录）；已知 stock 语义 = `selectModel` 同时改写全局默认模型（`packages/api/session-controller/src/commands.ts:151-158`），RP composer 今天即如此，非新增行为。上下文占用环与用量状态行同款投影接入。
- 交互体验 = 酒馆窄栏版的 stock 对话：转写行形态与 composer 骨架（文本区在上，模型席位→占用环→发送）与 stock web UI 同源；**没有** stock 的附件/加号/权限 chip（RP composer 本就不带，同口径）、审批确认卡（`never` + 无 shell，无可审之事）、会话切换器/历史列表（它就是这一个会话）。列宽约 340px 定宽。key 预检复用 `checkKey`（MISSING_CREDENTIAL 弹框同款）。**停止**：writer 无卡工具 bash 可杀，唯一长跑物是 LLM 流——停止走标准 `binding.session.cancel()`，不进引擎的会话级 `stop()`（那是 RP 专属：卡工具子进程 + 尾代理 fork）。共享 composer 的停止开关按调用方参数化：RP 传引擎 `stop` RPC，写卡列传标准 cancel。
- 工具面同步不对称（writer 带来的唯一行为差）：编辑器 RPC 写 `preset/tools/` 经 `syncCardTools` 即时生效（schema 当次请求可见）；writer 用 fs 工具落盘的脚本由主代理组装点的兜底 sync 接住（`registerMainAgentTools` 的 `system-prompt/assemble` 监听），而内核在瀑布**前**收集 schema——新条目晚一次请求生效。可接受；引导文案注明即可，`ensureWriter` 不触碰 sync 机制。
- 文件树与编辑区刷新（agent 落盘的感知，全部无需手动刷新）：编辑页打开期间 2s 轮询——① `tree()` 感知结构变化（新建/删除/改名自动出现在树上，对齐 tailRunning 轮询惯例）；② 顺带比对 `meta.json`，变化即同步身份头；③ **当前打开文件的内容在文本框未聚焦时自动重读**（正在输入时绝不覆盖用户缓冲，失焦/重点文件即得最新内容——手动点击任何文件仍必然重读，既有行为不变）。tree 只含路径不含 mtime，内容重读走既有 `readText`，零 wire 变更。写卡列自身转写走事件流实时更新。

### 复用边界：跟随 stock 更新的程度

- **数据面与行为面：自动跟随**。writer 走的都是宿主服务与产品组合——`sessions.binding`、事件流、投影（token 用量/上下文占用/模型目录）、credentials、agent-loop、sandbox 策略、工具注册。stock 侧升级这些（新投影、新模型目录能力、新工具、更好沙箱），写卡列不加代码即受益。
- **组件面：插件内一份实现、两处复用，不自动跟随 stock 组件改动**。stock 的 `ChatView`/`InputBar`/`ModelSelect` 不能直接 import：bundle 纯度门禁禁跨插件 value import；且它们是绑定「当前会话」作用域的 slot 组件，props 由渲染器会话机制合成，writer 是非当前会话、作用域机制不给第二个视图用（externalize + 手拼 props 的方案已评估否决：成本高且引入 stock 的当前会话假设）。因此转写/composer 从 `TavernChatView` 抽成 ui-tavern 内部共享组件——RP 聊天与写卡列消费同一份实现；stock 有值得跟的视觉/交互更新时，改一处两边同步，跟进成本从两处压到一处。内核若未来把 stock 对话组件导出为可复用 presentation 组件，再评估切换。

### 生命周期

- 惰性创建：编辑页首次挂载调 `ensureWriter`；一个工作空间一个 writer，重复调用幂等返回同一 id（映射守卫）。
- 清空/载入/编辑收尾不影响 writer：writer 绑 root 不绑 RP 会话；`cancelEdit` 还原文件面后，writer 的后续对话基于还原后内容（其对话历史不回滚——普通 agent 语义，接受）。
- 工作空间删除（`deleteSession`）：`.tavern-writer` 标记随目录消失，writer 会话日志留库不删——与尾代理同款归档立场（[tail-session-archive.zh.md](../runtime/tail-session-archive.zh.md)：harness 无会话库删除授权面，引擎不自写清理）。
- stock 会话列表：writer 是全量会话，会出现在 stock UI 的 WorkspaceBrowser（仅非 tavern profile 下可见）；tavern 侧栏按磁盘工作空间行驱动，零污染。

## 三、改动面归属（内核零改动核对）

| 包 | 改动 |
|---|---|
| `packages/extensions/tavern` | writer 映射 + `.tavern-writer` 标记与 restore、`onAgentCreated` 第三分支（guide section / shell guard / approval never）、写卡引导文本、`ensureWriter`/`writeAsset` host 实现 |
| `packages/api/tavern` | 新 RPC `ensureWriter`/`writeAsset` + wire 类型；照例 `pnpm build:lib:host` 重生成 typert **且** `pnpm --filter @deepseek-ai/dsh-api-tavern bundle` 重建 client bundle |
| `packages/client/ui-tavern` | 身份头组件、三列布局与模态加宽、写卡列组件（转写 + composer）、`tree` 轮询、locale 词典 |
| `packages/bundle/tavern` | 无改动（三行装配不动） |
| 内核（`packages/core/*`、`api/session-controller`、`fs`、`interaction`、`sandbox`） | **零改动** |

写卡列用到的全部是既有 seam：`sessionController.create({cwd})`、per-agent scoped system-prompt section 与 `agent/created` 注册、`tools.guard` per-agent 守卫、sandbox `workspace-write` 默认策略、`setApprovalPolicy`、typert Remote 生成。唯一新增包依赖边：`extensions/tavern` → `@deepseek-ai/dsh-user-approval`（导入 `setApprovalPolicy`；该服务在 base bundle 已挂载，只是被 tavern 引用）——包清单改动，非内核改动；改 `package.json` 后照例 `pnpm install` 同步 lockfile 再跑 constraints。

## 四、测试与执行清单

- 单元（`extensions/tavern`）：writer 惰性创建幂等 + `.tavern-writer` 重启恢复；`onAgentCreated` 三分支判定（writer 不吃卡 system、不吃 wrap、guard 拒 shell、approval never 事件落日志）；`writeAsset` 围栏（路径逃逸拒 / 扩展名拒 / 超限拒）。
- REAL（`loader-composition`）：`ensureWriter` 幂等 + `.tavern-writer` 跨重启恢复（同根二次 compose 返回同一 id 且不新建会话）；writer 请求 system 断言含 `tavern:writer-guide`、面内无卡工具/尾工具；`approval/policy: never` 落 durable 日志；模型调用 bash → 拒绝结果回灌、回合续跑、固定提示词文件原样存活。
- 前端 spec（`ui-tavern`）：身份头编辑回写 `meta.json`（坏 JSON 拒写并提示）、三列渲染与让位后的动作区、写卡列 send 走 `session.prompt` 假面、树轮询刷新与选中文件「未聚焦自动重读、聚焦不覆盖」、导入预览页与存档页不渲染写卡列。注意 app 级测试假面 `record()` 双信封坑（返回值方法用裸 override）。
- 执行顺序：host（`ensureWriter`/`writeAsset`）与 client（身份头 + 三列 + 写卡列）可分两个 PR 独立回退；wire 加字段照例 build:lib:host + api bundle 双重建，漏后者 = 客户端方法静默 `undefined`。
