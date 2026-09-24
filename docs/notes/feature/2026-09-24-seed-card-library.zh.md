# 卡库随装自带:推演记录与最终裁定

**状态:已裁定——保持当前设计,不自带卡包(2026-09-24)** · 本文由同日提案改写为决策记录。原提案正文(seed 机制、改动清单、验证方案)随裁定作废;推演过程、被否决的方案与代码实证**保留在案**,作为将来重启的底稿。英文版与 `*.i18n.yaml` 不再补(未实现即无对外面)。

---

## 0. 一句话结论

**示例卡不进任何发布包,`tavern_presets/` 维持仓库内现状,引擎代码零改动。**

产品定位随之明确:**引擎外发,卡自备**——安装态用户提供空卡库,通过建卡/编辑/ST 导入自备内容;示例卡与芙宁娜在可预见期内是仓库私有资产。这个定位是知情选择,以下事实已确认接受:

- 装出来的用户**永远玩不到芙宁娜的卡 UI**:ST 导入只读三个 prompt 字段(`workspace.ts:385` 注释原文:"Only `system_prompt`, `pre_prompt`, and `post_prompt` are read"),`preset/ui`(面板运行时)、`hooks.json`、CG 等全进不来;
- 安装态没有任何开箱内容,卡库页初始为空。

## 1. 起点:两个真问题(2026-09-24 安装演练实测)

### 1.1 安装态卡库为空,"源码里有卡"是 cwd 巧合

`packages/engine/src/index.ts:112-113` 两个路径默认值是相对的,`:457` 按**宿主进程 cwd** 解析:

```ts
libraryBase: z.string().default('tavern_presets'),   // 卡库
workspaceBase: z.string().default('tavern_workspace'), // 会话工作空间(存档所在)
```

- 源码流程 `bin/dev.mjs:271,290` 以 `cwd: REPO_ROOT` 起宿主 → 恰好落到仓库根的 `tavern_presets/`,三张示例卡"看起来自带"纯属巧合;
- `tavern_presets/` 不在任何包的 `files` 里,安装态从机制上无卡;
- 演练实测:`D:\_rehearsal\` 下出现 `tavern_presets\card\preset\…`(用户建的,标题空 → 兜底名 `'card'`,`workspace.ts:378`)与 `tavern_workspace\ws-…`——库和存档落在"敲 `dsh` 命令的那个目录"。
- 仓库早为 agent preset 踩过同一个坑(`index.ts:221-226` 的 tandem 注释:"the cwd-relative convention only worked inside the harness repo")——这是同一 bug 的第二处受害者。

### 1.2 (独立于带卡与否)cw 相对默认值使**存档跟着目录走**

工作空间含 `savings/`(存档)。换目录启动 `dsh`,旧会话即不可见。此问题**与是否自带卡无关**,属引擎自身缺陷——见 §5.2 遗留。

## 2. 推演过的形态(按讨论时间序)

### 2.1 C0 原提案:单目录 seed-if-absent

包内母本在 engine mount 时 seed 到 `<DSH_HOME>/tavern_presets`,`existsSync` 即跳过;更新语义 = "未改不碰,删卡即更新"。评估结论:机制成立,担心点有三——示例卡永不自动更新(需账本式 v2 补)、部分删坏不自愈、示例卡无法永久移除。**本提案最完整的原始文本在其 git 前身的 §3–§9**(已废弃,论证要点并入 2.5)。

### 2.2 运行时下载(用户最初设想"另立项目自动下载")

否决,理由:
- 任何"自动下载"最终收敛到 npm——插件本身就经 registry 安装,再为内容造一条 GitHub/CDN 通道等于重造一遍 npm 白送的管道(离线挂载、完整性、缓存、重试);
- 落点若选 profile 目录,踩 reconcile 坑(profile 是配置领地,`dsh plugin` 生命周期会清)。

### 2.3 B1:cards 独立包(推演中被接纳为构件)

卡内容拆 `packages/cards` 独立包独立版本:engine 不随发布驮 6.08 MiB,内容节奏与代码节奏解耦,SRD/CC-BY 法律面隔离;安装经依赖链自动带动(内核 plugin 管理器 = pnpm install,bundle 声明依赖即可)。**作为构件成立**;dev 里 `link:` 需在 `bin/dev.mjs` 依赖表显式列行(link: 不吃传递依赖,现状即四包全显式列)。

体积事实(只带 `preset/`,逐字节复算):dnd 26 文件/0.52 MiB;dnd5e 1258/2.57;芙宁娜 31/2.98;合计 1315 文件/6.08 MiB。`docs/`(单张头像 12.4 MB)与 `assemble.mjs` 不进包。

### 2.4 union 双根并集(用户裁定否决)

为同时拿到"免 seed + 自动更新 + 恢复出厂免费",设想库 = 包根(只读)∪ 用户库(可写),编辑经 publish 自然 fork,名字解析用户优先。**用户裁定:"不希望有两个目录"**——否决。

否决前的代码实证产出(沉淀为 §4,对所有形态都有价值):
- fork 首存**不是免费**:`publishIntoLibraryCard`(`workspace.ts:369`)要求目标卡已存在,缺 `preset/` 即 throw;
- **高危**:`deleteCard`(`index.ts:947`)已在 wire 上(`rpc.ts:39,126`),UI 每卡悬停提供删除(`locales.ts:89`)——naive union 下删除包内卡会 rmSync 进 node_modules,Windows 可写文件系统上等于损坏已装包;
- `editDirty`(`index.ts:888`)必须走"用户库优先"解析,否则 `diffTree`(`workspace.ts:731`)把缺失 fork 按空树算,编辑页刚打开就误报脏;
- 两个去重面(`publishWorkspaceCard:378`、`commitImport:932`)必须扩到包名集,否则用户新卡标题撞示例卡名会静默遮蔽。

### 2.5 单目录 seed + 位置统一(七条约束全满足的完整体)

union 否决后的收敛形态:库与工作空间在 dev/安装两世界统一按 `<DSH_HOME>` 解析(dev 用隔离 home `~/.dsh-tavern-fengyue`,`dev.mjs:30`);仓库只当母本(`packages/cards`),dev.mjs bootstrap 刷样例卡入库;原提案 §6 的"dev 钉回仓库" patch 整段退役。账本(`.tavern-seeded.json`,逐文件哈希)补自动更新:未改覆盖、改过保留;账本损坏按"此卡归用户"处理——**所有失败路径倒向'不动'**。

**最终未采用**(见 §5)。两个诚实的残留语义,重启时仍适用:
- 用户改过示例卡后自己整卡删除 → 重启复活母本原版,改动随删除消失(删卡 = 恢复出厂);
- 部分删坏(误删卡内个别文件)不自愈,残卡保留。

## 3. 用户约束七条(推演中逐条拍板,重启时原样生效)

1. **一键带卡**:`dsh plugin add` 必经依赖链自动带示例卡,无手动步骤、无运行时下载;
2. **cards 独立成包**(B1):独立包独立版本,engine 不驮内容;
3. **单目录**:卡库永远只有 `<DSH_HOME>/tavern_presets/` 一个目录,双根/并集否决;
4. **用户卡不可摧**:升级/profile 重建/卸载,永不删改用户自建或改过的卡;
5. **示例卡归包**:母本在包,库内副本由 seed 产生;更新 = 未改覆盖、改过保留;
6. **dev/安装同一位置规则**:两世界都按 `<DSH_HOME>` 解析(dev 用隔离 home);仓库只当母本;
7. **代码实证**:结论必须落到文件行号、逐场景走查,不接受"应该没问题"。

## 4. 代码实证附录(本轮行号沉淀,重启时先复核)

### 4.1 卡库的读写路径全景(全部触点)

读:`library()`→`listLibrary`(`index.ts:731`;`workspace.ts:306`,单根 readdir、每 RPC 现读无缓存);`resolveLibraryCard`(`index.ts:829`);`importCardPreset`(`workspace.ts:322`,载卡拷贝进工作空间 + `seedRuntime`);`readLibraryAsset`(`workspace.ts:680`,fence + MIME + `editReadCap`,只读);`editDirty`→`presetDiffers`→`diffTree`(`workspace.ts:725,731`,缺目录 = 空树)。

写(四条,无其他):`publishIntoLibraryCard`(`workspace.ts:364`,目标必须已存在,:369);`publishWorkspaceCard`(`:373`,标题兜底 `'card'` + `-2` 去重);`commitImportedCard`(`:385`;调用点 `index.ts:930-941`);`deleteCard`(`index.ts:947`,整卡 rmSync)。

编辑链:载卡/编辑全走工作空间(`editFromLibrary` `index.ts:895` 盖 `EDIT_MARKER`),库自身无原地编辑路径;回写仅 `saveEdit`/`publishCard` 两口(`:875,856`)。

### 4.2 数据安全三重事实(约束 4 的依据)

- **物理隔离**:卡库落点在 profile 目录之外时,`dsh plugin add`/reconcile/重建根本看不见它——pnpm 只动依赖清单声明的 node_modules 子树;
- **内核不删**:plugin 管理器(`@deepseek-ai/dsh/lib/plugin-Ddi42qoW.js`)中 `rmSync`/`rmdirSync`/`unlinkSync` 零命中;dev 流程仅删 `pnpm-lock.yaml` 解冻(`dev.mjs:199`);
- **引擎不碰库**:全部 `rmSync` 逐个清点,只落在工作空间内部(preset 替换、savings、runtime、fenceIn 路径)与会话日志 GC(`index.ts:402,439`),无一处指向 libraryBase。

### 4.3 其他核实项

- Windows 非 ASCII:`copyTree`(`workspace.ts:68`)为 `cpSync` 静默失败的修复件(2026-09-23),目标含中文卡名必用;
- agent preset 镜像 `syncShippedPresets`(`index.ts:226` 起)是"byte 不同即覆盖"语义,仅适用系统所有内容,**不可**照抄到用户卡库;
- wire:`TavernLibraryCardWire`(`api/src/types.ts:41`,`name/title/desc/cover`);`bundles` 依赖声明在 `packages/bundle/package.json:38-42`;
- `packages/engine/tsconfig.json` 仅 `include: ["src"]`,卡内容迁入 engine 包不进构建面;
- 卡 UI 文案(`locales.ts:86-89,104`)描写的是单根世界,任何改库落点的方案需同步核文案。

## 5. 最终裁定

### 5.1 裁定本体(2026-09-24)

**保持当前设计(档位 A):不自带卡包,引擎代码零改动。** 原提案文档全部作废;`tavern_presets/` 留在仓库根,继续作为作者卡库与示例卡母本(现状机制:`tier_dev` 的 cwd 巧合,dev 流程依赖它,勿"顺手修"破坏)。

### 5.2 遗留(未拍板,单列待议)

**两个 base 的 cwd 相对默认值**(`index.ts:112-113`)。这是与带卡决策无关的独立缺陷:安装态下用户存档/自建卡跟随"敲命令的目录"分散。候选修法(档位 B):默认值改为 `<DSH_HOME>` 绝对路径(`tavern_workspaces` 复数、`tavern_presets` 保持命名),约十行 + 对应测试;dev 流程不受影响(dev 本就以 `cwd: REPO_ROOT` + 可显式传绝对路径)。**注意:改默认值会改变安装用户的既有数据落点,实施前需单独拍板并考虑旧目录兼容说明。**

## 6. 重启条件

当以下任一成为真实需求时重启本提案:要给他人开箱分发芙蓉娜/示例卡;正式对外发布且"零开箱内容"不可接受;外部卡作者出现(那时 B2 独立卡仓重新上桌)。

重启成本:本文 §2–§4 即全部论证与代码事实,§3 七条约束原样生效;预期工作面 = 引擎双根或单目录 seed 二选一 + cards 包 + dev sync + 测试路径随迁 + wire(若有来源徽章)。先复核 §4 行号,再动代码。
