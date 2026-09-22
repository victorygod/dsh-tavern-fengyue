# Agent Note: Tavern plugin independence via composition, not kernel semantics

Status: implemented

English | [中文](2026-09-14-tavern-plugin-independence-core-reverts.zh.md)

## Problem

The tavern plugin required two kernel semantics that only tavern consumed: the literal `'none'` Agent preset in session-controller (`bca70fe`) and the `agent/request-messages` request-view extension point (`b6c28be`). Shipping the plugin without kernel-specific semantics meant both had to go while preserving the product behaviors they enabled — preset-free sessions and per-turn prompt wrapping.

## Decision

**Preset-free by composition.** The tavern bundle's patch disables the whole per-session preset plane (`agent-presets`, `ui-agent-preset`). The engine requests no preset; session-controller composes every session through its `presets === undefined` branch — the code path that predates presets entirely. Every consumer of the service in the tavern profile tolerates absence (optional chains, early returns, or unreachable UI).

**Wrapping by submission-time composition.** The wrap feature keeps its card files and import mapping but moves to the `tavern.prompt` RPC: after the turn-tail gate, the engine renders the prefix/post pair and composes ONE durable content block — `<pre-instructions>` / `<post-instructions>` tagged pair around the raw player text — admitted through the normal session-controller prompt path with the client-minted rpcId. The wrap is permanent per message; every request derives the same view from the log, and the UI (transcript, sidebar summary, save summaries) strips the anchored sections. One block, because the provider flattens a message's text blocks with no separator — the block's own bytes are the only stable anchors. The client strip mirrors the composer byte-for-byte in `wrap-markers.ts` (the `FIXED_PATHS` two-copy precedent).

**Both kernel commits reverted** (`bca70fe`, `b6c28be`): the agent-loop, agent types, scope generated registry, and architecture docs returned byte-identical to the pre-plugin state; no regeneration step needed since the revert carries the generated file. The baseline tag `tavern-baseline-2026-09-14` is the diff authority. Unrelated defect fixes (`85e04e8`, `be8dc71`, `fcd4575`) deliberately ride along.

## Alternatives considered

- **Keep the kernel semantics** (peer-range version floor + fail-loud activation probe): viable for the bundled release but keeps plugin-only semantics in shared packages and bakes silent-failure risk (cordis waterfall listeners on unknown events never fire) into every external deployment.
- **Drop prefix/post wrapping entirely**: removes the plugin's own dependency reason but discards a documented card capability (SillyTavern `pre_prompt`/`post_prompt` import) that the composition preserves.

## Consequences

Players see panels and hard rules at the most recent position every turn; the UI never shows them, including across refresh and save/load, because the strip's evidence lives in the log itself. Requests carry every historical pair (recency resolves which is current); compaction owns the shrink. Anything that renders raw logs (SDK, non-tavern UIs) will display the tagged text. The kernel-facing reconciliation is mechanical: `git diff tavern-baseline-2026-09-14..HEAD -- packages/core packages/api/session-controller docs/architecture*` equals the two reverts' inverse.
