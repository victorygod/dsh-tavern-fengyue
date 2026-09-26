// ptr.mjs — 书签:读位唯一可变正本(2026-09-25 域重构批)。
// 段指针单键 LRU ≤16(与宿主 reader-anchor 同口径),键 `s:<sessionId>`,条目
// {r, paras, asstSeq, mode, ts};存储不可用/身份缺席退化「不持久」——本页行为零伤。
// 打包/解包走 views 纯函数(经注入);唯一写手=演出机,持久化只此一家。
export function createBookmark({ storage, views }) {
  const KEY = 'gg.reader.pointers'
  const store = storage !== null && storage !== undefined ? storage : null
  let r = 0, asstSeq = 0, sid = null, mode = 'boot'

  const readPack = () => {
    if (store === null) return {}
    try { return views.readPointersPack(store.getItem(KEY)) } catch { return {} }
  }

  return {
    /** 当前读位(快照式取值,演出机内部演进)。 */
    get() { return { r, asstSeq, sid, mode } },
    /** 演出机驱动(全卡唯一写路径):按键覆写。 */
    touch(next) {
      if (next.r !== undefined) r = next.r
      if (next.asstSeq !== undefined) asstSeq = next.asstSeq
      if (next.sid !== undefined) sid = next.sid
      if (next.mode !== undefined) mode = next.mode
    },
    /** 同会话的存位(读位恢复三分枝的输入);身份缺席 = null。 */
    saved() { return sid === null ? null : (readPack()[`s:${sid}`] ?? null) },
    /** 立即落盘(段推进/输入态落定/落定校准三个业务时机由演出机点名)。 */
    save(parasLen) {
      if (sid === null) return
      try {
        const all = views.packPointers(readPack(), sid, { r, paras: parasLen, asstSeq, mode, ts: Date.now() })
        if (store !== null) store.setItem(KEY, JSON.stringify(all))
      } catch { /* 存储不可用:本页行为不受影响,只失去跨往返记忆 */ }
    },
  }
}
