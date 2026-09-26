// feed.mjs — 仓库:外界(泵)唯一入口(2026-09-25 域重构批)。
// 单通道摄取:boot(350ms 间隔、9 拍上界重试)与 delta(文件事件拉一拍)共用同一函数族;
// rev 同值短路;水位由内部持有(含 boot 早于快照出生的键自愈);交货=事实集
// {reason, session, aSeq, uSeq, freshAsst, freshUser, script, cg, assetKeys}
// 经 onScript 直达演出机——仓库不碰书签、不碰演出机,分支体(①落定/②新玩家行/④⑤CG·资产)在演出机。
// 语义与现役 index.js 的 poll/bootPoll 逐条一致;行为锚 = galgame-card.client.spec 16 例。
export function createRepo({ runScript, views, onScript, onDead }) {
  const BOOT_TRIES = 9              // bootPoll 上界(~3.2s):失败上屏而非无限静默自旋
  const BOOT_MS = 350
  let disposed = false
  let rev = null, sid = null
  let userSeq = 0, asstSeq = 0
  let bootTimer = null

  const tryFetch = async () => {
    if (disposed) return null
    try { return JSON.parse(await runScript('gal_data.mjs', JSON.stringify({ op: 'panel' }))) } catch { return null }
  }

  const emit = (reason, d, value, freshAsst, freshUser) => {
    const script = views.makeScript(d.lastAssistant ?? null, d.history ?? [])
    onScript({
      reason,
      hasAsst: Boolean(d.lastAssistant?.orig || d.lastAssistant?.text),
      session: d.session ?? null,
      aSeq: d.lastAssistant?.seq ?? 0,
      uSeq: d.lastUser?.seq ?? 0,
      freshAsst,
      freshUser,
      script,
      cg: d.cg ?? null,
      assetKeys: value.assetKeys ?? [],
    })
  }

  /** boot:成功交货一次(reason 'boot');持续失败支到上界交 dead(停摆,不静默)。 */
  async function boot() {
    return new Promise((resolve) => {
      if (disposed) { resolve(); return }
      let tries = 0
      bootTimer = setInterval(async () => {
        const value = await tryFetch()
        tries += 1
        if (value?.ok !== true) {
          if (tries >= BOOT_TRIES) {
            clearInterval(bootTimer); bootTimer = null
            onDead(value?.error ?? '数据源未就绪')
            resolve()
          }
          return
        }
        clearInterval(bootTimer); bootTimer = null
        const d = value.data
        rev = value.rev
        sid = d.session ?? null
        userSeq = d.lastUser?.seq ?? 0
        asstSeq = d.lastAssistant?.seq ?? 0
        emit('boot', d, value, false, false)
        resolve()
      }, BOOT_MS)
    })
  }

  /** delta:文件事件拉一拍(poll 原样——rev 短路后水位/fresh 判定,其余在演出机)。 */
  async function delta() {
    if (disposed) return
    const value = await tryFetch()
    if (value?.ok !== true) return
    if (value.rev === rev) return
    rev = value.rev
    const d = value.data
    if (sid === null && d.session != null) sid = d.session   // 键自愈:boot 早于快照出生
    const uSeq = d.lastUser?.seq ?? 0, aSeq = d.lastAssistant?.seq ?? 0
    const freshUser = uSeq > userSeq, freshAsst = aSeq > asstSeq
    userSeq = Math.max(userSeq, uSeq); asstSeq = Math.max(asstSeq, aSeq)
    emit('delta', d, value, freshAsst, freshUser)
  }

  return {
    boot,
    delta,
    get session() { return sid },
    dispose() { disposed = true; if (bootTimer !== null) { clearInterval(bootTimer); bootTimer = null } },
  }
}
