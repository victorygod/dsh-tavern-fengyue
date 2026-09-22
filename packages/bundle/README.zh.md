---
description: "酒馆 profile patch：引擎、其 Remote 命名空间与浏览器接管，叠在 base + web-app 之上，供启动 dsh tavern 的用户使用。"
kind: "package-bundle"
---

# dsh-tavern-fengyue

[English](README.md) | 中文

## 概述

`dsh-bundle-tavern` 把 base + web-app 变成酒馆 profile：三行——世界卡引擎、其 Remote 命名空间与浏览器接管——插在共享内核之后。`dsh tavern` 应用本 patch；你几乎不会触碰这个包。

## 目录

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

<a id="use-this-package"></a>
## 使用本包

启动 `pnpm dsh tavern` 即得完整 profile——bundle 随 dsh CLI 出厂，`tavern` profile 首次使用时按 shipped 模板自动初始化（一行命令，零安装动作）。要定制时，追加一个更晚的 `--patch` 覆盖层而不是改这个文件；patch 会替换目标行的整个 `config`。

在没有随车 bundle 的 dsh 上，外部挂载本包：`dsh plugin --profile tavern add dsh-tavern-fengyue`，再把 `@deepseek-ai/dsh-web-app` 与 `dsh-tavern-fengyue` 追加进 profile `package.json` 的 `dsh.profile.bundles`，然后 `dsh --profile tavern`（共三步；bundle 层只从该列表生效，不走依赖发现）。

<a id="understand-the-implementation"></a>
## 理解实现

- **[cordis.patch.yml](./cordis.patch.yml)** — 三个插入（`tavern-engine`、`tavern-api`、`ui-tavern`）与禁用行：per-session 的 agent preset 面（`agent-presets`、`ui-agent-preset`）和首条提示标题生成器（`session-title-llm`）。卡即整个世界：session-controller 经其 no-service 分支零 preset 合成每个会话。本 patch 自己的 `package.json` dependencies 点名这三个包，供解析器校验。

## 开发备注

patch 会替换目标行的整个 `config`，因此 cordis.patch.yml 的每一行都重述它拥有的每个键；写一半的行会静默丢掉它省略的键。

<a id="model-experience"></a>
## 模型体验

间接地，经每个被插入行的包——由它持有该行面向模型的行为。

#### KV Cache 影响

bundle 本身不加请求前缀；每个被插入行的包自持其缓存效果。

<a id="known-limitations-and-deferred-work"></a>
## 已知限制与延期工作

不发布 invariant companion：bundle 是对插件 id 的 patch 清单，没有自己的代码面。

- **叠层顺序是承重墙** — 这些行假设其下有 base + web-app（含投影单元）；自定义 profile 去掉任一层都会断掉浏览器半侧的数据来源。
