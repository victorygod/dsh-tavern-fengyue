# Agent Note: Tavern one-click SillyTavern importer

Status: implemented

English | [中文](2026-09-16-tavern-st-importer.zh.md)

## Problem

The old import path was a flat field reader: top-level `name/description/system_prompt/pre_prompt/post_prompt` only — real SillyTavern cards (V2 data.*, V3 character_book/regex_scripts, PNG containers) folded to blank cards, PNGs were unselectable, and nothing landed for worldbooks, greetings, or identity tags. The design in st-card-field-mapping_zh.md prescribed the shape; this change implements it.

## Decision

**One module, pure fold.** `st-import.ts` (client side, no React) handles: PNG magic probing with a tEXt chunk walk (`ccv3` preferred over `chara`, base64 JSON, PNG bytes become the cover); spec detection (`chara_card_v2`/`chara_card_v3`/spec-less V1 + the legacy DSH top-level `pre_prompt`/`post_prompt` pickup); normalization onto the V2 canonical shape. The fold lands five ways per the mapping doc: systemPrompt composed in ST's own assembly order (constant world-book entries in `before`/`after` sections around the persona stack), triggered entries into `preset/lorebook.json` (full entry preserved under `st` for re-fold) + a generated `preset/scripts/lorebook.sh` v1 (jq-based: tail snapshot → contains-match → probability gate → ordered output; jq missing = world book silently off, documented) with `{{lorebook()}}` mounted in postPrompt (the inverted 2026-09-16 default; `post_history_instructions` also lands in postPrompt — same mechanism as ST's depth-0 injection), `first_mes`+`alternate_greetings` into `preset/greetings.json`, identity into meta.json (title/desc-short/cover/creator/version/tags), every un-foldable regex script pre-sorted by verdict (`translate`/`pending-render-hook`/`drop`) into the `preset/st-import/` work order whose README carries the import report (drops / missing refs / disabled entries / fold stats). Persona rides as two files (`scripts/persona.sh` + `setup/persona.md` seeding `runtime/persona.md`). `importFromJson` wraps the whole fold so any throw becomes a user-facing import error, never an unhandled rejection.

**One entry.** The directory-import button is deleted (its parseDirectoryImport with it); the single tavern-card entry accepts `.png`/`.json`. The preview page keeps its in-memory edit flow; the PNG cover lands via `writeAsset` right after `commitImport` (meta.json already points at `preset/assets/cover.png`; a failed cover write alerts instead of blocking).

## Alternatives considered

- **Keeping directory import**: rejected per decision — it served our own legacy flat format, the new parser picks up `pre_prompt`/`post_prompt` from spec-less JSON anyway, and one entry keeps the UX honest about what importer semantics apply.
- **Mounting `{{lorebook()}}` in systemPrompt**: rejected — in-history models (deepseek-flash) append system changes after the cached prefix without replacing, so stale world content accumulates; the post tail section has ST's per-submission semantics with zero cache cost (mapping §4.2).
- **Translating regexes in the importer**: rejected — rule translation needs semantic judgment (agent), the importer only pre-sorts by verdict and preserves raw entries.

## Consequences

Wire and engine untouched (`commitImport`/`writeAsset` already cover the flow). The work order materializes only when there is something to report; translation-agent consumption is the remaining staging item (§9 PR3, plus a writer-guide section). Tests: a 12-case pure-folder spec (PNG routes incl. ccv3-vs-chara precedence, normalization matrix, assembly-order assertion, verdict matrix, report rows, empty-work-order suppression) plus the reworked picker test asserting sections, the merged postPrompt, persona files. UI copy keys for the removed directory entry deleted both languages; docs reversed in design_zh (two entries), mapping (§5.1 WORLD-INFO semantics corrected — ST rewrites entry content at injection, not matching), and the work-order recipe.
