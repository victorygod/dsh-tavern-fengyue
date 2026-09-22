/**
 * Runtime compatibility backstop. The install-time probe
 * (`dsh-tavern-fengyue/bin/compat-probe.mjs`) pins its verdict to
 * `<dsh-home>/profiles/tavern-fengyue/.tavern-compat.json`; the engine READS
 * that record once per process and never probes the host at runtime. A zero
 * responsibility beyond the notice: missing/failed records surface one warn
 * pointing at the guided installer, and live seam errors carry the same
 * guidance through {@link withHostGuidance} so a post-install change of the
 * host names its fix instead of dropping a bare stack trace.
 * @module dsh-tavern-fengyue-engine/compat-notice
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'

/** The profile this plugin installs into (kept in step with the bundle bin). */
const PROFILE = 'tavern-fengyue'
const INSTALL_HINT = 'npx dsh-tavern-fengyue'
const UNINSTALL_HINT = `dsh plugin --profile ${PROFILE} remove dsh-tavern-fengyue`

interface CompatRecord {
  readonly detected?: string
  readonly verdict?: string
}

let noticed = false

/**
 * One-time per process: read the pinned probe record and warn when it is
 * absent or failed. Synchronous file read of a tiny JSON — no probing, no
 * I/O beyond that read, no accumulation.
 * @param logger - the plugin logger (warn sink).
 */
export function noticeCompatRecord(logger: { warn(message: unknown): void }): void {
  if (noticed) return
  noticed = true
  try {
    const path = join(resolveDshHome(), 'profiles', PROFILE, '.tavern-compat.json')
    if (!existsSync(path)) {
      logger.warn(new Error(`tavern: 未找到安装态探测记录（${path}）——重跑 ${INSTALL_HINT} 完成一次探测；宿主行为变更时插件以首回合结构化错误提示`))
      return
    }
    const record = JSON.parse(readFileSync(path, 'utf8')) as CompatRecord
    if (record.verdict === 'fail') {
      logger.warn(new Error(`tavern: 安装态探测判定 fail（宿主 ${record.detected ?? '未知'}，记录 ${path}）——按强制提示回到已验证版本或重跑 ${INSTALL_HINT}`))
      return
    }
    // Version drift, best effort: the current host package is usually not on
    // the profile's resolution chain (the installation carries it), so an
    // unresolvable probe is normal and silent. When it does resolve and
    // differs from the probed host, the record is stale.
    try {
      const hostDir = createRequire(fileURLToPath(import.meta.url)).resolve('@deepseek-ai/dsh/package.json')
      const current = (JSON.parse(readFileSync(hostDir, 'utf8')) as { version: string }).version
      if (record.detected !== undefined && record.detected !== current) {
        logger.warn(new Error(`tavern: 宿主已变更（探测时 ${record.detected}，当前 ${current}）——重跑 ${INSTALL_HINT} 重新探测`))
      }
    } catch {
      // Normal on user installs: the host is not on the engine's require
      // chain. First-turn wrappers cover an actual drift.
    }
  } catch (error) {
    logger.warn(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Attach the one-line fix guide to a seam failure raised inside the tail fork
 * or the post injector. The message stays a single line — the fail-visible
 * channel at runtime, replacing the retired version gate.
 * @param context - which seam surfaced the error.
 * @param error - the original error.
 * @returns an error carrying the guided message.
 */
export function withHostGuidance(context: string, error: unknown): Error {
  const detail = error instanceof Error ? error.message : String(error)
  return new Error(`tavern: ${context} 在宿主侧失败（${detail}）——宿主可能已变更：重跑 ${INSTALL_HINT}，或 ${UNINSTALL_HINT}`)
}
