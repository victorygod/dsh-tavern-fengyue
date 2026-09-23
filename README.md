# dsh-tavern-fengyue

English | [中文](README.zh.md)

[![dsh-plugin](https://img.shields.io/badge/dsh--plugin-plugin-2b6cb0)](https://github.com/topics/dsh-plugin)

**Tavern Fengyue (DSH)** — an RPG character-card engine running on the [dsh](https://github.com/deepseek-ai/deepseek-harness) host, with direct support for importing SillyTavern preset cards.

This project aims to guide the development paradigm for tavern-style agents in the agent era: tavern-like applications should stand on mainstream agent infrastructure, not on a bespoke DSL stack.

## Table of Contents

- [Design Principles](#design-principles)
- [Features](#features)
- [Quick Start](#quick-start)
- [Workspace Layout](#workspace-layout)
- [SillyTavern Card Import](#sillytavern-card-import)
- [Docs](#docs)
- [Contributing](#contributing)
- [License](#license)
- [Disclaimers](#disclaimers)

## Design Principles

**LLM handles reasoning; everything else runs as a script.**

The division of labor, layer by layer:

| Layer | What it does |
|---|---|
| **LLM** | Narrative prose (creative writing) · Semantic updates to changing values (character mood, scene, state) |
| **Scripts** (`preset/scripts/*.mjs` / `preset/tools/*.mjs`) | Dice rolls, pathfinding, HTML rendering, panel styling, state machines — all deterministic logic |

SillyTavern raises the learning curve for both players and card authors — players face regex injection, world info, and injection depth; authors need to master multiple bespoke DSLs just to build a card with real functionality. This project folds everything back into traditional scripts:

- **ST configuration languages retired** — regex, STScript, world info, and macros all become local `.mjs` scripts; ST's multi-source depth injection (each source re-injecting its own prompt into the same context every turn) becomes a single live `postPrompt` per turn, paired with dsh's built-in automatic context compression. In the agent era, reuse the agent infrastructure that already works — don't reinvent wheels.
- **Context structure reuses the mainstream agent paradigm** — `systemPrompt` (fixed) + compressed history + pure-append dialogue + latest user message + per-turn dynamic `postPrompt`.
- **Workspace as memory** — `runtime/` IS an llm-wiki: a standing root index + detail archives fetched on demand; no vector DB, no RAG, no plugin black boxes — retrieval, long-term memory, and skills all live as scripts and local files.
- **Built-in card authoring agent** — player interaction stays at "pick a card + chat"; the author's learning cost shifts to the AI, which writes the scripts and config; this two-way convergence forces the concept system to stay lean.
- **Tools and local files first** — modern agent architecture's external memory + tool-calling pattern; not bespoke frameworks.

**Breaking the traditional impossible triangle.** "Rich functionality / low comprehension cost / token cost" are at odds in the traditional ST framework. This project collapses every concept into the system framework itself, and all three improve at once:

- **Near-unlimited functionality** — flexible scripts can carry almost any logic, unconstrained by pre-defined concept sets
- **Extremely low comprehension cost** — players see only cards and chat; authors let the AI write the configuration, no need to learn proprietary DSLs
- **Significantly lower token spend** — a fixed context structure boosts prefix-cache hit rates; state lives on disk maintained by the tail agent, not re-emitted every turn by the model

## Features

- **Minimalist UI** — pick a card + chat, that's it; advanced customization relies on the built-in agent
- **Direct SillyTavern / Fengyue card import** — `.json` / `.png`; world info auto-converts to `lorebook.mjs`, regex to scripts, complex logic translated by the agent with a full report — nothing silently dropped
- **Tail agent** — after each narrative turn, state changes are written to `runtime/` so the frontend renders panels directly, without the model burning output tokens repeating static state
- **Auto/manual save** — keeps last 10 world snapshots (chat history + model context + local files) on every send, roll back anytime
- **Cross-platform** — all scripts run on Node.js

## Quick Start

**Prerequisites**: Node.js ≥ 22.19 or ≥ 24, pnpm (`npm i -g pnpm` or `corepack enable`).

**Compatibility**: verified against `@deepseek-ai/dsh` **0.1.5-rc.1** and **0.1.5-rc.2** — the list lives in [`config/dsh-compatibility.json`](config/dsh-compatibility.json), and `pnpm bootstrap` installs the newest verified version into the profile. Upstream dsh is in developer preview with breaking changes expected; if a newer dsh breaks the tavern profile, re-run `pnpm bootstrap` to restore the verified profile, or follow the external-install fallback in [docs/release/independence-and-release.zh.md](docs/release/independence-and-release.zh.md).

### How this is distributed

This repository **is** a DSH profile project: it declares the `tavern-fengyue` profile and its bundle layer in [`package.json`](package.json), and every package under [`packages/`](packages) is built from source. **Install from source today** — the steps directly below.

The same bundle is being prepared for the standard dsh plugin channel (published to npm as `dsh-tavern-fengyue` plus its three sibling packages, then installed per profile with `dsh plugin add`). That path has not been rehearsed end to end yet, so this README deliberately does not document it until it is.

### Install and run from source

In the project directory:

```sh
pnpm install       # required after cloning — a checkout ships no build output
pnpm build
pnpm bootstrap     # registers this checkout as the `tavern-fengyue` profile
pnpm tavern        # starts the host; Ctrl-C stops it
```

`pnpm tavern` runs the host this repo pins as its own devDependency
(`node_modules/@deepseek-ai/dsh`), so **a globally installed `dsh` is not required**. It keeps
its own harness home (`~/.dsh-tavern-fengyue`), which leaves any existing `~/.dsh` untouched.
Set `DSH_HOME` to relocate that home, and re-run `pnpm bootstrap` afterwards.

### Daily Use

Run `pnpm tavern` again from this checkout. Both the profile's packages and the host come from
here (they are `link:` dependencies), so after a source edit `pnpm build` is all it takes — the
profile re-applies the bundle layer live.

To drive the same profile with a globally installed `dsh` instead, that host has to read the
home the profile was written into:

```sh
DSH_HOME=~/.dsh-tavern-fengyue dsh --profile tavern-fengyue               # bash / zsh
$env:DSH_HOME="$HOME\.dsh-tavern-fengyue"; dsh --profile tavern-fengyue   # PowerShell
```

(Or put the profile in the host's default home from the start: `DSH_HOME=~/.dsh pnpm bootstrap`.)

### First Play

1. Set your API Key in the sidebar "API Key" (or set `DEEPSEEK_BASE_URL` / `DEEPSEEK_API_KEY` for a self-hosted / proxied endpoint)
2. Click "＋ New Tavern Session" → pick a card / import an ST card / start from a blank skeleton with the AI writing agent
3. Each turn: model narrates → tail agent bookkeeps → panel refreshes itself
4. Header "Save / Load / Reset" freezes or restores this world at any point

Stop: Ctrl-C in the host terminal; `pnpm stop` under background mode.

## Workspace Layout

Each session creates `tavern_workspace/<timestamp>/`:

```text
<workspace>/
├── preset/              ← card source (persists across sessions)
│   ├── meta.json        card metadata
│   ├── prompt/          systemPrompt / postPrompt / maintenancePrompt
│   ├── setup/           initial-state template
│   ├── scripts/         {{script}} template scripts
│   ├── tools/           main-agent CLI tools
│   └── assets/          media files
├── runtime/             ← live state (tail agent maintains)
└── savings/             ← save snapshots (runtime backups)
```

Everything that enters the model's context is a local file you can open and audit — this IS the memory system of the whole project.

## SillyTavern Card Import

On import, world info folds into `lorebook.mjs`; regex, STScript, and community-derived extensions (such as the MVU variable-update convention) land in `preset/st-import/` with a translation report — capabilities preserved, concepts consolidated. Full mapping: [sillytavern-mechanics-and-import.zh.md](docs/cards/sillytavern-mechanics-and-import.zh.md).

**On MVU**: the framework fully supports the MVU paradigm, but we recommend replacing it with a named tool from `preset/tools/` — a tool call can narrate, mutate the state, and return the freshly updated value in one turn, weaving state reads/writes naturally into the narrative flow. If you want to keep MVU's "inline variable-update directive written into narrative" paradigm specifically to avoid tool-call interruption, the framework's hook scripts + frontend JS presentation layer fully support that path too.

## Docs

Deep-dive docs live in [`docs/`](docs/) — organized by area, currently Chinese-first; an English pass follows once the set is reorganized. See the [docs index](docs/README.md) for the full map:

- [Design](docs/architecture/design.zh.md) · [file tree](docs/architecture/file-tree.zh.md) · [scripts & tools](docs/architecture/scripts-and-tools.zh.md)
- [Card hooks](docs/cards/card-hooks.zh.md) · [SillyTavern mechanics & import](docs/cards/sillytavern-mechanics-and-import.zh.md) · [field map](docs/cards/st-card-field-mapping.zh.md)
- [Dynamic post injection](docs/runtime/dynamic-post-injection.zh.md) · [autosave & retry](docs/runtime/send-moment-autosave-and-retry.zh.md) · [tail-session archive](docs/runtime/tail-session-archive.zh.md)
- [Keyless testing](docs/testing/keyless-testing.zh.md) · [mock-LLM testing](docs/testing/mock-llm-testing.zh.md)
- [Independence & release](docs/release/independence-and-release.zh.md)

`docs/notes/` holds dated decision/bug-fix notes plus the chronological [devlog](docs/notes/devlog.zh.md) — a historical record; on conflict, the code and READMEs win.

## Contributing

PRs welcome — see [CONTRIBUTING.md](docs/CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). `pnpm lint`, `pnpm build`, and `pnpm test` must pass before review (CI runs the same on Ubuntu / macOS / Windows).

## License

MIT for this project's own code — see [LICENSE](LICENSE). Upstream DSH packages keep their own licenses; vendored snapshots and the SRD 5.1 corpus (CC-BY 4.0, not MIT) are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Disclaimers

- **Not affiliated** — DeepSeek / DeepSeek Harness, SillyTavern, Dungeons & Dragons / SRD (Wizards of the Coast), and Genshin Impact (HoYoverse) are products of their respective owners. This independent project is not affiliated with, endorsed by, or sponsored by any of them; names are used for identification and interoperability only.
- **Content is the card's, not ours** — the engine runs whatever card you author or import. Imported community cards speak for their authors; this project does not vet, endorse, or curate card content, and responsibility for restricted content lies with the importer under their local rules.
- **As is** — provided without warranty under the MIT license. Example-preset imagery is AI-generated, as labelled in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
