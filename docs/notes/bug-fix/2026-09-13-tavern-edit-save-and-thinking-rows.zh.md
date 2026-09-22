# Agent Note：卡库编辑保存语义与思考行的链路真相

Status: implemented

[English](2026-09-13-tavern-edit-save-and-thinking-rows.md) | 中文

## 问题

编辑卡就地编辑落地后的真机手测暴露五个缺陷。(1) 编辑器失焦双写把工作空间 `preset/` 文件镜像进了错误路径——`preset/` 段被切掉，写入落在 `tavern_presets/<卡>/prompt/…`（卡根下、卡库树外），卡面从未更新。(2) 即使路径修对，双写设计本身违反契约：每次失焦都在改卡库，「返回」永远回不到初始状态。(3) 思考流在持久化日志里全程正确，但转写把消息的 `reasoning` 内容块漏进了叙事气泡，且监听的是会话格式里根本不存在的 `assistant/attempt` 日志事件——打包的 stream 挂在 `assistant/message` 的 `data` 上。(4) `switchSession` 只对 `sessions.refresh()` 的失败重试；成功回调里 `sessions.open()` 的同步抛错变成未处理 rejection，无重试无提示。(5) mock 的 `success` 行为思考与正文零间隔连发，看不出流式，也没有思考→正文的停顿。

## 决策

**编辑绝不碰卡库。** `writeText` 只写工作空间，失焦镜像删除。卡库只经两个显式动作更新：`saveEdit`（仅保存——工作空间 preset 覆盖被编辑的卡，编辑戳**保留**，可继续改）与 `publishCard`（保存并开始——发布并清戳，随后 `reset` 换绑全新会话）。`editDirty`（新增 RPC）按字节与结构比较工作空间 `preset/` 树与被编辑卡（`workspace.ts` 的 `presetDiffers`）；「返回」先查它——干净直接离开，脏（或查询失败，宁稳勿丢）弹三选框：取消留在编辑器、不保存走 `cancelEdit`（重新载入原卡）、保存先 `saveEdit` 再离开。`importFromLibrary` 与 `draftCard` 清陈旧编辑戳，无镜像的工作空间不会再静默指向无关旧卡。

**转写读持久化真形，不读想象。** `blocksOf` 只收 `type: 'text'` 内容块；思考行从同一 `assistant/message` 事件的 `data.stream` 聚合 `reasoning-chunks`（`reasoningOf`）——会话日志里不存在独立的 `assistant/attempt` 事件类型，修复前先对着真实 `session.v3.jsonl.zstd` 取证。live 思考增量仍走 transient `assistant/live-chunk` 帧；流式 summary 跟随最新一行并带原型扫光，思考期间隐藏打字点。

**换绑重试覆盖 open 抛错。** `switchSession` 把 `sessions.open` 的同步抛错纳入退避循环（与 `refresh()` 拒绝同路，≤8 次 × 250ms，全失败弹 `app.openFailed`）——rebind 不再在 refresh 与 open 之间静默死亡。

**mock 分相位节奏。** 新增 `--reasoning-gap-ms` 在最后一条 reasoning 增量与第一条 content 增量之间停顿（默认 0；`scripts/mock-llm.sh` 经 `REASONING_GAP_MS` 默认 800）；reasoning 增量按 `--chunk-delay-ms` 节奏发送（脚本默认 40ms）；思考文本保留真实换行。测试计时读排空的 body——`fetch()` 在响应头就 resolve，否则会漏掉流中段的停顿。

证据：引擎组合测试现钉「编辑不碰卡库 / `saveEdit` 保留编辑态 / `publishCard` 清戳」；客户端用例钉三选返回框与纯 text 叙事。排障全过程：`docs/tavern-prototype/load-rebind-debug_zh.md`（二轮/三轮/四轮定案）。

## 备选方案

**保留失焦镜像、只修路径。** 最初只是想修掉 slice 错位；败在契约本身——每次失焦都改卡库，返回的"恢复未动状态"在结构上不可能成立，因为设计里从来没有存过先前状态。

**每次失焦加确认弹窗。** 给旧双写加确认救不了契约，倒在两件事上：每个字段都弹窗导致疲劳，且用户走开时卡库仍可能停在中间态。

**给会话格式补上缺失的 `assistant/attempt` 事件。** 认下转写想象的真实性等于扩 `SessionEventMap`（外加 scoped-events 重生成），为一个日志里根本不存在的事件扩格式；流式记录本来就挂在 `assistant/message` 的 `data` 上，改读真身即可。

## 后果

失焦不再落盘：编辑后直接关页的改动按设计丢失，仅保存/保存并开始成为回写卡库仅有的两个动作——"保存"手势从隐式转为显式。换来的是返回永远能回到已知状态、卡库不可能落后于工作空间、转写渲染与持久日志逐字一致。脏态返回多一步确认（`editDirty` 校验失败亦按脏态处理）。
