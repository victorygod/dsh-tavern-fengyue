# Agent Note: Tavern editor file ops — runtime-area renames and collision-safe creation

Status: implemented

English | [中文](2026-09-15-tavern-editor-file-ops.zh.md)

## Problem

Manual testing surfaced two editor file-tree defects. (1) `runtime/` rows offered a working-looking 重命名 menu item, but the engine's `workspaceFileOp` move guard accepted only `preset/` paths and the client swallowed the rejected RPC call (`then(reload, () => undefined)`), so the menu click did nothing with no signal anywhere. (2) Creating a name that already existed was worse than duplication: the editor create op carried no occupied-target check, so `writeFileSync(path, '')` silently truncated the existing live file — the tail agent's `runtimeCreate` refuses occupied targets, the editor's own fileOp did not — and mkdir over an occupied path was a recursive no-op. The client default name was hardcoded to `untitled.md`, so every second creation in one directory collided.

## Decision

One rule per surface. Engine (`workspace.ts`): moves stay within one editable area — `preset/` and `runtime/` rename freely through the new `editableAreaOf` pair check, cross-area moves and `savings/` stay rejected, because savings snapshots are the load path's source of truth and area identity separates user-authored card content from tail-agent-maintained world state; create and mkdir now fail loud on occupied targets (`already exists — creating/mkdir needs a free name`). Client (`TavernView.tsx`): the creation default de-duplicates against the current tree — `untitled.md` → `untitled-1.md` → `untitled-2.md` … capped at 1000, then reverting to the base name so the engine's guard stays the race backstop — in both the disk-backed editor and the in-memory import table. [design_zh.md](../../../../docs/tavern-prototype/design_zh.md) edits the editor paragraph to the new verbs.

## Alternatives considered

**Server-side name derivation.** A `unique` flag on the create op would let the engine derive the free name. It lost for this change because the default name is a client concern today (the wire op never carried a name template), the client already holds the tree data the bump consumes, and server-side derivation costs an api/tavern wire change plus typert and bundle regeneration for no extra correctness — the occupied-target guard covers the stale-tree race.

**Allow cross-area moves.** Moving `preset/` content into `runtime/` would relocate user-authored card files into the area the maintenance agent owns and may rewrite; the reverse hands a runtime file into the card that gets copied to the library on publish. Area identity is load-bearing on both sides, so moves pair within one area.

**Toast on fileOp failures.** The silent-failure surface predates this change (drag moves onto illegal targets still swallow), but threading the toast channel into CardEditor is a UI-scope follow-up, not part of this storage policy change.

## Consequences

`runtime/` renames work end to end; concurrent-manual and second creations de-duplicate; a create that races a stale tree fails loud instead of truncating content; `savings/` immobility is now engine policy instead of an accident of the old guard. Tests pin the same-area file and directory renames, the cross-area and savings refusals, occupied create preserving prior content, the client bump to `untitled-1.md`, and a runtime rename issuing a same-area `move`. The fake rpc `tree` gained state-driven entries returned as a fresh copy per call — same-reference snapshots bail out React state updates and the reload goes invisible.
