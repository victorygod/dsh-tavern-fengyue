/**
 * The tavern bundle: a patch-layer package whose whole contribution is the
 * `cordis.patch.yml` beside this module (engine + api + browser rows). This
 * entry exists so the workspace build has a module face for the package.
 * @module dsh-tavern-fengyue
 */

/** The patch layer this bundle carries, relative to the package root. */
export const TAVERN_PATCH = './cordis.patch.yml' as const
