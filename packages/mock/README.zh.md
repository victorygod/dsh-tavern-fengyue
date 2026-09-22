---
description: "用于在无提供方密钥的情况下测试 LLM（大语言模型）适配器与恢复策略的可通过脚本控制的 OpenAI 兼容故障服务器，面向测试作者与演示。"
kind: "package-library"
---

# dsh-tavern-fengyue-mock

[English](README.md) | 中文

## 概述

本包为测试与演示提供可编脚本的 OpenAI 兼容 HTTP／SSE（Server-Sent Events）端点，使其无需提供方密钥即可检验模型提供方的失败与成功。每个已接受的 `/chat/completions` 请求依次消费下一个脚本行为，包括重置、停滞、畸形分片、限流、服务器错误、补全与工具调用。测试作者可以通过 `pnpm run mock:llm` 运行服务器，也可以调用 `startMockLlmServer`，后者会返回捕获的请求供断言使用。带种子的 `random` 行为支持可复现的混合故障压力运行。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

本包让测试或演示无需实际提供方即可使用提供方协议进行通信：启动服务器，脚本化你想检验的协议行为，然后把真实 LLM 适配器指向它的 base URL。

### 独立运行

从本仓库运行源入口：

```sh
pnpm run mock:llm \
  --port 8000 \
  --api-key mock-key \
  --sequence partial_disconnect,success \
  --partial-text "discard this half"
```

将发布的 DeepSeek 适配器指向服务器；它会将 `/chat/completions` 追加到已配置 base：

```sh
DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1 \
DEEPSEEK_API_KEY=mock-key \
pnpm dsh --profile headless "test provider recovery"
```

仓库脚本将 JSONL 写入 stdout：`ready` 记录携带以 `/v1` 结尾的 base URL 与随机种子，后续请求/结果记录同时命名脚本行为与实际选中的具体行为；每条 `request` 记录携带解析后的请求体（system 提示词、messages、tools 与采样参数），headers 只保留在进程内的 `server.requests` 记录上。本包不公开可安装的二进制命令。

### 脚本化行为

`--sequence` 是逗号分隔的 FIFO。耗尽时返回结构化 HTTP 500；`--repeat-last` 显式重用最后一项。

| 行为 | 协议结果 |
|---|---|
| `connection_reset` | 在发送 HTTP 标头前销毁 socket |
| `stream_disconnect` | 发送 SSE 标头，然后在第一个事件前重置连接 |
| `partial_disconnect` | 发送文本增量，然后重置 socket |
| `stall` | 发送 SSE 标头，并保持空闲，直到客户端／服务器取消 |
| `empty` | 发送有效的无内容 stop 和 `[DONE]` |
| `empty_body` / `stream_eof` / `partial_eof` | 正常结束，但缺少必需的 `[DONE]` 边界 |
| `malformed_json` / `malformed_event` | 发送无效 SSE JSON 或无效提供方分片形态 |
| `rate_limit` / `server_error` / `service_unavailable` | 返回面向重试的 429/500/503 JSON 错误 |
| `auth_error` / `invalid_request` / `context_overflow` / `quota_exceeded` | 返回终止性错误或需要单独恢复的提供方错误 |
| `success` / `slow_success` / `reasoning_success` | 流式发送完整文本响应，可选延迟，或先发送有节奏的推理（reasoning）并在思考与正文之间停顿；`success` 仅在请求开启思考时附带推理，`reasoning_success` 强制附带 |
| `tool_call_success` / `max_tokens` | 以工具调用或结束原因 `length` 完成 |
| `wrong_content_type` | 以 `application/json` 内容类型发送有效 SSE 正文 |
| `random` | 按带权重的种子随机选择具体请求行为 |

`connection_refused` 只能在 CLI 中使用，且必须是第一个条目。它会延迟绑定调用方指定的非零端口，因此 `--listen-delay-ms` 期间的请求会收到真实 TCP 拒绝；其余条目在 listener 启动后开始。

### 随机模式

使用重复 `random` 条目执行开放式混合运行：

```sh
pnpm run mock:llm \
  --port 8000 \
  --sequence random \
  --repeat-last \
  --seed 42 \
  --random-weights 'success=60,slow_success=10,connection_reset=5,stream_disconnect=5,partial_disconnect=10,empty=5,server_error=5'
```

省略 `--seed` 会生成种子，并在 `ready` 记录中打印。`--random-weights` 接受非负的相对 `behavior=weight` 条目，并要求至少一个正权重具体行为。导出默认值是一个成功占主导的压力分布，包含 reset、disconnect、部分输出、空完成、stall、429/5xx、干净截断与格式错误的 JSON；它用于施加测试压力，而非估计生产事故频率。`connection_refused` 被排除，因为已绑定的请求处理器无法产生真实拒绝。随机权重包含 `stall` 时，为待测客户端配置较短的流空闲超时，使场景及时结束。

### 时序与内容控制

CLI 公开 `--success-text`（可重复；每次出现都加入响应内容池）、`--success-text-file <path>`（每行一条文本；跳过空行）、`--partial-text`、`--reasoning-text`、`--chunk-size`、`--chunk-delay-ms`、`--reasoning-gap-ms`（最后一条 reasoning 增量与第一条 content 增量之间的停顿）、`--disconnect-delay-ms`、`--latency-ms <min>-<max>`（单值即固定）、`--retry-after-ms`、`--request-id`、`--tool-name` 与 `--tool-arguments`，以及 `--show-tools`（pretty 请求在名单后附打每个工具的完整线上 schema）。毫秒延迟是 Node 定时器范围内的有界整数；`retryAfterMs` 还必须为正数。success 形态行为每次请求从内容池抽取一条，抽取使用与 `random` 行为选择共享的种子随机流，因此整次运行可由种子复现；单元素池即流式输出固定文本。每个被接受的请求在首个响应字节前等待一段从 `--latency-ms` 区间抽取的延时，HTTP 错误响应同样包含。库接受相同的 camel-case 选项（`successTexts` 优先于 `successText`；`latencyMaxMs` 缺省取 `latencyMinMs`）。可选的 `apiKey` 会精确验证 `Authorization: Bearer <token>`；省略时接受任何 token。交互式使用可直接跑仓库脚本 `scripts/mock-llm.sh`——内置叙事池、成功为主的失败权重、1–3 秒延时区间与流式分块，经环境变量覆盖。

### 可能出什么问题

- **脚本耗尽**——耗尽时返回结构化 HTTP 500；当一次运行需要更多请求时设置 `--repeat-last` 或加长序列。
- **没有正权重具体行为的随机权重会被拒绝**——每个条目都必须命名现有行为，且至少一个条目带正权重。
- **无效请求不消费脚本**——错误方法、路径、Bearer token 与畸形 JSON 会收到普通 4xx 响应，因此配置错误的客户端可能耗尽重试却不推进序列。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现细节——点击展开</summary>

本节解释服务器的设计；可观察行为已在[使用本包](#use-this-package)中完整说明。

### 设计

服务器建立在一个规则之上：每个已接受的 chat-completions 请求从按到达顺序排列的 FIFO 游标消费恰好一个行为，服务器从不重试或解读 harness 策略。校验先于游标推进——只有 `POST` 且路径以 `/chat/completions` 结尾、配置密钥时携带有效 Bearer token、且 JSON 正文可解析的请求才消费脚本；其余请求都收到普通 4xx。`random` 条目在请求时通过带种子的 PRNG 按配置权重解析，因此一次运行可由其打印出的种子复现。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | `startMockLlmServer`：listener、行为表、种子随机、遥测（telemetry）、捕获的请求记录 |
| [`src/cli.ts`](src/cli.ts) | `--sequence` 与时序/内容选项解析、JSONL stdout 遥测 |
| [`src/bin.ts`](src/bin.ts) | `pnpm run mock:llm` 源入口 |
| — | 不发布运行时不变式伴生组件；该独立测试服务器不拥有 Cordis 事件流或共享数据；其协议行为和生命周期通过直接 HTTP 测试及组装后的循环测试进行检验。 |

### 协议流程

请求进入处理器、通过校验，然后选择行为：具体脚本条目直接运行，`random` 抽取一个，已耗尽脚本则以结构化 500 报告 `script_exhausted`。随后 `runBehavior` 执行协议结果——销毁 socket、SSE 流、JSON 错误或补全——同时每个请求与结果按到达顺序记录到返回的句柄上，供测试断言。`close()` 停止接受请求并强制终止停滞连接。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

当包级约定不够用时阅读以下页面。它们从故障服务器逐步进入它所检验的适配器约定，以及用于已记录成功 transcript（文本记录）的无密钥替代方案。

- [LLM 包](../../llm/llm/README.zh.md)——本服务器所检验的提供方流约定与重试策略。
- [llm-replay](../llm-replay/README.zh.md)——回放已记录成功 transcript 而非制造故障的无密钥替代方案。
- [测试策略](../../../docs/testing.zh.md)——本服务器服务的覆盖层级与恢复测试。
- [test-support 组地图](../README.zh.md)——兄弟 harness 与支持包。

-----

<a id="model-experience"></a>
## 模型体验

无。该测试服务器替代提供方协议行为，而不调用真实模型。

#### KV Cache 影响

无；请求在本地终止，绝不会到达提供方缓存。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>


这些限制说明何时需要对该服务器特别小心。它们是当前包约束，不是任务积压。

- **随机权重建模测试压力，而非生产事故频率**——需要环境专用分布的调用方必须提供已测量权重，并记录发出的种子。
- **请求脚本按到达顺序执行**——并发调用方共享一个游标，因此确定性的每会话故障分配需要独立服务器实例。
- **真实连接拒绝发生在监听器生命周期阶段**——CLI 延迟必须与客户端尝试重叠；请求级随机选择只能重置已接受的连接。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者的工作上下文——点击展开</summary>

无。

</details>
