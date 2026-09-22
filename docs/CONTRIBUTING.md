# Contributing

Thank you for considering a contribution — issues, PRs, doc translations, and playtest feedback are all welcome.

## Before submitting

1. Make the suite green: `pnpm lint` (oxlint), `pnpm build`, and `pnpm test` (vitest composition tests). CI runs the same on Ubuntu / macOS / Windows × Node 22 / 24 — keep it that way.
2. For anything larger than a bug fix, open an issue first to align on direction before investing in code.

## Code style

- TypeScript; compile config lives in the root `tsconfig.*.json` files.
- Commit messages follow the [Conventional Commits](https://www.conventionalcommits.org/) format.
- No new runtime dependencies without justification in the PR.
- Everything under `scripts/`, `bin/`, and the presets' script surfaces must run on macOS, Linux, and Windows unmodified — use `node:path` and Node APIs, no POSIX-only shell constructs.

## PR flow

1. Fork or branch off `main`.
2. Commit with lint and tests green.
3. Describe what / why / blast radius in the PR (see `.github/pull_request_template.md`).
4. Merge after at least one maintainer approval.

## Docs

- Update README / docs alongside the code change.
- House convention is bilingual pairs (`xxx.md` English + `xxx.zh.md` Chinese); the deep-dive docs are Chinese-first pending a docs-set reorganization, after which English editions land as pairs.

## Code of conduct

See [CODE_OF_CONDUCT.md](../CODE_OF_CONDUCT.md) at the repository root.
