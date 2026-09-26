/**
 * E2E-定向：galgame 段读位（2026-09-25 补批）——芙宁娜卡内「点到第几句」跨切卡/刷新存活。
 * 链路（真卡真回复）：input 发送 → 回复落定进 reading → 点读补完→推进到段2（存位更新）
 * → 整页 reload（= 最狠的往返形态）→ 断言恢复「读到的那段」而非直落 input。
 * 用法：node scripts/e2e-gal-reader.mjs [--base http://127.0.0.1:3081]
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
const say = (...a) => console.log('[e2e]', ...a)
const fail = (m) => { console.error('[e2e] ✗', m); process.exit(1) }

const urls = [...readFileSync(LOG, 'utf8').matchAll(/dsh web: (\S+token=\S+)/g)].map(m => m[1])
if (!existsSync(LOG) || urls.length === 0) fail('无 boot URL')
const first = await fetch(urls.at(-1), { redirect: 'manual', signal: AbortSignal.timeout(8000) })
const raw = first.headers.get('set-cookie') ?? ''
if (raw === '') fail('token 已消费——重启宿主重跑')
const [pair] = raw.split(';')
const i = pair.indexOf('=')
const cookie = { name: pair.slice(0, i).trim(), value: pair.slice(i + 1).trim() }

let browser
try { browser = await chromium.launch({ channel: 'chrome', headless: true }) } catch { browser = await chromium.launch({ headless: true }) }
const context = await browser.newContext({ viewport: { width: 1400, height: 860 } })
await context.addCookies([{ ...cookie, domain: '127.0.0.1', path: '/' }])
const page = await context.newPage()
page.on('pageerror', (e) => say('页面异常：', e.message))

const state = () => page.evaluate(() => document.querySelector('.gg')?.dataset.state ?? 'NO-GG')
const pointer = () => page.evaluate(() => localStorage.getItem('gg.reader.pointers'))
// backlog 防剧透(2026-09-25 第二弹):当前回复在历史里的已读行数(末行 assistant,
// 有效行 trim 非空——与 readEnd 截断口径一致)。剧透 → 整行全文 = 全段行数。
const blRead = () => page.evaluate(() => {
  const rows = Array.from(document.querySelectorAll('.bl-row.a .bl-text'))
  const last = rows.length > 0 ? rows[rows.length - 1].textContent ?? '' : ''
  return last.split('\n').filter(t => t.trim() !== '').length
})

const SETTLED = '.tavern-send-btn:not([class*="sendStop"])'
const RUNNING = '.tavern-send-btn[class*="sendStop"]'

try {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  // 重启后可能「没有会话」:点侧栏芙宁娜行进卡。
  await page.waitForTimeout(2500)
  if (await page.locator('.gg-dialog').count() === 0) {
    await page.locator('button[class*="sessionCard"]:has-text("芙宁娜")').first().click({ timeout: 30_000 })
    say('① 已从侧栏切入芙宁娜会话')
  }
  await page.waitForSelector('.gg-dialog', { timeout: 90_000 })
  await page.waitForFunction(() => {
    const s = document.querySelector('.gg')?.dataset.state ?? ''
    return s.includes('mode=input') || s.includes('mode=reading')
  }, { timeout: 30_000 })
  say('① galgame 面就绪:', await state(), '| 存位:', await pointer())

  // 若正处 reading(上次遗留),先点完到 input,保证从干净输入态起跑。
  while ((await state()).includes('reading')) {
    await page.click('.gg-dialog')
    await page.waitForTimeout(400)
  }
  say('② 干净 input 态:', await state())

  // 发送一条要求分段的请求;等回复落定(发送键形态)。
  await page.fill('textarea', '请恰好分四段向我介绍你自己,每段一句,段间换行')
  await page.locator(SETTLED).first().click()
  await page.waitForSelector(RUNNING, { timeout: 9000 }).catch(() => undefined)
  // 落定判据:发送键回到「在场 attached」(reading 态停靠语义下它会被卡 CSS 藏起,
  // 不可见但在场)且卡内状态机离开 waiting。
  await page.waitForSelector(SETTLED, { timeout: 480_000, state: 'attached' })
  await page.waitForFunction(() => {
    const s = document.querySelector('.gg')?.dataset.state ?? ''
    return s.includes('mode=reading') || s.includes('mode=input')
  }, { timeout: 120_000 })
  // 回复落定后卡应进入 reading(首段演绎)。
  await page.waitForFunction(() => (document.querySelector('.gg')?.dataset.state ?? '').includes('mode=reading'),
    { timeout: 60_000 })
  const st1 = await state()
  if (!st1.includes('段 1/')) say('② 落定后不在段1(段数可能少于4):', st1)
  say('② 回复落定,进入 reading:', st1)

  // 点读:补完打字 → 推进到段2 → 存位应记录 r=1。
  await page.click('.gg-dialog')          // 补完当前段
  await page.waitForTimeout(300)
  await page.click('.gg-dialog')          // 推进下一段
  await page.waitForTimeout(400)
  const st2 = await state()
  const p1 = await pointer()
  say('③ 点读到:', st2, '| 存位:', p1, '| 历史已读行:', await blRead())
  if (!st2.includes('段 2/')) fail(`③ 应停在段2,实际 ${st2}（回复可能不足两段）`)
  if (!(p1 ?? '').includes('"r":1')) fail(`③ 存位未记录 r=1:${String(p1)}`)
  // 历史防剧透:读到段2 → 历史当前行恰 2 行(段≥3 时必然截断,剧透即露馅)。
  const read3 = await blRead()
  if (read3 !== 2) fail(`③ 历史已读行应=2,实际 ${read3}（剧透或行口径漂移）`)

  // ★ 用户原话链路:点的不是 reload,是真点击另一张卡的侧栏行「切卡」,再点回芙宁娜行。
  await page.locator('button[class*="sessionCard"]:has-text("DND")').first().click({ timeout: 30_000 })
  await page.waitForTimeout(2500)
  const stAway = await state()
  say('④ 切到 DND 卡(离开芙宁娜):', stAway)
  await page.locator('button[class*="sessionCard"]:has-text("芙宁娜")').first().click({ timeout: 30_000 })
  await page.waitForSelector('.gg-dialog', { timeout: 90_000 })
  await page.waitForFunction(() => {
    const s = document.querySelector('.gg')?.dataset.state ?? ''
    return s.includes('mode=reading') || s.includes('mode=input')
  }, { timeout: 60_000 })
  const st3 = await state()
  const pBack = await pointer()
  const readBack = await blRead()
  say('④ 切回芙宁娜后:', st3, '| 存位:', pBack, '| 历史已读行:', readBack)
  if (!st3.includes('mode=reading') || !st3.includes('段 2/')) fail(`④ 切卡往返后应恢复段2 reading,实际 ${st3}`)
  // 历史防剧透跨往返:恢复段2 → 历史仍只截到 2 行(修前 boot 漏设 asstText,守卫
  // 失效整行全文上屏——用户报告第二弹的真机断言)。
  if (readBack !== 2) fail(`④ 往返后历史已读行应=2,实际 ${readBack}（剧透:未读段整行露面）`)
  // 点一条推进到段3 → 历史同步多展一段(「点完一条消息后历史多展示下一段」)。
  await page.click('.gg-dialog')
  await page.waitForTimeout(300)
  await page.click('.gg-dialog')
  await page.waitForTimeout(400)
  const readNext = await blRead()
  say('⑤ 再点一段后:', await state(), '| 历史已读行:', readNext)
  if (readNext !== 3) fail(`⑤ 推进后历史已读行应=3,实际 ${readNext}（历史未随点读前进）`)
  say('★ galgame 段读位全链路通过 ✓（真·切卡往返形态 + 防剧透闭环）')
} catch (error) {
  await page.screenshot({ path: join(tmpdir(), 'e2e-gal-fail.png') }).catch(() => undefined)
  fail(`${error.message}（截图 ${join(tmpdir(), 'e2e-gal-fail.png')}）`)
} finally {
  await browser.close().catch(() => undefined)
}
