/**
 * Browser half: mounts the generated tavern Remote namespace as the
 * `remote.tavern` service. The mount lives here — not in the UI plugin —
 * because a `remote.tavern` inject entry blocks activation until the
 * namespace service exists; the entry that both provides and requires it
 * would wait on itself and fail the web boot audit.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import tavernRemote from 'dsh-tavern-fengyue-api/remote'

/** Required browser services: the typed Remote carrier. */
export const inject = ['remote']

/**
 * Mount the generated tavern Remote contribution for the plugin's lifetime.
 * @param ctx - client root context carrying the typed Remote face.
 * @returns disposer withdrawing the namespace.
 */
export async function apply(ctx: ClientContext): Promise<() => Promise<void>> {
  return ctx.remote.$mount(tavernRemote)
}
