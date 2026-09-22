/**
 * Tavern browser half: mounts the full tavern application page by shadowing
 * the built-in `root` slot (see app/TavernApp.tsx) — the whole web surface
 * becomes the tavern page. All services resolve at render time, so this
 * plugin's apply performs registrations only and never touches a service
 * instance that may not be activated yet.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { ReactNode } from 'react'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { NS, en, zh, type TavernKey } from './locales.ts'
import { TavernRoot } from './app/TavernApp.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Tavern copy. */
    'tavern': TavernKey
  }
}

/** Services required for the slot registration and the application page. */
export const inject = [
  'slots', 'locale', 'sessions',
  'remote', 'remote.credentials', 'remote.tavern',
  // The composer's model picker: the resolver service and the namespace face
  // its directories read. Optional at runtime for the page itself, but the
  // strict root-context reads inside directoryFor require the declaration.
  'modelDirectories', 'remote.session',
]

/**
 * Client plugin body: register the dictionaries and shadow the root slot.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-tavern: dictionaries')

  const registerRoot = (ctx as unknown as {
    slots: { register(options: { name: string; priority: number }, component: () => ReactNode): () => void }
  }).slots
  // The application page: a lower cell priority shadows the stock web shell.
  // 'root' is the runtime's own built-in hole (always declared), so this
  // registration cannot fail on activation order, and every service the page
  // reads is resolved inside the component body at render time.
  ctx.slots.inject('root', () => registerRoot.register(
    { name: 'root', priority: -20 },
    () => TavernRoot({ ctx }),
  ))

  console.info('[tavern] root shadow 已落座（priority -20）— 应用页面接管生效')
}
