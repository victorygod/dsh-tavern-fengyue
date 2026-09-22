# 尾代理完成的事件驱动解锁（去轮询）设计

> 状态：设计定稿（2026-09-20）· 目标：去掉前端 `setInterval(pollTail, 2000)` 轮询，尾代理完成时前端即时解锁。

## 一、问题

前端「发送框锁定/维护行」依赖 `tailRunning`，其唯一真值是引擎 `state()` RPC 的 `this.gates.has(sessionId)`。尾代理完成（`gates.delete`）只是引擎侧一个 promise 状态翻转，**不产生任何 session 事件**，前端只能定时 `rpc.state` 轮询感知，代价是解锁最多滞后 2s。

## 二、为什么不能用 turn/end（上次失败的教训）

`turn/end` 是「回合边界」事件，不是中性信号。往主会话塞一个多余 turn/end 会：

1. 改写主会话 `lastTurnEndSeq`（它扫 log 里最后一个 turn/end）；
2. 污染 `turnBoundary` 投影与 fork 的 seed 边界。

尾代理 fork 正切在主会话回合边界上。边界被搅乱 → seed 重放错位 → 子会话 inbox 残留 pending → `hasPending` 恒真 → `while(await turn())` 无限循环。**结论：session 事件类型各有领域语义/投影副作用，不能随手复用。**

## 三、可用通道调查（为什么选 command/done）

| 通道 | 结论 |
|---|---|
| `subagentTiming` / `subagent` 投影 | ❌ 折叠的是「子会话自己」的事件；前端订阅的是主会话 binding，读不到子会话投影。主会话 `subagentCatalog` 投影只有「创建目录」（fork 时 append 一次），无「完成」态。 |
| 内核「尾代理完成」事件 | ❌ 不存在。`subagent/end` 是 lifecycle emitter（非 session append）；`subagent/catalog` 只在 fork 时 `establishCatalogChild` append。`whenIdle` resolve 不 append 任何主会话事件。 |
| `command/done` | ✅ 安全。见下。 |

`command/done` 的安全依据（逐条核对 SessionProjectionMap 与各投影 apply）：

- `SessionProjectionMap` 无 command 投影 → 不驱动任何投影；
- `lastTurnEndSeq` 只扫 `turn/end` → 不受影响；
- `turnBoundary` 投影只响应 `turn/start`/`turn/end` → 不受影响；
- `repairSeedInbox`/`seedPendingInbox` 只 fold `agent/inbox/spliced` → 不受影响；
- 前端 tavern `read()` 不处理 `command/done`（无 else-if 分支）→ 不渲染、不串行。

用 `commandId` 前缀 `tavern-tail-done` 做语义隔离，避免与 dsh-commands 命令面板的真实命令混淆。

## 四、方案

**引擎**（`startTail` 的 `finally`，`gates.delete` 之后）：

```ts
try {
  parent.session.append('command/done', {
    commandId: brandString<CommandId>('tavern-tail-done'),
    kind: 'success',
  })
} catch (error) {
  this.ctx.logger.warn(withHostGuidance('尾代理完成通知', error))
}
```

**前端**（`TavernApp.tsx`）：

1. `read()` 新增 `command/done` 分支：`data.commandId === 'tavern-tail-done'` → `props.onTurnEnd()`（= pollTail，读一次 rpc.state 得到 tailRunning=false，即时解锁）。
2. 删除 `useEffect` 里的 `setInterval(pollTail, 2000)` 轮询；保留「挂载/切换立即 pollTail」与「主会话 turn/end → onTurnEnd」两条既有触发。

## 五、解锁时序（改造后）

```
主代理 turn 完成 → turn/end(completed) → 前端 onTurnEnd → pollTail → tailRunning=true（锁）
尾代理完成 → 引擎 append command/done → 前端 onTurnEnd → pollTail → tailRunning=false（解锁）
挂载/切换 → 立即 pollTail 一次（初始态）
```

全程事件驱动，解锁延迟 = session 事件推送延迟（≈几十 ms），不再有 2s 上限。

## 六、边界与兜底

- **append 失败**：`catch` 记 warn。此时无解锁信号，最坏退化为「锁住到下一次 turn/end / 切换会话」——发生概率极低（session append 仅在其已 dispose 时失败，而尾代理运行中主会话必然存活）。若后续实测需要，可加一个 30s 级低频兜底查询，不算常驻轮询。
- **历史重放**：挂载重放遇到历史 `command/done` 也只会触发一次 `pollTail`（读最终态），无害；与 turn/end 的 `primed` 门槛不同，无需 seq 门槛。
- **fork seed 携入**：下一回合尾代理 fork 的 seed 会带上前一回合的 `command/done`，但它非 splice/turn/catalog，各投影均忽略，无副作用。
