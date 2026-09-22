# Agent Note: Host ghost turn — settlement signal missing for error turns, unlocking the composer (fixed)

Status: resolved | 2026-09-22 | Surface: packages/engine (settlement-signal contract) + stop() self-heal

[中文](2026-09-22-host-ghost-turn.zh.md) | English

## Problem (resolved rewrite)

The investigation opened as "a hung turn locking the composer across restarts." The durable log told the real story: the turn did NOT hang — after the SSE stream broke, it ended normally with `turn/end reason.kind=error (STREAM_CLOSED)`. The actual gap was the settlement-signal contract covering only `completed` rounds: after error/aborted/stop-raced turns, the `command/done (tavern-tail-done)` event never arrives, and the client unlocks **solely** on that event (nothing new will ever appear in the durable view to wait for).

Two honest corrections from the investigation: the mock base URL in the host env was NOT a fault — the live host resolves its provider from the in-app config (request header shows deepseek-official/glm-4.7), ignoring the env var by design; and "even stop doesn't unlock" was partially an empty-draft misread (a disabled send button can mean an empty draft, not a lock). The contract gap itself stands proven by the log.

## Root cause (evidence)

seq 18-23: turn/start → user rows → request/header — the submission chain is fully healthy. seq 24-26: attempt finish → `turn/end kind=error` — the turn settles, no bookkeeping. Missing: the settlement event — `onSessionEvent` simply returned on non-completed turns. One seam, one missing signal.

## Fix

1. **Settlement signals cover every turn boundary**: completed (not stop-raced) settles through the bookkeeping chain as before; error/aborted/stop-raced turns settle immediately via microtask, no bookkeeping. The in-flight-gate branch is untouched.
2. **stop() pair-audit heal** for legacy ghosts: on an idle stop, scan the durable events (pure helpers `scanSettlement` + `settlementUnsigned`, unit-testable) and append the missing signal when the last closed turn is unsigned; healthy sessions stay no-ops.
3. Client comment wording updated (zero behavior change there).

## Verification

Unit (`settle.spec`, 5 cases incl. the real ghost shape), REAL composition (an error turn owes exactly one tail-done after its end, no tail scheduled; an idle healthy stop appends nothing), full suite 291/291 — plus repairing a drifted node_modules (three markdown extensions were registered in the lockfile but physically absent; `pnpm add` at the same versions rebuilt them, zero lockfile delta). Live end-to-end on the real host with the real model: the ghost session works again — glm-4.7 replied in Furina's voice **trailing its own `<!-- cg: 1 -->`** (the directive protocol followed by the real model), the hook landed `runtime/cg.json`, the galgame panel repainted with the new line, and the composer unlocked. Screenshot: /tmp/gal-live-e2e.png.

## Impact

Error-settled turns (network breaks, provider outages) now unlock immediately; the settlement signal widened from "every completed turn" to "every turn boundary" while hooks/tail bookkeeping still happens only on completions; legacy ghost sessions heal on their next stop under the fixed engine.
