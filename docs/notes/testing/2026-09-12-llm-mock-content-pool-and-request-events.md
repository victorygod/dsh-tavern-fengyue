# Agent Note: llm-mock-server response pool, request-body events, and per-request latency

Status: implemented

English | [中文](2026-09-12-llm-mock-content-pool-and-request-events.zh.md)

## Problem

The mock LLM server streams one fixed `successText` for every success-shaped behavior, so an open-ended interactive run — for example exercising the tavern web surface against `DEEPSEEK_BASE_URL` — repeats a single canned sentence on every turn, and behavior-level `random` cannot vary content. Separately, the standalone JSONL telemetry named each request's scripted and resolved behavior but never showed what the provider actually received, so an interactive session could not be inspected for the assembled system prompt, dynamic context snapshots, tools, or sampling parameters without a debugger or the in-process handle.

## Decision

- **Content pool.** `MockLlmServerOptions.successTexts` supplies multiple complete texts; the success-shaped completion path draws one per request from the same seeded PRNG that selects `random` behaviors, so a run reproduces from its seed. A single-entry pool skips the draw, preserving existing seeded behavior sequences; `successText` keeps working and the default text is unchanged when neither option is set. `successTexts` takes precedence over `successText`. The CLI feeds the pool with a repeatable `--success-text` and `--success-text-file <path>`, read one-text-per-line at parse time (blank lines skipped, leading BOM stripped, fail-loud on unreadable files and empty pools). `partialText`, `reasoningText`, and `toolArguments` stay single-valued.
- **Request body in the `request` event.** The event carries the parsed JSON body from the existing emit site, so the standalone JSONL log shows the assembled provider request per call. Headers are deliberately not echoed: the Authorization header would land in terminal scrollback and CI logs, and in-process tests already assert on `server.requests[...].headers`.
- **Per-request latency.** `latencyMinMs`/`latencyMaxMs` (CLI `--latency-ms <min>-<max>`; a single value pins it) delay every accepted request before its first response byte — HTTP errors included — drawn from the seeded stream shared with behavior and pool selection. A degenerate range skips the draw, so seeded sequences reproduce unchanged.

## Alternatives considered

**Echoing headers in the `request` event.** Rejected: an event destined for stdout must not duplicate credentials (even dummy ones habituate to real ones); the detached header copies remain available to tests on the server handle.

**A per-call response script file (llm-replay-style positional scripting).** Rejected: the mock server's contract is per-request behavior, not per-call transcript replay; positional scripts and consumption diagnostics are `llm-replay`'s job, and content variety only needs a pool draw.

## Testing

`pnpm exec vitest run packages/test-support/llm-mock-server` covers: pool reproducibility under a seed across two servers and coverage of every entry; default and single-`successText` back-compat; pool draws in `max_tokens`, `slow_success`, and `wrong_content_type`; `request`-event body deep-equal to the sent JSON and `undefined` for an empty body; fixed and ranged latency with a client disconnecting during the wait; option validation for an empty pool, an empty entry, and an inverted latency range; CLI parsing for repeatable flags, flag-plus-file merge order, blank-line skipping, unreadable or blank-only file errors, and pinned/ranged/inverted latency values. The consumer suites (`llm-retry` transport recovery, `session-log-deepseek` feedback composition) stay green.

## Consequences

Interactive keyless runs get varied narratives, realistic 1–3 s latency, and a per-request view of the assembled prompt and tools directly in stdout (`| jq` for readability); the repository script `scripts/mock-llm.sh` bundles these defaults behind environment overrides with a `stop` subcommand that reaps orphaned standalone servers. Costs accepted: pool draws share the PRNG stream with behavior draws, so changing the pool changes subsequent behavior selection under the same seed — reproducibility holds per fixed configuration, not across option changes; and event lines now carry full request bodies, so stdout volume grows with prompt size.
