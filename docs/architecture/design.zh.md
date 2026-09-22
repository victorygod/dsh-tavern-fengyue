# Tavern — DSH 的 RPG 世界设定卡引擎

加载一个插件，DSH 即成为驱动「RPG 世界设定卡」的引擎，并打开为其定制的 Web 界面。玩法类似 SillyTavern：设定卡定义世界，玩家在聊天中冒险，模型负责叙事，引擎在幕后记账与调度。全部能力通过现有 DSH seam 实现，核心包零修改。

## RPG 世界设定卡

一张设定卡是一个纯数据目录，不是 npm 包。**卡的主体是三张提示词**（主代理两张 + 尾代理维护提示词一张），其余内容是锦上添花。

| 内容 | 地位 | 作用 |
|------|------|------|
| `preset/prompt/systemPrompt` | **主体** | 主代理系统提示词：世界规则、叙事风格、场景设定 |
| `preset/prompt/postPrompt` | **主体** | 每回合动态注入既有玩家消息之后的那条 post 消息的渲染模板（2026-09-16 动态 post 改造：`prefixPrompt` 文件退役且**引擎不再读取**，存量内容需手动并入本文件或删除，机制见 [dynamic-post-injection.zh.md](../runtime/dynamic-post-injection.zh.md)） |
| `preset/prompt/maintenancePrompt` | **主体** | 尾代理（记账员）系统提示词：如何根据刚发生的叙事维护世界状态文档 |
| `preset/setup/` | 锦上添花 | 初始可变状态模板：角色表、世界状态、NPC、场景；另含 `opening.html` 开场白页面 |
| `preset/tools/` | 锦上添花 | 主代理可见的 CLI 工具（`.sh`，每脚本注册为 tools 数组独立条目：`# @tavern-schema` 头内嵌具名参数 schema，无标记则以 `{args}` 泛化注册、`-h` 自述进 tool-brief 段） |
| `preset/scripts/` | 锦上添花 | `{{scriptName(args)}}` 提示词模板脚本 |
| `preset/meta.json` | 锦上添花 | 卡片元数据：`title`（标题）、`desc`（简介）、`cover`（封面图路径）— 卡库展示与模板发现 |

三张提示词由用户编写，运行时系统从不修改，`preset/prompt/` 固定三件（退役的 `prefixPrompt` 是不读取的死数据：可编辑可删除，旧内容手动并入 `postPrompt`）。三件均支持 `{{scriptName(args)}}` 模板注入，每次请求渲染时解析（`maintenancePrompt` 渲染发生于 fork 派生时）。工作空间按生命周期分工：`preset/` 装卡片固定内容、跨会话可复用；`preset/setup/` 是初始状态模板，开局时复制为 `runtime/`；`runtime/` 是尾代理在回合间维护的当前世界状态（面板、设定、世界书）；`savings/` 是存档区 — 完整运转见[运行流程](#运行流程)。

| 提示词 | DSH hook |
|--------|----------|
| `systemPrompt` | `ctx.systemPrompt.section()`（provider 型 section，每次装配重读） |
| `postPrompt` | 提交期渲染 → 引擎在 `tavern.prompt` RPC 渲染 `postPrompt` 体入提交 stash；回合首步 `agent/pre-step` 注入器把上一回合的 post **原位影子化**（空内容 system 节点替换，日志留存、wire 消失）并把新值骑在 claims 之后落账为**独立 user 事件**——历史恒为干净 u/a 交替、当前回合恰好一道 post（机制与 N↦N+1 全模拟见 [dynamic-post-injection.zh.md](../runtime/dynamic-post-injection.zh.md)） |

## 工作空间

开启新会话即在当前目录创建 `tavern_workspace/<时间戳>/`，作为干净的新工作空间；一个工作空间绑定一个活跃会话，承载该会话的完整生命周期：

```
tavern_workspace/<时间戳>/
├── preset/     ← 卡片固定内容（可复用，随卡复制）
│   ├── meta.json        ← 卡片元数据（title / desc / cover）
│   ├── prompt/          ← 三张提示词（卡牌主体）
│   ├── assets/          ← 媒体资产收录处（封面/背景/音频/视频；preset 相对路径引用）
│   ├── setup/           ← 初始可变状态模板
│   ├── scripts/         ← {{…}} 提示词模板脚本
│   └── tools/           ← 主代理 CLI 工具（每脚本一个工具条目）
├── runtime/    ← 运行态：面板、可改设定、世界书；开局由 preset/setup 播种，尾代理维护
└── savings/    ← 存档：每个子目录 = 一个存档（目录名即存档名），内容为 runtime/ 完整快照
```

- `preset/` 是卡片固定内容，跨会话可复用：导入或制作卡片时一次就位，用户可编辑。
- `preset/prompt/` 是提示词权威：只由用户经编辑器修改，运行时系统从不改写；引擎每次请求重新读取 — 永远最新，无需状态同步。
- `preset/setup/` 是 `runtime/` 的种子：开局时复制进去，作为尾代理修改的基线。
- `runtime/` 是派生态：尾代理在回合间创建、修改、管理面板、设定、NPC、世界书。
- 可改性分三类：`preset/` 仅用户可改；`runtime/` 模型可改（尾代理写入，用户不手改）；`savings/` 为只读快照。
- 侧边栏是**会话列表**：hover 会话卡片 ✕ 删除（连同 `tavern_workspace/<时间戳>/` 工作空间目录，需确认）；重命名已移除。
- 设定卡库位于 `tavern_presets/`（与 `tavern_workspace/` 平级）— 库中的卡可被多个会话复制使用，互不影响。
- 开局导入卡片 = 复制卡片的 `preset/` 内容进工作空间 + 从 `preset/setup` 播种 `runtime/`。三种来源：① 卡库目录（`tavern_presets/<卡>/`）；② 浏览器侧文件（弹系统选择框选 `.json` 或卡片目录 — 浏览器与宿主可能不同机，故解析在浏览器侧完成：酒馆卡 JSON 读 `name`/`description`/`system_prompt`/`pre_prompt`/`post_prompt`，目录读取隐藏文件跳过/二进制扩展名拒绝/单文件 1MB 上限/骨架补齐）；③ 制作卡片（见下）。②③ 选定后先进入**导入预览页**（与制作卡片共用同一左树右编辑器组件，可直接修改解析结果），点「保存并开始」经 `commitImport` RPC 入库并加载。示例卡见 `templates/tavern-tavern/`（`preset/` 结构）。

## 引擎：一个进程级插件

后端包 `@deepseek-ai/dsh-tavern`（`packages/extensions/tavern`，函数插件 `name` / `inject` / `Config` / `apply` 形态，经 tavern bundle 装配，见[装配](#装配bundle--profile)）。`inject = ['systemPrompt', 'tools', 'subagents', 'shell', 'workspaceRegistry']`；`Config` 为空 — 所有路径隐式相对工作空间根。`apply(ctx, config)` 注册：

1. **系统提示词** — `ctx.systemPrompt.section()` 注册 provider 型 section（`text` 可为函数，每次装配求值），读取并渲染 `preset/prompt/systemPrompt`。
2. **工具注册** — `ctx.tools.register()`：`preset/tools/` 目录的**每个脚本**注册为 tools 数组独立条目（带 `# @tavern-schema` 头 = 具名参数 schema，非法块注册时抛错；无标记 = `{args}` 泛化条目），只给主代理；组合期全量注册、此后按目录变更增量同步；尾代理的五个 `runtime*` 工具固定写死在引擎：

| 工具 | 来源 | 主代理 | 尾代理 |
|------|------|--------|--------|
| 卡工具条目 | 工具脚本（`preset/tools/`，每脚本一个条目） | ✅ | ❌ |
| `runtimeRead` / `runtimeGrep` | 引擎写死 | ✅ | ✅ |
| `runtimeWrite`（建档/整档覆盖） / `runtimeEdit`（old_str→new_str 精确替换＋replace_all） / `runtimeDelete` | 引擎写死 | ❌ | ✅ |

3. **路径围栏** — `runtime*` 工具验证路径解析后必须落在 `runtime/` 内，拒绝逃逸；卡工具以逐脚本条目注册、脚本文件为单一事实源（无泛化入口）。`preset/` 与 `savings/` 均为用户侧区域，两个代理都写不进 `preset/`。围栏在工具 execute 内做 realpath 包含检查（模型 JSON 参数边界即验证点）。**分代理机制**：fork 的 `toolFilter`/`restrict()` 只能收窄已存在工具（对未知名抛错），不能授权 — 因此共用件（卡工具/runtimeRead/runtimeGrep）落全局注册表，写面（runtimeWrite/Edit/Delete）在 `agent/created` 检出 tavern fork 子代理时于其 `agent.ctx` 追加 scoped 注册（同名全局/逐代理变体是 registry 支持的用法）。**并发模型**：读对与写对声明 parallel-safe（内核同帧滚动池，上限 10）；写对另以逐绝对路径的 promise 串行链保序——同文件编辑按模型顺序落盘，跨文件真并行；`runtimeDelete` 与卡工具保持 exclusive（内核屏障先排空池子）。目录树操作（mkdir / 播种复制 / 快照 / 删除）在 host 半面用 node:fs + 包含检查实现（fs capability 只有读写文本，无删除/移动，`packages/fs/fs/src/index.ts`）
4. **post 消息提交期渲染 + pre-step 注入** — `{{scriptName(args)}}` 渲染（经 `ctx.shell.run()` 执行，脚本缺失或失败则占位符原样保留）在提交期 `tavern.prompt` RPC 内异步执行并入提交 stash；`.sh -h` 工具说明探测仍发生在 `system-prompt/assemble` waterfall listener 内（`packages/extensions/tavern/src/prompting.ts`），每次装配重读文件、永远最新。回合内 `agent/pre-step` 注入器（全局监听器、主代理分支）把上一回合的 post 节点以**空内容 system 消息原位 replace 影子化**（内核 `SystemPromptProjection` 同款单活节点模式，日志留存、wire 消失），再把 stash 里的渲染值 `createUserMessage`（plugin source）骑在本步 claims 之后——loop 统一落账为独立 durable 事件，历史恒为干净 u/a 交替。
5. **`-h` 探测缓存**（主代理）— 工具说明按脚本文件 mtime 缓存，文件变更后下一次装配重新探测；不让每次模型请求为全部 `preset/tools/*.sh` 各起一个子进程。
6. **尾代理调度**（监听 `session/event` 的 `turn/end`，仅 `reason.kind === 'completed'` — 出错/中断的回合不产生记账）— 叙事回合（完整 turn）结束后异步派生尾代理，`preset/prompt/maintenancePrompt` 全文经 fork 请求 prompt 作为 user 消息传入（引擎前缀一行固定引子；maintenancePrompt 为空白卡完全不触发）。fork 种子 = 父上下文截至最后一个 `turn/end` 的前缀，含主会话 system 历史 — 双代理的 system 同源（同一张卡）。不用 `step/end`：它在 turn 内多次触发，且当前未闭合的 turn 不在 fork 种子内。下一回合的输入在 `agent/pre-step` 闸门里 `await` 尾代理结果 — 该 waterfall 为 awaited，阻塞而不丢弃输入；`reject` 会丢弃 claimed 消息，不能用作暂停。闸门只拦发送：输入仍被接受（Enter 不发送）。自动存档不再挂在这里 — 存档点已移到「玩家点击发送的一刻」（见[状态与存档](#状态与存档)）。
7. **一会话一工作空间守卫** — 拒绝把会话附加到已被占用的设定卡工作空间（插件内逻辑；`workspaceRegistry` 本身是多会话设计）。

## 装配：bundle + profile

tavern 不用 persona/预设行：persona 行是会话级、scope-only 的组合件（全局挂载会与 prompt registry 自身的注册冲突并 fail loud），而 tavern 要的是一次进程启动即全部就位。三件套：

- `packages/bundle/tavern`（`@deepseek-ai/dsh-bundle-tavern`）：`package.json` 声明 `dsh.bundle.patch` 指向 `cordis.patch.yml`，后者的补丁插入三行 — host 行挂 `@deepseek-ai/dsh-tavern`，api 行挂 `@deepseek-ai/dsh-api-tavern`（宿主 Remote 命名空间 + 浏览器挂载面），client 行挂 `@deepseek-ai/dsh-client-ui-tavern`（前后端配对，见 `packages/bundle/web-app`）。
- tavern profile（`$DSH_HOME/profiles/tavern`，随 `PROFILE_TEMPLATES` 作为新模板提供）：`dsh.profile.bundles = ['base', 'web-app', 'tavern']` — base 与 web-app 提供既有产品能力与浏览器应用，最后叠加 tavern。`dsh --profile tavern`（或 `dsh tavern`）启动即为改造版设定卡界面。
- 逐层 patch 语义不变：任何一行的最终配置仍可被 profile 层、home 层与 `--patch` 覆盖。

## 双代理

| | 主代理（叙事者） | 尾代理（记账员） |
|--|----------------|-----------------|
| 上下文 | 用户对话本身 | 干净 fork 的完整子会话（system 与主代理同源）；maintenancePrompt 作为首条 user 消息，自己不带 post 注入；**种子里最后一条玩家消息带本回合的活态 post**（与主代理回答时刻同构，durable 事件随种子原样拷贝）|
| 任务 | 回复玩家，推进叙事 | 由 maintenancePrompt 指定：「根据刚发生的叙事维护工作空间文档」 |
| 工具 | 卡工具逐脚本条目（`preset/tools/`） | 固定五个 `runtime*`（引擎写死） |
| 写权限 | 无（`runtime/` 只读） | 仅 `runtime/` |
| 节奏 | 玩家输入时 | 每个叙事回合后自动，串行阻塞下一回合 |

`preset/tools/` 是卡牌的能力面，作者自选工具集 — DND 5e 掷骰不是内置工具，只是示例卡里的 `preset/tools/roll.sh`：回显叙事检查点与骰子结果，代理必须同时尊重两者。

尾代理回合不注入 post：`agent/pre-step` 注入器按主代理会话分支放行 fork 子会话（`header.origin === 'subagent'`），其回合只有 maintenancePrompt 的 `{{script}}` 渲染（全局 gate 监听器认领段完成）。尾代理不获得任何卡工具条目 — `preset/tools/` 只服务主代理，尾代理的工具是写死的 `runtime*` 集合。

尾代理是**可选**的：创建卡片时 `preset/prompt/maintenancePrompt` 内容为空，则完全不执行尾代理这一步 — 不派生 fork、不施加 `agent/pre-step` 闸门；玩家手动保存与自动存档仍可用（自动存档挂发送时刻，与尾代理无关）。编辑器顶栏「启用尾代理」checkbox 以此为准：初始状态依照 maintenancePrompt 是否非空；关闭时 maintenancePrompt 树行与编辑区灰显只读（内容保留在编辑缓冲），「保存并开始」时以空串入库。

尾代理子会话是一次性归档：不需要任何恢复操作，其会话库磁盘记录与清理边界见 [tail-session-archive.zh.md](../runtime/tail-session-archive.zh.md)。

## 运行流程

一轮完整回合分四段：会话建立、每回合请求组装、回合内执行、回合间记账。

**会话建立（一次性）**
1. 侧边栏「开启新会话」→ 在当前目录创建 `tavern_workspace/<时间戳>/`（一会话一工作空间守卫）。
2. 开局页选择卡片来源（卡库 / 浏览器侧导入（文件或目录）→ 导入预览页 / 制作卡骨架）；「保存并开始」经 `commitImport` 入库并加载 → 引擎把 `preset/setup` 复制为 `runtime/` — 开局状态就位。
3. `preset/prompt/systemPrompt` 注册为系统提示词。
4. 聊天区没有任何历史（刚加载卡、或清空后）时，渲染 `preset/setup/opening.html` 开场页（见[工作空间](#工作空间)）。

**每回合的请求组装** — 按 DSH 正常对话流走，只加一条规则：玩家发送时引擎渲染 `postPrompt`（先等尾闸门，面板反映最新维护后的 runtime）入提交 stash，**原文原样**经 `tavern.prompt` RPC 落账（机制：回合内 `agent/pre-step` 注入器由 stash 取值——上一回合 post 影子化退场、新 post 骑在 claims 之后落为独立 user 事件；内核 `surfaceOp: replace` + 空内容 system 为公开缝，零请求视图改写）：

第 N 回合请求视图（durable 消息的直派生）：[system, u1, a1, u2, a2, …, u(N-1), a(N-1), uN, postN]，历史恒为干净 u/a 交替、当前回合恰好一道 post 贴在最后一条 user 之后

- `system` 为 `preset/prompt/systemPrompt` 的渲染结果（每次装配重读）；`u`/`a` 为历史消息（durable 原文）；`postN` 为本轮 post 渲染值（plugin-source 独立 user 事件，`agent/pre-step` 注入器骑载落账；step≥2 无 claims 不重注入，post 节点保持活态持续可见——即 ST depth 注入的「每请求都在」；下一回合首步被原位影子化退场）。模型可见 ⟺ 日志按构造成立：影子化事件与 post 事件全部入账，请求视图就是 durable 消息按 surface fold 的直派生。
- 前端转写、侧栏 last-line、存档 summary 都按锚定边缘剥离标记段显示玩家原文；刷新/载入后同一剥离路径同样不可见。
- **卡文是唯一的 system**：`harness:identity`、`harness:source`（实现库位置）与 `app:web-surface`（Web GUI 说明）三个产品 section 在酒馆代理 scope 内被同名空 shadow 抹除——system 除卡文与 `-h` 工具自述外不夹带任何产品文案；对其他进程内会话零影响。
- 提示词均支持 `{{scriptName(args)}}`，在本插件的 provider / 快照文本产出前渲染完成 — `{{…}}` 绝不能原样进入 system-prompt 的严格插值层（未注册变量会在 `renderPrompt` 抛错）；`{{…}}` 只解析 `preset/scripts/` 下的脚本，`preset/tools/` 下的脚本由模型以逐脚本具名工具调用。
- 工具模式（主代理）：装配时读取 `.sh -h` 输出缓存（mtime 失效），作为工具模式说明随请求附带。

`{{script}}` 的意义在此：`postPrompt` 里写 `{{get_turn}}`，发送时执行 `scripts/get_turn.sh`，它读 `runtime/state.md` 返回「Day 2 · 夜晚」— post 消息由此获得随剧情变化的开口。

**回合内** — 主代理叙事：按需 `runtimeRead` / `runtimeGrep` 查当前状态（NPC 立场、玩家 HP）→ 分歧点调用 `roll.sh` 掷骰（逐脚本具名工具条目），结果必须尊重 → 输出叙事段落。

**回合间** — `turn/end` 触发尾代理（闸门期间只拦发送，输入不受影响）：干净 fork 继承父日志前缀（截止到最后一个 `turn/end`），按 `preset/prompt/maintenancePrompt` 读「刚发生的叙事」，用写死的 `runtime*` 工具更新 `runtime/`（`state.md` 推进时间、`npcs/*.md` 记下酒保态度变化）→ 闸门放行、允许下一句（自动存档不在回合间发生 — 它在玩家下一次点击发送的时刻盖章，快照天然包含本次尾代理维护完的 `runtime/`）。

**下一回合** — 新玩家输入继续以发送时刻的新渲染 post 骑载落账；上一回合的 post 被影子化退场（日志留存、wire 消失，恰一道「现状面板」贴在最后一条 user 之后），此时 `{{script}}` 渲染与主代理读到的 `runtime/` 都已是尾代理更新后的版本。

## 状态与存档

存档即 `runtime/` 的完整快照，落在工作空间 `savings/<存档名>/`（目录名即存档名）。`preset/` 是卡片的固定可复用内容，随卡片存在，不入存档；会话日志不进入存档 — 存档是世界状态回滚点，载入只恢复 `runtime/`，对话历史保留在活会话中。

存档有两个来源：

- **autosave（自动）** — **玩家点击发送的一刻**自动保存一份（在尾代理闸门放行之后、消息落盘之前）：快照 = 该条消息**之前**的世界状态，存档戳（`savings/.tavern-boundaries.json`，引擎私有的隐藏账本）记录存档点会话 id、最后一个 `turn/end` seq（fork 边界）与该刻输入框内容 `draft`（即正在发送的消息原文）。命名 `autosave-<时间戳>`；仅保留最近 10 份，超出的自动清理。回合结束/尾代理完成不再产生存档。
- **手动保存** — 头部「保存」按钮：弹框输入存档名（上方列出已有存档，点击条目即填入名称 = 覆盖）；同名保存需覆盖确认。手动存档不参与自动清理；存档戳同样记录 `draft`（保存那一刻输入框里的内容，可为空）。手动存档不作重试点（边界任意、其草稿从未提交过）。

设置 → 存档 tab 列出全部存档，每行提供「载入」（把快照恢复到 `runtime/`，历史 fork 回存档点边界，**并把存档戳里的 `draft` 回填进输入框**——世界回到「你正要说这句话」的状态，可改字重发）与「删除」；保存动作只在头部「保存」按钮。快照在工作树中只读，不可改写。保存/载入是 UI 层用户操作，不是代理工具。

## 重试与草稿恢复

- **重试（↻）** — 最近一条回复的操作行内的小刷新图标（该行还承载消息复制；操作行恒占布局空间、hover 经 opacity 显隐，与 stock web UI 同机制）。显示条件 = 最后一条回复（含被停止/报错的回合）之后没有新的玩家提交，且会话空闲（与发送按钮同一状态机：运行/在途/尾代理期间 ↻ 消失）、且存在可用重试点。点击 = 引擎 `retryPoint`：取**最新的** `autosave-*` 存档戳（带 `draft`），fork 回发送时刻边界（无边界——如首条消息——则等价于 `reset` 到开局），换绑后把戳里的原文经正常发送管线重发（post 重渲染、新 requestId、独立回合与尾代理）。旧回复消失、原文气泡重现、新回复流式——重试后再重试链收敛（重试的发送又盖同边界新戳）。
- **草稿恢复** — 载入任何存档（自动或手动）都把存档戳的 `draft` 放回输入框；清空不恢复草稿。
- **Esc 快捷键**（聊天视图内）— 单击：可停（与发送按钮停止态同源）→ 停止；有对话框 → 关闭；都不满足 → 无动作。双击（400ms 内、且第一下未消费任何动作）：输入框有内容 → 清空；已空 → 打开加载页（存档 tab）。`event.repeat` 不丢弃（按住 ≈ 急停连按）；输入法组词与带修饰键的组合不拦。

## Web 界面

前端包 `@deepseek-ai/dsh-client-ui-tavern`（`packages/client/ui-tavern`）经 tavern bundle 的 client 行装配，随引擎一起启用 — 进程启动即为设定卡界面，不是可切换的皮肤。整页接管 = root 槽位 shadow：以 priority -20 注册 ui-renderer 的全应用唯一挂点 `root`（`renderSlot('root')`），整页替换默认 dsh 外壳；页面内部自绘侧栏（会话列表）/ 卡库 / 开场页 / 叙事转写 / composer。文案走 locale 字典；浏览器半面经 `packages/api/tavern`（Remote RPC 面）跨进程调用 host 编排，其生成的 `remote.tavern` 命名空间挂载在 api 包自己的 client 面上（前排卡 inject 点路径守卫的解法 —— 消费者不能自举命名空间）。包结构与文件职责见 [file-tree.zh.md](../architecture/file-tree.zh.md)。卡片驱动的页面展现（主题/布局/消息渲染/交互面板）见 [card-presentation.zh.md](../cards/card-presentation.zh.md)。

```
┌───────────┬─────────────────────────────────┐
│ 侧边栏    │ 聊天区                           │
│ 会话列表  │   [user]      右对齐气泡          │
│ (240px)   │   [assistant] 左对齐叙事段落       │
│           │   头部：纯文字标题 + 保存/加载/清空 │
└───────────┴─────────────────────────────────┘
```

- 聊天区只有两种聊天气泡：用户气泡、助理叙事。post 注入消息以 plugin source 落账，前端按 `source.kind` 过滤，永不出现在界面上（旧 wrap 时代日志的标签段由保留的剥离 shim 兜底显示）；思考与工具调用以 DSH web 同款灰色折叠行呈现（默认折叠一行摘要、可展开），不与气泡混排。日夜状态、回合分隔线等额外装饰暂不做。**界面不使用任何 emoji** — 图标一律用文字或单色字形。输入区为 DSH composer 结构：**文本输入区在上**，下方控制行右对齐 — **模型席位** chip（两级钻取菜单选模型与思考强度）、**上下文占用环**（14px SVG 圆环，点击弹出明细面板 — 占比条 + 系统提示词 / 工具 / 对话 三行 ~token 明细）与发送按钮（DSH 的加号 / 附件 / 权限 chip 不进酒馆）。**发送闸门**：主代理回复进行中与尾代理记账期间，发送按钮与 Enter 均无效 — 回复中的输入不排队，输入不受影响（排队会让消息以真在途身份落进尾代理 fork 种子被记账子代理认领）。聊天区最底部贴边一行 ｜ 分隔的纯文本**用量状态行**（不可点）：「输入 X tok ｜ 输出 Y tok ｜ 缓存命中 Z% ｜ W tok/s」— 四段占位常显，无数据写 0。
- 侧边栏是**会话列表**：hover 会话卡片 ✕ 删一并删工作空间目录（需确认）；底部「＋ 开启酒馆会话」；「API Key」按钮弹配置弹框（按需弹框：缺 Key 发送前预检与失败回合时出现）。侧栏可整体收起（缩到 width 0）：聊天头部最左的面板字形 toggle **两种状态下都常驻**，是收起后唯一的唤回点；收起态在其右保留「＋ 开启酒馆会话」方形按钮，新会话主操作不随侧栏消失。偏好写 localStorage（`tavern.sidebar.open`），重载恢复。收起动画沿用 dsh web 侧栏的冻结宽技巧 — 内容钉死在展开宽度原地淡出、由滑到 0 的列裁剪（滑动过程不 reflow），`visibility` 延迟到落定才撤走键盘焦点与读屏树。
- 头部为**纯文字会话标题**（无框、不可点）；右侧「保存」（弹框命名存档，同名覆盖确认）、「加载」（直达设置模态存档 tab）、「清空」（回到初始卡片状态：**工作空间换绑到一个全新会话**——会话日志只追加永不改写，「聊天记录清空」= 玩家从此面对一个从零开始的新会话；旧会话的持久日志原样存档在会话库中、不再绑定任何工作空间。runtime/ 重新从 preset/setup 播种、savings/ 存档保留；确认后**直接回到开场页**，不插入任何提示消息）与「设置」。
- 开场页：**聊天历史完全为空**（agent 记忆里也没有、前端也没有）时，聊天区以 iframe 渲染卡片的 `preset/setup/opening.html`（**整页平铺聊天区**，容器不留边框内边距；卡无此文件时渲染默认开场页 — 居中展示卡片标题与简介的大卡页）— 页面拼装开场叙事，并带**开场白选项**；点击选项把该句填入输入框（iframe 经 postMessage 与父页通信），再点发送即开始第一回合，也可以自己写内容发送。**默认开场页也有数据侧开场选项**：可选文件 `preset/greetings.json`（`{ "greetings": ["…", …] }` — 导入的 first_mes 与 alternate_greetings 的数据落点）渲染为选项按钮，点击同走填入输入框；文件缺席或 JSON 无效则只剩标题与简介。开场页只占聊天区，**不遮挡输入区**；首个回合发出的消息进入历史后即恢复正常聊天视图，开场叙事作为第一段 assistant 叙事随之入历史。
- 开局页：新会话的聊天区**没有输入框**，默认以**书架式封面卡**平铺展示卡库 `tavern_presets/` — 每张卡渲染其 `preset/meta.json` 的封面图与标题；悬停时卡片右上角浮现「删除（×）」与「编辑（铅笔）」，点击卡片本体即加载（复制进本会话并播种 runtime/）。右上角两个入口 — **创建新卡**（就地编辑器）与**从酒馆卡导入**（点击弹系统**文件选择框**，接受 `.json` 与 `.png`：PNG 走 tEXt chunk 抽 `ccv3`/`chara` 内嵌 JSON，字节即封面）。解析器（`st-import.ts`）按 [st-card-field-mapping.zh.md](../cards/st-card-field-mapping.zh.md) 把任意 V1/V2/V3 归一化后五路折叠：systemPrompt 按 ST 装配序成段（`pre_prompt`/`post_prompt` legacy 字段并入 postPrompt）、触发世界书进 `lorebook.json` + 生成 `lorebook.sh` + `{{lorebook()}}` 挂 postPrompt、`first_mes`/备选开场进 `greetings.json`、身份字段进 meta、PNG 封面提交后经 `writeAsset` 落 `preset/assets/cover.png`；落不进活跃面的正则等源料进 `preset/st-import/` 翻译工作单（含**导入报告**：丢弃/缺失引用/体量统计）。选定后进入**导入编辑页**（统一编辑器组件，可直接修改解析结果），带「← 返回」；`maintenancePrompt` 恒空 → 尾代理默认关闭；顶栏「启用尾代理」可切换启用并补写内容。页顶「**保存并开始**」把解析结果收入卡库 `tavern_presets/`（重名自动加后缀）并加载进本会话 → 开场页（卡无 `preset/setup/opening.html` 时渲染标题与简介的默认开场页）。取消系统选择框则停留卡库页。
- 制作卡片 / 编辑卡页：统一编辑器组件就地呈现（同设置模态的工作空间编辑器），**没有存档 tab**；页顶是**卡片身份头** — 左侧封面图（与卡库书架封面同比例的缩小版 120×82：点击上传/更换，图片经 `writeAsset` 落 `preset/assets/`（**同名即覆盖**，不再数字后缀躲重名）并回写 `meta.cover`，悬停 ✕ 仅解除引用不删文件；存量卡的旧路径照读），右侧标题与简介两行点击行内编辑、其下一行只读的「作者 · 版本」小字（`meta.creator`/`meta.version`，有值才渲染）、失焦写回 `preset/meta.json`（**字段保真序列化**：身份行合并回读到的原始 JSON 对象再写回，`tags` 等身份头不编辑的字段永不因编辑而丢失；解析失败时身份头只读并提示修复 JSON；导入预览页的身份头编辑的是内存表里的 meta，无封面上传）；骨架 = `preset/{prompt, setup, assets, scripts, tools}` + `preset/meta.json`（title / desc / cover / creator / version / tags 占位字段；`preset/prompt/` 恰三个空提示词文件；`assets/`、`setup/`、`scripts/`、`tools/` 各含一份 README.md 介绍该目录应该放什么样的文件）+ 空的 `runtime/` 与 `savings/`；顶栏「启用尾代理」checkbox 控制 maintenancePrompt 的启用与灰显（见[双代理](#双代理)），右侧「保存并开始」把内容落库并加载进会话。
- 设置模态框 = 「工作空间」「存档」两个 tab。「工作空间」是一份**左树右编辑的统一组件**（页顶带同款卡片身份头，动作区承载该页的动作按钮与尾代理 chip），四个场景共用同一实现：设置模态「工作空间」（动作区 = 尾代理 chip + 叙事agent默认工具 checkbox，见下条）、创建新卡 / 编辑卡、导入编辑页（后两者在组件顶栏带 checkbox 控制组与「保存并开始」动作按钮，控制组可扩展）。文件树为 VS Code 风格纯净列表（行内无徽标，目录行左侧 chevron，选中整行底色）；文件操作走**右键菜单**：右键目录在其内部新建文件/目录、重命名、删除（固定文件绝不弹菜单；新建对既有默认名自动递增去重；`runtime/` 可新建/删除/区内改名，`savings/` 快照可新建/删除、不可改名）；**拖动文件移动，松手需确认（限 preset/ 与 runtime/ 的同区内）**。树中没有 ＋按钮，也没有 hover 操作图标；图片/音视频只读预览，文本直接编辑，非多媒体 >10MB 拒绝预览；**失焦即保存**。「存档」交互见[状态与存档](#状态与存档)。
- **叙事agent默认工具开关**（2026-09-21 v5 定案：卡身份 meta.json 显式字段 + 开局窗口可改）：设置→工作空间页与建卡/编辑卡页的动作区（与数据维护 chip 同一**竖列**；该列与保存/保存并开始按钮同排）各有一枚 **checkbox「叙事agent默认工具（runtimeRead/Grep）」**，默认勾选。关闭 = 主 agent 的模型可见工具面只剩卡自带工具（`preset/tools/`），`runtimeRead`/`runtimeGrep` 被收走、无法主动读取 `runtime/`；**尾代理五件与卡工具不受影响**。状态在**卡体自身**（与 runtime 零关系）：卡身份 `preset/meta.json` 的显式布尔字段 **`narratorTools`**（缺席/true = 开，false = 关；存量卡零迁移，人类可读可手改）——发布 / 编辑保存 / 导卡三条 preset 整目录拷贝边界都携带 meta.json，建卡/编辑时点掉就是点掉（即点即存、始终写当前工作区的 meta），保存并开始后新会话即按所点状态开局。**可改窗口 = 对话开始之前**（选卡/建卡/编辑卡）：`state.dialogStarted`（durable 日志出现玩家消息即真，载入存档的快照认领也算已开始）为真后 checkbox 置灰只读。**翻转走既有端点**（typert 契约冻结，无专用 wire 方法 —— 09-20 红线）：UI 读 meta → 字段保真地设置 `narratorTools` → `writeText` 整文件写回（引擎命中 meta.json 即 re-sync 工具面）——翻转落在当前请求边界；重载经 `state.narratorToolsOn` / meta 轮询恢复勾选态。不放 localStorage（引擎须以工作区为真相源）、不放隐藏 dot 标记（v4 实证「重新打开卡片又恢复」的观感根因：用户看不见也信不过；显式 JSON 字段才是身份该有的形态）。
- **写卡 Agent 列**：编辑卡页、制作卡页与设置→工作空间页的编辑器为三列——文件树 | 编辑器 | 写卡对话列（导入预览页与存档页不挂）。写卡列是一个普通 dsh agent 对话，钉死在当前工作空间（会话 cwd = 工作空间根，`ensureWriter` 惰性创建、每工作空间一个、`.tavern-writer` 跨重启恢复），对话历史跟工作空间走、不跟 RP 会话走。转写与 composer 复用 RP 聊天的共享渲染层（模型席位/上下文占用环/用量行/停止）；发送走标准会话通道。引导 = 工作空间布局事实 + 写卡手法（含卡工具 `@tavern-schema` 约定）；权限 = 工作空间内可写（sandbox workspace-write 默认行为），2026-09-16 起守卫全拆：standard preset 完整工具面（含 shell 与委派）无限制可用，仅保留审批策略 `never`（无审批面，需审批动作被静默拒）。agent 落盘由编辑页 2s 轮询感知：树结构、meta.json 身份头、以及未聚焦时当前打开文件的内容自动重读。机制详见 [edit-page-identity-and-writer-agent.zh.md](../notes/edit-page-identity-and-writer-agent.zh.md)。
- 可改性与工作空间一致：`preset/` 供用户编辑；`runtime/` 由尾代理管理，不手改；`savings/` 快照只读。
- 尾代理运行行也是灰色折叠行，完成后保留在流尾，展开可见其执行的写死工具；运行期间不可发送（按钮与 Enter 均无效），但允许输入。maintenancePrompt 为空的卡不出现这一阶段。

## 实现映射

| 需求 | DSH API | 状态 |
|------|---------|------|
| 进程装配（engine + api + client 三行） | `dsh.bundle.patch`（tavern bundle）+ tavern profile | 🆕 新增 |
| 系统提示词 section（动态 provider） | `ctx.systemPrompt.section()` | ✅ 现有 |
| 动态 post 注入（独立 user 消息、旧回合影子化退场） | `agent/pre-step` waterfall（claims 骑载）+ `session.append` 的 `surfaceOp: replace` 空内容 system 影子化 + 「送发时刻渲染值入 stash」 | 🆕 引擎内组合 |
| 工具注册与分代理面 | `agent/created` 时全部经 `agent.ctx` scoped 注册（主代理三件 / 尾代理五件）+ 双方 `tools.restrict({allow:[]})` 收空继承面 | 🆕 引擎内组合 |
| 尾代理 fork | `ctx.subagents.start('fork', …)`（`subagent-fork-in-process`）；触发经 `session/event` 的 `turn/end` 仅 completed；maintenancePrompt 作为 fork 的首条 user 消息 | ✅ 现有（组合方式本轮变更） |
| 阻塞下一回合 | `agent/pre-step` waterfall 闸门（await 尾代理结果；只拦发送，不拦输入） | ✅ 现有 |
| 工具注册 | `preset/tools/` 逐脚本条目（具名参数/泛化）仅主代理；尾代理 `runtime*` 五件固定写死在引擎 | 🆕 新增（per-tool 条目） |
| 会话日志持久化 | `packages/session/` 代际 JSONL（`session.vN.jsonl[.zstd]`） | ✅ 现有 |
| 载入（快照恢复 runtime/） | node:fs 复制（插件内逻辑） | 🆕 新增 |
| 会话绑定 tavern 工作空间 | `session.create({ cwd, agentPreset: 'none' })`（`packages/api/session-controller/src/commands.ts`；`'none'` = 显式无预设，替代默认编码代理预设） | ✅ 现有（`'none'` 本轮新增） |
| 工作空间注册与会话绑定 | `ctx.workspaceRegistry`（会话经 header 归属工作空间） | ✅ 现有 |
| 子进程执行（`{{…}}` 渲染、`-h` 探测、CLI 工具） | `ctx.shell.run()`（shell seam） | ✅ 现有 |
| 工作空间文件读写（编辑器） | `workspaceFiles.read()` / sandbox `workspace-write` | ✅ 现有 |
| 弹框命名、同名覆盖确认、autosave（`autosave-<时间戳>`，发送时刻盖章）保留 10 份与自动清理、删除存档、清空回初始状态、↻ 重试（载入发送时刻存档并重发原文）、载入恢复输入框草稿、Esc 快捷键（停/关对话框；双击清空/开加载页） | 插件内逻辑 | 🆕 新增 |
| 开局页书架式封面卡库（meta.json 渲染封面/标题，hover 删除/编辑，点卡即加载）+ 两入口（创建新卡 / 酒馆卡 .json/.png 导入弹系统文件选择框 → 解析折叠 → 预览页 → `commitImport` 收入库并加载，封面经 `writeAsset` 落 assets）、`tavern_workspace/<时间戳>/` 目录创建、hover ✕ 删除会话连同工作空间 | 插件内逻辑 | 🆕 新增 |
| 工具发现、`{{…}}`/`-h` 渲染与缓存（主代理）、路径围栏、一会话一工作空间、save/load 编排 | 插件内逻辑 | 🆕 新增 |
