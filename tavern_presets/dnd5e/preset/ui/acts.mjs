// acts.mjs — v9 交互动作:layout.json/视图里 [data-act] 点名,宿主事件委托派发到同名导出。
// 动作内可以动 DOM/调 runScript,但没有生命周期(挂载/卸载/轮询全是宿主的事)。
// 册/待办模态的 markup 复用 view.mjs 同源函数(ctx.views)——样式与结构仍在卡的地盘。

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
  ctx.runScript('ui_data.mjs', JSON.stringify({ op: 'panel', name: 'hud-left' })).then(text => {
    const slice = JSON.parse(text)
    const key = target === 'player' ? 'player' : '_file'
    const c = key === 'player' ? slice.data.player : (slice.data.companions ?? []).find(x => x._file === target)
    if (!c) return
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

// ── 成长待办点选（front_commit 前端决策通道:ASI 加点 / 学新法术）──
// 一档一次（2026-09-22 叠档丢点修正）：每次提交恰一档（ASI 恰 2 点 / 新法术恰 2 个），
// 落盘成功还有余档则自动重开下一档——现值经面板重取回落,账目权威在 front_commit(逐档销标记)。
export function pending(ctx) {
  const fc = document.querySelector('.fc-ov')
  if (fc !== null) { fc.remove(); return }
  openTier(ctx)
}

function openTier(ctx) {
  ctx.runScript('ui_data.mjs', JSON.stringify({ op: 'panel', name: 'hud-left' })).then(text => {
    const slice = JSON.parse(text)
    const p = slice.data.player
    if (!p || !(p.pending ?? []).length) { ctx.refresh('hud-left'); return }   // 无档可分——收工刷新
    const pend = p.pending
    const hasAsi = pend.some(x => String(x).includes('ASI'))
    const hasSpells = pend.some(x => String(x).includes('新法术'))
    const asiLeft = pend.filter(x => String(x).includes('ASI')).length
    const spLeft = pend.filter(x => String(x).includes('新法术')).length
    document.querySelector('.fc-ov')?.remove()
    const modal = document.createElement('div')
    modal.className = 'fc-ov open dnd-hud'   // fc-* 配色同吃 .dnd-hud 变量——容器外挂自携 token
    modal.dataset['panel'] = ctx.panel
    modal.innerHTML = `
      <div class="fc-box">
        <div class="fc-h"><span>成长待办</span><button class="fc-x">✕</button></div>
        <div class="fc-b">
          ${hasAsi ? `<div class="fc-sec">属性加点（本档恰 2 点：+2 单属性 或 +1×2${asiLeft > 1 ? ` · 共 ${asiLeft} 档,本档后自动继续` : ''}）</div><div class="fc-asi">${[['力', 'str'], ['敏', 'dex'], ['体', 'con'], ['智', 'int'], ['感', 'wis'], ['魅', 'cha']].map(([k, key]) => `<div class="fc-attr"><span class="k">${k}</span><span class="v">${esc(p[key] ?? 10)}</span><button class="plus" data-stat="${key}">+1</button></div>`).join('')}</div>` : ''}
          ${hasSpells ? `<div class="fc-sec">学新法术（英文名,逗号分隔,本档恰 2 个${spLeft > 1 ? ` · 共 ${spLeft} 档` : ''}）</div><input class="fc-input" placeholder="如 fireball, shield">` : ''}
          <div class="fc-note">待办：${esc(pend.join(' · '))}</div>
          <div class="fc-msg"></div>
          <button class="fc-submit">提交本档${pend.length > 1 ? `（余 ${pend.length - 1} 档）` : ''}</button>
        </div>
      </div>`
    document.body.append(modal)
    const msg = modal.querySelector('.fc-msg')
    let asiSel = {}
    const total = () => Object.values(asiSel).reduce((a, b) => a + b, 0)
    for (const plus of modal.querySelectorAll('.plus')) {
      plus.onclick = () => {
        const stat = plus.dataset['stat'] ?? ''
        asiSel[stat] = (asiSel[stat] ?? 0) + 1
        plus.previousElementSibling.textContent = String((p[stat] ?? 10) + asiSel[stat])
        if (total() >= 2) for (const b of modal.querySelectorAll('.plus')) b.classList.add('off')
      }
    }
    modal.querySelector('.fc-x').onclick = () => modal.remove()
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove() })
    modal.querySelector('.fc-submit').onclick = async () => {
      msg.textContent = ''
      try {
        if (hasAsi) {
          if (total() !== 2) { msg.textContent = '本档属性加点须恰 2 点'; return }
          await ctx.runScript('front_commit.mjs', JSON.stringify({ op: 'asi', who: 'player', payload: { stats: asiSel } }))
        }
        if (hasSpells) {
          const learned = (modal.querySelector('.fc-input')?.value ?? '').split(',').map(s2 => s2.trim()).filter(Boolean)
          if (learned.length !== 2) { msg.textContent = '本档恰学 2 个新法术（学不满请整档悬置）'; return }
          await ctx.runScript('front_commit.mjs', JSON.stringify({ op: 'spells', who: 'player', payload: { learned } }))
        }
        modal.remove()
        openTier(ctx)   // 余档自动续开;无档则 openTier 内部走 refresh 收工
      } catch (e) { msg.textContent = '提交失败：' + (e instanceof Error ? e.message : String(e)) }
    }
  }).catch(e => console.warn('[dnd5e-acts] pending failed —', e instanceof Error ? e.message : String(e)))
}

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
