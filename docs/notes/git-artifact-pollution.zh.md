# 暂存区编译产物污染诊断与清理记录

2026-09-11 诊断。当次未提交工作的暂存区混入了 789 个编译产物（`.js` / `.js.map` / `.d.ts` / `.d.ts.map`），散落在约 20 个包的 `src/` 目录和 `vendor/schemastery/src/` 中。本文记录诊断结论、证据与清理步骤。全程只读诊断，未执行任何 git 写操作；清理命令留待人工确认后执行。

## 现象

`git status --short` 共 822 个暂存条目：611 个 `A`、202 个 `AM`、1 个 `AD`、12 个 `M`、1 个 `MM`，另有 6 个未跟踪条目。其中 789 个是编译产物，真正的源码与文档改动约 45 个：`apps/cli`、`docs/tavern-prototype`、新包 `packages/api/tavern`（含 `tsconfig.json`）、`packages/client/ui-tavern` 的界面源码等。

`AM` 状态表示文件暂存后又被后续编译重写，工作区与暂存区版本不一致；`AD` 表示暂存后文件又从磁盘删除（如 `packages/client/ui-tavern/src/client/FooterAction.tsx`）。

HEAD 提交中 `packages/**/src/` 与 `vendor/**/src/` 下没有任何 `.js` 文件，全部污染均为本次未提交工作期间新增，不是历史遗留。

## 证据链

1. `tsconfig.base.json` 开启 `composite` / `declaration` / `declarationMap` / `sourceMap`，但不设 `outDir`；`rootDir: src` 与 `outDir: lib/types` 由各包 leaf tsconfig 提供。凡绕过 leaf 配置、对 extends base 的编译单元执行会 emit 的 tsc，产物即就地写在源文件旁。
2. `packages/api/gateway/src/client/index.js` 与正式产物 `packages/api/gateway/lib/types/client/index.js` 逐字节一致：同一套编译选项的产物，唯一差别是缺失 `outDir`。
3. 正常入口逐一验证安全：`pnpm run build` → `scripts/build.ts` → `tsc -b tsconfig.host.json`（聚合配置自身 `noEmit: true`，各 leaf 写各自 `lib/types`）+ tsdown；`scripts/ts-project.ts` 显式 `noEmit: true`；typert emitter 为模型驱动，不向 `src/` 落盘。标准构建产物只进 `lib/`，已被 `.gitignore` 覆盖。
4. 文件时间线：`.js` 与 `.js.map` 集中于 00:27–00:30 两次全量 emit，部分 `.d.ts` 于 00:55 被第二次仅声明 pass 重写，解释了 `A` 与 `AM` 混杂。
5. shell 历史中只有重复的 `pnpm run build`；以当前配置该命令不可能写出 `src/` 产物。触发编译的具体调用无法从文件系统还原，产物特征（base 选项全开、无 `outDir` 的完整 emit）指向一次绕过 leaf 配置的 tsc 运行或程序化 emit。

## 结论

不是 `pnpm run build` 的问题。根因是一次绕过包 leaf tsconfig 的编译（产物缺 `outDir` 落入 `src/`），叠加一次无差别的 `git add -A` 把产物连同真实改动一起暂存。此状态违反 CLAUDE.md 的「Source plane vs artifact plane, never mixed」与 `.gitignore` 对 `lib/` 的约定，一旦 commit 产物将永久进入历史。

## 清理步骤

全部污染文件均为 `A` 状态（从未提交），撤下暂存并删除文件即可完全恢复。`lib/` 下的产物是正常构建输出，已被 gitignore，不要动；`ui-tavern` 的未跟踪源码（`??` 状态）不经过暂存区，不受影响。

```sh
# 1) 生成清单并人工过目（只列暂存区中 src/ 下的产物）
git diff --cached --name-only --diff-filter=A \
  | grep -E '^(packages|vendor)/.*/src/.*\.(js|js\.map|d\.ts|d\.ts\.map)$' > /tmp/dsh-artifacts.txt
wc -l /tmp/dsh-artifacts.txt   # 预期约 789，抽查确认均为产物

# 2) 撤暂存并删除文件（git rm --cached 兼容已从磁盘删除的 AD 文件）
xargs -a /tmp/dsh-artifacts.txt git rm --cached -q --
while read -r f; do rm -f "$f"; done < /tmp/dsh-artifacts.txt

# 3) 验证
git status --short | grep 'src/.*\.\(js\|map\)$'   # 应为空
git diff --cached --stat | tail -1                 # 应只剩约 45 个真实文件
git diff --cached --check                          # 尾换行检查
```

## 防复发

- typecheck 与构建只走 `pnpm run typecheck` / `pnpm run build`。不要对 extends `tsconfig.base.json` 的配置直接跑会 emit 的 tsc：base 不带 `outDir` 是有意设计，输出位置由 leaf 配置负责。
- 暂存避免 `git add -A` / `git add .`；提交前先 `git status` 过目，推送前按 dsh-pre-push-checks 流程选取检查。
- 可选加固：新增一个小 gate 脚本，检查暂存区 `src/` 下不出现编译产物，挂入 pre-commit，符合仓库「可机械检查的不变量接门禁」惯例。
