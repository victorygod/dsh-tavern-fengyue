import { defineConfig } from 'tsdown'

/**
 * Bundle node-half artifact. The bundle package is a patch carrier; its
 * loader half emits from lib/types after the host tsc tree. A local config
 * is required — without one tsdown's workspace resolution walks up to the
 * root config and mislabels the build cwd.
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
