# Docs

Tavern 深度文档目录(中文为主;待整套翻译落地后按双语成对组织——`foo.zh.md` 中文版 ↔ 未来的 `foo.md` 前两节英文配对)。GitHub 社区文件:[CONTRIBUTING.md](CONTRIBUTING.md) / [CONTRIBUTING.zh.md](CONTRIBUTING.zh.md)。

## Architecture / 架构

- [design](architecture/design.zh.md) — 上下文结构(固定 systemPrompt + 单活 postPrompt)、工作空间即记忆、launcher/引擎分工、「工具归属与引擎能力边界」
- [file-tree](architecture/file-tree.zh.md) — 仓库与工作空间的文件树结构逐一说明
- [scripts-and-tools](architecture/scripts-and-tools.zh.md) — `{{script}}` 模板脚本的渲染时机与 `@tavern-schema` 工具注入

## Cards & SillyTavern Import / 卡与导入

- [card-hooks](cards/card-hooks.zh.md) — `preset/hooks.json` 卡钩子契约(生命周期挂点与 gate 语义)
- [card-presentation](cards/card-presentation.zh.md) — per-card UI 展现层的七步管线
- [sillytavern-mechanics-and-import](cards/sillytavern-mechanics-and-import.zh.md) — ST 机制逐项盘点与导入映射
- [st-card-field-mapping](cards/st-card-field-mapping.zh.md) — ST 卡 → 我方卡的字段严格映射
- [st-import-work-order](cards/st-import-work-order.zh.md) — 导入翻译工作单与翻译器规格

## Runtime / 运行时

- [dynamic-post-injection](runtime/dynamic-post-injection.zh.md) — wrap 退役 → 每回合单活 post 注入机制
- [send-moment-autosave-and-retry](runtime/send-moment-autosave-and-retry.zh.md) — 发送时刻自动存档、回复重试与草稿恢复
- [tail-session-archive](runtime/tail-session-archive.zh.md) — 尾代理会话的生命周期与归档

## Testing / 测试

- [keyless-testing](testing/keyless-testing.zh.md) — 无 API Key 的自动化测试链路设计与覆盖
- [mock-llm-testing](testing/mock-llm-testing.zh.md) — 不真实调用 LLM 的本地测试方式

## Release / 发布

- [independence-and-release](release/independence-and-release.zh.md) — 插件独立性、共享面处置与发布形态(dsh 版本列车 + 外装回退)

## Historical Records / 历史记录

[notes/](notes/) — 按日期的定案/修复笔记(bug-fix / feature / architecture / testing)与编年体 [devlog](notes/devlog.zh.md)。历史记录不随代码维护,与代码冲突时以代码与 README 为准。

## Elsewhere

- [prototype/](prototype/) — 早期 UI 原型(ui-mockup.html)
- 各示例卡自带文档:`tavern_presets/dnd5e/docs/`(DM 循环、面板数据、UI 契约等,随卡走)
