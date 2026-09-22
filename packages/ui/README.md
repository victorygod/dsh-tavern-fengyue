---
description: "The tavern browser surface: a root-slot game page with session sidebar, card library, opening page, narrative transcript, and a projection-fed composer, for maintainers of the tavern UI."
kind: "package-reference"
---

# dsh-tavern-fengyue-ui

English | [中文](README.zh.md)

## Summary

`dsh-client-ui-tavern` draws the tavern game page in the browser: it shadows the built-in `root` slot at lower priority, so on the `tavern` profile this page replaces the stock web chrome entirely. The page covers the session sidebar (workspace rows with cover images and last-line previews), the in-place card library and import flows, the opening page, a narrative transcript with collapsible think/tool/bookkeeping rows, and the composer — model seat, context ring, and the one-line usage strip fed by host projections. You meet it only on the tavern profile.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

Nothing to configure and nothing to import: the profile composes the row, the page mounts itself, and all services resolve inside the component body after the boot audit.

## Understand the implementation

- **[TavernApp.tsx](./src/client/app/TavernApp.tsx)** — the page: key dialog on demand (send pre-flight, `MISSING_CREDENTIAL` rows, the sidebar entry), save dialog, settings modal, and the chat view with the tail gate, two-level model menu, the ↻ retry flow (retryPoint → prompt re-send → session switch), load-restore of the composer draft, and the Esc shortcuts (stop / close dialog; double-Esc clears the composer or opens the load page). The default opening page renders the `preset/greetings.json` options (a click fills the composer, never sends; missing file or bad JSON silently falls back to title+desc).
- **[chat-view.tsx](./src/client/chat-view.tsx)** — the transcript facts, composer, and bottom-pinned scroll both chat faces render through (RP chat and the writer column). Each user/narrative line carries a fixed-space actions row (copy with check-swap feedback, plus the ↻ retry on the last reply) that reveals on hover like the stock web UI.
- **[TavernView.tsx](./src/client/TavernView.tsx)** — the card library, import preview, draft editor, and the unified workspace editor whose context menu omits rename/delete on fixed paths. The identity header's inline title/desc editing carries the creator · version credit line and saves field-faithfully (unedited meta fields — `tags` etc. — never vanish on an edit).The import entry runs the `st-import.ts` parser: .json/.png container probing, V1/V2/V3 normalization, and the five-way fold (systemPrompt sections / lorebook.json / greetings.json / meta / translation work order + import report); the directory-import entry is gone.
- **[rpc.ts](./src/client/rpc.ts)** — the typed face over the generated namespace, unwrapping every `RemoteResult` envelope uniformly.
- **[card-ui.ts](./src/client/card-ui.ts)** — loads the bound card's `preset/ui/` presentation pack (theme.css / chat.css / layout.json / index.js) and mounts it outright: installing a card already grants host-level trust, so no consent dialog. `chat.css` is selector-prefixed into `.tavern-stage` after the CSS guard; `theme.css` is NOT injected here — it is returned as `themeCss` for the themes.ts sheet.
- **[themes.ts](./src/client/themes.ts)** — the theme system: three built-in token sets (parchment, dsw light, dsw dark — colors and font stacks, resolved from the dsh web UI design tokens) applied as the one `#tavern-theme` stylesheet on the `.tavern-root` hook. The header's top-right select (chat and library pages alike) picks card theme or a built-in (persisted in `tavern.ui.theme`, localStorage); a built-in choice replaces the bound card's `theme.css` outright, `card` folds it in behind the parchment base.
- **App.module.css** — a 1:1 module conversion of the prototype's stylesheet ([docs/tavern-prototype](../../../docs/tavern-prototype/design_zh.md)); colors and fonts are `--t-*` token reads, no literals — themes.ts owns the declarations.

## Dev Note

Every service resolves inside the component body: slot callbacks run during the loader's dynamic phase, when sessions/remote may not be activated yet — reading them at apply time silently loses the whole page.

## Model Experience

Indirectly, through the sessions binding and the tavern engine: the page displays and queues turns but never assembles a request itself.

#### KV Cache effect

None — the page adds no request prefix; the engine owns any cache effect.

## Known Limitations and Deferred Work

No invariant companion is published: the browser surface holds no state of its own — every value is an rpc or projected read, and the wire shapes are pinned per-method by the spec fakes.

- **Projection consumers degrade to zeros** — without the token-meter and session-stats projection units the usage strip reads all zeros and the context ring stays empty; the page treats absent capability as a placeholder, never an error.
- **Theme choice is browser-local** — the settings-page theme selection persists in `tavern.ui.theme` (localStorage); it does not follow the card or the account, and a fresh browser starts on `card`.
- **Card covers stay parchment art** — the library cover gradients (tint0-3) and their white overlay text/alphas are deliberately literal: they are card artwork, not themable chrome.
- **`FIXED_PATHS` mirror** — the menu's fixed-path list mirrors the engine's policy and must move with it.
- **Last-line previews ride localStorage** — the sidebar's per-session last line derives from a local cache and can be empty on a fresh browser.
- **Session list covers workspace rows from disk** — the sidebar renders `workspaces()` disk rows, so a workspace whose session is not running shows its card without live transcript state.
