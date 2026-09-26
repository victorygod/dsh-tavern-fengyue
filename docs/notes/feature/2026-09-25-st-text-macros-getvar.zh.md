# Agent Note：ST 文本宏翻译期封装（get_var）+ runtime 变量文档

Status: draft — 方案已对齐,待实现。不改渲染器语法契约;导入器新增宏翻译;引擎/客户端各加一档只读消费。

中文

## 问题

酒馆卡的字段里普遍埋着文本宏(`{{user}}` / `{{char}}`,偶尔 `{{persona}}`)。当前链路:

- **导入侧**：原样保留(`st-import.ts` 全程 `str()` 直搬,与 ST 导入侧同一哲学——不替换、不清洗)；
- **卡层渲染器**：语法契约是「占位符 = 唯一一种东西：脚本调用」，裸 `{{name}}` 废弃、显式静默保持字面量（`prompting.ts:200-204`）；
- **kernel 严格插值层**：对穿过来的**任何** `{{...}}` 组（不分有没有括号）做收紧校验，未注册名直接 throw（`@deepseek-ai/dsh-system-prompt` 的 `interpolate`）。

三者拼起来:导入酒馆卡后,systemPrompt 段里的裸 `{{user}}` 会撞 kernel → `unknown prompt variable` → **回合装配失败**;world 书条目经 `lorebook()` stdout 拼进 prompt 的同样炸;greetings/opening.html 不经过渲染器,字面量直接端给玩家。同型事故在案:`docs/notes/devlog.zh.md:282`(裸 `{{...}}` 撞内核插值层 → turn/end error)。

`docs/cards/st-card-field-mapping.zh.md:181` 早就许了愿——「文本宏 `{{char}}`/`{{user}}` → **脚本承担** ✅」——但从未落地,且 `st-import.ts:322` 生成的 persona.mjs 注释教卡作者写**裸** `{{persona}}`,与权威文档的 `{{persona()}}` 互相矛盾。

## 调研（SillyTavern-release 1.18.0）

- ST 导入侧同样**原样入库**（`charaFormatData` 直接 `_.set`，`characters.js:579-626`），无导入期替换选项。
- 替换全在渲染端懒执行:`baseChatReplace` → `substituteParams` → 宏注册表（新引擎 `MacroRegistry.registerMacro(name, {handler})`,handler 是内置闭包）。分档:
  - 纯字符串:`{{user}}`=Persona 名(name1)、`{{char}}`=角色名(name2)、`{{persona}}`=Persona 描述文本、`{{description}}` 等字段引用;
  - 计算带参:`{{random:a;b}}` `{{roll:d20}}`(内置函数吃参数,`::`/`;` 分隔);
  - 有状态:`{{setvar::k::v}}`/`{{getvar::k}}`(聊天作用域存储)。
- **ST 的宏层没有「裸 token → 调用卡作者脚本」机制**;可编程能力在另一层(STScript/正则扩展)。我们退役的正是那一层;我们的 `{{script(args)}}` 扮演它的角色,宏层不该与其合并。
- 顺序学:ST 递归有序,字段引用先、user/char 最后替换(防递归)。

## 决策一：翻译期封装,不做渲染器内置宏表

**导入折叠时,把白名单内的 ST 文本宏改写成我们的脚本调用形态**;渲染器对裸 `{{name}}` 的「废弃保持字面量」契约原封不动(我们自己的卡禁止裸形态,导入卡是翻译边界——与世界书→lorebook.mjs+scan.kinds 同一性质的翻译)。

备选「渲染器加内置文本宏表」被否,四条理由:

1. 本方案实现的是映射文档 181 已拍板的「脚本承担」,不是新规则;
2. 保住 09-15「唯一语法」契约**双向**:裸形态对我们自己的卡继续非法,翻译只发生在导入边界;
3. 更 doc-first:卡文档里白纸黑字写着 `{{get_var('user')}}`,机制可读;内置表是运行时隐式认词;
4. 渲染器零改动(除下文 stdout 重扫一条)。

## 决策二：runtime 变量文档 = 值的唯一来源

**`runtime/persona.md` 定型:YAML frontmatter 的 `name:` 字段 + 正文 = Persona 描述。** 玩家仍编辑这一个文档,setup 播种照旧。解析契约:frontmatter 进快照,正文为描述——persona.mjs 时代「整文件即描述」随之退役。

`{{char}}` 是**卡侧静态**值,不落 runtime 文档(两处真源必漂移),渲染时直读 `preset/meta.json` 的 title。与 ST 对称(玩家侧 name1/persona,卡侧 name2)。

## 决策三：get_var 单脚本三键

导入器生成 `preset/scripts/get_var.mjs`(取代现 persona.mjs 的职责):

- `get_var('user')` → frontmatter `name`;
- `get_var('persona')` → 正文;
- `get_var('char')` → `../preset/meta.json` 的 title(cwd=runtime/)。

一份文档、一个脚本、一个翻译动作闭环。键集白名单就是上面三个+后续可议扩展,表外不扩。

## 翻译覆盖面

| 位置 | 处理 |
|---|---|
| systemPrompt 各段(composeSystemPrompt 产出) | 翻译 |
| postPrompt(含 `{{lorebook()}}` 座外的正文) | 翻译 |
| `first_mes` / `alternate_greetings` → greetings.json | 翻译(配合客户端契约,见下) |
| 世界书条目 content → lorebook.json | 翻译 |
| `mes_example` | 翻译 |
| `description` → `preset/setup/opening.html` | **不翻**(iframe 无求值器,翻了字面量更难看);报告行提示 |
| 白名单外的一切宏(`{{random}}`/`{{setvar::…}}`/…) | 不翻;原样+导入报告「宏审计」行 |

翻译只动**白名单三员**;naive 全量改写等于把 ST 配置语言招回来,不做。

## 客户端预览契约

开场选项按钮是客户端直读直显(`card-ui.ts:258-271`),不经过任何渲染器。契约:客户端开场页渲染 greetings 前,读 `runtime/persona.md`(frontmatter)与 `meta.title`,对文本做同表替换——**只认一个形态** `{{get_var('key')}}`,键查上面三员,约 15 行纯函数,零新 RPC。(裸 `{{user}}` 不认——那是外来习语,翻译后不存在。)

## 稳定性收口（本批一并）

1. **stdout 引爆面**:脚本 stdout 不被渲染器重扫,而 kernel 对任何 `{{...}}` 组都收紧——`{{get_var('user')}}` 进 stdout 一样炸。方案:渲染器对脚本 stdout 做**一层**、深度受限的重扫(复用现有 depth guard);或 lorebook.mjs 模板对条目内容收尾处理后输出。二选一实现时定,但「stdout 里的 {{...}} 是地雷」必须收掉,**否则翻译只是把 `{{user}}` 换成另一个炸法**。
2. **未知裸 token 审计**:导入期扫描全部文本字段,报告单列「宏审计」行(认识几个、翻几个、剩哪些);不认识的维持原样。运行时炸 kernel 的风险由 1+2 合力收口。
3. **fan-out 去重**:同一段 prompt 里 `{{get_var('user')}}` 出现 N 次不展开成 N 个进程——导入期同 key 合并不可行(位置语义),接受并发小账;评估渲染器脚本调用缓存(process 级 memo,同 key 同参数同回合)。
4. **保真语义改口**:work-order 的「原文 verbatim 挂 `st` 槽」承诺修订为「原文挂 `st` 槽,宏已翻译」;翻译后的 token 集合记进导入报告,符合「无静默丢弃」。
5. **脚手架注释修正**:`st-import.ts:321-328` 教裸 `{{persona}}` 的注释改为 get_var 版;persona.mjs 下架或改为 get_var 别名。

## 同批查出：ST JSON 兼容债（复现矩阵实测）

对真实世界常见 JSON 形态逐个过 `parseTavernCard`(jsdom 实测,基线 19/19 绿):

| 形态 | 结果 |
|---|---|
| ST v2 spec 导出 / ST 真实导出(`getCharaCardV2`,顶层 v1+`data.*` 并存) | ✅ |
| V1 裸卡(顶层 `name`) / UTF-8 BOM 前缀 | ✅ |
| **Pygmalion 平铺**(`char_name`/`char_persona`/`world_scenario`/`char_greeting`/`example_dialogue`) | ❌ 报「不认识的卡格式」——ST 自己支持(`characters.js:929-956` 五字段映射),我们缺 |
| **顶层 `world_book` 数组的社区卡** | ⚠️ **静默劫持成风月方言**:error=null 但 description/first_mes 全丢、systemPrompt 空——「三方零重叠」前提(`st-import.ts:87`)在真实世界不成立,`world_book` 不是风月独占;违反 nothing-silently-dropped |
| 世界书导出 JSON(`{entries}`) / spec 在 data 缺 | ❌ 拒收(设计外),文案未指路 |
| GBK 字节 | 导入成功但中文 mojibake(可后议) |

**world_book 劫持是本批最阴的一条**,修复方向(待拍板,不在本 note 范围):`isFengyueCard` 收紧——风月判定要求 `pre_prompt` 在场,或按条目形状(`key_region`/`value_region`/`group` 位码键)而非字段名判定。

## 测试计划

- st-import:白名单宏翻译矩阵(三员各自落点+白名单外原样+审计行);world_book 收紧后的 ST 社区卡回归(第一方言优先)。
- prompting:stdout 一层重扫(嵌套深度上限、失败上报不静默)。
- ui:开场预览替换契约(greetings 含 `{{get_var('user')}}` × frontmatter 文档快照)。
- 新增端到端烟测:一张真 ST 卡(字段埋 `{{user}}`/`{{char}}`/`{{persona}}`)导入→回合跑通→开场按钮替换正确。

## 边界(不做什么)

- 不做完整 ST 宏引擎:函数宏(random/roll/setvar/getvar)、`<BOT>`/`<USER>` 旧标记一律不迁;`{{random}}` 归脚本(`$RANDOM` 语义已存在),setvar 类拒绝。
- 不给用户暴露「导入时把 {{char}} 烘成名字」之类选项(导入时玩家未知,语义上不可能)。
- greeting 预览不做 RPC 渲染(锁一档客户端只读契约)。
