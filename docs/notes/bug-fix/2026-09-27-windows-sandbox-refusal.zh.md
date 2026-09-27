# Windows 全卡报废案:引擎 spawn 继承会话沙盒,无后端宿主整线拒绝

状态:**已修复**(2026-09-27 批)| 日期:2026-09-27 | 关联:[[2026-09-27-turn-error-face-channel]](可见性三层,让本案 10 分钟定案的前置)、[[2026-09-25-cards-zero-poll-migration]](泵链统一走 `tavern.runScript`)

## 现象(用户真机)

- mac 全正常,Windows 全卡齐挂。
- 芙宁娜:`[gg] gal_data连接失败: 数据源未就绪`(修复前的死样子——原因被三层可见性吞掉)。
- dnd5e(`opening` 落盘):`tavern rpc failed: tavern/script-failed: sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host; refusing to run the command unconfined. … ensure the ACL restricted-token runner can start (Windows) — otherwise switch the consumer to danger-full-access.`——**这条原文就是根因自白**。

## 三层事实链

1. **内核按平台装配 shell 执行器**(`dsh-settings`):`shell: process.platform === 'win32' ? 'pwsh-sandbox' : 'bash-sandbox'`。Windows 沙盒后端 = ACL restricted-token runner;后端不可用时执行器**拒绝运行而不是回退直跑**(fail-safe 设计)。
2. **引擎侧 spawn 不传 `sandboxPolicy`** → 内核回落会话面默认 `workspace-write` → 撞上第 1 条的拒绝。受影响面 = 引擎全部 shell seam:卡 prompt `{{script}}` 渲染、前端泵 `tavern.runScript`、卡面直写工具 `runCardTool`。**卡 = 受信宿主代码**(card-ui 信任模型明文「installing a card already grants host-level trust」),本就不该继承模型会话的沙盒表面——沙盒该管的是模型,不是卡自己的脚本。
3. **可见性放大**:api 失败回执 `value.failure` 在 card-ui `runScript` face 被扔掉 → 任何平台任何失败都只见空串 → 卡泵 9 拍后统一「数据源未就绪」。这就是「所有卡一个错、Windows 连错象都对不上手册」的原因(face→信封→上屏三层修复见关联笔记)。

## 修复

- `packages/engine/src/tools.ts` 新增 `trustedScriptPolicy(root): { mode: 'danger-full-access', workspaceRoot: root }`——写法即内核错误文本自带的处方。结构化字面量,零新依赖(不 import `@deepseek-ai/dsh-sandbox`)。
- 两处 seam 显式携带:`prompting.ts` 内部 `runScript`(签名加 `root` 参数,两条调用线:占位渲染 + `runCardScript`)与 `tools.ts` `runCardTool`(卡面直写工具,同一信任级)。
- 语义注记:引擎侧全开放 ≠ 放弃围栏。卡脚本的可写世界本来就是本工作区 `runtime/`(cwd 契约);这条策略只是把「信任卡」从默认措辞落成显式事实,并让卡 spawn 与会话沙盒模式切换/后端可用性**解耦**——之前 mac 上会话沙盒若锁 read-only,连卡自己的落盘渲染也会被误伤。

## 分诊探针(Windows 机自证)

`node scripts/probe-card-script.mjs [--root <工作区根>]`——**不走宿主 shell/沙盒**,直接 spawn 复刻 runner 契约(`node <runner> <b64 脚本路径> <b64 载荷>`,cwd=runtime):

| 步骤 2/3(绝对路径 node / PATH node) | 结论 |
|---|---|
| 有脚本回执(stdout 任何内容,含卡自身业务 exit≠0) | node/runner/脚本栈健康 → 断层在宿主 shell/沙盒层,升级含本修复的宿主即愈 |
| 步骤2 有、步骤3 无 | 宿主壳环境 PATH 无 node(spawn env / PowerShell profile 改写) |
| 无任何回执 | node/runner 层真断,stderr 即真因 |

「脚本跑起来」与「退出码干净」分开记——业务回执(exit 1 + JSON)恰恰是栈通的证明(实测 dnd `front_commit` 业务 JSON 回执一例)。

## 验证

- 引擎 194 例绿(含新钉:占位渲染请求携带 `{mode:'danger-full-access', workspaceRoot: root}`);UI 全套 192 绿。
- mac 真机 `e2e-gal-errorface` error/happy 双 phase 复跑全绿(新引擎构建下泵链畅通)。
- Windows 复测步骤:同步仓 → `pnpm build` → 重启宿主 → 复测;仍败则跑探针按上表切层。
