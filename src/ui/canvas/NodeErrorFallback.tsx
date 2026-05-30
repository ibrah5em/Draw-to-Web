/**
 * Per-element canvas error fallback (L-CAN-09).
 *
 * Rendered by the `react-error-boundary` wrapper around each {@link CanvasNode}
 * when that node's render throws. It replaces *only* the offending node with a
 * small inline error chip — siblings and the rest of the canvas keep
 * rendering and stay interactive — and offers a Retry that resets the
 * boundary so a transient failure (or one fixed by an edit) recovers without
 * a full reload.
 *
 * Presentational only; the boundary that owns reset lives in `CanvasNode`.
 */

import { AlertTriangle } from 'lucide-react'
import type { FallbackProps } from 'react-error-boundary'
import type { JSX } from 'react'

import styles from './NodeErrorFallback.module.css'

/** Inline fallback shown in place of a node whose render threw. */
export function NodeErrorFallback({ error, resetErrorBoundary }: FallbackProps): JSX.Element {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className={styles.fallback} role="alert">
      <AlertTriangle size={14} className={styles.icon} aria-hidden />
      <span className={styles.text}>Element failed to render</span>
      <span className={styles.detail} title={message}>
        {message}
      </span>
      <button type="button" className={styles.retry} onClick={() => resetErrorBoundary()}>
        Retry
      </button>
    </div>
  )
}
