// runtime.mjs — dnd5e 卡自携的面板运行时(2026-09-22 拍板:面板机制按卡主权 vendoring,
// 不进宿主框架;宿主只装载本件并注入 {callScript, layout, views, acts})。
// v10(2026-09-25 零轮询):泵从定时重臂改为**事件驱动**——mount 首拍后无定时器,
// kick()(文件事件/手势/容器落地三源)串行合并拉取;`op:panel` 携带已知 rev,
// 同值脚本回裸 ack(拉式差量)。设计:docs/notes/feature/2026-09-25-*-file-events-channel/-cards-zero-poll-migration。
// 职责:per-panel 泵(rev 门+rev 参数短路)、容器落地观察(MutationObserver)、头像逐键缓存、
//       错误 chip(fail-visible)、act 全局单委托+归属解析、ui-state、生命周期(dispose 帧界纪律)。
// 纪律沿 v8 谱系:每处 await 续帧检查停止旗;amp 帧内失败不上浮整拍。
// 可 jsdom 直测(packages/ui/tests/dnd5e-panel-runtime.client.spec.ts)。

const OPENING_SEL = '[class*="openingFrame"],[class*="openingFull"],[class*="openingWrap"],[class*="openingLive"]'

const errChip = (panel, detail) =>
  `<div class="tavern-panel-err" data-panel="${panel}" style="border:1.5px solid #b0493f;border-radius:8px;padding:6px 10px;font:600 11px/1.5 -apple-system,'PingFang SC',sans-serif;color:#b0493f;background:rgba(176,73,63,.08)">◈ 面板 ${panel} · ${detail.replace(/[<>&]/g, '')}</div>`

/**
 * @param deps { doc, callScript(name, argvJson)→Promise<{text, failure?}>, panels, viewModule, actModule }
 * @returns { dispose(): void }
 */
export function mountPanels(deps) {
  const stops = []
  const add = fn => { if (typeof fn === 'function') stops.push(fn) }
  const isStopped = deps.stopped ?? (() => false)
  let stopped = isStopped
  let disposed = false
  add(() => { disposed = true })

  const doc = deps.doc
  const revs = new Map()
  const lastData = new Map()
  const uiStates = new Map()
  const avatars = new Map()
  const avatarMissed = new Set()
  const refreshOnce = new Set()
  const avatarsSnapshot = () => Object.fromEntries(avatars)
  const json = t => { try { return JSON.parse(t) } catch { return null } }

  // 面板可见性(2026-09-22 收编):开幕硬藏是卡约定(display 直置);用户总开关(index.js 面板按钮)
  // 是持久的**类驱动**态(--off:opacity/transform 过渡)——泵拍与 rev 重绘一律不踩它。曾案:总开关
  // 直接改 display、泵每拍 hideDuringOpening 强制回显 → 藏了 2 秒即复活,既丢状态也无动画。
  let userHidden = false
  const applyVisibility = (panel) => {
    const container = doc.querySelector(`.tavern-panel-${panel.name}`)
    if (container === null) return
    if (panel.hideDuringOpening === true && doc.querySelector(OPENING_SEL) !== null) {
      container.style.display = 'none'
      return
    }
    container.style.display = ''
    container.classList.toggle('tavern-panel--off', userHidden)
  }

  const runPanelScript = async (panel, argv) => {
    try {
      const value = await deps.callScript(panel.data.script, JSON.stringify(argv))
      if (value.failure !== undefined) {
        const suffix = value.failure.exitCode === undefined ? '' : ` ${value.failure.exitCode}`
        return { ok: false, rev: `err:${value.failure.reason}:${value.failure.exitCode ?? ''}`, error: `脚本失败(${value.failure.reason}${suffix})` }
      }
      return json(value.text)
    } catch (error) {
      return { ok: false, rev: `err:${error instanceof Error ? error.message.slice(0, 120) : 'unknown'}`, error: error instanceof Error ? error.message.slice(0, 120) : 'unknown' }
    }
  }

  const resolveAvatars = async (keys) => {
    const missing = (keys ?? []).filter(key => !avatars.has(key) && !avatarMissed.has(key))
    if (missing.length === 0) return
    try {
      const value = await deps.callScript('ui_data.mjs', JSON.stringify({ op: 'avatars', keys: missing }))
      if (value.failure !== undefined) { for (const key of missing) avatarMissed.add(key); return }
      const parsed = json(value.text) ?? {}
      for (const [key, url] of Object.entries(parsed.avatars ?? {})) avatars.set(key, url)
      for (const key of missing) if (!avatars.has(key)) avatarMissed.add(key)
    } catch { for (const key of missing) avatarMissed.add(key) }
  }

  const paint = (panel, value) => {
    const container = doc.querySelector(`.tavern-panel-${panel.name}`)
    if (container === null) return
    const view = deps.viewModule?.[panel.view]
    const fresh = value.ok === true && value.rev !== undefined && value.data !== undefined
    if (!fresh || view === undefined) {
      const detail = view === undefined
        ? `view "${panel.view}" 未在 view.mjs 导出`
        : value.rev === undefined ? '数据缺 rev/data' : (value.error ?? '数据源报告失败')
      container.innerHTML = errChip(panel.name, detail)
      return
    }
    // rev 门:同 rev 且未被 refresh 点名 → 跳过重绘(上次内容原样保留)
    const forced = refreshOnce.delete(panel.name)
    if (!forced && revs.get(panel.name) === value.rev) return
    revs.set(panel.name, value.rev)
    lastData.set(panel.name, value)
    container.querySelector('.tavern-panel-err')?.remove()
    container.innerHTML = view(value.data, { avatars: avatarsSnapshot(), ui: uiStates.get(panel.name) ?? {} })
  }

  const repaint = (panelName) => {
    const panel = deps.panels.find(p => p.name === panelName)
    const value = lastData.get(panelName)
    const container = doc.querySelector(`.tavern-panel-${panelName}`)
    const view = deps.viewModule?.[panel?.view]
    if (panel === undefined || value === undefined || container === null || view === undefined) return
    container.innerHTML = view(value.data, { avatars: avatarsSnapshot(), ui: uiStates.get(panelName) ?? {} })
  }

  const tickPanel = async (panel) => {
    if (stopped()) return
    applyVisibility(panel)
    // 拉式差量(2026-09-25):带上已知 rev——脚本 stat 同值即回裸 ack(changed:false,无
    // data),变了才全量投影;旧脚本无此契约则照旧全量(参数被忽略,纯加法)。
    const argv = { op: 'panel', name: panel.name, ...(panel.data.params ?? {}) }
    const knownRev = revs.get(panel.name)
    if (knownRev !== undefined) argv.rev = knownRev
    const value = await runPanelScript(panel, argv)
    if (stopped()) return
    if (value !== null && value.ok === true && value.changed === false) return   // 没变,本拍就地终结
    if (value !== null && value.ok !== false && Array.isArray(value.avatarKeys) && value.avatarKeys.length > 0) {
      await resolveAvatars(value.avatarKeys)
      if (stopped()) return
    }
    paint(panel, value ?? { ok: false })
  }

  // ── v10 泵(2026-09-25 零轮询,docs/notes/feature/2026-09-25-cards-zero-poll-migration):
  // 事件驱动——mount 首拍后**不再重臂定时器**,空闲零拍零请求;拉取只由三源触发:
  // 文件事件(经卡 index.js 订阅 tavern.files → kick)、手势 act 的 ctx.refresh 点名
  // (front_commit 落盘自带事件)、容器落地(MutationObserver)。旧宿主无文件通道 =
  // 纯手势泵,rev 门照旧兜全部时效。在途合并:beat 进行中落下的 kick 塌缩成一次
  // 尾随补拍——绝不并行起 beat(每 beat 每面板一次 callScript spawn,rev 门只挡重绘不挡拉)。──
  let beating = false
  let kickWanted = false
  const runBeat = () => {
    if (disposed || stopped() || beating) return
    beating = true
    void Promise.resolve()
      .then(async () => {
        // 同拍串行:多面板共享一次节拍的 spawn 预算,单面板失败不上浮整拍
        for (const panel of deps.panels) {
          if (stopped()) return
          try { await tickPanel(panel) } catch {}
        }
      })
      .finally(() => {
        beating = false
        if (disposed || stopped()) return
        if (kickWanted) { kickWanted = false; runBeat() }   // 在途 kick → 收尾立即补一拍
      })
  }
  const kick = () => {
    if (disposed || stopped()) return
    if (beating) { kickWanted = true; return }               // 合并:绝不并行起 beat
    void runBeat()
  }

  // act 委托:单实例 document 级监听。归属解析:面板容器内命中 → 面板名;
  // body 级浮层(book/fc 模态,挂 document.body 避开面板 transform 包含块)
  // 已由创建方打 data-panel 标记,回流创建面板——同一匹配只派发一次。
  const handler = (event) => {
    if (stopped()) return
    const target = (event.target instanceof Element ? event.target : null)?.closest?.('[data-act]')
    if (target === null) return
    const act = target.dataset['act']
    if (act === undefined || act === '') return
    let owner = deps.panels.find(p => doc.querySelector(`.tavern-panel-${p.name}`)?.contains(target))?.name
    if (owner === undefined) {
      const tagged = target.closest('[data-panel]')
      const taggedName = tagged?.dataset['panel']
      owner = typeof taggedName === 'string' && deps.panels.some(p => p.name === taggedName) ? taggedName : undefined
    }
    if (owner === undefined) return
    const fn = deps.actModule?.[act]
    if (fn === undefined) { console.warn(`[dnd5e-runtime] act "${act}" has no handler (acts: ${Object.keys(deps.actModule ?? {}).join(',') || '空'})`); return }
    fn({
      container: (doc.querySelector(`.tavern-panel-${owner}`) ?? doc.body),
      act,
      actEl: target,
      panel: owner,
      views: deps.viewModule,
      getUi: (key) => (uiStates.get(owner) ?? {})[key],
      setUi: (key, value) => { uiStates.set(owner, { ...(uiStates.get(owner) ?? {}), [key]: value }) },
      repaint: () => repaint(owner),
      runScript: async (name, ...args) => {
        const value = await deps.callScript(name, ...args)
        if (value.failure !== undefined) throw new Error(`${name} failed (${value.failure.reason})`)
        return value.text
      },
      avatars: avatarsSnapshot(),
      showPanel: (name, visible) => {
        const el = doc.querySelector(`.tavern-panel-${name}`)
        if (el instanceof HTMLElement) el.style.display = visible ? '' : 'none'
      },
      // v10:refresh 点名即 kick 一拍(手势是三源之一——act 提交后数据真身已变,立即拉)。
      // 曾案:只解门等下个 2s 整拍——零轮询后整拍永不自来(fixture/无通道环境即死等)。
      refresh: (name) => { refreshOnce.add(name); kick() },
    }, event)
  }
  doc.addEventListener('click', handler)
  add(() => doc.removeEventListener('click', handler))

  // vtip 悬停浮签（2026-09-24 定案）:全 data-tip 走自制浮签,统一 0.1s 延迟出、移开/滚动即收——
  // 原生 title 延迟约 1s 且不可控,弃用。body 级单件;dispose 连监听带元素一起收。
  const tipEl = doc.createElement('div')
  tipEl.id = 'vtip'
  tipEl.className = 'dnd-hud'
  ;(doc.body ?? doc.documentElement).appendChild(tipEl)
  let tipTimer = null, tipHost = null
  const hideTip = () => { clearTimeout(tipTimer); tipTimer = null; tipHost = null; tipEl.classList.remove('open') }
  const showTip = (el) => {
    tipHost = el
    tipTimer = setTimeout(() => {
      tipEl.textContent = el.getAttribute('data-tip') ?? ''
      tipEl.classList.add('open')
      const r = el.getBoundingClientRect()
      const w = tipEl.offsetWidth, h = tipEl.offsetHeight
      const vw = doc.defaultView?.innerWidth ?? 1200, vh = doc.defaultView?.innerHeight ?? 800
      const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, vw - w - 8))
      let top = r.bottom + 6
      if (top + h > vh - 8) top = Math.max(8, r.top - h - 6)
      tipEl.style.left = left + 'px'
      tipEl.style.top = top + 'px'
    }, 100)
  }
  const overTip = (e) => {
    const el = (e.target instanceof Element ? e.target : null)?.closest?.('[data-tip]') ?? null
    if (el === tipHost) return
    hideTip()
    if (el !== null) showTip(el)
  }
  doc.addEventListener('mouseover', overTip)
  doc.addEventListener('scroll', hideTip, true)
  add(() => {
    doc.removeEventListener('mouseover', overTip)
    doc.removeEventListener('scroll', hideTip, true)
    clearTimeout(tipTimer)
    tipEl.remove()
  })

  // ── 容器落地观察:mount 可能先于宿主渲染面板容器(dnd 老卡 waitHost 自旋的存在实证)。
  // 零轮询后没有"下个整拍"兜底——事件化补位:观察期间容器落齐即 kick 首拍,落齐即断开。
  const missingPanels = () => deps.panels.filter(p => doc.querySelector(`.tavern-panel-${p.name}`) === null)
  if (typeof MutationObserver === 'function' && missingPanels().length > 0) {
    const observer = new MutationObserver(() => {
      const missing = missingPanels()
      if (missing.length < deps.panels.length) kick()
      if (missing.length === 0) observer.disconnect()
    })
    observer.observe(doc, { childList: true, subtree: true })
    add(() => observer.disconnect())
  }

  runBeat()
  // 调试钉:页面 console 直接读(window.__panelRuntime)——挂载/act 接线排障用
  globalThis.__panelRuntime = {
    actsAttached: 1,
    panels: deps.panels.map(p => p.name),
    actNames: Object.keys(deps.actModule ?? {}),
    viewNames: Object.keys(deps.viewModule ?? {}),
  }

  return {
    /** 面板总开关(index.js 按钮):用户隐藏走 --off 类(有过渡),泵拍永远尊重该态。 */
    setPanelsHidden(hidden) {
      userHidden = hidden === true
      for (const panel of deps.panels) applyVisibility(panel)
    },
    /** 立即拉一拍(卡 index.js 的 tavern.files 订阅回调入口;在途合并,可连点)。 */
    kick,
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const fn of [...stops].reverse()) { try { fn() } catch {} }
    },
  }
}
