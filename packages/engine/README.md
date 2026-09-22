---
description: "The tavern world-card engine: per-session preset/runtime/savings workspaces, card prompt assembly, the panel-maintenance tail agent, and the runtime tool family, for maintainers of the tavern profile."
kind: "package-reference"
---

# dsh-tavern-fengyue-engine

English | [中文](README.zh.md)

## Summary

`dsh-tavern` is the host engine of the tavern (SillyTavern-style) profile. Each tavern session owns one workspace directory: `preset/` holds the card's fixed content, `runtime/` holds the live world state, and `savings/` holds one snapshot directory per save. The engine assembles the card's prompt files into sections, registers the card's tool scripts for the main agent, and runs the tail agent — the 面板维护Agent — as a fork that rewrites `runtime/` between turns. You rarely touch this package directly: `dsh tavern` composes it, and the browser half (`dsh-tavern-fengyue-ui` over `dsh-tavern-fengyue-api`) is its only other consumer.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

The engine mounts on the `tavern` profile through `packages/bundle/tavern`; nothing to install by hand. Its `Config` (settable from cordis.yml) has five fields: `workspaceBase` (default `tavern_workspace`), `libraryBase` (default `tavern_presets`), `autosaveKeep` (default 10 snapshots per session), `editReadCap` (default 10 MB per editor read), and `editWriteCap` (default 10 MB per decoded editor asset write).

## Understand the implementation

- **Workspace layout and the card** — [workspace.ts](./src/workspace.ts) creates the skeleton, imports cards (directory, SillyTavern JSON, in-place draft), seeds `runtime/` from `preset/setup/`, snapshots to `savings/`, and enforces `FIXED_PATHS`: the area roots, the skeleton directories, `preset/meta.json`, and the four prompt files may be empty but are never removable or renamable. Cover uploads land through `writeAsset` — base64-decoded, extension-allowlisted (the read path's MIME table), byte-capped, and fenced under `preset/`. Autosave rows carry read-local timestamps to the second (`autosave-2026-09-14-01:22:28`, numeric suffix on same-second collisions); save rows order by directory write time, so name-shape eras never skew the autosave ring. Every stamped save (manual and auto) records its summary and its composer draft — for an autosave both are the submitted message, because the engine stamps each save at the SEND moment (after the tail gate, before the message lands): the snapshot is the pre-send world, and `retryPoint` rebinds to that boundary to re-send the preserved text. Manual saves stamp the on-screen draft instead and never qualify as retry points. The ledger also surfaces both fields on the save row. The meta contract carries optional `creator` / `version` / `tags` identity fields (tolerant parse: absent unless well-typed and non-empty — older three-field metas read unchanged); the client save-back merges the edited identity over the file's raw JSON, so unedited fields survive every identity edit.
- **Prompt assembly** — [prompting.ts](./src/prompting.ts) turns the card's `preset/prompt/` files and `{{script}}` templates into prompt sections, with a per-turn pre-render cache at section boundaries.
- **Tool faces** — [tools.ts](./src/tools.ts) registers every `preset/tools/*.mjs` script (node module) as its own main-agent tool entry: a `@tavern-schema` block comment (JSON `description` + `parameters`) names the parameters, delivered to the script through the global `args` object, while a script without a block gets a generic entry whose parameter string arrives as the `argv` array. The engine re-syncs the face when preset mutations land and re-probes at each assembly; the tail fork gets the read pair plus the write face on its own scoped context: `runtimeWrite` (create or fully replace a document) + `runtimeEdit` (exact old_str→new_str replacement with replace_all) + `runtimeDelete` (hard-fenced to runtime/, .json mutations parse-checked on the RESULT). The read pair and the write pair declare parallel-safe — the kernel pool runs same-step calls concurrently, and the write pair serializes same-path mutations through a per-path chain.
- **Lifecycle** — [index.ts](./src/index.ts) maps sessions to workspace roots (persisted in `.tavern-session`, rebuilt at boot), gates `agent/pre-step` behind the in-flight tail run, stops a session's in-flight activity through `stop` (the active turn cancels with its pending inbox preserved, the tail fork's child cancels through its parent stamp, and a running card-tool bash dies through the forwarded execution signal), and serves the whole surface the remote namespace exposes. The card-writing agent session (persisted in `.tavern-writer`, rebuilt at boot) composes as a default dsh agent — product sections and tool face intact — plus the scoped `tavern:writer-guide` section, a guard denying the shell and delegation families' EXECUTION (their schemas stay visible; a denied call returns an isError tool result), and approval policy `never`.
- **Seed ledger reconciliation** — [inbox-repair.ts](./src/inbox-repair.ts) cancels inbox-queue entries a fork's seed cut severs: a message the player queues before the cut comes along as a commit whose claim lands outside the seed, and the child would otherwise replay it as its first turn (载入's "rolled-back message re-sent"). Before each child's first claim the engine appends durable cancellations — scoped to the seed region, keeping source-still-pending input (`livePendingIds` of the fork source) and never touching own-region deliveries such as the tail's maintenance prompt.

## Dev Note

Editor file operations run on the host fs directly: the `dsh-fs` capability exposes text read/write but no removal or move ops, and none of these paths are model-facing. The tail fork derives from the main agent at first turn, so card edits to the maintenance prompt reach the fork only on the next session.

## Model Experience

### Card prompt sections and template scripts

#### What the model sees

The card's `systemPrompt` and `postPrompt` files verbatim, plus `{{scriptName(args)}}` placeholders expanded to the stdout of the node script `preset/scripts/<name>.mjs` run with the session's `runtime/` as its working directory; a failed script leaves the placeholder in place. Each claimed player message is admitted as the bare text, followed by ONE dynamically injected post message: the rendered `postPrompt` body rides the pre-step waterfall as a plugin-attributed user message, and the previous turn's post is shadowed in position by an empty-content system node — history stays plain u/a turns with exactly one live post. The tail fork inherits that same one-post view plus the card's `maintenancePrompt` verbatim as its persona section.

#### Token effect

Direct and data-dependent: the three prompt files count once per request, script output counts in place of each placeholder, the live post message counts once per request, and the maintenance prompt counts once in the fork's request. Larger cards grow every tavern request.

#### KV Cache effect

The prompt sections are prefix-stable within a turn boundary cache; per turn the view diverges after the previous claim (the old post's position empties, the new one appends at the tail), so reuse tops out near the last player message — accepted at the 2026-09-16 design decision. A script that reads `runtime/` re-renders its segment when the state changes, replacing earlier request tokens at the same position.

### Tool surfaces

#### What the model sees

One entry per `preset/tools/*.mjs` script — named parameters for scripts carrying a `@tavern-schema` block, a generic `argv` array otherwise (single command-line string in `argv[0]`) — plus the six `runtime*` operations, described in their schemas; full argument text lives in the definitions in [tools.ts](./src/tools.ts) rather than a generated catalog entry.

#### Token effect

Two fixed schema blocks (the runtime read pair) plus one per card tool script, so the count scales with the card's own tool set.

#### KV Cache effect

Append-only at conversation start and prefix-stable afterward; editing a card does not rewrite already-sent schemas.

## Known Limitations and Deferred Work

No invariant companion is published: every tavern observation (session binding, card state, saves) derives from the one `TavernRuntime` workspace table and disk, so independent observations cannot diverge.

- **Client bundles refresh on restart** — the modules server snapshots `lib/client.js` at process boot; a rebuilt bundle reaches the browser only after `pnpm dsh tavern` restarts.
- **`FIXED_PATHS` exists twice** — the engine owns the policy; the client keeps a copy only to shape the context menu, and the two must move together.
- **清空 rebinds, never rewrites** — `reset` keeps the append-only log intact: the workspace binds to a fresh session (empty history, `runtime/` re-seeded, `savings/` kept) while the old session's durable log stays archived unbound.
- **The bookkeeping row survives refreshes** — the row comes from the owner log's durable `subagent/catalog` (one per fork); the expanded body (tool calls, closing text) derives lazily through `tailTranscript` from the child's own log — live children via the registry, archived ones via the `sessionQuery` cold read (without it the status is honestly `'archived'`).
- **Card scripts are node modules (`.mjs`)** — executed through a shell-neutral `node -e` data-module runner (script + args base64), so the same bytes run on every platform; execution failures surface through `scriptFailures` (never silent). Save naming itself is a pure-dash format (`autosave-YYYY-MM-DD-HH-MM-SS-mmm-N`), safe on every filesystem.
- **Wrap-era tags linger in old logs** — sessions recorded before the dynamic-post injection (2026-09-16) carry tagged instruction blocks inside their durable player messages; the anchored browser strip (`wrap-markers.ts`) stays as a display shim so those logs stay readable. Change it only when rescoping the historical composer pattern itself.
- **Retired `prefixPrompt` files are dead data** — cards authored before 2026-09-16 may still carry a non-empty `preset/prompt/prefixPrompt`; the engine never reads it. Merge its content into `postPrompt` by hand and delete the file.
- **Empty-system shadow nodes accumulate** — each injected post shadows its predecessor with an empty-content `system/message` event (a few dozen bytes per turn) that projects to nothing on the wire; trajectory-style debugging views show them as empty rows.
- **NEW agent events need resolver regeneration** — adding an agent-subject event anywhere requires `pnpm run gen-scoped-events` to refresh `packages/core/scope/src/scoped-events.generated.ts`; `verify-scoped-events`/`test` catch the miss.
