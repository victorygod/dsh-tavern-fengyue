# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Root `LICENSE` (MIT), `CHANGELOG.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, and `THIRD_PARTY_NOTICES.md`.
- GitHub issue/PR templates and a cross-platform CI workflow (Ubuntu / macOS / Windows × Node 22 / 24).
- `pnpm lint` (oxlint) with the vendored source snapshots excluded.

### Changed

- Tail-agent write face rebuilt to mirror the stock dsh fs tools, fenced to `runtime/`: `runtimeEditor` (view/create/str_replace/insert) is retired for `runtimeWrite` (create or fully replace a document) and `runtimeEdit` (exact old_str→new_str replacement with `replace_all`); `runtimeRead` absorbs the view powers (cat -n numbering, optional `view_range`, two-level directory listings, 10k clip marker) and `insert` is dropped (multi-line `new_str` splices lines).
- The `runtime*` tools now participate in the kernel's parallel tool scheduling: the read pair and the write pair declare parallel-safe, with the write pair serializing same-path mutations through a per-path promise chain (different files write concurrently, one file's edits keep their model order); `runtimeDelete` and the card tools stay exclusive.
- `bin/dev.mjs` repo-root `.env` credential loading is now guarded by `.gitignore` (plus a committed `.env.example`).
- Docs reorganized into a system: `docs/` split into `architecture/` / `cards/` / `runtime/` / `testing/` / `release/` with a `docs/README.md` index; dated decision/debug records and the devlog moved to `docs/notes/`; all cross references updated. English editions land later as `foo.md` ↔ `foo.zh.md` pairs.
- Verified against `@deepseek-ai/dsh` 0.1.5-rc.2 (devDependency and compatibility list moved up from rc.1; full suite green on both).
- Legal hardening: README "Disclaimers" (not affiliated / card-content responsibility / as-is), explicit CC-BY 4.0 scoping (SRD corpus is not covered by the project MIT) and the CC-BY adaptation note in `THIRD_PARTY_NOTICES.md`.

### Fixed

- **Windows: save directory names no longer embed `:`** — `readableSaveName` produced a colon-separated wall clock (`autosave-2026-09-14-01:22:28`), and `:` is illegal inside a Windows path segment, so `writeSave`'s `mkdirSync` failed with `ENOENT`: autosave broke outright, and 16 engine composition tests failed with it. Every field is dash-separated now (`autosave-2026-09-14-01-22-28`). Existing saves are unaffected — rows are listed by directory entry and ordered by mtime, and the name is only ever tested for the `autosave-` prefix, never parsed. The READMEs' examples were updated to match; both already documented a pure-dash format, which the code now actually produces.
- **Windows: copying into a non-ASCII destination no longer silently drops every file** — the engine used `fs.cpSync(..., { recursive: true })`, which on Windows copies *nothing* into a destination path carrying non-ASCII characters and reports no error at all. Since the destination is routinely user text, this hit publishing a card whose title is non-ASCII (library entry left with an empty `preset/`), manual saves with non-ASCII names (empty snapshot), and editor copies/moves to non-ASCII paths. All copy sites now go through a hand-rolled `copyTree` / `copyPath` pair built on `readdirSync` / `copyFileSync`, which handle the same paths correctly (verified on Node 24.14.0; equivalent on POSIX).
- **`pnpm build` and `pnpm typecheck` work again** — dropped `--config-loader tsx` from all seven `tsdown` invocations (root `build:lib:host` / `build:lib:client` / `typecheck`; `packages/api` and `packages/ui` `bundle` / `watch`). tsx's CJS loader hook resolved `node:fs?tsx-namespace=…` as a file path and died with `ENOENT`, so the host face never built. The flag was never needed: tsdown loads `tsdown.config.ts` natively, and upstream dsh's own `build:lib:*` scripts carry no such flag.
- **A fresh checkout builds again (CI was red on every platform)** — `packages/api/src/client/index.ts` mounts the browser Remote stub through the bare import `dsh-tavern-fengyue-api/remote`, which `exports["./remote"]` resolves to `lib/typert.remote-client.d.ts`; the client face's `tsc -b` therefore needs the four generated Typert artifacts present. They are produced by `@deepseek-ai/dsh-typert-generator`, and this repo cannot run that generator: it recognises `@Remote` only when the protocol's declarations belong to a project of the analyzed workspace, while here `@deepseek-ai/dsh-typert-protocol` is a published `node_modules` dependency (`isTypeMetaSymbol` / `registrationForFile` in the generator's `analyzer.js`). Nothing generated them here, so they existed only as a hand-carried snapshot which the blanket `lib/` ignore rule kept out of git — a fresh clone failed with `TS2307: Cannot find module 'dsh-tavern-fengyue-api/remote'` and never reached the tests. They are now versioned via four `.gitignore` exceptions (`packages/api/lib/typert.*`); every other `lib/` artifact stays ignored. The rationale and the regeneration procedure live in `packages/api/REGENERATE.md`.
- dnd5e `cast` tool: attack-type spells now apply the parsed damage-modifier chain (immunity → 0, resistance → half, vulnerability → ×2), matching the `attack` tool; removed a dead save-branch no-op.

### Removed

- `scripts/llm-debug.sh` — pre-extraction leftover referencing a no-longer-shipped proxy script; the mock-LLM dev flow (`scripts/mock-llm.mjs`) covers keyless debugging.

## [0.1.0-rc.1] - 2026-09-17

First release candidate: the RPG world-card engine as an out-of-tree dsh profile.

### Added

- Tavern engine on the dsh host: per-session workspaces (`preset/` / `runtime/` / `savings/`), turn-tail maintenance agent, replayable save history.
- SillyTavern / Fengyue card import (`.json` / `.png`): world info → `lorebook.mjs`, regex → scripts, agent-translated leftovers with an import work order — nothing silently dropped.
- Built-in card-writing agent: new cards from a blank skeleton by conversation.
- Full-screen web UI with theme system; Chinese/English README.
- Example presets `dnd`, `dnd5e` (ships SRD 5.1 lore, attributed per `THIRD_PARTY_NOTICES.md`), and `芙宁娜`.
- Keyless vitest composition suite (mock-LLM, jsdom testkit) and the `bin/dev.mjs` dev orchestrator.
