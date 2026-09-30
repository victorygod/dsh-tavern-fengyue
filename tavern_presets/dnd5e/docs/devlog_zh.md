# dnd5e 卡开发日志

卡自包含的开发档案（卡根 `tavern_presets/dnd5e/`，与 `preset/`、`assemble.mjs` 平级；engine 不扫描）。本目录即全量卡档案：design_zh.md（定案唯一口径）· rules_zh.md（规则汇编）· tools_zh.md（工具设计）。本日志专职记卡内生事务。

## 2026-09-21 fs_tree.mjs：编辑器懒加载目录树的数据通道

- **定位**：`preset/scripts/fs_tree.mjs` = 酒馆工作空间编辑器的按目录取层协议（`{op:'list',path}` 单层 / `{op:'levels',paths}` 批量）——编辑器树改为"展开那一刻才取该层"，轮询用 levels 一次批量刷「根层+展开层」，替代整树全量预取。与 rulebook.mjs 同类：**纯前端门面的取数脚本，模型不可感知**（tools/ 不声明、postPrompt 不引用）。
- **围栏与跨平台**：路径只认 preset/runtime/savings 三区 + 根层（resolve 包含判断，拒 `..`）；入参反斜杠归一 + 重复斜杠折叠；输出恒 POSIX 风格相对路径（与引擎 listTree 的 wire 约定一致）；目录判定用 dirent。冒烟覆盖 levels/围栏拒绝/归一。
- **降级**：脚本缺席的卡上，编辑器自动回退整树 RPC（渲染层折叠）——本脚本只是增强，不是依赖。

## 2026-09-20 规则之书整体下架（用户裁定）

- **裁定**：右下书本按钮 + 规则之书 Modal 及其取文协议整体删除——玩家侧不再提供 SRD 浏览器（模型经 runtimeRead 查 lorebook 原文的面不动）。
- **删除面**：`ui/index.js` 四处（`data-act="rulebook"` 按钮、act 分发、`mountRulebook()` + `mdToHtml()` 微渲染器（确认无他人引用）、`.rb-*` CSS 块、Esc 关书死代码、头部注释提法）；`preset/scripts/rulebook.mjs`（manifest/get/search 三 op）整文件。
- **保留面（关键区分）**：`setup/dnd5e-srd-lorebook/` 数据**原样保留**——它是与模型共享的数据面（`{{srd_index()}}` 注入索引、泵 derived 的 AC 装备 join 依赖），删的只是书本这个 UI 门面；`srd_index.mjs` 与其他 lorebook 消费脚本不动。
- **文档同步**：ui_zh.md（总述/总开关/右下角件/模块三整节/字段表 lorebook 行/R1 通道注/监视表/状态保全三则→两则/z-index 分层/施工序列划线归档）、design_zh.md（触发器清单去 rulebook、§6.5 改「已删」定案、§2 目录定案与 §2.1 双消费、§6.7 书本弹窗提法）、panel-data_zh.md（读取通道列）、templates/README.md（接口行）、assemble.mjs 注释。原型稿（hud-proto-v6/v7）按「带日期原型不随实现回写」惯例原样保留。
- **验证**：`node --check` ui/index.js 与 assemble.mjs 通过；preset/ 全文 grep rulebook/规则之书/书本 零残留（lorebook 数据原文的 "official rulebooks" 英文词除外）。

## 2026-09-19 立卡：数据层从 v1 磨到 v7 的全程

### 拍板链（用户连砍七刀的收敛史）
- v1 双目录(players/ + lore/characters/,承现卡遗产) → v2 同构面板+frontmatter 机层 → v3 人物 JSON → v4 一人一文件全包 → v5 characters/ 全员统一+固定 player.json → v6 平铺+type 字段（过度合并,被否）→ **v7 lore 子目录上提,目录即类型**
- 工具族六件磨成三件：roll（主面唯一——骰/优劣/先攻/濒死/专注/施法闸/灵感,consume 闸半体并入施法参数族）+ advance、rest（尾面,schema `agents:[tail]` 声明归属）
- **消解清单**（全部为想象中的消费者预建,被 YAGNI 处决）：tools-tail 目录→schema agents 字段；rolls.log 流水+SETTLE→参数中继+窄道直改面板；lib 共享层→第二次需要时才建；frontmatter mini 解析器→JSON.parse 免费；render 摘要层→暂时全量原文注入

### 机制终案
- **格式律**：characters/*=JSON（机器重,_execute=尾代浅层整写,flat 一层+四字小对象,禁深嵌）;locations/quests/items 等=md（现卡 lore 协议上提一格,LLM 重）;接口(ui_data/manifest)=JSON;state.md=唯一 md 常驻面板
- **面板**：`runtime/characters/player.json` 固定名+一切具名人物同 schema;杂兵住 combat.enemies 行;宿敌带 `character` 字段链回收,战末归档回写
- **注入**：postPrompt 暂时全量原文（player+同伴[扫 role]+热点 NPC[state 近期人物行]+combat+state+分层索引）≈1.5-2k token/回合;摘要层挂账量测后议
- **写权限**：窄道机械位（slots/灵感）=roll 直改;整文件=尾代基线续写;创角器 opening_commit=t=0 第4道
- **引擎 write-guard（施工项）**：runtimeUpdate 写 *.json→parse→坏则回滚+结构化报错
- **经验账**：RAW 每人一账,遭遇 XP 均分,新同伴按平均等级建档;**Short-rest 池版警示**：狂暴 2014 是长休恢复（勿串 2024 的短休回 1）

### 已就位
- `preset/setup/dnd5e-srd-lorebook/`——1164 篇/16 类/5.0M(2014 全基线+2024 poisons;frontmatter 机层;assemble.mjs 渲染,含字段审计四补:reactions/forms/起装/contents)
- `preset/templates/`——character.tpl.json(v7)+combat.tpl.json+README(双模板 parse 验证过)
- `preset/setup/state.md` 种子(六节+队伍+近期人物+time 机器行)
- `assemble.mjs`(卡根构建器,任意 cwd,3b124d8 钉版+CC-BY 署名常驻头注释)

### 施工遗留（按序）
1. 引擎 15 行×2：registerCardToolsDir(face)+尾面追挂;JSON write-guard
2. 工具族：roll(先攻/施法闸/濒死/专注分支+halve/double)、advance/rest(尾面)
3. 提示词三件套+maintenancePrompt(字典式:提事实+文件规范+对账,零规则);state.md 若换世界观改种子
4. opening(page 改造清单在定案文档 §6,五步职责已记缓后) + ui(RPG HUD §6.7+手簿+书本 §6.5)
5. 世界观拍板:沿「边境小镇」or 新世界(当前种子为占位)

### 踩坑存档
- assemble 初版两 bug:monster special_abilities 的 `+[]` 残渣把数组字符串化再 spread=竖排字符(279 只受害);paras() 对 desc 数组 String()=逗号连接——**凭手感写表达式的教训:spread/隐式转换链要 node -e 复现后再上**
- 规则稿凭记忆写"狂暴短休回 1"=2014/2024 版本串线——**死规则必须对照 lorebook 原文,不背书**
- v6 平铺是我第 N 次过度合并:统一 schema 到"目录即类型"比"同目录+判别字段"少一个字段

## 2026-09-19(b) 数值维护与结算分工定案
- 原则：**主代理=计算不可分**（叙事内的一切罐头计算——掷骰/闸门/买卖）;**尾代理=零新算纯维护**（不发明算式,调罐头不算产出逻辑——转录对账建删档）。
- 工具族 3→4：新增 **trade**（主面买卖结算：查价→10:1 跨币找零→钱包窄道直改→回执清单供尾代转录 gear;卖价 SRD 无明文 DM 传参）。
- 固化分类表落定：A 有表/B 多步链/C 叙事内硬约束 → 工具;D 单步四则叙事频度 → 尾代直改;E 流程型时间账（craft/lifestyle/training/loot）→ 二期账本。
- **末行自演算 tip** 入 systemPrompt：正文末段数据变化小结=复述即自校验,兼作尾代转录锚。

## 2026-09-19(c) 维护工作全普查与工具终律
- **三条终律**：工具覆盖不了的=agent 直做（**无二期**——craft/lifestyle/training/loot/encounter 预算全部当下归 agent）;有工具的必须告知 agent（骨架新增工具面纪律:禁止心算清单）;工具少而语义明（实现复杂无所谓,输入输出即契约）。
- 工具冻结 **4 件**：roll/trade（主,窄道直改钱包位与濒伤计数）、advance/rest（尾）;无双面工具 v1。
- 普查 45 项维护工作路由表归档进定案文档 §3;撤项：encounter 工具、二期账本段。

## 2026-09-19(d) 纯计算器定律 + 文档入卡
- **终律**：工具一律零写盘纯函数（计算器）——读面板/返回回执;唯一写手=尾代理（opening_commit t=0 除外）;窄道直改全线撤销（slots/灵感/濒死计数/钱包→回执制含建议新值）;回合内连续性=**回执中继**（DM 参照上文回执或传 budget_offset,与 crit 参数中继同先例）。
- 红利：纯函数可单测/可重放/语义契约只剩输入输出/调用记录入 transcript 即审计。
- 新增 `tools_zh.md`（四件工具完整设计契约）;定案稿与规则汇编 **git mv 入卡**（docs→卡内,卡自包含:数据+构建器+模板+档案）。

## 2026-09-19(e) 工具骨架与前端蓝图落位
- `preset/tools/` 四件骨架落位(roll/advance/rest/trade)——schema 块按完整契约参数全写(装配即注册正确的名字/参数/归属),execute 为结构化退场(施工中,x1);误调用不炸 session。
- `preset/ui/` 骨架:layout.json(codex 右槽)+ index.js(mount 三模块 TODO 区块+避坑存档注)+ 依赖 `preset/scripts/ui_data.mjs` 数据泵(占位 JSON)。新蓝图文档 `docs/ui_zh.md`:HUD 角件/手簿/书本三模块、数据链唯一泵、施工序列、现卡经验直迁避坑清单。
- 附:HTML 侧州与 file 树:
  preset/{tools(4)/, scripts/ui_data, ui/{layout,js}, templates(2), setup(2)}/ + assemble.mjs + docs(6)——骨架即当下全貌,存款下一步真实现。

## 2026-09-19(f) HUD v6 定稿与面板↔前端对应锁定
- 六轮原型收敛(`hud-proto-v6.html` 存档,v1~v5 已清):悬浮角件/统一 pcard 解剖(头像突出+双条数字叠条+元信息chips)/hero 华丽版与 mate 同构成缩小版/亮色羊皮纸/面板总开关/输入框沿宿主。
- 面板↔前端对应锁进 `ui_data.mjs` 注释(契约=字段名即文档):pc/mates/enemies/world 四出口,派生(AC/bar2/阈值色)全在泵侧;前端零数值逻辑。
- ui_zh.md 整篇换 v6 定稿(三模块/对应表/避坑/施工序列)。

## 2026-09-19(g) 对应方向纠正:数据格式为准
- 用户纠正两处:①ui_data 契约不得按 HUD 部件形状倒捏(bar2 之类展示概念出清)——**出口=runtime 面板原样投影(player/companions/combat/state)+derived 派生区(与存储严格分离)**,前端基于数据格式(character.tpl.json schema=SRD 构造)做展示映射;②「前端不碰 runtime」是错误表述——浏览器无 FS,runScript(ui_data) 即前端读 runtime 的通道,输出随面板变化而变化。
- ui_data.mjs 契约重写;ui_zh.md 对应表反转(左列=数据格式字段,右列=HUD 部件,展示规则单列)。

## 2026-09-19(h) 前端数据流架构:rev 心跳+变更拉取
- 定案:runScript 直读 runtime;实时渲染=两级协议——op:rev(2s 心跳,stat 串,常态零开销)→变了才 op:full(几 KB)→各根重绘;single-flight 防堆积;隐藏页签 10s backoff。
- 理由:浏览器无 FS 事件,而尾代写盘集中回尾一次突发——探到"变了"一个比特即够,不必造推送;引擎 turn-end 事件留作升级口(推拉结合),不预实现。
- 渲染三层 store/render*/scheduler;ctx 开态重绘保位、收展态存 store、失败保旧数据。rev 残余漏拍(同毫秒等长双写)下回合自愈,已记档。

## 2026-09-19(i) 局部重绘定案:节级三段粒度
- 变更检测/数据拉取/DOM 重绘三层粒度统一到**节**(player/mates/combat/state 四节各自 rev):变了哪节拉哪节画哪节;节内整根重绘,节点级 DOM diff 不做(复杂度不值);监听=事件委托绑容器一次。
- 展现面板清单钉死:player.json/characters 同伴/combat.json/state.md 四节+lorebook 静态参照(不监视);近期人物 v1 不进 HUD。

## 2026-09-19(j) 面板数据文档+SRD 流程脉络
- 新增 `docs/panel-data_zh.md`:面板存储分区总览/schema 正本引 tpl;**可变中间变量大表**(值四种居所:存储/回执/派生/参数中继,一值一居所律);更新时序图;**SRD 流程脉络**(冒险日/战斗五步/回合结构/攻击伤害链/濒死/施法/检定——对照 lorebook 原文);agent 映射草案(4 处 ⟦讨论⟧:round 推进/同伴操纵权/时间粒度/同伴濒死掷骰)。
- ui_zh.md 增前端准则清单 R1~R6,**R2 局部重绘=硬要求**。
- 待与用户讨论 §五 映射草案后升级为定案。

## 2026-09-19(k) SRD 脉络诚实版重写
- 用户质询"是否完整/真实/书里教学支持?"→grep 核对认账:冒险日=DMG 非SRD(语料无);灵感规则 SRD5.1 无章(仅一句顺带提及,我们系房规采纳);XP 阈值/遭遇预算均不在语料(去处:advance 常量/联网口径);战斗=章节簇(轮循环完整+八个查表分支章)。
- panel-data §4 重写:4.0 缺口表(内容/在否/去处)/4.1 章节簇/4.5 书中教学的一场游戏结构骨架。

## 2026-09-19(l) 工具归属终律:计算器全员主面,尾代纯写手
- 用户修正时序模型:roll/trade/rest/**advance 全部=主代理的推演现场计算器**(叙事内就要结算后的值);尾代从 transcript(回执本在上下文)+正文事实落账,**零卡工具**——引擎"尾面挂载"小改整个撤销,引擎只剩 write-guard。
- 三文档同步:panel-data §三时序图重写(计算器全主面/尾代纯转录);tools_zh 定律2/5+advance/rest 归属改主面;design_zh 归属段+引擎施工项。
- PHB/DMG/MM 全文无合法下载源;语料正本=SRD5.1(已有),缺口四件走"自话归纳+出处声明"。Basic Rules 免费但非 CC,可读不可入库。

## 2026-09-19(m) Basic Rules 下载校对 + DM 流程总集
- Basic Rules v1.0 2018 PDF（WotC 官方 media 链接，用户桌面副本）全文抽取（pypdf，180 页 78 万字符零失败）→ /tmp/basic-rules.txt。定位：灵感 p.61 / 战斗簇 p.72-80 / 休整 p.71 / XP 表 p.13 / 环境 p.68。
- 校对结果：XP 阈值 20 行逐值=advance 常量✓；灵感 BR 有完整规则（SRD5.1 缺→房规采纳获得官方锚点）；濒死/五步/长短休逐句吻合语料✓。
- 新文档 docs/dm-flow_zh.md：出处四标记（SRD/BR/DMG/卡）→ 三层循环 → 探索/社交/战斗五步+回合经济 → 四结算链 → 遭遇结算 → 间隙 → 世界推进/成长线/冒险日口径 → 十一账环闭环验证（rest↔time、advance↔combat 跨环依赖入尾代 checklist）→ 出处对应总表（两项 ⚠ 差异声明：灵感房规/冒险日 DMG 口径）。
- Basic Rules 法律地位：免费非 CC——只做校对锚点，事实自话归纳不入库。

## 2026-09-19(n) DM 手册合并定版（v3）
- dm-loop(用户独立规则版 v2) × dm-flow(卡映射版) **合并为 dm-loop_zh.md v3**:A 部=纯规则(不绑项目),B 部=卡内落地附录(映射总表/十一账环矩阵/一致性核对/悬点);dm-flow_zh.md 退役删除。
- **四处校勘(语料+BR 定谳)**:①DC 标尺恢复六档(Medium 15/Very hard 25/Nearly impossible 30);②濒死 3 成=稳定(非当场回血,稳定者 1d4h 后醒 1HP;回血醒才清零);③先攻无标准熟练(仅 Alert 等特征);④卖价缺省半价补 BR p.46 原文锚(未损装备半价/怪装备不可售/魔品难售)→trade 工具规格同步升级。
- BR p.46 卖价段页码核实;XP 表 p.13、灵感 p.61 校对锚点并入手册 §7.2/§7.3。

## 2026-09-19(o) BR 逐条取证收口
- 三轮取证(pypdf 归一化消 PDF 断词伪影后 28 项全命中):五步/突袭/先攻组掷平手/回合预算/免费互动/即兴动作(Improvising an Action 节)/Ready 触发/借机/nat20/暴击翻骰/抗易/濒死全链/急救/短休 HD/长休 HD 半回(minimum of one)/24h 铁轨/时间尺度/强行军/食水/被动/掩体/力竭六档(p.173 附录)/水下骑乘擒抱/卖价半价/灵感授予+消耗/态度三档(BR p.70「Social Interaction」节实证——从 DMG-only 升级为双源)/XP 表 p.13。
- 零矛盾;§7.5 证据总表入册;DC 页码修正 p.62;态度锚点升级 p.70。

## 2026-09-19(p) 交互主循环入册
- BR p.5「How to Play」三步循环取证（DM 描述环境→玩家声明意图→DM 叙述结果+掷骰打断点）入册 §0.0——包住三层循环的元循环;玩家/DM 职责分账与两条交互铁律（意图优先/不确定才掷）。

## 2026-09-19(q) 交互主循环扩写入册
- §0.0 扩为完整章:三步循环(带对话示例+掷骰打断点)/玩家分层职责表(常驻/战斗双面/社交/成长/队伍/桌外)/DM 对应职责/骰子归属对偶表(玩家掷自己的含濒死;DM 掷 NPC;被动无人掷)/两条交互铁律(意图优先+不确定才掷)。A 部保持纯规则,卡映射仍在 B 部。

## 2026-09-19(r) 流程分类 review:前端决策通道立项
- 用"机械→工具/玩家选择→前端/判断→LLM"镜过 A 部全流程:机械脊柱确认已被 4 工具覆盖;审出唯一结构性缺口=ASI 二传手(advance.apply 让 LLM 参与纯玩家选择)。
- 定案:**front_commit 前端决策通道**(opening_commit t=0 例外的泛化):ASI/升环学新法术=前端点选→机械校验落盘→清 pending→LLM 下回合只读结果;写手二元化(尾代=叙事事实,front_commit=前端机械决策),LLM 保持零写手。tools_zh advance 去 apply 参数;advance.mjs 骨架同步。

## 2026-09-19(s) 工具面终稿:v4 整合版
- 用户定则:**一切掷骰 DM 掷**;玩家面=声明意图+加点+法术升环三种行为。
- tools_zh 重写 v4:统一 I/O 约定(单 JSON 入/回执出/who 对象参数/引用解析)+四工具全参 spec(roll 含 who 先攻自动解析 dex;trade 卖价半价;rest 三铁轨;advance 去 apply)+**front_commit 前端决策通道**(op: asi|spells,校验→窄写→清 pending,无判断落盘道与尾代二元)。
- 程序面终态:**4 LLM 工具+1 前端通道**;不设工具对照清单(LLM 判断/尾代直改/对话内声明三分)。

## 2026-09-19(t) 四工具逐件完备性审计
- roll **链化定案**:一次调用跑完整链(攻检→伤害→抗性→建议新HP;施法三检→攻击链/逐目标豁免链)——crit 中继退役为后备;新增参数 target/targets/weapon/cover_bonus/extra_dice/damage/vs/who。
- **数据层缺口修复**:怪物 frontmatter 缺 save_prof/skill_prof(豁免法术打怪/对抗检定算不出怪物加值)——assemble.mjs 补齐(源数据本有,渲染漏了)并全量重刷(goblin skill_prof:[stealth]/aboleth save_prof:[con,int,wis] 验证✓);**assembler 改 env SRD_SRC 指源**(.src 已删,重渲染=clone 5e-database→env 指向,仓内保持干净)。
- 多角色缺陷:rest.hd_spent/advance.hp_mode 改逐人映射;front_commit 补 op:prepare(长休换准备表,RAW 牧师/法师)。
- 如实声明的不自动化边界(五条):升环增值/怪物攻防数值=DM 转写(源库正文承载);特征骰条件/种族重骰=DM 判断;双持后手=weapon+modifier:0 表达。

## 2026-09-19(u) 时相律:叙事段/结算段两分
- 用户洞察:advance/rest 属回合末结算,非叙事中行为——context 的本质=叙事绑定(回执当剧情素材),结算段无反作弊问题。
- 定律 7 落盘:叙事段(roll/trade,context 必填)/结算段(advance/rest,无 context,正文完稿后收尾);结算触发判断权在 DM(叙事权威)故留主面,尾代理仍纯写手,引擎零改动。
- 同步:trade 补 context 必填(原 spec 遗漏);advance/rest schema 注结算段;panel-data 时序图改两段式。

## 2026-09-19(v) 变化日志定案:正文述事件,HUD 述数值
- 用户模型确认:正文只述事件(战斗结束/进行了长休)→尾代照回执+事件落账→HUD 显示上回合变化+原因。
- 两精化:①**结算段量永不出现在正文**(XP/回复值——防"正文心算 vs 工具计算"双真值;末行自演算 tip 范围精化为叙事段量);②HUD 新部件**变化日志 feed**——数据源=state.md「上回合变化」节(尾代每回合整节重写,值+原因格式),ui_data `state.changes[]` 投影,零新文件。
- 同步:state.md 种子加节/ui_data 契约/design tip 精化/ui_zh 蓝图+对应表。

## 2026-09-19(w) B4 三悬点全闭合
- **round 语义**（BR p.73 取证）:轮=6s+全员各行动一次,序跨轮守序→本卡映射:**一条玩家消息=一轮**(DM 单回复按序推演完所有单位);round 推进=正文驱动→尾代+1;act_index 仅断点记录(例外态)。
- **同伴操纵权**(用户拍板):玩家只控 PC;同伴与一切 NPC=独立人格由 DM 全权推演(战斗/对话/行为);同伴骰=DM 掷;**连带修正 B5:同伴成长走叙事宣告→尾代落账,front_commit 仅服务 PC**。
- **时间粒度**(BR p.67「Time」取证:DM 按情境换时标):state.time={day,hour} 两粒度;轮/分钟=场景局部量(combat.json 计数,战末折叠;探索分钟摘要进位)——rest 三铁轨 hour 精度原生满足。
- 同伴濒死随②闭合(DM 统一掷)。A 部 §2.1/§5.1 补 BR 锚。

## 2026-09-19(x) 工具实现设计:预期逻辑+回执模板
- tools_zh §九落盘,照此直译成代码:
  - roll 九分支逐步算法(引用解析公式/攻击链全解析顺序/施法链 DC 推导与逐目标循环/先攻 dex 自动源/濒死计数封顶/专注 DC 内算/对抗择优)+攻击链回执模板;
  - trade cp 统一核算(汇率表 gp100/sp10/ep50/pp1000)+贪婪找零+回执模板;
  - rest 长短休算法(last_long_rest 记录/HD 回半/位表常量/短休池逐职业含 arcane 1 日旗)+回执模板;
  - advance 阈值表/职业表行解析(特征/位表)/pending 标记生成+升级回执模板;
  - front_commit 三 op 校验链(ASI 合计≤2+20 上限+CON 追溯/spells 存在性+数量表额/prepare ⊆known+数量)。
- 实现注:无序列号(工具无状态,回执自述);seed 可重放;职业数据=解析 lore classes 表行 JSON 列。

## 2026-09-19(y) trade 场景例与边界
- 场景例入册(tools_zh §三):卖缴获+买补给混合单全程(调用→回执→织正文→尾代落账→HUD 日志);边界表:无对价进出(赏金/受赠/被偷/拾取)=尾代直改、生活方式日费=downtime 层、小钱两可但动钱包建议都过 trade。

## 2026-09-19(z) roll/rest/advance 场景例入册
- roll:塔厅 R2 一回合两链(攻击链 nat20→暴击自动翻倍→建议新HP;施法链戏法位检豁免+DC13 推导+fail 全伤)——展现"DM 只传判断入参,链内全解析"。
- rest:长休全程(三铁轨 26h 校验/逐人回满/HD+1/时间+8h/last_long_rest=完成时刻)+短休逐人 HD 映射;advance:同场战斗终局(200÷3=66/人,三人跨 LV4,逐职业升级块+pending)——正文只述事件,XP 数字只在回执与 HUD。
- front_commit 流接续:ASI 面板亮起→点选→下回合宣告。四工具场景面齐。

## 2026-09-19(aa) 归属重排:rest 留主面,advance 移尾面;回执语义化
- 用户三连:①roll 回执须逐行语义自述(命中判定/伤害判定/目标状态)——重写模板(原文案有烂占位);②rest 输出全集澄清(校验区/逐人变化含资源池逐池/全局含时间推进+last_long_rest+prepare 提醒);③**归属重排**:rest=主面(触发叙事事件/校验拒绝是剧情/时间喂下一幕),advance=尾面(触发纯事实/回执永不入正文/自执行消灭漏调 XP)。
- 判定式:回执是否为「叙事素材」=主/尾面唯一分界。尾代理持且仅持 advance(不再是零卡工具);引擎尾面挂载恢复立项(与 write-guard 并列两项)。
- 同步:tools_zh 定律2/7+§四/§五重写+两模板语义化;advance.mjs schema agents:["tail"];design 施工项。

## 2026-09-19(bb) 无状态审计→roll 分裂:8+1+1 终态
- 用户双判据:①工具无状态——回执禁输出快变量绝对值(HP A→B 会读陈旧值),只输出增量/判定;绝对值仅限串行结算段(rest/advance/death 计数);②输入不同/逻辑复杂就分开。
- mega-roll(18参9分支)分裂:check/attack/cast/damage/initiative/death——主面 8+尾面 1+前端 1=**10 面**;roll.mjs 删除,六骨架立(schema 全参),语法校验过;attack/cast 内部共享实现但独立工具(闸区差异);HP 累计=DM 单步叙述+尾代终写。

## 2026-09-19(cc) context 全覆盖 + 术语对齐翻译表 v3
- 用户抓漏:①rest 缺 context(真缺,补 required)——**context 律收严:主面全员必填**(叙事段/结算段皆绑剧情),无 context=尾面 advance+前端;六骰骨架实均有 context(initiative/death 描述补"必填"字样,tools_zh 节头补齐)。②术语 sweep 对齐翻译协议 v3 台版锚点:游荡者→盗贼(7文件)/圣武士→圣骑士/邪术师→契术师;我的文档面零残留(lorebook 与 lorebook-cn 翻译工程不在此列)。③cantrip=戏法:翻译表 §⑥ v1.1 起定名且 v3 维持——向用户说明语义(0环/免位/无限施放,与环级法术区分),如需改名是一行表更。
- 补扫:rules_zh/hud-proto-v6/rest.mjs 残留游荡者→盗贼(初轮 sed 清单漏了这三个文件);devlog 历史记与 translation-protocol 的历史引述按性质保留。

## 2026-09-19(dd) 术语 v4:Warlock=术士执行;两条撞名 hold
- 用户裁定 Warlock=术士:活文档 sweep 完成(rules_zh 三处同步);**Sorcerer 撞名**(原占"术士")暂改巫师标待裁;**Gnome=矮人 hold**(Dwarf 撞名,备选地侏/侏儒/另择)——两条已记入翻译协议 v4 待用户一字定夺;lorebook-cn 侧 sweep 双双 hold 至裁决定。

## 2026-09-19(ee) 术语 v4 提案撤销
- 用户裁定:Warlock=术士 提案与连带消歧(Sorcerer/Gnome)全案撤销——撞名连锁(Sorcerer 占术士/Dwarf 占矮人)使改动面大于收益,**维持 v3 全量口径**(盗贼/圣骑士/契术师/地侏/咒法/术士/矮人)。
- rules_zh 三处还原;协议 v4 改记撤销;cn 语料自始未动(此前 hold 生效)。

## 2026-09-19(gg) 三分提示词落地 + SRD 索引 v2
- **根索引 v2**(assemble 生成器改造+重刷):去中文短语→BR 简介中文+includes 全条目英文名;**mega-3(spells/monsters/equipment)名单折叠**(名字不带效果对查询无益+省 2.5k token)→INDEX 17.8KB→6KB(≈1.6k token);proficiencies(117)为剩余最大项,可同法折叠。
- **systemPrompt**(29 行):DM 定位(单人卡/玩家只控 PC/一切骰 DM 掷)·世界运转(面板基线/记账自动/结算量禁入正文/front_commit 待办确认)·工具纪律(两时相/context 必填/禁止心算清单/拒绝即事实)·流程骨架(交互循环/战斗五步=一消息一轮/冒险日 DMG 口径)·SRD 两级查询(路径省略前缀声明+{{srd_index()}} 注入)。
- **postPrompt**(2 行):{{snapshot()}} 全量注入。
- **maintenancePrompt**(28 行):三铁律(照抄回执/单步四则/lorebook 只读)+自调职责(advance 自执行,漏调=最高优先)+六步维护清单(人物/combat 归档/经验/建档/state 含上回合变化整节重写/报警)+文件规范。
- **两个注入脚本**:srd_index(原样搬 INDEX)+snapshot(全量分节,坏 JSON 标注勿采信)。

## 2026-09-19(hh) 提示词去实现细节泄漏:runtime/ 目录字样清零
- 用户抓漏:LLM 的世界只有三样——注入快照/工具 schema/路径参数;服务器目录名 runtime/ 不可见也不可验证,写进提示词是泄漏实现细节且可能诱导双重前缀。
- 修正:systemPrompt「runtime/ 面板」→「每回合注入的【回合快照】」+快照外文档用 runtimeRead(同路径口径);maintenancePrompt「转录进 runtime/ 面板」→「用文档工具转录进面板(path 相对文档基线)」。残留 runtimeRead/Grep/Create/Update/Delete=工具名(LLM 真实可见),合法保留。postPrompt 本就无泄漏。
- 原则入档:**提示词只说 LLM 可见的三样东西——注入内容、工具名与 schema、路径参数;服务器目录名/文件名一律不出现在提示词层**。

## 2026-09-19(ii) 提示词角色门:systemPrompt 双脸共享的角色判定
- 引擎核码:registerCardSections 在主/尾两处 compose 都调用——**systemPrompt 双脸共享**;原写法"你是 DM"+"尾代理转录"造成角色混乱(簿记代理读到自己该叙事/主代理被要求感知同事)。
- 定案(用户原则):**systemPrompt=运行结构+角色判定门**——先判定身份再行动:收到簿记维护指令→簿记代理(维护指令优先,不做叙事);收到玩家消息→叙事代理(全部叙事指令适用);其他任务指令(写卡脸)→以该指令为准。**未得到正式任务指派前,不做那类事**。
- 尾代理去人格化:不感知"主代理"——输入只是 transcript+维护指令;maintenancePrompt 开头自证身份("本指令=身份与任务凭证,优先于系统提示叙事指令")。
- 验证:三提示词零"尾代理/主代理"字样(systemPrompt 0/maintenance 以簿记代理自称 1/post 0)。

## 2026-09-19(jj) postPrompt 语义面板化 + 去人格化到底
- **postPrompt 重写**:回合快照概念退役→五语义面板各挂具名脚本——【玩家面板】get_player_state/【同伴与 NPC 面板】get_npc_state(同伴常驻+近期人物热点,坏 JSON 标注勿采信)/【世界面板】get_world_state(剥上回合变化)/【战斗面板】get_combat_state(无战占位)/【上回合变化】get_changes;五脚本真实实现非骨架,snapshot.mjs 退役;systemPrompt 同步"分组面板"。
- **去人格化到底**(用户追加):maintenancePrompt 连"簿记代理"自称都不留——任务制开篇("你的任务:把事实转录进面板文档"),优先级声明保留(本任务优先于系统提示叙事指令);systemPrompt 判定门同步去标签("收到维护指令→只按该指令行事")。**原则:代理不感知自己的实现身份,只感知任务。**

## 2026-09-19(kk) 工具面 v6:原子更新重构
- 用户模型:**主代理专注叙事(数值它本来就知道——lorebook 转写+单步合计),尾代理做客观事实→结构化原子写**;roll 族与 rest 保留(计算器,供易错数值),advance/trade 消亡(规则职责被原子操作吸收:exp 级联内置阈值表,cp 内置三栏规范化+负余额拒绝)。
- **status_update(who,field,value)**:唯一结构化写道——立即写盘/返回文件+字段+旧→新/字段语义与校验全在参数表/who 自动定位 characters 或 combat 敌行;尾代理另持 runtimeRead 抽查校验+runtimeUpdate 整节+runtimeCreate 建档。
- 落账律翻转:**结算量禁入正文律解除**——数值来源=叙事代理的准确陈述(无双真值:转录只搬运),责任收敛为"陈述必须准确"。
- 落盘:status_update 骨架(字段语义全在 value 描述)/advance+trade 删/systemPrompt(工具面+落账律)/maintenancePrompt(原子更新主写道+七步清单含校验抽查)/tools_zh v6/design。
- 补刀:maintenancePrompt 残留"自调职责(advance)"节删除;tools_zh 收缩史/场景例索引/§九 trade/advance 逻辑小节全部归档标注(消亡记录留档,思路继承去向注明)。v6 全量一致:**主面计算器 7(check/attack/cast/damage/initiative/death/rest)+尾面 status_update+前端 front_commit**。
- 补刀完成:maintenancePrompt 自调职责节删除+死引用清理——全文现与 v6 原子模型一致(原子更新主写道/七步清单/三铁律)。
- 补刀完成:maintenancePrompt 自调职责节删除+死引用清理——全文与 v6 原子模型一致(原子更新主写道/七步清单/三铁律)。

## 2026-09-19(ll) 工具面 v7:级联/直编二分
- 用户判据:**只有多步级联配得上工具**——gain_exp(阈值级联:升级衍射 PB/特征/HD/HP/位表/pending)+gain_money(cp 核算三栏规范化+负余额拒绝);其余一切面板变化=尾代理直接编辑 JSON(单步四则+查表:位表查 classes 等级行,休整规则查 rules/resting.md——规则仍在语料,不再复制进工具)。
- rest 从主面移除(短休生命骰掷骰走 damage 工具治疗语境复用);status_update 存续一日即被二分取代(级联/直编)。
- 终态:**主面骰算 6(check/attack/cast/damage/initiative/death)+尾面级联 2+前端 1+直接编辑**;maintenancePrompt 重写(两条级联工具+直接编辑主写道+长休落账细则含 rules/resting.md 查询指引)。
- 补刀:maintenancePrompt 清单第 2 步 status_update 残句→"级联走两工具,其余直接编辑"。

## 2026-09-19(mm) gain_money 忠实化+工具头注释全写+附近 NPC 注入模型
- **gain_money 不拒绝负余额**:忠实落账+回执警示;支出前钱包核对=叙事代理提示词纪律(快照可见,systemPrompt 已加"支出前先核对【玩家面板】钱包")。
- **八工具开头注释全写**:schema+实现逻辑逐步(引用解析公式/攻击链解析序/施法闸区与 DC 推导/先攻 dex 三源/濒死计数/级联明细/货币规范化)入各文件头——照注释直译成代码;全文件语法校验过。
- **注入策略 v2**:「近期人物」退役→**「附近 NPC」名单**(state.md 节,尾代按正文场景每回合更新)+**【人物志】get_roster**(扫描 characters/ 全角色逐条 name—description 简图,零维护)——注入=玩家+同伴+附近 NPC 完整面板,其余人物只有简图;postPrompt 六节;systemPrompt 面板清单与钱包纪律同步;maintenancePrompt 加附近 NPC 名单维护职责。

## 2026-09-19(nn) 提示词补完(用户半成品接手)
- 用户手改方向:systemPrompt 去角色判定门→纯 DM 人格(尾代理靠 maintenancePrompt 优先级声明自恰)——尊重不回加。
- 补完三处半成品:①maintenance gain_money"+负余额拒绝"→忠实落账+回执警示;②铁律 2"多步链(升级/找零/休整)是工具的事"→级联两工具+休整改直接编辑;③systemPrompt 拒绝清单去"余额不足"(gain_money 不再拒绝,钱包核对=DM 纪律已在工具纪律节)。

## 2026-09-19(oo) 级联工具去内部规则+报警概念清除
- maintenancePrompt:gain_exp/gain_money 只说"必须调用"——级联内部规则(阈值/特征/位表/pending)全由工具处理,提示词零规则;systemPrompt 补规则效力序(本提示>SRD>记忆)与"语料所举即全部,不自创怪物法术"。
- **报警概念清除**(用户:尾代理没法报警):维护清单第 7 步删除、校验抽查去"报警"、注入脚本"勿采信,报警"→"勿采信"——尾代理的输出只有面板文件本身,变化日志=它的唯一"发言"渠道,不承担告警语义。

## 2026-09-19(pp) combat.json 时序令+战前铺场
- 用户令:combat.json 非战斗/战斗结束立刻清空;战前先铺场。落位:systemPrompt 战斗五步前增「战前先铺场」条(敌意显现先叙述场景+应对选项,不掷先攻不建战斗面板——接战才开战);maintenancePrompt combat 条强化「战斗结束或非战斗状态,本文件必须立刻不存在(当回合删除)」+「战前铺场阶段不建此文件——它只在先攻掷出后存在」。
- 语义:铺场=叙事段行为(无面板);combat.json 生命周期=先攻掷出→战斗结束当回合,严格夹紧。
- 补刀:maintenancePrompt 经多轮字符串手术后出现节重复——整文件重写为终态(任务制开篇/两条级联工具/直接编辑细则含长休与 resting.md 指引/三铁律/七步清单/combat 时序令/文件规范),零报警零 status_update 零 advance。

## 2026-09-19(qq) 提示词写作律成文
- 用户要求总结提示词方面全部指令→docs/prompt-principles_zh.md:六律 31 条(身份与感知/内容分工/注入面/纪律条款/方法论判词/同源原则)——三份提示词的每处措辞可回溯至此。
- 同源原则首次显式成文:历次修正的共性=让 LLM 承担它看不见或不必看见的东西;修正方向=LLM 只处理此刻任务与眼前文本,机制沉到工具与语料。

## 2026-09-19(rr) systemPrompt 用户手编版整理
- 用户手编(大幅精简:去结构标题/角色门/落账自动段,平铺纪律条)→本役只做三件:①"禁止心算"清单与 v7 对齐(掷骰=工具;价格/经验合计=转写+单步,原句"XP/价格/找零全部工具算"为 v6 残留自相矛盾);②"路径省略前缀"补半句(runtimeRead 时补回——用户早前自定"要说明相对谁"的最低实现);③查法一句复原(两级查询),其余措辞全保留。

## 2026-09-19(ss) 历史对话入口入 systemPrompt
- 用户指令:历史对话在 .chat.snapshot.jsonl 持续更新,可能很长,用 grep 查找。核实引擎常量 CHAT_SNAPSHOT_FILE=runtime/.chat.snapshot.jsonl(每回合重写的会话投影);systemPrompt 事实与面板节增条:runtimeGrep 定位、勿整读、path 口径。

## 2026-09-19(tt) 时间单位四分与研究落盘
- 用户令:研究周期/回合/时间/轮的意义与"过去一单位发生什么",须引 SRD/BR。检索:SRD time.md(时标三阶:地城分/城野时/长途天+战斗轮 6 秒)、casting-a-spell Duration 节(duration=轮/分/时/年/Until dispelled)、BR p.73/p.80、语料 319 法术时长分布实测。
- **时间单位律**入 panel-data:statuses.remaining 必须带单位并按其单位对应时钟递减(轮→combat.round;分/时→time 折算;日→day;场景→切换清除);Instantaneous 不入 statuses;Concentration 走 concentrating;回合锚定效果=DM 叙事裁定。maintenancePrompt 递减规则同步修正(原"逐回合−1"单位含糊,1 小时 buff 按轮递减必错)。

## 2026-09-19(uu) 时间推进协议:声明流逝/机械结算
- 用户三问的定案:①主代理推进时**不需要**知道到期清单——只声明流逝(三轮/一下午/三天后,含糊时尾代合理折算并注明);②状态到期**不是玩家决策点**(机械事件直接落账,HUD 可见;是否叙述=DM 裁量;决策点只有 ASI/休整/HD 既有机制);③DM 完全自由决定推演跨度。
- 机制:尾代理先读后写(state.md 旧时间→新时间→Δt 按单位折算→statuses 递减/删 0/记日志)——单步四则+查表,无新工具(v7 二分律一致)。
- 落盘:panel-data 推进协议/maintenancePrompt Δt 结算/systemPrompt 时间自由推进条。

## 2026-09-19(vv) 时间推移检查清单总集
- 用户令:整体 review SRD/BR/面板,枚举时间推移需检查的变化。检索新证:绝食(3+CON 天后每日末自动力竭+1)/缺水(减半 DC15 失败+1,更少自动+1,均 BR p.70)/生活方式(BR p.55)/强行军(BR p.67 已有)/奥法回复 1/日(语料"Once per day")/疾病时间轴(sewer plague 1d4 天)。
- **分档清单**:每轮(轮 statuses+怪特性)/每小时(时分 statuses+强行军+短休窗口)/每日(日 statuses+绝食缺水+日费+downtime+奥法重置+疾病+长休窗口+预算重置)/通用扫尾——落 panel-data 总集+maintenancePrompt"时间推移检查清单"节(time 进位即触发)。
- 掷骰类(强行军 CON/短休 HD/疾病豁免)=DM 叙事段职责,清单注明"你只落账"。

## 2026-09-19(ww) 时间敏感项登记表落 state.md
- 用户令:state.md 维护"当前随时间变化的内容的清单"(写明必要项),尾代照清单逐项更新,主代理照清单叙事。
- 设计:state.md 新节「时间敏感项」=队伍/世界级时间账的活实例(绝食缺水计数/生活方式/downtime/奥法回复日旗/长休窗口/疾病进程/冒险日预算);**角色 buff 不进登记表**(character statuses 已有,避免双真值)。尾代=逐项结算(计数器进位/定时器递增/窗口判定),主代理=照表叙事(紧迫感)。
- 落盘:state.md 种子七必要项/maintenancePrompt 清单第 5 步+时间检查节接线/systemPrompt 世界面板说明/panel-data 设计。

## 2026-09-19(xx) state.md frontmatter 退役:时间归登记表
- 用户令:时间敏感项的规则解释属维护提示词,state.md 只留空分区+常驻项(当前时间);开头 frontmatter time"没必要了,顺便看看是干啥的"。
- 查证:frontmatter time_day/hour 唯一工具消费者=已消亡的 rest 工具(三铁轨);ui_data 可解析正文行——机器层理由随 rest 消亡。
- 执行:state.md 重写(无 frontmatter;时间敏感项=活值登记:首行「当前时间」+七常驻项空槽,零规则解释);maintenancePrompt(进位对象=登记表首行/文件规范更新);postPrompt 标签;ui_data 契约(time 行解析口径);panel-data R/W 表与 schema;design。

## 2026-09-19(yy) systemPrompt×state.md 交叉审
- 三处整理:①systemPrompt 登记表条目枚举冗余(注入的 state.md 自身已含全部条目)+"逐项检查"系尾代职责泄漏→收为 DM 视角一句;②末行小结双写合并(数值穿插记录+末行小结=一条);③state.md 去泄漏:"尾代/维护提示词/待拍板"meta 字样→被动语态(系统自动记账/规则查 SRD)——state.md 是 DM 可读注入物,同样受"不感知实现身份"律管辖。
- 补:时间敏感项节头同款泄漏(尾代结算/主代理照此)→被动语态。

## 2026-09-19(uu2) 叙事语言风格移植
- 用户令:借鉴老 dnd 卡 systemPrompt 的叙事语言风格,自然衔接加入新卡。移植:「叙事约定与语言风格」节插于流程骨架后/SRD 原文库前(索引保持末尾附录位)——叙事约定(档案既定/姓名相称/任务决策权归玩家/时间跳进)+节奏骨架(铺垫→…→余韵+2~4 行动选项收尾,注明选项是抓手非限制)+语言风格三叠(基底第二人称过去时/战斗短句体感/舒缓细腻克制)。
- 有意不移植:技能点/exp 公式(旧卡 homebrew)、时间标记强制(v7 时间自由推进)、战前轮 2~4 策略(新卡战前铺场已含);暴击渲染并入战斗叠加条。

## 2026-09-19(vv2) 官方纸质角色卡对照:0 缺口定案 + 面板 v8 两刀
- 用户令:Basic Rules 2018 附录三页纸卡(pp.177–179,WotC 2014 空白卡,AcroForm 空校验)字段全提作对照镜;问官方分区架构与扁平架构孰宜 agent。
- 定案:扁平赢——agent 按名寻址不按版面;派生量现算赢"手抄静态值"(官方卡 mod/DC/AC/passive 皆抄录结果,升级/换装即漂移);深嵌套违格式律。官方卡的真实价值=字段完备性清单,沉淀 preset/templates/character.official-sheet.json(参考件不参与出生)。逐格对账:调整值/PB/DC/先攻/passive=派生不落盘(design 明文);外貌六格+symbol→description;backstory/allies/treasure→biography 行/gear 行/lore;features→lore classes 表驱动——**新增合并缺口=0**。
- v8 两刀(用户拍板):①resources 行数组([[名,现值],…] 追加式)收编 res_action_surge/res_second_wind/res_arcane_recovery/res_channel 封闭四枚——原枚举只盖战士×2/法师/牧师,武僧气点·野蛮人狂暴·诗人灵感等无家;②origin 由 _notes 半悬空转登记启用=指向 lore/ 来源实体路径(任务/地点/招募人),出生可空,进 design 机器层全清单。
- 落盘:character.tpl.json(_tpl/_notes/resources/origin)/design 机器层清单行/tools rest 短休回充措辞(扫 resources 行按名回充;顺带修正 arcane_recovery_day"面板记"旧词→state.md 时间敏感项,ww 迁移余留)/README 居民行 v6→v8。

## 2026-09-19(aaa) character.tpl v8 适配审计
- 用户/代理已改 v8:①resources 行数组收编四 res_*(全职业开放,免封闭枚举)——res_* 引用全域已扫零;②origin 登记启用(来源实体路径);③新增 character.official-sheet.json(BR pp.177-179 纸卡字段对照,纯参考件)。
- 适配四刀:①tpl _notes v6 陈旧句(平铺/type 判别)修正为 v7 口径+origin 语义(来源实体路径,非 lore/ 前缀);②maintenancePrompt 长休落账补 resources 池回满(回充时机查职业特征,2014 狂暴警示)+短休池回充提示位(时间清单跨小时档原有);③gain_exp 级联规格(mjs 头+tools_zh)补 resources 池上限更新(class_specific 列原生数据);④maintenancePrompt 新实体建档补 origin 登记(同伴升格/招募)。
- official-sheet.json 定性:纯参考件不参与出生流程——HUD/前端未来可据它补 ep/pp 展示位(现面板仅 gp/sp/cp,pp/ep 走正文,口径不变)。
- 注:校验脚本报错为验证脚本自身天真(裸孔位即设计形态),模板文件完好。

## 2026-09-19(bbb) combat.json 不可代替审计+敌行 statuses 补齐
- 用户问:轮数/状态啥的必须记吗?能否被 state.md 代替?审计结论:**不能**——①先攻值=一次性掷骰事实(重掷变结果),必须战斗作用域持久化;②敌行 HP=全场最高频变异,JSON 数组形状+write-guard 守护;③删文件=原子(时序令),state 删节可遗忘;④【战斗面板】独立=有战/无战注入信号。格式律(随主要作者与读者)自洽。
- 逐项判定:order/round/enemies(allies)必须;act_index 仅断点;**PC/同伴状态不进 combat**(character 文件+combat.round 作时钟,零重复)。**审出缺口**:敌行缺 statuses(敌也会中目盲/毒,轮锚递减无处落)→combat.tpl v2 补 enemies/allies 的 statuses 字段(与角色面板同语法,时间单位律),parse 校验过。

## 2026-09-19(ccc) official-sheet 迁出 templates:参考件归 docs
- 用户令:对照镜不是出生件,放 docs 更合适——按 templates/README 自家定义(top 区=出生辅助层,只住"生成那一刻被读取"的模板),参考件属借宿;docs=开发期文档区(读者=人/LLM,vs HUD 补 ep/pp 展示位的未来消费者见 vv2 定性)。
- 迁移:character.official-sheet.json → docs/(文件名不变,保持 devlog 引用可追);templates/ 回归两模板+README 纯净态;README 居民行收回引用;tpl _notes 指路改 docs/。

## 2026-09-19(ccc) 战斗进入回合的空面板时序钉死
- 用户问:主代理不写面板,战斗面板为空时进入战斗怎么办?答:即正常路径——主代理首回合素材=先攻回执+lorebook statblock+自述伤害增量(单步累计),从不操作面板;尾代理当回合末照 tpl 誓建 combat.json(敌行自 lorebook/character 初始化)并把本回合全部增量一并落账;下回合注入即现值。敌人数据源由"语料所举即全部"律保证。
- 钉死:systemPrompt 战前铺场条下增"开战回合【战斗面板】尚不存在＝正常"句;maintenancePrompt 第 3 步增战斗进入当回合誊建+增量并落细则。
- 注:maintenancePrompt 第 3 步经用户手改精简,按实际文本钉入誊建时序。

## 2026-09-19(ddd) combat 字段审计收口+NPC 精简形态
- combat.tpl 逐字段对照消费者审计:**格式已完备**(order=一次性先攻事实/round=递减时钟/enemies=最高频变异 JSON 形状/allies 瞬态单位;act_index 仅断点)。两微注:_lint 补"誊建剥离 _ 键"+"显式不建三字段"(surprised/xp/战况记事——防实现期自加)。
- **NPC 精简形态**(用户问 NPC 多余字段):exp/hd_available/inspiration/pending/resources/death 计数对纯 NPC 多余(RAW 缺省 NPC 0HP 即死不掷濒死;宿敌走 PC 规则才补)——尾代建档省略之,消费者缺字段=能力不适用;模板零改动(tpl 是 PC/同伴出生模板)。保留:identity/hp/六维/熟练/抗免/languages/concentrating(施法)/statuses/persona/biography/weapons/gear/origin。
- 注:新实体条经用户手改(origin 半句已被用户并入),按实际文本补 NPC 精简形态。

## 2026-09-19(eee) 前端 HUD v7 原型:丑诊断 + 亮色精修定稿
- 用户反馈 v6 原型"太丑"→逐条诊断六病灶:①字号全线 6–9px(最致命,不可读) ②三底色近同=米色海无焦点 ③满屏 1px 米色描边+头像负边距咬合像便利贴 ④HP 珊瑚三色渐变 2012 味 ⑤emoji 当图标跨平台不一致 ⑥gap 3px/padding 6px 零呼吸感。
- 三方向提案(亮色羊皮纸精修/暗色酒馆/玻璃拟态)→推荐并落地**亮色精修**(尊重 ui_zh「亮色羊皮纸系」定案;暗色只 token 层可切,未做)。
- 产出 `docs/hud-proto-v7.html`(静态原型,v6 保留对照):字号≥10px/底色拉深径向晕影+卡面提亮柔投影/金色收敛一支(仅 LV 章·主线边·关键标签)/血条内凹+实心+数字移出条右/SVG 线性图标去 emoji。
- 用户三轮迭代:①右上地图圆盘删除(地点/时日/地形文字块保留) ②主角面板加六维速览行+大头像双环光晕+顶装饰线 ③头像内嵌不伸出+完全贴左上角(top0/left0,左上直角 border-radius 0 0 16px 0)+左侧 3px 金边+顶部金渐变横幅。
- 经验:①"丑"的根因在**执行层**(字号/对比/边/渐变),非结构——悬浮角件+pcard 解剖方向本身正确;②金色要有纪律,收敛成一支比满天喷更显华丽;③原型即 token 文档,正式施工译进 ui/index.js 的 --t-* 与 render*,R2 节级局部重绘硬要求不变。

## 2026-09-19(fff) 濒死计数零落盘+NPC 字段问答
- 用户裁定:①death_success/death_fail 字段全删(PC 也删)——濒死序列 1~3 轮由 transcript 承载,death 工具改计数入参制(DM 传当前成/败,回执给判定,零落盘);②NPC 要升级(exp 保留——同伴=全形态,精简形态仅纯场景 NPC);③pending 由 DM 立刻分配(同伴也是 NPC,不用前端);④inspiration/resources 语义答疑(灵感=BR p.61 玩家扮演奖励;资源池=职业消耗池)。
- 同步:tpl v8.1(death 字段删+_tpl 更新)/death.mjs(计数入参)/maintenancePrompt(濒死零落盘注记+事实提取清单去濒死计数)/panel-data 机器层/tools_zh。

## 2026-09-19(ggg) NPC 三面模型定案:删单 12 键 + 缝补 + 秘密 β
- 用户三拍:秘密走 β(零 schema 变动);施法位表缝由代理荐;先证"NPC 删什么"再落盘。
- **三面模型**:A 生存成长=peer 统一(全员同表同规则链)/B 推演=DM 落盘而玩家脑内自带(persona/biography/活状态/位置走 state)/C 交互=gear·钱·语言·对抗(工具链已跨 who)。v8.1 两档制即此模型的执行版——精简档只省 A 面"不激活"的键。
- **删单(判据=该键对纯场景 NPC 无读者)**:原六件(exp/hd/位表/resources/pending/inspiration)+熟练六件(save_prof/skill_prof/expertise/armor_prof/weapon_prof/tool_prof)=**12 键**;null 默认键不省略。workspace 旧件查无出生 NPC 实证——全省读者面推演,留痕待出生校验。
- **缝补定案:场景 NPC 不施法**——精简档无位表,cast 闸区无据;施法型具名角色一律全形态出生;升档=就地补键,schema 始终一份。
- **秘密 β 口径**:biography 行「[秘]」前缀=未公开情报,永不主动叙述,揭示后去前缀归一般行;biography 双职能定案(出生段=背景,追加行=记忆,不设 memory 键)。
- 顺手:panel-data 中间变量表 death_success/fail 行居所修正为"参数中继+transcript"(v8.1 字段已删的余留漂移);panel-data 新增 二·B 三面模型节。
- 落盘:tpl(_tpl 省略单扩六件/_notes β+缝补)/panel-data(death 行+二·B)/devlog 本条。

## 2026-09-19(ggg) panel-data 用户改动理解+同步
- 用户新增 **§二·B 人物三面模型**:玩家=peer(A 面键全员同表同规则链,不问亲疏)/三面(A 生存成长 peer 统一两档填充·B 推演 NPC 落盘·C 交互)/精简档省略单 12 键(判据=对纯场景 NPC 无读者)/缝补定案(场景 NPC 不施法,施法型具名角色全形态出生)/升档路径(就地补键升全形态,schema 一份)/**biography 双职能**(出生段=背景,追加行=记忆,不设 memory 键)/**秘密 [秘] 前缀**(永不主动叙述,揭示后去前缀)/玩家 B 面不落盘(自带脑内)。
- 同步四处 v9 口径:省略单六件→四件(灵感/资源已全删)/null 键去 origin/§三时序图 v7 化(六骰算+级联+直接编辑,trade/advance/rest 残留清除)/R/W 表三 stale cell(pending 走 gain_exp 级联·exp 同·round ⟦讨论⟧已定案标注)。

## 2026-09-19(hhh) 键能力裁剪律定案(用户令):没有什么能力,就没有相关字段
- 用户令:『场景 NPC 不施法』的缝补不如升律——键存在性跟随能力,**对所有角色生效**(玩家同律:战士玩家天生无施法族)。取代两档制(同伴全形态/场景精简)。
- 律文:无某能力/机制参与 → 键族整族不出生(不留 0/空壳):施法族(caster_attr/spells_known/prepared/slots_l1..9/concentrating)·成长族(exp/pending/hd_available)·features(无职业者)·训练面(熟练六件)。核心键永不裁。已整删机制(inspiration/resources→features 行内池状态/origin/death 两键)非裁剪,另列免混。
- 工具侧:读缺席键=结构化报错(「无施法能力」「无成长面」),不得 NaN 崩读(tools 一·新增可选键律)。
- 落盘:tpl v9.1(header 接律+role 降为路由值/_notes 同步;本会话与用户侧 v9 三删并行演进,此处对齐非回滚)/panel-data 二·B 重写(裁剪律表+整删机制另列+核心键清单;中表 pending/exp/concentrating 行注"键随族",inspiration 行改"机制已删")/design lint 行(必需键=核心集+族条件必需;濒死计数≤3 随 v8.1 删键退役)+机器层全清单 v9.1 口径。
- 教训留痕:panel-data 中表 Rewrite 一次误删四行(当前时间/crit/已耗位/AC派生),当场发现并复原——older_string 跨行粘贴事故,改正后逐行小步编辑。

## 2026-09-19(hhh) 键能力裁剪律适配
- 用户改 panel-data:两档制废→**键能力裁剪律**(『没有什么能力就没有相关字段』,玩家同律;四族:施法/成长/特征/训练;concentrating 归施法族;核心键永不裁;已整删除与裁剪分立;工具侧读缺席键=结构化报错不 NaN 崩读;示例:战士玩家无施法族/掌柜无训练面——玩家=peer 的字段表达)。
- 适配五处:①tools_zh 可选键律精化两行为(族头缺席=报错 cast/gain_exp;修饰键缺席=裸属性解析 check——RAW 正确退化);②tpl v10(全字段对照骨架+出生器按能力族裁剪,concentrating 归施法族,_holes 增裁剪步);③maintenancePrompt 长休落账注记(缺席族跳过不补空壳);④systemPrompt 拒绝例加无施法能力;⑤cast.mjs(族头报错)/check.mjs(裸属性)头注释。

## 2026-09-19(www) 八工具+front_commit+ui_data 完整实现+冒烟测试通过
- **preset/lib/core.mjs 首次启用**(YAGNI 条件达成:8 工具共享件):rnd(LCG/crypto 双态)/rollExpr/mod/pb/readChar(名字→文件三步解析)/readFM(frontmatter 简易解析)/statusesMod/SKILL_STAT 18 映射/toCp(多币解析)/normWallet/WEAPON_SLUG·ARMOR_SLUG 中文名桥/equipmentFM。
- **六件骰算真实现**:check(四形分派:dc/专注 auto/对抗 vs/引用解析含 statuses effect/优劣 2d20/语义回执)、attack(武器链:equipment FM 解析骰式与属性→灵巧择高/远程 dex/熟练 PB/nat20 暴击翻骰/抗免三态→增量输出)、damage(纯骰+半伤×2)、death(计数入参制,零面板落盘)、initiative(combatants 名单→dex 三源自动)、cast(闸区三检+攻击型内联+豁免型逐目标 half_on_save+DC 内算)。
- **两条级联真实现**:gain_exp(阈值表 20 行内置/跨阈值多级连升/PB 查 class 表/特征级联/hp 均值+CON/位表/资源池上限 class_specific/pending ASI+新法术)、gain_money(cp 统一核算/三栏贪婪规范化/负余额照实落账+警示)。
- **front_commit**(scripts 面):三 op(asi: 合计≤2/CON 追溯/spells: 存在性+表额/prepare: ⊆known)。
- **ui_data**:rev(节级 stat)/full(原样投影+derived:AC 装备解析/bar 类别判定)。
- **冒烟**:伪 runtime(/tmp/tav-test:runtime/characters+state.md+preset/lib)直调五件——check ✓/attack ✓(增量+命中判定)/death ✓(计数入参零落盘)/gain_exp ✓(exp 850→950 写回)/gain_money ✓(15gp→5gp 规范化)。

## 2026-09-19(xxx) 全量后端 review
- 五维审查结论:提示词三份/面板数据/代理协作/工具脚本/lorebook 全部自洽,零矛盾零泄漏。
- **修两处**:①postPrompt【世界面板】残句"frontmatter time_day/time_hour 为机器字段"→"「时间敏感项」首行当前时间＝时间真值"(frontmatter 退役遗留);②meta.json desc 从"施工中——语料层已就位"更新为当前实态,v0.1.0-m2→m3。
- 遗留:layout.json codex 声明与 ui/index.js 骨架=前端施工项(后续);meta.json desc 为展示文案不影响运行。

## 2026-09-19(yyy) 开局系统:场景库+出生生成器
- **openings.json**(4 场景):边境小镇/废弃矿坑/荒野古道/海港酒馆——每场景含 narration(开场白)/state(所在·篇章·主线)/npcs(初始 NPC 名单)。
- **opening_commit.mjs**(出生生成器):创角表单 JSON→种族/职业查表(lorebook)→HP=骰面+CON·PB·装备包(四职业常量)→全字段骨架→能力族裁剪→写 player.json+同伴→patch state.md(时间敏感项/所在/篇章/主线/队伍等级)→NPC 骨架建档→返回开场白。
- **前端 opening 页设计**(未实现):三步——①创角表单(姓名/种族/职业/背景/属性三法/技能选二/人设四件)②选场景卡片③确认开场白(可改);提交即调 opening_commit。

## 2026-09-19(zzz) 卡住根因:cn 语料混入 setup→seed 2377 文件
- 用户报:创会话选卡卡住。根因:lorebook-cn(1187 文件)混在 preset/setup/ 里→seedRuntime 一次同步 cpSync 2377 文件阻塞事件循环。
- 修复:cn 移出 setup→docs/lorebook-cn(翻译参考件,运行时不需要);seed 降到 1190 文件实测 0.47 秒。
- 引擎 seedRuntime 为同步 cpSync(recursive)——2377 文件在 macOS 上文件系统开销(每文件 open/close/stat)≫ 10MB 数据量本身。

## 2026-09-19(aaaa) 前端 v7 深色重做 + 工具 schema 修复 + opening/z-index 调试
- **视觉重做**:用户嫌 v6 亮色羊皮纸"丑",多轮原型收敛到 v7 深色 BG3 风(`hud-proto-v7.html`):主角=统一深色面板(264px 贴左上角,首字头像金环+HP红条/位蓝条上下叠数字叠条内+六维金框+翼龙纹水印);同伴/敌人=同构成深色小卡;世界面板深色厚重;龙纹用 game-icons.net 的 wyvern(Lorc/CC BY 3.0)。
- **ui/index.js 完整实现**:v7 token + store/scheduler(rev 心跳 2s→full→节级重绘) + render 函数族(hero/mates/enemies/world/quests) + ctx 详情卡 + rulebook Modal(微型 md 渲染含表格) + opening 隐身/opening-commit 桥 + **front_commit 点选 UI**(ASI 加点/学新法术,pending badge→点选 Modal→runScript front_commit)。
- **rulebook.mjs 新建**:manifest/get/search 三 op + 路径白名单围栏(拒 .. 逃逸);manifest 实测 16 类 1160 条目。
- **ui_data.mjs 修两处**:bar 判定去硬编码英文 class 名单→改面板字段(caster_attr/slots_l1 判施法者/resources 判池,以面板为准);derived.slotsTotal 现算(内嵌 full caster 位表 20 级×9 环——语料无此表,脚本唯一载体)。冒烟:3 级法师 slotsNow2/slotsTotal6/ac11 全对。
- **工具 schema 修复**:8 个工具 @tavern-schema 从占位符(「略」「schema 见 git」)→合法 JSON(description+parameters),引擎 JSON.parse 才不炸;顺带删 initiative.mjs 引用未 import existsSync 的死代码。
- **opening/z-index 调试**(playwright mock 宿主验证):①opening 容器族类名是 openingFrame/openingFull/openingWrap/openingLive 四枚,只查 openingFrame 漏了 openingFull→HUD 开场页右上角闪显;改四枚全查+mount 立即 applyVisibility()+300ms 轮询;②z-index 分层 正文<HUD(20)<详情卡(60)<书本(90)<opening(宿主),HUD 绝不能压 opening;③悬浮角件避宿主顶栏 48px(hero)/62px(right)/274px(mates)。
- **ui_zh.md 更新**:v6 亮色→v7 深色定稿;避坑存档补 opening 容器族类名/z-index 分层/顶栏偏移;施工序列标记完成项。
- 待办:opening 表单页(openings.json+opening_commit.mjs 已备,表单 HTML 渲染层缺)。

## 2026-09-19(bbbb) 前端对齐原型 v7:缩水回填 + 泵 derived 扩容
- 用户报:实现与原型 `hud-proto-v7.html` 完全不一样。比对定案:角件(主角/同伴/敌怪/世界面板)大体忠实,但 ①详情卡被我降级成三芯片(原型=三 tab:总览/装备/技能) ②任务手风琴没做(只有标题行,点击无响应) ③二级面(任务条/详情卡/规则之书/成长待办)全涂黑超出原型授权——v7 原型是"底深卡浅":角件深色 BG3、二级面亮羊皮纸 ④世界面板缺地形 chip 与时段映射 ⑤敌怪缺先攻 chip ⑥总开关硬切无滑出动画 ⑦待办旗用了 emoji 违反无 emoji 纪律。根因:ui_zh.md 蓝图同步被改出缩水版再照图施工——**原型才是视觉正本**,蓝图恢复原描述。
- **ui/index.js 整体重写**:详情卡三 tab 直译原型(摘要芯片+HP横条+施法位圆点+属性三列+状态注/武器护甲杂物钱袋/熟练技能+专业★+豁免+特征);杂兵无 derived=精简总览、敌怪 character 链→按名匹配同伴开全卡;位置跟随点击者(bottom+6 上限 220)+Esc 关闭+tab 态存 store;任务手风琴(点击展开=行文本直读,行首 ✓→完成划线,开态存 store 跨重绘保真);二级面回亮羊皮纸;总开关 translate+opacity 滑出;时段映射(N时→拂晓…黄昏…深夜);先攻 chip;⬜→◆;顺手修委托顺序 bug(待办 chip 在 hero[data-ctx] 内部,原实现 [data-ctx] 判定在前会吞掉点击)。
- **ui_data.mjs 泵扩容**(规则计算归泵纪律):`skills[]`(18 技能→attr 内嵌表+PB 熟练/专业双倍判定,键名归一)/`saves[]`/`attrMods[]`/`slotsLv[]`(每环 now/total)/`weapons[]`(equipment frontmatter join:damage/damage_type/properties,缺席键原样)/敌怪 `init`(combat.order 双向包含匹配)/state 地形解析;bar 池分支随 v9.1 resources 删除而移除(slots|HD 择一);复用 lib/core.mjs 的 mod/pb/readFM(此前自行内联算 mod 属前端越权)。冒烟(/tmp 伪 runtime):AC16/隐匿+8 专业双倍/豁免 DEX+6/shortsword 1d6 穿刺[灵巧·轻型]/地形"温带丘陵"全对。
- **跨层小改**:setup/state.md「玩家所在」节加`- 地形：温带丘陵`行;maintenancePrompt 记账 spec 补"所在与地形"一句(节结构不变,panel-data 分区描述不动)。
- **中英显示名映射**(展示决策归前端,术语=translation-protocol v3 台版锚点):职业 12/种族 10/技能 18/伤害类型 13/武器属性/护甲——hero 职业行此前渲染裸英文键('rogue'),现"盗贼 · 半精灵"与原型一致。

## 2026-09-20(e2e) playwright mock 宿主全链路验证 74/74——揪出引擎 runner 64K 截断与 who 传参两真 bug
- **harness**(/tmp/hud_e2e,node http + playwright chrome channel):mock 宿主 48px 顶栏+亮羊皮纸正文;/runscript spawn 真脚本(cwd=runtime、真 lorebook/真 front_commit 写盘);fixture=4 人物(玩家盗贼/牧师同伴/战士同伴/具名敌怪)+combat.json(先攻+character 链)+主线✓态。
- **74 断言全绿**:HUD 角件数值(AC join/PB/HD 择条)、CN 显示名(盗贼·半精灵)、世界面板(黄昏时段+地形 chip)、任务手风琴(✓划线/展开行文本)、同伴滤敌怪、先攻 chip、详情卡三 tab(施法位圆点 used 3/6、武器 join 短剑 1d6 穿刺 灵巧·轻型、隐匿★+8 专业双倍、特征已用直读)、tab 态跨重绘保真、杂兵迷你卡 vs 具名敌怪全卡、规则之书(16 类/搜索 17 hits/条目渲染)、总开关滑出、opening 隐身、fc modal(合计满 2 禁用+front_commit 真写盘 力 14→16 回读)。
- **真 bug ①(引擎级)**:引擎 runner(`packages/engine/src/tools.ts` NODE_RUNNER_INNER)以子进程跑卡脚本,脚本 `console.log→process.exit` 同步紧跟——>64KB stdout(manifest 67KB)超出内核管道缓冲的部分随 exit 丢弃→**规则之书 manifest 必然截断**,任何管道捕获宿主皆命中。修法:runner 内 `process.exit` 补丁——推迟真 exit 至 stdout/stderr 排空+抑制 exit 后 fall-through 输出(否则 rulebook.mjs 尾行兜底 log 会追加第二段 JSON 打破消费方 parse);实证 200KB payload 完整、exit 0、单 JSON;引擎 92 测试全过。
- **真 bug ②(前端)**:fc modal `who: p.name`(洛克)→front_commit 拼 `characters/洛克.json` 不存在(player.json 固定名)——**玩家永远无法提交 ASI**。改传 `who: 'player'`。
- **顺手**:同伴栈渲染滤掉在场具名敌怪(character 文件同住 characters/,否则同伴+敌人双显示);mock runner 镜像引擎语义。

## 2026-09-20(去轮询) 尾代理完成的事件驱动解锁——去掉 2s 轮询
- **根因**:尾代理完成(`gates.delete`)只是引擎侧 promise 翻转,不产生任何 session 事件;前端 `tailRunning`(唯一真值=引擎 `state()` 的 `gates.has`)只能 `setInterval(pollTail, 2000)` 轮询感知,解锁最多滞后 2s。
- **上一次走弯路的教训**:想用 `append('turn/end', interrupted)` 造完成信号——`turn/end` 是回合边界事件,会改写 `lastTurnEndSeq`、污染 fork seed 边界,导致尾代理 fork 的 seed 重放错位、子会话 inbox 残留 pending → `while(await turn())` 无限循环(mock 里 messages 8 刷屏)。**session 事件各有领域语义/投影副作用,不能随手复用。**
- **正确通道**:`command/done`(`commandId='tavern-tail-done'`,kind='success')。逐条核过安全:SessionProjectionMap 无 command 投影、`lastTurnEndSeq` 只扫 turn/end、`repairSeedInbox` 只 fold `agent/inbox/spliced`、前端 read() 不渲染它——非 splice、非 turn 边界、无投影副作用;commandId 前缀隔离避免与 dsh-commands 命令面板混淆。
- **引擎**:`startTail` finally 里 `gates.delete` 之后 append `command/done`;`import type { CommandId } from '@deepseek-ai/dsh-commands'`。**前端**:read() 加 command/done 分支(`commandId==='tavern-tail-done'`→`onTurnEnd`=pollTail),删掉 `setInterval` 轮询,保留挂载/切换立即一次 + 主会话 turn/end 触发。全程事件驱动,解锁延迟≈RPC 往返+React 重渲染(<100ms,实测),不再有 2s 上限。
- **验证(playwright chrome channel + mock 固定 latency 2000)**:两轮消息均正常解锁(3951/7294ms≈4000ms LLM latency+处理),叙事可见、控制台 0 错误、mock 请求数 4=2 轮×2 请求——**无循环**。诊断期曾加 `console.log` 确认 command/done 确实到达前端(seq 递增 17→30→44→57…),验证后已摘。
- **踩坑**:eventSource 是 push(不是轮询),但「历史重放」会把旧会话的 command/done 反复触发 pollTail——无害(只多读一次最终态),但测量「解锁延迟」时须按 seq 基线区分新/旧事件,否则把历史 seq 误当成本轮完成点。
- **环境**:用户要求 `DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1 DEEPSEEK_API_KEY=sk-mock pnpm start` 直连 mock——删 `~/.dsh-tavern-fengyue/settings.yaml`(其 `llm-deepseek.baseURL` 覆盖环境变量;备份 `settings.yaml.deleted-bak`);credentials 里的真实 key 不阻碍(credentials-local resolve 的优先级=进程环境变量 > store > .env)。

## 2026-09-20(hosted) 面板架构纠正:走宿主 overlay 槽——悬浮不挤正文+左面板+容器级 toggle 动画
- 用户二次纠正:面板必须悬浮且不影响正文位置、要有左面板、toggle 要有动画、opening 期间隐藏。比对宿主源码定位三个根因:①layout.json 声明的 `codex right 320px` 是**停靠槽**(`.tavern-panel-slot-right{flex:none;height:100%}`,flex 兄弟节点)→空面板也挤压正文;②蓝图"不走 layout 槽"条款本身是错的架构;③**宿主 overlay 槽样式为死代码**——TavernApp panel className 从不输出 `tavern-panel-overlay`,而 App.module.css 的 absolute 规则要求双类,overlay 面板从未真正悬浮过。
- **修复**:①layout.json 撤 codex→声明 `hud-left/hud-right` 两个 slot:overlay 面板;②TavernApp.tsx 补 `tavern-panel-overlay` 类(overlay 槽才吃到宿主 absolute+z-30 规则);③index.js 重构三根结构——rootLeft(主角+同伴)住左槽/rootRight(世界+任务+敌人)住右槽/rootTools(总开关+详情卡+规则之书+成长待办弹窗)恒 body 级 fixed;hosted 判定+tick 自愈(React 重渲染清空容器→ensureHosted 每 tick 校正归属;mount 常先于宿主首渲染,容器后出生也能升级);④toggle 动画作用于宿主容器本体(.panel-hidden→translateX±280/240px+opacity,0.3s spring——容器在 .dnd-hud 作用域外,var(--spring) 不可达,缓动写字面量);⑤opening 隐身扩大到宿主容器+三根(300ms 轮询)。
- **mock 宿主升级**:page.html 模拟宿主 stage 骨架(cardStage flex 列+relative/overlay 槽 absolute z-30/transcript 全宽/composer 占位);e2e 增断言:HUD 住进双槽、容器 absolute、**正文不被挤压(transcript 宽=stage 宽)**、容器 pointer-events:none 不挡正文、toggle 滑出动画 0.3s、opening 隐藏容器、清空容器后 tick 自愈重挂;fixture 复位内置 drive 开头(上轮 e2e 真实消耗 pending 导致 fc 断言摆动)。**81/81 两次运行稳定全绿**;ui 包 40 测试过(TavernApp 改动)。
- 教训:前端验证必须模拟宿主真实集成形态(layout.json→TavernApp panels() 渲染路径),只测卡片自身 DOM 会漏掉停靠挤压与死代码两层集成 bug。

## 2026-09-20(live) 真宿主联调:opening 创角页落地 + opening_commit 两处出生 bug 修复
- 用户报"左面板还是没有"——直连真应用(127.0.0.1:3080,bin/dev.mjs 隔离家)playwright 联调定位:**HUD 挂载链路在真宿主全部正常**(双 overlay 容器+三根 hosted ✓),空的真因=会话 runtime 无 characters/(角色从未出生)——opening 创角表单页是蓝图挂账的最后缺件。
- **新建 preset/setup/opening.html**(沙箱 iframe 自绘,v7 深色金视觉):三段式——身份(姓名/种族9/职业12/背景)、六维标准数组互斥分配、技能18选2、人设四件+阵营、场景卡(嵌入 openings.json 静态数据,沙箱无网络)、开场白可改;提交→postMessage `opening-commit`→卡 UI 桥→opening_commit.mjs 落盘→ack→完成页→`tavern-insert` 填 composer。
- **真宿主联调揪出 opening_commit 两处出生 bug**(mock 冒烟遮不住):①runtime 无 characters/ 目录时 writeFileSync ENOENT(种子无此目录,t0 首建——mock 冒烟时手工建过目录)→mkdirSync(recursive);②openings.json 读取路径错——`new URL('../setup/…', 'file://…/preset/')` 把 preset 段剥掉解析到 `<workspace>/setup/`(不存在)→改直读 runtime 根(种子同层)+preset/setup 兜底。调试手段:引擎失败路径丢弃 stdout→运行时副本旁路 debug 日志(runtime/commit-debug.log)+桥 ack 探针,复现链路后以干净源覆盖。
- **真应用全流程 5/5**:清空→opening 出现→填表提交→player.json+NPC 骨架(老隐士/镇政厅文员)+state.md patch→composer 预填开场白→HUD 主角卡显形(洛克·盗贼·半精灵)。
- **联调方法论教训**:①侧栏会话行按 workspace 绑定——"DND·边境小镇"是旧 dnd 卡,"DND 5e · 原味跑团"才是 dnd5e,探针点错行白查一轮;②token 每次取 log 尾;③清空不删 runtime/characters(只重播种 setup);④旧会话的 preset/ 副本是出生时快照——**用户须新建会话或「清空」才能吃到卡更新**;⑤mock 冒烟遮不住的恰是目录状态与路径假设——真宿主联调必须做。

## 2026-09-20(去轮询·补) 尾代理解锁的「过早解锁」真 bug——乐观锁 + cmd-done seq 门槛
- **timing 实测定位**(mock 零延迟,playwright + 引擎/前端双端 `[timing]` 打点对齐):尾代理整段(fork→LLM→whenIdle)=133ms,`whenIdle-done → 前端解锁`=49ms(append→push 34ms + React 渲染 15ms)——**尾部无 2s**,用户感知的「2s」就是 mock `--latency-ms 2000` 的 LLM 返回等待,与解锁无关。
- **揪出真 bug「过早解锁」**:前端在 `turn/end(completed)` 时立刻 pollTail,而引擎 `onSessionEvent` 与前端事件流是**两个异步消费方**,时序不保证——pollTail 此刻读到 stale 的 `tailRunning=false`(引擎 `gates.set` 尚未置位),导致前端在**尾代理写盘窗口内提前解锁**(实测 975ms 解锁 vs 尾代理 1111ms 才完成),玩家能抢在维护落账前发下一条=数据竞争。
- **修复**:①`onTurnEnd(lock)`——`turn/end(completed)` 用**乐观锁**(先 `setTailRunning(true)`,尾代理必然 fork),只由 `command/done` 完成信号 pollTail 落真实值解锁;非 completed(aborted/error)落真实状态。②`command/done` 分支加 **seq 门槛**(`primed && seq>seenCmdDone`),与 turn/end 同款——历史重放不触发,否则重放会在主代理刚结束、闸门未置位的窗口读到 false 而提前解锁。
- **验证**:修复后两轮消息解锁 1024/1159ms(发送→解锁),叙事可见、控制台 0 错误;诊断 `[timing]` 已全部摘除,host/client typecheck + build 通过。教训:**跨异步消费方的状态同步,读侧不能靠「立即拉一次真实值」,要用事件语义乐观置位**——completed 必然引出尾代理,就该锁,而非读一个可能还没翻转的闸门。

## 2026-09-20(删卡延迟) 会话删除的两处慢:sessionsOverview N 次全量探测 + 会话日志永生
- **现象**:mock 零延迟下删会话仍要 ~2s 才有反应(删空会话也卡)。
- **根因 ①(N×全量查询)**:`sessionsOverview` 的孤儿检查对**每个 workspace 单独调一次 `sessionQuery.listSessions()`**——N 个会话行 = N 次全量持久化扫描;删卡触发 `refreshRows → workspaces RPC → sessionsOverview`,正是这条热路径。修法:**一次 `listSessions()` 收集成 `Set<SessionId>`,逐行判**(一个 `durableSessionIds()`,查询缺失/出错=available:false 时全保留——漏删一行比多显示一行糟)。删小卡 1946ms→378ms。
- **根因 ②(会话日志永生)**:`listSessions` 实测 256-661ms/703 条——`dsh-session-query` 的 corpus 列表=**目录扫描**(无索引),而「删会话」只删 workspace 目录,**session log(dsh 持久化 `<dshHome>/sessions/<projectKey(cwd)>/<sessionId>/`)永生**;尾代理每回合 fork 一个子会话都落一条,越删越慢。修法两刀:①`deleteSession` 先 `stop()`(取消在途回合/尾代理,防写手在 rm 后重建目录)再连**整个 project dir** 一起 rm——主会话(历次 rebind 的所有 id)+尾代子会话+写卡 agent 全在同一 key 下;②**启动孤儿清扫** `sweepOrphanSessionLogs`(挂 restoreBindings):sessions 根下 key 指向的 tavern workspace 已不存在=孤儿,rm;非 tavern project dir 一律不碰。projectKey 编码器(分隔符→`-`、危险字符→`~XXXX`、`--…--` 包裹)按钉版内核复制,与实盘 home 逐字核对;未来内核改名则 rm force 无害空转,退化为旧行为。
- **验证**:清了 122 个孤儿 project dir(全部对应已删工作空间,现存唯一 workspace 从未跑过持久化回合零误伤);全周期 playwright:建卡→发消息(产尾代 log)→删卡 → **sessions project dirs 0 残留**、行消失 434ms;两轮消息解锁 1010/994ms 回归正常、0 控制台错误。诊断 `[sweep-dbg]`/`[timing]` 已摘净。
- **教训**:①「列表慢」先查**每行一次的全量探测**再查单次成本——把 N×全量合并成 1×全量是数量级收益;②删业务数据时要想到**关联的持久化痕迹**(session log/artifact),kernel 不提供删除面时,按钉版内核的存储布局补引擎侧 GC(删除+启动清扫双刀),并在注释里写明布局出处与退化路径。

## 2026-09-20(anchored) CSS 挂靠架构收敛:单一 stage 锚定 regime——根治"面板跑到会话侧栏"与重绘卡顿
- 用户报:面板很卡、左面板经常跑到会话侧栏上。根因自认:挂靠有两条定位 regime——宿主容器缺席(React 首渲染/换绑空窗)时回退 **body+viewport fixed**,HUD 落视口左缘=压住 260px 会话侧栏,容器出生后(2s tick)才跳进聊天区,每次进会话都闪一次。卡顿=rev 每变(尾代写盘期)就整段 innerHTML 重建+详情卡开态每 tick 重建。
- **修复(ui/index.js)**:①定位统一收敛——`place()`:宿主容器 → 退而 `.tavern-stage` 直挂(同款 absolute 锚聊天区坐标,`dnd-hud--anchor-l/r` 类) → 仅无 stage 的独立页才 body;任何 regime 都不落视口坐标。②`MutationObserver`(body subtree)容器出生/重建即时搬挂,不等 2s tick;place 有归属判定,重入无副作用。③`paint()` 内容 diff:HTML 未变不碰 DOM——render 五件+openCtx 全量接入,尾代写盘期与开态重锚定零重建。④列升合成层 `will-change:transform,opacity`+`padding-bottom:96px` 避让 composer。⑤toggle 滑出兼容容器/锚点两种宿主。
- **mock 宿主升级**:加 260px 会话侧栏+app 双层结构;新增不变量断言:hero.x ≥ stage.x(不压侧栏)、hero.y ≥ stage.y(不压顶栏)、挂靠非 body、容器删除→观察器改挂 stage 仍锚聊天区、容器重建→HUD 搬回容器、**rev 变但内容未变→innerHTML 0 次重写(paint 跳过回归)**。87/87 全绿。
- **真宿主证据链**:.tavern-panel-hud-left 确为 relative stage 子级、卡样式已注入生效(computed absolute/left:0);此前的 x=0 测量值是 opening 隐身态(display:none)——恰是 spec 行为。联调方法论补遗:多同名会话行+用户并发操作会污染自动探针,量可见子树而非 querySelector 首个。
- 遗留:用户侧需新建会话(或对旧会话清空)吃新文件;我调试用会话(DND 5e · 原味跑团 ×N)可删。

## 2026-09-20(compact) 主角面板紧凑化 264→208px——用户反馈挡正文
- 左列(宿主容器/锚点根)与主角面板 264→208px:头像 44→34、名字 16→13、条 13→10px、六维/元信息字号与间距同步收、水印 140→100;同伴卡同构成收缩(av 44→36/body min-width 176→150);详情卡 264→208 同宽;body 兜底 mates top 274→236。mock 断言加 hero 紧凑宽(196~212)与列宽=208 锁定。89/89 全绿。

## 2026-09-20(roll) 创角页加「随机分配」——一键 roll 全套免手填
- opening.html 顶部加 ghost 金钮「◆ 随机分配」:姓名(20 名池)/种族/职业/背景(14 池)/六维(标准数组 Fisher-Yates 随机排布,天然满足互斥)/技能 18 选 2(重 roll 清旧高亮)/人设四件+阵营(池随机);flash 支持 ok 绿态提示"可再手动微调"。roll 后仍可逐项手改。
- 验证:playwright 直载 opening.html 连 roll 三轮——每轮姓名/种族职业/背景/六维=标准数组排列/技能恰 2/人设五件全填,18/18 全绿;截图目检。

## 2026-09-20(ctx-near) 详情卡跟随角色卡弹出——不再钉死视口最左
- 用户反馈:点开的详情卡在最左(视口 left:14 在真布局里就是侧栏附近),应贴着角色面板。openCtx 重排:先 add('open') 再量尺寸;垂直=anchor.bottom+6 且钳制不出视口下缘;水平=anchor 右侧+8,右缘放不下(右列敌怪卡)翻到 anchor 左侧-8。刷新重锚定仍保留上次位置。mock 断言:主角/同伴卡→卡右侧贴 +8(±2);敌怪卡→翻左侧;卡不出视口。90/90 全绿。

## 2026-09-20(opening-pure) 开局只落主角——同伴/场景 NPC 一律不种档
- 用户反馈:一上来 HUD 同伴区就有两张"队友卡"（老隐士/镇政厅文员——openings.json scenario.npcs 经 opening_commit 种的骨架档,ui_data 把 characters/ 下除 player 外全归 companions 渲进同伴区,场景 NPC 看着像队友）。
- 定案:开局只落主角。opening_commit 删 mates 写入循环+scenario.npcs 种子建档;openings.json 四场景删 npcs 字段,_doc 注明"NPC 由 DM 按叙事在场内建档";同伴区今后=运行期 DM 建档的人物减在场敌怪。state.md 队伍节措辞不动（运行期仍成立）。

## 2026-09-20(combat-compat) combat.json 键名失配修复——兼容层+提示词硬约束双保险
- 真局实锤（ws-20260920-180355-556-1 巨狼战）:尾代誊建 combat.json 自造 initiative/combatants/team/score 键名,无视 templates/combat.tpl.json 的 order/enemies/side/init——ui_data 只认模板键→敌人区空置+巨狼漏进同伴栈当"队友"。
- 双保险:①ui_data 加兼容层——combatants+initiative 在场时归一到 enemies/order（teamOf:先攻行 join,缺行撞主角名=pc 余按敌方;字符串 statuses 升为 {name} 对象）,渲染端零改动;②maintenancePrompt 战斗清单加键名硬约束（顶层仅 round/act_index/order/enemies/allies,行键列全,自造键=HUD 敌人区失明）。
- 验证:18:41 autosave 的失配 combat.json 做 fixture 跑真 ui_data——巨狼归入 enemies(hp35/37 ac14 init11 join 成功)、洛克排除、order 归一 ✓;playwright(chromium headless shell)载真 index.js+真泵输出截图——巨狼进敌人区带先攻 chip,同伴栈只剩两场景 NPC ✓。

## 2026-09-20(radar) 主角面板六维格→头区右侧六角雷达
- 用户定案:六维做成六角图表放名字右边。48px 纯 SVG 零依赖:三圈导轨六边环+辐射线+金色半透明填充多边形,顶点单字标签(力敏体智感魅,顺时针);刻度 3~20 线性归一((v-3)/17,标准数组 8~15 差异可见);数值走 <title> 悬停+ctx 详情卡——面板不再显示 +/-（调整值掷骰时由泵/工具照算,不在 HUD 占位）。六维格整行删除,面板再省 ~21px,body 兜底 mates top 236→216。attrMod 前端定义随删（ctx 卡数值+调整值保留——角色卡惯例）。
- 同步:hud-proto-v7.html 主角区换静态雷达 SVG(视觉正本不降级);ui_zh.md 主角面板规格+字段对应表同步。
- 验证:playwright 截图目检——标签无裁切、形状诚实反映 8~15 数组(智/感外凸力内凹)、与名字行对齐良好;色对比 validator 单色系过 3:1。

## 2026-09-20(no-combat-json) combat.json 退役——战斗并入 state.md「## 战斗」节
- 用户定案:卡不应有 combat.json（先攻描述里"序列由转录任务落 combat.json"这类话也不要有）,战斗相关记录进 state.md;templates/combat.tpl.json 随之退役。动因=巨狼案:JSON 模板管不住尾代自造键名,md 行更抗写歪,且少一层"誊建/推进/删除/归档"文件生命周期。
- **行语法**（state.md「## 战斗」节,无战=「（无战斗）」占位）:`- 回合：N`、`- 先攻：名:值 > 名:值`、`- 敌行：名 | HP 现值/上限 | AC n | path:lorebook相对路径 | 状态文本`、`- 友行：` 同语法（无档案友军）。杂兵必带 path 供 attack/cast 查抗免;具名有档者 path 可省。
- **解析下沉 core.mjs**:`combatSectionLines/foeRow/parseCombat/combatFoe` 四件——ui_data(敌怪卡数据+先攻 join+具名敌撞 character 档)、attack/cast(目标 AC/path→statblock 抗免)、get_combat_state(节原文直出)四家同源。path 语义=lorebook 相对（旧 combat.json 存全路径会被 readFM 二次拼前缀——随迁修正的潜伏 bug）。
- **消费面改道**:ui_data 删 combat.json 读面+上一步的 initiative/combatants 兼容层（已无意义）,rev 无独立 combat 节（随 state.md 心跳）;attack.mjs/cast.mjs 目标解析改 combatFoe 优先→character 档退化;initiative.mjs 描述与回执删 combat.json 提及;maintenancePrompt 第 3 条重写为战斗节生命周期(开战=照先攻回执改写/回合推进/战毕=命名敌终态回写+清回「（无战斗）」),第 5 条挂"战斗节按第 3 条维护";systemPrompt 战前铺场/开战回合两条措辞同步;state.md 种子增「## 战斗」节;combat.tpl.json 删除,templates/README 与 character.tpl 注记同步。
- **验证**:fixture state.md 造战况(回合2/先攻序/杂兵行带 path/具名行/友行)→parseCombat 全对(round/order side 推断/init join/character 撞名);attack vs 杂兵=AC15 自敌行、vs 具名=AC14;get_combat_state 直出节原文;playwright 真 index.js+真泵输出截图——敌人区两卡(哥布林甲 2/7 AC15 先攻9 中毒 chip+巨狼 35/37 先攻11),同伴栈无巨狼 ✓。六文件 node --check 全过。

## 2026-09-20(readFM-tolerant) readFM 前缀容错——combat path 全路径双拼 ENOENT 收尾
- 真局实锤（ws-20260920-200129-074-1 恐狼战）:格雷 attack 恐狼 exit 1 无输出——旧 combat.json 敌行 path 存全前缀（dnd5e-srd-lorebook/monsters/dire-wolf.md）,readFM 再拼一次→ENOENT 未捕获异常走 stderr;而引擎 runCardTool 只捕获 stdout→宿主只见「Exit: 1」不见原因。
- 卡侧:core.readFM 剥离多余 lorebook 前缀（容错全/相对两种 path,与战斗节相对路径语义兼容）;live 会话（旧快照 preset）同款外科修补,当回合即恢复。
- 引擎侧（tools.ts stderr 入回执）随流式分支一并提交。

## 2026-09-20(opening-init) 开场页接通 openings.json 单源 + 桥应答 + opening_commit patch 正则对齐现模板
- 用户报:点「落盘并开始冒险」不落盘、开场白不进输入框、场景也没用 openings.json 的可选项。双向盘:①宿主侧——工作区懒树化后 ui 包 loadCardUi 按「树里有 preset/ui/*」探测恒 false,卡 UI(含 opening-commit 桥)不挂载,提交石沉大海(宿主侧修复见根 docs/devlog_zh.md);②卡侧——opening.html 仍用内嵌单场景副本(文案已与库漂移),openings.json 四场景根本没进页。
- 卡侧修复:preset/scripts/opening_data.mjs 新增(cwd=runtime 直读 openings.json,旧布局兜底,缺 scenarios 非零退出);preset/ui/index.js 桥加 opening-init → opening-init-data 应答(镜像 dnd 卡握手);setup/opening.html 场景渲染改可重建 renderScen(修掉首版「每张卡都显选中」的 'scn on' 恒挂),内嵌副本同步为四场景现文案且降级为兜底——开场页加载即向父页要场景库,桥应答即按库重建(此后改 openings.json 即生效,不再双处维护);narrDirty 判定保留用户手改的开场白。
- 顺修:opening_commit.mjs「当前篇章」「队伍平均等级」两处 patch 正则按旧模板措辞写(节名「## 当前篇章」/队伍首行即等级)——现模板「## 篇章进度」+ 两 bullet 下是静默 no-op,海港开局篇章行错停边境小镇。对齐后 fixture 实跑全命中。
- 用户拍板二次修正:一键全包且零跳转——ack 成功即 post tavern-insert 把 payload.narration(textarea 现值)直入宿主输入框;「✓ 角色已诞生」完成页整个退役(#ok 块与 .done 样式删净),页面原地不动:按钮变「✓ 已落盘——开场白已填入下方输入框」禁点态 + flash 一句。payload 带 narration 顺带修掉「手改口播 ≠ 落盘脚本返回」的分叉。
- 验证:临时 runtime fixture 用引擎同款 runner 实跑 opening_data(四场景)与 opening_commit(port-tavern 五项 patch HIT/未知 id 兜底 HIT);playwright 真宿主 e2e(独立端口实例,用户前台实例的 token 打在其终端)——scenCount=4、切场景叙事、单次点击后按钮原地变已完成态且 #ok=0/#form 仍可见、输入框即时含「歪桅杆」156 字(无二次点击)、player.json/state.md 落盘(SMOKE-PASS);老会话工作区持旧副本,载一次卡/开新会话即吃新件。

## 2026-09-20(term-audit) cantrip 核查后维持「戏法」+ 详情卡「敌怪」兜底标签撤除
- 用户点名核查 cantrip 译名("戏法翻译不对"):网络核查结论——两岸主流谱系一致作「戏法/戲法」(大陆官中 PHB、BG3 官方简中、纯美苹果园繁化系、灰机 wiki、台湾泉媽團站),即它是通行标准而非误译;台版谱系仅 trpgtdnd.weebly「D&D 5E 中文化」一支作「小法術」。用户终裁:**维持「戏法」,不改**(曾短暂全量试扫 小法术,依终谕整体还原,git 归账零净差;此条为查证结论存档,防后续重开)。
- 「敌怪」标签撤除(用户定案:敌人也可能有职业,标签不能区分 NPC 与敌,弃用):唯一可见出处=详情卡副标题兜底 `c.character ?? '敌怪'`——NPC 档缺 level 时职业位错显「敌怪」。改法:副标题 LV/职业/种族**逐段拼装、缺什么略什么、零兜底**(level 在→LV n 职业;否则有 class 只给职业;race 在再追加;全缺=空)。复查面板/开页/工具无其它「敌怪」可见文案(余下 4 处全为代码注释与文档作者用语);角色模板无该默认值。ui_zh.md 的数据流章节用语(敌怪=作者对敌怪卡的称呼)非可见文案,不动。
- 提示词/运行时语料核查:preset/prompt、setup/dnd5e-srd-lorebook、scripts/tools 全文均无「戏法」(运行时语料为英文 SRD 原文)——该词只存在于 docs 译稿层与协议术语表,如未来译库入卡需按本条口径。

## 2026-09-20(no-combat-injector) get_combat_state 撤并 + HUD 敌人区退役
- 用户裁定:战斗数据已在 state.md,get_combat_state 与 get_world_state 注入的是同一份文件的同一批行（世界面板=state.md 全文剥「上回合变化」,战斗节随文在内）——每回合重复注入第二遍纯烧 token。postPrompt 删【战斗面板】注入节,脚本删除;systemPrompt 六节→五节（战斗现值在世界面板战斗节）。
- HUD 敌人区退役:战斗呈现归 DM 叙事,右列只剩世界面板+任务。ui_data 的 combat 解析保留（同伴栈仍按敌名滤除在场具名敌怪——否则战斗中的具名敌漏进同伴区）;attack/cast 工具照吃战斗节敌行。renderEnemies/sec-enemies/enemy CSS/openCtx enemy 分支删除。
- 战斗机制与数据面不动:先攻/攻击/施法工具、战斗节生命周期、战前铺场规则全在。

## 2026-09-21(ui-v8) 身份化主卡 + 宽幅数据册 + 环境面板——v8 原型定稿与改造起步
- 用户数轮口授定向(2026-09-20~21),v7 全套被取代,视觉正本=`docs/hud-proto-v8.html`(页面注记了每轮范围;原型每轮截图验证)。蓝图整篇重写为 v8(本目录 ui_zh.md)。
- **HUD 主卡=身份层**:像素头像+名字+种族徽签+性别符号(♂蓝靛偏紫/♀粉/未知=金环无符号·兜帽)+HP 绝对值 `现值±临时/上限`(用户定案不用百分比,临时 HP=琥珀附段骑血条右缘)+状态行(kind 三色 chips——用户后补:主页面必须显示临时状态);AC/位条/职业不进 HUD(别绑太多)。同伴同构成缩小。
- **详情卡=宽幅数据册(544px,取代三 tab 弹卡)**:册头=头像+身份+常驻 HP;左栏=大六维雷达(**顶点标数值+修正,代替属性列表**——用户定案"雷达替代属性列表提供冲击力")+豁免+技能 18 全列;右栏=速览/状态/施法/装备背包/特征/训练语言/抗性;末节小传+追忆。去 tab;滚动条隐藏,余量提示=底部渐隐+下行金箭头(用户点名)。[秘] 行纪律:NPC 永不显示,玩家显示但去前缀;biography 行容错剥「· 」(曾因数据行带前缀致秘行漏显,已修)。
- **环境面板重做**:地点层级三行(大区›区域›地点)+第N日·钟盘(24 刻度,夜月昼日)+天气 SVG+地形 chip+**昼夜四档变底**(拂晓/昼/黄昏/深夜,夜档星点闪烁)——用户点名"背景随时间变换,比如钟表,dnd 风格"。state.md「玩家所在」节随之升级为层级三行+地形+天气五行约定,pump 拆解投影(旧单行兼容)。
- **头像素材契约(三学位)**:①像素生成器=占位正本,唯一实现住 ui/index.js(v3:28×32 设计量化到 14×16 粗网格——用户裁定"低像素一些";每族独立头型,女美丽男有特点,高美感人形基底+种族特征);②图片槽 `preset/ui/avatars/<race>-<gender>.png|webp|jpg` 覆盖渲染(pump op:avatars 投影 dataURL,换图=丢文件零代码,素材用户后续提供);③opening 创角页选种族/性别即时预览,走 postMessage `opening-avatar` 桥应答(零拷贝,宿主缺席静默隐藏)。
- **gender=新 schema 字段**:character.tpl.json v9.2 加 `gender`(male|female|unknown,unknown=金环无符号+兜帽);三处补齐=tpl/opening.html 表单(♂♀未知三段+随机池)/opening_commit.mjs 落盘。泵 derived 增补 法术DC/法术攻击/被动察觉(纯规则计算归泵,前端零规则)。

## 2026-09-21(avatar-sheet) 全种族贴图投放——切图上线 + stdout 64KB 截断实锤
- 用户投 4096² 全种族贴图(`docs/头像.PNG`:3 列 ♂/♀/兜帽 × 10 行,行序=人类→半精灵→精灵→高等精灵→矮人→半身人→地侏→半兽人→提夫林→龙裔)。贴图非均匀网格(行高 365~456、立绘纵向粘连),纯投影/连通域都不行(相邻立绘 alpha 相触,组件 15 非 30)——最终**每列行投影局部极小候选 + 分层 DP 选 9 切点**(相邻间距 280~1000、代价=min(谷深)+409.6 吸引),三列切点同排吻合即网格成立的独立判据。三十格紧致 bbox → 方形透明衬垫 → 192×192 webp q85(每张 ~14KB)投 `preset/ui/avatars/<race>-<gender>.webp`;切图验收件=`docs/avatar-sheet-slice.png`(行列标签拼图,映射与用户给定序一致)。
- 结构适配:img 变体 CSS(`.pix-av` 分 `svg`(内缩)/`img`(满铺 cover)两形态);泵 `op:avatars` 增 `keys` 过滤;前端**逐键懒取**(单键 ~19KB,命中缓存即 rerenderAll,缺席落生成器不重试),opening-avatar 桥同跳。
- **stdout 64KB 截断实锤(重要引擎坑)**:卡片脚本 `console.log(大JSON)+process.exit(0)` 在 macOS 管道(64KB 缓冲)冲刷未完成即退出→**静默截尾**(单键 100KB JSON 恰断在 65536)。修复=pump 加 `emit()`(等 write 回调再 exit),avatars 分支先改;引擎 runCardScript 前端路径本就无 cap(prompting.ts 直返 stdout),模型面工具另有 TOOL_OUTPUT_CAP=8000 不相干。避坑存档=ui_zh 避坑 12。
- 验证:真 Chromium+真 loader 逻辑+真卡包+真泵(单源 bridge fixture,argv 注入齐平引擎协议)——HUD 主角(半精灵男贴图)/同伴(半兽男贴图)/册子头图全部贴图渲染;单键 23KB、整表 591KB 双探针均完整;253 测试全绿。
- 素材疑点备忘:第 7 行囧(用户序=地侏 gnome)在该图里呈绿皮大耳造型(更像 goblin 系)——已按用户给定序部署,如与构想不符换图即可(丢同名文件进 avatars 目录)。

## 2026-09-21(pixel-gen-retire) 像素生成器整族退役——兜底=首字头像
- 用户定案:贴图全量投放后,程序化像素头像生成器(RACE_PIX/avatarSvg,28×32→14×16 两代)不再需要,兜底也不用它——**槽键未命中=渲染名字首字**（`.pix-letter`,DP 环色仍随性别;开页预览 `.av-letter` 金字,名字字段实时出字、roll 随名刷新、选种族命图即换图）。index.js 删生成器整块与专属色值;头像职能收敛为「图片槽逐键懒取 + 首字兜底」两层。
- 教训入库:删生成器时把同区的 `dashId` 一并带走——`avatarFor` TDZ 静默炸在 tick 的 try{}里面板整列空壳(node --check 不报运行期死区)。修复即补;删除大区块时逐符号 grep 残留引用必须包含**小工具函数**（本期 leftover 检查只盯了生成器主件）。
- 验证:图槽命中(洛克/老铁贴图)与未命中(石牙 goblin→「石」首字)双态截图;opening 表单预览三态(无桥首字/桥在无图首字/桥在命中图逻辑顺延);253 测试全绿。

## 2026-09-21(npc-inject-v3) 附近 NPC 注入 v3——名单退役,叙事点名即在场
- 核实:注入器旧循环无视「附近 NPC」名单全量注入 characters/(注释与实现相悖),名单层失效;同伴判定三处各说各话(roster 查 role、注入器查队伍节文本、state.md 模板写 role:npc)。
- 定案:**注入判据=最近一轮主 agent 正文∪玩家本轮文本**(扫 `runtime/.chat.snapshot.jsonl` 最后一条 assistant 行+最新 user 行,名字=文件名 stem,`seen.includes(name)`)+**同伴(role:companion)常驻**——零名单可维护,误注入(回忆性提及)只多不少方向安全,人物志兜底。开局空窗(无 assistant 行)自然退化=同伴集,开局只落主角故为占位文案。
- 配套:state.md「## 附近 NPC」节与尾代维护职责废除;role 约定入法 `pc|companion|npc`(maintenancePrompt 第4条,入队/离队改 role,注入器按它判定常驻);systemPrompt/principles 13 同步;HUD 走 ui_data 自扫全量档不受影响。

## 2026-09-21(no-panel-forensics) 「面板又没了」破案——芙宁娜草稿会话 + loader 缺包告警
- 用户报面板再失。现场取证(CDP 只读 attach + 工作区直查):用户停在新会话 ws-20260921-024010——其 preset=**建卡骨架形状**(prompt/meta.json/assets/setup/scripts+README;无 ui/lib/templates),meta.json title=**芙宁娜**、cover 指向刚上传的图,runtime 仅 README → **是「芙宁娜」新卡草稿会话,不是 dnd5e 装卡失败**;卡 UI presence-probe(四件套直读)自然全缺 → loadCardUi 静默 null → 无面板可挂。dnd5e 两工作区(010731/023809)preset 完整含当日全部新代码。
- 行为修——正是这行静默 return 把「草稿卡没有面板」伪装成「代码坏了」:card-ui.ts 缺包路径加响亮 console.warn('has no preset/ui pack — nothing to mount(draft card or ui-less card)'),将来一眼可辨。255 测试全绿。
- 经验记档:多卡并存时代,“面板不见”第一嫌疑=当前会话是不是另一张卡/草稿(每卡 ui 独立,presence-probe 是按会话工作区算的)。芙宁娜要 dnd5e 同款面板得给它配自己的 ui 包。

## 2026-09-21(birth-trim) 出生器裁剪空数组 + classRow 序数词等级列修复
- 用户查 postPrompt 注入面板冗余,点名两处:①空数组不该写出来 ②features 缺失要修。定根因于 opening_commit.mjs。
- **空数组裁剪**:panel 组装完 `JSON.stringify` 前过 `stripEmptyArrays`——空数组键整族删除(约10个:expertise/armor_prof/weapon_prof/tool_prof/resist/immune/pending/statuses/features(空时)/skill_prof(空时))。模板「键能力裁剪律」(_tpl:没有什么能力就没有相关字段)落地;null(无子职/无暗视)与空字符串(无甲)有语义保留。前端 ui_data.mjs 与 index.js 全程 `?? []`/`Array.isArray?…:[]` 兜底,字段缺席安全。
- **classRow 双 bug**:①等级列在 SRD 表里是序数词(| 1st | 2nd | 3rd …),纯数字 `\s*1\s*` 匹配 "1st" 落空→features 整列丢;②specific 列是嵌套 JSON({"sneak_attack":{"dice_count":1,…}}),旧 `(\{[^}]*\})?` 遇内层 } 即断→正则整段失败。修:等级加 `(?:st|nd|rd|th)?`,specific 改 `[^|]*` 整列抓取(不关心括号深度)。
- 验证(真实 fixture+真实 lorebook):rogue 1级 features=`专精/偷袭/盗贼黑话`("Expertise|长休|已用0"×3),save_prof=[DEX,INT],空数组残留 0;255 测试全绿。
- 经验记档:classRow 这类"表行抓取"要当心 (a)SRD 表用序数词等级列 (b)Class Specific 列是嵌套 JSON 不是扁平 {}——两个坑叠加让 features 静默丢了一路,直到用户从注入面板反推才发现。

## 2026-09-21(hooks-debug) ui_data 施法者崩溃修复 + 钩子零触发排查
- 现象:悬浮面板 hero/mates 恒空;hooks 测试件(test_main_after/test_tail_after)零触发。
- 根因一(面板):`ui_data.mjs:140` 写成 `c[caster_attr]`——裸标识符未定义(与 111 行的 `c.caster_attr` 字段判定同源),施法者角色(有 caster_attr+slots_l1)一到 derive 即 ReferenceError;前端 `runScript` 的 `catch { return null }` 静默吞掉→面板永不渲染。非施法者不进该分支,故只有施法者角色面板全灭。顺修 146 行被动察觉 `?.v`→`?.mod`(skills 字段本无 v——原式恒 10)。
- 根因二(钩子):engine 产物 `packages/engine/lib/index.js` 还是 13:33 的构建,早于钩子实现(~16:30)——hooks.json 字符串在 bundle 里 0 命中,运行时根本没有挂点,工作区副本再新也无从触发。
- 修法:ui_data 两处一行修 + 工作区副本同步;`pnpm run build` 重建(mainAfterDone×3/hooks.json×1 入 bundle)。验证:直跑 ui_data 输出完整 JSON;全套 267/267 绿。
- 经验记档:①「面板恒空」第一动作=进 runtime 直跑 `node ../preset/scripts/ui_data.mjs`——崩栈直接定位,不用猜前端;②engine 层改动必须 `pnpm run build`+重启宿主,`tsc -b`/typecheck 只产 .d.ts 不产 bundle;③卡片脚本副本是导入快照,库改后要同步(重导卡或单文件 cp)。
- 同日(hud-fix) 两处 HUD UI 病:①mount 残留根——panel/stage 双缺席时 place() 的 body 兜底接收旧根(mount 异常/unmount 未调时无人清场),页面底部死件且 --hosted 类未摘;修=mount 开场幂等清场(.dnd-hud 先摘光)+body 兜底路径摘挂类。②头像 LV 徽章被裁——徽章是 .h-av/.m-av 子元素、bottom:-7px 露出圆框下沿,而容器 overflow:hidden(为照片裁圆)正好挡掉;修=容器摘 overflow,裁圆移交 img 自身 border-radius。工作区副本同步,全套 267/267(8 连跑稳定)。
- 同日(exp-gender) EXP 条全链贯通 + opening 性别两段收口:①XP 阈值表上提 lib/core.mjs(XP_THRESHOLDS,PHB p.13 单一事实源),gain_exp 改引,本地副本退役;②ui_data derive 新增 expBar(exp/本级下限/下一级阈值;键裁剪律——无 exp 成长面不出;20 级 next=null=MAX);③hero 卡 HP 行下新增 .h-exp 细条(本级段内进度,lv20 恒满),沙箱验证 gain_exp 0→299→300 精确触升级 LV2 且 expBar/min/next 数学正确;④opening 性别段去 '?'(两选一),随机池 male/female——此前三测角色均 unknown 系随机池 1/3 概率,现池收二;commit 白名单 unknown 仍容(兼容旧档/NPC)。工作区副本同步,267/267 绿。

## 2026-09-22(face-exp) 工具 face 机制实装 + 详细面板 EXP/钱袋重排 + 串台清场加固
- **face 实装**:设计里的归属声明制(agents 字段)一直停在纸面——gain_exp/gain_money 描述写着「尾面维护用」实际只挂主面,尾代反而调不到。实装:CardToolSchema 增 agents(缺省['main'] fail-safe,generic 恒主面,坏值注册期抛错),主面缺名跳过(mtime 变更自然重评估),尾面扫描登记(每回合重组合免同步);两工具标 tail 并按用户契约在描述声明更新文件(characters/<who>.json)。=2026-09-19「尾代纯写手零卡工具」的修订,design_zh 归属段已记。
- **串台修复**:两 dnd5e 会话间切换,1-2s 后旧主角面板叠进新会话——unmount 清场链任一回调抛错即中断,根+MutationObserver 残留,ensureHosted 继续把旧根往新面板塞。修:卸载链 LIFO+逐项 try/catch(+昨日的 mount 开场幂等清场,双保险)。
- **详细面板重排**:bk 头部改列式——HP 条 / EXP 绿条(同列两行;键裁剪律,无成长面不出) / 钱袋(从装备区移出,右对齐 13.5px 金字;钱不是装备,挂账条下)。工具/面板六件同步工作区;全套 269/269 绿(新增 face 3 例)。
- 同日(串台续):首修不够深——`stopped` 旗只在重臂(`if (!stopped) setTimeout`)检查,**帧内 await 的续跑不设防**:切换会话瞬间恰有一拍在途,`rerenderAll` 把旧会话数据画进新会话挂载的同名元素(全卡同 id:`#sec-player` 等全局寻址)——这才是"1-2s 后刷出旧主角面板"的本体。修:tick 帧头+每处 await 续帧后 `if (stopped) return`;ensureHosted 头部同防(observer 已断,但已入队微任务仍会跑一次);顺带 visibilitychange 监听器补进卸载链。经验:全局 id 的多实例组件,每个 await 续帧都是同名元素换主人的时机——停止旗必须在每帧边界重查。另有结案提醒:工作区 preset 是导入快照,修复落在库里后**旧会话要同步**(本轮三个工作区×6 文件全量同步);新会话导入自带新件。
- 同日(TDZ 事故):上一轮把 `if (stopped)` 防插进 ensureHosted,但 `let stopped` 声明留在文件尾部(_scheduler 段)——ensureHosted 在 mount 首帧即被调用,TDZ ReferenceError 令 mod.mount 抛出,card-ui 静默 catch → 面板空壳、整 HUD 失挂。修:stopped 声明上提 mount 顶部(TDZ 纪律:被定义处引用的旗,声明必须先于首个调用点),尾部双声明拆除。冒烟:脚本序校验「声明@593 < 首调@30425」;三工作区同步;269/269 绿。教训:在多实例卡 UI 里加"停止旗"类跨段状态,声明位置必须在改动 diff 里与引用点一起看——`node --check` 不查 TDZ,只有运行时首帧会炸。

## 2026-09-22(ui-split) UI 架构分层落地:宿主面板运行时 + 卡声明形态(v9)
- 背景:面板事故连环(ui_data 崩溃/串台 ×2/TDZ/死件根),根因=七步管线(数据/泵/转换/渲染/布局/样式/交互)的命令式部分全压在卡侧一个 930 行 index.js 里,零测试、多实例竞态面、静默吞错。
- 刀1(F1,5a97a10):runScript 结构化失败——引擎失败不抛,`{text:'',failure:{reason,exitCode}}` 上浮 wire;prompt 面的 scriptFailures 哲学推平到前端面。
- 刀2(本次):`packages/ui/src/client/panel-runtime.ts` 宿主面板运行时——per-panel 泵(rev 门/j deadline 帧界 stopped 检查)、头像缓存(op=avatars 逐键)、**错误 chip**(fail-visible,死因+面板名)、act 事件委托(data-act→acts.mjs)、ui-state(view 态归 acts,repaint 即时);layout.json v2 解析(data+view+hideDuringOpening 可选,半声明=错误 chip 不静默);card-ui 六件套探测+view/acts 模块装载,legacy mount 全量并存。卸载前“pack 缺席”告警降级为合法形态(骨架无 ui/=纯对话区)。
- 刀3(本次):dnd5e 迁移声明形态——view.mjs(heroPanel/rightPanel/bookHtml 纯函数,node 可测)+acts.mjs(book/quest/pending,markup 复用 view 同源)+ui.css(整块样式抽出)+index.js 瘦成 opening 桥+面板总开关;ui_data.mjs 增 op=panel(左右切片,rev=真身文件摘要,avatarKeys 上浮)。
- 测试基建:内核原语包 dependencies 声明为空但 import anser/clsx/katex/mdast 全家——pnpm 隔离下 vitest SSR 解析必炸;vitest.shared 配置期扫描内核 lib 裸导入、凡根 node_modules 可达即生成 alias(自动纳入新增),primitives inline 交给 vite 转换(.module.css);不碰 node_modules。全套 276/276(含新 runtime 4 例+composer 3 例)。
- 语义变化零:wire 协议只加不减;旧 mount 形态与新声明形态并存;骨架不带 ui/=纯对话区。
- 同日分册(拆分后):playwright/CDP 真浏览器逐项验证五面(绑定会话渲染/头像 dataURL/EXP 行/书册开合/任务手风琴/会话计数),揪出并修复三处:①acts.mjs 解包错层(wire 值是 {ok,rev,data:{…}},直接取 data.player=undefined → no-char 静默 bail);②act 名不匹配(view 里 data-act="book-close" vs acts 导出 bookClose);③事件委托缺失静默(handler 命中失败只 return)——补 console 告警+window.__panelRuntime 调试钉(actsAttached/panels/actNames/clicks 计数)。测试侧连带:panel-runtime 行为钉 4 例(首画/rev 门/错误 chip 带死因/dispose 停摆)+composer直渲 3 例转通(内核原语包 deps 空声明,actions:配置期扫描裸导入生成根可达 alias+primitives inline,.module.css 落 vite 转换)。全套 283/283。教训两行:1)「单元层全绿」远不等于浏览器行为正确——本轮全部 3 个真 bug 都藏在 jsdom 够不到的组合层;2)调试钉(计数器+进入标记)比断点快得多,采集面先铺理赔路。
- 同日(css-断链) 「面板 css 不对」实录:CDP 截图肉眼验收揪出——GUI 全裸(HUD 内联进对话流、头像巨图、面板 1167px 满宽非浮层)。根因:拆分时把样式抽成 ui.css 文件,却**忘了接注入管线**——卡样式整页消失。修复:card-ui loadCardUi 读 preset/ui/ui.css → 卫队 → 注入独立 style(#tavern-card-ui),与 chat.css(作用域重写)分治:ui.css 全局注入,定位契约(.tavern-stage > .tavern-panel-*)/卡 token/.dnd-hud 变量/fixed 模态都在其中。验后:left/right = absolute 208/180px、hero 贴槽、零错误 chip、零 console 告警,截图 /tmp/fixed2.png。教训:**纯函数化拆分时,「样式注入」是生命周期职责,搬家必须连管线一起搬**——DOM 断言齐绿也拦不住纯视觉回归,截图肉眼验收(captureScreenshot→Read)是最后也是最便宜的一道闸。
- 同日(book-token) 详情册配色 broken:book/fc 模态由 act 挂到面板容器,而容器非 .dnd-hud 血统——纸面 token(--p1/--p-ink/--p-gold)全部落空。旧架构挂点(rootTools)本身带 .dnd-hud 类被掩盖。修:模态自携 token 作用域(book/fc-ov 类名追加 dnd-hud)。CDP 数值验(--p1=#fbf7ed/coinColor=--p-gold)+截图肉眼验(羊皮纸/雷达/速览/施法/装备全字段恢复)。教训:模态/浮层类元素脱离组件树挂载时,token 作用域必须自携——「谁挂载谁负责 vars 可达」。
- 同日(book-pos) 「详情册位置还是不对」两层根因(CDP rects 定案):①**双派发**——每面板一个 document 级监听,同一次点击 book 被派发两次插进两容器(第二本出屏);②**fixed 包含块劫持**——.book(position:fixed)插进面板容器,容器祖先带 transform → 包含块=容器而非视口,内联 left:483 实渲染 748(整整偏出一个侧栏)。修:①单实例全局委托+归属解析(容器内→面板名;body 浮层→data-panel 标记回创建面板);②book/fc 模态升 document.body 挂载(视口坐标语义+泵重绘不吞)+自携 token(前一修复)。终态实测:bookCount=1、bookRect=(483,50)=heroRect+(208+10,-6) 精确锚定、bk-x 关/点开循环稳定、控制台零告警。
- 同日(B-cutover) 面板运行时整体下沉卡资产(用户拍板路线 B):panel-runtime.ts 退役(git rm),逻辑忠实迁入 preset/ui/runtime.mjs——deps 从 {rpc,sessionId} 改为 {callScript(结构形),panels,viewModule,actModule},对宿主只暴露 mountPanels/dispose;openiing/头像等卡种语义随迁自然归位。宿主回落纯装载器:loadCardUi 读 runtime.mjs(Blob import)并把 {runScript(legacy 文本形),callScript(结构形),layout,views,acts,runtime} 经 mount(tavern) 注入——index.js 成为整卡组装点(面板实例化+opening 桥+总开关)。回归面跟随归属:panel-runtime 4 例改为直接对卡资产回归(spec 迁+改依赖形状),全套 283/283;CDP 实测面板/书册锚位/coin/零告警。框架净收益:panel-runtime 整文件退役,pack 装载契约=「读 .mjs→Blob import→tavern 注入」,不再认识任何面板机制。

## 2026-09-22(dnd 交叉污染) dnd 卡面板消失事故:我方 B 路线同步循环盲拷污染
- 现象:「dnd 的卡面板没了」——容器在、恒空、零警告。CDP 变异观察器 8s 零事件=start() 从未运行;而 body 上趴着一个 dnd5e 的工具条(铁证:页面跑的是 dnd5e 的 index.js)。
- 根因:面板运行时下沉(B 路线)的收尾同步循环用 `[ -d preset/ui ]` 当谓词,把 **dnd5e 的 runtime.mjs+index.js 盲拷进所有带 ui 目录的工作区**——dnd 卡的 075621 中招:layout=codex 声明,入口却被换成 dnd5e 的(panels 过滤 data+view=空,只画工具条,codex mount 不在场)。库未受染(循环只写工作区)。
- 修复:075621 的 index.js 从库复位、runtime.mjs 移除;全工作区交叉污染审计(按卡 id 对直读,零残余)。浏览器验收:codex 五页签+数据泵(勇者 LV1 正文)+composer codex-shift 避让+外来工具条消失。
- 教训:**工作区同步必须按卡身份键(meta.json title→库源)拷文件,「有 ui 目录」不是充分谓词**——多卡并存时代一张卡的自带件绝不能落到另一张卡的工作区。后续把同步收进 card-keyed 脚本(队列)。

## 2026-09-24(prompt-P123) P1–P3 提示词批次落地:成长宣告链 + 战斗面懒生成 + 写档总则改写
- P1(systemPrompt「事实与面板」末条新增「同伴与 NPC 的未分配成长」):面板 `pending` 由 DM 按独立人格叙事宣告去向(属性/新术),宣告即生效、转录照叙写入;纯场景 NPC 缺席的战斗数值(HP 上限/AC/豁免)由 DM 接战时当场确定——落实 B4-② 的 DM 侧指引(此前实测:无提示即无动作,pending 悬死)。
- P2(maintenancePrompt 清单新条 3「成长写入」+ 顺延 4~7):宣告成长 → 读现档整档写回(六维/CON 追溯 hp/spells_known),同一笔**同步移除对应 pending 单条**(其余标记保留)——补上 `panel-data_zh.md:31`「尾代清」从未接线的指令缺口,消除重复宣告风险;清单 5 条交叉引用「战斗」节改「按第 4 条」。
- P3-a(条 4 战毕句):命名敌战毕回写时,战中首次宣告的战斗面(HP 上限/六维/AC/save_prof/施法块)一并补齐写回——战斗面懒生成的唯一自然落档时机。P3-b(条 5 精简形态句):纯场景 NPC 连战斗数值也省略,接战前可全无、按 DM 宣告起算,敌对施法者接战补施法块。
- 写档总则改写(用户令):旧「直接编辑(runtimeEdit 为主)」节重置为「写档(主要工作道)」——正文不点名工具,级联/骰算工具因是硬调用契约保留实名;末条「写与编辑的取舍」实名给建议:小文件多处改动 → 先 runtimeRead 现档、runtimeWrite 整档重写一次到位(characters/*.json 皆属此类),大文件零星几处 → 才用 runtimeEdit 点对点替换(old_str 全唯一/new_str 空即删除/多笔 runtimeEdit 同帧按序);新增「能并行就并行」条(互不依赖读写同帧,不同文件互不等待);铁律 3 改「禁止一切写与删除类工具」。
- 措辞三清(用户令):①全文「账」字清零(落账→落盘/结算/写入;登记表系 state.md 数据层术语,无账字,保留);②不提 HUD `???`(get_npc_state 直接 stringify JSON,DM 与尾代均不可见 `???`——那是玩家侧渲染);③runtime 工具名只在写档节末条取舍建议出场(runtimeWrite/runtimeEdit,取数 runtimeRead),其余正文自然动词。
- 验证:vitest 全套 23 files/307 tests 绿;grep 实证两 prompt 「账」0 处,runtime 名仅存取舍条三处。asi-pending_zh.md 状态两分行同步(P1–P3 提案→已落)。

## 2026-09-25 · 成长流入册实施——呼吸标题/居中学习框/候选清单/±列表行(playwright 全链验收)

原型 `docs/hud-proto-grow.html` 二轮定案落地到实现层(五件套:ui_data/view/acts/runtime/ui.css),`fc` 待办模态整体退役:

- **提醒非按钮**:hero 待办 chip 改`◆未分配成长·N`(呼吸 pp 动画保留,去 data-act)——点卡整体开册语义不变。
- **册版面重排**(用户令):左栏=Ability Scores→Saving Throws→Vitals→Skills→Proficiencies,右栏=Spellcasting→Conditions→Equipment/Gear→Features→Resistances/Immunities;速览入左栏,六维与施法齐平;空数「无」版面常驻。
- **术语锚**:节标题=SRD 英文原文(uppercase 排印,不二转译),每一个英文名词挂中文 `data-tip` 悬停解释;Proficiencies 组名=中文(护甲/武器/工具熟练+语言掌握),Proficiency Bonus 单值居节首;**逐项 alt** 由 view 层 PROF_TIPS 词典驱动。
- **学习对话框**(acts grow 系六动作/pop):呼吸节标题(data-act=grow)弹出,**视口居中 translate 自适应**、册不关;属性点=**±列表行**(行=属性名/现值(调整值)→预览值/已加值 delta 常驻/－＋钮,恰 2 可保存);学法术=**候选清单**(`ui_data op:candidates` 泵层过滤:本职业表∩环位≤可施∩未收录∩非戏法——玩家零输入零杜撰);保存=front_commit(恰 2 卡点),fail-visible(.g-msg 上屏不吞错);取消/外侧/Esc=放弃。`.g-dlg` 双类自携 dnd-hud(透明底回归钉);两层同拍旗标防重渲染脱挂误关(册/框各一)。
- **施法三行拆分**:`ui_data spellSplit` 按法术卡 level:0 拆 戏法/已知/已备(未知卡名落环术行不冒充);**熟练度呈现**:PB 本体+资格名单(panel-data 冻结口径,未熟练不显)。
- **头像 138% 内裁层**(av-clip)与 **#vtip 悬停浮签**(runtime 全局单件,0.1s 统一延迟,title 全量退役)。
- **测试**(307→339 绿):view 结构钉/acts 对话框行为钉(jsdom)/runtime vtip 钉/jsdom 各一;`dnd5e-ui-data-candidates.spec` 真脚本+临时树(cwd 与 preset 兄弟——部署同构);`dnd5e-grow.browser.spec` playwright 无头 Chrome(--allow-file-access-from-files)全链:呼吸→居中(几何断言)→token 不透明→±分点→双通道保存(fixture 机械层真改 player)→泵拍回落→vtip 0.1s→截图留证 `packages/ui/tests/__artifacts__/grow-dialog.png`(对照原型逐点相符)。**browser 层当场抓出并修掉两枚真 bug**:shellDlg 缺 open 类(真浏览器永不可见)、dlg 居中测量时序(入场动画盖 translate→改 CSS translate 自适应)。
- 遗留:front_commit 侧三检(环位资格)未落——候选列表已从源头约束,直改存量攥写防线上仍靠 prompt;L4 语料列/准备制长休句未动(asi-pending L 批次照旧)。
- **追记(同日)**:开局 roll 全面重做——opening-meta.mjs 单源(SRD 技能白名单/主属性序/L1 子职标记/戏法与首环数/12 职起装),opening_data 桥下发 meta(技能白名单现场解析 *Proficiencies* 行+子职清单+法术池),opening_commit 镜像校验(技能越白名单 fail-loud/施法者出生即满/子职落/训练面出生/特征回充按表非池|—/中文描述与 backstory 缝合),roll 改耦合链(性别→种族→同族名→职业→主属性序吃标准数组→技能按白名单→L1 子职→施法成套);创角表单(bridge 下发)跟改:技能格按职业重建/选数动态/子职 select/施法成套只读预览+重掷;7 条集成钉(dnd5e-opening.spec)——356 全绿。

## 2026-09-25 · 目标结算咽喉化——attack/cast 查无目标不再静默涂默认值

事故:哥布林乙射梅西雅,回执 `vs AC 10` 误中(该骰 12)——实况 AC 17(鳞甲14+敏1+盾2)。根因:梅西雅存 `characters/player.json`(真名在 name 字段),attack 目标退化查找手写 `existsSync('characters/梅西雅.json')` 落空 → AC 留初始默认 10 静默流入结算;而攻击者侧 readChar 走的 findCharFile 有 name 兜底扫描——同名两条路,一条有兜底一条没有。同病三处:attack 目标、cast 攻击型(连角色档退化都没有,法术打玩家恒 10)、cast 豁免型(静默 saveBonus 0)。

- **core.mjs 咽喉**:新增 combatRow(敌行∪友行)/deriveAC(AC 律单源)/resolveTarget/resolveSave——失败一律返回 null,失败策略归调用方 err。ui_data 内联 AC 副本同步收拢调 deriveAC,「同律」从注释承诺变代码事实(顺带中文名甲从此走 equipmentFM 桥,旧裸路径读读不到回落 10+敏)。
- **attack**:19 行手写目标解析块→1 行 resolveTarget;查无且未传 ac→`!查无目标 AC:<名>` 报错;新 schema 参数 `ac`=转写逃生舱(即兴无档/剧情态与档不符如弃盾);回执 AC 行带来源(`敌行`/`友行`/`characters/player.json`/`转写`),LLM 转写值与档读值一眼可分。
- **cast**:攻击型分支补上角色档退化(原 combatFoe 单路);豁免型换 resolveSave,查无→报错不涂 0。
- **设计裁定**(用户讨论定案):持久玩家资产=档读(反作弊锚+确定性:桥对则永远对,LLM 抄写每骰一赌,抗性列表必翻车),DM 即兴资产=转写且留痕——这条线现状本就成立,只是目标侧的桥断了;静默默认值与「拒绝分支空吞错」同罪,就此绝迹于目标解析路径。
- 测试:`packages/engine/tests/dnd5e-tools-target.spec` 8 钉(事故锚 name 兜底/敌行回归/查无报错/ac 逃生舱有档+无档双形态/cast 攻击型+豁免型/ui_data 同 17),全套 37 files/457 tests 绿。工作区快照四文件(core/attack/cast/ui_data)已同步,真机四验全过:repro→`vs AC 17(characters/player.json)`、玩家打哥布林→`vs AC 15(敌行)` 回归、查无→报错退出、panel `derived.ac:17`。

## 2026-09-25(npc-list-v4) 附近 NPC 三态名单 v4——state 节复活,注入与前端人际三区同源
- **用户定案,推翻 2026-09-21 v3「零名单」案**:前端要求展示 同伴/中立/敌对 三区且与 postPrompt 注入集**完全一致**;用户拍板:①杂兵也进入(上榜必有档——与硬性要求 7「参战全员建档」同向,v2「无名杂兵住敌行」旧陈述作废);②行式 `- 名 | 态`;③**名单漏更时同伴不加 role 兜底**(漏=漏,与 v2 盲区共存亡);④敌对在右栏、同伴+中立在左栏。复活 state.md「## 附近 NPC」节为唯一在场真源,敌对=持久态(战毕未死者不回落中立——v3 时代「敌意消退即回落」的语义边界就此消解)。
- **一处算法两处消费**(v2 死因=注入器无视名单+三处同伴判据打架,质量锁就是不再让判据分家):`lib/core.mjs` 新 presence()——解析节行式「名|态」,行在档缺/坏 → j=null(注入示警「勿采信」+前端占位卡,裂缝可见不静默);get_npc_state.mjs 重写为消费真源(三标签注入全 JSON,快照点名算法退役,.chat.snapshot.jsonl 不再读);ui_data op=panel——hud-left=player+同伴+中立、hud-right=敌对+环境+任务,敌卡 HP/先攻 **敌行优先**(战斗回合机械快照压档案值,无敌行=持久敌对未接战纯档案口径),`_missing` 占位;full op 同步三池。
- **rev 扩容**:hud-left=player+characters 聚合+**state.md**(名单一行之差必须触发重画);hud-right=state.md+characters(敌卡 join 档案)。
- **view/acts/css 三区**:matesHtml 拆 personCard+zoneHtml(同伴/中立左区、敌对右区置顶,空区整隐);敌对=暖红调+先攻 chip ◆N;缺档占位卡不可点(data-tip 尾代应补建);acts.book 改按 ctx.panel 取切片(右池 foes 在 hud-right 响应里),缺档卡不开册。
- **提示词**:maintenancePrompt 新增 3.d 名单维护流(新在场者上行+建档含杂兵/离场删行/态迁移改标/入队离队**行与 role 双写**防分家/死敌删行删档);3.a 建档句与新硬性 7(参战者全登记敌对行;战毕死敌删档**并删行**)同步;systemPrompt 注入语义句改名单口径。
- **种子/文档**:setup/state.md 增「## 附近 NPC」节(-(无) 占位);ui_zh.md 敌怪区条款修订(2026-09-20「不设」案推翻,敌对区=名单第三态投影非战斗面板,战斗呈现仍归 DM 叙事)+数据流三池版;prompt-principles #13 重写(记明代价=尾代每回合维护);panel-data_zh.md:13/65、design_zh:139 数据全景同步;get_roster 头注释。
- **一致性锁**:`dnd5e-presence.spec.ts`(engine 侧新增)——同 fixture 分别跑真 get_npc_state 与真 ui_data 两面板,断言**人名集+三分类逐一相等**(注入与前端镜像的机器锚,防 v2「注释与实现相悖」重演); smoked fixture 实测:左=老铁(同伴)+掌柜/幽灵客(中立,后者缺档占位)、右=石牙(敌对,敌行 HP 7/9 压档案)、注入同名同序,全对上。
- **代价记档**:尾代每回合多一项名单维护(v3 的零维护红利放弃);名单漏更=漏注入漏上屏(用户明断接受);存量工作区 state.md 无该节 → 迁移需尾代首回合补建行(卡库种子只影响新装卡)。
- **追记(09-26)**:用户令「敌人面板在任务列表下方」——右栏区域序改为 环境→任务→敌对(敌对区由置顶改沉底);view rightPanel 顺序调换,zones spec 断言翻转(敌对 zone 晚于 quests 容器),ui_zh 措辞同步。

## 2026-09-26 · 一期直写工具体系落地——九件工具当拍写盘+敌行瘦身+尾代转审计员

设计正本=panel-consistency_zh.md(§9 逐件终稿+五条通用律);本日按其施工,attack/cast 归并行线未动。

- **core.mjs 机械层收拢**:pbOf 单公式(两端 clamp 1–30,修旧 pb 的 0.25 虚低+CR21+ 封顶双错)/XP_BY_CR 查表(key=level 含小数档,xp 不落档=派生不存)/classRow 序数词单源(修 gain_exp 特征行恒空——SRD 表是 | 1st |,旧纯数字正则永不匹配)/stripEmptyArrays+saveChar 写盘 helper/presenceAdd+combatWrite 两个 md 行操作/**敌行瘦身**(行只记 名|path|状态,HP/AC 一律走档;resolveTarget 扩展回传 file/j/growth,resolveSave 弃 row.path 分支全走档)。
- **九件工具**:check(save:true 豁免熟练/dc 缺省=对抗/damage 自带专注入口/modifier 兼骰式)、damage(世界伤害掷骰,target 必填,抗免走档,0HP 受击自动 death_fail+1)、heal 新件(非法术治疗:钳上限/0HP 苏醒双清/生命骰逐枚)、**hp_change** 新件(无骰直改 amount|full;永不作修正器——用户命名)、initiative(物化战斗节;临时单位转写通道废除,未建档报错逼 spawn)、death(计数读档落盘,删 success/fail 参数,v8.1 反转)、spawn_npc 新件(角色创建器:全参 LLM 亲自输入/完备律/同名拒/from 镜像校验锚/count 天干/presence 行/path 溯源)、gain_money·gain_exp(双面解封+context+落盘行;gain_exp 扩 who 名单+foes 战果通道——档读 level 查表求和均分,DM 零算术)。回执统一:落盘行(对象 字段 旧→新 [文件])+梗概+铁则;err 结构化自纠。
- **联动**:ui_data 敌卡 join 档案(行不落数值,档坏缺席保真)+pb→pbOf;模板补 vulnerabilities/death 计数/level 双语义注记;种子战斗节注释改瘦语义。
- **提示词重训**:systemPrompt(九件清单+「先调工具再落笔」+来源路由律入纪律+亲手算白名单退役价格合计/经验均分+铺场 spawn 即备账+中途增援例外废+AC10 陈旧句清+对抗/群体入判断清单);maintenancePrompt 转审计员(**落盘行=核对不重放**/三方对账双报警/建档改调 spawn_npc/战毕清场四件/终态不回写)。
- **验证**:dnd5e-phase1.spec 14 钉(spawn 完备律·镜像·count/三件套·0HP 分叉·受击落败/death 读写/initiative 物化·报错/foes 结算/check save·对抗·专注/pbOf 边界 level21→+7)+dnd5e-tools-target 瘦身适配+dnd5e-presence 语义翻转(敌卡=档案值)——**全套 40 files/479 tests 绿**;pbOf 公式对 FM 334 只逐只对账零偏差;临时 rig 全链冒烟(spawn→initiative→damage→check→heal→hp_change→death→gain_exp→gain_money)通过。
- 遗留:P0 E2E(regenerate/stop 真机实证)待宿主执行;attack/cast 彼线合流后接内联治疗/自动伤害分支(来源路由律硬约束);工作区无活跃 dnd5e 实例,下次开局自然带出(快照不传导,卡库为源)。

**追记(同日·attack/cast 收尾,用户令归本线)**:attack 终版落地(§9 终稿+off_hand 后手布尔+吞零修复+即兴无档新裁定:写盘需要档,ac 转写仅限有档目标的剧情态覆盖,即兴必须先 spawn——旧测试「酒馆老板」锚改报错);cast 终版落地(彼线四裁定+路由律内联第五六分支:治疗型 restore:true+dice 钳上限苏醒双清/自动型 dice 逐目标独立掷——法术来源一切生命变动归 cast 禁接龙)。**实施抓真 bug 一枚**:自施法(治疗自己)时 cast 结尾位表/专注写盘用开头陈旧快照整档回写,把治疗刚写的 hp 拍回 0(clobber)——修复=结尾写盘前重读实盘;新增三钉(attack 落盘+0HP/cast 位耗+专注 RAW 覆写/治疗内联+自动型)。**全套 40 files/482 tests 绿**。一期 11 件至此全部代码落地;遗留仅 P0 E2E(regenerate/stop 真机)。

## 2026-09-27 · 死代码清扫批——八通道枚举审计+对抗复核,15 项落地+1 bug 顺手修

全卡死代码审计:枚举八条存活通道(工具注册/prompt 占位/hooks/宿主固定名装载/卡内 runScript·data-act·view 名/库导入四形态/CSS 类产出/测试),逐项证明全空才判死;删前对抗复核(方括号动态取属性/插值拼类/宿主动态类名构造/iframe 隔离)。**方法论教训**:词边界 `\b` grep 在本环境 ugrep 下不可靠——首轮曾误判 setSeed 死,朴素模式重验抓出引擎测试播种在用(dnd5e-phase1 prelude 固定 LCG 骰流防 1/20 断言翻红)→撤案;凡下死刑必以朴素 grep+调用语法级双重确认。

- **core.mjs**:删 `d20`(骰果回执须列每颗骰,rollExpr 成唯一出口)/`charFileOf`(与 readChar 重复)/`combatFoe`+`combatRow`(敌行瘦身+resolveTarget 咽喉化后的旧真相读口)/`pb`(pbOf 修双端 clamp 后注释标退役未删)。setSeed 保留(测试播种)。
- **glossary-cn.mjs**:删 `featureNameCn`+`PAREN_CN`+`subclassCn/languageCn/weaponCn`——中文化消费全在 view 副本侧(裸串加载不能 import),服务端只接 spellCn;数据表留作译名正本。
- **front_commit.mjs**:删 `op=prepare` 分支——「长休换准备表」UI 从未进版面定案,spells_prepared 唯一写入者=出生 roll。
- **opening_commit.mjs**:本地 readFM/classRow/stripEmptyArrays 三副本退役改 import core(2026-09-26 收拢声明的落地);readFM 留一行容错壳(race 非法兜底 {} 不炸出生);PRIMARY 多余解构删。
- **view.mjs**:删 `profHtml=''` 空壳(2026-09-24 版面定案 Proficiencies 迁左栏残留)。
- **ui.css**:删 `.bk-tail`(小传提到册首 9e9f610 后 bk-tale 取代)/`.stc.dying2`×2+`@keyframes dc`(濒死表达移卡级 .dying)/`.dnd-hud--anchor-l/r`+`.panel-hidden`×2+`.hero/.mates/.right.hidden`(锚点挂载与旧可见性被 hosted+--off 取代)/`.bk-cap.g-pend.on`(grow 断链删,见下);**顺手修真 bug**:`.loc .l.up::after` content `"\\203A"` 双反斜杠转义错,字面渲染 `\203A` 六字符,应为 `"\203A"`(›)——环境面板大区/区域行箭头自出生即坏。
- **index.js**:删总开关按钮 `data-act="panels"` 属性(行为走直绑 onclick;runtime 委托因 owner 解析失败恒放行,属性纯摆设)。
- **ui_data.mjs**:删 v9 `op=full` 全量投影(v10 零轮询后零调用方;op 缺席/未知改 fail-visible 报错);删 state 投影 `changes/party/hierarchy` 三无消费字段(changes=DM 账走 get_changes;party 只服务长休结算;hierarchy=v8 层级迁移兼容旗)。
- **拍板一·kind 三色补契约**:maintenancePrompt 3a statuses 行加「kind: b 增益/d 减益/i 信息金,拿不准就 i」;panel-data_zh.md 字段表补行——原型(hud-proto-v8/grow)三色+kind:'b' 样例俱全,实现期字段清单掉了 kind,展示层三色自出生从未点亮;此批把最后一环接上。
- **拍板二·grow 高亮断链删**:acts `setUi('grow')`×3+view bookHtml 第三参+capPend open 参+.g-pend.on CSS+两 spec 断言——四环链断在生产端从不传参,功能从未上线,学习框自带标题上下文;接上需 acts 持有册子数据,复杂度/收益不配。保留 deps.stopped(宿主停旗接缝,2 行防御缝,纯加法语义)。
- **验证**:全套 **40 files/499 tests 绿**;存量工作区同步 4/12(153334/154142/154808/160149 四个与改动前卡版本一致者 10 文件全量镜像+md5 抽查一致;其余 8 个为 09-23/早 09-27 旧版快照,强推新文件致新旧错配,跳过留档)。

## 2026-09-28 · 铺场单段制落地——systemPrompt「至少分两回合」退役,§4.5 拍板尾巴收口

§4.5(09-26)本就定「铺场不再依赖尾代,两段制解除」,但 §7 标注「解除与否实施时拍板」——0a4e4db 实施批只带走两个子项(铺场 spawn 即备账/中途增援同回合照打),主条款「战斗至少分两回合…下一回合等玩家给出策略后才能正式接战」原封未动,致使 systemPrompt 自相矛盾:新战斗不许同回合开打、战中增援却许(半截施工指纹)。两段制存在理由(尾代回合末转录备账)随 spawn_npc 当拍建档早已消失。

- **方法论流程**(按用户提示词法四步):①行为逻辑=开战时机不设结构闸,开战链固定 点名→无档者 spawn→initiative,玩家决策保障留叙事层(交互循环给选项+轮末 2~4 选项既有条款);②全状态 agent 视野枚举=探索遇敌(DM 叙述+选项自然等表态)/玩家先动手/敌方先动手·突袭/战中增援(25 行既有条款)/在册者参战——谁有档在注入名单即可见;③视野推导要求=spawn 判据必须视野可判→写「无档者」(在册者免 spawn,防同名拒报错误触),开战触发必须 agent 可判→「先动者」三态(玩家表态动手/敌方先动手/突袭);④覆盖校验=行为逻辑逐条对上、五状态枚举齐、零外部文档依赖、零尾代依赖;机械假设对码:spawn 同名拒(spawn_npc.mjs 描述)/initiative 未建档报错(dnd5e-phase1.spec.ts:130-144,行为测试)。
- **落位**:systemPrompt 战前铺场/接战回合两行并一条开战链(旧「接站」typo 一并清);initiative.mjs 描述「接战当口(铺场完毕、玩家给出策略)」→「参战者均已建档,无档者先 spawn_npc」+同回合可开句;prompt-principles #20、design_zh 战斗叙事条、panel-consistency §7 拍板注记四处文档同步。
- **验证**:测试不锚定上述文本(dnd5e-phase1 只测工具行为——runTool 调用与报错),全套 **40 files/499 tests 绿**;本地无活跃工作区(~/.dsh 不存在),存量工作区同步按既账走(快照不传导,239 侧同律)。

**追记(同日·工具纪律分层校验+L6 人物志判据修正)**:用户两问——schema 已有介绍,systemPrompt 是否还要重复?L6 人物志条判据是否挂错?对码实证:①人物志=get_roster() 扫 characters/*.json(档案驱动,有 .json 才在册),名单行判据(没有行＝不在场)只属【NPC 面板】(get_npc_state 读三态名单)——原文把两判据混挂;②L6 后半句 runtimeRead/凭设定填/数字过脑与 spawn_npc schema 逐字重复,违反纪律层/契约层分工。落改:systemPrompt L6 重写(两判据分挂:人物志=档案在册;不在场=无名单行;spawn 填写契约指向 schema);「纯场景者照 commoner 底版填凡人数值」为 schema 独缺的填法指导,搬入 spawn_npc 描述;cast 描述补无掷骰型入路(代码 cast.mjs:130 本就支持护盾/隐匿只过闸落位,描述四型列举缺第五型);attack 描述补一轮多击=同回合连调(Extra Attack 最高频调用模式入路显式化);三处文档债按既风格清:tools_zh §零4「回执中继」改同回合连发句(crit 从未存在=budget_offset 已删)、design_zh 两段 v2/v3 律加已废编注(当拍写盘取代)。**全套 40 files/499 tests 绿**。

**追记二(同日·工具纪律节用户重训+全篇两层分工走查)**:用户手工重写工具纪律节——删九件名录(工具面板即名录)/删来源路由律(五件 schema 各自声明必经边界,合集即路由)/删判断清单(schema 逐处标「你判」)/删亲手算白名单(并入心算禁令扩围金钱经验)——只留 schema 讲不了的四条(跨件连用禁令/全局心算禁令/买得起自检/拒绝即世界事实)。按提示词四步法走查 agent 视野补两缝:①用户自补「同一事件的生命变动只走一件」界定域(防 Extra Attack 连调/斩后喝药等合法组合被过宽条款误伤);②Claude 落「无骰直改同理(hp_change)——先调工具,再落笔」半句(原枚举缝漏无骰变动+恢复全局兜底)。同法扫全篇压缩两处 schema 复读:L21 删「骰算工具开战全程可用」(两段制时代信号,单段制后为默认态)、L22 删「查表求和、按名单均分、升级级联全自动」(gain_exp schema 原文),保留 prompt 独占面(时机/移交/落盘行对账律);其余各节(事实面板五条/交互循环/开战链/战斗五步/冒险日节奏/叙事风格/SRD 库)均判定 prompt 独占(注入无导语/行为序列/卡对 RAW 的媒介绑定/DMG 口径语料无),保持不动;postPrompt 核对一致未动。**全套 40 files/499 tests 绿**。

**追记三(同日·systemPrompt 用户三轮重训收敛+opening 后门采谱)**:用户继续手工重训——L19 交互循环改真·agent 行为环(意图→推演→调工具→续推演「...」→抉择点给选项,吻合单回合内叙述/工具多轮交替的真实执行形态);删人物志/名单读法行(postPrompt 节题注+spawn schema「剧情中任何新角色登场」+尾代 3.d 补漏三重兜)、删意图优先姿态句等。Claude 复审补两处:#1 L20 开战链回补门控「接战触发＝先动者(玩家表态动手/敌方先动手/突袭局面)」(防「敌意显现=必然开战」剥夺打/谈抉择点——判据视野内可判);#2 L21「击杀即获取经验」改「击败即结算经验(被击败＝杀死/击倒/劝降,逃跑不算)」——gain_exp schema 明文口径,原短句把打倒未杀/劝降收窄漏算(prompt 明文>SRD 效力顺序,prompt 错短句权重盖过 schema 对语义,必对齐)。剩余判定:意图优先句删=leniency 用户自裁,「唯一/DMG 口径」等 minor trim 随用户。

**追记四(同日·世界簿记四定案+右栏等宽+时钟明细)**:用户五决——①主线/支线合并为单「## 任务」节(行式 `- 内容`,完成 `- ✓ 内容`;传闻/悬赏只有玩家接手才立项,呼应 BR p.3「campaign 由 quests 涌现」与叙事约定「任务须玩家决策才接受」);②篇章退役(state.md 篇章进度节删,systemPrompt L30 章法改口「场景内、场景之间」——BR 场景母语;篇章进度+阶段为空转维护字段,玩家 HUD 信息价值≈0);③opening 不设任务(openings.json 四场景 state 只留 所在,opening_commit 删篇章/主线两 patch 行,BR 依据:开局给 hooks 不给主线,p.5 patron 挂角色不挂任务字段);④右栏与左栏等宽(ui.css 两处 hud-right 180px→208px);⑤时钟 hover 明细(view.mjs worldHtml 表盘包 .w-dial data-tip「第N日·H时」——启用既有 413 行全局浮签单件)。联动:BH 任务手风琴 CSS .q-item.main 金边删/questsHtml 单列重写(key 前缀 T:)/ui_data main+side→tasks(zones.spec STATE fixture 同步);「买 bottle」英文残留顺手修(→买酒);docs 三份( panel-data/panel-consistency/ui_zh)现行 schema 行同步。**全套 40 files/499 tests 绿**。遗留:openings.json 内容级重做(三支柱配平+矿坑开局补活人)未动——hooks 具体文案待用户拟。

**追记五(同日·总开关图标眼睛化)**:右下总开关按钮由「双面板」残影图标换眼睛样式——可见=睁眼,隐藏(.off)=闭眼+斜杠(eye-slash)。双 SVG 并置类驱切(.i-eye/.i-eye-off,btn.off 流转既有),零 JS 改动;ui_zh 总开关行同步。全套 499 绿。

**追记六(同日·对账裁减+前端回执 v4 配对修复)**:①maintenancePrompt 读盘纪律重写——注入面板=回合初快照(postPrompt 各节加来源括注:player.json/characters 聚合/state.md 节),"本回合未被改写的文件不必读,要写才 runtimeRead";落盘行回执「不读盘不重放」(删纯核读盘);runtimeWrite JSON 免读回(引擎 parse 校验),仅 runtimeEdit md 读回受改节;硬性要求 2/5/6 与开头段同步。②前端工具回执消失破案:0.1.7 会话格式 v4 的 durable tool/result 事件形状变位——回执文本直接在 message.content 的 text 块、toolCallId 挂 message(实机 zstd 日志解剖:31 call/31 result 1:1 全在,卡在客户端 find(type==='tool-result') 旧块形状落空→text!=='' 门静默);TavernApp tool/result 分支改 v4 主路径+旧块兼容,textBlocksOf 原生兼容;pnpm build 双面+全套绿。遗议:roster 玩家行(轻重复)待用户拍板滤否。

**追记七(同日·濒死豁免玩家专属定案+规则集中 systemPrompt+death 去 who 参)**:SRD/BR 双正本核读(BR Combat 章「Monsters and Death」栏+SRD damage-and-healing 同名节)定案:濒死豁免＝玩家专属——NPC/怪/同伴 0 HP 即死(SRD GM 缺省),唯一例外=近战非致命打晕(攻击者伤害落地瞬间明言),本卡不为任何人免死。落改四层:①0HP 分叉键 `role==='pc'` 取代 growth(exp 键在否)——core.resolveTarget 删 growth 字段(死代码清扫律),attack/cast/damage/hp_change 四处分叉同律,0HP 受击自动落败收窄至 PC;②death.mjs 硬闸两道(role==='pc'+hp===0)——玩家专属由代码兜底,LLM 绕不过描述但绕不过代码;who 参数撤除(玩家专属下恒定玩家档,findCharFile('玩家') 本就特判 player.json);③规则集中 systemPrompt·工具纪律一条(濒死豁免＝玩家专属/同伴 NPC 怪 0HP 即死/打晕例外/不为任何人免死),attack/cast/damage/death 四处描述政策尾巴全撤——工具描述与回执只留机械事实(濒死计数起算/即死),规则为什么集中一处说(rules_zh §7 同步成文);④death 描述收敛「仅玩家可调(规则集中见系统提示)」。事故账:回执落盘行 `${file}` 残留未随 resolveTarget 改名,saveChar 落盘成功后 echo 行 ReferenceError→exit 1——death 两测一红一绿的假象根因,临时 rig 复现锤死已修。**全套 40 files/499 tests 绿**。

**追记八(同日·玩家死亡=跑团终局)**:systemPrompt 濒死条补终局句——death 回执「死亡」当轮立即收束落幕终章,不开新情节、不给行动选项(与叙事约定「行动选项收尾」的冲突由本条显式压过);rules_zh §7 三败条同步;顺手清 §7 行首「，。」赘点(sed 残留)。**全套 40 files/499 tests 绿**。

**追记九(同日·「叙事约定与语言风格」节冗余收敛)**:用户点名重复冗余,共同逐条对账后按推荐案收敛:9 条→7 条、约四成篇幅,独有指令全保。块内归一——NPC 内心禁写三处归「视角」(差异化设定/对话/动作/衣物外化并入);幽默搞笑两处归「节奏」;沉浸感三处+「不明写书写技术」归「小说文体」(保留两句原例句);跨节去重——「时间跳进随叙事自然给出」删(L7 时间自由推进同义,其示例即叙事级表述);行动选项条迁「流程骨架」与数据小结合并为每回输出一条;「不刻意回避死亡」半句并入濒死条(「叙事上也不刻意回避任何人的死亡」,死亡规则集中一处);玩家主权两条合并(任务决策权+客观推演;开头总纲句删=L1 已有)。填充清扫:「你擅长掌握」「张弛有度」「优先保证沉浸感」等人设吹捧与空话删,「参杂→掺杂」/节尾「；」/弯直引号混用随重写规整;量化判据原样保留(缓和≤2/紧张≤4 轮、五段式结构)——判据可判不降级。「断章钩同」一次性黑话(全仓唯一,3983e01 引入)依"判据必须视野内可判"删除,若原意为选项兼悬念钩,待补明话再回填。注:「少写心理」保留于战斗叠加——战斗体感优先于内心戏含玩家角色自身,与「视角」条的 NPC 内心禁写是两个面。验证:无测试锚定该节文本(prompting.spec 用自 fixture);全套 40 files/504 tests 501 绿 3 红——红(attack/cast 濒死自动暴击·翻骰)经 stash 实证与本改无关(撤 systemPrompt 改动重跑红量不变),系在途当拍写盘批;本地 ~/.dsh* 下 systemPrompt 快照零命中,存量工作区同步无对象(239 侧同律走账);rules_zh 不动(§7 免死句已覆盖,不回避死亡属风格层非规则层)。

**追记九(同日·濒死目标自动暴击+deathHitFail 单源+判词收口+hp_change 描述正空间重写)**:战报复盘(狼咬濒死 PC:agent 知 RAW「5尺内自动暴击」但 attack 只认 nat20→+1 败,遍历无合法补记通道→拿 hp_change -1 即兴补计→静默 no-op 假成功 Exit 0,盘面 death_fail=1 与信念 2 分叉)五件落地:①**attack 濒死自动暴击**——0HP 目标命中=暴击(伤害骰照 nat20 同机制翻倍、濒死败双计),攻击带近似:面板武器照 properties 远程判定,statblock 转写默认近战带(咬/爪主流);几何终判=DM,例外申辩 `beyond_5ft:true`(长触及武器打点击距离外;远程带默认不暴击无须传)。②**cast 触及类同律**(经用户裁定无 beyond_5ft——触及定义上即在 5 尺内,申辩口子无实质;远程带默认不暴击);顺修现存不对称:hurt() nat20 暴击打 0HP 也只+1→crit 参数 +2。③**core.deathHitFail 单源**(四结算件同律:稳定者 success 双清重开濒死——RAW「受新伤害即失稳定」补缺;crit +2 否则+1;满三=dead)。④**hp_change 0HP 负改=受伤同律**(濒死败+1,修复静默 no-op;同事件补计滥用由禁止连用+context 钉死防,不由 err 硬顶——旧伤崩裂本是合法独立受伤事件);description 整段正空间重写(用户裁定原文负空间定义看不懂:先说是什么/两类正向用法举例,红线后置具象化四专属件点名)。⑤**判词收口**——受击件也能写满三败(RAW)但原回执只报计数不说死亡:四件落败后 f>=3 →「◇ 三败——死亡(终局)」,death verdict 同改「死亡(终局)」,判词全库一语;systemPrompt 终局句对齐「任一工具回执判词『死亡』当轮收束」(用户手工重训合流,补「叙事上也不刻意回避任何人的死亡」);rules_zh §7 同步(自动暴击执行注/稳定打破注)。事故闭环:狼牙锁喉场景 attack 一件即出正解(骰翻倍+败+2+三败判词),hp_change 无需也不应被征用。**全套 40 files/504 tests 绿**(新增 attack 自动暴击/beyond_5ft/cast 触及/hp_change 0HP 同律/稳定重开五钉;三处断言串初版没料到骰式自带+50 修正,对实机回执修正后全绿)。

**追记七(同日·「上回合变化」节全线退役)**:用户定案,state.md 不再有该节、postPrompt 不再注入。动机:直写工具体系后变化已成三份复读(回执落盘行在 transcript、面板现值在注入快照、变化节再抄一份),且尾代每回合白写一次。消费面核明后删:前端(view/ui_data)09-27 清扫时已零消费,唯一活跃消费者=postPrompt 的 {{get_changes()}}。落位:get_changes.mjs 删;postPrompt 上回合变化块删;systemPrompt 五节→四节;maintenancePrompt 变化日志草稿句/3.c 变化节重写句/两处「变化日志注明冲突」清理(修复动作本身即事实落盘,注记为旧时代残留);get_world_state 剥离逻辑保留改注为存量工作区冻结节防漏渗;zones 无关,dnd5e-phase1 fixture STATE 摘节。docs 三份同步(panel-data/panel-consistency/asi-pending 所有权段——前端 .front-ops 通道自此独任玩家行为事件流)。全套 504 tests 绿(含 attack/cast 濒死自动暴击批新增 5 钉)。

**追记十(同日·工具描述十件全量重写——四步法判据落地)**:用户裁定工具 description 太长不清晰,按提示词四步法审计出四病:①层重复(description⊃参数描述⊃systemPrompt 铁则三层同文——agent 视野内重复不增判断力只增漂移温床);②视野外词汇(「同律/当拍/闸区/路由律/完备律/零转录」系维护者架构词,agent 视野内不可判);③预期效果复读回执(死亡五分支预演等——回执是 post-call 视野,自证不预演);④嵌套括号套娃(解析成本压在秒级选择时刻)。改法=描述只留独占品:**路由行(管什么/邻居谁)+触发时机(视野内可判)+通道骨架**,细则下沉参数、红线归 systemPrompt、细节归回执;长度 300-700 字→110-190 字/件。专属内容归位:attack「打濒死目标直传原始骰式,自动翻骰勿预倍」下沉 dice 参数;spawn_npc 的 commoner 底版填法/schema 独缺指导保留在描述(无参数可承载);check 群体检定「过半=全队过」家规保留(不可推导);gain_money 已在新方言,轻收一处。**全套 40 files/504 tests 绿**。

**追记十一(同日·描述瘦身后的丢信息对账)**:用户追问瘦身是否丢信息——全量删句做三分类对账(①参数描述自足②systemPrompt 有③回执自证):attack九句全落位(off_hand/dice 通道/ac 逃生舱/濒死原始骰式各归其参);check 六场景五归位(专注 DC 公式在 damage 参数、对抗回报骰值可由回执自证、群体过半保留);death/gain_exp/heal/hp_change 的删句全部落在 systemPrompt(被击败=杀死/击倒/劝降)或回执(乘数不进发放/升级块/同刻组/0HP 同律后果);initiative 同刻「组内次序你裁」回执自带 ⟦同刻⟧ 行=假警报。真丢一处:damage 坠落封顶「上限 20d6」(dice 参数只留了 10 尺 1d6)——补回「(上限 20d6＝200 尺封顶)」;对称弱损一处:cast dice 参数补濒死原始骰式提示(升环覆盖路径与 attack 对称)。**全套 40 files/504 tests 绿**。

**追记十二(同日·自动暴击从 agent 主视野撤出——机制→纪律+例外参数)**:用户追问「自动暴击是 agent 视野里该有的么」——按四步法重推:agent 在攻击调用时刻的合法动作只有复制律(statblock/原文数字照抄 dice),不需要理解暴击;把「自动暴击翻骰勿预翻倍」写进 dice 参数反而把机制塞回脑子里,而事故证明 agent 的 RAW 先验+机制意识=即兴绕工具的燃料。改:①attack/cast 的 dice 参数删机制解说,立「照原文一字不改」复制律(预翻倍=改写原文,被纪律直接禁止);②例外知识住进 beyond_5ft 参数自带触发条件(「濒死目标命中自动暴击,不在 5 尺内则传」)——要申辩的人正好在读申辩口,常备视野零机制。**全套 40 files/504 tests 绿**。

**追记十三(同日·升级系统疑云审计+选骰全机械化+cast 去 dice 参数+schema 通顺化)**:用户疑「升环被当成加点做进升级系统」——gain_exp 级联全段审计:级联只写 level/exp/hp/hp_max/hd_available/slots_lN/pending,零触碰法术强度,升环仍按次存在于 cast 调用参数(误会源=回执 slots_l3 2→3 是弹药池扩容)。顺带捞两条真案:①ASI.rogue 多 6 级——asi-pending 台账 L1 早有立案(「纯数值错」),用户记的「故意加」真身=rogue 额外档在 10 非 6;执行 L1+rules_zh §10 同步。②半施法者/契术师升级零环位(台账 L5)——补 HALF_SLOTS/PACT_SLOTS 位表,PACT 低环清零=整池上移;测试钉三连。**选骰全机械化**:正文句式三轮抽取(319 件→80 条,异常归零:attack 型 Hit: 行+On a hit 备胎、升环「for each/every (two) slot level(s)」、治疗 regains 族+平血 70/700、手核 eldritch-blast(计数型连调)与 spiritual-weapon(attrMod+两环一档))→`preset/lib/spell-data.mjs`→cast 消费:tblDice(基础+升环Δ聚合/戏法 5/11/17 档 scaleDice)+healDice+healFlat+施法属性内算。**rollExpr 能力边界实证:单骰项+平值**(8d6+1d6+1d6=null)→同面聚合 agg('8d6+1d6+1d6'→'10d6')。**dice 参数彻底删除**(用户裁):多弹份额=targets 重复名单(逐弹独立掷,3 发≠3 名单位报错)、变体=改语料数值、表外=响亮 err 逼补表;attack/type NotHit 面=「命中无伤害」明示行(contagion/plane-shift 类无伤攻击法术的静默问题)。**cast schema 通顺化**:用户二次裁定不清楚——六参数全重写成平顺句(删 frontmatter/施法族/路由律/接龙等黑话)。测试:fireball 五环=10d6+位耗、cure-wounds 属性内算(掷 X+3)、飞弹三发三单位、restore/自动型夹具改 FM 字段驱动(test-heal heal:1d8+40/test-missile damage:3d4+90)。**全套 40 files/506 tests 绿**(新增 6 钉)。

**追记十四(同日·cast 去 restore 参数——治疗自动识别)**:用户续裁「restore 还需要吗」——判据可推断:治疗分支改 `healDice||healFlat 且非 attack/save`(语料表 heal 字段/FM heal 字段自动识别;语料无治疗+伤害双面法术,vampiric touch 吸血=等伤害量的非骰式未入 heal 字段,零歧义)。restore 参数删除,cast 参数只剩 spell/caster/targets/as_level/mode;两 cure 测试钉去 restore 全绿。**全套 40 files/506 tests 绿**。

**追记十五(同日·attack 攻击名机械化——怪物攻击表+出生登记+转写通道退役)**:attack 照 cast 同律手术。**数据**:334 件 statblock 抽取 488 条攻击入 `preset/lib/monster-attack-data.mjs`(键=怪物slug/攻击名slug;kind: melee/ranged/touch/ray;0 异常;含 6 条法术攻击型能力——幽魂接触族),Hit 句式全覆盖(Weapon 行无 Hit=0)。**攻击数据三来源**:出生登记(char.attacks,spawn_npc 新增 attacks 参数——'名|melee/ranged|加值|骰式|类型|触及' 六段,出生完备律)>语料表(char.path 溯源→MONSTER_ATTACKS)>面板武器(equipmentFM,PC/同伴)。**dice/modifier/type 转写通道退役**(狼牙事故的转写面清零):变体=改语料/spawn 登记;表外攻击名响亮 err;beyond_5ft 收窄为长触及专口——reach 字段进表,reach≤5 恒 5 尺内自动暴,reach>5 默认贴身打+beyond_5ft 申辩,远程默认不暴。**边界如实**:plus 后段骑手 65 条(龙焰咬)v1 首段+台账;豁免型能力伤害(龙息类)80+ 件句式可抽但需豁免结算消费者,二期;光环/诅咒类 DM 面。spec:phase1 三枚骰转写钉→五枚新钉(表路径/狼咬自动暴/出生+beyond/出生定伤即死/表外err),tools-target 五调用转出生登记(PLAYER/哥布林乙 夹具带 attacks)。**全套 40 files/508 tests 绿**(净增 2 钉)。

**追记十六(2026-09-28·「冒险日」造词退役——统一「长休周期」口径)**:对照 Basic Rules p.166"Ch.13 Building Combat Encounters"原文核义——"The Adventuring Day"指一天内(两次长休之间)的遭遇节奏/资源消耗单位,并非一种日程事件;旧译「冒险日」事件化有误导,登记行旧值「新冒险日」更是无数可填的事件相位词。全员退役:preset 四处——systemPrompt 列目改「长休周期节奏:两次长休之间 6~8 场中/难＋两口短休」、maintenancePrompt 计数行「冒险日消耗」→「遭遇消耗」+重置行→「遭遇预算随长休重置」、state.md 登记行→「遭遇预算:满」(消耗态由 DM 随遭遇改写「已耗N场」);living 文档四件 24 处(design/panel-data×6/panel-consistency/dm-loop×15/prompt-principles)同步换词,DMG 出处名保留英文 "Adventuring Day" 保真;devlog 系史录不改旧文。**全套 40 files/508 tests 绿**。

**追记十六(同日·buff 体系一期——statuses 机械化+status 工具+ac 退役)**:用户三裁定型:①buff 四要素(名称/剩余/效果json/说明)+终版形态 `{name, remaining?, mods?:[{stat,magnitude}], notes?}`——效果 json 唯一职责=给工具算最终值;kind/conc/src 全删(显示由 magnitude 推、摘除按 name);时间单位归一轮/分/时/天(RAW '1 分钟'写入时归一'10 轮',系统两枚钟=战斗回合计数+世界时辰)。②**统一读口 statMods(j,stat)**(core)——"任何最终值=基础计算+Σ statMods",无 per-stat 特权;deriveAC 的 buff 侧收成一行;消费者渐开:ac(deriveAC)/attack_save+attack(attack 攻检,骰式每掷独立)/damage(伤害侧)三闸一期开,save 专链二期。③**status.mjs 新件**(直改器家族第三件):施加/摘除 statuses,mods 白名单校验,同名覆盖(RAW Combining),回执给前后 AC;写入者终局=cast 自动(法术族)+status 工具(叙事施加/解除,主代当拍,同帧生效)+尾代到期扫。④**ac 参数退役**(attack 最后数字转写口)——弃盾=statuses 机械条目(盾键=持有记录原义,持握态由 debuff 表达),工具弹弃盾钉改写;err 文案双叹气顺手修(err 前缀'!'+文案'!'叠印,attack 查无目标单叹化)。**RAW 收据**:Combining Magical Effects(同名不叠取最强/异名相加)、Adv-Dis 不叠互抵(条件类禁入机械键的规则依据)、Conditions 附录(语料缺——补语料候选;paralyzed 5尺必暴已机械存在)、time.md 尺度;语料版 Combining 截掉「同强取最近」一句——语料勘误候选。schema 净化:status 描述去 RAW 出处/函数名/清算黑话(用户二次裁定)。测试:弃盾 -2→AC15 摘回 17、查无目标、cast buff 写入弧;夹具终版形态。**全套 40 files/509 tests 绿**(净增 1 钉)。

**追记十七(同日·remaining 绝对止点制+二期总账)**:用户两问撕开两个口。①remaining 谁更新——相对量('10 轮')无锚=不可扫的洞:改**绝对止点制**,core 新 `anchorRemaining`(读 state.md 两枚钟打锚:'第 N 轮止/第 D 日 H 时止';'分'落钟格之间保持'约 N 分'叙事裁量),cast/update_status 写入时打锚,**条目永不更新,到期=扫钟摘除**(钟=活值在时间敏感项+回合计数器,条目=死值)。②remove:boolean 模式旗标虽不优雅保留——同帧摘除需求与弃盾对称(拾回盾后同回合 attack 读新 AC),err 双叹顺手修(err 前缀'!'+文案'!'叠印,attack 查无目标单叹化)。③用户裁定「散装二期会打架」——立 `docs/backlog_zh.md` **统一二期总账**(A buff 消费面/B 怪物能力/C 语料勘误补全/D 升级链 L3/L4/L6-L11 照走/E 工程面),规则三条:当批即入账、schema 内永不出现路线图语、数据先行消费渐开。update_status 改名落地。**全套 40 files/509 tests 绿**。

**追记十八(同日·statuses 数组→对象 map 覆盖式迁移)**:用户裁定「status 应是 json 对象不是数组」——覆盖式更新,核心三变:①**形态**:statuses `[]`→`{}`(key=状态名,value=`{applied_at, effect?, mods?}`),同名天然覆盖;②**时间锚**:anchorRemaining(绝对止点)退役,换 `core.nowAnchor`——施加时读 state.md 两枚钟记游戏时间('第 N 轮/第 D 日 H 时'),effect 文本自带持续+解除条件,到期=DM 叙事推进时对照 applied_at 判断;③**字段收敛**:kind/remaining/notes 删除,并入 effect 文本。联动:cast buff 写入改对象 map(T.buff 改 `{effect,mods}` 形态,cure 四条 buff 的 effect 文本带持续+专注);update_status 重写为覆盖器(施加 applied_at 自动/覆盖/remove 删 key/不传字段=删字段天然由覆盖式承担);core statMods/statusesMod/deriveAC 全改 Object.values 遍历;UI view chipsSmall 加 statusList 归一化(兼容对象+旧数组),三处 .length 改 Object.keys;模板/opening statuses `[]`→`{}`;锚点钉 tools-target「弃盾」改 shield 键翻转(装备态非状态,应早前裁定)、新增 update_status 对象表覆盖式钉;UI 夹具 4 文件 statuses 数组→对象(FOE 中毒改 `{中毒:{effect:''}}`)。**全套 40 files/510 tests 绿**(净增 1 钉)。遗留:弃盾的 shield 键翻键通道(谁写 false)仍无工具承载——尾代 runtimeEdit 或未来装备直改,见 backlog。

**追记十九(2026-09-28·机制审计修复批——A1/A2/A3/B1/B2/B3/C1 落码)**:审计方法=真 preset lib+真语料搭 rig 逐件实跑(位移术给队友 21 力场伤/神赐自伤 3 血/铁则行把数据错钉成剧情事实三案实锤),施工单+方案包全文在 `docs/audit-fixes_zh.md`(判决表 22 条带 RAW 依据、C2 专注断链方案、C3 rest 方案、C1 临时生命协议、C4 尾代重训挂钩清单)。落码七件:①**A1 语术语义分类**——SPELL_DATA 升语义层(`suppress` 伤害面封死/`save` T 级豁免覆写修 FM 洞/`healMulti` 群疗;divine-favor·branding-smite 重分类为武器附伤 buff),cast 自动伤害管道触发收窄为「表内显式 bolts」——fm.damage 兜底不再能致自动伤害,止于「◇ 无掷效果」显式回执;②**A2 多目标静默丢**——群疗逐人独立掷+落盘(单疗多填=响亮 err),攻击型多攻骰(scorching-ray 型)逐目标独立攻检+名额校验(施工中自查发现:tblDice 排除 bolts 致射线零伤害→rayDice=T.damage 补口);③**A3 收录闸**——spell∉spells_known(slug 归一)即 err,施法族「声明则必全」的读者迟到补上;④**B1 读口三缺**——core 新 `rollMods`(statuses mods 掷算单源,骰式每掷独立+暴击双掷+parts 带状态名):cast 攻击型吃 attack_save、攻击豁免双通道入掷,resolveSave 升级(save/attack_save 入豁免值,回执「状态修正 名: 骰」行——bless 的 d4 从此对豁免生效且 agent 视野内可判),attack 伤害侧 mods 扩骰式骑手(回执「附伤」行);⑤**B2**——check 豁免吃 save/attack_save,statusesMod 旧正则通道(effect 文本'dex+2'式)退役——展示文案不再承载机械语义;⑥**B3**——豁免型伤害套 resistNote(与 attack 同一函数,易伤×2 补齐)+hitFlat(disintegrate+40)失败全伤/成功对总额减半,自动弹分支同律接入;⑦**C1 temp_hp 退役**——模板/出生/HUD 芯片/CSS 死键全删(全库零写手零读者的门面键),临时生命协议(statuses 条目+hp/hp_max 同抬,到期回收 min(hp,hp_max−N))成方案待 C4 批拍板。夹具面:PLAYER 增 spells_known、cast 伤检/治疗回执带目标名前缀、test-missile(FM-only damage)改「无掷效果」钉(自动伤害=表内显式 bolts 语义收窄)。文档同步:panel-data/ui_zh/design_zh/panel-consistency #7 编注四份+tools_zh §四审计批注记。**全套 40 files/518 tests 绿(净增 8 钉)**;ui 源(view.mjs/ui.css)动过→pnpm build 双面过。协调注:本批与追记十八对象表迁移同帧施工,core/cast/check/attack 四件为并行 agent 所辖——C2/C3 等二期四件落地退 F/G/H 编号归并行线。

**追记十九(同日·并行分工下完成本方零冲突活)**:并行 agent(audit-fixes)动 core/cast/check/attack 期间,本方只做对方明确不碰的活,三件落:①**H1 语料截句补**——casting-a-spell.md Combining 段补「Or the most recent effect applies if the castings are equally potent」(BR p.85 对勘,语料版原截断,同效同名取最近的 RAW 依据补齐)。②**G1/G2 怪物表数据先行**——scripts/extract-monster-extra.mjs 新建,抽 `monster-ability-data.mjs`(ABILITIES 豁免型伤害能力 79 条:龙息 DC+save+骰+half/knockProne;RIDERS Weapon 骑手段 65 条);16 条「attack 附带 save」能力正确排除(其伤害段已在首表如 specter/life-drain,save 是附加状态属更深 backlog)。消费面按分工挂账待对方豁免结算消费者交付,数据先行(backlog 排序总原则)。③**H3 脚本归档(部分)**——monster-ability 抽取脚本已入 scripts/,可复现;spell-data/monster-attack 的抽取脚本留 /tmp 历史一次性不去重写(两表现已是「抽取+对方手工语义分类」混合层,重跑会丢 suppress/save 覆写手工层)。分工记忆已存 dnd5e-audit-fixes-parallel。**全套 40 files/518 tests 绿(含对方新增测试)**。

**追记二十(2026-09-28·audit-fixes 开放项自主定案)**:用户授权「不要找我拍板,自己想,记文档」——三案定谳入 `docs/audit-fixes_zh.md`(方案节升级为定案节,含规格/回执样例/测试钉):①**C2 专注断链(F 线)=判词即写**——check 专注维持失败自动级联(core.dropConcentration:清施法者 concentrating+扫全档删同名条目),判定件零写盘律接受唯一显式例外,依据三条(§3.1 工具读域法先例于内/零写盘律的旧豁免依据已随 buff 机械化失效/death·nat20 判词驱动落盘同型先例);cast 顶替顺修「只换字段不摘条目」遗病。②**C3 rest 件(G 线)**——schema 定稿 `rest(context,kind,who,hd?,food?,water?)`:短休掷 HD+短休池+契术师整池;长休三铁轨(hp≥1/24h 窗/打断=叙事)+位表迁 core 单源+长休池清+力竭(food/water=false 跳过)+专注清复用 F;边界成文(模糊时长 statuses 清扫留尾代,每日档池归 tick)。③**C1 临时生命协议(H 线)**——statuses 值域增 `temp:N`,授予=hp_max/hp 同抬+条目三写,取高不叠,到期回收 min(hp,hp_max−N) 算式不变式,伤害侧六通道零改动(组合池红利);RAW 偏差(治疗回填临时区间)成文声明。C4 尾代重训清单按三定案最终化(§9 六条)。施工序 F→G→H(G 依赖 F),四件文件归并行线。

**追记二十(同日·audit-fixes 二期 F/G/H 三线施工完成)**:并行 agent 完成 A1-C5 一期后,二期 F/G/H(实现归并行线)由本方施工,照 audit-fixes §6/§7/§8 定案落地。**F 线 专注断链当拍级联**:core.dropConcentration(扫描 characters 全档删键名==concentrating 的 statuses 条目+清 concentrating,幂等/坏档跳过);消费一=cast 专注顶替(旧专注跨档删+concentrating 换,修遗病旧条目不摘);消费二=check 专注维持失败级联(判词即写——判定件零写盘律唯一显式例外,§7 裁决)。**G 线 rest 件**:位表三族 SLOTS_FULL/HALF/PACT+slotsFor 迁 core 单源(gain_exp 改 import 删本地副本,行为零变化);rest.mjs 新建——短休(HD 掷+池回充+契术师整池)/长休三铁轨(hp≥1/24h 窗口 last_long_rest/位表回满+hd 公式 min(level,±⌊level/2⌋)+力竭 food 闸+专注清 dropConcentration+state.md 落账)。**H 线 临时生命组合池**:core.grantTemp/recoverTemp(三写 hp_max/hp/temp+取高不叠 Combining+不变量回收 hp=min(hp,hp_max-N));cast temp 分支(false-life 1d4+4,语料有);hp_change temp 通道(三选一);tpl statuses 注释补 temp。**遗留**:armor-of-agathys 语料缺(SRD 5.1 spells 未收,§6 定案误判)——backlog 挂账待语料补全。**测试**:F 四钉(concentration.spec)/G 五钉(rest.spec)/H 四钉(temp.spec),全套 40 files/531 tests 绿(较一期 518 净增 13)。

**追记二十一(同日·RAW 临时生命独立池 + 怪物面消费 G1/G2/F1 全落地)**:用户裁定临时生命方案 A(RAW 独立缓冲池)——推翻 §6 组合池近似。**临时生命独立池**:temp_hp 键复活(出生 0,tpl/opening 双补);core **injure** 统一受伤入口(先扣 temp_hp 剩余落 hp,六条扣血通道 attack/cast/damage/hp_change 负改全部改为它);grantTemp 改独立池版(只写 temp_hp+statuses 记录,不动 hp/hp_max,取高不叠);recoverTemp 改 temp_hp 递减(不碰真血)。RAW 五约束全收:独立缓冲/受伤先扣临时/可超 hp_max/治疗不回填/取高不叠。**怪物面消费**:G1 龙息豁免——attack 加 ability 入口(走豁免不走攻检,DC/骰式自语料表 ABILITIES 79 条,半伤/knockProne/抗免合并);G2 龙焰骑手——attack 叠加 RIDERS(独立骰+独立类型+独立抗免,65 条);F1 rage 抗性——attack 抗免段读目标 statuses 的 resist/immune 字段(合并进抗免名单)。E1 零星:spawn_npc stance/level 去维护者词(role 派生/刻度)。测试:temp 四钉重写为独立池/damage 先扣临时;/ability 三钉(龙息/wing-attack/表外报错)。**全套 40 files/534 tests 绿**。

**追记二十二(同日·升级链收尾+F2 消费型+E2 双值渲染)**:用户全权委托「能干完的都干完,自己验证」。升级链批次:①**L3 剩余**front_commit spells 三检(本职业表/非戏法/环位≤可施,readFM 读卡 level+classes)——players 点选侧零杜撰补上直改 JSON 通道;②**L6/L8/L11 验证已修**(gain_exp roll 早掷骰、op=prepare 已删、maintenancePrompt 已有 PC 例外)——台账过时勾销;③**L9 取舍定案**「卡不启用专长」rules_zh 注明;④**L10 双通道修**front_commit CON 追溯改「调整值增量 mod(后)−mod(前)」+maintenancePrompt 同伴通道同口径(属性分+1 而调整值不变=不追溯)。**F2 消费型状态**:core.consumeBonus(读 on_use 骰式删条目);check/attack 加 consume 参数(用掉即摘+加骰,写盘第二例外=资源消耗机械事实,与专注断链同型);schema 补 consume。**E2 HUD 双值**:ui_data return 补 ac_base;view AC 两处(速览 chip+护甲行)改「最终(基)」展示(ac≠ac_base 时)。**F3 力竭**:效果 6 级清单已文档成文(conditions.md),机械面(hp_max 减半)低频判定不强制——挂账。**L4/L7/E3 需对源/真机挂账**(L4 语料 8 张 class 表补 spells_known 需对 SRD 源、L7 抄录原文对源、E3 P0 E2E 需真机)。**全套 40 files/534 tests 绿**。

**追记二十三(同日·agent 视野走查→怪物状态骑手机械化)**:用户四问(agent 能否正确调工具/交叠/缺口/误导)——站 agent 视野实读全部工具描述走查:路由基本清晰(交叠靠「来源」分,描述互点名),但挖出真缺口=**怪物 Weapon 攻击的状态骑手**(狼咬 DC 豁免倒地/蛇咬中毒/鬼恐慌——约 80+ 条,此前 attack 只结伤害不结 rider 状态,agent 要手动翻 statblock 极易漏)。落完整方案:抽 monster-ability-data 的 **STATUS_RIDERS 23 条**(save/dc/status/duration;复杂 rider 疾病/诅咒/吞食/拉拽 16 条挂账);attack 命中后自动掷豁免,失败自动写 statuses(applied_at=at 参数,effect 带中文状态名+持续);schema 加 at 参数。agent 一件结完伤害+状态,零手动。**全套 40 files/536 tests 绿**。

**追记二十四(2026-09-29·HUD 展示层三翻——状态签短名化+节标题中文化翻案+同伴卡经验条)**:用户三令。①**状态签短名化**——主卡/同伴卡 chipsSmall 不再内联 effect 全句(吟游诗人激励整句撑爆窄行),可见签=短中文名+消费骰式(`·1d6`,读 on_use 结构位),effect 全句挪 `data-tip` 悬浮;数据册「状态」节同款签,全文出处仍 bk-stnotes 列表;update_status schema effect 引导改一句短话+**新增 on_use 参数**(骰式校验/`-?\d+d\d+/`,补上 consumeBonus 唯一读者的断供写手—— Bardic Inspiration 的 d6 从此入结构位不入文本)。②**节标题中文化翻案**——推翻 2026-09-24/25「SRD 英文标题+中文 tooltip」定案:household 全部节标题收编 hud-proto-v8 中文正本(六维/豁免/速览/技能/训练与语言/施法/状态/装备/背包/特征/抗性 / 免疫+熟练加值行),非新造译名(v8 正本一直是中文,09-25 实装跟了 grow 原型英文属跑偏,本次=纠偏);data-tip 中文规则注保留;grow.view/browser 两 spec 断言同步翻;memory 已翻案存档。③**同伴卡经验条**——personCard 依 `d.expBar` 存在性渲染 EXP 条(类 NPC 成长族 spawn 出生即带 exp,泵层 derive 从已算,零泵改),条体 h-exp 同款(数学=册头 bke 同式,clamp 0-100),css `.m-exp` 与 `.h-exp` 合并选择器;hud-proto-v8 正本同步:derive 补 expBar 演示子集+影样例补 exp+mateCard 补条+.m-exp 样式。**存量工作区已同步**(view.mjs/ui.css/update_status.mjs 三件);**全套 48 files/566 tests 绿**。

**追记二十五(2026-09-29·开局手动等级+高等级成长族出生+ASI 前端点选)**:用户令「opening 能手动设等级(roll 固定 1 级),设置完毕有对应成长,前端能选加点」。方案三件套:①**opening-meta 逐级施法死规则**——`CANTRIPS_BY_LEVEL`(6 施法者 SRD 三段阶梯 1-3/4-9/10+)+ `KNOWN_BY_LEVEL`(bard/sorcerer/warlock 逐级已知列)+ `knownSpellsAt`(wizard=4+2·L 进书线,与 gain_exp 每级新法术×2 同曲线;cleric/druid 准备制返 null);数据三源勘验(open5e SRD5.1 class API 直取 bard/sorcerer 逐级列,roll20/wikidot SRD 转载全 20 行比对 warlock/wizard/cleric/druid,双独立源一致落表——开卷实证,不凭记忆)。②**opening_commit 等级入参**——`ch.level`(缺省 1,落盘逐字节旧路径):1..20 中械闸(超 XP/位表/职业表表长即拒);buildClass 白级累积+`classHpMax(基础 con)` 满血+`hd_available=level`+exp=阈值当前级下限+位表整档 slots_l1..lN;**历史 ASI 不机械随机**(NPC 侧 applyAsiGrowth 才随机)——按 ASI_LEVELS 逐档挂 `LVn·ASI 点选` pending,玩家面板数据册 Ability Scores 节逐档点选(front_commit 既有闸照用:恰 2 点/上限 20/CON 追溯 HP——classHpMax 对 conM 逐级线性,追溯与公式严格自洽,零新校验);子职分支 `subAt===1`→`subAt<=level`(已到分岔级必落);施法面逐级对表+known/prepared 池=1..maxSlot 联合(报错文案「首环法术」→「已知法术」泛化,spec 断言同步);state.md 平均等级写实际值;rolled 回执增 level/asi_pend。③**opening 表单**——身份行加等级 select(Lv 1..20)+hint;`refreshGrowthFaces`(改职业/等级/六维三入口):子职卡「分岔级≤ birth level」现身+施法成套重掷(戏法/已知逐级计数,准备=level+wis 调整并**开始随表单提交**,服务端新校验数量+池);随机分配不 roll 等级;校验按所选等级对表。opening_data:`pools.byLevel` 按环位分桶+`slotMax`(三族位表派生最高可施环)+cantripsBy/knownBy 下发。**零面板/宿主/前端框架改动**(pending→grow 模态→front_commit 全链既有)。文档:design_zh §6.8 新节/rules_zh §10 一条/asi-pending 出生挂单先例。**存量工作区已同步**(opening-meta/opening_commit/opening_data/opening.html 四件——ws 内 update_status/ui/view/postPrompt 为并行追记二十四工作流所辖,未触碰);**全套 48 files/566 tests 绿**(含并行线新增,净增 7 钉:dnd5e-opening 高等级批用例)。

**追记二十六(2026-09-29·spawn_monster 枚举化+档案自含+stance/敌我退役+DMG 财宝)**:用户四令收敛:①「完全不需要让 LLM 读 monster 章节,把所有怪物名放枚举,工具按名自寻档案,回执返整卡」;②「hp 按卡里计算方法生成;DMG 财宝本期做;掉落财宝=背包+钱」;③「人物卡格式只有一种,不能用 from 代替——假设 agent 运行中无法再使用 lorebook monster 内容」;④「stance 没啥用?显式构造敌我有必要么?战斗节只放参战者」。落码:**A 枚举+材料化**——monster_kind 全量枚举 334(文件 stem,内核 schema enum 先拦+工具读卡兜底,漂移钉防 assemble 加怪漏改);spawn_monster 重写:HP=FM `hp_roll` 骰式掷(≥1,缺字段回退卡值,批量逐只独立)、钱袋=rollTreasure(CR 档,gp/sp/cp 直填,物品归 agent gear)、材料化入档 attacks(表+RIDERS 附伤+STATUS_RIDERS 豁免上状态,agent attacks 覆盖优先)/abilities(龙息类)/features(`名|释义` 正文 Trait 行——释义连同入档,运行时零 lorebook 语义依赖)/description(FM);**怪档=人物卡单一格式完整实例,path 键退役,monster_kind=身份元数据**(对位 class)——**attack 结算改纯档案驱动**(born.attacks/abilities/riders/status_rider 优先,旧档 path 剥离回退 join=兼容存量;MONSTER_ATTACKS/ABILITIES 系列表退居 spawn 数据源)。**B 财宝表**:lib/treasure.mjs——DMG p.133 Individual Treasure 四档死规则(本地 SRD 确认不收此表,数据取转写站全表+四档三处著名奇行独立开卷互证,CR0-4 三行挂官方 PDF 勘误候选;ep→×5sp/pp→×10gp 归一,汇率正本=语料 rules/standard-exchange-rates.md)。**C stance/敌我退役**(翻 09-25 三池定案,机械敌我零消费者实证:attack/damage/cast/gain_exp 全不查敌我)——spawn 两工具 stance 参数退役上 `companion` boolean(我方位=前端左右分位;怪物固定右/同伴+PC 左);presence 单列制(`- 名`,旧三态行兼容读;分桶消费端按 role 现算,档缺归右);战斗节参战名单化(combatWrite {round,order}+参战行,initiative 去 foes 交集——参战名单即战斗名单;旧 敌行/友行 行式兼容读);get_npc_state label=档案 role;ui_data 左右 projection 重写;maintenancePrompt 5 行同步;视图 zones(同伴/非我方)。设计辨析若干:装备(armor/shield/weapons=deriveAC/attack 机械读者)vs 背包(gear=纯清单)不合并;弃盾 status 退役方向成立待装备直改道(挂账)。测试:dnd5e 五 spec 63/63+全仓 49 files/578 tests 绿(净增 12 钉:材料化/hp 掷/钱袋/漂移钉/单列名单/参战名单化/兼容回退)。文档:tools_zh/design_zh/panel-data_zh 换词;backlog 四账。

**追记二十六补(同批·MONSTER_CORE 数据快照——spawn 零 lorebook 读取)**:用户两问撕开残存耦合:「bodyText 还读 lorebook?不能复制进 json data 么」「法术/技能/状态/feature 文本同理都不该运行时查」。落:scripts/extract-monster-core.mjs(与 buildMonster md 语义逐式同源)→ lib/monster-core-data.mjs(MONSTER_CORE 334 条:FM core+抗免扁平化+暗视+特征释义+description);buildMonster 改「数据快照主路+md 断档回退」(fixture 靠专名 grexling 走回退钉,双路径各自有覆盖);fixture goblin 与真身撞名的教训入 spec 注释。**方向入账**:法术/职业表(classRow 正则—最脆一环)/装备等全消费面数据化=第二批(backlog 已记),工具运行时零 lorebook 读取为终态;DM 叙事 runtimeRead 规则原文属正常通道,不在退役列。

**追记二十七(2026-09-30·数据化第二批——法术/装备/特征 items enum+档案 spell_details 自含+cast 回执效果行+查书节退役)**:用户定案①「希望 LLM 会用法术并知道意义=法术名+内容进注入卡——出生/学法术把会的每条展开入档」②「cast 非伤害类(飞行/幻术/召唤)效果好坏要看——回执照效果」③「attack/cast 参数不枚举,值域=who 会什么,拦截即闸(attack 已然)」④「查 SRD 的搞什么——agent 不该看那些」。落码:**抽取三发**——extract-spell-core(SPELL_CORE 319:{fm 全量+effect 剥机械头正文含 At Higher Levels},fm 语义与 core.readFM 同源,`_cur` 泄漏一次修)、extract-equipment-core(EQ_CORE 237)、extract-class-features(CLS_FEATURES 12 职全文;顶级 '## ' split 法避开多行 $ 断行陷阱);**换读取口**(全部断档回退,fixture 兼容):cast(fm=SPELL_CORE 主路+回执 `效果:` 行≤1200 字+schema 改'who 的法术之一';收录闸照旧)、front_commit(三检换 SPELL_CORE+学 2 法术 spell_details append)、opening_commit(readDirSpells 迭代 SPELL_CORE+panel spell_details/feature_details)、opening_data(池/slotMax 数据化)、ui_data candidates(目录扫→SPELL_CORE 迭代,键=文件 slug)、core.equipmentFM(EQ_CORE 主路)。**send 物料**:spawn_npc spells_known/prepared items enum 319(skill/class 等 6 枚举同批);**档案自含 helper**:lib/spell-build.materializeSpellDetails(names)+class-build.feature_details(CLS_FEATURES 名前缀匹配,缺者空)。**systemPrompt 查书节→「素材与规则真源」**:srd_index 撤常驻(6KB),两行=素材全集=工具枚举/档案为事实+规则原文 rules/ 罕见边缘才翻——**用户纠偏:agent 面禁工程黑话(日期/定案字样),全面 grep 实证 prompts 与 schema description 干净(注释面不算)**。**语料勘误诱因**:tools-target A2 夹具补 scorching-ray attack_type 被数据真身遮蔽——照 H1 先例改真身(corpóre 勘误)+重抽;opening/candidates 旧钉的 fixture 池语义走「迷你 SPELL_CORE rig 覆写」(断言不动)。**断奶实证**:tools/scripts/lib 的 lorebook 读取仅剩断档回退+2b 欠账(classes 表/classRow——opening/升级链低频)。**全套 580 绿**(净增 0——旧钉经迷你核/勘误保持语义;新面无常绿钉入 cast 效果行与 spell_details,由既有集成钉覆盖)。遗留(2b):classes 职业表正则(classRow/buildClass Proficiencies 行)、races、opening_data classes 解析。

**追记二十八(2026-09-30·数据化 2b——classes/races 机械化,断奶收官)**:用户令「都机械化」。两发抽取:extract-race-core(RACE_CORE 9:{fm})/extract-class-core(CLASS_CORE 12:{fm, prof_line, rows[1..20]{pb,features,specific}}——**classRow 正则退役为回退**,序数词解析在抽取期固化)。换口:core.classRow(数据主路+md 回退)、class-build buildClass(readProfLine 内联回退)、opening_data classes meta(CLASS_CORE 快照 fail-loud)、opening_commit/spawn_npc raceFM(RACE_CORE 主路);opening_data 死 readFM 摘除。**断奶终检**:tools/scripts/lib 的 lorebook 读取全部=断档回退分支(+死脚本 srd_index.mjs 待 git rm——注入口早已零,assemble.mjs 注释提及);classes/races/devlog 三文档迦词照例。**全套 580 绿**。遗留阅读面(有意不机械化):skill/conditions/weapon-properties/proficiencies/Alignments/damage-types/languages/magic-schools/poisons(零机械消费者,poisons 待"毒物物件闭环"立项再抽)。

**追记二十八补(同日· рамка 回锅折中——三态列回 presence/前端,战斗节参战名单化保留)**:用户真机玩批(伊芙遇缇娜/瑟兰):出生游侠落右栏与敌混列+「hud 面板点不开」=中演体感是论据——关系本无落点。「点不开」真因=acts.book 旧键池查找(批一改 ui_data 形状漏了这一个消费口,静默 return)——修 companions/others→三态后回键。折中定案:①spawn 两工具 stance enum 必填(同伴|中立|敌对——出生当拍在场快照),archive role 由 stance 派生(同伴→companion);②presence 行/三池/注入标注/前端三区回 v4 形(get_npc_state 标签=池,label 幽灵客单列旧行=中立);③战斗节=参战名单不回滚(敌我不入战斗节——批一净收益);④maintenancePrompt d 节回三态句(态迁移改标/入队双写/敌对=持久态)。spec 侧:presence/zones 回三态形状+单列旧行=中立兼容钉+注入池序钉(池序非行序——防再踩);phase1/spawn 双 spec .Production notes:python 批补丁啃括号三处(regex 贪心无 `\s*\)`)——PAR sequence 全绿 580 后扫尾。教训:改数据形状当拍 grep 全消费口(acts.book 即漏网),(用户面反馈=视觉回归第一信号)。

**追记二十九(2026-09-30·批3——lorebook 出 runtime 终局)**:用户三令①「目标=去掉 lorebook,不希望有任何索引到 lorebook 的兜底」②「rules 写一个 tool 专门查」③「runtime 里不要再有 lorebook」。落码:**回退全拆**——core(classRow md 正则/equipmentFM existsSync 回退/readFM 导出全退役,纯数据)、monster-build(md 回退单源化,孤儿块剪净)、spell-build/class-build(fallback 删,查无快照即爆)、cast/front_commit(SPELL_CORE-only,查无即拒)、rest/gain_exp(hit_die 读 CLASS_CORE)、attack(**MONSTER_ATTACKS/RIDERS/ABILITIES 表 join 回退整个退役——born-only**,ability 表钩/旧档 kindOf 剥离全删;旧档出路=重 spawn)、ui_data(武器 join→EQ_CORE/spellFm→SPELL_CORE)、srd_index 死脚本 git rm、maintenancePrompt 语料四句清(rules细节全转 rule 工具句)。**rule 查章工具**:tools/rule.mjs 新件(章 34 全集枚举内核硬拦,RULES_CORE 34 章全文数据;超限 q 关键词提行;agents main+tail),RULES_CORE=extract-rules-core 出(276KB 语料→数据模块;正文原样)。**语料迁移**:`preset/setup/dnd5e-srd-lorebook` → **卡根 `corpus/srd-lorebook`**(git mv,不在 preset=不播种=runtime 无语料),六发抽取脚本+规则抽取路径同改;assemble 改输出点挂账(重跑散料需 SRD_SRC,罕见)。**spec 数据核化**:helpers/dnd5e-fixtures.ts 初版误居引擎包——用户抓边界「卡不应在 engine 改代码」——迁**卡内 scripts/test-fixtures.mjs**(spec 经 pathToFileURL 引,卡片测试工具住卡片);phase1/concentration/ability(cast-branches 本就数据化)夹具 md 拷贝全走 injectSpellCore/injectMonsterCore/monsterArchive 数据核注入;corpus 路径五 spec 同改;ability 狼/龙档案由 monsterArchive 产(材料化自带 interceptor 键)。**ability 键尾横杠归一**(MONSTER_ABILITIES 键 '…legendary-' 甩尾,attack slug 追不中——档案键 materialize 时 replace(/-+$/,''))。**验收**:grep preset/ 零 `dnd5e-srd-lorebook` 引用(maintenancePrompt 四句清后);runtime 种子=preset 整拷,语料目录自此不存在;**全套 579 绿**(净减 1:旧档兼容回退钉随回退一起退役——旧档出路=重 spawn)。遗留阅读面照旧(skill 文本/conditions 全文/weapon-properties/proficiencies/poisons——零机械消费者,查证走 rule 工具章;poisons 待物件闭环)。

**追记三十(2026-09-30·官方纸卡开卷——行名「已知→法术」+出生戏法并册 spells_known)**:用户三连问(「HUD 戏法行后的『无』何解」「已知 宜改法术——术语表有据」「戏法落哪/官方卡有无 cantrips 项」)牵出两个定案。**开卷实证**:Basic Rules(2018)空白角色卡 p.179——spells known 一张表、0-9 环行、「cantrips」竖排侧标签恰与 0 环行同带 = 官方口径 cantrips 是 spells known 名单的 0 环行,非并行第二名单;RAW 职业表「Cantrips Known」独立列=配额计数列,不是存储面。**历史链对账**:原型 hud-proto-grow mock spells_known 本就含戏法+「交付版由泵按 level:0 拆」注释(视觉正本)→ ui_data splitSpells 照交付 → b5e4ebc 开局重做出生层 `spells_known: learned` 断点(测试钉「进书=首环,戏法不混」把捷径锁死)→ spawn_npc「0 环归 spells_known」NPC 侧回正——PC/NPC 字段语义分裂即缺口本体:出生 roll 的戏法只进回执(rolled.cantrips),spells_known/spell_details 两口全缺,cast 收录闸连带拒所有 PC 戏法(cast 「戏法免位」位检形同虚设过不了前闸)。**落码**:opening_commit 并册(`spells_known: [...cantrips, ...learned].sort()`+spell_details 物化含戏法+翻案注释)、dnd5e-opening.spec 五处反转(法师 L1 9 件/L5 18 件/warlock 4 件/cleric L3 known=3 戏法——准备制 known 面空但戏法在册)、panel-consistency 字段描述补「含戏法(0 环并册)」、ui_zh 三行句式;HUD/cast/front_commit 零改动(泵投影照拆、收录闸自然放行、学法三检只管新学≥1环)。**行名**(同批):view spRow('已知'→'法术')+CAP_TIPS.cast 枚举句、grow.view/browser 两 spec、术语表依据=translation-protocol §⑥ spell=法术(spellSplit 键名/存储 spells_known 不动——存储层不改律)。**存量闭合**:ws-035017 术士蕾雅(L1 Draconic)——出生回执不可考(表单 cantrips:[]=服务端 roll 未落盘),按 NPC 机械随机先例从 SPELL_CORE 术士 L0 池重 roll 4(Chill Touch/Mage Hand/Poison Spray/True Strike)并册+spell_details 6 件物化;ui_data op:panel 泵实跑验 `spellSplit` 4/2 拆分(HUD 戏法行就此有货)。三 ws 快照外科手术同步(view.mjs 行名已随外部刷新到位;opening_commit 并册 delta 三锚点各计数闸=1 才写;并行钟面工作流文件零触碰)。**全套 49 files/579 tests 绿**。

**追记三十一(2026-09-30·hover 中文浮签批——lorebook-cn 入 corpus+intro-cn 抽取+施法/技能上签)**:用户拍板「hover 法术/戏法/技能要中文介绍」。排查:vtip 机制健在(0.1s 出/移开收),根因=法术名是纯文本 span、技能行从未挂 `data-tip`——非坏是未接线;且中文效果正文全仓不存在(中文只有 glossary 译名)。**译稿资产**:用户提供桌面全量译稿 `lorebook-cn`(1187 篇,与 srd-lorebook 同构,spells 319+INDEX/skills 18/rules/…)——照「语料入 corpus」先例整拷**卡根 `corpus/lorebook-cn`**(5.0M,与英文正典等重,不在 preset=不播种)。**抽取**:`scripts/extract-intro-cn.mjs` → `preset/lib/intro-cn-data.mjs`(SPELL_INTRO_CN 319+SKILL_TIP_CN 18;剥机械头取首段,超 170 字句界截断,升环段不入)。译稿特形两坑全被 fail-loud 闸咬出:①「法术列表」类名与正文**粘行**——12 职业中文名封闭集锚定贪吃消费后余文=正文;②stat 标签**全角冒号**(`**施法时间：**`)——正则双冒号兼容;外加仪式标挂粗体外(`**1环 防护**（仪式）`)。验收:键位与 SPELL_CORE **319/319 全对齐**,长度 min/avg/max=9/…/171,查无/异形=0。**接线**(泵上签,view 裸加载不 import=不内嵌大表):ui_data `splitSpells` 产出 `spellSplit.tips`(在册法术名→中文简介,戏法+环术+已备全含,查无缺省)与 `skillTipsOf`(熟练技能→中文句);view 法术三行改**逐词 chip span**(`data-tip` 有才挂,vtip 不出空签)、技能行 div 级 `data-tip`;词间分隔符照旧。零存储零工具改动(spell_details 英文自含照旧——展示层/注入层分野)。**测试**:view spec 法术三行断言改 chip 形+挂签/noSplit 不挂签反例+技能签;ui-data spec tips 断言(全量自喂出中文)+未知卡名 tips={} 反例;browser spec fixture 带 tips+四签精确清单+mouseover→closest 链路出中文签(real-hover 已由 hpbar 既有用例覆盖,growSave mock 同步保 tips)。**全套 584 tests 绿**(+5 净增)。遗留:特征(feature_details 英文全文)浮签未挂——待文后续批;#vtip 换行/长文样式零改动。

**追记三十二(2026-09-30·corpus 退役——lib 数据单源收口+模块合并)**:用户令「corpus 应该不需要了,所需内容都整理进 lib,且 lib 具体内容合并合并」。**合并(total 20→12 件)**:①`srd-data.mjs` 六件合核(SPELL_DATA/CLASS_CORE/CLS_FEATURES/RACE_CORE/EQ_CORE/RULES_CORE——原 spell-data/class-core-data/class-feature-data/race-core-data/equip-core-data/rules-core-data,域段注释分隔,头注=手工维护源+SRD 5.1 OGL 处署名);②`monster-extra-data.mjs` 二件(MONSTER_ATTACKS+ABILITIES/RIDERS/STATUS_RIDERS);③`glossary-cn.mjs` 吸 intro-cn-data(SPELL_INTRO_CN+SKILL_TIP_CN 并入,CN 文案总件);④**两个注入缝保持纯单 export 硬约束**——spell-core-data/monster-core-data 是测试夹具(test-fixtures injectSpellCore/injectMonsterCore+双 spec miniSpellCore)**按文件名整文件覆写**的接缝,六个夹具覆写点全部译成 `export const 仅一个 const`,合并它们即破覆写——因此独自成册。12 处 import 行重写(脚本/工具/lib 内部双行合一)。**退役**:corpus/(srd-lorebook 英文正典 5.0M+lorebook-cn 译稿 5.0M,`rm -rf`)、`assemble.mjs`(源 docs/dnd5e-srd 早不在=不可运行死件)、`scripts/extract-*.mjs` ×9(死件,先例=srd_index git rm;重抽通道随档——数据已是终态,改动直改 data 模块)。**spec 残影十段清**(批3「五 spec corpus 路径同改」的 cpSync 段——运行时零 lorebook 后本就无消费):rest 整拷/phase1 四拷/spawn-monster 六拷四考/tools-target 五拷删;双真断言改单源(spawn-monster 漂移钉=enum==MONSTER_CORE 键集;spawn-npc subclass 枚举=CLASS_CORE fmUnion——fmUnion 逐值≡旧 md frontmatter 解析,等价替换)。design_zh 目录定案句+§2.1 改终局修订存档注释。**存量同步=三 ws preset/lib 整目录换新**。**全套 49 files/584 tests 绿**(净零)。数据责任断言:grep preset/scripts/packages 全域 corpus 引用仅剩出处注释。

**追记三十三(2026-09-30·lib 域家族返工——srd-data 溶解,spell/monster/class 同前缀聚家)**:用户追问「spell 相关难道不该在一起?monster 难道不该在一起?」——判明上批合并轴错位:按「语言/生产轴」把 SPELL_DATA 混进六域杂烩 srd-data,违背真正的组织轴=**域**。返工:**srd-data 溶解**(rm)——SPELL_DATA 抽回 spell-data.mjs、RACE_CORE/EQ_CORE/RULES_CORE 各归 race-core-data/equip-core-data/rules-core-data(单 export 姿态);**class 域首次真折叠**——CLASS_CORE+CLS_FEATURES 双导出同居 class-core-data.mjs(非注入缝,合法);monster 域三件(core 缝/extra/build)已是家族,不动;CN 文案(glossary-cn)/出生配额(opening-meta)/机械(core)/状态(status)/财宝(treasure) 保持 singles。10 处 import 重接(cast→spell-data/rule→rules-core/opening_data+rest+gain_exp→class-core/opening_commit+spawn_npc→race-core/ui_data→equip-core/class-build+core、spawn-npc spec),status.mjs 与 spell-data 头注笔误随修。终形态:lib 共 16 件=域家族同前缀 8(spell 3:core 缝/data 骰式/build;monster 3:core 缝/extra 行为表/build;class 2:core 双导出/build)+singles 8(race-core-data/equip-core-data/rules-core-data/glossary-cn/opening-meta/status/treasure/core)。design_zh 目录定案句改域家族终版。三 ws preset 全档再同步(前批只同步 lib,scripts 旧 import 漏网已由全档拷扫平)。**全套 584 绿**。教训:合并前先问用户脑里的「合并」沿哪根轴——域内聚≠文件数少;同前缀家族才是 lib 的正确目录形态。

**追记三十四(2026-09-30·test-fixtures 迁居卡 test/)**:用户令「test-fixtures.mjs 放该卡的 test 目录」。git mv scripts/test-fixtures.mjs → **test/test-fixtures.mjs**(卡根新建 test/——测试工坊与规则工具分居;该件曾因批3「卡不应在 engine 改代码」边界由引擎包迁入卡内,今再按面归位),头注补分居句;消费者 dnd5e-phase1/dnd5e-ability 两 spec 的 pathToFileURL 行同改。全 49 files/584 绿。

**追记三十五(2026-09-30·时间流式提示词批——systemPrompt「时间流逝」节+maintenancePrompt 一致性校验)**:用户令「system 集中写一节:时间必须流式+流逝参考标准;末尾报当前时间(既有)」且「tail 维护提示词按时间流逝校验面板/状态合理」。落笔:**systemPrompt 新「## 时间流逝」节**(原「时间自由推进」句自事实节迁入并扩)——①时间必须流式(静止镜头不存在);②流逝参考尺=SRD time 四层(轮=一条玩家消息≈6 秒/分钟=地下城逐室动作,样例查门 1 分搜房 10 分/小时=城市荒野,样例 15 哩 4 小时/天=长途短休≥1 时长休≥8 时);③声明即事实(声明的流逝=时间增量,维护链照它进位「当前时间」行,小结报时间与地点——postPrompt 既有末行显式接线;buff 照 applied_at+effect 时长判存续)。**maintenancePrompt 第 4 节升格「进位执行+时间一致性校验」**:先核主面小结时间与「当前时间」行无漏跳,再逐项校验钟与面板自洽(该到未到/过期残留——未到期误删以钟为准不复活),冲突按时间真值当拍修正+完成摘要点名。测试零锚定(prompting 无钉)——本批 8 红为并行 persona 批 spec 待补参(同伴四件必填中途态),spawn 链经补参探针实证完好(hp 28/特征 4 落档),非本批伤。

**追记三十六(2026-09-30·statblock 幽灵词清扫+maintenancePrompt 六处死规清账)**:用户令「statblock 清理」+「除 7/8/9(战利品落点/换装律/l.16 收敛)都改」。**词汇**:agent 视野零 statblock——systemPrompt 2(敌人用其怪种真名/怪走 spawn_monster 按 monster_kind 选型)、spawn_monster schema 3(monster_kind 描述=「全部怪种的枚举」等)、monster-core-data/monster-build 头注;连带修正已死指引 monster-build 回执报错「重跑 extract-monster-core.mjs(已删)」→「MONSTER_CORE 缺条目」。**六处**:①参战行「名|path|状态」→「名|状态」(path 无活写手——combatWrite core.mjs:329 只发名/状态,parseCombat path 解析=旧档容错遗产);②NPC spells_known 追加流删除(spawn 后不变,无学法流——来源链「cast 升级/学习」对 NPC 不成立),括注上移条款头;③登记表计数器剔「奥法已用/遭遇消耗」(features 行/预算感各自唯一法域,双家必漂);④「不要自己折算单位」→「时钟不许自造、不许重推,一律对行判负」(与硬性要求 3 矛盾解除);⑤强行军 DC 精确化=「10+超出 8h 的时数」(原「10+时数」歧义);⑥rest 级联权授予尾代——级联白名单 gain_exp/gain_money/rest,3.a「漏调照第 2 步补调」、跨小时短休/跨日长休窗口两句同改，「主面调 rest」死角解除(长休窗口不足 24h 不结算+摘要点出)。全 agent 面 schema JSON 可解析+node --check ✓。**批次红底归属再证**:594 基线 22 红全在并行 persona 批在编面(monster-build 引 monster-persona-data.mjs 尚未入库=其半落态;phase1/spawn-monster/status-enum/ability/persona-data 五 spec),本批触面(spawn_monster 单句描述/维护提示词)语法与 schema 独立验证完好。

**追记三十七(2026-09-30·maintenancePrompt 四透镜通读批——十处修订)**:用户四透镜审查(不明不白/机制矛盾/agent 视野外/空禁令与改造历史化石)+令全落。**历史化石**:「你不再转录数值…」「转录不得重复落」(转录员时代遗留——本代尾代从不是转录员=空禁令)改正面职责句;persona 节「(2026-09-30,docs/persona-threelayer_zh.md)」日期+仓库 docs 引用删除(docs 不进 runtime=视野外)。**译文黑话**:「重放」×2→「不重复落盘」;「孤儿写据」名字与 l.10 定义不符(本义=写了没叙,定义的是账实矛盾)→「回执与正文矛盾」;「主面申报」→「主面声称仍在、档里却无的也不重建」;「在场三态」与「三态名单」同名异指→「建档与更新名单一次完成」;「无追加流」→「建档时定死,不随成长变化」。**机制矛盾**:硬 4 补 rest(上手批给尾代 rest 级联权漏了硬 4,照字面补调反越权);「删亡者档案」加玩家档豁免×2(玩家死亡=终局档案保留——原无限定,player.json 有被战毕清场误删的事故面);短休级联 hd 补判据(照叙事/对话声明,未声明不结算——防撞「不发明」);persona 字数「见键描述」视野外→写死(各键 ≤30~60 字/history≤120——对码 lib/persona.mjs PERSONA_LIMITS)。misstep 自纠:persona 节替换锚点缩进踩出双连字符,行 18 已复位。化石 grep 清零(转录/重放/孤儿写据/主面申报/日期 docs 引用)。

**追记三十七(2026-09-30·人物卡更新器——update_status 改名 update_character 扩面+spawn_npc 去 spells_prepared+cast 收录闸并集)**:用户令四步收敛:①「spawn_npc 创建不需要 spells_prepared——已备表=和临时状态一样的东西(运行时可变),不属出生面」;②「该有个更新人物卡的 tool=update_status 扩展,现在只能改 buff——改名 update_character、支持更新叙事可变字段」;③「参数不需要枚举,靠回执 lint 就够了」+「spells_known=agent 视野唯一全法术枚举,留且别处不重复」;④statuses 三连翻案:「修改状态=改一个数组,每条=状态名+applied_at 一个 json;effect/mods 机械按状态名匹配;不需要 remove,update 的 statuses 填 JSON 数组就够了」+「persona/abilities/race/gender 不会改(生成面/改法不属直接编辑)」。落码:**A update_character.mjs**(并删 update_status.mjs)——statuses 数组全量替换(每条=名+applied_at;effect/on_use/mods 机械按名匹配:条件/职业态=lib/status.mjs 新 STATUS_TEXT 单源,法术条=名(SPELL_CORE fm.name)→slug→spell-data 的 buff/pool/onFail 检索——LLM 零手写效果文本/零手抄机械修正;**替换式未列即摘除**,remove 退役;temp 仅临时生命条目带)+平铺叙事字段(description/history_append(行数组只增)/role(入队离队)/exhaustion/armor/shield/weapons/gear/languages;数组=全量替换空=删键,标量 null=删键)——**生成面(persona/abilities/race/gender/六熟练/特征/抗免)与结算面(hp/钱款/经验/法术位/concentrating/slots)传了即报错点名归属**,特殊修档=尾代 runtimeEdit 兜底;未知参数防幻觉点名(内核不限 additionalProperties,参数白名单 ALLOW 在工具拦);**回执=逐键行+改后整卡 JSON**(spawn_npc:先例同口径,维护代理可接力);法术参数无 enum 传全表走 SpellsCheck 三检(lib/spell-build 新 spellsCheck 单源=spawn 出生同律 spells 断奶),spell_details 自动重铺。**B spawn_npc**:spells_prepared 参数删(schema 319 重复枚举随之消失)、代码三检收 spells_known 一步、**退役守闸**(persona.mjs 先例)「已备表走 update_character 落」+准备制职业(牧师德鲁伊圣武士游侠)回执◇出生空提示。**C cast 收录闸并集**(勘验发现的 live 缺口伴修):opening_commit 对 cleric/druid 落 spells_known=仅戏法(knownSpellsAt 返 null,opening-meta:53)+prepared 单置 spells_prepared,而收录闸只查 spells_known——天生准备制玩家施不了已备法术;闸池改 known∪prepared(法术面措辞,slot 无改动),tools-target 未收录钉一条同改。lint 双闸(saveChar 当拍拦/lint_characters 存量扫)与 UI statusList 归一化不动(卡内存储仍对象 map)。**全套 51 files/608 tests 绿**。文档:tools_zh 新 §八·B/值域行改写、mechanism-map 行、backlog F2/F3/E1、refactor-plan E1、maintenancePrompt 3.a(卡片字段写档优先 update_character,状态=数组全量列表,尾代 runtimeEdit 兜底)、tpl/comments 四处点名、front_commit 存档注。
**追记三十八(2026-09-30·枚举政策批+当前想法+history 整合律)**:用户五问连环收敛:①「role/languages 可以 enum 么?还有其他 agent 视野内重复 enum 么」②「rest 的 kind 可以 enum 么」③「damage 的 type 可以 enum 么?应该参考啥」④「人物面板要有『当前想法』条目——player 不需要,NPC/怪需要,仅靠 update_character 持续更新,人设重要一环」⑤「maintenancePrompt 应检查每个 character.json 的 history,超 10 行整合成一条」。落码:**A 枚举即名录扩面**——update_character `role`(companion|npc)/`languages`(16 键=glossary-cn LANGUAGE_CN 单源)、rest `kind`(short|long)、damage `type`(13 型=**glossary-cn 新增 DAMAGE_TYPE_CN 正典**,SRD 5.1 damage types 全量;spell-data/EQ_CORE 数据面全在 13 内=钉证)——漂移钉新立 dnd5e-enum-drift(stance 字面量×2 对写核/languages·damage 正本钉/闭域闭环);agent 视野重复枚举审计=仅 stance(spawn 两工具各持字面量,schema 间无共享座,钉对齐兜)。misstep 自纠:枚举注入先用了 `["@KEYS@"]` 占位替换(用户问「有这种语法么」——占位一旦漏替=垃圾上线),改字面量直写,正本钉兜同步,与 spawn 既有字面量枚举同律。**B 当前想法 thought**——update_character 平铺新参(NPC/怪卡专属内心一句 ≤40 字,玩家卡 err 拒落=内心自主权;唯一写入通道;null=删键),面板小传(bk-tale)非 PC 常驻 `💭 当前想法:` 行(缺省显「无」,零新 CSS);spawn 出生不落(键裁剪律)。**C history 整合律**(maintenancePrompt §3.a 新条)——任何 characters/*.json history 行数组>10 行(注入面板=整卡 JSON,行数尾代视野内可判;写档时读档顺检)→整合成**一条**记录:叙事总结留关键事件与因果、[秘] 子句原样保留、压缩行 ≤120 字;整合=history 只增律唯一例外,归维护面走 runtimeWrite(update_character 面只承载追加)。**death 机制勘验**(用户问「到底对不对,为什么这么难死」):death.mjs=RAW 忠实(nat20 回 1HP 清计数/nat1 双败/10+成功/三败死三成稳/仅 PC 掷);attack 受击 0HP 走 deathHitFail(+1/crit+2/稳定者受击重开)。**RAW 缺口=大伤害直接死(Massive Damage:0HP 时溢出伤害≥hp_max 当场死)链上未实现**——40 伤砸 10 血不会当场死,只能靠三败滚出;「难死」主因=治疗抢拍+nat20 回血+大伤害条款缺位,机制本身无偏差。全套 52 files/614 tests 绿。
**追记三十九(2026-09-30·普通人搬家+check 对话直演)**:用户两问一令:「创建普通人 NPC 不要用 spawn_monster——commoner 从枚举去掉,spawn_npc 加普通人职业」+「有什么提示词要求和 NPC 交流用 check 么?为啥这么爱调?」。落码:**A commoner 迁家**(spawn_monster 枚举 334→333;MONSTER_CORE/monster-persona-data/monster-extra-data 'commoner/club' 三件数据清除;**spawn_npc 新职业**——职业域数据 NPC_CLASSES 归 class-core-data(用户纠偏:opening=玩家创建面,不收——CLASS_CN 12 职原样,岗位面=CLASS_CN∪NPC_CLASSES);CLASS_CORE commoner 条目(d8/saves[]/prof_line null/subclass[]/rows 仅 L1 空 features);PROF_ARMOR/PROF_WEAPON commoner=[];ASI_LEVELS commoner=[](普通人无 ASI 档);spawn 六维特判——commoner 不 roll 标准数组(15/14 不是普通人),SRD statblock 全 10 出生;为 schema 枚举 13 值;阶段一 spec 路人甲改 spawn_npc)。**B check 对话直演**——勘察:systemPrompt 无社交点名,推动源=「一切 d20 全部工具算」+check 描述「一切判定类掷骰必经本工具」;用户自改 check 描述「npc 做决断靠人设和逻辑,不调用本工具」(对话交流=叙事直演,不在对话中例行掷骰)。全 hunt 绿。

**追记四十(2026-09-30·开场白人称批——三场景 narration 改玩家第一人称)**:用户令「opening 里,描述需要用第一人称——这是 user 消息」。判据=落盘 ack 后 `tavern-insert` 把开场白直入宿主输入框、由玩家亲手发送——即**首条 user 消息**:user 口吻里「你」只能指 DM(扮演者自称该是「我」),旧第二人称口径是「场景旁白体」时代的化石。三场景逐句换称:「你就是其中一个→我就是其中一个」「没人指望你,也没人拦你→没人指望我,也没人拦我」「你的传奇→我的传奇」「你已经站在崖道半腰→我已经…」「只剩你一个→只剩我一个」「而你→而我/把你拽进→把我拽进」「塞进你手里→塞进我手里」「约你半夜→约我半夜」;无人称的世界框架句(盘着一条老龙/王位空悬)不涉改;tagline=表单卡片标签(不进消息)人称中性照旧。双处落笔:openings.json `_doc` 落**人称律**(narration 以 user 消息发出,一律玩家第一人称,禁「你」指玩家)+opening.html 内嵌兜底副本同步(头部注释同律)。工作区:旧 ws 已清,新 ws-20260930-180251-895-1 播种即第一人称正本(preset/setup 两件+runtime/openings.json 核验 我称 3/你称 0)。测试注:dnd5e-opening 的 narration 断言仅 toContain('酒桶镇') 不涉人称;本批零新钉。期间全套一度 3 红(dnd5e-persona-data/phase1/spawn-npc)——核为追记三十九批中途态钉未跟上(git stash 双面验:与本批两文件无关),三十九批收尾后**全套 52 files/615 tests 绿**。
**追记四十一(2026-09-30·半施法正位+spawn 校验聚合——游侠拒建案)**:用户两问:「spawn npc 的时候,每个字段的错误都需要全都检查完毕以后一起输出到回执里」+「ranger 这个职业不让创建吗」。勘验:ranger 建档本身可过(在 CLASS_CN/schema 枚举内),断点=施法者家族:opening-meta CASTERS 名单手抄全施六族,而 core 位表三族早备了半施表(HALF_CASTER={paladin,ranger})——buildClass.isCaster 派生自该名单,paladin/ranger 被判非施法族,spawn 带 spells_known 即「!ranger 非施法职业」整体拒,读作「不让创建」。落码:**A 施法家族单源**——core 新 `isCasterClass`(全施/半施/契术三族判定),opening-meta CASTERS 改派生(`Object.keys(CLASS_CN).filter(isCasterClass)`,名单不再手抄=漂移源拆除),class-build.isCaster 换源+CASTER_ATTR 补圣骑士=魅/游侠=感知;半施 L1 无位表(SLOTS_HALF 行缺省)=RAW 正确,spawn 三检环位闸自然收口(L1 传猎魔人箭=「环位超可施」而非「非施法」);cast/gain_exp/rest 本就走 slotsFor 家族族表,零改动即通。**B 玩家面**——opening_commit 准备制分支扩四职(cleric/druid/paladin/ranger)带 maxSlot>0 闸(L1 半施不进支=无施法面正确);opening.html wantCounts prepared 计数同扩(施法属性按职取:感知/魅力),表单 spellcard 对半施现身(半施无 0 环表→戏法区恒空属正确)。**C spawn 校验聚合**——err 首错即 exit → **账本化**:逐字段错误入账不即断,全字段查完一次上回执(一行一错、`!` 前缀、Exit 非零整段转述,内核无首行特殊语义);persona 闸同步账本化(personaGate 签名第二参 err→opts,返回 errors 聚合——记账剥 `!` 前缀、回执出口统一加,防 `!!`;两调用面:spawn_npc 并入同一本账,opening_commit join 成一条 fail,该点无写盘清账安全);依赖链:职业/等级坏即跳过 class 派生与依赖检(未知职业不再连带「查无职业快照」),法术逐条逐检多罪并排(旧首错即断只报一条),子职双闸独立记账(一处坏不遮另一处),同键超长不再补必填(同键一罪)。**D 同名守护**——schema 承诺「同名已存在(含 player.json)则报错不覆盖」落地(existsSync 闸入账;spawn 直写不动原档)。**E 顺带缺陷修复(勘验中现形)**——spell-build `materializeSpellDetails` slugOf 对齐三检键法(撇号先弃再断):Hunter's Mark 旧键法撇号当断点(hunter-s-mark)查无 SPELL_CORE 键,词条降 fallback(0 环/空文),对齐后 1 环带全文;schema 319 名录内 Apostrophe 类同修。验证:实弹 probe 四组(ranger L5 猎魔人箭:caster wis/位表 l1=4·l2=2/准备制提示/词条 1 环;paladin L3:cha/l1=3;ranger L1=超环文案;opening_commit ranger L3 玩家=准备表 5(3+感调2)+位表 3+无戏法,paladin L1 无施法面·L2 位表 2+准备表 3)。双新钉:dnd5e-halfcaster(9 测试)/dnd5e-spawn-aggregate(7 测试);**全套 54 files/631 tests 全绿**。文档:tools_zh §八 spawn/update 两行+design_zh §6.8。
