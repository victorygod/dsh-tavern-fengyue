# Agent Note: The tavern card-writing agent column

Status: implemented

English | [中文](2026-09-14-tavern-writer-agent-column.zh.md)

## Problem

Card authors edited the card only through the file editor. The design (edit-page-identity-and-writer-agent_zh.md ②) adds a normal dsh agent conversation pinned to the current workspace as the editor page's third column — but a second session per workspace must not be composed as a card agent, must not break the `FIXED_PATHS` invariant, and must not hang on approvals the shadowed UI cannot render.

## Decision

**A third composition branch on a second map.** `ensureWriter` lazily creates a NORMAL dsh session (`sessionController.create({cwd: workspace root})`) recorded in a `writers` map and persisted as `.tavern-writer` (restored by the boot scan). The session never enters the `workspaces` map — `onAgentCreated`'s branch order (main → tail → writer) keeps the branches mutually exclusive, and the writer composes as a default dsh agent: product sections and the inherited tool face intact, plus exactly three scoped additions on its own `agent.ctx` — the `tavern:writer-guide` section (workspace layout facts, card-tool `@tavern-schema` conventions, current card identity), a guard denying the shell and delegation families (`bash`, `pwsh`, `subagent`, `send_message`, `interrupt_agent`, `list_agents`, `list_subagent_models`, `job_output`, `job_kill`), and `setApprovalPolicy('never')`.

**The guard denies execution, not visibility.** A per-agent guard cannot remove a tool from the model-visible face, and no per-path veto exists for subprocesses — so the fixed-template-paths invariant is held by denying shell EXECUTION: the model sees the inherited bash schema, an out-of-bounds call returns an isError tool result carrying the denial, and the turn continues. Delegation is denied for the same reason the shell is: a delegated child re-enters `agent/created` with the full default face, and a per-agent guard does not propagate.

**One shared conversation surface.** The transcript line rendering, composer (model seat, context ring, send/stop, usage line), and projection reader moved from the RP chat into a shared module; the RP chat and the writer column consume the same implementation, so stock-parity updates land with one edit. The writer sends through the standard client face (`binding.session.prompt`) — the tavern `prompt` RPC is the wrap-pair path — and stops through `binding.session.cancel` (the engine's session-level `stop` is RP-specific: card-tool subprocesses and tail forks).

## Alternatives considered

- **`tools.restrict({allow})` instead of a guard**: removes the shell schemas from the model's view but freezes the writer's face at today's allowlist — future product tools would silently never reach it. A guard denies execution while inheriting whatever the product face becomes.
- **A fork for the writer (the tail's shape)**: forks are one-shot and seeded; the writer is a persistent, interactive conversation bound to the workspace across 清空/载入/编辑 rebinds.

## Consequences

The writer's `{{script}}` guide text is brace-free by construction — a literal `{{name}}` in a section hits the kernel's strict interpolation layer and throws (the card prompts survive only because the main/tail assemble listener renders placeholders first; the writer has no such listener). Agent-driven file edits reach the editor through a 2-second poll (tree structure, meta.json, and the open file's content re-read only while the textarea is unfocused); editor-RPC writes to `preset/tools/` resync the main agent's tool face same-request, while the writer's fs-tool writes resync at the next assembly — one request later. The deny list is a maintainer contract: new shell or subagent providers extend it.
