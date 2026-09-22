/**
 * Card hooks: the engine's mechanical trigger seam on the turn-settlement
 * chain. `preset/hooks.json` maps `main.after` / `tail.after` to ordered
 * `preset/scripts/` names; the chain itself is strictly serial — main →
 * main.after → tail → tail.after — held open for the next submission in the
 * engine's gates. Registry discipline: re-read at fire time (a small file; an
 * edit lands on the next event, nothing to cache or synchronize), an invalid
 * file is ignored loudly, one failing script logs and never breaks the chain.
 * Scripts share the prompt face's spawn contract via {@link runCardScript}
 * (cwd = `runtime/`, 60s timeout, no argv — the turn context comes from
 * `runtime/.chat.snapshot.jsonl`, `runtime/.chat.tail.jsonl` and the runtime
 * tree, never from the engine). Design authority: docs/cards/card-hooks.zh.md.
 * @module dsh-tavern-fengyue-engine/hooks
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runCardScript } from './prompting.ts'
import type { ShellSeam } from './tools.ts'
import { PRESET_DIR } from './workspace.ts'

/** The two settlement-boundary hook events. */
export type HookEvent = 'main.after' | 'tail.after'

/** One card's hook registry: the validated view of `preset/hooks.json`. */
export interface CardHooks {
  /** Scripts fired after the main agent's completed turn; list order is run order. */
  readonly 'main.after'?: readonly string[]
  /** Scripts fired after the tail run settled (never fired when maintenance is empty). */
  readonly 'tail.after'?: readonly string[]
}

const HOOK_EVENTS: readonly HookEvent[] = ['main.after', 'tail.after']

/** The registry read's outcome: the validated hooks, or why the file is ignored. */
export interface CardHooksRead {
  readonly hooks: CardHooks
  /** `parse`: broken JSON; `shape`: wrong structure. Both mean "no hooks fire". */
  readonly error?: 'parse' | 'shape'
}

/** Absolute path of one workspace's hook registry. */
export function cardHooksPath(root: string): string {
  return join(root, PRESET_DIR, 'hooks.json')
}

/**
 * Read the hook registry synchronously. Never throws; a structurally invalid
 * file reads as "no hooks" plus the `error` so the phase warns once per firing.
 * @param root - absolute workspace root.
 */
export function readCardHooks(root: string): CardHooksRead {
  const path = cardHooksPath(root)
  if (!existsSync(path)) return { hooks: {} }
  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { hooks: {}, error: 'parse' }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { hooks: {}, error: 'shape' }
  const table = (parsed as { hooks?: unknown }).hooks
  if (table === undefined) return { hooks: {} }
  if (table === null || typeof table !== 'object' || Array.isArray(table)) return { hooks: {}, error: 'shape' }
  const hooks: { 'main.after'?: string[]; 'tail.after'?: string[] } = {}
  for (const event of HOOK_EVENTS) {
    const list = (table as Record<string, unknown>)[event]
    if (list === undefined) continue
    if (!Array.isArray(list) || list.some(entry => typeof entry !== 'string')) return { hooks: {}, error: 'shape' }
    hooks[event] = list as string[]
  }
  return { hooks }
}

/** One event's ordered script names. */
export function hookEntries(hooks: CardHooks, event: HookEvent): readonly string[] {
  return hooks[event] ?? []
}

/** Dependencies of one hook phase, supplied by the engine. */
export interface HookPhaseDeps {
  /** Absolute workspace root the phase runs against. */
  readonly root: string
  readonly event: HookEvent
  readonly shell: ShellSeam
  /** The turn-settlement abort handle: fired means stop() cancelled the chain. */
  readonly signal: AbortSignal
  /** Engine write-queue flush — the phase must observe the snapshot / tail file already on disk. */
  readonly quiesce: () => Promise<void>
  /** Failure sink: one warn line per ignored file / failed script. */
  readonly warn: (message: string) => void
}

/**
 * Run one hook phase: flush the write queue (the just-produced snapshot / tail
 * file is on disk before the first script runs), then execute the event's
 * scripts in list order. Failures log and the remaining entries continue; a
 * fired abort signal skips everything still pending.
 */
export async function runHookPhase(deps: HookPhaseDeps): Promise<void> {
  await deps.quiesce()
  const read = readCardHooks(deps.root)
  if (read.error !== undefined) {
    deps.warn(`tavern: preset/hooks.json ignored (${read.error})`)
    return
  }
  for (const name of hookEntries(read.hooks, deps.event)) {
    if (deps.signal.aborted) return
    const result = await runCardScript(deps.root, name, [], deps.shell, deps.signal)
    if (!result.ok) {
      const suffix = result.exitCode === undefined ? '' : `, exit ${result.exitCode}`
      deps.warn(`tavern: hook "${name}" (${deps.event}) failed (${result.reason}${suffix})`)
    }
  }
}
