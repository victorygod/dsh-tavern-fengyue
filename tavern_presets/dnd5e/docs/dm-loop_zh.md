# DM 全流程手册（v3 合并版）

> **A 部 = 独立规则文档**：只依据 D&D 5e 三大核心书整理的 DM 运行流程与各环节注意点，不绑定任何项目实现。
> **B 部 = 卡内落地附录**（dnd5e 卡专用）：流程→工具/面板/代理的映射、账环闭环、出处核对——与 A 部规则相互独立，不用卡也可只读 A 部。
>
> **出处体例**：A 部用 **书 → 章（节）**；DMG 数值表附页码（p.82/83/84/274，2014 版）；`[BR p.N]` = Basic Rules v1.0 2018（官方免费 PDF，非 CC，只作校对锚点）。B 部另用 `[SRD·章]`（语料正本，CC 可分发）与 `[卡]`（卡内自造件）。
> **v3 校勘**（2026-09-19，对照 SRD 语料与 BR 抽取文本定谳）：① DC 标尺恢复**六档**（含 Very hard 25，"Medium"）；② 濒死 3 成结果改为**稳定**（非当场回血）；③ 先攻熟练措辞收紧；④ 卖价半价补 BR p.46 原文锚点。
> 凡未给出具体数字处=原著以表列形式给出且印次有差异，引用请对照实体书（唯一留白：DMG p.84 冒险日 XP 数值表，见 §7.2）。

---

# A 部 · 规则层

## 0.0 交互主循环与职责分账（DM↔玩家 · [BR p.5「How to Play」✓ 校对]）

> 三层循环（§0）是游戏内的结构;**这个对话循环是包住它们的元循环**——D&D 的运行形态就是一段结构化对话:

```
1. DM 描述环境 —— 所在何地、周遭有何,给出「选项的基本范围」
   （几个门可出/桌上有什么/酒馆里有谁）[BR: presenting the basic scope of options]
        ↓
2. 玩家声明想做什么 —— 有时一人代表全队（"我们走东门"）,有时各做各的
   （一个搜箱、一个看符文、一个警戒）[BR 原文两式并陈]
   —— 声明的是【意图】,不是机制（"我要砸开这扇门",而非"我做一个力量检定"）
        ↓
   【掷骰打断点】结果不确定且带后果?（§3.1 三前提）
   是 → DM 判定用何检定+定 DC → 玩家掷骰 → 骰值裁决成败
        ↓
3. DM 叙述结果 —— "结果常引出新的决策点" → 回到 1,循环继续
```

探索/社交/战斗三层遭遇都是这个循环在不同规则密度下的形态——战斗只是把第 2 步收紧为"先攻序内的回合经济"（§5）。

### 玩家职责（分层）

| 层面 | 玩家做什么 |
|---|---|
| 常驻 | 声明意图（想干什么、怎么干）· 应 DM 之召掷骰 · **保管自己的人物卡**（HP/位/资源的跟踪者是玩家本人）· 角色扮演人格四件（灵感的授予判据,§7.3） |
| 战斗·自己回合 | 决定移动（可拆）+1 动作+（若有）附赠 · 指定目标 · 宣言特殊选项（非致命/擒抱/预备/躲藏） |
| 战斗·他人回合 | 反应窗口决策（借机/预备释放/特征反应）· **濒死豁免由玩家自己掷** |
| 社交 | 自选扮演/检定/混合（§4.1 注意条:社交是过程不是开关） |
| 成长 | 自己点 ASI/换技能/选法术 · 提议休整的时机 |
| 队伍 | 集体决策:站位/带路/接委托/走哪条支柱 |
| 桌外 | 创角（Part 1）· 长线志愿 |

### DM 职责（对应面）

- **描述环境**（带选项范围——选项给全,选择权在玩家）
- **意图→机制翻译**（把"我要砸门"译成"力量检定 DC15"——DM 最重要的技术活）
- **扮演一切 NPC 与怪**（它们的骰子 DM 掷,可明可暗）
- **叙述结果**、节奏与时间尺度换挡（§2.1）
- **授予** XP/loot/灵感 · **维护世界账**（§7.1 状态机）

### 骰子归属（对偶）

| 骰 | 谁掷 |
|---|---|
| 自己角色的攻检/豁免/检定 | 玩家 |
| 自己的濒死豁免 | 玩家（raw d20,§5.5） |
| 怪与 NPC 的一切骰 | DM（可明可暗） |
| 被动值 | 无人掷——DM 直接对照（§3.2） |

### 两条交互铁律

1. **意图优先**：玩家说意图,DM 找机制——规则是 DM 回答"你试试会发生什么"的工具,不是玩家报检定名的接口;对玩家的提议,DM 的第一回答是"好,你可以试"（DMG 口径:rulings over rules）。
2. **不确定才掷**：叙述可以推进一切,骰子只裁决分歧（§3.1 三前提）;必成/必败/无代价的推进直接叙述。

## 0. 总览：三层循环

```
D0 备桌层（战役/篇章级，跑团外完成）
 └─ 冒险日循环（一个长休周期的游戏内时间）
     ├─ 场景铺设 → 三支柱择路：探索 / 社交 / 战斗
     ├─ 探索遭遇环 ─┐
     ├─ 社交遭遇环 ─┤  均汇入 ↓ 战后结算
     ├─ 战斗遭遇环（回合循环）─┘
     ├─ 战后结算（奖励/XP/时间推进）
     ├─ 休整（短休/长休，资源重置）
     └─ 冒险日之间（生活方式费用/休整活动/成长）→ 回到场景铺设
```

---

## 1. D0 备桌层

### 1.1 世界与篇章
- 做什么：定地点、冲突、主要 NPC 与势力；按 tier 定调（1–4 级地方、5–10 级区域、11–16 级大陆、17–20 级位面）。
- 出处：DMG「A World of Your Own」整章。
- 注意：冒险跨度与队伍等级匹配；开篇冲突要小而具体，世界观留白比设定集式灌输更可用。

### 1.2 冒险结构
- 做什么：为冒险搭结构（线性/分支/开放/连环），布置开局钩子，高潮与回报。
- 出处：DMG「Creating Adventures」→「Elements of a Great Adventure」「Structuring Adventure Sessions」。
- 注意：钩子挂在玩家角色动机上（builtin motivation）比外部悬念有效；每条主线准备 2~3 个可回收伏笔；一个冒险日有明确"完成条件"避免无限膨胀。

### 1.3 遭遇配平（核心数值表①②③）
- 做什么：按队伍等级给每场遭遇定难度、配怪物、算资源消耗。
- 出处与数值（DMG「Creating Adventures」→「Creating Combat Encounters」节）：
  - **表① XP 阈值表（DMG p.82，每角色）**：

| 等级 | Easy | Medium | Hard | Deadly |
|---|---|---|---|---|
| 1 | 25 | 50 | 75 | 100 |
| 2 | 50 | 100 | 150 | 200 |
| 3 | 75 | 150 | 225 | 400 |
| 4 | 125 | 250 | 375 | 500 |
| 5 | 250 | 500 | 750 | 1,100 |
| 6 | 300 | 600 | 900 | 1,400 |
| 7 | 350 | 750 | 1,100 | 1,700 |
| 8 | 450 | 900 | 1,400 | 2,100 |
| 9 | 550 | 1,100 | 1,600 | 2,400 |
| 10 | 600 | 1,200 | 1,900 | 2,800 |
| 11 | 800 | 1,600 | 2,400 | 3,600 |
| 12 | 1,000 | 2,000 | 3,000 | 4,500 |
| 13 | 1,100 | 2,200 | 3,400 | 5,100 |
| 14 | 1,250 | 2,500 | 3,800 | 5,700 |
| 15 | 1,400 | 2,800 | 4,300 | 6,400 |
| 16 | 1,600 | 3,200 | 4,800 | 7,200 |
| 17 | 2,000 | 3,900 | 5,900 | 8,800 |
| 18 | 2,100 | 4,200 | 6,300 | 9,500 |
| 19 | 2,400 | 4,900 | 7,300 | 10,900 |
| 20 | 2,800 | 5,700 | 8,500 | 12,700 |

  - **表② 遭遇乘数（DMG p.82–83）**：按**怪物只数**调的是"有效难度"，不是玩家拿走的 XP。1 只 ×1；2 只 ×1.5；3–6 只 ×2；7–10 只 ×2.5；11–14 只 ×3；15+ 只 ×4。
  - **表③ 冒险日预算（DMG p.84，"The Adventuring Day"）**：标准冒险日 = 6–8 场 Medium/Hard 之间的遭遇（两口短休）。具体每级的"冒险日 XP"数值以原著 p.84 表为准（各印次排版不同，不在此背数）。
- 算法：预算 = Σ(每队员查表①该难度列)；对照值 = 怪物 XP 总和查表②调整；**调整后 XP 与预算比**，不是毛 XP。
- 注意：
  - 队伍 <3 人：难度评估**上移一档**看（medium 按 hard 估）；队伍 >5 人：下移一档（DMG 假定四人队）。
  - CR 只是粗标尺（DMG p.274 定义：四人队"不冒死亡风险能打赢"的近似等级）。行动经济压倒 CR——4 只 CR½ 的行动力常强于 1 只 CR2；地形、光照、埋伏全都位移真实难度。
  - XP 是玩家**拿走**的数量（按挑战各怪的"monster XP"，数量不加乘数）；乘数只用于评估难度。

### 1.4 怪物选配
- 做什么：按生态/阵营/CR 梯度选怪（Devil 与 Demon 是两个阵营，别混编）；类人对手直接用 NPC statblock。
- 出处：MM 正文（statblock 阅读法见 MM 开篇「Reading Monster Statblocks」说明）；MM「Appendix B: Nonplayer Characters」。
- 注意：怪物给它"战场目标"（偷东西跑路/守门/护主），比拼到全灭更难也更活；需要巢穴动作/传奇动作的 boss 只在 MM 对应 statblock 有，别临时发明。

---

## 2. 冒险日循环（day loop）

### 2.1 开日
- 做什么：明示时间/位置/目标；登记队伍线站位（谁警戒谁殿后）。
- 出处：PHB「Adventuring」→「Time」；DMG「Adventure Environments」。
- 注意：时间尺度换挡——**战斗 = 6 秒/轮；地城探索 = 分钟；野外/城镇 = 小时；长途 = 天**（PHB「Time」;[BR p.67✓]："the DM might use a different time scale depending on the context"）。尺度互换是节奏工具，忘了换挡跑团会磨死。

### 2.2 旅行与移动
- 出处：PHB「Adventuring」→「Movement」（Travel Pace 表 / Forced March / travel pace 影响察觉）。
- 数值（PHB）：Slow 2 mph / 18 里/日；Normal 3 mph / 24 里/日；Fast 4 mph / 30 里/日；地城尺度 Slow 200 呎/分、Normal 300 呎/分、Fast 400 呎/分。
- 注意：
  - **强行军**：日行 8 小时后每小时过 CON 检定 DC 10 + 超出时数，失败得一级力竭。
  - **速度与警觉联动**：慢速潜行（可隐匿可侦察）／快速行进被动察觉 −5。
  - 食水：中型生物每日 1 磅食物 + 1 加仑水（炎热天气 2 加仑）——远征冒险这才是主要的资源威胁（PHB「Adventuring」→「Food and Water」）。

### 2.3 三支柱择路
- 出处：PHB 开篇「The Three Pillars of Adventure」（exploration / social interaction / combat）；DMG「Running the Game」→ 各支柱的运行节。
- 注意：走哪根支柱由**玩家行动**决定，不是 DM 预设——玩家想口才过关就别强行开怪；三支柱共享同一套检定体系（见 3.1）。

---

## 3. 探索遭遇环

### 3.1 检定闸
- 出处：PHB「Using Ability Scores」→「Ability Checks」；**DC 标尺（PHB 同节）六档**：

| Task Difficulty | DC |
|---|---|
| Very easy | 5 |
| Easy | 10 |
| Medium | 15 |
| Hard | 20 |
| Very hard | 25 |
| Nearly impossible | 30 |

  （v3 校勘：恢复六档——SRD「Ability Checks」原表与 [BR p.62] 同。）
- 判定三前提：结果**不确定**、**有后果**、非纯推进——满足才掷骰；否则直接叙述。
- 注意：失败不是"什么都没发生"——要"有代价地推进"（位置恶化、时间损失、引入新威胁）；优势/劣势**不叠加**，多来源优劣势互相**抵消**（PHB「Advantage and Disadvantage」）。

### 3.2 陷阱与危险
- 出处：DMG「Adventure Environments」→「Traps」；PHB「Adventuring」相关环境条目。
- 关键机制：被动察觉（10+感知调整值，熟练 +5）作为常备门槛——不用玩家喊"我找陷阱"；主动检定只在有触发条件描述时才掷。
- 注意：陷阱的 DC 结论要连着"失败长什么样"（毒/箭/落石/水位）一起设计；拆障要用 thieves' tools + 熟练项，不是任意敏捷。

### 3.3 物件与拾取
- 出处：DMG「Adventure Environments」→ 物件 AC/HP 段；MM 对物件的伤害裁定注记。
- 注意：物件豁免多为自动失败；给物件 AC/HP 时以材质定（木~石~铁梯度 DMG 有表）。

---

## 4. 社交遭遇环

### 4.1 NPC 塑造与态度
- 出处：DMG「Creating Nonplayer Characters」→ NPC 特征/动机/理想/羁绊与缺陷；态度三档 friendly / indifferent / hostile（[BR p.70「Social Interaction」✓]：Friendly NPCs are predisposed to help you）。
- 机制含义：态度决定交涉起始 DC 位移——friendly 顺势、indifferent 要理由、hostile 要筹码或让步；态度可被行为改变。
- 注意：用 roleplay 包检定，或检定替代 roleplay，**别让一次 Persuasion 直接背诵出结果**——社交是过程不是开关。

### 4.2 交涉技能边界
- 出处：PHB「Using Ability Scores」→ Charisma 节（Deception / Intimidation / Performance / Persuasion）。
- 注意：
  - Deception 有被识破后的对抗后果；口不对心时用。
  - Intimidation 对"豁出去的人/无惧者"无效；威胁兑现会烧桥。
  - Insight（感知）是对面玩家的读心工具，DM 用它裁定 NPC 是否看穿。
- 社交/探索**成就也发 XP**——RAW 中 encounter 不止战斗（DMG「Creating Noncombat Encounters」+ XP 奖励规则）。

### 4.3 经济流
- 出处：PHB「Equipment」→ 货币（cp/sp/ep/gp/pp，10:1 兑换链条）；[BR p.46「Selling Equipment」校对✓]。
- **卖出规则（[BR p.46] 原文归纳）**：未损毁的武器、护甲与一般装备在市场卖出**得半价**（fetch half their cost）；**怪物用过的武器护甲通常成色不足以出售**；**魔法物品卖出困难**（药水/卷轴好出手，其余只有顶层贵族买得起；常见的魔法物品/法术卷轴也难以购入）。
- 注意：跨币找零多步换算是必错点；卖价缺省=半价，特殊品与魔品由 DM 裁。

---

## 5. 战斗遭遇环（回合循环）

### 5.1 开战五步
- 出处：PHB「Combat」→「The Order of Combat」（[BR p.72-73 校对✓]：1 判突袭 → 2 定站位 → 3 全员掷先攻 → 4 按序行动 → 5 新一轮直至战斗停止）。
- 注意：
  - **突袭**：对潜伏方开战时，被突袭者第一回合不能移动/动作、回合结束前不能反应；由 DM 判定谁被突袭（双方都不潜行=互见无突袭）。
  - **先攻** d20+敏捷调整值——2014 版无标准先攻熟练，**仅 Alert 等特征授予加值**（v3 校勘收紧）；**跨轮守序**；同种生物整组一掷；平手 Dex 高者先，再同掷。轮定义=[BR p.73✓]：轮=6 秒+全员各行动一次,序跨轮不变（本卡映射见 B4-①）。
  - 战斗无"逃逸惩罚"规则——敌人溃逃/投降都是合法结束条件。

### 5.2 一个回合的行动经济
- 出处：PHB「Combat」→「Your Turn」「Movement and Position」「Actions in Combat」「Bonus Actions」「Reactions」。
- 预算：**移动（速度值内，可拆分）+ 1 动作 + 1 附赠动作（有授予才能用）+ 1 反应（每轮）**；免费与 1 个环境物件互动；**说话免费**（brief utterances and gestures）。
- 动作清单：Attack / Cast a Spell / Dash / Disengage / Dodge / Help / Hide / Ready / Search / Use an Object——**开放集合**：以上只是"最常见"，职业特性给的动作、以及**即兴动作**都合法；玩家即兴时由 DM 判可行性 + 用什么判定（PHB「Actions in Combat」开篇总条款）。
- 注意：Attack 里可替换**擒抱/推撞**（相对抗检定，目标选防/脱属性）；Ready 自己**自定义触发与响应**；互动第二个物件才要动作。

### 5.3 攻击与伤害结算
- 出处：PHB「Combat」→「Making an Attack」「Damage and Healing」；掩体 PHB「Combat」→「Cover」（[BR p.77✓]）。
- 链条：攻击检定（d20+属性调整+熟练+魔加）vs AC → 命中掷伤害骰 → **暴击**（nat20，伤害骰全翻倍、固定加值不翻）→ 减抗性/易伤（**减半向下取整、加倍是全量**；同源抗易不叠）→ 扣 HP。
- 注意：nat20/nat1 的自动成败**只有攻击检定有**；临时 HP 不叠加取高、不因休息回复；大伤害即时死亡线=剩余伤害 ≥ HP 上限（等效负 HP ≤ −max）。

### 5.4 状态（conditions）
- 出处：PHB 附录「Conditions」逐条（[BR 附录 A✓]）。
- 关键 15 条：Blinded / Charmed / Deafened / Frightened / Grappled / Incapacitated / Invisible / Paralyzed / Petrified / Poisoned / Prone / Restrained / Stunned / Unconscious / Exhaustion（力竭为 6 级累进制，单列）。
- 注意：状态是**精确规则负担**（比如 Prone：近战打它优势、远程打它劣势；起身花一半速度），施加前先读条——别按"名字感觉"裁定。

### 5.5 濒死与死亡
- 出处：PHB「Combat」→「Death Saving Throws」「Instant Death」「Massive Damage」（[BR p.80 校对✓]）。
- 机制：0 HP → 每个自己的回合开始掷**死亡豁免**（无加值 raw d20；≥10 一成、<10 一败；nat20=回 1 HP 苏醒，nat1=记两败）。**三成=伤势稳定**（不是当场回血——稳定者停止掷豁免但保持昏迷，无人医治则 1d4 小时后自然苏醒 1 HP；受新伤害则重开濒死）〔v3 校勘：SRD/BR 原文 "become stable"，勿并作回血〕；三败=死。0 HP 时受到**任何**伤害再 +1 败（暴击来源 +2）；剩余伤害 ≥ HP 上限即死。回血即苏醒且成败计数**双双清零**。
- 注意：稳定伤员要 **Medicine DC10**（动作）或施法；非玩家角色缺省 0 HP 即死（MM 开篇）。

### 5.6 借机攻击与反应
- 出处：PHB「Combat」→「Opportunity Attacks」「Reactions」。
- 机制：敌对生物在**你触及范围内**以移动/动作等方式离开触及时，你用反应打一发近战；Disengage/传送/不离开触及范围不触发。
- 注意：反应每轮 1 次，借机与 Ready 的释放共用同一反应资源。

### 5.7 特殊地形战斗
- 出处：PHB「Combat」→「Underwater Combat」「Mounted Combat」。
- 注意：水下近战不利（除匕首类）+ 火系法术失效+ 冷冻抗性；坐骑共享先攻窗口，骑手与坐骑各自动作受规则限定。

### 5.8 战斗结束
- 出处：PHB「Combat」（战斗停止）；DMG「Running the Game」关于追踪战斗的节。
- 注意：终态（谁死了谁逃了谁缴械）在结场时宣布清楚，这是战后结算的输入。

---

## 6. 战后结算 → 休整 → 冒险日之间

### 6.1 结算
- 做什么：发 XP（逐怪 XP 加总，均分给活着参战的队员）、战利品（DMG treasure tables）、敌我终态、消耗清点。
- 出处：DMG「Creating Adventures」→ encounter rewards 段；MM statblock 的 XP 值。
- 注意：非战斗成就按 XP 发（见 4.2）；XP 阈值升级表（"Beyond 1st Level"，PHB 同名节；[BR p.13 校对✓] 0/300/900/2700/6500/…/355,000）是唯一正典升级路径。

### 6.2 休整
- 出处：PHB「Adventuring」→「Short Rest」「Long Rest」（[BR p.71 校对✓]）。
- **短休**：≥1 小时无剧烈活动；结束时可花生命骰（≤等级数枚，逐枚掷 骰面+CON，掷一次看结果再决定下一枚）回血；次数无上限。
- **长休**：≥8 小时（≥6 小时睡眠+≤2 小时值守）；**HP 全回+已用生命骰回总数一半（≥1）+法术位全回**；24 小时内只受益一次；被剧烈活动（≥1 小时行走/战斗/施法）打断**整个作废重来**；起始 HP 必须 ≥1。
- 注意：法术位/其余长休资源全部"完成长休"恢复——这就是"冒险日"作为资源循环单位的机制含义。

### 6.3 冒险日之间（downtime）
- 出处：DMG「Between Adventures」整章（生活方式费用 / 休整活动 crafting、training、research、recuperating），以及 PHB「Between Adventures」同名节。
- 注意：生活方式档位（贫苦/modest/富裕等）影响 NPC 反应与信息获取；休整活动按"天"计数，跨日结算，别在冒险日中段塞入。

### 6.4 成长
- 出处：PHB「Beyond 1st Level」（升级流程）；各职业表「Ability Score Improvement」条。
- 机制：XP 触发升级 → 职业表拿新特性 → **ASI**（4/8/12/16/19 级等，以各职业表为准；战士/盗贼更多）——单属性 +2 或双属性各 +1，上限 20（或换 feat，若启用专长）。
- 注意：升级时机是桌规（长休后/冒险结算时都常见），RAW 缺省获得足够 XP 即可；HP 每级 +1 骰（或均值）+CON 是必选项。

### 6.5 长线状态
- 做什么：更新主线/支线/伏笔/关系网，落账到下次开局的钩子。
- 出处：DMG「Creating Adventures」（结构与回收）+「Creating Nonplayer Characters」（关系网）。
- 注意：每个分支结尾至少回收一个已公开伏笔；开场新钩子应该接住上一场戏的情绪。

---

## 7. 验证（规则层）

### 7.1 闭环性（状态机完备）
| 状态 | 唯一/主要写手环节 | 读手 |
|---|---|---|
| HP/生命骰/法术位/资源池 | 5.3 伤害与治疗、5.5 濒死、6.2 休整 | 5.2~5.5、6.2 |
| 力竭 | 2.2 强行军、6.2 长休（饮食前置） | 2.x、3.x 检定劣势 |
| 游戏内时间 | 2.1 开日、2.2 旅行、5.x 战斗轮、6.2/6.3 休整 | 6.2 铁轨校验、6.3 休整活动 |
| 先攻/轮序/敌体 | 5.1 建立、5.2~5.4 更新、5.8 清场 | 5.x 全程 |
| XP/等级/ASI | 6.1 发放、6.4 结算 | 1.3 配平、6.4 |
| 钱包/物品 | 3.3 拾取、4.3 交易、6.1 战利品 | 6.3 生活方式 |
| 剧情进度/NPC 态度/伏笔 | 4.x 社交、6.5 长线回收 | 1.2 钩子、下一局 |

出口闭合：战斗停止→6.1；探索/社交结束→回 2.x 下一场景；长休完成→资源全重置→新冒险日；篇章终局→回 D0 换篇。**默认闭环成立**。

### 7.2 对应性与正确性
- 数值表出处：XP 阈值（DMG p.82）、遭遇乘数（p.82–83）、冒险日 6–8 场（p.84）、CR 定义（p.274）、DC 标尺/旅行速度/食水/强行军（PHB「Adventuring」）、死亡豁免/暴击/半伤取整（PHB「Combat」）、休整三铁轨（PHB「Resting」）。
- **冒险日 XP 数值表（p.84）有意未背数**：二手转述互相矛盾，为保正确性只引用表存在与"6–8 场 Medium/Hard"的机制结论——本手册唯一"留白引用"。
- 校对锚点（[BR]）：DC 六档 p.59 / 战斗五步 p.72-73 / 攻伤 p.74-77 / 濒死 p.80 / 休整 p.71 / 卖价 p.46 / 灵感 p.61 / XP 阈值 p.13。

### 7.3 灵感（专条：SRD 缺章声明）
SRD 5.1 无灵感规则章（仅「Advantage and Disadvantage」一句顺带提及）；**PHB/BR p.61 有完整规则**：DM 按"人格四件（性格/理想/羁绊/缺陷）的真实扮演"授予；消耗=一次攻击/检定/豁免获得优势。采用与否属桌规——采用时授予时机由 DM 自定。

### 7.5 BR 逐条校验证据（2026-09-19，pypdf 全文抽取后逐项取证——28 项全命中）

| 环节 | BR 证据（原文短引） | 页 |
|---|---|---|
| 战斗五步 | "1. Determine surprise … 2. Establish positions … 3. Roll initiative … 4. Take turns … 5. Begin the next round" | 73 |
| 突袭禁动 | "surprised, you can't move or take an action on your first turn … can't take a reaction until that turn ends" | 73 |
| 先攻敏检/组掷 | "makes a Dexterity check … one roll for an entire group of identical creatures" | 73 |
| 先攻平手 | "If a tie occurs, the DM decides the order among tied DM-controlled creatures…" | 73 |
| 回合预算 | "you can move a distance up to your speed and take one action" | 73 |
| 免费互动 | "interact with one object or feature of the environment for free" | 74 |
| 动作清单 | Attack…Use an Object 十动作（"Use an Object"正文独立成节） | 74-76 |
| 即兴动作 | "Improvising an Action: Your character can do things not covered by the actions in this chapter" | 76 |
| Ready 自定义触发 | "trigger your reaction. Then, you choose the action you will take in response to that trigger" | 76 |
| 借机 | "moves out of your reach … use your reaction to make one melee attack" | 77 |
| nat20/nat1 攻检 | "roll for an attack is a 20 … regardless of any modifiers or the target's AC" | 77 |
| 暴击翻骰 | "damage dice twice and add them together. Then add any relevant modifiers as normal" | 79 |
| 抗性/易伤 | "resistance … halved against it … vulnerability … doubled" | 79 |
| 濒死 | "Whenever you start your turn with 0 hit points … Roll a d20. If the roll is 10 or higher, you succeed" | 80 |
| 0HP 受击/暴击双败 | "suffer a death saving throw failure. If the damage is from a critical hit, you suffer two failures" | 80 |
| 即死线 | "equals or exceeds your hit point maximum, you suffer instant death" | 80 |
| 急救 | "DC 10 Wisdom (Medicine) check. A stable creature doesn't make death saving throws" | 80 |
| 短休花 HD | "spend one or more Hit Dice at the end of a short rest, up to … the character's level" | 71 |
| 长休 HD 回半 | "regains spent Hit Dice, up to … half of the character's total number of them (minimum of one die)" | 71 |
| 24h 一次/起始≥1HP | "one long rest in a 24-hour period, and a character must have at least 1 hit point at the start" | 71 |
| 时间尺度 | "about 6 seconds in the game world" | 73 |
| 强行军 | "Forced March … for each additional hour…"(CON DC10+) | 67 |
| 食水 | "pound of food per day … half rations" | 70 |
| 被动检定 | "A passive check … doesn't involve any die rolls" | 63 |
| 掩体 | "Half cover … +2 … three-quarters cover +5" | 78 |
| 力竭六档 | "1 Disadvantage on ability checks, 2 Speed halved, 3 Disadvantage on attack rolls…" | 173 |
| 水下/骑乘/擒抱 | Underwater Combat / Mounted Combat / "grapple … no more than one size larger" | 81/81/78 |
| 卖价半价 | "fetch half their cost when sold … monsters … rarely in good enough condition … Selling magic items is problematic" | 46 |
| 灵感授予/消耗 | "reward you for playing … true to his or her personality trait, ideal, bond, and flaw" / "expend it when you make an attack roll, saving throw, or ability check" | 37-38 |
| 态度三档 | "Friendly NPCs are predisposed to help you, and hostile ones are inclined to get in your way"（「Social Interaction」节） | 70 |
| XP 阈值表 | "0/300/900/2700/6500/14000/…/355,000"（逐值） | 13 |

**校验结论**：A 部全部机制环节均有 BR 原文证据；零处矛盾。BR 不含者（DMG 专属层：遭遇配平三表/冒险日预算/冒险结构与场景教学/世界构建）在手册中已按出处声明引用。取证后修正的手册错误=§7 头部 v3 校勘四处。

### 7.4 适用边界
- 本手册以 2014 版（5e）为准；2024 修订版的遭遇配平方法与专长位置有实质变化，混用前需整套重核。
- A 部与任何具体实现无关；卡内落地见 B 部。

---

# B 部 · 卡内落地附录（dnd5e 卡专用，`[卡]` 件）

> 与 A 部的映射关系：A 部规则 → 本卡的计算器/面板/代理分工。规则争议以 A 部与 SRD 语料为准。

## B1 · 流程→落点映射总表

| A 部流程件 | 本卡落点 |
|---|---|
| 3.1 检定闸 | roll（stat+skill 引用解析；mode=adv/dis） |
| 5.1 步3 先攻 | roll 先攻分支（一次全团，同种怪一掷）→回执→尾代誊 combat.order |
| 5.3 攻伤链 | roll 攻检→回执 nat20 提示→roll 伤害（crit:true 中继；halve/double）→尾代落敌 hp |
| 5.5 濒死 | roll 濒死分支（raw d20+新计数回执）→尾代落 player |
| 5.x 施法 | roll 施法参数族（spell/as_level/caster 三检+回执建议余量）；扣位尾代照回执落 |
| 4.3 经济流 | trade（买=查价合计+10:1 找零；**卖缺省半价 [BR p.46]**）→回执→尾代落钱包+gear |
| 6.1 结算 | advance（gain 查怪 XP→均分→阈值常量[BR p.13 校对✓]→升级块→pending 标记写入回执） |
| 6.4 ASI/新法术点选 | **🖥前端决策件**（B5 通道）:玩家在前端分配→front_commit 机械落盘→LLM 下一回合注入只见结果 |
| 6.2 休整 | rest（kind/hd_spent/food_water；三铁轨校验）→回执→尾代落全员 |
| 2.1 时间 | 尾代推进 state time_*（粒度 ⟦讨论⟧） |
| 5.8→6.1 战斗结束 | 尾代归档：宿敌终态回写 character→战斗节清回「（无战斗）」→state 队伍更新 |
| 3.2 陷阱 / 4.x 社交 / 6.3 downtime | 无工具——agent 直做+尾代落账（"无二期"律） |

## B2 · 账环闭环矩阵（十一环）

| 账环 | 起点 | 写者 | 闭环条件 | 孤儿风险与防线 |
|---|---|---|---|---|
| HP | 伤害/治疗正文 | 尾代（roll 回执+正文） | 死亡归档或长休回满 | 漏抄→摘要可见+尾代对账 |
| 施法位 | roll 闸回执 | 尾代 | 长休回满 | 中继漏传→对账 nat 提示 |
| 专注 | roll 施法 | 尾代 | 结束/破碎/长休 | — |
| 濒死 | HP=0 | roll 回执→尾代 | 稳定/死亡/回血（清零） | — |
| 战斗 | 敌现身 | 尾代建档/维护 | 归档+**删除** | 忘删→泵仍显示→checklist 必检 |
| 经验 | 击败/成就 | advance 回执→尾代 | 升级块应用+pending 清 | 漏调→怪 XP 对账报警 |
| 钱包 | trade 回执 | 尾代 | — | — |
| 时间 | 正文推进 | 尾代 | — | rest 铁轨消费 time——漏推失准，checklist 必检 |
| 状态 | 施加正文 | 尾代 | remaining→0 删行 | — |
| 实体 | 登场 | 尾代建档（tpl） | 归档或长存 | — |
| 灵感 | DM 授予（扮演判据） | roll 回执→尾代 | 消耗或长休 | — |

两个跨环依赖（rest↔time、advance↔combat 归档）进尾代 checklist 硬性必检。

## B3 · 落地一致性核对

| 规则件 | SRD 语料 | 本卡实现 | 一致性 |
|---|---|---|---|
| 战斗五步/突袭/先攻 | order-of-combat ✓ | roll 先攻+state.md 战斗节 | ✅ |
| 攻伤/暴击/抗性 | making-an-attack 等 ✓ | roll crit/halve/double | ✅ |
| 濒死/稳定/即死 | damage-and-healing ✓ | roll 濒死分支 | ✅ |
| 施法/专注/仪式 | casting-a-spell ✓ | roll 施法参数族 | ✅ |
| DC 六档/被动 | ability-checks ✓ | roll+派生被动 | ✅（[BR p.62/63]） |
| 休整三铁轨 | resting ✓ | rest 校验 | ✅ |
| 卖价半价 | ❌语料无 | trade 缺省半价（BR p.46 口径） | ⚠BR 锚 |
| 灵感 | ❌（一句顺带） | 房规采纳（§7.3） | ⚠声明 |
| XP 阈值 | ❌ | advance 常量 | ⚠载体声明 |
| 冒险日/预算 | ❌ | systemPrompt 点睛（DMG 口径） | ⚠口径 |

## B5 · 前端决策通道（front_commit · 2026-09-19 流程 review 产物）

**原则**：流程中存在一类**纯玩家选择、零 LLM 判断**的可选点（ASI 属性分配、施法者升级学新法术）——它们不该走「玩家打字→LLM 转述→工具」的二传手链（LLM 参与只会引入转述错误与 token 浪费），而应**前端点选 → 机械写道落盘 → LLM 下一回合注入只读结果**。

**机制**：
- `preset/scripts/front_commit.mjs`——opening_commit 的 t=0 出生例外**泛化**为「前端机械写道」:输入=前端表单 JSON（op: `asi`|`spells`），校验（对照面板 pending 标记的白名单:能否加/上限 20/是否本级已用）→窄写对应字段→清 pending→回执给前端。
- **与写权律的关系**：写手仍二元——尾代（叙事事实）+front_commit（前端机械决策），二者都是**无判断的落盘**;LLM 保持零写手不变。write-guard 照拦。
- **LLM 视角**：不参与分配;下一回合 postPrompt 注入的面板已是新值,pending 已清,DM 只需叙事确认（"你的磨练化成了力量"）。
- **范围修正（随 B4-② 定案）**：front_commit **仅服务玩家自己的 PC**——同伴的成长由 DM 叙事宣告（独立人格）→尾代照正文落账,不经前端点选。

## B4 · 已定案记录（原悬点四项,2026-09-19 全部闭合）

**① round 语义**（[BR p.73✓]："A round represents about 6 seconds… Once everyone has taken a turn, the fight continues to the next round… initiative order remains the same from round to round"——轮=全员各行动一次,序跨轮守序）：
- **本卡映射：一条玩家消息 = 一轮**——DM 单次回复内按先攻序推演完所有单位（PC 行动由玩家消息声明,同伴/敌人由 DM 独立人格推演）;默认不跨消息悬轮。
- **round 推进 = 正文驱动→尾代 +1**（DM 轮末叙述/宣告,尾代机械进位——判定权在叙事,簿记在尾代）。
- `combat.act_index` 仅作**断点记录**（例外态:DM 主动断在决策点如"轮中谈判",下回合从断点续演;默认零）。

**② 同伴操纵权**（用户拍板）：
- **玩家只控自己的角色**（输入框只声明 PC 意图）;**同伴与一切 NPC = 独立人格,由 DM（LLM）全权推演**——战斗回合行动、对话立场、行为取舍。
- 骰子归属天然一致:同伴的骰也是 DM 掷（roll `who`=同伴,既有律）。
- **连带修正 B5**：同伴的成长不走前端点选——同伴 ASI/新法术 = **DM 叙事宣告→尾代照正文落账**（叙事事实写道）;`front_commit` 仅服务玩家自己的 PC。

**③ 时间粒度**（[BR p.67「Time」✓]："the DM might use a different time scale depending on the context… In a dungeon environment… a scale of minutes"——DM 按情境换时标:战斗=轮(6s)/地城=分钟/城镇野外=小时/长途=天）：
- **本卡定案：`state.time = {day, hour}` 两粒度**——rest 三铁轨（1h 短休/8h 长休/24h 限）原生 hour 精度,长途由 day 承载。
- **轮与分钟 = 场景局部量,不进持久时标**：战斗轮计数住 state.md 战斗节「回合」行,战末折叠（round×6s 通常 <1h 不动 hour,跨时进位）;地城探索的分钟由尾代按正文摘要折算进位（"探索约一小时"→+1h）。
- 换挡纪律（§2.1）不变——时标切换是叙事动作,折算进位是尾代簿记。

**④ 同伴濒死掷骰**：随②闭合——DM 统一掷（roll 濒死分支 who=同伴）,玩家无骰。
## B5 · 前端决策通道（front_commit · 2026-09-19 流程 review 产物）

**原则**：流程中存在一类**纯玩家选择、零 LLM 判断**的可选点（ASI 属性分配、施法者升级学新法术）——它们不该走「玩家打字→LLM 转述→工具」的二传手链（LLM 参与只会引入转述错误与 token 浪费），而应**前端点选 → 机械写道落盘 → LLM 下一回合注入只读结果**。

**机制**：
- `preset/scripts/front_commit.mjs`——opening_commit 的 t=0 出生例外**泛化**为「前端机械写道」:输入=前端表单 JSON（op: `asi`|`spells`），校验（对照面板 pending 标记的白名单:能否加/上限 20/是否本级已用）→窄写对应字段→清 pending→回执给前端。
- **与写权律的关系**：写手仍二元——尾代（叙事事实）+front_commit（前端机械决策），二者都是**无判断的落盘**;LLM 保持零写手不变。write-guard 照拦。
- **LLM 视角**：不参与分配;下一回合 postPrompt 注入的面板已是新值,pending 已清,DM 只需叙事确认（"你的磨练化成了力量"）。
- **范围修正（随 B4-② 定案）**：front_commit **仅服务玩家自己的 PC**——同伴的成长由 DM 叙事宣告（独立人格）→尾代照正文落账,不经前端点选。

## B4 · 待拍板悬点（⟦讨论⟧）

1. combat.round 推进语义：DM 正文宣告"新一轮"→尾代 +1？还是尾代按行动循环自判？
2. 同伴回合操纵权：DM 全权推演？玩家也给同伴指令？
3. 时间粒度：state.time 以小时为主？战斗轮 6 秒如何折算累计？
4. 同伴濒死掷骰：DM 统一掷？
