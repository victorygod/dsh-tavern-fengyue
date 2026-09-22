# Agent Note: 宿主幽灵回合——error 回合不发落定信号,composer 解锁协议缺口(已修复)

Status: resolved | 日期:2026-09-22 | Surface:packages/engine(结算信号契约)+ stop() 自愈

[English](2026-09-22-host-ghost-turn.md) | 中文

## Problem (结案改写)

调查起点「回合挂起/锁死 composer/跨重启不愈」。Durable 日志 dump 后真相:回合**没有挂起**——SSE 流中断后回合以 `turn/end reason.kind=error(STREAM_CLOSED)` 正常收束;真正的缺口是**落定信号契约只覆盖 completed**:error/aborted/停赛竞速回合结束后 `command/done(tavern-tail-done)` 永不到达,而客户端解锁**单点依赖**该事件(durable 视图里此后再无新事件可等)。

取证中的两处自我修正(诚实记录):①宿主 env 的 mock base url 不是故障——真宿主的 provider 取自应用内配置(request header 实拍 deepseek-official/glm-4.7),env 变量被无视属预期;②「停止键也解不了锁」的判读部分是空草稿误读(disabled=空草稿,非锁)——但契约缺口本身由日志坐实,与误读无关。

## Root Cause (证据链)

| seq | 事件 | 现象 |
|---|---|---|
| 18-23 | turn/start → user(玩家行+post 渲染的 CG 菜单) → request/header | 提交链全部正常,provider=真实配置 |
| 24-26 | assistant/attempt(finish) → turn/end **kind=error**(STREAM_CLOSED) | 回合收束,无记账 |
| — | (缺失) command/done tavern-tail-done | **契约缺口**:onSessionEvent 对非 completed 直接 return |

引擎代码 `index.ts` onSessionEvent:`if (reason.kind !== 'completed') return` —— 唯一漏点。

## Fix

1. **结算信号全覆盖**(核心):每个回合边界欠恰一条 tavern-tail-done——completed(未被停赛竞速)走记账链链尾发;error/aborted/停赛竞速回合无记账、`queueMicrotask` 即发。gates 在途分支语义原样保留(各自 finally 发)。
2. **stop() 对账补签**(存量自愈):空闲会话 stop 时扫描 durable 事件(纯函数 `scanSettlement`+`settlementUnsigned` 导出可单测),末个已闭 turn/end 之后无签名 → 补发一条;健康会话保持 no-op。
3. 客户端注释口径同步(行为零改动——客户端本就监听同一条事件)。

## 验证

- 单元:`settle.spec` 5 例(healthy/ghost 真实形状/in-flight/空/他者 done 不算签名);
- REAL:①error 断流回合(SIGKILL adapter fail)→ 恰一条 tail-done 落在 error turn/end 之后、尾代不排;②健康空闲 stop = 零新事件(no-op 保持);
- 全套 291/291(含用户新增 composer/rich-text spec——顺带修复了 node_modules 盘面漂移:三个 markdown 扩展包登记在册却实体缺席,`pnpm add` 同版本重建,锁文件零 delta);
- **live 全链**(真宿主+真模型):幽灵会话可用后直接发回合——glm-4.7 以芙宁娜人格回复且**尾部自携带 `<!-- cg: 1 -->`**(协议被真模型遵守)→ 钩子落贴 `runtime/cg.json` → galgame 面板台词刷新、指令剥离、composer 解锁。截图 /tmp/gal-live-e2e.png。

## Impact & 语义

- 任何 error 收束的回合(网络断流/provider 超时)此后都会即时解锁 composer;
- 落定信号语义从「每 completed 回合」扩为「每回合边界」——hooks/尾代理记账仍只在 completed 上发生,仅解锁信号全覆盖;
- 存量幽灵会话:stop 一次即补签(新引擎载入后)。
