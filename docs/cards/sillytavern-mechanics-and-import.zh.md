# SillyTavern 机制盘点与酒馆卡解析映射

2026-09-14。本文盘点 SillyTavern（下称 ST，参照本地 `/Users/wolf/Desktop/learn_code/SillyTavern-release` 1.18.0）的卡片格式、世界书、正则、提示词装配等机制，并回答两件事：① 我们的酒馆引擎要解析 ST 卡需要做什么；② `preset/scripts` 与自定义 JS 能对 ST 哪些功能对齐、哪些必须另走 seam。机制权威在 ST 源码（`src/character-card-parser.js`、`src/validator/TavernCardValidator.js`、`src/endpoints/characters.js`、`public/scripts/world-info.js`、`public/scripts/extensions/regex/engine.js`、`public/scripts/openai.js`）；我方架构权威在 [design.zh.md](../architecture/design.zh.md)、[scripts-and-tools.zh.md](../architecture/scripts-and-tools.zh.md)、[card-presentation.zh.md](../cards/card-presentation.zh.md)。**字段与功能的逐项精确映射（含注入位置退化、世界书能力边界修正）见 [st-card-field-mapping.zh.md](../cards/st-card-field-mapping.zh.md)，本文的「解析/scripts 对齐」小节以该文为准。**

## ST 卡片格式

一张 ST 卡是两种容器之一：`.json` 文本，或 **PNG 图片把卡 JSON 内嵌进 tEXt chunk**（base64）。解析入口 `character-card-parser.js` 的 `read()`：抽出所有 `tEXt` chunk，优先找 keyword `ccv3`（V3），次之 `chara`（V2），base64 解码出 JSON；两者都没有则抛「No PNG metadata」。1.18 核心**只读 PNG**（不读 webp/jpeg 内嵌元数据）；封面图就是这张 PNG 本身（同时当头像）。

卡 JSON 有三个规范版本，判定权威在 `TavernCardValidator.js`：

| 版本 | 判定 | 字段位置 |
|---|---|---|
| V1 | 无 `spec`，顶层含 `name/description/personality/scenario/first_mes/mes_example` | 顶层；创作者备注字段叫 `creatorcomment` |
| V2 | `spec === 'chara_card_v2'` 且 `spec_version === '2.0'` | 顶层 `spec` + **`data.*`** |
| V3 | `spec === 'chara_card_v3'` 且 `3.0 ≤ spec_version < 4.0` | `data.*`（V2 的超集，常带 `character_book`、`extensions.regex_scripts`） |

ST 把 V1/V2/V3 都归一化到 V2 规范形（`characters.js` 的 `getCharaCardV2`/`convertToV2`/`charaFormatData`）。我们解析也应先归一化到同一规范形，再做字段折叠。

V2 规范形全字段（`char-data.js` typedef + `charaFormatData`）：

```
data.name / description / personality / scenario / first_mes / mes_example
data.creator_notes / system_prompt / post_history_instructions
data.tags[] / creator / character_version / alternate_greetings[]
data.character_book { name, entries[] }              ← 角色自带世界书
data.extensions {
  talkativeness, fav, world, depth_prompt{depth, prompt, role},
  regex_scripts[]                                     ← 角色正则脚本
  chub / risuai / sd_character_prompt / ...           ← 第三方非标准字段
}
顶层残留：creatorcomment（V1）、chat、avatar、create_date、json_data（V1 迁移用）
```

## 字段语义与提示词装配顺序

ST 的「系统提示词」不是单块，而是**一段有序、可各自开关/编辑的 section 栈**。OpenAI 兼容路径的装配顺序（`public/scripts/openai.js:1358` `preparePromptsForChatCompletion`）：

1. `worldInfoBefore` — 世界书「角色前」注入
2. `worldInfoAfter` — 世界书「角色后」注入
3. `charDescription` — `data.description`
4. `charPersonality` — `data.personality`
5. `scenario` — `data.scenario`
6. `impersonate` / `quietPrompt` / `groupNudge` / `bias`
7. 扩展注入：summary（总结）、authorsNote（作者注）、vectors / smartContext（向量记忆）
8. `personaDescription` — 用户人格（见下）
9. 主系统提示词（`data.system_prompt`）+ 越狱（`data.post_history_instructions`）→ 对话历史

字段语义（对应「等价折叠」时每个字段该去哪）：

| 字段 | 语义 | 我方落点 |
|---|---|---|
| `description` | 角色人设（persona） | meta.desc + systemPrompt「人设」段 |
| `personality` | 性格 | systemPrompt「性格」段 |
| `scenario` | 场景/背景 | systemPrompt「场景」段 |
| `first_mes` | 开场白（首条 assistant 消息） | 开场消息（当前无此机制，需补） |
| `mes_example` | 对话示例（few-shot） | systemPrompt「对话示例」段 |
| `creator_notes` | 创作者备注（也参与世界书/向量匹配） | systemPrompt「创作者备注」段 |
| `system_prompt` | 主系统提示词 | systemPrompt「系统指令」段 |
| `post_history_instructions` | 越狱/后置指令 | systemPrompt「越狱」段（或 postPrompt 做更强每回合注入） |
| `alternate_greetings[]` | 可滑动的备选开场白 | 存档（我们无 swipe，只取 first_mes） |
| `tags[]` | 标签/分类 | meta.tags（需扩 meta） |
| `depth_prompt` | 总结提示词（`extensions.depth_prompt`） | 无落点（见「总结」） |
| 封面（PNG 字节） | 封面/头像 | `preset/` 资产 + meta.cover |

## 世界书机制（World Info / Lorebook）

ST 世界书分**全局世界书**（用户库，作用于所有角色，`world_info` 对象）与**角色书**（`data.character_book`，随卡携带、只作用于该角色）。两者 entry 结构相同，差异只在作用域与注入顺序策略（`world_info_insertion_strategy`：`evenly=0` / `character_first=1` / `global_first=2`）。

entry 字段（`char-data.js` typedef）：

- `keys[]` / `secondary_keys[]` — 主/次触发关键词（`use_regex` 时按正则、否则按词）
- `content` — 命中后注入的正文；`comment` — 人类备注
- `constant` — 恒定注入（不参与匹配，永远生效）
- `selective` + `selectiveLogic`（`AND_ANY=0`/`NOT_ALL=1`/`NOT_ANY=2`/`AND_ALL=3`）— 多 key 的选择性逻辑
- `position`（`world_info_position`：`before=0`/`after=1`/`ANTop=2`/`ANBottom=3`/`atDepth=4`/`EMTop=5`/`EMBottom=6`/`outlet=7`）— 注入位置；V2 卡里常只写 `before_char`/`after_char`（`characters.js` 的 `convertWorldInfoToCharacterBook` 把 `position==0` 翻成 `before_char`、否则 `after_char`）
- `insertion_order` — 同位置多 entry 的排序
- `extensions`：`exclude_recursion` / `prevent_recursion` / `delay_until_recursion`（递归抑制）、`depth`（扫描深度）、`scan_depth`、`probability` + `useProbability`（概率注入）、`group` / `group_weight` / `group_override` / `use_group_scoring`（分组计分）、`case_sensitive` / `match_whole_words`、`role`、`automation_id`、`vectorized`、`display_index`、`match_persona_description` / `match_character_description` / `match_character_personality` / `match_character_depth_prompt` / `match_scenario` / `match_creator_notes`（决定扫描哪些非消息文本）

运行时语义（`world-info.js` 的扫描器）：请求前把最近 N 条消息（depth 决定 N）拼成扫描缓冲 → 对每个非恒定 entry 用正则/词匹配 keys、累计主/次 key 命中分 → 按 selectiveLogic 判定是否激活 → 恒定/激活的 entry 按 position + insertion_order 注入提示词。全局开关：`world_info_budget`（条数预算）、`world_info_recursive`（递归激活）、`world_info_min_activations`（最少激活数）。

与我们的差异：我们**没有请求时扫描注入**机制。`{{script}}` 是模板注入（静态占位符 → bash stdout），不是「扫消息 → 命中才注入」。等价路径见「scripts 对齐」。

## 正则机制（Regex Scripts）

`data.extensions.regex_scripts[]`，entry 字段（`char-data.js` typedef）：

- `findRegex` / `replaceString` — 正则查找/替换（`replaceString` 支持 `$1`/`$<name>` 捕获组、`{{match}}` → `$0`、末尾再过一次 `{{...}}` 宏替换）
- `trimStrings[]` — 从捕获的 match 里再裁掉的字符串
- `placement[]` — 作用于哪条流（`regex_placement`：`MD_DISPLAY=0` 已弃用、`USER_INPUT=1`、`AI_OUTPUT=2`、`SLASH_COMMAND=3`、`WORLD_INFO=5`、`REASONING=6`；`4` 是旧 sendAs）
- `markdownOnly` / `promptOnly` — 见下
- `runOnEdit` — 是否在编辑消息时也跑
- `substituteRegex`（`substitute_find_regex`：`NONE=0` 原样 / `RAW=1` 先宏替换再用 / `ESCAPED=2` 宏替换+转义再用）
- `minDepth` / `maxDepth` — 深度门控
- `disabled` — 停用

应用语义（`engine.js` `getRegexedString`）——关键的两个正交轴：

| 轴 | 取值 | 含义 |
|---|---|---|
| placement | USER_INPUT / AI_OUTPUT / WORLD_INFO / REASONING | 改哪条流 |
| markdownOnly / promptOnly | markdownOnly | 只改显示（Markdown 渲染），不进提示词 |
| | promptOnly | 只改提示词（发给 LLM），不改显示 |
| | 两者都 false | 显示和提示词都改（走「生成」路径，因为聊天历史源头已改过） |

所以「对 assistant 的改写」分三种：**只改显示**（markdownOnly）、**只改下轮发给 LLM 的内容**（promptOnly）、**两者都改**（默认）。正则脚本默认有**首次启用授权门槛**（`extensions/regex/index.js` 的 allow/disallow 弹窗）。

## 其他机制

- **Personas（用户人格）**：与角色分离的「用户自己」设定（name + description），可放提示词内（`IN_PROMPT`）或作为独立消息；世界书可 `match_persona_description`。我们无等价物（写者即玩家）。
- **总结 / depth_prompt**：ST 在上下文接近上限（默认 80%）自动把旧历史压成摘要（Tavern Extras「Summarize」），摘要指令 = `extensions.depth_prompt`，**卡作者可定制**。我方有 `compaction-basic`（默认 `thresholdRatio=0.8` 自动压缩 + overflow 恢复 + `/compact`），但摘要指令是引擎写死模板（`summarizer.ts`），**卡不参与**——所以 `depth_prompt` 无落点，需单独给 compaction 开「卡自定义摘要指令」口子才能对齐。
- **Author's Note（作者注）**：一段浮在固定深度的提示词（`2_floating_prompt`），可插在任意 depth。近似对应我方 postPrompt 或 systemPrompt 的某一段。
- **记忆 / 向量 / 智能上下文**：Tavern Extras 摘要、Vectors、ChromaDB——长程记忆。我们以 `runtime/` + 尾代理承担「世界状态」，机制不同。
- **宏 `{{...}}`（substituteParams）**：`{{char}}`/`{{user}}`/`{{persona}}`/`{{original}}`/`{{random}}` 等是**文本替换宏**，不是代码执行。注意：我们的 `{{script(args)}}` 是**执行 bash**，语义不同——ST 的文本宏≈纯字符串替换，我们的≈脚本调用。
- **STscript / Quick Replies / 斜杠命令**：一条用 `/` 和 `|` 管道串起的命令 DSL，能读写变量、调用内部 API、执行 `/run`。这是 ST 的「脚本」主体。
- **扩展插件 JS**：`public/scripts/extensions/third-party/*/` 是**全可信 JS**，注入主文档，能改任何 DOM、挂任何 UI。这是 ST 的「自定义 JS」主体。
- **UI 定制**：消息内 HTML + `<style>`（scoped 到 `.mes_text`）、creator_notes `<style>`（授权后全局）、Custom CSS（全局）。详见 [card-presentation.zh.md](../cards/card-presentation.zh.md) 上游参照节。

## 我方三面映射框架

我方对「脚本/自定义能力」有清晰的三面，对应两条不变量（权威在 [card-presentation.zh.md](../cards/card-presentation.zh.md) 与 [scripts-and-tools.zh.md](../architecture/scripts-and-tools.zh.md)）：

| 面 | 位置 | 不变量 | 现有 seam |
|---|---|---|---|
| A 模型可见派生 | host，装配点/提交点/fork 点 | `模型可见 ⟺ 已记录` | `{{script}}`（systemPrompt 装配、prefix/post 提交、maintenancePrompt fork） |
| B durable 改写 | host，消息准入点 | `模型可见 ⟺ 已记录` | 无 |
| C 显示投影 | client，渲染层 | `display = f(log, workspace)` | 面板/主题/布局 + 主文档脚本层（`sdk`，card-presentation 定案） |

ST 的机制按此三面归类：

- 世界书触发注入、promptOnly 正则 → **面 A**（理论可被 scripts 覆盖，前提补「脚本读最近 N 轮 transcript」输入）。
- 「改下轮 LLM 内容且跨轮一致」的正则（AI_OUTPUT + promptOnly/默认）→ 最该落在**面 B**（assistant 消息落盘前改写），否则只能用面 A 的确定性纯函数在每请求重算，脆弱。
- markdownOnly 正则、CSS、布局、DOM → **面 C**（客户端），`preset/scripts`（host bash）物理上够不到。

## 解析 ST 卡需要做什么

1. **探测容器**：`.json` 直接读；PNG 用 `file.arrayBuffer()` + 一个约 40 行的 chunk 解析器（签名 + 逐 chunk 读 `tEXt`，找 `ccv3`/`chara`）取内嵌 JSON，封面 = 这张 PNG 字节。
2. **归一化**：按 `TavernCardValidator` 判 V1/V2/V3，统一归一化到 V2 规范形（V1 的 `creatorcomment`→`creator_notes`、`data.*` 折叠回顶层、`alternate_greetings` 字符串→数组）。这部分照抄 `getCharaCardV2`/`charaFormatData` 语义，用 TS 重写。
3. **折叠字段**：按「字段语义」表把文本字段折进我们的四提示词文件；`first_mes` 落到开场消息（需补机制）。
4. **世界书 / 正则**：见下「scripts 对齐」，先把原始 `character_book` 与 `regex_scripts` **原样存进 `preset/st-card.json`**（只读底账，信息不丢、日后可无痛重折叠）。
5. **封面**：PNG 字节落 `preset/` 资产 + `meta.cover`；复用既有 `writeAsset` RPC（base64 → fenceIn `preset/`）。
6. **meta 扩字段**：`tags`。`readCardMeta`/客户端 `serializeMeta` 两侧同步。
7. **解析位置**：延续「浏览器侧读文件 → 文本表跨 RPC」契约（[devlog.zh.md](../notes/devlog.zh.md) 导入流）；PNG 解析也在浏览器侧，`commitImport` 只收文本、封面走 `writeAsset`（或给 `commitImport` 加可选 base64 封面字段）。

## scripts / 自定义 JS 与 ST 功能的对齐边界

`preset/scripts`（host bash）能对齐的只有**面 A**；输入原语（TavernContext：runtime 文件 + 双视角历史 + 环境，快照对一次执行固定）已定案（见 [card-presentation.zh.md](../cards/card-presentation.zh.md)「统一上下文」，未实现）：

- **世界书触发**：TavernContext 快照就绪后，脚本自取 `TAVERN_CONTEXT_FILE` 或 `{{lorebook(ctx.chat.llm_view)}}` 传参做关键词扫描/注入；budget/recursion/probability/group 由卡自行实现或后续专用 seam。
- **promptOnly 正则**：装配点脚本可做「请求派生式改写」；TavernContext 快照对一次执行固定，纯函数性质与跨轮确定性由快照保证。
- **markdownOnly 正则 / CSS / DOM**：宿主面 bash 够不到（无浏览器上下文），由前端脚本层与渲染管线承担（内容改写钩子仍是后续 seam；交互面板已定案主文档 JS + SDK）。

结论：

| ST 功能 | 对齐面 | 结论 |
|---|---|---|
| 世界书（恒定条目） | 面 A | ✅ 直接折进 systemPrompt |
| 世界书（触发条目） | 面 A | ✅ TavernContext 就绪后脚本自取 ctx 文件或 `{{lorebook(ctx.chat.llm_view)}}` 传参；budget/递归/概率由卡自行实现或后续专用 seam |
| 正则 promptOnly | 面 A/B | ⚠️ 面 A 纯函数可做（ctx 快照保证确定性）；跨轮一致应落面 B（消息准入改写 seam） |
| 正则 markdownOnly | 面 C | ❌ 客户端 seam，非 scripts |
| CSS/布局/DOM | 面 C | ❌ 客户端 seam |
| `depth_prompt` 总结指令 | — | ❌ 引擎固定模板，需开「卡自定义摘要指令」口子 |
| 文本宏 `{{char}}` 等 | 面 A | ✅ 与 ctx 合流：`{{ctx.env.*}}` 等纯求值零 bash，ST 宏的轻量语义由渲染层直取快照承担 |
| 扩展插件 JS / STscript | 面 C | ✅ 主文档 JS + SDK 定案（见 card-presentation_zh.md，ST 扩展同款形态）；STscript DSL 不移植，bash + JS 覆盖，Quick Reply = 面板按钮 |

## 分期建议

| 期 | 内容 | 内核改动 |
|---|---|---|
| PR1 | PNG 解析 + V1/V2/V3 归一化 + 全文本字段折叠 + 封面 + `st-card.json` 底账 | 零 |
| PR2 | 恒定世界书条目入 systemPrompt + 触发条目入 runtime + meta.tags + first_mes 开场消息 | 零 |
| PR3 | TavernContext 快照注入（env 临时文件）+ 表达式语法 v2（`ctx.` 变量/函数/嵌套）+ `tavern.runScript` RPC | 零（shell seam 按请求 env 已支持） |
| 后续 | 世界书扫描注入 seam / 消息准入改写 seam / 正则 markdownOnly 半边 / 卡自定义摘要指令 | 需内核级 seam，单独决策 |

## Known Limitations

- ST 世界书与正则是**专用运行时机制**（扫描/计分/改写流），我方以 `{{script}}` 模板注入近似，语义等价度见上表；正则脚本默认不兼容（[card-presentation.zh.md](../cards/card-presentation.zh.md) 已有结论）。
- 1.18 核心只读 PNG 内嵌元数据；webp/jpeg 内嵌卡不在解析范围。
- `alternate_greetings`（滑动开场）无对应机制，仅存底账。
- `depth_prompt` 无落点：我方 80% 压缩的摘要指令是引擎固定模板，卡不参与。
