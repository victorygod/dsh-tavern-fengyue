# Agent Note：酒馆独立仓落地 + 卡脚本契约 v2(.mjs) + 全仓跨平台

状态：已实现

中文 | [English](2026-09-17-tavern-independent-repo-v2-scripts.md)

日期：2026-09-17 · Surface：repo-wide（engine / api / ui / bundle / scripts / tests）

## 背景

卡脚本 v1 = bash 文本(`.sh`)，经 `bash "路径" '参数'` 走宿主 shell 通道——引擎硬编码 bash，Windows 直接没有可用的执行面；write-card agent 写 bash 引号转义也是经典失败模式。同时整仓再核实了一遍跨平台面（Windows 侧 spawn EINVAL / URL.pathname 前导斜杠 / CRLF 外部格式）。

## 决策

1. **卡脚本契约 v2**：卡脚本 = node 模块（`.mjs`），执行统一为
   `node -e '<解码器>' -- <base64 脚本> <base64 参数载荷>`
   —— 解码器把 base64 参数解码后注入全局 `argv`（JSON）与 `args`（同值,兼容两套文风）；行内**零单引号**（三面逐字等价）。schema 声明从行注释改为头部块注释 JSON（`/** @tavern-schema … */`），解析用 marker + `*/` 边界（不能用 `$` 锚——后面还有正文行，$ 会失配漏过 '*/'）。
2. **`.sh` 全部退役**：模板/ fixtures 的 bash 卡脚本按行为等价改写 `.mjs`（get_weather / get_turn / roll / get_state）；ST 导入器生成物 persona/lorebook.mjs 同步；`tavern_presets` 里 DND 186 行 roll.sh 结算器忠实转译（含 rolls.log 流水、crit-pending 翻倍链、DC 标尺、成长分支）。
3. **写卡 agent 教程同步**：writer-guide.md 的 scripts/tools/验证环段落全部改写为 node 直跑三坑（多行输出拼接、existsSync 降级、args/argv 已解码勿再 base64）。

## 代码

- `packages/engine/src/tools.ts`：`NODE_RUNNER` + `cardScriptCommand(scriptText, argsPayloadJson)`；schema 解析改为 marker+`*/` 边界。
- `packages/engine/src/prompting.ts`：占位符与 `runCardScript` 走同一条 v2 通道（cwd=runtime 保留）。
- `packages/ui/src/client/st-import.ts`：生成 persona/lorebook `.mjs`（世界书扫描换纯 JS 抽取，去 jq 依赖）。
- 资产：模板/ fixtures / tavern_presets 的 `.sh` 全部转 `.mjs` 并删原件。

## 跨平台收口（同一批）

- dev.mjs：纯 Node pidAlive/stop（`process.kill(0)/SIGTERM/Atomics 同步小睡`）；bootstrap 的 pnpm install 改经 node 直呼宿主 CLI（绕 Windows `.cmd` spawn EINVAL）；start 默认**前台**（Ctrl-C 即停，`--bg` 保留）。
- setup.mjs（bundle bin）：win32 下 dsh 探测/pnpm install 走 shell 字符串形态；LOCAL link 斜杠归一为正斜杠。
- cleanup：`node scripts/cleanup.mjs`（netstat+taskkill / lsof+pkill 双路），sh 版退役统一入口。
- vitest 移除 win32 bash 守门：v2 卡脚本执行通道全 node，测试无平台分叉。
- `.gitattributes`：`*.sh`（存量卡作者层）/`.mjs`/`.ps1` 强制 LF——Windows checkout 的 CRLF 会让 bash 卡脚本 shebang 必炸。

## 已知边界

- 老 v1 bash 卡（外部带进来的）需要手转 `.mjs`（runner 契约很薄：`args` 全局 + stdout 即回执）。
- Windows 侧 `setup.mjs` 的 shell 曲面未真机实测；Linux 同族但亦未走全套门。
