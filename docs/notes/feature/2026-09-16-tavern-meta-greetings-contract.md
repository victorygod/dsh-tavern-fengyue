# Agent Note: Tavern meta contract expansion and default-opening greeting options

Status: implemented

English | [中文](2026-09-16-tavern-meta-greetings-contract.zh.md)

## Problem

Two prérequisites of the one-click SillyTavern import were missing. ① `TavernCardMeta` carried only `{title, desc, cover}`, and the client's `serializeMeta` rebuilt the file from exactly those three keys — any new field would have been silently erased the first time a user edited an identity line. ② `first_mes` / `alternate_greetings` had no landing: ST's swipable greetings belong to the opening experience, but our opening options only existed inside a card-authored `opening.html`; the default opening page was a bare title + desc.

## Decision

**① Meta contract: optional `creator` / `version` / `tags[]` with a field-faithful save-back.** The engine parses the three optional fields tolerantly (absent unless well-typed and non-empty — older three-field metas read unchanged) and the skeleton meta gains their placeholders. The client `parseMeta` now returns the editable identity plus the untouched raw record; saving merges the identity over the raw JSON, so fields the header does not edit (`tags`, importer extras) survive every edit verbatim. The header renders a read-only creator · version credit line and the poll's change detection includes the new fields.

**② Default opening page reads `preset/greetings.json`.** An optional data file (`{ "greetings": ["…", …] }` — the future importer writes `first_mes` first, then `alternate_greetings`) renders option buttons; a click fills the composer through the same `updateDraft` entry the `opening.html` postMessage path uses — fill only, sending stays the player's gesture. Missing file, bad JSON, empty array, or non-string entries silently degrade to title + desc; cards with their own `opening.html` never load the file.

## Alternatives considered

- **Carrying the new meta fields across the wire** (state/library values): rejected — the identity header and the import preview both read the file through `readText`; the wire's three strings already cover its consumers, so a wire change would only force both bundle rebuilds.
- **Generating an `opening.html` to host the options**: rejected — escaping hazards, and a JSON data file rendered by the default page matches the presentation model where the host owns the DOM.
- **A seeded first assistant message**: decided against (2026-09-16) — the kernel would need a controlled seeding primitive, and the opening-options path is the final shape.

## Consequences

Backward compatible by construction: per-field tolerant-parse tests pin the old reading shape, and the ui suite pins field survival across an identity edit. `serializeMeta`'s signature change updated the import-preview call site with it; the meta poll now also refreshes on creator/version changes. One latent client bug fixed in passing: `.onCover` was referenced by the default opening markup but never defined in `App.module.css` (the class rendered as the literal string `undefined`); it now carries a legibility text-shadow. `greetings.json` is a client-side convention only — no engine change, not in `FIXED_PATHS`.
