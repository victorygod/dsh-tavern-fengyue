/**
 * E2E：尾代理硬关思考 + GLM 布尔开关桥的真机全链路实测（Playwright-core）。
 *
 * 本脚本自管全部外围，与用户前台实例零交集：
 *   ① 隔离 DSH_HOME（mkdtemp）bootstrap 出 dev profile；
 *   ② 播种 cordis.patch.yml（glm-4.7 路由 + llm-deepseek baseURL 指 mock）；
 *   ③ 起官方协议 mock LLM（jsonl 事件流落文件：request 事件携带解析后的完整 body，
 *      且 success 行为仅在 body.thinking.type==='enabled' 时附带推理）；
 *   ④ 起宿主（独占端口、--no-open），浏览器真实建 dnd5e 会话并发送两回合；
 *   ⑤ 判决（mock JSONL 逐请求）：
 *        尾子请求（用户文块含「面板维护任务」）＝ thinking.type==='disabled'
 *          且无 output_config 且镜像 enable_thinking===false；
 *        主代理请求 ＝ thinking.type==='enabled' 且镜像 enable_thinking===true。
 *      差分同时证明：锁 1 覆写（尾代）与 GLM 桥镜像（glm 路由）都真实落 wire。
 *
 * 用法：node scripts/e2e-tail-nothink.mjs [--keep]（--keep 保留隔离家与日志供尸检）
 * 占用 127.0.0.1:3099(宿主)/8001(mock)；结束即清理（--keep 除外）。
 * 跨平台：纯 node API，零 shell 拼接。断言失败 exit 1。
 * @module dsh-tavern-fengyue/scripts/e2e-tail-nothink
 */
import { existsSync, mkdtempSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const { chromium } = await import(`${REPO_ROOT}node_modules/playwright-core/index.mjs`)

const say = (...args) => console.log('[e2e-tail]', ...args)
const fail = (message) => { console.error('[e2e-tail] ✗', message); process.exit(1) }
const keep = process.argv.includes('--keep')

const HOST_PORT = '3099'
const MOCK_PORT = '8001'
const BASE = `http://127.0.0.1:${HOST_PORT}`
const HOME = mkdtempSync(join(tmpdir(), 'dsh-tv-nothink-'))
const PROFILE = join(HOME, 'profiles', 'tavern-fengyue')
const LOG = join(HOME, 'logs', 'tavern-fengyue.log')
const MOCK_LOG = join(HOME, 'mock-events.jsonl')
const BOOK_TEXT = '原味跑团'
/** 尾子请求的判别标记：维护提示词的首行标题（主代理的用户文块不含它）。 */
const TAIL_MARKER = '面板维护任务'
const TAIL_TIMEOUT = 480_000

process.env.DSH_HOME = HOME

let mockProc

function cleanup() {
  spawnSync(process.execPath, [join(REPO_ROOT, 'bin', 'dev.mjs'), 'stop'],
    { cwd: REPO_ROOT, env: process.env, stdio: 'ignore', timeout: 30_000 })
  spawnSync(process.execPath, [join(REPO_ROOT, 'scripts', 'mock-llm.mjs'), 'stop'],
    { cwd: REPO_ROOT, stdio: 'ignore', timeout: 30_000 })
  if (mockProc !== undefined) { try { process.kill(mockProc.pid) } catch { /* already gone */ } }
  if (keep) { say('--keep：隔离家保留在', HOME); return }
  rmSync(HOME, { recursive: true, force: true })
}

async function waitHttpReady(what, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try { await fetch(url, { signal: AbortSignal.timeout(1500) }); return } catch { /* not up yet */ }
    await new Promise(resolve => { setTimeout(resolve, 400) })
  }
  fail(`${what}：${Math.round(timeoutMs / 1000)}s 内未就绪（${url}）`)
}

async function waitBootUrl(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(LOG)) {
      const urls = [...readFileSync(LOG, 'utf8').matchAll(/dsh web: (\S+token=\S+)/g)].map(m => m[1])
      if (urls.length > 0) return urls.at(-1)
    }
    await new Promise(resolve => { setTimeout(resolve, 500) })
  }
  fail(`boot URL：${Math.round(timeoutMs / 1000)}s 内未出现在 ${LOG}`)
}

/* ---------- ① 隔离家引导 + 组合播种 ---------- */
say('① bootstrap 隔离家…')
const booted = spawnSync(process.execPath, [join(REPO_ROOT, 'bin', 'dev.mjs'), 'bootstrap'], {
  cwd: REPO_ROOT, env: process.env, encoding: 'utf8', timeout: 600_000,
})
if (booted.status !== 0) fail(`bootstrap 失败：${booted.stdout ?? ''}\n${booted.stderr ?? ''}`)
// 播种＝现网组合的镜像：glm-4.7 路由（低 effort，为差分面）+ llm adapter 指向本 mock。
writeFileSync(join(PROFILE, 'cordis.patch.yml'), [
  '- id: agent-default-model',
  '  name: "@deepseek-ai/dsh-agent-default-model"',
  '  config:',
  '    provider: deepseek-official',
  '    model: glm-4.7',
  '    reasoningEffort: low',
  '- id: llm-deepseek',
  '  name: "@deepseek-ai/dsh-llm-deepseek-api-key"',
  '  config:',
  `    baseURL: "http://127.0.0.1:${MOCK_PORT}"`,
  '    maxTokens: 131072',
  '    models:',
  '      - id: glm-4.7',
  '        name: glm-4.7',
  '        contextWindow: 1000000',
  '        defaultMaxTokens: 131072',
  '',
].join('\n'))

/* ---------- ② mock（jsonl 落文件） ---------- */
say('② 起 mock LLM（jsonl →', MOCK_LOG, '）…')
mockProc = spawn(process.execPath, [
  join(REPO_ROOT, 'scripts', 'mock-llm.mjs'), '--',
  '--port', MOCK_PORT, '--log-format', 'jsonl',
  '--random-weights', 'success=100', '--latency-ms', '200',
], { cwd: REPO_ROOT, detached: true, stdio: ['ignore', openSync(MOCK_LOG, 'a'), 'ignore'] })
mockProc.unref()
await waitHttpReady('mock 端口', `http://127.0.0.1:${MOCK_PORT}/`, 20_000)

/* ---------- ③ 宿主（env 指 mock；独占端口；--no-open） ---------- */
say('③ 起宿主（--port ' + HOST_PORT + '）…')
const hostEnv = { ...process.env, DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`, DEEPSEEK_API_KEY: 'sk-e2e-verify' }
process.env.DEEPSEEK_BASE_URL = hostEnv.DEEPSEEK_BASE_URL
process.env.DEEPSEEK_API_KEY = hostEnv.DEEPSEEK_API_KEY
const started = spawnSync(process.execPath, [join(REPO_ROOT, 'bin', 'dev.mjs'), 'start', '--bg', '--no-open', '--port', HOST_PORT], {
  cwd: REPO_ROOT, env: hostEnv, encoding: 'utf8', timeout: 120_000,
})
const pidFile = join(HOME, 'logs', 'tavern-fengyue.pid')
if (!existsSync(pidFile)) fail(`宿主启动失败（pid 缺席）：${started.stdout ?? ''}\n${started.stderr ?? ''}`)
const bootUrl = await waitBootUrl(180_000)
say('③ boot URL 到手')

/* ---------- ④ 浏览器建 dnd5e 会话 + 两回合 ---------- */
const cookieFirst = await fetch(bootUrl, { redirect: 'manual', signal: AbortSignal.timeout(8000) })
const rawCookie = cookieFirst.headers.get('set-cookie') ?? ''
if (rawCookie === '') fail('token 兑换失败（单消费被占——重启后重跑本脚本）')
const [pair] = rawCookie.split(';')
const eq = pair.indexOf('=')
let browser
try {
  browser = await chromium.launch({ channel: 'chrome', headless: true })
} catch {
  browser = await chromium.launch({ headless: true })
}
const context = await browser.newContext({ viewport: { width: 1280, height: 520 } })
await context.addCookies([{ name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), domain: '127.0.0.1', path: '/' }])
const page = await context.newPage()
page.on('pageerror', error => say('页面异常：', error.message))

const SETTLED_BTN = '.tavern-send-btn:not([class*="sendStop"])'
const RUNNING_BTN = '.tavern-send-btn[class*="sendStop"]'
async function converse(text) {
  await page.waitForSelector(SETTLED_BTN, { timeout: TAIL_TIMEOUT })
  await page.fill('textarea', text)
  await page.locator('.tavern-send-btn').click()
  await page.waitForSelector(RUNNING_BTN, { timeout: 9000 }).catch(() => undefined)
  await page.waitForSelector(SETTLED_BTN, { timeout: TAIL_TIMEOUT })
  await page.waitForTimeout(700)
}

let mockLogText = ''
try {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /开启酒馆会话/ }).first().click()
  await page.locator(`[role="button"]:has-text("${BOOK_TEXT}")`).first().click({ timeout: 90_000 })
  await page.waitForSelector('.tavern-transcript', { timeout: 60_000 })
  say('④ 会话就绪（书卡：' + BOOK_TEXT + '）')
  await converse('推门试炼：走一段路，遇一件小事。')
  say('④ 第 1 回合落定（尾 fork 已排）')
  await converse('再走一步，收个尾。')
  say('④ 第 2 回合落定')
  // 证据先取：清场会连隔离家一起删，判决材料必须在 rm 前入内存。
  mockLogText = existsSync(MOCK_LOG) ? readFileSync(MOCK_LOG, 'utf8') : ''
} finally {
  await browser.close().catch(() => undefined)
  cleanup()
}

/* ---------- ⑤ 判决：mock JSONL 逐请求断言 ---------- */
if (mockLogText.trim() === '') {
  fail('mock 事件流为空——mock 未被命中或事件未落盘（可用 --keep 留尸检：' + MOCK_LOG + '）')
}
const requests = mockLogText.split('\n')
  .map(line => { try { return JSON.parse(line) } catch { return undefined } })
  .filter(event => event !== undefined && event.type === 'request' && event.body !== undefined)
  .map(event => event.body)
if (requests.length === 0) fail('mock JSONL 无 request 事件——mock 未被命中或事件流未落盘')

const mainRequests = requests.filter(body => JSON.stringify(body.messages ?? []).includes(TAIL_MARKER) === false)
const tailRequests = requests.filter(body => JSON.stringify(body.messages ?? []).includes(TAIL_MARKER))
say('⑤ 请求分类：主代理', mainRequests.length, '条 / 尾子', tailRequests.length, '条')
for (const [label, body] of [['主', mainRequests.at(-1)], ['尾', tailRequests.at(-1)]]) {
  if (body !== undefined) {
    say(`   ${label} 样本: model=${body.model} thinking=${JSON.stringify(body.thinking ?? null)}`,
      `enable_thinking=${JSON.stringify(body.enable_thinking)} output_config=${JSON.stringify(body.output_config ?? null)}`)
  }
}

if (tailRequests.length === 0) fail('无尾子请求——尾 fork 未触发（书卡缺维护提示词？）')
if (mainRequests.length === 0) fail('无主代理请求——异常')

// 锁 1 判决：尾子全量 thinking.type==='disabled'，且不携带 effort 档。
const tailBad = tailRequests.filter(body => body.thinking?.type !== 'disabled')
if (tailBad.length > 0) fail(`尾子请求存在非 disabled：${JSON.stringify(tailBad[0].thinking)}`)
const tailEffortLeak = tailRequests.filter(body => body.output_config !== undefined)
if (tailEffortLeak.length > 0) fail('尾子请求泄漏 output_config（off 不应带 effort 档）')

// GLM 桥判决：glm 路由镜像布尔——尾 false、主 true。
const tailMirrorBad = tailRequests.filter(body => body.enable_thinking !== false)
if (tailMirrorBad.length > 0) fail(`尾子镜像失败：enable_thinking=${JSON.stringify(tailMirrorBad[0].enable_thinking)}`)
const mainMirrorBad = mainRequests.filter(body => body.enable_thinking !== true)
if (mainMirrorBad.length > 0) fail(`主代理镜像失败：enable_thinking=${JSON.stringify(mainMirrorBad[0].enable_thinking)}（glm 路由应镜像 true）`)
// 主代理锁面：非 off（现网 effort low → thinking enabled）。
const mainOff = mainRequests.filter(body => body.thinking?.type === 'disabled')
if (mainOff.length > 0) fail('主代理请求被误关思考——覆写越界')

say('✓ 全链路判决成立：')
say('   尾子', tailRequests.length, '条全部 thinking={type:disabled}（off 不带 effort 档）+ enable_thinking=false')
say('   主代理', mainRequests.length, '条全部 thinking={type:enabled} + enable_thinking=true（glm 镜像）')
if (keep) say('   （--keep：隔离家保留在', HOME, '）')
