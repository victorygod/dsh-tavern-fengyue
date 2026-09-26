// 芙宁娜 galgame 卡入口(v11 分域·组装,2026-09-25 域重构批)。
// 本件 = 产房+拆迁办+发牌员:等容器 → 建骨架(节点一次取定)→ 造胶囊发牌 →
//   订阅路由(live/思考流→演出机、files→仓库、opening→重渲一拍)→ 清理表逆序。
// 业务全在四件(modules manifest 装载):tavern.mods.feed(仓库·单通道摄取)/
//   ptr(书签·读位唯一可变正本)/para(演出机·唯一推进者)/stage(舞台·演出效果);
//   规则(切分/防剧透口径/三分支/合流/渲染/指针包)在 view.mjs 纯函数。
// 四动词协议与六铁律:docs/notes/feature/2026-09-25-gal-domain-refactor.zh.md;
//   v10.x 事故编年归档:docs/build_galgame-ui_zh.md。宿主无 mods(旧宿主)= 停摆留痕。
export function mount(tavern) {
  const views = tavern.views ?? {}
  const mods = tavern.mods ?? {}
  const factoryOf = {}
  const missing = []
  for (const [name, key] of [['feed', 'createRepo'], ['ptr', 'createBookmark'], ['para', 'createPresenter'], ['stage', 'createStage']]) {
    const factory = mods?.[name]?.[key]
    if (typeof factory !== 'function') missing.push(name)
    else factoryOf[name] = factory
  }
  if (missing.length > 0) {
    console.warn(`[gg] 宿主无 tavern.mods(${missing.join('/')} 缺席——需 layout.json modules 声明装载)——分域胶囊不齐,卡停摆(fail-visible)`)
    return () => {}
  }

  const stops = []
  const add = fn => { if (typeof fn === 'function') stops.push(fn) }
  let disposed = false
  const readAsset = p => tavern.readAsset ? tavern.readAsset(p).catch(() => undefined) : Promise.resolve(undefined)
  let storage = null
  try { storage = typeof localStorage === 'undefined' ? null : localStorage } catch { storage = null }

  /* ── 骨架(不变)与节点一次取定 ── */
  function build(host) {
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
          <div class="gg-dock-slot" data-dock-slot="composer"></div>
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

  /* ── 容器等待(宿主挂面板容器可能晚于 mount;落地即建)── */
  const whenHost = (onReady) => {
    const host = document.querySelector('.tavern-panel-galgame')
    if (host !== null) { onReady(host); return }
    const observer = new MutationObserver(() => {
      const found = document.querySelector('.tavern-panel-galgame')
      if (found !== null) { observer.disconnect(); onReady(found) }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    add(() => observer.disconnect())
  }

  whenHost((host) => {
    if (disposed) return
    const root = build(host)
    const q = s => root.querySelector(s)
    const nodes = {
      root,
      front: q('.gg-front'), back: q('.gg-back'), mood: q('.gg-cg-mood'),
      dialog: q('.gg-dialog'),
      who: q('.gg-name'), text: q('.gg-text'),
      next: q('.gg-next'), stop: q('.gg-stop'),
      greet: q('.gg-greet'), dockSlot: q('.gg-dock-slot'),
      think: q('.gg-think'), thinkBody: q('.gg-think-body'), thinkSummary: q('.gg-think-summary'),
      dots: q('.gg-dots'),
      expand: q('.gg-expand'), collapse: q('.gg-collapse'),
      blBody: q('.gg-bl-body'), backlog: q('.gg-backlog'),
    }

    /* ── 造胶囊发牌(唯一认识全部胶囊的地方)── */
    const bookmark = factoryOf.ptr({ storage, views })
    const stage = factoryOf.stage({ runScript: tavern.runScript, readAsset, nodes })
    const presenter = factoryOf.para({
      bookmark, stage, views, nodes,
      opening: tavern.opening ?? null,
      stopper: () => tavern.stop?.(),
    })
    const repo = factoryOf.feed({
      runScript: tavern.runScript, views,
      onScript: presenter.handleFact, onDead: presenter.dead,
    })
    add(presenter.dispose)
    add(repo.dispose)

    /* ── G3 停靠:槽声明给宿主,composer 原件由宿主 portal 进来;解停入 stops
       双保险(宿主 handle dispose 亦清空)。无 face 的旧宿主 → 降级留痕。── */
    if (nodes.dockSlot != null) {
      if (typeof tavern.dockComposer !== 'function') {
        console.warn('[gg] 宿主无 dockComposer face——输入框不入槽,input 态降级(fail-visible)')
      } else {
        const undock = tavern.dockComposer(nodes.dockSlot)
        if (typeof undock === 'function') add(undock)
      }
    }

    /* ── 订阅路由:live/思考流→演出机直呼(队列是演出瞬态);opening 翻转→重渲一拍 ── */
    const unsubOpening = tavern.opening?.subscribe?.(() => { presenter.pulse() })
    if (typeof unsubOpening === 'function') add(unsubOpening)
    const unsubLive = tavern.assistantLive?.subscribe?.(presenter.pushLive)
    if (typeof unsubLive === 'function') add(unsubLive)
    const unsubReason = tavern.assistantLive?.subscribeReasoning?.(presenter.think)
    if (typeof unsubReason === 'function') add(unsubReason)

    /* ── v10 零轮询:boot 基线就绪后才订 files(早订与 boot 拍竞态);
       工作区一动即拉一拍 delta(rev 同值短路在仓库)。── */
    void repo.boot().then(() => {
      if (disposed) return
      const unsubFiles = tavern.files?.subscribe?.(() => { void repo.delta() })
      if (typeof unsubFiles === 'function') add(unsubFiles)
    })
  })

  return () => {
    disposed = true
    for (const fn of [...stops].reverse()) { try { fn() } catch { /* 清理容忍 */ } }
  }
}
