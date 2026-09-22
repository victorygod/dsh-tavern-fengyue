# Tavern RPG 插件 — 文件树结构

## 目录结构

```
packages/
├── extensions/
│   └── tavern/                    ← 后端插件包 @deepseek-ai/dsh-tavern（新建）
│       ├── package.json           ← 包定义、依赖声明、files 配置
│       ├── tsconfig.json          ← TypeScript 编译配置（继承 tsconfig.base.json）
│       ├── tsdown.config.ts       ← tsdown 打包配置
│       ├── src/
│       │   ├── index.ts           ← 插件入口（name / inject / Config / apply）
│       │   └── types.ts           ← 类型声明（无运行时代码）
│       ├── lib/                    ← 构建产出（不纳入版本控制）
│       │   ├── index.js
│       │   └── types/
│       │       └── index.d.ts
│       ├── tests/
│       │   └── tavern.spec.ts     ← 单元测试
│       └── README.md              ← 包说明文档
│
├── bundle/
│   └── tavern/                    ← @deepseek-ai/dsh-bundle-tavern（新建）
│       ├── package.json           ← 声明 dsh.bundle.patch → ./cordis.patch.yml
│       └── cordis.patch.yml       ← 三行：host 行挂 @deepseek-ai/dsh-tavern、api 行挂 @deepseek-ai/dsh-api-tavern、client 行挂 @deepseek-ai/dsh-client-ui-tavern
│
└── client/
    └── ui-tavern/                 ← 前端 UI 包 @deepseek-ai/dsh-client-ui-tavern（新建）
        ├── package.json           ← 包定义、依赖声明
        ├── tsconfig.json          ← TypeScript 编译配置
        ├── tsdown.config.ts       ← tsdown 打包配置
        ├── src/
        │   ├── index.ts           ← 客户端入口（slots 注入）
        │   └── client/
        │       ├── index.ts              ← UI 主组件总入口
        │       ├── WorkspaceSettings.tsx ← settings modal 内的 tavern 设置面板
        │       ├── FileTree.tsx          ← 文件树组件（preset/ / runtime/ / savings/；右键菜单 + 拖拽移动）
        │       ├── ChatRenderer.tsx      ← 聊天渲染（user bubble + assistant narrative + 思考/工具/尾代理灰色折叠行）
        │       ├── ChatTitle.tsx         ← header 纯文字卡名标题（无框，不可点）
        │       └── slots.ts              ← slot 落座（conversation.session shadow 等）
        │   └── locales/
        │       ├── en.ts          ← 英文文案
        │       └── zh.ts          ← 中文文案
        ├── lib/                    ← 构建产出（不纳入版本控制）
        │   ├── index.js
        │   └── types/
        │       └── index.d.ts
        ├── tests/
        │   └── tavern-ui.spec.tsx ← 客户端单元测试
        └── README.md              ← 客户端包说明文档

docs/                             ← 本目录文档以中文为主（英文版待文档集成体系后成对补齐）
├── README.md                     ← 文档索引（分节导航）
├── CONTRIBUTING.md / .zh.md      ← 参与贡献（双语）
├── architecture/                 ← 设计总纲 · 文件树 · 脚本与工具
├── cards/                        ← 卡钩子 · per-card UI · SillyTavern 导入三篇
├── runtime/                      ← 动态 post 注入 · 发送时刻存档 · 尾代会话归档
├── testing/                      ← keyless · mock-LLM 测试
├── release/                      ← 独立性与发布形态
├── notes/                        ← 按日期的工程笔记 + 编年 devlog（历史记录）
├── prototype/
│   └── ui-mockup.html            ← HTML 原型（会话列表 + 开局页默认卡库平铺（加载/编辑/删除）与三入口就地切换、制作卡片页带尾代理状态、preset/runtime/savings 结构、右键菜单与拖拽、预览铺满、无 emoji）
└── templates/
    └── tavern-tavern/            ← 示例卡（preset/ 结构，四张提示词含 maintenancePrompt）
```

## 进程装配（bundle + profile）

tavern 是一次进程启动即全部就位的组合，不走会话级预设行。tavern profile（`$DSH_HOME/profiles/tavern`，随 `PROFILE_TEMPLATES` 提供模板）声明 `dsh.profile.bundles = ['base', 'web-app', 'tavern']`：base 与 web-app 提供既有产品能力与浏览器应用，tavern bundle（`packages/bundle/tavern`）最后一片，补丁插入 host、api、client 三行。`dsh --profile tavern` 启动即为改造版设定卡界面；bundle 行仍受 profile 层、home 层与 `--patch` 逐层覆盖踩平。

## UI 在哪里、怎么渲染

DSH 的 web UI 使用 **slot-based injection** 系统渲染。tavern 的整页接管不是塞一个设置面板，而是用 single-slot **shadowing** 换掉对话主视图（`packages/client/ui-conversation/src/client/apply.ts` 声明 `'conversation.session': { kind: 'single', scope: 'session' }`）：

```
ui-tavern（浏览器半面）注册：
  conversation.session   ← single slot，priority 更低（如 -1）shadow 掉
                            ui-conversation 的 ConversationSession —
                            启动即接管整个对话区（own children：副本
                            转写、开场页、开局卡库、编辑器视图）
  sidebar.workspaces     ← single slot shadow → 左侧换成会话列表
  conversation.chat.node ← keyed（按 ChatNodeKind）：user 气泡 /
                            narrative 段落 / 思考·工具·尾代理灰色折叠行
                            （样式对齐 ui-chat 现有 ReasoningRow/ToolRow）
  conversation.session.header.actions ← list：头部追加 保存/加载/清空
  conversation.composer  ← chain：记账闸门期的发送抑制投影

register 的 target slot 必须已被声明；新 slot 由拥有界面的包经
SlotMap 声明合并（TS declare module）。single slot 同 priority 二次注册
抛错，不同 priority 时最低 live priority 渲染（shadowing）。
```

因此 tavern 需要 bundle 里的**三**个配合行（host + api + client），文件分三处：
1. **`packages/extensions/tavern`** — 后端插件：prompt 快照、tools、尾代理调度、工作空间/卡库/存档编排
2. **`packages/api/tavern`** — Remote RPC 面（形如 `packages/api/workspace-files`）：浏览器半面跨进程调用 —— 会话创建（`cwd = tavern_workspace/<时间戳>`；`session.create` 接受 `cwd` 或 `workspaceId`，见 `packages/api/session-controller/src/commands.ts`）、卡库导入、文件树/编辑器写回、存档操作
3. **`packages/client/ui-tavern`** — 双面前端包（`dsh.client` + `exports['./client']`，node 半面空 `apply()`，形如 `ui-jobs`），按上面的 slot 落座

关键点：
- 文案走 locale 字典（`verify-client-ui-i18n` 闸门拒绝硬编码文案）
- 文件树 editor、聊天渲染器等都遵循 DSH 现有的 UI 组件模式（`ui-primitives` 组件、`ui-theme` tokens）

## 各文件改动内容简介

### `packages/extensions/tavern/`（后端插件）

见 [design.zh.md](design.zh.md) 中的设计理念。

### `packages/client/ui-tavern/`（前端 UI 包 — 全新）

#### `package.json`
- 包名：`@deepseek-ai/dsh-client-ui-tavern`
- `type: "module"`（ESM）
- 双面结构：node 半面 `main: "lib/index.js"` + 浏览器半面 `exports["./client"]`（`dsh.client` 字段声明 — 客户端包加载器扫描装配行后构建浏览器启动图，形如 `packages/client/ui-jobs`）
- peerDependencies：
  - `@deepseek-ai/cordis`
  - `@deepseek-ai/dsh-client-ui-slots`（slot 注入）
  - `@deepseek-ai/dsh-client-ui-primitives`（Modal、Button 等 UI 基础组件）
  - `@deepseek-ai/dsh-client-ui-settings`（settings scope）
  - `@deepseek-ai/dsh-client-locale`（i18n）
- dependencies：无额外依赖（复用 DSH 现有 UI 原语）
- 浏览器半面 `inject = ['slots', 'locale', 'remote', 'sessions', 'workspaces']`
- `apply(ctx)`：调用 `ctx.slots.inject(key, () => ctx.slots.register(...))` 注册 tavern 面板

#### `src/index.ts` — node 半面入口（形如 ui-jobs）
- 导出 `name`、空实现 `apply(ctx)`；真实贡献在浏览器半面

#### `src/client/index.ts` — 浏览器半面入口
- 导出 `inject`、`apply(ctx)`：
  1. 注册 locale 字典（`ctx.locale.register(...)`）
  2. `ctx.slots.inject('conversation.session', () => ctx.slots.register({ name: 'conversation.session', priority: -1, locale: 'tavern' }, TavernSessionView))` — shadow 掉 ui-conversation 的会话视图接管对话区；`sidebar.workspaces` 同法 shadow 成会话列表
  3. 其余 slot 注册（模式选择器、聊天气泡/叙事渲染等）同上按 key 逐个注入

#### `src/client/slots.ts` — Slot key 整理
- shadow：`conversation.session`、`sidebar.workspaces`；keyed 渲染器：`conversation.chat.node`；list：`conversation.session.header.actions` — 全部为已声明的 slot，以 `packages/client/ui-slots` 的 `SlotMap` 声明为准
- 若确需新 slot（如 `conversation.hero.workspace` 的 workspace picker），由拥有该界面的包把键与 kind/scope 合并进 `SlotMap`（`declare module`）；未声明的 slot 注册会抛错

#### `src/client/TavernSessionView.tsx` — 会话主视图（conversation.session shadow 的落座组件）
- 自声明子视图：开场页 iframe、开局卡库、文件树编辑器；设置模态（工作空间/存档两 tab）复用同一编辑器组件
- Tab 布局（两页）：
  - 「工作空间」Tab：文件树 editor（preset/、runtime/、savings/）+ 文件编辑器；右键目录/文件操作（新建、重命名、删除），拖动文件移动（松手确认），无 ＋按钮与 hover 操作图标；工具说明并入本页页脚（`executeTools` 仅主代理；尾代理 runtime* 写死）
  - 「存档」Tab：快照列表（`savings/<存档名>/`，autosave 保留最近 10 份、手动存档不自动清理）+ 每行「载入」（把快照恢复到 runtime/）与「删除」；保存动作只在头部「保存」按钮（弹框命名、同名覆盖确认）
- 文件树行为同 ui-mockup.html prototype（制作卡片页复用同一编辑器组件：就地渲染、无存档 tab，并显示「尾代理：启用/关闭」状态标签 — 依据 preset/prompt/maintenancePrompt 是否为空）
- 编辑 blur 保存

#### `src/client/FileTree.tsx` — 文件树
- 左侧树形目录（preset/、runtime/、savings/）
- 右侧文件内容编辑器
- 文件类型处理：图片/音视频预览只读、>10MB 拒绝预览
- 右键菜单：新建/重命名/删除文件和目录
- workspace 文件读写走 `workspaceFiles.read()` / `workspace-write` sandbox mode

#### `src/client/ChatRenderer.tsx` — 聊天渲染
- User message → 右对齐气泡
- Assistant narrative → 左对齐段落（带 label/speaker）
- 工具调用结果展示

#### `src/client/locales/zh.ts` — 中文文案
- tavern 面板各区域的中文标签

#### `src/client/locales/en.ts` — 英文文案
- tavern 面板各区域的英文标签

#### `src/client/index.ts` — UI 主组件总入口
- 导出所有组件

### 示例卡模板（docs/tavern-prototype/templates/）

```
docs/tavern-prototype/templates/
└── tavern-tavern/
    └── preset/
        ├── meta.json          ← 卡片元数据（title / desc / cover）
        ├── prompt/
        │   ├── systemPrompt   ← 主代理系统提示词
        │   ├── prefixPrompt
        │   ├── postPrompt
        │   └── maintenancePrompt ← 尾代理系统提示词
        ├── setup/             ← 初始可变状态（state/player/npcs/scenes）+ opening.html 开场白页面
        ├── scripts/           ← {{…}} 提示词模板脚本
        └── tools/             ← 主代理工具脚本
            ├── roll.sh        ← DND 5e 骰子（演示之用）
            └── get_turn.sh    ← 获取回合信息（演示之用）
```
