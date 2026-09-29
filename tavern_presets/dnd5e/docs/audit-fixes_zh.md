# 机制审计修复批（施工单 + 定案包 · 2026-09-28）

> 性质：**施工单**（A1/A2/A3/B1/B2/B3/C1-字段退役/C5 本批已落码）+ **定案包**（§6/§7/§8 由用户授权自主定案（2026-09-28：不要找我拍板，自己想，记文档），照本文可直接施工）。
> 审计方法：真实 preset lib + 真实语料搭 rig 逐件实跑复现，非读码推断；全部病案有回执为证（devlog 09-28 审计追记/追记十九）。
> 基线：statuses **对象表模型**（`key=状态名, value={applied_at?, effect?, mods?, temp?}`）—— §7 起按对象表形态设计。
> 边界：**不动提示词、不动语料**；二期四件(core/cast/check/attack)实现归并行线，编号 **F=专注断链 / G=rest 件 / H=临时生命授予面**（施工顺序 F→G→H，G 复用 F 的 dropConcentration）。

## 0 · 批准范围与分工

| 项 | 处置 | 落位 |
|---|---|---|
| A1 位移/增益法术被当直伤 | **已修**（本批落码） | §1：数据分类 + cast 路由 + 回执 |
| A2 多目标静默丢失（群疗/多攻骰） | **已修**（本批落码） | §2：cast 治疗/攻击分支循环 |
| A3 spells_known 无闸 | **已修**（本批落码） | §3：cast 收录闸 |
| B1 bless/attack_save 消费面三缺 | **已修**（本批落码） | §4：统一读口单源 |
| B2 check 读死通道 | **已修**（本批落码） | §4：statusesMod 退役 |
| B3 豁免型不查抗免+平值 | **已修**（本批落码） | §5：save 分支补 resistNote/hitFlat |
| C1 temp_hp 字段 | **字段已退役**（本批）；**授予面已定案=H 线** | §6 |
| C2 专注断链 | **已定案=F 线**（§7 定案全文） | — |
| C3 短休HD/特征池 | **已定案=G 线**（§8 定案全文） | — |
| C4 尾代律法重训 | **挂账**（§9 清单已按定案最终化） | — |
| C5 kind i/场景单位/减害笔误 | **已吸收**（对象表重设计退役 kind/remaining；§10 残留清点） | — |

## 1 · A1：法术语义分类——cast 管道按类路由

### 1.1 病理（实测三样本，真语料+真工具）

```
[施法 · 梅西雅→Teleport]                    ← 位移术,RAW 无施放伤害(3d10=Mishap 条款)
  伤害判定: 缇娜 3d10 = 21(自动命中)         → 落盘 缇娜 hp 38→17
[施法 · 梅西雅→Divine Favor]                ← 自体武器附伤增益(1d4=on a hit 条款)
  伤害判定: 梅西雅 1d4 = 3(自动命中)         → 落盘 自伤 40→37
[施法 → Mass Cure Wounds]                   ← 群疗 3 人,A2 相关
  落盘: 仅 targets[0] 一人,余静默丢弃
```

根因：`cast` 末分支触发条件 `dice !== undefined || (T?.damage && (T.bolts||T.upcastBolts))` 让一切「有伤害数字」的表/FM 条目在无 save/无 attack_type 时落入**自动直伤管道**。提取批抽取的是「语料里有没有伤害数字」，没做**语义分类**——位移 mishap 款、施法后压力款（wish）、占位冲突款（dimension-door）、武器命中附伤款（divine-favor）、构装体攻击款（flame-blade/arcane-hand）、地形持续款（web/spike-growth）全部混进直伤。

### 1.2 修法（数据 + 路由，零 schema）

- **自动直伤管道收窄**：触发条件改为 `T?.damage && (T.bolts || T.upcastBolts)`——只有**多弹类**（magic-missile 型，表内显式 bolts 声明）才走自动命中无豁免管。表外/fm.damage 兜底**不再**能触发自动伤害——位移/增益类自动落入「无掷效果：只过闸与落位」 + 新增一行显式回执 `◇ 无掷效果——效果归叙事/状态工具（本术语料无当拍掷面）`。
- **数据表 = 语义分类层**（`spell-data.mjs` 字典增补）：
  - `suppress: true`——语料数字属实但**不属于施放时点直伤**（mishap/骑手/地形/自险/条件款）；该词项伤害面整体封死（表+F 兜底双通道都断），DM 后续按 RAW 用 `damage`/`check` 工具逐事件结算。
  - `save: 'dex'|'con'|...`（T 级覆写）——**修 FM 洞**：语料 F 少数豁免型法术 FM 没落 save 键（call-lightning/flaming-sphere/spirit-guardians/earthquake 等 RAW 实为豁免型），cast 路由判据改为 `fm.save ?? T?.save`。
  - buff 条目承接**武器附伤骑手**（divine-favor/branding-smite）：`mods:[{stat:'damage',magnitude:'1d4'}]`——attack 伤害侧 mods 从「仅数值」扩为「数值/骰式每掷独立」（与攻检侧同律）。

### 1.3 判决表（15 自动伤害现役受害者 + 豁免侧人工复判）

| 法术 | 语料伤害源 | 判决 | RAW 依据 |
|---|---|---|---|
| teleport | Mishap 款 3d10 | `suppress`（mishap=事件→damage 工具） | Mishap: GM 重掷传送表 |
| dimension-door | 到点占位款 4d6 | `suppress` | occupied space 条款 |
| wish | 施法压力款 1d10× 环 | `suppress` | stress/duplicate 二选一 |
| meld-into-stone | 语料无当拍伤害 | `suppress` | 仪式融合石 |
| divine-favor | on a hit 附伤 1d4 | **buff**（mods damage 1d4） | weapon attacks deal an extra 1d4 |
| branding-smite | on a hit 附伤 2d6 | **buff**（mods damage 2d6，显形入 effect 文案） | next weapon attack |
| arcane-hand | 构装体攻击 4d8 | `suppress`+backlog B（构装体攻击通道二期） | Clenched Fist=melee spell attack |
| flame-blade | 构装体持剑 3d6 | `suppress`+backlog B | melee spell attack per swing |
| web | 燃网 2d4 | `suppress`（烧网=事件→damage） | webs are flammable |
| spike-growth | 地形 2d4/10尺 | `suppress`（踏入=事件） | terrain rider |
| prismatic-wall | 穿墙 10d6 | `suppress`（穿墙=事件） | passing through |
| call-lightning | 每支闪电 3d10 | `save:'dex'`（当拍可掷首支） | Dex save per bolt |
| flaming-sphere | 撞压 2d6 | `save:'dex'`（当拍掷出现时） | Dex save |
| spirit-guardians | 光环 3d8 | `save:'wis'` | Wis save half |
| earthquake | 区域 5d6 | `save:'dex'` | 区域效力 |
| bestow-curse（豁免侧） | 诅咒无直伤（1d8 幻数） | `suppress` | 诅咒四选一无伤害款 |
| enlarge-reduce | 体型武器补差 1d4 | `suppress` | enlarge 附差 |
| geas（豁免侧） | 违令 5d10 | `suppress`（违令=事件→damage） | on disobey |
| contact-other-plane | 自险 6d6 | `suppress`（施法者自身 DC15 INT 检定→check+damage） | caster self-risk |
| control-water | 无伤害（2d8 误抽） | `suppress` | 无伤害款 |
| dream | 无施放时点伤害 | `suppress` | 信使术 |

豁免侧其余（moonbeam/heat-metal/feeblemind/phantasmal-killer 等）RAW 主效即伤害+豁免，**维持原管道**。`disintegrate/finger-of-death` 的 `hitFlat`（+40/+30）RAW 明文「失败全额/成功减半（总额减半）」→ §5 修入豁免分支。

### 1.4 cast 连带回执改进

- 无掷效果类打印显式行（agent 视野内可判「本调用不做数值结算」）。
- 每分支补「落盘即写据」约束不变。

## 2 · A2：多目标静默丢失

- **治疗分支**：`T.healMulti:true`（现役 mass-cure-wounds）→ 逐目标独立掷骰+独立落盘；非群疗传多目标 → **报错**（响亮拒绝 beats 静默丢）。旧行为 `targets[0]` 静默取首位——删除。
- **攻击分支**：多攻骰法术（scorching-ray 型，`T.bolts`+fm.attack_type）→ 逐目标独立攻检+伤害（RAW: each ray/ray allocation=targets 名单）；有 `T.bolts` 时名额数校验与 magic-missile 同律。单目标法术传多人 → 报错。eldritch-blast 维持「连调」拍板（表内无 bolts 不校验名额）。
- schema 唯一连带：cast `targets` 参数描述一句改为「豁免型/群疗型/多攻骰型可填多个；单目标攻击/治疗只填一个名字」——不新增参数。

## 3 · A3：spells_known 收录闸

- cast 在「无施法能力」闸后增第二闸：`spells_known`（slug 归一比较）不含该法术 → err `!施法者未收录此法术：{spell} 不在 {caster} 的 spells_known`。
- 施法族出生（opening/spawn）已有「声明则必全」契约，此闸是它**迟到已久的读者**；档无该键（异常档）同报错——fail-closed。
- spells_prepared 暂不设闸（管家人工面，二期 grow/rest 议）。

## 4 · B1/B2：统一读口补三缺（rollMods 单源）

**现状消费地图（实测）**：`attack_save` 只有 attack 武器攻检在读；cast 攻击型、cast 豁免型、check 豁免——全盲。`save` 白名单明文允许，全库零读者。check 读的 statusesMod 是旧正则通道（`effect` 文本 `dex+2` 式），对象表新模型下无人合法写入=死渠。

**修法**：
- core 新增 `rollMods(j, ...stats)`：statMods 取条目→数值直加/骰式每掷独立掷→返回 `{flat, parts}`；`doubleDice` 选项=暴击时骰式骑手双掷（RAW：暴击翻的是伤害骰，含附伤骑手；定值不翻）。**单源**，attack.mjs 现场循环改为调它（同律注释分叉即 bug 温床的既案）。
- 消费面三补：
  1. **cast 攻击型**：`ab += rollMods(char,'attack','attack_save').flat`，回执加「状态修正」行（bless 挤进法术攻检）；
  2. **cast 豁免型目标侧**：`resolveSave` 升级——`bonus+parts` 返回（save/attack_save 双通道进豁免值），回执豁免行下加「状态修正 {名}: …」行；
  3. **check 豁免**：save 分支吃 `rollMods(char,'save','attack_save')`，parts 进「修正」行。
- **statusesMod 退役**：check 停用旧正则通道，core 删除导出（全库唯一消费=check）。技能检定面不改——mods 白名单无技能通道，`modifier` 参数（祝福/指引类手填）保持唯一入口——语义 Clarke：面板状态若带 `mods:[{stat:'save'...}]`，agent 现在可以确信它落在豁免上，不再需要在心里猜「thisön有效吗」。
- **attack 伤害侧**：`statMods('damage')` 从仅数值扩为 rollMods（divine-favor/branding-smite 的 1d4/2d6 骑手落点），回执加「附伤」行。

## 5 · B3：豁免分支抗免 + 平值 + 半伤律

- save 分支伤害套 `resistNote`（与 attack 分支同一函数）：失败豁免=全伤→抗减半；成功豁免=半伤→再抗减半（RAW 连减，floor）。
- `T.hitFlat`（disintegrate +40/finger-of-death +30）入豁免伤害总额：`roll.total + flat`，成功减半=对**总额**减半（RAW: half as much damage）。
- 自动弹（magic-missile）分支同律补 resistNote（力场罕见有抗，但规则面一致）。

## 6 · C1：temp_hp 字段退役 + 临时生命协议（已定案 → H 线）

**本批已落码**：`temp_hp` 键从模板/opening 出生面/view 展示面删除（死字段：全库无写手无读者——工具从不消费，HUD 芯片从未点亮）。存量档容忍残键（读方全部走 `?? 0` 习惯，实际无一读它）。

**协议（定案）——临时生命 = statuses 条目 + hp/hp_max 同抬的组合池模型**：

- **授予（H 线施工面）**：获得临时生命 N → 同拍三写：`hp_max += N`、`hp += N`、statuses 新条目 `「{法术名}」= {applied_at, effect: '临时生命+{N}，到期回收', temp: N}`。
  - **statuses 值域增可选字段 `temp: N`**（数值）——尾代现读 effect 文本即可干活、未来 tick 机读的锚；tpl `statuses` 注释行随 H 线一行补形态。
  - 法术源：`SPELL_DATA` 增 `temp`/`tempUpcast` 字段——`armor-of-agathys: {temp: 5, tempUpcast: 5}`（每环+5）、`false-life: {temp: '1d4+4'}`（掷）。heroism（每回合续灌）复杂暂不入表，backlog B。
  - 无骰源：hp_change 增 `temp: N` 通道（hp_change 不属四件，schema 一参）——同拍三写同律。
- **取高不叠（RAW Combining Magical Effects）**：授予时已有任一 `temp>0` 条目——新 N ≤ 旧 N → 两键不动，回执注「已有临时生命 {旧}≥{新}，不叠」；新 N > 旧 N → 两键按 Δ=新−旧 抬升并覆盖条目。
- **伤害侧零改动（本模型核心红利）**：临时生命在组合池顶段，attack/cast/damage 直接扣 hp 天然先吃临时——六条扣血通道**一行不改**。0HP/濒死/回复语义不变（池尽才到真实 0；治疗照旧钳 hp_max）。
- **到期回收（算式不变式已证）**：`hp = min(hp, hp_max − N)`、`hp_max -= N`、删条目——耗尽/部分消耗/未消耗三情形全部收敛正确。执行面：现=尾代（读 `temp` 字段，单步四则允许范围内），二期=tick；叙事性提前解除可由主代 update_status(remove) 同帧发起。
- **RAW 偏差声明（deliberate）**：治疗优先回填临时区间（RAW 治疗不回填临时）——组合池的固有近似，不为它建第二存储。
- 测试（H 线）：授予三写/取高覆盖/低位不叠/到期回收三情形（耗尽/部分/未耗）/伤害先扣临时不动 hp_max。

## 7 · C2：专注断链当拍级联（已定案 → F 线）

**病理**：断链三处孤儿（受益人 statuses 条目 / 施法者 `concentrating` / cast 顶替时旧术全部条目）——statuses 现为**工具读域**（attack/cast 在读 mods），孤儿条目持续污染此后每次计算，恰好踩 panel-consistency §3.1 自立的法（会污染工具读→强一致→当拍）。现状清理归「尾代回合尾」，但 maintenancePrompt 无常驻指令（只有 cast 回执一次性提示）。

**裁决（定案）：判词即写——check 专注维持失败时自动级联清理，判定件零写盘律接受唯一显式例外。**

依据三条：
1. **§3.1 的法先例于内**：专注锚定的 statuses 是工具读域，回合尾弱一致清理=每次掷骰可能被过期 bless 污染——正是该定律禁止的事。备选案（回执提示主代手动 update_status remove）保留一回合分叉窗口且依赖 LLM 记忆，与「机械交工具」立卡哲学相悖，弃。
2. **零写盘律的豁免依据已失效**：当年豁免专注清理的理由是「清理由 cast RAW 覆写吸收＋concentrating 降级展示域」——buff 机械化（追记十六/十八）后两前提皆不成立（statuses 已喂工具读），律条应随事实更新。
3. **家族先例**：death 工具 nat20 判词已驱动落盘（hp 0→1 双清）——「判词=机械事实、级联写=其纯函数」同型；W1（零判断入写）成立：失败判定是骰子的确定函数，条目删除是 concentrating 值的确定函数。

**规格（F 线照此施工）**：
1. `core.dropConcentration(casterName)` → `{old, removed: [{file, key}]}`：读施法者档；`concentrating` 空 → 返回空（幂等，不报错）；扫描 `characters/*.json`（含施法者自身）statuses 对象表删**键名全等**于 concentrating 的条目（cast 写入键=fm.name，update_status 手写条目撞名=Combining 同名语义，接受）；`concentrating=null`；只回写实际变动文件；坏档跳过不炸。
2. **消费位一·cast 专注顶替**（顺修遗病：现只换 concentrating 字段、旧术条目不摘）——施新专注术前旧值非空且≠新名 → dropConcentration。回执在「顶替」行后并列落盘行：
   ```
   专注: 顶替旧专注「Bless」→Hypnotic Pattern(RAW 覆写,自动弃旧)
   落盘: 梅西雅 statuses −「Bless」 [characters/player.json]
   落盘: concentrating Bless→Hypnotic Pattern [characters/缇娜.json]
   ```
3. **消费位二·check 专注维持失败**（仅 `damage` 参数入口级联；环境式 con 豁免不级联）——判词「失败」后自动 dropConcentration(who)，回执追加：
   ```
   [判定 · 缇娜 · 专注维持]
     判定: d20-2 = 18 vs 专注维持 DC20 → 失败
     落盘: concentrating Bless→无 [characters/缇娜.json]
     落盘: 梅西雅 statuses −「Bless」 [characters/player.json]
   ```
   成功/无专注 → 零写盘如旧。check 头部注释锚「唯一写盘例外=专注断链（audit-fixes §7 裁决）」防后人按零写盘律误删。
4. 边界：duration 自然到期（非断链）不辖——归 tail/二期 tick；受益人亡档 natural 空过；cast 回执「◇ 专注类…尾代销毁」句随 F 线改为「断链/顶替时自动销毁」。
5. F→G 依赖：G（长休清专注）复用本函数。
6. 测试四钉：顶替链（旧条目跨档双删）/断链链（受益人多名）/无条目容错（只清 concentrating）/幂等（concentrating 空→零副作用零落盘行）。

## 8 · C3：rest 件（已定案 → G 线）

**形态（schema 定稿）**：
```
rest(context, kind: 'short'|'long', who: '名单', hd?: int, food?: bool, water?: bool)
```
主面件（休整=DM 叙事申报事件，尾代只对账）。「一次调用走完一个休整事件」：who=名单（常驻全队），逐人结算逐人落盘。

**短休（kind: short）**：
- HD：`hd`（缺省 0）=逐人花费枚数——**hd > 该角色 hd_available → err 点名**（响亮拒绝 beats 静默钳制；RAW「掷一枚看结果再决定下一枚」的逐步决策=DM 分次调用，非硬上限）。逐枚掷 `d{hit_die}+CON` 成行（hit_die 读 `classes/<职业>.md` FM；无成长面/无 class 者跳过掷骰段——怪不挣 HD）；hp 钳上限；`hd_available −= hd`。
- 池回充：features 行 `名|短休|已用N` → `已用0`；**契术师整池回满**（warlock pact slots RAW 短休全回——按 core 位表键改写 slots_lN）。
- 1 小时时长/邀请纪律：RAW 无次/日硬上限——叙事纪律（systemPrompt 既有「长休周期节奏」预算句），不做工具闸。

**长休（kind: long）**：
- **三铁轨**：①`hp ≥ 1`（濒死者不能长休）else err；②`last_long_rest` 距今 <24h → err（回执给现距 h 数，RAW「一 24h 窗口一长休」）；③打断作废=叙事纪律（无工具闸）。`last_long_rest` 读写=state.md 时间敏感项登记行（时钟行注入器已解析，rest 顺律读写）。
- 全链写（逐人落盘行，W3 写据律）：`hp → hp_max`；`hd_available = min(level, hd_available + max(1, ⌊level/2⌋))`；slots 按 class 位表**回满**——位表三件（SLOTS/HALF/PACT）**从 gain_exp 迁 core 单源导出**（gain_exp 改 import，行为零变化）；features `|短休|`与`|长休|` 已用清零（长休覆盖短休池，RAW）；`exhaustion −1`（≥1 时；`food:false` 或 `water:false` 声明则跳过并在回执注明，缺省视为有饮食）；专注清=调 **F 线 dropConcentration**（逐施法者）；妖精/不死等不饮食特质不辖（语料叙述，DM 面）。
- **不辖（边界成文）**：其余 statuses 到期清扫仍归尾代（applied_at+effect 文本判）——rest 只做带硬规则的 RAW 机械；临时生命回收=H 线算式（tail 代管至 tick）；「每日」档池（如法师奥法回复）不随长休重置（时间IP 每日口径归 tick）。

**回执样例**：
```
[休整 · 短休 · 梅西雅,缇娜]
  生命骰: 梅西雅 1d6+1=5 · 2d6+1=6 → hp 12→17 · hd_available 3→1
  池回充: 梅西雅 Second Wind|短休|已用1→0
  落盘: 梅西雅 hp 12→17 · hd_available 3→1 [characters/player.json]
  ...
[休整 · 长休 · 全队]
  铁轨: hp≥1 ✓ · 距上次长休 31h ✓(≥24h)
  落盘: 梅西雅 hp 17→22 · hd_available 1→2 · slots_l1 0→4 [characters/player.json]
  落盘: 缇娜 concentrating Sleep→无 [characters/缇娜.json]
  落盘: state.md 时间敏感项 last_long_rest=第 3 日 7 时
```

**maintenancePrompt 退役面（C4 时一并）**：§3.a 长休结算整段 + §4 跨小时「短休（正文声明→生命骰掷骰回执落盘）」句 → 「正文声明休整→主面调 rest」。

**测试六钉（G 线）**：短休掷骰+池+契术师整池；长休 hd 公式（含 ≥1/封顶 level）；slots 三位表回满；力竭（food:false 跳过并注明）；hp0 err+24h 铁轨 err；位表迁 core 后 gain_exp 全量回归绿。

## 9 · C4 挂账：尾代律法集中重训时的必带清单（已按 §6/§7/§8 定案最终化）

1. statuses **对象表**教范（key=状态名 / value={applied_at, effect?, mods?, temp?}）+ 删数组/remaining/kind/「remaining 折算 −1」旧律——3.a 现行文本仍教数组折算模型，直接矛盾。
2. 到期清扫教范：无 remaining → 尾代按 **applied_at + effect 文本**判到期删键（时间真值=叙事）；带 `temp` 字段条目 → 到期先算回收（§6 公式）再删键。
3. 专注线随 F/G 落地改写：「专注类条目由尾代销毁」句与 §3.a「temp_hp/专注清」句退役 → 「断链/顶替/长休由工具自动销毁，尾代只对账」。
4. §3.a 长休结算 + §4 短休句 → 「正文声明休整→调 rest」（G 线）；「掷骰由 DM 完成，你只落盘」尾代职责句删。
5. 施法面对账收紧：cast 收录闸已立——尾代发现叙事施法无回执照双报警律处理，不代调 cast（主面职权）。

## 10 · C5 残留清点（被对象表重设计吸收）

- kind `b/d/i` 三色、`remaining` 四单位（含「场景」）、「减害」笔误——**全部随 09-28 对象表重设计消失**（update_status 增量字段版无 kind/remaining 描述）。残留=文档面（panel-data 字段表行、maintenancePrompt 3.a 旧教范）→ 归 C4 重训批同步,本批不动提示词。
- 追加残留：_FM 洞_清单（call-lightning 等 save 缺失）已由 T.save 覆写兜住，语料勘误仍按 backlog C 入账。

## 11 · 测试计划

**本批已落钉（8 枚，全套 40 files/518 tests 绿）**：
1. teleport(suppress)：无伤害判定行、无 hp 落盘、有「无掷效果」行+位耗落盘。
2. divine-favor：buff 条目落盘（mods damage）且零自伤。
3. mass-cure-wounds 三目标逐人独立掷+落盘；cure-wounds 多目标报错。
4. spells_known 收录闸：表外法术 err；表内过。
5. burning-hands vs 火抗：半伤→再抗减半（回执 arrow 值对账 hp）。
6. bless 修正行三处可见：cast 攻击型/cast 豁免型目标侧/check 豁免。
7. 旧正则通道死透：effect='dex+2' 不影响豁免值。
8. scorching-ray 多目标逐掷+名额校验+单目标攻击型多填报错；temp_hp 出生面退役断言。
（夹具面：PLAYER/各 rig 增 spells_known 已同步；治疗回执带目标名前缀；test-missile 改「无掷效果」钉。）

**F/G/H 线落地时的新钉**：F 四钉（§7.6）；G 六钉（§8）；H 五钉（§6）。

## 12 · 文档同步清单（本批已同步）

- panel-data_zh：temp_hp 行删；statuses 行改对象表形态（若重设计批未同步到）。
- ui_zh：临时HP 芯片行删。
- design_zh §机器层清单：temp_hp 出列。
- panel-consistency_zh §2#7：temp_hp 行加已废编注（字段退役，协议改组）。
- tools_zh：cast 分支路由/attack damage 骑手/check+resolveSave 消费面色块同步。
- devlog_zh：本批追记成文。
