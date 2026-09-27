/**
 * E2E：galgame 卡回合失败演出 + 对话修复实测（Playwright-core,2026-09-27 通道批）。
 *
 * 前置：宿主已按目标 phase 的配置重启（settings.yaml 换装后必须 restart——
 * LLM 配置 boot 时快照）,--bg --no-open。本脚本不做环境改写,只验页面行为:
 *   --phase error  坏配置 boot:发送 → galgame 横幅(.gg-err)上屏,waiting 不耗
 *                  看门狗即刻回落;宿主转写红行(恒隐)仍按契约落行。
 *   --phase happy  正常配置:发送 → 回合落定(发送键形态回归), Furina 正文上屏、
 *                  横幅不得在场。
 *
 * 断言失败 exit 1。纯 node API,零 shell 拼接。鉴权链 = e2e-landing 同族(token
 * 单消费→兑 cookie);落定判据与 e2e-landing **有意分叉**:galgame 卡读段期把
 * composer 收进卡槽,发送键形态永远不可见——here 用宿主转写文本增长(模式无关)。
 * @module dsh-tavern-fengyue/scripts/e2e-gal-errorface
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const { chromium } = await import(`${REPO_ROOT}node_modules/playwright-core/index.mjs`)

const argv = process.argv.slice(2)
const PHASE = argv.includes('--phase') ? argv[argv.indexOf('--phase') + 1] : null
if (PHASE !== 'error' && PHASE !== 'happy') fail('用法: node scripts/e2e-gal-errorface.mjs --phase error|happy')
const BASE = argv.includes('--base') ? argv[argv.indexOf('--base') + 1] : 'http://127.0.0.1:3081'
const dshHome = process.env['DSH_HOME'] ?? join(homedir(), '.dsh-tavern-fengyue')
const LOG = join(dshHome, 'logs', 'tavern-fengyue.log')

const say = (...args) => console.log('[e2e-gal]', ...args)
function fail(message) { console.error('[e2e-gal] ✗', message); process.exit(1) }
function ok(message) { say('✓', message) }

/** 从日志尾取最新 boot URL(token 单消费:不跑 status 探针)。 */
function latestBootUrl() {
  if (!existsSync(LOG)) fail(`宿主日志不存在:${LOG}(先 bin/dev.mjs restart --bg --no-open)`)
  const urls = [...readFileSync(LOG, 'utf8').matchAll(/dsh web: (\S+token=\S+)/g)].map(m => m[1])
  if (urls.length === 0) fail('日志中无启动 URL(宿主未完成 boot)')
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

/* 发送/停止同节点变身(铁律):落定 = 发送键形态回归。 */
/* galgame 面板内页面事实(fail-visible 家族:断言读真身,不读代理)。 */
async function galFacts(page) {
  return await page.evaluate(() => {
    const panel = document.querySelector('.tavern-panel-galgame')
    const err = document.querySelector('.gg-err')
    const transcript = document.querySelector('.tavern-transcript')
    return {
      panel: panel !== null && panel.classList.contains('gg-waiting'),
      errShown: err !== null && err.style.display === 'block',
      errText: err?.textContent ?? null,
      // 构建产物 CSS modules 会哈希类名(.ga666a_errMsg)——按后缀包含匹配,不读源码名。
      errMsgRows: transcript?.querySelectorAll('[class*="errMsg"]')?.length ?? -1,
    }
  })
}

/* ---------- 主体 ---------- */

const cookie = await exchangeCookie()
say('cookie 兑换 OK(', cookie.name, ')')

let browser
try { browser = await chromium.launch({ channel: 'chrome', headless: true }) } catch (error) {
  say('系统 Chrome 通道不可用,回退内建 chromium:', error.message)
  browser = await chromium.launch({ headless: true })
}
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await context.addCookies([{ ...cookie, domain: '127.0.0.1', path: '/' }])
const page = await context.newPage()
page.on('pageerror', (error) => say('页面异常:', error.message))

try {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  // 芙宁娜卡会话:卡库新会话走「编辑卡→保存并开始」同款入口(卡件 = 库内最新快照)。
  await page.getByRole('button', { name: /开启酒馆会话/ }).first().click()
  await page.locator('[role="button"]:has-text("芙宁娜")').first().click()
  await page.waitForSelector('.tavern-panel-galgame', { timeout: 60_000 })
  // composer 目标收窄到卡槽内(G3 停靠):页面可能瞬态出现别的 textarea,散选会误发。
  await page.waitForSelector('.gg-dock-slot textarea', { timeout: 60_000 })
  // 输入态落定窗:boot → input 的桥拍(facts 由脚本轮询)。
  for (let waits = 0; waits < 10; waits += 1) {
    const ready = await page.evaluate(() => {
      const dialog = document.querySelector('.gg-dialog')
      const slot = document.querySelector('[data-dock-slot="composer"]')
      return dialog?.classList.contains('gg-input') === true && slot !== null && getComputedStyle(slot).display !== 'none'
    })
    if (ready === true) break
    await page.waitForTimeout(1000)
  }
  ok('芙宁娜 galgame 会话就绪(面板 + input 态 + 卡槽 composer)')

  const draft = PHASE === 'error' ? '今晚也请多指教' : '好久不见,芙宁娜。今晚的枫丹,有什么好戏吗?'
  await page.fill('.gg-dock-slot textarea', draft)
  const sendSel = '.gg-dock-slot .tavern-send-btn:not([class*="sendStop"])'
  try {
    await page.locator(sendSel).click({ timeout: 15_000 })
  } catch {
    // 现场转储再失败转抛——fail-visible,不给黑盒驱动留死角
    const dump = await galFacts(page)
    fail(`发送键 15s 不可点:${JSON.stringify(dump)}`)
  }
  ok('发送已受理')

  if (PHASE === 'error') {
    // 失败拍:横幅应在 provider 报错(秒级-分部级)即上屏,而非 120s 看门狗静默。
    const deadline = Date.now() + 90_000
    let facts = null
    while (Date.now() < deadline) {
      await page.waitForTimeout(1000)
      facts = await galFacts(page)
      if (facts.errShown === true) break
    }
    if (facts === null || facts.errShown !== true) fail(`横幅未上屏(90s 内):${JSON.stringify(facts)}`)
    ok(`失败横幅上屏:「${facts.errText?.slice(0, 100)}」`)
    // 快败竞态两序皆容:② 先到(慢败)即刻回落;② 迟到(快败,404 级)由回声锁消化——15s 窗内必须回到非 waiting。
    const settleAt = Date.now() + 15_000
    while (Date.now() < settleAt) {
      if (facts.panel !== true) break
      await page.waitForTimeout(500)
      facts = await galFacts(page)
    }
    if (facts.panel === true) fail('waiting 15s 未消——失败回落/回声锁契约未生效')
    ok('失败回落生效(input 态,未耗看门狗)')
    if (facts.errMsgRows < 1) fail('宿主转写 .errMsg 红行缺席——宿主侧失败记录回归受损')
    ok(`宿主转写红行按契约落行(${facts.errMsgRows} 条,恒隐但事实在场)`)
  } else {
    // 落定判据换血(galgame 形制):读段期 composer 收进卡槽,发送键形态判据
    // (`waitSettled`)对本卡恒不可见——改读宿主转写整段文本(模式无关)增长。
    await page.waitForTimeout(1500)
    const before = await page.evaluate(() => document.querySelector('.tavern-transcript')?.textContent ?? '')
    const deadline = Date.now() + 300_000
    let settled = false
    let lastLen = -1
    let stable = 0
    while (Date.now() < deadline) {
      await page.waitForTimeout(1500)
      const now = await page.evaluate(() => ({
        text: document.querySelector('.tavern-transcript')?.textContent ?? '',
        hasErrRow: (document.querySelector('[class*="errMsg"]') ?? null) !== null,
      }))
      if (now.hasErrRow) fail('转写出现失败红行——回合失败了')
      if (now.text.length > before.length) {
        if (now.text.length === lastLen) {
          stable += 1
          if (stable >= 2) { settled = true; break }
        } else {
          stable = 0
          lastLen = now.text.length
        }
      }
    }
    if (settled !== true) fail('300s 内转写未出现落定回复(文本不增长)')
    ok(`回合落定:转写增长 ${before.length} → ${Math.max(lastLen + before.length, before.length)} 字符上下`)

    const finalFact = await page.evaluate(() => {
      const t = document.querySelector('.gg-text')
      const err = document.querySelector('.gg-err')
      const errRows = document.querySelectorAll('[class*="errMsg"]').length
      return { dialogText: t?.textContent ?? '', errShown: err !== null && err.style.display === 'block', errText: err?.textContent ?? '', errRows }
    })
    if (finalFact.errShown === true) fail(`回复落地后失败横幅不得在场:「${finalFact.errText}」`)
    ok('失败横幅不在场(成功拍)')
    if (finalFact.errRows > 0) fail('宿主转写存在红行——修复后的回合不应失败')
    ok('宿主转写零红行(回合成功)')
  }
  say('全部断言通过 ✓')
} finally {
  if (browser !== undefined) await browser.close().catch(() => undefined)
}
