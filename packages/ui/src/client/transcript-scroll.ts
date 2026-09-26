/**
 * The transcript's scroll mechanics — layer 3 of the landing contract
 * (2026-09-25). Owns nothing but the viewport: `follow` arms tail-follow (an
 * arming that also arrives from the landing arbiter at every rebind), reader
 * gestures float it (leaving the 80px tail band disarms; re-entering arms it
 * back), the dependency-free glue effect re-glues on every commit only while
 * armed, and `land` performs a one-shot jump to a reading anchor (arming off —
 * streams no longer grab the viewport). `onFollowChange` flips exactly on
 * transitions: the「回到底部」lamp's show/hide signal.
 *
 * This is the session-agnostic half of the old `useBottomPinnedScroll`; the
 * session/cause knowledge lives in the arbiter (TavernChatView + landing.ts).
 * The writer column keeps the original hook's semantics unchanged.
 * @module dsh-tavern-fengyue-ui/transcript-scroll
 */

import { useEffect, useMemo, useRef } from 'react'
import type { RefObject } from 'react'

/** Distance from the scrollport floor within which the reader is held to be reading the tail. */
const BOTTOM_SNAP_PX = 80

export interface TranscriptScrollerOptions {
  /** Fires exactly on following↔not transitions (never on unchanged commits). */
  readonly onFollowChange?: (following: boolean) => void
  /** Glue gate: while it holds, commits do NOT glue (the landing arbiter's
   *  pending plan owns those commits — the two-phase boot restore). */
  readonly gate?: () => boolean
}

export interface TranscriptScroller {
  /** Arm tail-follow: subsequent commits glue to the floor until disarmed. */
  follow(): void
  /** Disarm tail-follow without touching any stored anchor. */
  unfollow(): void
  /** One-shot: scroll so the anchor row's top sits `offsetPx` below the scrollport top; disarms. */
  land(row: HTMLElement, offsetPx: number): void
  /** The live follow flag (render face of `onFollowChange`). */
  isFollowing(): boolean
}

/** Read one row's content-space top (callers fake rects in specs). */
function contentTop(el: HTMLElement, row: HTMLElement): number {
  return row.getBoundingClientRect().top - el.getBoundingClientRect().top + el.scrollTop
}

export function useTranscriptScroller(ref: RefObject<HTMLElement | null>, options: TranscriptScrollerOptions = {}): TranscriptScroller {
  // Fresh mounts start armed — the arbiter rewrites it the instant its plan
  // applies, and a component-less use of the hook keeps the old hook's
  // tail-glued default.
  const armed = useRef(true)
  const notify = useRef(options.onFollowChange)
  notify.current = options.onFollowChange
  const setArmed = (value: boolean): void => {
    if (armed.current === value) return
    armed.current = value
    notify.current?.(value)
  }
  // The pin state samples every scroll event (including our own glue writes).
  useEffect(() => {
    const el = ref.current
    if (el === null) return
    const onScroll = (): void => { setArmed(el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SNAP_PX) }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => { el.removeEventListener('scroll', onScroll) }
  }, [ref])
  // Every commit re-glues while armed — the same growth-source-immune shape
  // the 09-14 hook established; unarmed renders cost one boolean check.
  useEffect(() => {
    const gate = options.gate
    if (armed.current === false || gate?.() === true) return
    const el = ref.current
    if (el !== null) el.scrollTop = el.scrollHeight
  })
  return useMemo(() => ({
    follow(): void { setArmed(true) },
    unfollow(): void { setArmed(false) },
    land(row: HTMLElement, offsetPx: number): void {
      setArmed(false)
      const el = ref.current
      if (el !== null) el.scrollTop = contentTop(el, row) - offsetPx
    },
    isFollowing(): boolean { return armed.current },
  }), [ref])
}
