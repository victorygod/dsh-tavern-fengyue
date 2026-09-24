// 芙宁娜 galgame 入口(v1 直控·对话框状态机)。
// 契约:docs/design_galgame-ui_zh.md;施工:docs/build_galgame-ui_zh.md;
//      opening 契约:docs/notes/feature/2026-09-24-tavern-opening-surface-contract.zh.md。
// 职责全部在本件:数据轮询(gal_data op:panel)、段落状态机(reading→…)、打字机、
// 点击路由、backlog 防剧透、CG 双缓冲换场(readAsset 资产通道)。
// 输入回宿主(layout.json dock:["composer"]):input 态把宿主 composer 原件
// 以 JS 量尺 fixed 到对话框输入行位——模型座/上下文环/textarea/发送/usage 全
// 原生,发送走宿主原生 Enter/发送键。量尺(getBoundingClientRect)是浏览器统一
// API,不再让卡 CSS 猜宿主几何(旧停靠跨平台失效的根因)。
// 开场契约(layout.json suppress:["opening"]):greeting 选项由卡渲染
// (数据 = tavern.opening.greetings);点击 postMessage tavern-insert 填宿主
// composer draft(只填不发);开场结束 = tavern.opening.active 翻假。

const POLL_MS = 900
const TYPE_MS = 26
const WAIT_TIMEOUT_MS = 120_000   // waiting 兜底:超时未结算回落输入态

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

export function mount(tavern) {
  const views = tavern.views ?? {}
  const stops = []

  const add = fn => { if (typeof fn === 'function') stops.push(fn) }
  let disposed = false

  document.body.classList.add('gal-ui')
  add(() => document.body.classList.remove('gal-ui', 'gal-input'))

  const readAsset = p => tavern.readAsset ? tavern.readAsset(p).catch(() => undefined) : Promise.resolve(undefined)

  // ── 状态(会话期 UI 态,不落盘;数据真身在 runtime 文件)──
  const state = {
    mode: 'boot',              // reading | waiting | input
    r: 0,                      // 当前段(0 基)
    paras: [],                 // 回复按行切分后的消息队列(只 assistant 行,{role,text})
    asstSeq: 0, userSeq: 0,    // 已消费的水位
    asstText: '', userText: '',
    asstRaw: '', lineEnds: [], // 剥指令后的原文 + 有效行末端偏移(防剧透换行一致)
    liveText: '',              // 流式中当前生成行(未遇 \n 的活性行,实时上屏)
    reasoning: '', thinkOpen: false,  // 本轮思考(流式推理,对话框上方折叠)与展开态
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
    // gg-greet = 开场白块:画面中央、独立不透明块(不在对话框内——用户定形
    //   2026-09-24:开场白应在画面中央、背景不透明)。
    // gg-dock-slot = input 态停靠锚位:宿主 composer 原件以 JS 量尺 fixed 到
    //   它的坐标上(对话框保留可见外框,composer 嵌在盒内)。
    host.innerHTML = `
      <div class="gg">
        <img class="gg-cg gg-front" alt="">
        <img class="gg-cg gg-back" alt="">
        <div class="gg-cg-mood"></div>
        <div class="gg-greet"></div>
        <div class="gg-dialog">
          <span class="gg-name">芙宁娜</span>
          <button class="gg-expand" title="展开历史"><svg width="12" height="9" viewBox="0 0 12 9"><path d="M6 1 11 8H1Z" fill="currentColor"/></svg></button>
          <button class="gg-stop" title="停止并返回输入">停止</button>
          <div class="gg-text"></div>
          <div class="gg-dock-slot"></div>
          <div class="gg-dots"><i></i><i></i><i></i></div>
          <div class="gg-next">▼</div>
        </div>
        <div class="gg-think">
          <button class="gg-think-head" title="展开/收起思考"><span class="gg-think-label">思考</span><span class="gg-think-summary"></span></button>
          <div class="gg-think-body"></div>
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
    mood: root?.querySelector('.gg-cg-mood'),
    dialog: root?.querySelector('.gg-dialog'),
    who: root?.querySelector('.gg-name'), text: root?.querySelector('.gg-text'),
    next: root?.querySelector('.gg-next'), stop: root?.querySelector('.gg-stop'),
    greet: root?.querySelector('.gg-greet'), dockSlot: root?.querySelector('.gg-dock-slot'),
    think: root?.querySelector('.gg-think'), thinkBody: root?.querySelector('.gg-think-body'),
    thinkSummary: root?.querySelector('.gg-think-summary'),
    dots: root?.querySelector('.gg-dots'),
    expand: root?.querySelector('.gg-expand'), collapse: root?.querySelector('.gg-collapse'),
    blBody: root?.querySelector('.gg-bl-body'),
  })
  const dbg = () => { if (root) root.dataset.state = `mode=${state.mode} · 段 ${state.r + 1}/${Math.max(state.paras.length, 1)}` }

  /* ── composer 停靠(量尺 fixed:把宿主 composer 原件钉到 dock-slot 坐标)──
     仅动宿主 composer 的内联 style,不动 DOM 结构;退出还原(回宿主文档流,
     卡 CSS 再隐去)。getBoundingClientRect 为浏览器统一 API,零平台几何假设。 */
  let docked = false
  function dockComposer() {
    const e = el()
    const composer = document.querySelector('.tavern-composer')
    const slot = e.dockSlot
    if (!composer || !slot) return
    const sr = slot.getBoundingClientRect()
    // box-sizing 归 border-box:width 含 padding,让原件正好贴合 slot 宽——
    // 宿主 composerWrap 自带左右 padding,缺这行会右缘探出对话框(真机量证)。
    composer.style.boxSizing = 'border-box'
    composer.style.position = 'fixed'
    composer.style.left = `${Math.max(0, Math.round(sr.left))}px`
    composer.style.top = `${Math.max(0, Math.round(sr.top))}px`
    composer.style.width = `${Math.max(0, Math.round(sr.width))}px`
    // 高度钉到 slot 高:内部 textarea flex 填满(对话框 input 态 min-height 稳定 →
    // slot 高稳定),与说话对话框同盒、不塌不溢出。
    composer.style.height = `${Math.max(0, Math.round(sr.height))}px`
    composer.style.margin = '0'
    // 停靠必须压过全屏面板层(z45):inline display block + z50,否则输入被
    // 面板里的空 slot 盖住,对话框内看不出 input(真机 elementsFromPoint 量证)。
    composer.style.display = 'block'
    composer.style.zIndex = '50'
    composer.style.visibility = 'visible'
    docked = true
  }
  function undockComposer() {
    const composer = document.querySelector('.tavern-composer')
    if (!composer || !docked) return
    composer.style.boxSizing = ''
    composer.style.position = ''
    composer.style.left = ''
    composer.style.top = ''
    composer.style.width = ''
    composer.style.height = ''
    composer.style.margin = ''
    // 还原 display/z/visibility 由卡 CSS 的 body.gal-ui 隐藏规则接回
    composer.style.display = ''
    composer.style.zIndex = ''
    composer.style.visibility = ''
    docked = false
  }
  const onResize = () => { if (docked) dockComposer(); placeThink() }
  window.addEventListener('resize', onResize)
  add(() => window.removeEventListener('resize', onResize))

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

  /* ── 段级 CG 切换:那条话出现时,按它内嵌的 cg 指令即时换场(不等 durable)──
     manifest 层索引经 gal_data op:manifest 取一次缓存;crossfade 幂等(同 id 跳过)。 */
  let cgCache = null
  async function ensureCgLayers() {
    if (cgCache) return cgCache
    try {
      const v = JSON.parse(await tavern.runScript('gal_data.mjs', JSON.stringify({ op: 'manifest' })))
      cgCache = v?.ok === true && v.cgs ? v.cgs : {}
    } catch { cgCache = {} }
    return cgCache
  }
  async function switchCg(id) {
    if (!id || String(id) === String(state.cgId ?? '')) return
    const cgs = await ensureCgLayers()
    const layers = cgs[id]?.layers
    if (!layers) return
    state.cgId = id
    crossfade(id, layers)
    setMood(id)
  }
  /* CG 情绪词(manifest intro)画面中央浮层 */
  function setMood(id) {
    const e = el()
    if (!e.mood) return
    const intro = (cgCache?.[id] ?? { intro: '' }).intro
    if (!intro) { e.mood.style.display = 'none'; return }
    e.mood.textContent = intro
    e.mood.style.display = ''
  }

  /* ── 回复定型:回复正文按行切 → 对话队列(只 assistant 行;玩家话不重复展示,
    在角落/backlog 用户行——2026-09-24 用户定形)──
    同拍记录剥指令后的原文与有效行偏移(asstRaw/lineEnds),防剧透按已读行
    slice 原文保留换行,刷新前后一致。 */
  function applyTurn(asstText) {
    const raw = views.stripDirectives(asstText ?? '')
    state.asstRaw = raw
    state.lineEnds = views.lineEndsOf(raw)
    state.paras = views.splitParagraphs(asstText).map(t => ({ role: 'assistant', text: t.text, cg: t.cg ?? null }))
    state.r = 0
  }

  /* ── 活性行实时上屏:流式中未遇 \n 的当前行順滑显示在对话框(无打字机重播)──
     chunk 一到就有字,不等首行 \n。 */
  function displayLive() {
    if (state.liveText.trim() === '') return
    const e = el()
    e.who.textContent = '芙宁娜'
    e.dialog.classList.remove('gg-you')
    clearInterval(typing); typing = null
    e.text.textContent = state.liveText
    e.next.classList.remove('gg-on')
    setMode('reading')
    renderBacklog(); dbg()
  }

  /* ── 思考折叠行(对话框盒外上方):流式推理实时更新,默认折叠(摘要),点开看全文。
     位置由 placeThink 跟随对话框顶部定位(bottom)。── */
  function placeThink() {
    const e = el()
    if (!e.think || !e.dialog) return
    const dr = e.dialog.getBoundingClientRect()
    const vh = window.innerHeight
    e.think.style.bottom = `${Math.max(4, Math.round(vh - dr.top + 12))}px`
  }
  function renderThink() {
    const e = el()
    if (!e.think) return
    const r = state.reasoning
    if (r.trim() === '') { e.think.style.display = 'none'; return }
    e.think.style.display = 'block'   // 显式 block:'' 会回退到 CSS 默认 none,永远隐藏
    e.think.classList.toggle('gg-think-open', state.thinkOpen)
    e.thinkBody.textContent = r
    // 折叠摘要显示「最末非空行」(流式更新到最新一行,镜像宿主 summaryOf)
    const lines = r.split('\n').map(t => t.trim()).filter(t => t !== '')
    const last = lines.length > 0 ? lines[lines.length - 1] : ''
    e.thinkSummary.textContent = last.length > 60 ? `${last.slice(0, 60)}…` : last
    placeThink()
  }
  function handleReasoning(text) {
    // 只接受有内容:宿主 live 结束后会推空串清 live,不能覆盖已收集的本轮思考(否则思考一闪没)
    if (String(text ?? '').trim() === '') return
    state.reasoning = String(text)
    renderThink(); dbg()
  }
  function toggleThink() {
    state.thinkOpen = !state.thinkOpen
    renderThink(); dbg()
  }

  /* ── 流式入队:宿主推 live assistant 瞬态文本,遇换行切,新完整行 append 到
     展示队列 —— 首条定型即上屏;后续行只入队等待。未遇 \n 的活性尾行
     在无待展示定型段时实时上屏。看下一条唯一触发是玩家手势。 */
  function pushAssistantLine(line) {
    const text = typeof line === 'string' ? line.trim() : (line?.text ?? '').trim()
    if (text === '') return
    const cg = line?.cg ?? null
    state.paras.push({ role: 'assistant', text, cg })
    // 入队不切 CG:切换时机 = 下一条段「展示」时(见 startParagraph),按该段内嵌
    // 指令判段做替换——不是流式一收到就切。
    if (state.mode === 'reading') {
      // 已有当前展示段:只入队,不切换(看完当前条点开下一条)
      renderBacklog(); dbg()
      return
    }
    // 首条到达(空闲/waiting)→ 启动展示这条
    state.r = state.paras.length - 1
    setMode('reading')
    startParagraph(state.r)
  }
  function handleLive(text) {
    const s = String(text ?? '')
    const parts = s.split('\n')
    const lastComplete = s.endsWith('\n') ? parts.length : parts.length - 1
    // 完整行(遇 \n)逐条入队:parseLine 去注释取展示文本 + 提取行内 cg
    const base = state.paras.length
    for (let i = base; i < lastComplete; i++) {      const parsed = views.parseLine(parts[i] ?? '')
      if (parsed.text !== '' && !parsed.text.startsWith('<!--')) pushAssistantLine(parsed)
    }
    // 活性尾行(未 \n):保存去注释文本;无待展示定型段时实时上屏
    state.liveText = lastComplete < parts.length ? views.parseLine(parts[lastComplete] ?? '').text : ''
    const showingFixed = state.mode === 'reading' && state.r < state.paras.length
    if (!showingFixed) displayLive()
  }
  /* ── durable 校准:以剥指令全文为准重建队列(流式已推行程数保留,
     尾部残片/缺口被替换补足)——落定与刷新后走同一契约,一致。 */
  function syncDurable(fullText) {
    const raw = views.stripDirectives(fullText ?? '')
    const full = views.splitParagraphs(fullText)
    const prevR = state.r
    state.paras = full.map(t => ({ role: 'assistant', text: t.text, cg: t.cg ?? null }))
    state.asstRaw = raw
    state.lineEnds = views.lineEndsOf(raw)
    state.liveText = ''   // 落定后无活性行(由精确行定型接管)
    state.r = Math.min(prevR, state.paras.length - 1)
    if (state.mode === 'reading') {
      // 落定后当前段刷新为正文(流式期间尾部指令残片被替换)
      const e = el(); const cur = state.paras[state.r] ?? { text: '' }
      e.text.textContent = cur.text
      e.next.classList.toggle('gg-on', state.r < state.paras.length - 1)
    } else if (state.paras.length > 0) {
      startParagraph(state.r)   // 流式未启动即落定:立即展示队列头
    }
    renderBacklog(); dbg()
  }
  let typing = null
  function startParagraph(i) {
    state.r = i; state.mode = 'reading'
    const e = el(); const cur = state.paras[i] ?? { role: 'assistant', text: '' }
    if (cur.cg) void switchCg(cur.cg)   // 该段出现即切该段指定 CG
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
      placeThink()   // 对话框高度随打字增长,思考行保持贴顶
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
    // gg-waiting 类驱动 CSS 隐藏文本、露出三点;此前从未设置,waiting 态一直露旧文
    e.root.closest('.tavern-panel-galgame')?.classList.toggle('gg-waiting', m === 'waiting')
    e.dots.style.display = m === 'waiting' ? 'flex' : 'none'
    e.who.textContent = m === 'input' ? '你' : '芙宁娜'
    e.next.classList.toggle('gg-on', m === 'reading' && state.r < state.paras.length - 1)
    e.stop.style.display = m === 'waiting' ? 'inline-block' : 'none'
    e.dialog.classList.toggle('gg-input', m === 'input')
    if (m === 'input') dockComposer(); else undockComposer()
    renderGreet(e)
    renderThink()
  }

  /* ── greeting 选项(开场契约:数据据 tavern.opening,不再摸宿主 DOM)──
     显示 = 输入态 ∧ 还没开聊(无任何回合历史、无对话队列——开场期/
     清空后同形);点击 postMessage tavern-insert 填宿主 composer draft
     (只填不送,发送由玩家在原生 composer 完成)。 */
  function renderGreet(e) {
    if (!e.greet) return
    const list = Array.isArray(tavern.opening?.greetings) ? tavern.opening.greetings : []
    const show = state.mode === 'input'
      && state.paras.length === 0 && state.history.length === 0
      && list.length > 0
    e.greet.style.display = show ? 'flex' : 'none'
    if (e.greet.dataset.rendered !== '1' && list.length > 0) {
      e.greet.dataset.rendered = '1'
      e.greet.innerHTML = ''
      const label = document.createElement('div')
      label.className = 'gg-greet-label'
      label.textContent = '—— 开场白 ——'
      e.greet.appendChild(label)
      for (const text of list) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'gg-greet-btn'
        btn.textContent = text
        btn.addEventListener('click', ev => {
          ev.stopPropagation()
          try { window.parent.postMessage({ t: 'tavern-insert', text }, '*') } catch { /* 窗口上下文异常 */ }
        })
        e.greet.appendChild(btn)
      }
    }
  }

  /* ── backlog 防剧透:当前回复合并成一个气泡,只截到已读文本 ──
     paras 元素是 {role,text} 对象,必须取 .text——整对象传 esc() 会
     字符串化成 [object Object](2026-09-24 真机量证:未点完拉历史必现)。 */
  function renderBacklog() {
    const e = el(); if (!e.root) return
    let html = ''
    for (const row of state.history) {
      if (row.role === 'assistant' && row.seq === state.asstSeq && state.asstText !== '') {
        // 防剧透:历史显示「已到达的段」(含当前展示段 r)——点完全部段(r=末段)
        // 即显示完整回复,不再丢最后一段;换行按原文偏移 slice 保留,刷新一致。
        const readEnd = state.lineEnds[Math.min(state.r, state.lineEnds.length - 1)]
        html += rowHTML('assistant', state.asstRaw.slice(0, (readEnd === undefined ? state.asstRaw.length : readEnd)))
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

  /* ── backlog 开合(宿主面板容器挂 gg-backlog-open 类:激活 CG 暗化)──
     point 开历史隐藏输入框:停靠的宿主 composer 退出停靠,回文档流后由
     body.gal-ui 隐藏规则接回;收起历史若仍在 input 态恢复停靠输入。 */
  let blOpen = false
  function openBacklog() {
    const e = el(); if (!e.root) return
    blOpen = true
    e.root.closest('.tavern-panel-galgame')?.classList.add('gg-backlog-open')
    e.root.querySelector('.gg-backlog').style.display = 'flex'
    undockComposer()
    renderBacklog(); dbg()
  }
  function closeBacklog() {
    const e = el(); if (!e.root) return
    if (!blOpen) return
    blOpen = false
    e.root.closest('.tavern-panel-galgame')?.classList.remove('gg-backlog-open')
    e.root.querySelector('.gg-backlog').style.display = 'none'
    if (state.mode === 'input') dockComposer()
  }

  /* ── 点击路由 ── */
  function onStageClick(event) {
    if (event.target.closest('.gg-bl-head, .gg-collapse, .gg-expand, .gg-greet, .gg-dock-slot, .gg-bl-body, .gg-think') !== null) return
    if (blOpen) { closeBacklog(); return }   // backlog 态点背景先收起,不误触跳段
    // 背景(CG 区)点击不推进不停止——避免「随便点一下就停」;
    // 读段/补全只认对话框内点击。停止仅 .gg-stop 键(绑定自身 click)。
    if (!event.target.closest('.gg-dialog')) return
    if (state.mode === 'waiting') return
    if (state.mode === 'input') return
    if (typing !== null) { completeParagraph(); dbg(); return }
    if (state.r < state.paras.length - 1) { startParagraph(state.r + 1); dbg(); return }
    // 队列尾已看完:有活性 live 流式生成中 → 实时显示它;否则进输入态
    if (state.liveText.trim() !== '') { displayLive(); return }
    setMode('input'); dbg()   // 对话队列点完 → 输入态(名字牌=你)
  }
  /* waiting 中:停止走 mount face 的 stop(宿主 chat view 同语义通道,
     经稳定 ref 转发)——替代曾点 .tavern-send-btn 的 DOM hack。 */
  function requestStop() {
    try {
      const done = tavern.stop?.()
      if (done && typeof done.catch === 'function') done.catch(err => console.warn('[gg] stop failed:', err?.message ?? err))
    } catch (err) { console.warn('[gg] stop failed:', err) }
    setMode('input')
  }

  /* ── 轮询:gal_data(900ms;rev 同值短路)── */
  let pollTimer = null
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
    // ① 新回复落盘 → durable 校准(补齐流式缺口;流式已播行不重播)。
    //     玩家话不在对话队列(不重复展示,在角落/backlog 用户行)。
    if (freshAsst) {
      const raw = d.lastAssistant?.orig || d.lastAssistant?.text
      if (raw) syncDurable(raw)   // 用保留注释的 orig:段级 CG 判定依赖行内注释
      return
    }
    // ② 只有新玩家行(无回复):发送已落盘 = 新回合开始 → 重置队列/读位/settle
    //     (否则上一回合残留的 r 会把新回合展示直接顶到最后段——2026-09-24 真机量证)
    if (freshUser && state.mode === 'input') {
      state.paras = []; state.r = 0
      // 新回合清掉上一回合的屏幕内容(waiting 态由 gg-waiting 类隐藏文本)
      const e = el(); e.text.textContent = ''; e.next.classList.remove('gg-on')
      setMode('waiting'); return
    }
    // ③ waiting 兜底:超 120s 无回复 → 回输入态
    if (state.mode === 'waiting' && Date.now() - state.waitStart > WAIT_TIMEOUT_MS) { setMode('input'); return }
    // ④ CG 换场(状态机不动)
    if (d.cg?.id !== undefined && d.cg.id !== state.cgId) { state.cgId = d.cg.id; crossfade(d.cg.id, d.cg.layers); setMood(state.cgId) }
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
    // 开场契约:active 翻转(玩家首条消息落盘/清空回跳)→ 重渲一拍
    // (greeting 显隐/停靠/状态机复核由各自渲染函数承担)
    const unsubOpening = tavern.opening?.subscribe?.(() => { syncDomState() })
    if (typeof unsubOpening === 'function') add(unsubOpening)
    // 流式桥:host 推 live assistant 文本,按行切即时渲染(纯加法,无 face 跳过)
    const unsubLive = tavern.assistantLive?.subscribe?.(handleLive)
    if (typeof unsubLive === 'function') add(unsubLive)
    // 思考流:宿主推 live reasoning,对话框上方折叠行流式更新
    const unsubReason = tavern.assistantLive?.subscribeReasoning?.(handleReasoning)
    if (typeof unsubReason === 'function') add(unsubReason)
    const thinkHead = el().think?.querySelector('.gg-think-head')
    thinkHead?.addEventListener('click', e => { e.stopPropagation(); toggleThink() })
    // waiting 停止仅此键(背景点击不再触发 requestStop)
    el().stop?.addEventListener('click', e => { e.stopPropagation(); requestStop() })
    el().expand.addEventListener('click', e => {
      e.stopPropagation()
      if (blOpen) closeBacklog(); else openBacklog()
    })
    el().collapse.addEventListener('click', e => {
      e.stopPropagation()
      closeBacklog()
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
      await ensureCgLayers()
      setMood(state.cgId)
      // 开场期(契约:tavern.opening.active;数据兜底:无 assistant 历史)→ 恒输入态
      // (greeting 选项在对话框内,点击填宿主 composer draft,发送由玩家手势触发)。
      if (tavern.opening?.active === true && !d.lastAssistant) setMode('input')
      else if (d.lastAssistant?.orig || d.lastAssistant?.text) {
        // 存档/刷新:不重播,直接进 input(玩家可展开历史看完整;演绎全新会话才在 live 走)。
        // 存档视为全部已读 → 历史完整可见,且不会再出现「演绎时 input 还挂着」。
        applyTurn(d.lastAssistant.orig || d.lastAssistant.text)
        state.r = state.paras.length - 1
        setMode('input')
        renderBacklog()
      } else {
        // 有玩家行无回复 / 无任何行 → 输入态(玩家话在角落/backlog)
        applyTurn(''); setMode('input')
      }
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