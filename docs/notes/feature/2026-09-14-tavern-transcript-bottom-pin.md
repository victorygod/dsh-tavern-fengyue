# Agent Note: Tavern transcripts pin to the bottom while the reader is near it

Status: implemented

English | [中文](2026-09-14-tavern-transcript-bottom-pin.zh.md)

## Problem

The tavern transcript scrolled only by hand: a streaming turn grew past the floor and the newest lines stacked out of view, and opening a session (refresh or sidebar switch) landed wherever the browser restored the scroll. Both chat faces need it — the RP chat and the card-writing column render the same `.transcript` scroll container through `chat-view.tsx`.

## Decision

**One shared hook, one scroll rule.** `useBottomPinnedScroll` in `chat-view.tsx` owns the whole policy: the pin samples every scroll event (within 80px of the floor), a dependency-free effect re-glues on every commit while pinned, and a fresh mount starts pinned. Streaming deltas, the typing pulse, error rows, and the opening-page swap all re-glue for free because the effect rides the render commit, not a chosen list of growth sources.

**Not imported from `ui-chat`.** The stock chat's follow-scroll is interleaved with its virtualized window and jump navigation (`atBottomRef`, anchor keys); extracting it would couple the tavern bundle to `ui-chat` internals the root-slot shadow does not otherwise reach. The tavern transcript is a plain append-only flow, so the whole primitive is ~20 lines next to the components that use it.

**The page height anchor moves to the percentage chain together with this change.** `.app` switched from `100vh` to `100%`: the mount point is `#root` of the shell's `height: 100%` chain (web `base.css`), and the viewport unit disagreed with it by a subpixel (zoom, ever-visible scrollbars) — the document carried a resting scrollbar "a little taller than the window". The slot wrapper above `.app` is `display: contents`, so `100%` resolves against `#root` directly.

## Alternatives considered

- **Scroll on `lines` identity only**: rejected — the typing pulse, error rows, and projection-driven re-renders also change the floor; enumerating growth sources re-creates the bug each time one is missed. The every-commit effect costs one boolean check when unpinned.
- **IntersectionObserver on a sentinel row** (the chat-tech standard): rejected — heavier state for one scroll container with no lazy pagination to serve; the distance check already answered by the scroll event is exact here.

## Consequences

No source change outside `packages/client/ui-tavern`; both views pass their existing `.transcript` ref, so a writer-column edit and an RP-chat edit land together. Reading back through history keeps working while turns stream — updates never yank the view until the reader returns within the 80px band. jsdom computes no layout, so the spec asserts the pin through element-level scroll-metric accessors and dispatched scroll events (`tavern-app.client.spec.tsx`, "transcript bottom pin").
