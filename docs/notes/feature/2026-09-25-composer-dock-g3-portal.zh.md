# composer 停靠 G3：挂载权归宿主（portal 方案定案）

状态：**已实施**（2026-09-25：host face+portal、芙宁娜量尺三件套退役、皮肤收面板作用域、vault/卡行为钉、427/427 绿；真机 CDP 验收项留待下次带宿主重启的批次） | 日期：2026-09-25 | 关联：[[2026-09-24-tavern-opening-surface-contract]]（opening face 同族先例）、`docs/cards/card-presentation.zh.md`（薄 API 契约源头，dock 节已按本案改写）

> **落地记录（2026-09-25）**：§4 清单全项完成——card-ui.ts `createComposerDockVault`（fail-visible 三守卫：未声明/非元素/换槽替换留痕）+ mount 袋 `dockComposer` + handle `composerDock` 读面 + dispose 清空；TavernApp TavernChatView DockController（订阅槽态 → composer 渲染 IIFE portal 分支，`createPortal` 同子树换挂载点）；芙宁娜 index.js 删量尺三件套与 body.gal-ui/gal-input 全局类（~55 行净减），`data-dock-slot="composer"` + whenHost 注册 + 解停入 stops；ui.css 删 body 级停靠定位段、皮肤 19 处选择器收 `.tavern-panel-galgame .gg-dock-slot` 作用域、补 backlog 隐槽规则、顺手修活死选择器（`:66` 名字牌 input 青色——`gg-input` 原本挂在 dialog，选择器从未命中）。观察点迁移：spec 内 14 处 `body.gal-input` 断言改读 dialog 类（断而不删改写）。回归钉：card-ui vault 契约 4 例 + galgame G3 行为 4 例（注册即交槽/解停双保险/无 face 降级留痕/**零 .tavern-composer 写入**）；全套 427/427 绿。

## 0. 一句话

卡的自由止步于「声明一个槽」：**几何、层序、回收全部退化为宿主树内的普通事实**。composer 的挂载权（搬运）还给宿主——DockController 持 portal 把宿主自己的 ChatComposer 子树搬进卡注册的槽；卡零接触宿主 DOM，卸载回落由 React 结构保证。

## 1. 事故与考古：四代路线，三次翻覆

### 1.1 本次事故（立案）

芙宁娜 ↔ dnd5e 切换会话，输入框内联样式泄漏进 dnd5e 会话——文本内容跑到输入框后方。

确定性链条（全部源码可查）：

```
① TavernApp.tsx:702   <TavernChatView sessionId> 无 key → 切绑 React 复用同一 composer DOM 节点
② 芙宁娜 index.js dockComposer: document.querySelector('.tavern-composer') 逮宿主原件,
   写 9 个内联属性(position/left/top/width/height/margin/display/zIndex/visibility/boxSizing)
③ dispose: 卡 stops 逆序清理——body类✓ resize✓ 观察者✓ unsubs✓ 钟✓ … 无 undock ✗
④ 内联样式乘着幸存节点进入新会话 → fixed 在芙宁娜对话框坐标 z50 → 压住 dnd5e 转写行
```

所有权矩阵（泄漏的结构性根源）：

| 资产 | 声明权 | 执行权 | 回收权 |
|---|---|---|---|
| 样式注入 | 宿主 | 宿主 | **宿主（结构保证）** ✔ |
| dock 意图 | **宿主**（card-ui.ts 解析 layout.dock） | **卡**（宿主解析完只透传） | **无人** ✗ |
| composer 节点 | 宿主 | 卡（全局查询+写字） | 期望卡自觉 ✗ |
| 槽几何 | 卡 | 卡（JS 量尺） | 卡自觉 ✗ |

dock 是全链路唯一「声明/执行/回收三权倒挂」的功能。undock 漏写只是症状。

### 1.2 考古：09-22 起的四代

| 代 | 机制 | 死因 | 搬运者 |
|---|---|---|---|
| G1 | `data-gal-docked` 属性 + 树外 CSS 绝对定位（跨平台猜几何） | composer 不在卡子树 → CSS 无坐标系；Windows 引擎直接被隐藏 | 卡 |
| G2 | 卡自绘 textarea + `tavern.submit` face（bc97464「停靠路线整体退役」） | 克隆长不出模型座/环形/usage 等原生件；草稿 500ms 轮询镜像 hack | 卡（画的克隆） |
| G2' 现行 | JS 量尺 + 9 内联属性（079ab83 回摆复用宿主原件） | 搬运权仍在卡：五连修 + 本次泄漏 | **卡** |
| G3 本案 | 宿主 portal，卡供槽 | —— | **宿主（首次=所有者）** |

G2' 五连修（0b86f41 z40<45 被 overlay 盖 / ae02b44 宽度探出+误停 / 59cedc1 overflow 裁模型窗 / 2532131·5c9d4e2 尺寸两轮 / 566fbb3 写卡列串台）不是五个独立 bug，是同一定理的五种症状：**搬运者≠所有者，力必须隔空逐项补**。

**对「历史上还给宿主出过问题吗」的严格回答**：没有。bc97464 退役的是「卡隔空操控宿主件」（composer 从未易主）；079ab83 回摆的是**功能复用**（要模型座），回摆后搬运权仍在卡。三次失败全是「搬运者不是所有者」；宿主持有自身组件从未被实验过，无失败样本——历史只能证明「别的方式都试死了」，不能证明 G3，G3 要靠自己的验收面兜底（见 §6）。

## 2. 设计：三泳道权责线

```
┌──────────────────────────────┬──────────────────────────────────────┐
│ 宿主管(唯一): 哪里放(挂载)     │ 卡主管(全部定制):                     │
│                              │  ① 何时现(展现时机)   ← 剧情状态机,   │
│  dock 声明(layout.json,已有)  │     宿主故意不收——两处必漂移          │
│  slot 注册(新 face)          │  ② 长什么样(全部外观) ← 面板作用域CSS  │
│  portal 搬运 + 回落          │  ③ 输入语义(发/停/草稿) ← 宿主原件原生 │
└──────────────────────────────┴──────────────────────────────────────┘
```

- **红线不变**：卡不能编程触发 send-btn、composer 永不卸载（build §2）——portal 恰好字面满足：同一个 React 子树换挂载点，草稿/IME/焦点/模型座全保留。
- **回落是显式状态**：无声明 / 无 slot / dispose → composer 回 transcript 下方流内常位，`data-dock=off` 可观测，不是事故形态。

## 3. 图解

### 3.1 目标形态

```
声明: layout.json {"dock":["composer"]}   ← 宿主早已解析,如今自己执行
        │
        ▼
┌ 宿主 ────────────────────────────────────────────────────┐
│ DockController(state.dockSlot: Element|null)             │
│   null  → <ChatComposer/> 流内常位                        │
│   非空  → createPortal(<ChatComposer/>, dockSlot)         │
│ 卡调一次: tavern.dockComposer(slotEl) → 返回解停函数       │
│           (与 files/opening 同族纯加法 face)               │
└──────────────▲───────────────────────────────────────────┘
┌ 卡(芙宁娜)    └───────────────────────────────────────────┐
│ .gg 内 <div class="gg-dock-slot" data-dock-slot>          │
│ input 态: slot 显示 + flex:1(composer 流内铺满,零量尺)      │
│ 非 input: slot 隐藏(composer 随之)                          │
└──────────────────────────────────────────────────────────┘
```

### 3.2 换绑时序（泄漏面=0 的证明）

```
芙宁娜(停靠中) ──玩家切到 dnd5e──►
① React cleanup: 卡 dispose(卡资源自清) + DockController 清 dockSlot(宿主态)
② portal 容器没了 → <ChatComposer/> 结构性回流内常位——不是"还原",是"从未走远"
③ loadCardUi(dnd5e) → hud 面板挂载;composer 在宿主常位,零触碰 ✔
卡对宿主节点的写入次数: 0 ——无从泄漏
```

### 3.3 两卡型与写卡列

- **dnd5e**（无 dock 声明）：DockController 永不激活，对它的操作数=0。
- **写卡 Agent 列**（WriterColumn 用同一 ChatComposer）：它从头到尾不在 TavernChatView 的 dock 渲染路径里；且卡样式收进 `.tavern-panel-galgame` 面板作用域后，**祖先链天然够不到写卡列**——566fbb3 那类串台从「纪律性隔离」变成「结构性隔离」。
- 芙宁娜定制清单全项有通道：展现时机=槽显隐（单轨，无双轨第二态）；外观=稳定类面板作用域覆盖；`body.gal-ui .tavern-stage .tavern-composer` 全局段失去存在理由。

## 4. 改动清单

```
宿主 packages/ui
  + card-ui.ts: dockComposer face(注册/解停/卫队,见 §6)
  + TavernApp/TavernChatView: DockController portal 分支(layout.dock 驱动)
  ~ docs/cards/card-presentation.zh.md §薄API: dock=「卡供槽,宿主搬运」三条改写;
    稳定类清单补 data-dock-slot;"composer 规则必须 .tavern-stage 前缀"条目
    升格为总则「卡样式一律落自家 panel 容器作用域」
卡 芙宁娜/preset/ui
  − dockComposer/undockComposer/onResize(量尺三件套, ~50 行)
  − ui.css: body.gal-ui 停靠定位全局段
  + index.js: slot 补 data-dock-slot + mount 时 dockComposer(slotEl) 一次,解停入 stops
  + ui.css: 外观皮肤(textarea/发送/模型座暗金)收进 .tavern-panel-galgame 作用域
测试
  ~ galgame-card.client.spec 行为钉: 停靠断言 → portal 位断言
  + CDP 新钉: portal 换容器 DOM 态保留(草稿文本/焦点/IME 组词中切换)——
    一次真机实测钉死,不只信文档
```

纪律面：动 packages/ui 源 → `pnpm build` 双面（typecheck 只建 host 面）；E2E 重启取新枚，一律 `--no-open`。

## 5. G3 明确不给的三样（以及为什么不要）

1. **改 composer 的 DOM 结构**：CSS 能做视觉重排（芙宁娜全部需求已证明够用），够不着真·DOM 重构——要那玩意就得回卡自绘+face 扩征（G2 已用一次回摆证明代价不值）。
2. **触发宿主发送键点击**：`card-presentation` 红线，芙宁娜本来就只填不发。
3. **宿主代管展现时机**：时机是剧情状态机（卡的业务），宿主收了就成第二张状态表，必漂移。

## 6. G3 自身的新风险与契约（8f8a9a8 前车之鉴）

那次根因：`el()` 解构漏 `dots` → 守卫恒真 → syncDomState 从未跑 → 「名字牌/body 类/**composer 停靠**全失效」难查。G3 的同名风险面：**face 注册是跨生命周期的状态同步点，静默失灵 = 卡以为停靠了、composer 停在默认格**。契约内置：

1. 注册失败（slot 无效/重复注册/卡未声明 dock 却调用）→ **fail-visible**：console 响亮告警 + 回落默认格，绝不静默（`client-rpc-no-silent-catch` 同宗纪律）；
2. 回落恒为显式可观测状态（`data-dock=off`）；
3. 验收单首条即 CDP 实测 portal DOM 态保留（§4 测试节）。

## 7. 验收

1. 芙宁娜 input 态：composer 在对话框内、外观=暗金皮肤全套、模型弹窗朝上弹出不被裁；
2. reading/waiting/backlog：composer 随槽隐/现，无第二可见框；草稿与 IME 组词跨态切换不丢；
3. 芙宁娜 ↔ dnd5e 反复切换：dnd5e 侧 composer 在宿主常位、零残留内联样式（本次事故的反向钉）；
4. 三分工作区：写卡 Agent 列 composer 原生皮不受任何卡样式影响；
5. dnd5e 会话全程：DockController 不激活，行为与现状逐帧一致；
6. 全套 `pnpm test` 绿 + 真机 CDP 各态截图对原型。
