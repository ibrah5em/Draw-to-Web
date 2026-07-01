/**
 * Topbar "Match design" button.
 *
 * Opens the {@link MatchLayout} dialog, which ranks the layout drawn on the
 * canvas against the bundled professional designs and lets the author adopt
 * one. Self-contained (owns its open state) so the app shell only has to
 * mount it, mirroring {@link ExportButton}.
 */

import { Wand2 } from 'lucide-react'
import { useState, type JSX } from 'react'

import { MatchLayout } from '../dialogs/MatchLayout'
import styles from './MatchButton.module.css'

/** Topbar control that opens the layout-matching dialog. */
export function MatchButton(): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen(true)}
        title="Match your layout to a professional design"
        aria-label="Match my layout to a professional design"
      >
        <Wand2 size={14} aria-hidden />
        Match design
      </button>

      <MatchLayout open={open} onClose={() => setOpen(false)} />
    </>
  )
}
