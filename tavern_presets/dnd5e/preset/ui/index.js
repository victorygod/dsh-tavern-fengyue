// dnd5e 卡 UI 入口(v9 声明形态·卡主权版)——mount 是整张卡 UI 的组装点:
//   ① v2 面板实例化:runtime.mjs(自携面板运行时)+ view.mjs + acts.mjs 在此组装
//   ② opening.html 桥(init/commit/avatar;iframe 沙箱宿主桥,定案保留)
//   ③ 面板总开关按钮(跨面板控制,不属于任何单一面板)
// 数据泵/渲染/册/任务/待办的机制都在 runtime.mjs;视图=view.mjs;动作=acts.mjs;样式=ui.css。
export function mount(tavern) {
  const stops = []
  const add = fn => { if (typeof fn === 'function') stops.push(fn) }

  // ── ① 面板实例化:layout 声明 data+view 的面板交给自携运行时 ──
  let panelsHandle
  const panels = (tavern.layout?.panels ?? []).filter(p => p.data && p.view)
  if (panels.length > 0 && tavern.runtime && tavern.views) {
    if (!tavern.runtime.mountPanels) console.warn('[dnd5e-ui] runtime 缺 mountPanels——面板不挂载')
    else {
      panelsHandle = tavern.runtime.mountPanels({
        doc: document,
        callScript: tavern.callScript,
        panels,
        viewModule: tavern.views,
        actModule: tavern.acts ?? null,
      })
      add(() => panelsHandle.dispose())
      // 文件事件(2026-09-25 通道批 + 零轮询):工作区一动 → kick 立即拉一拍——泵的
      // 主时钟从定时器换成事件;在途合并由 runtime 管,可连发。rev 门照旧裁决重绘。
      // 旧宿主无 face = 无订阅,泵自然退化为纯 gesture 驱动(纯加法语义)。
      const unsubFiles = tavern.files?.subscribe?.(() => { panelsHandle?.kick?.() })
      if (typeof unsubFiles === 'function') add(unsubFiles)
    }
  }

  // ── ② rootTools:总开关条(fixed 常驻;CSS 承自 ui.css 的 .btns 段)──
  // 隐藏交给 runtime 的类驱动可见性(setPanelsHidden)——曾案:这里直改 display,
  // 被泵每拍的 hideDuringOpening 强制回显 2 秒内复活。--off 类带过渡动画。
  const tools = document.createElement('div')
  tools.className = 'dnd-hud dnd-hud--tools'
  tools.innerHTML = `
    <div class="btns">
      <button class="btn" data-act="panels" title="隐藏/开启面板"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="8" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="13" y="4" width="8" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M7 9v6M17 9v6" stroke="currentColor" stroke-width="1.1" fill="none" stroke-linecap="round"/></svg></button>
    </div>`
  document.body.append(tools)
  const btn = tools.querySelector('.btn')
  btn.onclick = () => {
    const next = btn.classList.toggle('off')
    panelsHandle?.setPanelsHidden?.(next)
    btn.title = next ? '开启面板' : '隐藏面板'
  }
  add(() => tools.remove())

  // ── 头像兜底(opening 预览用;HUD 面板的头像由运行时自取)──
  const AVATARS = new Map()
  async function ensureAvatar(key) {
    if (AVATARS.has(key)) return
    let out = null
    try {
      const t = await tavern.runScript('ui_data.mjs', JSON.stringify({ op: 'avatars', keys: [key] }))
      out = typeof t === 'string' ? JSON.parse(t) : null
    } catch { return }
    if (out?.ok && out.avatars?.[key]) AVATARS.set(key, out.avatars[key])
  }

  // ── opening 桥:opening-init(场景数据)/ opening-avatar(头像预览)/ opening-commit(落盘)──
  const dashId = r => String(r ?? '').trim().toLowerCase().replace(/[\s_-]+/g, '-')
  const onMessage = event => {
    const d = event.data
    if (!d || typeof d.t !== 'string') return
    const reply = ok => detail => { try { event.source?.postMessage({ t: 'opening-commit-ack', ok, detail }, '*') } catch {} }
    if (d.t === 'opening-init') {
      tavern.runScript('opening_data.mjs')
        .then(t => { try { event.source?.postMessage({ t: 'opening-init-data', ok: true, data: JSON.parse(t) }, '*') } catch {} })
        .catch(e => { try { event.source?.postMessage({ t: 'opening-init-data', ok: false, detail: e instanceof Error ? e.message : String(e) }, '*') } catch {} })
      return
    }
    if (d.t === 'opening-avatar') {
      // 头像素材契约（ui_zh.md）：图片槽在→dataUrl；缺席→名字首字自绘兜底；宿主侧永不报错阻塞表单
      const gk = d.gender === 'female' ? 'female' : d.gender === 'male' ? 'male' : 'unknown'
      const key = `${dashId(d.race)}-${gk}`
      ensureAvatar(key).then(() => {
        const url = AVATARS.get(key)
        const payload = url ? { ok: true, dataUrl: url } : { ok: true, miss: true }
        try { event.source?.postMessage({ t: 'opening-avatar-data', ...payload }, '*') } catch {}
      }).catch(() => {})
      return
    }
    if (d.t !== 'opening-commit') return
    tavern.runScript('opening_commit.mjs', JSON.stringify(d.payload ?? {}))
      .then(t => reply(true)(typeof t === 'string' ? t : ''))
      .catch(e => reply(false)(e instanceof Error ? e.message : String(e)))
  }
  window.addEventListener('message', onMessage)
  add(() => window.removeEventListener('message', onMessage))

  // ── opening 在场 → 总开关条隐身(2026-09-25 opening face 迁移:300ms visPoll 退役;
  //     面板容器的 hideDuringOpening 回显原来蹭每拍 applyVisibility——零轮询后无拍可蹭,
  //     翻转即 kick 一拍补评)。旧宿主无 opening face → 退回 DOM 探测轮询(容错态)。──
  if (typeof tavern.opening?.subscribe === 'function' && 'active' in tavern.opening) {
    const applyToolsVisibility = () => {
      tools.style.display = tavern.opening?.active === true ? 'none' : ''
      panelsHandle?.kick?.()
    }
    const unsubOpening = tavern.opening.subscribe(applyToolsVisibility)
    if (typeof unsubOpening === 'function') add(unsubOpening)
    applyToolsVisibility()
  } else {
    const openingSel = '[class*="openingFrame"],[class*="openingFull"],[class*="openingWrap"],[class*="openingLive"]'
    const applyVisibility = () => {
      tools.style.display = document.querySelector(openingSel) !== null ? 'none' : ''
    }
    applyVisibility()
    const visPoll = setInterval(applyVisibility, 300)
    add(() => clearInterval(visPoll))
  }

  return () => { for (const fn of [...stops].reverse()) { try { fn() } catch {} } }
}
