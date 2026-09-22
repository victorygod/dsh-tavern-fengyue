---
description: "The tavern profile patch: the engine, its remote namespace, and the browser takeover over the base + web-app bundles, for users booting dsh tavern."
kind: "package-bundle"
---

# dsh-tavern-fengyue

English | [中文](README.zh.md)

## Summary

`dsh-bundle-tavern` turns base + web-app into the tavern profile: three rows — the world-card engine, its Remote namespace, and the browser takeover — inserted after the shared core. `dsh tavern` applies this patch; you rarely touch the package itself.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)

## Use this package

Boot `pnpm dsh tavern` and the profile is complete — the bundle ships with the dsh CLI, and the `tavern` profile initializes on first use from the shipped template (one command, zero install steps). To customize, add a later `--patch` overlay rather than editing this file; a patch replaces a targeted row's whole `config`.

On a dsh without the shipped bundle, mount this package externally: `dsh plugin --profile tavern add dsh-tavern-fengyue`, then append `@deepseek-ai/dsh-web-app` and `dsh-tavern-fengyue` to the profile's `dsh.profile.bundles` in its `package.json`, and boot `dsh --profile tavern` (three steps total; bundle layers apply only from that list, not from dependency discovery).

## Understand the implementation

- **[cordis.patch.yml](./cordis.patch.yml)** — three inserts (`tavern-engine`, `tavern-api`, `ui-tavern`) plus disables: the per-session agent-preset plane (`agent-presets`, `ui-agent-preset`) and the first-prompt title generator (`session-title-llm`). The card is the whole world: session-controller composes every session preset-free through its no-service branch. The patch's own `package.json` dependencies name the three packages so the resolver can verify them.

## Dev Note

A patch replaces the targeted row's whole `config`, so each row in cordis.patch.yml restates every key it owns; a partial row silently drops the keys it omits.

## Model Experience

Indirectly, through each inserted row's package, which owns that row's model-facing behavior.

#### KV Cache effect

The bundle itself adds no request prefix; each inserted row's package owns any cache effect.

## Known Limitations and Deferred Work

No invariant companion is published: the bundle is a patch manifest over plugin ids with no code surface of its own.

- **Stacking order is load-bearing** — the rows assume base + web-app beneath them (projection units included); a custom profile that drops either layer breaks the browser half's data sources.
