---
name: client-rpc-no-silent-catch
description: 客户端 RPC 落点禁止空吞错()收益是静默卡死;失败必须上屏(错误行/toast)+console.warn;同族已两度成灾
metadata:
  type: feedback
---

规则:packages/ui 客户端任何 `rpc.*` 调用的拒绝分支 **不许** 写 `() => undefined` / 裸 return。失败 = 行内错误 UI(带引擎错误原文)+ `console.warn` 留痕 + 交互态恢复(按钮解锁)。

**Why**: 服务端抛的结构化错误(`tavern/save-failed: ...`)被吞后,用户看到的只有「点了没反应/卡死」,诊断只能靠 F5 考古。两度成灾:09-18「保存并开始」不跳开场页、09-24「载入存档」双面板崩坏+永久卡死,两次真因都直到修掉吞错才可能一眼定位。
**How to apply**: 新增 RPC 交互时验尸清单——(1)loading 态且在途禁点;(2)拒绝带错误文案上屏;(3)console.warn 原始 error;(4)成功失败都复位交互态。回归钉参考 `packages/ui/tests/saves-load.client.spec.tsx`(注意:tests-client-plane 的 glob 至今不被 vitest 匹配,可运行用例放 `tests/`,用本地 translate stub 避开 client-runtime 的 kernel client.js 链)。
