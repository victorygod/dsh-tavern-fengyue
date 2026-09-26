# 卡片展现层（per-card UI）定案

2026-09-15 终版（通道归一 + 单文件会话快照），废止 TavernContext env 快照、`ctx.` 表达式、厚 SDK/curd/data 分层与 `.tavern/` 目录的历代草案，本文是唯一权威。核心一句话：**引擎把世界（`runtime/`）与会话快照（`runtime/.chat.snapshot.jsonl`）维护成磁盘上的视图，提示词面用 `{{script(args)}}` 读它，前端用一个函数 `tavern.runScript` 调同一批脚本；写入口全部出自引擎与 bash**。机制权威：`packages/client/ui-tavern`（渲染与 `mount`）、`packages/extensions/tavern`（投影与提示词脚本面）、`packages/api/tavern`（新增 runScript RPC）。内核零改动。

## 修改面分类

| 修改面 | 卡作者写什么 | 生效点 | 信息来源 | ST 对应 |
|---|---|---|---|---|
| ① 提示词面（进模型） | 三张提示词 + `{{script(args)}}` | system=每请求 / post=提交定格（动态 post 注入消息，2026-09-16 wrap 退役后唯一逐回合注入点） / maintenance=fork | `runtime/*` + `.chat.snapshot.jsonl` + `../preset/meta.json` + `date` | 世界书触发、promptOnly 正则、文本宏、Author's Note |
| ② 声明面（纯皮） | `theme.css` / `chat.css` / `layout.json` | 页面注入 / 作用域注入 / 摆位与窗口 | 无（宿主自有） | creator 样式、Custom CSS |
| ③ 脚本面（交互） | `ui/index.js` `mount(tavern)` | 主文档容器 + 轮询 | `tavern.runScript` × 同一批脚本 + 稳定钩子 DOM | 扩展 JS、消息 HTML/`<style>` |
| 跨面协同 | 同一批 `scripts/*.sh` | 见执行时机表 | ①③共用一库脚本一层文件 | STscript+QR 的能力域 |

①与③**共用同一批脚本、同一层数据**：差别只在调用语法（`{{…}}` vs 原生函数）、路径（对称：都用 cwd=`runtime/` 的同一 spawn 约定）与回流（③ 独有 DOM 回填）。

## 卡片包与编写模型

| 文件 | 作用 |
|---|---|
| `preset/ui/theme.css` | 全页注入（首次启用确认 + 设置按卡总开关） |
| `preset/ui/chat.css` | 选择器自动前缀 `.tavern-stage`，只作用聊天区（css-tree/postcss 重写） |
| `preset/ui/layout.json` | 数据侧声明：`transcript.window`（`all`/`{last:N}`）、`panels[]` 容器（`{name, slot, size}`）、`html`（正文 HTML 开关，默认 true）、`dock:["composer"]`（G3 停靠，见下表行）、`modules[]`（卡自家 UI 模块清单，2026-09-25 manifest——宿主按单装载 `preset/ui/<名>.mjs` 注入 `tavern.mods`，卡声明、宿主装载）。校验失败回默认 + toast |
| **G3 停靠（2026-09-25）** | `dock:["composer"]` 声明 + 卡面板内 `<div data-dock-slot="composer">` 槽 + mount 时 `tavern.dockComposer(slotEl)` 一次注册（返回解停函数，入卡 stops）。声明者（宿主）执行：宿主把自己的 composer 子树经 **React portal** 挂进槽——卡零接触宿主 DOM（不量尺、不写内联样式、不卸载），几何=槽内流式布局、显隐=槽的 display、回收=宿主清空槽态（结构保证，无卡侧 undo）。未声明即调用 → console 留痕拒绝（fail-visible）。卡样式一律**面板作用域后代选择器**点名 `.tavern-*` 稳定类换肤。事故史与裁度：[composer-dock-g3-portal](../notes/feature/2026-09-25-composer-dock-g3-portal.zh.md) |
| `preset/ui/index.js` | `export function mount(tavern)`：宿主注入的面 = `runScript` / `callScript` / `readAsset` / `submit` / `stop` / `dockComposer` / `opening` / `assistantLive` / `files` / `layout` / `views` / `acts` / `runtime` / `mods`（声明模块装配面，2026-09-25）（返回清理函数）；面板/交互/游戏逻辑全在这里 |
| `preset/scripts/` | 宿主 bash 脚本库——两面共用的全部逻辑与数据访问 |

**提升编辑便利的手段 = 预设脚本**：骨架预置 `read.sh`（`cat "$1"`，把文件内容拉进提示词/返回给前端），示例卡模板（`templates/tavern-tavern/`）再带 `last.sh`（最近 N 条消息）等常用件。卡要"读聊天历史"就是 `runScript('read.sh', '.chat.snapshot.jsonl')`（前端）或 `{{read('.chat.snapshot.jsonl')}}`(提示词面)，剩下的交给 JS/模型逻辑。预设脚本作者可改可删，不是特权内建。

## 数据视图：runtime/ 一个目录、一个 cwd 约定

- `runtime/` = 世界状态 + 会话快照（`.chat.snapshot.jsonl`）。写者：尾代理（`runtime*` 工具）、卡脚本、模型工具、`run` 委托的脚本；编辑器仍可手改（既有策略）。`.chat.snapshot.jsonl` 无只读纪律——它是每次从头刷新的可弃缓存，错了就错了，下一次全量替换自愈。
- **cwd 契约**：`scripts/`、`tools/`、前端 `runScript` 的进程 **cwd = `runtime/`**；跨区读用 `../preset/meta.json`、`../savings/…`。不依赖任何环境变量——树形布局（`writeCardSkeleton` + `FIXED_PATHS`）本身就是契约，写进编辑器引导与卡作者文档。
- `preset/` 资产（图片等）：前端经脚本取 base64（`runScript('asset64', …)`），或既有编辑器预览通道；不设第二个前端函数。
- 编辑器树默认隐藏点文件，加「**显示隐藏文件**」选项（默认关）——`.chat.snapshot.jsonl` 可看可玩（改了无效果、会自愈），不想看到就关着。

### 业务时序（一个回合的全部运行逻辑）

```
玩家输入
  → 快照含入这条消息（pending 行）
  → post 渲染：执行 {{script}} —— 读到「最新状态 + 包含本条输入的历史」
  → 合成 durable 消息（进模型、进日志）
  → 模型叙事（途中可调 tools 改 runtime）
  → 回合结束 → 尾代理数据维护：更新 *.state.json 等世界文件
  → 快照整写一次（含新消息）
  → 前端面板轮询发现文件变化 → 刷新
```

## 会话快照：`runtime/.chat.snapshot.jsonl`

定义：**当前绑定会话的 durable 消息投影**（不是请求视图、不含流式临时帧）。写法 = **全量替换**（临时文件+原子改名），无 append、无 seq 对账、无只读纪律——权威在 durable 日志，文件是可弃缓存，"每次聊天历史有变化就完整替换，错了就错了"。

| 触发点 | 行为 |
|---|---|
| durable 消息事件 | 从绑定会话日志整写一遍（**wrap 渲染前必先含 pending 玩家行**——世界书才能扫到当前输入；提交失败/中止即下次重写自愈） |
| 换绑（新会话/载入/清空/发布卡） | 从新会话日志整写一遍 → "存档自动带回对话"免费成立（fork 种子带全） |

行格式：首行可选 head `{type:'head', sessionId, clientTimeZone, cardTitle}`（全量替换模型下免费，脚本免 spawn 取时区/卡名），随后每条消息 `{seq, kind:'user'|'assistant', orig, plain}`——`orig` 进模型原始形态（wrap 标记在手）、`plain` 展示形态（与显示层共用同一 `stripInstructions` 副本，防双份镜像）。

## 提示词面：`{{script(args)}}` 唯一语义

`{{…}}` 只有一种含义：执行 `preset/scripts/<name>.sh`（替换现行 `prompting.ts:81` v1 正则与 `:189` 裸拼 argv）。

```
expr  := '{{' call '}}'
call  := NAME '(' [ arg (',' arg)* ] ')'
arg   := call | literal          ; literal = 引号串，或不含 ( ) , 的裸词
```

- 这是"**调用 + 字面量求值树**"，不是表达式语言：无变量、无算术、无内建函数、无 `tavern.*`——动态信息全在文件里，参数只传调用点已知的静态值；`{{func(tavern.read('x'))}}` 这类写法不存在（渲染必须纯函数 + 不复活内置命名空间）。
- 值模型全字符串；argv 每实参引号包成单参（上限 16KB，超限报错指路自读文件）；stdout（trim）即返回；嵌套深度 4、单渲染 spawn 总数 8、单脚本 60s（沿用渲染执行参数，可停）。
- **per-render 去重缓存**：同一次渲染相同表达式只执行一次。
- 失败：整段 `{{…}}` 原样保留（fail-visible）+ `scriptFailures` 挂 prompt 结果 → toast + 引擎日志，不阻断提交（现行机制沿用）。

## 薄 API：前端只有 `runScript`，其余是钩子 DOM

| 能力 | 做法 |
|---|---|
| 取数 | `tavern.runScript(name, ...args)`——轮询读 `.chat.snapshot.jsonl` / `runtime` 文件（本地 bash spawn 毫秒级，2s 网格沿用；真有性能压力将来加只读 RPC 是纯增量） |
| 写 | **前端没有写文件的 API**——`runScript` 委托脚本完成一切写（唯一写通道） |
| 执行 | `tavern.runScript` 与提示词面同一 spawn 约定（cwd=`runtime/`、abort signal、超时/上限沿用渲染执行参数），返回 stdout |
| 回流 | 两条路：**填**——卡 JS 写 `.tavern-textarea`（`tavern-insert` 语义的 DOM 形态），由玩家按宿主的发送键；**发**——卡自绘输入框时走 `tavern.submit(text)`（与宿主 composer 同一条 admission，请求身份由宿主侧铸、浏览器时区随行）。宿主自己的 `.tavern-send-btn` 仍是禁触：那次点击归 composer |
| 资产 | `runScript('asset64', 'preset/…')`（bash `base64` 输出） |
| 事件 | 无独立事件通道——`setInterval` + `runScript` 对文件 diff 即事件 |

`mount(tavern)` 幂等渲染、返回清理函数；切会话/载入/重置/发布卡整体重 mount。规则：只认稳定钩子；钩子三类——结构钩子（`.tavern-root / -stage / -transcript / -message(-user/-assistant) / -bubble / -body / -thinking / -tool / -tail-ledger / -timestamp / -model-seat / -context-meter / -usage-line`）供 CSS 换肤、Grid 摆位与 JS 寻址（`.tavern-root` 挂在整页根上，是 `--t-*` token 宿主——`#tavern-theme` 样式表与卡 `theme.css` 的唯一落点）；容器钩子（`.tavern-panel(-<name>)`）由 `layout.json` 声明、`mount` 挂载；交互钩子（`.composer / -textarea / -send-btn`）是回填目标、宿主 `-send-btn` 卡不得触发——卡要自己发送就画自己的输入框走 `tavern.submit(text)`（同一条 admission），不劫持宿主那次点击（停靠的 composer 换肤走 G3 dock 的面板作用域，见上表 G3 行）。卡自己面板内部 DOM 不进契约。**卡样式一律落自家 panel 容器作用域**——`body` 级全局选择器会波及写卡 Agent 列等宿主其他语境（566fbb3 串台铁训，2026-09-25 升格为总则）。JS 的自由来自主文档信任级，JS 的稳定来自钩子契约。SDK 出 `.d.ts`。（2026-09-17 拍板收缩：`-sidebar / -header / -avatar / -name` 四锚出契约——应用壳的整页表达面 = `.tavern-root` token 面（theme.css 覆盖 `--t-*`），依据与缺锚影响史见 [stable-hook-gaps.zh.md](../notes/stable-hook-gaps.zh.md)。）

## 前端渲染面

**主题双层**（2026-09-17 起无授权门槛）：`theme.css` 经卫队（禁 `@import`、`url()` 白名单 `data:` 与 `preset/` 相对资产）后不再单独注入——它成了 `themes.ts` 统一样式表 `#tavern-theme`（`.tavern-root` 落点）的卡片段：页头右上角常驻主题选择（卡片主题（如有）/羊皮纸/DSH 亮/DSH 黑，存 `tavern.ui.theme`）选「卡片主题」时把卡 `theme.css` 拼在羊皮纸 token 基座之后（卡可覆盖 token），选内建主题时整段替换卡主题（覆盖语义；卡无主题或选择为卡时基座即羊皮纸）。`chat.css` 选择器重写限定 `.tavern-stage`；两套 module CSS 的配色与字体全面 token 化（`--t-*`，书架封面 tint 渐变与其白色蒙层为美术资产保留字面量）。**布局方案 B**：宿主渲染固定 DOM 骨架（transcript、各 panel 容器、composer 依次），卡 CSS Grid/Flex 自由摆位，region 概念溶解进 grid-area。**消息渲染管线**（顺序固定）：`stripInstructions` → MarkdownText（`packages/client/ui-primitives`：GFM/KaTeX/代码块）→ DOMPurify 默认白名单 → `<style>` encode→sanitize→decode 作用域化到叙事容器（照上游 `chats.js:536-610`：`custom-style` 暗道 + 选择器前缀 + class `custom-` 前缀 + 禁外链声明），正文 HTML 默认渲染、`layout.json.html:false` opt-out；流式期间打字点，结算后渲染。消息脚行一时间戳与操作同排（`.msgFoot`），流式行（思考/工具/记账）相邻聚团成块。`transcript.window` 视口窗口化：最近 N 条优先渲染、滚动上载全量。

## 信任模型

- **写面**：一切写出自引擎（快照）与 bash（脚本/工具）——前端没有写文件的任何 API；bash 层文件粒度 last-writer-wins（回合结构天然错开脚本与尾代理的重叠窗口），引擎内 RPC 写（编辑器）与尾代理写以进程内按工作空间排队串行。
- 卡 JS 进主文档是信任级摆正（卡的 scripts/tools 已是宿主侧 bash）；`mount` 的单方法对象是定型约定不是隔离——真隔离的 `iframe sandbox` 逃生门留给未来不可信第三方卡，opening.html 维持 iframe 现状。
- 正文 HTML/`<style>` 走消毒与作用域通道；CSS 走卫队；无授权门槛——安装卡已是宿主级信任（scripts/tools 即宿主侧 bash），展现包直接应用（2026-09-17 退役确认框；主题可用设置页内建主题覆盖）。

## 场景走查

五个场景全部由**卡内脚本 + 卡内 UI + 既有引擎时序**组合实现，零引擎改动——它们同时是本定案的业务验收标准。

**① 人物状态面板（尾代理维护 → 面板自刷）**：`preset/setup/<人物名>.state.json` 开局种子；maintenancePrompt 声明每回合后更新各 state；`layout.json` 声明面板容器；`index.js` 2s 轮询 `runScript('read.sh','张三.state.json')` → 内容变化即渲染进 `.tavern-panel-<name>`（`chat.css` 上样式）。

**② 状态注入 post（每轮最新）**：`postPrompt` 挖 `{{read('张三.state.json')}}`（或预设 `states.sh` 拼全部 state）。提交前引擎先等尾闸门，注入的必然是尾代理刚维护完的最新状态；渲染值随消息定格入库，下一轮读到的又是下一轮的最新。

**③ 背包面板（拖拽/买/卖/用 + 流水 + 注入）**：`runtime/bag.json` + `runtime/bag.log`；`preset/scripts/` 的 `bag_buy/sell/use.sh`（jq 读改写 + 临时文件原子改名 + `printf >> bag.log`）；按钮 → `runScript('bag_buy.sh','张三','长剑')` → 刷新渲染；`postPrompt` 挖 `{{read('bag.json')}} {{tail('bag.log','10')}}`。面板操作与尾代理并发按「整文件原子替换 + 后写胜」兜底。

**④ 字幕模式 + galgame 背景**：`layout.json` 的 `transcript.window:{"last":1}` 只显示最近一条（滚轮仍可上翻全量）；`index.js` 轮询快照取最后一条 `plain` → 关键词判定 → `runScript('asset64','../preset/assets/bg_酒馆.png')` → 切换 `.tavern-stage` 背景；`chat.css` 把 `.tavern-message` 做成对话框样式。

**⑤ 世界书（关键词/概率 → 注入上下文）**：`../preset/lorebook.json` 条目 `{keys[], content, probability, constant?}`；`lorebook.sh` = tail 快照最近 N 条拼接 `plain` → `grep -F` 逐条匹配 → 常驻条目直通、`RANDOM` 过概率 → 输出命中正文。挂 `systemPrompt` = 每次请求重扫（世界观层，概率每请求重掷）或挂 `postPrompt` = 每条玩家提交格定（指令层，概率每提交一掷；2026-09-16 反转后的默认挂点——`in-history` 模型下 systemPrompt 变化只追加不替换、旧内容滞留视图，post 影子化退场才是 ST 语义，见 st-card-field-mapping §4.2）。玩家**当前输入已在快照里**（pending 行先于渲染落盘）——关键词能命中刚打出的这句话，这正是 ST 世界书的手感。



| ST 机制 | ST 证据 | 我方落点 | 覆盖 |
|---|---|---|---|
| 消息 HTML + 消息内 `<style>` | `script.js:1898-1911` + `chats.js:536-610` | 渲染管线同款（DOMPurify 为新依赖） | ✅ |
| creator_notes 全局样式（上游弹窗授权） | `chats.js:644`、`:684-706` | `theme.css` 直接应用（无确认框；设置页内建主题可覆盖） | ✅ 且免授权 |
| Custom CSS / 主题（仅全局） | `power-user.js:1148` | `theme.css`/`chat.css` 双层 + 方案 B 布局 | ✅ 超越（ST 无 per-card 布局/主题） |
| 正则 promptOnly | `regex/engine.js:334,350-354` | 脚本读 `.chat.snapshot.jsonl` 输出改写段（全量快照=确定性） | ✅ 语义等价 |
| 正则 markdownOnly | 同上 | 渲染钩子（PR5 评估） | ⏳ 明示推迟 |
| 世界书（恒定/触发+预算扫描） | `world-info.js:73` 起 | 恒定入 systemPrompt；触发= `{{lorebook()}}` 扫 `./.chat.snapshot.jsonl` | ✅ 核心；递归/概率/分组卡自实现 |
| 文本宏 | `macros.js:610` | 脚本化（骨架 `read.sh` 抵 boilerplate；per-render 去重控成本） | ✅ 语义等价 |
| STscript DSL | `SlashCommandParser.js:43` | 不移植 DSL：bash（数据）+ JS（表现）覆盖能力域 | ✅ 能力覆盖、语法不兼容（明示） |
| Quick Replies（含角色级） | `quick-reply/index.js:144-166` | 面板按钮 + DOM 回填 `.tavern-textarea`（填），或卡自绘输入框经 `tavern.submit` 直发 | ✅ |
| 扩展插件 JS（主文档 module） | `extensions.js:826-832` | `mount(tavern)` 同形态 | ✅ 同构 |
| depth_prompt / 总结指令 | `script.js:4423-4431` | 尾代理 runtime 摘要近似；压缩指令定制=后续内核口子 | ⚠️ 近似 |
| Author's Note 任意深度 | `script.js` floating prompt | 动态 post 尾注段（深度=最后 user 之后；任意深度不可达） | ⚠️ 近似 |
| Personas | `public/scripts/personas.js` | `meta.json` + 脚本 | ✅ |
| alternate_greetings | `script.js:7652-7671` | 不做，仅存导入底账 | ❌ 明示 |

## 与当前代码的核对（2026-09-15，行号为磁盘证据）

**已在位（直接复用）**：读围栏开放全工作空间根（`workspace.ts:518`）；写区域覆盖 `runtime/`（`workspace.ts:630-639`，编辑器/`runScript` 通道共用）；prompt 提交顺序与 pending 插入点（`index.ts:316→329→330`）；`stop` 面（`index.ts:907`）；引擎全局事件监听（`index.ts:135`）——快照重写的事件源；`scriptFailures` fail-visible→toast（不阻断提交）；`tavern-insert` 先例与 composer 焦点防护（`TavernApp.tsx:681-685`）；`stripInstructions` 双份镜像（引擎 `prompting.ts:74` + 客户端 `wrap-markers.ts:28`）。

**需新增**：① 快照投影器——`runtime/.chat.snapshot.jsonl` 全量替换渲染（两条触发点 + pending 行），无 append/seq 机制；② 表达式求值器替换 v1 正则（`prompting.ts:81`，argv 引号安全 + 嵌套 + per-render 去重）；③ `tavern.runScript` RPC（api/tavern 唯一新增方法，cwd=runtime 同约定）；④ 客户端 `mount(tavern)` 薄面对象（单方法）；⑤ 脚本进程 cwd 迁至 `runtime/` + 预设脚本（骨架 `read.sh`、模板脚本集）；⑥ 编辑器「显示隐藏文件」开关（客户端 tree 过滤 + locale 键）；⑦ 引擎内 RPC 写（编辑器）与尾代理写的按工作空间排队（进程内轻量件；bash 层 last-writer-wins 写明即可，无需跨进程锁）。

**已消解的设计风险**：世界书扫不到当前输入（pending 行 + 全量重写自愈）；缓存陈旧（权威在日志，错了就错了）；双份视图词汇退役（`orig`/`plain` 是行字段不是概念）；脚本大输入（文件自取，16KB 仅限字面参）；写冲突（前端无写 API，引擎内排队 + bash last-writer-wins）。

## 执行时机表（五主体）

| 主体 | 执行时机 |
|---|---|
| 声明面（css/layout） | 换绑时加载注入；主题选择变更即时（sheet 重注入） |
| 前端脚本面 `mount` | 换绑时幂等重挂 |
| 提示词面脚本 | system=每请求组装；post=提交时（pending 行落盘后、durable 提交前）；maintenance=fork 认领时（首步闸排到 main.after 全部落定之后） |
| `run`（前端调脚本） | 任意时刻（abort/超时兜底） |
| tools（不改造） | 模型工具调用时（回合内） |
| 钩子面 `preset/hooks.json` | 回合收束严格串行链 main→main.after→tail→tail.after（2026-09-21 定案，见 [card-hooks.zh.md](../cards/card-hooks.zh.md)） |

## 分期

| PR | 内容 | 体量 |
|---|---|---|
| PR1 | 稳定钩子重构 + 正文 markdown/HTML/scoped style 管线 | 中（地基） |
| PR2 | `theme.css`/`chat.css` + `layout.json`（已落地：授权退役、设置页主题选择接管覆盖） | 小 |
| PR3 | 快照投影器（`runtime/.chat.snapshot.jsonl` 全量替换）+ 统一表达式求值器 + 引擎内写排队 | 中 |
| PR4 | `tavern.runScript` RPC + `mount(tavern)` + cwd 迁移与预设脚本 + 示例卡 `ui/` + 编辑器「显示隐藏文件」 | 中 |
| PR5 | 渲染钩子评估（markdownOnly 等价物）、面板深化 | 小 |

每期双语 README + devlog + Agent Note；内核零改动，`api/tavern` 仅 PR4 一处新增。手测前按例 `pnpm run build` + client bundle 重建。
