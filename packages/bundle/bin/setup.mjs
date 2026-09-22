#!/usr/bin/env node
/**
 * Guided installer for the tavern fengyue plugin — a thin shell over the
 * OFFICIAL dsh plugin channel, not a parallel implementation of it:
 *
 *   npx dsh-tavern-fengyue        # this script
 *   dsh --profile tavern-fengyue  # daily run
 *
 * What it does, in order:
 *   1. ensures a dsh host exists (installs `@deepseek-ai/dsh@latest` when
 *      absent; an existing host is never touched, any version is allowed);
 *   2. checks the detected version against the verified list shipped in
 *      dsh-compatibility.json — in-list versions skip the probe entirely;
 *   3. seeds the profile with the same shape upstream's own shipped-template
 *      init writes (bundle ROWS for the in-box layers, no deps; the official
 *      reconcile never touches template rows);
 *   4. forwards installation to the official channel:
 *      `dsh plugin --profile tavern-fengyue add dsh-tavern-fengyue`;
 *   5. for versions outside the verified list, runs the compat probe once and
 *      writes `<profile>/.tavern-compat.json` — the engine reads that file and
 *      never re-probes.
 *
 * No version gate: an unlisted host is probed, not refused. A failed probe
 * prints the direction-correct fix (upgrade dsh when too old, or return to a
 * verified version when too new) and how to undo the add.
 *
 * Rehearsal/local mode: DSH_TAVERN_FENGYUE_LOCAL=<repo root> links the
 * packages from that checkout AND takes the host closure from that checkout
 * (skips the official forwarder, which would install from the registry).
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SELF_DIR = dirname(fileURLToPath(import.meta.url))
const PKG_DIR = resolve(SELF_DIR, '..')
const COMPATIBILITY = JSON.parse(readFileSync(join(PKG_DIR, 'dsh-compatibility.json'), 'utf8'))
const VERIFIED = Array.isArray(COMPATIBILITY.verified) ? COMPATIBILITY.verified : []
const PROFILE = 'tavern-fengyue'
const PLUGIN_PACKAGE = 'dsh-tavern-fengyue'
const LOCAL_REPO = process.env.DSH_TAVERN_FENGYUE_LOCAL ? resolve(process.env.DSH_TAVERN_FENGYUE_LOCAL) : undefined
const BUNDLE_ROWS = ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', PLUGIN_PACKAGE]
// Upstream initProfile's own bytes for the user patch layer and pnpm settings —
// copied, not reinvented, so an npx-seeded profile is byte-identical to one
// the official channel would have created.
const PATCH_TEMPLATE = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
[]
`
const PNPM_WORKSPACE = `packages:
  - .

nodeLinker: hoisted
autoInstallPeers: false
`

function dshHome() {
  return process.env.DSH_HOME ?? join(process.env.HOME ?? '', '.dsh')
}
function profileDir() {
  return join(dshHome(), 'profiles', PROFILE)
}
/**
 * Run a `cmd + args` sync. On win32 the `.cmd` shims (dsh/npm/pnpm) spawn
 * EINVAL without a shell, so take the shell-string form there; the callers
 * using this helper only pass space-free tokens. `runNode` stays on plain
 * argv for paths with spaces.
 */
function run(cmd, args, options = {}) {
  if (process.platform === 'win32') {
    return spawnSync(`${cmd} ${args.join(' ')}`, { encoding: 'utf8', shell: true, ...options })
  }
  return spawnSync(cmd, args, { encoding: 'utf8', ...options })
}
/** Plain node exec (no shell, safe for spaced absolute paths on all platforms). */
function runNode(script, options = {}) {
  return spawnSync(process.execPath, [script], { encoding: 'utf8', ...options })
}

/** Host CLI version; '' when dsh is absent or broken. */
function dshVersion() {
  const probe = run('dsh', ['--version'])
  return (probe.stdout ?? '').trim()
}

/** 1. dsh host present — install latest when missing, never replace an existing one. */
function ensureHost() {
  let version = dshVersion()
  if (version !== '') return version
  console.log('[setup] 未检测到 dsh 宿主——安装 @deepseek-ai/dsh@latest。')
  const install = run('npm', ['i', '-g', '@deepseek-ai/dsh@latest'], { stdio: 'inherit' })
  if (install.status !== 0) {
    console.error('setup: npm i -g @deepseek-ai/dsh@latest 失败——手动安装后再跑本命令。')
    process.exit(1)
  }
  version = dshVersion()
  if (version === '') {
    console.error('setup: 安装后仍未探测到 dsh（PATH 未刷新？）——开新终端重试。')
    process.exit(1)
  }
  return version
}

/** 3. Seed the profile exactly the way upstream's shipped-template init would. */
function initProfile(dir) {
  mkdirSync(dir, { recursive: true })
  const manifestPath = join(dir, 'package.json')
  const localDeps = LOCAL_REPO === undefined ? {} : {
    [PLUGIN_PACKAGE]: `link:${join(LOCAL_REPO, 'packages', 'bundle').replaceAll('\\', '/')}`,
    'dsh-tavern-fengyue-engine': `link:${join(LOCAL_REPO, 'packages', 'engine').replaceAll('\\', '/')}`,
    'dsh-tavern-fengyue-api': `link:${join(LOCAL_REPO, 'packages', 'api').replaceAll('\\', '/')}`,
    'dsh-tavern-fengyue-ui': `link:${join(LOCAL_REPO, 'packages', 'ui').replaceAll('\\', '/')}`,
  }
  if (!existsSync(manifestPath)) {
    writeFileSync(manifestPath, `${JSON.stringify({
      name: `dsh-profile-${PROFILE}`,
      private: true,
      type: 'module',
      dependencies: localDeps,
      dsh: { profile: { bundles: BUNDLE_ROWS, patchReload: 'live' } },
    }, undefined, 2)}\n`)
  } else if (LOCAL_REPO === undefined) {
    // Migration: manifests written by older setups pinned the in-box layers as
    // dependencies — the reconcile treats those names as removable deps. The
    // authoritative shape is rows-only for in-box layers.
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const stale = Object.keys(manifest.dependencies ?? {}).filter((name) => {
      return name === '@deepseek-ai/dsh-base' || name === '@deepseek-ai/dsh-web-app'
    })
    for (const name of stale) delete manifest.dependencies[name]
    if (stale.length > 0) {
      writeFileSync(manifestPath, `${JSON.stringify(manifest, undefined, 2)}\n`)
      console.log(`[setup] 清理了老 manifest 钉死的 in-box 依赖：${stale.join(', ')}`)
    }
  }
  const patchPath = join(dir, 'cordis.patch.yml')
  if (!existsSync(patchPath)) writeFileSync(patchPath, PATCH_TEMPLATE)
  const workspacePath = join(dir, 'pnpm-workspace.yaml')
  if (!existsSync(workspacePath)) writeFileSync(workspacePath, PNPM_WORKSPACE)
  console.log(`[setup] profile 就绪：${dir}（in-box 层 = 行声明，可被官方 reconcile 触碰的只有插件依赖）`)
}

async function main() {
  // LOCAL mode keeps the old rehearsal shape: repo host, link deps, direct pnpm.
  if (LOCAL_REPO !== undefined) {
    const host = JSON.parse(readFileSync(join(LOCAL_REPO, 'node_modules', '@deepseek-ai/dsh/package.json'), 'utf8'))
    if (!VERIFIED.includes(host.version)) console.warn(`[setup] 注意：本仓宿主 ${host.version} 不在已验证列表 ${JSON.stringify(VERIFIED)}——继续，但不被 CI 背书。`)
    else console.log(`[setup] 宿主 ${host.name}@${host.version}（LOCAL，已验证列表内）✔`)
    initProfile(profileDir())
    const install = run('pnpm', ['install'], { cwd: profileDir(), stdio: 'inherit' })
    if (install.status !== 0) throw new Error('setup: profile 目录内 pnpm install 失败')
    console.log('[setup] LOCAL 演练完成。运行：')
    console.log(`  dsh --profile ${PROFILE}`)
    return
  }

  // 1-2. Host + verified list.
  const version = ensureHost()
  const verified = VERIFIED.includes(version)
  console.log(`[setup] 宿主 dsh@${version} ✔（已验证列表${verified ? '内' : '外'}${verified ? '' : '——安装后将跑一次现场探测'}）`)

  // 3. Seed the profile (rows-only shape).
  initProfile(profileDir())

  // 4. The official channel does the actual install.
  const add = run('dsh', ['plugin', '--profile', PROFILE, 'add', PLUGIN_PACKAGE], { stdio: 'inherit' })
  if (add.status !== 0) {
    console.error('setup: dsh plugin add 失败——above 为 pnpm 原始输出。')
    process.exit(1)
  }

  // 5. Unlisted host: one live probe, verdict pinned to the profile.
  if (!verified) {
    const probe = runNode(join(PKG_DIR, 'bin', 'compat-probe.mjs'), { stdio: 'inherit' })
    if (probe.status !== 0) {
      console.error('setup: 现场探测未通过——当前宿主与插件不匹配。')
      console.error(`  回到已验证版本: npm i -g @deepseek-ai/dsh@${VERIFIED[VERIFIED.length - 1] ?? '0.1.5-rc.1'}`)
      console.error(`  卸载本插件: dsh plugin --profile ${PROFILE} remove ${PLUGIN_PACKAGE}`)
      process.exit(1)
    }
  }

  console.log('[setup] 完成。运行：')
  console.log(`  dsh --profile ${PROFILE}`)
  console.log(`更新/卸载经官方通道: dsh plugin --profile ${PROFILE} update|remove ${PLUGIN_PACKAGE}（更新后重跑 npx 重新探测）`)
}

main().catch(error => {
  console.error('setup:', error)
  process.exit(1)
})
