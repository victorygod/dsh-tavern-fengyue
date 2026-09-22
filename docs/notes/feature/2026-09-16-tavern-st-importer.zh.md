# Agent Note：酒馆一键导入器

Status: implemented

[English](2026-09-16-tavern-st-importer.md) | 中文

## 问题

旧导入路径是平铺字段读取器：只认顶层 `name/description/system_prompt/pre_prompt/post_prompt`——真正的酒馆卡（V2 的 data.*、V3 的 character_book/regex_scripts、PNG 容器）会折成空卡；PNG 选不了，世界书/开场白/身份 tags 全部没落点。st-card-field-mapping_zh.md 定了形态，本笔实现它。

## 决策

**一个模块、纯折叠。** `st-import.ts`（客户端、无 React）：PNG 魔数探测 + tEXt chunk 走读（`ccv3` 优先于 `chara`，base64 JSON，PNG 字节即封面）；spec 判定（`chara_card_v2`/`chara_card_v3`/无 spec 的 V1 + legacy DSH 顶层 `pre_prompt`/`post_prompt` 捡拾）；归一化到 V2 规范形。折叠按映射文档五路落位：systemPrompt 按 ST 自己的装配序成段（恒定世界书条目以 before/after 段夹住人格栈），触发条目进 `preset/lorebook.json`（条目原文挂 `st` 字段作重折叠源）+ 生成 `preset/scripts/lorebook.sh` v1（jq：tail 快照 → contains 匹配 → 概率门 → 按序输出；jq 缺失 = 世界书静默失效，README 有说明），`{{lorebook()}}` 挂 postPrompt（2026-09-16 反转后的默认；`post_history_instructions` 同落 postPrompt——与 ST 的 depth-0 注入同机制），`first_mes`+`alternate_greetings` 进 `preset/greetings.json`，身份进 meta.json（title/desc 缩写/cover/creator/version/tags），所有折不进活跃面的正则按 verdict 预分拣（`translate`/`pending-render-hook`/`drop`）进 `preset/st-import/` 工作单，README 第一节即导入报告（丢弃/缺失引用/禁用条目/体量统计）。人格以两文件随行（`scripts/persona.sh` + `setup/persona.md` 播种 `runtime/persona.md`）。`importFromJson` 全程兜底：折叠任何抛错都转成用户可见的导入错误，绝不 unhandled rejection。

**入口合一。** 「从其他目录导入」按钮删除（parseDirectoryImport 一并退役）；酒馆卡入口接受 `.png`/`.json`。预览页保持内存表编辑流；PNG 封面在 `commitImport` 之后紧接 `writeAsset` 落位（meta.json 已指向 `preset/assets/cover.png`；封面写失败 alert 不阻断）。

## 备选方案的取舍

- **保留目录导入**：否决（拍板）——它服务自家旧平铺格式，而新解析器对无 spec 的 JSON 本就捡拾 `pre_prompt`/`post_prompt`；单一入口让「哪种导入语义」不再含糊。
- **`{{lorebook()}}` 挂 systemPrompt**：否决——in-history 模型（deepseek-flash）下 system 变化只尾部追加不替换，旧世界内容滞留视图越积越多；post 尾注段有 ST 的每提交粒度语义且零缓存代价（映射 §4.2）。
- **导入器里直接翻译正则**：否决——规则翻译需要语义判断（agent），导入器只做 verdict 预分拣并保原始条目。

## 后果

wire 与引擎零改动（`commitImport`/`writeAsset` 既有通道全够）。工作单只在有话要说时物化；翻译 agent 的消化是剩余的分阶项（§9 PR3 + writer-guide 补节）。测试：12 例纯折叠 spec（PNG 双路由含 ccv3/chara 优先级、归一化矩阵、装配序断言、verdict 矩阵、报告行、纯净卡无工作单）+ 改造后的选择器用例（断言分段 systemPrompt、合并 postPrompt、persona 文件）。被删入口的双语文案键两侧同删；文档随批反转：design_zh（两入口）、mapping（§5.1 WORLD-INFO 语义勘误——ST 是注入时改写条目 content，不是匹配方式）、工作单菜谱行。
