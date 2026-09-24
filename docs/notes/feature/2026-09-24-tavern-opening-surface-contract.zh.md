# 酒馆 opening 统一结构：宿主默认格 + 卡覆盖 + 能力契约

状态：设计定稿 | 日期：2026-09-24 | 关联：[[2026-09-22-furina-galgame-card]]、[[2026-09-16-tavern-meta-greetings-contract]]

> **落地裁定 1（2026-09-24，用户拍板）**：非停靠轮落地 `suppress:["opening"]` + 卡侧 greetings。
>
> **落地裁定 2（2026-09-24，用户二次拍板，真机反馈「没按原型做、交互不对」）**：**推翻「不回停靠」**——恢复 composer 停靠。
> `dock` 从词汇落地为 `["composer"]`：input 态宿主 composer 原件经 **JS 量尺
> （`getBoundingClientRect`）fixed 停靠**到对话框输入行位（模型座/上下文环/发送/
> usage 全原生）。旧停靠失败的根因是「卡 CSS 猜宿主几何（百分比/坐标上下文）」，
> 量尺 fixed 用浏览器统一 API 的像素真值，根治该面。dnd/dnd5e 收编仍为独立批次。
>
> **视觉定形（2026-09-24，用户）**：开场白块独立于对话框、**画面中央 + 背景不透明**
> （实色深底 + 金边，`top:50%/left:50%` + `translate(-50%,-50%)`，聊天区正中）；
> input 态**对话框保留可见外框**（深色渐变底 + 金边 + shadow），宿主 composer 停靠
> 落进对话框内 slot（composer 原件自然高 146 ≈ slot 高 150）。

## 0. 一句话结论

把「开场阶段」从"宿主与卡各自画、互相盖、靠摸 DOM 猜对方"重构为两条正交契约：

- **表面维**：宿主聊天区 = 一组默认格（transcript / opening / composer），卡通过 `layout.json` 声明**覆盖**哪几格——`suppress`（宿主不画，卡自绘）或 `dock`（宿主画，卡重定位）。全屏接管不需要新概念，它就是一个 overlay 面板。
- **能力维**：`mount(tavern)` 把卡需要的**数据 / 信号 / 入场权**一次交清，替代今天三张卡各自轮询 `[class*="openingFrame"]` 的 hack。

两条一起补上，宿主严格退成"没被覆盖处的默认值提供者"，卡获得"聊天区任意改造"的能力。

## 1. 背景：一个生命周期，三个 hack

opening 是一个生命周期阶段（转写为空），要摆平三块表面——**视觉**（铺什么）、**输入**（在哪打字，须唯一）、**起步**（greetings 建议首句）。现状把这三块散在两层、用 DOM hack 硬拼。

三卡现状：

| 维度 | dnd·边境小镇 | dnd5e·原味跑团 | 芙宁娜·galgame |
|---|---|---|---|
| mount 代际 | v1（index.js 自建 DOM） | v2（runtime+view+acts） | v1（index.js 自建 DOM） |
| 视觉 owner | 宿主转写 + 右 `codex` 面板 | 宿主转写 + overlay HUD | 卡全屏 overlay（CG+对话框） |
| 输入 owner | 宿主 composer | 宿主 composer | 卡自绘 textarea |
| opening 形态 | opening.html（iframe 表单） | opening.html（创角表单） | 无 opening.html → 宿主默认开场页 |
| 起步数据 | openings.json（卡内读） | openings.json（卡内读） | greetings.json（宿主渲染） |
| 开场结束探测 | `visPoll` 模糊类名 | runtime.mjs `applyVisibility` | `openingPresent()` + `hiddenMirror` |

三处共享 hack（本次要退休的全部）：

1. **"开场页在场"探测**——三张卡硬编码同一个模糊选择器 + 轮询：
   ```js
   '[class*="openingFrame"],[class*="openingFull"],[class*="openingWrap"],[class*="openingLive"]'
   ```
   dnd `index.js:98`（500ms）、dnd5e `runtime.mjs:8,44` + `index.js:89,94`（300ms）、芙宁娜 `index.js:19`。
2. **面板开场期让位**——责任在卡不在宿主：dnd 直接 `host.style.display='none'`，dnd5e 刚把 `hideDuringOpening` 收编进自家 runtime。
3. **开场结果填输入**——两条通道：opening.html `postMessage tavern-insert` → 宿主 composer（dnd/dnd5e 通）；greeting 按钮 `updateDraft` → 隐藏 composer → 500ms 轮询抄进卡 textarea（芙宁娜断）。

根因：宿主自己知道开场页在不在（`defaultOpeningOn` / `opening !== null`），却从不告诉卡；卡缺的数据（greetings/投影）与能力（submit 之外的 stop、composer 停靠锚点）宿主也从不给。

## 2. 设计原则

> 宿主允许聊天区任意页面改造；宿主只在聊天区没有被覆盖的改动里给出默认值。（用户拍板）

落在代码上 = **默认格 + 覆盖**。宿主聊天区拆成三个默认格：

```
聊天区 = ┌ transcript ┐ ┌ opening ┐ ┌ composer ┐
         └────────────┘ └─────────┘ └──────────┘
        ── 卡可在其上叠加面板 / 或声明"这一格我来" ──
```

## 3. 统一模型

### 3.1 表面维：覆盖的两种语义

卡对每一个宿主默认格，覆盖方式有两种，必须分清：

- **`suppress`**（压制/自绘）：宿主**不渲染**该默认格，卡在自己的面板里自绘。适用 opening（芙宁娜自绘开场视觉 + greetings）。
- **`dock`**（停靠/重定位）：宿主**渲染**该默认格，卡通过稳定锚点把它**重定位**进自己的布局。适用 composer（芙宁娜要保留模型座/上下文环/usage 原生功能块，只是把 composer 停靠进对话框输入行）。

区分 suppress 与 dock 是关键：把 composer 也做成 suppress（宿主不画、卡自绘 textarea）会**丢失 composer 的原生功能块**（模型选择器、上下文环、usage 行），只能靠镜像抄文本——这正是芙宁娜当前实现的退化。

全屏接管不需要新概念：芙宁娜的 galgame 本来就是一个 `{ slot: "overlay" }` 面板 + `position:absolute; inset:0`。

### 3.2 能力维：mount face 契约

今天逼三卡轮询 DOM 的，不是"面板画不了全屏"，是这些能力宿主从没交出来：

| 卡需要的能力 | 现状 | 契约化后 |
|---|---|---|
| 发消息（入场权） | `submit` 已有，但芙宁娜还绕 `updateDraft` | 统一 `submit` |
| 停止（对称权） | 芙宁娜 `forwardStop()` 去点宿主 send-btn | 新增 `stop()` |
| 开场何时结束 | 三卡各自轮询 DOM 类名 | `opening.active` + `subscribe(onChange)` |
| greetings / 标题 / 封面 | 宿主渲染 or `runScript` 读 | 宿主读一次，塞进 mount face |
| 模型/上下文/usage 投影 | 芙宁娜轮询镜像隐藏节点 | 投影数据直接给（或由停靠的宿主 composer 原生承载） |
| composer 停靠锚点 | 卡猜 `.tavern-stage` 定位上下文（Windows 失效） | 宿主显式锚点/稳定容器 |

## 4. 契约定义

### 4.1 `layout.json`（卡声明覆盖哪些格）

```jsonc
{
  "surface": "host",              // "host"（默认） | "card"——粗粒度开关，等价于下面的组合
  "suppress": ["opening"],         // 宿主不画：芙宁娜 = ["opening"]；纯 HUD 卡 = []
  "dock": ["composer"],            // 宿主画、卡重新定位进自己布局：芙宁娜 = ["composer"]
  "panels": [ { "name": "galgame", "slot": "overlay" } ]
}
```

`suppress` / `dock` 是细粒度声明；`surface` 是给"全屏接管"卡的简写（`"card"` = suppress opening + dock composer，具体组合由宿主解析为同一张清单）。缺省即 host，旧卡零迁移。

**落地状态**：`suppress:["opening"]`（宿主渲染门）+ `dock:["composer"]`（卡 JS 量尺停靠宿主 composer，模型座/环形/发送/usage 原生）均已实现（card-ui.ts parseLayout；TavernChatView `honorOpening` 渲染门；芙宁娜 index.js 停靠量尺）。`"surface"` sugar 不解析——解析器对未知词 fail 拒整份。

### 4.2 `mount(tavern)`（能力契约，一次交清）

```ts
tavern = {
  // 入场/对称权
  submit(text): Promise<...>,       // 已有，复用
  stop(): Promise<...>,             // 新增：对称于 submit 的停止（替代 forwardStop 去点 send-btn）
  // opening 事实 + 信号（宿主唯一读源）
  opening: {
    active: boolean,                 // 宿主权威判断：开场页当前是否在场
    html: string | null,             // opening.html（suppress 后卡不再需要，但 dnd/dnd5e 仍用）
    title: string, desc: string, cover: string,
    greetings: string[],             // greetings.json（suppress opening 的卡据此自绘起步选项）
    subscribe(onChange): () => void, // active 翻转通知，替代三处轮询
  },
  // 停靠锚点（dock composer 的卡用，替代猜 .tavern-stage 定位上下文）
  dockAnchor?: HTMLElement | string, // 宿主 composer 的稳定容器/属性
  // 现有
  runScript, callScript, readAsset, layout, views, acts, runtime,
}
```

## 5. 芙宁娜功能可实现性 review（含原型）

对照 `design_galgame-ui_zh.md`（§1–§8）、`build_galgame-ui_zh.md`（S1–S5）、`proto_galgame-ui.html`（视觉正本）逐项核对。

| # | 功能 | 归属 | 新设计下 | 说明 |
|---|---|---|---|---|
| 1 | CG 双缓冲换场 + 锚头身（cover 50% 18%） | 卡侧 | ✅ 无需宿主 | `readAsset` + manifest + `gal_data`，纯 overlay |
| 2 | 对话框底贴边 + 名字牌态色（金/青） | 卡侧 | ✅ | overlay 面板 |
| 3 | 段落打字机（28ms/字）+ click 补全/下一段 | 卡侧 | ✅ | 状态机 |
| 4 | 状态机 reading/done/consumed/input/waiting | 卡侧 | ✅ | |
| 5 | backlog 防剧透截止 + user 右/assistant 左 | 卡侧 | ✅ | `gal_data` 的 history |
| 6 | 段落进度会话期不落盘 | 卡侧 | ✅ | |
| 7 | 输入态 textarea + 发送 | 输入格 | ⚠️ 见发现 A | 设计 §4 要"停靠宿主 composer"，当前实现已退化成"自绘" |
| 8 | 模型座/上下文环/usage 原生功能块 | 输入格 | ⚠️ 需停靠锚点 | 当前用镜像 hack，丢原生功能块 |
| 9 | waiting 三点弹跳 + 停止小键 | 卡侧 + stop | ⚠️ stop 需对称权 | 三点纯卡侧；停止当前 `forwardStop` 点 send-btn |
| 10 | usage 四项（输入/输出/缓存/速度） | 投影 | ⚠️ 需投影数据 | 当前 500ms 镜像隐藏节点 |
| 11 | greetings 起步（开场白选项） | opening | ✅ 新设计核心 | suppress opening + 宿主交 `opening.greetings` |
| 12 | 开场结束探测 | opening | ✅ 新设计核心 | `opening.active` 替代 `openingPresent()` |
| 13 | CG 情绪换场（指令协议） | 引擎已有 | ✅ 不动 | `cg_brief` → `apply_directives` → `gal_data` 链路完整 |
| 14 | 流式语义（打字机承担流式观感） | 声明 | ✅ | design §5 声明，与 opening 无关 |

**发现 A（本次 review 最重要的一条）**：设计文档 §4 白纸黑字定的是「**宿主 composer 原件停靠入位**」——模型座/上下文环/textarea/发送/usage **全原生、零转发零镜像**。但 `bc97464`（composer 停靠路线退役）把它改成了「卡自绘 textarea + `tavern.submit` + 镜像」，于是 #8/#10 的模型座/上下文环/usage 全降级成"轮询抄文本"。停靠当年在 Windows 失败的根因是**停靠锚点靠猜宿主 CSS 定位上下文**（`commit` 原话"停靠面跨平台假设"），正确解法不是退化成自绘，而是把**停靠锚点收进宿主契约**（§4.2 `dockAnchor`）——这正是本设计能力维的一部分。

**发现 B**：原型里的 `#modelSeat` / `#ring` 是**自绘 mock**（示意模型选择器与上下文环），真卡按设计 §4 应停靠宿主 composer 原生承载（或走 §4.2 投影数据），不要照原型把这两个 mock 搬进真卡再镜像。

结论：**14 项功能里 12 项纯卡侧或引擎已有，新设计不影响、可实现；3 项依赖宿主契约（greetings 数据、开场结束信号、composer 停靠+投影+stop），正是本设计要补齐的**。没有任何一项"卡实现不了"。

**本轮落地记录**：#11/#12/#9（greetings 数据、开场信号、stop）已随 opening 契约解决；#8/#10（模型座/环形原生功能块）已随「恢复停靠」轮解决——宿主 composer 原件停靠入位，镜像退化退役。

## 6. 其他卡影响分析（dnd / dnd5e）

新设计是**加法为主 + 可选收编**：

**加法（零迁移）**
- `layout.json` 新增 `surface` / `suppress` / `dock` 字段，缺省 host——dnd/dnd5e 不写这些字段 = host 模式，行为不变。
- `mount(tavern)` 新增 `opening` / `stop` / `dockAnchor` 字段——dnd/dnd5e 不读新字段 = 零影响。
- `hideDuringOpening`（dnd5e 已有、dnd 无）继续生效。

**可选收编（要精确，不能误删）**
- 把"开场页在场"信号统一为 `opening.active`：dnd 的 `visPoll` 与 dnd5e 的 `applyVisibility` 里的 `hideDuringOpening` 分支可删。
- **但** dnd 的 `visPoll` 还干两件与 opening 无关的事——`composer.classList.toggle('codex-shift', …)`（HUD 面板在场时 composer 左移让位）和 `transcript.classList.toggle('opening-live', …)`。这两件是"HUD 让位"不是"opening 生命周期"，收编时**只迁 `[class*=openingFrame]` 那一条判断，`codex-shift` / `opening-live` 保留在卡侧**。
- dnd5e 的 `hideDuringOpening` 收编到宿主后，runtime.mjs 的 `applyVisibility` 里那段 `panel.hideDuringOpening && OPENING_SEL` 分支可删，但 `tavern-panel--off` 用户总开关（类驱动态）必须保留。

**风险点**
- 三卡的 `[class*=openingFrame]` 探测都依赖宿主 `.openingFull` / `.openingFrame` 类名的渲染。若本设计顺带改了宿主开场页的渲染方式（如 `surface:"card"` 下不再渲染 `.openingFull`），收编迁移必须与"宿主下发 `opening.active`"**同步落地**，否则三卡探测同时失明。
- 建议落地顺序：先加能力契约（`opening` 数据 + 信号，纯加法）→ 芙宁娜迁到新契约 → 再收编 dnd/dnd5e 的轮询。三步各自可独立验证，不串。

## 7. 落地阶段（1+2 已落地，含二次裁定「恢复停靠」；3 收编独立批次）

1. ✅ **能力契约加法**：`card-ui.ts` 解析 `suppress:["opening"]` + `dock:["composer"]`，mount face 补 `opening`（greetings/active/subscribe）+ `stop`（宿主 stop 语义经稳定 ref 转发）；`TavernChatView` 按 `honorOpening` 条件渲染默认开场页/greetings/封面背景。
2. ✅ **芙宁娜迁移**：`index.js` 删 `openingPresent()`/`hiddenMirror`/自绘输入区/`submit` 通道；接 `opening.greetings`（对话框内选项块，点击 postMessage `tavern-insert` 填宿主 composer draft）+ `opening.active`（boot 定态与选项显隐）+ `stop`（waiting 停止小键）+ **停靠量尺**（input 态把宿主 composer 原件 `getBoundingClientRect` fixed 钉到 `gg-dock-slot` 坐标，模型座/环形/发送/usage 原生）+ **backlog 门**（展开挂 `gg-backlog-open` 激活 CG 暗化、点背景先收起）+ **发送节奏**（发送→waiting 三点）。
3. ⬜ **收编 dnd/dnd5e**（独立批次）：迁到 `opening.active`，删各自轮询（`codex-shift`/`opening-live`/用户总开关保留）。
4. 补测试 + 真机 CDP 逐项验 §5 清单。
