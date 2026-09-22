# 挂起的 client 平面测试

这些套件与 packages/ui/tests-client-plane/ 同源同困：jsdom testkit 需要整条
client 层（conversation/primitives/api-session-controller client 等）的
Node 侧 import 形态，而上游 npm 发布的 `dsh-client-*` 包不带 client 源面
（`./client` 出口是浏览器 closure-factory 包）。缺的源锥 ≈ 8 包 / 1.5 万行，
再做 vendor 的成本与收益不匹配，pin 于此。

恢复信号：上游发布形态携带 `./client` 的 node-importable 面（或公开源面导出），
或上游 desktop externalPlugins 提供官方 testkit 通道。
