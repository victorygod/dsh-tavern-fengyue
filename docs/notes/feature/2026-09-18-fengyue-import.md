# Agent Note: fengyue card import (st-import's second dialect)

Status: implemented

[中文](2026-09-18-fengyue-import.zh.md)

## Problem

The import surface only understood the SillyTavern ecosystem (V1/V2/V3 PNG-tEXt
cards + legacy DSH `pre_prompt` exports). A fengyue card (catai.wiki ecosystem)
has entirely different JSON field names and prompt segmentation — routed into
the ST normalizer today, its `pre_prompt` folds away as a legacy DSH post
instruction, the HTML `description` gets crushed into a one-line intro, and
`world_book` is ignored outright.

## Decision

**`st-import.ts` goes bilingual-dialect: after the JSON container probe, cards are
routed by signature; fengyue cards fold through the dedicated `foldFengyueCard`.**
Detection signature: any of `pre_text` / `post_text` / `world_book` present
(legacy DSH exports only carry the `pre_prompt` / `post_prompt` pair; ST uses
`character_book` / `world` — the three dialects have zero overlap;
`isFengyueCard` is exported and unit-testable).

Mapping table (user's spoken contract + mechanical landings):

| fengyue field | our landing |
|---|---|
| `pre_prompt` | `preset/prompt/systemPrompt`, verbatim |
| `pre_text` + `post_text` | `preset/prompt/postPrompt` (joined `\n\n`; `{{lorebook()}}` heads it when a world book exists — reusing the ST fold's lorebook pair) |
| `world_book` | `preset/lorebook.json` + `preset/scripts/lorebook.mjs`: keys parsed from `_or_-prefixed @wb@-separated` strings into the keys array; each entry verbatim rides the `fy` slot (the ST entry's `st` slot counterpart); the `key_region` bitmask (**1=system, 2=user, 4=assistant**, the user's spoken contract) folds into each entry's `scan.kinds` — the match surface is "the latest message among those kinds" (during a send, the latest user row is the engine's pre-projected current input; see chat-snapshot's pendingText ordering) |
| `description` | `preset/setup/opening.html` — a self-drawn HTML opening page is exactly our card-authored opening slot (dnd card's shape), rendered in the sandboxed iframe |
| `opening_statement` + `suggested_questions` | `preset/greetings.json` (opening option buttons) |
| `name` / `summary` | `meta.json` title / desc (summary collapsed to one line, same shortDesc as ST) |
| `cover` | remote URL fetched by the importing browser (catai.wiki's live server verified: `access-control-allow-origin: *`, `image/jpeg`); magic-byte sniffing picks the extension (the engine's asset allowlist is extension-keyed); any failure never blocks import — a report row + the identity header's manual upload is the fallback |
| persona scaffold, maintenancePrompt | same standard seeds as the ST fold (`persona.mjs` + `setup/persona.md`, empty maintenance) |

**lorebook.mjs v1.5 dual match surface**: entries carrying `scan.kinds`
(fengyue) match against the latest message of those kinds; entries without
`scan` (ST) keep the last-N-rows joined window (argv[0] tunable, default 12).
For `value_region` (injection position) the user ruled **no separate seat** —
hit content always injects at postPrompt's `{{lorebook()}}` slot, with one
volume-row note.

**Fields with no counterpart land in the import report**
(`preset/st-import/README.md`, fengyue flavor): the system bit (our snapshot
carries no system rows, so it never matches), `key_region` falling back to the
default user+assistant, `_and_` combination keys (folded as OR, degradation
reported), `group` grouping, `banned_words`, `cg_book`, `shortcut_commands`,
`preset_chats`, and the count of entries filtered for missing keys or empty
content. The fengyue mapping is fully mechanical — no
translation TODO list, the report is the whole story; deleting the directory
marks it read. The synchronous fold path (`importFromJson` called directly)
never issues network requests; a URL with no bytes lands as a cover-not-
delivered report row.

## Alternatives weighed

- **Fold the world book into the systemPrompt constant section**: rejected —
  fengyue entries are all keyword-triggered (`_or_` multi-key); pushing six
  multi-KB entries into the system prompt wholesale throws away the trigger
  mechanism, and the near-scan lorebook pair already exists.
- **Crush `description` into `meta.desc`**: rejected — it is a complete HTML
  opening page (13k, with styles); one-lining it leaves noise. `opening.html`
  is lossless.
- **Leave the cover to manual upload**: rejected — catai's live server allows
  CORS, so the fetch is free; failures already carry a fallback row.
- **Include `pre_prompt` in the detection signature**: rejected — collides with
  legacy DSH exports (that route is pinned by existing tests).

## Consequences

The entry point was renamed `parseSillyTavernCard` → `parseTavernCard`
(bilingual-dialect reality; TavernView and the spec follow, both call sites).
Zero UI changes: the file picker already accepts `.json`, and the preview
panel plus the `commitImport`/`writeAsset` cover-landing chain are reused as
is. 40 UI cases green (the fengyue cover URL is emptied under jsdom to stay
offline). The real card 战争模拟.json passed a full-text smoke: all 6 world-book
key lists parse correctly, the 13,041-char opening page lands, and the
postPrompt three-segment merge is as specified. Same-day second draft: the
key_region bitmask semantics landed (scan.kinds + the latest-message match
surface, verified end-to-end in a scratch runtime — an entry whose key only
appears in an older assistant row no longer fires).
