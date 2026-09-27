# typert 生成物的再生成

`lib/typert.host.*` 与 `lib/typert.remote-client.*` 是 typert 生成物（现行快照：
2026-09-27 按 0.1.7-rc.2 生成器重生成，含 strict codec 的 `create()` 工厂；更早的
源点是 tavern-extraction-2026-09-17 / 078257c 的 0.1.5 面貌——0.1.7 typert-loader
要求 `mode:'strict'` + `create()`，旧产物在宿主启动时 fail loud）。它们**已纳入
版本控制**（`.gitignore` 里 `!packages/api/lib/typert.*` 四条例外；`lib/` 其余
产物照旧忽略）。

## 2026-09-27 起的仓内重生成流程（已演练成功）

前提：同版本上游 monorepo 检出在手（0.1.7-rc.2 = `~/Desktop/learn_code/deepseek-harness-master`）。

1. 临时三件套（**生成后全部回退**，勿留仓内）：
   - 拷上游 `packages/typert/protocol/src/*.ts` 到 `packages/typert-protocol/src/`，配
     `package.json`（name 必须恰为 `@deepseek-ai/dsh-typert-protocol`）与 `tsconfig.json`；
   - `tsconfig.host.json` 加 `{ "path": "./packages/typert-protocol" }` 引用，并
     `extends ./tsconfig.base.json`（不 extends 则 paths 不生效，`Remote` 会解析到
     node_modules 的发布 `.d.ts`、`registrationForFile` 判外 → invocations 0 →
     fail loud "publishes Remote artifacts but has no Remote methods"）；
   - `tsconfig.base.json` 的 paths 加 `"@deepseek-ai/dsh-typert-protocol": ["./packages/typert-protocol/src/index.ts"]`。
2. 拷上游 `packages/typert/generator/src/*.ts` 到临时目录（`scripts/tmp-gen/`），跑：

   ```js
   import { WorkspaceTypertGenerator } from './tmp-gen/workspace.ts'
   const g = new WorkspaceTypertGenerator(process.cwd(), { checkDiagnostics: false })
   const [r] = g.generate(['dsh-tavern-fengyue-api'])
   // r.js / r.dts / r.remote.js / r.remote.dts → 写 packages/api/lib/typert.{host,remote-client}.{js,d.ts}
   ```

   `checkDiagnostics: false` 是逃生舱：生成器自带的 tsc 诊断对面上的
   `ctx.tavernService` 增强声明与嵌套 cordis 版本会误报；本仓 `pnpm typecheck`
   全绿即为面正确性的独立证据。
3. 回退三件套 + 临时目录，`rm -rf packages/typert-protocol`，`pnpm typecheck` 确认绿。

## 历史流程（上游 monorepo 内生成，仍可用于上游侧改动）

若在上游 monorepo 里动了 tavern 的 RPC 面，回那边执行：

    pnpm run build:lib:host          # 根目录（typertPlugin workspace 模式）
    把 packages/api/tavern/lib/typert.* 四件拷回本包 lib/
    sed -i '' 's|@deepseek-ai/dsh-api-tavern|dsh-tavern-fengyue-api|g' lib/typert.*
    （生成物内部烙着生成时的包名；typert-loader 校验 manifest 所有权必须
    与承载包一致，漏掉这步宿主启动即 fail loud）
并把 `tests/wire-face.spec.ts` 的 conforms 断言跑绿（生成物与 protototype 门禁
互证）。

## 为什么必须手工带回：生成器无法在本仓运行

本仓**不能**用 `@deepseek-ai/dsh-typert-generator` 自行生成这四件。原因不是配置，
而是生成器源码里的符号识别规则（`dsh-typert-generator/lib/types/analyzer.js`）：

```js
isTypeMetaSymbol(node, name) {
    const resolved = this.resolveSymbol(symbol);
    if (resolved.name !== name) return false;                 // 必须是 'Remote'
    const declaration = preferredDeclaration(resolved);
    const registration = this.registrationForFile(declaration.getSourceFile().fileName);
    if (registration?.name === '@deepseek-ai/dsh-typert-protocol') return true;  // ← 关键
    // 或者：声明词法上写在 declare module '@deepseek-ai/dsh-typert-protocol' {} 块里
    return false;
}
```

而 `registrationForFile()` 的"文件 → 所属包"表**只从 face aggregate tsconfig 的
`projectReferences` 建立**，并要求被引用目录位于 `<root>/packages` 之下
（同文件 `loadRegistrations()`）：

```js
for (const reference of aggregate.parsed.projectReferences ?? []) { ... }
```

两极处境：

- **上游 monorepo**：protocol 就在同一工作空间（`packages/typert/protocol`），被
  `tsconfig.host.json` 引用，`tsconfig.base.json` 的 `paths` 又把它映射到源码 →
  表里有它 → `@Remote` 被承认 → 生成成功。
- **本仓（仓外插件）**：protocol 是 npm 已发布包，解析到
  `node_modules/@deepseek-ai/dsh-typert-protocol/lib/types`。`node_modules` 永远不进
  `projectReferences` → 表里没有它 → 判定**恒为 false**。

后果是**静默**的：`collectInvocations()` 里每个方法的 `remoteMarker()` 都返回
`undefined`，于是整个类被跳过（不报错），模型里 `invocations: 0`；emitter 便不产出
`remote` 构件，而 `package.json` 又声明了 `exports["./remote"]`，`validateExport()`
这才 fail loud：

    typert(host): dsh-tavern-fengyue-api publishes Remote artifacts but has no Remote methods

实测记录（2026-09-23，把 `typertPlugin` 接回根 `tsdown.config.ts` 后直接调用生成器 API）：

    discover(['host'])  → dsh-tavern-fengyue-api, dsh-tavern-fengyue-engine      # 发现正常
    analyze(api)        → services: 1, events: 0, objects: 0, schemas: 0, invocations: 0
    generate()          → 抛上面那条 TypertAnalysisError

顺带否证一条捷径：给 Remote 类加生成器支持的"显式 typert root"标签
`@typert service tavernApi`，能让 `services` 正确登记为 1，但 `invocations` 仍是 0
——标签不是瓶颈，上面那条 protocol 符号检查才是。

因此快照携带是这个仓外形态下**唯一可行**的做法，不是绕路。

## 两条备选方向（尚未落地）

- **（b）vendor protocol 源码**：把 `packages/typert/protocol/src` 作为工作空间工程
  引进本仓（命名须为 `@deepseek-ai/dsh-typert-protocol`，并在 face aggregate 里引用），
  使 `registrationForFile()` 能匹配、从而在本仓内真正生成。**这不是改造 protocol**，
  而是取一份未改动快照；本仓已有 `packages/vendor-ui-*` 三个快照的先例。代价：要连其
  依赖子树一起 vendor，且运行时仍须走已发布包（否则与 typert-loader 的所有权/协议校验
  冲突）。属独立立项。
- **（c）当上游问题提 PR**：`isTypeMetaSymbol` 的"必须同工作空间"是生成器对**所有仓外
  插件作者**的通用限制——而"仓外 dsh 插件"本身是受支持场景（本仓就是证据）。可向上游
  `deepseek-harness` 提案：支持按包名匹配，或让 protocol 的解析位置可配置。走通后本仓
  即可直接生成、摆脱快照冻结，是"跟最新 dsh"的根治方向。按本仓 `CLAUDE.md` 第 1 条，
  依赖侧的行为变更正该以 PR 落在依赖仓库，而不是在本仓打补丁。

## 快照冻结的代价（须知）

这四件冻结在 `tavern-extraction-2026-09-17 / 078257c`。dsh 升级若触及 RPC 面或
typert 协议，manifest 所有权/协议校验会 **fail loud**，此时必须回 monorepo 重跑上面的
流程。版本地板三件套（四个 `package.json` 的 version、`dsh-compatibility.json`、
peer 范围）与这一步要一起动。

## 与本仓构建的关系

`packages/api/src/client/index.ts` 以裸导入 `dsh-tavern-fengyue-api/remote` 挂载
浏览器侧 Remote 桩，`exports["./remote"]` 指向 `lib/typert.remote-client.d.ts`；client
face 的 `tsc -b` 因此需要它已存在。**干净检出缺少这四件 ⇒ 构建必红**——这正是 CI
（Ubuntu / macOS / Windows × Node 22/24）在 2026-09-23 全红的原因，也是它们从
`.gitignore` 里获得例外的原因。
