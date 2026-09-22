---
description: "酒馆浏览器界面：root 槽游戏页——会话侧栏、卡库、开场页、叙事转写与投影供数的 composer，供酒馆 UI 的维护者使用。"
kind: "package-reference"
---

# dsh-tavern-fengyue-ui

[English](README.md) | 中文

## 概述

`dsh-client-ui-tavern` 在浏览器里绘制酒馆游戏页：它以更低优先级 shadow 内建 `root` 槽，因此在 `tavern` profile 上本页整体替换默认 web 外壳。页面覆盖会话侧栏（带封面图与末行预览的工作空间行）、就地卡库与导入流、开场页、带可折叠思考/工具/记账行的叙事转写，以及 composer——模型席位、上下文占用环与宿主投影供数的一行式用量条。你只在酒馆 profile 上遇到它。

## 目录

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

无可配置项，也无可导入项：profile 组装该行，页面自行挂载，所有服务在启动审计后的组件体内解析。

<a id="understand-the-implementation"></a>
## 理解实现

- **[TavernApp.tsx](./src/client/app/TavernApp.tsx)** — 页面本体：按需打开的 Key 对话框（发送预检、`MISSING_CREDENTIAL` 失败行、侧栏入口）、存档对话框、设置模态，以及带尾代理闸门、两级模型菜单、↻ 重试流（retryPoint → prompt 重发 → 会话切换）、载入草稿回填与 Esc 快捷键（停/关对话框；双击清空输入框或开加载页）的聊天视图。默认开场页渲染 `preset/greetings.json` 的开场选项（点击填入输入框，不代发；文件缺席或坏 JSON 静默回退标题+简介）。
- **[chat-view.tsx](./src/client/chat-view.tsx)** — 主聊天与写卡列共用的转写事实、输入区与转写滚动的底部钉屏。每条 user/narrative 行挂恒占空间的操作行（复制带 ✓ 反馈；最后一条回复另挂 ↻ 重试），hover 显隐与 stock web UI 同机制。
- **[TavernView.tsx](./src/client/TavernView.tsx)** — 卡库、导入预览、草稿编辑器，以及右键菜单对固定路径省略重命名/删除的统一工作空间编辑器。卡片身份头的标题/简介行内编辑附「作者 · 版本」小字行，保存按字段保真合并（不编辑的 meta 字段——tags 等——永不因编辑丢失）。导入入口吃 `st-import.ts` 解析器：.json/.png 容器探测、V1/V2/V3 归一化、五路折叠（systemPrompt 段序/lorebook.json/greetings.json/meta/翻译工作单+导入报告），「从其他目录导入」入口已删除。
- **[rpc.ts](./src/client/rpc.ts)** — 生成命名空间之上的类型面，统一解包每个 `RemoteResult` 信封。
- **[card-ui.ts](./src/client/card-ui.ts)** — 载入绑定卡的 `preset/ui/` 展现包（theme.css / chat.css / layout.json / index.js）并直接挂载：安装卡已是宿主级信任，故无授权弹窗。`chat.css` 过 CSS 卫队后选择器前缀 `.tavern-stage` 注入；`theme.css` 不在此注入——以 `themeCss` 返回交给 themes.ts 的统一样式表。
- **[themes.ts](./src/client/themes.ts)** — 主题系统：三套内建 token（羊皮纸、DSH 亮、DSH 黑——含配色与字体栈，DSH 两套按 web UI 设计 token 解析），以单张 `#tavern-theme` 样式表落在 `.tavern-root` 钩子上。页头右上角的下拉（聊天页与库页都常驻）可选卡片主题或内建主题（存 `tavern.ui.theme`，localStorage）；选内建即整体替换绑定卡的 `theme.css`，选 `card` 则把它拼在羊皮纸基座之后。
- **App.module.css** — 原型样式表的一比一 module 化（[docs/tavern-prototype](../../../docs/tavern-prototype/design_zh.md)）；颜色与字体全部读 `--t-*` token、零字面量——声明归 themes.ts。

## 开发备注

所有服务都在组件体内解析：槽位回调在 loader 的动态阶段运行，此时 sessions/remote 可能尚未激活——在 apply 时读取会静默丢掉整页。

<a id="model-experience"></a>
## 模型体验

间接地，经 sessions binding 与酒馆引擎：本页只展示与入列回合，从不自行组装请求。

#### KV Cache 影响

无——本页不加请求前缀；缓存效果由引擎持有。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

不发布 invariant companion：浏览器界面没有自有状态——每个值都是 rpc 或投影读取，wire 形态由各规格的假面逐方法钉住。

- **投影缺位退化为零** — 没有 token-meter 与 session-stats 投影单元时，用量条全读 0、占用环保持空态；本页把能力缺席当占位符，从不报错。
- **主题选择只在本地浏览器** — 设置页的主题选择存于 `tavern.ui.theme`（localStorage），不随卡、不随账号走；新浏览器默认 `card`。
- **卡封面恒为羊皮纸美术** — 书架封面渐变（tint0-3）与其白色覆盖字/蒙层 alpha 刻意保留字面量：那是卡的美术资产，不是可主题化的界面铬。
- **`FIXED_PATHS` 镜像** — 菜单的固定路径清单镜像引擎策略，必须随之移动。
- **末行预览依赖 localStorage** — 侧栏的每会话末行来自本地缓存，新浏览器上可能为空。
- **会话列表来自磁盘扫描** — 侧栏渲染 `workspaces()` 的磁盘行，工作空间的会话未运行时卡片不带实时转写状态。
