# Agent Note: Tavern save-list readability — readable autosave names and per-save summaries

Status: implemented

English | [中文](2026-09-14-tavern-save-list-ux.zh.md)

## Problem

Both save-row facts the UI leans on were hostile to the player. Autosave directory names read as compact machine stamps (`autosave-20260913-210351-453-2`) — the saves page is the player-facing list of where they were, yet every row's identity had to be mentally decoded. And a row carried nothing about its moment: two saves typed only by auto/manual, so "which of these is the night at the harbor" required loading each one.

## Decision

**Autosave names read as local wall-clock time to the second** — `autosave-2026-09-14-01:22:28`, with a numeric suffix only on genuine same-second collisions (`readableSaveName` in workspace.ts; the compact seq-stamped form stays for workspace-root names, which no save row displays). **Save rows order by directory write time, not by name**: the name formats changed shape once already, and lexical order across eras is fiction — mtime is the era-independent authority the autosave ring prunes through (name order remains the deterministic tiebreak).

**Every stamped save records a summary — the last player message at save time** — in the boundary ledger (`TavernSaveStamp.summary`, capped at one display line's worth), captured at all three stamping sites: manual `save()`, the no-tail turn-end autosave, and the post-gate bookkeeping autosave. `listSaves` surfaces it on each row; the saves page renders it as an ellipsized third line (full text on hover) and the save dialog as a middle line between name and kind.

## Alternatives considered

**Keep machine names, decode in the UI.** Formatting client-side keeps the directory layer untouched but puts one more engine-owned fact in the browser's hands — and the name IS the save identity on disk (the overwrite check matches it exactly); decoding would display one truth and act on another.

**Sort mixed eras by parsing the name into a timestamp.** Parsing two name grammars to compare them adds a third fact — order — derived from identity; the directory already records when it was written.

**Summary as a sidecar file per save.** The boundary ledger already holds exactly one row per stamped save and is the load path's authority; a second per-save file would duplicate its keying for no reader.

## Consequences

Names use `:` in the time (POSIX-legal; NTFS cannot host them — macOS/Linux are the intended filesystems). Autosave rows are self-describing at a glance and each stamped row says what was happening; the ring prunes by real recency across any future name changes. The mtime dependency is the cost: `listSaves` now stats every save directory (N saves, one `statSync` each — bounded by the autosave ring plus manual rows), and any future flow that rewrites a save directory wholesale (= the save) is taken as its save-time. Unstamped rows — pre-ledger saves, and the unstamped `autosave()` test helper — list with an empty summary rather than a synthesized one.
