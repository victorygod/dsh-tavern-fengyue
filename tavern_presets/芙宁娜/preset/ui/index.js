// 芙宁娜 galgame 入口(v1 直控·对话框状态机)。
// 契约:docs/design_galgame-ui_zh.md;施工:docs/build_galgame-ui_zh.md。
// 职责全部在本件:数据轮询(gal_data op:panel)、段落状态机(reading→…)、打字机、
// 点击路由、backlog 防剧透、CG 双缓冲换场(readAsset 资产通道)、composer 停靠(body 类驱动)。
// 输入零转发:input 态显示宿主原生 composer(模型座/环形/usage 原生),Enter 原生发送。

const POLL_MS = 900
const TYPE_MS = 26
const WAIT_TIMEOUT_MS = 120_000   // waiting 兜底:超时未结算回落输入态

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function mount(tavern) {
  const views = tavern.views ?? {}
  const stops = []

  // 开场页在场 → 对话框恒为输入态(玩家先说话;开场选项由宿主 updateDraft 填入
  // .tavern-textarea=停靠位,发送仍由玩家触发)。开场页退场后由状态机接管。
  const OPENING_SEL = '[class*="openingFrame"],[class*="openingFull"],[class*="openingWrap"],[class*="openingLive"]'
  const openingPresent = () => document.querySelector(OPENING_SEL) !== null
  const add = fn => { if (typeof fn === 'function') stops.push(fn) }
  let disposed = false

  document.body.classList.add('gal-ui')
  add(() => document.body.classList.remove('gal-ui', 'gal-input'))

  const readAsset = p => tavern.readAsset ? tavern.readAsset(p).catch(() => undefined) : Promise.resolve(undefined)

  // ── 状态(会话期 UI 态,不落盘;数据真身在 runtime 文件)──
  const state = {
    mode: 'boot',              // reading | waiting | input
    r: 0,                      // 当前段(0 基)
    paras: [],                 // 当前回复分段(已剥指令)
    asstSeq: 0, userSeq: 0,    // 已消费的水位
    asstText: '', userText: '',
    history: [],               // 全量 backlog 行 {role, seq, text}
    cgId: null, cgLayers: [],  // 当前 CG(manifest 切片)
    assets: new Map(),         // img 路径 → dataUrl
    assetMissed: new Set(),
    rev: null,
    waitStart: 0,
  }

  // ── DOM(面板容器落地后建)──
  let root = null
  function build(host) {
    host.innerHTML = `
      <div class="gg">
        <img class="gg-cg gg-front" alt="">
        <img class="gg-cg gg-back" alt="">
        <div class="gg-user"></div>
        <div class="gg-dialog">
          <span class="gg-name">芙宁娜</span>
          <button class="gg-expand" title="展开历史"><svg width="12" height="9" viewBox="0 0 12 9"><path d="M6 1 11 8H1Z" fill="currentColor"/></svg></button>
          <button class="gg-stop" title="停止并返回输入">停止</button>
          <div class="gg-text"></div>
          <div class="gg-input-row">
            <textarea class="gg-textarea" placeholder="说点什么…(Enter 发送)"></textarea>
            <div class="gg-input-controls">
              <span class="gg-model-mirror"></span>
              <span class="gg-usage-mirror"></span>
              <button class="gg-send" title="发送(玩家手势)">发 送</button>
            </div>
          </div>
          <div class="gg-dots"><i></i><i></i><i></i></div>
          <div class="gg-next">▼</div>
        </div>
        <div class="gg-backlog">
          <div class="gg-bl-head">
            <button class="gg-collapse" title="折叠历史"><svg width="12" height="9" viewBox="0 0 12 9"><path d="M6 1 11 8H1Z" fill="currentColor"/></svg></button>
            <div class="gg-bl-cap">—— 聊 天 历 史 ——</div>
          </div>
          <div class="gg-bl-body"></div>
        </div>
      </div>`
    return host.querySelector('.gg')
  }

  const el = () => ({
    root, front: root?.querySelector('.gg-front'), back: root?.querySelector('.gg-back'),
    user: root?.querySelector('.gg-user'), dialog: root?.querySelector('.gg-dialog'),
    who: root?.querySelector('.gg-name'), text: root?.querySelector('.gg-text'),
    next: root?.querySelector('.gg-next'), stop: root?.querySelector('.gg-stop'),
    dots: root?.querySelector('.gg-dots'),
    expand: root?.querySelector('.gg-expand'), collapse: root?.querySelector('.gg-collapse'),
    blBody: root?.querySelector('.gg-bl-body'), ta: root?.querySelector('.gg-textarea'),
    send: root?.querySelector('.gg-send'), modelMirror: root?.querySelector('.gg-model-mirror'),
    usageMirror: root?.querySelector('.gg-usage-mirror'),
  })
  const dbg = () => { if (root) root.dataset.state = `mode=${state.mode} · 段 ${state.r + 1}/${Math.max(state.paras.length, 1)}` }

  /* ── CG 双缓冲换场(readAsset 资产通道)── */
  let cgFront = true
  function crossfade(id, layers) {
    const e = el(); if (!e.root) return
    const front = cgFront ? e.front : e.back
    const back = cgFront ? e.back : e.front
    const next = (layers[0] ?? {}).img
    const load = () => { const p = next ? readAsset(next) : Promise.resolve(undefined)
      p.then(url => { if (typeof url === 'string' && url !== '') back.src = url }) }
    if (back.dataset.cgId !== id) { back.dataset.cgId = id; load() }
    cgFront = !cgFront
    front.classList.remove('gg-front'); front.classList.add('gg-back')
    back.classList.remove('gg-back'); back.classList.add('gg-front')
    void back.offsetWidth
  }

  /* ── 段落派生:对话队列 = [玩家行(如有)] + 芙宁娜分段——名字牌随段切换 ── */
  function applyTurn(userText, asstText) {
    const paras = []
    const u = (userText ?? '').trim()
    if (u !== '') paras.push({ role: 'user', text: u })
    for (const p of views.splitParagraphs(asstText)) paras.push({ role: 'assistant', text: p })
    state.paras = paras
    state.r = 0
  }
  let typing = null
  function startParagraph(i) {
    state.r = i; state.mode = 'reading'
    const e = el(); const cur = state.paras[i] ?? { role: 'assistant', text: '' }
    const full = cur.text
    e.who.textContent = cur.role === 'user' ? '你' : '芙宁娜'
    e.dialog.classList.toggle('gg-you', cur.role === 'user')
    clearInterval(typing); typing = null
    e.text.innerHTML = ''
    const cursor = document.createElement('span'); cursor.className = 'gg-cursor'; e.text.appendChild(cursor)
    let n = 0
    typing = setInterval(() => {
      n += 1; cursor.insertAdjacentText('beforebegin', full[n - 1] ?? '')
      if (n >= full.length) { clearInterval(typing); typing = null; cursor.remove() }
    }, TYPE_MS)
    syncDomState(); renderBacklog(); dbg()
  }
  function completeParagraph() {
    clearInterval(typing); typing = null
    const e = el(); e.text.textContent = (state.paras[state.r] ?? {}).text ?? ''
    e.next.classList.toggle('gg-on', state.r < state.paras.length - 1)
  }

  /* ── 模式切换与渲染同步 ── */
  function setMode(m) {
    state.mode = m
    if (m === 'waiting') state.waitStart = Date.now()
    syncDomState(); dbg()
  }
  function syncDomState() {
    const e = el(); if (!e.root || !e.dots || !e.dialog) return   // 重入瞬态守卫:DOM 可能已被下一轮 mount 换血
    const m = state.mode
    document.body.classList.toggle('gal-input', m === 'input')
    e.dots.style.display = m === 'waiting' ? 'flex' : 'none'
    e.user.style.display = state.userText ? 'block' : 'none'
    e.user.textContent = state.userText
    e.who.textContent = m === 'input' ? '你' : '芙宁娜'
    e.next.classList.toggle('gg-on', m === 'reading' && state.r < state.paras.length - 1)
    e.stop.style.display = m === 'waiting' ? 'inline-block' : 'none'
    e.dialog.classList.toggle('gg-input', m === 'input')
  }

  /* ── backlog(防剧透:当前回复只画到已读段)── */
  function renderBacklog() {
    const e = el(); if (!e.root) return
    let html = ''
    for (const row of state.history) {
      if (row.role === 'assistant' && row.seq === state.asstSeq && state.asstText !== '') {
        // 当前回复行:按段切,只画已读(0..r)
        for (let i = 0; i <= Math.min(state.r, state.paras.length - 1); i++) {
          html += rowHTML('assistant', state.paras[i] ?? '')
        }
        continue
      }
      html += rowHTML(row.role, row.text)
    }
    e.blBody.innerHTML = html
    e.blBody.scrollTop = e.blBody.scrollHeight
  }
  function rowHTML(role, text) {
    const cls = role === 'user' ? 'u' : 'a'
    return `<div class="bl-row ${cls}"><div class="bl-name">${role === 'user' ? '你' : '芙宁娜'}</div><div class="bl-text">${esc(text)}</div></div>`
  }

  /* ── 点击路由 ── */
  function onStageClick(event) {
    if (event.target.closest('.gg-bl-head, .gg-collapse, .gg-expand, .gg-textarea, .gg-input-controls, .gg-bl-body') !== null) return
    if (state.mode === 'waiting') { forwardStop(); setMode('input'); return }
    if (state.mode === 'input') return
    if (typing !== null) { completeParagraph(); dbg(); return }
    if (state.r < state.paras.length - 1) { startParagraph(state.r + 1); dbg(); return }
    setMode('input'); dbg()   // 对话队列点完 → 输入态(名字牌=你)
  }
  /* waiting 中:转发玩家手势给宿主停止键(design §4 声明的唯一例外) */
  function forwardStop() {
    const targets = [...document.querySelectorAll('.tavern-send-btn')]
    const stop = targets.find(b => b.getAttribute('aria-label')?.includes('停止') || b.querySelector('svg rect'))
    ;(stoppableBtn(stop) ?? stop)?.click()
  }
  const stoppableBtn = b => b

  /* ── 轮询:gal_data(900ms;rev 同值短路)── */
  let pollTimer = null, typingGuard = 0
  async function poll() {
    if (disposed) return
    let value = null
    try { value = JSON.parse(await tavern.runScript('gal_data.mjs', JSON.stringify({ op: 'panel' }))) } catch { return }
    if (value?.ok !== true) return
    if (value.rev === state.rev) return
    state.rev = value.rev
    const d = value.data
    state.history = d.history ?? []
    const uSeq = d.lastUser?.seq ?? 0, aSeq = d.lastAssistant?.seq ?? 0
    const freshUser = uSeq > state.userSeq, freshAsst = aSeq > state.asstSeq
    state.userSeq = Math.max(state.userSeq, uSeq); state.asstSeq = Math.max(state.asstSeq, aSeq)
    if (d.lastUser?.text) state.userText = d.lastUser.text
    if (state.history.length) { const last = state.history.at(-1); if (last.role === 'assistant') state.asstText = last.text }
    // ① 新回复落盘 → 重建对话队列(玩家行起)并逐段播放
    if (freshAsst && d.lastAssistant?.text) {
      const uText = state.history.find(r2 => r2.seq === uSeq)?.text ?? state.userText
      applyTurn(uText, d.lastAssistant.text); setMode('reading'); startParagraph(0); return
    }
    // ② 只有新玩家行(无回复)→ 单段队列:显示玩家行,点完 → input(等待回复或重说)
    if (freshUser && state.mode !== 'waiting') {
      applyTurn(d.lastUser?.text ?? '', ''); setMode('reading'); startParagraph(0); return
    }
    // ③ waiting 兜底:超 120s 无回复 → 回输入态
    if (state.mode === 'waiting' && Date.now() - state.waitStart > WAIT_TIMEOUT_MS) { setMode('input'); return }
    // ④ CG 换场(状态机不动)
    if (d.cg?.id !== undefined && d.cg.id !== state.cgId) { state.cgId = d.cg.id; crossfade(d.cg.id, d.cg.layers) }
    // ⑤ 资产补缺
    for (const key of (value.assetKeys ?? [])) {
      if (state.assets.has(key) || state.assetMissed.has(key)) continue
      const url = await readAsset(key)
      if (typeof url === 'string' && url !== '') state.assets.set(key, url); else state.assetMissed.add(key)
      const front = el().front
      if (front && state.cgLayers[0] && state.cgLayers[0].img === key) front.src = url
    }
  }

  /* ── 组装(容器落地 → 建 DOM → 首拍定态 → 轮询)── */
  let tries = 0, waitHost = null, bootPoll = null
  waitHost = setInterval(() => {
    tries += 1
    const host = document.querySelector('.tavern-panel-galgame')
    if (host === null) { if (tries > 100) clearInterval(waitHost); return }
    clearInterval(waitHost)
    root = build(host)
    root.addEventListener('click', onStageClick)
    // 卡自持输入:玩家手势(Enter/发送键) → tavern.submit(text) 直发宿主 admission
    const ta = el().ta
    if (ta !== null && ta !== undefined) {
      ta.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault(); e.stopPropagation()
          const text = ta.value.trim()
          if (text !== '' && state.mode === 'input' && typeof tavern.submit === 'function') {
            ta.value = ''
            tavern.submit(text).catch(err => console.warn('[gg] submit failed:', err?.message ?? err))
            setMode('waiting')
          }
        }
      })
      el().send && el().send.addEventListener('click', e => {
        e.stopPropagation()
        const text = ta.value.trim()
        if (text !== '' && state.mode === 'input' && typeof tavern.submit === 'function') {
          ta.value = ''
          tavern.submit(text).catch(err => console.warn('[gg] submit failed:', err?.message ?? err))
          setMode('waiting')
        }
      })
    }
    // Greeting 选项(宿主 updateDraft) → 隐藏 composer 的 textarea 值同步进卡输入(greeting选项点击回填)
    const hiddenMirror = setInterval(() => {
      const hidden = document.querySelector('.tavern-textarea')
      const text = (hidden && hidden.value) || ''
      const mine = el().ta
      if (mine && document.activeElement !== mine && text !== '' && text !== mine.value) mine.value = text
      // 镜像 usage 用法行
      const usage = document.querySelector('.tavern-usage-line')
      if (usage && el().usageMirror) el().usageMirror.textContent = usage.textContent || ''
    }, 500)
    add(() => clearInterval(hiddenMirror))
    el().expand.addEventListener('click', e => {
      e.stopPropagation()
      const bl = el().root.querySelector('.gg-backlog')
      const show = bl.style.display !== 'flex'
      bl.style.display = show ? 'flex' : 'none'
      if (show) renderBacklog()
      dbg()
    })
    el().collapse.addEventListener('click', e => {
      e.stopPropagation()
      el().root.querySelector('.gg-backlog').style.display = 'none'
    })
    bootPoll = setInterval(async () => {
      let value = null
      try { value = JSON.parse(await tavern.runScript('gal_data.mjs', JSON.stringify({ op: 'panel' }))) } catch { return }
      if (value?.ok !== true) return
      clearInterval(bootPoll)
      state.rev = value.rev
      const d = value.data
      state.history = d.history ?? []
      state.userSeq = d.lastUser?.seq ?? 0; state.asstSeq = d.lastAssistant?.seq ?? 0
      state.userText = d.lastUser?.text ?? ''
      for (const key of (value.assetKeys ?? [])) { const url = await readAsset(key); if (typeof url === 'string' && url !== '') state.assets.set(key, url) }
      state.cgId = d.cg?.id ?? null; state.cgLayers = d.cg?.layers ?? []
      crossfade(state.cgId, state.cgLayers)
      if (openingPresent()) setMode('input')   // 开场期:恒输入态(选项点击→宿draft→玩家Enter)
      else if (state.userSeq > state.asstSeq || !d.lastAssistant) {
        // 开局/中断恢复:队列 = [玩家行(如有)];无任何行 → 直接 input
        if (d.lastUser) { applyTurn(d.lastUser.text, ''); setMode('reading'); startParagraph(0) }
        else setMode('input')
      } else { applyTurn(d.lastUser?.text ?? '', d.lastAssistant.text); setMode('reading'); startParagraph(0); renderBacklog() }
      pollTimer = setInterval(() => { void poll() }, POLL_MS)
      add(() => { clearInterval(pollTimer); clearInterval(typing) })
      dbg()
    }, 350)
    add(() => clearInterval(waitHost)); add(() => clearInterval(bootPoll))
  }, 200)
  add(() => clearInterval(waitHost))
  if (bootPoll) add(() => clearInterval(bootPoll))

  return () => {
    disposed = true
    for (const fn of [...stops].reverse()) { try { fn() } catch {} }
  }
}
