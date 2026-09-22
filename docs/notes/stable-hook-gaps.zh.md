# 稳定钩子存量核对与缺失钩子（需求）

2026-09-17 记录（未实现，需求）。起因=DnD 卡（`tavern_workspace/ws-20260916-024118-182-1`）主题真机手测翻车：卡片深色主题与宿主浅色布局互相咬出「半生不熟」，用 playwright 探针 + 源码逐一核对稳定钩子契约，发现契约承诺的四个钩子**从未接线**。机制权威：[card-presentation.zh.md](../cards/card-presentation.zh.md)（薄 API 节的钩子清单是契约源头）、`packages/client/ui-tavern/src/client/card-ui.ts`（卡 CSS 注入面）。

## 发现：契约与实装差异

钩子契约的承诺面（card-presentation「薄 API」节 + writer-guide「稳定 class 钩子」节）对照 ui-tavern 源码逐点 grep 与真机 DOM 探针：

| 钩子 | 契约定位 | 实装 | 真机 DOM |
|---|---|---|---|
| `.tavern-sidebar` | 结构钩子 | **从未接线（全源码 0 处）** | 不存在 |
| `.tavern-header` | 结构钩子 | **从未接线（全源码 0 处）** | 不存在 |
| `.tavern-avatar` | 结构钩子 | **从未接线（全源码 0 处）** | 不存在 |
| `.tavern-name` | 结构钩子 | **从未接线（全源码 0 处）** | 不存在 |
| 其余全部（stage / transcript / message 族 / bubble / body / thinking / tool / tail-ledger / timestamp / composer 族 / model-seat / context-meter / usage-line / panel 族） | 已承诺 | 已接线（`FlowRow` 的 `hook=` 参数与模板字面量拼挂） | 探针一致 |

探针一次假阴性备忘：`tavern-tail-ledger` 在探针里缺失是因为探针宿主跑**旧 client bundle**（bundle 是 boot 快照，改源码必须重建/重启）——源码里接线存在（`chat-view.tsx:345`）。以源码接线为契约存量口径。

附带核对结论（免重查）：`.tavern-bubble` 只挂玩家行（`chat-view.tsx:421`），DM 叙事行的样式落点是 `.tavern-body`；`.tavern-transcript` 接线在 `app/TavernApp.tsx:1150`；RP 聊天转写的默认样式 import 自 `app/App.module.css`（`TavernView.module.css` 是工作空间编辑器）；卡 CSS 由 `setStyleElement` 挂 `document.head`、晚于宿主模块样式注入，同特异性晚者胜，多级祖先选择器（`.tavern-message-user .tavern-bubble`）稳赢单类默认。

## 影响（2026-09-17 主题批后复核修正）

四锚缺失属实；但「无替代表达面」的原始断言已被同日主题批推翻：`.tavern-root` 接线（TavernApp.tsx:430）且 `theme.css` 改为拼进 `themes.ts` 统一 `#tavern-theme`（卡片段在 token 基座后），两套 module CSS 全面 token 化——**整页换肤的现役表达面就是 `.tavern-root` 上的 `--t-*` 覆盖**（DnD 事故「底色输给宿主不透明壳」在 token 面下不再成立；落空的只剩直接写 `.tavern-sidebar { … }` 这类字面量选择器）。writer-guide 同日按「收缩」临时处理，本日升正式拍板。

## 拍板：方向 B（收缩契约，2026-09-17）

采纳收缩：四锚出契约，整页表达面 = `.tavern-root` token 面。核心理由：卡作者都是 AI，成本不在语法而在 **guide 能否简洁完整表达整条路径**——token 面一张 37 词条的语义表就是完整路径，且覆盖 token 天然整页一致；反观补齐字面量锚位会重新打开「字面量局部改 vs token 全局值」的分裂（DnD 事故的「改面不改字」正源于此）。guide 同日重写：新增「整页主题：token 面」节（37 token 语义表 + 最小可信集十件 + 成组换肤规则），世界书挂点行随 §4.2 反转修正，「改主题前」旧世界指导（hashed 类摸不到/宿主恒浅色）删除；card-presentation :85 清单删除四锚并落定案注记。B 的验收「两处清单一字不差一致」已达成；无代码改动，keyless DOM 断言随方向 A 一并不需要。

## 需求：二选一拍板（未拍板）

- **方向 A（接线补齐，推荐）**：`TavernApp` 的侧栏容器与页头元素补挂 `.tavern-sidebar` / `.tavern-header`（会话行头像与名称若随身份头自然落位，`.tavern-avatar` / `.tavern-name` 一并补），卡可整页换肤（SillyTavern 卡带全页主题是惯例）。影响面：`packages/client/ui-tavern`（`app/TavernApp.tsx` + `App.module.css` 不动结构只挂钩子类）、`prompts/writer-guide.md`（恢复锚位并写明各锚所在视图）、本目录 card-presentation 85 行清单。内核零改动。
- **方向 B（收缩契约）**：承认应用壳不做卡主题表达面，从 card-presentation 与 writer-guide 删除四锚（writer-guide 已临时生效）；卡主题永久限定于 `.tavern-stage` 内与 body 继承。
- 验收（任一方向）：card-presentation 与 writer-guide 两处清单一字不差一致；走 A 则 keyless 测试补 DOM 钩子存在断言（jsdom）+ 真机探针复核一次（工作空间先拷贝隔离沙箱，遵守 2026-09-16 事故铁律：探针不直连用户数据、不自动接受对话框）。

## 排期建议

方向 A 适合随展现层后续 PR 落地（面板深化 PR5 或独立小 PR，量级：挂钩子类 + 文档两处 + 测试断言）；方向 B 文档面已基本生效，零代码。
