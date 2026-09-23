# dsh-tavern-fengyue

[English](README.md) | 中文

[![dsh-plugin](https://img.shields.io/badge/dsh--plugin-plugin-2b6cb0)](https://github.com/topics/dsh-plugin)

**DSH酒馆风月** —— 跑在 [dsh](https://github.com/deepseek-ai/deepseek-harness) 宿主上的 RPG 世界设定卡引擎，支持直接导入 SillyTavern 等预设卡。

本项目旨在引导新时代酒馆类 agent 的开发范式：agent 技术已然成熟，酒馆类应用应建立在主流 agent 架构之上，而非自造一套专有配置体系。

## 目录

- [设计原则](#设计原则)
- [特性](#特性)
- [快速开始](#快速开始)
- [工作空间](#工作空间)
- [SillyTavern 卡导入](#silleytavern-卡导入)
- [文档](#文档)
- [参与贡献](#参与贡献)
- [许可](#许可)
- [免责声明](#免责声明)

## 设计原则

**LLM 只做推理，其他一切交给脚本。**

一层清晰的分工：

| 层 | 负责什么 |
|---|---|
| **LLM** | 叙事渲染（创造性写作）· 变化值的语义更新（角色情绪、场景、状态） |
| **脚本**（`preset/scripts/*.mjs` / `preset/tools/*.mjs`）| 掷骰、寻路、HTML 渲染、面板样式输出、状态机等一切固定逻辑 |

SillyTavern 同时抬高了使用者和卡作者的理解成本——用户不得不面对正则注入、世界书、注入深度这些概念；卡作者要学多门专有 DSL 才能做出一张功能丰富的卡。本项目把这一切收口回本地脚本：

- **ST 配置语言全面退役**——正则、STScript、世界书、宏全部归约为本地 `.mjs` 脚本；多路 depth 注入（多源堆叠在同一上下文里逐回合复现）改为每回合恰一道的单活 `postPrompt`，配合 dsh 内建的上下文自动压缩控制历史规模。agent 技术成熟的今天，复用已被广泛使用的基础设施，不再自造轮子
- **上下文结构复用普遍范式**——`systemPrompt`（固定）+ 压缩后的 history + 纯增对话历史 + 最新 user 消息 + 每回合动态注入的 `postPrompt`
- **工作空间即记忆**——`runtime/` 即 llm-wiki：常驻主索引 + 按需拉取的详情档案；无需向量、RAG 或复杂插件，检索、长期记忆、技能都由脚本 + 本地文件完美承载
- **内置写卡 Agent**——使用者的交互只保留「选卡 + 对话」；卡作者的学习成本转嫁给 AI，由 AI 代写脚本与配置，双向收敛倒逼概念体系必须精简
- **tools 与本地文件优先**——现代 agent 架构反复验证的「外存 + 工具」能力，不重复发明

**破除传统框架的不可能三角。**「功能丰富 / 编辑理解成本低 / token 花费可控」在传统 ST 里三者不可兼得。本项目把全部概念归约到系统框架本身之后，三者同时得到改善：

- **功能几乎无上限**——灵活的脚本几乎能承载任何逻辑，不受限于预定义概念集合的边界
- **编辑理解成本极低**——使用者只看界面选卡；作者让 AI 代写配置与脚本，无需学习专用 DSL
- **token 花费更省**——固定的上下文结构提升前缀缓存命中率；状态由尾代理写入磁盘，不再由模型逐轮复述

## 特性

- **极简界面**——用户只需要选卡 + 对话，理解成本极低；高级用户的自定义配置靠内置 agent 协助
- **SillyTavern 卡 / Fengyue 卡直接导入**——`.json` / `.png`；世界书自动转为 `lorebook.mjs`，正则自动转脚本，复杂逻辑交由 agent 翻译并附工作单报告，绝不静默丢弃
- **回合尾代理（tail agent）**——叙事回合结束后自动把状态变更写入 `runtime/`，前端直读文件渲染面板，不让模型把 token 花在重复输出的状态块上
- **自动 / 手动存档**——自动保留最近 10 次输入后的世界状态（聊天历史 + 模型上下文 + 本地文件），随时回退
- **跨平台**——一切脚本由 Node.js 执行，跨平台

## 快速开始

**前置**：Node.js ≥ 22.19 或 ≥ 24，pnpm（`npm i -g pnpm` 或 `corepack enable`）。

**兼容性**：已在 `@deepseek-ai/dsh` **0.1.5-rc.1** 与 **0.1.5-rc.2** 上验证——清单列在 [`config/dsh-compatibility.json`](config/dsh-compatibility.json)，`pnpm bootstrap` 会把最新的已验证版本装进 profile。上游 dsh 处于 developer preview(内核明示会有破坏性变更)；新版 dsh 若破坏 tavern profile，重跑 `pnpm bootstrap` 恢复已验证版本，或按 [docs/release/independence-and-release.zh.md](docs/release/independence-and-release.zh.md) 的外装回退路径操作。

### 本项目的分发形态

本仓库**本身就是一个 DSH profile 项目**：profile 与它的 bundle 层声明在 [`package.json`](package.json) 里，[`packages/`](packages) 下的各包全部从源码构建。**当前从源码安装**——就是下面这几步。

同一份 bundle 正在准备接入 dsh 官方的插件通道（发布到 npm 的 `dsh-tavern-fengyue` 及其三个兄弟包，再按 profile 用 `dsh plugin add` 安装）。该路径尚未端到端演练复现，因此演练完成前本 README 有意不写它。

### 从源码安装并运行

在项目目录执行：

```sh
pnpm install       # 克隆后必须先装依赖，检出里不含任何构建产物
pnpm build
pnpm bootstrap     # 把本检出注册为 `tavern-fengyue` profile
pnpm tavern        # 前台启动宿主；Ctrl-C 结束
```

宿主的 Web UI 在 **http://127.0.0.1:3081**。酒馆 profile 自带独立端口，因此可以与默认 3080 的 `dsh web` 并存；启动时会打印完整 URL（带登录 token）。`--port` 可覆盖：`pnpm tavern --port 3099`。

`pnpm tavern` 用的是本仓自己钉的宿主（`node_modules/@deepseek-ai/dsh`），**不需要全局安装 `dsh`**。它自带独立的宿主家目录（`~/.dsh-tavern-fengyue`），不会碰你已有的 `~/.dsh`；要换位置就设 `DSH_HOME`，换完重跑一次 `pnpm bootstrap`。

### 日常运行

在本检出里再跑 `pnpm tavern` 即可。profile 的包与宿主都来自本检出（`link:` 依赖），所以改完源码 `pnpm build` 就够——profile 会实时重新应用 bundle 层。

若想用全局安装的 `dsh` 驱动同一个 profile，那个宿主必须读到 profile 所在的家目录：

```sh
DSH_HOME=~/.dsh-tavern-fengyue dsh --profile tavern-fengyue               # bash / zsh
$env:DSH_HOME="$HOME\.dsh-tavern-fengyue"; dsh --profile tavern-fengyue   # PowerShell
```

（或者一开始就把 profile 写进宿主的默认家：`DSH_HOME=~/.dsh pnpm bootstrap`。）

### 首次游玩

1. 侧栏「API Key」→ 填入模型 Key（或通过 `DEEPSEEK_BASE_URL` / `DEEPSEEK_API_KEY` 环境变量指定自建 endpoint）
2. 点「＋ 开启酒馆会话」→ 三选一：从卡库选卡 / 导入 ST 卡 / 从空白骨架让 AI Agent 帮你写一张新卡
3. 每回合：模型叙事 → 尾代理记账 → 面板自主刷新
4. 头部「保存 / 加载 / 清空」随时冻结 / 恢复这个世界

### 停止

宿主终端 Ctrl-C；后台模式 `pnpm stop`。

## 工作空间

每个会话在 `tavern_workspace/<timestamp>/` 下创建独立目录：

```text
<workspace>/
├── preset/              ← 卡牌固定内容（跨会话复用）
│   ├── meta.json        卡片元数据
│   ├── prompt/          systemPrompt / postPrompt / maintenancePrompt
│   ├── setup/           初始状态模板
│   ├── scripts/         {{script}} 模板脚本
│   ├── tools/           主代理 CLI 工具
│   └── assets/          媒体文件
├── runtime/             ← 运行时状态（尾代理维护）
└── savings/             ← 存档（runtime 快照）
```

进入模型上下文的一切都来自这些可打开审查的文件——这是整个项目的记忆系统。

## SillyTavern 卡导入

导入 ST 卡时，世界书自动归约为 `lorebook.mjs`；正则、STScript，以及社区衍生扩展（如 MVU 变量更新体系）等无官方对应机制的源料进入 `preset/st-import/` 翻译工作单并附导入报告——能力保留，概念归一。完整机制对照见 [sillytavern-mechanics-and-import.zh.md](docs/cards/sillytavern-mechanics-and-import.zh.md)。

**关于 MVU**：本框架完全支持 MVU 范式，但更推荐用 `preset/tools/` 的主代理工具替代——工具调用可以「边叙事边改状态、随轮返回更新后的值」，一条叙事流内自然完成状态读写。如果不想让 tool call 打断叙事流、确需使用 MVU 的「叙事正文内嵌变量更新指令」范式，本框架下的 hook 脚本 + 前端 JS 展示层也完全支持这条路径。

## 文档

深度文档在 [`docs/`](docs/)——按领域分组,完整地图见[文档索引](docs/README.md);目前中文为主,整理成体系后补英文:

- [设计](docs/architecture/design.zh.md) · [文件树](docs/architecture/file-tree.zh.md) · [脚本与工具](docs/architecture/scripts-and-tools.zh.md)
- [卡面 hooks](docs/cards/card-hooks.zh.md) · [SillyTavern 机制与导入](docs/cards/sillytavern-mechanics-and-import.zh.md) · [字段映射](docs/cards/st-card-field-mapping.zh.md)
- [动态 post 注入](docs/runtime/dynamic-post-injection.zh.md) · [自动存档与重试](docs/runtime/send-moment-autosave-and-retry.zh.md) · [尾代会话归档](docs/runtime/tail-session-archive.zh.md)
- [无 Key 测试](docs/testing/keyless-testing.zh.md) · [mock-LLM 测试](docs/testing/mock-llm-testing.zh.md)
- [独立性与发布形态](docs/release/independence-and-release.zh.md)

`docs/notes/` 是按日期的定案/修复笔记与编年体[开发日志](docs/notes/devlog.zh.md)——历史记录,与代码冲突时以代码与 README 为准。

## 参与贡献

欢迎 PR——见 [CONTRIBUTING.zh.md](docs/CONTRIBUTING.zh.md) 与 [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)。review 前 `pnpm lint`、`pnpm build`、`pnpm test` 必须全绿（CI 在 Ubuntu / macOS / Windows 上跑同一套）。

## 许可

本项目自有代码 MIT——见 [LICENSE](LICENSE)。来自上游 DSH 的代码遵循各自许可;vendor 快照与 SRD 5.1 语料(按 CC-BY 4.0 分发,不适用 MIT)清列于 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 免责声明

- **非官方、无关联**——DeepSeek / DeepSeek Harness、SillyTavern、Dungeons & Dragons / SRD(Wizards of the Coast)、原神(HoYoverse)分别为其各自所有者的产品。本独立项目与上述任何一方不存在关联、背书或赞助关系;名称仅用于指称与互操作。
- **内容归卡,不归项目**——引擎运行的是你自写或导入的任意卡。导入的社区卡言论与其作者相关;本项目不审查、不背书、不策展卡内容,受限内容(如 18+)的责任由导入者按当地规则自负。
- **按原样提供**——依 MIT 许可,不作任何担保。示例预设图片为 AI 生成,已在 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) 标注。
