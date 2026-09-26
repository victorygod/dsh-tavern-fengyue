// para.mjs — 演出机:唯一推进者(2026-09-25 域重构批)。
// mode 迁移(reading|waiting|input)、120s 看门狗、打字机、点击节流、读位恢复三分支、
// live 两拍、落定校准、思考行、开场白、backlog——全卡唯一写书签的手、唯一发舞台
// 演出事件的手。规则(切分/防剧透口径/三分支/合流/渲染)全部在 views 纯函数,
// 本体只留时序;状态机语义与现役 index.js 逐条一致(行为锚 = client spec 16 例)。
// nodes 由组装一次建好传入(不再逐拍重查);降级自理:舞台/书签/宿主 face 缺位不在此感知。
const TYPE_MS = 26

export function createPresenter({ bookmark, stage, views, nodes, opening, stopper }) {
  const WAIT_TIMEOUT_MS = 120_000   // waiting 兜底:超时未结算回落输入态(一次性看门狗,不寄生拉取)
  let disposed = false
  let mode = 'boot', r = 0
  let liveTail = ''                 // 流式中未遇 \n 的活性行(实时上屏)
  let reasoning = '', thinkOpen = false, blOpen = false
  let script = views.makeScript(null, [])
  let paras = []                    // 展示队列(剧本段副本 + live 追加;正本在剧本)
  let typing = null
  let waitGuard = null
  const stops = []
  const add = fn => { if (typeof fn === 'function') stops.push(fn) }

  const dbg = () => { if (nodes.root != null) nodes.root.dataset.state = `mode=${mode} · 段 ${r + 1}/${Math.max(paras.length, 1)}` }

  /* ── 思考折叠行(对话框盒外上方):流式推理实时更新,默认折叠。── */
  function placeThink() {
    if (nodes.think == null || nodes.dialog == null) return
    const dr = nodes.dialog.getBoundingClientRect()
    const vh = window.innerHeight
    nodes.think.style.bottom = `${Math.max(4, Math.round(vh - dr.top + 12))}px`
  }
  function renderThink() {
    if (nodes.think == null) return
    const text = reasoning
    if (text.trim() === '') { nodes.think.style.display = 'none'; return }
    nodes.think.style.display = 'block'   // 显式 block:'' 会回退到 CSS 默认 none,永远隐藏
    nodes.think.classList.toggle('gg-think-open', thinkOpen)
    nodes.thinkBody.textContent = text
    // 折叠摘要显示「最末非空行」(流式更新到最新一行,镜像宿主 summaryOf)
    const lines = text.split('\n').map(t => t.trim()).filter(t => t !== '')
    const last = lines.length > 0 ? lines[lines.length - 1] : ''
    nodes.thinkSummary.textContent = last.length > 60 ? `${last.slice(0, 60)}…` : last
    placeThink()
  }
  function think(text) {
    // 只接受有内容:宿主 live 结束后会推空串清 live,不能覆盖已收集的本轮思考
    if (String(text ?? '').trim() === '') return
    reasoning = String(text)
    renderThink(); dbg()
  }
  function toggleThink() { thinkOpen = !thinkOpen; renderThink(); dbg() }

  /* ── greeting 选项(开场契约:数据据 tavern.opening,不摸宿主 DOM)──
     显示 = 输入态 ∧ 还没开聊;点击 postMessage tavern-insert 填宿主 draft(只填不送)。 */
  function renderGreet() {
    if (nodes.greet == null) return
    const list = Array.isArray(opening?.greetings) ? opening.greetings : []
    const show = mode === 'input'
      && paras.length === 0 && (script.history ?? []).length === 0
      && list.length > 0
    nodes.greet.style.display = show ? 'flex' : 'none'
    if (nodes.greet.dataset.rendered !== '1' && list.length > 0) {
      nodes.greet.dataset.rendered = '1'
      nodes.greet.innerHTML = ''
      const label = document.createElement('div')
      label.className = 'gg-greet-label'
      label.textContent = '—— 开场白 ——'
      nodes.greet.appendChild(label)
      for (const text of list) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'gg-greet-btn'
        btn.textContent = text
        btn.addEventListener('click', ev => {
          ev.stopPropagation()
          try { window.parent.postMessage({ t: 'tavern-insert', text }, '*') } catch { /* 窗口上下文异常 */ }
        })
        nodes.greet.appendChild(btn)
      }
    }
  }

  /* ── 模式切换与渲染同步 ── */
  function setMode(m) {
    mode = m
    bookmark.touch({ mode: m })
    if (m === 'input') bookmark.save(paras.length)
    if (m === 'waiting') {
      waitGuard = setTimeout(() => {
        waitGuard = null
        if (!disposed && mode === 'waiting') setMode('input')
      }, WAIT_TIMEOUT_MS)
    } else if (waitGuard !== null) {
      clearTimeout(waitGuard); waitGuard = null
    }
    syncDomState(); dbg()
  }
  function syncDomState() {
    if (nodes.root == null || nodes.dots == null || nodes.dialog == null) return   // 重入瞬态守卫:DOM 可能已被下一轮 mount 换血
    nodes.root.closest('.tavern-panel-galgame')?.classList.toggle('gg-waiting', mode === 'waiting')
    nodes.dots.style.display = mode === 'waiting' ? 'flex' : 'none'
    nodes.who.textContent = mode === 'input' ? '你' : '芙宁娜'
    nodes.next.classList.toggle('gg-on', mode === 'reading' && r < paras.length - 1)
    nodes.stop.style.display = mode === 'waiting' ? 'inline-block' : 'none'
    // input 显隐 = .gg-input 类(CSS 开闭 dock-slot)
    nodes.dialog.classList.toggle('gg-input', mode === 'input')
    renderGreet()
    renderThink()
  }

  /* ── backlog(防剧透口径与渲染在 views,此处只换装+滚动)── */
  function renderBacklog() {
    if (nodes.root == null) return
    const rows = views.visibleHistory(script, { r, asstSeq: bookmark.get().asstSeq })
    nodes.blBody.innerHTML = views.renderHistoryHTML(rows)
    nodes.blBody.scrollTop = nodes.blBody.scrollHeight
  }
  function openBacklog() {
    if (nodes.root == null) return
    blOpen = true
    nodes.root.closest('.tavern-panel-galgame')?.classList.add('gg-backlog-open')
    nodes.backlog.style.display = 'flex'
    renderBacklog(); dbg()
  }
  function closeBacklog() {
    if (nodes.root == null) return
    if (!blOpen) return
    blOpen = false
    nodes.root.closest('.tavern-panel-galgame')?.classList.remove('gg-backlog-open')
    nodes.backlog.style.display = 'none'
  }

  /* ── 活性行实时上屏:无待展示定型段时,live 尾行直接进对话框(无打字机重播)── */
  function displayLive() {
    if (liveTail.trim() === '') return
    nodes.who.textContent = '芙宁娜'
    nodes.dialog.classList.remove('gg-you')
    clearInterval(typing); typing = null
    nodes.text.textContent = liveTail
    nodes.next.classList.remove('gg-on')
    setMode('reading')
    renderBacklog(); dbg()
  }

  /* ── live 入队:完整行追加队列;首条(空闲/waiting)即上屏,其余只入队等玩家手势。
     入队不切 CG——切换时机 = 下一条段「展示」时(startParagraph 按该段内嵌指令)。── */
  function pushLine(row) {
    const text = typeof row === 'string' ? row.trim() : (row?.text ?? '').trim()
    if (text === '') return
    paras.push({ role: 'assistant', text, cg: row?.cg ?? null })
    if (mode === 'reading') { renderBacklog(); dbg(); return }
    r = paras.length - 1
    bookmark.touch({ r })
    setMode('reading')
    startParagraph(r)
  }
  function pushLive(text) {
    const merged = views.mergeLive({ paras }, text)
    liveTail = merged.liveTail
    for (const row of merged.paras.slice(paras.length)) pushLine(row)
    const showingFixed = mode === 'reading' && r < paras.length
    if (!showingFixed) displayLive()
  }

  /* ── 段落展示:打字机 + 段级 CG 时机 + 读位落盘(推进/恢复即刻)── */
  function startParagraph(i) {
    r = i; mode = 'reading'
    bookmark.touch({ r, mode: 'reading' })
    const cur = paras[i] ?? { role: 'assistant', text: '' }
    if (cur.cg) void stage.show(cur.cg)   // 该段出现即切该段指定 CG
    const full = cur.text
    nodes.who.textContent = cur.role === 'user' ? '你' : '芙宁娜'
    nodes.dialog.classList.toggle('gg-you', cur.role === 'user')
    clearInterval(typing); typing = null
    nodes.text.innerHTML = ''
    const cursor = document.createElement('span'); cursor.className = 'gg-cursor'; nodes.text.appendChild(cursor)
    let n = 0
    typing = setInterval(() => {
      n += 1; cursor.insertAdjacentText('beforebegin', full[n - 1] ?? '')
      if (n >= full.length) { clearInterval(typing); typing = null; cursor.remove() }
      placeThink()   // 对话框高度随打字增长,思考行保持贴顶
    }, TYPE_MS)
    syncDomState(); renderBacklog(); dbg()
    bookmark.save(paras.length)
  }
  function completeParagraph() {
    clearInterval(typing); typing = null
    nodes.text.textContent = (paras[r] ?? {}).text ?? ''
    nodes.next.classList.toggle('gg-on', r < paras.length - 1)
  }

  /* ── 点击路由 ── */
  function onStageClick(event) {
    if (event.target.closest('.gg-bl-head, .gg-collapse, .gg-expand, .gg-greet, .gg-dock-slot, .gg-bl-body, .gg-think') !== null) return
    if (blOpen) { closeBacklog(); return }   // backlog 态点背景先收起,不误触跳段
    // 背景(CG 区)点击不推进不停止;读段/补全只认对话框内点击;停止仅 .gg-stop 键。
    if (!event.target.closest('.gg-dialog')) return
    if (mode === 'waiting') return
    if (mode === 'input') return
    if (typing !== null) { completeParagraph(); dbg(); return }
    if (r < paras.length - 1) { startParagraph(r + 1); dbg(); return }
    // 队列尾已看完:有活性 live 流式生成中 → 实时显示它;否则进输入态
    if (liveTail.trim() !== '') { displayLive(); return }
    setMode('input'); dbg()
  }
  /* waiting 中:停止走宿主 chat view 同语义通道(替代曾点 .tavern-send-btn 的 hack)。 */
  function requestStop() {
    try {
      const done = stopper?.()
      if (done && typeof done.catch === 'function') done.catch(err => console.warn('[gg] stop failed:', err?.message ?? err))
    } catch (err) { console.warn('[gg] stop failed:', err) }
    setMode('input')
  }

  /* ── 剧本装配:新轮回=换整个对象(队列取副本供 live 追加,正本不动)── */
  function adopt(next) {
    script = next
    paras = next.paras.slice()
  }

  /* ── 落定校准(① freshAsst):以剧本为准重建队列——流式已推过的段保留
     (r 不后退),尾部残片/缺口由 durable 替换;落定后无活性行。── */
  function settle(fact) {
    const prevR = r
    adopt(fact.script)
    liveTail = ''
    r = Math.min(prevR, paras.length - 1)
    bookmark.touch({ r })
    if (mode === 'reading') {
      const cur = paras[r] ?? { text: '' }
      nodes.text.textContent = cur.text
      nodes.next.classList.toggle('gg-on', r < paras.length - 1)
    } else if (paras.length > 0) {
      startParagraph(r)   // 流式未启动即落定:立即展示队列头
    }
    renderBacklog(); dbg()
    bookmark.save(paras.length)
  }

  /* ── boot(首拍定态):泵态换景/资产 → 空回落输入态 / 三分支读位恢复。── */
  function bootFact(fact) {
    adopt(fact.script)
    void stage.warm()                                   // manifest 索引本拍预载(boot 原序)
    void stage.show(fact.cg?.id ?? null, fact.cg?.layers)
    void stage.prime(fact.assetKeys)
    if (opening?.active === true && !fact.hasAsst) { setMode('input'); return }
    if (!fact.hasAsst) { setMode('input'); return }     // 有玩家行无回复/无任何行 → 输入态
    const verdict = views.decideRestore(bookmark.saved(), fact.aSeq, paras.length)
    if (verdict.plan === 'resume') {
      // 同回合存位:回到读到的那段完整上屏(不打字机重播)
      r = verdict.r; bookmark.touch({ r })
      setMode('reading'); startParagraph(r); completeParagraph(); renderBacklog()
    } else if (verdict.plan === 'replay') {
      // 缺席期新回复:玩家未读,从队头从头演绎(防剧透同义)
      setMode('reading'); startParagraph(0); renderBacklog()
    } else {
      r = paras.length - 1; bookmark.touch({ r })
      setMode('input'); renderBacklog()                // 无存位/存位 input:直落输入态(旧契约)
    }
  }

  /* ── 事实梯(poll ①②④⑤ 原序):水位先随拍,分支体在此。── */
  function handleFact(fact) {
    if (disposed || nodes.root == null) return
    if (fact.session != null) bookmark.touch({ sid: fact.session })   // 键自愈:poll 拍补 boot 缺的键
    const bm = bookmark.get()
    if (fact.aSeq > bm.asstSeq) bookmark.touch({ asstSeq: fact.aSeq })
    if (fact.reason === 'boot') { bootFact(fact); return }
    if (fact.freshAsst) { settle(fact); return }                       // ① 新回复落定 → 校准
    if (fact.freshUser && mode === 'input') {                          // ② 新玩家行 → 清屏进 waiting
      paras = []; r = 0; bookmark.touch({ r: 0 })
      nodes.text.textContent = ''; nodes.next.classList.remove('gg-on')
      setMode('waiting')
      return
    }
    if (fact.cg?.id !== undefined && fact.cg.id !== stage.id) void stage.show(fact.cg.id, fact.cg.layers)   // ④ 泵态换景
    void stage.prime(fact.assetKeys)                                    // ⑤ 资产补缺
  }

  /* boot 连接失败上屏(BOOT_TRIES 上界后停摆,不再自旋)。 */
  function dead(error) {
    if (nodes.who == null) return
    nodes.who.textContent = '芙宁娜'
    nodes.text.textContent = '—— 数据通道未就绪(详见控制台)——'
    console.warn('[gg] gal_data 连接失败:', error ?? '数据源未就绪')
  }

  /* ── 装配(组组装建好的节点,此处只挂交互)── */
  nodes.root.addEventListener('click', onStageClick)
  nodes.think?.querySelector('.gg-think-head')?.addEventListener('click', e => { e.stopPropagation(); toggleThink() })
  nodes.stop?.addEventListener('click', e => { e.stopPropagation(); requestStop() })
  nodes.expand.addEventListener('click', e => { e.stopPropagation(); if (blOpen) closeBacklog(); else openBacklog() })
  nodes.collapse.addEventListener('click', e => { e.stopPropagation(); closeBacklog() })
  const onResize = () => { placeThink() }
  window.addEventListener('resize', onResize)
  add(() => window.removeEventListener('resize', onResize))
  syncDomState()

  return {
    handleFact,
    pushLive,
    think,
    pulse: syncDomState,   // opening 契约翻转 → 重渲一拍
    dead,
    dispose() {
      disposed = true
      if (typing !== null) { clearInterval(typing); typing = null }
      if (waitGuard !== null) { clearTimeout(waitGuard); waitGuard = null }
      for (const fn of [...stops].reverse()) { try { fn() } catch { /* 清理容忍 */ } }
    },
  }
}
