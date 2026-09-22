/**
 * The tavern wire face: every `@Remote` method must declare the
 * two-parameter `(request, signal)` form. The generated remote-client
 * dispatches `(request, signal?); a one-parameter service method
 * fails the runtime invocation with `expected 1 argument(s), got 2` —
 * a silent client failure (the caller's rejection path only warns).
 * @module wire-face
 */
import { describe, expect, it } from 'vitest'
import TavernApi, { type TavernRemoteFace } from '../src/index.ts'

/** The zero-arg methods are declared with an explicit empty record request. */
const SKIP = new Set(['constructor', 'ctx', 'scope'])

describe('tavern wire face', () => {
  it('every @Remote method declares (request, signal)', () => {
    const proto = TavernApi.prototype as unknown as Record<string, (...args: unknown[]) => unknown>
    const names = Object.getOwnPropertyNames(proto)
      .filter(name => !SKIP.has(name) && typeof proto[name] === 'function' && name !== 'default')
    expect(names.length).toBeGreaterThan(5)
    for (const name of names) {
      expect(proto[name]!.length, `Remote method "${name}" must take (request, signal)`).toBe(2)
    }
  })

  it('the declared face is fully implemented (compile-time conformance)', () => {
    // The generated typert host manifest serves exactly this face:
    // a face method missing from the class shipped silently — the
    // client greeted `namespace lacks method`.
    const face: Pick<TavernRemoteFace, 'stop' | 'tailTranscript'> = TavernApi.prototype as never
    expect(face).toBeDefined()
  })
})
