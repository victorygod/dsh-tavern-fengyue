/**
 * The transcript's per-session reading anchor — layer 2 of the landing
 * contract (2026-09-25). One `{seq, offsetPx, follow}` per session: the
 * durable seq of the row riding the viewport's top edge when the reader
 * left, that row's top offset relative to the scrollport top (negative =
 * the row straddles the edge), and whether the reader left glued to the
 * floor. The anchor is the restore target for a later rebind into the same
 * session; a durable-seq identity survives replay/aggregation changes the
 * way an index never can.
 *
 * Storage: one localStorage key per session (`tavern.readerAnchor.<id>`) —
 * the same direct persistence idiom as pending-session — over an LRU-bounded
 * live map (read refreshes recency; the oldest session's entry is dropped
 * past `capacity`). Storage-unavailable environments (jsdom/private mode)
 * degrade to memory-only: the current page behaves, only the cross-reload
 * memory is lost. Malformed persisted rows and illegal values are treated as
 * absent — never thrown, never trusted.
 * @module dsh-tavern-fengyue-ui/reader-anchor
 */

/** One reading position: durable seq of the anchor row, its top's offset
 *  relative to the scrollport top at capture time, and the tail-follow flag. */
export interface ReaderAnchor {
  readonly seq: number
  readonly offsetPx: number
  readonly follow: boolean
}

export interface ReaderAnchorStore {
  /** The stored anchor for a session, or null when absent/invalid/cleared. */
  read(sessionId: string): ReaderAnchor | null
  /** Store (or clear, with null) a session's anchor; persists immediately. */
  capture(sessionId: string, anchor: ReaderAnchor | null): void
}

const PREFIX = 'tavern.readerAnchor.'
const DEFAULT_CAPACITY = 24

export interface ReaderAnchorStoreOptions {
  /** Live-map bound: past it, the least recently read session's anchor is dropped. */
  readonly capacity?: number
  /** Storage seam for tests; defaults to window.localStorage. */
  readonly storage?: Storage | undefined
}

/** Whether a decoded value is a trustworthy anchor. */
function validAnchor(value: unknown): value is ReaderAnchor {
  if (typeof value !== 'object' || value === null) return false
  const anchor = value as Partial<ReaderAnchor>
  return typeof anchor.seq === 'number' && Number.isInteger(anchor.seq) && anchor.seq >= 0
    && typeof anchor.offsetPx === 'number' && Number.isFinite(anchor.offsetPx)
    && typeof anchor.follow === 'boolean'
}

export function createReaderAnchorStore(options: ReaderAnchorStoreOptions = {}): ReaderAnchorStore {
  const capacity = options.capacity ?? DEFAULT_CAPACITY
  const storage = options.storage ?? (typeof localStorage === 'undefined' ? undefined : localStorage)
  // 失败降噪：持久化失败走上限内静默（同 pending-session；只丢跨重启记忆）。
  const write = (sessionId: string, anchor: ReaderAnchor | null): void => {
    if (storage === undefined) return
    try {
      if (anchor === null) storage.removeItem(`${PREFIX}${sessionId}`)
      else storage.setItem(`${PREFIX}${sessionId}`, JSON.stringify(anchor))
    } catch { /* storage unavailable — memory-only degradation */ }
  }
  // Live map in recency order (oldest first). localStorage feeds `read` misses;
  // eviction removes both faces — a stale key must not resurrect from storage.
  const live = new Map<string, ReaderAnchor>()
  const evict = (): void => {
    while (live.size > capacity) {
      const oldest = live.keys().next()
      if (oldest.done) return
      live.delete(oldest.value)
      write(oldest.value, null)
    }
  }
  return {
    read(sessionId: string): ReaderAnchor | null {
      const known = live.get(sessionId)
      if (known !== undefined) {
        live.delete(sessionId)
        live.set(sessionId, known)
        return known
      }
      if (storage === undefined) return null
      let raw: string | null = null
      try { raw = storage.getItem(`${PREFIX}${sessionId}`) } catch { return null }
      if (raw === null) return null
      let parsed: unknown = null
      try { parsed = JSON.parse(raw) } catch { return null }
      if (!validAnchor(parsed)) return null
      live.set(sessionId, parsed)
      evict()
      return parsed
    },
    capture(sessionId: string, anchor: ReaderAnchor | null): void {
      if (anchor !== null && !validAnchor(anchor)) return
      if (anchor === null) {
        live.delete(sessionId)
        write(sessionId, null)
        return
      }
      live.delete(sessionId)
      live.set(sessionId, anchor)
      evict()
      write(sessionId, anchor)
    },
  }
}

const BOTTOM_SNAP_PX = 80

/** Read one row's content-space top (jsdom-safe: callers fake rects in specs). */
function contentTop(el: HTMLElement, row: HTMLElement): number {
  return row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
}

/**
 * Capture the reader's position from the transcript DOM at the moment of
 * leaving. The anchor row is the one straddling the scrollport's top edge
 * (its upper part stays visible after restore). Within the 80px tail band —
 * or when the content fits the viewport — the position IS the tail: a follow
 * anchor (`{seq of the last row, offset 0, follow: true}`) instead. No
 * `data-seq` rows or no layout → null (nothing to restore).
 */
export function captureAnchor(el: HTMLElement | null | undefined): ReaderAnchor | null {
  if (el === null || el === undefined) return null
  const rows = Array.from(el.querySelectorAll<HTMLElement>('[data-seq]'))
  if (rows.length === 0) return null
  const lastSeq = Number(rows[rows.length - 1]?.dataset['seq'])
  const overflow = el.scrollHeight - el.scrollTop - el.clientHeight
  if (!Number.isInteger(lastSeq)) return null
  if (overflow <= BOTTOM_SNAP_PX) return { seq: lastSeq, offsetPx: 0, follow: true }
  const straddling = rows.find((row) => row.getBoundingClientRect().bottom > el.getBoundingClientRect().top)
    ?? rows[0]!
  const seq = Number(straddling.dataset['seq'])
  if (!Number.isInteger(seq)) return null
  return { seq, offsetPx: contentTop(el, straddling) - el.scrollTop, follow: false }
}

/** Locate the restore target by durable seq (topmost match — an assistant
 *  event folds into a think row + a narrative row sharing the seq). */
export function findAnchorRow(el: HTMLElement | null | undefined, seq: number): HTMLElement | null {
  if (el === null || el === undefined) return null
  return el.querySelector<HTMLElement>(`[data-seq="${seq}"]`)
}
