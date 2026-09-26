/**
 * E2E-定向：用户原始 repro——**回复流式中**切走会话再切回，应停在离开位置。
 * 覆盖 ①流式受理中上滚 ②流式中切走 ③缺席期间回复落定 ④切回=恢复而非跳最新。
 * 用法：node scripts/e2e-stream-switch.mjs [--base http://127.0.0.1:3081]
 */
import { existsSync, readFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const { chromium } = await import(`${REPO_ROOT}node_modules/playwright-core/index.mjs`)
const argv = process.argv.slice(2)
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://127.0.0.1:3081'
const LOG = join(process.env['DSH_HOME'] ?? join(homedir(), '.dsh-tavern-fengyue'), 'logs', 'tavern-fengyue.log')
const say = (...args) => console.log('[e2e]', ...args)
const fail = (m) => { console.error('[e2e] ✗', m); process.exit(1) }

const urls = [...readFileSync(LOG, 'utf8').matchAll(/dsh web: (\S+token=\S+)/g)].map(m => m[1])
if (!existsSync(LOG) || urls.length === 0) fail('无 boot URL')
const first = await fetch(urls.at(-1), { redirect: 'manual', signal: AbortSignal.timeout(8000) })
const raw = first.headers.get('set-cookie') ?? ''
if (raw === '') fail('token 已消费——重启宿主重跑')
const [pair] = raw.split(';')
const i = pair.indexOf('=')
const cookie = { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim() }

const TRANS = '.tavern-transcript'
const facts = (page) => page.evaluate((sel) => {
  const el = document.querySelector(sel)
  return el === null ? null : { top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight }
}, TRANS)

let browser
try { browser = await chromium.launch({ channel: 'chrome', headless: true }) } catch { browser = await chromium.launch({ headless: true }) }
const context = await browser.newContext({ viewport: { width: 1280, height: 520 } })
await context.addCookies([{ ...cookie, domain: '127.0.0.1', path: '/' }])
const page = await context.newPage()
page.on('pageerror', (e) => say('页面异常：', e.message))
page.on('console', (msg) => { if (msg.type() === 'error') say('console.error:', msg.text().slice(0, 200)) })

try {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  // 会话 A：卡选第一张；会话 B：第二张（切走目标先建好，后续切换 = 纯侧栏点击）。
  await page.getByRole('button', { name: /开启酒馆会话/ }).first().click()
  // 库页卡片冷启动可能晚到（封面/元数据一串读），等待放宽到 90s。
  // 只挑 DND 系卡（芙宁娜是 galgame 卡:宿主 composer 被停靠,等待态下不可见,E2E 不便驾驶）。
  await page.locator('[role="button"][class*="book"]:has-text("DND")').first().click({ timeout: 90_000 })
  await page.waitForSelector(TRANS, { timeout: 60_000 })
  say('① 会话 A 就绪')
  // 建 B。
  await page.getByRole('button', { name: /开启酒馆会话/ }).first().click()
  await page.locator('[role="button"][class*="book"]:has-text("DND")').nth(1).click({ timeout: 90_000 })
  await page.waitForSelector(TRANS, { timeout: 60_000 })
  await page.waitForTimeout(800)
  say('② 会话 B 就绪')
  // 回 A。
  await page.locator('button[class*="sessionCard"]').nth(1).click()
  await page.waitForTimeout(1000)

  // 第一问（落定，撑起内容）。
  await page.waitForSelector('.tavern-send-btn:not([class*="sendStop"])', { timeout: 30_000 })
  await page.fill('textarea', '推门环视酒馆描述一下')
  await page.locator('.tavern-send-btn').click()
  await page.waitForSelector('.tavern-send-btn[class*="sendStop"]', { timeout: 9000 }).catch(() => undefined)
  await page.waitForSelector('.tavern-send-btn:not([class*="sendStop"])', { timeout: 480_000 })
  await page.waitForTimeout(800)
  say('③ 第 1 轮落定')
  if (await page.getByText('配置 DeepSeek API Key').count() > 0) fail('该宿主无 API Key：本复现需要真实流式回复')

  // ★ 第二问：受理进入流式（stop 键在场），随后上滚离开带。
  await page.fill('textarea', '向酒保要一杯麦酒闲聊几句')
  await page.locator('.tavern-send-btn').click()
  await page.waitForSelector('.tavern-send-btn[class*="sendStop"]', { timeout: 9000 })
    .catch(() => say('!! 未观测到受理态（回复可能过快落定）——继续按流式窗口尝试'))
  await page.waitForTimeout(1200) // 流式进行中
  await page.evaluate(() => {
    const el = document.querySelector('.tavern-transcript')
    el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * 0.35)
    el.dispatchEvent(new Event('scroll'))
  })
  const before = await facts(page)
  const dumpBef = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-seq]')].map(n => [n.getAttribute('data-seq'), Math.round(n.getBoundingClientRect().top + document.querySelector('.tavern-transcript').scrollTop)])))
  say('④ 流式中上滚停在', JSON.stringify(before), '内容坐标:', JSON.stringify(dumpBef))
  if (before.height - before.top - before.client <= 80) fail('④ 上滚应离开带（流式窗口太短？加长首轮内容）')
  const readingTop = before.top

  // ★ 流式中切走（A→B），等 A 的回复在缺席下落定。
  await page.locator('button[class*="sessionCard"]').nth(0).click()
  await page.waitForTimeout(500)
  const anchorDump = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('tavern.readerAnchor.')).map(k => [k, localStorage.getItem(k)])))
  say('⑤ 切走后锚存层:', JSON.stringify(anchorDump))
  await page.waitForSelector('.tavern-send-btn:not([class*="sendStop"])', { timeout: 480_000 })
  await page.waitForTimeout(2000)
  say('⑥ A 的回复已在缺席中落定（B 视图空闲）')

  // 切回 A：期望落在 readingTop ±4，绝不落底。
  await page.locator('button[class*="sessionCard"]').nth(1).click()
  await page.waitForTimeout(1200)
  const after = await facts(page)
  const dumpAft = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-seq]')].map(n => [n.getAttribute('data-seq'), Math.round(n.getBoundingClientRect().top + document.querySelector('.tavern-transcript').scrollTop)])))
  const drift = Object.entries(dumpBef).flatMap(([seq, a]) => { const b = dumpAft[seq]; return b !== undefined && b !== a ? [`${seq}:${a}->${b}(${b - a})`] : [] })
  say('④⑦ 行坐标差:', drift.length === 0 ? '(无)' : drift.join(' '))
  const kinds = await page.evaluate(() => [...document.querySelectorAll('[data-seq]')].slice(0, 12).map(n => `${n.getAttribute('data-seq')}:${n.className.split(' ').pop()}`).join(' | '))
  say('⑦ 行类名样本:', kinds)
  say('⑦ 切回后 top =', after.top, '（离开时', readingTop, '，总高', after.height, '）')
  const anchorDump2 = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('tavern.readerAnchor.')).map(k => [k, localStorage.getItem(k)])))
  say('⑦ 锚存层:', JSON.stringify(anchorDump2))
  if (Math.abs(after.top - readingTop) > 4) fail(`⑦ 应恢复到 ${readingTop}，实际 ${after.top}（偏差 ${after.top - readingTop}px）`)
  say('★ 流式中切走再切回：位置保持 ✓')
} catch (error) {
  await page.screenshot({ path: join(tmpdir(), 'e2e-stream-fail.png') }).catch(() => undefined)
  fail(`${error.message}（截图 ${join(tmpdir(), 'e2e-stream-fail.png')}）`)
} finally {
  await browser.close().catch(() => undefined)
}
