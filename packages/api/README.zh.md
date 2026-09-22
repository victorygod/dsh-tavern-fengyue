---
description: "酒馆引擎之上的 tavern Remote 命名空间：工作空间、卡片、存档与编辑器 RPC，供酒馆线材契约的维护者使用。"
kind: "package-reference"
---

# dsh-tavern-fengyue-api

[English](README.md) | 中文

## 概述

`dsh-api-tavern` 是 `ctx.remote.tavern` 的宿主持有者：酒馆浏览器界面可调用的每个工作空间、卡库、存档、开场与编辑器操作，聚合为一个生成的 Typert 命名空间。它还随包发布生成好的 client face（`./client`）来挂载该命名空间，使消费方的 `remote.tavern` inject 同时是激活边。你只会经酒馆 profile 遇到这个包。

## 目录

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

无可配置项。命名空间的线材契约在 [types.ts](./src/types.ts)；每个方法恰好接收一个请求对象，并以客户端面统一解包的 `RemoteResult` 信封作答。

<a id="understand-the-implementation"></a>
## 理解实现

- **[index.ts](./src/index.ts)** — 每个操作一个 `@Remote` 方法，各自是对引擎缝的一层薄 `wrap`，把失败变成 `tavern/*` Remote 错误而不是 rejection。`retryPoint` 把工作空间换绑到发送时刻的自动存档并交还其输入框草稿；`load`/`reset` 返回待恢复草稿，`save`/`state` 携带（`draft`、`retryable`）——浏览器面据此实现重试与载入草稿恢复，无需二次读取。
- **[src/client/index.ts](./src/client/index.ts)** — 生成的 `$mount` 客户端入口；端点变化后需同时跑 `pnpm run build:lib:host` 与本包的 `bundle` 脚本重建，否则服务出的 bundle 落后于服务端。

## 开发备注

服务类经 `static inject = ['tavernService']` 解析引擎；命名空间是 Host 面，浏览器半侧代码绝不可导入它——生成的 `./client` 入口是唯一过界点。

<a id="model-experience"></a>
## 模型体验

间接地，经渲染这些 RPC 返回值的 `dsh-tavern-fengyue-ui`；命名空间本身从不进入请求。

#### KV Cache 影响

无——该命名空间不携带自己的模型请求。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

不发布 invariant companion：Remote 命名空间是对引擎服务的逐方法转发——在这里立检查只能复述刚刚调用过的被调方。

- **端点变化需要两次重建** — 增删方法需要 `pnpm run build:lib:host` 重生成类型，且 `pnpm --filter dsh-tavern-fengyue-api bundle` 重建 client face；漏掉后者会在调用时静默失败。
- **client face 是生成物，不是手写类型** — `ui-tavern` 的 `rpc.ts` 里的本地类型垫片镜像本契约，必须在同一变更中同步更新。
- **过期 bundle 现在会在启动时告警** — modules server 对所供给 `lib/client.js` 早于其包源码的情形打 WARN（仅诊断；修复是重建并重启）。
