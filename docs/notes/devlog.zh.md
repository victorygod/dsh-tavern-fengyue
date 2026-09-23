# 开发日志 — 酒馆插件

按时间倒序记录每次排查的根因与修复。约定：现象 → 证据链 → 根因 → 修复 → 验证 → 防复发，与 [git-artifact-pollution.zh.md](../notes/git-artifact-pollution.zh.md) 同一体例。

## 2026-09-23 Windows 删除会话 EPERM：POSIX 掩盖的删-开同秒竞态（已修：退避重试 + 保留绑定 + 日志侧降级）

- **现象（Windows 真机报）**：侧栏「彻底删除」确认后 RPC 失败——`tavern rpc failed: tavern/error: EPERM, Permission denied: \\?\D:\_rehearsal\code_…`（`\\?\` 前缀只是 libuv 在 Windows 的长路径内部写法，非病因；`EPRTM` 为手抄变体）。macOS 同操作从未失败。
- **链路**：`sidebar.deleteConfirm`（`packages/ui/src/client/locales.ts:201`）→ `deleteSession` RPC，失败面由 unwrap 拼装（`packages/ui/src/client/rpc.ts:97`）→ api `wrap` 把底层 err.message 包成 `RemoteError('tavern/error', …)`（`packages/api/src/index.ts:163-169`）→ 实干方 `engine.deleteSession`（`packages/engine/src/index.ts:554-570`）：`stop(sessionId)` 之后**同步立刻**两个 `rmSync(x, { recursive: true, force: true })`（工作空间目录 + dsh-home 会话日志项目目录）。
- **根因（POSIX / Windows 删除语义差）**：
  1. Windows 不允许删除被打开的文件/目录（无 `FILE_SHARE_DELETE` 的句柄 → `DeleteFile` 报 Access is denied → libuv 映射 `EPERM`）；POSIX 下 unlink 打开中的文件成功，句柄随关闭消亡——同一个竞态在 mac 被 POSIX 语义掩盖，到 Windows 现形。**引擎定义里已有一条承认**：`writerLogGC` 注释明写 "a tombstone whose rm failed (**file-lock races on Windows**) stays tombstoned for the next boot"（`packages/engine/src/index.ts:408-409`），但 `deleteSession` 无这层缓冲。
  2. 竞态构成：`stop()` 只是发出取消（返回 `{accepted, tailStopped}`，`packages/engine/src/index.ts:1651`），主回合收尾、tail fork 收尾、持久层 writer 冲刷日志的句柄要在之后的 tick 才落——`rmSync` 抢跑。写卡 agent **只摘映射行不 stop**（`packages/engine/src/index.ts:565-567`），其 cwd = 同一工作空间根，编辑页开着时句柄可在场。外部锁源同理：Defender 实时扫描/索引器对刚写完的文件短暂持锁。
  3. Node 侧无重试：`rmSync` 对 `EBUSY/EMFILE/ENFILE/ENOTEMPTY/EPERM` 的线性退避重试**只在显式传 `maxRetries` 时生效，默认 0**；`force: true` 只吞 `ENOENT`。一次锁即整体抛错。
- **连带影响**：失败时 `workspaces.delete` 已执行、目录树可能已删一半；侧栏是磁盘扫描，残余半个工作空间会以幽灵行驻留。
- **修复（已落码，语义三面）**：`deleteSession` 改 async（`packages/engine/src/index.ts`），`api` 面相应 await（原先 fire-and-forget 会把引擎失败吞成未处理 rejection 而谎报成功）。
  1. **rm 退避**：`removeTree` 对 Access-Denied 家族（`EBUSY/EACCES/EPERM/EMFILE/ENFILE/ENOTEMPTY`——Windows 上 Access is denied 以 EPERM 或 EACCES 形态到站）做 12×250ms 有界重试，吃掉"撤销后句柄迟落"的结算窗；`EACCES` 是实测教训：初版集合漏了它，POSIX chmod 锁走 EACCES 直接旁路了重试车道（测试时长露馅：6s 变 4s）。
  2. **绑定保留**：rm 全败时不再先删名册——重试耗尽抛错原路返回，绑定仍在，玩家可原样重试删除；成功才解除 `workspaces/postStash/writers` 并清日志项目目录。
  3. **日志侧降级**：工作空间已销而日志项目目录仍被锁 → 只 `logger.warn`（"启动孤儿清理将兜底"），RPC 不带病报成功也不误伤玩家；孤儿留给既有的 `sweepOrphanSessionLogs` 启动期收。写卡 agent 也纳入销户撤单（原版只摘名册不停业）。
- **验证**：vitest 297/297（新增 `loader-composition.spec.ts` REAL composition 三锚：销户成功路径 / 工作空间 rm 全败抛错且绑定保留、解锁后重试销净 / 日志侧锁死降级不炸 RPC——POSIX chmod 锁定面，Windows skip 注明真机测）；tsc host/client、oxlint 干净（预存 presets 警告与本改无关）。**Windows 真机待复测**（回合进行中删除、编辑页开着删除、以及日志侧锁死三个场景）。

## 2026-09-23 Windows 卡脚本全部 exit(1)：卡脚本 v2 的单引号命令面过不了 Windows PowerShell 5.1（已修：runner 落文件 v3 命令面）

- **现象（Windows 真机报）**：dnd5e 卡左上面板 `hud-left` 报 `脚本失败(exit 1)`（显示面 = vendored `preset/ui/runtime.mjs:55-57`，`failure.reason=exit, exitCode=1`）；macOS 同卡同操作正常。面板数据泵 = `preset/scripts/ui_data.mjs`（前端 `tavern.runScript` → `runCardScript`），内容层面已核跨平台中立（相对读全正斜杠、`pathToFileURL(process.cwd()+'/../preset/lib/core.mjs')` 经 `path.resolve` 归一混合分隔符与 `..`）、本地 POSIX 面复刻命令字节级跑通（exit 0）——故障指向装载链。
- **证据链（kernel 源码核读 + 本机抽验）**：
  1. tavern 引擎 `static inject = ['…','shell','…']`（`packages/engine/src/index.ts:277`），脚本执行走 `runCardScript`（`packages/engine/src/prompting.ts:378-397`）把卡脚本包成**单引号命令串** `node -e '<解码器>' -- <b64脚本> <b64参数>`（`packages/engine/src/tools.ts:88`，设计注释声明「unix faces + pwsh shell 中立、解码器源无单引号」）。
  2. Windows 上这个 `ctx.shell` 是 **PowerShell 执行器**、不是 bash：dsh-base 组装面 `bash-sandbox` 在 win32 禁用、`pwsh-sandbox` 在 win32 启用（`@deepseek-ai/dsh-base/cordis.patch.yml:214-222`，本仓 `packages/bundle/cordis.patch.yml` 无 shell 行 → 继承默认）。
  3. 执行形态：`[pwsh -NoLogo -NoProfile -NonInteractive -Command <前导+整条命令串>]`（`dsh-pwsh-local/lib/index.js:271-280`），中间无第二层 shell；PowerShell 把 `'…'` 当字符串字面量消费后，**将参数重新序列化给 node.exe**。
  4. pwsh 解析顺序：先 `%ProgramFiles%\PowerShell\7\pwsh.exe`、再 PATH、兜底 **`System32\WindowsPowerShell\v1.0\powershell.exe`（Windows PowerShell 5.1）**（`dsh-pwsh-local/lib/index.js` candidatePwshPaths）。
- **根因**：PS 对原生 exe 的参数再序列化分代——**pwsh 7.3+ 默认 `$PSNativeCommandArgumentPassing = Windows`（node.exe 不在 Legacy 白名单 → Standard）**，内嵌双引号按 MSVCRT 转义，node 收到逐字的解码器，命令成立；**Windows PowerShell 5.1 只有 Legacy 式传参**：解码器（`tools.ts:87`）无空格 → 不包引号直接拼接，其**内嵌双引号**（`"base64"`/`"utf8"`/`"data:text/javascript;base64,"`）裸现于命令行，被 CommandLineToArgvW 当引号定界剥掉 → node 的 `-e` 实参碎裂 → **SyntaxError → 子进程退出码 1**。「无单引号」不变式保护了 POSIX 与 pwsh7，未保护 5.1 的引号剥离面。
- **可见面只是冰山**：`hud-left` 是唯一纯前端消费者所以最先显眼；同一缝隙下**全部卡脚本**（`preset/tools/*` 的工具、提示词 `{{…}}` 脚本）在 PS 5.1 真机上同样 exit(1)，模型面表现为静默失败。
- **鉴别面（真机一步定位）**：失败回执的 `[stderr]`——① `SyntaxError`（指向 `data:text/javascript;base64`）= 引号剥离本路径；② stderr 空且恰 ~10s = 超时击杀（`TOOL_TIMEOUT_MS = 10_000`，Windows 下 Job 击杀子进程同样结算为 `exit code 1` 无信号标记，`dsh-tool-pwsh` 已注明）；③ `The term 'node' is not recognized` = PATH 缺 node。可证伪检查：Windows 真机装 PowerShell 7（≥7.3）后同卡应复原。
- **修复（已落码：卡脚本 v3 = runner 落文件）**：命令面改为 `node <runner> <b64脚本路径> <b64参数载荷>`，三个调用点（`prompting.ts` 两处 + `tools.ts` 卡工具）改传脚本**路径**而非文本。
  1. **runner 落文件**（`packages/engine/runner/runner.cjs`，随 package `files` 分发，src 直跑与 bundled lib 双面经 `../runner/runner.cjs` 解析）：POSIX 单引号加 `'\''` 转义、win32 双引号——路径引号打不坏，因为 `"` 是 Windows 路径非法字符集成员，PS 5.1 剥无可剥；`--` 分隔符退役（b64 字母表不可能以 `-` 开头）。**base64 仅保留给参数载荷**（shell 中立字母表的本职），脚本文本不再上命令串。
  2. **相对 import 红利**：脚本按真实文件路径 import（不再是 data: 模块），卡脚本内的相对 import 自然成立；落盘 hardening（exit 排空轮询 / 首 exit 后吞输出）逐字节移植旧内联解码器。
  3. **鉴别面升级**：脚本缺失属 TOCTOU 窗口 → runner 捕 import 错误、stderr 带栈、exit(1)——排序在回执 `[stderr]` 节，天然可辨。
- **验证（本机）**：vitest **298/298 绿**——新增 REAL composition 锚「卡工具 REAL spawn」（composed 真 shell 缝 + 真 runner 进程跑 `weather` 工具，回执 `Exit: 0` + stdout 进过会话日志）；**Windows CI 通道就是 PS 5.1 面的真锚**（三平台 CI 都跑这具锚，win32 = pwsh 执行器真 spawn）。`runner/runner.cjs` 补测三面（300KB 大 payload 排空 / 失败 stderr+exit 1 / 相对 import）。tsc、oxlint 净增零。
- **防盗号注**：macOS 本机无法生产 PS 5.1 行为——`docs/notes/devlog.zh.md` 该条的真机复验步骤（PS 5.1 环境复现旧 exit(1) + 新版复原）留给首次 Windows 真机。

## 2026-09-23 干净检出构建必红：typert 生成物必须携带（生成器无法在仓外运行）

- **现象**：GitHub Actions 6 个 job 全红（Ubuntu / macOS / Windows × Node 22/24），且**本机全绿**——同一提交两处结论相反。CI 日志：`pnpm install --frozen-lockfile` ✅、`pnpm lint` ✅、`pnpm build` ❌、`pnpm test` ⏭ skip；错误为 `packages/api/src/client/index.ts(10,26): error TS2307: Cannot find module 'dsh-tavern-fengyue-api/remote'`。
- **证据链**：① 该裸导入经 `exports["./remote"]` 解析到 `lib/typert.remote-client.d.ts`，client face 的 `tsc -b` 需要它已存在；② 这四件是 **typert 生成物**，由 `@deepseek-ai/dsh-typert-generator` 的 tsdown 插件在上游 host pass 产出；③ 本仓根 `tsdown.config.ts` 是上游同文件**删掉了 `typertPlugin` 的 import 与 `plugins:` 一行**（diff 实测仅此两处 + 有意的 `workspace` 变动），故本仓**没有任何环节产出它们**；④ 上游 `.gitignore` 同样忽略 `lib/` 与 `.typert-*/` —— 上游是**生成**而非提交；⑤ 本机 `packages/api/lib/` 里躺着快照期（`tavern-extraction-2026-09-17 / 078257c`）手工拷回的四件，**被 `lib/` 规则挡在 git 之外**，所以"本机绿"是陈旧产物撑出来的，干净检出必红。
- **根因（两层）**：
  1. **直接原因**：本仓依赖"生成物已存在"，却没有把它们纳入版本控制（`.gitignore` 的 `lib/` 一刀切）。
  2. **深层原因（为什么不能改为在本仓生成）**：生成器只在"protocol 的声明属于被分析工作空间的工程"时才承认 `@Remote`。`analyzer.js`：
     ```js
     isTypeMetaSymbol(node, name) {
       const registration = this.registrationForFile(declaration.getSourceFile().fileName);
       if (registration?.name === '@deepseek-ai/dsh-typert-protocol') return true;   // ← 关键
       ...  // 或声明词法位于 declare module '@deepseek-ai/dsh-typert-protocol' {} 块内
       return false;
     }
     ```
     而 `registrationForFile()` 的那张表**只从 face aggregate tsconfig 的 `projectReferences` 建立**，且要求被引用目录在 `<root>/packages` 下。上游 protocol 就在同仓（`packages/typert/protocol`，被 `tsconfig.host.json` 引用 + `paths` 指源码）故通过；本仓 protocol 是 npm 已发布包（`node_modules/@deepseek-ai/dsh-typert-protocol@0.1.5-rc.2`），永不进 `projectReferences`，故判定**恒为 false**。后果是**静默**的：每个方法的 `remoteMarker()` 返回 `undefined` → 整个类被跳过 → 模型 `invocations: 0` → 不产出 remote 构件 → 而 `package.json` 声明了 `./remote` → `validateExport()` 才 fail loud：`typert(host): dsh-tavern-fengyue-api publishes Remote artifacts but has no Remote methods`。
- **修复**：四件生成物纳入版本控制——`.gitignore` 放行 `!packages/api/lib/` + `packages/api/lib/*` + 四条 `!...typert.*` 例外（注意顺序：git 无法重新包含"父目录已被排除"的文件，必须先放行目录再逐条放行文件；`lib/index.js`、`lib/client.js`、`lib/types/**`、`*.tsbuildinfo` 照旧忽略）。根 `tsdown.config.ts` 的注释改写为"本仓**不**在此跑 Typert"（原文案沿袭上游"runs Typert"，与实际不符，正是本次误判的起因之一）。依据与再生成流程写进 `packages/api/REGENERATE.md`。
- **验证**：① 忽略规则逐条实测（四件 not ignored；`index.js`/`client.js`/`types/**`/tsbuildinfo 仍 ignored）；② **干净检出模拟**：删掉所有 `packages/*/lib` 与 `*.tsbuildinfo`，只 `git checkout -- packages/api/lib` 还原受跟踪内容（其余包 `lib/` 为空），`pnpm build` **exit 0**；③ `pnpm test` 22 文件 / 294 用例全绿；④ 推 `main` 后由 CI 矩阵自证。
- **防复发**：① "本机绿"不等于"干净检出绿"——凡涉及生成物/构建产物，验收一律以**干净检出模拟**（清空 `lib/` + tsbuildinfo + 只还原受跟踪内容）为准，这已写进 REGENERATE.md 与本节；② 从上游抄配置文件时，注释与代码要一起核对（沿袭的注释会掩盖被删掉的行为）；③ 仓外插件若依赖"上游同工作空间才能生成"的产物，必须在文档里写明**携带**而非"可再生成"。
- **两条备选方向（尚未落地，明确记录）**：
  - **（b）vendor protocol 源码**：把 `packages/typert/protocol/src` 作为工作空间工程引进本仓（命名须为 `@deepseek-ai/dsh-typert-protocol`，并在 face aggregate 里引用），使 `registrationForFile()` 可匹配，从而在本仓内真正生成、摆脱快照冻结。**这不是改造 protocol**，而是取未改动快照（本仓已有 `packages/vendor-ui-*` 三例先例）。代价：需连依赖子树一起 vendor，且运行时仍须走已发布包（否则与 typert-loader 的所有权/协议校验冲突）。属独立立项。
  - **（c）当上游问题提 PR**：`isTypeMetaSymbol` 的"必须同工作空间"是生成器对**所有仓外插件作者**的通用限制，而"仓外 dsh 插件"本身是受支持场景（本仓即证据）。向 `deepseek-harness` 提案：支持按包名匹配，或让 protocol 解析位置可配置。走通即根治、可跟最新 dsh。按本仓 `CLAUDE.md` 第 1 条，依赖侧行为变更正该以 PR 落在依赖仓库而非本仓打补丁。
- **快照冻结的代价**：四件冻结在 `078257c`；dsh 升级若触及 RPC 面或 typert 协议，所有权/协议校验会 fail loud，须回 monorepo 重跑 REGENERATE.md，并与版本地板三件套（四个 `package.json` 的 version、`dsh-compatibility.json`、peer 范围）同批动。

## 2026-09-21 叙事agent默认工具开关 v5：旗标落 meta.json 显式字段 + 指示/开关竖列排版

- **现象（用户裁定）**：①「checkbox 根本保存不了——点掉以后重新打开卡片又恢复了，就不能存在一个什么 json 里？meta.json 也行啊？」②「是否允许使用 tools 的 checkbox 应该和是否开启数据维护（tail agent）的指示放在同一竖列」（v4 我又把排版改成了同排横列，接续第三次返工）。
- **根因**：v3/v4 把旗标藏进 `preset/.narrator-tools-off` 隐藏 dot 文件 —— 用户不可见、不可手查，「保存到哪了」无从对账；而「重新打开卡片」走卡库再导入，旗标只经发布/编辑保存汇入卡库，任何一步没走保存链就表现为「恢复勾选」。观感即 bug：身份字段必须是显式 JSON。
- **修复**：旗标迁为 `preset/meta.json` 的显式布尔字段 **`narratorTools`**（缺席/true = 开，false = 关；`readCardMeta` 增列，_TavernCardMeta_ 增可选字段；身份编辑的字段保真序列化天然保它）。UI 翻转 = 读 meta → 容错解析 → 置字段 → `writeText` 整文件写回（`flipNarratorToolsRpc` 改异步）；引擎 `writeText` 命中 `preset/meta.json` 即 re-sync 工具面；引擎读面 `narratorToolsOn(root) = readCardMeta(root)?.narratorTools !== false`，隐藏 dot 标记机制全撤。布局：`actionCol` 竖列容器 —— 数据维护 chip 与 narrator checkbox 纵向堆叠，该列与保存/保存并开始同处 idActions 一排。
- **验证**：workspace.spec 边界用例改 meta 断言（publish → 编辑保存 → 导入三点 `readCardMeta().narratorTools` + 身份字段保真）；REAL 用例改 meta 读改写翻转（盲面与复得均经真实 writeText）；UI client spec 断言翻转写出的 meta 含 `narratorTools:false` 且原 title 字段保真、锁灰态点击零写；全套 255/255、typecheck 双面零错、双面重建。
- **防复发**：卡身份的一切默认态，落显式 JSON 字段（meta.json），永不落隐藏文件 —— 可见性即 可信性；同排/同列等排版谓词以用户视角的空间关系为准，实现前先复述确认。

## 2026-09-21 叙事agent默认工具开关 v4：可改窗口收窄到「对话开始之前」+ 动作区同排排版

- **需求（用户裁定）**：①checkbox 的开关是**卡的身份**，可改窗口 = 还没开始对话（选卡/建卡/编辑卡都属开局窗口），对话开始后置灰；②点掉即存（ Always 始终写当前工作区），保存/保存并开始必须携带；③排版：checkbox 与数据维护 chip 同排，且二者与「保存/保存并开始」同一行（撤 v3 的强制换行）。
- **实现**：`state` 端点语义分层加列 `dialogStarted`（durable 日志存在 `user/message` source.kind=user 即真；`hasPlayerTurn` 与 `lastPlayerText` 同一扫描面）——载入存档的快照认领计入「已开始」，开局（含载入前的首屏）为 false。WorkspacePanel checkbox 依此 `disabled` + `.optRowLocked` 置灰；DraftPanel（建卡/编辑）按定义处于开局窗口，恒可点。排版撤 `.optRow` 的 `flex-basis:100%`，与 chip 同属 `idActions` flex 行。格式上 v2 的教训保持成立：不加 wire 方法，`dialogStarted` 是既有 state 响应的加列。
- **验证**：REAL 用例加线断言（createSession 后 false → 首回合 after whenIdle true）；UI client spec 加「dialogStarted=true → disabled 且点击不产生 writeText」用例；全套 255/255、typecheck 双面零错、双面重建。

## 2026-09-21 叙事agent默认工具开关 v3：旗标迁 preset 随卡携带——修「保存后刷新又恢复」+ 撤「跑动卡置灰」

- **现象**：①建卡页点掉 checkbox → 保存并开始 → 刷新，勾选态恢复；②用户据 v1/v2 行为推断「只有建卡/编辑卡能点、跑动的卡不能点」，要求把这种场景的 checkbox 置灰。
- **根因**：v2 把标记放 `runtime/` —— runtime 作世界状态在导入/清空/再播种时整体蒸发，旗标不随卡走。「保存并开始」把卡收进卡库后新会话导入播种，`runtime/.narrator-tools-off` 天然不在 —— 建卡页的 checkbox 成了空头支票。置灰诉求其实是同一根因的另一面：旗标没能在它该存在的地方（卡体）持续存在。
- **修复**：标记迁 `preset/.narrator-tools-off` —— 发布(publishWorkspaceCard)、编辑保存(publishIntoLibraryCard)、导入(importCardPreset) 三条边界都是 preset 整目录 cpSync，旗标作为卡体属性全链路携带（dot 前缀在编辑器 listTree 隐藏；存量卡缺席 = 开零迁移）。跑动的卡随时可点（写本工作区 preset，跨重载与清空持久）—— **不存在"不能点"的场景，无需置灰**。清空/reset 保留 preset，旗标是工作区特质而非存档历史。UI/engine/测试三处路径常量同步，DraftPanel 注释更新。
- **验证**：workspace.spec 新增卡边界携带单测（publish → 编辑回写 → 导入三点 existsSync 断言 + listTree 隐藏断言，导入路径实证「新会话 checkbox = 建卡时的选择」）；loader-composition REAL 用例换 preset 路径重跑；全套 vitest 绿 + typecheck 双面零错。
- **防复发**：每工作区性质的状态放哪里，按「它应否跨越工作空间生命周期边界」决定 —— 随卡 → preset/（整目录拷贝自动携带）；随局 → runtime/（播种蒸发是特性不是缺陷）。v2 的失误不是通道选错（writeText/fileOp 仍对），是持有位置语义选错。

## 2026-09-21 叙事agent默认工具开关：根目录标记驱动的条件注册

- **需求**：右上角维护 chip 下方加 checkbox（默认勾选）——关闭即主 agent（叙事agent）看不到任何工作区（引擎默认读工具 `runtimeRead`/`runtimeGrep` 收走）；尾代理面与卡自带工具不动。上一轮「内置工具目录化」方案已否决，本条在保持引擎实现的前提下给每工作区加开关。
- **设计要点**：引擎侧每工作区布尔无先例，取根目录 dot 标记 `.tavern-narrator-tools`（内容 `off` = 关、缺席 = 开——存量卡零迁移，与 `.tavern-writer` 同族、处于编辑器 writeText 围栏之外、随存档/发表都不走）。`registerMainAgentTools` 增可选 `runtimeToolsOn` provider，read pair 与卡条目同进 sync 的 disposer diff（成对增删；缺省参数恒 on，既有调用与测试零迁移）。内核 tools 收集先于 assemble waterfall，标记翻转必须经返回的 sync 才落当前请求——`setNarratorTools` RPC 写/删标记后复用 `syncCardTools` 同一路径；`state()` 增 `narratorToolsOn` 供 UI 恢复勾选态。
- **实现陷阱**：REAL 用例（盲面 → RPC 重开 → 明面）收尾必须 waitFor 全部请求落定 + `tailRunning:false`，否则 afterEach 的 `fiber.dispose` 吊死在在途尾 fork（首跑 10s hook timeout 的根因；adapter 耗尽本身抛 LlmError，不是挂起形态）。
- **验证**：typecheck 双面零错；全套 253/253——新增 tools.spec 盲/开双向（assemble 再同步）与无工具卡盲面、loader-composition REAL（盲面主请求只余 weather、尾面五件齐、`state.narratorToolsOn: false`、RPC 翻转后当前请求即见 read pair）、UI client spec 的 mock 与 checkbox 翻转断言（该目录仍属已知 glob 缺口，不进默认套件）。

## 2026-09-21 叙事agent默认工具开关 v2：撞上 typert 冻结契约——翻转改走 writeText/fileOp 既有通道

- **现象**：实机点右上角 checkbox，每击报 `tavern rpc: namespace lacks method "setNarratorTools"`，乐观翻转回滚（点不掉）；一击一报。
- **根因**：v1 走了「新增 @Remote wire 方法」的捷径，违反 09-20 裁定——本仓没有 typert 生成器，客户端 manifest 冻结不可再生，新方法永远进不了浏览器侧命名空间（服务端有注册、客户端无路由 ≠ 双向可用）。同日懒加载树条的结论（扩展只许两通道：卡脚本 / 既有端点语义分层）被自己复犯。
- **修复**：① `setNarratorTools` 双端全撤（api @Remote + face + Request 类型、ui rpc 适配、engine 方法）。② 标记迁 `runtime/.narrator-tools-off`（`writeWorkspaceText` 围栏本就放行 runtime/ 全路径，dot 前缀对齐 `.writer-sessions.json` 先例、编辑器树不可见；runtime 再播种＝回默认开）。OFF = `writeText(path, 'off')`、ON = `fileOp delete`——引擎 `writeText` 命中该路径走 `syncCardTools`（fileop 本就全量 sync），翻转落在当前请求边界（内核 tools 收集先于组装）。③ 建卡/编辑卡页（DraftPanel）补同款 checkbox：随 2s 轮询 readText 读标记（读失败 = 缺席 = 开）+ 乐观翻转失败回滚，与工作空间页共用 `flipNarratorToolsRpc` 帮手。`state.narratorToolsOn` 字段保留——响应加列属两通道定案允许的「既有端点语义分层」。
- **验证**：REAL 用例改走真实翻转通道（engine.writeText 写标记 → 当前请求盲面：主请求只余 weather、尾面五件；fileOp 删除 → 下一请求复得 read pair）；UI client spec 断言改打 writeText 载荷；typecheck 双面零错；全套 253/253 绿。教训入档：动 wire 前先对 09-20 红线自查——「编译过」仅证明源码自洽，浏览器侧的冻结 manifest 不收购任何新方法。

## 2026-09-21 懒加载树 + 写卡会话标签条：typert 冻结期的正规重建（卡脚本通道 + 既有端点语义分层）

- **背景**：前版两需求（懒加载树/清空写卡会话）因手改 typert 生成物被整体回滚（09-20 回滚条）。本条 = 「不改内核与 lib」约束下的重建，先经内核逻辑逐项检验定案。
- **设计定案（约束推演）**：wire 冻结期扩展只走两条通道——①**卡脚本**：`runScript` 的字符串参数协议（卡内容自有，rulebook 先例）；②**引擎对既有端点/内核原生字段的语义分层**（engine 是我们的代码，只要不加不改 wire 方法即自由）。被否路线留档：`deleteSession` 语义分派（writer id / 主会话 id 同一调用的破坏半径不对称、契约含义被破坏、把内核 `not-session` 错误路径当模式标记——同类错误的手法换马甲）；`ensureWriter` 哨兵（隐藏语义）。
- **懒加载树（1A 卡脚本）**：dnd5e `preset/scripts/fs_tree.mjs`——`{op:'list',path}` 单层 / `{op:'levels',paths}` 批量（轮询一次 spawn 刷根层+展开层）；三区围栏（preset/runtime/savings+根层，resolve 包含判断）；**跨平台**：入参反斜杠归一+重复斜杠折叠（冒烟抓出）、围栏 resolve 后比较、输出恒 POSIX、dirent 判定。CardEditor 双模：挂载探测 fs_tree——可用 = lazy（真·点开才取，walk 门 = 展开∧已加载）；缺席 = full 回退（整树 RPC，仅渲染层折叠）——旧卡零破坏。轮询保持 B 节奏（2s 活动/8s 空闲），lazy 一次 levels、full 一次 tree。增删改：lazy 刷受影响父层（pruneSubtree 作废旧子树缓存）、full 重载整树。
- **写卡会话标签条（用户定案）**：**stock `create({cwd})`** 开新会话（内核原生"同 cwd 新开"，blank by definition；root 取自 RP 会话 SessionSummary.cwd）——不走 ensureWriter。标签条 ‹ n/m › ＋ × 贴写卡列顶部；注册表 = `runtime/.writer-sessions.json`（点号开头编辑器树不可见；sessions + deleted 墓碑两节）。
- **引擎侧两件（纯内部，wire 零改）**：①`onAgentCreated` 写卡识别 cwd 化——writers 映射 miss 后按「header.cwd = 工作空间根 ∧ 无 parentSession 血统（fork 存档分支与尾孩子同 cwd 但非 writer）」合成（引导 section + approval never），stock 自建会话才能吃到写卡身份；②**writerLogGC**（镜像 `sweepOrphanSessionLogs`）：boot 排空墓碑——只删墓碑点名的 id 目录（精确匹配，主/尾/fork 日志不碰），rm 失败者保留墓碑下次再清，排空后消费墓碑；**遗留迁移种子**：registry 缺席而 writers 映射有旧 ensureWriter writer → 自动成为标签 1（历史不丢）。projectKeyOf 转正 public（纯编码器，测试定位项目目录）。
- **删除语义（内核姿态对齐）**：× = UI 即时全下线（停在途回合 `rpc.stop`、摘标签、refresh 对账 stock 列表、不可寻址不可恢复）+ 磁盘目录 boot GC 排空——与「内核 wire 无删除、日志永久、GC 只在 boot 无活 agent 时点」的既定哲学一致；`session.lock`+`session.v3.jsonl.zstd` 随目录整体消失（实查活体存储：纯目录结构无中央索引，删目录即 listSessions 收敛）。
- **实现陷阱**：①useDialogs 返回对象每渲染新身份——进 createTab 依赖链会把挂载 effect 变成死循环（重复建会话），按 house 模式改 ref 载荷（deps 只认 rpc/sessionId，换工作空间必重读）；②新建会话 durable 目录惰性落盘——GC 测试用 projectKeyOf 直接定位项目目录伪造日志。
- **验证**：typecheck 双面零错；全套 250/250（新增 REAL 用例：cwd 合成——stock create 路径的会话 system 含引导且 approval never 落 durable；writerLogGC——重启排空墓碑、活日志与主会话日志原样、墓碑消费）；fs_tree 冒烟（levels/围栏拒绝/反斜杠归一）。

## 2026-09-20 回滚「清空写卡助手」+「懒加载目录树」：typert 生成物 = 内核，不可手改

- **裁定（用户）**：宁可不加新需求，也不能改内核或 lib。两个需求的实现（清空写卡 Agent 会话、编辑器懒加载目录树）因都要动 `packages/api/lib/typert.*` wire 生成物而整体回滚；回滚干净后重新设计实现路径。
- **根因复盘**：typert 四件生成物是浏览器↔宿主的接口契约清单，由源码 `@Remote` 经生成器机器生成（母仓 build 挂 typertPlugin，lib 纯产物、清空可复原）。本仓 09-17 抽取时只带了 loader/protocol/registry 三个运行时包、**没带 generator**，build 不再生成——四件成了 gitignore 目录里无人跟踪、无法再生的手工文件。本次实现走了「手工扩展生成物」的捷径（机械复制 ensureWriter 同形块），违反了「源码是唯一真理、产物由构建生成」的不变量。
- **回滚清单**：typert 四件逆向恢复至与抽取快照**字节级一致**（已与 learn_code 母仓副本 + 包名 sed 逐一 diff 验证）；`REGENERATE.md` 恢复原文；api 源码撤 `TavernResetWriter*`/`TavernTreeRequest` 与对应 face/@Remote；engine 撤 `resetWriter`、`tree` 还原全量签名、`listTree` 还原递归版；CardEditor 数据层还原 initialArea 版（entries 扁平态 + landInitialArea + reload）；WriterColumn/chat-view 撤清空 UI 与 extraSeats；locales/CSS 撤 `writer.clear*`/`.writerClear`；测试撤 resetWriter 用例、workspace.spec tree 用例还原。
- **保留面（不受裁定影响）**：自绘弹窗 dialog.tsx 及 16 处原生弹窗替换（独立需求，不碰 wire）；轮询治理 B 档（writerActive 活动信号 → 2s/8s 双档，纯 UI，activity 上报保留）；CardEditor `initialArea`（并行工作）；dnd5e 规则之书删除。
- **重建路径（09-21 已落地，未走生成器）**：两需求在 wire 冻结约束下经「卡脚本通道 + 既有端点语义分层」重建（见 09-21 条），typert 四件保持抽取快照原样；生成器 vendor 仍为 wire 解冻前的长期项。
- **验证**：typecheck 双面零错；全套 245/245；preset 与 packages 全文 grep resetWriter/TavernTreeRequest/loadedDirs 等零残留。

## 2026-09-20 设置页轮询治理：请求集瘦身 + 活动自适应节奏（A+B）【A 随懒加载树回滚，B 保留】

- **现象（用户质询）**：设置→文件页一直在刷请求。盘点 = 两个 2s 轮询器叠加：`useCardIdentity`（meta.json ×1，封面路径变化才追加 readAsset）+ CardEditor（tree × (根层+每个已加载/已展开目录) + readText 选中文件）——懒加载改造后默认落点稳态 ≈ 6 帧/2s，每多展开一个目录每 tick 再 +1；懒加载前是 3 帧/2s（全量 tree ×1），请求条数近乎翻倍（服务端每次更便宜但线上条数确实变多）。传输为 WebSocket 多路复用，刷的是 ws 帧。
- **根因**：writer（fs/bash 工具）与尾代理（runtimeEditor 系）都在服务端直接改工作空间文件，文件系统无变更推送通道，引擎只在会话事件流发事件——编辑器只能盲轮询兜底。**但有事件信号可用**：writer 会话流的 `tool/call`（粒度只能到"有活动"，bash 写盘路径不可知）、主会话的 `command/done(tavern-tail-done)`——这是后续 C 方案（事件驱动）的原料。
- **A（请求集瘦身）**：CardEditor tick 只刷 根层 + **展开层**；塌着的已加载层不再被轮询，改为 **toggleDir 展开那一刻后台重验**（展开即时生效、子层从缓存渲染、重验合并换血）——可见性与新鲜度对齐：塌着时看不见的东西不需要新鲜。未落点的 runtimeAuto 额外保留 runtime/ 轮询（播种检查）。
- **B（活动自适应节奏）**：WriterColumn/WriterChat 上报 `onActiveChange(running||pending||thinking||texting)` → DraftPanel/WorkspacePanel 持 `writerActive` 态 → CardEditor（`writerActive` prop）与 `useCardIdentity`（新 `pollMs` 参数）双档：**2s 活动 / 8s 空闲**。空闲=回合没在跑=工具没在执行=不可能有新写盘（工具执行都在回合内），8s 纯兜底；落点未定时保持快档（播种检查不拖沓）。**已知边界**：RP 主会话的尾代理写 runtime/ 感知不到 writer 活动信号，已展开层最多陈旧 8s、塌着层靠展开重验兜底——C 方案（监听主会话尾信号）才能根除。
- **验证**：typecheck 双面零错；全套 243/243。稳态空闲 ≈ 4 帧/8s（根层+2 展开层+选中文件+meta，活动档同集 2s）。

## 2026-09-20 runtimeUpdate → runtimeEditor：与内置 str_replace_editor 等价 + .json 写前 parse 校验

- **需求（用户裁定）**：`runtimeUpdate` 的全文重写模型换成与内置编辑器（`dsh-tool-str-replace-editor`）**语义等价**，差异只留两点——workspace 固定 `runtime/` 与硬围栏（realpath 包含）。动机复核：世界状态 JSON 的 str_replace 曾被视为脆（缩进/转义漂移、多匹配歧义），但「多命中即拒绝 + 行号引用」（对齐内置）配合 `runtimeRead` 先读再改的工作流，误差面比"模型整档重抄"更小——大 JSON 的整档重抄错误才是静默数据损毁主通道。
- **落地（tools.ts）**：`runtimeEditorTool` 四命令逐条镜像内置——`view`（cat -n 六位行号、`view_range=[start,end]`（end=-1=EOF）、目录两层级 listing、`<response clipped>` 截断）、`create`（已存在拒绝，文案对齐 stock）、`str_replace`（0 命中 did-not-appear、多命中 `Multiple occurrences … in lines [a, b]`、省略 new_str = 删除匹配）、`insert`（0-based 行位，0=顶部、len=追加）。**超出 stock 的两件**：路径一律 `runtimePath` realpath 围栏；所有变更命令在落盘前对**编辑后的整档** `.json` ⇒ `JSON.parse`，坏则拒绝且**什么都不写**——dnd5e design 挂账的 "write-guard 施工项" 以工具边界一段并入，读侧 fail-loud 兜底。
- **面变化**：尾 fork = `runtimeRead`/`runtimeGrep`/`runtimeEditor`/`runtimeDelete`（`runtimeCreate`/`runtimeUpdate` 删除）；主代理面不变（读对 + 卡工具）。
- **迁移面**：dnd5e/dnd 两卡 maintenancePrompt 的工具用法段（全文重写 → str_replace 精确替换；建档 → `command:"create"`）；文档（engine README 双语、design_zh 工具表与 scoped 注册段、prototype README、api types 注释、dnd5e panel-data/design 的 write-guard 与直改描述——历史 devlog 条目保持原样）。与并行的懒加载目录树合流无冲突：`runtimeEditor` 是尾面工具，CardEditor 是人手编辑器，两不相干。
- **测试**：tools.spec 重写 runtime 段（唯一性行号引用/删除语义/insert 边界/view_range 切片/目录两层级/.json 拒写现场验文件未动/escape 围栏复测）；loader-composition 尾脚本步骤换 runtimeEditor——create deed、str_replace deed、str_replace state.md（注意 state.md 由 probe-card 的 setup 播种**已存在**，create 会拒，用 str_replace 'day 1'→'存档后续'）。
- **验证**：engine 全量绿；构建后 `restart --bg` 换上新引擎（dev server 必须 `--bg` 起独立进程——前台起法会被发起方 shell 一并带走，本日已栽过一次）。

## 2026-09-20 编辑器懒加载目录树 + runtime 优先落点【已整体回滚；09-21 经卡脚本通道重建，见 09-21 条】

- **需求**：①打开工作空间编辑器时，runtime/ 有内容就**只**展开 runtime/（其余默认层全部折叠）；空着就默认展开 preset；②除默认展开的目录外，其余目录不预先加载——点展开的那一刻才拉取该层。
- **wire 侧（tree 单层化）**：`tree` RPC 请求加可选 `path`（`TavernTreeRequest`），语义从「全量递归扁平表」改为「一次列一层」——缺省 = 根层（三个固定目录，未播种也照常声明存在），`path` = 该目录的直接子项（fenceIn 围栏 + 三个固定 area 前缀白名单 + 隐藏条目跳过 + 文件路径/越界前缀空手而归）。typert 生成物第二轮手工扩展（tree 的 param schema 加 `'path': z.string().readonly().optional()`——与 prompt 的 `clientTimeZone` 同款可选字段形态；typeSymbol 换 `TavernTreeRequest`；host 类型清单、remote-client.d.ts 的 face 与 dispatch 两行同步），REGENERATE.md 留言已更新。跨版本降级双向无害：旧宿主（schema 剥掉 path）回全量表 = 新 UI 拿到超集照常渲染；旧客户端拿根层 = 只见三目录不展开，不崩。
- **UI 侧（CardEditor 数据层重写）**：`entries` 单一扁平态 → `listings`（按父目录分片的 Map，`''` = 根层）+ `loadedDirs`（已拉取集合）+ `openDirs`；**walk 下钻门 = 展开 ∧ 已加载**（内存表模式旁路）。`toggleDir` 对未加载目录先 `fetchDir(path)` 再展开——点开那一刻才拉取。挂载序列：根层必拉 → runtimeAuto 预拉 runtime/（根层只看得到目录本身，空不空要拉一层才知道）→ `tryLand` 落点 → 落点函数自己 `ensureFetched` 新展开层。**writer 轮询只刷 `'' + openDirs ∪ loadedDirs`**——塌着的、从未打开的层零成本（原实现每 2s 全量递归走一遍盘）。
- **落点规则（tryLand，只决定一次）**：runtimeAuto 且 runtime/ 有文件 → `openDirs = 首选文件（state.md 优先，否则字典序第一）的目录链`，**替换式**设置（其余默认层折叠）+ 选中该文件；runtime/ 空 → 默认展开 preset，等播种后的轮询再落（玩家点过任意树行 `landed` 置位，自动落点永不再打扰）。preset 模式（编辑卡/建卡/导入预览）维持 preset 展开。
- **增删改的缓存一致性**：`pruneSubtree(path)` 作废被删/被移路径的整棵子树缓存（listings 分片、loadedDirs、openDirs 三处同滤），随后只重拉受影响的父目录层（新建拉所在层；重命名/移动/拖拽拉新旧两个父层）——替代原 `reload()` 全量刷新。新建的行内命名态先落，列表回来后新条目行就地进入命名态。
- **验证**：typecheck 双面零错；workspace.spec 的 tree 用例按单层契约重写（根层三目录、按层拉取、深路径不预载、空目录合法、越界/文件路径空手而归）——注意骨架 prompt 下有 maintenancePrompt/postPrompt，断言用 contains 不用全等；全套 243/243 三轮连跑稳定绿（中途一次 242/243 为同期 runtimeEditor 迁移在飞窗口的时序失败，迁移落地后消失）。

## 2026-09-20 写卡助手「清空」+ 全部原生弹窗自绘化【清空部分已回滚（typert 内核裁定），自绘弹窗保留】

- **需求**：①写卡 Agent 列的模型席位旁加「清空」——清掉写卡助手的记忆（上下文）与聊天历史（durable 日志），二次确认后生效；②全仓 `window.alert` / `window.confirm`（13 + 3 处）全部换成自绘弹窗。
- **清空语义（对齐既有先例）**：与 RP 清空同哲学——durable 日志从不重写，永远换绑新会话。差异点：RP 清空旧会话**归档保留**（存档是玩家的纪念物），writer 清空旧日志**直接删除**（writer 会话是脚手架不是纪念品，每次清空留一份归档会让 project 目录无界膨胀）。引擎 `resetWriter`：cancel 在途回合（`agents.cancel({kind:'user'}, {keepInbox:true})`，deleteSession 同款防持久化写手在 rm 后重建目录的竞态；writer 无尾 fork，无 stop() 的 stopped 标记面）→ 摘 `writers` 映射行 + 删 `<sessionsRoot>/<projectKey>/<旧writerId>/` 日志子目录 + 删 `.tavern-writer` marker → 复用 `ensureWriter` 组合全新会话并回传新 id。卡文件零触碰。
- **typert 生成物手工扩展（本条的核心教训）**：加 RPC 惯例是回 harness monorepo 再生成（REGENERATE.md），但本仓 typert 生成器缺席、harness 副本的 tavern 源已落后且构建状态未知——为一个 `{sessionId}→{sessionId}` 的同形 RPC 跨仓重建不值得。核实 typert-loader **无哈希/完整性校验**（只验包名所有权）后，把 `ensureWriter` 的四段生成物（remote-client 与 host 的 schema 常量 ×2 + 方法行、host 的 method 签名行与类型声明、remote-client.d.ts 的 face 与 dispatch 两行）逐字复制改名落进四件 `lib/typert.*`，REGENERATE.md 留言「下次正规再生成自然吸收」。源与生成物 34→35 方法一致，`wire-face.spec` 门禁绿。
- **自绘弹窗（dialog.tsx）**：`useDialogs()` 每组件实例化，返回 `{dialog, confirm(), alert()}`——promise 化替代原生同步语义（confirm 解析 boolean，alert 解析 void），复用编辑返回三选框的 `confirm*` CSS（补 `white-space:pre-line` 承载换行错误文案）。**Esc 必须 capture 阶段 window 监听**：设置模态打开时 TavernChatView 仍在背后活着，其 bubble 阶段全局 Esc（停→关框→双击开加载页）会先跑——开着确认框按 Esc 却停掉底下运行中的回合是绝对不允许的；capture + stopPropagation 稳赢。挂载即卸载兜底 resolve(false)，防悬空 promise；二次弹窗叠开时先到者按取消结算（原生 confirm 也不排队）。
- **接入面**：写卡列清空键 = ChatComposer 新 `extraSeats` prop（模型席位之后渲染，RP 聊天不传）→ WriterChat 持有确认框与 `stop()`（先杀客户端在途 admission）→ `resetWriter` → `onWriterReset` 换绑新 id（流式态重置 effect 已由并行改动落位）。全仓替换清单：TavernView（封面上传类型/上传失败、卡库删除、导入解析错误、导入封面失败、保存并开始双错、文件删除/移动、存档删除、`useCardIdentity` 加 dialogs 参数）、TavernApp（侧栏删会话、覆盖存档、清空会话）。新词条 `writer.clear*` / `dialog.ok|move|overwrite` 双语。
- **验证**：typecheck 双面零错；全套 240/240（含新增 loader-composition REAL 用例：resetWriter 换新 id、marker 重写、旧 durable 日志目录删除、卡文件原样、幂等收尾）。

## 2026-09-20 正文流式 + 数据维护行重构：透流改道与种子过滤

- **现象（使用裁定）**：①正文整段一次性掉出（原生 dsh 聊天是逐字流式的）；②数据维护行展开后「回执」区是主代理的正文副本，且运行期工具调用不更新——行体冻结在 fork 初的快照；工具行点不开（整段死文本）；③主转写工具行展开只有参数没有返回值；④工作空间编辑器永远默认 preset。
- **证据链与根因**：①TavernApp/WriterColumn 的 read() 只累加 `reasoning-delta`，`text-delta` 被丢弃，正文只走 durable `assistant/message`（回合落定才出现）；②尾代理 fork 子会话的种子 = 父会话 completed-turn 前缀，父的 assistant/message 与 tool/call 原样进子日志——`tail-transcript.ts` 的 deriveRun 忽略 seq 全量遍历，`reply` 取到父正文、`actions` 混入父工具；且子会话事件只到子日志，父流只有一条 durable `subagent/catalog`，前端 `loadTailDetails` 只 fetch 一次且 detail 有值后永不再刷；③durable `tool/result` 从未被读取；④CardEditor 恒定初始选 preset。
- **透流改道（核心机制）**：`dsh-api-session-controller` 宿主按 `agent.session.id` 路由 `agent/assistant-stream` 帧——引擎把尾子代理的真实流帧改写 attemptId（`tavern-tail:<childId>:<n>`，UI 按 childId 回拆）后以**父 agent** 名义 `ctx.emit` 重发，浏览器父会话 follow 即收到子流瞬态（走过的 wire 管线与主代理自己的完全相同；Symbol 标记防回环）。**帧契约**：`end` 帧必须发 `outcome:{kind:'abandoned'}`——父流中不存在该 attempt 的 durable settlement，发 `committed` 会落进客户端 pending-settlement 匹配失败 → 全窗 rebaseline；`abandoned` 恰好语义一致（本流确无 settlement）并走 settleAssistant 干净清除。瞬态永不重放、零日志写入，父日志与 fork 种子不被污染。
- **种子过滤**：live 子会话读 `session.inheritedEventCount`（实例字段，非 header）；冷读走 `sessionQuery.readSession()` 顶层同名字段；deriveRun 只统计 `seq >= boundary`。旧路径 boundary 缺省 = 0，行为不变。
- **维护行重写（ThinkRow 同款骨架）**：外层 DisclosureRow + `data-state=running` sweep；运行期收起摘要 follow 最新一笔（`chat.tailRunning`），展开体 = 每笔调用独立可展开的小行（参数 mono + 落定后配对回执）+ 流式收尾答复；落定换血 = 既有 `command/done(tavern-tail-done)` 事件把 tailDetail 缓存作废后重取（事件驱动，无轮询）。`TailAction` 增加 `args`（截断 2k）与 `result`（按 callId 配对 `tool/result`，可见文本在 tool-result 块的 content 里——第一版直接读 message.content[].text 拿到空串，测试当场抓出）。主转写工具行同样按 callId 配对 durable 回执，展开后 `↳ 返回值` 同显。
- **正文流式**：transient `text-delta` 聚合成 live narrative 行（`live:true`），落定后 durable `assistant/message` 原子换掉该行（settleAssistant 清瞬态，无重复窗口）；`TranscriptPulse` 加 `texting`，正文流式期间打字点隐藏（思考行同款约定）；WriterColumn 同步两行改动。
- **工作空间默认目录**：CardEditor 增加 `initialArea`（编辑卡/建卡/导入预览 = `preset`；跑卡会话 = `runtimeAuto`）——首次 tree 快照时 runtime/ 已有文件则展开并选中 runtime/state.md（无则字典序第一个）；runtime 未播种就留在 preset，待播种后的刷新再落；玩家点过树行即不再自动落点。
- **教训（通道盘点，防再次踩坑）**：`session.append` 无 `ignorable` 选项，自造 durable 类型会在 persistence read 被拒（KNOWN_SESSION_EVENT_TYPES 白名单）——**父会话逐笔 durable 转发不可行**；`command/run` 有命令追踪消费面、`subagent/catalog` 有 fold 校验、`hook/*` 有协议不变量，复用皆有陷阱；客户端 `openSubagent` 是导航（切 current）不是并行绑定——综合下来透流改道是唯一既真实时又零日志面风险的通道。
- **验证**：engine 97/97（含新增透流改道 REAL 用例：父名义收到 `tavern-tail:` 帧且答复文本流过、end=abandoned；tail-transcript 单测补种子排除/结果配对/boundary 缺省）；UI client-plane 新增正文流式与维护行折叠用例（该套件仍处 vitest include 已知挂起面，与在库用例同批等待接线）；typecheck 双面零错。

## 2026-09-18 尾代理闸门横幅退役：可感性收归停止键与维护行

- **现象（使用裁定）**：尾代理记账期输入框上方的金色胶囊「数据维护中 — 发送暂不可用，输入不受影响」逐回合闪现；闸门可感性已由发送键变形（`stoppable = running || pending || tailRunning`）与维护行（`chat.tailIdle` / `chat.tailActions` / `chat.tailStatus*` 灰折叠行）承载，横幅为纯装饰噪音。
- **删除面**：TavernApp 的 `tailLock` 传参；chat-view 的 `tailLock?` prop、渲染位与模块头注释提法；`App.module.css` 的 `.tailLock` 规则；locales 双语词条与 key 联合（en 词条由 lib 产物比对暴露——单语假象源于只 grep 中文串）；tests-client-plane 闸门用例等待标记从横幅文案改锚「停止」按钮（`docs/prototype/ui-mockup.html` 的 tail-lock 元素保留——带日期的原型稿不随实现回写）。功能面零改动：Enter 不排队、Esc 停止、↻ 隐藏、维护行照旧。
- **验证与如实盘点**：typecheck / 全套 228/228 / build 绿，`lib/client.js` 查无残串；client-plane 套件本就挂起（vitest include 排除，等上游 `dsh-client-*` 源面），故本次无真实渲染验证——套件恢复时改锚用例直接生效。顺带：mock-llm-testing 文档方式一入口对齐现实现（`node scripts/mock-llm.mjs` / `pnpm tavern` / `packages/mock/src/cli.ts`）。

## 2026-09-14 主代理停止键失效定位：双通道化（session.cancel + 引擎 stop）

- **现象（手测）**：写卡 agent 的停止键正常，主 agent 的停止键「根本没用」也不停尾代理。
- **通道差异是唯一变量**：写卡列走 `binding.session.cancel()`（session 命名空间——老命名空间，任何宿主进程都有）；主 agent 走 `rpc.stop`（tavern 命名空间，新方法）。运行中的 dsh tavern 进程在启动时快照 api bundle——旧进程里 `tavern['stop']` 不存在 → 客户端 `face('stop')` reject「namespace lacks method」→ 原 stop 实现把错误**静默吞掉**（成功/失败分支同形）→ 按钮零反应零日志。
- **修复（双通道 + 可见性）**：RP stop 改为先 `binding.session.cancel()`（与写卡列/stock UI 同一条生产路径，负责杀主回合），保留 `rpc.stop`（负责尾代理 fork 取消与 stopped 竞态标记）；两条通道失败都 `console.warn`——旧 bundle 场景下 DevTools 立即可见而不是无声。附带确认引擎侧 `main.cancel` 与 session-controller `cancel` 是同一 `agent.cancel({user,keepInbox})`，引擎 stop 的 REAL 用例（杀 bash/aborted 收束）host 端逻辑无恙。
- **验证**：app 规格两处停止用例补 `sessionsFace.cancel` 断言；ui-tavern 73/73；typecheck/lint 零错；全量 build。

## 2026-09-14 写卡列手测二轮三修：user 消息不显示 / jscpd 标记泄漏 / 停止后尾代理仍跑

- **写卡列不显示 user 消息**：writer 走标准 client face 入队，durable user/message 的 `data` 直接是消息（content 在 data 层，无 `message` 包装），而写卡列聚合只读 `data['message']` → body 恒空。修复 = 对齐 RP reader 的 fallback（先 `data.message` 再 `data.content`）。
- **jscpd 标记泄漏进聊天 UI**：把 `/* jscpd:ignore-start/end */` 写在了 JSX 子节点位置（transcript head 与 composer 两处），JSX 里裸 `/* */` 是**文本节点**会渲染出来。修复 = 改 `{/* jscpd:ignore-start/end */}`（JSX 注释不渲染，jscpd 正则仍匹配内层 `/* jscpd:ignore-start */` 子串、克隆门禁仍 0）。**教训**：JSX 里的注释必须 `{/* */}`，裸 `/* */` 会变成 DOM 文本；TS 函数体里的 `/* */` 才是安全注释。
- **停止后尾代理仍跑（竞态）**：主回合 running 中 stop，`main.cancel` 是协作式——若模型已生成完整回复，cancel 到达时回合已 completed，`onSessionEvent` 照常排尾（此前 523beb2 只堵了 aborted 不排尾）。修复 = 引擎加 `stopped` 标记：`stop` 时 set，`onSessionEvent` 在 `turn/start` 清标记（新回合恢复排尾）、在 `turn/end` 检查并清（被停止的回合即使竞态 completed 也不排尾）。

## 2026-09-14 写卡列手测反馈五修：openWindow / 标题 wrap / 加宽竖线 / 错误进历史 / 会话独立

- **写卡列一直 loading 的真根因（手测抓出）**：writer 是非 current 会话，client 侧历史窗口只在 current 切换（`followCurrent`）时 open——`SessionFace` 根本不暴露 `open()`。设计时误信了 `binding.session.open()` 可用，实为内核契约缺口。修复 = `api/session-controller` client 加一个公开 seam `ISessions.openWindow(id)`（`this.resolve(id)?.session.open()`，打开窗口**不切 current**、幂等、未知名 fail-quiet），WriterChat 挂载后调用。连带补齐三处 ISessions 实现（test-support TestSessions + conversation-registry spec 假面 + ui-trajectory 用面）。**教训**：跨包能力复用前必须对着 client 契约（非内部实现）逐方法核对，侦察结论不能直接当契约。
- **设置模态标题 wrap 泄漏**：`modalTitle` 用了 `card.title`（session 自动标题，由最后一条玩家消息摘要生成，而玩家消息被 `<pre-instructions>` 包裹）→ 改用 `cardMeta.title`（meta.json 干净标题）fallback 工作空间名。
- **对话框加宽 + 竖线 + 标题显示不全**：设置模态 880px/620px → 1320px/92vh；fileTree 竖线色统一 `#e2ded2`；editorPath 加 flex:1 + ellipsis（长路径不再溢出）。
- **失败消息常驻最末位**：turn/end 错误原是独立 turnError 状态永远渲染在转写最末，改成一个**历史行**（`ChatLine.kind:'error'`）push 进 lines——失败消息待在历史位置，下条消息接在其后；MISSING_CREDENTIAL 走 chat.errorKey 文案、配置入口靠发送预检。
- **刷新/关闭保留 + 会话独立**：openWindow 打开窗口后，writer 会话的 durable 日志重放保留历史（刷新/关设置页回来历史还在）；ensureWriter 按 root 反查保证每工作空间一个 writer、不同会话天然独立——手测反馈的提醒点已确认无缺口。

## 2026-09-14 写卡 Agent 列（编辑页改造②）：三支组合 + guard 拒执行 + 共享对话层

- **落地**：引擎 `ensureWriter`（惰性创建普通 dsh 会话、cwd=工作空间根、`.tavern-writer` 持久 + restoreBindings 恢复、writers 映射绝不进 `workspaces`）；`onAgentCreated` 第三支 = 引导 section（`tavern:writer-guide`）+ `tools.guard` 拒 shell/委派族**执行** + `setApprovalPolicy('never')`（新依赖边 dsh-user-approval）。api 新 RPC `ensureWriter`（照例 build:lib:host + api bundle 双重建）。客户端：`chat-view.tsx` 共享层（ChatLine/FlowRow/ChatComposer/useProjectionValue——RP 聊天与写卡列同源渲染）；`WriterColumn.tsx`（标准 `binding.session.prompt`/`cancel` 通道）；`CardEditor` 三列 + 2s 轮询（树/meta/未聚焦内容重读）。
- **两个真发现**：① writer 引导文本里的字面 `{{scriptName(args)}}` 撞上内核严格插值层，回合直接 `turn/end error`（malformed prompt variable reference）——卡提示词能活是因为主/尾的 assemble 监听先渲染占位符，writer 没有该监听；引导文本必须按构造无大括号，语法让 writer 自己读 `preset/scripts/README.md` 与卡内示例（文件内容不进插值层）。② guard 拒的是**执行**而非可见性——bash schema 仍在继承面上，模型越权调用得到 isError 工具结果回灌、回合续跑（内核 per-path 否决缝不存在，这是唯一能守住 FIXED_PATHS 又不冻结工具面的形态）；拒绝清单 = bash/pwsh + subagent 委派族九个名字，是维护者契约。
- **验证**：REAL（loader-composition）新增整链用例——ensureWriter 幂等 + 同根二次 compose 跨重启恢复同一 id 且不新建；writer 请求 system 含引导、面内无卡/尾工具；`approval/policy: never` 落 durable；bash 调用被拒、固定四件存活、回合续跑到下一脚本步。前端 spec：写卡列挂载/发送（standard prompt）/缺 key 请宿主弹框/存档页与导入预览不挂列。tavern 65 + ui-tavern 70 全绿。**假面坑（再现）**：`useSyncExternalStore` 的 getSnapshot 必须返回稳定身份——writerFaces 假面每次新建 snapshot 对象触发 Maximum update depth 无限循环挂死整个 worker；binding 也必须 memo 化（真客户端缓存、假面不缓存）。

## 2026-09-14 封面渲染全点约束 + 编辑器上限 1MB → 10MB

- **渲染失控点（用户报告「左边栏封面图大小要限制」）**：全仓封面渲染点里，书架 `.cover`、身份头 `.idCover`、默认开场页都走 background + cover（盒子固定，天然约束），编辑器媒体预览 `assetPreview` 已有 absolute inset + contain——唯一失控点是**侧栏头像**：`<img className={css.avatarImg}>` 没有任何 CSS 规则，大图按原始尺寸撑爆 34px 头像盒与整行。修复 = `.avatarImg` 钉死 `width/height:100% + object-fit:cover + border-radius:inherit`，`.avatar` 补 `flex:none; overflow:hidden`。教训：新增「源图尺寸不受控」的 `<img>` 消费点时必须自带盒子约束，background-image 天然免疫这类问题。
- **上限放宽（用户要求去掉 1MB）**：写上限（`editWriteCap`）与预览读上限（`editReadCap`）默认值 1MB → 10MB，仍可经 cordis.yml 调整。不能「裸去掉」的两个原因：① 仓库约定要求 RPC 完整返回结果有界（base64 资产直灌浏览器内存/传输线）；② 两上限必须同步动——只放宽写不放宽读 = 大图传得上去、身份头/书架/头像全部拒读回落无图。客户端删除本地字节预检与 `COVER_UPLOAD_LIMIT` 常量（引擎唯一权威，镜像常量会随部署配置漂移）；`writeAsset` 被拒不再静默吞掉，改为弹出引擎错误信息（`id.coverUploadFailed`）。保留界内不动：`tools.ts` READ_CAP（模型侧 runtimeRead）与目录导入解析器的 1MB 是另外两个独立上限。
- **验证**：121/121（新增引擎拒绝上传 → alert 弹错用例）；typecheck/lint、全量 build、doc-sync 16/16；README 双语 + Agent Note 双语 Consequences 改写 + 两处 pairing sidecar 重录。

## 2026-09-14 卡片身份头：封面 + 标题/简介行内编辑 + `writeAsset` RPC（编辑页改造①，定案见 [edit-page-identity-and-writer-agent.zh.md](../notes/edit-page-identity-and-writer-agent.zh.md)）

- **需求**：各编辑卡入口页顶部加卡片身份头——左侧封面（与卡库书架封面同比例缩小 120×82）+ 右侧标题/简介两行点击行内编辑；「工作空间」标题行为其让位。封面上传是唯一需要新能力的点：wire 上没有任何二进制写入通道（`readAsset`/`readLibraryAsset` 均只读）。
- **实现**：引擎 `workspace.ts` 新增 `writeAsset`（fenceIn `preset/` 内、复用读取路径的 MIME 白名单、解码后 ≤ `editWriteCap`（新 Config 字段，默认 1MB）、自动建父目录）→ api/tavern 新 RPC `writeAsset` → 客户端 `IdentityHeader`/`IdentityLine`/`useCardIdentity`。meta.json 保持唯一写路径：客户端解析既有 `readText` 读到的文本、重序列化、走既有 `writeText`——引擎不加 meta 校验（读取器本就容忍坏档），坏 JSON 身份头只读 + 修复提示，不阻塞编辑器。封面上传 = tree 查占用 → 重名数字后缀（`commitImport` 先例，固定 `cover.png` 名会静默覆盖用户文件）→ `writeAsset` → `meta.cover` 回写；悬停 ✕ 清除仅解除引用、文件不删。接入三页（编辑卡 / 制作卡 / 设置→工作空间，动作按钮与尾代理 chip 收进身份头右侧动作区）；导入预览页身份头编辑内存表 meta、无上传（`commitImport` 落库前无磁盘工作空间）。
- **踩坑**：① oxlint 对 method 语法的 props 类型（`onCommit(value): void`）报 unbound-method → 属性箭头语法；② CSS module 的类访问类型是 `string | undefined` → 组件 className prop 需放宽；③ `input !== null && input !== undefined` 触发 no-unnecessary-condition；④ app 级假面 `readText` 必须给 `preset/meta.json` 返回合法 JSON——返回空串会让所有身份头落坏档态；⑤ 「工作空间」标题退役后，既有测试的页面标记改为 /面板维护Agent/（workspace 页）与「卡片标题」占位（设置模态）；⑥ 对象字面量里的嵌套三元与 `@stylistic indent` 的 JSX 对齐口径纠缠 → 拆 if 分支或 `lint:fix`。
- **验证**：tavern + ui-tavern 120/120（新增 writeAsset 围栏 4 例 + 身份头 6 例；10 连跑中出现过 1 次未复现、用例名未捕获的偶发失败，其后 11 连跑全绿）；typecheck/lint/duplication 零错；test:docs 16/16；build:lib:host + api-tavern/ui-tavern 两 client bundle 重建；README 双语（Config 五字段 + writeAsset 句，双侧同改后重录 i18n sidecar）+ Agent Note `2026-09-14-tavern-card-identity-header` 三件套。
- **遗留**：真实 `pnpm dsh tavern` 手测（上传/更换/清除封面、标题简介写回、坏 meta 兜底）；②写卡 Agent 列（三列布局）未动工。

## 2026-09-14 回复期间锁发送：主代理回合进行中的输入不再排队

- **现象**：主代理回复中发送按钮可点、Enter 可发 —— 消息经 `'queue'` 排队、下回合处理。这是实现首日就有的既定行为（disabled 条件只有空草稿 + 尾代理闸门，从无 `running`/`pending`；design_zh.md 对回复期沉默，默认容忍排队），非尾代理闸门空窗修复引入。
- **为什么必须锁**：回复中排队的消息在 `turn/end` 前已落日志，位于 fork 种子前缀内且真在途；内核契约「种子账本对齐切点时刻真实 inbox、真在途项照旧继承」（core/agent-loop `inbox.spec.ts` 的 projects-inherited-inbox 用例钉死）意味着记账子代理可能认领玩家输入、按维护人格处理并改写 `runtime/`，闸门放行后主代理还会再处理一次 —— UI 不锁时双重消费是活的。
- **修复**：`send()` 增 `running || pending` 早退，按钮 `disabled` 同条件；`'queue'` 模式保留作快速连点的竞态兜底（`pending` 异步置位窗口内的第二次触发由队列保序）。「输入不受影响」语义不变；design_zh.md composer 节补「发送闸门」口径。
- **验证**：新增用例（running 时输入草稿 → 按钮禁用、Enter 不触达 prompt）；ui-tavern 全量绿。

## 2026-09-13 尾代理闸门空窗：主代理刚结束的一小段时间发送按钮可点

### 现象

开启面板维护Agent（尾代理）的卡，主代理回合刚结束、尾代理尚未开始记账的一小段时间里发送按钮可点、Enter 可发送，下一拍按钮又变灰，尾代理跑完才恢复。未开尾代理的卡不受影响（宿主走 autosave 分支，闸门从不置位）。

### 根因

锁信号到达客户端只靠固定周期轮询，两条通道在回合结束瞬间错位。宿主侧无空窗：`ctx.on('session/event')` 监听 `turn/end`（`packages/extensions/tavern/src/index.ts` 的 `onSessionEvent`/`startTail`），`gates.set` 在首个 await 之前同步执行，`turn/end` 分发的同一同步块内 `state().tailRunning` 已为 true。客户端侧 `running` 位走 `binding.session.subscribe` 事件流即时翻 false，而 `tailRunning` 唯一载体是 `setInterval(..., 2000)` 轮询 `rpc.state()` — 窗口 = 回合结束到下一个 2s tick，最长 2s。窗口内点击不是纯视觉：`send()` 只认滞后的 `tailRunning`，会真实 `prompt(..., 'queue')` 排队，恰好卡在尾代理 fork 边界（预步闸门拦主代理下一次认领，拦不住尾子代理认领 fork 种子里真在途的继承项）。附带盲区：interval 首个 tick 在挂载/切会话 2s 后，切回一个尾代理在跑的会话同样可点 2s。

### 修复（方案取舍）

- 否决「乐观闩锁」（前端在 turn/end 置 true 等轮询确认）：假锁（非 completed 回合宿主不跑尾）、重放陷阱（read() 挂载即重放历史 turn/end）、释放语义（或逻辑会永久锁死）、依赖同为滞后值的 `maintenanceOn`、宿主尾策略的前端副本五类问题，复杂度全部花在消灭毫秒级残余窗口上。
- 采用事件触发即时同步：锁值唯一来源仍是宿主 `state().tailRunning`，前端零推断，只把「问的时刻」改为挂载/切会话立即一次 + 每个活到的 `turn/end` 立即一次 + 2s 轮询兜底（解锁维持 ≤2s，多锁方向安全）。`TavernChatView.read()` 以 seq 基线区分重放与活事件（`primed`/`seenTurnEnd` 闭包变量，按订阅期隔离；历史窗口 prepend/replace 会整体换血，只有 seq 单调可靠），活到的 `turn/end` 回调 `onTurnEnd` → `pollTail`。不筛 reason：中止/出错回合也触发拉取，宿主答 false 即无锁，拉取自校正，无需把宿主的跳过条件翻译到前端。
- 残余窗口 = 一次本地 RPC 往返（毫秒级），且即便命中也落入本就允许的 mid-turn queue 同类行为。

### 验证

新增三例（挂载即锁 / 活 turn/end 同步触发查询并锁定 / 重放建基线且更旧 seq 不触发、更新 seq 触发）；假面 `sessions()` 补 `push` 能力（原 subscribe 从不通知）。等待断言全部改为「30ms 沉降 + 同步断言」——默认 waitFor 预算在负载尖峰下会间歇超时（本文件 Key 弹框用例已有同款先例），且判别力不丢（旧实现在 2s tick 前按钮必然亮着）。顺带修正既有 tail-gate 用例的恒真断言（空草稿时按钮本就禁用，补输入草稿）。`vitest run packages/client/ui-tavern` 55/55 连跑 7 轮全绿；`tsc -p` 与 oxlint 干净。

### 防复发

- 客户端可见的宿主瞬态（如尾代理闸门）：取值契约 = 宿主唯一权威、前端只负责在正确时刻刷新；优先「事件触发拉取」而非「固定轮询 + 乐观推断状态」，后者每次宿主改触发策略都要前端跟随。
- 禁用态断言必须先输入草稿；事件流假面要有活推送能力，重放与活事件要分开断言（seq 基线是免疫重放的关键，值得单独一例钉住）。

## 2026-09-11 启动后始终进入默认 web UI（root 接管崩溃静默回退 + 挂载位置死锁）

### 现象

`pnpm dsh tavern` 启动后浏览器打开的是默认 web 外壳，酒馆页面从未出现，终端与服务端日志无任何告警。DevTools console 中有两条错误：`Error: cannot get property "remote.tavern" without inject` 与 `slot entry crashed in 'root': ...`。

### 排查与证据链

1. host 侧逐层实证无问题：`dsh tavern --dump-config` 的组合树含 `@deepseek-ai/dsh-bundle-tavern` 三行（`tavern-engine` / `tavern-api` / `ui-tavern`），用户层无禁用；起服后抓取首页 HTML，`__DSH_BOOT__` 图含 `@deepseek-ai/dsh-client-ui-tavern` 条目，`/plugins/??…ui-tavern/client.js` 返回 200（220 KB，含 Safari Iterator 垫片）。
2. 真实 Chrome（playwright-core headless）探针复现：`[tavern] root shadow 已落座（priority -20）` 已打印，说明槽位接管注册成功；随后 `TavernRoot` 渲染即抛 `cannot get property "remote.tavern" without inject`，槽位系统捕获后回退渲染低优先级 cell（ui-layout 默认外壳）。DOM 证据一致：`#root` 内是默认侧栏布局，无任何酒馆元素。
3. cordis 属性代理（`vendor/cordis/src/reflect.ts:144`）按**完整点路径**校验 inject；`packages/client/ui-tavern/src/client/index.ts` 的 inject 只声明了 `'remote'` 与 `'remote.credentials'`，未声明 `'remote.tavern'`。optional chaining 对抛错的 get 无效，组件内的 `remote?.tavern` 兜底形同虚设。

### 根因（两层）

**第一层 — inject 缺点路径声明，渲染崩溃后被静默回退。** `remote.<namespace>` 是独立服务（`packages/api/gateway/src/client/index.ts` 的 `remoteServiceKey(name)`），读取 `ctx.remote.tavern` 需要在 inject 数组声明点路径 `'remote.tavern'`；缺失时渲染抛错，ui-slots 捕获后回退到下一个 cell，表现即「一直进默认 UI」。

**第二层 — 命名空间挂载位置死锁。** 点路径 inject 同时是**激活前置依赖**（`packages/client/web/src/boot.ts:149` 引导审计要求 `ctx.get('remote.tavern')` 已定义，否则 fail-loud）。`$mount` 放在 ui-tavern 自己的 apply 里即自等自：入口等 `remote.tavern`，而只有它自己会挂载。内建命名空间（`remote.commands` / `remote.goals` 等）全部由 `@deepseek-ai/dsh-api-remotes` 载体在消费者之前挂载，tavern 是唯一违反者。

### 修复

给 `@deepseek-ai/dsh-api-tavern` 建独立 client face，与内建载体同构：

- `packages/api/tavern/src/client/index.ts`（新建）：`inject = ['remote']`，apply 返回 `ctx.remote.$mount(tavernRemote)`；tsconfig 拆 `tsconfig.host.json` / `tsconfig.client.json` 双面并注册进根聚合；package.json 增 `./client` 导出与 `dsh.client` 元数据；`tsdown.config.ts` 用 `clientBundle`。
- `packages/client/ui-tavern`：runtime inject 增 `'remote.tavern'`；`dsh.client.inject` 增 `@deepseek-ai/dsh-api-tavern` 图边；删除自挂载 effect 与 `@deepseek-ai/dsh-api-tavern/remote` 导入（bundle 223 KB → 75 KB，生成物随挂载移入 api 面）。

### 验证

真实 Chrome 探针：`[tavern] root shadow 已落座` 与 `[tavern] 应用页面已挂载` 两条日志齐全，DOM 为酒馆页面（会话侧栏、卡库书架、API Key 对话框，全部为活 RPC 数据）；`pnpm exec vitest run packages/client/ui-tavern` 13/13 通过。

### 防复发

- Remote 命名空间的 `$mount` 一律放在所属 api 包的 client face，消费者只声明点路径 inject — 与内建命名空间模式对齐。
- 点路径 inject 有双重语义（运行时读取许可 + 激活前置依赖），新增 `ctx.remote.<ns>` 读取时两处清单必须同步。
- keyless 组件测试（client-test-runtime）不覆盖真实浏览器的 inject 守卫与槽位回退路径；非平凡接管类改动用真实浏览器探针验证（本仓库 node_modules 已带 playwright-core，可驱系统 Chrome headless）。

## 2026-09-11 槽位崩溃回退的全局取消 — 暂缓（决定记录）

**诉求**：槽位条目渲染崩溃时直接显示错误，而不是回退渲染低优先级 cell（本次默认 UI 事件的直接表现层）。

**为什么必须动内核**：回退不是插件侧逻辑。捕获点在 `packages/client/ui-renderer/src/client/scoped-slots.tsx:325` 的 `SlotErrorBoundary`，它从外部包裹每个槽位条目，插件组件抛出的错误先离开插件代码才被接住，插件内部无拦截点；「回退到下一个 cell」由该边界调用 `host.reportEntryError(..., { abdicate: true })` 驱动（账本 `SlotCore.reportEntryError` 把崩溃条目从 cell 除名，ui-slots/src/index.ts:1137），`abdicate: true` 是 ui-renderer 写死策略（scoped-slots.tsx:755 单/键/列表槽、:918 root 槽），插件传不进去。全局取消 = 改这两处内核代码，并改变所有插件的降级语义（侧栏小部件崩溃将从静默降级变为显示错误），属产品级策略，不由单一消费者推动。

**已评估的最小内核方案**（暂缓，供将来决策）：边界捕获错误进入自身 state 并渲染消息 + 堆栈替代现在的空 `data-slot-error` div；两处 `abdicate` 改为 `false`；同步更新 `SlotCore.reportEntryError` / `SlotRendererHost.reportEntryError` 契约文档与 `scoped-slots.client.spec.tsx` 用例。现有用例经分析全部仍通过（回退行为本身无用例断言，仅注释描述）。

**不改内核的插件侧替代**：在 `TavernRoot` 组件内部包酒馆自己的错误边界，错误不逃出插件、内核边界不触发 — 只保护酒馆接管面。作为酒馆侧后续改进项。

## 2026-09-11 API Key 按需弹框 + 设置入口；composer 模型/思考强度选择器

### API Key 交互重构（`packages/client/ui-tavern`）

原实现挂载即 `credentials.describe` 并弹模态框，且模态框无任何关闭途径 — 未存 key 的用户每次启动被阻断在输入框。重构为三段：

- **挂载不弹框**：挂载效果只刷新「key 是否缺失」缓存；`credentials/reference-updated` 推送事件驱动缓存失效（与 ui-settings-models 同款模式）。
- **按需弹框**：composer 发送前预检（缓存命中则免 describe），缺 key 时弹框且**保留草稿**；回合以 `MISSING_CREDENTIAL` 失败时（`turn/end` 的 `reason.error.code`，stable LLM failure 词汇），transcript 渲染错误行 + 「配置 API Key」按钮 — 顺带补上了此前回合失败完全静默的缺口。
- **设置入口**：侧栏头部「设置」按钮打开同一模态框（保存/稍后配置/Esc/遮罩关闭）。

### composer 模型与思考强度选择器

数据面完全复用 `ui-model-selection` 的既有设施：`ctx.modelDirectories.directoryFor(sessionId)`（per-session 共享目录，Host 目录 + 会话持久选择投影）+ `directory.select({ provider, model, reasoningEffort? })`；不导入其组件（bundle 纯洁性），酒馆页面自绘选择器（当前模型标签 + provider 分组弹出层 + effort chips，文案走 locale）。原型先行：`docs/tavern-prototype/prototype/ui-mockup.html` 的 composer 增加 mock 目录的同款选择器（localStorage 持久），产品侧与原型交互一致。

### 踩坑：runtime 语境下的服务读取严格性

`directoryFor` 经 traceable 代理调用时，方法内 `this.ctx.remote.session` 的 receiver 解析到**调用者语境**；ui-tavern 的 inject 未声明 `remote.session` / `modelDirectories` → 渲染时抛 `cannot get property "remote.session" without inject`，选择器静默消失（catch 吞掉）。修复 = inject 声明补 `'modelDirectories'` 与 `'remote.session'`，`ctx.modelDirectories` 走声明内代理读取。与上文 `remote.tavern` 同一条铁律的第三次出现：**运行时代码里读到的每个服务/点路径都必须出现在本插件的 inject 声明里，`ctx.get` 与 optional chaining 在 runtime 语境下都不是逃生门。**

### 验证

22 个 ui-tavern 用例（新增 9 个：弹框策略 5、回合错误行 2、选择器 2）+ extensions/tavern + api/tavern 共 57/57 全绿；真实 Chrome 探针：启动不弹框、设置弹框开/跳过正常、会话内选择器弹出且渲染真实 Host 目录（模型名 + Off/Low/High/Max 强度）。原型改动为纯静态 HTML，浏览器直接打开验证。

## 2026-09-11 页面视觉对齐原型（App.module.css 逐段移植 + DOM 结构重排）

首轮实现只对齐了「布局位置」，与 `ui-mockup.html` 的视觉规格差距过大。本轮把原型当设计规格源：通读全部 CSS（约 700 行）与视图渲染 JS，逐段移植到 `App.module.css`，并按原型 DOM 重排 `TavernApp.tsx`：

- **侧栏**：264px 渐变底（`linear-gradient(180deg,#fbfaf6,#f3f1ea)`）、「会话 / N 个」头部、会话卡片（34px 金字头像方块 + 标题 + ◆运行中/◇空闲状态行 + mono ws 行、hover 白底阴影、active 金色左条 ::after + 金色渐变底）、底部虚线「＋ 开启新会话」（新建入口从头部移到脚部，与原型一致）。
- **主区**：底部金色径向光晕 `radial-gradient`；磨砂聊天头（`rgba(255,255,255,.82)` + `backdrop-filter: blur(6px)`）；HeaderAction 从内联样式换肤到 text-btn 体系（保存=金色 primary、清空=danger hover）。
- **transcript**：760px 列 + 16px 间距；用户气泡（`#f0ead9` 圆角 + 悬停时间戳戳记，时间取事件 envelope 的 `time`）；叙事段落（衬线 Georgia/Songti 15px/1.9 + 左侧金色短横 ::before）；工具调用改为原型式可折叠 flow-row（标签 + 摘要 + ▶ 旋转，展开显示 mono 参数框）。
- **输入区**：tail-lock 圆角横幅（`maintenanceOn` 时显示，turn/end 后经 `rpc.state` 刷新）；composer 下 kbd 提示行（Enter 发送 · Shift+Enter 换行）；发送后 typing 三点动画（assistant/message 或 turn/end 处消除）。
- **卡库 landing**：ob 头部行（标题 + ws mono 副标题 + 创建新卡/从其他目录导入/从酒馆卡导入/设置 四个 text-btn）+ lib-grid 书架卡（四款 tint 渐变封底、hover 上浮 + 阴影 + 悬停显示编辑/删除圆钮）+ 虚线分隔 note；新建/导入在无会话时自动先建会话再动作。
- **模态**：遮罩统一为 `rgba(58,48,26,.32)` + blur + fadeIn/slideUp 动画；工作空间模态顶部使用同款磨砂头。

**未对齐项（记录）**：会话右键菜单（重命名/删除 — Remote 面无对应方法）、toast 通知条（HeaderAction 自带内联反馈）、思考/记账行（`think`/`tail` — 事件流中暂无对应载体，工具行先行）；工作空间编辑器沿用 `TavernView.module.css` 自身样式。**验证**：57/57 全绿；真实 Chrome 截图对照原型（landing / chat / 模型弹出层 / 工作空间模态）布局、用色、字重、交互态一致。

## 2026-09-11 行为对齐设计文档（design_zh.md「Web 界面」为权威规格）

第一轮只对齐了视觉层，行为仍是自创。本轮以 design_zh.md 135-154 行为规格逐条校正：

- **开局页就地切换**（150 行）：卡库与「创建新卡 / 从其他目录导入 / 从酒馆卡导入」不再走弹窗/自制 landing — 主区直接渲染 `TavernView`（其 library/json/dir/draft 模式本就是就地视图 + 「← 返回」），新增 `onCardReady` 回调在卡载入后切回聊天视图。
- **头部四键**（129-131 行）：「保存」= 保存弹框（原型 .sv-dialog：上方列存档、点击条目填名 = 覆盖有确认、下方输入 + hint）；「加载」= 打开设置模态并直落存档 tab（`TavernView` 新增 `initialTab` 透传）；「清空」= 确认后 reset；「设置」= 设置模态。原 HeaderAction 下拉面板组件解散删除。
- **设置模态**（152 行）：原型 .modal 结构 — 标题为**会话名**（syncChrome 行为）+ workspace.sub 副题 + 关闭 ×；tab 行 [工作空间 | API Key]，工作空间 tab 宿主 TavernView（文件/存档/开场页），API Key tab 为本轮新增的 key 配置（用户要求）。侧栏头部加常驻「设置」— 开局页无头部时 key 配置仍可达（无会话时直开 key 弹框）。
- **尾代理闸门**（154 行）：maintenanceOn 期间发送按钮禁用 + Enter 无效，输入不受影响；横幅沿 navigation 前一轮实现。
- **开场页选项回填**（149 行）：聊天区监听 `postMessage`（`tavern-insert`），把开场白选项句填入输入框。
- **聊天区背景**澄清：原型聊天区没有外框 — 消息直接铺在暖色底 + 底部金色径向光晕上；带边框圆角的「背景框」是**开场页 iframe**（`.opening-frame`）。两者均已按原型实现。

**验证**：60/60 全绿（新增：保存弹框流、就地开局页、尾代理闸门、设置 API Key tab 共 5 例）；真实 Chrome 探针 + 截图确认就地导入视图（← 返回）、设置模态（会话名标题 + 双 tab）、保存弹框。

## 2026-09-11 三个连锁根因：RPC 信封未解包 / Service 插件 Config 未挂 static / 会话创建绕过控制器

用户反馈「开启新会话点不动、卡库永远为空、UI 永远落在新局页」。逐层排查出三个互相掩盖的根因，全部是**接线层**错误而非样式问题：

1. **RPC 信封未解包（影响面最大）**。Runtime 命名空间的方法永远返回 RemoteResult 信封 `{ ok, value | error }`（`packages/api/gateway/src/client/index.ts` 的 `invoke`），而 ui-tavern 所有调用点直接读 `value.xxx` — `hasCard`/`cards`/`rows`/`html`/`saves` 全部 undefined：hasCard 恒 false → 永远落在开局页；卡库永远「空」；opening 永不渲染；保存/载入假动作。仓库里的正确姿势早就存在：credentials 调用点一直写着 `response.ok === true ? response.value…`（ui-model-selection 的 modelCatalog 同款）。修复 = `rpc.ts` 的 `tavernRpc` 现在把命名空间逐方法映射过 `unwrap`（失败 reject 成 `tavern rpc failed: <code>: <message>`），调用点保持读值形状。测试假面同步改为信封形状。
2. **Service 插件的 Config 必须挂 `static Config`**。引擎把 `Config` schema 导出为模块级 const — Loader 对 Service 插件只读类上的 `static Config`（范例：jobs-local 的 `LocalJobRegistry`），于是 `cfg` 从第一天起就是 undefined，所有落盘路径（建会话/卡库/存档/资产读取）一直带着 `Cannot read properties of undefined (reading 'workspaceBase')` 潜伏。修复 = 类上挂 `static Config: z<Config> = Config`。
3. **会话创建绕过 session-controller**。引擎原来直接 `ctx.agents.create()` — agent 有了，但会话从不进入 session-controller 的列表/持久化路径，侧栏永远不显示新会话。设计文档「实现映射」写的就是 `session.create(request.cwd)`。修复 = 引擎 `createSession` 改走 `sessionController.create({ sessionId, cwd: root })`；`static inject` 加 `sessionController`。

**顺带落地**：侧栏数据源改为 `workspaces()` 磁盘行（每行 = 一个 tavern_workspace 目录：卡片标题/简介/◆运行中/◇空闲/干净工作空间状态行 + mono 目录名）；会话**右键菜单**（重命名 = `sessionController.rename` 仅显示名；彻底删除 = 删工作空间目录含存档，需确认 — 引擎新增 `renameSession`/`deleteSession` RPC，注意 dispose 能力归创建者，控制器无 teardown RPC，会话日志暂不删）；`readAsset` RPC（围栏 + MIME 嗅探 + 1MB 上限，data URL）；主区改为三段式恒定结构（头部常显、按钮按开局状态显隐）；`tavernRpc` 对缺失方法改为调用时才报错（旧 host bundle 不再炸整页）。api/tavern 新增三端点后经 `pnpm run build:lib:host` 重生成 typert 生成物。

**验证**：60/60 全绿；真实 Chrome 实测 — 点「＋ 开启酒馆会话」后磁盘出现 `ws-<时间戳>` 目录、侧栏 1→2 行、新行带完整状态行、右键出菜单、fail-loud 后所有 RPC 错误带真实 message 出现在 console。**尚未完成**（下轮）：TavernView 旧样式向原型移植（ob 面板/lib 卡/draft 就地编辑器）、文件树右键菜单与拖动、思考/记账折叠行、清空回开场页、封面图渲染。


## 2026-09-11 对齐更新后的原型：导入预览流 + 默认开场页 + 重启绑定恢复

原型与文档更新（导入改系统选择框 + 只读导入预览页 + 「保存并开始」；开场页整页平铺 + 默认开场页）。按「设计意图 → 后端要求 → 文档对应」规划后实现：

- **导入流**（design_zh.md L50/L150、README_zh.md）：卡库页两入口改挂隐藏 `<input webkitdirectory>` / `<input accept=.json>`（浏览器安全模型只给内容不给路径 → 契约 = 前端解析的文件表跨 RPC）；前端解析归一化（隐藏文件跳过、二进制扩展名黑名单登记占位、>1MB 不读内容、缺失提示词补空、meta.json 缺失按目录名/卡名生成）；新增 `ImportPreviewPanel`（← 返回 + 只读左树右内容 + 「保存并开始」）；后端新增 `commitImport(sessionId, title, files)`——库目录名按 title 清洗 + 重名自动加后缀、路径围栏写入、复制进工作空间并播种 runtime。旧 ImportJsonPanel/ImportDirPanel（粘贴/手输路径）删除。
- **开场页**：iframe 整页平铺聊天区（无边框无内边距）；卡无 opening.html 时渲染默认开场页（居中标题+简介大卡，数据来自 `state()` 新增的 title/desc）。
- **重启绑定恢复**：引擎会话↔工作空间映射原本只在内存，进程重启后 `.tavern-session` 不反向重建 → 老会话全部变「非 tavern 会话」（载入中卡死）。修复 = 构造时 `restoreBindings()` 扫描工作空间基目录重建映射。
- **对照验收**：真实浏览器 E2E 全流程（新会话 → setInputFiles 选 .json → 只读预览 → 保存并开始 → 默认开场页显示标题简介 + composer 可用 → 重启后再进同一会话正常）；截图与原型逐状态比对（卡库/预览/开场）。**残留校准项**：卡库页列宽与原型聊天列宽（760px 内嵌）的微差、封面图（meta.cover）渲染、文件树右键菜单/拖动、思考/记账折叠行、清空回开场页。

## 2026-09-11 工作空间编辑器对齐原型（统一编辑器 + 制作卡就地发布 + API Key 归位）

- **文件树按原型重写**（统一编辑器组件）：顶部 tree-hint（preset 说明 + 右键/拖动操作提示）、目录折叠（▸ 旋转）、缩进层级、runtime//savings/ 入树并带 RO 徽标（不再整体隐藏）、选中金色左条；右侧编辑器头（mono path + 可编辑/只读徽标）+ mono textarea / 媒体 data-URL 预览；**去掉 ＋ 按钮** — 新建/重命名/删除全部走右键菜单（只读区菜单收敛）；文件可拖到目录移动（松手确认，fileOp move）。引擎 `fileOp` 增加 `mkdir`。
- **创建新卡 = 就地编辑器**（原 stub「骨架已写入 → 开始编写」删除）：draftCard 后直接渲染编辑器 + 实时尾代理 chip（读 maintenancePrompt 判定）+「保存并开始」= 新 `publishCard` RPC（工作空间 preset 发布进卡库，title 派生唯一目录名）。修一个通知点 bug：draftCard 写骨架后 hasCard 即为 true，原来 onCardReady 挂在状态轮询上会把建卡页顶掉 — 现在只有「卡库加载 / 导入提交 / 发布」三条真实路径通知宿主切换到聊天视图。
- **API Key 归位**：从设置模态移除，改侧栏右上角「API Key」入口 → 独立弹框；设置模态回归原型的「工作空间 / 存档」内容（宿主 TavernView 自带 tabs）。
- **验证**：60/60 全绿；真实浏览器走通「新会话 → 创建新卡 → 就地编辑器（chip/右键菜单/RO 徽标）→ 保存并开始 → 卡库落盘 + 默认开场页」；API Key 侧栏入口弹框正常。

## 2026-09-11 统一编辑器组件（文档二轮更新对齐）

文档把「导入预览页」升级为「导入编辑页」（可直接修改解析结果），并规定统一编辑器组件：顶栏 checkbox 控制组 + 动作按钮（工作空间模态无顶栏）、VS Code 纯净树（行内无徽标、chevron、选中整行底色）、尾代理开关 dim 语义（关闭 → maintenancePrompt 树行/编辑区灰显只读、缓冲保留、提交空串入库）。实现：

- `FilesPanel` → `CardEditor` 统一组件：`table` 模式（导入编辑页 — 编辑内存解析表，未落盘）与 workspace RPC 模式（设置模态/制作卡）共用；`controls`/`actions` 渲染顶栏。
- 尾代理开关：初始按 maintenancePrompt 非空；关闭 → 树行斜体灰显 + textarea 半透明只读；导入提交与制作卡发布路径都按开关写空串（磁盘已验证 `maintenancePrompt === ""`）。
- 树行改为 chevron + nm 纯净行，去 RO 徽标与拖拽点（整行可拖）。
- 真 E2E：导入 .json → 编辑页（toolbar/灰显）→ 关闭尾代理提交 → 卡库 meta/四提示词落盘且 maintenancePrompt 为空 → 默认开场页。

**诚实盘点（对照当前原型）**——已对齐：卡库页（书架/三入口/悬停操作）、系统选择框、导入编辑页（可编辑+toolbar+dim）、制作卡页（就地编辑器+chip+发布）、工作空间编辑器（树/右键菜单/拖动/RO 灰显/失焦保存/媒体预览/1MB 上限）、侧栏（工作空间行/右键/API Key 入口）、头部四键（保存弹框/加载直达存档/清空确认/设置模态）、默认开场页、模型/思考强度选择器、尾代理闸门横幅。**未对齐（残留）**：思考/记账灰色折叠行（思考行有事件载体可做：assistant/attempt 的 reasoning-chunks）、清空后回开场页、卡库封面图（meta.cover）渲染、卡库页与原型 760px 聊天列的宽度微差、设置模态多出的「开场页」tab（超集）、toast 通知条。

## 2026-09-11 残留项全量对齐（思考/记账行 · 清空回开场 · 封面图 · toast · 模态 tab 精确化）

- **思考折叠行**：`assistant/attempt` 事件流中的 `reasoning-chunks` 聚合为灰色折叠行（label 思考、摘要首行、展开全文）——DSH web 同款，不再只认工具行。
- **记账折叠行**：`turn/end` 正常收尾且 maintenanceOn 时合成「记账 · 尾代理 · runtime/ 已更新 · autosave 已写入 savings/」展示行（展示层合成，不入持久历史 — 重载后不重现，已记录）。
- **清空 → 回开场页**（design 148 行）：确认清空后前端 bump resetSignal — 转写清空、开场页（iframe 或默认开场页）回显、composer 可用；下一次发送恢复正常历史视图（durable 日志不删除 — 会话记忆清理受追加式日志限制，已知偏差记录）。
- **卡库封面图**：新 `readLibraryAsset(name, path)` RPC（库卡目录内围栏 + MIME + 上限），书架卡按 meta.cover 渲染背景图，无封面落回 tint 渐变。
- **toast**：原型底部居中 toastIn 样式；手动保存与 Key 保存反馈接入。
- **设置模态 tab 精确化**：工作空间只留 文件/存档 两个 tab（开场页预览 tab 删除 — 开场页由聊天区空历史状态承担）。
- **卡库页宽度**：与原型聊天列同宽（760px 居中）。

至此设计文档「Web 界面」全部条目与原型当前版本对齐。测试 60/60。

- **文件树层级修复**（用户反馈「目录展开位置不对」）：原实现按扁平字典序渲染，`preset/meta.json`（文件）插在 `preset/prompt/`（目录）之前、顶层目录被 preset 子树隔开。修复 = 先从扁平路径表构建层级树（中间段即目录），再按「目录优先、同层按名」深度优先展开 — 展开/折叠语义不变，初始展开选中文件（默认 systemPrompt）的祖先链，与原型 openFile 行为一致。空目录（酒馆卡导入的 setup/tools）展开无子项属预期。

- **文件树层级修复**（用户反馈「目录展开位置不对」）：原实现按扁平字典序渲染，`preset/meta.json`（文件）插在 `preset/prompt/`（目录）之前、顶层目录被 preset 子树隔开。修复 = 先从扁平路径表构建层级树（中间段即目录），再按「目录优先、同层按名」深度优先展开 — 展开/折叠语义不变，初始展开选中文件的祖先链（默认 systemPrompt），空目录（酒馆卡导入的 setup/tools）展开无子项属预期。
- **固定提示词保护**（用户要求）：`preset/prompt/` 四个提示词文件（systemPrompt / prefixPrompt / postPrompt / maintenancePrompt）禁删除与重命名 — 引擎 `presetFileOp` 的 delete/move 边界拒绝（含 move 落点碰撞检查），客户端右键菜单对应项禁用（划线灰显 + 悬停说明）；文件内容仍可编辑。
- **路由规则确认**（用户要求）：没选卡片 → 聊天区 = 卡库页（无输入框）；选了卡片但无聊天历史 → opening.html / 默认开场页（输入框可用）。真机双分支验证通过。

- **侧栏卡片改版**（用户要求）：移除会话重命名（RPC 三层同删）；卡片 = 封面图（readLibraryAsset）+ 标题（未选卡显示「请选择卡片」）+ 最后一句话截断（localStorage 派生缓存，当前会话由事件流实时更新）；右键菜单取消 → hover 右侧 ✕ 删除（确认弹窗），原型 ui-mockup.html 同步此交互。默认开场页补封面背景（meta.cover 经 readAsset）+ 标题兜底改工作空间名（此前空 title 落到品牌名「酒馆」）。侧栏禁横向滚动（溢出截断 + hover title 全文）。

- **侧栏交互二轮修正**：右键菜单取消（菜单只承载删除一个操作不值得）→ 会话卡 **hover 右侧 ✕**（确认弹窗）；侧栏禁横向滚动（溢出截断 + hover title 显示全文）。原型 ui-mockup.html 同步此交互（card-del 按钮 + 死代码 openSessionMenu 清除，JS 语法校验通过）。

## 2026-09-11 编辑器二轮：行内命名 + 面板维护Agent 改名 + 模态页面互斥

- **行内命名（VS Code 式）**：新建文件/目录 = 立即创建（默认名 untitled.md / untitled/）并进入树行内命名输入；重命名 = 原地编辑。Enter/失焦提交（fileOp move / 表键替换），Esc 还原默认名；window.prompt 全部移除。固定提示词四件：引擎 presetFileOp delete/move 边界拒绝（含 move 落点碰撞），客户端菜单项禁用划线。
- **尾代理 → 面板维护Agent**（UI 文案统一）：maintenance chip、编辑器顶栏 checkbox、记账折叠行 label、树底说明同步改；内部标识（maintenancePrompt 文件名/引擎符号）不变。
- **创建新卡页标题** → 「编辑设定卡」（创建/编辑两入口同页）。
- **设置模态页面互斥**（用户要求）：去掉 文件/存档 tab —— 「设置」直进工作空间页、「加载」直进存档页（initialTab 即页面本身），两页面不再同屏。

- **尾代理 checkbox 移除**（用户要求）：顶栏不再有手动开关 — 启用与否只由 maintenancePrompt 是否为空决定（编辑内容即切换）。CardEditor 去掉 controls/dim 逻辑；制作卡页 chip 由 2s 轮询 maintenancePrompt 实时刷新；导入提交按编辑后的实际内容入库。真机验证：无 checkbox、chip 正确显示关闭态、行内新建+重命名（backstory.md 落盘工作空间 prompt/）。

## 2026-09-11 输入框补上下文占用环（原型）

- **形态对齐 DSH ContextMeter**（`ui-conversation` 的 `skeleton/ContextMeter`）：输入栏发送按钮左侧新增 14px SVG 圆环触发钮（2px 轨道 + 2px 进度自 12 点顺时针、圆帽、28px 圆形命中区），点击弹出 264px 明细面板 — 标题行「上下文已用 N% + ~已用/128K」、4px 分段占比条（系统提示词 / 工具 / 对话，沿用 DSH 三色）、三行 ~token 明细；点击开合、外部 mousedown 与 Esc 关闭，与模型席位菜单同款。
- **mock 数据**：产品侧的占用应接 token-meter 的 `contextPressure` / `contextBreakdown` 投影（真实客户端 ui-tavern 尚未挂载 ContextMeter，属遗留项）；原型按聊天 DOM 估算（固定底数 卡片提示词 2.6K + 工具 1.4K，用户气泡与叙事段落 ×1.7 chars/token、每个折叠行 +90），MutationObserver 盯聊天列统一驱动（发送 / 流式 / 记账 / 历史 / 清空 / 切会话全路径自动覆盖），流式逐字 tick 以 150ms 合并。
- **顺带修复原型启动崩溃**（ Playwright 冒烟验证时发现，改动前已存在）：设置模态顶层语句引用了未声明的 `overlay`（`ReferenceError`）导致整个初始化脚本中断、卡库与侧栏不渲染 — 补回 `const overlay = $("settingsOverlay")`。此前只做过 `node --check` 语法校验，未覆盖运行期引用错误。

## 2026-09-11 输入区重构为 DSH composer 结构 + 会话统计行（原型）

- **结构校正**（用户指正：DSH 的模型席位在右下角、文本输入区在上）：composer 由「单行 = 模型席位 + 文本 + 发送」改为 DSH InputBar 的两行结构 — 文本输入区在上，下方控制行**右对齐**（模型席位 chip → 上下文占用环 → 发送）；模型弹出菜单的锚移到 `model-wrap`、与触发器**右缘对齐**向上弹（DSH portal 的右对齐规则）；DSH 的加号 / 附件 / 权限 chip 按用户要求不进原型。
- **会话统计行**（对齐 ui-chat 的 `StatsPills` + `stat-dialog` 皮肤）：composer 下方居中两个单色 SVG 图标 pill — 仪表「N 轮 M 步 · X tok/s」点开**会话统计**对话框（模型用时 / 首 token 平均 TTFT / 输出速度 TPS），数据库「N tok · 缓存命中 X%」点开 **Token 用量**对话框（缓存命中 / 未缓存输入 / 缓存读取 / 缓存写入 / 输出，精确计数，行按有无数据显隐）；两对话框互斥（DSH openPill 独占位）、外部 mousedown 与 Esc 关闭；首轮结算前整行隐藏。
- **mock 结算**：产品侧接 token-meter 的 `tokenUsage` / `sessionStats` 投影；原型挂 `afterReply` 每轮一次 — input = `send` 时捕获的请求上下文占用（首轮 90% 记缓存写入、之后 94% 记缓存读取 → 命中率第二轮起跳升），output = 结算时的占用增量，速度按输出长度确定性波动（38–56 tok/s，恒定值看起来像写死）。上下文占用估算提取为 `ctxEstimate()`，环与统计共用。
- 验证 = playwright 冒烟：布局断言（文本区在上、模型→环→发送右对齐）、首轮 pill 显隐与用量行显隐（只有缓存写入、无命中行）、二轮「缓存命中 49%」跳升、对话框互斥与 Esc、模型菜单右对齐弹出，全程无页面错误。

## 2026-09-11 用量行二次校正：pills + 对话框 → 一行贴边纯文本（原型）

- **用户指正**：DSH 默认 web 底部的用量不是可点 pill（仓库源码 `ui-chat/StatsPills.tsx` 确为「双图标 pill + 点击弹明细对话框」，但实际产品形态是一行 ｜ 分隔的纯文本、贴聊天区下边缘、不可点）— 以用户看到的实际产品为准。
- **重构**：删掉 stats-row / stat-pill / stat-dlg 整套（HTML+CSS+JS 的互斥开合机制），换成单个 `div.stats-line` — 居中、11.5px 减弱色调、tabular-nums、`hidden` 首轮结算前隐藏；文本 = 「输入 X tok ｜ 输出 Y tok ｜ 缓存命中 Z% ｜ W tok/s」，缓存命中与速度无数据时整段省略（首轮只有 输入/输出/速度）；composer-wrap 底 padding 16→8px 让它贴住下边缘。
- **保留**：mock 结算逻辑不变（send 捕获请求上下文、afterReply 结算、首轮 90% 缓存写 / 之后 94% 缓存读、TPS 按输出长度波动）；`composer-hint`（kbd 提示）移到用量行上方。
- 验证 = playwright 冒烟：首轮「输入 4.8K tok ｜ 输出 299 tok ｜ 52 tok/s」、二轮「输入 10.1K tok ｜ 输出 598 tok ｜ 缓存命中 49% ｜ 52 tok/s」、行底距 < 20px（贴边）、元素为不可点 DIV、无页面错误。
- **kbd 提示行移除**（用户要求）：「Enter 发送 · Shift+Enter 换行」不再单独占一行 — 并入发送按钮 `title`（悬停提示）与 `aria-label`（「发送（Enter 发送 · Shift+Enter 换行）」）；`.composer-hint` 的 HTML/CSS 整体删除。
- **用量行占位常显**（用户要求）：不再「无数据段省略 / 首轮前整行隐藏」— 四段固定占位、无数据写 0（「输入 0 tok ｜ 输出 0 tok ｜ 缓存命中 0% ｜ 0 tok/s」），加载即渲染，宽度稳定不跳；`turnAcc.steps` 与 hidden 逻辑删除。

## 2026-09-11 草稿态跨切换保持 + 返回清理；记账横幅真 bug 修复

- **草稿态**：引擎 `.tavern-draft` 标记文件 — draftCard 写入、publishCard/cancelDraft 移除；`state()` 返回 `drafting`。切走再切回仍停留建卡页（TavernView 按 drafting 直进 draft 模式）；「← 返回卡库」= 新 `cancelDraft` RPC（清空 preset/runtime/savings 恢复空工作区）→ 卡库页。真 E2E：写入内容 → 切走切回仍在建卡页 → 返回 → 工作区 0 项恢复空态。
- **记账横幅常驻真 bug**（用户报告「启用了 tail agent 横幅一直出现」）：`state().maintenanceOn` 语义是「维护提示词非空 = 尾代理启用」，被横幅/禁发送误用成「运行中」→ 卡带维护提示词就永久禁发送。修复 = `state()` 拆出 `tailRunning`（引擎 `gates.has(sessionId)`，闸门在途才 true），横幅/禁发送/记账行判定全部改用 tailRunning；客户端 2s 轮询跟随宿主闸门（约 2s 内出现/消失）；「启用」语义仅保留在编辑器 chip。

- **卡库点卡进工作空间真 bug**（用户报告）：① `LibraryPanel.load` / `ImportPreviewPanel.commit` 残留 `setMode(workspace)` — 任何宿主未翻转的路径（如残留 `.tavern-draft` 标记使 drafting=true）都会把用户留在编辑器页；② `importFromLibrary`/`commitImport` 不清草稿标记 → 加载真卡后 drafting 仍 true，草稿路由锁死。修复 = 两处删 setMode（加载后由宿主 onCardReady 切聊天视图 → opening）；引擎两个导入路径移除 DRAFT_FILE（载入真卡即结束草稿）。测试改为断言宿主接管（不再断言进工作空间）。

- **多流程压测通过 + 陈旧 bundle 提示**：新会话点卡 / 发布+清空后 / 双击卡三条流程均进开场页。用户若仍见「点卡进工作空间」：其运行中的 `pnpm dsh tavern` 进程早于最后一次 bundle 重建 — 模块服务在**进程启动时**快照 `lib/client.js`（`initialBundleSnapshot`），重建不达已运行图。**重启 `pnpm dsh tavern`** 即得新行为。
## 2026-09-12 发送仍弹 Key 对话框真 bug：credentials.describe 读错字段

- **现象**（用户报告）：设置 API Key 保存成功后，每次点发送仍然弹出 Key 对话框。
- **证据链**：`TavernApp.refreshKey` 读 `described.value?.DEEPSEEK_API_KEY?.value` → `CredentialInfo` 的字段是 `{configured, source?, writable}`，**没有 `value`**——credentials 远端面单向原则「Secret values cross in one direction only — no method here returns one」（`api/settings-controller/src/credentials.ts`）。`stored` 恒 undefined → `keyMissing` 恒 true 并被 `checkKey` 缓存 → 每次发送预检必弹框。
- **为什么测试没抓住**：app 级测试的 `credentialFace` 假面按**客户端错误读法**造形（`{value: stored}`），假面与线上一致地错。修复 = 假面改产真线形 `{configured: boolean, writable: true}`（对齐 stock 消费方 `ui-settings-plugins/web-search-card-controller.readCredential` 的读法：`response.value[ref]?.configured`）。
- **修复**：`refreshKey` 改读 `view.configured !== true`；env 提供的 key 同样计为 configured（`configured` = 「解析该引用当前能取到值」）。保存后 / `credentials/reference-updated` 事件都会重读，缓存随即校正。
- **验证**：29 项 jsdom 测试（含「已存 key 发送不弹框」回归，用真线形假面）；playwright + 系统 Chrome 冒烟 — dummy key 下点发送不弹框、prompt 正常入列。

## 2026-09-12 真实客户端 composer 对齐原型：两行结构 + 上下文占用环 + 底部用量行

- **结构**（对齐 ui-mockup.html 的 DSH InputBar 结构）：composer 改两行 — 文本输入区在上，控制行右对齐（模型席位 chip → 上下文占用环 → 发送）；kdb 提示行删除（并入发送键 title/aria），底部为**一行 ｜ 分隔纯文本用量行**（不可点、占位常显、无数据写 0）。
- **模型席位升级为两级钻取菜单**（对齐原型 mp-cell 结构）：根面板两行 cell（「模型 ▸ 当前值」「思考强度 ▸ 当前值」），子面板 = 分组列表行（选中尾部 ✓）+「‹ 返回」行；Esc 逐级退回、根级关闭；外部点击关闭。数据仍走 `modelDirectories.directoryFor().select()`。
- **真实数据面**（全部宿主投影，tavern profile 经 base+web-app 层已挂载对应单元）：
  - `tokenUsage`（token-meter）：输入 = uncached+cacheRead+cacheWrite 三桶计费输入，输出 = outputTokens，缓存命中 = cacheRead/计费输入；挂载于 base 层。
  - `sessionStats`（session-stats）：tok/s = decodeTokens/(decodeMs/1000)（解码时长口径）；挂载于 web-app 层。
  - `contextPressure` + `contextBreakdown`（token-meter）：占用环 = `contextOccupancy(pressure)`（复用 ui-conversation 的实现，新增其 client 入口导出）；分段占比条 = breakdown 三段按 `percent × tokens/total` 配比（启发式配比之和 ≠ provider 占用，DSH 同款只画比例），零宽分段不画。
  - 读取通道 = `sessions.binding(id).session.projections.faceOf(key)` + `useSyncExternalStore`（`useProjectionValue` 本地封装）；能力缺席读 undefined，界面落 0 占位。
- **顺带修复默认开场页渲染两遍**（真实浏览器冒烟抓到）：transcript 里残留两个 `opening === null` 的 defaultOpening 渲染块，删去无封面那份。
- **门禁**：ui-tavern 15 项 app 测试（含用量行 0 占位 / 投影结算 2K·45%·50 tok/s / 环 15% 面板明细 / 两级菜单钻取）；oxlint、tsc、jscpd 全绿；playwright 冒烟（opening ×1、用量行、模型席位、占用环、发送不弹 Key 框、零 console 错误）。
- **防复发**：线形假面必须对着**服务端投影代码**造形（本例对齐 `CredentialInfo`），不能对着客户端读法造形——假面复制客户端 bug 时测试全绿但线上全坏。

## 2026-09-12 工作空间文件策略重写：固定模板路径 + 三区可建 + 目录改名真 bug

- **固定模板路径（用户定形）**：`preset/`、`preset/prompt/`、`preset/scripts/`、`preset/tools/`、`preset/meta.json`、`runtime/`、`savings/` 与四个提示词文件 = 模板固定项——可为空、不可删、不可改名、不可缺失。引擎 `FIXED_PATHS`（原 `FIXED_PROMPT_PATHS` 扩容）统一拒绝 delete/move；右键菜单**不渲染**不可操作项（固定文件干脆不弹菜单），不再是划线禁用。
- **三区可建**：create/mkdir 放开到 `preset/`、`runtime/`、`savings/`；`runtime/` 内容改为可手动编辑（`writeWorkspaceText` 替代 `writePresetText`，savings 快照仍只读——载入以其为事实来源）。
- **删除跳页真 bug**：删除所选文件后代码调用了不存在的 `open(DEFAULT_FILE)`（`ReferenceError`）——改为 `read(DEFAULT_FILE)`；且 meta.json 现为固定项不可删，state().hasCard 不可能因删文件翻转，双重封死。
- **目录改名真 bug（用户报告「一直无法成功」）**：`commitEdit` 对带尾斜杠的目录路径取 `lastIndexOf('/')` 取到尾部斜杠 → parent = 目录自身 → 目标变成 `dir/子名/`（移进自己）→ 引擎异常被吞。修复 = 先剥尾斜杠再取父；引擎加 `to 在 from 子树内` 拒绝（防 API 直调同类请求）。E2E：`preset/untitled/` → `preset/my-notes/` 落树 ✓。
- **移动语义收紧**：目标已存在时拒绝（此前 cpSync 会并进已存在目录造成静默合并）；move 仍限 `preset/` 内。
- **门禁**：引擎 38+3 项（固定路径矩阵/三区新建/子树拒绝/占用拒绝）；客户端 30 项（菜单条件渲染、删选区回落默认文件、runtime 可编辑、savings 可建）；playwright 五场景（固定目录菜单、固定文件无菜单、savings 建目录、删除不跳页、目录改名）；oxlint/tsc/jscpd/test:docs 16 项全绿。
- **附带**：补齐 tavern 四包双语 README（含 Model Experience / Known Limitations 骨架）；Agent Note `2026-09-11-tavern-world-card-engine` 落地；`docs/tavern-prototype/` 与 `tavern_presets/`、`tavern_workspace/`（用户数据）加入双语文案料/发现排除；修 `scripts/repo-files.ts` 在 Node 22.22 的 glob ENOTDIR 崩溃；补完 llm-mock-server 早期半截的 `successTexts` 池（cli 接线 + 恢复 spec 丢失的 chunkSize 参数）。

## 2026-09-13 载入/清空换绑链路：弹窗遮罩根因修复 + 编辑卡同卡更新 + 输入法 Enter + 思考行

- **载入三层根因定位与修复**（探针逐层复现，详见 `docs/tavern-prototype/load-rebind-debug_zh.md`）：① 客户端会话列表晚听 fork 新 id → `sessions.open` 同步抛 unknown session 被吞 → 视图停在旧会话（用户症状：历史不变、旧线继续发）；② 旧设置/保存弹窗 `.keyDialog` 遮罩未关 → 载入后「清空/保存/发送」全部被拦截，直到手动刷新；③ 旧存档无边界戳只能 runtime-only。修复 = `switchSession` 统一入口（先 `sessions.refresh()` 再 open、250ms 退避重试 8 次、**rebind 先关弹窗**）、清空/载入后 forgetLastLine + 转写按新会话全量重读。
- **编辑卡同卡更新**：卡库铅笔 → `editFromLibrary`（载卡 + `.tavern-editing` 戳）→ 失焦保存 `writeText` 同路径双写卡库真卡；返回 `cancelEdit` 恢复原卡；编辑模式头部「保存并开始」→ 卡库已更新后 `reset` 开新会话。`state.editing` 贯穿 engine→api→shim→view。
- **输入法 Enter**：composer 加 stock keymap 语义 IME guard（isComposing / keyCode 229 / compositionend 后 10ms 窗口）——中文确认候选词不再发送。
- **（思考）行**：前端聚合 live `assistant/live-chunk` reasoning-delta 渲染思考折叠行（durable message 不带 reasoning，此前只读 attempt 流所以成功回合永远没有）；mock `--reasoning-text` 显式配置时 `success` 也流思考 chunks + result 事件带 `reasoning`/`assistantText`（修复 payload 被 completeText 先行 emit 吞掉的 bug）+ pretty 日志 `[assistant] <thinking>…</thinking>` 正文块；`scripts/mock-llm.sh` 默认喂三条（思考）行。
- **门禁**：受影响包 585 单测、src 门 31/31、双构建、lint/doc-sync 16/16；载入 R4 的 headless 复验被真机手测接替（探针遗留脏会话导致断言失真），手测清单见 `load-rebind-debug_zh.md`。

## 2026-09-14 · 插件独立性改造：preset 替代 + wrap 换轨 + 内核双 revert

三段连续落地（决策与证据链见 independence-and-release_zh.md，基线 tag `tavern-baseline-2026-09-14` = `7376b54`）：

1. **preset 组合级替代（`4f74e9c`）**：bundle patch 禁 `agent-presets` + `ui-agent-preset` 两行；引擎 create/reset 去 `agentPreset: 'none'`；revert `bca70fe`——session-controller 回到 init 期 no-service 分支。组合测试钉住 creations 无 agentPreset。
2. **wrap 换轨提交时合成**：新 `tavern.prompt` RPC（客户端经 util-crypto 铸 requestId/本地采 zone，引擎等尾闸门 → `renderWrapPair` → `composeWrappedText` 单块合成 → 转发 controller.prompt，rpcId 取证语义不变）；wraps 状态机/wrap 快照/`registerWrapRewrite`/`registerSeedRetentionWrap`/载入 baseline 整体退场；UI 转写/last-line/存档 summary 走替换式剥离（引擎 `stripInstructions`、客户端 `wrap-markers.ts` 镜像）。**单块定形的根因**：provider 把消息 text 块 `join('')` 直连，多块方案换行无处安放——单块让剥离锚定 composer 独有边缘，原文恒等。
3. **revert `b6c28be`**：request-view 缝从内核退场（agent-loop/agent/scope/生成物/architecture 三语随 revert 还原）。终态核对 = 零命中 grep + 对照基线 tag 的内核 diff。

验证：tavern 47+14、ui-tavern 56（prompt 假面移到 tavern face：send 断言 `face.calls`、拒绝用例走 rejecting override、running-lock 断言 calls 不含 prompt）、session-controller 785、agent-loop/scope 全绿；typecheck/lint/build:lib:host/api+ui bundle 全过。

## 2026-09-16 meta 契约扩容 + 默认开场页问候选项（一键导入前置 P0/P1）

- **meta 契约扩容**：`TavernCardMeta` 增可选 `creator`/`version`/`tags[]`（宽容解析——类型不符或为空即缺席，旧三字段卡读形不变，workspace.spec 钉住）；骨架 meta 占位补齐。关键坑 = 客户端 `serializeMeta` 原先按三键**重建**整个 meta.json：若不改，导入的 tags/creator 会在用户第一次编辑标题时被静默抹掉。改为 `parseMeta` 返回 `{meta, raw}`、保存 = 身份行合并回原始 JSON 对象（字段保真），未知字段忠实穿透（ui 测试断言 `"custom": 7` 都存活）。身份头加只读「作者 · 版本」小字行；meta 轮询变更判断纳入新字段。wire 未动（身份头/预览走 readText 直读，state/library 三字符串已够消费方）。
- **默认开场页问候选项**：可选文件 `preset/greetings.json`（`{greetings: [...]}`，first_mes 在首 + alternate_greetings，导入器日后生成）渲染选项按钮，点击与 opening.html 选项共用 `updateDraft` 入口只填不代发；缺文件/坏 JSON/空数组/非字符串条目静默退回标题+简介；带 opening.html 的卡不加载。同一作用域内直调（iframe 才需要 postMessage）。真·首条 assistant 播种同日拍板**不做**（内核受控播种缝不开，详见 st-card-field-mapping_zh.md §8.2）。
- **顺手修潜伏 bug**：`.onCover` 被默认开场页标题/简介引用却从未在 App.module.css 定义——CSS module 里 `css.onCover` 是 undefined，封面背景时 className 出现字面量 "undefined"；现补一条可读性文字投影规则并让选项标签复用。
- **踩坑三条**：① lint `no-confusing-void-expression` 拦 `onClick={() => updateDraft(text)}` 箭头简写——加大括号；② Agent Note 英文侧语言切换器格式 = `English | [中文](…zh.md)`（自身纯文本在前），写反被 verify-translation-pairing 拒；③ CSS 变量必须用本模块已声明的（`--t-card`/`--t-gold-dim`），别发明新变量名。
- 门禁：tavern+ui 189/189、typecheck、lint（残留 warning = .oxlintrc 双 profile 既定豁免）、test:docs 16/16（Agent Note 三件套 + 两包 README 双语同改后 --write 重录 sidecar）。Agent Note = implemented/feature/2026-09-16-tavern-meta-greetings-contract。遗留：导入器生成端（writing greetings.json/st-card 落盘）属导入期 PR。
## 2026-09-16 二轮：st-card.json 永久底账砍掉 → 翻译工作单 + 翻译器规格立档

- **拍板**：`preset/st-card.json` 永久底账**不做**——重折叠走重导入（原始卡文件永远在用户 ST 库里）、审计走导入报告、lorebook.json 全字段已承载世界书、greetings.json 全量承载开场。agent 翻译需要的源料改走**一次性工作单 `preset/st-import/`**：落（导入器写 README 工作单+regex.json+stscript.txt）→ 消化（写卡 agent 按菜谱翻译→自验→删除目录→卡归净）→ 不消费也自洽（目录常驻 =「有翻译待办」）。纯 files 表产物，`commitImport` 零改动。
- **翻译器规格立档** `docs/tavern-prototype/st-import-work-order_zh.md`：工作单文件 schema（regex.json 带 verdict 预分拣 translate/pending-render-hook/drop——导入器判定、agent 只执行）+ README.md 模板（含导入报告三类：丢弃/缺失引用/体量统计；报告寿命 = 目录寿命）+ 翻译菜谱表（USER_INPUT 注记式→wrap 前后段、WORLD_INFO regex→lorebook.json match 字段+grep -E、QR→面板按钮+runScript+.tavern-textarea 只填不发、STscript 按命令意图映射）+ agent 消化契约五步（条件触发/读单/产出/自验/收尾，任一放弃目录保留标 ✗）。边界明确：agent 只消费工作单+卡内既有，不动 runtime；PR3 才在 writer-guide.md 补节（不在无工作单卡上提这些，引导只描述现实）。
- mapping 文档 §5.3/§7 指针 + 权威清单更新；test:docs 16/16。未提交（与后续工作同批或单独批均可）。
## 2026-09-16 三轮：wrap 退役 → 动态 post 注入定案（未实现）

- **拍板**：wrap 方案退役 + `prefixPrompt` 文件退役（ST `pre_prompt` 并入 postPrompt 头部）；postPrompt 改为 DSH 原生「最后 user 轮动态附加 user 消息」的渲染模板；KV 缓存回退接受；测试重录 ok。定案文档 = `docs/tavern-prototype/dynamic-post-injection_zh.md`（含 N→N+1 全模拟表）。
- **机制地基取证**：注入缝 = `agent/pre-step`（`agent-loop/src/agent.ts:244-250`），claims 追加在 step() 内 pre-step 之后（`:373-377`）→ **post 必须骑 `decision.messages`**，pre-step 内直接 `session.append` 的消息会排在玩家消息之前；`surfaceOp: replace` 是**原位替换**（`session/src/surface.ts:469` splice 顶位，非尾部追加）——上一轮「直接 append replace 后 post 出现在 uN+1 之后」的表述是错的；影子删除器 = **空内容 system/message**（内核自有先例 `agent-loop/src/runtime-context.ts:88-102`，`SystemPromptProjection` 对空节点惰性，head 恒为位序第一真实 system 节点）；fork 种子原样拷贝（`session-controller/src/commands.ts:263`）→ 影子/活态在子会话重折叠自洽；尾代理 system 唯一 = head 每步原位比对刷新（一致零提交）。
- **注入协议**：全局 pre-step 监听器（主代理分支；scoped 曾卡死 waterfall 链，同引擎 gate 现例）每「有 claims」的 step：① 扫 `surface.nodes` 尾部所有活态 post 节点（user/message + `source.kind==='plugin'`）→ 空 system replace `[p..p]` 逐个影子化；② 按 claims 顺序从 stash FIFO 各取渲染值 `createUserMessage`（source 对齐 time-context：kind plugin + form snapshot + sections）骑 `decision.messages` 尾部。触发不限于 step 1——中途 steering 消息被认领的 step 同样注入；无 claims 的工具循环 step 跳过（已有 post 保持 live = ST depth 注入「每次请求都在」）。
- **行为影响**：autosave/重试/载入/保存/清空边界全不变；`repairSeedInbox` 脱离 wrap 修复职责；`stripInstructions` 退为旧日志显示 shim（新代码按 source 过滤，同构 stock ui-chat 的 ContextMessageNode 分类）；已知噪声 = 影子化 bump `replaceGeneration` → 该 step `request/header` 以 `reason:'series'` 追记（无语义影响）。mapping 文档 §行 64/§2/§4.2/§4.3 注入落点已同步（prefix 退化 → post 尾注段）。design_zh.md 反转留到实现落地同批。wire 无变更。
## 2026-09-16 四轮：动态 post 注入实现落地（已实现，全部门禁绿）

- **引擎**（`packages/extensions/tavern`）：① `prompting.ts` — `renderWrapPair`/`composeWrappedText`/标签常量退役，`renderPostMessage`（legacy prefixPrompt 前段 + postPrompt，两段独立 renderPlaceholders 后空行拼接）返回 `RenderedText`；`stripInstructions` 保为 wrap-era 显示 shim。② `workspace.ts` — `PROMPT_FILES` 三件（骨架只建三件），`CardPromptFile` 类型保留 prefixPrompt 读能力，`FIXED_PATHS` 摘除 prefixPrompt（可创建/改名/删除）。③ `index.ts` — `postStash: Map<SessionId, {text}[]>`（**每 push 一个唯一 wrapper 对象**，catch 按 findIndex 身份回滚——并发提交不误删他人条目；空文本条目 = 该 claim 无 post，位置占位保 FIFO 对齐）；`prompt()` content 恒原文单块；`deleteSession`/`load`/`reset` 三处 stash 清理。④ 注入器 = 扩展现有全局 `gate` 监听器（拆出 `injectPosts` 私有方法）：主代理分支扫 `session.surface.nodes` 反向找 plugin-source user 事件 → `session.append('system/message', {turn, step, message: createSystemMessage('')}, {surfaceOp: replace [seq..seq], sourceEventSeqs: [seq]})` 原位影子化 → 按 claims 数 shift stash、`createUserMessage`（plugin + form snapshot + sections）返回 rides；gate 末尾 `[...filtered, ...rides]`。⑤ 快照 `chatSnapshotRows` 原本就滤到 `source.kind==='user'`——post 天然不进，只更新注释。
- **客户端**（`packages/client/ui-tavern`）：转写已有 `sourceKind !== 'user'` 过滤（post 行天然不可见）；`wrap-markers.ts` 重写为 legacy shim 文档（tag 常量删除）；导入器 `pre_prompt`+`post_prompt` → 单一 postPrompt 文件（pre 前置空行分隔）、骨架预填三件、FIXED_PATHS 镜像摘除 prefixPrompt；locale `json.sub` 双语更新合并口径。
- **REAL 组合测试钉死的形态**（`loader-composition.spec`）：turn1 视图 `['第一回合', postMessage]`、turn2 `['第一回合','第二回合', post]`（驱逐生效）、turn3 同构、清空/载入后的 `['第一回合','第二回合','第五回合', post]`（checkpoint 种子 p2 活态 + 新注入影子化它）、尾 fork 种子含 claim + 活态 post 且 maintenance 恒最后、durable 层玩家消息恒原文 + 每 turn 恰一条 plugin post +影子空 system 数 = turn 数-1、停止用例的 aborted 回合 tool-result 以空文本 user 行出现在视图（**既有行为，旧断言用 lastUserText 掩盖了**）。
- **踩坑**：① 断言口径——旧 `lastUserText` 断言把 post 当唯一收尾、改成 `userTexts` 全等后暴露 tool-result 空文本噪声与尾 fork 种子历史分叉，「恰好认领一次」改用 durable 日志 player-claim 计数断言（视图 contains 会把尾 fork 的继承历史算进去，length=3 是对的不是 bug）；② 双 profile lint/tsc 矛盾——`mock.calls[0]!/0!` 的非空断言 CLI-oxlint 报 unnecessary 而 client-face tsc 需要（noUncheckedIndexedAccess），`.at(0)?.[0]?.text` optional chaining 两面通吃（该 error 在干净树就有，顺手修）；③ pre-commit staged 与 CLI lint 的 warning 豁免集不同，以 CLI `pnpm run lint` exit 0 为准。
- 门禁：tavern+ui 191/191、typecheck、lint exit 0、duplication 0 clones、build 全绿、test:docs（Agent Note = implemented/feature/2026-09-16-tavern-dynamic-post-injection 三件套，--write 重录 sidecar）。design_zh.md/README 双语/writer-guide.md/st-import-work-order 同批反转完成。遗留：真机手测（`pnpm dsh tavern` + mock-llm，需重启宿主吃新 lib）。
## 2026-09-16 五轮：prefixPrompt 引擎读取线撤除（用户复核指正）

- **拍板修订**：「原 pre 内容进 post 消息」只由 **ST 导入期的文件合并**承建（pre_prompt+post_prompt → 单一 postPrompt 文件），引擎**不读** `prefixPrompt`——上一批的 legacy 读入拐杖撤除（那是把导入语义错误扩成了运行时读取；退役文件半活化 = 一个无谓的第三代码路径 + 静默吞字面的错觉）。
- **落地**：`renderPostMessage` = postPrompt 单一渲染（删两段拼接）；`readCardPrompt`/`CardPromptFile` 联合收窄到三件；FIXED_PATHS/writer-guide/design/README 双语全部改「死数据，不读取，旧内容手动并入」口径；README Known Limitations 加升级提示条目（双语）。测试反转：prompting.spec 的四文件用例改**负例断言**（prefixPrompt 有内容但 post 恒不含）；loader-composition 的 seedCard 保留写非空 prefixPrompt 作**负例夹具**（postMessage=CARD_POST，任何请求不得含 CARD_PREFIX）；workspace.spec 注释改口径。
- 门禁：tavern 91/91（+ui 191/191）、typecheck、lint、test:docs 16/16（README sidecar 重录）。提交 = 五轮修正批。
## 2026-09-16 六轮：媒体资产归位 + 真机验证 + 手测事故记录

- **assets 归位（commit `9951c79`）**：上传改落 `preset/assets/`、骨架新增 assets/+README、listTree 撤根级 assets 死行走。
- **真机 e2e 验证上传落位**（playwright-core + chrome-1208 + 独立宿主实例 `--port 3123`）：创建会话 → 建卡页 → 身份头上传 → 实测文件落 `preset/assets/probe-cover.png`、`meta.cover` 回写 `preset/assets/…`——**meta.cover 口径铁律 = 工作空间相对路径、带 `preset/` 前缀**（readAsset 围栏要求路径在 preset/ 内）。
- **存量数据迁移（本地仓库数据，不入 git）**：2 工作空间 + 3 卡库卡的封面从 `preset/` 根移入 `preset/assets/` 并重写 meta（首版误写 `assets/…` 无前缀会被围栏拒读，当场修正为 `preset/assets/…`）。其它散落媒体未动（卡 CSS 的自有引用仍有效；新约定只约束引擎写入点）。
- **手测事故（用户确认没事）**：UI 清理探针定位器过宽 + 全局 dialog 自动 accept → 误删工作空间 ws-20260914-013130-834-1（rmSync 无废纸篓；runtime/+savings/ 不可恢复；durable 会话日志仍归档于 ~/.dsh/sessions；卡库完好；无 APFS 快照可救）。善后：探针宿主已杀、探针自建工作空间已删。**探针铁律**：① 涉上传/删除的 e2e 必须先拷数据到 /tmp 隔离沙箱；② 探针永不自动 accept 对话框，破坏性点击禁止自动化；③ 定位器先 assert 目标唯一再取其专属按钮。
- 门禁：191/191、typecheck、lint、test:docs 16/16、build 全绿。card-presentation_zh.md 的动态 post 口径反转（并行批）随本条入手。
## 2026-09-16 七轮：同名封面上传走覆盖（用户拍板）

- **拍板**：`preset/assets/` 内同名封面上传改「覆盖」，不再数字后缀躲重名（cover-2/3 累积是「静默覆盖」恐惧的遗产；资产目录里同名 = 刻意替换）。引擎 `writeAsset` 本就无 exists 拒绝（writeFileSync 直写）——纯客户端改动。
- **落地**：`uploadCover` 撤 tree 占用查询（少一次 RPC），路径恒 `preset/assets/<净化名><ext>` 直写；断言补「同名文件在位时仍写同路径、无 cover-2、meta.cover 恒同值」。设计文档身份头段补「同名即覆盖」。
- 门禁：ui-tavern 101/101、tsc、lint 0 error、build 全绿。
## 2026-09-16 四轮：ST 一键导入器落地（目录导入入口退役）

- **st-import.ts**（客户端纯折叠模块，12 例单测）：PNG 魔数 + tEXt chunk 走读（ccv3>chara，PNG 字节=封面）；spec 判定 + V1/V2/V3 + legacy pre/post 捡拾 归一化到 V2 形；五路折叠=systemPrompt 按 ST 装配序成段（恒定条目 before/after 夹人格栈）+ 触发条目进 lorebook.json（条目原文挂 st 字段）+ 生成 lorebook.sh v1（jq：tail 快照→contains 匹配→概率门→按序输出；jq 缺失=世界书静默失效）+ `{{lorebook()}}` 挂 postPrompt（A#1 反转定案）+ post_history_instructions 同落 postPrompt；greetings.json（first_mes 首位）；meta 折叠（creator/version/tags/desc 缩写 140 字）；verdict 预分拣（translate/pending-render-hook/drop）进 st-import 工作单，README 第一节=导入报告（丢弃/缺失引用/禁用条目/体量）；工作单只在有 material 时物化；persona 骨架件（persona.sh+setup/persona.md）随行；importFromJson 全程 try/catch→error 面（杜绝 unhandled rejection）。
- **入口合一**：「从其他目录导入」删除（用户拍板：parseDirectoryImport+死 locale 键两语言+死常量一并退役）；酒馆卡入口 accept `.png,.json`；PNG 封面提交后紧接 writeAsset 落 `preset/assets/cover.png`（meta 预指路径；失败 alert 不阻断）。预览页身份头/字段保真流不变。
- **踩坑**：① 树行显示 basename 而非全路径——测试点击目标用 'systemPrompt' 而非全路径（第一次匹配到路径徽标是巧合）；② cover 形状在 importFromJson 返回时须重整（{coverPath,…}→{path,…}）；③ 工作单 JSON 测试夹具的 enabled:false 被 importFromJson 消费后 report 行才出现——先修夹具再看断言。
- **§5.1 勘误连带**：实现核对时发现 WORLD_INFO 正则语义此前写错——ST 是注入时改写条目 content（world-info.js:5086），不是「改匹配方式」；mapping §5.1 + 工作单菜谱（match 字段设计作废）改为「静态烘焙进条目 content（差异明示）」。
- 门禁：ui-tavern 112 + st-import 12 + tavern 91 全绿、typecheck/lint/test:docs 16/16、Agent Note 三件套、双语 README 反转。剩余=工作单 agent 消化（PR3）+ lorebook 全功能模板。
## 2026-09-17 兼容体系终案：硬门槛退役，收编官方 dsh plugin 通道（已验证列表 + 安装时一次探测 + 运行期零探测）

- **拍板链**（用户三轮收敛）：版本 assert 拒装 → 「高低版本都能装、坏在运行才发现也不行」→ 「安装时测一次钉盘」→ 「无门槛，不按版本号拒装，失败给方向正确的升/降级命令」。降级能力矩阵、per-seam 运行期开关全部砍掉——错误通道只有一条。
- **机制核读（唯一权威 = 上游源码）**：① `boot/app-boot/profile.ts` 的 `PROFILE_TEMPLATES` 只是首启模板表、无白名单，out-of-tree profile 是一等公民；② bundle 解析 two-anchor **先安装闭包** → `dsh-base`/`dsh-web-app` 恒跟宿主版本，我们钉不钉都无效（版本耦合被上游结构性消解）；③ `dsh plugin` reconcile 只扫 **profile manifest 依赖**——我们包自己的依赖边不会被扫到 → 「单条 add 依赖边自动带入 web-app」是误判，in-box 层必须以**行声明**存在（上游模板同形：行不依赖、reconcile 永不触碰），manual 路径因此是 `--from-default-profile web` 先行；④ `healProfilesModuleFallback` 保证全 profile 共享安装本体的单 cordis 实例。
- **落地**：`packages/bundle/bin/compat-probe.mjs`（安装态一次：8 缝解析/导出 + 三包 ESM 导入 + 单 cordis 实例，判定逐项落盘 `<profile>/.tavern-compat.json`，fail 按方向给命令；PATH 外宿主回退读本仓 node_modules 版本）；`setup.mjs` 重写为官方通道薄壳（无 dsh → `npm i -g @deepseek-ai/dsh@latest`；已验证内跳过探测；profile 播种 = 上游 `initProfile` 同字节 PATCH_TEMPLATE/PNPM_WORKSPACE；装入转发 `dsh plugin add`；老 manifest 钉死的 in-box 依赖自动清理迁移；LOCAL 演练模式保留）；`compat-notice.ts`（引擎启动一次性读判定，缺失/fail/版本漂移仅警示；`withHostGuidance` 包尾 fork 与 post 影子化——首回合缝错误带重跑指引）；`dev.mjs` 硬断言 → 已验证列表警示、导出探测 3 spawn → 进程内 import；双语 README 安装段三条命令 + 纯官方等价路径、版本策略段无门槛口径、生态行（dsh-plugin topic）。schema 换 `{probeVersion, verified[]}`（bundle 副本=发布真源）。
- **踩坑**：① dev.mjs 模板串内嵌反引号未转义（先前遗留语法错，`node --check` 兜出）；② `.mjs` 里手滑写 TS `as` 断言；③ dev 机 dsh 不在全局 PATH → `detected` 空、「已验证列表 外」误报；④ bundle 副本与 config 镜像漂移（probe 判 false）→ 漂移守卫 spec 钉字节一致（226→228 例）；⑤ win32 `.cmd` shim 的 shell-string 规则要按调用方逐个标记（`node.exe` 直呼必须无 shell）。
- **验证**：228/228（+drift spec 2）、tsc host/client、三脚本 `node --check`、探测真机实跑 `宿主 0.1.5-rc.1｜判定 pass｜已验证列表 内`。**遗留**：CI watcher（verified 列表自动维护）未建；官方通道隔离 DSH_HOME 端到端演练待发布前钉层序；发布机 checklist（`pnpm -r publish` 改写 workspace:* / `npm view` 查名 / `dsh-plugin` topic）。
## 2026-09-18 「保存并开始」不跳开场页：诊断法反转（静默吞错链可见化）+ 孤儿锚点套件发现

- **现象（用户报）**：编辑/创建卡的「保存并开始」点击后不跳 opening 页；且呈现数据相依—早期测试入库的卡复现、新建卡不复现。链上既有读数：draft/edit 双路 UI→publishCard→(编辑)reset→onSessionSwitch→开场页门闩（`cleared || lines.length===0`）逐步核读全通，引擎 markers（`.tavern-draft`/`.tavern-editing`）磁盘检查零残留、host 侧 `agent-preset/not-found` 抛错通道确认（`resolve()` 对未知 id）但 `empty` 正常装配——**纯静态读数到不了真因**。
- **结构性根因一（复发机制）**：双入口（DraftPanel.publish 与 WorkspacePanel 编辑按钮）的所有失败分支全是 `() => undefined`/`undefined → return` 无声通道——publishCard 拒、reset 拒、onSessionSwitch 缺失三种失败在 UI 层完全不可见。任何真宿主按工作空间的拒答（探测过的候选：agent-preset 解析、一会话一工作空间守卫、boundary 账本）都表现为「点了没反应」，且每轮回归都查无对证。修复 = 双入口可见化（console.warn + `window.alert` 带原始 message；沿用 ImportPreviewPanel 封面上传的既有 alert 先例）。真因交由下一次点击弹出原始错误一次定位。
- **结构性根因二（锚点盲区）**：`packages/*/tests-client-plane/` 的客户端 UI 规格（含「保存并开始 publishes, resets, rebinds with cause edit」锚）**自快照抽取起从未被 vitest include 匹配**（glob 只认 `packages/*/tests/**`）——锚存在但从未执行。尝试接线时暴露更深缺口：session-controller 的浏览器 `client.js` 顶层要求宿主 `window.__ModuleLoader__` 预lude，Node/jsdom fork 里模块加载即死。本轮保留三eshnew 失败可见性锚于该目录（publishCard 拒/reset 拒 → alert 断言），vitest include 维持原 glob 并在 config 注明 KNOWN GAP（pnpm test 门禁保持 228 绿）；接通前置 = 测试态 `__ModuleLoader__` shim（后续专项）。
- **门禁**：vitest 228/228、`pnpm build` 双 face 全绿（可见性补丁进 client bundle）。
- **真因補记（同日）**：用户观测收敛到「只在我测试期入库的卡上复现」——验尸 `tavern_presets/`：card/card-2/card-3/card-4 四张卡的 systemPrompt **0 字节**、meta.json 全空（draft 骨架未经填写直接 publish），用户自建卡（dnd 4513B / 这是第一张卡 27B）皆有内容。空卡并非「跳转失败」：hasCard 只认 meta.json 存在 → 空卡也换绑成功进聊天，但默认开场页渲染出空标题/空简介/零开场白的空白页——观感即「点了没反应」。**修复**：`publishCard` 增加发布地板 = readSystemPrompt(root) 非空（workspace.ts 新导出 readSystemPrompt），空卡入库在引擎侧抛中文指引错误，由 UI 可见化补丁弹窗承载；post-root-cause 门禁 228/228 + build 全绿。遗留处置：四张空卡为测试垃圾待用户亲手 `rm -rf`（ destructive 不代删）。
## 2026-09-18 风月卡导入：st-import 第二方言（foldFengyueCard）

- **需求（用户口述契约）**：`tavern_presets/战争模拟.json` 是风月（catai.wiki 生态）卡——`pre_text`+`post_text` 合并 = postPrompt、`pre_prompt` = systemPrompt、世界书要翻译。评估发现现网 ST 归一化会把它误折（pre_prompt 当旧 DSH 后注、HTML description 压行、world_book 无视）。
- **决策**：`st-import.ts` 双方言——JSON 容器探测后按特征分流（`pre_text`/`post_text`/`world_book` 任一在场即风月；与旧 DSH 的 `pre_prompt`/`post_prompt` 对、ST 的 `character_book`/`world` 三方零重叠）。`foldFengyueCard` 机械全映射：世界书 `_or_@wb@` 键 → lorebook.json 双件套（原文挂 `fy` 槽）、HTML 开场页 → `setup/opening.html`（dnd 卡同座）、`opening_statement`+`suggested_questions` → greetings.json、封面远端 URL 浏览器抓取（已验服务器回 `access-control-allow-origin: *` + `image/jpeg`；魔数定扩展名——引擎资产白名单按扩展名）；无对位字段（key_region/value_region 注入位、`_and_` 组合、group、banned_words 等）全部进 `preset/st-import/` 风月版导入报告。
- **改动面**：入口改名 `parseSillyTavernCard` → `parseTavernCard`（双方言本质，TavernView/spec 两处跟改）；UI 其余零改动（选择器本收 .json、预览/commitImport/writeAsset 链路复用）。spec 新增风月组 7 例（含旧 DSH 不被劫持的反向锚）；真实卡全文烟测：6 条世界书键全对、13041 字开场页落位、三段合成如约。40/40 绿。
- **文档**：`docs/notes/feature/2026-09-18-fengyue-import{,.zh}.md` 契约+备选取舍（世界书入 systemPrompt 恒定段/description 压行/封面纯手动三个否决项），i18n 双文 blob 配对。
## 2026-09-18 scripts/cleanup.mjs unix 端口清理自 GroupKill 退场

- **现象（用户报）**：`node scripts/cleanup.mjs` 无法清理，且刚打一行 `terminate port 3080 pid 0` 就退出（exit 144）。
- **根因（双层叠加）**：unix 路径按 lsof 输出**列序** split 抠 PID——`[0]` 实际是 COMMAND（`node`→`NaN` 全被滤掉，端口清理从未杀对过进程），而输出末尾空行解析成 `pid 0` 继而被当作合法 PID——`process.kill(0)` 在 POSIX 语义是**向调用者整个进程组发 SIGTERM**，脚本第一步就把组内的自己＋父 shell 全杀（pkill 签名清扫、pid 文件清理、收尾统计全没执行；此前「能清」的场合都是端口本就空闲——空输出 slice(1) 后为空）。
- **修复**：`lsof -t` 纯 PID 输出（无表头、免列序耦合）＋ `> 0` 过滤；`kill()` 加卫语句拒 0/负数（0=杀组、-1=杀全用户都不可能是有意为之）；收尾占用统计复用同解析。`mock-llm.mjs` 的 win 路径本就 `pid > 0` 过滤、unix 走 `pkill -f`，无恙。
- **验证**：实跑修后脚本：正确报出真 PID 11000 并杀掉宿主、跑到收尾 `3080:0 / 8000:0`、exit 0、pid 文件清空、本会话 shell 存活。

## 2026-09-18 风月世界书 key_region 位码落地：lorebook 扫描面换「最近一条」语义

- **勘误（用户口述规格）**：风月卡 world_book 的 `key_region` 不是注入位/关窗深度——是**消息种类位码（1=system、2=user、4=assistant）**，键匹配面是「按位选中的种类集合里最近一条消息」；`value_region`（注入位）用户拍板不另设位（我们本来就只有 postPrompt 一处世界书座，体量行记一句即可）。
- **lorebook.mjs v1.5 双匹配面**：条目带 `scan.kinds`（风月折叠自 key_region 位码）→ 取该种类集最近一行做键匹配；无 `scan`（ST 条目）→ 维持最近 N 行（argv[0]，默认 12）拼合窗口，ST 行为零变化。快照只有 user/assistant 行且发送期 pendingText 预投影——mask 六（user|assistant）的条目实际等价「本回合玩家输入」匹配。
- **报告行更替**：移除「key_region/value_region 未迁移」旧行；新增 system 位知情行（快照无 system 行恒不命中）、key_region 缺落回默认 user+assistant 行；体量行明示匹配面 + `value_region 不另设位`。
- **验证**：spec 假卡喂 6/2/5/0 四种位码钉 scan.kinds 折叠与新报告行（19/19）；临时 runtime 端到端实跑生成脚本——键只在较旧 assistant 行出现的条目（旧窗口语义会误触发）不再命中，同消息双键条目正常命中。全量 235 + tsc 绿后重建 client 产物。

## 2026-09-20 卡 UI 失挂（懒树回归）救回 + dnd5e 开场链贯通

- **现象（用户报）**：dnd5e 卡开场页点「落盘并开始冒险」——不落盘、开场白也进不了输入框；且场景里看不到 openings.json 的可选项。
- **根因一（结构性回归）**：工作区 `listTree` 懒树化（根级只报 preset/runtime/savings 三目录行；测试与 TavernView 编辑器同批跟改）——`card-ui.loadCardUi` 的存在性探测仍按旧递归树语义 `entries.some(path.startsWith('preset/ui/'))`，懒树下恒 false → **卡 UI 整面失挂**：`opening-commit` 桥无人监听，开场提交石沉大海（iframe 等 15s 报「落盘超时」）；HUD 同样失联但开场期本就隐身，用户无从察觉。属漏改 call-site：整树语义退役时该探测点没被清点。
- **根因二（卡侧静默 no-op 家族）**：`opening_commit.mjs` 的「当前篇章」「队伍平均等级」patch 正则仍按旧 state.md 模板措辞（「## 当前篇章」节名 / 队伍节首行即平均等级），现行模板是「## 篇章进度」+ 队伍节两条 bullet——即使桥通了这两项也不落（真机 fixture 才现形）。
- **修复**：`loadCardUi` 探测改直读 preset/ui/ 四件套（读到且非空白才算在场，全缺/全空白 → null），挂载判定与树快照彻底解耦。dnd5e 卡：新增 `preset/scripts/opening_data.mjs`（runtime 直读 openings.json 单源）；ui 桥加 `opening-init` → `opening-init-data` 应答（镜像 dnd 卡握手）；opening.html 场景列表改「内嵌副本兜底 + 桥应答即以库重建」（内嵌副本同步为四场景现文案；用户手改开场白的 dirty 判定保留不覆盖）；`opening_commit` 两处 patch 正则对齐现模板。
- **行为定案（用户拍板，二次修正）**：「落盘并开始冒险」一键全包且零跳转——落盘成功即把 payload.narration（textarea 现值，所见即所插）经 tavern-insert 直入宿主输入框；完成页整体退役（无任何页面切换），按钮原地变「✓ 已落盘——开场白已填入下方输入框」禁点态 + flash 一句，发送由玩家在输入框完成。payload 带 narration 顺带修掉「手改口播与落盘脚本返回不一致」的潜在分叉。
- **验证**：引擎子进程同款 runner 跑 fixture runtime 实测（opening_data 四场景直出 / port-tavern commit 篇章·所在·主线·队伍·时间五项 patch 全命中 / 未知 scenario id 兜底生效）；新增 `packages/ui/tests/card-ui.client.spec.ts` 三例（在场→活柄 layout/theme、全缺→null、纯空白→null；tree 快照恒三目录也不影响判定）；vitest 246/246、tsc、client bundle 重建；**真机 playwright e2e 冒烟（headless chrome 打独立端口宿主实例——用户前台实例的 boot URL 打在其终端,全局日志摸不到 token）**：新会话→卡库载 dnd5e→开场页 `.scn`=4→切「海港酒馆」→随机分配→单次点击「落盘并开始冒险」→按钮原地变「✓ 已落盘——开场白已填入下方输入框」（`#ok` 计数=0、表单仍在原地）→输入框即时 156 字含「歪桅杆」（二次点击零参与）→服务器侧 `characters/player.json`+`state.md` 主线 patch 落盘，SMOKE-PASS。冒烟自建会话精确删除（用户既有会话原样保留）；老会话的工作区持有旧卡副本身上不带新脚本——载一次卡/开新会话即吃新件。
