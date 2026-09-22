/**
 * The user's onboarding intent marker: which session the player created with
 * 「＋ 开启酒馆会话」 but has not yet started playing (no card picked). The
 * host session manager re-opens its most recently active workspace's session
 * on every page load (watchNavigation reconcile), and a blank session loses
 * that recency race to any played workspace — so the marker is what lets the
 * plugin restore the card-picker instead of a game nobody chose.
 *
 * Lifecycle: SET at createSession; CLEAR at the first real intent — a library
 * pick (onCardReady), any rebind landing (handleSessionSwitch / 清空), or an
 * explicit sidebar row click. A refresh before any of those re-opens the
 * pending blank session; a refresh after the clear accepts the host choice.
 * @module dsh-tavern-fengyue-ui/pending-session
 */

const PENDING_KEY = 'tavern.pendingSession'

/** The session id waiting at the card picker, or null when none is tracked. */
export function readPendingSession(): string | null {
  try { return localStorage.getItem(PENDING_KEY) } catch { return null }
}

/** Track a freshly created blank session as the pending card-picker. */
export function setPendingSession(sessionId: string): void {
  try { localStorage.setItem(PENDING_KEY, sessionId) } catch { /* storage unavailable — the restore simply no-ops */ }
}

/** Drop the marker: an intent event landed (pick/rebind/abandon) or the session died. */
export function clearPendingSession(): void {
  try { localStorage.removeItem(PENDING_KEY) } catch { /* storage unavailable — nothing to clear */ }
}
