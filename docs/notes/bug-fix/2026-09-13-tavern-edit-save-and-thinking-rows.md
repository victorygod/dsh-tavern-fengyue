# Agent Note: Tavern edit-save semantics and the thinking-row wire truth

Status: implemented

English | [中文](2026-09-13-tavern-edit-save-and-thinking-rows.zh.md)

## Problem

Five defects surfaced in real manual testing after the edit-in-place cards landed. (1) The editor's blur double-write mirrored workspace `preset/` files into the library at the WRONG path — the `preset/` segment was sliced off, so writes landed at `tavern_presets/<card>/prompt/…`, outside the card: the library card never changed. (2) Even with the path fixed, the double-write design is wrong by contract: editing mutated the library card on every blur, so 返回 could never restore the initial state. (3) The reasoning stream reached the durable log correctly, but the transcript leaked the message's `reasoning` block into the narrative bubble and listened for an `assistant/attempt` log event that the session format never emits — the packed stream rides `assistant/message`'s `data`. (4) `switchSession` retried only a failing `sessions.refresh()`; a throw from `sessions.open()` inside the success handler died as an unhandled rejection with no retry and no toast. (5) The mock LLM streamed reasoning and content back-to-back with zero inter-chunk delay on `success`, so nothing looked streamed and no thinking→reply pause existed.

## Decision

**Editing never touches the library.** `writeText` writes the workspace only; the blur mirror is deleted. The library updates through exactly two explicit actions: `saveEdit` (仅保存 — the workspace preset replaces the edited card, the editing stamp SURVIVES, editing continues) and `publishCard` (保存并开始 — publish and clear the stamps, then `reset` rebinds a fresh session). `editDirty` (new RPC) compares the workspace `preset/` tree against the edited card byte-and-structure (`presetDiffers` in `workspace.ts`); the 返回 flow queries it — clean leaves directly, dirty (or a failed check; fail safe) opens a three-way dialog: 取消 stays, 不保存 runs `cancelEdit` (re-import the original card), 保存 runs `saveEdit` then leaves. `importFromLibrary` and `draftCard` clear stale editing stamps so a mirror-less workspace can never silently point at an unrelated card.

**The transcript reads the durable shape, not an imagined one.** `blocksOf` now admits only `type: 'text'` content blocks; the 思考 row aggregates `reasoning-chunks` from the SAME `assistant/message` event's `data.stream` (`reasoningOf`), because no separate `assistant/attempt` event type exists in the session log — verified against a real `session.v3.jsonl.zstd` before fixing. Live reasoning deltas still render through transient `assistant/live-chunk` frames; the streaming summary follows the newest line with the prototype's sweep marker and hides the typing dots while thinking.

**Rebind retry covers the open throw.** `switchSession` wraps `sessions.open` in the backoff loop alongside the `refresh()` rejection path (≤8 × 250 ms, then the `app.openFailed` toast) — a rebind can no longer die silently between refresh and open.

**The mock paces its phases.** New `--reasoning-gap-ms` dwells between the last reasoning delta and the first content delta (default 0; `scripts/mock-llm.sh` defaults 800 via `REASONING_GAP_MS`), reasoning deltas honor `--chunk-delay-ms` (script default 40 ms), and reasoning text keeps its real newlines. The gap is measured on the drained body in tests — `fetch()` resolves on headers, which would otherwise miss a mid-stream pause.

Evidence: the engine composition test now pins edit-never-touches-library / `saveEdit` keeps the stamp / `publishCard` clears it; the client specs pin the three-way back dialog and the text-only narrative. Debug trail: `docs/tavern-prototype/load-rebind-debug_zh.md`（二轮/三轮/四轮定案）.

## Alternatives considered

**Keep the blur mirror with the corrected path.** Fixing the slice bug instead of reworking the contract was the first move; it lost because every blur still mutated the library card, which made 返回's "restore the untouched card" impossible by construction — rollback needs an stored prior state the design never had.

**Confirm dialog on every blur.** Guarding the old double-write with per-edit confirmations lost to an explicit two-action model: dialog fatigue on every field, and the library could still drift if a user walked away mid-dialog.

**Add the missing `assistant/attempt` event to the session format.** Accepting the transcript's imagined wire truth would have expanded `SessionEventMap` (plus scoped-events regen) for an event the durable log does not carry; the stream records already ride `assistant/message`'s `data`, so the reader moved to the real shape instead.

## Consequences

Blur no longer persists anything: an author who edits and closes the tab loses those edits by design, and 仅保存/保存并开始 are the only write paths back to the library — the "save" gesture moved from implicit to explicit. In exchange 返回 can always restore a known state, the library cannot drift behind the workspace, and the transcript renders exactly what the durable log carries. The dirty-返回 dialog adds one confirm when work is unsaved (fail safe on the `editDirty` check).
