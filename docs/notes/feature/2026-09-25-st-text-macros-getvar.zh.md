# Agent Note：ST 宏明确不支持 + 导入期脚本翻译（st.mjs）

Status: implemented（2026-09-27 施工完成；B1 引擎重扫/预算、B2 导入器分拣+st.mjs、B3 客户端开场三键、全套 499 绿、build 双面）。文件名沿用 `getvar`（初案定名）；终案脚本为 `st.mjs`，与调用名 `{{st(...)}}` 同名（家法：调用名≡`preset/scripts/` 下的脚本文件名）。

中文

## 问题

酒馆卡的 systemPrompt / postPrompt / 世界书条目 / 开场白里普遍埋着文本宏（实测九张真卡：裸 `{{user}}`≈45 处、`{{char}}`≈36 处）。当前链路下它们：导入侧原样保留 → 卡层渲染器"裸=字面量"静默穿过（`prompting.ts:200-204`）→ kernel 严格插值层对任何 `{{...}}` 组抛 `unknown prompt variable` → **回合装配失败**。另两条伤：
- lorebook() stdout 不被重扫，书条目里的宏直穿进 section；
- greetings.json 是客户端直读直显（`card-ui.ts:258-271`），字面量直接端给玩家。
在案事故：`devlog.zh.md` 裸 `{{...}}` 撞内核插值层 turn/end error（09-14 写手列）。

## ST 机制调研（SillyTavern-release 1.18.0，浓缩）

导入侧原样入库；替换全在渲染端懒执行（`substituteParams` → 封闭内置宏注册表，handler 全是 ST 编译期闭包）；宏家族 = 名字类 + 字段自引用类 + 时间骰子类 + 有状态类（setvar/getvar）+ 群聊类 + STScript 专用（pipe/original 等）。ST 的宏层**没有**"裸 token 调卡作者脚本"机制——可编程在其另一层（STScript/正则扩展，我们已退役）。

## 决策史（三轮，各留理由）

1. **09-25 初案**：翻译期封装 `{{get_var('key')}}`（当时拍板）；
2. **09-27 复审**：一度翻向"渲染器内置文本宏白名单"方案——依据是渲染咽喉唯一（systemPrompt/postPrompt/lorebook stdout 同过 `renderPlaceholders`）；
3. **09-27 终案（用户裁定）**：内置白名单是**半吊子方言**——要支持 ST 语法就得整个家族支持；而家族里的字段自引用类需要运行时持有的原始卡字段，本架构折叠后**不保存 canonical card**，全家族内置意味着新增一份卡原文持久化。故:**明确不支持 ST 宏语法,导入期用脚本翻译**——脚本机械（折叠期已知值 + 脚本 fs/快照/Date 能力）覆盖全家族,内置白名单方案作废。

## 不变量（家法文本，四条）

1. 运行时唯一占位符语法 = 脚本调用 `{{scriptName(args)}}`；09-15 裸 `{{name}}`="废弃字面量"契约**原样破例为零**；
2. **折叠后，面向 kernel 的文本中不存在裸 `{{name}}`**；
3. ST 宏语法在本项目不存在运行时；导入器是唯一翻译边界；
4. 翻译只动折叠产物，`st`/`fy` 槽 verbatim 不变（原文永远可追溯，重折叠之源）。

## 终版分箱（导入期三类处置 + 一撮真死角）

**第一档 烘焙为字面（值在卡里已是死数，折叠时直接写进文本）**：
`{{description}}` `{{personality}}` `{{scenario}}` `{{mesExamples}}` `{{charPrompt}}` `{{charJailbreak}}` `{{charDepthPrompt}}` `{{charCreatorNotes}}` `{{charVersion}}`；`{{newline}}`→字面换行、`{{noop}}`→去除、`{{trim}}`→去重白。零运行时成本。

**第二档 翻译为 `st.mjs` 脚本调用（值在运行时才存在）**：
导入器把 ST 宏的活的逻辑写进**卡自己的 scripts**：`preset/scripts/st.mjs`（单文件多子命令，argv[0] 分发；文件名与调用名同名，同 lorebook.mjs 之家法）。**零特殊地位**——和 lorebook.mjs 同类同待遇：引擎不认识它、不注册它；调用失败走普通脚本失败行（`scriptFailures` 上屏不静默）；玩家可编辑可删除，删了对应调用照常失败。

| ST 宏（族） | 翻译为 | 取值 |
|---|---|---|
| `{{user}}` / `{{persona}}` | `{{st('user')}}` / `{{st('persona')}}` | `runtime/persona.md` frontmatter `name:` / 正文 |
| `{{char}}`（=`{{name2}}`） | `{{st('char')}}` | `../preset/meta.json` 的 `title` |
| `{{name1}}/{{name2}}`、`<BOT>/<USER>/<CHAR>` | 同上（旧标记顺手映射） | — |
| `{{time}}/{{date}}/{{isotime}}/{{isodate}}/{{weekday}}` | `{{st('time')}}` 等 | 脚本内 `Date` |
| `{{roll:d20+2}}` | `{{st('roll','d20+2')}}` | 骰式解析 |
| `{{random:a;b}}` / `{{pick:a;b}}` | `{{st('random','a;b')}}` / `{{st('pick','a;b')}}` | 参数拆分随机取 |
| `{{setvar::k::v}}` / `{{getvar::k}}`（+global 族） | `{{st('set','k','v')}}` / `{{st('get','k')}}` | 读写 `runtime/vars.json`（脚本有 fs 权限；ST 的 stabilization 编序语义不做等价，按求值顺序落） |
| `{{lastMessage}}/{{lastUserMessage}}` / `{{input}}`(pending) | `{{st('last')}}` / `{{st('pending')}}` | 读 `.chat.snapshot.jsonl`（lorebook 同款数据源） |

**第三档 产品语境常量（不用脚本，用 1v1 语境规则）**：
`{{group}}`→空串、`{{groupNotMuted}}`→空串、`{{notChar}}`→空串、`{{charIfNotGroup}}`→`{{st('char')}}`。

**真死角（明确放弃，剔除+审计行，原文留槽）**：`{{original}}`、`{{pipe}}`（STScript 内部流水语境，无处可还）；`{{model}}`（宿主运行模型，卡脚本不可触及——除非日后宿主把模型写进快照）；`{{input}}` 仅发送期 pending 面可取，其余语境（载入/开场预览/书重扫时）缺失，记半弃。半支持记偏差：`setvar/getvar` 只做"求值顺序读写 vars.json"，ST 的 stabilization/延迟重映射编序不做等价。
**勘误更正（施工期复核 ST 语义）**：`{{charFirstMessage}}/{{greeting}}/{{greeting::N}}` 在 ST 里是**静态卡数据**（macro registry 返回 `data.first_mes`/`alternate_greetings[N]`），归**烘焙档**而非剔除——上稿勘误一节的"自引用无处安放"判断撤回；烘焙在草稿填装语义下的代价是引用文本字面进入提示词、玩家若再选同一开场文即出现一次重复，与 ST 行为同构，可接受。

## 引擎配套（复审后：一件新增、一件已存在、一处常量上调）

1. **stdout 一层重扫（唯一新增件）**：`renderPlaceholders` 对脚本 stdout 再求值一轮（深度限 1），书条目里翻译出的 `{{st(...)}}` 在插入 section 前被解掉；重扫产物同样进 memo 防环；失败 → failure row，不静默。
2. **记忆化已存在，不是新增件**：`renderPlaceholders` 的 `memo`（`prompting.ts:313,330-336`，注释原文 "Identical tokens inside one render resolve once"）。复审前把它列为方案新增件是错的。语义差异照记：ST 每次出现重掷，我们同 token 一装配一值——`pick` 语义免费复现，`random/roll/time` 一装配内恒定。
3. **spawn 预算上调（新方案件）**：`MAX_PLACEHOLDER_SPAWNS = 8`（`prompting.ts:84`）是每 renderPlaceholders 调用一份预算——system 每装配、postPrompt 每提交各一渲。导入卡 setvar 族（键多且各异、memo 不去重）会撞 `limit` 失败行。方案含常量上调（建议 24，终值施工定）；`prompting.ts` 是 packages/engine 自家文件非 lib/ 内核，可直接改。Rappa 复算：lorebook + st('user') + st('char') = 3，余量足。

## 客户端开场契约（复审重写）

**开场的产品语义 = 草稿填装快捷键**：点击 greeting 只是 `updateDraft(text)`（`TavernApp.tsx:1655-1663`），玩家手按发送；文本从头到尾是**用户面文本**，引擎对玩家提交内容不做任何占位符渲染（`index.ts:833-838` 原样入会话）。渲染只发生在两处：system 装配（`prompting.ts:507+`）与 postPrompt 提交（`index.ts:827-832`，渲染产物经 postStash 入**模型上下文**，永不入 durable 聊天记录——此前方案里"postPrompt 渲染结果成为 durable 消息"的表述是错的）。

由此：
- 替换时机 = **点击装 draft 之前**客户端替换（三键：`st('user')/('persona')/('char')`，读同一 persona 文档 + meta.json；按钮常驻文案同表替换纯为预览美感）；`time/roll` 类在预览文案保持原样的局限依旧（用户面不渲染，本就无炸面）；
- 玩家若原样转发含 token 的文本，落进用户消息 = 字面量无害（kernel 不插值用户消息）。

## 值源与 persona.md 契约变更

`runtime/persona.md` 定型为 YAML frontmatter `name:` + 正文=人格描述；播种器兼容旧文件（无 frontmatter = 整文即描述，`user` 空串）。`{{user}}` 无名字 → 空串，不猜代词，审计行披露。**persona.mjs 退役**：导入器不再生成（存量卡的 `{{persona()}}` 走脚本注册表照常工作）；`st-import.ts` 脚手架注释一并修正（现教裸 `{{persona}}`，与权威文档打架）。

## 导入审计（三本账）

报告行三列：**翻译 N**（逐宏族计数）、**烘焙 M**、**剔除 K**（真死角逐宏列名）——加既有 system 位/key_region 缺位等行。无静默丢弃；`st`/`fy` 槽保真可回溯。

## 测试计划

- st-import：分箱矩阵（三档各抽查 + 死角剔除 + 审计行三本账 + `<BOT>` 旧标记）；ST/风月双方言回归。
- prompting：stdout 重扫（嵌套深度/失败上行不静默）；记忆化（同 token 一 pass 一值）。
- ui：开场预览 get 三键替换契约 × persona.md frontmatter 兼容旧文件。
- ui：开场**点击装 draft 前替换**契约（三键 × persona.md frontmatter 兼容旧文件）；spawn 预算上调后的 setvar 重卡回归。

## 复审勘误（2026-09-27 第二轮，逐条对码）

1. **记忆化已存在**（`renderPlaceholders` 的 `memo`）——复审前列为新增件是错的；
2. **greeting 语义重定**：草稿填装快捷键（`updateDraft`），非"AI 开场消息"——`st('greet0')` 整项撤销入死角，postPrompt"durable"旧表述一并纠正；
3. **spawn 预算 8 顶棚此前漏算**——方案新增常量上调件（setvar 重卡会撞 limit）；
4. **基础面复核通过**（方案站住的承重墙）：调用名≡文件名由 `evalToken` 按文件查证强制（`prompting.ts:273-274`，无注册表）；参数语法原生支持引号/转义/嵌套（`:232-253`，`{{st('roll','d20+2')}}` 直接可写）；`readText` 是整工作区栅栏面（`index.ts:1289`），客户端读 `runtime/persona.md`/`meta.json` 无障碍；脚本 spawn 显式全开放（`tools.ts:130` trustedScriptPolicy），`st('set')` 写 `runtime/vars.json` 可行；脚本 cwd=`runtime/`，`../preset/` 相对路径persona.mjs 已有先例。

## 真不做什么

不建 ST 宏运行时；不为自引用家族保存 canonical card；不建群聊；opening.html 不解析；不做 ST 的 stabilization 编序等价；greeting 预览不做 time/roll 客户端求值。

---

## 附一：2026-09-27 战测与裁定（docs/test_cards 十份真实样本）

战测语料存放**仓库外**：`~/Desktop/dsh-test-cards/`（不跟踪进 git；曾短暂入库后移出，见 7602978 入库记录）。内容：四张 ST 卡（PNG×3+JSON×1，折叠 json/png 全等）、一张真风月卡、两包正则脚本、一份 ST 设置导出、一份风月卡世界书解析正主 `chat_core.py`。裁定与落地（**均已随兼容批落地**，全套 499/499 绿）：

1. system 位重建 → 先不支持（恒不命中+报告行）；
2. AND 组合键 → 支持：fold 落 `mode:"and"`，`lorebook.mjs` v1.6 全含判定；
3. kinds 集合>1 只扫最近一条 → 维持现逻辑；
4. key_region 缺位 → 不触发（对齐 chat_core `_parse_region(0)` 空集语义）；
5. value_region 塌缩 postPrompt → 维持；
6. CG 远期记档：CSS 承载图 + LLM 产出带 CSS 类 HTML（不照搬"[图片:url]"），未建机制；
7. 双方言并存实证 + `isFengyueCard` 收紧（`pre_prompt` ∧ 三特征任一）；
8. 空壳/正则包拒收防线（九卡复跑 4+1 OK、2 专属文案拒、1 拒）。

## 附二：为什么不选"渲染器内置宏族"（终案对比备忘）

内置全家族需要运行时持有原始卡字段（canonical card）——折叠架构刻意不存；setvar 族需要编排语义与第二套状态机制（与 state.md 家法竞争）；group 族在本产品无语境。折叠期手里恰好握有全部静态值与全部翻译信息，脚本机械又恰好握有全部运行时能力——B 路（边界翻译）两头的便宜都占。
