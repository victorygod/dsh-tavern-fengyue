# 机制-实现映射（2026-09-28 全量盘点）

> 原则：**机械机制尽可能进工具/脚本，LLM 只做判断**（不心算、不手抄骰、不手写数值）。
> 分四层：工具面（tool）/ 脚本面（script）/ 数据面（表+helpers）/ 判断面（LLM 唯一职责）。

## 一、工具面（13 件，各自机械责任）

| 工具 | 机械责任（脚本做） | 留给 LLM 的判断 |
|---|---|---|
| **attack** | 攻检 d20+加值、命中判、伤害骰、暴击翻骰、抗免易应用、扣血(injure 先扣临时)、濒死自动暴击、濒死败、怪物骑手(龙焰咬第二段)、龙息豁免(ability 入口)、目标 statuses 抗性合并(F1)、消费型状态(consume) | 优劣势 mode、掩体 cover_bonus、beyond_5ft 申辩、打晕(非致命)、攻击名 attack/ability 选哪个 |
| **cast** | 收录闸(spells_known)、位闸(戏法/仪式免位/升环)、专注顶替级联(dropConcentration)、选骰(语料表基础+升环Δ聚合/戏法角色档)、治疗属性内算、豁免逐目标、抗免+平值+半伤、多弹份额(targets 重复)、buff 写 statuses、临时生命(temp)、suppress 语义分类 | caster/targets/spell 选、升不升环 as_level、多弹分配 |
| **check** | 技能/属性/豁免修正解析、专注维持 DC 内算、豁免吃 save/attack_save(rollMods)、专注失败断链级联、消费型状态 | skill/stat/save 选、DC 档、对抗比大小、优劣势 |
| **damage** | 环境伤害掷骰+抗免+落盘 | dice/type/target |
| **heal** | 掷骰回血+钳上限+苏醒双清 | dice/target（生命骰逐枚投=分次调） |
| **hp_change** | 无骰直改/回满/临时生命(temp)三写 | amount/full/temp 选、直改值（独立事件） |
| **death** | 濒死豁免 raw d20、成败计数落盘、nat1 双败/nat20 回血、三成稳定/三败死亡判词 | 何时调（玩家濒死每轮） |
| **update_character** | 人物卡更新器(2026-09-30):statuses 数组全量替换(每条=名+applied_at,effect/on_use/mods 机械按名自动匹配——STATUS_TEXT/spell-data 单源;未列=摘除)、平铺叙事字段(armor/shield/装备/现况/历史追加/role/力竭)、法术三检+spell_details 重铺、拒收字段点名(生成面/结算面)、整卡回执 | statuses/各字段、target(玩家名直通) |
| **rest** | 短休 HD 掷+池回充+契术师整池；长休三铁轨+hp/hd/位表/力竭/专注清全链 | 何时休整、谁、滴/无饮食 food/water、HD 花费枚数 |
| **gain_exp** | XP 查表求和均分、升级级联(PB/HP/HD/位表/pending) | who 名单、foes 战果/直值 |
| **gain_money** | 钱包跨币换算+落账 | direction/amount |
| **initiative** | 掷全团先攻+排序+战斗节物化 | combatants、接战时机 |
| **spawn_npc** | 角色建档+presence 行+from 镜像校验+count 批量+attacks 出生登记 | name/stance/level/ac/hp/六维 抄 statblock |

## 二、脚本面（script，非 LLM 工具）

| 脚本 | 机械责任 | 触发方 |
|---|---|---|
| **front_commit** | 玩家 ASI(恰2/上限20/CON 调整值追溯)/学法术(三检:本职业表·非戏法·环位≤可施)→窄写+清 pending | 前端点选(runScript) |
| **opening_commit** | 开局玩家建档(六维/HP/temp_hp/pending) | 开局 |
| **ui_data** | 面板注入泵(ac/ac_base 双值、skills/saves/weapons/expBar/候选法术) | 前端泵 |
| **srd_index** | SRD 索引注入 systemPrompt | assemble 生成 |
| **extract-*** | 语料抽取器(怪物能力/骑手) | 构建期 |

## 三、数据面（core.mjs helpers + 3 张表）

**core.mjs 单一事实源 helpers**：`rnd`/`rollExpr`(骰)、`mod`(调整值)、`pbOf`(熟练)、`statMods`/`rollMods`(状态修正读口)、`slotsFor`(位表)、`deriveAC`(AC 律)、`resolveTarget`/`resolveSave`(目标/豁免解析)、`deathHitFail`(濒死落败)、`dropConcentration`(专注断链)、`grantTemp`/`recoverTemp`/`injure`(临时生命独立池)、`consumeBonus`(消费型状态)、`XP_THRESHOLDS`/`SLOTS_*`(成长/位表)。

**3 张语料表**（抽取器生成，agent 只读不写）：
- `spell-data.mjs` — 80 条法术：damage/upcast/heal/temp/buff/suppress/save
- `monster-attack-data.mjs` — 488 条武器/法术攻击：kind/bonus/dice/type/reach
- `monster-ability-data.mjs` — 79 条豁免能力 + 65 条骑手：save/dc/dice/type/half/knockProne

## 四、判断面（LLM 唯一职责，不可机械、也不该机械）

| 类别 | 内容 |
|---|---|
| **几何/站位** | 优劣势来源(空间/隐形/伏击)、掩体 0/2/5、5 尺内(长触及 beyond_5ft 申辩)、多弹分配去谁 |
| **RAW 强制例外** | 打晕(近战非致命)、恐惧源视线、倒地起身 |
| **剧情裁量** | 何时开战/休整/换场景、DC 档(5-30 标尺)、遭遇难易、谁算参战/失败方、非战斗成就 XP 数额 |
| **叙事态** | 弃盾(经 shield 键)/醉酒/被俘标记等不进 statuses 的自由态——纯叙事，不进机械 |
| **时间流逝** | 轮/分/时/天声明、状态到期对 applied_at+effect 文本判断 |

## 五、硬边界（永不做机械、也不该）

- 优劣势**不叠互抵**（Adv/Dis 律）→ 禁入 mods，走 mode 现判。
- 掩体/站位/临场 → 世界现况，永不进档。
- polymorph 整卡替换、多来源临时 HP 次高回滚 → 纯叙事/边缘挂账。