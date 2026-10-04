# ST 导入：翻译待办（本目录全部完成后删除）

本卡由 SillyTavern 导入；以下源料无法机械折叠，需要理解后逐项翻译。

## 导入报告（一次性；删除本目录即视为已阅）
- 丢弃：depth_prompt（卡自定压缩指令槽未建，映射 §8.3）
- 宏翻译 52 处（char×12、user×40)→ {{st(...)}} 调用
- 体量：恒定条目 1 → systemPrompt；触发条目 49 → lorebook.json；开场选项 3 → greetings.json

## 待办清单

（无翻译项 —— 读完报告即可删除本目录）

## 消化契约（每项必守）

- 产物只落 `preset/` 内；runtime/ 是世界状态区，不写
- 脚本自验：bash -n 过；产物里的 `{{…}}` 每个占位符必须有对应 preset/scripts 脚本
- 全部完成后删除本目录（rm -rf preset/st-import）
