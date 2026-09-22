# Agent Note：风月卡导入（st-import 第二方言）

Status: implemented

中文

## 问题

导入面只认 SillyTavern 生态（V1/V2/V3 PNG-tEXt 卡 + 旧 DSH `pre_prompt` 导出）。
风月（catai.wiki 生态）卡的 JSON 字段名与提示词分段完全不同——今天误入 ST 归一化
会把 `pre_prompt` 当旧 DSH 后注折掉、HTML 的 `description` 被压成一行简介、
`world_book` 整体无视。

## 决策

**`st-import.ts` 双方言：JSON 容器探测后按特征分流，风月卡走专用折叠
`foldFengyueCard`。** 识别特征：`pre_text` / `post_text` / `world_book` 任一在场
（旧 DSH 导出只有 `pre_prompt` / `post_prompt` 一对，ST 用 `character_book` /
`world`——三方零重叠，`isFengyueCard` 导出可单测）。

映射表（用户口述契约 + 机械落点）：

| 风月字段 | 我方落点 |
|---|---|
| `pre_prompt` | `preset/prompt/systemPrompt` 原文直落 |
| `pre_text` + `post_text` | `preset/prompt/postPrompt`（`\n\n` 合并；有世界书时前置 `{{lorebook()}}`——沿用 ST 折叠的世界书双件套） |
| `world_book` | `preset/lorebook.json` + `preset/scripts/lorebook.mjs`：键从 `_or_前缀@wb@分隔` 解析为 keys 数组，每条原文 verbatim 挂 `fy` 槽（对应 ST 条目的 `st` 槽）；`key_region` 位码（**1=system、2=user、4=assistant**，用户口述契约）折叠为每条目的 `scan.kinds`——匹配面是「该种类集合**最近一条**消息」（发送期最近一条 user 即引擎预投影的本回合输入，见 chat-snapshot 的 pendingText 时序） |
| `description` | `preset/setup/opening.html`——自绘 HTML 开场页正好是我们卡自绘开场的标准位置（dnd 卡同款），沙箱 iframe 渲染 |
| `opening_statement` + `suggested_questions` | `preset/greetings.json`（开场选项按钮） |
| `name` / `summary` | `meta.json` 的 title / desc（summary 压一行同 ST 的 shortDesc） |
| `cover` | 远端 URL，导入时浏览器抓取（已核对 catai.wiki 现网回 `access-control-allow-origin: *` + `image/jpeg`）；魔数嗅探定扩展名（引擎资产白名单按扩展名定 MIME）；任何失败不拦导入——报告行 + 身份头手动上传兜底 |
| persona 脚手架、maintenancePrompt | 与 ST 折叠同款标准种子（`persona.mjs` + `setup/persona.md`、maintenance 空） |

**lorebook.mjs v1.5 双匹配面**：带 `scan.kinds` 的条目（风月）取该种类集合
最近一条消息做键匹配；无 `scan` 的条目（ST）沿用最近 N 行（argv[0] 可调，
默认 12）拼合窗口。`value_region`（注入位）用户拍板**不另设位**——值内容一律
注入 postPrompt 的 `{{lorebook()}}` 座，仅体量行记一句。

**无对位字段进导入报告**（`preset/st-import/README.md`，风月版）：system 位
（快照无 system 行恒不命中）、`key_region` 缺落回默认 user+assistant、`_and_`
AND 组合键（按 OR 落，报 degradation）、`group` 分组、`banned_words`、`cg_book`、
`shortcut_commands`、`preset_chats`、无键/无内容被滤掉的条目数。风月映射全机械，
无翻译待办清单——报告即全部，删除本目录即视为已阅。同步折叠路径
（`importFromJson` 直呼）不发起网络请求，带 URL 无二进制时记报告行说明封面未落地。

## 备选方案的取舍

- **世界书直落 systemPrompt 恒定段**：否决——风月条目全部是关键词触发式（`_or_` 多键），
  5k 级条目六七条全量进系统提示等于丢掉触发机制；近文扫描双件套是现成的。
- **`description` 压成 `meta.desc`**：否决——它是完整 HTML 开场页（13k、带 style），
  压行只余噪声；落 `opening.html` 零损耗。
- **封面留给用户手动上传**：否决——catai 现网 CORS 放行，抓取免费；失败已有兜底行。
- **识别特征带上 `pre_prompt`**：否决——与旧 DSH 导出撞车（那条路已有测试钉住）。

## 后果

入口改名 `parseSillyTavernCard` → `parseTavernCard`（含双方言本质；TavernView 与
spec 两处调用点同步）。UI 面零改动：文件选择器本就收 `.json`，预览面板、
commitImport/writeAsset 封面落地链路原样复用。40 用例全绿（jsdom 里风月封面 URL
置空避网络）。真实卡「战争模拟.json」全文烟测通过：6 条世界书键各解析正确、
开场页 13041 字符落位、postPrompt 三段合成如预期。同日第二稿：key_region
位码语义落地（scan.kinds + 最近一条匹配面，临时 runtime 端到端跑通——键只在
较旧 assistant 行出现的条目不再误触发）。
