# Agent Note：酒馆主题系统（三套内建主题、免授权、页头右上选择）

Status: implemented

[English](2026-09-17-tavern-theme-system.md) | 中文

日期：2026-09-17 · 仓面：`packages/client/ui-tavern`（零引擎改动）

## 问题

酒馆页的配色字体是一体硬编码：token 化只做了半截——`.app`/`.root` 上声明 `--t-*`/`--tv-*`（同名异前缀两族），游离于声明之外的百余处字面量（白卡片、墨色按钮、用户气泡三件、危险色系、暖棕投影族…）与半 token 状态并存，无主题机制可将它们整体换肤。卡 `preset/ui/` 展现包每次首次启用都弹 `window.confirm` 授权，且设置页没有任何地方选择主题。

## 决策

**一注入点、一 token 族、一选择座位。**

- **`themes.ts` 唯一执笔 `#tavern-theme` 定稿**：单张样式表打在整页根新增的稳定钩子 `.tavern-root`（`TavernApp` 根 div 上与 `css.app` 并挂）上，内容 = 选定内建主题的 token 规则 +（选择为卡时）卡 `theme.css` 片段。三套内建：羊皮纸（原 `.app` 值逐字沿用）、DSH 亮/DSH 黑（按 `ui-theme/src/styles/design-platform.css` 的 alias 语义逐项解析成字面量——`bg/bg-deep/surface-2/surface/card` 五层、border 两档、fg 四档、accent 族全集、ok/danger 三族、气泡三件套、veil/scrim、字体栈 serif→DSH sans）。alpha 族拆出 `--t-gold-rgb / --t-danger-rgb / --t-shadow-rgb` 三元组 token，用点写 `rgba(var(--t-x-rgb), α)` 保住原始逐级 α。
- **两套 module CSS 全面去字面量**（`--t-*` 单族，`--tv-*` 并入）：体量≈白底 20 处、用户气泡 3、send/primary 渐变 6、危险系 8、投影 15、金色系若干；书架封面 tint 渐变与其白色蒙层/白字是**卡的美术资产**，刻意保留字面量（README Known Limitations 记录）。字体栈 `SF Mono…` 字面量归 `var(--t-mono)`。
- **授权弹窗退役**：安装卡已是宿主级信任（scripts/tools 即宿主侧 bash，`card-presentation_zh.md` 信任模型），`ui.consent` 键删除，展现包直接应用。`card-ui.ts` 不再注入 theme.css——以 `handle.themeCss` 返回，交 themes 统一进 sheet；`chat.css`（`.tavern-stage` 前缀）、`layout.json`、`mount(tavern)` 位置不变。
- **覆盖语义**：主题座位 = 页头右上角的常驻 select（`headActions` 打头，聊天页/库页都在；初始放设置 files tab 当天即挪——发现页是模态、要两跳才够得着），四选项——卡片主题（如有）/羊皮纸/DSH 亮/DSH 黑，存 `tavern.ui.theme`（localStorage 直存，同 `tavern.lastLines` 模式）；选内建 = 整段替换卡的主题（卡 theme.css 不进 sheet）；选卡 = 卡 css 拼在羊皮纸基座后（卡可在 `.tavern-root` 上覆盖 token——原注入模型下 `:root` 压不过 module 类，现在同名同级后者胜，卡片主题第一次真正可覆盖整页 token）。
- **sheet 常驻本体**：`TavernChatView` 是条件挂载（库/设置模态时卸载），执笔人放 `TavernAppBody`——`useLayoutEffect` 首帧绘制前落笔避默认色闪变，卸载离场才 `clearTheme`；卡侧 `themeCss` 经唯一上报口 `onCardTheme` 上抛。选择即换肤，不刷新。

## 备选方案的取舍

- **每主题一整份 CSS bundle**（用户原话「各种 css 都打包成一套」的字面解）：否决——一式三份千行 CSS，换主题维护三处；token 基座 + 全面 token 化等价覆盖「包括字体」的全维度，卡作者也只需覆盖 token 而非整表。
- **dsw 主题活引用 `var(--dsw-*)`**：否决——活引用随 `body[data-ds-dark-theme]` 自动翻转，与「显式选择 DSH 亮/暗」语义相抵；且 jsdom 无 body token 即会塌。字面量解析一次入表，主题是死数据。
- **保留授权、改为设置页按卡开关**（原记忆 pending 项）：被用户指令直接推翻——不弹窗、直接应用；信任模型本就前置，Known Limitations 与「卡封面是美术」的诚实边界已补。
- **sheet 执笔放 `TavernChatView`**：否决——条件挂载会在库页/设置模态摘走 token，整页裸奔；上报口上抛是三行成本，换常驻正确性。

## 后果

`tests/themes.client.spec.ts`（jsdom）：三主题 token 定稿、卡拼接/替换两语义的顺序与排除、单表不堆叠、清表、localStorage 回环与脏值回退。`tavern-app.client.spec.tsx` 页头 select 用例：四选项 locale 断言 + change 后 sheet 即换 `--t-bg: rgb(21, 21, 23)`、localStorage 落 `dsw-dark`；`tavern-view.client.spec.tsx` 钉死工作空间面无主题行。`ui-tavern` 全套 122/122；`tsc -p` 干净。文档面：README 双语补 `card-ui.ts`/`themes.ts`/主题两条限制，`card-presentation_zh.md` 授权口径五处反转 + `.tavern-root` 入钩子契约。

同日二批（用户走查反馈）：**消息脚行**——时间戳原以 `position:absolute; bottom:-17px` 悬在气泡外、与恒占 20px 的操作行错排（用户问「为什么上下这么宽、时间和按钮怎么不在一排」）；改为 `.msgFoot` 一行同排（用户侧右对齐 `[时间][复制/↻]`、叙事侧左对齐 `[复制/↻][时间]`、err 行时间 `margin-left:auto` 随行），旧 `.stamp` 绝对定位与 reveal 规则改挂 foot 整行。**流式行聚团**——思考/工具/维护连串行相邻负 margin(-12px) 收到 4px、flow↔叙事收一半到 8px（stock 的 closed-process→answer 一档），对齐 stock 排版节奏；用户点名要三者「看起来在一起」。**叙事金杠退役**——`.narrative::before`（12×3px 金条）被用户评「看起来很傻」，删；其让位列同步收回（padding-left 24→8），文件头注释去掉 gold tick 措辞。**三批（同日「看看默认 webUI」）**：排版整体搬上 stock 阶梯——`:global(.tavern-body)` 行高 24px、markdown `<p>` margin 钉 0/16（此前浏览器默认 margin 与行距叠加出夸张间距）、叙事/气泡行高统一 24px；思考行改为 stock 同款 `DisclosureRow` 原语 + `IconThinkOutline14`（24px 行、13/20 三级色正文、hover 换箭头、运行扫光）——其间 line-height:1 的临时拍板由本参考对齐收覆，且查明绑定卡自身 `preset/ui/chat.css`（1.95 行距 + 逐条 margin 叠列距）一直在盖宿主，已修。
