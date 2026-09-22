# Agent Note: llm-mock-server 响应内容池、请求体事件与逐请求延时

Status: implemented

[English](2026-09-12-llm-mock-content-pool-and-request-events.md) | 中文

## 问题

mock LLM 服务器对所有 success 形态行为只流式输出一条固定的 `successText`，开放式交互运行（例如把酒馆 web 界面指向 `DEEPSEEK_BASE_URL`）每一回合都重复同一句罐头文本，而行为层的 `random` 无法变化内容。另外，独立进程的 JSONL 遥测只命名每次请求的脚本行为与解析行为，从不显示提供方实际收到了什么——不接调试器或进程内句柄，就无法查看组装出的 system 提示词、动态上下文快照、工具与采样参数。

## 决定

- **内容池。** `MockLlmServerOptions.successTexts` 提供多条完整文本；success 形态的补全路径每次请求从与 `random` 行为选择共享的种子 PRNG 抽取一条，因此整次运行可由种子复现。单元素池跳过抽取，既有种子下的行为序列保持不变；`successText` 继续有效，两个选项都未提供时默认文本不变。`successTexts` 优先于 `successText`。CLI 经可重复的 `--success-text` 与 `--success-text-file <path>` 供给内容池，文件在解析期按行读取（跳过空行、剥离起始 BOM；文件不可读或池为空时 fail-loud）。`partialText`、`reasoningText` 与 `toolArguments` 保持单值。
- **`request` 事件携带请求体。** 事件在既有 emit 点带上解析后的 JSON body，独立进程的 JSONL 日志因此能逐次展示组装出的提供方请求。headers 刻意不回显：Authorization 头会落进终端回滚与 CI 日志，进程内测试早已能在 `server.requests[...].headers` 上断言。
- **逐请求延时。** `latencyMinMs` / `latencyMaxMs`（CLI `--latency-ms <min>-<max>`；单值即固定）让每个被接受的请求在首个响应字节前等待一段延时——HTTP 错误响应同样包含——从与行为、内容池共享的种子随机流抽取。退化区间跳过抽取，种子序列保持不变。

## 备选方案

**在 `request` 事件中回显 headers。** 否决：面向 stdout 的事件不应复制凭据（即使是假 key——这会养成对真 key 的习惯）；detached 的 header 副本仍在服务器句柄上供测试使用。

**按调用次序的响应脚本文件（llm-replay 式位置脚本）。** 否决：mock 服务器的契约是逐请求行为，不是逐调用转写回放；位置脚本与消耗诊断是 `llm-replay` 的职责，内容变化只需要内容池抽取。

## 测试

`pnpm exec vitest run packages/test-support/llm-mock-server` 覆盖：同种子下两台服务器的池抽取一致且覆盖每一条目；默认文本与单条 `successText` 向后兼容；`max_tokens`、`slow_success`、`wrong_content_type` 同样走池；`request` 事件 body 与发出的 JSON 深度相等、空 body 时为 `undefined`；固定与区间延时任取、客户端在等待期断开；空池、空条目、倒置延时区间的选项校验；CLI 对可重复 flag、flag 与文件合并顺序、空行跳过、不可读或全空文件、固定/区间/倒置延时值的解析。消费方套件（`llm-retry` 传输恢复、`session-log-deepseek` feedback 组合）保持全绿。

## 后果

交互式 keyless 运行获得变化的叙事文本、贴近真实的 1–3 秒延时，并在 stdout 直接看到每次请求组装出的提示词与工具（可接 `| jq` 便于阅读）；仓库脚本 `scripts/mock-llm.sh` 把这些默认值收拢到环境变量之后，并带一个清理孤儿独立服务器进程的 `stop` 子命令。接受的代价：池抽取与行为抽取共享 PRNG 流，改变内容池会在同一种子下改变后续行为选择——可复现性按固定配置成立，不跨选项变更成立；事件行携带完整请求体，stdout 体积随提示词增大。
