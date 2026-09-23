#!/usr/bin/env node
/**
 * Dev orchestrator for the tavern fengyue profile project. Minimal on purpose:
 * no Android/desktop/updater paths — this manages ONE thing, the tavern host
 * (`node bin/dev.mjs start`) in the background with an isolated DSH_HOME. The
 * mock LLM is NOT part of this orchestrator: run `node scripts/mock-llm.mjs` in
 * its own terminal and connect to it by injecting the environment yourself, e.g.
 *   DEEPSEEK_BASE_URL=http://127.0.0.1:8000/v1 DEEPSEEK_API_KEY=sk-mock node bin/dev.mjs start
 * Default credentials = whatever this shell carries (env / .env / in-app key
 * dialog): every environment connects to the real service unless the caller
 * says otherwise.
 * The host is the repo devDependency `@deepseek-ai/dsh`; its version is
 * asserted against config/dsh-compatibility.json (fail loud, never silent).
 */
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const PROFILE = 'tavern-fengyue'
const COMPATIBILITY = JSON.parse(readFileSync(join(REPO_ROOT, 'config', 'dsh-compatibility.json'), 'utf8'))

const repoRequire = createRequire(join(REPO_ROOT, 'package.json'))

function dshHome() {
  // Dev runs in an isolated harness home so the host's real ~/.dsh (and any
  // profile it already owns) is never touched. Override with DSH_HOME.
  return process.env.DSH_HOME ?? join(process.env.HOME ?? '', '.dsh-tavern-fengyue')
}
function profileDir() {
  return join(dshHome(), 'profiles', PROFILE)
}
function logDir() {
  return join(dshHome(), 'logs')
}
function hostPackageDir() {
  return dirname(repoRequire.resolve('@deepseek-ai/dsh/package.json'))
}
/** 宿主 CLI 的 JS 入口（node 直呼，绕开 Windows `.cmd` shim 的 spawn EINVAL 面）。 */
function cliBinPath() {
  const manifest = readJson(join(hostPackageDir(), 'package.json'))
  const binPath = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.dsh
  if (binPath === undefined) throw new Error('dev: the @deepseek-ai/dsh package declares no dsh bin')
  return binPath
}
function cliEntry() {
  return join(hostPackageDir(), cliBinPath())
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}
function pidAlive(pid) {
  if (pid === undefined) return false
  // 纯 Node 存活探测（Windows 无 kill 命令；process.kill(0) 三平台等价）。
  try { process.kill(pid, 0); return true } catch { return false }
}
/** 跨平台同步小睡（Windows 无 sleep 命令）。 */
function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}
function readPid(name) {
  const path = join(logDir(), `${name}.pid`)
  if (!existsSync(path)) return undefined
  const value = Number(readFileSync(path, 'utf8').trim())
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}
function writePid(name, pid) {
  mkdirSync(logDir(), { recursive: true })
  writeFileSync(join(logDir(), `${name}.pid`), `${pid}\n`)
}
function killPid(name) {
  const pid = readPid(name)
  if (pid === undefined) return false
  try {
    if (pidAlive(pid)) {
      try { process.kill(pid, 'SIGTERM') } catch {}
      for (let i = 0; i < 20 && pidAlive(pid); i += 1) {
        sleepSync(200)
      }
      if (pidAlive(pid)) { try { process.kill(pid, 'SIGKILL') } catch {} }
      return true
    }
    return false
  } finally {
    rmSync(join(logDir(), `${name}.pid`), { force: true })
  }
}

/** Verified-list check: warn (never throw) when the host is off the verified list. */
function warnHostCompatibility() {
  const host = JSON.parse(readFileSync(join(hostPackageDir(), 'package.json'), 'utf8'))
  const verified = Array.isArray(COMPATIBILITY.verified) ? COMPATIBILITY.verified : []
  if (host.name !== '@deepseek-ai/dsh') {
    console.warn(`[dev] 注意：宿主包名为 ${host.name}，不是 @deepseek-ai/dsh`)
    return
  }
  if (!verified.includes(host.version)) {
    console.warn(`[dev] 注意：宿主 ${host.version} 不在已验证列表 ${JSON.stringify(verified)}——继续，但机制级行为不被 CI 背书；现场探测以首次实跑为准。`)
    return
  }
  console.log(`[dev] 宿主版本 ${host.name}@${host.version}（已验证列表内）✔`)
}

/**
 * Peer-package probe on the installed host closure: each engine-facing export
 * must load. In-process dynamic import — the host closure is loaded by this
 * node process anyway, so these checks are free; no probe subprocesses.
 */
async function probeHostExports() {
  const required = [
    ['@deepseek-ai/dsh-agent', 'AgentRegistry'],
    ['@deepseek-ai/dsh-llm', 'LlmAdapter'],
    ['@deepseek-ai/dsh-api-session-controller', 'SessionController'],
  ]
  for (const [name, exportName] of required) {
    let entry
    try {
      entry = repoRequire.resolve(name)
    } catch {
      throw new Error(`dsh-compatibility: ${name} is not installed in the repo node_modules; run pnpm install`)
    }
    try {
      // require.resolve hands back a native path; the ESM loader only takes a
      // URL, and on Windows `D:\...` parses as the scheme `d:` (same idiom as
      // the card tools under tavern_presets/*/preset/).
      const mod = await import(pathToFileURL(entry).href)
      if (exportName !== undefined && mod[exportName] === undefined) {
        throw new Error(`missing export ${exportName}`)
      }
    } catch (error) {
      throw new Error(`dsh-compatibility: ${name} failed to load ${exportName}: ${error instanceof Error ? error.message : error}`)
    }
  }
  console.log('[dev] 宿主必需出口探测 ✔（dsh-agent / dsh-llm / dsh-api-session-controller，进程内零 spawn）')
}

/** Create or refresh the profile directory. Idempotent; always re-links and re-syncs. */
function bootstrap() {
  warnHostCompatibility()
  const dir = profileDir()
  mkdirSync(dir, { recursive: true })
  const manifest = {
    name: `dsh-profile-${PROFILE}`,
    version: readJson(join(REPO_ROOT, 'package.json')).version,
    private: true,
    type: 'module',
    dependencies: {
      '@deepseek-ai/dsh-base': COMPATIBILITY.verified.at(-1),
      '@deepseek-ai/dsh-web-app': COMPATIBILITY.verified.at(-1),
      'dsh-tavern-fengyue': `link:${join(REPO_ROOT, 'packages', 'bundle')}`,
      'dsh-tavern-fengyue-engine': `link:${join(REPO_ROOT, 'packages', 'engine')}`,
      'dsh-tavern-fengyue-api': `link:${join(REPO_ROOT, 'packages', 'api')}`,
      'dsh-tavern-fengyue-ui': `link:${join(REPO_ROOT, 'packages', 'ui')}`,
    },
    dsh: {
      profile: {
        bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app', 'dsh-tavern-fengyue'],
        patchReload: 'live',
      },
    },
  }
  writeFileSync(join(dir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(join(dir, 'cordis.patch.yml'), '# dsh-tavern-fengyue 项目配置由 dsh-tavern-fengyue bundle 提供；此文件只保留用户覆盖。\n[]\n')
  console.log(`[dev] profile 已更新：${dir}`)
  const workspacePolicy = readFileSync(join(REPO_ROOT, 'bin', 'profile-pnpm-workspace.yaml'))
  try {
    writeFileSync(join(dir, 'pnpm-workspace.yaml'), workspacePolicy)
  } catch { /* the policy file is static; missing it is a repo error, but keep bootstrap flowing */ }
  // The forwarded dsh plugin child resolves its own home: pin the isolated
  // dev home into its env or it drifts to ~/.dsh and operates on a real
  // profile that bootstrap never wrote.
  const install = spawnSync(process.execPath, [join(hostPackageDir(), cliBinPath()), 'plugin', '--profile', PROFILE, 'install'], {
    cwd: dir,
    stdio: 'inherit',
    env: { ...process.env, DSH_HOME: dshHome(), CI: 'true' },
  })
  if (install.status !== 0) throw new Error('bootstrap: dsh plugin install failed in the profile directory')
  console.log('[dev] bootstrap 完成：dsh-tavern-fengyue 三包以 link: 直连本 repo，bundle 改动 unlink 重装即生效（patchReload live）。')
}

/**
 * Parse the repo-root `.env` (KEY=VALUE lines) into credential variables for
 * the host child. Monorepo days ran every tavern with a root .env, so the
 * stock "添加一个 API Key" onboarding dialog never appeared there; without
 * the same feed the dialog pops on conversation open and eats clicks — this
 * loader restores that parity. Caller-set variables always win.
 */
function loadRepoDotEnv() {
  const path = join(REPO_ROOT, '.env')
  if (!existsSync(path)) return {}
  const out = {}
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (match === null) continue
    const [, key, raw] = match
    if (process.env[key] !== undefined) continue
    out[key] = raw.replace(/^["']|["']$/g, '')
  }
  return out
}

/**
 * Environment for the host child. Default = REAL service: .env credentials
 * feed the child (see {@link loadRepoDotEnv}), everything else inherits the
 * caller's environment untouched. Connecting it to the mock server is
 * entirely the caller's choice — inject the two DEEPSEEK_* variables on the
 * command line; nothing here knows about it.
 */
function startEnv() {
  const env = { ...process.env }
  // The child resolves its harness home independently of this orchestrator:
  // pin it to the isolated home, or the host boots the user's real ~/.dsh
  // profiles (the live-boot ghost that motivated this line).
  env.DSH_HOME = dshHome()
  return { ...loadRepoDotEnv(), ...env }
}

function startHost(mode) {
  const cli = cliEntry()
  mkdirSync(logDir(), { recursive: true })
  const env = startEnv()
  // 额外旗标透传给宿主 CLI(如 --no-open:测试自动化重启时不弹浏览器)——仅本脚本自身的
  // `--bg` 被摘除,其余原样追加。跨平台:纯参数数组,零 shell。
  const passthrough = process.argv.slice(2).filter(arg => arg.startsWith('--') && arg !== '--bg')
  const hostArgs = [cli, '--profile', PROFILE, ...passthrough]
  // pid file ALWAYS: `pnpm stop`（另一终端）与 cleanup 都按它清场，前台模式也不例外。
  if (mode === 'fg') {
    console.log(`[dev] 前台启动宿主（--profile ${PROFILE}${passthrough.length > 0 ? ' ' + passthrough.join(' ') : ''}）——Ctrl-C 结束；Web URL 会在下方输出：`)
    const child = spawn(process.execPath, hostArgs, {
      cwd: REPO_ROOT,
      env,
      stdio: 'inherit',
    })
    writePid('tavern-fengyue', child.pid)
    child.on('exit', (code) => {
      rmSync(join(logDir(), 'tavern-fengyue.pid'), { force: true })
      console.log(`[dev] 宿主已退出（code=${code ?? 'signal'}）`)
      process.exitCode = code ?? 0
    })
    for (const sig of ['SIGINT', 'SIGTERM']) {
      process.on(sig, () => { child.kill(sig); })
    }
    return
  }
  const out = join(logDir(), 'tavern-fengyue.log')
  const fd = openSync(out, 'a')
  const child = spawn(process.execPath, hostArgs, {
    cwd: REPO_ROOT,
    env,
    detached: true,
    stdio: ['ignore', fd, fd],
  })
  child.unref()
  writePid('tavern-fengyue', child.pid)
  console.log(`[dev] dsh 宿主已后台启动（pid ${child.pid}，--profile ${PROFILE}）`)
  console.log(`[dev] 日志：${out}（tail -f 查看启动输出与 Web URL）`)
}

const commands = {
  async bootstrap() {
    await probeHostExports()
    bootstrap()
  },
  async start() {
    await probeHostExports()
    if (!existsSync(join(profileDir(), 'package.json'))) bootstrap()
    else warnHostCompatibility()
    startHost(BG ? 'bg' : 'fg')
  },
  async stop() {
    const host = killPid('tavern-fengyue')
    console.log(`[dev] stopped: host=${host ? 'killed' : 'not running'}（mock 归 \`node scripts/mock-llm.mjs stop\` 管，不在本命令范围）`)
  },
  async restart() {
    await commands.stop()
    await commands.start()
    if (!BG) {
      // 前台 restart 语义 = 本进程即是前台会话：restart 无从保持前台，交还提示。
      console.log('[dev] 提示：restart 仅用于 --bg 模式的前台化替代——前台模式请 Ctrl-C 后重新 pnpm tavern。')
    }
  },
  async status() {
    const home = dshHome()
    const isolatedHome = home === join(process.env.HOME ?? '', '.dsh-tavern-fengyue')
    console.log(`[dev] 当前家: ${home}${isolatedHome ? '（隔离家）' : '（非隔离家！）'}`)
    for (const name of ['tavern-fengyue']) {
      const pid = readPid(name)
      console.log(`[dev] ${name}: pid=${pid ?? '-'} alive=${pidAlive(pid) ? 'yes' : 'no'}`)
    }
    const logPath = join(logDir(), 'tavern-fengyue.log')
    const logText = existsSync(logPath) ? readFileSync(logPath, 'utf8') : ''
    await probeComposition(logText, logPath)
    if (existsSync(logPath)) {
      console.log('--- log tail ---')
      spawnSync('tail', ['-n', '30', logPath], { stdio: 'inherit' })
    }
  },
}

/**
 * Identity probe over the LAST boot URL in the host log: authenticate once
 * (token → cookie), count the fengyue client rows vs the pre-rename package
 * names in the served boot manifest, and append the verdict to the local log.
 * This is the anti-ghost line: a default-webUI page here means the served
 * composition carries no tavern rows (wrong home走出去 or assembly regression).
 */
async function probeComposition(logText, logPath) {
  const urls = [...logText.matchAll(/dsh web: (\S+token=\S+)/g)].map(m => m[1])
  if (urls.length === 0) {
    console.log('[dev] 装配身份: 日志中无启动 URL（宿主未完成 boot）')
    return
  }
  const url = urls[urls.length - 1]
  try {
    const first = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(8000) })
    const cookie = (first.headers.get('set-cookie') ?? '').split(';')[0]
    const page = await (await fetch(new URL(url).origin + '/', {
      headers: cookie ? { cookie } : {},
      signal: AbortSignal.timeout(8000),
    })).text()
    const fengyue = (page.match(/fengyue/g) ?? []).length
    const legacy = (page.match(/dsh-client-ui-tavern|dsh-api-tavern/g) ?? []).length
    const verdict = fengyue > 0 && legacy === 0
      ? '酒馆 fengyue 装配 ✓'
      : fengyue > 0 && legacy > 0
        ? '新旧混杂（旧包名同时在场）✗'
        : '未装配 fengyue（页面为原版 webUI 面）✗'
    const line = `[dev] 装配身份: fengyue 标记 ${fengyue} 处 / 旧包名 ${legacy} 处 → ${verdict}`
    console.log(line)
    appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`)
  } catch (error) {
    console.log(`[dev] 装配身份: 探测失败（${error.cause?.code ?? error.message}）——宿主可能未起或在重启窗口`)
  }
}

const BG = process.argv.includes('--bg')
const command = process.argv.slice(2).find(arg => arg && !arg.startsWith('--'))
const selected = commands[command]
if (selected === undefined) {
  console.error('usage: node bin/dev.mjs <bootstrap|start [--bg]|stop|restart [--bg]|status>')
  process.exit(1)
}
await selected()
