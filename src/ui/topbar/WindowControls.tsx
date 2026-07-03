/**
 * Custom window controls for the frameless title bar (Task 3).
 *
 * Minimize / Maximize-Restore / Close buttons wired to the main process via
 * `electronAPI` window controls. The maximize icon reflects the live window
 * state, kept in sync with OS-driven maximize/restore (double-click, edge-snap,
 * keyboard) through `onWindowMaximizedChange`.
 *
 * On macOS the native traffic-light controls are used instead, so this renders
 * nothing there.
 */

import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useState, type JSX } from 'react'

import styles from './WindowControls.module.css'

/** Minimize / maximize / close buttons for the custom title bar. */
export function WindowControls(): JSX.Element | null {
  const api = typeof window !== 'undefined' ? window.electronAPI : undefined
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    if (!api) return
    let active = true
    void api.isWindowMaximized?.().then((value) => {
      if (active) setMaximized(value)
    })
    const unsubscribe = api.onWindowMaximizedChange?.((value) => setMaximized(value))
    return () => {
      active = false
      unsubscribe?.()
    }
  }, [api])

  // macOS renders native traffic lights — no custom controls.
  if (!api || api.platform === 'darwin') return null

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.button}
        onClick={() => api.minimizeWindow()}
        aria-label="Minimize"
        title="Minimize"
      >
        <Minus size={16} />
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => api.maximizeWindow()}
        aria-label={maximized ? 'Restore' : 'Maximize'}
        title={maximized ? 'Restore' : 'Maximize'}
      >
        {maximized ? <Copy size={13} /> : <Square size={13} />}
      </button>
      <button
        type="button"
        className={`${styles.button} ${styles.close}`}
        onClick={() => api.closeWindow()}
        aria-label="Close"
        title="Close"
      >
        <X size={16} />
      </button>
    </div>
  )
}
