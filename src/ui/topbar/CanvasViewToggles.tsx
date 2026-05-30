/**
 * Canvas view toggles (L-CAN-10 / L-TOP-06 grid overlay, L-TOP-03 hover preview).
 *
 * Two icon toggle buttons in the topbar:
 *
 *   - **Grid** — flips `document.settings.gridVisible`. It lives on the
 *     document because the DoD requires per-project persistence, so toggling
 *     it dirties the file (it is a project setting). Written through
 *     {@link commitDocumentPatch} so the change still validates via Zod.
 *   - **Hover** — flips the UI-lane {@link useViewPrefs} `hoverPreview` flag.
 *     Ephemeral and never serialized, so previewing hover styling never
 *     mutates the document (L-TOP-03 DoD).
 */

import { Grid3x3, MousePointerClick } from 'lucide-react'
import type { JSX } from 'react'

import { useDocumentSettings } from '@store/documentStore'

import { commitDocumentPatch } from '../panels/document-settings/applySettings'
import { useViewPrefs } from '../state/viewPrefs'
import styles from './CanvasViewToggles.module.css'

/** Grid-overlay + hover-preview toggle buttons. */
export function CanvasViewToggles(): JSX.Element {
  const gridVisible = useDocumentSettings().gridVisible
  const hoverPreview = useViewPrefs((s) => s.hoverPreview)
  const toggleHoverPreview = useViewPrefs((s) => s.toggleHoverPreview)

  const toggleGrid = (): void =>
    commitDocumentPatch((doc) => ({
      ...doc,
      settings: { ...doc.settings, gridVisible: !doc.settings.gridVisible },
    }))

  return (
    <div className={styles.group} role="group" aria-label="Canvas view">
      <button
        type="button"
        className={gridVisible ? styles.toggleActive : styles.toggle}
        onClick={toggleGrid}
        aria-pressed={gridVisible}
        title="Toggle 12-column grid overlay"
        aria-label="Toggle grid overlay"
      >
        <Grid3x3 size={16} />
      </button>
      <button
        type="button"
        className={hoverPreview ? styles.toggleActive : styles.toggle}
        onClick={toggleHoverPreview}
        aria-pressed={hoverPreview}
        title="Preview hover states"
        aria-label="Toggle hover preview"
      >
        <MousePointerClick size={16} />
      </button>
    </div>
  )
}
