# 改造计划 · 待 review（2026-09-28）

> ⚠️ **分工前提**：并行 agent 的 `docs/audit-fixes_zh.md` 是施工权威(正在动 core/cast/check/attack 四件)。本计划的 A1/A4 已完成或已方案化于对方账内,此处勾销引用;剩余项重新编号 F/G/H 避开撞车。本计划所有项**均不碰** core/cast/check/attack,待对方交付后再统一 review 消费闸接口。

## 已被对方覆盖(不重复计)

- **save 专链 / bless 豁免半** → 对方 **audit-fixes B1** 已落(rollMods 单源 + check/cast/attack 三消费面)。✅
- **hp_max 提升族 / 临时 HP 池** → 对方 **audit-fixes C1** 已方案化(temp_hp 退役已落 + 临时生命协议含不变量证明)。✅

---

## F · 状态消费剩余

### F1 · rage 抗三型(钝/刺/砍减半)

- **现状**：狂暴是职业能力,连「自动写入状态」都没有;钝刺砍抗性靠 DM 判断。
- **改什么**：抗性不是 `{stat,magnitude}`,是「伤害类型→减半」映射——statuses 条目加 `resist` 字段(或 mods 白名单新 stat),attack 抗免段合并。
- **为什么**：狂暴最常驻(野蛮人每场开),抗性最实打实。
- **前置**：等对方 rollMods 交付后审接口;rage 数据先落档。

### F2 · bardic inspiration 消费型(持有 d6 待用)

- **现状**：诗人激发「持有 d6,掷某次检定用掉即摘」,无消费通道。
- **改什么**：条目加 `on_use` 旗标,check/attack 掷点侧可选消耗。
- **为什么**：消费型是 buff 形态第二类,机制要长出来。
- **前置**：掷点侧是 check/attack(对方动),等对方交付。

### F3 · 力竭效果机械挂接

- **现状**：力竭 6 级,可机械的只有 hp_max 减半(4 级)、速度减半/0(2/5 级);其余优劣势(禁机械)。全在 effect 文本。
- **改什么**：力竭条目挂 hp_max/speed 修正(复用 hp_max 消费闸)。
- **为什么**：力竭是生存压力核心,触发相对低频。

---

## G · 怪物面(对方没动 monster-attack-data)

### G1 · 怪物豁免能力表(龙息等 80+ 件)

- **现状**：`monster-attack-data.mjs` 只收 488 条武器/法术攻击;龙息等「DC+豁免+骰」能力纯转写面。
- **改什么**：抽豁免型能力表(DC/save/骰/type/区域)。**数据抽取可先做**(零代码冲突),消费依赖对方的豁免结算消费者。
- **为什么**：怪物最标志性的能力(龙息)没有机械面,是战斗面最大洞。

### G2 · 龙焰咬 plus 骑手段(65 条)

- **现状**：65 条 Weapon 行带 `plus X (YdZ)` 第二段,抽表时 `rider:true` 只标账不抽。
- **改什么**：抽第二段骰进表,结算叠加。
- **为什么**：v1 取首段留尾,龙系咬击伤害被低估。

### G3 · Spell Attack 能力 rider

- **现状**：6 条法术攻击能力已入表,效果 rider 手动。基本了结,标错。

---

## H · 语料勘误/补全(对方「不动语料」,归本账)

- **H1** 语料截句补:`casting-a-spell.md` 缺「Or the most recent effect applies」——BR p.85 对勘。
- **H2** conditions 纳入 assemble 源流(手工 `rules/conditions.md` 重跑会丢)。
- **H3** 抽取脚本归档:/tmp 三个临时脚本入库 scripts/。

---

## D · 升级链(对方无此项)

asi-pending_zh.md **L3/L4/L6–L11**:

- **L3 学法术资格校验**：front_commit 只查存在性/数量,不查职业表合法性 → 可学未入表法术。
- **L4 非法师全施法者升级法术增长零机械**：bard/sorcerer 升级可学新法数无机械。
- **L6 hp_mode=roll 骰面零贡献**：roll 模式退化成均值。
- **L7 法师抄录机制无语料**：spellbook 悬空。
- **L8 prepare 数量上限文档有代码无**。
- **L9 ASI 无专长并列选项**(取舍题)。
- **L10 CON 追溯以属性分为闸,RAW 应以调整值增量为闸**。
- **L11 玩家 PC 成长写入例外缺失**。

## E · 工程面

- **E1** 六件工具 schema 通顺化(**不含** cast/attack/check——对方已改;剩 death/damage/heal/hp_change/initiative/spawn_npc/gain_exp/gain_money/update_status)。
- **E2** HUD「最终(基)」双值渲染(ui_data 已发数据,视图未接)。
- **E3** P0 E2E regenerate/stop 真机实证。

---

## 综述

- **对方已覆盖/在动**：save 专链、hp_max/临时 HP、core/cast/check/attack 四件、schema 三件。
- **本计划剩余、可安全先做(零代码冲突)**：G1/G2 **数据抽取**、H1 截句、H3 脚本归档、E1 六件 schema 通顺化(文档面)。
- **需等对方交付后审接口**：F1/F2/F3(消费闸)、G1/G2 消费面、D 族升级链(检查与对方是否有 schema 交集)。
- **建议砍/缓**：F3、G2、G3、E2、E3 —— 合规洁癖或展示优化,不做游戏照跑。