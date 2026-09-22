# Agent Note: Tavern seed-ledger reconciliation for forked children

Status: implemented

English | [中文](2026-09-13-tavern-seed-ledger-reconciliation.zh.md)

## Problem

Two reproducible defect families appeared whenever a tavern save was loaded after the player had kept playing. (1) 载入 rebound the workspace to a fork of the save-point session, but the child silently re-ran the player's rolled-back pre-load message as its first turn — the model answered it again, and the phantom turn surfaced above whatever the player typed next. (2) The first message sent after 载入 executed twice: once on the main agent and once inside the tail agent's bookkeeping run. Both were proven at the durable-log level in real `session.v3.jsonl.zstd` forensics: the phantom claim carried the client's original `rpcId`, and the child's log held the inbox ledger's `agent/inbox/spliced` commit whose paired removal sat beyond the seed cut.

Root cause: every kernel seed slice can sever an inbox ledger pair. `sessionController.fork` advances the cut to the next `turn/start`, so a message queued after the save boundary rides along as a commit whose claim lands outside the seed; the tail provider's completed-turn cut severs the same way for a message queued during the parent's final turn. The child's inbox projection folds the half pair into a pending message it never legitimately owed, and the loop drains it on the child's first claim.

## Decision

The engine reconciles seed-ledger state at the two points where it owns the child before its first claim. `repairSeedInbox` (new `inbox-repair.ts`) replays the seed region's ledger — mirroring the inbox projection's coordinate validation — and appends durable cancellation splices (`agent/inbox/spliced` with `outcome: 'canceled'`, same-target removals in descending index order). `load` invokes it on the freshly forked child with the fork source's `livePendingIds` as the keep-set: entries the source still holds pending survive (the kernel's inherit-genuinely-pending handoff contract holds), entries the source already consumed cancel. `composeTailAgent` invokes it without a keep-set — the tail owns bookkeeping only, and the parent claims its own queue. Own-region deliveries are unreachable by construction: the tail's maintenance prompt enters through `child.followup` after the seed, outside the reconciled region.

## Alternatives considered

**Fix the kernel seed cut instead.** Aligning each seed's ledger with the parent's state at the cut inside `sessionController.fork` and the fork provider is the semantic home, and keeps every fork consumer clean — it lost for this change because it edits two core packages and reshapes a test-pinned inheritance contract for a defect only tavern's save/load hits in product. It remains the documented long-term home (`docs/tavern-prototype/load-rebind-debug_zh.md` 三轮定案); both repair callsites are its deletion points when it lands.

**Cancel the phantom at the pre-step gate.** The tavern gate could drop a first claim the ledger never paired. It lost because the phantom's durable user/message, turn events, and transcript row all exist before pre-step — the visible damage would ship anyway, just unrouted to the model.

**Clean savepoint sessions.** Fork a savepoint child at save time (its source log ends at the boundary — nothing to sever) and rebind on load without forking. It lost to cost: one extra fork child per save including every autosave turn, plus a fallback path for saves predating the feature; the load-time repair covers existing saves for free.

## Consequences

载入 and 记账 now start from a balanced ledger: no re-run turns, one consumption per message, and a durable cancellation trail in each child's log. The repair writes agent-loop-owned event vocabulary from a plugin — mechanically guarded by the projection fold's fail-loud coordinate validation rather than by the ownership boundary — so agent-loop ledger changes must follow along in `inbox-repair.ts`. The REAL composition test pins both directions: with the repair callsites disabled the load test reproduces the severed pair's re-run, and the tail test pins the parent-queued message running exactly once.
