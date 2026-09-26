// stage.mjs — 舞台:CG 演出效果(2026-09-25 域重构批),无进度概念。
// 唯一认识的东西是「景」:不知道读到第几段、不知道 seq、不持剧本——唯一入口是
// 演出机发的演出事件。全量层索引(cgs:id→layers/intro)经注入的 runScript 调泵
// op:manifest 自取一次缓存(泵 panel 载荷只带当前 CG 切片,全量表唯一取数口)。
// nodes:{root, front, back, mood}(组装建好的 DOM 引用,build 一次取定不再重查)。
export function createStage({ runScript, readAsset, nodes }) {
  const cur = { id: null }
  let frontFacing = true
  let frontKey = null            // 当前前缓冲的层一资产(poll ⑤ 资产补缺后修复 front.src 用)
  let cgCache = null
  const assets = new Map(), missed = new Set()

  /** 全量层索引:一次取,常驻缓存;失败退化空表(缺景即不换,不静默炸)。 */
  async function index() {
    if (cgCache !== null) return cgCache
    try {
      const v = JSON.parse(await runScript('gal_data.mjs', JSON.stringify({ op: 'manifest' })))
      cgCache = v?.ok === true && v.cgs ? v.cgs : {}
    } catch { cgCache = {} }
    return cgCache
  }

  /** CG 情绪词(manifest intro)画面中央浮层。 */
  function setMood(id) {
    if (nodes.mood == null) return
    const intro = (cgCache?.[id] ?? { intro: '' }).intro
    if (!intro) { nodes.mood.style.display = 'none'; return }
    nodes.mood.textContent = intro
    nodes.mood.style.display = ''
  }

  /** 双缓冲换场(asset 通道取图;back 同景幂等不重载)。 */
  function crossfade(id, layers) {
    const front = frontFacing ? nodes.front : nodes.back
    const back = frontFacing ? nodes.back : nodes.front
    const next = (layers[0] ?? {}).img
    const load = () => { const p = next ? readAsset(next) : Promise.resolve(undefined)
      p.then(url => { if (typeof url === 'string' && url !== '') back.src = url }) }
    if (back.dataset.cgId !== id) { back.dataset.cgId = id; load() }
    frontKey = (layers[0] ?? {}).img ?? null
    frontFacing = !frontFacing
    front.classList.remove('gg-front'); front.classList.add('gg-back')
    back.classList.remove('gg-back'); back.classList.add('gg-front')
    void back.offsetWidth
  }

  return {
    /** 幂等换场:layers 可由交货方直供(boot/泵态切片);缺席则查自身索引(段级切换)。 */
    async show(id, layers) {
      if (!id || String(id) === String(cur.id ?? '')) return
      const cgs = await index()
      const use = layers !== undefined ? layers : (cgs[id] ?? {}).layers
      if (!use) return
      cur.id = id
      crossfade(id, use)
      setMood(id)
    },
    /** 资产预载/补缺:逐键一次,缺席记黑名单;前台当前键到账即修 front.src。 */
    async prime(keys) {
      for (const key of keys ?? []) {
        if (assets.has(key) || missed.has(key)) continue
        const url = await readAsset(key)
        if (typeof url === 'string' && url !== '') {
          assets.set(key, url)
          if (frontKey === key && nodes.front != null) nodes.front.src = url
        } else {
          missed.add(key)
        }
      }
    },
    /** manifest 索引预载(boot 原序:首拍即取,峙于第一次段级切换之前)。 */
    warm() { return index() },
    get id() { return cur.id },
  }
}
