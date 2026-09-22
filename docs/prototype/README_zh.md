# Tavern RPG 界面原型

在任何浏览器中打开 `ui-mockup.html`。

## 布局

两列布局（侧边栏 + 聊天），与 DSH 现有 web 应用模式一致：

| 区域 | 描述 |
|------|------|
| 左侧边栏（240px） | **会话列表** — 点击选中；右键会话可重命名（仅显示名，工作空间目录名不变）或彻底删除（连同 `tavern_workspace/<时间戳>/` 工作空间目录，需确认）；底部「＋ 开启新会话」（当前目录 `mkdir -p tavern_workspace/<时间戳>/` 作干净工作空间）；右上角「API Key」按钮弹配置弹框 |
| 中间聊天区 | 聊天消息 + 输入区（文本区在上；下方控制行右对齐：模型席位 · 上下文占用环 · 发送）；最底部贴边一行 ｜ 分隔的用量文本（输入/输出 tok · 缓存命中 · 速度，不可点）。未选卡前显示开局页，无输入框 |

## 头部

聊天头部是**纯文字会话标题** — 无框、不可点。右侧四个文字按钮：「保存」（弹框命名存档，写入 `savings/<存档名>/`，上方列出已有存档、点击即填名 = 覆盖、同名保存需覆盖确认）、「加载」（直达设置模态框的存档 tab）、「清空」（回到初始卡片状态：runtime/ 重新从 preset/setup 播种、聊天记录清空、savings/ 保留；需确认）、「设置」（打开居中设置模态框，「工作空间」「存档」两个 tab — 匹配 DSH 的设置面板模式）。日夜状态、回合分隔线等装饰暂不做。

## 开局页

侧边栏「开启新会话」在当前目录 `mkdir -p tavern_workspace/<时间戳>/`，作为干净的新工作空间（初始仅含 `preset/`、`runtime/`、`savings/` 三个空目录）。该会话聊天区即开局页：**没有输入框**，默认以书架式封面卡平铺展示卡库 `tavern_presets/`（与 `tavern_workspace/` 平级）的每张卡 — 封面与标题来自各卡的 `preset/meta.json`（`title` / `desc` / `cover`）。交互：

- **点击卡片本体即加载**：复制进本会话（preset/ 就位）并从 `preset/setup` 播种 `runtime/`，随即开始 — 库中的卡可被多个会话复制使用，互不影响。
- **悬停卡片**：右上角浮现「删除（×）」与「编辑（铅笔）」按钮 — 编辑进入就地左树右编辑器（同制作卡片页），改动写入卡库目录；删除需确认。

右上角三个入口：

- **创建新卡**：就地编辑器写新卡（骨架同下），保存进卡库。
- **从其他目录导入**：点击弹出**系统目录选择框**；任意含 `preset/`（或平铺 prompt/setup/scripts…）的卡片目录，目录内文件实读解析。
- **从酒馆卡导入**：点击弹出**系统文件选择框**（`.json`）；只读取 `system_prompt`、`pre_prompt`、`post_prompt` 三个字段写入 `preset/prompt/`，maintenancePrompt 留空 → **尾代理默认关闭**。

两条导入路径在系统选择框中选定文件后进入**导入编辑页**（带「← 返回」）：与工作空间 / 制作卡片共用的**统一左树右编辑器**，解析结果**可直接编辑**，结构按标准卡骨架自动填充 — 目录导入把实读文件填入对应位置，缺失的 `setup/` / `scripts/` / `tools/` 以空目录补齐、缺失的提示词留空；酒馆卡仅三张提示词有内容、其余目录为空。顶栏「启用尾代理」checkbox 同步控制 `maintenancePrompt` 的灰显与入库状态。点**「保存并开始」**把结果收入卡库 `tavern_presets/`（重名自动加后缀）并加载进当前会话 → 进入开场页：开场页 **iframe 整页平铺聊天区**（无边框无圆角），卡没有 `preset/setup/opening.html` 时渲染**默认开场页** — 居中展示标题与简介的大卡页（酒馆卡导入即如此），直接在下方输入框开打。取消系统选择框则停留卡库页。隐藏文件（`.DS_Store` 等）不导入；二进制文件登记在树中但只显示占位信息；超过 1 MB 的文本不读入内容。

制作卡片 / 编辑卡的骨架：`preset/{prompt, setup, scripts, tools}` + `preset/meta.json`（title / desc / cover 占位字段；`preset/prompt/` 恰含 systemPrompt / prefixPrompt / postPrompt / maintenancePrompt 四个**空文件**；`setup/`、`scripts/`、`tools/` 各含一份 README.md 介绍该目录应该放什么样的文件）+ 空的 `runtime/`、`savings/`；编辑器顶栏「启用尾代理」checkbox 控制 `maintenancePrompt` 灰显（关闭 = 保存时以空串入库，运行时即不派生尾代理），右侧「保存并开始」落库并加载进会话。

## 用户在聊天中看到的内容

仅出现两种消息类型：

```
[user]    <用户真实输入>            ← 右对齐气泡
[assistant] <模型叙事回复>          ← 左对齐叙事段落
```

`prefix_prompt` 和 `post_prompt` **不在聊天中渲染** — 它们经 `ctx.systemPrompt.context()` 注册为 durable 的 user-role 动态快照，每次请求装配重新物化；插件产出快照文本前完成 `{{script}}` 渲染（不让裸 `{{…}}` 进入 system-prompt 的严格插值层）。快照是用户消息之外的独立 durable 对象，聊天渲染按此过滤。

助理回复是叙事段落（非聊天气泡）。用户消息使用紧凑气泡。

思考与工具调用不与气泡混排：以 DSH web 相同的灰色折叠行呈现 — 默认折叠成单行（思考：首行摘要；工具：工具名 + 截断为一行的结果），点击原地展开（工具行展开为 IN/OUT 终端卡片，思考展开全文）；运行中带整行扫光。头部标题为静态展示，不响应点击。

## 尾代理

一个完整的派生子代理会话 — 其上下文是**干净的分支**，不是用户对话的延续。它的系统提示词加载 `preset/prompt/maintenancePrompt`（维护提示词）；既不接受 `prefix_prompt` 也不接受 `post_prompt`。

- 系统提示词：`preset/prompt/maintenancePrompt` — 任务由它指定：「根据刚发生的叙事维护工作空间文档」
- 工具固定写死在引擎：runtimeRead + runtimeGrep + runtimeWrite（建档/整档覆盖）+ runtimeEdit（old_str→new_str 精确替换＋replace_all）+ runtimeDelete（不含 executeTools — `preset/tools/` 只服务主代理）
- 触发时机：监听 `session/event` 的 `turn/end` — 整个叙事回合结束后；不用 `step/end`（turn 内多次触发，且未闭合 turn 不在 fork 种子内）
- 尾代理运行显示为一行**灰色折叠行**（与工具调用同款样式）：默认折叠、显示一行摘要，完成后仍保留在流里，展开可查看其执行的写死工具与更新结果；运行中带整行扫光
- 尾代理运行期间**不可发送**（发送按钮与 Enter 均无效），但允许输入 — 这是主机侧 `agent/pre-step` 闸门（await 尾代理结果）的投影，操作层面的阻塞不靠 UI
- 将动态状态写入 `runtime/` — 不能触及 `preset/`
- 完成后、放行前自动 autosave（`autosave-<时间戳>`，保留最近 10 份）；手动保存/加载/删除是 UI 层的用户操作，不是代理工具
- **可选**：创建卡片时 `preset/prompt/maintenancePrompt` 内容为空，则完全不执行尾代理这一步 — 不派生 fork、不施加 `agent/pre-step` 闸门、无自动 autosave；编辑器顶栏「启用尾代理」checkbox 控制（关闭时该文件灰显只读、保存以空串入库）

## 工具（工具分层）

### 主代理工具
| 工具 | 范围 | 描述 |
|------|------|------|
| `roll` | 叙事 | DND 5e 掷骰 |
| `runtimeRead` | 仅限 `runtime/` | 读取 `runtime/` 下的文件 |
| `runtimeGrep` | 仅限 `runtime/` | 在 `runtime/` 下的文件中搜索模式 |

### 尾代理工具（固定写死，非 `preset/tools/`）
| 工具 | 范围 | 描述 |
|------|------|------|
| `runtimeRead` | 仅限 `runtime/` | 读文件（cat -n 行号/可选 view_range）或列目录（两层级） |
| `runtimeGrep` | 仅限 `runtime/` | 在 `runtime/` 下的文件中搜索模式 |
| `runtimeWrite` | 仅限 `runtime/` | 建档或整档覆盖写（content 全量落盘，父目录自动建）；.json 落盘前整档 parse 校验，坏则拒写 |
| `runtimeEdit` | 仅限 `runtime/` | old_str→new_str 精确替换（old_str 默认全文件唯一，空 new_str=删除，replace_all 全替换）；.json 落盘前整档 parse 校验，坏则拒写 |
| `runtimeDelete` | 仅限 `runtime/` | 删除 `runtime/` 下的文件 |

所有 `runtime*` 工具都会验证提供的路径是否解析在 `runtime/` 内，并拒绝任何逃逸路径。

`runtimeGrep` 模仿 CLI grep：接收一个 `pattern` 字符串和可选的 `path`（相对于 `runtime/`），搜索匹配文件，返回带文件路径的匹配行。

`runtimeRead` 接收一个相对于 `runtime/` 的路径并返回文件内容。

主代理可以读取和搜索 `runtime/`，但不能写入 — 写操作保留给尾代理。

### 掷骰工具（DND 5e 骰子）

`tavern-tavern` 示例卡在 `preset/tools/` 提供叙事脚本 `roll.sh`，主代理经 `executeTools` 调用。代理在分支决策点使用它。工具会回显叙事检查点 + 骰子结果 + 继续执行的指令（"must respect both"）。

```
executeTools("roll.sh", ["1d20"]) → "Rolled 1d20 -> 17 …"
```

## 保存/加载

存档即 `runtime/` 的完整快照，写入工作空间 `savings/<存档名>/`（目录名即存档名）。`preset/` 是卡片的固定可复用内容，随卡片存在，不入存档；会话日志不进入存档 — 存档是世界状态回滚点，载入只恢复 `runtime/`，对话历史保留在活会话中。

| 类型 | 触发条件 | 清理规则 |
|------|----------|----------|
| **autosave（自动）** | 每次允许玩家说话之前 — 尾代理更新完成、闸门放行前；命名 `autosave-<时间戳>` | 仅保留最近 10 份，超出的自动清理 |
| **手动保存** | 头部「保存」按钮 → 弹框输入存档名；上方列出已有存档，点击条目即填入名称（再次保存即覆盖）；同名保存需覆盖确认 | 永不自动清理 |

存档 tab 列出全部存档，每行提供「载入」（把快照恢复到 `runtime/`）与「删除」；保存动作只在头部「保存」按钮。快照在工作树中只读。

## 工作空间

侧边栏「开启新会话」在当前目录 `mkdir -p tavern_workspace/<时间戳>/` 作为干净的新工作空间；一个工作空间绑定一个活跃会话。

### 布局

```
tavern_workspace/<时间戳>/
├── preset/          ← 卡片固定内容（可复用，随卡复制）
│   ├── meta.json    ← 卡片元数据（title / desc / cover）
│   ├── prompt/      ← 提示词权威（恰好四个文件）
│   │   ├── systemPrompt     ← 主代理系统提示词
│   │   ├── prefixPrompt
│   │   ├── postPrompt
│   │   └── maintenancePrompt ← 尾代理系统提示词
│   ├── setup/       ← 初始可变状态模板（state/player/npcs/scenes）
│   │   └── opening.html ← 开场白页面（无聊天历史时聊天区渲染）
│   ├── scripts/     ← {{…}} 提示词模板脚本
│   └── tools/       ← 主代理 CLI 工具（经 executeTools 调用）
├── runtime/         ← 运行态：面板、可改设定、世界书（开局从 preset/setup 播种；尾代理维护）
└── savings/         ← 存档：每个子目录 = 一个存档，内容为 runtime/ 完整快照
```

### 世界卡牌模板

模板是纯数据目录，不是 npm 包。示例卡 `tavern-tavern/` 采用 `preset/` 结构：`prompt/`（四张提示词）、`setup/`、`scripts/`、`tools/` 与 `meta.json`（卡片元数据：标题 / 简介 / 封面图）。导入即复制 `preset/` 进工作空间并从 `preset/setup` 播种 `runtime/`；也支持 SillyTavern 酒馆卡（`.json`，导入时映射为 `preset/` 结构）。不需要 `agent.cordis.yml` — tavern 由 tavern profile 进程级装配（`dsh.profile.bundles = ['base', 'web-app', 'tavern']`），启动即生效。

设置模态框（通过头部「设置」打开；「工作空间」「存档」两个 tab）是工作空间的**文件树编辑器**（与制作卡片、导入编辑共用的统一左树右编辑器组件；本场景无顶栏控件）：

| 区域 | 描述 |
|------|------|
| 左面板 | 当前工作空间的文件树（`preset/` / `runtime/` / `savings/`） |
| 文件操作 | **右键菜单**：右键目录在其内部新建文件/目录、重命名、删除（`runtime/`、`savings/` 只读，菜单项禁用）；**拖动文件移动，松手需确认**；无 ＋按钮与 hover 操作图标 |
| 右面板 | 选中文件的内容编辑器 |

**文件类型处理：**
- **图片/音频/视频**：仅预览（只读）
- **文本文件**：可作为纯文本编辑
- **非多媒体文件 > 1MB**：显示"文件太大无法预览" — 不编辑

**保存行为**：编辑在失焦（离开编辑器焦点）时保存；没有保存按钮。

标准提示词文件位于 `preset/prompt/` 下（`systemPrompt`、`prefixPrompt`、`postPrompt`、`maintenancePrompt`）。`preset/prompt/` 恰好包含这四个文件。可改性分三类：`preset/` 仅用户可改；`runtime/` 由尾代理维护，不手改；`savings/` 快照只读。

## 自定义 CLI 脚本

存放在工作空间 `preset/scripts/` 目录中的纯 `.sh` 脚本。其中任何脚本都可用于 `{{scriptName(args)}}` 模板解析 — 文件名即为引用名称。通过 stdin/stdout 子进程执行。

## 设计令牌（亮色 · 近似自 DSH）

- **界面不使用任何 emoji** — 图标一律用文字或单色字形（如「▸」箭头、单字铭牌）
- 背景：`#f7f6f1`（暖纸白）/ 面板：`#ffffff` / 侧栏：`#fbfaf6 → #f3f1ea`
- 文本：`#29261f` / 次级：`#3d3a33` / 减弱：`#8b877c` / 强调金：`#b3860a`（文字）/ `#d4a017`（点缀）
- 用户气泡：`#f0ead9`，`border-radius: 14px`
- 边框：`#e2ded2` / 弱分隔：`#eae7dd`
- 字体大小：14px 正文 / 15px 叙事（衬线）/ 12.5px 折叠行摘要 / 11px 标签
