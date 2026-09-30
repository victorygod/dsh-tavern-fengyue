# dsh 0.1.7-rc.2（next）迁移定案：六个破坏面、修法与实测验收

2026-09-27 完成。上游 deepseek-harness-master（`~/Desktop/learn_code/deepseek-harness-master`，同版本 0.1.7-rc.2）在手的前提下，把整个仓从 0.1.5-rc.2 迁到 0.1.7-rc.2（npm `next` 预发布），Playwright 全链实测通过（创建会话→选卡→聊两句→保存→加载，0 报错）。六个破坏面逐条记录；机制权威在 0.1.7 发布包 `lib/` 与上游源码。

## 一、破坏面总表

| # | 面 | 0.1.5 形态 | 0.1.7 形态 | 修法 |
|---|---|---|---|---|
| 1 | shell 缝 | `shell.run(spec)` | `shell.execute(spec).result()`（`ShellExecutor` 改 execute，前景投影走 `result()`） | `ShellSeam` 类型收紧为 `{resolve, execute→{result()}}`；tools/prompting 两处调用改 |
| 2 | 消息生产者 | `source.kind:'plugin'` + `plugin` 字符串 | 「无共享 plugin kind」——每个生产者以 module augmentation 自声明 kind（`MessageSourceMap`） | 引擎声明 `tavern` kind（`form:'snapshot'`+`sections`），post 注入/扫描/测试全部换；`createSystemMessage` 单参 |
| 3 | 客户端 sessions | `sessions.open(id)`；`list.current` | `retain(target,{source})`/`SessionReference.release()` 引用计数；「当前」=`retainedBy.<source> > 0`（`UiSession.publishMain` 同规则） | UI 自持 `'tavern'` 保留源（`SessionReferenceSourceMap` 增强）+ `mainViewRef`；credentials 事件通道 `as never`（词表增强未随 ui 包加载，见遗留） |
| 4 | typert 产物 | zod 对象面 codec | strict codec：`mode:'strict'` + `create()` 工厂，loader fail loud | 用上游 generator（`checkDiagnostics:false`）+ 临时 vendor protocol 源码重生成四件，接线回退只留产物（见 REGENERATE.md） |
| 5 | agent preset | profile 根目录 `preset.yml`+`agent.cordis.yml` | preset = `@deepseek-ai/dsh-agent-preset` 服务 patch 行（`config.id`+`config.plugins`） | `cordis.patch.yml` 改 insert `preset-empty`（id:empty, plugins:[]）；`syncShippedPresets` 目录镜像随之失效 |
| 6 | 会话格式校验 | 无校验 | 强校验：`command/done` 须有同 commandId 的 `command/run` 先行、commandId 全局唯一、`system/message` 须落在打开的 turn+step 内 | 三条修法见下节——这是本轮最深的坑 |

另有两处环境面对齐：root pin + 全部子包锚定 `>=0.1.7-rc.2 <0.2`（pnpm update 不吃 next tag，必须显式锚定）；`config/dsh-compatibility.json` verified 加 0.1.7-rc.2（bootstrap 才会把 profile 的 dsh-base/web-app 升对版本——版本错配的形态是 stock `settings-shell` 引 `primitives.settingsNumberField` 崩、**拖垮整个客户端 boot**，酒馆面一起不渲染）。

## 二、会话格式校验的三条修法（第 6 面展开）

### 2.1 command/run 配对 + commandId 唯一

引擎 `notifyTailSettled` 用合成 `command/done`（commandId `tavern-tail-done`）当「尾代理完成」的非回合信号（0.1.5 起的契约：无投影、非 splice、非 turn 边界）。0.1.7 出两条新校验：

- `command/done has no prior command/run`——先 append 一条 log-only `command/run` 配对；
- `command/run repeats commandId`——**固定字面量必炸**（每回合重复）。commandId 改为 `tavern-tail-done-<session.seq>`，全局唯一；消费两端（引擎 `settlementUnsigned` 结算扫描、客户端 TavernApp 解锁）从字面量等值改**前缀匹配**。

教训：第一版只补配对没换唯一 id，实测「聊两句成功、加载存档才炸」——校验在 resume/读取路径上才触发，写路径静默。

### 2.2 post 影子化的 microtask 推迟

`injectPosts` 在 pre-step 里把上一回合的 post 节点就地替换为空 system/message（内核单活节点模式）。三重约束夹击：

1. 视图派生（`deriveMessages`，在 `buildRequest`）**晚于** pre-step——影子必须在那之前不可见，即必须在 pre-step~buildRequest 之间落日志；
2. 0.1.7 校验器要求 `system/message` 落在**打开的 turn+step 内**，而 pre-step 恰在 `turn/start` 之后、`step/start` 之前（step 为 null）——pre-step 里 append 直接 fail loud（坏日志实锤：`seq 37 system/message < seq 38 step/start`）；
3. 在 `step/start` 的 session/event 观察者里同步 append 撞内核重入禁令：`session append cannot reenter while another append is being published`。

破局：**queueMicrotask**。内核在 `prepareRequest` 的首个 await 处让出事件循环，microtask 恰插在「step 已开（校验满足）」与「视图尚未派生（影子生效）」之间，且无 append 在飞。失败降级语义不变（旧 post 多活一回合，warn 留痕）。

## 三、环境面：LLM 端点与模型

0.1.7 的 DeepSeek 适配器讲 **Anthropic Messages 协议**（`POST <base>/messages` SSE，`frame.event` 必须等于 JSON `type`；`config.baseURL ?? env DEEPSEEK_BASE_URL ?? 官端` 的优先级里 **config 恒压 env**）。本机 profile 的用户覆盖（`~/.dsh-tavern-fengyue/profiles/tavern-fengyue/cordis.patch.yml`）把 baseURL 钉成 `!!js` 表达式实现**双路切换**：

```yaml
baseURL: !!js process.env.DEEPSEEK_BASE_URL ?? 'https://internal.example.com/api/anthropic/v1'
```

带 env 跑 env（本地 mock 等）、无 env 走内网端点；key 层天然同语义（进程 env > `.credentials.yaml` 管理库）。双路 Playwright 实测全绿。**fallback 必须是 `/api/anthropic/v1`**——适配器只讲 Anthropic `/messages`，openai 路径恒 404。其他实测要点：

- 鉴权 `Authorization: Bearer <key>` 或 `x-api-key` 均可；
- 模型名是内网端点的目录名（本 token 可用 `Qwen3-32B`；`DeepSeek-V41-Flash` 在内网端点不存在——客户端模型选择必须选目录内名字）；
- **非流式调用必须 `enable_thinking:false`**，否则 MPE-001（本项目全走流式，无此约束）；
- mock（`scripts/mock-llm.mjs`）已补 `/messages` 路由 + Anthropic SSE + `event:` 行；字符串载荷（`[DONE]`、malformed_json）保持裸排不加引号；**带 thinking 的真请求**（`reasoningEffort: low` → `thinking.enabled`）必须走 `message_start → thinking 块(thinking_delta) → text 块 → message_delta/stop` 的块流——OpenAI 的 `reasoning_content` 帧首帧无 `type`，宿主即报 event type mismatch（裸 curl 正确、真请求即炸的坑）。

连带修了 `bin/dev.mjs bootstrap`：profile `cordis.patch.yml` 只在缺席时落占位（原实现每次无条件覆写成 `[]`，会把自定义端点这类用户覆盖静默抹掉、打回默认端）。该文件可能被多个会话共编，改动前先重读。

## 四、实测验收（Playwright，真 token 非全好评）

先在 vitest 拿到 build/typecheck/test 全绿（488/488），再上真宿主：

1. boot 0 报错、fengyue 面装配 ✓（`retainedBy` 探针与 curl 二步抓取双验）；
2. 创建会话（`empty` preset 不再报 Unknown）→ 选卡（DND 5e · 原味跑团）→ 真模型聊两句（思考块 + 角色扮演回复 + 数据维护工具调用均真实发生）；
3. 保存（对话框命名）→ 设置模态加载存档行 → 点击换绑 → 存档点回放正常；
4. 全程页面 0 error。

工艺教训（巨贵）：**坏日志直接 zstd 解压逐行看**（`zstd -dc session.v4.jsonl.zstd`），比猜校验器快一个数量级；profile 版本（bootstrap 装了什么）与宿主版本是两个独立轴，「客户端全军覆没」类故障先查它。

## 五、升级工具链（2026-09-27 落地）

这次 0.1.5→0.1.7 跨两个 minor 的大迁移里，机械部分已全部脚本化（三脚本均实跑验证）：

| 脚本 | 职责 | 验证 |
|---|---|---|
| `scripts/bump-dsh.mjs <ver\|latest\|next>` | 伞包精确钉 + 子包范围锚点（`>=x <0.2` 只动锚不动上界）+ verified 白名单 + bundle 镜像 + lockfile 重解析；幂等 | 同版本 no-op ✅ |
| `scripts/gen-typert.mjs [上游路径]` | REGENERATE.md 流程全程自动化：vendor protocol 源码 → tsconfig 接线（host extends+reference / base paths）→ tsx 直跑生成器（`checkDiagnostics:false`）→ 写回四件 → **接线全部回退** | 产物与已提交逐字节一致、`git diff` 干净 ✅ |
| `scripts/re-vendor.mjs [上游路径]` | 上游 `ui-{renderer,session}/src` + ui-chat 契约整树拷回（逐字节不打补丁）+ exports 入口存在性体检（防 `.tsx→.ts` 扩展名漂移） | diff 与上游零差异 ✅ |

**诚实的边界**：语义破坏面（`open→retain`、消息源模型、preset 格式、会话格式校验）是判断题，脚本无法替代——本次六个面里五六个都是它。把「大改」变成「小改」的真正杠杆是**连续跟版**：`next` 出新 rc 就跑 `bump-dsh next` + 全套测试，每次只消化一两个破坏面，而不是攒两个 minor 一起扛。可再进一步：CI 定时任务对 `@deepseek-ai/dsh@next` 装机跑 build/test 红绿通报（探测自动化，修复仍人工）。

## 遗留（不阻塞运行）

- `credentials/reference-updated` 等 `$on` 词表增强未随 ui 包加载（现 `as never` 兜底）——上游把词表紧到一个未被 ui 链引入的文件里，待有干净引法再收；
- `packages/client-runtime`（jsdom slot 测试运行时）的 spec 在 `tests-client-plane/**`，vitest `include` 一直没吃（上游同款 KNOWN GAP）——pending 接线或换上游发布的 `@deepseek-ai/dsh-client-test-runtime`；
- CI 对 `next` 的定时探测（canary）未建——上表的脚本已把「升级的机械动作」归零，剩下的是把它接进流水线。
