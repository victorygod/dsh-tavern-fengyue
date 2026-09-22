# 酒馆 keyless 自动化测试链路设计与覆盖现状

本文陈述酒馆自动化测试的现状覆盖、未覆盖缺口，以及不依赖真实 API key 跑通整体链路的四层设计。2026-09-12 定稿时只落地本文；各层实现时以本文为蓝图，机制事实的权威在各自包的源码与测试。

## 现状

现有 5 个测试文件（64 用例），全部是手搭 `ctx` / 组件假 RPC 测试，没有任何真实组合（Loader + 真实插件树）启动：

| 文件 | 覆盖 |
|---|---|
| `packages/extensions/tavern/tests/workspace.spec.ts`（18 例） | 卡骨架、路径围栏、播种、存档环、卡库导入、固定提示词保护等纯函数 |
| `packages/extensions/tavern/tests/tools.spec.ts`（8 例） | `executeTools` 与 `runtime*` 工具面、围栏拒绝 |
| `packages/extensions/tavern/tests/prompting.spec.ts`（8 例） | `{{script}}` 渲染、`-h` 探测缓存、四提示词渲染 |
| `packages/client/ui-tavern/tests/tavern-app.client.spec.tsx`（16 例） | key 弹框策略、回合错误行、模型选择器、占用环、保存弹框、尾代理闸门 UI 旗标 |
| `packages/client/ui-tavern/tests/tavern-view.client.spec.tsx`（14 例） | 就地路由、卡库操作、导入预览、草稿态 |

## 覆盖缺口

- **`TavernRuntime` 引擎服务层零覆盖**：会话↔工作空间绑定与 `restoreBindings()` 重启恢复、`createSession`（经 `sessionController.create`）、草稿生命周期（`draftCard` / `cancelDraft` / `.tavern-draft` 标记）、`publishCard` / `commitImport`、存档编排（`save` / `load` / autosave 清理）、`state()` 语义。
- **`agent/created` 组合与双代理调度零覆盖**：`composeMainAgent` 的提示词/工具装配、尾代理 fork（`turn/end` 触发、persona 挂装）、`agent/pre-step` 闸门 await、fork 子会话日志落盘。
- **`packages/api/tavern` 零测试**：约 24 个 `@Remote` 方法的信封返回形状、`wrap()` 的引擎失败 → `RemoteError('tavern/error')` 映射均无断言（信封未解包曾是已修复的最大接线 bug，见 devlog）。
- **`packages/bundle/tavern` 零测试**：patch 三行（engine / api / ui）的组合有效性。
- **ui-tavern 组件缺口**：`tavernRpc` 信封 unwrap 与失败 reject 自身、opening 页渲染、封面资产渲染、清空（reset）、会话删除、`en` locale。
- **CLI 与 profile**：`dsh tavern` 别名（`apps/cli/src/args.ts`）无测试；`PROFILE_TEMPLATES.tavern` 未被 app-boot 测试覆盖。
- **REAL-composition 政策缺口**：`TavernRuntime` 是 product-visible Service 插件，按 `packages/CLAUDE.md` 必须有非单元的真实组合测试，目前不存在。
- **真实浏览器链路无入库测试**：devlog 中反复出现的 playwright 真 Chrome 探针（root 接管、inject 守卫、导入流、重启恢复）都是未入库的一次性脚本；jsdom 假 RPC 无法覆盖 inject 点路径守卫与槽位回退路径（devlog 已记录为已知缺口）。

## 四层设计

### ① host REAL-composition 测试

先例：`packages/llm/llm-retry/tests/loader-composition.spec.ts`（临时目录写 test-only `cordis.yml` → `new Context()` + `ctx.plugin(Loader)` + `Include` + module map → `loader.await()` → 仅 mock LLM（自绘 `LlmAdapter` 经 `ctx.llm.registerAdapter` 注册）→ 经真实 agent loop 驱动回合并断言持久化会话事件）；双面包布局同 `packages/experimental/inspector/tests/loader-composition.host.spec.ts`。

酒馆版本：组合行取 tavern 引擎及其 inject 依赖（agents / sessions / sessionController / systemPrompt / shell / subagents / tools 等，参照 `packages/bundle/base/cordis.patch.yml` 裁剪，禁用 `session-title-llm`），LLM 用脚本化 adapter 按调用次序派发（主代理回合 = 叙事文本流；尾代理回合 = `runtime*` 工具调用流）。驱动：建会话 → 从 fixture 卡目录导入 → 发两个用户回合，断言：回合事件入日志、尾代理工具调用改写 `runtime/`、autosave 落盘、第二回合的闸门等待尾代理完成（事件顺序）。可加：dispose 后重新启动组合，`restoreBindings()` 后绑定仍在。全 keyless。

### ② api/tavern 远程面测试

先例：`packages/api/workspace-files/tests/harness.ts`（真实后端 + 临时工作空间，直调服务，失败经 `remoteErrorOf` 断言）、`packages/api/gateway/tests/gateway.host.spec.ts`（host 侧 `TypertRemoteService` 命名空间）。

酒馆版本：host spec 以真实 `TavernRuntime`（最小组合或直构）驱动 `TavernApi`，按方法类别取代表（`state` / 卡库 / 存档 / `readText`）断言成功返回形状与失败 → `RemoteError('tavern/error')` 映射；附 loader-composition 政策要求的 default-export 守卫与 `unwrapExports` 往返。全 keyless。

### ③ 真实浏览器 e2e

先例：`packages/experimental/inspector/tests/client-browser.e2e.ts`（包内浏览器 e2e，注册于 `vitest.web.config.ts`）；进程内启动真实 web 组合 + 真实 Chromium 的脚手架在 `apps/web/tests/scaffold.ts`（keyless 模型输入参照其向 `ctx.llm` 安装 replay/脚本 adapter 的做法，`scaffold.ts:761-780`）。

酒馆版本：`packages/client/ui-tavern/tests/` 下新增浏览器 e2e（沿用 inspector 的注册方式），组合 = base + web-app + tavern 三层 bundle patch；场景脚本 = 新会话 → `setInputFiles` 导入 fixture 酒馆卡 → 导入编辑页「保存并开始」→ 开场页 → 发送回合 → 断言用户气泡与叙事段落渲染、尾代理折叠行出现 → 刷新页面验证 `restoreBindings()` → console 无错误。key 预检走真实 credentials 面存假 key（顺带覆盖弹框流）。依赖：`pnpm run build` 产物（scaffold `requireDist`）。

### ④ 快照通道（recorded-session replay）

仓库正规 keyless 通道：`packages/test-support/session-snapshot` 以真实子进程启动 profile，replay 模式自动拼 `--patch <scenario>/cordis.snapshot.yml`（禁用 `llm-deepseek`、插入 `llm-replay`），会话日志与期望输出比对。harness 与 launcher 对 profile 无硬编码，但两处基建把通道封闭在现有四 profile：`packages/test-support/session-snapshot/src/manifest.ts` 的 `SnapshotProfile` 枚举，与 `scripts/session-snapshot-corpus.corpus.ts` 的 lane 清单和 fixture 门禁（composition/header.class 单 pin、sidecar、corpus 政策）。

酒馆接入有两条路：加 web-lane 场景（`snapshots/web/` 目录 + tavern overlay，不动枚举；首次录制可对本地 mock 服务器录，见 [mock-llm-testing.zh.md](../testing/mock-llm-testing.zh.md)），或加独立 tavern lane（动枚举 + corpus 清单 + 新 driver）。两者都要满足 corpus 的 fixture/sidecar 规则；录制模式（`test:snapshot:record`）需要一次真实 key 或对本地 mock 录制。

## 验证命令对照

| 层 | 命令 | 前置 |
|---|---|---|
| ① ② | `pnpm exec vitest run packages/extensions/tavern packages/api/tavern` | 无 |
| ③ | `pnpm run test:web` | `pnpm run build` |
| ④ | `pnpm run test:snapshot`（replay）/ `test:snapshot:record`（录制） | ④ 落地后 |
