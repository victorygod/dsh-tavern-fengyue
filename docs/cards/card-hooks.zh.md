# 卡钩子(preset/hooks.json)定案与实施计划

2026-09-21 **定案并实施**(engine 全链落地,全套测试 267/267 绿,含 REAL 串行链用例;本文即该机制唯一权威)。核心一句话:**引擎在回合收束的严格串行链 `main → main.after → tail → tail.after` 上,按卡内 `preset/hooks.json` 的登记顺序机械触发 `preset/scripts/` 里的脚本**——为「回合边界、无判断、无 LLM 的副作用」提供唯一落点(回合末外部副作用、聚合缓存重建、自声明文本解析落账等)。机制对具体玩法零内建、零背书:消费逻辑全在卡脚本的地盘。内核零改动,机制权威在 `packages/engine/src/index.ts` + 新件 `packages/engine/src/hooks.ts`;dnd5e 卡自带 `test_main_after.mjs`/`test_tail_after.mjs` 两枚挂钩测试件。

与既有机制的关系:`{{script(args)}}` 与 `tavern.runScript` 解决「读」与「玩家/前端触发」,尾代理解决「叙事性维护」(需要判断力),`get_*` 脚本解决「展示型惰性派生」;钩子只接管此前无落点的第四类——**完成后副作用**。

## 修改面

| 面 | 内容 | 依据 |
|---|---|---|
| 引擎 | 挂点接线 + 钩子队列与 gate 串接 + stop 贯通 + `runtime/.chat.tail.jsonl` 写入器 | index.ts(index.ts:1394-1653),runner 独立成 `hooks.ts` |
| 卡契约 | `preset/hooks.json`(新增,唯一注册表) | 与 `ui/layout.json` 同级同 fail-soft 校验先例 |
| 脚本体 | 复用 `preset/scripts/` 一库、同一 runner | 两面共用一库脚本的家规不允许第二目录 |
| 文档 | 写权律扩员、执行时机表加行、模板样例 | 见[文档同步](#文档同步) |

## preset/hooks.json 契约(冻结)

```jsonc
// preset/hooks.json — 数组序 = 执行序;值为 preset/scripts/ 的脚本名(带 .mjs 全名或省略扩展名,与 runScript 同一解析)
{
  "hooks": {
    "main.after": ["scriptA.mjs", "scriptB.mjs"],  // 主代理回合 completed 后;每回合必触发(尾代开不开都触发)
    "tail.after": ["refresh_cache.mjs"]            // 尾代理运行收束后;本轮尾代没跑就不触发
  }
}
```

| 决策 | 定案 | 理由 |
|---|---|---|
| 事件词表 | 仅 `main.after` / `tail.after` 两事件 | 「主+尾全完」就是 `tail.after`(它蕴含主代已终结);尾代禁用的卡用 `main.after`。少一个事件少一组组合语义 |
| 顺序 | 同一事件的数组按序逐个 await | 注册表即执行序,零隐藏排序 |
| 失败 | 单脚本失败记引擎日志 warn,继续后续(不中断列表);无 toast、不进 `scriptFailures`(钩子无提交路径可挂) | 与 systemPrompt/维护路径失败上报同款处置 |
| 触发条件 | 仅 `reason.kind === 'completed'` 的回合 | 与尾代理触发条件一致;stop/abort/出错轮不触发 |
| 注册表读取 | **每次触发现读**该文件,非法 JSON/结构→warn+整文件忽略 | 小文件零缓存成本;编辑即刻生效,免去注册失效/同步机制 |
| 参数 | 钩子无 argv,读文件取数据(cwd=`runtime/` 同契约) | 「动态信息全在文件里」的家规;回合上下文从 `.chat.snapshot.jsonl` / `.chat.tail.jsonl` / runtime 自取 |
| 超时与上限 | 复用 `runCardScript` 全套(prompting.ts:378;单脚本 60s,prompting.ts:85;cwd=`runtime/`;stdout 不入模型,记日志) | 不发明第二执行通道 |

## 执行模型与保证(「确保正确触发」的全部内容)

**串行链(定案:严格顺序执行,无并发窗口):**

```
主代理回合 completed
  → main.after 钩子按数组序逐个执行
  → 尾代理运行(首步被拦,直到 main.after 全部落定才开跑)
  → 尾代理收束:写 .chat.tail.jsonl → tail.after 钩子按数组序逐个执行
```

尾代禁用(maintenancePrompt 空)时链到 main.after 即收束;`tail.after` 不触发——**没有那个事件**,不是「跳过」。钩子拖尾会顺延尾代理,这是顺序语义的代价,60s 超时封顶。

| # | 保证 | 现有缝/接线点(2026-09-21 实施后行号) |
|---|---|---|
| 1 | 每工作空间一条串行钩子队列(FIFO),队列内列表序执行;单钩子失败记 warn 不断链 | 未用独立 map——整条链就是**一个 promise**(`settled`),`beginTurnSettlement`(index.ts:1501) |
| 2 | 触发前先等快照/尾文件写队列清空:`quiesce` 经 `enqueueWrite(root, () => true)`(index.ts:310)排到队尾,先于第一发钩子返回 | 写队列即既有快照写(index.ts:1402-1409)的通道;`settlePhase`(index.ts:1540) |
| 3 | turn-end 窗口同步孵化契约不动:子会话照常窗内孵化(index.ts:1563,孵化本身零 durable 副作用),但其**首步在引擎全局 pre-step gate(index.ts:1624)挂「main.after 完成闸」**——尾代理的实际工作(认领+渲染+首请求)在 main.after 全部落定后才开始;维护提示词的 `{{script}}` 渲染同点位(index.ts:1653),随之读到钩子写完后的状态 | gate() 内一条 `await parentRun.mainAfterDone` |
| 4 | `main.after` 挂点 = `beginTurnSettlement` 链体首段;`tail.after` 挂点 = `spawnTailPhase` 的 `await started.result`(index.ts:1585)之后 | 触发自 turn/end completed 分支(index.ts:1414-1425) |
| 5 | 整条串行链并入 `gates`(index.ts:255)——**下一条玩家消息 `prompt()` 的 `await gate`(index.ts:684-685)等待 = main.after + 尾代理 + tail.after 全部完成**,postPrompt 渲染永远读到链终状态 | gate 机制白拿 |
| 6 | `stop()` 贯通:`tailRuns` 里的收束运行即含钩子;stop 时 abort → 在跑的钩子子进程随 exec.signal 被杀、首步闸放行(子会话由既有句柄取消),无悬挂 | stop(index.ts:1607)原句柄直通 |
| 7 | `.chat.tail.jsonl` 在 tail.after 钩子触发**之前**写好:`enqueueWrite` 队列序——尾文件整写(index.ts:1589-1593)先于 phase 的 quiesce | `writeTailSnapshot`(chat-snapshot.ts) |

为什么不用「延后孵化」实现顺序:turn-end 窗口同步孵化是内核契约(#3);先孵化、后拦首步,顺序语义与契约两全——孵化只造会话,不跑模型、不写盘。

## `runtime/.chat.tail.jsonl`(尾代输出临时文件)

**动机**:尾代理是 fork 子会话,其 children id 不进 `workspaces`,`onSessionEvent` 第一道门 `workspaces.get(child)===undefined → return`(index.ts:1401-1402)——子会话 durable 消息**到不了快照**;其文本流仅以瞬态转投(`transposeTailStream`,index.ts:1474,"no durable event is written")给 UI。钩子和卡脚本因此需要一个文件读到「本轮尾代的叙述」。

```
runtime/.chat.tail.jsonl        ← 与 .chat.snapshot.jsonl 同族;每轮全量替换(临时文件+原子 rename,chat-snapshot.ts:122-124)
{"type":"head","sessionId":"…","turnSeq":42,"ranAt":"2026-09-21T10:00:00.000Z"}
{"role":"assistant","text":"本轮尾代理维护叙述…"}
```

- 写入时机:`spawnTailPhase` 收束处(index.ts:1589-1593),取事件缓冲的子会话 assistant 文本整写;先写文件、后触发 tail.after(entry #7);
- `head.turnSeq` = 主会话该回合的 seq(取法同 index.ts:1250 的先例)——尾代禁用/该轮 abort 时文件保持上轮内容,脚本可凭 turnSeq 判陈旧,可弃缓存自愈语义与快照一致;
- **不记历史**:每回合尾代的权威归档在引擎侧(子会话 dispose 的 live-to-cold checkpoint,见 ../runtime/tail-session-archive.zh.md);卡要流水就让钩子脚本自己 append 自己的账本文件——引擎不做第二个真相源;
- **不记工具调用与结果**:快照投影注释明文"tool traffic … are model/display-face derivations, not history"(chat-snapshot.ts:58-63),`textOfBlocks` 只取 text 块(chat-snapshot.ts:51);尾代工具的效果本来就是 runtime 文件。后补只考虑 opt-in 字段,v1 不背。

## 正文可见性(钩子脚本拿输出,就这两条)

- **主代理本轮输出的正文** → `runtime/.chat.snapshot.jsonl`(全部历史累积;本轮的 = 最后一条 `kind:"assistant"` 行)。
- **尾代理本轮输出的正文** → `runtime/.chat.tail.jsonl`(仅当前轮;每轮全量替换掉上一轮)。

钩子脚本需要本次输出的正文,就去对应文件读;不需要,看 runtime 其余文件即可。

实现侧只有一个义务,没有别的逻辑:**两个文件必须在各自的 after 事件触发之前已经写好盘**——main.after 触发前,快照已含主代理本轮正文;tail.after 触发前,尾文件已含尾代理本轮正文(即执行模型表 entry #2 / #7,无其余隐含规则)。

> 写权律附记:钩子是第三支「无判断落盘」写手(尾代叙事事实 / front_commit 前端决策 / 钩子),LLM 零写手铁律不动。

## 实施计划(已落地)

| 期 | 内容 | 状态 |
|---|---|---|
| M1 引擎缝 | `packages/engine/src/hooks.ts`(注册表现读+校验+phase runner);index.ts `beginTurnSettlement`/`spawnTailPhase`/`settlePhase` + gate 首步闸 + stop 直通 | ✅ |
| M2 尾文件 | `writeTailSnapshot`(chat-snapshot.ts 同族,原子 rename + `head.turnSeq`);`tailChildRuns` 事件缓冲接它 | ✅ |
| M3 卡面 | dnd5e 卡 `preset/hooks.json` + `test_main_after.mjs`/`test_tail_after.mjs`(追加写 `testmainafter.md`/`testtailafter.md`);模板样例与 README 同步另行 | ✅(测试件)|
| M4 验收 | `hooks.spec`(注册表/顺序/失败不断链/abort)+ chat-snapshot 尾文件 spec + loader-composition REAL 用例;全套 267/267 绿,tsc host/client 双绿 | ✅ |

## 实现落点(符号索引,行号为 2026-09-21 提交时点)

- `readCardHooks` / `runHookPhase` — `packages/engine/src/hooks.ts`(注册表、校验、phase runner)。
- `TurnRun` / `tailRuns` / `tailChildRuns` / `beginTurnSettlement` / `settlePhase` / `spawnTailPhase` — `packages/engine/src/index.ts`(链体、事件拦截、闸)。
- `textOfBlocks` / `TAIL_SNAPSHOT_FILE` / `tailSnapshotPath` / `writeTailSnapshot` — `packages/engine/src/chat-snapshot.ts`。
- 尾代叙述缓冲:子会话 durable `assistant/message` 事件在 `onSessionEvent` 顶部 interception(index.ts:1394-1400)推入 `run.tailTexts`——子会话不绑工作空间,必须先于 workspaces 门。

## 测试清单(验收口径 = 全绿)

- 解析:合法结构按数组序执行;非法 JSON/结构 warn+忽略不 block 回合;引用脚本缺失时该条 warn、后续条目继续。
- 触发:仅 completed 触发;aborted/stop 不触发;尾代禁用时 tail.after 永不触发而 main.after 触发。
- 可见性:main.after 触发时快照已含本轮 assistant 行;tail.after 触发时 `.chat.tail.jsonl` 已写好且 runtime 含尾代落账。
- 严格顺序:main.after 全部落定前尾代首步未开跑(单测:main.after 钩子内挂住的闸、窗内孵化不违反;REAL:main.after 钩子写 runtime 标记,maintenancePrompt 的 `{{script}}` 渲染断言该标记可见)。
- 串接:同事件多钩子按序;单钩子失败不断链、后续条目继续;下一回合的 postPrompt 渲染(REAL)发生在整链(main.after+尾代+tail.after)写盘之后。
- stop:钩子运行中 stop → 子进程被杀、日志留痕、无孤儿正在写盘。
- REAL(`loader-composition`,沿用 `dsh-subprocess-local` 先例):实测卡 + maintenancePrompt 完整回合,断言快照行、尾文件 head.turnSeq、钩子副作用、下回合渲染时序。

## 文档同步(落地时)

- `docs/cards/card-presentation.zh.md` 执行时机表加「钩子面」一行(两挂点+gate 语义)。
- `docs/architecture/scripts-and-tools.zh.md` 增钩子小节或交叉链接(执行通道全复用声明)。
- 写权律三支扩员(front_commit 尾注、dnd5e dm-loop B5、card-presentation 信任模型)。
- `tavern_presets/*/preset/` 与模板的 README 提一句新契约存在,不展开(权威本文)。

## 明确不做

submit/save/load/import 事件词表扩员;per-entry args 对象与排序字段;工具调用/结果落文件(含 opt-in,留待真实需求);尾代历史账本(引擎侧 checkpoint 已有);把任何具体玩法 DSL(回复文本声明块解析、变量系统等)内建进引擎——工具调用(face=LLM 声明、引擎执行)已覆盖一类语义,文本声明走钩子脚本属卡的自由组合,引擎不为任何一种建模。

相关:`docs/architecture/scripts-and-tools.zh.md`(渲染时机与执行参数)· `docs/cards/card-presentation.zh.md`(执行时机表/信任模型)· `docs/runtime/dynamic-post-injection.zh.md`(post 定格机制)· `docs/runtime/tail-session-archive.zh.md`(尾代归档)· `tavern_presets/dnd5e/docs/dm-loop_zh.md` B5(写权律)
