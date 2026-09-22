/**
 * Public client-build environment plumbing for the tsdown client bundle:
 * bundler substitutions for `DSH_CLIENT_*` variables.
 *
 * Snapshot from deepseek-harness `tavern-extraction-2026-09-17` (078257c),
 * scripts/client-build-environment.ts (defines section only). Upstream edits
 * must be re-ported here.
 * @module dsh-tavern-fengyue/client-build-environment
 */

/** Prefix reserved for build-time values that may be embedded in browser artifacts. */
const CLIENT_BUILD_ENV_PREFIX = 'DSH_CLIENT_'

/** Collect the public client environment in deterministic key order. */
function clientBuildEnvironment(environment: NodeJS.ProcessEnv): Record<string, string> {
  return Object.fromEntries(Object.entries(environment)
    .filter(([name, value]) => name.startsWith(CLIENT_BUILD_ENV_PREFIX) && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)))
}

/**
 * Create bundler substitutions for public client build environment variables.
 *
 * The empty `process.env` fallback makes an unset static property read
 * evaluate to `undefined` without providing a browser `process` global.
 * Exact substitutions remain longer matches than that fallback. Dynamic
 * property reads and enumeration deliberately observe the empty object.
 *
 * @param environment - environment inherited by the build process.
 * @returns deterministic Vite/tsdown `define` expressions.
 */
export function clientBuildEnvironmentDefines(
  environment: NodeJS.ProcessEnv,
): Record<string, string> {
  const defines: Record<string, string> = { 'process.env': '{}' }
  for (const [name, value] of Object.entries(clientBuildEnvironment(environment))) {
    defines[`process.env.${name}`] = JSON.stringify(value)
  }
  return defines
}
