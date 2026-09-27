/**
 * 卡脚本执行链分诊探针(2026-09-27 Windows 分诊批)。
 *
 * 背景:Windows 宿主全卡报「数据源未就绪/落盘失败」——引擎 spawn 继承的
 * workspace-write 沙盒在本机不可用时被执行器整线拒绝。本探针**不走宿主
 * shell 面**(不经 bash/pwsh/沙盒),直接用 node 子进程复刻 runner 契约,
 * 把「node+runner+脚本」栈与「宿主 shell+沙盒」层切开定位。
 *
 * 分诊结论:
 *   步骤2/3 全绿 + 宿主内依旧失败 → 断层在宿主 shell 面/沙盒层(0.1.7 已修:
 *   升级本仓宿主即可);步骤2 就红 → node/runner/脚本层,stderr 即真因。
 *
 * 用法: node scripts/probe-card-script.mjs [--root <工作区根>] [--script gal_data.mjs] [--payload {"op":"panel"}]
 * 纯 node API,零 shell 拼接,跨平台。
 * @module dsh-tavern-fengyue/scripts/probe-card-script
 */

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const RUNNER = join(REPO_ROOT, 'packages', 'engine', 'runner', 'runner.cjs')
const argv0 = process.argv.slice(2)
const flag = (name) => {
  const at = argv0.indexOf(`--${name}`)
  return at >= 0 ? argv0[at + 1] : undefined
}

const say = (...args) => console.log('[probe]', ...args)
const fail = (message) => { console.error('[probe] ✗', message); process.exit(1) }
const b64 = (text) => Buffer.from(text).toString('base64')
const okMark = (ok) => (ok ? '✓' : '✗')

/* ---------- 目标定位 ---------- */

let root = flag('root')
if (root === undefined) {
  const wsDir = join(REPO_ROOT, 'tavern_workspace')
  if (!existsSync(wsDir)) fail(`无 --root 且找不到 ${wsDir}(在仓库目录或传 --root)`)
  const candidates = readdirSync(wsDir).filter(name => name.startsWith('ws-')).sort()
  const newest = candidates.at(-1)
  if (newest === undefined) fail(`${wsDir} 里没有工作区(传 --root <工作区根>)`)
  root = join(wsDir, newest)
  say(`--root 缺省 → 最新工作区 ${newest}`)
}
root = resolve(root)
if (!existsSync(join(root, 'preset', 'scripts'))) fail(`${root}/preset/scripts 不存在——root 须是工作区根`)

let script = flag('script')
const scriptsDir = join(root, 'preset', 'scripts')
if (script === undefined) {
  const names = readdirSync(scriptsDir).filter(n => n.endsWith('.mjs')).sort()
  script = names.includes('gal_data.mjs') ? 'gal_data.mjs' : names.includes('read.mjs') ? 'read.mjs' : names[0]
  say(`--script 缺省 → ${script}`)
}
const scriptPath = join(scriptsDir, script)
if (!existsSync(scriptPath) || !statSync(scriptPath).isFile()) fail(`脚本不存在:${scriptPath}`)
const payload = flag('payload') ?? (script === 'gal_data.mjs' ? '{"op":"panel"}' : 'null')

say(`平台=${process.platform} node=${process.version}`)
say(`runner=${RUNNER} 存在=${existsSync(RUNNER)}`)

/* ---------- 步骤1:裸 node 可用性(PATH 解析 == 宿主壳内的 node 解析) ---------- */

const bareNode = spawnSync('node', ['--version'], { encoding: 'utf8', timeout: 10_000, windowsHide: true })
say(`步骤1 裸 PATH node 解析 ${okMark(bareNode.status === 0)} → ${bareNode.error !== undefined ? `error: ${bareNode.error.message}` : (bareNode.stdout ?? '').trim() || `status=${bareNode.status}`}`)

/* ---------- 步骤2/3:runner 契约直跑(node 绝对路径 / 裸 node) ---------- */

const runWithTag = (tag, exe, arg0) => new Promise((resolve_, reject) => {
  say(`步骤${tag} 启动:${exe === undefined ? 'node(PATH)' : 'node 绝对路径'} cwd=${join(root, 'runtime')}`)
  const child = spawn(exe ?? 'node', [arg0, b64(scriptPath), b64(payload)], {
    cwd: join(root, 'runtime'),
    windowsHide: true,
    timeout: 30_000,
    env: { ...process.env },
  })
  let out = ''
  let err = ''
  child.stdout.on('data', chunk => { out += String(chunk) })
  child.stderr.on('data', chunk => { err += String(chunk) })
  child.on('error', error => reject(error))
  child.on('close', (code, signal) => {
    const ok = code === 0
    // 「脚本跑起来了」与「脚本退出码干净」分开记:业务回执(exit!=0 但有 stdout)
    // 恰恰证明 runner 栈通(2026-09-27 实测:dnd front_commit 业务 JSON 回执)。
    const ran = out.trim().length > 0 || err.trim().length > 0
    say(`步骤${tag} 退出=${code ?? `signal ${signal ?? '?'}`} stdout=${out.length}B ${okMark(ok)}${ran ? '(脚本确已执行)' : ''}`)
    if (out.trim() !== '') say(`步骤${tag} stdout 头: ${JSON.stringify(out.trim().slice(0, 200))}`)
    if (err.trim() !== '') say(`步骤${tag} stderr: ${JSON.stringify(err.trim().slice(0, 500))}`)
    resolve_({ ok, ran })
  })
})

const absoluteRunner = await runWithTag('2', process.execPath, RUNNER).catch(error => {
  say('步骤2 ✗ spawn 异常:', error.message)
  return { ok: false, ran: false }
})
const bareRunner = await runWithTag('3', undefined, RUNNER).catch(error => {
  say('步骤3 ✗ spawn 异常:', error.message)
  return { ok: false, ran: false }
})

/* ---------- 结论 ---------- */

console.log('')
if (absoluteRunner.ran && bareRunner.ran) {
  say('结论:node/runner/脚本栈健康(退出码哪怕非 0 也是卡自身业务回执)——若宿主内仍全卡失败,断层在宿主 shell 面/沙盒层(符合 2026-09-27 案:引擎 spawn 继承 workspace-write 被拒)。升级本仓宿主(引擎侧已显式全开放)后复测。')
} else if (absoluteRunner.ran && !bareRunner.ran) {
  say('结论:node 绝对路径可跑、PATH 解析失败 → 宿主壳环境的 PATH 无 node(spawn env 或 PowerShell profile 改写)——查宿主启动进程的 PATH。')
} else {
  say('结论:runner 直跑即失败(node/runner/脚本层,且无脚本回执)——上方 stderr 即真因(node 在该机不可用/runner 缺位)。')
}
