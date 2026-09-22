# Agent Note: Tavern card identity header over meta.json plus a writeAsset RPC

Status: implemented

English | [中文](2026-09-14-tavern-card-identity-header.zh.md)

## Problem

The card authoring surfaces (编辑卡页, 制作卡页, the settings-modal workspace page, the import preview) exposed the card identity — title, description, cover — only as raw `preset/meta.json` JSON text inside the file editor. The identity was invisible at the top of every authoring page, and there was no wire path to write a binary asset at all: every asset RPC (`readAsset`, `readLibraryAsset`) is read-only.

## Decision

**The identity header replaces the page title row on every disk-backed authoring surface.** A fixed 120×82 cover (the library shelf's ~19:13 ratio scaled down, one shared CSS comment pins the parity) sits on the left; the title and description render as two click-to-edit inline lines beside it; the page's action buttons and the tail-agent chip move into the header's right action area. The import preview edits the in-memory table's meta and carries no cover upload — before `commitImport` there is no disk workspace to write into, and the preview's file map carries text only.

**`meta.json` keeps a single write path.** The client parses the meta text it already reads through `readText`, re-serializes the edited fields, and saves through the existing `writeText`. The engine gains no meta validation — its readers already tolerate junk, and a second structured write path would need its own dirty semantics beside `editDirty`/`saveEdit`. An unparseable meta file renders the header read-only behind a repair note instead of blocking the editor.

**Cover uploads are the one new wire method: `tavern.writeAsset`.** The engine decodes base64, enforces the read path's extension allowlist, caps the decoded size (`editWriteCap` config, default 1 MB), and fences the target under `preset/` — the cover is card content, while `runtime/` and `savings/` stay out. The client picks a free `preset/<name>` path by consulting the tree listing (numeric suffix on collision, the `commitImport` precedent — a fixed `cover.png` name would silently overwrite a user file), uploads, then points `meta.cover` at the new path through the normal meta write. Clearing the cover only detaches the reference; the file stays on disk.

## Alternatives considered

- **A structured `updateMeta` RPC** (engine parses and validates the JSON): rejected — it would create a second write path to the same file with different failure semantics while the editor's text view and `presetDiffers` already treat meta.json as bytes.
- **A fixed cover filename**: rejected for the overwrite reason above; also loses the original filename, which is useful context when a card directory is shared or re-imported.

## Consequences

The size bound is engine-authoritative: `editWriteCap` and `editReadCap` (both 10 MB by default) govern the write and the preview read together — they must move together, or a large cover uploads but no render site can preview it. The client runs no size pre-check; a rejected upload alerts with the engine's error message. The wire gained one method, so the typert host manifest and the api-tavern client bundle were regenerated in the same change. The header's read-only stance on broken meta is intentionally silent about which field failed — JSON errors are position-free.
