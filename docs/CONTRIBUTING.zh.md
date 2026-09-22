# 参与贡献

欢迎以任何形式参与——Issue、PR、文档翻译、测试反馈。

## 提交 PR 前

1. 确保 `pnpm lint`(oxlint)、`pnpm build`、`pnpm test`(vitest 组合测试)全部通过。CI 在 Ubuntu / macOS / Windows × Node 22 / 24 上跑同一套命令——保持这个状态。
2. 新功能或改动较大时,先开 issue 讨论方向,避免大量返工。

## 代码风格

- TypeScript,遵守项目根 `tsconfig.*.json` 中的编译配置
- 提交信息使用 [Conventional Commits](https://www.conventionalcommits.org/) 格式
- 不引入新的运行时依赖;需要新依赖时在 PR 中说明理由
- `scripts/`、`bin/` 与 preset 脚本面的一切代码必须在 macOS / Linux / Windows 无改动可运行——用 `node:path` 与 Node API,不用 POSIX 专有 shell 写法

## PR 流程

1. 从 `main` fork 或新建 feature 分支
2. 提交代码并确保 lint 与测试通过
3. PR 描述中说明改动内容、动机和影响范围(见 `.github/pull_request_template.md`)
4. 至少一个 maintainer approve 后合并

## 文档

- 修改代码时同步更新相关 README / docs
- 仓库惯例是双语成对(`xxx.md` 英文版 + `xxx.zh.md` 中文版);深度文档目前以中文为主,待整理成体系后由维护方补齐英文成对版

## 行为准则

见仓库根目录 [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md)。
