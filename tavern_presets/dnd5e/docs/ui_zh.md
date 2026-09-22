# dnd5e 卡前端蓝图（v8 定稿 · 身份化主卡 + 宽幅数据册 + 环境面板）

目标形态（2026-09-20 数轮原型收敛到 v8；原型=`docs/hud-proto-v8.html`，v7 全套被其取代）：
**无固定边栏，全部悬浮角件，"底深卡浅"——HUD 角件（主角/同伴/环境）深色皮革+金色 BG3 游戏风，二级面（数据册/任务条/成长待办）亮羊皮纸；正文圣域不遮挡；输入框沿宿主默认零改动。面板在 opening 结束后才显现。**

## 三模块

### 模块一：HUD 悬浮角件（layout.json overlay 槽；内容 ui/index.js 自绘）

- **面板架构**（沿 v7）：layout.json `panels=[hud-left/hud-right, slot:overlay]`→宿主 `.tavern-panel-hud-*` 容器=定位锚，内容自绘；宿主容器缺席回退 stage 直挂锚点；React 重渲染 `ensureHosted` 自愈；opening 在场→三根+宿主容器全 display:none，300ms 轮询+mount 即检。
- **主角卡=身份层**（约 200px，贴左上）：
  - **像素头像**（生成器 v3，见「头像素材契约」）：圆形+LV 章；环色=性别三态（男=蓝靛偏紫 `#7c86dd`、女=粉 `#e08cba`、未知=金环无符号）。
  - 名字（16px serif 粗）+ 副标签行：种族徽签（中性暗底）+ 性别符号（带色 ♂/♀；未知=无符号只金环）。
  - **HP 行=唯一主信息**：血条（内嵌左"HP"右 `现值±临时/上限` 绝对值）——**不用百分比**；临时 HP=琥珀附段骑在血条右缘（虚线分隔，title 提示）；≤25% 暗红脉动；0=濒死（红环+闪烁）。
  - **状态行**：statuses chips（kind 三色小号：增益绿/减益红/信息金；`名+剩余`），有才渲染。
  - **不绑其余**（用户定案"别绑太多"）：AC/位条/天气等一律只在数据册。职业不进 HUD。
- **同伴卡=同构成缩小**（主角下方栈）：头像(38px)+名字+性别符号+HP 细条+绝对值+状态行；种族只在数据册。濒死同主角。
- **环境面板**（右上，深色皮革）：
  - **地点层级三行**：大区 › 区域 › 当前地点（上一级 9.5px 灰小字带 ›，当前 14px serif 亮字）——数据源 state.md「玩家所在」节层级约定（见下）。
  - **时日+钟盘**：24 刻度罗盘钟（指针=时辰/24×360°），中心盘**夜=月牙/昼=日辉**；右侧"第 N 日·时段"（拂晓/白天/黄昏/深夜映射）。
  - **天气+地形行**：天气 SVG 图标（晴/多云/雨/雷暴/雪/雾）+ 地形 chip。
  - **昼夜变底**：面板底色随时段四档渐变（拂晓橙/白天青/黄昏赤/深夜蓝靛），夜档加星点闪烁。
- **任务手风琴**（亮羊皮纸卡，沿 v7）：主线金边/支线；点击展开=行文本直读；行首 ✓→完成划线降透明。
- **总开关**（右下按钮）：toggle 滑出左右全部悬浮件（translate+opacity，0.3s spring）。
- 敌怪区**不设**（2026-09-20 定案：战斗呈现归 DM 叙事；战斗数据仅供同伴栈滤除在场敌怪）。

### 模块二：宽幅数据册（点任意角色卡翻开；取代 v7 三 tab 弹卡）

- **容器**：544px 羊皮纸册（max-height 88vh，内部整体滚动）；展开放在触发卡旁（右缘放不下翻左侧；竖向 clamp 视口）。左缘双线"装订脊"。
- **册头**：像素头像(50px+性别环) + 名字 + 副行（LV·职业·种族·性别符号）+ 次行（背景·阵营，缺席跳过）+ **常驻 HP 条**（同 HUD 语义：绝对值±临时段）+ 关闭钮。
- **左栏（196px）**：
  - **大六维雷达**（**代替属性列表**——2026-09-20 用户定案）：三环+六轴+多边形（3~20 归一），顶点直接标 `力 14 +2`（值 13.5px 粗+修正金色）——形状快读+数值可查双重职责；
  - 豁免六枚 chips（熟练亮白/未熟练暗淡）；
  - **技能 18 全列**（不截断）：熟练=金点+全亮+修正粗体，专业★，未熟练降透明；行内属性 tag。
- **右栏（≈1fr）**：速览 chips（AC/速度/暗视/被动察觉/临时HP/力竭/治愈骰——各自缺席即缺位）→ 状态（chips kind 三色+effect 逐行小注）→ 施法区（主属性/法术DC/法术攻击 chips+逐环位点+已知/已备列表——**裁剪律：无施法族整区不渲染；已知型无已备行自动缺席**）→ 装备（武器=泵 join 伤害/类型/性质中文；护甲+盾；钱袋）→ 背包（gear 行）→ 特征（features 行,池类「名|回充|已用」直读）→ 训练与语言（甲/武/具/语言 chip 组，缺族组不渲染）→ 抗性/免疫。
- **末节（通栏）=小传**：description（serif）+ persona 四件（性格/理想/羁绊/缺陷 label 网格）+ 追忆（biography 运行时追加行）。
- **[秘] 纪律**：biography 行 `[秘]` 前缀=玩家不可见推演行——NPC 册**永不显示**；玩家自己的秘行显示但去前缀。数据行容错：剥手写「· 」标记（css 已渲染记号）。
- **滚动提示**：滚动条隐藏（`scrollbar-width:none`+webkit display:none）——余量提示="底部渐变阴影+下行金箭头"（呼吸动画），滚到底即隐；每次渲染重挂 chrome。
- 同名敌怪有档→开全册；杂兵（无 derived）开精简册（仅头+速览+状态）。

### 模块三：frontend 决策通道（front_commit，沿 v7）

成长待办（ASI 加点/学新法术）模态；实现保留。trigger=主角卡状态行的待办 chip。

## 面板↔前端对应（数据格式为准）

**方向律（沿 v7）**：前端基于面板存储 schema 展示；`ui_data.mjs`=唯一读通道（op:rev/full/avatars），出口=runtime 原样投影（player/companions/state/combat 四区）+`derived` 派生区。规则计算归泵，展示映射归前端。

| 数据格式字段 | 泵 derived | HUD/册子部件 | 展示规则 |
|---|---|---|---|
| `name`/`race`/`gender`/`level`/`class`/`subclass`/`background` | — | 头像环色+徽签+性别符+身份行 | gender→环色/符号映射;race/class 中文=前端映射（norm `-_` 归一）;background/alignment 若为中文键直读 |
| `hp`/`hp_max`/`temp_hp` | `hpPct`（条宽用,非展示） | HP 条（绝对值 cap） | `现值(±临时)/上限`;temp≥1→琥珀附段;≤25% low;0 濒死 |
| `exhaustion` | — | 力竭 chip（册子）/状态行 | >0 才渲染 `力竭N级` |
| `statuses[]`(name/kind/effect/remaining) | — | HUD 状态行 + 册子状态区 | kind→色（b/d/i）;effect 注仅册子 |
| `hd_available`/`level` | — | 册子治愈骰 chip | 二者均在才渲染 |
| `slots_l1…l9`/`caster_attr` | `bar/slotsNow/slotsTotal/slotsLv`+`dc/atk`(新) | HUD 不显;册子施法区 | HUD 第二条已删（身份化定案） |
| 六维 | `attrMods`+雷达数据 | 册子大雷达 | 雷达多边形=泵值,前端绘制 |
| `save_prof`/`skill_prof`/`expertise` | `skills[]`/`saves[]`（PB 归泵） | 册子技能/豁免 | 18 全列;熟练点/专业★ |
| `spells_known`/`spells_prepared` | — | 册子法术列表 | 直接名单（中文名=模型存的即按存展示） |
| `weapons[]`/`armor`/`shield`/`gear`/三币 | `weapons[]`（lorebook join） | 册子装备区 | join 缺席=键名原样 |
| `armor_prof`/`weapon_prof`/`tool_prof`/`languages` | — | 册子训练与语言 | 缺族组不渲染 |
| `resist`/`immune` | — | 册子抗性 chips | 缺席整节不渲染 |
| `persona 五件`/`description`/`biography` | — | 册子小传+追忆 | `[秘]` 过滤（见上）;NPC 也显示 persona（观察面） |
| state.md「玩家所在」节（**层级约定·新**） | `region/area/place/weather/terrain`（泵拆解） | 环境面板三行+天气 | 层级=泵拆,前端只展示 |
| state.md `time_*` | — | 钟盘+时段 | 时段四档映射;钟盘角度/日月=前端 |
| state.md 主线/支线 | — | 任务手风琴 | 沿 v7 |

**state.md「玩家所在」节层级约定（v8 起）**：
```
## 玩家所在
- 大区：<大陆/王国级>
- 区域：<地区级>
- 地点：<具体场所·场景>
- 地形：<地形>
- 天气：<天气>
```
维护纪律（maintenancePrompt 同步）：随场景迁移更新「区域/地点/地形/天气」，大区低频变化；泵对旧单行格式兼容（只有地点行时 region/area 为空、不再渲染其行）。

## 头像素材契约（2026-09-20 定案 · 2026-09-21 素材已投放 · **生成器已退役**）

- **图片槽=唯一正本**。`preset/ui/avatars/<race>-<gender>.webp`——2026-09-21 由 4096² 全种族贴图（`docs/头像.PNG`，3 列=♂/♀/兜帽 × 10 行=用户给定种族序）按 DP 谷值切分（`docs/avatar-sheet-slice.png`=切图验收拼图），紧致 bbox 方形衬垫降到 **192×192 webp q85**（每张 ~14KB，base64 ~19KB）。race 键=存储连字符形（`half-elf`）；gender ∈ `male|female|unknown`（兜帽列=unknown）。**泵 `op:avatars` 支持 `keys` 过滤**：前端**逐键按需拉取**（单键 ~19KB——整表 600KB 级会撞进程出闸截断，见避坑 12），命中缓存即重绘。
- **兜底=首字头像**（2026-09-21 用户定案：像素生成器整族退役）：槽键未命中时渲染名字首字（`.pix-letter`，环色仍随性别；开页预览为 `.av-letter` 金字）；换图/补图=丢同名文件进目录。
- **opening 预览**：选种族/性别即向宿主桥要图（`opening-avatar`→`opening-avatar-data`，图片在→dataUrl）；未命中/无桥/未选种族→**本地首字兜底**（名字字段实时出字，roll 后随名刷新），预览永可见、不阻塞表单。
- **种族×性别全表**：人类/半精灵/精灵/高等精灵/矮人/半身人/地侏/半兽人/提夫林/龙裔 × ♂/♀/未知兜帽=30 张。

## 前端准则清单（R1~R6 沿 v7 全数保留）

- **R1 通道唯一**：runScript('ui_data.mjs'),无第二读面;无本地持久缓存（avatar 图片缓存=会话内存,可接受）。
- **R2 局部重绘（硬要求）**：节级三段粒度不变（player/mates/state rev 心跳→节变拉节重绘）;节点级 DOM diff 禁止。
- **R3 数据格式为准**：消费字段=存储 schema（character.tpl.json v9.2 含 gender）;前端展示映射不做规则计算（AC/PB/skills/DC/被动/位表=derived）。
- **R4 监听委托**：事件绑三根一次;册开态跨重绘按 data-ctx 重锚定+tab/滚动位态不迁移;面板收展存 store。
- **R5 失败保旧**：runScript 失败保留上次数据,下拍自愈;页签隐藏降频。
- **R6 正文圣域**：悬浮角件不占流;输入框零改动;总开关收展。

## 数据流与实时渲染架构（沿 v7 rev/full 两级协议,粒度节级）

节清单微调：`player`（player.json）/`mates`（characters/ 聚合）/`state`（state.md——含 玩家所在/主线/时间）。`combat` 无 HUD 件仅滤除用。lorebook 不监视（静态 join）。lorebook join（AC/武器/DC）全在 derived。

## 避坑存档（沿 v7 全部有效 + v8 增补）

1. CSS Modules 哈希类 opening 容器四类名全查;2. 容器晚于 mount→轮询;3. runScript v2 参数=JSON 单串;
4. mount 即 applyVisibility+300ms 轮询;5. 总开关管三根;6. z-index 分层正文<HUD(20/30)<册(60/300)<opening;7. 悬浮件避宿主顶栏;
8. **册 innerHTML 重渲染必重挂渐隐/箭头 chrome**（innerHTML 会清掉）——openBook 内统一重挂;
9. **册/弹层滚动不靠微型滚动条**——隐藏之,可滚=渐隐+箭头;
10. **avatarSvg 输入键归一**：存储 race 可能带连字符（'half-elf'）,norm 后再进生成器/图片键;
11. **opening 预览走桥不内嵌**：宿主缺席时预览静默隐藏,不抛错不阻塞表单;
12. **script stdout 出闸截断**（2026-09-21 实锤）：卡片脚本末尾的 `process.exit(0)` 会在管道冲刷前砍掉大输出——macOS 管道缓冲恰 64KB,超容即静默截尾（JSON 完整性即破）。脚本侧大 payload 一律走 `emit()`（write 回调落完再 exit）;前端侧头像因此改逐键拉取,别再整表投影。

## 施工序列

1. ui_data.mjs：rev/full 沿用+derived 增补（dc/atk/passive）+state 玩家所在层级拆解+op:avatars
2. HUD 角件（身份化主卡+同伴卡+环境面板+任务手风琴）
3. 宽幅数据册（雷达/增益/施法/装备/小传+滚动提示+秘行纪律）
4. gender 三处（tpl/opening.html/opening_commit.mjs）+opening 头像预览桥
5. state.md 层级三行+天气行+openings.json 场景补充+maintenancePrompt 同步
6. 头像素材槽（preset/ui/avatars/ 目录+泵投影+前端覆盖渲染；素材文件后续用户提供）
