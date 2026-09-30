# 人设三层定案 · persona 重构(人格层 / 履历层 / 现况层)

> 状态:**波1已施工**(2026-09-30;spawn 双侗+tpl v10+lib/persona.mjs+maintenancePrompt+panel-data —vitest 引擎面 20/20 绿)。定案五则 + 女娲质量标准映射 + schema 描述稿 + 施工清单。方法论参照 [女娲 · Skill造人术](file:///Users/wolf/.codefuse/engine/cc/skills/huashu-nuwa/SKILL.md) 的输出框架(extraction-framework.md / skill-template.md / 通过标准),不是其调研流程(六 agent 蒸馏给真实人物用,不适用)。

## 背景:现行字段的五处欠账

- **description 实际装着外观**:`希尔薇.json` description=「银灰短发精灵游侠,灰绿眼睛,暗红斗篷」——外观无字段可落,散在 description 与卡头描述里。
- **persona 五件=标签化**:`personality/ideals/bonds/flaws` 短标签(「嘴硬」「沉黙寡言」),`postPrompt:20`「性格靠差异化设定外化」指名靠它,但标签控不了行为(女娲:捕捉 HOW they think,不是 WHAT they said)。
- **历史两处真值**:表单 `backstory` 死通道(UI 恒传空,`opening.html:513`)+ `biography[0]` 组装句(`opening_commit.mjs:150`)。
- **spawn 输入面极薄**:两工具只收一句话 persona(本篇裁定后,`spawn-commoner_zh.md` 定案 3 的 ideals/bonds/flaws 方案**作废**,由本篇取代)。
- **description 静态**:出生定终身,roster 面(`get_roster` 全部人名—简介)渐失时效。

## 定案

### 1 · 分界:三维度→三层三职能(2026-09-30 用户定案)

| 层 | 字段 | 职能 | 形态 | 更新 |
|---|---|---|---|---|
| **人格层** | `persona` | 怎么演这个人(行为逻辑+外观+阵营) | 对象七键,值单行 | 半静态;尾代后补/剧情改写 |
| **履历层** | `history` | 经历了什么(长期设定+运行时事件) | 行数组,追加式 | 只增;出生写 [0],运行时追加(唯一例外=整合律 §3) |
| **现况层** | `description` | 现在怎么样(身份+当前处境/动向) | 单行 ≤40 字 | **随 history 追加同拍刷新**(同一笔 runtimeWrite);无追加=保持出生值 |

```
persona: {                                                  // 人格层(七键,≈150字/人)
  appearance: "银灰乱发,圆脸笑纹深,指节粗大,一身油亮的皮围裙",  // 外观 ≤40字:头发/脸/身体特点部位+当前穿搭(西幻)
  lens:       "看人先看钱路——嘴上都是情分,眼里都是生意",     // 底色 ≤30字
  reaction:   "生面孔→先掂量后搭话;被赊账→嘴上骂、账本上留名",  // 遇事 ≤60字
  voice:      "嗓门大,骂人带笑,口头禅『这世道』",              // 腔调 ≤30字
  never:      "不出卖投宿客人;白天绝不谈买卖",                // 红线 ≤30字
  tension:    "趋利,却给跑路的落难客也留饭",                  // 张力 ≤40字
  alignment:  "中立"                                        // DnD 械轴,9 值枚举
},
history: [                                                  // 履历层(只增)
  "前佣兵遗孀;丈夫死在谷地的仗里,客栈一个人撑到今天。传闻她藏着一笔抚恤金[秘]",
  "第3日·新客赖账没吵起来,记下了名字"                          // ← 追加行带日戳(格式对例)
],
description: "酒桶镇客栈老板娘,丈夫亡后独撑店面,近来店里流民渐多"   // 现况层
```

- **退役清单**:`personality/ideals/bonds/flaws`(五件)、顶键 `background`、`biography` 键。迁移成本低:biography 即现成行数组,history≈换名+首行重写成饱满值。
- **分层不重复**:人格回答「怎么演」、履历回答「发生了什么」、现况回答「现在怎么样」;
- 键裁剪律照旧:五件人格键可缺(裁剪),但**有名有姓的 NPC 三层都在**(spawn 闸,定案 4)。
- 存储纪律不破:值=单行短串/行数组;注入成本 persona ≈150字+(老五件≈50字),在场 3-4 人多 ~400-600 token/回合,换主 agent 直演质量。

### 2 · 女娲质量标准映射(各键的要求出处)

| persona 键 | 女娲出处 | 硬性要求(进 schema 描述/系统提示) |
|---|---|---|
| `lens` | 三重验证(排他+生成力) | **排他**:换个路人来不该也想得到——禁通用价值观词(「重情重义」式,女娲:把通用道理包装成独特见解=违例);**生成力**:拿到没写过的情境也能由此推出该角色的态度 |
| `reaction` | 决策启发式(如果X则Y) | 「遇X→Y」句式 2-3 条(可触发于新情况,不只适用原始案例);**禁形容词标签**(「多疑」不算,「被施压时闭口不谈」才算);宁少勿多(3 条深刻的远好于 10 条浅薄) |
| `voice` | 表达 DNA(句式/词汇/口癖) | 口癖点到即止(太多变成模仿秀);读 100 字能认出这是谁(辨识度,不是通用 AI 味对白) |
| `never` | 反模式(我拒绝的) | 判据=**机器/代理视野内可判**(涉及具体人/物/场合):「不出卖投宿客人」可判,「为人正派」不可判;1-3 件 |
| `tension` | 矛盾处理(本质性张力=深度来源) | **保留不合解**(❌选一边忽略另一边/❌编调和解释/❌假装不存在);一对即可 |
| `appearance` | ——(女娲无此维度,自裁)**西幻化(2026-09-30)** | 一字段足矣(用户定案);**西幻人物风:至少含头发、脸、身体一处分明的部位 + 当前穿搭**(服饰=现在穿什么);换装后更新(维护面);画面感,禁只写身高体重数字 |
| `history[0]` | 人物时间线(关键节点) | 写**塑造性事件**不写流水账——事件对「之所以是此/之所以在此」的因果;秘密子句 `[秘]` 前缀(女娲「公开表达≠真实想法」的 NPC 化=示人面与藏匿面) |
| `description` | 身份卡(50字自我介绍) | 第三人称转写:身份+当前处境/动向,不复制 history 行文 |

**整体通过判据**(女娲 Phase 4 通过标准,NPC 化)——spawn 回执 ◇ 行与 lint 按此软检:
1. **生成力**:拿这份人设,遇到没写的情境,能否推出该角色会怎么做?(lens/reaction 的判据)
2. **辨识度**:appearance+voice 合读 100 字能认出这是谁
3. **张力 ≥1 对**:全员「观点高度一致」=太假(女娲:观点高度一致=太假)
4. **反模式**:任何键禁形容词标签堆叠;写的必须是可运行的规则/画面
5. **鲜活各异(2026-09-30 用户定案)**:初始设定要有故事性张力——创作鲜活的、性格各异的、有故事的人;可从文艺作品立得住的成功角色设定里汲取灵感(取神不抄皮);**每个角色都认真创造**,禁千人一面/模板句糊弄

### 3 · 写协议(分工律 2026-09-30 用户定案 + 尾代侧)

- **分工律**:写法要求分两面,不设第三处——**创造面**(人设怎么写:西幻外观、张力、女娲判据)只进 spawn 两工具的 schema 描述(所有 agent 在调用点即见——创造 NPC 是所有 agent 的工作);**维护面**(history 追加/description 刷新/换装更新/[秘])只进 maintenancePrompt。systemPrompt 不另设方法论段(§6 作废)。
- **同拍律**(维护面):history 追加与 description 重写是**同一笔 runtimeWrite**,roster 面即现值;无追加=description 保持出生值。
- **换装律**(维护面):appearance 的服饰段=**当前穿搭**(可见装备,西幻风);换衣(armor/装备变更或叙事换装)后同拍更新穿搭段。
- **整合律**(维护面,2026-09-30):history 只增律的唯一例外——行数组超 10 行(触发=maintenancePrompt 文首 `{{history_alert()}}` 注入器欠账点名,清零归静默)→ 整合成一条记录(叙事总结 ≤120 字,`[秘]` 子句原样保留);走 runtimeEdit 整段替换数组(old_str=现行整个数组文本——update_character 面只承载追加),落笔后读回核对;不与同拍律联动(整合不改现况)。
- `[秘]` 行前缀:history 专属(人格层不藏秘);尾代维护;示人面=view(wave 2:NPC 拥有 `[秘]` 行永不显示,玩家去前缀)——biography 时代的约定原样迁移。
- 追加行带日戳(格式对例「第3日·」),时间真值=state.md「当前时间」行。

### 4 · spawn 闸(分级;2026-09-30 用户裁,怪侧同日二次翻案)

- **spawn_npc(一切调用必带 persona)**:**同伴**(长线人物)`lens/reaction/tension/voice`+`history[0]` 必填;**路人/在场 NPC** `lens/reaction`(行为契约最小对)必填——分级闸对传没传 persona 都生效(零人设不可出生,gate=lib/persona.mjs);`appearance/never/description` 缺项回执 ◇ 软提示。
- **spawn_monster(不收人设参数,数据面预生成)**:statblock 自带机制数值与风貌 description——**LLM 一概不填 persona**;怪人设=MONSTER_CORE 的预生成 `persona` 行(每怪一份,data 批统一生成勘验),spawn 机械落 `m.persona`(数据行缺席=裁剪);个体化同名怪由尾代后补/数据批覆盖。传 persona/history 参数=结构化报错。
- **字数上限硬闸(displayed in tool)**:appearance 40 / lens 30 / reaction 60 / voice 30 / never 30 / tension 40 / description 40 / history[0] 120,超限 err(机械事实进工具,内容判断归 LLM)。
- **杂兵不填**(spawn_monster 批量):多层工体不写,`personality` 时代的省略语义不变。
- **无 roll 机制**:人设是判断不是骰——机械层不发明设定(对照 opening 服务端 roll 只存在于 SRD 表内机械面);饱满靠 schema 行文+缺项提示。怪物 statblock 自带 description 照旧落初始现况值。

### 5 · schema 描述稿(spawn 两工具 wave 1 施工规格)

spawn_npc 「persona」对象参数(机械事实+判据;方法论集中 systemPrompt,遵守「规则集中 systemPrompt,工具描述只留机械事实」):

```json
"persona": {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "appearance": { "type": "string", "description": "外观:一眼看上去的印象,西幻人物风——至少含头发、脸、身体一处分明的部位,加当前穿搭(服饰=现在穿什么),≤40字,画面感,禁只写身高体重。" },
    "lens": { "type": "string", "description": "底色:他/她看人看事的独特镜片,一句话≤30字——判据:换个人不该也想得到;拿到没写过的情境能由此推出态度。禁『重情重义』式通用价值观。" },
    "reaction": { "type": "string", "description": "遇事:行为契约『遇X→Y』2-3条,主代理照此直演——判据:遇到没写的情境能推出反应。禁形容词标签(『多疑』不算,『被施压时闭口不谈』才算);宁少勿多。" },
    "voice": { "type": "string", "description": "腔调:说话方式/嗓音/口癖,≤30字;口癖点到即止,过量=模仿秀。" },
    "never": { "type": "string", "description": "红线:此人的硬边界1-3件,须可判(涉及具体人/物/场合):『不出卖投宿客人』可判,『为人正派』不可判。" },
    "tension": { "type": "string", "description": "张力:一对矛盾,保留不合解——人物深度的来源,立得住的角色都有一处拧着的地方;≤40字。" },
    "alignment": { "type": "string", "enum": ["守序善良","中立善良","混乱善良","守序中立","绝对中立","混乱中立","守序邪恶","中立邪恶","混乱邪恶"], "description": "阵营(9 值枚举,缺省=绝对中立不落)。" }
  },
  "description": "人设三维度(外观/行为/来历):人格七键。每个角色都认真创造:鲜活、性格各异、有故事性张力,可从文艺作品里立得住的成功角色设定汲取灵感(取神不抄皮),禁千人一面;判据=生成力(拿设定能推没写过的情境)/辨识度/张力,禁形容词标签堆叠"
}
```

spawn 入参与落位对照(同形):

```json
"history": { "type": "string", "description": "长期设定:出身+塑造往事——事件对『之所以是此/之所以在此』的因果,要有故事张力,不写流水账;≤120字;秘密子句行首『[秘]』前缀(不主动叙述,揭示后去前缀)。" },
"description": { "type": "string", "description": "现况一句:身份+当前处境/动向,≤40字;出生写当下,随 history 追加同拍刷新(维护面,规则在 maintenancePrompt)。" }
```

落位:`persona` 对象照传落;`history` → `history:[首行]`;`description` 顶键照落;**`biography`/`background`/散参 `persona`(string) 三参退役**。spawn_monster 不同构:两参都不收(传参即拒),怪人设=数据面 `m.persona` 预生成行、机械落卡(§4 二次翻案)。

### 6 · systemPrompt 方法论段——作废(2026-09-30 用户定案)

分工律(定案 3)落定后无此段:写法要求全部进 spawn schema 描述(定案 5,创造面),维护规则全部进 maintenancePrompt(定案 3,维护面)——西幻外观三笔在 appearance 键描述,张力/鲜活/文艺灵感在 persona 对象与 lens/reaction/history 键描述。systemPrompt 不重复。

## 施工清单

| # | 件 | 内容 |
|---|---|---|
| 1 | `preset/templates/character.tpl.json`(v10) | ✔已落:persona 七键全骨架+注释;history 行数组(追加式,`[秘]` 约定);description 现况注;biography/background 五件退役 |
| 2 | `preset/tools/spawn_npc.mjs` | ✔已落:定案 4 分级闸(必带 persona)+五·schema 描述稿+落位改造(退役三参);回执 ◇ 缺项提示/字数硬闸;闸体=lib/persona.mjs |
| 3 | `preset/tools/spawn_monster.mjs` | 已落:工具不收 persona/history(传参即拒);落位接线 `m.persona`(数据面预生成行) |
| 4 | ~~`preset/prompt/systemPrompt`~~ | 方法论段作废(定案 6,分工律) |
| 5 | `preset/prompt/maintenancePrompt` | ✔已落:3.a 加同拍律(history 追加⇔description 刷新)+**换装律**(appearance 穿搭段随换装更新)+ persona 七键后补语义——维护规则唯一居所(分工律:创造面=schema、维护面=此件) |
| 6 | 文档 | ✔已落:panel-data_zh 二·B 表(三面模型→三层模型)+核心键永不裁、`spawn-commoner_zh` 取代标注;design_zh §6 随 wave 3(opening 侧)更新 |
| 7 | wave 2(view) | ✔已落:小传 persona 六行渲染(外观/底色/遇事/腔调/红线/张力,缺哪不显)/卡头=阵营(background 退役)/history「履历」节+`[秘]` 人物过滤(NPC 永不显,玩家去前缀)/roster 读现况 description |
| 8 | wave 3(opening) | ✔已落:表单五件→七键(六输入+阵营+履历 textarea)+随机池全换骨架句(契约式,非标签)+一键 roll/「↺ 重掷」同源+提交闸四件必填+出身背景输入框退役;opening_commit:personaGate 复检+history[0]=玩家履历(backstory 别名收编)+description 现况组装+组装句退役+design_zh §6.9 |
| 9 | 迁移 | ✔已落:`lint_characters` 三闸(statuses/persona 七键/history 形状,退役键列示促迁);存量两档与工作区快照——tavern_workspace 已清空,无迁移面 |

## 风险与开放点

- **注入成本**:persona 七键 ≈150字/人,`get_npc_state` 全卡注入+roster 命中——在场 3-4 人多 ~400-600 token/回合。
- **旧档 biography**:wave 2 起不再写;存档旧键读侧兼容(view 保底)见迁移 #9。
- **追加行日戳**:格式对例(「第3日·」)已裁;是否硬闸尾代补戳=施工时看维护提示行文再定。
- **怪人设数据批(✔已落,2026-09-30)**:MONSTER_CORE 全 334 怪预生成 `persona` 行——5 个分批(批作者产出 `scripts/persona-batches/batch-*.json`,批3 曾 API 瞬断半途、续写补齐)→ `merge-persona-batches.mjs` 校验(slug ∈ MONSTER_CORE/三键必填/七键白名单/字数硬闸/alignment 9 值/全值无数字)→ `lib/monster-persona-data.mjs` sidecar(334/334 零错,手改会被合并覆盖)。spawn_monster:单只落卡、**批量(×N)杂兵不配个体人设**。voice/never/tension/alignment 有门槛取舍:voice 只给能交流的(数据档 languages 判「can't speak」),tension 只给龙/恶魔/巫妖级,纯兽/构装/软泥/虫群无阵营不写 alignment。
