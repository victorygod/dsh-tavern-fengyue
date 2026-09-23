import { defineConfig } from 'tsdown'

function isBuildFaceClient(value: unknown): boolean {
  if (value === undefined || value === 'host') return false
  if (value === 'client') return true
  throw new Error(`tsdown: --env.DSH_BUILD_FACE must be host or client, received ${String(value)}`)
}

/**
 * The ordinary workspace build consumes JavaScript emitted by the Host
 * TypeScript project. The Client pass selects packages that declare a browser
 * bundle and lets their package-local configs emit both their Node loader entry
 * and browser artifact.
 *
 * Upstream's copy of this file also runs the Typert generator here (`plugins:
 * [typertPlugin(...)]`), which is how `lib/typert.*` gets produced there. This
 * repo deliberately does NOT: the generator only recognises `@Remote` when the
 * protocol's declarations belong to a project of the analyzed workspace, and
 * here the protocol is a published `node_modules` dependency — so it cannot
 * generate our artifacts and hard-fails the build instead. Those four files are
 * carried and versioned; see packages/api/REGENERATE.md.
 */
export default defineConfig(({ env }) => {
  const client = isBuildFaceClient(env?.DSH_BUILD_FACE)
  return {
    workspace: ['packages/*'],
    entry: client ? '' : ['lib/types/{index,invariant,startup}.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  }
})
