#!/usr/bin/env node
/**
 * Compatibility probe for the tavern fengyue plugin against the installed
 * `@deepseek-ai/dsh` closure. Runs once at install time (driven by the bundle
 * bin / `npx dsh-tavern-fengyue`), never again at runtime: the result is
 * pinned to `<profile-dir>/.tavern-compat.json` and the engine only reads it.
 *
 * What a v1 probe CAN verify without booting the host — resolution and export
 * presence for every host-facing seam package the engine composes on, a clean
 * dynamic import of all three plugin packages, and the single-cordis-instance
 * guarantee. What it CANNOT verify: live seam behavior (pre-step gate, post
 * shadowing, fork semantics) — that is the CI matrix's job, summed up in the
 * `verified` list of dsh-compatibility.json; versions outside the list run on
 * probe + first-use fail-visible.
 *
 * Exit 0 = pass, 1 = fail. The verdict file records everything either way.
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUNDLE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COMPATIBILITY = JSON.parse(readFileSync(join(BUNDLE_DIR, 'dsh-compatibility.json'), 'utf8'))
const PROBE_VERSION = 1

function dshHome() {
  return process.env.DSH_HOME ?? join(process.env.HOME ?? '', '.dsh')
}
function profileDir() {
  const index = process.argv.indexOf('--profile-dir')
  if (index !== -1 && process.argv[index + 1] !== undefined) return resolve(process.argv[index + 1])
  return join(dshHome(), 'profiles', 'tavern-fengyue')
}

/**
 * Host CLI version via the standard probe (shell form on win32 for the .cmd
 * shim). Dev repositories run with the host in local node_modules, not on the
 * global PATH — fall back to reading that package.json so rehearsal runs see
 * the same field a user install does.
 */
function hostVersion() {
  const probe = process.platform === 'win32'
    ? spawnSync('dsh --version', { encoding: 'utf8', shell: true })
    : spawnSync('dsh', ['--version'], { encoding: 'utf8' })
  const fromPath = (probe.stdout ?? '').trim()
  if (fromPath !== '') return fromPath
  try {
    return (JSON.parse(readFileSync(join(BUNDLE_DIR, '..', '..', 'node_modules', '@deepseek-ai', 'dsh', 'package.json'), 'utf8'))).version ?? ''
  } catch {
    return ''
  }
}

/**
 * Resolve one package from the profile anchor (the profile's own hoisted
 * node_modules, with the dsh-owned links and the healed fallback beside it).
 * @returns the resolved directory, or null when unresolvable there.
 */
function resolveFromProfile(profileAnchor, name) {
  try {
    return dirname(profileAnchor.resolve(name + '/package.json'))
  } catch {
    return null
  }
}

let dynamicImportCounter = 0
/** Dynamic import with a query buster so repeated probes never read a module cache. */
async function freshImport(entry) {
  dynamicImportCounter += 1
  return import(`${entry}?tavern-probe=${dynamicImportCounter}`)
}

async function main() {
  const root = profileDir()
  const compatPath = join(root, '.tavern-compat.json')
  const checks = []
  const record = (name, ok, detail = '') => {
    checks.push({ name, ok, ...(detail === '' ? {} : { detail }) })
    console.log(`[probe] ${ok ? '✔' : '✖'} ${name}${detail === '' ? '' : ` — ${detail}`}`)
  }

  const anchor = createRequire(join(root, 'package.json'))
  const detected = hostVersion()

  // 1. Profile closure exists at all.
  if (!existsSync(join(root, 'node_modules'))) {
    record('profile-closure', false, `${join(root, 'node_modules')} 不存在——先完成 dsh plugin add`)
    writeCompat(compatPath, detected, checks, 'fail')
    process.exitCode = 1
    return
  }
  record('profile-closure', true, root)

  // 2. Host-facing seam packages resolve from the profile and export the symbols the engine composes on.
  const seams = [
    ['@deepseek-ai/dsh-agent', 'AgentRegistry'],
    ['@deepseek-ai/dsh-llm', 'LlmAdapter'],
    ['@deepseek-ai/dsh-api-session-controller', undefined],
    ['@deepseek-ai/dsh-subagent', undefined],
    ['@deepseek-ai/dsh-system-prompt', undefined],
    ['@deepseek-ai/dsh-tools', undefined],
    ['@deepseek-ai/dsh-shell', undefined],
    ['@deepseek-ai/dsh-home-paths', undefined],
  ]
  for (const [name, exportName] of seams) {
    const dir = resolveFromProfile(anchor, name)
    if (dir === null) {
      record(`seam:${name}`, false, 'unresolvable from the profile closure')
      continue
    }
    try {
      const entry = anchor.resolve(name)
      const mod = await freshImport(entry)
      record(`seam:${name}`, exportName === undefined || mod[exportName] !== undefined,
        exportName === undefined ? dir : `${dir} (${exportName})`)
    } catch (error) {
      record(`seam:${name}`, false, String(error instanceof Error ? error.message : error))
    }
  }

  // 3. The three plugin packages import cleanly from the profile.
  for (const name of ['dsh-tavern-fengyue-engine', 'dsh-tavern-fengyue-api', 'dsh-tavern-fengyue-ui']) {
    const dir = resolveFromProfile(anchor, name)
    if (dir === null) {
      record(`plugin:${name}`, false, 'unresolvable from the profile closure')
      continue
    }
    try {
      const entry = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
      await freshImport(join(dir, entry?.main ?? 'lib/index.js'))
      record(`plugin:${name}`, true, dir)
    } catch (error) {
      record(`plugin:${name}`, false, String(error instanceof Error ? error.message : error))
    }
  }

  // 4. Single cordis instance: the profile must resolve the same real path as the dsh installation.
  const profileCordis = resolveFromProfile(anchor, '@deepseek-ai/cordis')
  let installCordis = null
  try {
    // Ask npm for the global root of the dsh installation; resolution there
    // mirrors what the booting host itself uses. npm is a .cmd shim on win32 —
    // shell-string form only (plain argv spawns EINVAL on .cmd).
    const probe = process.platform === 'win32'
      ? spawnSync('npm root -g', { encoding: 'utf8', shell: true })
      : spawnSync('npm', ['root', '-g'], { encoding: 'utf8' })
    const globalRoot = (probe.stdout ?? '').trim()
    if (globalRoot !== '') {
      const installAnchor = createRequire(join(globalRoot, '@deepseek-ai/dsh', 'index.js'))
      installCordis = resolveFromProfile(installAnchor, '@deepseek-ai/cordis')
    }
  } catch {
    installCordis = null
  }
  if (profileCordis === null) record('cordis-single-instance', false, 'cordis unresolvable from the profile')
  else if (installCordis === null) record('cordis-single-instance', true, `profile: ${profileCordis}（安装侧不可探测，跳过比对）`)
  else record('cordis-single-instance', profileCordis === installCordis, `profile=${profileCordis}\n         install=${installCordis}`)

  const failed = checks.filter(check => !check.ok)
  const verdict = failed.length === 0 ? 'pass' : 'fail'
  const verified = Array.isArray(COMPATIBILITY.verified) && COMPATIBILITY.verified.includes(detected)
  writeCompat(compatPath, detected, checks, verdict)

  console.log(`[probe] 宿主 ${detected}｜判定 ${verdict}｜已验证列表 ${verified ? '内' : '外'}`)
  if (verdict === 'fail') {
    console.error('[probe] 该宿主与插件当前形态不匹配。修复方向：')
    if (detected !== '') console.error(`  npm i -g @deepseek-ai/dsh@${COMPATIBILITY.verified[COMPATIBILITY.verified.length - 1]}   # 回到已验证版本`)
    console.error('  或在能通过的宿主上重跑: npx dsh-tavern-fengyue')
    console.error(`  明细: ${compatPath}`)
    process.exitCode = 1
  }
}

function writeCompat(compatPath, detected, checks, verdict) {
  const verified = Array.isArray(COMPATIBILITY.verified) && COMPATIBILITY.verified.includes(detected)
  writeFileSync(compatPath, `${JSON.stringify({
    probeVersion: PROBE_VERSION,
    detected,
    testedInVerifiedList: verified,
    verdict,
    checks,
  }, undefined, 2)}\n`)
}

main().catch(error => {
  console.error('[probe] 未预期失败：', error)
  process.exitCode = 1
})
