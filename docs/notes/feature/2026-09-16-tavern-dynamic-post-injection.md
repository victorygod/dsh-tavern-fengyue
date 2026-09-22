# Agent Note: Tavern wrap retirement — dynamic post injection

Status: implemented

English | [中文](2026-09-16-tavern-dynamic-post-injection.zh.md)

## Problem

The card's per-turn instruction text was composed at submission INTO the player's durable message: `<pre-instructions>` / `<post-instructions>` tag blocks wrapped the raw text in one content block, and every prompt permanently carried its turn's rendered pair. Consequences: stale instructions could never leave the model's view, the display side needed anchored tag-stripping in four places, and the player's text was inseparable from the author's directives at the provider boundary. SillyTavern semantics (depth-0 injection) — a fresh, independent instruction user message each turn — had no native seam. Two card-contract issues folded into the same change: `prefixPrompt` had no native "before the user turn" analog (DSH plugins can only append after the last user turn), and the fixed-file set bordered a file the new design would never render as a position.

## Decision

**One dynamically injected post message replaces the wrap.** The engine renders the post body at submission (`renderPostMessage` — the legacy `prefixPrompt` body prepended to `postPrompt`, each through its own placeholder render so budgets and `scriptFailures` attribution stay per-file) into a per-session FIFO and forwards the RAW player text through the controller. At every step with claims, a global `agent/pre-step` listener (main-agent branch only; scoped agentCtx pre-step listeners previously deadlocked the waterfall) does two things: it shadows every live post node — each is replaced IN POSITION by an empty-content `system/message` event, the kernel's own single-live-node pattern from `SystemPromptProjection` (logged, projects to no wire message, inert to the projection's `text !== ''` filters) — and it appends the stashed rendered texts to `decision.messages`, which the loop admits right after the claimed player messages. The result is the settled view `[system, u1, a1, …, un, postn]` with clean u/a history and exactly one live post; `surfaceOp: replace` is a public seam ("any surface-replacing producer may use it"), so nothing model-visible lacks a durable backer.

`prefixPrompt` retired from the fixed-file set (three fixed prompts now) and downgraded to an ordinary optional file the renderer still reads when present — pre-retirement card content keeps flowing with zero migration. ST imports merge `pre_prompt` + `post_prompt` into the single `postPrompt` file (pre first, blank line between). Display consumers switch from tag-stripping to `source.kind === 'plugin'` filtering; the strip stays as the shim that keeps wrap-era logs readable. Every blocked mechanism is pinned in the REAL suite: turn N+1 eviction, the fork seed's one-live-post tail view, checkpoint-load live-post restoration, reset, stop paths, and the ledger repair walking off its wrap duty.

## Alternatives considered

- **Riding `decision.messages` for the fresh post only, no shadowing** (time-context's accumulate shape): rejected — stale panel instructions would stack into every later request, diverging from the settled per-turn semantics.
- **A replace with meaningful content occupying the old position**: rejected — replacement is in-position (`surface.ts` `nodes.splice`), so the new post would reappear at the previous turn's slot, never after the current claim.
- **Merging prefix content at render time into one file, deleting `prefixPrompt` outright**: rejected for now — existing cards would silently lose their prefix body; the legacy optional read keeps the migration surface empty.
- **Keeping the request-view rewrite seam from the pre-2026-09-14 wrap**: already rejected — model-visible content must derive from the log; the new scheme holds that by construction.

## Consequences

Zero kernel changes; the wire face is untouched (`prompt` RPC signature and `scriptFailures` unchanged). The durable log grows one plugin post event and (after the first post) one empty-system shadow per turn — a few dozen bytes, wire-invisible. `request/header` gains a `reason:'series'` row on injection steps because the shadow bumps `replaceGeneration`; it has no semantic effect (no prepared-call in-history rebasing in tavern). KV-cache reuse per turn now tops out at the previous claim instead of extending through the prior reply — accepted at decision time. Old sessions replay readably through the strip shim; new sessions carry no tags anywhere. Snapshot rows already filtered to player-sourced messages, so worldbook scripts and the tail read clean history without changes.
