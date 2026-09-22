# Agent Note: Cancel-edit must unload the workspace — the route triplet only reads disk truth

Status: implemented

English | [中文](2026-09-22-cancel-edit-unloads-workspace.zh.md)

## Problem

From the card picker, open a card's 编辑 (edit), 返回 back to the library, refresh the page — the session did not stay on the picker; it entered the card as a game. Causal chain: (1) `editFromLibrary` copies the whole card `preset/` into the workspace (`hasCard=true`) and stamps `.tavern-editing`; the client's `editing` gate keeps it out of chat. (2) 返回 runs `cancelEdit`, which clears the stamp then **re-imports the original card into the workspace** — intended as "restore the untouched card", but the side effect is the workspace stays bound to that card forever. (3) On refresh the route gate `inChat = hasCard && !drafting && editing === null` reads `(true, false, null)` — structurally identical to "playing this card" — and mounts chat. The draft path's `cancelDraft` wipes the three roots back to blank, so "draft → back → refresh" correctly stays on the picker; the edit path had missed that symmetric unload.

Digging further exposed a test blind spot: `tavern-app.client.spec.tsx` statically mocked the editing session as `hasCard:false`, contradicting the real engine (an editing session necessarily has `hasCard:true`) — the post-refresh route derivation was never exercised by any test.

## Decision

**Make disk state tell the truth; leave the route gates untouched.** `cancelEdit` now matches `cancelDraft`'s unload semantics: clear the editing stamp and wipe `preset/`, `runtime/`, `savings/` back to the blank trio (both abandon paths share the new `wipeWorkspaceDirs` in `workspace.ts`, structurally blocking future drift). Data safety rests on three guarantees: editing never writes the library directly (writes back go only through `saveEdit`/`publishCard`), so only the workspace copy is lost; the abandon path is only reachable through `editFromLibrary`, whose `seedRuntime` already wipes `runtime/` first, so a session with real play saves never reaches here; the card-writing agent binds to the workspace root off-session, so the unload is invisible to it. Companion changes: `cancelDraft` is refactored onto the same helper, the `start` route (`TavernView.tsx`) and the `inChat` gate are unchanged, and `TavernView`'s back-button comment now states the new semantics.

**Guards pinned on both sides.** Engine side: a new composition test drives edit → dirty write → `cancelEdit`, then asserts `(hasCard, drafting, editing)=(false, false, null)`, the library card byte-identical, and idempotence on a blank session. Client side: the static mock is replaced by a state machine mirroring disk truth (`editingLifecycle()`: blank→editing→cancelled) plus a re-mount regression case reproducing the refresh. Per `tests-client-plane/README.zh.md` the client-plane suites remain suspended (not matched by the vitest include); the new case passes lint and syntax checks and activates as soon as the suites are wired in.

## Alternatives

**Keep the card, add a persistent "user is at the picker" marker.** Teach the route gate a fourth disk flag (a disk-born cousin of `tavern.pendingSession`). Fails on state surface: another rot-prone marker file, partly redundant with the `(hasCard, drafting, editing)` triplet — three fields already express "no card", so the fourth merely stores the same fact twice, and drift between them buys another debugging round.

**Fix only in the frontend return handler; leave the engine alone.** Wins on zero engine churn, but after a refresh the client cannot distinguish "user is at the picker" from "user is in a game" (that is exactly this bug's root) — a fix would need a global in-memory flag, i.e. papering over the missing disk semantics; wrong again within the refresh window.

## Consequences

After 返回卡库, a refresh honestly lands on the card picker; the editing session's workspace returns to its blank-page state. The cost: abandoning an edit discards not just "changes versus the original card" but the whole workspace copy — semantically identical to abandoning a draft, and since editing never writes the library directly, the library card is always intact. 返回卡库 now shares one fact with the 不保存 dialog option and the draft abandon path: leaving the editor zeroes the workspace.
