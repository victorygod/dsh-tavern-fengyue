# 芙宁娜 galgame UI · 改造方案(照图施工计划)

状态:方案(待批准) | 日期:2026-09-22 | 依据:design_galgame-ui_zh.md(设计) + proto_galgame-ui.html(可交互原型=视觉正本)

> 本方案 = 设计文档 §7 映射表的展开。原则:**设计文档与原型已定案并逐项 CDP 实测**,施工只做"把原型的交互搬进真卡",不再临时发明。

## 0. 现状收口(改造前先停摆旧 UI)

当前芙宁娜 v2 声明形态(mount→runtime(泵+视图)→gal_data 数据泵)与新的对话框状态机**冲突**:
v2 每 2s 重绘一层 HTML,而状态机需要"打字机进度/段落指针/点击路由"这类**跨重绘的会话期 UI 态**——v2 的全量重绘会把它一次刷没。故本次**从 v2 声明形态切回 v1 直控形态**(design §7 已定):

- layout.json:panels 退回 `[{name:'galgame', slot:'overlay'}]`(容器声明,**去掉 data/view**);
- 删除 `ui/runtime.mjs`、`ui/acts.mjs`(本卡不再走 v2 面板运行时);
- `gal_data.mjs` 沿用(数据形状不变,或加 `assets` 资产接口后由控制器直调)。

## 1. 实施序(5 阶段,每阶段独立可验)

### S1 脚手架:上容器 + 控制器骨架

- `ui/index.js` 重写为 v1 直控 `mount(tavern)`:向 `tavern.readAsset` 取图(已注入),挂 `.tavern-panel-galgame` 的 innerHTML 为对话框骨架 + 内嵌状态;
- `gal_data.mjs` op:panel 输出不变(靠 `tavern.runScript/gal` 直调,不走 runtime 泵);
- `chat.css`:转写区 `.tavern-transcript { opacity:0; pointer-events:none }`;composer 由状态机 switches 显隐。

验收:容器出现在 overlay 槽,close。

### S2 段落状态机 + 打字机(原型 script 直移植)

- 状态 `reading|waiting|input`;段落数组 = 用 `gal_data` 的 lastAssistant 按**空行切段**、剥指令注释;
- 打字机 28ms/字;点击路由:打字中=补全 → 补全后=下一段 → 全点完再点=输入态;backlog 态点背景=先收起;
- ▼ 慢悠悠浮动(仅 `r < N-1`)。

验收:点读节奏、双击语义、全部点完进输入态。(原型已有,照搬)

### S3 输入态:composer 停靠 + 功能角

- `#dialog.mode-input` 时 CSS 把 `.tavern-composer` 从宿主原位**停靠**进对话框输入行位置(框架唯一修改点,见 §2);
- 发送键与 textarea 同排、textarea 矮(64px);模型座+环形在发送键下方一行、右缘对齐发送键——这三件由停靠态 composer 原生提供,卡侧只给容器与样式;
- usage 统计线:卡侧在对话框**外正下方**渲染灰色小字(从宿主 contextMeter/usage 线镜像,或直接读宿主现有节点外置),四项 tok。

验收:输入态视觉 = 原型 v8(截图了对齐)。

### S4 backlog:防剧透折叠

- 右上角 `⌃`(dialog 上边缘)点开 → backlog 面板(75% 高,独立 `<div>`,非 dialog 内)出现;右上角 **下三角折叠钮**独立固定(不随内容滚);
- 内容 = 完整历史轮次 + 本轮**已读段落**截止(上一条 assistant 有 N 段而只读到 r,只渲染到 r);user 右对齐、assistant 左对齐;`blBody` 独立 `overflow-y:auto`;
- 段落进度是**会话期 UI 态,不落盘**(换绑重读)。(原型已有,照搬)

验收:防剧透截止、折叠钮位置、滚动。

### S5 CG 换场 + 收尾

- 双缓冲两层 img(cover + `object-position 50% 18%` 锚头身),`.6s` 交叉淡入;manifest 驱动层栈;
- backlog 态 CG `brightness(.55)` + `scale(.965)`;
- waiting 态三点弹跳 + 停止小键(转发停靠态 composer 的停止)。

验收:情绪换场交叉淡入、截头修复、backlog 变暗。

## 2. 框架侧唯一改动(停靠 composer 的载体)

卡**不能**编程触发 send-btn、也不能把 composer 从 React 卸载。停靠方案 = **纯 CSS 定位**:
`index.js` 在输入态给 `.tavern-composer` 加 `data-gal-docked` 属性 → `ui.css` 据此 `position:absolute; left/right/bottom` 钉进对话框输入行;退出输入态移除该属性即回宿主原位。composer 内部(模型座/环形/textarea/发送/usage)全是宿主原生,零复制零转发。
- 若宿主 `.tavern-composer` 结构变动,卡侧 CSS 选择器会退化——这是**仅此一处**的宿主耦合,写进方案以备案;newsletter 保持不动。框架层的 mount face 已具 `readAsset`(前几轮已加),无需再改。

## 3. 文件清单(增删改)

| 文件 | 动作 |
|---|---|
| `preset/ui/index.js` | **重写**(v1 状态机控制器:点击路由/打字机/停靠切换/backlog) |
| `preset/ui/view.mjs` | **精简**(纯函数:分段 spliter + backlog HTML + 对话框骨架,node 可测) |
| `preset/ui/ui.css` | **重写**(对话框/▼/backlog/输入态/停靠样式) |
| `preset/ui/chat.css` | 改(转写区恒隐;composer 停靠态定位) |
| `preset/ui/layout.json` | 改(退 `panels:[{name,slot}]`,去 data/view) |
| `preset/ui/runtime.mjs`、`acts.mjs` | **删除**(本卡不再走 v2 面板运行时) |
| `preset/scripts/gal_data.mjs` | 沿用(数据形状不变) |
| `preset/hooks.json` | 沿用(指令协议/cg 落盘不动) |

## 4. 回归面

- 卡脚本:`gal_data`/`apply_directives`/`cg_brief` 零改动(fixture 直测保留);
- 引擎:无改动(纯卡资产 + 框架 CSS 停靠);
- 真浏览器(CDP)逐项验 S1-S5(与原型 v8 同断言)+ 截图肉眼;
- 全套 `pnpm test` 绿(本改不触引擎,回归既有 291 例即可)。

## 5. 明确不做

- 不长持久化段落进度(换绑重读,ADV 习惯);
- 不重做 token 级直播流(快照 durable 粒度,打字机承担"流式"观感——design §5 声明);
- 不动 v2 声明形态本身(dnd5e 卡仍在用);芙宁娜只是**改用 v1 直控**,面板运行时 vendoring 路线不变。

## 6. 输入框视觉定形 + 停靠改造 review（2026-09-24）

**定形（用户拍板，原型 `proto_galgame-ui.html` v3 为视觉正本）**
- 与「assistant 说话」对话框**同一个盒**：同 padding、同高度基准;切输入态不缩条、不突兀;
- 无金边:textarea 纯深底(与对话框融为一体)、聚焦不发光;
- 无环形进度条;右侧 = 发送大按钮(可变形填充)+ 其下选模型 chip;
- textarea 与正文同内边距、随对话框填充高度(滚动),去掉底部 `…tok` usage 行。

**现状确认:仍复用宿主默认 input 框**(`dock:["composer"]`,`mount` 面把宿主 composer 原件以 JS 量尺 fixed 停靠进 `gg-dock-slot`),**不重画**——改造全部走卡 CSS 覆盖宿主稳定类(`.tavern-composer/.tavern-composer-inner/.tavern-textarea/.tavern-composer-row/.tavern-model-seat/.tavern-context-meter/.tavern-send-btn/.tavern-usage-line`),宿主零改动。

**CSS 改动与风险点(会打架的点,必须一起处理,不可单改一项)**
1. **高度耦合**:textarea flex 填满需要父确定高度——停靠时须把 `composer.style.height` 也钉到 slot 高(≈150,由 dialog input 态 min-height 190 − padding 推导,稳定),textarea `flex:1; overflow:auto`;否则塌/溢出。意味着高度语义从「自然内容高」改「填满滚动」。
2. **两态不一致(突兀真身)**:reading dialog 高随文本、input 态写死 190 → 切换跳变。要「同盒」:固定说话常见基准高,或离开 reading 时记录 dialog 高度、进 input 复用(JS 缓存)真正无跳。
3. **模型选择 popover 锚**:面板 absolute 相对 model-seat;把 model-seat 移右下后会从下方展开、易溢出被遮。需让面板 `bottom:100%` 朝上弹,或模型座本轮不挪、保留可靠锚。
4. **发送按钮 stop 态**:stoppable 时宿主换停止图标;大按钮竖排文字后图标态要能居中适配。

**建议实施顺序**:先做最小版(去 usage/环形、textarea 全高、发送放大、两态高度复用),模型座暂留原位避 popover 风险;逐项 CDP 截图对原型核对后再动 model-seat。