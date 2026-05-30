/**
 * File-change conflict dialog (L-DLG-04).
 *
 * Subscribes to the `onFileChanged` IPC (C4 + I-ELE-06) — fired when the open
 * `.dtw` is modified outside the editor — and prompts the author to reconcile:
 *
 *   - **Reload from disk** — re-opens the project, replacing the in-memory
 *     document. This clears the undo/redo timeline (the loaded document is a
 *     fresh baseline), which is why it requires the explicit ack this dialog
 *     provides rather than reloading silently.
 *   - **Keep my changes** — dismisses; the in-memory document wins and stays
 *     dirty, so the next save overwrites the external edit.
 *
 * `openProject` re-prompts for the file because a load-by-path IPC isn't part
 * of the current preload surface; selecting the same file completes the
 * reload. (A `loadFromPath` IPC would let this reload silently — a follow-up
 * for the electron lane.)
 */

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type JSX } from 'react'

import { openProject } from '@store/persistence'

import styles from './ConflictResolver.module.css'

/**
 * Subscribe to external file-change notifications. Returns the changed file
 * path while a conflict is pending, or `null` when there is none. Safe when
 * the IPC bridge is absent (web/test) — it simply never fires.
 */
function useFileConflict(): [string | null, () => void] {
  const [conflictPath, setConflictPath] = useState<string | null>(null)
  useEffect(() => {
    const api = (globalThis as { electronAPI?: Window['electronAPI'] }).electronAPI
    if (!api?.onFileChanged) return
    const unsubscribe = api.onFileChanged((filePath) => setConflictPath(filePath))
    return unsubscribe
  }, [])
  return [conflictPath, () => setConflictPath(null)]
}

/** Modal shown when the open project changes on disk outside the editor. */
export function ConflictResolver(): JSX.Element {
  const [conflictPath, clear] = useFileConflict()

  const reload = (): void => {
    void openProject().finally(clear)
  }

  return (
    <Dialog.Root open={conflictPath !== null} onOpenChange={(next) => !next && clear()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <Dialog.Title className={styles.title}>File changed on disk</Dialog.Title>
          <Dialog.Description className={styles.body}>
            This project was modified outside the editor
            {conflictPath ? <span className={styles.path}>{conflictPath}</span> : null}. Reload the
            external version, or keep your in-memory changes?
          </Dialog.Description>
          <p className={styles.warning}>Reloading discards your undo history.</p>
          <footer className={styles.footer}>
            <button type="button" className={styles.keepBtn} onClick={clear}>
              Keep my changes
            </button>
            <button type="button" className={styles.reloadBtn} onClick={reload}>
              Reload from disk
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
