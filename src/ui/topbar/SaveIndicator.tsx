/**
 * Save / unsaved indicator (L-TOP-05).
 *
 * Shows the document name with a dirty dot (●) while there are unsaved
 * changes and a clean check once saved. Clicking it (or Ctrl+S, wired in
 * the keyboard layer L-DLG-05) runs `saveProject`, which clears the dirty
 * flag on success (Y-PER-06) — so the dot disappears without any local
 * state here. The dirty flag is owned by the document store; this is a pure
 * projection of `useIsDirty()`.
 */

import { Check, Circle } from 'lucide-react'
import { useState, type JSX } from 'react'

import { useDocumentMeta, useIsDirty } from '@store/documentStore'
import { saveProject } from '@store/persistence'

import styles from './SaveIndicator.module.css'

/** Dirty-state chip in the topbar; click to save. */
export function SaveIndicator(): JSX.Element {
  const meta = useDocumentMeta()
  const dirty = useIsDirty()
  const [saving, setSaving] = useState(false)

  const onSave = (): void => {
    if (saving) return
    setSaving(true)
    void saveProject().finally(() => setSaving(false))
  }

  return (
    <button
      type="button"
      className={styles.indicator}
      onClick={onSave}
      disabled={saving}
      title={dirty ? 'Unsaved changes — click to save (Ctrl+S)' : 'All changes saved'}
      aria-label={dirty ? 'Unsaved changes, click to save' : 'All changes saved'}
    >
      {dirty ? (
        <Circle size={8} className={styles.dot} fill="currentColor" aria-hidden />
      ) : (
        <Check size={12} className={styles.check} aria-hidden />
      )}
      <span className={styles.name}>{meta.name}</span>
      {dirty ? (
        <span className={styles.star} aria-hidden>
          *
        </span>
      ) : null}
    </button>
  )
}
