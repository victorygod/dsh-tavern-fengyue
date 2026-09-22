# Agent Note: Tavern world-card engine and web surface

Status: implemented

English | [中文](2026-09-11-tavern-world-card-engine.zh.md)

## Problem

SillyTavern-style tabletop play needs a card-driven RP mode on the harness: a card library, per-session world state the model maintains through tools, save/restore, an opening page, and a full-screen game surface — none of which the stock conversation UI or agent loop knows about. Shipping it had to stay inside the all-plugin rules: no `agent-loop` changes, no new kernel hooks, and the browser half had to survive every guard the client framework applies (inject declarations, slot takeover, Remote envelopes).

## Decision

**A three-package capability seam, composed by a bundle patch.** [`@deepseek-ai/dsh-tavern`](../../../../packages/extensions/tavern/src/index.ts) owns the workspace engine (one directory per session: `preset/` card content, `runtime/` live world state, `savings/` snapshots); it registers the main agent's `executeTools` plus the fixed `runtime*` tool family, and the tail agent — the 面板维护Agent — as a fork whose write trio maintains `runtime/` between turns. [`@deepseek-ai/dsh-api-tavern`](../../../../packages/api/tavern/src/index.ts) exposes the engine as the `ctx.remote.tavern` namespace and mounts the generated client face from a separate client entry, so the consumer's `remote.tavern` inject is an activation edge, not a self-wait. [`@deepseek-ai/dsh-client-ui-tavern`](../../../../packages/client/ui-tavern/src/client/app/TavernApp.tsx) shadows the built-in `root` slot at lower priority and draws the whole game page: session sidebar, card library, opening page, narrative transcript, and a composer fed by host projections (`tokenUsage`, `contextPressure`, `contextBreakdown`, `sessionStats`) for the context ring and the one-line usage strip. `dsh tavern` boots the profile; `packages/bundle/tavern` stacks the three rows on base + web-app.

**Fixed template paths are a policy, enforced once.** `workspace.ts` names `FIXED_PATHS` — the three area roots, the card skeleton directories, `preset/meta.json`, and the four prompt files. Each may be empty but must exist; the engine refuses deletes, renames, and moves onto them, and the editor's context menu renders no rename/delete row for one (a fixed file opens no menu at all). Creation reaches all three areas; moves stay inside `preset/` and refuse occupied or own-subtree targets instead of merging. Content edits reach `preset/` and `runtime/`; `savings/` snapshots stay read-only because `load` treats them as the restore source of truth.

**Session identity is disk-first.** The engine maps sessions to workspace roots, persists the mapping in a `.tavern-session` marker, and rebuilds it at boot (`restoreBindings`), so restarts do not orphan workspaces. Draft authoring is a `.tavern-draft` marker: the editor page survives tab switches, 返回 abandons it through `cancelDraft`, and both import paths clear it. The tail gate is two different facts — `maintenanceOn` (prompt non-empty, a chip) and `tailRunning` (the engine's in-flight gate, polled) — conflating them once disabled sending permanently.

**The key dialog reads presence, never values.** `credentials.describe` returns `CredentialInfo.configured`; secrets never cross the remote. The dialog opens on demand (send pre-flight, a `MISSING_CREDENTIAL` failure row, the sidebar entry) and shows the configured verdict.

## Alternatives considered

**Extend the agent loop.** Rejected: the loop is a documented no-touch surface; the tail agent, prompt assembly through sections, and tool registration covered every behavior from plugin land.

**Model-visible state in the session log.** The maintenance agent's writes go to `runtime/` files and enter prompts through a cached section provider; replaying them as log events would have multiplied log formats for no replay benefit, since the files are the state.

**A sidebar tab instead of `root` takeover.** The game page replaces the whole chrome (prototype-faithful); a tab would have kept the conversation shell around a full-bleed game surface.

**Reading the stored key back for the pre-flight.** The credentials seam deliberately returns nothing; `configured` is the only question a client may ask.

## Consequences

Tavern sessions depend on the token-meter and session-stats projection units (mounted by base + web-app); without them the usage strip shows zeros and the ring stays empty rather than breaking. The modules server snapshots client bundles at process boot, so bundle rebuilds reach the browser only after a server restart — a restart is part of every upgrade path. The namespace wire returns `RemoteResult` envelopes; `tavernRpc` unwraps uniformly, and test doubles must fake the envelope, not the unwrapped values — fakes that mirror a client-side misreading pass tests while breaking on the real wire (this happened with the key check and is recorded in the tavern devlog). `FIXED_PATHS` exists in both the engine and the client; the engine is the authority and the client copy only shapes the menu.
