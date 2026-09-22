# 面板数据结构与可变中间变量（v1 · 2026-09-19）

定案文档：[design_zh.md](design_zh.md)（架构）/ [tools_zh.md](tools_zh.md)（工具）/ 本篇（**数据结构 + 中间变量 + SRD 流程脉络**）。前端准则见 [ui_zh.md](ui_zh.md)。

## 一 · 面板数据结构（存储正本）

Schema 正本 = `preset/templates/character.tpl.json`（依 SRD 构造，人物全员统一）+ `combat.tpl.json` + `setup/state.md` 种子。此处不重抄字段，只立**存储分区总览**：

| 分区 | 文件 | 格式 | 主要读者 | 内容域 |
|---|---|---|---|---|
| 人物 | `characters/player.json`（固定名）/ `<名>.json` | JSON | roll/trade/ui_data/尾代/前端 | 机件（六维/hp/熟练/施法位/资源池/装备引用/钱包）+ 叙事（persona/biography 行数组） |
| 战斗 | `state.md`「## 战斗」节（combat.json 已废 2026-09-20） | md 行 | roll/尾代/前端/attack·cast 工具 | `- 回合：N`/`- 先攻：名:值 > …`/`- 敌行：名 | HP 现值/上限 | AC n | path:… | 状态`/`- 友行：` 同语法——解析归 core.parseCombat |
| 世界 | `state.md` | md | 尾代/泵/DM | frontmatter time_* + 六节（篇章/主线/支线/伏笔/所在/时间）+ 队伍 + 近期人物 |
| 规则 | `dnd5e-srd-lorebook/` | md | runtimeRead/工具 join（书本 UI 已删） | 静态只读（1164 篇） |

## 二 · 可变中间变量（值的四种居所）

**关键认知**：值不一定都住在面板里。按生命周期分四种居所——存储（面板文件）、回执（工具返回文本，transcript 承载，回合内）、派生（读方现算，永不存储）、参数中继（DM 下一次工具调用的入参）。

| 变量 | 居所 | 写者/更新时机 | 读者 |
|---|---|---|---|
| `hp / hp_max / temp_hp` | **存储** player | 尾代每回合照正文数字落账 | 全体 |
| `death_success / death_fail`（v8.1 起字段已删） | **参数中继 + transcript** | death 工具入参:DM 传当前计数,回执给判定;濒死序列由 transcript 承载,零落盘 | death 结算、DM 口头中继 |
| `exhaustion` | **存储** player | 尾代（长休−1 须 rest 铁轨校验） | roll（力竭劣势）、前端 |
| `slots_l1…l9`（现量） | **存储** player | roll 施法闸回执建议 → 尾代落 | roll 闸、前端位条 |
| `inspiration` | **存储** player | roll 回执建议 → 尾代落 | roll（花灵感=优势）、前端💡 |
| `inspiration`（v9 机制已删） | —— | 灵感=玩家扮演奖励,归 DM 叙事,无面板落点 | —— |
| `concentrating`（键随施法族,裁剪律二·B） | **存储** player | 尾代（施法写入/受伤 roll 专注失败清空） | roll 专注冲突检、前端 |
| `hd_available` | **存储** player | rest 回执 → 尾代落 | rest、前端 |
| `gp/sp/cp` | **存储** player | trade 回执 → 尾代落 | trade、前端钱袋 |
| `pending[]`（如 ASI 待选） | **存储** player（键随成长族,裁剪律二·B） | gain_exp 级联写入 → 玩家前端点选 → 尾代清 | 前端待办旗、DM 宣告 |
| `statuses[].remaining` | **存储** player.statuses | 尾代按**其声明单位**递减（见下单位律），到 0 删行 | roll（effect 计入）、前端 chips |
| 敌人 `hp` / 状态 | **存储** combat.enemies 行 | 尾代照正文落账；战末归档回写 character 文件 | roll（目标 AC）、前端敌卡 |
| `round / act_index / order[]` | **存储** combat | 尾代转录（initiative 回执建序；每轮 round+1 由正文宣告驱动——B4-① 已定案） | roll、前端 |
| `exp / level` | **存储** player | gain_exp 回执 → 落账（键随成长族,裁剪律二·B） | gain_exp、前端经验 |
| `当前时间`（时间敏感项首行） | **存储** state.md 登记表 | 尾代按正文推进（轮/分折算进小时） | 休整 24h 铁轨、前端时日 |
| **crit 待结标记** | **回执中继**（攻击 nat20 回执自提示） | DM 下一次伤害结算传 `crit:true`——不存储 | roll 结算分支 |
| **已耗位累计** | **回执中继**（budget_offset 参数） | DM 参照上文回执传参——不存储 | roll 施法闸 |
| AC / 修正值 / 位表总量 / hpPct / 被动醒觉 | **派生**（泵或工具现算） | 读时算，永不存储 | 前端/roll |

**时间单位律（2026-09-19，对照 SRD Time/Duration + BR p.67,73,80）**：
- 四单位语义：**轮**=6 秒（全员各行动一次）；**回合**=轮中一个参战者的行动窗；**时标**（分/时/天）=DM 按情境换挡的世界时钟；**duration**=效果存续期（轮/分/时/年/Until dispelled）。
- **`statuses.remaining` 必须带单位**（"2轮"/"10分钟"/"1小时"/"1日"/"场景"），**按其单位对应的时钟递减**：轮→combat.round 每轮推进时 −1；分/时→state.time 进位按真实流逝折算 −1；日→time_day −1；场景→地点切换清除。
- Instantaneous 不进 statuses（瞬时已完）；Concentration 走 concentrating 字段（独立机制）；回合锚定效果（"直到你的下回合结束"）罕见——DM 叙事裁定，不进 statuses。
- **推进协议（2026-09-19 补全）**：主代理只**声明流逝**（三种形态：战斗轮自然推进/场景内流逝量"搜索了一下午"/跨场景目的地"三天后"）——**不枚举到期清单**（机械结算非其职责）；尾代理**先读后写**：state.md 旧时间→写新时间→Δt 按单位折算→statuses 递减/删 0/变化日志记"XX 到期 | 时间流逝"。流逝陈述须"可结算"（明确量或明确目的地），含糊时尾代按叙事合理取值并在变化日志注明折算。
- **时间推移检查清单（2026-09-19 总集，逐项有 SRD/BR 出处）**——按流逝时钟分档：
  - **每轮**（combat.round）：轮单位 statuses −1；怪 per-round 特性（lorebook 查）；
  - **每小时**（time_hour）：分/时单位 statuses 折算 −1；强行军（日行军>8h 部分，每小时 CON DC10+超出时数，失败力竭+1 [BR p.67]）；短休窗口（正文声明→HD 掷骰走 damage）；
  - **每日**（time_day）：日单位 statuses −1；**绝食**（无食超 3+CON 天→每日末自动力竭+1 [BR p.70]）；**缺水**（减半→每日 CON DC15 失败力竭+1；更少自动 +1 [BR p.70]）；生活方式日费（驻留城镇，gain_money）；downtime 进度（+1 天）；**法师奥法回复 1/日重置**；疾病/长效毒按条目时间轴（sewer plague 1d4 天发作类）；长休窗口（声明+last_long_rest≥24h→落账细则）；冒险日预算重置（长休完成）；
  - **通用扫尾**：statuses 全表按单位折算；"场景"单位地点切换清除；pending 未决提示。
  - 主代理侧（非转录清单）：强行军/疾病/HD 掷骰（check/damage）；流逝声明可结算；旅行遭遇机会（DMG 口径叙事裁量）。
- **「时间敏感项」登记表（2026-09-19 落 state.md）**：清单的活实例——队伍/世界级时间账（绝食/缺水计数、生活方式、downtime、奥法回复日旗、长休窗口、疾病进程、冒险日预算消耗）；角色 buff 类不进登记表（在各 character statuses，避免双真值）。尾代=逐项结算者，主代理=照表叙事（紧迫感：断粮第几天/能否长休）。
- **状态到期不是玩家决策点**——机械事件直接落账（HUD 可见）；是否叙述到期=DM 叙事裁量。玩家决策点只有既有机制类（ASI 前端点选/休整提议/HD 花费对话声明）。
- 依据：语料 319 法术时长实测分布（瞬时 87/1分钟 61/10分钟 30/1小时 26/8h 15/24h 12/1轮 9/10天 5）——时长是跨战斗内外的真实机械轴，单单位递减必错。

**铁律重申**：一值一居所——存储值不进回执重复长期化，回执不落盘只转录，派生永不落盘。

## 二·B · 人物三面模型（2026-09-19 定案：玩家=peer）

**视角**：玩家是世界的 peer——A 面机制键全员同表、同规则链（check/cast/gain_exp 按 `characters/<who>.json` 解析，不问亲疏）；NPC/同伴的差异只在**填充深度**与 B 面落盘（玩家侧的推演内容在玩家脑内——不落盘不是缺，是设计）。

| 面 | 覆盖 | 归宿/定案 |
|---|---|---|
| **A 生存成长**（peer 统一） | 等级线/体质线/防护线/熟练线/施法线/资产线 | 全员同 schema 同规则链；**键能力裁剪律**：『没有什么能力，就没有相关字段』，对所有角色（玩家同律）——能力族见下 |
| **B 推演**（NPC/同伴落盘，玩家自带脑内） | persona 五件 / biography / 活状态（statuses·exhaustion·concentrating） / 位置 | **biography 双职能：出生段=背景，运行时追加行=记忆**——不设 memory 键（避免双真值）；位置不落盘（state.md 附近名单路由）；**秘密=biography 行「[秘]」前缀**（永不主动叙述，揭示后去前缀归一般行） |
| **C 交互**（工具链已跨 who） | gear/weapons/三币/languages/技能对抗/施法对冲 | 无新增键 |

**键能力裁剪律（2026-09-19 定案，取代两档制；对所有角色含玩家）**——字段存在性跟随能力：无某能力/机制参与 → 对应键族**整族不出生**（不留 0/空壳）：

| 能力/参与 | 键族 | 无此能力时 |
|---|---|---|
| 施法 | caster_attr / spells_known / spells_prepared / slots_l1…l9 / concentrating | 整族不出生；cast 读缺席键=结构化报错「无施法能力」 |
| 成长机制 | exp / pending / hd_available | 不出生；gain_exp 同理 |
| 职业特征 | features（池类特征行内标回充时机与已用） | 无职业者不出生 |
| 训练参与 | save_prof / skill_prof / expertise / armor_prof / weapon_prof / tool_prof | 不出生，检定/对抗按裸属性解析 |

- **已整机制删除（非裁剪，与能力无关）**：inspiration（灵感=扮演奖励归 DM 叙事）/ resources（并入 features 行内池状态）/ origin / death_success·fail（濒死=参数中继+transcript）。
- **核心键永不裁**：身份（class/level/race/background/subclass）/ 六维 / hp 族 / 防护（armor·shield·speed·darkvision·resist·immune）/ 资产三币 / gear / weapons / persona / biography / statuses·exhaustion·temp_hp / languages。
- 叙事示例：战士玩家天生无施法族，酒馆掌柜无训练面——与场景 NPC 同律（这正是『玩家=peer』的字段表达）；剧情需要时补族，schema 始终一份。
- 工具侧：读缺席键=结构化报错（tools 一·可选键律），不得 NaN 崩读。

## 三 · 更新时序（一回合的生命周期 · 2026-09-19 用户修正定案）

**分工终律（v7/v9 口径）：主面=六件骰算计算器（叙事段,context 必填）；尾面=直接编辑+两条级联工具（gain_exp/gain_money）。**工具回执（含执行后的值）本就在上下文里,尾代照实转录:

```
回合 N
  主代理·叙事段: 读注入分组面板 → 推演
        → 按需调 check/attack/cast/damage/initiative/death(context 必填——回执=叙事素材,数字织进正文)
        → 正文(数字明确+末行自演算小结;经验/金钱/物品/状态/休整=叙事陈述,不经工具)
  回尾闸门
  转录任务: 从上下文(transcript:工具回执+正文)提取事实 → 照实落账面板
        → gain_exp/gain_money(级联) + runtimeEdit 直接编辑(old_str→new_str;write-guard 由工具内置——.json 落盘前整档 parse,坏则拒写)
        → statuses 按单位递减 / 新实体建档 / combat 维护 / round 推进(正文宣告驱动)

  泵: rev 四节心跳 → 前端节级重绘
回合 N+1: 注入已是新值
```

## 四 · SRD 流程脉络（2026-09-19 修正:诚实版——语料核对后重写）

### 4.0 先认账:书结构、SRD 裁剪、语料缺口

**5e 三大件**:PHB(玩家规则:检定/冒险/战斗三章) · DMG(DM 手艺:冒险→章→场景→遭遇组织法、节奏与遭遇构建、奖励) · MM(怪)。**SRD 5.1 = 三书的 OGC 裁剪本**——DMG 只裁进散件(陷阱/疾病/疯狂/毒/造物/神系/位面),**节奏教学未进 OGC**。

**语料缺口(grep 核对,2026-09-19)**:

| 内容 | 语料? | 出处与我们的去处 |
|---|---|---|
| 冒险日节奏(6~8 场+两短休) | ❌ | DMG·创造遭遇章 → systemPrompt 点睛(声明"DMG 口径非 SRD") |
| 灵感规则(授予/消耗) | ❌(仅优劣势章一句顺带提及) | PHB → **房规采纳声明**(panel 字段+roll 参数保留,systemPrompt 记一句"SRD 无此章,按 PHB 惯例自定授予时机") |
| XP 升级阈值表 | ❌ | advance.mjs 内置常量(唯一载体,既定设计) |
| 遭遇预算(CR×XP×系数) | ❌ | DMG → DM 心算口径( encounter 工具已撤;数字源=联网核验非语料) |

### 4.1 战斗=章节簇,不是单章

轮循环(下 4.2)之外,rules/ 另有八个**条件触发的查表分支章**:掩体 · 骑乘 · 水下 · 移动与位置(借机所在) · 环境(视野/光照/食物) · 物件 · 陷阱 · 疾病/疯狂/毒——流程中进入相应情境才查,不是每场必走的步骤。

### 4.2 战斗轮循环(语料原文,完整)
1. **定突袭**(order-of-combat):无潜行互见;有则 Stealth 检定 vs 被动醒觉
2. **定位置**:GM 摆位
3. **掷先攻**:`d20+DEX`;同种怪**整组一掷**;平手 GM 裁
4. **轮流行动**:移动(可拆)+1 动作+≤1 附赠(须特征)+≤1 反应(非己回合);自由互动物件×1
5. **下一轮**:round+1 至一方败

### 4.3 攻击伤害链(making-an-attack / damage-and-healing)
攻检 d20+修正 vs AC(优/劣 2d20 取高低;nat20 必中+暴击)→伤害 骰式+修正(暴击骰全翻倍)→应用(抗性减半↓/易伤加倍/免疫零)→0HP→濒死(raw d20 每己回合;3 成稳定/3 败死;nat20 回 1HP;nat1 双败;再受伤自动败、暴击源双败;回血醒+双清零;即死=余量≥hp_max;杂兵即死 GM 缺省)。

### 4.4 施法/检定链(casting-a-spell / ability-checks / saving-throws)
施法:位可用→组件→施放→专注唯一(受伤=CON DC max(10,伤半);仪式+10min 免位)。检定:DM 设 DC 标尺→d20+属性(+熟练);被动=10+修正(伏击判据)。

### 4.5 书中教学的一场游戏结构(示例骨架,结构为重点)

```
冒险 Adventure(一本模块)
 └ 章 Chapter(一个地区)
    └ 场景 Scene(进入一室/一段对话)
       └ 遭遇 Encounter —— 三型:战斗/社交/探索
          ├ 战斗五步(4.2) 逐轮:掷先攻→序→各回合(移动+动作+附赠)…
          ├ 社交: 态度+检定→改剧情旗
          └ 探索: 察觉→调查→解除(链式检定)
       └ 奖励: XP(参战均分)/loot → 短休或推进
```

### 4.6 冒险日节奏(口径声明:DMG 非 SRD)
长休之间的冒险日=6~8 场中/难+两口短休,榨 HP/HD/位至近竭——5e 职业平衡的隐含前提。我们 PC+同伴=四人队数学原生适用;落位=systemPrompt 点睛。
## 五 · agent 流程映射草案（⟦讨论⟧ 待议——本节是讨论稿非定案）

| SRD 流程步 | 我们的落点 | 悬点 |
|---|---|---|
| 4.1 冒险日 | DM 叙事推进+rest/advance 罐头；state.time 由尾代推进 | 时间粒度：小时？战斗轮折算？ |
| 4.2-1 突袭 | DM 判断 → roll（敌方 Stealth vs 面板被动醒觉） | 被突袭者跳过首回合=DM 纪律 |
| 4.2-3 先攻 | roll 先攻分支（一次全团；同种怪一掷）→ 回执序列 → 尾代誊 combat.order | ⟦讨论⟧ round 推进：DM 正文宣告"新一轮"→尾代+1？还是尾代按 act_index 循环自判？ |
| 4.3 玩家回合 | 玩家输入驱动（策略→DM 叙事）；NPC/同伴回合=DM 推演 | 同伴是 DM 操还是玩家指挥？⟦讨论⟧ |
| 4.4 攻击链 | roll 攻检（mode 按优劣势判断）→回执→roll 伤害（crit 中继）→尾代落敌 hp | 链式两调用=DM 两次工具调用，transcript 可对账 |
| 4.5 濒死 | roll 濒死分支每轮（PC）；杂兵即死由 DM 直叙 | ⟦讨论⟧ 同伴濒死谁来掷（DM 统一掷？） |
| 4.6 施法 | roll 施法参数族（闸+骰同瞬）；专注受伤=roll 专注分支 | — |
| 4.7 检定 | roll 判定分支 | DC 选择=DM 判断（骨架已有标尺） |
