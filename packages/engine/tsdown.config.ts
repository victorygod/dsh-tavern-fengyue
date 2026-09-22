import { defineConfig } from 'tsdown'

/**
 * Engine node-half bundle. Face-agnostic on purpose: the host pass emits it
 * after `tsc -b tsconfig.host.json`, and re-emitting during the client pass
 * is harmless. A local config is required — without one tsdown's workspace
 * resolution walks up to the root config and mislabels the build cwd.
 */
export default defineConfig([
  {
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
  },
])
