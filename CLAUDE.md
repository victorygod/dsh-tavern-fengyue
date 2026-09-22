# CLAUDE.md

Scope: this file's mandates apply to the whole repository. Two hard boundary rules:

## 1. Do not modify `lib` or the kernel

Do not modify anything under `lib/` or the harness kernel (the `@deepseek-ai/dsh` package and its runtime internals: workspace, `{{script}}` rendering, tool registration, tail-agent dispatch, saves). They are external dependencies — treat them as read-only.

- Read them freely to understand behavior.
- Need different behavior? Write an adapter or override in project code (`packages/`, `scripts/`, presets), never patch the dependency itself.
- The only exception: a bug fix that must land upstream — patch it in the dependency's repo via a PR, not in this repo's `node_modules`.

`cordis.patch.yml` notwithstanding: it configures the host, not the kernel internals.

## 2. Scripts must be cross-platform compatible

All scripts (`scripts/*.mjs`, `bin/*.mjs`, preset scripts) must run on macOS, Linux, and Windows without modification:

- Path handling: use `node:path` and `path.parse`/`resolve`/`join` — no hand-rolled `a + '/' + b`, no regex string-slicing of paths.
- No POSIX-only shell constructs: avoid `rm -rf`, `grep`, `sed` inside script bodies; use cross-platform APIs (`node:fs`, `node:child_process` with explicit args, not shell strings).
- No Unix/Windows-only assumptions: no `/usr/bin/env` hardcodes, no `\`-vs-`/` assumptions, no drive-letter assumptions.
- What is acceptable: shell scripts under `scripts/` that already exist and are explicitly invoked as such; still, prefer `.mjs` + Node APIs for anything new.
- With pnpm workspaces: reference packages by name, not by relative path across workspace boundaries.

## 3. House style

Besides the two boundaries above, standard care: read before you write; match the surrounding code's comment density, naming, and idiom; run tests before claiming anything works.
