# Agent Note: 酒馆编辑器文件操作——runtime 区内改名与防撞名创建

Status: implemented

[English](2026-09-15-tavern-editor-file-ops.md) | 中文

## Problem

手测暴露两个编辑器文件树缺陷。(1) `runtime/` 行的右键菜单给出看似可用的「重命名」，但引擎 `workspaceFileOp` 的 move 守卫只接受 `preset/` 路径，客户端又把被拒的 RPC 静默吞掉（`then(reload, () => undefined)`）——点了没反应，任何地方都无信号。(2) 创建同名文件比「重复」更糟：编辑器 create 操作没有占用检查，`writeFileSync(path, '')` 会静默清空既有活文件——尾代理的 `runtimeCreate` 拒绝占用目标，编辑器自己的 fileOp 反而没有——mkdir 撞已存在路径则是递归 no-op。客户端默认名写死 `untitled.md`，同目录第二次创建必然撞名。

## Decision

每个面各一条规则。引擎（`workspace.ts`）：move 限于单一可编辑区内——`preset/` 与 `runtime/` 经新的 `editableAreaOf` 配对检查自由改名，跨区移动与 `savings/` 仍拒绝，因为 savings 快照是载入路径的事实源、区身份分隔用户著作的卡内容与尾代理维护的世界状态；create 与 mkdir 对占用目标 fail loud（`already exists — creating/mkdir needs a free name`）。客户端（`TavernView.tsx`）：新建默认名对当前树去重——`untitled.md` → `untitled-1.md` → `untitled-2.md` ……上限 1000，超限回落基础名让引擎守卫兜底竞态——磁盘编辑器与内存导入表两种模式同享。[design_zh.md](../../../../docs/tavern-prototype/design_zh.md) 的编辑器段同步动词。

## Alternatives considered

**服务端派生命名。** 给 create 操作加 `unique` 标志由引擎派生空闲名。本次落选：默认名如今是客户端关切（wire 操作从不携带名字模板）、客户端本就握有递增所需的树数据，且服务端派生要付出 api/tavern wire 变更加 typert 与 bundle 重生成，却不添正确性——占用守卫已兜住陈树竞态。

**放开跨区移动。** 把 `preset/` 内容移进 `runtime/` 会把用户著作的卡文件挪进维护代理拥有并可能改写的区域；反向则把 runtime 文件交给发布时会被复制进卡库的卡。两侧的区身份都是承重结构，故 move 只在单区内配对。

**fileOp 失败接 toast。** 静默失败面早于本变更（拖动到非法目标依旧吞错），但把 toast 通道穿进 CardEditor 属于 UI 范畴的后续项，不属于这次存储策略变更。

## Consequences

`runtime/` 改名端到端可用；二次创建自动去重；与陈树竞态的 create 以 fail loud 收场而非截断内容；`savings/` 不可移动由意外变为引擎明文策略。测试钉住：同区内文件与目录改名、跨区与 savings 拒绝、占用 create 保留原内容、客户端递增到 `untitled-1.md`、runtime 改名发出同区 `move`。假面 rpc 的 `tree` 获得可 state 化条目并每次调用返回新副本——同引用快照会使 React 状态更新 bail out、reload 隐形。
