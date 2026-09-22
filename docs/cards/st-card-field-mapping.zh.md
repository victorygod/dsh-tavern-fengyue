# 酒馆卡 → 我方卡：字段与功能严格映射

2026-09-15。本文是「一键导入酒馆卡」的前置分析：给出 SillyTavern 卡（下称 ST，V1/V2/V3）每一字段、每一运行时机制到我方卡的**逐项精确映射**——落点、精度、以及需改变我方实现方式的地方。目标是导入器据此无歧义地把一张 ST 卡折成我方卡，任何信息丢失都是**明示决策**而非遗漏。

精度图例：✅ 精确（语义等价，机制在位）｜⚠️ 近似（语义可承载但需退化或改实现）｜🤖 可复刻·需 agent 介入翻译（规则本体可翻译成我方脚本/JS，翻译本身无法纯代码生成；导入时把源料落进 `preset/st-import/` 翻译工作单，agent 消化后删目录）｜📋 TODO（本轮不迁移但明确记账待做，不是丢弃）｜❌ 不迁移（无对应物且无复刻意义：格式残料、纯展示状态等；丢弃项在导入报告里显式列明）。

延迟刷新的时机决策见 §9 分期。机制权威：ST 源码（`src/character-card-parser.js`、`src/validator/TavernCardValidator.js`、`src/endpoints/characters.js`、`public/scripts/world-info.js`、`public/scripts/extensions/regex/engine.js`、`public/scripts/openai.js`，参照本地 1.18.0）。内核调研证据：`packages/compaction/compaction-basic/src/summarizer.ts:31`（压缩指令写死常量）、`packages/core/agent-loop/src/assistant-stream.ts`（assistant 消息准入唯一入口）。我方权威：[design.zh.md](../architecture/design.zh.md)、[scripts-and-tools.zh.md](../architecture/scripts-and-tools.zh.md)、[card-presentation.zh.md](../cards/card-presentation.zh.md)。本文是对 [sillytavern-mechanics-and-import.zh.md](../cards/sillytavern-mechanics-and-import.zh.md) 的逐项精确化，映射关系以本文为准。翻译期操作规格（工作单 schema / 翻译菜谱 / agent 消化契约 / 导入报告）单独立档：[st-import-work-order.zh.md](../cards/st-import-work-order.zh.md)。

## 1. 容器与版本

| 容器 | 判定 | 处理 |
|---|---|---|
| `.json` | 文本即卡 | 直接读 |
| `.png` | tEXt chunk 内嵌 base64 JSON | 抽 chunk：优先 keyword `ccv3`（V3）、次之 `chara`（V2）；PNG 字节本身 = 封面 |

版本判定与归一化（权威 `TavernCardValidator.js`）：

| 版本 | 判定 | 归一化动作 |
|---|---|---|
| V1 | 无 `spec`，顶层含 `name/description/personality/scenario/first_mes/mes_example` | `creatorcomment`→`creator_notes`；`data.*` 折叠回顶层；`alternate_greetings` 字符串→数组 |
| V2 | `spec === 'chara_card_v2'` 且 `spec_version === '2.0'` | 基准形 |
| V3 | `spec === 'chara_card_v3'` 且 `3.0 ≤ spec_version < 4.0` | V2 超集，含 `character_book`、`extensions.regex_scripts` |

**第一步永远是归一化到 V2 规范形**（照抄 ST `getCharaCardV2`/`charaFormatData` 语义，TS 重写），后续所有映射都只针对 V2 规范形一个输入面。

## 2. 顶层字段映射总表

| ST 字段（V2 规范形） | ST 语义 | 我方落点 | 精度 |
|---|---|---|---|
| `data.name` | 卡名 | `meta.json.title` | ✅ |
| `data.description` | 角色人设 | `systemPrompt`「人设」段；另缩写一份进 `meta.json.desc`（书架展示） | ✅ |
| `data.personality` | 性格 | `systemPrompt`「性格」段 | ✅ |
| `data.scenario` | 场景/背景 | `systemPrompt`「场景」段 | ✅ |
| `data.first_mes` | 开场白 | **开场页选项**（拍板：放 `opening.html` 选项列表，点击填入输入框；§8.1 记录角色行翻转与 TODO 备选） | ✅ |
| `data.alternate_greetings[]` | 滑动备选开场白 | **同属开场范畴**：全量并入 `preset/greetings.json` 开场选项（ST 滑动 → 我方点击选开场，能力等价） | ✅ |
| `data.mes_example` | 对话示例（few-shot） | `systemPrompt`「对话示例」段 | ✅ |
| `data.creator_notes` | 创作者备注 | `systemPrompt`「创作者备注」段 | ✅ |
| `data.system_prompt` | 主系统提示词 | `systemPrompt`「系统指令」段 | ✅ |
| `data.post_history_instructions` | 越狱/后置指令 | **`postPrompt`（动态 post 注入消息）**——机制精确对位：ST 的 depth-0 注入本来就是「每回合新鲜渲染的独立 user 消息」，动态 post 即同款（旧回合的 post 影子化退场）；映射 §3 的 systemPrompt「越狱」段不再需要 | ✅（2026-09-16 wrap 退役后升级：靠 systemPrompt 段近似 → 独立消息精确对位） |
| `data.creator` | 作者名 | `meta.json.creator`（随 tags 同批扩 meta） | ✅ |
| `data.character_version` | 卡版本号 | `meta.json.version`（同上扩） | ✅ |
| `data.tags[]` | 标签 | `meta.json.tags[]`（**需扩 meta**，readCardMeta / serializeMeta 两侧） | ✅ |
| `data.character_book` | 角色自带世界书 | 恒定→systemPrompt 段；触发→`lorebook.json` + `lorebook.sh`（§4） | ✅ |
| `data.extensions.world` | 角色绑定的**全局世界书名引用** | 引用名不可解析（文件在 ST 用户库不随卡走）；导入记录缺失引用并提示（§4.4） | ⚠️ |
| `data.extensions.depth_prompt` | 总结提示词 | 卡自定压缩指令槽（tavern 内建文件合法，生效路径为 TODO，§8.3） | 📋 |
| `data.extensions.regex_scripts[]` | 角色正则脚本 | 按 placement 分流（§5）；可翻译部分 🤖 经工作单消化，不可译半边进导入报告明示丢弃 | 🤖 |
| `data.extensions.talkativeness / fav` | 非标准运行参数 | 丢弃（导入报告列明） | ❌ |
| `data.extensions.chub / risuai / sd_character_prompt / …` | 第三方专有数据 | 丢弃（面向其他前端，导入报告列明） | ❌ |
| 封面（PNG 字节 / V1 `avatar`） | 头像/封面 | **`preset/assets/cover.png`**（资产收录目录，见 §8.12）+ `meta.json.cover`（走 `writeAsset`，通道已在） | ✅ |
| 顶层 `chat` / `create_date` / `json_data` | 历史会话/迁移残料 | 丢弃（纯 ST 运行时状态） | ❌ |

## 3. 提示词装配顺序 → systemPrompt 段序

ST 的「系统提示词」是固定顺序的 section 栈（`openai.js:1358 preparePromptsForChatCompletion`）。导入 = **按同一顺序把这段栈拆散，折进我方 `systemPrompt` 一个文件**：

| ST 装配序 | 内容 | 我方落点 | 精度 |
|---|---|---|---|
| 1 `worldInfoBefore` | 世界书「角色前」注入 | `before_char` 恒定条目段（文件最前——恒定内容 → head 永不变化 → 前缀缓存全程有效）；**触发条目默认挂动态 post 尾注段（非此位）**（§4.2，2026-09-16 反转定案） | ⚠️ 位置退化 |
| 2 `worldInfoAfter` | 世界书「角色后」注入 | `after_char` 恒定条目段（人设段之后）+ 同上触发条目落 post 尾注段 | ⚠️ 位置退化 |
| 3 `charDescription` | `description` | 「人设」段 | ✅ |
| 4 `charPersonality` | `personality` | 「性格」段 | ✅ |
| 5 `scenario` | `scenario` | 「场景」段 | ✅ |
| 6 `impersonate/quietPrompt/groupNudge/bias` | 群聊/扮演机制 | 📋 TODO 群聊能力（已在 elf 项目有参考实现，重，后续单独做） | 📋 |
| 7 `summary` / `authorsNote` / `vectors` | 摘要 / 作者注 / 记忆 | 作者注→systemPrompt 段或 post 尾注段；摘要/向量→尾代理 runtime 承担（📋 TODO 长程记忆） | ⚠️ |
| 8 `personaDescription` | 用户人格 | ✅ 脚本承担（见 §6 Personas 行；ST 卡不携带 persona，导入仅搭脚本骨架） | ✅ |
| 9 `system_prompt` | 主指令 | systemPrompt「系统指令」段 | ✅ |
| — `post_history_instructions` | 越狱/后置（depth-0 注入） | **`postPrompt` = 动态 post 注入消息（同机制对位，见 §2 行）**——不再折进 systemPrompt | ✅ |

2026-09-16 拍板：`prefixPrompt` 退役——ST 导入的 `pre_prompt` + `post_prompt` **并入同一 `preset/prompt/postPrompt` 文件**（pre 前置、空行分隔，随「最后一个 user 轮后动态附加的 post 消息」每回合新鲜渲染，机制见 [dynamic-post-injection.zh.md](../runtime/dynamic-post-injection.zh.md)）。我方独有且导入后**恒空**的只剩 `maintenancePrompt`（空 = 尾代理默认关闭，留给玩家接手）。

## 4. 世界书机制

ST 世界书分**全局库**（用户级）与**角色书**（随卡）。角色书只认 `data.character_book`；全局库见 §4.4。

### 4.1 entry 字段映射

| ST entry 字段 | 语义 | 我方落点 | 精度 |
|---|---|---|---|
| `keys[]` | 主触发关键词 | `lorebook.json` `keys[]` | ✅ |
| `secondary_keys[]` | 次触发关键词 | 并入 `keys[]`（或独立字段，脚本自取） | ✅ |
| `content` | 命中注入正文 | `lorebook.json` `content` | ✅ |
| `comment` | 人类备注 | 丢弃（不参与匹配） | ❌ |
| `constant` | 恒定注入 | 折进 `systemPrompt` 静态段（`before_char`→人设前 / `after_char`→人设后）；亦可留 json 由脚本直通 | ✅ |
| `selective` + `selectiveLogic` | 多 key 组合逻辑 | 脚本条件分支，输入全在快照+json（**组合项可复刻**，导入器 v1 默认退化 OR-any，仅模板简化非机制上限） | ✅ |
| `position` | 注入位置 | 见 §4.3 | ⚠️ |
| `insertion_order` | 同位置排序 | `lorebook.json` 数组顺序承载 | ✅ |
| `extensions.probability` + `useProbability` | 概率注入 | 脚本 `RANDOM` 门 | ✅ |
| `extensions.depth` / `scan_depth` | 扫描深度 | 脚本 `tail -n N` 参数 | ✅ |
| 递归三件（exclude/prevent/delay_until_recursion） | 递归抑制 | 脚本多趟循环（**可复刻**，v1 模板不带） | ✅ |
| 分组计分（group/group_weight/group_override/use_group_scoring） | 分组计分 | jq 算分、组内取最高（**可复刻**，v1 模板不带） | ✅ |
| `case_sensitive` / `match_whole_words` | 匹配修饰 | `grep -i` / `grep -w`（**可复刻**，v1 模板不带） | ✅ |
| `role` / `automation_id` / `display_index` | 展示/自动化 | 丢弃（导入报告列明） | ❌ |
| `vectorized` | 向量匹配 | 📋 TODO 长程记忆（尾代理 runtime 摘要承担近似） | 📋 |
| `match_*`（扫描哪些非消息文本） | 扫描源开关 | 脚本读 `../preset/prompt/*`、`meta.json`（`match_persona_description` → persona 脚本文件） | ✅ |
| 全局 `world_info_budget` / `recursive` / `min_activations` | 全局开关 | 脚本计数/排序/截断参数 | ✅ |

**能力结论**：世界书扫描器**能力域 100% 可由脚本复刻**——同输入（`.chat.snapshot.jsonl` + `../preset` + `date` + `$RANDOM`）、同输出（stdout），且 `runtime/` 可留跨请求状态（超过 ST 原版的无状态单趟）。逐条差在「导入器生成模板写多精细」，不在机制。

### 4.2 运行时语义（脚本闭环）

```
玩家输入 → pending 玩家行先写进 runtime/.chat.snapshot.jsonl（post 渲染前必落盘）
  → systemPrompt 装配 → 渲染 {{lorebook()}}
      → spawn lorebook.sh（cwd=runtime/）
          tail -n N .chat.snapshot.jsonl → 拼 plain → 逐条匹配 keys
          → constant 直通 · 命中条目过 RANDOM 概率门 · 按插入序输出 content
  → stdout 替换进 systemPrompt → 请求发出
```

挂载点定案（2026-09-16 反转）——**触发条目默认挂 `postPrompt`（post 尾注段），`systemPrompt` 只留恒定条目**。依据内核路由事实（`agent-loop/tests/request-reconstruction.spec.ts:596-631`）：

- `deepseek-flash` 目录模型 = `systemPromptUpdate:'in-history'` capable 路由：systemPrompt 渲染变化时**不动 head、缓存前缀不变**，以**尾部 system 消息追加**进视图（`[…, aN, system(新), uN+1, …]`）——新内容进得来，但**旧内容出不去**（历次快照滞留视图，「本回合未命中=不注入」的 ST 退场语义失效，长会话累积）。
- 非 in-history 模型（v4 系默认路由）：变了才 head 原位替换，语义干净但每次变更缓存前缀失效。
- post 尾注段恰好补位：旧 post 影子化退场（每回合定时）= ST 退场语义；注入位置本就在最后 user 之后、视图天然在此分叉，**零额外缓存代价**；概率每条玩家提交一掷（stash FIFO 每 claim 各携各的 post——排队多条各格定，正合 ST 的每条玩家消息粒度）；pending 玩家行先落快照，当前输入照常可命中。

即：**恒定世界观进 systemPrompt（不变则零提交、前缀一路命中）；变化的世界触发进 post 尾注段**。

### 4.3 注入位置边界与退化（拍板）

占位符只在三张提示词文件，注入点三种。**拍板（2026-09-16）：所有深层位置一律退化到动态 post 尾注段**：

| ST `position` | 我方落点 | 精度 |
|---|---|---|
| `before_char`（=0） | `systemPrompt` 最前 | ✅ |
| `after_char`（=1） | `systemPrompt` 人设段之后 | ✅ |
| `atDepth k` / `ANTop` / `ANBottom` / `EMTop` / `EMBottom` / `outlet` | **退化到 post 尾注段** | ⚠️ 退化（拍板接受） |

退化根因是架构红线（无「user 轮之前/历史中间」的模型可见缝——DSH 的插件注入点只有 `agent/pre-step` 的最后 user 轮后附加，机制见 [dynamic-post-injection.zh.md](../runtime/dynamic-post-injection.zh.md)），不是脚本能力。深层位置字段保留在 `lorebook.json` 全字段里，日后若开「世界书扫描注入 seam」重折叠走重导入。

### 4.4 全局世界书（源码调研结论）

ST 侧事实（`public/scripts/world-info.js`）：

- 全局世界书 = **用户勾选的 lorebook 文件**（`selected_world_info`，存 settings 的 `world_info.globalSelect`，:66），作用于**所有角色**，与角色书合并进同一扫描池、共享全局预算（:1605-1611）。用途 = 跨卡共享的世界观设定集（一个宇宙、多张角色卡）。
- 卡对全局书的关联是**名字引用**：`data.extensions.world` 指向用户库里的一个世界书文件名，ST 选中该角色时自动激活它（:1127-1128）——**文件本身不随卡分发**。

我方落点：

| 项 | 落点 | 精度 |
|---|---|---|
| 全局世界书**机制**（用户级共享书库 + 全卡生效） | 引擎级小件：共享书库目录 + 工作空间级勾选合并进扫描池 → 📋 TODO（重，后续单独做） | 📋 |
| `data.extensions.world` 名字引用 | 导入报告 + 翻译工作单记「此卡想要名为 X 的共享世界书」，机制就绪后一键补挂 | ⚠️ |

## 5. 正则机制

**对「正则能否翻译成脚本逻辑」的直接回答：能。** `findRegex`/`replaceString` 规则本体 → `sed`/`perl`/jq 是机械可译的；真正的阻塞从来不是翻译，而是**钩子在不在**——改写结果要在正确的时机进入正确的流。已拍板：`AI_OUTPUT + promptOnly` 目前做不了（无准入钩子）；其余 placement 都有钩子或明确退化路径。

### 5.1 placement → 钩子分流

| placement | markdownOnly / promptOnly | 我方落点 | 精度 |
|---|---|---|---|
| `USER_INPUT`(1) | 默认（显示+提示词都改） | **忠实迁移路径已定**（2026-09-16 ST 语义查明）：ST 在落库前改写消息本身（`script.js:5816`）——durable 即改写后文本，显示/模型/存档恒同。我方对位 = `tavern.prompt` 转发前「提交期改写钩子」（卡脚本 stdin→stdout），durable 存改写后文本、显示同见；重试 draft 戳存原文、重发再过钩子，语义自洽。**钩子 = 📋 TODO 不急做**（§8.11）；落地前该 flag 类不进翻译工作单、报告 pending | 📋（机制已定形） |
| `USER_INPUT`(1) | promptOnly | ST 语义 = 存档显示原文、每轮组装时临时替换（`script.js:4447` isPrompt pass）。我方注记式近似：改写意图作为作者注记随动态 post 注入（模型可见、`source.kind=plugin` 显示过滤）——逐消息真替换需请求视图缝（已 revert） | ⚠️ |
| `AI_OUTPUT`(2) | promptOnly / 默认 | **面 B 消息准入改写 seam 未建**（assistant 消息由 agent-loop 准入，插件无钩子）→ 已拍板 v1 不做；📋 待内核面 B seam | ❌ |
| `AI_OUTPUT`(2) | markdownOnly | 面 C 渲染钩子（终版 PR5 评估） | ⏳ |
| `WORLD_INFO`(5) | 任意 | **静态烘焙**：ST 在注入时改写条目 content（`world-info.js:5086`）——content 是静态文本，导入时由翻译 agent 把 findRegex/replace 烘焙进对应条目（差异明示：不再每请求重跑） | ✅（2026-09-16 语义勘误：原「正则命中取代 grep -F」系误读） |
| `SLASH_COMMAND`(3) | 任意 | 无此流；QR 属脚本面按钮（§6） | ❌ |
| `REASONING`(6) | 任意 | 思考行是前端聚合流 → 显示半边随渲染钩子评估 | ⏳ |
| `MD_DISPLAY`(0，已弃用) | — | 丢弃 | ❌ |

### 5.2 entry 字段映射（规则本体）

| ST entry 字段 | 我方落点 | 精度 |
|---|---|---|
| `findRegex` / `replaceString`（`$1`/`$<name>`/`{{match}}`→`$0`/尾宏） | 脚本 `sed`/`perl`；尾宏走我方 `{{script}}` | ✅ 规则本体可译 |
| `trimStrings[]` | 二次裁剪 | ✅ |
| `substituteRegex`（NONE/RAW/ESCAPED） | 预处理序 | ✅ |
| `minDepth` / `maxDepth` | 脚本门控 | ✅ |
| `runOnEdit` | 我方历史不可编辑消息 | ❌ |
| `disabled` | 丢弃该条 | ✅ |

### 5.3 导入器的处置

可翻译的 regex_scripts **不自动生成脚本代码**：规则的语义正确翻译（含 markdownOnly 与 role 语境等边界）需要理解，由**导入期翻译 agent** 完成（🤖）。源料落 `preset/st-import/` 翻译工作单（工作单 schema / 翻译菜谱 / 消化契约见 [st-import-work-order.zh.md](../cards/st-import-work-order.zh.md)），agent 消化产物（preset/scripts、ui 按钮）并删除工作单目录。不可译半边（AI_OUTPUT promptOnly）直接进导入报告列明丢弃，不进工作单。

## 6. 其他机制

| ST 机制 | 我方落点 | 精度 |
|---|---|---|
| Personas（用户人格） | **✅ 脚本承担（拍板）**：`preset/scripts/persona.sh` + 玩家自写 `runtime/persona.md`，`{{persona()}}` 挂 systemPrompt。ST 卡不携带 persona → 导入仅搭脚本骨架 + 空文件，非卡内容迁移 | ✅ |
| 文本宏 `{{char}}`/`{{user}}`/`{{random}}` 等 | 脚本承担：`{{char}}`=meta.title、`{{random}}`=`$RANDOM`、`{{user}}`=persona 脚本 | ✅ |
| 总结 / `depth_prompt` | **内核调研结论**：压缩指令是 `compaction-basic/src/summarizer.ts:31` 写死常量，Config 无指令字段。tavern 内建第五提示词文件（如 `preset/prompt/compactionPrompt`）**本身合法**；但让它生效只有两条路：(a) tavern 自实现 compaction provider（capability seam 允许 provider 替换，但压力/检查点/溢出机器全套重写，重）；(b) 内核开「可插拔摘要指令」口子 → 📋 TODO | 📋 |
| Author's Note（任意深度） | 动态 post 尾注段（深度固定 = 最后 user 之后，任意深度不可达同 §4.3；与 AN 的「浮动独立消息」形态同型） | ⚠️ |
| 记忆 / 向量 / 智能上下文 | 尾代理 `runtime/` 世界状态（机制不同）→ 📋 TODO 长程记忆 | 📋 |
| STscript / Quick Replies / 斜杠命令 | **🤖 agent 辅助翻译（拍板）**：ST 是文本替换宏 + 命令 DSL。QR → 面板按钮 + DOM 回填（✅ 同构）；STscript 脚本 → bash（数据）+ `ui/index.js`（表现）+ 卡工具（副作用），由导入期翻译 agent 消化工作单后完成翻译（语法不兼容明示；STscript 调 ST 内部 API 的命令按意图映射，无对应者列进报告）。源料在 `preset/st-import/` 工作单内 | 🤖 |
| 扩展插件 JS | `mount(tavern)` 主文档 module，同型 | ✅ |
| 消息内 HTML + `<style>` | 渲染管线（micromark + DOMPurify + style 作用域化） | ✅ |
| creator_notes 全局样式（授权） | `theme.css` + 按卡授权 | ✅ 升级 per-card |
| Custom CSS / 主题 | `theme.css`/`chat.css` 双层 + layout.json | ✅ 超越（ST 无 per-card） |

## 7. 翻译工作单 `preset/st-import/`（一次性，消费后删除）

**拍板（2026-09-16）：不做永久底账。** 沉睡源料不值得在卡里常住——重折叠走**重导入**（原始卡文件永远在用户自己的 ST 库里），审计走**导入报告**（一次性列明丢弃项）。翻译 agent 需要的源料改走**一次性工作单**：

- **落**：导入器把「需要 agent 理解后翻译」的源料写进 `preset/st-import/`——`README.md`（工作单 + 导入报告）、`regex.json`（预分拣后的可译半边）、`stscript.txt`（原文留存）。文件 schema、README 模板与 agent 消化契约见 [st-import-work-order.zh.md](../cards/st-import-work-order.zh.md)。纯文件表产物，引擎 `commitImport` 零改动。
- **消化**：写卡 agent（已在位：每工作空间一个、cwd=工作空间根、shell 可用）按工作单逐项翻译为 `preset/scripts/*.sh` 与 `ui/index.js` 面板按钮，产出即普通卡文件；成功后**删除 `st-import/` 目录**——卡归净，无残留。写卡引导（`prompts/writer-guide.md`）补一节工作单消费约定。
- **不跑 agent 也自洽**：目录常驻可见、README 自解释，用户可手动处理或删除；换绑/发布随 `preset/` 复制，语义 =「这张卡还有翻译待办」。

`lorebook.json` 的定位独立于工作单：它是触发条目的**活跃数据文件**（脚本扫描的输入，卡作者可编辑，全字段保留）；工作单只承载「需要理解后翻译」的东西。

## 8. 需改变我方实现方式的地方（拍板汇总）

| # | 项 | 现状 | 改动 | 精度 |
|---|---|---|---|---|
| 1 | 开场：first_mes + alternate_greetings | opening.html 有「选项点击填入输入框」路径 | **✅ 已落地（2026-09-16）**：数据落点 `preset/greetings.json`（first_mes 在首、alternate_greetings 依次）+ 默认开场页选项按钮（点击填入 composer；缺文件/坏 JSON 静默回退）。导入器生成该文件仍属导入期。角色行翻转（角色台词由玩家发出）明示接受 | ✅（形态差异明示） |
| 2 | 真·首条 assistant 开场（备选） | **内核调研：`assistant/message` 由 agent-loop 准入（assistant-stream.ts），session 层无插件追加消息口子** | **❌ 不做（2026-09-16 用户拍板）**：开场选项路径为终态，不开内核受控播种缝 | ❌ |
| 3 | 卡自定压缩指令 | compaction-basic 指令写死（summarizer.ts:31） | tavern 内建第五提示词文件合法；生效需 tavern 自实现 compaction provider 或内核口子 → 📋 TODO | 📋 |
| 4 | `meta.json` 扩字段 | 仅 {title, desc, cover} | **✅ 已落地（2026-09-16）**：`TavernCardMeta` 扩 `creator`/`version`/`tags[]`（optional、宽容解析）；客户端身份头加「作者 · 版本」小字行；序列化改**字段保真**（身份行合并回原始 JSON 对象，未知字段永不因编辑丢失）；骨架 meta 占位补齐 | ✅ |
| 5 | 深层注入退化 | 无历史中间插入点 | 全部退化**动态 post 尾注段**（2026-09-16 拍板，同 §4.3；wrap 退役后退化目标随机制更名）；深层位置字段保留在 `lorebook.json` 全字段里 | ⚠️ |
| 6 | AI_OUTPUT promptOnly 正则 | 面 B seam 未建 | v1 不做（拍板）；📋 待内核面 B seam | ❌ |
| 7 | 共享世界书库 | 引擎无全局书概念 | 📋 TODO 用户级书库 + 工作空间勾选合并 | 📋 |
| 8 | 群聊/扮演 | 无 | 📋 TODO（elf 项目有参考实现，重） | 📋 |
| 9 | 长程记忆/向量 | 无 | 📋 TODO 尾代理 runtime 承担 | 📋 |
| 10 | 源料承载 | ~~`st-card.json` 永久底账~~ | **❌ 不做（2026-09-16 拍板）**：改为一次性翻译工作单 `preset/st-import/`（§7）——agent 消化后删除；重折叠走重导入，审计走导入报告 | ❌（工作单替代） |
| 11 | USER_INPUT「都 false」字面替换钩子 | 引擎 `tavern.prompt` 恒原文转发；ST 落库即改写（script.js:5816） | **📋 TODO（2026-09-16 拍板：要做，不急）**：`tavern.prompt` 转发前新增提交期改写钩子（卡脚本 stdin=原文→stdout=改写后），durable 存改写后文本——忠实 ST 落库改写语义；钩子落地前该 flag 类不进翻译工作单、导入报告列 pending，落地后重导入即可迁移 | 📋 |
| 12 | 资产目录收口 `preset/assets/` | 上传落 `preset/` 根（TavernView.tsx:305）；展现层场景④却引用 `../preset/assets/…` 要它存在；`listTree` 顶层还有工作空间根级 `assets` 死残留（workspace.ts:541） | **✅ 已落地（2026-09-16，9951c79）**：骨架建 `preset/assets/`（与 setup/scripts/tools 同走 README 兴建，含引用形态说明）；客户端 uploadCover 默认落 `preset/assets/`（tree 占用递增同旧例），**meta.cover 存工作空间相对值 `preset/assets/<file>`**（带 `preset/` 前缀——与存量卡的旧 cover 口径一致，显示链 readAsset/readLibraryAsset 零改动）；`listTree` 根级 `assets` 死残留已撤（资产由 preset 行走自然收录）；`writeAsset` 围栏不收紧（仍限 `preset/` 全区——约定落位不硬锁，`assets/bgm/` 等子目录随卡作者）；**`FIXED_PATHS` 未收录 `assets/`**（偏离本表原案：目录可删由上传 `mkdir -p` 自动重建兜底，约定不硬锁路线走到底）；存量卡 cover 路径照读零迁移（真机 e2e 已证）；导入器封面字节落 `preset/assets/cover.png`，目录导入天然带入 | ✅ |

## 9. 导入分期

| 期 | 内容（映射节） | 内核改动 |
|---|---|---|
| PR1 | 容器探测 + V1/V2/V3 归一化 + 五路折叠（§2/§3）+ 封面落 `preset/assets/`（§8.12 收口同批）+ 翻译工作单落盘（§7）+ 导入报告 | ✅ 已落地（2026-09-16，`st-import.ts` + 酒馆卡入口 `.png/.json`；目录导入入口删除） |
| PR2 | 世界书恒定/触发分流 + `lorebook.sh` v1 模板（幂等可编辑、jq 失效即世界书失效）+ `greetings.json` 生成 + persona 骨架件（persona.sh + setup/persona.md） | ✅ 已落地（同批） |
| PR3 | 🤖 翻译 agent 消化 `st-import/` 工作单（regex 可译半边 + STscript/QR → 卡工具/脚本/面板按钮，§5.3/§6/§7）+ lorebook 全功能脚本模板（递归/分组/预算） | 📋 剩余项（导入器已落工作单与报告，消化是运行期 agent 行为 + `writer-guide` 补节） |
| 后续 | 卡自定压缩指令（§8.3）/ 面 B 准入改写 seam（§8.6）/ 共享世界书库（§8.7）/ 群聊（§8.8）/ 长程记忆（§8.9）/ markdownOnly 渲染钩子 | 各自单独决策 |
