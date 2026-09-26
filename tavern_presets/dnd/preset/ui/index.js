// 冒险手簿 — 右栏面板(preset/ui/layout.json 声明的 codex 面板)。
// 数据经 tavern.runScript 轮询 preset/scripts/ui_data.mjs(整册 JSON);
// 阅读器原则:LLM 写的文档原样直出(.codex-doc),不提取数值、不拆行排版——写的是什么就显示什么;
// 面板内部 DOM 类名 .codex-* 不进稳定钩子契约。

const CSS = `
.codex { font-family: var(--t-serif, Georgia, serif); color: var(--t-fg, #3f3626);
  font-size: 13px; line-height: 1.7; height: 100%; display: flex; flex-direction: column;
  background: var(--t-surface-card, #faf5e7); border-left: 1px solid var(--t-border, #d9c9a4); }
.codex-head { padding: 10px 14px 8px; border-bottom: 1px solid var(--t-border-soft, #e8dec4); }
.codex-title { font-size: 13px; letter-spacing: 0.4em; text-indent: 0.4em;
  color: var(--t-gold-deep, #8a6d1a); text-align: center; }
.codex-tabs { display: flex; padding: 8px 10px 0; gap: 4px; }
.codex-tab { flex: 1; appearance: none; font: inherit; font-size: 12px; cursor: pointer;
  padding: 6px 0; border: 1px solid var(--t-border-soft, #e8dec4); border-bottom: none;
  border-radius: 6px 6px 0 0; background: var(--t-surface-2, #f2ead6);
  color: var(--t-muted, #7d6c4e); }
.codex-tab.on { background: var(--t-card, #f3ecd9); color: var(--t-fg-strong, #2e2716);
  font-weight: 600; border-color: var(--t-border, #d9c9a4); }
.codex-body { flex: 1; overflow-y: auto; padding: 12px 14px 18px;
  border-top: 1px solid var(--t-border-soft, #e8dec4); }
.codex-label { font-size: 11px; letter-spacing: 0.18em; color: var(--t-muted2, #9b8a66);
  margin: 14px 0 4px; display: flex; align-items: center; gap: 8px; }
.codex-label::after { content: ""; flex: 1; height: 1px; background: var(--t-border-soft, #e8dec4); }
.codex-label:first-child { margin-top: 0; }
.codex-card { border: 1px solid var(--t-border-soft, #e8dec4); border-radius: 6px;
  background: var(--t-card, #f3ecd9); padding: 7px 10px; margin: 6px 0; }
.codex-card .nm { font-weight: 600; color: var(--t-fg-strong, #2e2716); font-size: 13px; }
.codex-doc { white-space: pre-wrap; word-break: break-word; font-size: 12px;
  color: var(--t-fg, #3f3626); }
.codex-card .nm + .codex-doc { margin-top: 5px; padding-top: 5px;
  border-top: 1px dashed var(--t-border-soft, #e8dec4); }
.codex-empty { color: var(--t-muted2, #9b8a66); font-size: 12px; padding: 6px 0; }
`

function esc(value) {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

function label(text) { return `<div class="codex-label">${esc(text)}</div>` }

// 一份文档 = 卡(标题)+ 正文原文;正文缺失时退回 frontmatter 描述。
function doc(d) {
  const name = (d?.name ?? '').trim()
  const text = (d?.body ?? '').trim() !== '' ? String(d.body) : String(d?.desc ?? '').trim()
  if (name === '' && text === '') return ''
  return `<div class="codex-card">${name === '' ? '' : `<div class="nm">${esc(name)}</div>`}${text === '' ? '' : `<div class="codex-doc">${esc(text)}</div>`}</div>`
}

function shelf(list, emptyText) {
  const docs = (list ?? []).map(doc).filter(html => html !== '')
  return docs.length > 0 ? docs.join('') : `<div class="codex-empty">${esc(emptyText)}</div>`
}

function group(title, html) { return html.trim() === '' ? '' : label(title) + html }

function render(data, tab) {
  const p = data?.player ?? {}
  if (tab === 'quests') return group('故事', doc(data?.state ?? {})) + group('委托', shelf(data?.quests, '尚未接受的委托'))
  if (tab === 'items') return shelf(data?.items, '行囊空空')
  if (tab === 'skills') return shelf(data?.skills, '尚无收录的技能')
  if (tab === 'places') return shelf(data?.places, '尚未踏足的地方')
  return group('你', doc(p)) + group('结识人物', shelf(data?.npcs, '尚无结识的角色'))
}

export function mount(tavern) {
  // opening 桥:开场页(sandbox iframe,无文件 API)经 postMessage 读写 runtime——
  // opening-init 请求预填数据 / opening-persist 全量落盘(失焦/新建/删除即存)。
  const onMessage = event => {
    const data = event.data
    if (data === undefined || data === null) return
    const reply = msg => { try { event.source.postMessage(msg, '*') } catch { /* 窗口已关 */ } }
    if (data.t === 'opening-init') {
      tavern.runScript('opening_data.mjs')
        .then(text => reply({ t: 'opening-init-data', ok: true, data: JSON.parse(text) }))
        .catch(error => reply({ t: 'opening-init-data', ok: false, detail: error instanceof Error ? error.message : String(error) }))
      return
    }
    if (data.t === 'opening-persist') {
      const payload = typeof data.state === 'string' ? data.state : JSON.stringify(data.state ?? {})
      tavern.runScript('opening_commit.mjs', payload)
        .then(text => reply({ t: 'opening-persist-ack', ok: true, detail: typeof text === 'string' && text.trim() !== '' ? text : '已落盘' }))
        .catch(error => reply({ t: 'opening-persist-ack', ok: false, detail: error instanceof Error ? error.message : String(error) }))
      return
    }
  }
  window.addEventListener('message', onMessage)

  // ── 开场期隐身三联(v10 2026-09-25 零轮询:表面迁移 opening face,500ms visPoll 退役)。
  // 同拍仍管两件让位:①composer/用量行在面板在场时左移避让(chat.css .codex-shift);
  // ②转写容器挂 opening-live(几何见 chat.css)。旧宿主无 opening face → 回退
  // DOM 模糊类探测轮询(容错态,只此一条退路)。──
  const surfaceTurn = (openingLive) => {
    const host = document.querySelector('.tavern-panel-codex')
    if (host !== null) host.style.display = openingLive ? 'none' : ''
    const composer = document.querySelector('.tavern-composer')
    if (composer !== null) composer.classList.toggle('codex-shift', !openingLive)
    const transcript = document.querySelector('.tavern-transcript')
    if (transcript !== null) transcript.classList.toggle('opening-live', openingLive)
  }
  // v10 订阅收集面:mount 生命周期内的一切退订统一收口。
  const withdraws = []
  if (typeof tavern.opening?.subscribe === 'function' && 'active' in tavern.opening) {
    const unsubscribe = tavern.opening.subscribe(() => { surfaceTurn(tavern.opening?.active === true) })
    if (typeof unsubscribe === 'function') withdraws.push(unsubscribe)
    surfaceTurn(tavern.opening.active === true)
  } else {
    const visPoll = setInterval(() => { surfaceTurn(document.querySelector('[class*="openingFrame"]') !== null) }, 500)
    surfaceTurn(document.querySelector('[class*="openingFrame"]') !== null)
    withdraws.push(() => clearInterval(visPoll))
  }

  // 面板容器由宿主按 layout.json 渲染,mount 可能跑在容器出现之前。
  // v10:200ms 有界自旋改 MutationObserver(纯 DOM 事件,无迟漏无需上界)。
  let stop
  const launch = (host) => {
    try { stop = start(tavern, host) } catch (error) { console.warn('[codex] 启动失败 —', error instanceof Error ? error.message : String(error)) }
  }
  const host0 = document.querySelector('.tavern-panel-codex')
  if (host0 !== null) {
    launch(host0)
  } else {
    const observer = new MutationObserver(() => {
      const found = document.querySelector('.tavern-panel-codex')
      if (found !== null) { observer.disconnect(); launch(found) }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    withdraws.push(() => observer.disconnect())
  }
  return () => {
    for (const off of withdraws.splice(0)) { try { off() } catch { /* 收尾不放大 */ } }
    window.removeEventListener('message', onMessage)
    if (stop !== undefined) stop()
  }
}

/** 建本地簿 DOM 与轮询;幂等:重入前先拆上一实例(引擎 effect 重入会再次 mount)。 */
function start(tavern, host) {
  if (host.__codexStop !== undefined) host.__codexStop()
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.append(style)

  host.innerHTML = `
    <div class="codex">
      <div class="codex-head">
        <div class="codex-title">冒险手簿</div>
      </div>
      <div class="codex-tabs">
        <button type="button" class="codex-tab" data-tab="people">人物</button>
        <button type="button" class="codex-tab" data-tab="quests">任务</button>
        <button type="button" class="codex-tab" data-tab="items">物品</button>
        <button type="button" class="codex-tab" data-tab="skills">技能</button>
        <button type="button" class="codex-tab" data-tab="places">地点</button>
      </div>
      <div class="codex-body" id="codex-body"></div>
    </div>`

  let data = null
  let tab = 'people'
  const body = host.querySelector('#codex-body')
  const paint = () => {
    for (const el of host.querySelectorAll('.codex-tab')) el.classList.toggle('on', el.dataset.tab === tab)
    body.innerHTML = data?.ok ? render(data, tab) : '<div class="codex-empty">世界尚未开始——开局后这里会记录一切。</div>'
  }
  // v10(2026-09-25 零轮询):全文本门——此卡脚本无 rev 协议,比对整份应答文本,
  // 同值连 paint 都省(曾无门每 2.5s 无条件 innerHTML 重绘,三卡里最浪费的一处)。
  let lastText = null
  const refresh = async () => {
    try {
      const text = await tavern.runScript('ui_data.mjs')
      if (text === lastText) return
      lastText = text
      const parsed = JSON.parse(text)
      if (parsed?.ok === true) data = parsed
    } catch { /* 保留上一次数据,失败不打扰 */ }
    paint()
  }
  for (const el of host.querySelectorAll('.codex-tab')) {
    el.addEventListener('click', () => { tab = el.dataset.tab; paint() })
  }
  paint()
  // v10 零轮询:2.5s 定时钟退役 → 工作区一动(tavern.files 事件)即拉;旧宿主无
  // face = 无订阅,退化为纯手势(翻页签/开局)驱动(纯加法语义)。
  const unsubFiles = tavern.files?.subscribe?.(() => { void refresh() })
  void refresh()
  const stop = () => {
    if (typeof unsubFiles === 'function') unsubFiles()
    style.remove(); host.innerHTML = ''; delete host.__codexStop
  }
  host.__codexStop = stop
  return stop
}
