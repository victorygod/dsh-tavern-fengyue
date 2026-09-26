# dnd5e 卡工具规约（v5 · 2026-09-19 无状态审计后分裂定稿）

**程序面全景 = 8 件主面工具 + 1 件尾面工具 + 1 件前端通道**。玩家面只有三种行为：**声明意图**（输入框）/ **加点**（前端点选）/ **法术升环**（前端点选）——**一切掷骰由 DM 完成**（含玩家角色的检定/豁免/濒死），玩家不掷骰。前置阅读：`design_zh.md`（架构）、`dm-loop_zh.md`（流程正本,B 部为映射）。

## 零 · 定律

1. **工具=计算器**：读 runtime 面板、做罐头计算、返回值与回执——零写盘、零副作用、纯函数（seed 可重放单测）。
2. **写手与工具归属（v6 终版）**：主面=check/attack/cast/damage/initiative/death/rest（计算器,零写盘）；尾面=**status_update**（唯一结构化写道,原子写盘）+runtimeRead/Grep/Update/Create/Delete（整节与校验）；前端=front_commit。**转录任务不重算多步链**——数值来源=叙事代理的准确陈述（易错量经计算器），尾代只搬运与单步四则。
3. **前端机械写道=front_commit**（唯一非 LLM 落盘道）：玩家点选→校验→窄写→清 pending；LLM 零参与，下一回合注入只见结果。write-guard 照拦。
4. **回执中继**：同回合连发的状态连续性（连暴击链/已耗位）不靠磁盘——DM 下次调用参照上文回执（`crit`/`budget_offset` 参数）。
5. **存在判据**（成罐头缺一不可）：A 有表（阈值/价格/币率/池映射）· B 多步链（找零借位/升级衍射/休整曲）· C 叙事内硬约束（无位不可施/钱不够不可买）。其余=尾代直改或 LLM 直做，**无二期**。
6. **归属**：四件全部 `agents:["main"]`（DM 推演现场素材）；schema 块 `agents` 字段机制保留备用。
7. **时相律（2026-09-19 用户定案）**：回合=**叙事段→结算段**两相——
   - **叙事段**（正文写作中）：check/attack/cast/damage/initiative/death——回执即叙事素材,数字织进本回合正文;`context`（剧情梗概）**必填**（反作弊:骰值只裁定此刻,不得覆盖走向）；
   - **无结算段工具**：经验/金钱/物品/状态/休整**全部不经主面工具**——数值在叙事与末行小结中给出（落账由转录任务级联工具+直接编辑执行）；
   - 结算触发判断权在 DM（是否真发生长休/击败了谁——叙事权威）,故仍留主面;尾代理保持纯写手,引擎零改动。

## 一 · 统一 I/O 约定（四件工具共用）

- **输入**：单个 JSON 对象（引擎 v2 argv 注入）
- **输出**：回执文本 = 结果行（`[掷骰 #N ·…]` 式,织正文用）+ 计算分解 + **建议新值行** + footer；错误 = 结构化报错（`!` 前缀 + exit 1,含补救选项）
- **对象参数 `who`**：默认玩家;同伴/敌填名——工具按名读对应 `characters/<名>.json`
- **派生解析**：`stat+skill` 引用式参数由工具读面板解析（属性调整值+熟练/专精+statuses.effect）——**LLM 永不算数**
- **可选键律（2026-09-19 键裁剪，两行为）**：人物 JSON 键存在性跟随能力（裁剪律=panel-data 二·B 键能力裁剪律）。缺席键按两种行为处理：
  - **族头缺席=结构化报错**（工具的核心前提缺失）：cast 读不到施法族→「无施法能力」；gain_exp 读不到 exp→「无成长面」；
  - **修饰键缺席=按裸属性解析**（非报错）：check/attack 的熟练六件（save/skill/expertise/armor/weapon/tool_prof）缺席→不加熟练、检定按裸属性（RAW 正确退化，非静默忽略）；
  - 一切读键不得 NaN 崩溃。
- **无状态律（2026-09-19 审计定案）**：工具=一次性进程——读的必须是**回合内不变量**（AC/抗免/上限/熟练/钱袋底账）,输出的必须是**增量或判定**（伤害数值/成败/序列）;**禁止输出快变量绝对值**（HP A→B 同回合二次攻击会读陈旧值）,快变量累计=DM 单步叙述+尾代终写;绝对值输出仅限串行结算段（rest/death 计数）。

## 一·B · roll 分裂判据（2026-09-19 审计定案）

原 mega-roll（18 参数 9 分支）违背用户判据「**输入不同或逻辑复杂就不如分开**」。按「总是一起调才合并」重切：攻击+伤害链总同瞬→**attack**；施法闸+效果总同瞬→**cast**；判定/豁免/专注/对抗同形→**check**；先攻/濒死/纯伤害各具时机与参数→独立。**8+1+1 终态**。

## 二 · check——判定/豁免/专注/对抗（叙事段 · context 必填）
d20+修正 vs DC（专注=auto:专注维持+damage 内算 DC;对抗=vs+target 择优）→判定行（语义标签）。参数面见骨架 schema。

**链语义**：一次调用走到底，不再两段式中继——`攻击` 链=攻检→命中判定→伤害骰（nat20 自动翻倍）→抗性应用（↓取整）→**目标建议新 HP**；`施法` 链=三检（位/升环/专注冲突）→攻击法术走上链/豁免法术**逐目标** save（`half_on_save` 自动半伤）→建议新 HP;`crit` 中继参数退役为手动伤害的后备。**DM 只传判断类入参，一切机械解析在链内完成**（武器骰式/目标 AC/抗免/施法 DC=8+PB+施法调整值，全部从面板+lorebook frontmatter 自动取）。

**输入**：
```jsonc
{ "purpose": "判定|豁免|攻击|伤害|先攻|濒死|专注维持|施法|对抗",  // 必填
  "context": "一句已定型的剧情梗概(反作弊铁则)",               // 必填
  "who": "洛克",                                              // 骰谁/施法者(默认玩家)
  "stat": "str..cha", "skill": "技能名",                      // 修正值·引用式(推荐)
  "modifier": 0,                                              // 修正值·直值(临时环境项,如祝福+1d4 之外的固定项)
  "dc": 15,                                                   // 判定/豁免步
  "dice": "2d6",                                              // 显式骰式:伤害分支/升环覆盖(源库无升环字段,DM 照法术正文转写)
  "mode": "normal|adv|dis",                                   // 优劣势——来源判断=DM(空间/隐形/伏击)
  "target": "哥布林甲",                                        // 攻击链目标(AC/抗免自动解析)
  "targets": "哥布林甲,哥布林乙",                              // 豁免法术多目标(逐个 save 循环)
  "weapon": "短弓",                                            // 用哪件(默认面板持位武器;决定骰式/灵巧/射程属性)
  "cover_bonus": 2,                                           // 掩体 0|2|5——空间判断=DM,机械=工具
  "extra_dice": "2d6",                                        // 特征骰(偷袭等;条件是否满足=DM 判断)
  "spell": "fireball", "as_level": 3, "caster": "缇娜",        // 施法族
  "use_inspiration": true,                                    // 灵感换优势
  "damage": 12,                                               // 专注维持:受击伤害→DC=max(10,伤/2) 内算
  "vs": "运动|杂技",                                           // 对抗分支:目标择优自动( Athletics/Acrobatics 熟练自动解析)
  "combatants": "洛克,缇娜,哥布林甲",                          // 先攻:dex 全自动解析
  "budget_offset": 1 }                                        // 本回合已耗位(回执中继,施法连发)
```
**输出**：结果行 + 全链明细（攻检/逐目标伤害/抗性应用/建议新 HP）+ 分支回执（濒死=新计数;施法=建议余量;先攻=排序表）+ footer 梗概铁则。
**报错**：无位（RAW 强制）/ 专注冲突（附"弃旧或改施"选单）/ 目标不可解析 / 缺必填。

**如实声明的边界（不自动化,记档）**：
1. **升环增值**：源库无 machine-readable 字段——DM 照法术正文传显式 `dice`（转写非计算）；
2. **怪物攻检/伤害**：statblock 正文承载——DM 照抄传 `modifier`/`dice`（转写非计算；未来可选 assembler 正文抽取,有解析风险,不做）；
3. **特征骰条件**（偷袭是否满足优势/ adjacency）：DM 判断后经 `extra_dice` 传入；
4. **种族/特征重骰**（半身人幸运等）：DM 判定后二次调用取后值；
5. **离手武器/双持后手**（无属性调整值）：`weapon` 解析+`modifier:0` 覆盖表达。

**场景例**（2026-09-19：塔厅 R2,一回合两链）——玩家:"洛克贴柱绕到侧面,射那持盾的!"(洛 dex16+3,prof+2;无优势=DM 判侧翼不构成 2014 flanking)→
roll(`purpose:"攻击"`, `who:"洛克"`, `weapon:"短弓"`, `target:"哥布林甲"`, `context:"塔厅缠斗,洛克绕柱射短弓压制哥布林甲"`)→
回执:`d20+5=20 nat20 必中+暴击 → 2d6+3=9 穿刺 → 哥布林甲 HP 7→0(建议倒下,余量<max 非即死)`——DM 织克敌叙事;
同轮 DM 推演缇娜(独立人格):圣火术支援→roll(`purpose:"施法"`, `spell:"圣火术"`, `as_level":0` 修!戏法 level=0, `caster:"缇娜"`, `targets:"哥布林乙"`)→
回执:`位检豁免(戏法)✓ · DC13(8+2+3) · 目标 DEX 豁免 10<13 失败 → 8 光耀 → HP 7→0(建议倒下)`。
结算段:rest(见 §九例)。

## 三 · attack——攻击链（叙事段 · context 必填）
命中判定→伤害判定（nat20 自动翻骰）→抗性应用。**输出增量,无目标 HP 绝对值**;死活=DM 单步叙述+尾代终写;怪攻击=DM 照 statblock 转写 modifier/dice。

## 四 · cast——施法链（叙事段 · context 必填）
闸区三检（位表/升环/专注冲突;ritual 豁免）→豁免法术逐目标 save 循环（half_on_save 自动;DC 内算）→伤害判定（增量）。法术攻击型走 attack。

## 五 · damage——纯伤害（叙事段 · context 必填）
无攻击检定的伤害结算（坠落/环境/手动转写）。

## 六 · initiative——先攻（叙事段 · context 必填 · 开战一次）
全员 d20+DEX 排序（同刻组标注）→序列表（尾代转录进 state.md 战斗节）。

## 七 · death——濒死（叙事段 · context 必填 · 每角色每轮一次）
raw d20→新计数回执（读面板计数不陈旧）,封顶3;稳定/死亡建议。

## 九 · gain_exp / gain_money——尾面级联工具

- **gain_exp(who, exp)**：经验落账+升级级联（阈值表内置[BR p.13]；PB/特征查 lore classes 等级表/HD+1/HP 均值+CON/位表与 **resources 池上限**（class_specific 列）更新/pending 标记）。增量来自叙事声明——本工具不重算怪 XP。
- **gain_money(who, direction, amount)**：钱款落账（统一 cp 核算+三栏规范化）。**不拒绝负余额**——忠实落账+回执警示；支出前的钱包核对是叙事代理的提示词纪律（快照可见）。数额来自叙事声明。

## 九·B · rest 消亡记录（2026-09-19 v7）

主面 rest 计算器撤销——休整落账归尾代理直接编辑：长休（HP→上限/HD 回「等级÷2↓(≥1)」/位表回填查 classes 等级行/力竭−1 须饮食/temp 清/专注清/last_long_rest=完成时刻记队伍节）与短休（生命骰掷骰走 **damage 工具**治疗语境复用+尾代直接编辑）。规则依据=runtimeRead rules/resting.md（两级查询模式）——规则仍在语料，不再复制进工具。

## 十一 · front_commit——前端决策通道（非 LLM 工具）

玩家点选（无对话、无 LLM 参与）→ 校验 → 窄写 `characters/<名>.json` → 清 pending → JSON 回执给前端；LLM 下一回合注入只见新值。

**输入**：
```jsonc
{ "op": "asi",    "who": "洛克", "payload": { "stat": "dex", "plus": 1 } }          // 对照 pending 白名单:属性/次数/上限20
{ "op": "spells", "who": "缇娜", "payload": { "learned": ["灵性武器"], "prepared": ["灵性武器"] } } // 对照职业等级表校验
```
**输出**：`{ ok, panel 新值, pending 清除结果 }`；**报错**：无 pending/超上限/非法项/重复加点。
**性质**：opening_commit t=0 出生例外的泛化——**无判断落盘道**（与尾代同属"零判断写手"二元：尾代=叙事事实,front_commit=前端机械决策）。

## 十二 · 不设工具（对照清单）

判定时机/DC 选档/优劣势来源/摆位/态度/灵感授予/意图翻译/叙述 = **LLM 判断**；时间推进/状态衰减/combat 维护/gear 转录/新实体建档 = **尾代直改**；任务选择/HD 花几枚 = **对话内声明**（叙事动作,非分配面板）。

## 十三 · 收缩史（备查）

initiative→独立（分裂后）；consume→cast 闸区；encounter→撤（LLM 查表粗算）；craft/lifestyle/loot→无二期；rolls.log→撤（回执中继+transcript 审计）；**advance/trade→status_update 原子吸收（v6）**；双面工具→无需求（agents 字段保留口）。**演化终态（v7）：主面骰算 6 + 尾面级联 2 + 前端 1 + 直接编辑。**

## 九 · 预期逻辑与回执模板（实现设计 · 2026-09-19——照此直译成代码）

### 通用件
- **随机数**：`seed` 参数缺省时用 `crypto.randomInt`;给了 seed 则用 LCG(xorshift)——单测重放。
- **面板读取**：`characters/player.json`（固定名）或 `characters/<who>.json`;解析=JSON.parse,坏文件即结构化报错（fail-loud）。
- **lore 读取**：`dnd5e-srd-lorebook/<类>/<slug>.md` frontmatter（简易解析:---块内 key: value/列表）;职业等级数据=解析 `classes/<class>.md` 正文表行（`| LV | PB | Features | {json} |` 的 JSON 列）。
- **回执编号**：无序列号（工具无状态）;回执自述（who/what/target）,转录顺序=transcript 顺序。

### roll 逻辑（按 purpose 分派）
```
前置: 解析 who(默认玩家)→读面板;修正值=stat/skill 引用解析(属性调整值+PB(熟练)+PB(专精)+
      statuses.effect 中 attr 匹配项) 或 modifier 直值;两者皆缺→报错。
判定/豁免: dc 必填;d20(按 mode 取高/低)+mod ≥ dc → 成败;回执含分解。
攻击链:   target 必填→敌/友行(ac/path)或角色档(name 兜底,AC 律=core.deriveAC 单源)——
          查无且未传 ac→报错(2026-09-25 咽喉化:斩静默默 10);ac 直值=转写逃生舱(回执标来源);
          weapon(默认持位)→equipment frontmatter(伤害骰/类型/灵巧/射程);
          攻击属性=灵巧?max(str,dex):近战 str/远程 dex;prof=weapon_prof 命中类别;
          d20(mode)→nat20 必中+暴击/nat1 必失;
          命中→伤害骰(暴击×2 枚)+stat 调整(除非 modifier:0 表达后手)+extra_dice(暴击同翻);
          伤害类型查目标 resist/immune→减半↓/加倍/归零;
          回执: 攻检行+伤害行+目标 hp 现值→建议值(≤0 标濒死;余量≥hp_max 标即死)。
施法链:   spell→spells frontmatter(level/ritual/concentration/save/half_on_save/damage/attack_type);
          ritual→跳位检(回执注明+10min);位检: slots_lN-budget_offset ≥1→否则报错(附余量);
          专注冲突: 该法术 concentration && caster.concentrating→报错(选单:弃旧/改施);
          施法 DC=8+PB+施法属性调整值;attack_type→走攻击链(dice=frontmatter,升环 DM 显式覆盖);
          save→逐 target: d20+目标豁免加值(怪:属性调整+save_prof 命中则 PB;PC 同理;皆走
          resolveSave 咽喉,查无报错不涂 0) vs DC,
          half_on_save→成功半伤↓;逐目标建议新 HP;建议余量=slots_lN-1。
先攻:     combatants 逐名→dex(PC/同伴面板;怪=lorebook frontmatter dex)→d20+dex 排序;
          同值标⟦同刻⟧组(DM 裁内部次序);side: role∈{pc,companion}=友,否则敌。
濒死:     who 面板 death_success/fail;raw d20(无修正): ≥10 成+1/<10 败+1/nat20=建议 hp1 醒/nat1=败+2;
          ≥3 成→建议稳定;≥3 败→建议死亡;回执给新计数(封顶 3)。
专注维持: damage 必填→DC=max(10,floor(damage/2));who 的 CON 豁免;失败→建议 concentrating=null。
对抗:     who 检定(stat+skill) vs target 的 vs 列表各技能加值取最高→比大小;回执双侧明细。
```

**roll 回执模板**（语义逐行自述版,2026-09-19 修订——DM 织叙事/尾代转录都不猜数）：
```
[攻击 · 洛克→哥布林甲 · 短弓]
  命中判定: d20+5 = 18(优/劣:无) vs AC 15 → 命中
  伤害判定: 2d6+3 = 9 穿刺(暴击:已翻骰) → 抗性:无
  目标状态: 哥布林甲 HP 7 → 0(建议:倒下;非即死——余量<上限)
  ◇ 梗概:塔厅缠斗,洛克绕柱射短弓压制哥布林甲
  ◇ 铁则:骰值只裁定此刻成败,不得改写已构思的剧情走向与利害
```
施法链模板（同结构多一段闸区）：
```
[施法 · 缇娜→圣火术(戏法)]
  位检: 戏法免位 | 专注: 无冲突 | 升环校验: ✗(戏法)
  豁免判定(逐目标): 哥布林乙 DEX d20+2 = 10 vs DC13(8+PB2+WIS3) → 失败
  伤害判定: 8 光耀(half_on_save:否,失败全伤) → 抗性:无
  目标状态: 哥布林乙 HP 7 → 0(建议:倒下)
  ◇ 梗概/铁则: …
```

### trade 逻辑（已消亡——存档:找零/查价思路由 status_update('cp') 与 lorebook 转写继承）
```
解析 buys/sells(逗隔;"名 xN"、"名@价"、"名 xN@价")→逐项:
  买价=equipment frontmatter cost(解析为 cp:gp=100/sp=10/ep=50/pp=1000) 或 @价;
  卖价=@价 或 equipment cost 的一半(↓取整)——怪装备不可售/魔品难售=DM 判断不入工具;
净额=sells 总值−buys 总值;who 钱包(gp/sp/cp→cp) + 净额 <0→报错(附缺口);
建议新钱包=净额后总 cp 按贪婪分解(gp/sp/cp 最少币数);物品清单回执(尾代转录 gear)。
```
**回执模板**：
```
[交易 · 洛克] 购入 火把×5(5sp) 绳索(10gp) = 10gp5sp;卖出 短剑×2(半价 10gp)
  净付 5sp → 钱包 15gp3sp → 14gp13sp? 规范化: 14gp 8sp 5cp? → 建议新钱包 15gp 8sp 5cp(明细…)
  物品入包: 火把×5 绳索(50尺) | 出包: 短剑×2
```
（实现注:回执数值全部由工具算好,DM 只转述;尾代照抄。）

### rest 逻辑
```
kind 分派;targets=who 或扫描 characters/(role pc+companion);
读 state.md frontmatter(time_day/hour)+`last_long_rest`(队伍节,缺=从未);
长休校验: 逐人 hp≥1;now−last ≥24h→否则结构化拒绝(附剩余小时);
长休结算: hp→hp_max;HD 回 min(level, floor(总HD/2))≥1;位回满(全施法者位表常量,按 class+level);
  力竭−1(须 food_water,否则警告不动);temp_hp=0;concentrating=null;
  回执建议: 时间+8h;牧师/法师提示"可换准备表(front_commit prepare)";
短休结算: 逐人按 hd_spent[名] 掷 d(职业 hit_die)+CON 累计→hp=min(hp_max,hp+总);
  hd_available−=spent;短休池回充(扫 resources 行按名回充 max:战士 action_surge/second_wind、
  法师 arcane_recovery,附 1/日注:回复日旗记 state.md 时间敏感项,同日不重充);
  回执建议: 时间+1h。
```
**回执模板**（长休例）：
```
[长休 · 全队] 校验✓(HP≥1 · 距上次 26h)
  洛克: HP→22/22 · HD 1→2(+1) · 位回满 · 力竭 0
  缇娜: HP→8/8 · 位 2/2·1/4 回满 | 可换准备表
  建议时间推进 +8h(尾代);建议 last_long_rest=完成时刻(收益时点)
```

### advance 逻辑（已消亡——存档:阈值表与升级块由 status_update('exp') 级联继承）
```
gain 逐怪→monsters frontmatter xp 求和;或 xp 直值;share=floor(总/|who|)(余数舍);
who 默认全队;逐人: exp+=share;查阈值表(20 行常量)→可多级连升;
升级块: level+1;PB 按级;新特征=解析 lore classes/<class>.md 表行(旧级+1→新级 Features 列);
  HP=hp_mode(掷 d(hit_die)+CON / 均值 floor(die/2)+1+CON);HD_available+1;
  施法者位表更新(全施法者常量);ASI 级(4/8/12/16/19+战士 6/14+盗贼 6/10)→pending 追加
  "LV N·ASI 点选";法师升环→pending 追加"新法术×2";
未升级→回执仅 exp 旧→新+距下级余量。
```
**回执模板**：
```
[经验 · 战斗结算] 哥布林50×2+持盾哥布林100 = 200 XP ÷ 3人 → 66/人
  洛克 exp 750→816 (距 LV4 84) —— 未升级
[经验 · 升级] 洛克 exp 900→966 → LV4!
  PB +2→+3 · 特征新获: 无(盗贼 LV4=ASI) · HP+6(均值5+CON1) → 28/28 · HD+1
  ⬜ pending: LV4·ASI 点选(前端) —— DM 下回合宣告
```

### front_commit 逻辑
```
op=asi:   校验 pending 含 ASI 项;payload.stats 合计 ≤2(或 plus 单值);目标属性 <20(超出→报错);
          应用 str..cha += x;若 con 变化→hp_max += level(追溯每级);清该 pending 项;回写 JSON(parse 往返)。
op=spells: 校验 pending 含新法术项;learned 逐名→lorebook spells/<slug> 存在性;数量=表额(法师+2);
          spells_known 追加;prepared ⊆ known 校验后追加;清 pending。
op=prepare: prepared ⊆ spells_known(牧师=可准备池语义);数量 ≤ 等级+施法属性调整值;整体替换 prepared。
输出: {ok, updated:{字段:新值}, pending:[剩余], } ;坏 JSON/校验失败→{ok:false, error, hint}。
```
**回执模板**：
```json
{ "ok": true, "who": "洛克", "updated": {"dex": 13, "hp_max": 22}, "pending": [] }
```
