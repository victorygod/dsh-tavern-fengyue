# 挂起的 client 平面测试

`snap` 时代的两套 jsdom 套件（tavern-app / tavern-view）依赖 monorepo 测试件
`dsh-client-test-runtime` 的源面解析假设：上游发布的 `dsh-client-*` 包不带
Node 侧可 import 的 client 平面（`./client` 出口是浏览器 closure-factory 包，
首行 `window.__ModuleLoader__.load`）。vitest include 排除了 `tests-client-plane/`，
等上游发布形态携带 client 源或本方接手 testkit 后再恢复。
