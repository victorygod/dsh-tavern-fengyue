# Agent Note: Tavern sidebar collapses to zero width with a header-resident toggle

Status: implemented

English | [中文](2026-09-14-tavern-sidebar-collapse-toggle.zh.md)

## Problem

The tavern page's session sidebar was fixed at 264px with no way to reclaim the space. The stock web UI's collapse lives in `ui-layout`/`ui-sidebar`, whose pieces the tavern page replaces entirely through the root-slot shadow — none of that machinery is reachable from the tavern profile.

## Decision

**Collapse ends at width 0, not a rail.** The dsh sidebar collapses to a 56px icon rail because its collapsed controls are already icons; every tavern sidebar control is a text button, so a rail would hold nothing but orphaned glyphs. The toggle therefore lives in the chat head and must be present in BOTH states — it is the only reopen affordance once the column reaches 0. The collapsed state keeps a `＋` (开启酒馆会话) beside it so the primary session action does not vanish with the sidebar.

**The transition reuses the stock sidebar's freeze-width technique.** The inner column pins at 264px and fades in place while the aside slides to 0, so the slide clips instead of reflowing; `visibility` flips only after the 0.22s settle, which is what takes keyboard focus and the a11y tree (the settle-unmount equivalent of `SidebarRoot` without timer state). The preference persists in localStorage (`tavern.sidebar.open`), the same direct-write pattern as the last-line cache.

**The toggle glyph is inline SVG, not `ui-primitives`.** The tavern page ships as a runtime-fetched dynamic bundle under the client bundle purity gate, and `@deepseek-ai/dsh-client-ui-primitives` is not a module-table row for it (statically-linked packages import it fine; tavern is not one). An in-package single-color glyph also matches the page's icon rule.

## Alternatives considered

- **dsh-style 56px rail**: rejected — no tavern control shrinks into a meaningful icon; the rail would carry only the toggle itself.
- **Importing `IconPanelLeftOutline16`**: rejected — a value import from `ui-primitives` trips the dynamic bundle's purity gate; declaring a module-table row for one icon buys a loader dependency for nothing.

## Consequences

No source change outside `packages/client/ui-tavern`: no layout store, shell, bundle, or engine wiring. The preference scope is per-browser (like the last-line cache), not per-session. The aside stays mounted while hidden, so workspace rows and cover fetches continue behind the collapse; `visibility: hidden` keeps its buttons out of the focus order while collapsed.
