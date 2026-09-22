# 外部插件形态定案与抽取流程：tavern 从随车发布到独立插件项目

承接 [independence-and-release.zh.md](../release/independence-and-release.zh.md) 的发布形态定案（方案二现行：随 dsh 版本列车发布、`dsh tavern` 一行直达）。本文回答三个问题：为什么第三方 dsh 插件的仓库只有一小点内容；tavern 若作为独立插件项目该怎么组织；以及收口到那个形态的完整流程与时机。机制权威在 `packages/boot/app-boot/src/profile.ts` 与 `packages/bundle/README.md`，本文是决策与流程记录。

## 一、为什么第三方插件的 git 仓库很"干净"

dsh 是 all-plugin Cordis harness，插件机制的运行时是**组合，不是修改**。第三方插件的全部产出是一个普通 npm 包：

```text
my-plugin/
  package.json          # peerDependencies 声明共享宿主包
  src/index.ts          # Service Definition / provider / consumer（ctx.effect / ctx.on）
  cordis.yml            # 插件 manifest（!!js 只允许 config 与 entry disabled）
  cordis.patch.yml      # 可选：对组合 roster 按 id 定向覆盖
```

五条机制依据：

1. **组合器堆层**：`dsh --profile` 把 base patch → 各 bundle patch → 用户 profile patch 逐层堆叠，每层对目标 id 整体替换 `config`。插件的"接入"发生在运行时组合面，不在 harness 源码面。
2. **在外面安装**：`packages/bundle/README.md` 原话——in-box bundles 从 dsh 安装本体解析；out-of-tree bundles 经 `dsh plugin --profile <name> add <package>` 装进 profile。
3. **插件与宿主解耦**：upstream desktop 外部插件决策（2026-09-08 desktop-bundled-runtime-and-external-plugins；**来源 = 上游 rc.2 快照** `/Users/wolf/Desktop/new_learn/`，合并后该 note 才入本仓）要求 external plugins 把共享宿主包一律声明为 **peerDependencies**；插件的普通依赖可自选版本，宿主校验只拒绝不兼容 peer 与嵌套复制。插件仓库与 harness 仓库在 git 层面零关系。
4. **大多不需要私有面**：典型插件只有 engine 层 + cordis.yml。tavern 之所以是四个包，是它独有 UI takeover、`ctx.remote.tavern` 命名空间与 bundle patch 层——量大是需求量，不是形态错误。
5. **内核侧明文规则**："Plugins, not loop changes"（AGENTS.md）：新行为挂在文档化扩展点上，改 `agent-loop` 要动 architecture 文档—— spiritually 正是这轮 revert 收走的两个缝的反面教材。

仓库内的"干净形态"活参照：`packages/experimental/agent-team-profile/` —— 一个包 = `index.ts` + `cordis.patch.yml` + README，即 out-of-tree bundle 的最小样例。

## 二、两种形态的对照

| | 形态 A：随 dsh 版本列车（现行，已拍板） | 形态 B：独立插件项目 |
|---|---|---|
| 物理位置 | 本仓 4 包：`extensions/tavern` + `api/tavern` + `client/ui-tavern` + `bundle/tavern` | 独立 git 仓库，4 包平移 |
| 用户安装 | `dsh tavern` 零动作（shipped 模板） | `dsh plugin --profile tavern add <包或 tgz>` |
| 版本协同 | 无地板问题（同一列车） | 需声明最低 dsh 版本 + 加载时 fail-loud 探测 |
| 测试 | 与内核同仓同跑 | 需自建 dev 循环：装 dsh → 启 profile → smoke |
| 组装足迹 | `apps/cli` 依赖行、`PROFILE_TEMPLATES`、`dsh tavern` 子命令、tsconfig paths | 全部消失（外部插件没有这些入线）；**随车用户的 `pnpm dsh tavern` 随之失效** |
| 适用的发布单元 | dsh 全体用户 | dsh 之外的第三方用户 / 快于列车的插件迭代 |

形态 A 的"分散"是 monorepo 的自然结果，不是设计缺陷；形态 B 的"干净"是发布单元不同的结果。两者共享同一个前提：**内核零专属改动**。

## 三、形态 B 的三段流程

### 阶段一（前提）：仓内做到零共享面改动

independence 文档的方案一 + 方案三落地后，验收是可执行的：

```sh
git diff tavern-baseline-2026-09-14..HEAD -- packages/core packages/api/session-controller docs/architecture*
# 应恰为两笔 revert 的逆 diff；终态 grep：agent/request-messages 全仓零命中；agentPreset 限 session-controller
```

达到该态后，tavern 在**逻辑上**已是外部插件，只差物理位置。这是任何后续抽取的门槛，不做闭环满足就搬家，会把内核语义带出去悬挂在别人的运行时上。

### 阶段二：物理抽取

```text
tavern-plugin/
  packages/engine/      ← extensions/tavern 平移
  packages/api/         ← api/tavern 平移（ctx.remote.tavern 命名空间与类型）
  packages/ui/          ← client/ui-tavern 平移
  packages/bundle/      ← bundle/tavern（cordis.patch.yml + dsh.bundle.patch）
```

依赖改法：

- peer 集合按各包的 `static inject` 与真实 import 逐一对出，不要凭服务名猜：引擎侧 = `cordis` + `schema/` 类型面（`dsh-agent`、`dsh-llm`、`dsh-session`、`dsh-system-prompt`、`dsh-shell`、`dsh-subagent`、`dsh-tools`、`dsh-api-session-controller`）；`dsh-agent-loop` **不在**插件依赖里（loop 由宿主装配，插件只经服务面消费）。客户端构建期内联的包（如 `dsh-util-crypto`）留在 devDependencies。**不贪多**——peer 越宽，兼容地板越高，每次 dsh 升级的兼容清单越长。
- 删除三类"在仓内才成立"的东西：
  1. tsconfig paths 别名（改用发布包的 `lib/types`）；
  2. `apps/cli` 的 `dsh tavern` 子命令糖（外部插件没有这条入线，靠 `dsh plugin add`）；
  3. `test-support/llm-mock-server` 引用（换自己的 devDependency mock，或引用 upstream 发布后的等价包）。
- npm 包名换自己 scope；`files` 只 ship `lib/` + `cordis.yml`/`cordis.patch.yml` + 类型。

### 阶段三：安装与发布动线

```sh
npm publish                                        # 或 pnpm pack 出 tgz
dsh plugin --profile tavern add @your-scope/tavern-bundle
# 手编 profile 的 package.json：dsh.profile.bundles 补 @deepseek-ai/dsh-web-app 与 tavern bundle
dsh --profile tavern
```

配套约束（机制推导自 profile.ts 组合契约，外发前按 README 演练复现）：

- **版本地板 fail-loud**：引擎入口显式探测所依赖的每个服务面（`ctx.get` 尝试 + 带版本号的错误），三者缺一会静默失效，绝不静默。
- **覆盖通道仍可用**：profile `node_modules` 里 pnpm 管理的包解析优先于 dsh 自有链接，外装新版本可覆盖随车旧版；换机移植 = `pnpm pack` 三包 + `dsh plugin add <tgz>`。
- 用户侧可在自己 profile 的 `cordis.patch.yml` 再覆盖 tavern patch 的任意行（patch 层级里用户层最后生效）。

## 四、近期收敛：先合并 NEW 快照，再谈形态

抽取的第一步（阶段一）依赖 upstream 基线对齐；与 `new_learn`（0.1.5-rc.2 快照）的合并冲突面快照如下（2026-09-14 staged 前态，随树演化过期，重算方法：本档"现阶段依据"一节的 diff 命令）。

双侧都改过的 12 个文件：

| 档位 | 文件 | 备注 |
|---|---|---|
| 硬冲突 | `scripts/repo-files.ts` | 双方各自重写 glob 兜底；二选一后跑 `repo-files.spec.ts` |
| 硬冲突 | `pnpm-lock.yaml` | 不手合，合并后 `pnpm install` 重生成 |
| 可能红 | `tsconfig.client.json` | 双方插入点相距 5 行，上下文重叠 |
| 基本干净 | `tsconfig.base.json`、`apps/cli/package.json`、`scripts/verify-package-readme-model-experience.ts` | 不同行 / 相距远 |
| 语义核对 | `packages/boot/app-boot/src/profile.ts` | NEW 把 `ProfileManifest` 收窄为 `Partial<DshPackageManifest>`；tavern 模板与 bundle `dsh` 字段要过新类型 |
| 语义核对 | `packages/client/modules/src/index.ts` | NEW 把 `parseDshClient`/`exactPackageSpecifier` 移到 `./client/manifest.ts` |
| 语义核对 | `packages/core/agent-loop/src/index.ts` | NEW±1 `no-deprecated` 注记 vs 本侧 `waitForConfiguredPersistence`；hunk 不撞 |
| 语义核对 | `packages/client/ui-conversation/README*.md` ×3 | 双方各扩段落 |

已消除的冲突点（revert 落地后 == init == NEW）：`session-controller/{agent,types}.ts`、`core/agent-loop/src/agent.ts`、`core/agent/src/runtime-types.ts`、`core/scope` 两文件、`docs/architecture.*`。

非 git 冲突但合并后必红的集成面：

1. NEW 的 client assembly 测试线（`test-support/client-runtime` roster 断言）不认识 tavern 包，需把 tavern 挂进 assembly 清单。
2. NEW 新增 `packages/test-support/remote-mock`——tavern 测试引用 remote 层时可考虑复用。
3. root `package.json` 的 `@deepseek-ai/dsh-package-manifest` 依赖 NEW 已删，合并后消失；tavern 已改走注入，跑一遍 `pnpm run hygiene` 验证。
4. NEW 的 desktop 段落给了 external plugins 官方机制——tavern 独立化恰好对齐此路。

建议顺序：~~提交 staged revert~~（已完成，`ac5402a`）→ 吞 `repo-files.ts` → 其余小文件 → lock 重生成 → `typecheck` + assembly 挂 tavern；合并在新分支上做，以 `tavern-independence-2026-09-14` 为回滚锚。

## 五、执行清单与时机信号

1. 收敛（上一节）：与 rc.2 快照合并到可工作态。
2. 随车发布（形态 A 现行）：方案一/三执行清单走完，`dsh tavern` 直达发布。
3. 外发观察期：运行"随车发布"，累积外部用户画像（是否有旧版 dsh 用户装 tavern 的现实需求）。
4. 抽取触发信号（满足其一即可启动阶段二）：
   - upstream desktop externalPlugins 机制稳定（note 还很新，等它定型可白捡一整套验证与生命周期治理）；
   - 出现"旧版 dsh 用户要装 tavern"的真实场景；
   - tavern 迭代速度需要脱离 dsh 版本列车。

第 4 步之前不做搬家：形态 A 的红利（一行直达、无版本地板、同仓测试）是真实的工程收益，而达到零共享面改动后，形态 B 的抽取对插件代码而言基本是 `git filter-repo` 式搬家，不存在设计风险倒挂——但组装足迹的消失是**用户可见行为变化**：抽取落地时必须保留其一，①`dsh tavern` 子命令留作 deprecated 转发提示（指到安装命令），②发布迁移公告。"搬家无风险"只对仓库内部成立，对既有启动面不成立。

## 六、零发布移植：拷贝式安装（2026-09-14 落地并实测）

不发布 pnpm、不合并分支，把 tavern 装进**别的 dsh 分支 checkout**：四个包目录拷过去 + 少量接线 + 目标侧自己的构建链。`scripts/port-tavern.mjs` 把全部接线收成一条命令，逐步幂等、锚点缺失即 fail-loud 并打印手工改法，绝不静默半装。

```sh
node scripts/port-tavern.mjs /path/to/other-dsh-checkout
cd /path/to/other-dsh-checkout
pnpm install
pnpm run build                # 全量：tsc 产出 lib/types，tsdown 出运行时
pnpm dsh --profile tavern     # 组合装配；目标分支没有 dsh tavern 子命令糖，走 --profile
```

接线面（脚本自动完成，共 8 步）：拷贝 4 包目录（pnpm-workspace 的 `packages/*/*` glob 自动注册，无需改 workspace.yaml）；`apps/cli/package.json` 3 个依赖行（两锚解析的安装锚）；`PROFILE_TEMPLATES` tavern 条目（锚 = `headless:` 入口）；`tsconfig.base.json` 5 条源路径别名（dev 源跑 `tsx` 靠它解析）；`tsconfig.host.json` 3 条 + `tsconfig.client.json` 2 条 project references（两树显式维护——快照里「总通配符」的注释与实情不符，`paths` 无 `dsh-*` 总通配行，别名必须显式加）；`verify-package-readme-model-experience` 3 条 `indirect` 行；`packages/client/tsdown.client.ts` 的 Safari Iterator intro shim（rc.2 快照仍是旧 intro，Safari < 18.4 起不来——已知真 bug，随移植携带）。

为什么这样跨分支成立：模板/组合用的全部是 init 期公开语义（组合堆层、bundle patch、profile 目录）；两笔内核 revert 后 tavern 对上游内核面的引用与 rc.2 逐字节一致（本档「已消除的冲突点」实测）。剩下的兼容风险只在**上游 client 原语的类型演进**，用目标侧 `pnpm run typecheck` 兜底。

### 纯手动流程（不跑脚本，照单走）

①拷贝 4 个包目录到目标分支相同相对路径（只拷源码，四处各自的 `node_modules/`、`lib/` 不带）；`pnpm-workspace.yaml` 不用动（`packages/*/*` glob 自动注册）。②改六个文件，每处几行（省略后果见表）：

| # | 文件 | 改法 | 省略的症状 |
|---|---|---|---|
| 1 | `apps/cli/package.json` | dependencies 增 3 行 `workspace:^`（tavern / api-tavern / bundle-tavern） | 启动即报 bundle 名解析不到 |
| 2 | `packages/boot/app-boot/src/profile.ts` | `PROFILE_TEMPLATES` 里 `headless:` 前插 `tavern` 条目（bundles 三行 + patchReload 'live'） | profile 初始化成裸 `[dsh-base]`（替代：起一次后手编 `~/.dsh/profiles/tavern/package.json` 的 `dsh.profile.bundles`） |
| 3 | `tsconfig.base.json` | paths 补 5 行别名（api-tavern、api-tavern/types、client-ui-tavern、client-ui-tavern/client、dsh-tavern → 各自 src） | dev 源跑 module 解析失败/吃旧 lib |
| 4 | `tsconfig.host.json` | references 补 3 条（extensions/tavern、api/tavern/tsconfig.host.json、bundle/tavern） | build「成功」但 tavern 未编（静默） |
| 5 | `tsconfig.client.json` | references 补 2 条（api/tavern/tsconfig.client.json、client/ui-tavern） | tsdown 报 `UNRESOLVED_ENTRY lib/types` |
| 6 | `scripts/verify-package-readme-model-experience.ts` | kind 表补 3 条 `indirect` 行（api/client-ui/bundle-tavern） | `test:docs` 红（不碍运行，碍门禁） |

另加一处条件项：目标分支的 `packages/client/tsdown.client.ts` intro 若还是裸 `var module = …`（无 `globalThis.Iterator` 垫片），换成源仓库的 6 行 Safari shim——不做则 Safari <18.4 起不来（Chrome 无感）。③目标分支 `pnpm install && pnpm run build && pnpm dsh --profile tavern`（别用 `build:lib:host` 代替全量 build；ui-tavern 的 client bundle 依赖 tsc 先产出 `lib/types`）。省 6 个小编辑的代价 = 在三类不同形状的报错里反推漏了哪步——这就是脚本七个步骤的全部来历。

### rc.2 实测记录（2026-09-14，对 `/Users/wolf/Desktop/new_learn` 副本）

| 步骤 | 结果 |
|---|---|
| 脚本 8 步接线 | 全绿，零手工（fail-loud 锚点全部命中） |
| `pnpm install` + `build:lib:host` | ✅ engine/api 全部编译通过——宿主面对 rc.2 零漂移 |
| api-tavern / ui-tavern client bundle | ✅（ui-tavern 需先 `tsc -b tsconfig.client.json` 产出 lib/types，全量 `pnpm run build` 天然覆盖） |
| `pnpm dsh --profile tavern --dump-default-config` | ✅ 组合树正确：web-app bundle 层 + `agent-presets` 禁用行为 true + 三行 insert（tavern-engine/tavern-api/ui-tavern） |
| 目标侧 typecheck | ⚠️ ui-tavern 对 rc.2 有 3 处类型漂移（`ui-primitives` 的 IdentityLine props 收紧、locale 键集窄化、一处 unused）——显示面小改，不影响装配与 bundle |

结论：拷贝式移植成立；跨**小版本**分支零手工，跨**大版本**快照需按目标 typecheck 做 3 处量级的显示面适配。漂移清单会随目标分支不同而变化，以目标侧 typecheck 为准绳——这正是第三段「版本地板 fail-loud」的免费实现。
