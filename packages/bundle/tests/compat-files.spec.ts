/**
 * The compatibility record exists twice by design: `packages/bundle/dsh-compatibility.json`
 * is the canonical copy (it ships inside the published tarball and the
 * install-time probe reads its own package's file), while
 * `config/dsh-compatibility.json` mirrors it for the repo-level dev tooling
 * and CI. They must never drift — this spec is the drift tripwire.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '../../../..')

describe('dsh-compatibility record', () => {
  it('carries a non-empty verified list of host versions', () => {
    const record = JSON.parse(readFileSync(resolve(REPO_ROOT, 'packages/bundle/dsh-compatibility.json'), 'utf8')) as {
      probeVersion: number
      verified: string[]
    }
    expect(Array.isArray(record.verified)).toBe(true)
    expect(record.verified.length).toBeGreaterThan(0)
    expect(record.verified.every(version => /^\d+\.\d+\.\d+/.test(version))).toBe(true)
  })

  it('stays byte-identical between the bundle copy and the repo config mirror', () => {
    const bundleCopy = readFileSync(resolve(REPO_ROOT, 'packages/bundle/dsh-compatibility.json'), 'utf8')
    const configMirror = readFileSync(resolve(REPO_ROOT, 'config/dsh-compatibility.json'), 'utf8')
    expect(configMirror).toBe(bundleCopy)
  })
})
