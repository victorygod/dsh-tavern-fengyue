// @vitest-environment node
// dnd5e 成长流浏览器回归(playwright-core,无头 Chrome——按「不弹真浏览器」纪律)。
// 真模块真样式挂进临时 fixture 页(preset/ui/ 同层,file:// 同目录模块可 import):
// ①面板链(呼应对话框/待办 chip) ②对话框居中+token 不透明 ③±列表 delta ④保存双通道落 fixture 机械层
// ⑤vtip 0.1s ⑥头像 138% 裁层 ⑦截图人工比对原型 docs/hud-proto-grow.html。
// Chrome 缺席环境整体跳过(静默 skip,不假绿——skip 明 writing Reasons)。
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..', '..')
const UI = join(ROOT, 'tavern_presets', 'dnd5e', 'preset', 'ui')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const hasChrome = existsSync(CHROME)

let pw: typeof import('playwright-core') | null = null
let browser: import('playwright-core').Browser | null = null
const artifacts: string[] = []

beforeAll(async () => {
  if (!hasChrome) return
  pw = await import('playwright-core')
  browser = await pw.chromium.launch({ headless: true, executablePath: CHROME, args: ['--allow-file-access-from-files'] })   // file:// 模块同目录 import 需要
})

afterAll(() => {
  browser?.close().catch(() => {})
  rmSync(join(UI, '__e2e_fixture.html'), { force: true })
})

/** 各件套 + 真 runtime/view/acts + 可变 fixture 机械层(stateful 假 front_commit 真正改 player 态)。 */
function fixturePage(): string {
  const css = readFileSync(join(UI, 'ui.css'), 'utf8')
  return `<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><style>${css}
    body { background: radial-gradient(120% 90% at 50% 40%, #e9dfc9 0%, #dfd3ba 62%, #d5c7a7 100%); min-height: 100vh; margin: 0; }
    .tavern-stage { position: relative; height: 100vh; }
  </style></head><body>
  <div class="tavern-stage">
    <div class="tavern-panel-hud-left"></div>
    <div class="tavern-panel-hud-right"></div>
  </div>
  <script type="module">
    import { mountPanels } from './runtime.mjs'
    import * as views from './view.mjs'
    import * as acts from './views-placeholder-acts.mjs'
  </script>
  </body></html>`
}

// 占位导出被上面模板引用——真实 fixture 用 acts 同名文件,模板里直接替换 import 行
function writeFixture() {
  let html = fixturePage().replace('views-placeholder-acts.mjs', 'acts.mjs')
  const player = {
    name: '洛克', gender: 'male', level: 4, race: 'human', class: 'wizard', role: 'pc',
    hp: 20, hp_max: 26, temp_hp: 0, exhaustion: 0, speed: 30, darkvision: 60, armor: null, shield: false,
    str: 10, dex: 14, con: 14, int: 16, wis: 12, cha: 11,
    skill_prof: ['arcana'], save_prof: ['int'], weapon_prof: ['长杖'], tool_prof: [], languages: ['通用语'],
    caster_attr: 'int', slots_l1: 4, slots_l2: 3, concentrating: null, hd_available: 4,
    spells_known: ['火焰箭', '魔法飞弹', '护盾术'], spells_prepared: ['魔法飞弹'],
    spellSplit: { cantrips: ['火焰箭'], known: ['魔法飞弹', '护盾术'] },
    pending: ['LV4·ASI 点选', 'LV4·新法术×2'], exp: 6100, expMin: 2700, expNext: 6500,
    features: ['奥法回复|短休回环位|—'], statuses: [], weapons: [], gear: [], resist: [], immune: [],
    gp: 21, sp: 4, cp: 9, persona: { alignment: '中立善良' }, background: '佣兵',
    derived: {
      hpPct: 77, pb: 2, dc: 13, atk: 4, passive: 11, ac: 12, expBar: { exp: 6100, min: 2700, next: 6500 },
      slotsNow: 7, slotsTotal: 7, slotsLv: [{ lv: 1, now: 4, total: 4 }, { lv: 2, now: 3, total: 3 }],
      attrMods: ['str', 'dex', 'con', 'int', 'wis', 'cha'].map(k => ({ key: k, mod: k === 'int' ? 3 : k === 'dex' ? 2 : 0 })),
      skills: [{ key: 'arcana', attr: 'int', mod: 5, prof: true, exp: false }],
      saves: [{ key: 'int', mod: 5, prof: true }, { key: 'str', mod: 0, prof: false }, { key: 'dex', mod: 2, prof: false }, { key: 'con', mod: 2, prof: false }, { key: 'wis', mod: 1, prof: false }, { key: 'cha', mod: 0, prof: false }],
      weapons: [],
    },
  }
  window_closed: {
    // stateful 假机械层:front_commit 真改 player(照 front_commit.mjs 语义)
    html = html.replace('</script>', `
      window.__player = ${JSON.stringify(player)}
      window.__calls = []
      window.__respond = (name, argv) => {
        window.__calls.push(name + '|' + argv)
        if (name === 'ui_data.mjs' && argv.op === 'panel' && argv.name === 'hud-left')
          return JSON.stringify({ ok: true, rev: 'r' + Math.random(), data: { player: window.__player, companions: [] }, avatarKeys: ['human-male'] })
        if (name === 'ui_data.mjs' && argv.op === 'panel' && argv.name === 'hud-right')
          return JSON.stringify({ ok: true, rev: 's', data: { state: { place: '' } } })
        if (name === 'ui_data.mjs' && argv.op === 'avatars')
          return JSON.stringify({ ok: true, avatars: { 'human-male': AVATAR_1PX } })
        if (name === 'ui_data.mjs' && argv.op === 'candidates')
          return JSON.stringify({ ok: true, candidates: [{ name: 'Shield', level: 1, ritual: false }, { name: 'Web', level: 2, ritual: false }, { name: 'Burning Hands', level: 1, ritual: false }] })
        if (name === 'front_commit.mjs') {
          const p = window.__player
          if (argv.op === 'asi') {
            for (const [k, v] of Object.entries(argv.payload.stats)) p[k] += v
            p.pending = p.pending.filter(x => !x.includes('ASI'))
          }
          if (argv.op === 'spells') {
            p.spells_known.push(...argv.payload.learned)
            p.spellSplit = { cantrips: p.spellSplit.cantrips, known: [...p.spellSplit.known, ...argv.payload.learned] }   // 拆行快照同步——真实现由泵重读语料
            p.pending = p.pending.filter(x => !x.includes('新法术'))
          }
          return JSON.stringify({ ok: true, pending: p.pending })
        }
        return JSON.stringify({ ok: false, error: 'no fixture ' + name })
      }
      window.__handle = mountPanels({
        doc: document,
        callScript: (name, argvJson) => {
          const text = window.__respond(name, JSON.parse(argvJson))
          return Promise.resolve({ text })
        },
        panels: [
          { name: 'hud-left', slot: 'overlay', data: { script: 'ui_data.mjs' }, view: 'heroPanel', hideDuringOpening: true },
          { name: 'hud-right', slot: 'overlay', data: { script: 'ui_data.mjs' }, view: 'rightPanel', hideDuringOpening: true },
        ],
        viewModule: views,
        actModule: acts,
      })
    </` + `script>`)
    .replace('</head>', `<script>const AVATAR_1PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='</script></head>`)
  }
  const file = join(UI, '__e2e_fixture.html')
  writeFileSync(file, html)
  return file
}

describe.runIf(hasChrome)('dnd5e 成长流浏览器层(playwright 无头 Chrome)', () => {
  let page: import('playwright-core').Page

  beforeAll(async () => {
    page = await browser!.newPage({ viewport: { width: 1400, height: 900 } })
    await page.goto('file://' + writeFixture())
    await page.waitForSelector('.h-card', { timeout: 5000 })
  })

  async function openBook() {
    if (await page.$('.book.open')) return
    await page.click('.h-card')
    await page.waitForSelector('.book.open', { timeout: 5000 })
  }

  it('HUD:待办 chip 文案化(非按钮)+ 英文标题册 + 头像 138% 裁层', async () => {
    const chip = page.locator('.h-card .stc.pending')
    await chip.waitFor()
    expect((await chip.textContent())!.trim()).toContain('未分配成长·2')
    expect(await chipsActAttr()).toBe('')       // 无 data-act
    await openBook()
    // 悬浮件走 body 挂册——英文标题与次序
    const caps = await page.$$eval('.book .bk-cap', els => els.map(e => e.textContent!.trim()))
    for (const t of ['Ability Scores', 'Saving Throws', 'Vitals', 'Proficiencies', 'Spellcasting', 'Conditions', 'Equipment', 'Features'])
      expect(caps.some(c => c.startsWith(t))).toBe(true)
    expect(await page.locator('.book', { hasText: 'Proficiency Bonus' }).count()).toBe(1)
    // 头像 138%:img 宽 ≈ 裁层宽 ×1.38(±px 取整余差)
    const ratio = await page.evaluate(() => {
      const img = document.querySelector('.book .av-img') as HTMLImageElement
      const clip = img?.closest('.av-clip') as HTMLElement
      return clip ? img.getBoundingClientRect().width / clip.getBoundingClientRect().width : 0
    })
    expect(ratio).toBeGreaterThan(1.3)
    expect(ratio).toBeLessThan(1.45)
  })

  async function chipsActAttr() {
    return page.$eval('.h-card .stc.pending', el => el.getAttribute('data-act') ?? '').catch(() => '')
  }

  it('呼吸标题→居中学习框(token 不透明回归钉)→± 分点 delta→保存落机械层+呼吸消退', { timeout: 20000 }, async () => {
    await openBook()
    // asi 呼吸标题
    const asiCap = page.locator('[data-act="grow"][data-kind="asi"]')
    await asiCap.waitFor()
    const anim = await asiCap.evaluate(el => getComputedStyle(el).animationName)
    expect(anim).toContain('capg')
    await asiCap.click()
    await page.waitForSelector('.g-dlg.open')
    await page.waitForTimeout(250)   // 入场动画 dlgp 期间 keyframe 会盖掉 inline translate——等它放完再量居中
    // 居中 + 不透明(token 作用域回归钉) + 6 行 delta +0
    const box = await page.$eval('.g-dlg', el => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, bg: getComputedStyle(el).backgroundColor } })
    expect(Math.abs(box.x + box.w / 2 - 700)).toBeLessThanOrEqual(2)   // 视口几何中心 700/450
    expect(Math.abs(box.y + box.h / 2 - 450)).toBeLessThanOrEqual(2)
    expect(box.bg).toBe('rgb(251, 247, 237)')   // #fbf7ed = var(--p1)
    expect(await page.$$eval('.g-dlg .g-att', els => els.length)).toBe(6)
    expect(await page.$$eval('.g-dlg .delta', els => els.filter(e => e.textContent === '+0').length)).toBe(6)
    expect(await page.$eval('.g-dlg [data-act="growSave"]', el => (el as HTMLButtonElement).disabled)).toBe(true)
    // + 智两下 → delta +2 / 预览 17
    await page.click('.g-dlg [data-inc="int"]')
    await page.click('.g-dlg [data-inc="int"]')
    expect(await page.$eval('.g-dlg', el => el.textContent)).toContain('→ 18')
    expect(await page.$eval('.g-dlg .delta.on', el => el.textContent)).toBe('+2')
    // 外侧点击=取消(册不动)
    await page.mouse.click(700, 850)
    expect(await page.$('.g-dlg')).toBeNull()
    expect(await page.$('.book.open')).not.toBeNull()
    // 重开 → 分满 → 保存 → 机械层收 ASI 档,呼吸消退,泵回落
    await openBook()
    await page.click('[data-act="grow"][data-kind="asi"]')
    await page.waitForSelector('.g-dlg.open', { timeout: 5000 })
    await page.click('.g-dlg [data-inc="int"]')
    await page.click('.g-dlg [data-inc="int"]')
    await page.click('.g-dlg [data-act="growSave"]')
    expect(await page.$('.g-dlg')).toBeNull()
    // 面板级证据:待办 chip 从 2 档降为 1 档(ASI 已销,spells 犹在)——chip 文案单档无「·N」后缀
    await expect.poll(() => page.$$eval('.h-card .stc.pending', els => els.length === 0 ? 0 : Number(els[0].textContent!.match(/·(\d+)/)?.[1] ?? '1')), { timeout: 8000 }).toBe(1)
    await page.click('.book.open .bk-x')   // 收掉旧浮层—— Stale 内容不作证据
    await expect.poll(() => page.$$('[data-act="grow"][data-kind="asi"]').then(els => els.length), { timeout: 8000 }).toBe(0)
    await openBook()
    await expect.poll(() => page.$$('[data-act="grow"][data-kind="spells"]').then(els => els.length), { timeout: 4000 }).toBe(1)
  })

  it('学法术流:候选清单选 2 → 保存 → 全清归零(呼吸消失,角标消失)', { timeout: 20000 }, async () => {
    await openBook()
    const spCap = page.locator('[data-act="grow"][data-kind="spells"]')
    await spCap.waitFor()
    await spCap.click()
    await page.waitForSelector('.g-dlg.open')
    expect(await page.$$eval('.g-dlg .gp-row', els => els.length)).toBe(3)
    await page.click('.g-dlg .gp-row:nth-child(1)')
    await page.click('.g-dlg .gp-row:nth-child(2)')
    await page.click('.g-dlg [data-act="growSave"]')
    // 机械层真值不需要等待:pending.length → 0 为准;随后 UI 角标随之归于无
    await expect.poll(() => page.evaluate(() => window.__player?.pending?.length ?? -1), { timeout: 8000 }).toBe(0)
    await expect.poll(() => page.locator('.h-card .stc.pending').count(), { timeout: 8000 }).toBe(0)
    await page.click('.book.open .bk-x')
    await openBook()
    expect(await page.$$eval('.book.open [data-act="grow"]', els => els.length)).toBe(0)
    const knownRow = await page.$$eval('.book.open .bk-sp-row', els => els.map(e => e.textContent!.trim()).find(t => t.startsWith('已知'))!)
    expect(knownRow).toContain('护盾术')   // Shield——值中文化(2026-09-27):已知行显示中文译名
    expect(knownRow).toContain('蛛网术')   // Web
  })

  it('vtip:0.1s 口径——60ms 不出,160ms 中文出,移开收', async () => {
    await page.waitForSelector('[data-act="book"]')
    const target = page.locator('.h-card .hpbar')
    await target.hover()
    await page.waitForTimeout(60)
    expect(await page.$eval('#vtip', el => el.classList.contains('open'))).toBe(false)
    await page.waitForTimeout(120)
    expect(await page.$eval('#vtip', el => el.classList.contains('open'))).toBe(true)
    expect((await page.$eval('#vtip', el => el.textContent))!).toContain('HP 20/26')
    await page.mouse.move(700, 860)
    expect(await page.$eval('#vtip', el => el.classList.contains('open'))).toBe(false)
  })

  it('留证截图:册+学习框(人工对照原型 docs/hud-proto-grow.html)', { timeout: 25000 }, async () => {
    await openBook()
    // 全清后重录待办态:直接改窗内 player(模拟下一档)。v10 零轮询:机械层变更不再
    // 有 2s 整拍兜底——fixture 里 kick 一拍等价真实宿主的"文件写→事件→kick"。
    await page.evaluate(() => { window.__player.pending = ['LV8·ASI 点选']; window.__handle?.kick?.() })
    await expect.poll(() => page.locator('.h-card .stc.pending').count(), { timeout: 8000 }).toBe(1)
    await page.click('.book.open .bk-x')   // 旧册是开册快照——泵不重绘浮层,收掉重开才有呼吸 cap
    await openBook()
    await page.locator('[data-act="grow"][data-kind="asi"]').first().click()
    await page.waitForSelector('.g-dlg.open')
    await page.waitForTimeout(300)   // 入场动画(dlgp opacity 0→1)放完——首帧截图是空板
    const shot = join(HERE, '__artifacts__', 'grow-dialog.png')
    await page.screenshot({ path: shot })
    artifacts.push(shot)
    expect(artifacts.length).toBe(1)
  })
})
