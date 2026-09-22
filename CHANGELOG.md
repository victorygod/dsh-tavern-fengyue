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
