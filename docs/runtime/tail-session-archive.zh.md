# 尾代理会话的生命周期与归档

2026-09-13 复查。尾代理（记账员）在每个完成的叙事回合派生一个一次性子会话。本文记录两件已确认的事实：这些子会话**不需要任何恢复操作**，以及它们在会话库中留下的全部磁盘记录。token 与磁盘属于独立子代理的正常消耗，决策为接受、不做治理改造。

## 派生方式与一次性语义

主代理 `turn/end`（`reason.kind === 'completed'`）触发 `ctx.subagents.start('fork', { label: 'tavern-tail' })`，每回合一个新子会话（`packages/extensions/tavern/src/index.ts` 的 `onSessionEvent`/`startTail`）。fork 子会话以父会话的平衡 completed-turn 前缀为种子，前缀在创建时一次性捕获（`packages/subagent/subagent-fork-in-process/src/index.ts`）；一次运行结束即 dispose，同会话尾跑由引擎 `gates` 串行化、不并发（`finally` 删除闸门）。

尾代理的产出是 `runtime/` 文件本身，子会话日志只是过程记录——这是「不需要恢复」的结构性原因：任何「找回记账上下文」的需求都应由新 fork 读取当前 `runtime/` 状态满足，而不是重放旧子会话历史。

## 不需要恢复操作（需求记录）

| 事实 | 依据 |
|------|------|
| `load()` 存档回退只锚定存档戳里的主会话 id 与 `lastTurnEndSeq`，不触碰尾子会话 | `packages/extensions/tavern/src/index.ts` 的 `save`/`load` |
| 子会话一次性运行，结束即 dispose；句柄与写租约随之释放，无续跑形态 | subagent fork provider 的一次运行语义 |
| 标题生成跳过带 `parentSession` 的会话，尾回合不产生额外标题 LLM 调用 | `packages/session/session-title/src/index.ts`（`parentSession === undefined` 才排程） |
| 引擎进程内存不持有子会话键：`workspaces`/`wraps` 仅登记主会话，`gates` 在 `finally` 清除 | `packages/extensions/tavern/src/index.ts` |

## 会话库中多余产生的磁盘记录

每个尾子会话在会话库（persistence root 下每会话一目录）留下四类记录：

| 记录 | 位置与触发 | 增长曲线 |
|------|-----------|---------|
| 子会话 JSONL 日志目录，含前缀整拷贝与本回合运行事件 | 派生时 materialize | 全回合合计 ≈ 0.5 × 回合数 × 终局日志字节 ×（JSON 开销 ÷ 压缩率）；100 回合、终局 200KB 日志约 10–40MB |
| `session_projcache` 域每会话一行 checkpoint record | 子会话 dispose 的 live-to-cold 检查点（write-behind 落盘） | 每回合一行，单行低 KB |
| `session-query-sqlite` 全文索引行 | base 与 web-app 均挂载，tavern 继承；持久事件增量入索引 | 同类增长，SQLite 单文件 |
| `session-telemetry-otel` 导出行 | base 挂载，事件推 OTLP endpoint | 唯一离机项；部署若不需要，改 base bundle 的 telemetry config |

进程内存不增长：子会话一次性、组合注册全部挂在其自身 ctx 上随 fiber 回收；投影缓存为单行小记录；全文索引驻留 SQLite 文件，查询时才动。

## 可见性与清理约束

「隐性堆积」指这些子会话在产品 UI 中不可见——tavern 侧栏按工作空间驱动，而非会话库驱动——且会话库条目当前没有任何删除 API（现有唯一的 delete 面是 `TavernService.deleteSession` 的工作空间删除，明确不动日志），归档只进不出。

随时间付账的路径只有两条：`sessions.list()` 一类按目录扫描的 header-only 列表（O(子目录数)，常量很小）与跨会话全文查询。

手动清理的安全边界：可整案删除的目标是「不再被任何工作空间 `.tavern-session` 指向的归档子会话目录」；先读取各工作空间的 `.tavern-session` 排除所有现役会话，存档戳锚定的主会话目录（`load()` 的回退锚点）一律不动。删除会话目录是操作员行为，当前无服务授权面支撑，执行前确认目标不在运行中。

治理路径留待 harness 提供会话删除授权面后再产品化（引擎登记子会话 id + 一键清理入口），现阶段不自写清理逻辑。

## 决策

接受每回合 fork 形态：尾代理每回合读到当前维护提示词与 `runtime/` 最新状态，优于持久子会话形态（那种形态下改维护提示词要新会话才生效）。复查确认过、不成立的假风险：进程内存泄漏、内核协议冲突、尾回合额外标题 LLM 调用。
