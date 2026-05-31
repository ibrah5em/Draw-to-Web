/**
 * File-change conflict dialog (L-DLG-04).
 *
 * Subscribes to the `onFileChanged` IPC (C4 + I-ELE-06) — fired when the open
 * `.dtw` is modified outside the editor — and prompts the author to reconcile:
 *
 *   - **Reload from disk** — re-reads the changed file by its known path and
 *     replaces the in-memory document. This clears the undo/redo timeline
 *     (the loaded document is a fresh baseline), which is why it requires the
 *     explicit ack this dialog provides rather than reloading silently.
 *   - **Keep my changes** — dismisses; the in-memory document wins and is
 *     marked dirty, so the next save overwrites the external edit.
 *
 * The verdict is carried out by the Y-PER-05 store controller
 * (`acceptFileReload` / `declineFileReload`). Reload goes straight through
 * `openProjectByPath` (no second dialog) now that the load-by-path IPC is in
 * the preload surface (I-ELE-07).
 */

import * as Dialog from '@radix-ui/react-dialog'
import { useEffect, useState, type JSX } from 'react'

import { acceptFileReload, declineFileReload } from '@store/fileReload'

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
    if (conflictPath === null) return
    void acceptFileReload(conflictPath).finally(clear)
  }

  const keep = (): void => {
    declineFileReload()
    clear()
  }

  return (
    <Dialog.Root open={conflictPath !== null} onOpenChange={(next) => !next && keep()}>
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
            <button type="button" className={styles.keepBtn} onClick={keep}>
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
