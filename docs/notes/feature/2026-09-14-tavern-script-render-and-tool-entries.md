# Agent Note: Tavern card scripts render once at their consumer and every tool script becomes a first-class entry

Status: implemented

English | [中文](2026-09-14-tavern-script-render-and-tool-entries.zh.md)

## Problem

After the wrap swap to submission-time composition, `renderCardTexts` still rendered the prefix/post files at every assembly and discarded the result — the card's `{{script}}` templates re-ran their bash per request for nothing, and `get_state.sh` executed at least twice per request (once dead, once at submission). The `maintenancePrompt` never rendered at all: `startTail` passed the raw file text as the fork prompt, so `{{script}}` reached the model verbatim. The card's `preset/tools/` scripts had no model-visible contract of their own: one generic `executeTools{tool, args}` entry carried every script, with usage taught only by free-text `-h` output in the system prompt.

## Decision

**Every prompt file renders exactly once, at its only consumer.** `renderCardTexts` narrows to `{system, toolBrief}` — the prefix/post pair renders solely in `renderWrapPair` at submission. The maintenance prompt renders in the tail child's pre-step gate: the fork starts synchronously with the RAW prompt (required-service property access is only legal inside the turn-end event dispatch window — after an await it throws `inactive context`), and the child's claimed maintenance message has its placeholders resolved once, archived with the child session's durable claim. The main agent's claims never enter that branch (origin-stamp check), so player text with literal braces passes through untouched.

**Every `preset/tools/*.sh` script registers as its own tool entry.** A `# @tavern-schema` marker block in the script's leading comments (JSON `description` + `parameters`, parsed without executing the file) gives the entry named parameters validated through `parameterSchemaSpecToJsonSchema` — a block that fails to parse or validate throws at registration, which is session-creation time for a shipped card and that request's assembly for a mid-session edit. A script without a block gets a generic `{args}` entry (the retired `executeTools` escape hatch, per script), and the tool-brief section narrows to schema-less scripts so no tool is described twice. A schema'd script receives its whole argument object as ONE JSON string (`$1`, POSIX single-quote escaped); positional mapping was rejected because omitted optional parameters would shift every later argument.

**The tool face re-syncs at engine mutation points, with the assembly probe as the net.** The kernel collects the request's tools array BEFORE the assemble waterfall fires, so a registration made inside the waterfall is one request late. The engine therefore calls the syncer returned by `registerMainAgentTools` at every preset mutation (import, draft, cancel, `writeText` hitting `preset/tools/`, `fileOp`), making the change visible on the current request; the per-assembly directory probe (readdir + mtime, dispose/register on diff) covers out-of-band writes one request later.

**Render runs get one minute, no tavern-layer output cap, and a stop path.** `SCRIPT_TIMEOUT_MS` is 60 s; the 8 KB cap is gone (the executor's configured output bound — bash-local defaults to 64 KB — remains the deployment-level limit). `renderPlaceholders` returns the text plus structured `ScriptRenderFailure` entries (missing / exit / timeout / abort) while keeping failed placeholders verbatim; the submission path returns them as `scriptFailures` on the prompt RPC result and the client toasts the failed names. The submission signal and the assembling turn's signal thread into `shell.run`, so a cancelled submission or aborted turn kills its running scripts.

## Alternatives considered

- **Keeping `executeTools` as the escape hatch for mid-session script additions**: rejected — with every script an entry, the generic path only duplicated real entries; the mutation-point sync removes the freshness gap that motivated it.
- **A `<name>.schema.json` sidecar per tool**: rejected — a second file per tool for data that a comment block carries just as well, and two artifacts to keep in step.
- **Rendering the maintenance prompt in the engine before `subagents.start`**: rejected by mechanism, not preference — the render awaits real shell work, and the required-service access after that boundary throws `inactive context`; the fork must start synchronously inside the dispatch window.
- **A scoped pre-step listener on the tail child's own ctx**: attempted and reverted — the listener registered but its `await next()` never resolved, deadlocking the waterfall; the engine's global gate listener (proven in every tail's chain) hosts the render instead.

## Consequences

The wire gained one result field (`scriptFailures`), so the typert host manifest and the api-tavern client bundle were regenerated in the same change. The loader-composition fixture now runs real bash — which exposed that its composition registered the ABSTRACT `SubprocessRuntime` (no `spawn`) where production uses `@deepseek-ai/dsh-subprocess-local`; the test composition and the tavern devDependencies were corrected. A failing card script no longer fails silently for the player: the submission toast names the failed placeholders, the host log carries the system-prompt and maintenance-path failures (no client surface exists mid-request), and the model still sees the verbatim placeholder either way.
