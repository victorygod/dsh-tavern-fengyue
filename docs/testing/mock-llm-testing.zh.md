# 不真实调用 LLM 的本地测试方式

酒馆对话流开发可以在不发出真实网络请求的前提下驱动主代理与尾代理。仓库现有四种机制，本文陈述各自的机制、用法与限制；LLM seam 与补丁机制的权威说明在各自包内，不在本文重复。

## 前提事实

- LLM 能力面是适配器注册表：`ctx.llm`（`LlmRuntime`，`packages/llm/llm/src/index.ts`）按 provider 路由分发 `stream()` 调用；`llm-deepseek` 插件为路由 `deepseek-official` 注册 DeepSeekAdapter，未知路由报 `NO_ADAPTER`。
- 凭据在每次请求时由 adapter 解析（credentials seam，回退启动环境层），缺失抛 `MISSING_CREDENTIAL`，不在插件加载时失败；空白或不卫生的 key 抛 `INVALID_CREDENTIAL`（`packages/llm/llm-deepseek/src/index.ts`）。replay 与基准类自绘 adapter 不调用此检查。
- `DEEPSEEK_BASE_URL` 经启动环境层读取（进程环境 → 项目根 `.env` → home `.env`），请求发往 `${baseURL}/chat/completions`（`packages/llm/llm-deepseek/src/adapter.ts`）。
- 酒馆客户端的发送前 key 预检是前端逻辑，只检查 `DEEPSEEK_API_KEY` 是否存在，与 host 侧由哪个 adapter 服务该路由无关；缺 key 时弹配置框并保留草稿。

## 方式一：脚本化 mock 服务器（packages/mock）

`packages/mock`（`dsh-tavern-fengyue-mock`）是独立的 OpenAI 兼容 HTTP/SSE 服务器，只监听本机回环。每个被接受的 chat-completions 请求按序消耗脚本序列中的一个 behavior；`--repeat-last` 使序列耗尽后永远重复最后一项，因此不限回合数。behavior 词表定义于源码 `MOCK_LLM_BEHAVIORS`（`success`、`tool_call_success`、`rate_limit`、`stall`、`connection_reset` 等），完整清单与全部 CLI 选项见 `packages/mock/src/cli.ts` 的 usage 文本。

响应内容支持内容池：`--success-text` 可重复（每次出现入池），`--success-text-file <path>` 按行读取（跳过空行）；success 形态行为每次请求从池中随机抽取一条，抽取与 behavior 选择共用同一种子随机流，`--seed` 下整次运行可复现。每个被接受的请求在首个响应字节前等待一段从 `--latency-ms <min>-<max>` 区间抽取的延时（HTTP 错误同样包含）。stdout JSONL 的 `request` 事件携带解析后的请求体（system 提示词、messages、tools、采样参数），可实时观察酒馆每次发出的实际请求；headers 不回显（避免凭据进终端），进程内测试可在 `server.requests` 上断言。

酒馆手动测试用仓库脚本 `scripts/mock-llm.mjs`（node 单入口，`stop` 收停），默认 = 六条叙事池随机抽取 + success 为主、少量 rate_limit / server_error 的随机 behavior + 1000–3000ms 延时 + 流式分块：

```sh
node scripts/mock-llm.mjs
# 另一终端：
DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1 DEEPSEEK_API_KEY=sk-mock pnpm tavern
# 结束后清理（含占着端口的孤儿进程）：
node scripts/mock-llm.mjs stop
```

脚本默认值经环境变量覆盖：`PORT`、`SEED`、`WEIGHTS`（`--random-weights` 条目）、`LATENCY_MS`（`0-0` 即无延时）、`CHUNK_DELAY_MS`、`REASONING_GAP_MS`（思考行 → 正文的停顿）、`REASONING`（思考行文本）、`SHOW_TOOLS=1`（透传 `--show-tools`）；`--` 之后的其余参数直透 mock 服务器（后出现的同名 flag 覆盖默认）。全量手工定制仍走同一命令透传：`node scripts/mock-llm.mjs -- …`（完整选项见 `packages/mock/src/cli.ts` 的 usage 文本）。

终端日志默认 pretty 形态：每个 `request` 一行统计（behavior / model / stream / messages 数 / tools 数）加模型可见上下文全文（system、逐条消息的 role 与全文含 tool-call 块、工具名清单；消息超过 40 条折叠尾部），每个 `result` 一行（outcome / chunks 数）；`ready` / `unavailable` 握手行保持 JSON。要接管道/jq 时加 `--log-format jsonl` 恢复每行一个 JSON 的机器形态（`… --log-format jsonl | tee /tmp/mock-llm.jsonl` 后 `jq -c 'select(.type=="request")'` 逐条查看）。

限制与事实：`DEEPSEEK_API_KEY` 仍需一个非空值（adapter 侧的 `MISSING_CREDENTIAL` 先于网络请求），服务器仅在传入 `--api-key` 时校验 Bearer，否则接受任意值；主代理与尾代理（fork）请求共用同一序列，behavior 没有会话概念；`tool_call_success` 的工具名与参数由 `--tool-name` / `--tool-arguments` 指定；端口被占用时 mock fail-loud（`EADDRINUSE`），可用 `stop` 清理；内容池抽取与 behavior 抽取共享同一随机流，改变池或权重会在同一种子下改变后续序列。

## 方式二：llm-replay 回放补丁

`packages/test-support/llm-replay`（`@deepseek-ai/dsh-llm-replay`）从录制的会话 JSONL 派生每次模型调用的 chunk 脚本，按调用次序回放；`pnpm run test:snapshot` 的 keyless 回放即此机制。fixture 路径写在插件 `Config`（`file` / `overrideFile` / `childFiles`）或对应环境变量 `DSH_SNAPSHOT_FILE` / `DSH_SNAPSHOT_OVERRIDE` / `DSH_SNAPSHOT_CHILD_FILES`；`providers` 非空时为这些路由注册适配器（模型目录与选择器可用），缺省时安装 catch-all waterfall；`paceMs` 为逐 chunk 延迟。补丁可经 `dsh tavern --patch <file>` 应用，或写入 `$DSH_HOME/profiles/tavern/cordis.patch.yml`（profile 用户层，后于所有 bundle 层应用）。

```yaml
# 改编自 snapshots/session/text-turn/cordis.snapshot.yml
- id: llm-deepseek
  disabled: true
- id: session-title-llm
  disabled: true
- insert:
    - id: llm-replay
      name: '@deepseek-ai/dsh-llm-replay'
      config:
        file: <录制会话 JSONL 路径>
        providers:
          - id: deepseek-official
            name: DeepSeek
            models:
              - id: deepseek-v4-flash
```

限制与事实：脚本按调用次序消耗，耗尽即抛错（`script exhausted`），适合确定性场景，不适合不限回合数的自由对话；override sidecar 是裸 `ReplayEntry[]`（整体替换派生脚本）或 `{ patches }`（按 0 起始调用序号替换）；回放 adapter 不读取凭据，但上文的前端 key 预检仍会弹框。快照补丁同时禁用 `plugin-package-inventory-deepseek` 与 `session-title-llm`——两者也发起 LLM 调用。

## 方式三：session-snapshot 测试通道

`packages/test-support/session-snapshot` 以子进程方式启动真实 profile（`AgentUnderTest` 的 `profile` / `configPath`），replay 模式自动拼装 `--profile <name> --patch <base> --patch <scenario>/cordis.snapshot.yml`。harness 对 profile 无硬编码；通道归属由 `scripts/session-snapshot-corpus.corpus.ts` 固定为 `['acp', 'sdk', 'session', 'web']`，tavern 场景加入该清单或把 driver 放在 `snapshots/**` 之外（corpus gate 只扫描这四种 profile 的目录）。

## 方式四：自定义脚本化适配器插件

LLM seam 公开 `ctx.llm.registerAdapter(routes, adapter)`，抽象基类 `LlmAdapter` 只要求实现 `stream()`。一个函数插件注册总是返回固定 chunk 流的 adapter，配合 patch 禁用 `llm-deepseek` 并插入该插件，即可不限回合数返回固定内容，且 LLM 层完全无需凭据。仓库先例是 `benchmarks/agent-continuation/profile-adapter.ts` 的 `ProfileAdapter`（路由 `bench`，挂在 sdk-minimal profile 上）。四种方式中只有这一种需要新增代码。
