/**
 * The self-drawn dialog system: every former `window.alert` / `window.confirm`
 * renders through this one promise-shaped face — `confirm()` resolves the
 * answer, `alert()` resolves on dismissal — styled after the edit-back
 * confirm box (TavernView.module.css `confirm*` classes). Instantiated per
 * component: `useDialogs()` returns the host node to render next to the
 * owner's other content plus the two async actions; the host mounts nothing
 * until the first call.
 * @module dsh-tavern-fengyue-ui/dialog
 */
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import css from './TavernView.module.css'

/** One dialog's copy. The title is optional — a bare `window.alert` maps to a body-only box. */
export interface DialogSpec {
  title?: string | undefined
  body: string
  /** The affirmative button's label on a confirm-style dialog. */
  confirmLabel?: string | undefined
  /** The affirmative button's label on an alert (提示框) — read when `confirmLabel` is absent. */
  okLabel?: string | undefined
  /** `undefined` = alert-style single button (no cancel seat). */
  cancelLabel?: string | undefined
  /** Red affirmative button — destructive confirms. */
  danger?: boolean | undefined
}

/** The dialog face: the host node plus the two promise-shaped actions. */
export interface DialogFace {
  /** The host node; mounts nothing while no dialog is open. */
  dialog: ReactNode
  /** Resolves `true` only on the affirmative button — Esc, scrim, and cancel resolve `false`. */
  confirm(spec: DialogSpec): Promise<boolean>
  /** Resolves once dismissed (button, Esc, or scrim). */
  alert(spec: DialogSpec): Promise<void>
}

interface OpenDialog {
  spec: DialogSpec
  settle: (value: boolean) => void
}

/**
 * The per-component dialog seat.
 * @returns the host node and the `confirm` / `alert` actions.
 */
export function useDialogs(): DialogFace {
  const [open, setOpen] = useState<OpenDialog | undefined>(undefined)
  const openRef = useRef<OpenDialog | undefined>(undefined)
  const settle = useCallback((value: boolean): void => {
    const current = openRef.current
    if (current === undefined) return
    openRef.current = undefined
    setOpen(undefined)
    current.settle(value)
  }, [])
  const show = useCallback((spec: DialogSpec): Promise<boolean> => new Promise((resolve) => {
    // A stacked second call cancels the first — `window.confirm` never queued either.
    openRef.current?.settle(false)
    const next: OpenDialog = { spec, settle: resolve }
    openRef.current = next
    setOpen(next)
  }), [])
  // Esc closes: a CAPTURE-phase window listener outruns TavernChatView's
  // bubble-phase global handler (stop → close dialogs → double-Esc load
  // page), which would otherwise stop a running turn underneath an open
  // dialog — the settings modal keeps that chat view alive behind the editor.
  useEffect(() => {
    if (open === undefined) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      settle(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true) }
  }, [open, settle])
  // An unmount with a dialog up resolves it cancelled — no dangling promise.
  useEffect(() => () => { openRef.current?.settle(false) }, [])
  const confirm = useCallback((spec: DialogSpec): Promise<boolean> => show(spec), [show])
  const alert = useCallback((spec: DialogSpec): Promise<void> => show({ ...spec, cancelLabel: undefined }).then(() => undefined), [show])
  const dialog = open === undefined ? null : (
    <div className={css.confirmScrim} onClick={() => { settle(false) }}>
      <div
        className={css.confirmBox}
        role="dialog"
        aria-modal="true"
        aria-label={open.spec.title ?? open.spec.body}
        onClick={(event) => { event.stopPropagation() }}
      >
        {open.spec.title !== undefined && <h3 className={css.confirmTitle}>{open.spec.title}</h3>}
        <p className={css.confirmBody}>{open.spec.body}</p>
        <div className={css.confirmRow}>
          {open.spec.cancelLabel !== undefined && (
            <button type="button" className={css.btn} onClick={() => { settle(false) }}>{open.spec.cancelLabel}</button>
          )}
          <button
            type="button" autoFocus
            className={`${css.btn} ${open.spec.danger === true ? css.danger : css.primaryBtn}`}
            onClick={() => { settle(true) }}
          >{open.spec.confirmLabel ?? open.spec.okLabel ?? ''}</button>
        </div>
      </div>
    </div>
  )
  return { dialog, confirm, alert }
}
