/**
 * The landing arbiter's decision table — layer 4 of the landing contract
 * (2026-09-25). A rebind's cause and the reader-anchor store's readout
 * collapse into exactly one plan: either restore a reading position (an
 * anchor row's durable seq plus its scrollport-top offset) or follow the
 * tail. The pure function owns the whole policy; the view only executes.
 * @module dsh-tavern-fengyue-ui/landing
 */

import type { ReaderAnchor } from './reader-anchor.ts'

/** Why this rebind is landing. Unlisted contexts default to the natural one
 *  ('exit-return'): the table's outputs coincide today, so the enum exists
 *  for the record and for future divergence to be a one-point change. */
export type LandingCause = 'boot' | 'manual-open' | 'exit-return' | 'load' | 'retry' | 'edit-start' | 'clear'

/** Exactly one landing decision per rebind. */
export interface LandingPlan {
  /** Arm tail-follow (every commit glues to the floor until disarmed). */
  readonly follow: boolean
  /** Durable seq to jump to; null = follow-without-anchor. */
  readonly anchorSeq: number | null
  /** The anchor row's top offset relative to the scrollport top. */
  readonly offsetPx: number
}

/** Facts the decision consults. */
export interface LandingFacts {
  /** The stored reading anchor for the landing session (null = none/first visit). */
  readonly stored: ReaderAnchor | null
  /** 载入 fork 切刻（wire 的 anchorSeq）：落底部即存档点。保留为引擎背书事实。 */
  readonly loadAnchorSeq?: number | null
  /** 清空后的转写实况（空=开场页）；决策恒随尾，此值只为调用点可读。 */
  readonly hasContent?: boolean
}

const TAIL: LandingPlan = { follow: true, anchorSeq: null, offsetPx: 0 }

/** Fold a rebind cause + stored anchor into the landing plan.
 *  - any cause without a stored anchor → follow the tail (fresh mounts, save-point forks);
 *  - a stored follow anchor → follow (the reader left glued to the tail);
 *  - a stored position anchor → restore it, streams don't grab the viewport. */
export function decideLanding(cause: LandingCause, facts: LandingFacts): LandingPlan {
  const stored = facts.stored
  // 清空：转写回到开场页，着陆恒随尾（无行可锚）。
  if (cause === 'clear') return TAIL
  // 贴底锚 = 位置即持尾，作为跟随着陆；位置锚 = 恢复。
  if (stored !== null && !stored.follow) return { follow: false, anchorSeq: stored.seq, offsetPx: stored.offsetPx }
  return TAIL
}
