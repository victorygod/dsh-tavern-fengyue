// acts.mjs — v10 交互动作:layout.json/视图里 [data-act] 点名,宿主事件委托派发到同名导出。
// 动作内可以动 DOM/调 runScript,但没有生命周期(挂载/卸载/轮询全是宿主的事)。
// 册的 markup 复用 view.mjs 同源函数(ctx.views)——样式与结构仍在卡的地盘。
// 成长学习对话框=grow 系动作(2026-09-24 定案,fc 待办模态退役):呼吸节标题(saves/spells 有待办)弹框。

// ── 数据册:开(toggle)/合 ──
let anchorEl = null

export function book(ctx) {
  const target = ctx.actEl.dataset['target'] ?? ''
  if (target === '') return
  // 浮层挂 document.body:①position:fixed 的包含块=视口(插面板容器会被其 transform 劫持偏移)
  // ②泵重绘不吞浮层 ③同一次点击只此一份(容器守卫已限单派发)
  const existing = document.querySelector('.book.open')
  if (existing !== null && existing.dataset['target'] === target) { existing.remove(); anchorEl = null; return }
  existing?.remove()
  // v4(2026-09-25):按卡所属面板取切片——左池(companions/neutrals)与右池(foes)分住两个面板响应,取点击源头的那份。
  ctx.runScript('ui_data.mjs', JSON.stringify({ op: 'panel', name: ctx.panel })).then(text => {
    const slice = JSON.parse(text)
    const pools = target === 'player'
      ? [slice?.data?.player]
      : [slice?.data?.player, ...(slice?.data?.companions ?? []), ...(slice?.data?.neutrals ?? []), ...(slice?.data?.foes ?? [])]
    const c = pools.find(x => x && (target === 'player' || x._file === target))
    if (!c || c._missing) return
    const html = ctx.views?.bookHtml?.(c, ctx.avatars) ?? ''
    if (html === '') return
    document.querySelector('.book.open')?.remove()
    document.body.insertAdjacentHTML('beforeend', html)
    const book = document.querySelector('.book.open')
    if (book === null) return
    book.dataset['target'] = target
    book.dataset['panel'] = ctx.panel   // 归属标记:body 浮层的 act 派发回创建面板
    book.classList.add('dnd-hud')   // token 作用域:body 直挂——纸面变量自携
    anchorEl = ctx.actEl
    positionBook(book, anchorEl)
    const body = book.querySelector('.bk-body')
    const check = () => book.classList.toggle('s-fly', body !== null && body.scrollHeight - body.scrollTop > body.clientHeight + 4)
    body?.addEventListener('scroll', check)
    requestAnimationFrame(check)
  }).catch(e => console.warn('[dnd5e-acts] book failed —', e instanceof Error ? e.stack ?? e.message : String(e)))
}

export function bookClose(ctx) { document.querySelectorAll('.book.open').forEach(b => b.remove()); anchorEl = null }

/** 窗口缩放/重锚（换绑即随容器处理;面板重绘保留 book 由 lastData+ui 重挂？不——book 是 act 建件,重绘会清掉,acts 语义=下次点击重开） */
function positionBook(el, anchor) {
  if (!anchor || !anchor.isConnected) return   // 重绘后锚点被重建→无参照时保持原位
  const r = anchor.getBoundingClientRect()
  const w = el.offsetWidth, h = el.offsetHeight
  const vw = window.innerWidth, vh = window.innerHeight
  let left = r.right + 10
  if (left + w > vw - 12) left = Math.max(12, r.left - w - 10)
  el.style.left = left + 'px'
  el.style.top = Math.min(Math.max(r.top - 6, 12), Math.max(12, vh - h - 14)) + 'px'
}

// ── 任务手风琴:ui-state 集合翻转 + 即时重绘 ──
export function quest(ctx) {
  const key = ctx.actEl.dataset['q'] ?? ''
  if (key === '') return
  const open = ctx.getUi('questOpen') ?? new Set()
  const next = new Set(open)
  next.has(key) ? next.delete(key) : next.add(key)
  ctx.setUi('questOpen', next)
  ctx.repaint()
}

// ── 成长学习对话框（2026-09-24 定案:fc 模态退役;呼吸节标题 'grow' 弹出,视口居中、册不关）──
// 一档一保存（C1 语义）:恰 2 点/恰 2 法术才可保存,落盘走 front_commit 逐档销标记;取消/外侧/Esc=放弃。
const ATTRS = [['力', 'str'], ['敏', 'dex'], ['体', 'con'], ['智', 'int'], ['感', 'wis'], ['魅', 'cha']]
const mod = v => Math.floor((v - 10) / 2)
const sign = v => (v >= 0 ? '+' : '−') + Math.abs(v)
const Grow = { open: null, asi: {}, spells: [], player: null, candidates: null, panel: 'hud-left', lastCtx: null }
const asiSum = () => Object.values(Grow.asi).reduce((a, b) => a + b, 0)

export function grow(ctx) {
  const kind = ctx.actEl.dataset['kind'] ?? ''
  if (kind !== 'asi' && kind !== 'spells') return
  if (Grow.open && Grow.open !== kind) { Grow.asi = {}; Grow.spells = [] }   // 换节即弃旧选
  Grow.open = kind
  Grow.panel = ctx.panel
  Grow.lastCtx = ctx
  ctx.setUi('grow', { open: kind })
  ctx.repaint()   // 呼吸标题栏 → on 态
  wireGlobal()
  if (kind === 'asi') {
    // 行内现值来自面板切片（玩家六维）;读一次缓存,保存后由 refresh 回落
    if (Grow.player === null) {
      shellDlg(`<div class="g-title">属性点 · 本档恰 2 点<span class="tag">面板读取中…</span></div>`)
      ctx.runScript('ui_data.mjs', JSON.stringify({ op: 'panel', name: 'hud-left' }))
        .then(t => { Grow.player = JSON.parse(t)?.data?.player ?? null; if (Grow.open === 'asi') renderGrow() })
        .catch(e => setMsg('面板读取失败：' + (e instanceof Error ? e.message : String(e))))
      return
    }
    renderGrow()
    return
  }
  if (Grow.candidates === null) {
    shellDlg(`<div class="g-title">学新法术 · 本档恰 2 个<span class="tag">候选读取中…</span></div>`)
    ctx.runScript('ui_data.mjs', JSON.stringify({ op: 'candidates' }))
      .then(t => { Grow.candidates = JSON.parse(t)?.candidates ?? []; if (Grow.open === 'spells') renderGrow() })
      .catch(e => setMsg('候选读取失败：' + (e instanceof Error ? e.message : String(e))))
    return
  }
  renderGrow()
}

function tiersLeft(kind) {
  return (Grow.player?.pending ?? []).filter(x => String(x).includes(kind === 'asi' ? 'ASI' : '新法术')).length
}

function shellDlg(inner) {
  document.querySelector('.g-dlg')?.remove()
  const dlg = document.createElement('div')
  dlg.className = 'g-dlg dnd-hud'   // body 直挂——token 自携,否则 var(--p1) 空解析=透明底
  dlg.dataset['panel'] = Grow.panel
  dlg.innerHTML = `<div class="g-panel">${inner}<div class="g-msg"></div></div>`
  dlg.classList.add('open')   // .g-dlg 默认 display:none——缺 open 类=真浏览器永不可见(browser 回归钉)
  document.body.append(dlg)
  dlg.style.left = '50%'; dlg.style.top = '50%'   // translate 自适应居中——内容增减(±行列变化)自动回中
  dlg.style.transform = 'translate(-50%, -50%)'
  return dlg
}

function renderGrow() {
  if (Grow.open === 'asi') {
    const sel = asiSum()
    const tiers = tiersLeft('asi')
    const rows = ATTRS.map(([lb, key]) => {
      const n = Grow.asi[key] ?? 0
      const v = Grow.player?.[key] ?? 10
      const capped = sel >= 2 && n === 0
      return `<div class="g-att ${n ? 'sel' : ''} ${capped ? 'cap' : ''}">
        <b>${lb}</b><span class="vv">${v} <span class="md">(${sign(mod(v))})</span>${n ? ` <span class="to">→ ${v + n} <span class="md">(${sign(mod(v + n))})</span></span>` : ''}</span><span class="delta ${n ? 'on' : ''}">${n ? '+' + n : '+0'}</span>
        <span class="ctl"><button class="step" data-act="growDec" data-dec="${key}" ${n ? '' : 'disabled'}>−</button><button class="step" data-act="growInc" data-inc="${key}" ${(sel >= 2 || n >= 2) ? 'disabled' : ''}>＋</button></span>
      </div>`
    }).join('')
    shellDlg(`
      <div class="g-title">属性点 · 本档恰 2 点<span class="tag">RAW +2 单项 / +1×2 · 上限 20</span>${tiers > 1 ? `<span class="tag">已共 ${tiers} 档</span>` : ''}</div>
      <div class="g-asi">${rows}</div>
      <div class="g-foot"><span class="g-hint">已分 ${sel}/2 点 · 有加有减,保存后雷达即见形</span>
        <button class="g-btn ghost" data-act="growClose">取消</button><button class="g-btn" data-act="growSave" data-kind="asi" ${sel === 2 ? '' : 'disabled'}>保存</button></div>`)
    return
  }
  const list = Grow.candidates ?? []
  const tiers = tiersLeft('spells')
  const rows = list.map(c2 => {
    const picked = Grow.spells.includes(c2.name)
    const capped = Grow.spells.length >= 2 && !picked
    return `<button class="gp-row ${picked ? 'sel' : ''} ${capped ? 'cap' : ''}" data-act="growPick" data-spell="${esc(c2.name)}"><span class="nm">${esc(c2.name_cn ?? c2.name)}</span>${c2.ritual ? '<span class="rt">仪式</span>' : ''}<span class="lv2">${c2.level}环</span><span class="pk">${picked ? '✓' : '＋'}</span></button>`
  }).join('')
  shellDlg(`
    <div class="g-title">学新法术 · 本档恰 2 个<span class="tag">须为可施环阶</span>${tiers > 1 ? `<span class="tag">已共 ${tiers} 档</span>` : ''}</div>
    <div class="g-pick"><div class="gp-cap">可学候选——本职业表 ∩ 环位 ≤ 可施 ∩ 未收录 ∩ 非戏法</div><div class="gp-list">${rows || '<div class="gp-cap">无可学候选</div>'}</div></div>
    <div class="g-foot"><span class="g-hint">已选 ${Grow.spells.length}/2 · 不保存即悬置</span>
      <button class="g-btn ghost" data-act="growClose">取消</button><button class="g-btn" data-act="growSave" data-kind="spells" ${Grow.spells.length === 2 ? '' : 'disabled'}>保存</button></div>`)
}

function setMsg(t) { const m = document.querySelector('.g-dlg .g-msg'); if (m) m.textContent = t }

export function growInc(ctx) {
  const k = ctx.actEl.dataset['inc'] ?? ''
  const n = Grow.asi[k] ?? 0
  if (asiSum() >= 2 || n >= 2) return
  Grow.asi[k] = n + 1
  renderGrow()
}
export function growDec(ctx) {
  const k = ctx.actEl.dataset['dec'] ?? ''
  const n = Grow.asi[k] ?? 0
  if (!n) return
  Grow.asi[k] = n - 1
  renderGrow()
}
export function growPick(ctx) {
  const name = ctx.actEl.dataset['spell'] ?? ''
  const i = Grow.spells.indexOf(name)
  if (i >= 0) Grow.spells.splice(i, 1)
  else if (Grow.spells.length < 2) Grow.spells.push(name)
  renderGrow()
}
export function growClose(ctx) {
  Grow.open = null; Grow.asi = {}; Grow.spells = []
  document.querySelector('.g-dlg')?.remove()
  ctx?.setUi('grow', { open: null })
  ctx?.repaint()
}
export async function growSave(ctx) {
  const kind = ctx.actEl.dataset['kind'] ?? ''
  if (kind === 'asi') {
    if (asiSum() !== 2) return setMsg('本档属性点须恰 2 点（RAW +2 单项 / +1×2）')
  } else if (kind === 'spells') {
    if (Grow.spells.length !== 2) return setMsg('本档恰学 2 个新法术（学不满请取消悬置）')
  } else return
  try {
    const payload = kind === 'asi' ? { stats: { ...Grow.asi } } : { learned: [...Grow.spells] }
    const t = await ctx.runScript('front_commit.mjs', JSON.stringify({ op: kind, who: 'player', payload }))
    const r = JSON.parse(t)
    if (r.ok === false) { setMsg(r.error ?? 'front_commit 拒绝'); return }
    Grow.open = null; Grow.asi = {}; Grow.spells = []; Grow.player = null   // 现值缓存作废——下次开框重取(已保存后的新值)
    document.querySelector('.g-dlg')?.remove()
    ctx.setUi('grow', { open: null })
    ctx.repaint()
    ctx.refresh('hud-left')   // 下一拍泵重取——待办角标/现值回落（C1 语义）
  } catch (e) { setMsg('保存失败：' + (e instanceof Error ? e.message : String(e))) }
}

// 全局一次性 wiring（模块单例;无 open 时全部短路）:Esc=放弃,框外点击=放弃(册不动)
let globalsWired = false
function wireGlobal() {
  if (globalsWired) return
  globalsWired = true
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && Grow.open) growClose(Grow.lastCtx) })
  document.addEventListener('click', e => {
    if (!Grow.open) return
    if (e.target instanceof Element && (e.target.closest('.g-dlg') || e.target.closest('[data-act]'))) return
    growClose(Grow.lastCtx)
  })
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
