# 面板一致性与直写工具体系(v1 分析稿 · 2026-09-25)

> 性质:**提案层,尚未实施**——待 P0 实证(E2E)后拍板。若采纳,将替换 design_zh「工具归属·2026-09-22 修订」所立的主面零写盘契约、tools_zh v5 的无状态律/时相律,maintenancePrompt §4(时间推移检查清单)随 tick 落地而退役。
> 前置阅读:design_zh(架构)/ tools_zh(现行工具规约)/ panel-data(数据结构与值居所)/ dm-loop A 部(规则正本,BR/SRD 出处)。
> 方法:SRD/BR 全机制面 × maintenancePrompt 转录清单 × panel-data 字段表交叉普查,穷举「叙事中一切可影响面板的行为」,按一致性分级落位到目标工具体系。

## 0. 一句话主张

DM 只做判断(何时/对谁/付什么代价/结果是否已成事实),一切机械(数值/级联/折算/写盘)在工具内**当拍**完成。一致性分级:**工具读域当拍强一致,展示域回合尾弱一致**。尾代从转录员改为审计员。文本-面板分叉窗口从「一回合」压缩到「零」(工具读域)。

## 1. 现状面板体系

### 1.1 四层存储正本

| 层 | 位置 | 内容 | 写手(现行) |
|---|---|---|---|
| 人物 | `characters/player.json`(固定名)+`<名>.json` | 机件(六维/hp 族/熟练/施法/装备引用/钱包/pending/statuses)+叙事面(persona/biography 行数组);键裁剪律 | 尾代(runtimeWrite 整档)+gain_exp/gain_money(级联)+front_commit(玩家点选) |
| 世界簿记 | `state.md` | 六节(篇章/主线/支线/伏笔/玩家所在五级/时间敏感项登记表)+附近 NPC 三态名单(v4,2026-09-25)+「## 战斗」节(回合/先攻/敌行/友行)+上回合变化 | 尾代 |
| 规则 | `dnd5e-srd-lorebook/`(1164 篇) | frontmatter 机读层+正文原文;工具 join(装备/法术/怪物/职业) | 只读 |
| 叙事实体 | `locations/·quests/·items/` md | 非人物实体卡 | 尾代建删 |

### 1.2 值的四居所(不变)

存储(面板)/回执(工具返回,transcript 承载)/派生(读方现算,永不存)/参数中继(DM 下次调用入参)。v2 新增第五形态:**写据**(回执中的落盘声明行,见 §4.6)——回执从「建议值」升格为「已发生的事实」。

### 1.3 现行一致性链路与分叉点

```
正文(叙事+回执增量) ──尾代转录(回合尾)──> 面板 ──> 注入(回合初快照)/泵(HUD,mtime rev)
```

三条实测/推演的分叉缝:
1. **桥断类**:AC-10 事故(2026-09-25)——工具读档路径残缺,静默涂默认值。
2. **无据叙述类**:boss AOE 清场——非施法多目标能力没有单件工具形态,DM 逐目标 check+damage 弹幕或干脆心算直叙,面板滞后/缺失。
3. **转录漏项类**:尾代漏抄回执/单位混递(panel-data 原文自认「单位混递必错」)——回合尾 LLM 簿记的固有错误率。

另有一条结构性时差:注入器给 DM 的是**回合初快照**,工具读的是**文件实盘**——两者本来就不是同一张图。写据行成为回合内面板漂移的唯一可见通道(§4.6)。

## 2. 全量行为普查(叙事→面板,38 项)

一致性级:强=工具读域(当拍写);弱=展示域(回合尾写,尾代)。

### HP 域

| # | 行为 | 字段 | 现状 | v2 落点 | 级 |
|---|---|---|---|---|---|
| 1 | 武器攻击命中 | hp− | attack 增量+尾代 | attack 当拍写 | 强 |
| 2 | 法术攻击伤害 | hp− | cast 增量+尾代 | cast 当拍写 | 强 |
| 3 | 豁免法术伤害(全/半) | hp− | 同上 | 同上 | 强 |
| 4 | 怪物特殊能力/AOE(非施法) | hp−(多目标) | check+damage 逐目标弹幕 | **ability**(转写 DC/save/dice/targets 一次循环) | 强 |
| 5 | 坠落/陷阱/环境 | hp− | damage ✓ | 当拍写 | 强 |
| 6 | 治疗(法术/药水/HD) | hp+(钳上限;0HP 苏醒+双清) | damage 兼职掷骰+尾代;cast 治疗术只过闸不出骰 | **cast 内联(法术治疗)/heal(药水·生命骰)**——2026-09-26 来源路由律 | 强 |
| 7 | 临时 HP | temp_hp(取高) | 尾代 | cast 内联(法术来源)/hp 直改(无骰来源) | 强 |
| 8 | 0HP 时受击 | death_fail+1(暴击+2) | 叙事+尾代 | attack/damage 归并(目标已 0HP 自动落败) | 强 |
| 9 | 濒死掷骰 | death_success/fail | death 参数中继(v8.1 删字段) | **反转 v8.1**:计数回面板,death 读写 | 强 |
| 10 | hp_max 变动 | hp_max | 升级/CON 溯源=gain_exp ✓;力竭4=状态域 | 工具/apply_status | 强 |
| 11 | 即死/杂兵死 | hp=0 | DM 判断+尾代 | 工具写 0;死活判定永远 DM | 强 |

### 资源域

| # | 行为 | 字段 | 现状 | v2 落点 | 级 |
|---|---|---|---|---|---|
| 12 | 施法耗位 | slots_lN− | cast 建议余量+尾代 | cast 当拍写 | 强 |
| 13 | 专注开始 | concentrating | 尾代 | cast 当拍写 | 强 |
| 14 | 专注维持失败 | concentrating=null | 尾代 | cast 改 RAW 覆写(再施自动结束旧的)后,**concentrating 无工具读者→降级展示域**;尾代回合尾清 | 弱 |
| 15 | 专注顶替/弃旧 | concentrating | cast 报错给选单 | **RAW 覆写**(再施即结束前一个;或显式 drop 参数) | 强 |
| 16 | 职业资源池消费/回充 | features 行内已用 | 尾代直改 | 弱一致——池不喂任何工具读,留尾代(use_feature 备选 P4) | 弱 |
| 17 | 短休花 HD | hd_available−,hp+ | 尾代(掷骰走 damage) | rest(短休) | 强 |
| 18 | 长休全恢复 | hp/hd/slots/exh/temp/conc | 尾代直改(v7 拆的工具) | rest(长休):三铁轨校验+全链写 | 强 |

### 状态域

| # | 行为 | 字段 | 现状 | v2 落点 | 级 |
|---|---|---|---|---|---|
| 19 | 状态施加(15 条) | statuses+行 | 尾代 | **apply_status**(effect 映射=有界表内建;remaining 单位=DM 声明) | 强(statuses 喂 check 的 statusesMod) |
| 20 | 状态到时/递减/场景清除 | statuses− | 尾代(时间耦合) | **tick** 辖分/时/日;轮=回合边界(尾代);场景=地点切换事件 | 分/时/日强,余弱 |
| 21 | 力竭 ±级 | exhaustion | 尾代 | apply_status 族;tick 的强行军/断粮可直接写 | 强 |

### 资产域

| # | 行为 | 字段 | 现状 | v2 落点 | 级 |
|---|---|---|---|---|---|
| 22 | 钱款收支 | gp/sp/cp | gain_money(尾面) | 解封主面 | 强 |
| 23 | 交易 | 双方钱包+gear | trade 已死,查价找零=LLM 手算(心算必错项) | **trade 复活**(设计存档在 tools_zh §十三) | 强 |
| 24 | 物品给/夺/损毁 | gear± | 尾代 | gear 全量=弱;**weapons/armor 子集喂 attack/AC join=强**→give_item | 分 |
| 25 | 装备穿脱 | armor/shield | 尾代 | give_item/equip——AC 输入,AC-10 同族事故面 | 强 |

### 成长域

| # | 行为 | 字段 | 现状 | v2 落点 | 级 |
|---|---|---|---|---|---|
| 26 | XP 入账 | exp | gain_exp(尾面) | 解封主面 | 强 |
| 27 | 升级级联 | level/hp族/hd/slots/pending | gain_exp ✓ | 已是 | 强 |
| 28 | 同伴 ASI/新法术宣告 | 六维/spells_known/pending 清 | DM 宣告+尾代照叙写(2026-09-24 P2 流程) | **grow**(宣告即写+清 pending) | 强 |
| 29 | 玩家点选 | 同上 | front_commit ✓ | 不变 | — |

### 战斗结构域

| # | 行为 | 动的 | 现状 | v2 落点 | 级 |
|---|---|---|---|---|---|
| 30 | 敌人/友军登场 | 档+名单/敌行 | 尾代建档(铺场回合末) | **spawn_npc**(当场建档+presence 行,批量) | 强 |
| 31 | 先攻+开战 | 战斗节 回合/先攻/敌行 | initiative 出序列,尾代誊 | initiative 当拍写(物化敌行) | 强 |
| 32 | 回合推进 | round | 尾代(一消息=一轮) | 留尾代(弱一致,只喂展示) | 弱 |
| 33 | 战毕归档 | 敌行清/亡档删/战利品路由 | 尾代三步 | 清行+删档+路由留尾代(判断);**终态回写一步消失**(敌行瘦身后文件全程即终态) | 弱 |

### 时间与世界域

| # | 行为 | 动的 | 现状 | v2 落点 | 级 |
|---|---|---|---|---|---|
| 34 | 时间推进+随时间结算项 | 时钟/statuses 折算/计数器族/掷骰项 | 尾代 §4 清单(全卡最复杂例程,单位混递必错) | **tick**(§4.4 专节) | 强( statuses 喂 check) |
| 35 | 世界六节/任务/伏笔/所在/篇章/队伍 | state.md | 尾代 | 留尾代(用户定位:后台世界面板维护) | 弱 |
| 36 | 非战斗实体卡 | lore md | 尾代 | 留尾代 | 弱 |
| 37 | persona/biography 演进 | characters 叙事面 | 尾代 | 留尾代 | 弱 |

## 3. 一致性定律

### 3.1 工具读域 vs 展示域

判据一句话:**字段不新鲜会不会污染下一次工具计算?** 会→工具读域(当拍强一致);不会→展示域(回合尾弱一致,尾代照旧)。工具读域清单:hp 族/death 计数/slots/concentrating/statuses/六维/熟练表/armor·shield/wallet/exp·level/hd/weapons。边界案例=时间:rest 的 24h 铁轨读它→rest 结算时自读自写;tick 是它的例行写手。

### 3.2 写权判据(W1–W5,对应旧 A/B/C 罐头判据的写维扩展)

- **W1 数值机械**:写=回执自身计算的纯函数,零判断入写。
- **W2 单一居所**:字段一个家,回合内该工具是唯一例行写手;尾代只核对不例行重写。
- **W3 回执即写据**:每个写在回执里带不可误认的落盘行,transcript 就是审计链。
- **W4 可回滚**:写在 send-moment autosave 覆盖半径内(engine 钦定 retry point),不出 runtime/ 围栏。
- **W5 判断不入写**:事件是否发生=DM 叙事+铁则;工具绝不发明数值;转写逃生舱保持显式+标记。

引擎侧既有底牌:卡工具排他执行(kernel barrier,同回合天然串行);回尾闸门(尾代读到的必是写后状态);mtime rev 面板(写盘即上屏);agents 字段免费支持双面。

### 3.3 三层防线

1. **前置(prompt 纪律)**:systemPrompt 从「一切掷骰走工具」升格为「**一切改变面板数值的叙述,先调工具再落笔**」;末行数据小结扩为对账锚。
2. **当拍写(工具层)**:普查内工具读域行为当拍落盘。
3. **兜底(尾代=审计员)**:三方对账——回执写据↔盘上事实↔正文叙述。**孤儿写据**(写了没叙)与**无据叙述**(叙了没写)都报警+修复。防线 1 被 DM 绕过时,分叉只存活到回合尾。

## 4. 目标工具体系(v2 名册)

### 4.1 名册总表(主面 17 件+前端 1+尾代固定件)

**判定/结算二分律(2026-09-26 修正)**:写不写不取决于「是不是骰算件」,取决于「结果本身是不是面板变动」——判定件(check)零写盘,其后果各归结算件;结算件(attack/cast/damage/heal/death/initiative)的回执数字本身就是面板变动,写盘只是落进唯一居所。

**分期拍板(2026-09-26,再修订:damage 语义拆分)**:一期 = check/attack/cast/damage/heal/hp/initiative/death(七件骰算直改)+ gain_money/gain_exp 双面解封 + **spawn_npc(主尾双面,新件)**,共 11 件;余下新件(ability 起)全部二期,普查落点(§2/本表)不变,按需逐件上。spawn_npc 必填律:`name`(身份键,同名报错)+`stance`(三态,role 派生);**全参 LLM 亲自输入**(runtimeRead 怪物卡→照原文填参,读卡即认知+参数即审计),`from`=可选镜像校验锚;**出生即完备律**见 §4.5;`count` 天干批量;只写档+presence 行,不写敌行(宣战归 initiative)。

| 件 | 来源 | 一次调用走完 | 写 |
|---|---|---|---|
| check | 升级 | d20 判定/豁免(**补 save_prof 解析**)/专注维持 | **零写盘(判定件)**——专注失败的清理由 cast RAW 覆写吸收,concentrating 降级展示域 |
| attack | 升级 | 攻击链 | hp(档);0HP→濒死计数起算 |
| cast | 升级 | 施法链(闸+攻/豁免) | slots/concentrating/hp |
| **ability** | 新 | 怪物能力/非施法 AOE:转写 DC/save/dice/targets→逐目标豁免+伤害+写盘 | 逐目标 hp |
| damage | 拆分重构 | 世界伤害掷骰(坠落/陷阱/环境/手动结算)——**不与 attack/cast 连用** | hp |
| **heal** | 新(拆分) | **非法术**治疗掷骰(药水/生命骰逐枚);法术治疗归 cast 内联 | hp/濒死计数 |
| **hp** | 新(拆分) | 无骰直改(剧情定量/回满)——**永不作修正器,与掷骰件互斥** | hp |
| initiative | 升级 | 先攻排序+**开战物化** | 战斗节 回合/先攻/敌行(从敌对名单+参战点名) |
| death | 升级 | 濒死掷骰 | death 计数(读写,反转 v8.1) |
| **spawn_npc** | 新 | 建档+名单登记(批量):全参 LLM 照语料亲自输入(读卡即认知+参数即审计),from=可选镜像校验锚 | characters/<名>.json+presence 行 |
| **apply_status** | 新 | 状态施加:15 条状态表内建 effect 映射;remaining 单位 DM 声明 | statuses/exhaustion |
| **tick** | 新 | 时间驱动结算(§4.4) | 时钟/statuses/计数器族/力竭/钱包(日费) |
| **rest** | 新(v7 撤件复活) | 长休三铁轨+全链/短休 HD+池回充 | hp族/hd/slots/exh/temp/conc/last_long_rest |
| **trade** | 新(存档复活) | 买卖双方:查价合计+10:1 找零+物品进出 | 双方钱包+gear |
| **give_item** | 新 | 物品/装备转移 | gear/weapons/armor/shield |
| **grow** | 新 | 同伴成长宣告落地 | 六维(CON 溯源 hp)/spells_known/pending 清 |
| gain_money | 解封 | 钱款级联 | 钱包 |
| gain_exp | 解封+扩参 | XP 入账(直值 / **foes 战果通道**:档读 lv→XP 查表、Σ、均分 floor 弃余——DM 零算术,吸收死档 advance 的求和半体;xp 不落档=派生不存)+升级级联 | 成长面 |
| front_commit | 前端不变 | 玩家点选 | — |
| runtime* 读对/写对/删 | 尾代不变 | 审计与展示域维护 | — |

成本坦白:主面 8→17 件,schema 面约 +2k token 常驻。聚合判据不变(「总是一起调才合并」「一次调用走完一个叙事事件」)——ability 循环全目标、trade 双方一次、tick 全清单一体,弹幕化红线不破。

### 4.2 骰算六件升级要点

判定/结算二分:check 零写盘,余五件写。attack/cast/damage 增 `target`(写盘定位,走 resolveTarget 咽喉);0HP 受击自动落败计数(暴击+2);**cast 专注顶替改 RAW 覆写**(再施专注法术自动结束旧专注——现行报错闸比 RAW 严;覆写后 concentrating 无工具读者,降级展示域,专注破碎的清理归尾代回合尾);check 豁免分支补 save_prof(cast 的 resolveSave 同律收拢,纯读);death 计数读写化(v8.1 参数中继反转);initiative 增开战物化。

### 4.3 heal 语义(缺口闭合)

> **2026-09-26 修订**:本节为初稿,定稿见 §9「damage / heal / hp 三件套」——heal=**非法术**治疗掷骰件(药水/生命骰);法术治疗归 **cast 内联**(来源路由律);temp 模式取消(法术来源 cast 内联/无骰来源 hp 直改)。

治疗术在 cast 下只过闸不出骰、掷骰靠 damage 兼职、落账靠尾代——三段拼接。heal 收拢:dice+modifier→hp=min(hp_max,hp+N);目标 hp 起点为 0→苏醒+death 计数双清(RAW);temp 模式→temp_hp=取高;短休 HD=rest 内部复用本链。

### 4.4 tick:时间驱动结算专节

**将 maintenancePrompt §4 整节机械化吸收**(全卡最复杂、单位混递必错的尾代例程)。

```
tick(Δ:"2小时"|"1天"|"3天", food:full|half|none, water:full|half|none, forced_march_hours:N, lifestyle:档位?)
```

结算清单(给定 Δ 与声明,全部机械):
1. **时钟重写**:state.md 当前时间行(第N日·H时)。
2. **statuses 折算**:分/时/日单位按 Δt 递减,到 0 删行;变化日志行。
3. **计数器族**(时间敏感项登记表为工作集):绝食日计数(无食超 3+CON 天→每日末力竭+1)、缺水(half→每日 CON DC15 失败+1/none→自动+1)、疾病/毒时间轴、downtime 进度、奥法回复 1/日重置、冒险日预算重置、长休窗口判定(last_long_rest≥24h→报告行提示可休)。
4. **声明驱动的掷骰项**:强行军每小时 CON DC10+超时数(失败力竭+1);缺水豁免。掷骰与力竭写入一体。
5. **钱联动**(可选):lifestyle 日费(与 gain_money 同 cp 律)。
6. **不辖**:轮单位 statuses(回合边界=尾代,一消息=一轮);场景单位(地点切换事件);temp_hp/力竭恢复(rest 辖)。5e 无自然回血——时间驱动的恢复全部走 rest,tick 只辖纯时间项。

回执:变化日志 N 行(字段 旧→新 | 原因)+窗口/断粮警告。纪律:叙述时间流逝的同一回合必须调 tick,先调后叙。

### 4.5 spawn_npc 与铺场去结构化

**主代理当场造敌——铺场不再依赖尾代,两段制解除。**

```
旧(两段制,存在的唯一理由=转录在回合尾):
  回合N: DM 叙述战场+点名 → 尾代建行建档(回合末) → 玩家下回合给策略
  回合N+1: initiative → 接战
新(单段制):
  回合N: DM spawn_npc(全部参战者,批量) → initiative(开战物化) → 突袭判定(RAW) → 接战
```

- **玩家决策保障降为 prompt 纪律**(不再是结构强制):「战斗可在任何回合开启;每轮结束必须给玩家 2~4 个具体行动选项;首回合敌方是否先动=突袭判定」——选项纪律是既有条款,删的只是「必须空一个铺场回合」。
- **中途增援例外废除**:systemPrompt 该条款的存在理由(建档等尾代)消失,spawn 即可打。
- 与 presence(v4 三态名单)协同:spawn_npc(stance:敌对)→ 建档+presence 敌对行(持久敌意,战毕不回落——v4 语义原生吻合);敌行只在宣战时由 initiative 物化(身份+path+状态文本,见 §6)。
- 杂兵统一命名建档(哥布林甲/乙/丙式),「无名杂兵住敌行」规则废止。
- **出生即完备律(2026-09-26 拍板)**:有则必全,无则整族不生——maintenancePrompt「战斗数值建档留空,敌意回合再补」废止。战斗面(六维/hp 族/ac·甲盾/resist·immune·vuln/save_prof/weapon_prof·weapons/施法族/lv)出生必须整族带全;纯场景 NPC 照 commoner statbook 读卡后输入凡人数值;背景面(persona/biography/description)按叙事重量伸缩,无设定的怪整块不生。**怪的等级学(2026-09-26 RAW 考+设计修订)**:怪无等级无成长——CR=难度标尺、XP=玩家奖励货币(怪不挣)、PB 按 CR 查表、HP 骰按体型(rules_zh §13;5e 2014 无怪升级机制,sidekick 是 TCE 后话)——故档上刻度走**单键统一律**(见存储地图后条);怪无成长族=gain_exp 对怪即拒,恰是 RAW。NPC 双制并存:statblock 制(MM App.B,本质是怪)vs class 制(随行同伴按 PC 建,真 level+成长——本卡同伴建档现状)。模板缺口两处随手补:`vulnerabilities` 键(attack 读而模板缺)、death 计数(一期反转 v8.1 回归)。
- **入参终稿(2026-09-26,同日修订:全参 LLM 亲自输入——用户定案)**:必填 `name`(同名报错)+`stance`(三态,role 定形可变 stance 不变);**战斗面全参由 LLM 照语料亲手输入**(ac/hp/六维/**lv**(怪照 statblock 卡头抄 CR,数值原样小数合法;成长者填等级)/熟练面/抗免/速度/语言/施法族——caster_attr+spells_known+slots_lN 声明则必全)——流程=runtimeRead 怪物卡→照原文填参:数字过 LLM 上下文(跑战叙述要用,读卡即认知)+参数即 transcript 审计(静默拷贝=审计盲区),且 statbook 正文 Spellcasting 段可直读,FM 缺施法清单不再是薄点;`from` 降级为**可选校验锚**(带则对照 FM 镜像校验,不符报错列差异=强制重读;造变体「改数值不改名册」→不带 from;先例=opening_commit 白名单镜像);hp 为直输数(statblock 均值惯例,想要随机先掷后输,hp_mode 删);背景面 persona(单串或五键)/biography(单串或行数组)伸缩;`count` 天干批量;race/gender 选填。回执=落盘行(档+presence 行)+lv/XP(派生)/pb 摘要。
- **存储地图(2026-09-26)**:语料=类(`dnd5e-srd-lorebook/monsters/*.md`,只读,一个 goblin.md 可孵化哥布林甲/乙/丙多个实例;commoner/veteran/mage 等类人卡即 NPC 底版)· 活档=实例(`characters/<名>.json`——怪/同伴/NPC/玩家同目录同 schema,玩家=peer 同构)· 名单=身份(state.md 三态行+战时敌行 path 指回类卡,零数值)。**怪与 NPC 的区别不在存储位置,在出生抄谁**:怪抄 statbook(LLM runtimeRead 后照原文填参,语料原样),NPC 抄 DM 叙事(persona/biography 即正本)。档上刻度=**单键 `lv`**(见下条)。
- **单键统一律(2026-09-26 用户定案,附规则核验与解释成本)**:档上唯一刻度键 `lv`——玩家/同伴=等级(整数 1–20),怪/NPC=CR(0/0.125/0.25/0.5 小数合法,上限 30)。**规则核验(SRD/BR):零矛盾**——PB 两制在 1–20 波段逐值重合(5e 拿等级标定 CR 的设计事实),单公式 `pbOf(lv)=2+⌊(clamp(lv,1,30)−1)/4⌋` 同时复现 PHB 公式(玩家段)与 DMG p.274 表(怪段;assemble 烘进 FM 的 pb 字段可 334 只逐怪交叉验证);XP 查表 key=lv——statbook NPC 照卡直读,class-NPC「CR=lv」自动成立(核心书对 PC 构造 NPC 定价沉默,卡内约定,数值 DM 可调);CR0=10 为卡内简化(SRD 有「无害者 0」注脚)。**一处施工修正**:现 core `pb()` 的 min(level,20) 会在两端皆错(0.25→+1 虚低;CR21+ 封顶 +6 错杀 +7..+9),pbOf 须 clamp(1,30)。**LLM 解释成本:降不升**——spawn schema 一行(「lv:等级或 CR,怪照 statblock 卡头抄,数值原样」),prompt 零新增(表与公式全在 core,死规则唯一载体=脚本);叙事措辞自由(怪称 CR、成长者称等级,显示层按成长面有无换标签);**单键消灭填错位事故面**(两键案存在「怪误填 level 致 pb 虚低」失败模式,单键无处填错);化妆级噪音一条:注入面板裸现 `lv: 0.25`,语境自明。
- **与 NPC 对战的结算矩阵**:人打怪=玩家档攻侧(PB←level)+怪档防侧(ac 直值)→写怪档 hp;怪打人=攻侧转写+玩家档 AC(deriveAC)→写玩家档;怪吃豁免=怪档六维+save_prof+**PB←pbOf(lv)**;怪施法=档内施法族(见薄点);0HP 按 role 分叉(pc/同伴→濒死计数起算,怪/npc→RAW 默认即死 DM 判);**击败 NPC 的 XP(2026-09-26)**:XP 唯一档上载体=lv——statbook NPC 照卡直读,class-built/转写 NPC 核心书无硬规则、卡内约定 lv=等级(DMG 工坊精神,数值 DM 可调),构造差异被出生时一行 lv 吸收;战毕=**先结算后清理**:`gain_exp(who=参战名单, foes=被击败名单)` 在胜利回合由主面调用(亡档未删,档读 lv→**core 内嵌 XP 查表**(key=lv,含小数档)派生——xp 不落档,派生不存,单一路径→Σ→均分 floor 弃余→逐人级联,回执全透明;遭遇乘数只评难度不进发放=RAW,工具化后该经典错误结构性消灭;谁算参战/哪些算被击败=DM 判断,非致命/说服取胜走 foes 或 exp 直值;忘结算而档已删→报错+exp 直值兜底);随后尾代清场四件=敌行清+亡档删+**presence 行同步删**+战利品路由。无成长族者入 who 名单→照键裁剪律报「无成长面」;milestone 是 RAW 替代制但本卡 D4 定纯 XP 轨不开。**两个薄点如实记**:①~~statbook FM 不带施法清单~~(全参输入制下已消——LLM 直读 statblock 正文 Spellcasting 段输入施法族;FM 缺仅影响已废的自动填充通道),怪的类法术能力(吐息等)系统解法仍是二期 ability;②怪攻击侧永远转写(statblock 动作列散文,既有边界)。
- **与 opening 体系的关系(2026-09-26 对照定案)**:同一台「出生机」五步(声明→查表→组装→裁剪→写盘+可考回执),三个内核必须分立——构造知识源(职业表 classes/*.md vs 怪物块 monsters/*.md)、校验性态(opening=白名单镜像防玩家作弊 vs spawn=完备律防声明残缺)、成长面开关(玩家 ON/NPC OFF)。汇合三层:①opening-meta 即「class-built NPC」的知识底座——复杂剧情 NPC(对手法师 LV5 式)走 spawn 第三通道 class+level 复用其全套表(二期+ 候选);②**机械层共享清单(2026-09-26 定案)**:stripEmptyArrays(裁剪律落地)/classRow(序数词版单源进 core,兼修 gain_exp 病)/readFM(opening 本地副本退役)/写盘+可考回执规约——收拢 core(YAGNI 门槛已过:第二消费者出现);**构造器三件分立**:职业表构造器(opening,玩家/class-NPC:真 level+成长 ON+白名单镜像)·怪物块构造器(spawn,怪:lv=CR 直值+成长 OFF+完备律)·转写直通(即兴)——共用材料机,不共用填料器;③**gain_exp 的 classRow 纯数字正则 vs SRD 序数词等级列(| 1st |)永不匹配,升级回执特征行恒 '—'(2026-09-26 实锤)——同律分叉第三案(AC 律→save_prof→classRow),classRow 单源进 core 即修,不必等一期**;④**opening 耦合审计(2026-09-26)**:职业轴七族耦合 solid(施法族/子职时点/技能白名单/法术池/豁免起装训练面/特征回充/HP),零跨轴——X族×Y职限制 5e 2014 本不存在,正确地零实现;**种族轴与背景轴未建**——ability_bonuses 在 FM 但四层零消费(全员出生少 +2/+1)、种族 FM 仅三键致 darkvision/languages/resist 死读(矮人丢暗视毒抗、全员丢本族语)、backgrounds/ 目录从未装配(背景授予零落地)、half-elf 的 +1+1 自选源库即散文。修复排序:属性加成(最便宜)→ assemble 补提取 darkvision/languages → 背景轴(贵,随二期 class 通道一起)。

### 4.6 回执写据规约(W3 的落地)

```
[攻击 · 哥布林乙→梅西雅 · shortbow]
  命中判定: d20+4 = 12 vs AC 17(characters/player.json) → 未命中
  伤害判定: 1d6+2=4 = 4 piercing
  落盘: 梅西雅 hp 7→4 [characters/player.json]
  ◇ 梗概: ……
  ◇ 铁则: 叙事必须尊重梗概以及结果,不得篡改!
```

- 每笔写一行「`落盘:对象 字段 旧→新 [文件]`」;不写盘的纯判定回执没有落盘行;多写多行。
- 落盘行是 DM 回合内的实盘视图(注入器只给回合初快照,工具读实盘——写据行是两者之间唯一的可见通道)。
- 尾代新规则:「**落盘行=核对不重放;回执数字无落盘行=照抄落盘(仅剩展示域);正文与回执冲突=回执为准**」。

## 5. 尾代新画像

- **对账审计(新主业)**:三方核对(回执写据↔盘上事实↔正文),孤儿写据与无据叙述双报警+修复。
- **展示域维护**:世界六节/biography/非战斗实体/round 推进/战毕清场(清行+删亡档+战利品路由)。
- maintenancePrompt 缩编预览:删 §3a 的 HP 数学与级联搬运、敌行逐笔更新;§4 整节随 tick 退役;战斗生命周期按 §6 重写。硬性要求第 2 条(照抄回执)改为三方对账规则。

## 6. 战斗 schema 定案(敌行瘦身)

```
旧: - 敌行：哥布林乙 | HP 7/7 | AC 15 | path:monsters/goblin.md | 四分掩体（拐角+岩壁）
新: - 敌行：哥布林乙 | path:monsters/goblin.md | 四分掩体（拐角+岩壁）
```

- **HP/AC 全走 characters/<名>.json**(spawn_npc 出生落 hp/hp_max/ac;AC 一并搬——行留 AC 即留第二居所,漂移必然)。行三职:身份(本战敌人)+path+情境状态文本。
- resolveTarget 优先级翻转:档案为数值正本,行供身份与状态。
- ui_data 敌卡 HP/AC 走档案 join;panelRevOf 右栏已含 characters 聚合,rev 语义不变。
- **战毕终态回写消失**(文件全程即终态);只剩清行/删亡档/战利品路由。
- 迁移面:core(foeRow/parseCombat/resolveTarget)·attack·cast·ui_data·maintenancePrompt(3b)·systemPrompt·setup 种子·HUD·测试。

## 7. 迁移计划(2026-09-26 拍板:一期不加新件——6 roll+2 gain,余者二期)

### 一期(现有件改造,零新工具)

| 步 | 内容 |
|---|---|
| 0 | **E2E 实证**:最小写盘工具挂真机,测 regenerate/stop 两场景盘上行为(全案唯一硬前置) |
| 1 | 敌行瘦身(§6)——attack 写敌 HP 的 home 前置(HP/AC 全走档案,用户已定案) |
| 2 | attack/damage 当拍写 hp(0HP→濒死计数起算)+写据规约(§4.6) |
| 3 | cast 写 slots+concentrating(RAW 覆写);death 计数读写化(v8.1 反转);initiative 物化战斗节;check 补 save_prof(纯读,零写盘);PB 消费点(check/cast/resolveSave)统一切 pbOf(lv) |
| 4 | **spawn_npc(新件,`agents:['main','tail']`)**:建档+presence 行;铺场条款轻改(转录回合末备账→spawn 即备账)、中途增援例外废除;尾代 3.a 手工建档改调本工具 |
| 5 | gain_money/gain_exp 解封双面(`agents:['main','tail']`)——其回执「文件已更新」行即天然写据;gain_exp 扩 foes 战果通道(档读 lv→XP 查表——xp 不落档,Σ+均分,DM 零算术;core 收 XP 查表(key=lv,小数档)+pbOf 单公式) |
| 6 | maintenancePrompt 重训(**落盘行=核对不重放**——防双重扣血,龙骨;gain 条款同步改「主面已调则不重调」)+ systemPrompt 工具纪律升格(先调后叙;顺手清「静默 AC 10」陈旧句) |
| 7 | 测试+工作区同步 |

### 二期(新件,按需逐件上)

ability/heal/apply_status/tick/trade/give_item/grow/rest;maintenancePrompt §4 随 tick 退役;铺场**两段制解除**(游戏性决策——spawn_npc 已进一期,结构闸只剩 prompt 文本,解除与否实施时拍板)。各件设计见 §4.1/§4.3–§4.5,不因分期改动。

## 8. 风险与开放问题

1. **regenerate/stop 语义**(P0 硬前置):流式中工具已跑、回合被弃→写留盘上。兜底=send-moment autosave 恢复+尾代对账;护栏粗细由实证结果定。
2. **schema token 成本**:主面 8→17 件,约 +2k 常驻。已按聚合判据压到最窄(ability/trade/tick 皆为合并形态)。
3. 边界案例待定:spawn 的 statblock 字段面以 assemble 产物为准实施时核对;时间与 rest 的窗口联动(tick 提示、rest 消费)。已结:①杂兵即死判据=档上 exp 键(有=濒死起算/无=即死,gain_exp 同源,2026-09-26);②专注顶替=RAW 覆写(2026-09-26,连带 concentrating 降级展示域、check 保持零写盘);③双持后手=attack.off_hand 布尔(SRD Two-Weapon Fighting)。
4. 文档考古层清理:tools_zh §二/§九 mega-roll 遗骸与「建议新 HP」旧描述;systemPrompt「attack 静默 AC 10」陈旧句(2026-09-25 咽喉化后已失真)。

## 9 · 一期工具 schema 终稿(逐件过审,2026-09-26 起)

**九件通用 description 骨架(三段式)**:什么情况调 → 怎么填 → 预期效果——顺序即 LLM 决策顺序;各工具只说自己的事(不替别的工具描述职责)。
**「怎么填」分段纪律(2026-09-26 用户定案)**:该段=基线一句话+特殊通道/覆盖逻辑;参数默认值、类型、格式细节归各参数自己的 description,不在段内复读——纯判断参数(mode/cover 类)的行为准则也只在参数 description 里。
**来源路由律(2026-09-26 用户定案)**:同一事件的生命变动只走一件工具,按来源路由,禁止连用——武器(有攻检)→attack;法术(有施法闸,**含治疗数值与自动伤害**)=cast 内联;世界伤害(无攻检无施法)→damage;非法术治疗(药水/生命骰)→heal;无骰剧情直改→hp。两重禁令:连用=双重结算(同事件走两件,血扣两次);**hp 永不作修正器**——已结算结果不得用它改写(篡改骰果=铁则违反)。尾代对账把「同回合同目标双重落盘」列为报警项兜底;连带硬约束:cast 线必须内联治疗型与自动伤害型分支,不得靠 heal/damage 接龙。
**required 机制**:per-property `required: true`(引擎隐式 object 根),编译为线上标准 required 数组;不写=选填。
**三选一/条件关系的归属**:跨参数互斥 DSL 不支持(oneOf=单参内分支),落 description 教学+运行时 err;err=结构化报执(`!`前缀+exit 1),LLM 收到自纠——全工具族已验证形态。

### check(判定件,零写盘)——终稿 v2

```jsonc
{
  "description": "单次 d20 检定结算器——一切判定类掷骰必经本工具。什么情况调:结果不确定且带后果的当口——①技能检定(说服/察觉/隐匿);②纯属性检定(破门/掰腕);③豁免检定(法术/毒素/陷阱/坠崖,传 save:true+stat);④专注维持:专注中受伤→只传 damage(内部自动按 CON 豁免解析,DC=max(10,⌊伤/2⌋) 自动算,不填 dc);环境现象(浪打/颠簸)→stat:'con'+save:true+dc;⑤对抗检定(擒抱/隐匿对察觉/抢夺):双方各调一次,dc 都不填,回执只报骰值,你比大小;⑥群体检定(全队潜行):每人各调一次(照常填 dc),过半成功=全队成功,你数数。怎么填:context=一句已定型的剧情梗概(必填,骰值只裁成败、不得覆盖走向);能力来源三选一——用技能→skill(自动解析属性+熟练+专精+状态)、纯属性或豁免→stat(只加属性调整值;save:true 时豁免熟练命中则加)、面板外临时加值→modifier(直值或骰式,祝福类+1d4 写 '1d4')。预期效果:回执给 d20+修正=总值的完整分解与成败(dc 缺省时只报总值),成败即最终事实、后续剧情必须遵守。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概(反作弊铁则):从上次玩家消息到本判定点之间你对剧情走向的承诺,骰值只裁定此刻成败、不得覆盖它。" },
    "who": { "type": "string", "description": "检定者姓名(默认玩家),按名读面板。" },
    "skill": { "type": "string", "description": "技能名(隐匿/说服/察觉等)——凡用技能的检定都填它,自动解析属性+熟练+专精+状态。" },
    "stat": { "type": "string", "description": "裸属性 str/dex/con/int/wis/cha——不用技能的检定(破门/掰腕),或豁免时与 save:true 连用。" },
    "save": { "type": "boolean", "description": "豁免标记——法术/毒素/陷阱豁免传 true(配 stat):修正=属性调整值+豁免熟练(面板 save_prof 命中则加)。" },
    "modifier": { "type": "string", "description": "面板外临时加值——直值('-2'/'3')或骰式('1d4',祝福/指引类),回执分解单列。" },
    "dc": { "type": "integer", "description": "难度标尺 5极易/10容易/15中等/20困难/25极难/30近乎不可能。两类不填:对抗(比大小)、专注受伤(damage 内算)。" },
    "mode": { "type": "string", "description": "优劣势 normal|adv|dis,默认 normal。来源判断=DM(空间/隐形/伏击),多源不叠、优+劣抵消。" },
    "damage": { "type": "integer", "description": "专注维持·受伤入口:传了本参即专注判定,内部自动按 CON 豁免解析(属性+豁免熟练),DC=max(10,⌊伤/2⌋) 自动算,不填 dc。环境现象(浪打/颠簸)不传本参,改走 stat:'con'+save:true+dc。" }
  }
}
```

回执:`[判定 · {检定者}{ · skill}{ · 豁免}]` + `判定: d20{+修正} = {总值} vs {DC|专注维持 DC(=max(10,⌊伤/2⌋))|——无 DC,与对侧比大小} → 成败` + `修正: 分解`(豁免熟练入分解)+ 梗概/铁则 footer。**无落盘行**(判定件)。

err 清单:`!缺必填 context(剧情梗概——反作弊铁则)` / `!缺修正值来源:skill/stat 或 modifier 三选一` / `!save:true 须配 stat` / `!角色不存在:{who}` / `!角色无属性键 {stat}`。

对现状代码的变更:①删 auto 参数——damage 自带专注语义(受伤入口),环境现象走 save+stat:con+dc;②+save:true 豁免熟练解析(补 DM 心算洞);③dc 改可选——对抗两次调用有真入口(原 dc 必填拦死);④modifier 兼收骰式(bless/guidance 1d4 工具代掷);⑤description 三段式+对抗/群体首次教学(原 systemPrompt 零提及、规则本体躺语料 ability-checks.md 没人教);⑥内部 pb→pbOf(level)。

**返回值全枚举(2026-09-26 定稿)**:成功=Exit 0,**五行固定结构**(标题/判定/修正/梗概回显/铁则);错误=Exit 1 单行 `!`。check 永无落盘行(判定件)。

① 技能检定(skill):
```
[判定 · 梅西雅 · 隐匿]
  判定: d20+5 = 18 vs DC 15 → 成功
  修正: dex+3 · 熟练+2
  ◇ 梗概: 梅西雅贴着矿道岩壁潜行,避开哥布林哨位
  ◇ 铁则: 后续剧情必须遵守梗概以及判定结果，不得篡改！！
```
② 纯属性检定(stat)——标题无技能段:
```
[判定 · 洛克]
  判定: d20+3 = 8 vs DC 15 → 失败
  修正: str+3
  ◇ 梗概: 洛克徒手掰开锈死的铁闸
  ◇ 铁则: 后续剧情必须遵守梗概以及判定结果，不得篡改！！
```
③ 豁免(save:true+stat)——标题带「· 豁免」,修正多豁免熟练:
```
[判定 · 梅西雅 · 豁免]
  判定: d20+3 = 11 vs DC 13 → 失败
  修正: con+1 · 豁免熟练+2
  ◇ 梗概: 毒镖擦过梅西雅小臂,毒素侵入
  ◇ 铁则: 后续剧情必须遵守梗概以及判定结果，不得篡改！！
```
④ 专注维持·受伤(damage)——DC 带公式来源:
```
[判定 · 梅西雅 · 专注维持]
  判定: d20+3 = 15 vs 专注维持 DC 10(=max(10,⌊12/2⌋)) → 成功
  修正: con+1 · 豁免熟练+2
  ◇ 梗概: 哥布林的箭擦中维持祝福的梅西雅,她咬牙护住法术
  ◇ 铁则: 后续剧情必须遵守梗概以及判定结果，不得篡改！！
```
④b 专注维持·环境(stat:con+save+dc)——同③形,仅标题带「· 专注维持」、DC 无公式尾。
⑤ 对抗(dc 缺省)——**无成败词**,只报总值:
```
[判定 · 洛克 · 运动]
  判定: d20+5 = 18 ——无 DC,与对侧比大小
  修正: str+3 · 熟练+2
  ◇ 梗概: 洛克试图擒抱夺路的哥布林
  ◇ 铁则: 后续剧情必须遵守梗概以及判定结果，不得篡改！！
```
⑥ 群体检定——与①-③完全同形,每人各调一次,无特殊返回(过半=组成功由 DM 数)。例(全队潜行,梅西雅的一次):
```
[判定 · 梅西雅 · 隐匿]
  判定: d20+5 = 9 vs DC 13 → 失败
  修正: dex+3 · 熟练+2
  ◇ 梗概: 全队趁夜穿过哥布林营地
  ◇ 铁则: 后续剧情必须遵守梗概以及判定结果，不得篡改！！
```

行内变体:优劣势双骰透明 `d20(优:14,9)+5 = 19` / `d20(劣:4,11)+5 = 9`;**nat20/nat1 不特殊标注**——判定/豁免无自动成败(RAW,自动成败是 attack 专属)。修正分解构成:技能=`dex+3 · 熟练+2 · 专精+2`;豁免=`con+1 · 豁免熟练+2`;状态命中追加 `状态-2`;modifier 骰式单列 `祝福1d4=3`(工具代掷);全无=`修正: 无`。错误路径五条见上,err 即自纠入口(模型见 `Exit: 1
!…` 重填)。

### gain_money / gain_exp(结算件,主尾双面)——终稿 2026-09-26

**主面全件 context 必填律(2026-09-26 用户定案)**:context 的职能是**剧情连贯性**,不止反骰作弊——每次工具调用=叙事锚点:调用前 DM 承诺走向,回执把「承诺+结果」钉在一起,后续叙述从此被约束(写盘件同理:钱包+15gp 之后叙事不能再说一贫如洗)。九件全带;双面件的尾侧 context=转录的事实来源(「主回合击败哥布林×3」,maintenancePrompt 重训加一句)。标准文:context 描述=「一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。」;铁则句沿用 b568b6d 统一款「后续剧情必须遵守梗概与结果,不得篡改!」——写盘件的「结果」=落盘事实;判定件可在标准文上保留骰值细化(check 现稿即是)。

**schema 写作四步法(2026-09-26 用户授,余件照此)**:①先列 agent 要完成的功能/目标与全部具体行为;②代入 agent 每种状态的视野(能拿到/需要的信息),守最简信息量原则;③行为准则建立在 agent 自身视野上,非我们的全局视野;④模拟任意状态&视野下 agent 是否有足够信息达成目标。依此修剪出三退场:机制内幕(查表过程/公式/档删时序原理)、他工具职责、主面不可为之事(「禁手改文件」——主面根本无 runtimeWrite;尾侧禁令归 maintenancePrompt)。

**prompt 冲突发现(一期重训必改)**:现行 systemPrompt「你亲手算的只有转写与单步合计:**价格合计、经验均分**、状态到时」——前两项已被 gain_money/gain_exp 接管,与新 schema「工具内算」直接矛盾,须从白名单退役(状态到时留至 tick 二期再退)。

#### gain_money 终版 schema
```jsonc
{
  "description": "钱款落账器——叙事中任何角色的钱包变动必经本工具:获得(奖励/售卖/拾金)、支出(购买/付账/生活费)。怎么填:金额写法自由(15gp、3sp、1gp5sp 或纯数字=cp),跨币换算与规范化工具内算。预期效果:钱包落盘,回执给旧→新,照它继续叙事;支出超出余额照落不阻断,回执标 ⚠(核对失误信号)。",
  "agents": ["main", "tail"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "who": { "type": "string", "required": true, "description": "角色姓名。" },
    "direction": { "type": "string", "required": true, "description": "gain(获得)| spend(支出)。" },
    "amount": { "type": "string", "required": true, "description": "金额,如 15gp、3sp、1gp5sp 或纯数字(cp)。" }
  }
}
```
回执(gain 例;spend 同形,负余额在落盘行后追加 `⚠ 负余额——核对失误信号`):
```
[钱包 · 梅西雅] +15gp
  15gp 3sp 0cp → 30gp 3sp 0cp
  落盘: gp 15→30 [characters/player.json]
  ◇ 梗概: 卖出哥布林的短弓换得银钱
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```
err:`!amount 必须为正` / `!direction 须为 gain|spend` / `!角色不存在:{who}`。变更:agents 解封双面;+context(剧情连贯律);「文件已更新」行改统一落盘行;铁则句统一。

#### gain_exp 终版 schema
```jsonc
{
  "description": "经验入账与升级级联器——一切 XP 变动必经本工具。什么情况调:两通道二选一——①直值:非战斗成就或你裁定数额(说服化解危机、探索发现)传 exp;②战果:遭遇取胜的**当回合**传 foes(被击败者名单,杀死/击倒/劝降都算、逃跑不算,你判断)——工具查表求和、按名单均分、逐人跑升级级联,乘数不进发放。怎么填:who=分账名单(逗号分隔,活着参战者,你判断;单人直传);exp 与 foes 二选一。预期效果:回执给战果算式或直值+逐人落盘行;升级时级联衍射(PB/HP/HD/位表/pending)一并落盘并列升级块。",
  "agents": ["main", "tail"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "who": { "type": "string", "required": true, "description": "分账名单,逗号分隔(如 '梅西雅,缇娜')——名单=活着参战者,你判断。" },
    "exp": { "type": "integer", "description": "直值通道:XP 增量(正整数)——非战斗成就/你裁定的数额。与 foes 互斥。" },
    "foes": { "type": "string", "description": "战果通道:被击败者名单,逗号分隔(如 '哥布林甲,哥布林乙')。与 exp 互斥。" },
    "hp_mode": { "type": "string", "description": "升级 HP 算法:avg(默认,取均值)| roll(掷骰)。" }
  }
}
```
回执三形态(直值未升级/直值升级/战果多人;升级块追加在对应落盘行后,含 PB/HP/HD/新特征/pending 标记):
```
[战果 · 哥布林甲/乙/丙 被击败]
  战果: 50+50+50 = 150 XP ÷ 2 人 → 75/人
  落盘: 梅西雅 exp 816→891 [characters/player.json]
  落盘: 缇娜 exp 720→795 [characters/缇娜.json]
  ◇ 梗概: 矿道血战,哥布林小队覆灭
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```
err:`!exp 与 foes 二选一` / `!exp 必须为正整数` / `!角色不存在:{who}` / `!{名} 无成长面(怪/纯场景 NPC 不挣 XP——从名单移除即可)` / `!查无被击败者档案:{名}——档已删则改走 exp 直值`。变更:agents 解封双面;who 单名→名单;+foes 战果通道(XP 查表 key=level 含小数档,进 core);exp 必填→互斥可选;+context;落盘行+统一铁则;内部 classRow 序数词修复(特征行恒空 bug)。

### attack(结算件·武器攻击,主面)——终稿 2026-09-26

**Review 三裁定(判据已钉)**:①**删 spell 参数**——法术攻击三处重叠(attack.spell / cast.attack_type 分支 / tools_zh「法术攻击型走 attack」旧文)收敛为一:**归 cast**(闸+攻击一体省一次调用),attack=武器攻击专用;②**modifier 只做攻检加值 + 后手立 `off_hand` 布尔**——现状 `modifier` 兼做「转写攻检加值」与「后手压制伤害属性」(tools_zh「后手 modifier:0」,且 0 被 `(a.modifier ?? 0) || …` falsy 吞、从未可靠):修为纯攻检加值、判 `!== undefined`;双持后手走 `off_hand:true`——命中照面板算、伤害不加属性调整(RAW「除非属性为负则照减」,SRD making-an-attack·Two-Weapon Fighting);③**0HP 分叉判据=档上 `exp` 键,非 role**——`role` 仅 pc|npc 二类,分不出「class 同伴(有成长面→起算濒死)」与「statblock NPC(无成长面→即死)」;判据与 gain_exp 同源(现码 `j.exp === undefined`→报「无成长面」):PC/class 同伴出生必带 `exp`,怪 spawn 不带——一处键、一处判据,零新字段。

```jsonc
{
  "description": "武器攻击链结算器——攻检、命中伤害、抗性应用、扣血落盘一次走完;一切武器攻击必经本工具(法术攻击走 cast)。什么情况调:近战/远程武器攻击——玩家与同伴照面板武器全自动,怪物照 statblock 转写。怎么填:基线只传 who+target+weapon,骰式/属性择取/熟练/AC/抗免全自动;特殊通道——怪物/即兴攻击骰式直传 dice+modifier+type(传 dice 即不走面板武器解析);双持后手传 off_hand:true;目标无档案或剧情态与档不符(如弃盾)传 ac 直值(回执标「转写」)。预期效果:回执给攻检(双骰透明)、伤害分解、抗性应用与落盘行;目标归 0 时 PC/同伴濒死计数起算、怪默认即死(死活你判)。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "who": { "type": "string", "description": "攻击者姓名(默认玩家),按名读面板。" },
    "target": { "type": "string", "required": true, "description": "目标名——AC/抗免自动读档(敌/友行或角色档 name 兜底),查无且未传 ac 则报错。" },
    "weapon": { "type": "string", "description": "武器名(默认面板持位武器),决定骰式/灵巧/射程——全工具解析。" },
    "off_hand": { "type": "boolean", "description": "双持/离手后手攻击:命中照面板算,伤害不加属性调整(属性为负仍照减,RAW)。默认 false。" },
    "dice": { "type": "string", "description": "伤害骰式直传(怪物转写/覆盖),写全含属性加值,如短弓 1d6+2——传了即不走面板武器解析。" },
    "modifier": { "type": "integer", "description": "攻击加值直传(怪物/即兴转写),如 +4——与 dice 成对给;面板武器路径勿传(内部自算)。" },
    "type": { "type": "string", "description": "伤害类型(转写时用):穿刺/挥砍/火焰等。" },
    "extra_dice": { "type": "string", "description": "特征骰(偷袭/神圣打击),暴击同翻;条件是否满足你判。" },
    "mode": { "type": "string", "description": "优劣势 normal|adv|dis,默认 normal。来源判断=DM(空间/隐形/伏击),多源不叠、优+劣抵消。" },
    "cover_bonus": { "type": "integer", "description": "掩体加值 0|2|5——空间判断=DM。" },
    "ac": { "type": "integer", "description": "目标 AC 直值(逃生舱:即兴目标无档,或剧情态与档不符如弃盾)——回执标「转写」。" }
  }
}
```
回执(未命中时无伤害/抗性/落盘行;暴击标注 `2d6+3=9(暴击已翻骰)`;转写 AC 标「转写」;目标归 0 时 0HP 行按成长面分叉):
```
[攻击 · 梅西雅→哥布林乙 · shortbow]
  命中判定: d20(优:14,9)+5 = 19 vs AC 15(characters/哥布林乙.json) → 命中
  伤害判定: 1d6+3 = 4 穿刺 · 特征骰 2d6=7(偷袭) → 合计 11
  抗性: 无                          ← 或 抗性→↓取整=5 / 免疫→0 / 易伤→×2=22
  落盘: 哥布林乙 hp 7→0 [characters/哥布林乙.json]
  ◇ 即死: 哥布林乙 hp=0 无成长面(怪)RAW 默认即死——死活你判   ← PC/同伴则改「濒死:{名} hp=0 濒死计数起算(成 0/败 0)」
  ◇ 梗概: 梅西雅借岩壁掩护狙杀拐角后的哥布林
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```
err:`!缺必填 context/target` / `!查无目标 AC:{target}——spawn_npc 建档,或传 ac 转写` / `!即兴目标无档:{target}——spawn_npc 建档后再打(ac 转写仅限有档目标的剧情态覆盖如弃盾;**实施裁定 2026-09-26**:写盘需要档,即兴必须先 spawn)` / `!武器查不到:{weapon}——传 dice+modifier 转写,或核对面板` / `!角色不存在:{who}` / `!骰式不合法:{dice}`。变更汇总:①删 spell 参数(归 cast);②modifier 只做攻检加值 + off_hand 布尔(后手伤害不加属性);③hp 落盘+0HP 分叉(判据=档上 exp 键,gain_exp 同源);④双骰透明+暴击标注;⑤context 标准文;⑥武器 join/熟练/AC 咽喉解析不动(已验);⑦pb→pbOf(lv)。

### cast(结算件·施法链,主面)——终稿 2026-09-26

**路由律内联修订(2026-09-26 实施补)**:四裁定之上补第五、六分支——**治疗型**(restore:true+dice,照法术正文抄;钳上限/苏醒双清内联)与**自动型**(无 attack_type 无 save 但传 dice:魔法飞弹类自动命中逐目标独立掷)——来源路由律硬约束落地,法术来源的一切生命变动归 cast 一件,禁接龙 heal/damage。**实施修复**:自施法(目标=施法者)时结尾位表/专注写盘重读实盘——旧实现用开头快照整档回写,会把目标分支刚写的 hp 拍回去(clobber,测试实抓)。
**Review 四裁定**:①**专注冲突改 RAW 覆写**——现状报错闸(再施专注法术即 err)比 RAW 严;改为再施专注法术自动顶替旧专注、落盘 concentrating(§4.2 已定:覆写后 concentrating 无工具读者、降级展示域);②**删 budget_offset**——当拍写 slots 后,同回合连发读实盘即续,回执中继退役;③**补戏法免位闸**——现状 cast.mjs 对 level 0 法术也走 `slots_l1` 位检(戏法被误拦/误耗),须补「戏法免位」;④**攻击型纳归本轮**——attack.spell 删后,攻击型法术唯一入口=cast.attack_type 分支(不动,已含命中链)。

```jsonc
{
  "description": "施法链结算器——一次施法(攻击型/豁免型)的闸区+效果+写盘一次走完;一切施法必经本工具。什么情况调:角色施放法术——玩家与同伴照面板施法族全自动,怪物施法照 statblock 声明。怎么填:基线=spell(英文原名)+caster;targets=受击/受影响者(攻击型单名、豁免型多人逗号隔,写盘定位);升环传 as_level,源库无升环字段传 dice 覆盖。预期效果:闸区自动过(位可用/升环/仪式免位/戏法免位);攻击型走命中链、豁免型逐目标豁免(half_on_save 自动半伤);法术位、专注(再施专注法术自动顶替旧)、目标血量当拍落盘并给落盘行;目标归 0 时 PC/同伴濒死计数起算、怪默认即死(死活你判)。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "spell": { "type": "string", "required": true, "description": "法术名(英文原文,如 fireball)——按名读 lorebook frontmatter(环位/仪式/专注/豁免/伤害/攻击型)。" },
    "caster": { "type": "string", "description": "施法者姓名(默认玩家)——按名读施法族(施法属性/位表)。" },
    "targets": { "type": "string", "description": "受击/受影响者名单,逗号分隔——攻击型法术单名,豁免型可多名(逐目标豁免);写盘定位。" },
    "as_level": { "type": "integer", "description": "升环环位(≥法术原环位)——耗该环位,伤害随环位按表扩。" },
    "dice": { "type": "string", "description": "升环覆盖骰式(源库无升环字段时照法术正文转写),如 3d6。" },
    "mode": { "type": "string", "description": "攻击型法术的优劣势 normal|adv|dis,默认 normal;来源你判(空间/隐形/伏击)。" }
  }
}
```

回执三形态(攻击型/豁免型/专注顶替;未命中或全数通过豁免时无对应伤害落盘):

```
[施法 · 缇娜→火焰箭]
  闸区: 戏法免位 · 仪式✗ · 专注✗
  命中判定: d20(优:14,9)+5 = 19 vs AC 15(characters/哥布林乙.json) → 命中
  伤害判定: 1d10 = 8 火焰
  落盘: 哥布林乙 hp 7→0 [characters/哥布林乙.json]
  ◇ 即死: 哥布林乙 hp=0 无成长面(怪)RAW 默认即死——死活你判
  ◇ 梗概: 缇娜指尖凝焰,点穿了哥布林
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```

```
[施法 · 缇娜→火球术]
  闸区: 位检✓(slots_l3 剩 1) · 仪式✗ · 专注✗
  豁免判定 哥布林甲: d20+2 = 8 vs DC 15 → 失败(全伤)
  豁免判定 哥布林乙: d20+2 = 16 vs DC 15 → 通过(半伤)
  伤害判定: 哥布林甲 8d6=24 火焰 → 落盘: 哥布林甲 hp 7→0 [characters/哥布林甲.json]
  伤害判定: 哥布林乙 12 火焰(半伤) → 落盘: 哥布林乙 hp 7→0 [characters/哥布林乙.json]
  落盘: slots_l3 2→1 [characters/缇娜.json]
  ◇ 即死: 哥布林甲/乙 hp=0 无成长面(怪)RAW 默认即死——死活你判
  ◇ 梗概: 火球在矿洞里炸开
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```

```
[施法 · 缇娜→催眠图纹]
  闸区: 位检✓(slots_l3 剩 2) · 仪式✗ · 专注✓(需)
  专注: 顶替旧专注「妖火」→催眠图纹(RAW 覆写,自动弃旧)
  落盘: slots_l3 3→2 [characters/缇娜.json]
  落盘: concentrating 妖火→催眠图纹 [characters/缇娜.json]
  ◇ 梗概: 缇娜凝出图纹,先散了妖火
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```

err:`!缺必填 context/spell` / `!法术查不到:{spell}` / `!无施法能力——{caster} 无施法族` / `!升环校验失败:as_level({asL}) < 法术环位({lvl})` / `!无 {N} 环位可施(现 {have})` / `!攻击型法术需 targets(单目标)` / `!查无目标:{target}——写敌行/建档/spawn_npc` / `!骰式不合法:{dice}`。变更:①description 三段式+context 标准文;②专注冲突「报错闸」→「RAW 覆写」(concentrating 落盘);③+写盘:slots_lN−1(非仪式非戏法)、concentrating(专注法术)、目标 hp(攻击型命中/豁免型逐目标,0HP 分叉同 attack);④删 budget_offset(当拍写 slots 后读实盘即续);⑤补戏法免位闸(level 0 不耗位);⑥attack_type 分支保留(接管 attack.spell 退位后的攻击型法术),豁免型逐目标 resolveSave 同律收拢;⑦pb→pbOf(lv)。

### damage / heal / hp(结算件·HP 直改三件套,主面)——终稿 2026-09-26(语义拆分+来源路由律)

**拆分裁定(用户定案)**:原 damage 一件混三语义,拆为**掷骰伤害/掷骰治疗/无骰直改**三件,每件语义纯粹;**纯掷模式死**(生命骰=逐枚调 heal,掷一枚落一枚——BR「掷一枚看结果再决定下一枚」原生吻合);halve/double 死(抗免全读档,强制减半=叙事效果归 apply_status);三件互相及与 attack/cast 之间**禁止连用**(来源路由律,见 §9 头部)。

```jsonc
// damage——世界伤害掷骰件
{
  "description": "伤害掷骰器——无攻检、无施法的世界伤害一次走完:掷骰、抗性应用、扣血落盘。什么情况调:坠落(每 10 尺 1d6,上限 20d6)、陷阱、火场等环境伤害,以及手动结算的非法术伤害。武器伤害走 attack、法术伤害走 cast——同一事件的伤害只走一件,本工具不与它们连用(连用=双重扣血)。怎么填:基线只传 dice+target,抗性免疫按 type 自动查目标档。预期效果:回执给骰值、抗性应用与落盘行;减到 0 时 PC/同伴濒死计数起算、怪默认即死(死活你判)。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "dice": { "type": "string", "required": true, "description": "骰式,如 2d6+3。" },
    "target": { "type": "string", "required": true, "description": "挨打者名——抗免读档、hp 落盘。" },
    "type": { "type": "string", "description": "伤害类型(穿刺/火焰/钝击)——按它匹配抗性免疫。" },
    "modifier": { "type": "integer", "description": "附加调整值。" }
  }
}

// heal——非法术治疗掷骰件
{
  "description": "治疗掷骰器——掷骰回血一次走完:掷骰、钳上限、落盘。什么情况调:非法术来源的掷骰治疗——药水、短休生命骰(掷一枚落一枚,想再掷再调);法术治疗的数值由 cast 一并结算,本工具不与 cast 连用。怎么填:基线只传 dice+target。预期效果:回执给骰值与落盘行,自动钳 hp 上限;治疗 0 HP 者则苏醒并清濒死计数。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "dice": { "type": "string", "required": true, "description": "骰式,如 2d4+2(药水);生命骰按职业骰面+CON(如 1d10+2)。" },
    "target": { "type": "string", "required": true, "description": "恢复者名——钳上限、hp 落盘。" },
    "modifier": { "type": "integer", "description": "附加调整值。" }
  }
}

// hp——无骰直改件
{
  "description": "生命直改器——不掷骰的生命变动直接落盘。什么情况调:剧情性或规则性的定量变动——旧伤崩裂扣 4 点、恩赐恢复、休整回满。不可与任何掷骰工具(attack/cast/damage/heal)连用:同一事件的生命变动只走一件;本工具更不是修正器——已结算的结果不得用它改写(篡改骰果=违反铁则),只处理从未掷骰的事件。怎么填:target+amount(负=减损,正=恢复);回满传 full:true。预期效果:落盘行;减损到 0 走濒死/即死分叉,恢复走钳上限与苏醒,与掷骰件同律。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "target": { "type": "string", "required": true, "description": "角色名。" },
    "amount": { "type": "integer", "description": "直改量,正=恢复/负=减损;与 full 二选一。" },
    "full": { "type": "boolean", "description": "回满至 hp_max——与 amount 二选一。" }
  }
}
```
回执三形(`[伤害 · 名 · 类型]` / `[治疗 · 名]`(生命骰变体 `[治疗 · 名 · 生命骰]`) / `[生命 · 名 · 直改]`),落盘行同规,0HP/苏醒语义同 attack:
```
[治疗 · 梅西雅]
  治疗判定: 1d8+3 = 8
  落盘: hp 12→20(钳上限) [characters/player.json]
  ◇ 梗概: 缇娜的祷言化入伤口
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```
0HP 时:`落盘: hp 0→8 · 濒死计数双清` + `◇ 已苏醒`;hp 直改形:`落盘: hp 12→8(−4) [..]` / `落盘: hp 8→22(回满) [..]`。
err:`!缺必填 context/dice(或 amount/full)` / `!骰式不合法` / `!查无目标:{target}`。变更:①一件拆三(damage/heal/hp);②纯掷模式删(生命骰逐枚 heal);③halve/double 删;④target 必填化;⑤来源路由律入三件 description;⑥temp_hp 授予=cast 内联(法术)/hp 直改(无骰),二期不再单设 temp 模式。

### initiative(结算件·先攻+开战物化,主面)——终稿 2026-09-26

```jsonc
{
  "description": "先攻掷骰器——掷全团、排序、开战落账一次走完;正式开战必经。什么情况调:接战当口(铺场完毕、玩家给出策略)——掷先攻、定行动序。预期效果:回执给先攻序(同刻组标出,组内次序你裁);战斗节落盘——回合 1、先攻行、参战敌对者建敌行(HP/AC 都在各自档案,行只记名与状态)。参战者必须先完成角色创建,未建档报错。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "combatants": { "type": "string", "required": true, "description": "参战者名单,逗号分隔(如 '梅西雅,缇娜,哥布林甲,哥布林乙')——全部读档掷 d20+敏捷。" }
  }
}
```
回执:
```
[先攻 · 矿道遭遇战]
  1. 哥布林乙 — 15
  2. 梅西雅 — 13
  3. 缇娜 — 13
  ⟦同刻 13⟧ 梅西雅 · 缇娜(组内次序你裁)
  落盘: state.md 战斗节——回合:1 · 先攻行 · 敌行×2
  ◇ 梗概: 两军对撞,矿道血战开幕
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```
err:`!缺必填 context/combatants` / `!未建档:{名}——先用角色创建工具建档再开战`。变更:①战斗节落盘(回合/先攻/敌行建行,path 从档上溯源);②**临时单位转写通道废除**——参战必先建档,与 attack 查无报错同律;③「怎么填」段消失(无特殊通道);④context;⑤dex 全读档;⑥同刻组保留。

### death(结算件·濒死,主面)——终稿 2026-09-26

Review 裁定:**删 success/fail 两参**(v8.1 参数中继反转)——计数读档(缺席=0/0)、新值落盘,DM 零转录。

```jsonc
{
  "description": "濒死豁免掷骰器——0 HP 的角色每个自己的回合开始时必掷一次(raw d20,无任何修正)。什么情况调:濒死中的 PC/同伴,每轮一次;伤势稳定后不再掷,死亡即止。预期效果:回执给 raw 骰值、新旧计数与判定——继续濒死 / 回 1 HP 苏醒(nat20,计数清零)/ 记双败(nat1)/ 伤势稳定(三成,1d4 小时后自然醒)/ 死亡(三败);计数自动读档落盘,零转录。",
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "who": { "type": "string", "description": "濒死者姓名(默认玩家)。" }
  }
}
```
回执四形态(判定行随骰值:nat20→「回 1 HP 苏醒」+`落盘: hp 0→1 · 计数双清`;nat1→双败;3成→「伤势稳定(1d4 小时后自然醒,不再掷)」;3败→「死亡」):
```
[濒死 · 梅西雅]
  濒死判定: raw d20 = 14(成功+1) → 成 1/败 0
  落盘: death_success 0→1 [characters/player.json]
  判定: 继续濒死
  ◇ 梗概: 血泊中的梅西雅抓紧了意识
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```
err:`!缺必填 context` / `!角色不存在:{who}` / `!计数已满——稳定者不再掷/已死亡`。变更:①删 success/fail 参数(读写化);②落盘(计数/苏醒 hp/双清);③context;④raw d20 无修正保持。

### spawn_npc(角色创建件,主尾双面)——终稿 2026-09-26

```jsonc
{
  "description": "角色创建器——为登场的新角色建立完整档案并登记在场:怪物、NPC、同伴,一切新角色必经(玩家角色由开局表单创建,不经此)。什么情况调:剧情中任何新角色登场。创建前先读卡:怪物 runtimeRead monsters/ 下的 statblock 照原文填,原创 NPC 凭你的设定填——数字要过你的脑子,战斗中是你亲自跑它。怎么填:必填 name+stance+level+ac+hp+六维;level 是统一刻度——怪物抄卡头 CR(0.25 小数原样),有职业的填等级;有什么能力填什么族(施法者必须填全 caster_attr+spells_known+slots),没有的不填;设定重的角色填 persona/biography,杂兵跳过。特殊通道:from 传 statblock 路径做镜像校验(填错报错列差异;有意改数值的变体不带 from);count 批量(name 为基名,天干编号)。预期效果:档案+在场名单落盘,回执给落盘行与 XP/熟练加值摘要(派生,不落档);同名已存在会报错。",
  "agents": ["main", "tail"],
  "parameters": {
    "context": { "type": "string", "required": true, "description": "一句已定型的剧情梗概:本调用前你对剧情走向的承诺——回执把梗概与结果钉在一起,后续叙事必须遵守。" },
    "name": { "type": "string", "required": true, "description": "角色名——同名已存在(含 player.json)则报错不覆盖。" },
    "stance": { "type": "string", "required": true, "description": "同伴|中立|敌对——在场三态;role 由此派生且定形(stance 可变,role 不变)。" },
    "level": { "type": "number", "required": true, "description": "刻度:怪照 statblock 卡头抄 CR(0.25 等小数原样);class-NPC 与同伴填等级。" },
    "ac": { "type": "integer", "required": true, "description": "AC——怪=卡头直值;着甲类人=照甲算好填入。" },
    "hp": { "type": "integer", "required": true, "description": "HP 现值(=上限,出生即满血;statblock 均值为惯例)。" },
    "str": { "type": "integer", "required": true, "description": "力量值。" },
    "dex": { "type": "integer", "required": true, "description": "敏捷值(兼先攻与 AC 派生输入)。" },
    "con": { "type": "integer", "required": true, "description": "体质值。" },
    "int": { "type": "integer", "required": true, "description": "智力值。" },
    "wis": { "type": "integer", "required": true, "description": "感知值。" },
    "cha": { "type": "integer", "required": true, "description": "魅力值。" },
    "save_prof": { "type": "array", "items": { "type": "string" }, "description": "豁免熟练(str/dex/con/int/wis/cha),照卡。" },
    "skill_prof": { "type": "array", "items": { "type": "string" }, "description": "技能熟练,照卡。" },
    "resist": { "type": "array", "items": { "type": "string" }, "description": "伤害抗性,照卡。" },
    "immune": { "type": "array", "items": { "type": "string" }, "description": "伤害免疫,照卡。" },
    "vulnerabilities": { "type": "array", "items": { "type": "string" }, "description": "伤害易伤,照卡。" },
    "speed": { "type": "integer", "description": "速度(尺),照卡。" },
    "darkvision": { "type": "integer", "description": "黑暗视觉范围(尺),无则不填。" },
    "languages": { "type": "array", "items": { "type": "string" }, "description": "语言,照卡。" },
    "caster_attr": { "type": "string", "description": "施法属性(int/wis/cha)——施法族声明则必全。" },
    "spells_known": { "type": "array", "items": { "type": "string" }, "description": "已知法术——施法族声明则必全。" },
    "slots": { "type": "array", "items": { "type": "integer" }, "description": "施法位表(从 1 环起逐环数量,如 [4,2])——落档为 slots_l1..lN;施法族声明则必全。" },
    "persona": { "type": "string", "description": "一句话人设(伸缩:无设定的怪不填)。" },
    "biography": { "type": "string", "description": "背景首行(复杂 NPC 用,追加式)。" },
    "description": { "type": "string", "description": "名册一句话简介。" },
    "count": { "type": "integer", "description": "批量数量——name 为基名,天干编号(哥布林×3→甲/乙/丙)。" },
    "race": { "type": "string", "description": "种族(avatar/叙事用)。" },
    "gender": { "type": "string", "description": "male|female|unknown(avatar 用)。" },
    "from": { "type": "string", "description": "statblock 路径(monsters/goblin.md)——校验锚:对照 FM 镜像校验,不符报错列差异;造变体不带。" }
  }
}
```
回执:
```
[创建 · 哥布林乙 · 敌对]
  落盘: characters/哥布林乙.json 已建档(level 0.25 · ac 15 · hp 7)
  落盘: state.md 附近NPC +敌对行
  ◇ level 0.25 → XP 50 · pb +2(派生,不落档)
  ◇ 梗概: 哥布林小队现身矿道
  ◇ 铁则: 后续剧情必须遵守梗概与结果,不得篡改!
```
err:`!缺必填 {字段}` / `!同名已存在:{name}——改名,或确认非同一人` / `!施法族声明则必全(caster_attr+spells_known+slots)` / `!from 校验不符:{字段} 卡={x}≠传{y}——重读卡,或去掉 from(变体)` / `!查无 statblock:{from}`。变更:新件——完备律+键裁剪落地、from 校验锚、count 天干、presence 行写盘、落盘行+派生摘要;双面(尾侧 context=转录的事实来源)。

**注(2026-09-26)**:attack 已录并按 Review 三裁定改定;cast 已录于 attack 之后(归彼线,四裁定)。
