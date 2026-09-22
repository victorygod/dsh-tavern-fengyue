# DND5e 原味卡 — 四宿归类定案（v1）

基于 [rules_zh.md](rules_zh.md)（规则汇编,本目录）（规则骨架，已核验）与卡内语料 `tavern_presets/dnd5e/preset/setup/dnd5e-srd-lorebook/`（1164 篇，assemble.mjs 产出）的分析定案。目标：造一张与 RAW 2014 骨架贴近的单人跑团卡，沿用现有 dnd 卡的引擎机制位（post 注入 / 尾代理 / runtimeRead / lore_index / 卡工具）。

> 文中带 ⟦?⟧ 的是**暂定决策**（我的推荐案，用户未确认，可翻案）——翻案改本文件即可，下游设计都以本文件为唯一口径。
>
> **v2 修订（2026-09-18，依用户原则）**：凡输入输出确定的**死规则**（查表/多步推导/硬约束/跨字段重算），唯一载体是**脚本**；agent（主/尾皆然）只需知道调用协议（传什么、拿什么），**不需要知道规则内容**。据此收回 v1 的五处错置：升级阈值表与升级连锁、休整规则、调整值公式、施法资源硬约束、专注 DC 等衍生数值——全部从 prompt/agent 知识面退役，见 §1、§3、§4 的修订。

---

## 0. 四个暂定决策（对话中悬置，先按推荐执行）

| # | 决策点 | 暂定案 | 理由 / 翻案代价 |
|---|---|---|---|
| D1 | 法术资源 | **原味九列法术位**（1~9 环现量/总量，升环照 RAW） | 面板复杂度换机制完整；法环表已在 lore 职业文件里现成。翻案→MP 条（失真升环/专注/契约魔法） |
| D2 | 先攻 | **脚本硬先攻**：开战掷全团出序列，跨回合守序 | 行动经济/反应时机的数学落点；state.md 战斗态承载。翻案→软排序（省一次调用，失原味旗杆） |
| D3 | 职业深度 | **精选 4 经典职业**：战士/盗贼/法师/牧师（子职业取 SRD 默认那个） | 覆盖四象限、首卡收敛；lore 12 职业已全渲染，后续加职业=复制文件+开局页加项 |
| D4 | 成长 | **纯 RAW**：升级=+1HD+HP+特征表（lore）+4/8/12/16/19 级 ASI 玩家点选；经验=怪物 XP×RAW 阈值 | 零 homebrew 零版权风险。翻案→双轨加自造技能层/1d6 随机成长（见 v0 问题清单） |

其余已定（无争议）：优势劣势归脚本参数、濒死掷骰归 roll 专用分支、专长首发不启用；背景启用（SRD1+自写5式）、18 技能表进 systemPrompt 常驻、DM 手艺只做 systemPrompt 点睛。

## 1. 总判定规则（规则→宿主的五条充要判据）

1. **判断语境小常量**（≲30 行、每回合要看的**选择面**）→ **systemPrompt 常驻**：18 技能清单（选哪个检定）、DC 标尺（选多大）、掷骰时机铁则。**公式与表格形态的规则内容一律不进 prompt**——那是脚本的事。
2. **大表/长文**（有界但体积大）→ **lore + INDEX 注入**：法术 319、怪物 334、职业 12、武器/护甲、魔法物品、状态 15 条全文、伤害类型。
3. **死规则（输入输出确定的纯函数）→ 工具脚本**，agent 只持调用协议不持规则：xp 进→升级块出（advance）、休整进→结算出（rest）、施法链接进→位检闸出（roll 施法参数族）、stat/skill 进→修正值出（roll 解析）。规则内容唯一载体 = 脚本（+其引用的 lore 数据）。
   - **边界**：单步四则的高频叙事事件（HP 加减、状态到时）仍归尾代理直算——叙事流不能 RPC 弹幕化。
4. **可变状态** → **面板**（尾代理唯一写手；正文是唯一事实源——"写明确的数字世界才会记下它"）。
5. **判断与叙事纪律** → **提示词**：优势来源判断（谁看不见谁/掩护/倒地）、掷骰时机、失败推戏、三支柱配比。

读写权责铁律（v5 终律 2026-09-19：**纯计算器**）：主代理消费状态+产出正文+调计算器；**工具一律零写盘**——读面板、返回值与回执，无副作用；**唯一写手=尾代理**（照回执与正文事实落盘，opening_commit 的 t=0 出生除外）。执行串行，工具可测可重放。

## 2. SRD Lorebook 装配计划（语料→卡的裁剪表）

**目录定案**：SRD 语料装进 `preset/setup/dnd5e-srd-lorebook/` → 播种为 `runtime/dnd5e-srd-lorebook/`。定位 = **模型与玩家共同可见的共享数据面**——模型经 runtimeRead 按需查原文（书本 UI 已删 2026-09-20，数据面保留）。与叙事实体目录分立：`runtime/lore/`（尾代理登记的 NPC/任务/地点，可增删）管游戏世界，`dnd5e-srd-lorebook/` 管规则原文——**尾代理对后者只读**（maintenancePrompt 明文：禁止 create/update/delete，疏忽即数据损毁）。书本 UI 已删（2026-09-20，见 §6.5），其数据面双方共享不变。

**§2.1 文件双层制（合并的正确粒度）**：卡内构建器 `tavern_presets/dnd5e/assemble.mjs`（卡根、preset/ 之外——引擎开局只复制 preset/，构建面永不进运行时）把源 JSON 的结构化字段升进每个 md 的 frontmatter（法术：level/school/save/damage/damage_type/half_on_save；怪物：CR/XP/AC/HP/六维…），正文保持原文。单文件双消费——索引扫 frontmatter、脚本结算读 frontmatter（原书本 UI 渲染正文一环随 2026-09-20 删 书本 裁定移除）。规则数值零第二副本：改一处，玩家显示与脚本行为同变。上游同步链 = repo 级 `scripts/srd-convert.mjs`（clone 5e-bits/5e-database → 刷 docs/dnd5e-srd 的 .src）→卡内 assemble → 卡 setup。

**§2.2 合并口径**：2014 全量为基线（剔除：feats——D4 不启用；magic-items——首卡无战利品系统；中间表 categories/levels/features 等已内联）；2024 只补 2014 缺的类别（poisons）；同名实体 2014 优先。

**§2.3 分层索引**：全量 ≈700 行 ≈ 每回合 3~4k token 不可接受——索引分层：常用类别（规则章/状态/技能/装备/职业）逐条；大库类别（法术/怪物）折叠为一行汇总，模型细查时先 runtimeRead 该类 INDEX（两层跳跃仍按需）。首屏预算压到 ~1k 行级。索引脚本扫描双目录（lore + dnd5e-srd-lorebook）。

| 类别 | 进卡量 | 装配方式 |
|---|---|---|
| spells | 全 319 ⟦?⟧（或 首发 60~80 精选=战斗/探索/社交×4 + 仪式组 + 戏法全量） | `setup/dnd5e-srd-lorebook/spells/**`，INDEX 注入按环位分层 |
| monsters | 按"遭遇生态"选 60~90（哥布林~巨龙梯度+本卡世界观原生怪） | statblock 头行已含 CR/XP/HP/AC → INDEX 注入一行一只 |
| classes | 4（D3） | 全渲染（等级表+特征+子职业） |
| races / 装备 / 状态 / 伤害类型 / 规则章 | 9 races / 武器+护甲全集 / 15 条 / 13 / 33 章文本 | 常用小表部分升入 prompt，其余全量 lore |
| skills(18) | prompt 常驻（中英对照一行表）+ lore 冗余一份 | — |
| magic-items | 首发不装（无战利品系统），二层再开 | — |
| backgrounds | SRD Acolyte + **自写 5 式**（贴 PHB 结构：2 技能 + 2 工具/语言 + 特性 + 起装金——机制不受版权、表述自写） | lorebook `backgrounds/`，frontmatter 结构化 |

## 3. 主代理工具集（preset/tools/）

### roll（扩展现有卡 roll，一并修 ÷2 笔误）
- **modifier 改双通道输入**：`stat`+`skill` 引用式（推荐）→ 脚本读面板解析 `修正值 = 属性调整值 +（面板技能熟练表命中则熟练加值）+ frontmatter statuses 的 effect 数值`，返回行带计算分解；`modifier` 直值保留（未列临时环境项用）。**六属性公式与 ÷2 从两份 prompt 全部退役。**
- `mode`: `normal|adv|dis`（默认 normal）——2d20 取高/低，footer 重申"多源不叠、优+劣抵消"；
- `purpose` 含「濒死」→ 丢 modifier、raw d20 vs DC 10，nat20=回1HP / nat1=双失败，计数读写走面板临时节（回血/稳定双清零由本分支维护）；
- `purpose` 含「专注」且带 `damage` → DC = `max(10, damage/2)` 脚本自算（CON 豁免，取目体格）；
- 伤害结算参数 `halve/double`（抗性减半**向下取整**、易伤加倍——取整改归脚本不吃模型心算；DM 按目标 resist/immune 判定是否传参；immune 直接不掷）；
- 判定/结算/升环三分支保留；**暴击翻骰参数化**：攻击 nat20 的返回文本主动提示「下记伤害掷骰传 `crit=true`」——DM 做判断（是否暴击）不做数数，恰是他的本分；漏传由尾代从 transcript 对账发现（nat20 行后伤害未翻倍 → 报警）。
- **施法参数族（consume 的闸半体并入）**：`spell`（法术名）+`as_level`（升环）+`caster`（默认 PC）——工具读面板三检（位表可用性（RAW「无位不可施」）、升环 ≥ 法环、专注冲突（面板专注中 × 该法术 concentration）），**过检即回执**（建议扣减后的槽位/灵感余量——工具不落盘）；`use_inspiration: true` 则回执灵感已用标。**同回合连发施法的余量正确性=回执中继**——DM 下一次调用参照上文回执（或传 `budget_offset`），与 crit 参数中继同先例。覆盖面如实：无掷骰施法（护盾/隐身类）不走闸——兜底=注射面位聚合行（玩家/DM 双视）+ 尾代对账报警。
- **先攻并入本工具**（工具收敛）：`purpose=先攻`＋`combatants`（PC/同伴 dex 自面板读，敌人填）→ 全员 d20+DEX 排序（平手=同刻）；序列文本经 transcript 由尾代理转录 combat.md。**工具族终态（2026-09-19 数值维护专题）：4 件——roll、trade（主面）/ advance、rest（尾面）**。合并判据（用户原则）：只有"叙事瞬间总在一起"才并——先攻与掷骰同构（并入）；施法闸与施法的骰总同瞬（并入 roll 的施法参数族）；consume 的扣减半体=一步减法（归尾代理直改面板，连工具都不配——与 HP 落账同边界）。

### trade（新,已定）— 买卖结算器（主面,叙事内经济流）
- 入参：`buys`/`sells` 物品名与数量（自定价参数兜底非 SRD 品目;卖价 SRD 无明文 DM 传参）;
- 固化：lorebook equipment 价格合计（A 查表）→ **10:1 跨币兑换与找零**（SRD Standard Exchange Rates——多步链,心算必错项）→ **回执**（支付组合/找零/新钱包值/物品清单——尾代照回执落钱包与 gear）。

### advance（新）— 经验/升级结算器
- 入参：`xp_gain`（或怪名列表由脚本查 lore statblock 头行 XP）；
- 读面板 → 内部阈值表（20 行常量，**唯一载体**）→ 输出：新等级、经验余额、下一阈值；若升级——**整块升级 diff**：新熟练加值、该级特征清单（读职业 lore 等级表）、新法环表、HD+1（HP 掷骰或取均，入参二选一）、ASI 是否解锁、CON 追溯每级 +1 HP、上限 20 截断。输出为可直接落盘面板的 markdown 节选。

### rest（新）— 休整结算器
- 入参：`kind: short|long`、`hd_spent`（短休花几枚，玩家决策）、`food_water: bool`（长休力竭 −1 的前置）；
- 长休链条（RAW 核验）：HP 全回 + HD 回总数半数（≥1）+ 法环全回 + 力竭 −1（须饮食）+ 临时 HP 清；**三铁轨前置校验**——起始 HP ≥1、24 小时至多一次（读 state.md 游戏时间；上次长休时刻记 state 队伍节一行）、打断作废；
- 短休：逐枚掷 `骰面+CON` 回血 + 职业短休池回充——**池映射是 rest 脚本内私有死规则常量**（唯一消费者,不进 lib；lorebook 无此结构化列）：
  - D3 四职业：战士|行动浪潮+第二风 → 短休；法师|奥法回复 1/日（短休）；牧师|神圣渠道 → 短休；盗贼|无池。
  - 2014 基线禁区：**狂暴/吟游激励/术法点均为长休恢复**（「狂暴短休回 1」是 2024 规则，勿串线）；
- 输出结算摘要（动了哪些字段、回了多少）。

### consume — **已消解**（2026-09-18 三次收敛）
原设计（施法资源闸）拆散归位：
- **扣减半体**：一步减法，非规则链——尾代理凭正文事实直接 runtimeEdit 面板（与 HP 落账同边界，不设工具）；
- **闸半体**：叙事合法性必须即时 → 并入 roll 施法参数族（施法时刻闸与骰总同瞬——用户的合并原则）；
- 灵感花费/专注冲突/升环校验随闸同入 roll。
启示录：一个工具捆住两个不同生命周期的职责（叙事闸 vs 面板维护）正是它归属反复摇摆的根源——拆开后不再摇摆。

### 维护工作全普查（2026-09-19 终版路由——工具 4/脚本钩 5/其余 agent·尾代直做）
- **主·roll**：判定/伤害/先攻/濒死/专注/施法闸/灵感（全回执制:返回建议新值）——**零写盘**;**主·trade**：合计+跨币找零/新钱包值回执——零写盘。
- **尾·advance**：XP 均分/升级块/CON 溯/ASI apply;**尾·rest**：全链休整。战末归档=advance+直改（宿敌回写+删 combat）。
- **尾代直改（零工具）**：HP 落账/敌行/状态增衰/临时HP/力竭/池递减/gear 转录/state 六节时间/新实体建档/殁归档/combat 誊建清零。
- **agent 直做**：叙事/DC 选择/优势来源/目标选择/预算粗查/议价/craft 时机与数值（尾代落账）。
- **不可感知（触发器）**：player_panel 拼取（回合提交时）/ui_data（rev 心跳+节级拉取）/opening_commit（表单提交）/**front_commit（前端点选:ASI/新法术——机械写道,LLM 零参与,见 tools_zh §六）**/write-guard（runtimeEdit 写 json——已由工具内置：落盘前整档 parse,坏则拒写）。

### 工具归属与引擎能力边界（2026-09-18 二次修正：2+2 分挂）
**归属判据 = 谁在当回合叙事进行中就需要返回值**：叙事内即时性 → 主代理；纯面板维护性 → 尾代理。
- **主代理面（全员,2026-09-19 终律）**：**roll**（判定/伤害链/施法闸/濒死/专注/先攻）+ **trade** + **rest** + **advance**——四件全是 DM 推演的现场计算器,回执即叙事素材。
- **尾代理面（已撤销,2026-09-19 终律）**：计算器全员主面（推演现场素材）;尾代纯写手零卡工具、只持 runtime*——回执本在上下文,照实转录。schema `agents` 字段机制保留、全员缺省 main。
- **归属声明制（2026-09-18 定案）**：全部工具住 `preset/tools/` 一目录，schema 块新增可选字段 `agents`（缺省 `['main']`，**无 schema 块的 generic 工具亦归主面**——漏标记的失败方向=尾面看不到，不是误暴露，安全向正确）。归属改变=改一行标记（git 断史/搬文件/双目录副本之忧全消）；交叠免费（`agents: ['main','tail']`）。「位置=面」语言不再膨胀：一个 tools 目录 + 工具自述。
- **引擎落地**（核码，~15 行）：`registerCardToolsDir(agentCtx, root, shell, face)` 抽自 registerMainAgentTools——扫 `preset/tools/*.mjs`，按 mtime 缓存的 `CardToolSchema` 读 `agents` 字段，face 匹配才注册（缺省含 main）。主面调 face='main'（行为不变、向后兼容）；`registerTailAgentTools` 追加 face='tail'——尾代理每回合 `onAgentCreated→composeTailAgent` 重组合，重挂即吃到改卡，**免 mtime 同步**（循环只有 session 常驻主面需要）。两面注册表各自独立（cordis own-scoped 层），同名不冲突；第三脸 composeWriterAgent 将来 face 值语言照样覆盖。
- **lib 不预建（2026-09-19 YAGNI 裁决）**：当前零真实住户——commit 是写方（拼 frontmatter 无需解析器）、微渲染唯一消费者（内嵌 opening_commit）、阈值表/池表各归主人内嵌。规则：**同一份代码第二次真的被需要时才外提**，届时以 file:// 实证可达建 `preset/lib/`（engine 不扫不播种零执行入口）。此前立的准入门槛表作废。
- **共享实现层**（实证）：data-module 可 `import(\"file:///…\")`（cwd=runtime→`../preset/` 可达，逐调用起新 node 进程无缓存串扰）（作为未来外提共享件时的机械可行性备忘,非当前结构）。回尾闸门保证主/尾串行执行。

### 写盘纪律（v2.2，2026-09-18 rolls.log 退役）
**纯计算器定律（v3 写盘纪律,2026-09-19 终律）**：四件工具全部**零写盘、无副作用**——读 runtime 面板,返回值与回执;**唯一写手=尾代理**（转录回执+正文事实落盘;opening_commit 的 t=0 出生是唯一例外）。撤销 v2.2 的「窄道直改」（slots/灵感/濒死计数/钱包全部回归回执制——回执含建议新值）。同回合连发的状态连续性（多次施法/连暴击）一律**回执中继**（DM 参照上文回执或传 budget_offset 参数——与 crit=true 中继同先例）。校验只剩两道:引擎 write-guard 拦坏 JSON+读侧 fail-loud。**工具纯函数化的三重红利**:可单测可重放、语义契约只剩输入输出、调用记录天然进 transcript 即审计。**rolls.log 全线退役**不变——跨调用传话四条理由尸检（先攻单次/濒死不重复/暴击参数中继/施法闸回执中继）,全部无需磁盘传话。

## 4. 数据层与面板 Schema（v2.1，2026-09-18 面板专题定案）

**三原则**：
1. **同伴与主角同构**（frontmatter `role: pc|companion` 区分，内容稀疏度按需）——理由不是公平而是工具复用：roll/advance/rest 全部参数化为「读某面板」，同构=同伴免费获得全部结算工具；schema 分叉=每个工具双分支。
2. **面板只存「选择与现值」**：PB/修正值/先攻/DC/被动醒觉/位表总量一律 derived，读方（脚本/UI 汇编）现算；面板存原始六维、职业等级、熟练表、位表现量、资源现值、HD 未用枚数、HP 现值/上限（上限=掷骰历史的存量事实，算不出）。推论：**装备引用式**——面板只记持有清单（名×n+持位），骰式/AC 算式/价格 join lorebook equipment frontmatter——消灭双副本。
3. **战斗态独立文件** `combat.md`：initiative 开战时建、尾代理战后归档即整文件删除——瞬态与叙事分离；结束=删文件天然清空。

```jsonc
// runtime/characters/<名>.json（player 固定名）—— 目录即类型,v7,实体见 templates/character.tpl.json
// 机件：身份/六维/生存现值/熟练列表/施法/资源池/装备引用/钱包/武器与背包行/pending/statuses
// 叙事：persona（五短串）/biography（行数组,追加式）/——flat 浅层,深嵌最多一层对象
// 纪律（唯一的雷规）：叙事字段=单行短串或字符串数组,严禁多行长段——JSON 转义雷即消
// lore/ 只住非人物；战斗期现值走 state.md 战斗节敌行,战末归档回写本件
```

```markdown
# runtime/state.md（六节=引擎叙事簿记，非 5e 官方 schema；血统：游戏时间=真 RAW·Time 章；作息账=真 RAW·Between Adventures 章
# 玩家所在=探索面半对应，主线/支线/篇章=叙事工艺（DMG ch3 概念的正当去处是 systemPrompt 节奏纪律），伏笔=纯引擎创新）
## 篇章进度 / 主线 / 支线 / 伏笔 / 玩家所在 / 游戏时间   （沿用现卡六节）
## 队伍           成员名单与平均等级（供遭遇预算折算）；经验按 RAW 每人一账
```

```jsonc
// 战斗瞬态＝state.md「## 战斗」节（2026-09-20 定案,combat.json 及其模板已废;读者=roll/HUD/尾代/attack·cast）
{ "round": 1, "act_index": 0,
  "order": [{ "who": "洛克", "init": 17, "side": "pc" }],
  "enemies": [{ "name": "哥布林甲", "hp": 7, "hp_max": 7, "ac": 15,
                "path": "dnd5e-srd-lorebook/monsters/goblin.md" }],
  "allies": [] }
// 战况记事（地形/记忆点/DM 备注）→ 本地叙事走转写正文与摘要,不入本件
```

**数据全景（v7,2026-09-19——lore 子目录上提,目录即类型）**：`runtime/` 下——`characters/`（`player.json` 固定名+一切具名人物 `<名>.json`,JSON:机件+persona+biography 行数组）、`locations/ · quests/ · items/ 等`（md,现卡 lore 协议原样上提一格;LLM 主读写零机器消费）、「## 战斗」节（state.md 内,战斗瞬态;先攻后由尾代改写——回合/先攻序/敌行[杂兵带 lorebook path],战毕归档[命名敌终态回写 character 文件]清回「（无战斗）」;combat.json 已废）、`state.md`（根,唯一 md 常驻面板:六节+队伍+近期人物;frontmatter time_day/time_hour 两机器行）、`dnd5e-srd-lorebook/`（只读）。无名杂兵住战斗节敌行；特色分界=**characters JSON（机器重）/ locations·quests·items md（LLM 重）**。**postPrompt 每回合加载面（v7 定案:暂时全量原文,不做渲染摘要——用户裁决"暂时不需要"）**：player.json + 同伴（扫 role:companion）+ 热点 NPC（state「近期人物」登记行驱动,不用 mtime）+ state.md 原文（「## 战斗」节随文注入——get_combat_state 已撤,2026-09-20 用户裁定:同一份 state.md 不注入两遍） + 分层索引行;~1.5-2k token/回合;派生值通道=roll 工具照算;**摘要渲染层挂账为日后量测优化项**（注入层≠文件层的分界原则不变,当前选择直给）。拼接脚本退化为拼取器(cat 合集,零格式化）。**引擎 write-guard（~15 行,施工项）**：runtimeUpdate 写 *.json → 写后 JSON.parse → 坏则回滚原文+结构化报错（=「改完自动 lint」;读侧 fail-loud 兜底）。。
**经验账（2026-09-18 定案：按 RAW 标准）**：每人一账（player frontmatter `exp`），遭遇 XP 由**参战角色均分**；升级逐人 advance。新同伴入队按队伍平均等级建档（桌面通行约定，DMG 精神）。

**同步删除记录**（2026-09-18）：`docs/dnd5e-srd/`（md 正文与 .src 一并）已删——卡内语料为唯一正本（5.0M，git 可追踪）；再渲染路径=clone 5e-bits@3b124d8 → `scripts/srd-convert.mjs` → 卡内 assemble（钉版与署名常驻 assemble.mjs 头注释）。

尾代理职责（原则凝定 2026-09-19：**主=计算不可分**（叙事内罐头调用）/ **尾=零新算纯维护**（调罐头不算产出逻辑）——转录+对账+建删档）：规则链已脚本化（roll 施法闸/advance/rest），maintenancePrompt **不再承载任何规则知识**，只剩三块：
1. **回合事实提取清单**：HP/伤害/治疗落账、物品得失、新登场实体登记 lore、任务/主线/伏笔变化、时间与位置推进、掷骰与消耗数字的转录；
2. **文件规范**：面板与 lore 的结构、frontmatter、整文件重写纪律；
3. **对账原则**：工具已结算的（advance/rest/roll 闸与计数）**照抄工具返回落盘，不重算**；正文与工具返回冲突时以事实次序调和，面板现状为基线。
浮点无、阈值无、公式无——尾代理从"规则的执行者"降级为"事实的簿记员"。

### §4.5 面板×脚本配合契约（2026-09-18：双层制推广到面板）

**格式律 v3（2026-09-19，格式随主要作者与读者）**：**面板（players/combat）=纯 JSON**——主要读者是脚本与前端（roll/ui_data/HUD），尾代理做浅层整写（flat 一层+statuses 等四字小对象=LLM 安全区，**禁深嵌套**）；`JSON.parse` 免费 fail-loud（优于 frontmatter 坏行静默丢失的 fail-silent），出生即 schema 检查一次。**一人一文件——叙事也住 JSON（v5:全人物统一含 NPC/摊贩）**：persona 字段=单行短串、biography=**字符串数组（追加式）**——形态消雷（append 一行优于重写整段散文），免拆文件免跨文件对账。**lorebook/lore/prompt 保持 md**（LLM 为主读者，一次性出生；前端勿混）。lore/ 撤销=子目录上提:locations/·quests/·items/ 等直接住 runtime/ 下（md,现卡协议原样）。尾代理整文件重写时两层一体维护。机器读取只认 JSON 键——md 叙事卡零机器语法。

- `statuses` 为 JSON 数组（对象四字段：name/effect/source/remaining——effect 如 `"str-2"`，roll 命中属性即计入）
**lint 面**：面板=出生时 JSON.parse+schema 全检一次；此后尾代理整写偶发坏=下个读者 JSON.parse 当场炸（fail-loud 自愈式发现）+ 尾代施工时配对账工具（schema：必需键=核心集,能力族按**键裁剪律**条件必需(panel-data 二·B)/类型/枚举 role 二值 pc|npc/交叉约束 slots 现≤f(class,level)、hd≤level、concentrating∈spells_prepared）。接口 JSON（ui_data/manifest）由代码构造,免校验。lorebook/lore 的 frontmatter 面继续小 lint（lore_index 消费）。

**players 机器层全清单（v9.1 口径）**：核心键 `name/description/role(class|npc)/class/subclass/level/race/background`；六维 `str…cha`；`hp/hp_max/temp_hp/exhaustion`；`languages[]`（对话门控）；`speed`（基准）；`darkvision`、`resist[]/immune[]`（种族继承，伤害结算 `halve` 参数的依据面）；装备最小引用 `armor/shield`（骰式与 AC 派生 join equipment）；**钱包 `gp/sp/cp` 整型标量**（SRD Standard Exchange Rates 的 10:1 兑换是死规则——商店工具上线时内置；pp/ep 罕见走正文）。**能力族（键裁剪律,panel-data 二·B：没有什么能力就没有相关字段,对所有角色含玩家）**：成长族 `exp/pending/hd_available`；施法族 `caster_attr/spells_known/spells_prepared/slots_l1…l9/concentrating`（现量）；`features`（已获特征行数组,池类特征行内标使用状态(名|回充时机|已用),回充=时间推移检查清单短休/长休/每日档）；训练面 `save_prof/skill_prof/expertise/armor_prof/weapon_prof/tool_prof`（后三件=RAW 惩罚与背景的执行面）。**派生量一概不存**（PB/修正值/先攻/DC/被动醒觉/位表总量）。**已整删机制**：inspiration(灵感=扮演奖励归 DM 叙事)/origin/death_success·fail(濒死=death 工具入参+transcript)。

**state.md**：无 frontmatter——「时间敏感项」登记表首行「当前时间」=时间唯一真值（原 frontmatter time 字段的消费者 rest 工具已消亡，字段随亡）。**combat.md**：`round/act_index` 进 frontmatter；文件由尾代理建档与删除（roll 先攻分支只返回序列，不写文件——写权限按道分配不破）。

**R/W 矩阵（工具 × 面板）**：

| 工具 | 读 | 写/出 |
|---|---|---|
| roll | players/*.json（六维/熟练/level→PB）＋statuses；combat 敌人行 AC；施法链接时位检/专注检 | 结果文本/回执（含建议新值,零写盘） |
| advance | players/*.json（exp/class/level/con） | 升级块文本（frontmatter 新值清单，尾代理整段落盘） |
| rest | players/*.json（hp/hd/slots/res/exhaustion/concentrating）＋state 时间 | 结算摘要（尾代理=写手，直接落盘） |
| roll（先攻分支） | player `dex`＋敌人 dex（lore statblock） | 序列文本（combat.md 由尾代建档） |
| 索引/ui_data | 全面板＋combat | 注入行/JSON（派生量现算） |

**工程注**：引擎 v2 卡脚本以 data-module 注入执行，模块间相对 import 不可达——frontmatter 解析器（~15 行）各工具自带一份；未来若引擎提供 util 通道再收敛（记入 §7 风险）。


**注入层 ≠ 文件层（2026-09-18 补）**：面板文件是契约全量（上文机器层清单），**每轮注入 postPrompt 的不是文件本身**，而是渲染脚本产出的 **DM 摘要**——同批数据的另一张投影视图，派生量由渲染脚本现算：
**进摘要**：姓名/职业/等级 · HP/AC/先攻/被动醒觉（现算）· 六维+调整值 · 状态行 · 专注 · 装备一行 · 位现量聚合（施者）· 灵感。
**不进摘要**（文件有、上下文无）：`exp` 精确值（升级由 advance 报知）、`spells_known` 全表（准备表够用）、背景自述、履历——需要时 runtimeRead。
预算：每角色 6~8 行 ×4（PC+同伴）＋state 六节＋combat 摘要（有战才渲染）＋分层索引 ≈ **1k token/回合**。战斗期的敌人现况由 combat 摘要承担（非角色面板）。


**无二期（2026-09-19 终律）**：工具覆盖不了的行为一律 agent直做+尾代落账——craft（5gp/日）、lifestyle 日费、training、loot、**造战预算粗查（撤 encounter 后候选,DM 查 lorebook 表心算）**全部当下即如此处理;工具清单冻结为 4 件（皆过 A/B/C 判据:有表/多步链/叙事内硬约束）。**无双面工具 v1**——`agents:[main,tail]` 机制留作未来一行标记,不预建。
## 5. systemPrompt 骨架要点（纪律清单，不写散文文档——按用户定调"体感点睛"）

- 掷骰三前提（不确定+后果+非纯推进）；DC 标尺；18 技能表（选检定面）；modifier 传法 = `stat/skill` 引用交 roll 解析（熟练/专精/状态脚本计），临时环境项才直传；**任何公式不落 prompt**。
- 数值纪律：伤亡数字在叙事关键处写明确数值（尾代理唯一事实源）；`[掷骰 #N]` 行原样织入。
- **工具面纪律（必须）**：凡工具覆盖的行为**禁止心算**——掷骰一律 roll（施法必带 spell 参数过闸）、休整调 rest、战果经验调 advance、买卖调 trade;工具回执即账面事实,正文数字须与其一致。
- **末行自演算 tip**（纯提示词,与架构无关）：正文末段附数据变化小结（本回合：谁 -XHP/谁阵亡/谁获物/掷骰编号）——复述即自校验,兼作尾代转录锚。**范围=叙事段量**（骰值/伤害）;**结算段量（XP/休整回复）永不出现在正文**——正文只述事件（"战斗结束/扎营过夜"）,数值唯一呈现面=HUD 变化日志（尾代在 state.md「上回合变化」节登记 值+原因,ui_data 投影,前端 feed 渲染;防"正文心算 vs 工具计算"双真值）。
- 剧情梗概承诺（沿用现卡 footer 反作弊机制）；失败推戏不为墙。
- 优势来源=DM 判断（视觉/掩护/倒地/隐匿），传递给 roll 的 `mode`；不叠加只问有无。
- 战斗按先攻序叙事（D2）；借机/反应只在合法窗口触发；战前轮/战斗轮两段制保留（玩家没给策略→只铺场+选项——战斗规则在先攻前并未启动，与 RAW 不冲突）。
- **突袭**（2014 RAW）：对潜伏方开战时，敌方潜行检定（roll）对全员被动醒觉（面板现值）；被突袭者首个自己的回合不能移动/动作、该回合结束前不能反应。
- **非战斗 XP**（RAW：encounter 含社交/探索成就）：重大非战斗进版也可 advance `xp_gain` 记账，注明事由。
- **死亡二轨**：同伴（按职业构造）走 PC 濒死豁免；无名怪默认 0 HP 即死（RAW 缺省）。
- **冒险日按 DMG 标准**（6~8 场中/难预算 + 两口短休）：本卡常设 PC+2~3 同伴=四人队数学，遭遇预算原生适用、不再单人折算；强度带偏 easy/medium 适配单人指挥带宽；探索/社交遭遇同样计入预算（RAW encounter 定义）。**规则正本=`docs/dm-loop_zh.md` A 部（v3 合并版：三书规则+卡内落地 B 部）;DC 六档/濒死稳定/卖价半价三处校勘已并入。**
- 篇章换挡跟 Tiers：1–4 地方强，5–10 一域，11+ 位面（作为篇章设计的心法，写成两行）。

## 6. user-facing 流程（开局页）

opening.html 在现卡基础上（姓名/出身/同行者）加：
- **职业选择**（4 选项卡，各自 HD/豁免/核心特征五连图卡片，照 lore 职业文件渲染）；
- **属性生成三选**：标准阵列/27 购点/4d6 丢最低（点按钮本地掷骰，掷骰走 runScript 委托一个 roll 工具共享实现——零新机制）；
- **种族**（9 选，速度/暗视/属性加值进面板）；
- **背景**：lorebook backgrounds 六选一（SRD Acolyte + 自写 5 式），frontmatter 入 player 面板（技能/工具熟练并入面板熟练表）。
- **起装二选一（PHB 原文）**：职业装备选项包（lore class 起装行）或掷起始金（掷式在职业起装描述；面板 `gp` 落账）。
- **面板生育（2026-09-19 定案：模板文档 + 微渲染）**：`preset/templates/character.tpl.json`（模板文档区,engine 不扫不播种——一人一文件全包:机件 + persona/biography 行数组）+ 微渲染内嵌于 `opening_commit.mjs`（{{key}} 标量替换 ~15 行,唯一消费者,YAGNI）——数:表单变量×lorebook 查表初值。三源合一生 `runtime/players/<名>.md`——**出生后与模板零持续耦合**,面板此后是纯文档由 LLM 直读直改(runtimeEdit old_str→new_str 逐项精确替换)。此前"模板住 lib 代码"的方案收回。setup/ 仍只播静态件（state.md 种子无变量不配模板/lore 世界观/lorebook）。创角器=t=0 的第 4 条写盘道（先于一切代理回合）；combat.md 瞬态由尾代建删。卡布局:preset/{prompt,scripts,tools,setup(engine 消费)+templates(出生辅助)} + 卡根{assemble.mjs(构建器),docs/(卡内开发档案——devlog_zh.md,engine 不扫)}。

- **opening_commit.mjs 职责记录（2026-09-19 只记不实现——页面改造量大,缓后）**：
  输入=开局表单 JSON（postMessage 桥,argv[0] 单串）：`{name, 出身自述, classId(四选), raceId(九选), backgroundId(六选), 属性生成结果(六数,三法), 技能选择, 起装路线(装备包/掷金)+选项, mates:[{name, 职业四选, 一句话}×0~3]}`；
  五步：①校验（名字/六数/ID 白名单查 lorebook）→②查表算初值（HP₁=骰面+CON、PB、LV1 法环、豁免、技能候选并入、种族速度/暗视/语言/抗性、背景熟练与起装、掷金路线就地掷 RAW 挖式）→③渲染 `templates/players.tpl.md`（微渲染内嵌本脚本,{{key}} 纯替换）→④写盘 `runtime/players/<名>.md`×(1+N),同名覆盖幂等,回执清单返前端→⑤不碰 state.md（setup 播种）与 lorebook（只读）。
  **opening.html 改造清单**：现卡表单仅 姓名/出身/同伴×3——须增：职业四选（选项卡,起装与特征预览）、种族九选、背景六选、属性三法（阵列/购点/4d6,本地掷骰走 runScript）、技能选择（按职业候选）、起装二选一、同伴配置从"姓名+一句话"升格为"姓名+职业+一句话"（同构面板需要职业才能生成初值）。

提交 → opening_commit.sh 面板写全骨架（含按职业带出的法环表/资源池初值）。

**§6.7 游戏化 HUD（2026-09-19 用户愿景入档）**：游戏开始后前端转 RPG 面板形态——左上角头像+HP 条+状态章+同伴小行条、右上角地图区、角落时日/待办旗、战斗期敌人血条 overlay。数据链：players/*.json（固定 schema）→ `scripts/ui_data.mjs`（读 JSON→聚合派生→出一层 JSON 契约）→ `ui/index.js` 自绘 HUD（fixed 定位角件,鼠标按件抢事件,不走 layout.json 面板槽;手簿右栏,书本弹窗已删）。**5e 语义转译**：无 MP——施法者=分环槽条（现/总）、武人=资源池点阵+HD 骰点;状态章=statuses chips（含剩余角标）。`ui_data` 契约基本盘：pc{identity,hp,hd,pools,slots[],statuses[],flags}/mates 简版/party{names,avgLevel}/world{day,hour,place,pending}/combat{round,act,enemies[]};派生量（AC/修正/被动醒觉）ui_data 现算,HUD 零数值逻辑。**两个待决**：①头像=v1 开局上传（writeAsset)+职业圆章兜底,种族默认图库不做;②地图 v1 降格为所在旗（state 玩家所在+面包屑）,真图二期。

**§6.5 规则之书 —— 已删（2026-09-20 用户裁定）**：书本图标按钮、`ui/index.js` 的 mountRulebook()/mdToHtml/CSS 与取文协议 `preset/scripts/rulebook.mjs` 全部移除。**lorebook 数据（`setup/dnd5e-srd-lorebook/`）保留**——它是与模型共享的数据面：模型侧 `{{srd_index()}}` 注入索引、泵 derived 的 AC 装备 join 仍依赖它。原型稿（hud-proto-v6/v7）按「带日期原型不随实现回写」惯例原样保留。

## 7. 风险与开放点

- ⟦?⟧ 未决的四个决策（D1~D4）下游牵动：D1 换案=面板/maintenancePrompt 重写施法节；D2 换案=initiative 工具与 state.md 战斗态降级；D3 换案=开局页工作量；D4 换案=升级流程与 maintenancePrompt。
- 2024 字段兼容：本卡全部走 2014 语料（`docs/dnd5e-srd/2014/`），2024 目录仅参照。
- 大对照：法术/怪物为中文名字卡内汉化——**首版先用英文原文名+中文描述原文直译由 LLM 在场内消化**（INDEX 注入中英混排行省 token 且可查）；后期再出中文译名映射表。
- v3 后尾代理压力点=事实提取与对账+**回执的忠实转录**（漏抄回执=下回合闸读旧值,对账时尾代可自行发现）;风险=回执中继漏传（暴击/已耗位——尾代对账检测）。上线后前几局重点盯 transcript↔面板对账。
```

## 8. 施工清单（下一步按此开工）

1. 建卡骨架目录 `tavern_presets/dnd5e/`（meta/三 prompt/scripts/tools/setup/ui 各就各位，先 fork 现 dnd 卡整体做基座改名）；
2. lore 装配（§2）：卡内 `tavern_presets/dnd5e/assemble.mjs`——结构化字段进 frontmatter + 2014/2024 合并口径 + 分层 INDEX（**已建成**：1164 篇/16 类/5.0MB，含装配 bug 修复复盘）；
3. 工具族落地（§3）：check/attack/cast/damage/initiative/death（主面骰算 6）+gain_exp/gain_money（尾面级联 2,XP 级联与货币规范化内置）+尾代理直接编辑；rest/status_update/trade/advance 消亡史见 tools_zh v7；（stat/skill 解析、adv/dis、濒死/专注/先攻/**施法闸**分支）；advance＋rest（schema `agents: [tail]`）；**引擎小改**：registerCardToolsDir(face) helper（尾面挂载项已撤销）（~15 行）＋runtimeEdit 的 JSON write-guard 已并入工具（落盘前 parse,坏则拒写）；
4. maintenancePrompt 定稿（提事实+文件规范+对账，零规则）；`templates/character.tpl.json`+`templates/combat.tpl.json`+`setup/state.md`（已建）（state 保持 md——主要读者是 DM 摘要,time 两机器行用小正则直取）；setup 只播静态件（state/lore/lorebook——players 由模板渲染出生）；
5. opening.html 扩表单（§6）+ ui/index.js 手簿面板扩 tab（战斗态 tab）；
6. mock-llm 或实跑一轮开局→升级→战斗→长休的闭环冒烟。
```

### 工具归属·2026-09-22 修订：尾面开张，写盘工具进尾
用户拍板（发现主面可调 gain_money/gain_exp 后复盘）：**纯计算器定律不变**（主面四件零写盘、回执制）；**「尾代纯写手零卡工具」（2026-09-19 终律）修订为「尾代=写手面」**——尾面 = `runtime*` 固定件 + **显式声明 `agents:['tail']` 的写盘工具**。首批住户：`gain_money` / `gain_exp`（描述已按约声明更新的文件：`characters/<who>.json`）。主面契约不变：若将来要同类工具，必须零写盘+带 `context` 入参（反作弊铁则），当前无人申请。引擎 face 过滤已实装（`registerMainAgentTools` 主面缺名跳过 / `registerTailAgentTools` 尾面扫描登记，generic 恒归主面 fail-safe；尾代每回合重组合免 mtime 同步）。
