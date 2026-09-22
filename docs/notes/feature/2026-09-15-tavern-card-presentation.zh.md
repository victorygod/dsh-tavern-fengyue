# Agent Note: 酒馆卡片展现层（per-card UI）

Status: implemented

[English](2026-09-15-tavern-card-presentation.md) | 中文

## Problem

卡作者能定义一切，唯独定义不了玩家看到的页面：界面是宿主固定皮肤、转写是转义纯文本，而 SillyTavern 生态反复验证的「卡自带界面」体验（消息内 HTML 状态栏、作用域 `<style>`、per-card 主题、自定义面板）在我们这里没有落点。目标（历经四轮评审定案，`docs/tavern-prototype/card-presentation_zh.md`，逐条对标本地 SillyTavern 1.18.0 源码）：per-card 主题、per-card 布局、正文 markdown/HTML 渲染、脚本驱动面板——同时不动 `packages/core`，且展现面永远改不了模型可见的真相。

## Decision

一份数据视图、一个脚本库、两个只读面。引擎维护 `runtime/.chat.snapshot.jsonl` —— 绑定会话 durable user/assistant 消息的整文件投影（首行 head + `{seq,kind,orig,plain}` 行；随每条消息事件从 durable 日志整写，换绑再整写一次；提交路径在 wrap 渲染前把玩家输入投影为 pending 行，让世界书扫描命中当前输入，提交失败时下一次重写自愈）。占位符语法收敛为一种含义：`{{name(args)}}` 执行 `preset/scripts/name.sh` —— 每实参引号包成一个 argv（16KB 上限）、嵌套调用深度优先求值（深度 4、单渲染 8 次 spawn、渲染内去重）、废弃的裸 `{{name}}` 静默保持字面量。脚本、工具与前端 `runScript` 共用同一 spawn 契约（cwd = `runtime/`；不注入 env——工作空间树形布局本身就是契约）。前端只保留一个函数：`mount(tavern)` + `tavern.runScript`；theme/chat CSS 过卫队（禁 `@import`、绝对 `url()`），`chat.css` 选择器自动前缀 `.tavern-stage`（css-tree），消息正文走 markdown → DOMPurify → 作用域 `<style>`（上游 `chats.js` 的 encode/decode 技法），`layout.json` 钳制窗口/面板/HTML 开关，点文件由新的编辑器开关收纳。授权每绑定确认一次、按会话记忆。

## Alternatives considered

**TavernContext env 快照 + `ctx.` 表达式**（早期草案）。落选原因：每个消费需求最终都归结为读引擎已在维护的文件——env 通道、表达式变量、预留命名只能带来第二套求值面和第二份要版本化的 schema。**iframe 沙箱面板 + postMessage 桥**。信任模型落定后落选：卡脚本本就跑宿主侧 bash，沙箱防不住任何卡够不到的东西，桥反而把每个同步 bug 都吞下。**服务端派生默认名 / 跨区移动**（编辑器文件操作）。范围落选：默认名是客户端关切，区身份则在保护卡不被维护代理自己的写混淆。

## Consequences

全部改动留在 tavern 三包；`packages/core` 零触碰，对 `tavern-baseline-2026-09-14` 的内核 diff 校验依旧成立。`api/tavern` 只新增一个 RPC（`runScript`）并拓宽 `scriptFailures` 原因联合；测试覆盖投影器（投影/自愈/pending）、求值器（语法/引号/嵌套/预算/cwd）与编辑器开关。刻意推迟：markdownOnly 显示改写钩子、设置模态内的按卡开关（v1 用确认框覆盖）、ST 的 alternate_greetings。后续按本地单用户定位放开：writer guard 于 2026-09-16 整体拆除：写卡 agent 持有完整产品面（含 shell 与委派），不再有任何 guard 行，writer-guide 提示词文档外置 `packages/extensions/tavern/prompts/writer-guide.md`、重读动态、补齐界面体系参考（钩子表/场景→落点表）。preset 选型：agent-presets 回归 tavern 组合——主/尾跑 minimal（被既有 restrict 剥净），writer 跑 standard（完整产品面）；REAL 测试钉死三 agent 的模型可见工具边界。
