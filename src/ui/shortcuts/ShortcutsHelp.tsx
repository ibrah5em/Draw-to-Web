/**
 * Keyboard shortcuts Help panel (L-DLG-05).
 *
 * Read-only reference rendered from the shared {@link SHORTCUT_GROUPS}
 * catalogue, so it always matches what `useEditorShortcuts` binds. Opened
 * from the Help menu; a passive dialog with no actions of its own.
 */

import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { JSX } from 'react'

import { SHORTCUT_GROUPS } from './shortcutList'
import styles from './ShortcutsHelp.module.css'

interface ShortcutsHelpProps {
  readonly open: boolean
  readonly onClose: () => void
}

/** Modal listing every editor keyboard shortcut, grouped by area. */
export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps): JSX.Element {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>Keyboard shortcuts</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className={styles.closeBtn} aria-label="Close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </header>

          <div className={styles.body}>
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} className={styles.group}>
                <h3 className={styles.groupTitle}>{group.title}</h3>
                <ul className={styles.list}>
                  {group.entries.map((entry) => (
                    <li key={entry.description} className={styles.row}>
                      <span className={styles.desc}>{entry.description}</span>
                      <kbd className={styles.keys}>{entry.keys}</kbd>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
