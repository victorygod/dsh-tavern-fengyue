# ST 导入翻译工作单与翻译器规格

2026-09-16。定义「一键导入酒馆卡」翻译期（分期 PR3 🤖）的三个面：导入器落进卡里的**翻译工作单** `preset/st-import/`、写卡 agent 消化它时的**操作契约**、以及工作单承载的**导入报告**。翻译器自身（消费代码/引导节）由 PR3 实现，本文先于实现定形——写卡引导届时按 §4 补一节指到本文。定位与拍板权威：[st-card-field-mapping.zh.md](../cards/st-card-field-mapping.zh.md) §5.3/§7（工作单替代永久底账）。机制权威：写卡 agent（[edit-page-identity-and-writer-agent.zh.md](../notes/edit-page-identity-and-writer-agent.zh.md)）、卡脚本面与 `mount(tavern)`（[card-presentation.zh.md](../cards/card-presentation.zh.md)）。

## 1. 生命周期

```
导入器（PR1）：五路折叠后，把「需要理解后翻译」的源料落成 preset/st-import/（纯 files 表产物）
   → 工作单常驻可见（编辑器文件树 =「此卡有翻译待办」；待办 = 世界观满配但没配嘴的卡）
消化（写卡 agent，cwd=工作空间根）：读单 → 按菜谱逐项产出 → 自验 → 删除 st-import/ 目录
   → 卡归净，产物即普通卡文件（preset/scripts、preset/ui）
不消化也自洽：目录永远可手动处理；换绑/发布随 preset/ 复制；重导入 = 新工作单
```

## 2. 工作单文件规范

```
preset/st-import/
├── README.md     ← 工作单正文 + 导入报告（导入器模板生成，一次卡一份；schema 见下）
├── regex.json    ← 可译半边的原始 regex_scripts[]（摄入器预分拣后；仅 verdict=translate 的条目）
└── stscript.txt  ← STscript / Quick Replies 原文（分段编号；保留原文供逐段意图映射）
```

三方契约：

| 文件 | 生成者 | 消费者 | 生命周期 |
|---|---|---|---|
| `README.md` | 导入器（浏览器侧，P1 解析产物） | 写卡 agent 与卡作者 | 目录删除时随之消失 = 「待办已清 + 报告已阅」 |
| `regex.json` | 同上（POJO schema） | agent（`sed`/`perl` 翻译输入） | 同上 |
| `stscript.txt` | 同上（原样留存） | agent（意图映射输入） | 同上 |

### 2.1 `regex.json` schema

```jsonc
{
  "items": [{
    "id": "r1",                     // 工作单内的稳定引用（README 清单与条目互指）
    "placement": 1,                 // regex_placement：USER_INPUT=1 / AI_OUTPUT=2 / WORLD_INFO=5 / REASONING=6
    "markdownOnly": false,
    "promptOnly": true,
    "disabled": false,
    "findRegex": "/…/g",
    "replaceString": "…",           // 含 $1/$<name>/{{match}} 语义（映射 §5.2）
    "trimStrings": [],
    "minDepth": null, "maxDepth": null,
    "verdict": "translate",         // 导入器按映射 §5.1 预分拣的判定结果（见 §3 总表）
    "note": "仅注入提示词，不影响显示"
  }]
}
```

判定语义由导入器负责、agent 只执行：`translate`（进工作单，按菜谱翻）｜`pending-render-hook`（markdownOnly 半边挂 PR5 渲染钩子——**不进工作单**，报告列 pending）｜`drop`（无钩子的半边——**不进工作单**，报告列明）。

### 2.2 `README.md` 模板（导入器按卡填充）

```markdown
# ST 导入：翻译待办（本目录全部完成后删除）

本卡由 SillyTavern 导入；以下源料无法机械折叠，需要理解后逐项翻译。

## 导入报告（一次性；删除本目录即视为已阅）
- 丢弃：AI_OUTPUT + promptOnly 正则 2 条 —— 消息准入改写 seam 未建（映射 §5.1）
- 丢弃：depth_prompt —— 卡自定压缩指令槽未建（映射 §8.3）
- 缺失引用：extensions.world "AetherWorld" —— 共享世界书库未建（映射 §4.4），装好后手动挂
- 体量：恒定条目 6 → systemPrompt；触发条目 23 → lorebook.json；开场选项 4 → greetings.json

## 待办清单
| # | 源料 | 目标 | 状态 |
|---|---|---|---|
| 1 | regex.json#r1（USER_INPUT, promptOnly） | preset/scripts/ | ☐ |
| 2 | stscript.txt#q1（QR「查询状态」） | preset/ui/index.js 面板按钮 | ☐ |

## 消化契约（每项必守）
- 产物只落 `preset/` 内；runtime/ 是世界状态区，不写
- 脚本自验：`bash -n` 过；带 `# @tavern-schema` 的按工具脚本 `-h` 必须短路退出（不真跑长任务）
- 产物里的 `{{…}}` 每个占位符必须有对应的 preset/scripts 脚本（求值器 fail-visible）
- 全部完成后删除本目录（`rm -rf preset/st-import`）
```

## 3. 翻译菜谱（源料 → 产物）

| 源料（工作单内） | 产物落点 | 菜谱要点 |
|---|---|---|
| 正则 `USER_INPUT` + 默认 flag（ST 落库改写型，script.js:5816） | `preset/scripts/<名>.sh`（stdin=原文 → stdout=改写后）+ `tavern.prompt` 提交期改写钩子（📋 TODO §8.11，未落地） | 落库改写忠实型，**钩子落地前不进工作单**（导入报告列 pending——报告注明「引擎改写钩子落地后重导入即可迁移」）；钩子落地后：转发前跑脚本，durable 存改写后文本（显示同见，与 ST 一致）；重试 draft 戳存原文、重发再过钩子 |
| 正则 `USER_INPUT` + promptOnly | `preset/scripts/<名>.sh` + `postPrompt`（动态 post 注入段单一挂点） | **注记式**：提交期脚本读快照 pending 行 → 应用 findRegex → 改写后的意图文本经 `{{…}}` 进 post 渲染值；显示层按 `source.kind==='plugin'` 过滤 post 行——「显示原文 / 提示词见注记」成立（映射 §5.1） |
| 正则 `WORLD_INFO`（任意 flag） | `preset/lorebook.json` 对应条目 content | **静态烘焙**：ST 在注入时改写条目 content（`world-info.js:5086`）——翻译 agent 把 findRegex/replace 应用到匹配条目 content 后写回；差异明示：烘焙后不再每请求重跑。`minDepth/maxDepth` 无条目级对应，进导入报告 |
| 正则 `AI_OUTPUT` + promptOnly / 默认的提示词半边 | —— | drop：消息准入改写 seam 未建（映射 §5.1/§8.6），只进导入报告 |
| 正则 `AI_OUTPUT` + markdownOnly | —— | pending-render-hook：PR5 渲染钩子评估，不进工作单，报告列 pending |
| 正则 `REASONING` | —— | 同 markdownOnly（思考行前端聚合流），报告列 pending |
| Quick Reply（按钮） | `preset/ui/index.js` + `layout.json` + 卡脚本 | `layout.json` 声明面板容器 → `mount(tavern)` 内创建按钮 → 点击 `runScript(名, 实参)`；输出置 `.tavern-textarea` **只填不发** |
| STscript 段 | bash（数据）+ `ui/index.js`（表现）+ 卡工具（副作用） | 按命令意图映射：`/setvar`/`/getvar` → `runtime/` 状态文件；`/echo`/`/input` → 按钮文案或回填；调 ST 内部 API（`/gen`、`/swipe`）→ 有意图等价物则组合卡脚本+面板实现，没有则该段进报告。语法不兼容是明示的（映射 §6） |

## 4. agent 消化契约（写卡 agent 的操作序）

1. **入**：进入工作空间后检查 `preset/st-import/` 是否存在——不存在即无事可做（工作单是条件触发，不是常驻职责）；
2. **读**：以 `README.md` 清单为准逐项工作；`regex.json`/`stscript.txt` 是数据，清单是次序；
3. **产出**：按 §3 菜谱落到产物文件（普通文本文件，编辑器/写卡通道既有）；产物与本卡既有内容冲突时（重名脚本、已有按钮 id）递增后缀或并入现有文件；
4. **自验**：脚本 `bash -n`；工具形态脚本 `-h` 短路探针；`{{…}}` 与 `preset/scripts` 一一成对；`layout.json` 改动合法（容器名/slot 白名单，坏值回默认——card-presentation 校验语义）；
5. **收**：清单全部完成后 `rm -rf preset/st-import`；**任何一项放弃**则目录保留、README 状态列标 ✗（待办仍在，下次继续或用户手动处理）。

边界：翻译消费只看工作单三件 + 本卡 `preset/` 既有内容；不读卡外文件、不禁用既有机制、不动 `runtime/` 世界状态（脚本运行时写的状态文件除外）。PR3 实现时在 `writer-guide.md` 补一节按本文收缩表述，引导从不在无工作单卡上提这些。

## 5. 导入报告

报告 = 工作单 `README.md` 的第一节（§2.2 模板），承载：「本次导入丢了什么 + 为什么 + 有无复原通道」。随目录删除而消失——报告的寿命就是玩家的关注期，长期审计走重导入。固定三类：**丢弃**（机制未建且无近似路径）、**缺失引用**（卡指向我方没有的共享资源）、**体量统计**（各折叠落点的条目数，供玩家核对导入质量）。
