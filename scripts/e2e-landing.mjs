/**
 * E2E：转写着陆链路实测（Playwright-core，2026-09-25 着陆合约批）。
 *
 * 前置：宿主已以 --no-open 后台运行（`bin/dev.mjs start --bg --no-open`）。
 * 本脚本：从宿主日志尾部取 boot token（单消费，失败即响）→ 兑 dsh-auth
 * cookie → Playwright(headless 系统 Chrome 通道，免下载) 驱动真实宿主页面：
 *   ① boot 无锚贴底跟随  ② 多轮对话流式跟随  ③ 上滚离开带
 *   ④ 切会话再切回 = 位置恢复  ⑤ 刷新 = 位置恢复（localStorage 锚在场）
 *   ⑥ 载入存档 = 存档点落底（fork 切短后不剧透）  ⑦ 回底灯接回跟随
 *   ⑧ 发送即回到跟随
 *
 * 断言失败 exit 1。跨平台：纯 node API，零 shell 拼接。
 * 用法：node scripts/e2e-landing.mjs [--base http://127.0.0.1:3081]
 * @module dsh-tavern-fengyue/scripts/e2e-landing
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
const dshHome = process.env['DSH_HOME'] ?? join(homedir(), '.dsh-tavern-fengyue')
const LOG = join(dshHome, 'logs', 'tavern-fengyue.log')

const say = (...args) => console.log('[e2e]', ...args)
const fail = (message) => { console.error('[e2e] ✗', message); process.exit(1) }

/** 从日志尾取最新 boot URL（token 单消费：本脚本不跑 status 探针）。 */
function latestBootUrl() {
  if (!existsSync(LOG)) fail(`宿主日志不存在：${LOG}（先 bin/dev.mjs start --bg --no-open）`)
  const urls = [...readFileSync(LOG, 'utf8').matchAll(/dsh web: (\S+token=\S+)/g)].map(m => m[1])
  if (urls.length === 0) fail('日志中无启动 URL（宿主未完成 boot）')
  return urls.at(-1)
}

async function exchangeCookie() {
  const first = await fetch(latestBootUrl(), { redirect: 'manual', signal: AbortSignal.timeout(8000) })
  const raw = first.headers.get('set-cookie') ?? ''
  if (raw === '') fail(`token 兑换失败(HTTP ${first.status})——token 已被消费,重启宿主后重跑`)
  const [pair] = raw.split(';')
  const i = pair.indexOf('=')
  return { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim() }
}

/* ---------- 页面驱动助手（选择器全部取自源码稳定结构/class 钩子） ---------- */

const TRANS = '.tavern-transcript'

async function facts(page) {
  return await page.evaluate((sel) => {
    const el = document.querySelector(sel)
    if (el === null) return null
    return { top: el.scrollTop, height: el.scrollHeight, client: el.clientHeight }
  }, TRANS)
}
const nearFloor = (fact) => fact.height - fact.top - fact.client <= 80

async function scrollTo(page, ratio) {
  await page.evaluate(({ sel, ratio }) => {
    const el = document.querySelector(sel)
    el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * ratio)
    el.dispatchEvent(new Event('scroll'))
  }, { sel: TRANS, ratio })
}

/* 发送/停止是同一个 .tavern-send-btn 节点变身：受理前 = 发送键（无 sendStop 类），
   受理后（流式/尾闸门任一在跑）= 停止键（sendStop 类,仅图标）。「落定」判据 =
   发送键形态回归——比数行数可靠（思考/工具为主的回合不保证新增叙事行）。 */
const SETTLED_BTN = '.tavern-send-btn:not([class*="sendStop"])'
const RUNNING_BTN = '.tavern-send-btn[class*="sendStop"]'

async function waitSettled(page, timeout = 480_000) {
  await page.waitForSelector(SETTLED_BTN, { timeout })
}

/** 发送一条消息并等回合落定（含尾代理闸门）。 */
async function converse(page, text) {
  await waitSettled(page)
  await page.fill('textarea', text)
  await page.locator('.tavern-send-btn').click()
  await page.waitForSelector(RUNNING_BTN, { timeout: 9000 }).catch(() => undefined)
  await waitSettled(page)
  await page.waitForTimeout(700)
}

/** 建会话 + 从卡库选第一张卡，等聊天面就绪。 */
async function createCardSession(page) {
  await page.getByRole('button', { name: /开启酒馆会话/ }).first().click()
  await page.locator('[role="button"][class*="book"], [role="button"]:has-text("DND")').first().click()
  await page.waitForSelector(TRANS, { timeout: 60_000 })
}

/** 头一个「发送」后 3s 内是否弹 Key 对话框（无 key = 降级链路）。 */
async function detectKeyDialog(page) {
  try {
    await page.waitForSelector('text=配置 DeepSeek API Key', { timeout: 3000 })
    return true
  } catch { return false }
}

/* ---------- 主体 ---------- */

const cookie = await exchangeCookie()
say('cookie 兑换 OK（', cookie.name, '）')

let browser
try { browser = await chromium.launch({ channel: 'chrome', headless: true }) } catch (error) {
  say('系统 Chrome 通道不可用，回退内建 chromium：', error.message)
  browser = await chromium.launch({ headless: true })
}
const context = await browser.newContext({ viewport: { width: 1280, height: 520 } })
await context.addCookies([{ ...cookie, domain: '127.0.0.1', path: '/' }])
const page = await context.newPage()
page.on('pageerror', (error) => say('页面异常：', error.message))

try {
  // ① 会话 A：boot 无锚 → 贴底。
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await createCardSession(page)
  say('① 会话 A 就绪')
  let fact = await facts(page)
  if (fact === null) fail('滚动容器不存在')
  if (!nearFloor(fact)) fail(`① boot 应贴底跟随：${JSON.stringify(fact)}`)
  say('① boot 贴底 ✓', JSON.stringify(fact))

  // ② 多轮对话：三问三答；首发送探测 Key；每轮落定必须贴底跟随。
  await page.fill('textarea', '推门看看酒馆')
  await page.locator('.tavern-send-btn:not([class*="sendStop"])').click()
  const keyDialogSeen = await detectKeyDialog(page)
  const hasKey = !keyDialogSeen
  if (!hasKey) {
    await page.getByLabel('关闭').first().click()
    await page.waitForTimeout(800)
    say('② 无 API Key：回复链路降级（用户行驱动），着陆链路继续')
  } else {
    await waitSettled(page)
    await page.waitForTimeout(700)
    say('② 第 1 轮落定')
  }
  fact = await facts(page)
  if (!nearFloor(fact)) fail(`② 落定后应贴底跟随：${JSON.stringify(fact)}`)
  if (hasKey) {
    await converse(page, '向酒保打招呼')
    await converse(page, '环视一圈说说场景')
    fact = await facts(page)
    if (!nearFloor(fact)) fail(`② 第三轮落定应贴底跟随：${JSON.stringify(fact)}`)
    say('② 三轮对话全部落定且跟随 ✓')
  }

  // ③ 上滚离带（固定 40% 处）。位置在切走时要被锚存。
  await scrollTo(page, 0.4)
  fact = await facts(page)
  if (nearFloor(fact) && fact.height - fact.client > 160) fail('③ 上滚应离开 80px 带')
  const readingTop = fact.top
  const dumpA = await page.evaluate(() => ({
    anchors: Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('tavern.readerAnchor.')).map(k => [k, localStorage.getItem(k)])),
    tops: Object.fromEntries([...document.querySelectorAll('[data-seq]')].map(n => [n.getAttribute('data-seq'), Math.round(n.getBoundingClientRect().top + document.querySelector('.tavern-transcript').scrollTop)])),
  }))
  say('③ 锚存层:', JSON.stringify(dumpA.anchors))
  say('③ 内容坐标:', JSON.stringify(dumpA.tops))

  // ④ 建 B 并切回 A：恢复位置（±4px）。
  await createCardSession(page)
  if (hasKey) { await converse(page, 'B 会话说一句') } else {
    await page.fill('textarea', 'B 会话说一句')
    await page.locator('.tavern-send-btn:not([class*="sendStop"])').click()
    await page.waitForTimeout(1500)
  }
  say('④ 会话 B 就绪')
  const anchorDump = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith('tavern.readerAnchor.')).map(k => [k, localStorage.getItem(k)])))
  say('④ 锚存层(切走后):', JSON.stringify(anchorDump))
  const seqAtCapture = await page.evaluate(() => {
    const el = document.querySelector('.tavern-transcript')
    return { top: el?.scrollTop ?? -1, client: el?.clientHeight ?? -1, height: el?.scrollHeight ?? -1 }
  })
  say('④ B 视图事实:', JSON.stringify(seqAtCapture))
  // 侧栏第一行的会话卡是当前视图（B 在上，A 在下）——回 A 点第二个 sessionCard。
  await page.locator('button[class*="sessionCard"]').nth(1).click()
  await page.waitForTimeout(900)
  fact = await facts(page)
  const dumpB = await page.evaluate(() => ({
    tops: Object.fromEntries([...document.querySelectorAll('[data-seq]')].map(n => [n.getAttribute('data-seq'), Math.round(n.getBoundingClientRect().top + document.querySelector('.tavern-transcript').scrollTop)])),
    top: document.querySelector('.tavern-transcript')?.scrollTop ?? -1,
  }))
  say('④ 回A top:', dumpB.top)
  const drift = []
  for (const [seq, a] of Object.entries(dumpA.tops)) {
    const b = dumpB.tops[seq]
    if (b !== undefined && b !== a) drift.push(`${seq}:${a}->${b}(${b - a})`)
  }
  say('④ 行高差:', drift.length === 0 ? '(无)' : drift.join(' '))
  if (Math.abs(fact.top - readingTop) > 4) fail(`④ 切回 A 应恢复到 ${readingTop}，实际 ${fact.top}`)
  say('④ 切回 A 恢复到', fact.top, '✓')
  const storedAnchor = await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('tavern.readerAnchor.')) return { key, value: localStorage.getItem(key) }
    }
    return null
  })
  if (storedAnchor === null) say('④ 注意：锚存键未读到（A 的 localStorage 键可能被 LRU 分配）')
  else say('④ 锚存层在 localStorage：', storedAnchor.key, storedAnchor.value)

  // ⑤ 刷新：恢复仍生效。
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector(TRANS, { timeout: 30_000 })
  await page.waitForTimeout(1500)
  fact = await facts(page)
  if (Math.abs(fact.top - readingTop) > 4) fail(`⑤ 刷新后应恢复 ${readingTop}，实际 ${fact.top}`)
  say('⑤ 刷新后恢复到', fact.top, '✓')

  // ⑥ 载入存档：头部「加载」→ 存档页第一行「载入」→ 落在存档点（贴底）。
  await page.getByRole('button', { name: '加载' }).click()
  await page.waitForSelector('text=存档记录', { timeout: 10_000 }).catch(() => undefined)
  const loadButtons = page.locator('button:has-text("载入")')
  if (await loadButtons.count() === 0) say('⑥ 此卡无存档行,跳过⑥（载入链路由单组件 spec 锚定）')
  else {
    await loadButtons.first().click()
    await page.waitForTimeout(2000)
    fact = await facts(page)
    if (!nearFloor(fact)) fail(`⑥ 载入应落在存档点(贴底)：${JSON.stringify(fact)}`)
    say('⑥ 载入存档后在存档点（贴底）：', fact.top, '✓')
  }
  await page.locator('[aria-label="关闭"]').first().click().catch(() => undefined)

  // ⑦ 回底灯：上滚后灯应出现，点击接回跟随之。
  await scrollTo(page, 0.4)
  const lamp = page.getByRole('button', { name: '回到底部' })
  if (!await lamp.isVisible()) fail('⑦ 不跟随态应出现「回到底部」灯')
  await lamp.click()
  await page.waitForTimeout(400)
  fact = await facts(page)
  if (!nearFloor(fact)) fail(`⑦ 点灯后应接回跟随：${JSON.stringify(fact)}`)
  say('⑦ 回底灯接回跟随 ✓')

  // ⑧ 发送即回到跟随：发送后（若 key 可用则等落定）保持贴底。
  if (hasKey) await converse(page, '继续剧情')
  else {
    await page.fill('textarea', '继续剧情')
    await page.locator('.tavern-send-btn:not([class*="sendStop"])').click()
    await page.waitForTimeout(1500)
  }
  fact = await facts(page)
  if (!nearFloor(fact)) fail(`⑧ 发送后应贴底跟随：${JSON.stringify(fact)}`)
  say('⑧ 发送后贴底跟随 ✓')

  say('★ 全链路实测通过 ✓')
} catch (error) {
  await page.screenshot({ path: join(tmpdir(), 'e2e-landing-fail.png') }).catch(() => undefined)
  fail(`${error.message}\n截图: ${join(tmpdir(), 'e2e-landing-fail.png')}`)
} finally {
  await browser.close().catch(() => undefined)
}
