# 二期总账（统一 deferred ledger · 2026-09-28 立账）

> 规则:①一切「以后再说」**当批即入本账**——散装二期会打架,这里单源;②工具 schema/描述内**永不出现路线图语**(路线图归本账与 devlog);③每条带锚点(落账时的代码/文档位置)与前置依赖;④推进时勾销并在 devlog 记执行回执。
> 排序总原则:**数据先行**——数据能落档即排,消费闸一件一件开(先例:statuses mods 先于 rage 抗性消费);两条消费闸互不相抢,唯一共享面=core 白名单与 statMods 读口,改前对读口审。

## ⚠️ 分工防干冲（2026-09-28 拆分后新加；现状=audit-fixes 已全交付）

并行 agent 的 `docs/audit-fixes_zh.md` **一期 A1-C5 + 二期 F/G/H(专注断链/rest/临时生命)已全部落码**(二期由本方施工,见 devlog 追记二十)。本账原 A/B/C 编号与对方撞车,现重构为 **F/G/H** 避开;对方二期编号也用 F/G/H(含义不同:专注/rest/临时生命)——对方使命完成后不再活跃,本账 F/G/H 继续指(状态消费剩余/怪物面/语料)。

| 本账原项 | 对方覆盖处 | 结论 |
|---|---|---|
| 原 A1 · save 专链(bless 豁免半) | audit-fixes **B1**(rollMods 单源 + check/cast 三消费) | **勾销** |
| 原 A4 · hp_max 提升族+临时 HP 池 | audit-fixes **C1/H 线**(temp 组合池,已落) | **勾销**,核心已落,余见 H 遗留 |
| 原 E1 里 check/cast/attack 的 schema | 对方已改这三件 schema | 范围收窄为其余六件 |

**已解锁**:核心四件(core/cast/check/attack)对方交付完毕,本账剩余项(状态消费/怪物面消费/升级链)可安全施工——但消费闸接口(rollMods/statMods/grantTemp/dropConcentration)需先审对方的实现。

## F · 状态消费剩余(原 A 族,剔除对方已覆盖的 A1/A4)

| 编号 | 内容 | 锚点 | 前置 |
|---|---|---|---|
| F1(原 A2) | rage 抗三型——attack 抗免段合并 statuses 授予「伤害类型→减半」 | `attack.mjs` 抗免段 | 待对方 rollMods 交付后审;rage 条目落档先行 |
| F2(原 A3) | bardic inspiration 消费型(持有 d6 待用,用掉即摘) | `update_status.mjs` + check/attack 掷点侧 | 待对方交付(掷点侧是 check/attack) |
| F3(原 A5) | 力竭效果机械挂接(hp_max 减半/速度) | `update_status` + hp_max 消费 | hp_max 消费闸(F1 类)设计 |

## G · 怪物面(2026-09-29 消费全落地)

| 编号 | 内容 | 状态 |
|---|---|---|
| G1(原 B1) | 豁免型能力(龙息 79 条) | ✅ **消费已落**——attack `ability` 入口(走豁免,DC/骰自表,半伤/knockProne/抗免) |
| G2(原 B2) | Weapon 伤害骑手(龙焰咬 65 条) | ✅ **消费已落**(RIDERS 段,独立骰+独立抗免) |
| G3(原 B3) | Spell Attack rider | ✅ 已入首表 |
| **G4(新)** | Weapon **状态骑手**(击倒/中毒/麻痹 23 条) | ✅ **2026-09-29 落**——STATUS_RIDERS + attack 自动掷豁免写状态 |
| **G5(遗留)** | 复杂 rider(诅咒/疾病/吞食/拉拽 16 条) | ⏸ 挂账——非标准状态,DM 叙事兜底 |

## 缺口(agent 视野走查挖出,agent 想改面板但无工具)

| 内容 | 处置 |
|---|---|
| 装备/物品获得与卸下(拾取/换武器/穿甲/弃盾盾键) | ⏸ 挂账——尾代 runtimeEdit 兜底,频次低 |
| 力竭 +1(强行军/绝食/环境) | ⏸ 挂账——尾代 runtimeEdit 兜底 |

## H · 语料勘误/补全(对方边界「不动语料」,全归本账)

| 编号 | 内容 | 锚点 |
|---|---|---|
| H1(原 C1) | ~~casting-a-spell 语料截句补~~ **已补**(2026-09-28,BR p.85 对勘) | `rules/casting-a-spell.md` |
| H2(原 C2) | conditions 纳入 assemble 源流(手工件重跑会丢) | `rules/conditions.md` + `assemble.mjs` |
| H3(原 C3) | 抽取脚本归档:**monster-ability 已入 scripts/**(可复现);spell-data/monster-attack 留 /tmp 历史一次性(两表现是抽取+手工分类混合层,勿重跑覆盖) | `scripts/extract-monster-extra.mjs` |

## D · 升级链(原账照走,对方无此项)

D-族=asi-pending_zh.md **L3/L4/L6–L11**(锚点 2026-09-28 复核仍成立);L1/L2/L5 已执行销案,状态见该文「执行回执」。

## E · 工程面

| 编号 | 内容 | 锚点 |
|---|---|---|
| E1 | 其余六件工具参数级 schema 通顺化(**不含** cast/attack/check——对方已改;剩 death/damage/heal/hp_change/initiative/spawn_npc/gain_exp/gain_money/update_status) | 四步法工具描述清单 |
| E2 | HUD「最终(基)」渲染注(ui_data 已发 ac/ac_base 双值,视图未接) | `ui_data.mjs:121` |
| E3 | P0 E2E:regenerate/stop 真机实证 | 0a4e4db 留言 |
## 追记(2026-09-29b spawn_monster 档案自含批入账)

- **枚举化第二批**:法术/戏法/技能参数值域照 monster_kind 律 enum 化(statuses 已有内核写盘枚举闸 status.mjs;技能已有白名单;cast 的 spell 参数可循同律)。用户已表态方向。
- **怪物特殊能力回充(recharge 5-6)未机械化**——龙息的回合限制仍归 DM 叙事。
- **弃盾 status 退役**:盾键(shield bool)即持握唯一事实(deriveAC 只读它),弃盾=键翻转——缺装备直改道(工具或尾代 runtimeEdit 硬闸),补上即退役弃盾状态条目。
- **DMG 财宝表 CR0-4 档官方 PDF 再校**(数据取转写站,三档互证,0-4 档挂勘误候选)。
- **数据化 2b(2026-09-30 勾第二批遗留)**:classes 职业表进了 data(classRow 正则死于抽取/buildClass Proficiencies 行/live 逐级特征)——opening 与升级链 последний 消费面;races 同律。装备已清(EQ_CORE)。
