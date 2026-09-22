/**
 * Legacy wrap-era tag grammar, kept browser-side for display only. The engine
 * used to compose every player prompt as tagged blocks
 * (`<pre-instructions>` / `<post-instructions>` around the raw text) inside
 * the ONE durable user message; since the dynamic-post injection
 * (2026-09-16, companion `docs/tavern-prototype/dynamic-post-injection_zh.md`)
 * the player's durable message carries the bare text and the per-turn
 * instruction renders as a separate plugin-sourced user message the
 * transcript filters out by `source.kind`. This module remains as the display
 * shim that keeps those old session logs readable — arriving player text is
 * byte-identical under it. Anchored to the historical composer's exact edge
 * pattern; the engine no longer composes this shape from any source.
 * @module dsh-tavern-fengyue-ui/wrap-markers
 */

/**
 * Remove the legacy instruction sections from one message's text blocks — the
 * single display rule the transcript and the sidebar summary share for
 * wrap-era logs; a no-op on every message the current engine composes.
 * @param texts - the message's text blocks.
 * @returns the visible texts, in order and byte-identical where untagged.
 */
export function stripInstructions(texts: readonly string[]): string[] {
  return texts.map(text => text
    .replace(/^<pre-instructions>\n[\s\S]*?\n<\/pre-instructions>\n/, '')
    .replace(/\n<post-instructions>\n[\s\S]*?\n<\/post-instructions>$/, ''))
}
