# Third-Party Notices

This project (MIT, see [LICENSE](LICENSE)) installs, snapshots, and redistributes a few third-party pieces. They are listed here by redistribution shape.

## Upstream dsh host packages (installed, not vendored)

`@deepseek-ai/dsh`, `@deepseek-ai/dsh-base`, `@deepseek-ai/dsh-web-app`, and their `@deepseek-ai/cordis*` dependency tree are MIT-licensed by DeepSeek AI ([deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)). They are installed through npm; each package carries its license copy in `node_modules`.

## Vendored source snapshots (redistributed, test-loop only)

`packages/vendor-ui-chat`, `packages/vendor-ui-renderer`, and `packages/vendor-ui-session` are **source snapshots** of `@deepseek-ai/dsh-client-ui-chat` / `-ui-renderer` / `-ui-session`, taken from [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) at commit `078257c` (extraction 2026-09-17, recorded in each snapshot's `package.json`). The published tarballs ship no node-importable client plane, so the ui test loop resolves these sources instead. They are MIT (upstream license), not published, and not loaded by any host composition.

## SRD 5.1 lorebook (redistributed, within the `dnd5e` example preset)

`tavern_presets/dnd5e` ships a rendered lorebook (spells, monsters, rules, equipment, …) built from the System Reference Document 5.1. Source data was vendored as JSON from [5e-bits/5e-database](https://github.com/5e-bits/5e-database) at commit `3b124d8` (2026-09-12); the builder `tavern_presets/dnd5e/assemble.mjs` keeps the provenance pinned and carries the same attribution header. Files under `preset/setup/dnd5e-srd-lorebook/` are an **adaptation** — the source JSON rendered into Markdown with an added machine-readable frontmatter layer; rules-reference docs under `tavern_presets/dnd5e/docs/` quote SRD 5.1 under the same attribution.

License: SRD 5.1 © Wizards of the Coast LLC, under OGL v1.0a / Creative Commons Attribution 4.0. **This corpus is distributed under CC-BY 4.0, not under this project's MIT license** — the MIT license covers this project's own code only. The required attribution for distributed copies of this corpus:

> This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/system-reference-document, licensed under the Creative Commons Attribution 4.0 International License.

## Example-preset assets

Example-preset images (the `dnd` / `dnd5e` covers and the `芙宁娜` avatar) are made for this project (AI-generated).
