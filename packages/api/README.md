---
description: "The tavern Remote namespace over the tavern engine: workspace, card, save, and editor RPCs for the browser surface, for maintainers of the tavern wire contract."
kind: "package-reference"
---

# dsh-tavern-fengyue-api

English | [中文](README.zh.md)

## Summary

`dsh-api-tavern` is the host owner of `ctx.remote.tavern`: every workspace, card-library, save, opening, and editor operation the tavern browser surface can invoke, as one generated Typert namespace. It also ships the generated client face (`./client`) that mounts the namespace, so a consumer's `remote.tavern` inject doubles as an activation edge. You meet this package only through the tavern profile.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

Nothing to configure. The namespace's wire contract lives in [types.ts](./src/types.ts); every method takes exactly one request object and answers with a `RemoteResult` envelope the client face unwraps.

## Understand the implementation

- **[index.ts](./src/index.ts)** — one `@Remote` method per operation, each a thin `wrap` over the engine seam that turns failures into `tavern/*` Remote errors instead of rejections. `retryPoint` rebinds the workspace to the send-moment autosave and returns its composer draft; `load`/`reset` return the draft to restore, and `save`/`state` carry it (`draft`, `retryable`), so the browser surface can implement 重试 and 载入草稿恢复 without a second read.
- **[src/client/index.ts](./src/client/index.ts)** — the generated `$mount` client entry; rebuilding it after an endpoint change requires both `pnpm run build:lib:host` and the package's `bundle` script, or the served bundle lags the server.

## Dev Note

The service class resolves the engine through `static inject = ['tavernService']`; the namespace is a Host face and must never be imported by browser-half code — the generated `./client` entry is the only crossing.

## Model Experience

Indirectly, through `dsh-tavern-fengyue-ui`, which renders what these RPCs return; the namespace itself never enters a request.

#### KV Cache effect

None — the namespace carries no model request of its own.

## Known Limitations and Deferred Work

No invariant companion is published: the Remote namespace is a per-method forward into the engine service — an invariant here could only reassert the callee it just called.

- **Endpoint changes need two rebuilds** — adding or removing a method requires `pnpm run build:lib:host` for the generated types and `pnpm --filter dsh-tavern-fengyue-api bundle` for the client face; skipping the latter fails silently at call time.
- **The client face is generated, not hand-typed** — local type shims in `ui-tavern`'s `rpc.ts` mirror this contract and must be updated in the same change.
- **Stale bundles now warn at boot** — the modules server logs a warning when a served `lib/client.js` is older than its package sources (diagnostic only; the fix is rebuilding and restarting).
