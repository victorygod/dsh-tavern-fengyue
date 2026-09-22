# Agent Note：酒馆卡 meta 契约扩容与默认开场页问候选项

Status: implemented

[English](2026-09-16-tavern-meta-greetings-contract.md) | 中文

## 问题

一键导入酒馆卡缺两个前置。① `TavernCardMeta` 只有 `{title, desc, cover}`，且客户端 `serializeMeta` 按这三键重建整个文件——任何新字段都会在用户第一次编辑身份行时被静默抹掉。② `first_mes` / `alternate_greetings` 没有落点：ST 的滑动开场属于开场体验，而我们的开场选项只存在于卡自绘的 `opening.html` 里，默认开场页只有标题+简介。

## 决策

**① meta 契约：可选 `creator` / `version` / `tags[]` + 字段保真保存。** 引擎对三个可选字段宽容解析（类型不符或为空即缺席——旧三字段卡读形不变），骨架 meta 补齐占位。客户端 `parseMeta` 改为返回可编辑身份 + 未触碰的原始 record；保存 = 身份行合并回原始 JSON 对象，身份头不编辑的字段（`tags`、导入器私藏键）永不因编辑丢失。身份头新增只读「作者 · 版本」小字行，轮询的变更判断纳入新字段。

**② 默认开场页读 `preset/greetings.json`。** 可选数据文件（`{ "greetings": ["…", …] }` ——导入器日后写入：first_mes 在首、alternate_greetings 依次）渲染为选项按钮；点击与 `opening.html` 选项共用同一 `updateDraft` 入口只填不代发，发送仍是玩家动作。缺文件、坏 JSON、空数组、非字符串条目一律静默退回标题+简介；带卡自绘 `opening.html` 的卡不加载该文件。

## 备选方案的取舍

- **新 meta 字段上 wire**（state/library 值携带）：否决——身份头与导入预览都经 `readText` 直读文件，线上三个字符串已覆盖既有消费方，动 wire 只换来两次 bundle 重建。
- **生成 `opening.html` 承载选项**：否决——HTML 转义坑且玩家不可调；JSON 数据 + 默认页渲染与展现层「宿主拥有 DOM」模型一致。
- **真·首条 assistant 播种**：已拍板不做（2026-09-16）——需要内核受控播种原语，开场选项路径定为终态。

## 后果

向后兼容由构造保证：逐字段宽容解析测试钉住旧读形，ui 套件钉住「身份编辑后字段存活」。`serializeMeta` 签名变化连带更新了导入预览调用点；meta 轮询现在也感知 creator/version 变化。顺手修一个潜伏客户端 bug：`.onCover` 被默认开场页标记引用却从未在 `App.module.css` 中定义（类名渲染成字面量 `undefined`）；现承载可读性文字投影。`greetings.json` 是纯客户端约定——引擎零改动、不进 `FIXED_PATHS`。
