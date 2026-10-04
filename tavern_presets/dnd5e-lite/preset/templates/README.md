# templates/ — 模板文档区

**身份**：出生辅助层——engine 不扫、不播种、不索引。模板只在文档生成的那一刻被读取，产物出生后与模板**零持续耦合**，永不回刷。schema 演进走 prompt 规范与尾代对账。

## 居民

- `character.tpl.json` — 人物模板（v8 平铺:player.json 固定名 + 一切具名人物同 schema,目录即类型(无 type 字段);机件 + persona 短串 + biography/装备 行数组追加式;v8:职业资源=resources 行数组全职业开放,origin=lore 来源路径登记启用;出生=替换→JSON.parse 断言→stringify→schema 检查一次）——无名杂兵不入,住 state.md 战斗节敌行（combat.tpl.json 已废——2026-09-20 定案战斗入 state.md）

## 格式律（v3，2026-09-19——"格式随文件的主要作者与读者"）

| 区 | 格式 | 读者/作者 |
|---|---|---|
| `characters/*.json`（全员） | JSON | 脚本+前端为主读，尾代理浅层重写；engine write-guard 拦坏写 |

| lorebook / lore 实体 / prompt | md（双层制续用） | LLM 为主读者，一次性出生 |
| 接口（ui_data→手簿） | JSON | 机器喂机器，代码构造天然合法 |

**lint**：面板 JSON.parse = 免费的 fail-loud 校验（坏文件当场炸出，优于 frontmatter 的静默丢行）；schema 规则（必需键/枚举/交叉约束）在出生时检查一次 + 尾代理施工时配对账工具。flat 浅层（一层键+四个小对象列表`statuses`）是 LLM 整文件重写的安全区——**禁深度嵌套**。
