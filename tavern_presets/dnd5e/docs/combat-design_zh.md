# dnd5e-combat · 战斗封单工具设计

> 从 `dnd5e`（原味跑团）复制派生。核心改造：**LLM 退化为纯叙事 DM**——一切战斗结算
> 封进一个 `combat` 工具（v1 全自动互丢技能），LLM 只看「会什么」的能力画像 + 背包/钱/人设/记忆，
> 不看「有多少」的战斗数值。前端（HUD/JSON 面板）**不变**，玩家照旧看到全量战数值。

---

## 1. 分界原则（一张表记到底）

| 给 LLM（叙事需要） | 不给 LLM（战斗结算） |
|---|---|
| **会什么** — 技能熟练、剧情特征、语言、身份 | **有多少** — 六维数值、HP/AC、环位、战斗法术、状态 |

- 技能检定（`check`）＝叙事面，**全保留**（解谜/交涉/动物交流/潜行…）。
- 环位（法术位）**只在战斗里有意义**；日常施法（动物交谈、侦测魔法）纯叙事，不追环位。
- 法术天然二分（数据已自带）：`SPELL_DATA` 有机械骰表＝战斗法术；无表（cast 走「无掷效果」分支）＝剧情法术。

## 2. 决策记录（已拍板）

| 点 | 结论 |
|---|---|
| 战斗中谁玩敌方 | A 全自动：双方靠 AI 随机丢攻击/法术，无玩家操作，忽略占位/移动 |
| 战斗结果交付 | 同步工具回执（全自动＝纯计算，10s 闸无碍），零改流，不走 mvu |
| 战斗间资源 | v1 每场战斗**独立**：结束自动回满 HP+环位+清状态，不持久化战斗残值 |
| level/languages | 保留（level/class/subclass＝身份；languages＝RP） |
| 非战斗 XP | 保留 `gain_exp` 口子，升级级联按 role 分叉（玩家挂 pending／NPC 自动随机） |
| 玩家 pending | 不注入 LLM；前端 `front_commit` 点（asi/spells/choice 已支持） |
| 前端 | 不变（`ui_data.mjs` 读全量原档，HUD 原样） |

## 3. 工具矩阵

**保留（9 件）**：`combat`（新）+ `check` + `spawn_npc` + `spawn_monster` + `gain_money` +
`update_inventory` + `gain_exp`（非战斗 XP）+ `rule`。

**退役（8 件）**：
- `attack / cast / damage / initiative / death` → 结算内核搬进 `lib/combat-engine.mjs`，供 combat 复用，文件不再注册为 LLM 工具。
- `rest / hp_change / update_status` → v1 退役（战斗间资源由 combat 内部回满兜底；叙事态如力竭暂不追）。

> 工具＝`preset/tools/*.mjs`，`@tavern-schema` 标注即注册；删文件＝退役。`toolFaces`（meta.json）保持只 `main`。

## 4. `combat` 工具契约

### 4.1 schema（@tavern-schema）

```jsonc
{
  "description": "战斗结算器——一切战斗必经本工具（v1 全自动）：点名交战双方→无档当场建档→自动互丢攻击/法术→战报回执。何时调：敌意显现、接战触发即调，一次调用走完一场。日常叙事不碰任何战斗数值。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概（反作弊铁则）" },
    "allies": { "type": "array", "items": { "type": "string" }, "description": "我方名单。默认=玩家+附近「同伴」（presence 读）；可显式覆盖。" },
    "enemies": { "type": "array", "items": { "type": "object" }, "description": "敌方名单，每条 {name, monster_kind}（或已建档怪名）。" },
    "terrain": { "type": "string", "description": "战场风味（只进战报叙事，不参与机制——v1 忽略占位）。" }
  }
}
```

### 4.2 自动战斗算法

1. **建档**：enemies 无档者按 `monster_kind` 走 `buildMonster`（`monster-build.mjs`）当场建档；我方从 presence 读档。
2. **先攻**：全员 roll 先攻排 order（复用 `initiative` 内核）。
3. **循环**（逐轮、按先攻序）：
   - 每个单位随机选一个动作：近战/远程攻击（`attacks` 表，怪）或面板武器（PC/同伴）——命中→伤害→抗免→扣血；
     施法者若仍有环位，随机从**战斗法术**（`SPELL_DATA` 有骰表且已收录）里挑一个丢——位闸→效果→写盘。
   - 我方成员 0HP 走 `death` 濒死计数（同伴/怪 0HP 即死，与 `death.mjs` 同律）。
   - 状态骑手（击倒/中毒/法术 buff）按名机械写（复用 `attack`/`cast` 骑手逻辑）。
4. **结束条件**：一方全 0HP，或达上限轮数（默认 20，防两个坦克互刮痧死循环）。
5. **结算**：终 HP/状态落盘 → XP 按 CR 自动结算（升级级联按 role 分叉，见 §6）→ 战利品（怪 gear/钱袋）汇总 → 战斗结束**回满** HP+环位+清战斗态。

### 4.3 战报格式（≤8KB 硬闸，`TOOL_OUTPUT_CAP=8e3`）

- **每轮一行**（不逐骰）：`第3轮: 玩家砍倒哥布林甲(12→0); 哥布林乙射中玩家(-4, 20→16)`。
- **结尾摘要**：胜负 + 幸存者终 HP + 经验（谁升没升）+ 战利品清单 + 若玩家三败死亡标「◇ 跑团终局」。
- 工具**主动压缩**（中段轮次折叠为 `…（第4~17轮从略，互有往来）…`），不靠引擎截断。

## 5. 注入面缩窄（`panel-view.mjs`）

`panelView()` 新形态——叙事画像：

```jsonc
{
  name, role, level, race, gender, class(中), subclass(中),
  "擅长": ["驭兽——安抚驯兽/洞悉动物意图", "隐匿——潜行躲藏"],   // 只列熟练/专精，中文名+短注
  "特长": ["圣疗——触碰回血", "黑暗视觉——黑暗里能看见"],        // 只列剧情特征，一句释义
  "语言": ["通用语", "精灵语"],
  "背包": { weapons, gear },
  "钱包": { gp, sp, cp },
  "人设": { persona, history, description, thought }
}
```

- **删键**：六维 `str/dex/con/int/wis/cha`、`hp/hp_max/temp_hp`、`spells_known/spells_prepared`、
  `statuses`、`pending`、`exhaustion`、战斗特征、成长特征。
- **特征过滤**：白名单表 `FEATURE_KIND`（键=特征 norm 键，值=`narrative|combat|growth`），默认 `combat`（安全），只透出 `narrative` 桶。
- **技能中文化**：补 `SKILL_CN` 短名表（现只有 `SKILL_TIP_CN` 全段过长）。
- 前端 `ui_data.mjs`/`view.mjs` 不动，读全量原档。

### 5.1 特征分类（完整表见 §附录）

- 剧情（保留，23 条）：盲视感知/净化之触/神圣健康/神圣干预/神圣感知/德鲁伊语/隐于众目/大地之步/原始感知/纯净之躯/心如止水/盗贼黑话/不朽之躯/日与月之舌/消隐/万事通/可靠天赋/不屈力量/缓慢坠落/宿敌/天生探索者/荒野变形/野兽施法。
- 战斗（删，~60 条）＋成长（删，~28 条）→ 见附录全表。

## 6. 成长

- **玩家（pc）**：升级挂 `pending`（ASI/新法术/成长选项）→ 前端 `front_commit` 点；`pending` 不注入 LLM。
- **NPC（companion/npc）**：升级不挂 pending，`applyExp`（`mvu-apply.mjs`）按 `role` 分叉——pc 挂、
  NPC 自动随机（ASI 随机 +2 某属性、wizard 随机学 2 法术、特征照职业表入库）。
- 战斗 XP 由 combat 内部结算；非战斗 XP 走 `gain_exp`，级联同上分叉。

## 7. 实现清单（文件级）

1. **`preset/lib/combat-engine.mjs`（新）**：从 attack/cast/damage/initiative/death 抽出纯结算函数
   （`runAttack`/`runCast`/`rollInitiative`/`resolveDeath`），复用 `core.mjs` 原语。
2. **`preset/tools/combat.mjs`（新）**：schema + 自动战斗循环 + 战报压缩 + XP/战利品/回满结算。
3. **删 8 件工具**：`attack/cast/damage/initiative/death/rest/hp_change/update_status` 的 `.mjs`。
4. **`preset/lib/glossary-cn.mjs`**：补 `FEATURE_KIND` 白名单 + `SKILL_CN` 短名表。
5. **`preset/lib/panel-view.mjs`**：按 §5 缩窄（删战斗键、特征白名单过滤、技能中文+短注）。
6. **`preset/lib/mvu-apply.mjs`**：`applyExp` 按 role 分叉（NPC 自动随机）。
7. **`preset/prompt/systemPrompt`**：工具纪律/「战斗五步」改写成「接战调 `combat`，回执收战报再叙事」；
   「禁止心算」段删除已退役工具的引用。
8. **`preset/prompt/postPrompt`**：面板说明同步（注入已是叙事画像）。

## 8. 风险 / 待验证

- 8KB 战报闸：长战斗需压缩到位，实测一场满编（4v4）20 轮的字节数。
- NPC 自动随机升级的「随机」口径（ASI 属性选择、wizard 学法术）要落地成确定性规则。
- `combat` 内部「随机丢法术」需限定在战斗法术子集，避免丢出剧情法术（如 speak-with-animals）造成荒谬战报。

---

## 附录 · 特征全分类

### 剧情（narrative，进面板）

盲视感知 blindsense · 净化之触 cleansing_touch · 神圣健康 divine_health · 神圣干预 divine_intervention ·
神圣感知 divine_sense · 德鲁伊语 druidic · 隐于众目 hide_in_plain_sight · 大地之步 land_s_stride ·
原始感知 primeval_awareness · 纯净之躯 purity_of_body · 心如止水 stillness_of_mind · 盗贼黑话 thieves_cant ·
不朽之躯 timeless_body · 日与月之舌 tongue_of_the_sun_and_moon · 消隐 vanish · 万事通 jack_of_all_trades ·
可靠天赋 reliable_talent · 不屈力量 indomitable_might · 缓慢坠落 slow_fall · 宿敌 favored_enemy ·
天生探索者 natural_explorer · 荒野变形 wild_shape · 野兽施法 beast_spells

### 战斗（combat，删）

动作如潮 action_surge · 勇气灵光 aura_of_courage · 防护灵光 aura_of_protection · 吟游诗人激励 bardic_inspiration ·
凶蛮暴击 brutal_critical · 引导神力 channel_divinity · 驱散亡灵 channel_divinity_turn_undead · 反魅惑 countercharm ·
狡黠动作 cunning_action · 危险感知 danger_sense · 拨挡飞弹 deflect_missiles · 摧毁亡灵 destroy_undead ·
钻石之魂 diamond_soul · 神圣打击 divine_smite · 无踪 elusive · 空灵之体 empty_body · 闪避 evasion ·
额外攻击 extra_attack · 快速移动 fast_movement · 野性本能 feral_instinct · 野性感官 feral_senses ·
灵活施法 flexible_casting（±2 变体） · 疾风连击 flurry_of_blows · 屠敌者 foe_slayer · 灵感之源 font_of_inspiration ·
魔法之源 font_of_magic · 高等神圣打击 improved_divine_smite · 不屈 indomitable · 气 ki ·
气贯打击 ki_empowered_strikes · 圣疗 lay_on_hands · 武术 martial_arts · 契约魔法 pact_magic ·
以守代攻 patient_defense · 圆满自我 perfect_self · 持续狂暴 persistent_rage · 原初冠军 primal_champion ·
狂暴 rage · 鲁莽攻击 reckless_attack · 不屈狂暴 relentless_rage · 回气 second_wind · 油滑心智 slippery_mind ·
偷袭 sneak_attack · 休息之歌 song_of_rest · 施法 spellcasting · 疾风步 step_of_the_wind · 幸运一击 stroke_of_luck ·
震慑打击 stunning_strike · 卓越灵感 superior_inspiration · 无甲防御 unarmored_defense · 无甲移动 unarmored_movement ·
直觉闪避 uncanny_dodge · 大德鲁伊 archdruid · 秘法复苏 arcane_recovery · 魔能大师 eldritch_master ·
术法恢复 sorcerous_restoration

### 成长（growth，删）

属性值提升 ability_score_improvement · 秘法传统 arcane_tradition · 吟游诗人学院 bard_college ·
神圣领域 divine_domain · 德鲁伊圈 druid_circle · 魔能祈唤 eldritch_invocations · 专精 expertise ·
战斗风格 fighting_style · 魔法秘辛 magical_secrets · 武术流派 martial_archetype · 超魔法 metamagic ·
修院传统 monastic_tradition · 秘法奥秘 mystic_arcanum · 誓约法术 oath_spells · 异界宗主 otherworldly_patron ·
契约恩惠 pact_boon · 道途特性 path_feature · 原初道途 primal_path · 游侠流派 ranger_archetype ·
盗贼流派 roguish_archetype · 神圣誓言 sacred_oath · 招牌法术 signature_spell · 术法起源 sorcerous_origin ·
法术精通 spell_mastery · 领域法术 domain_spells
