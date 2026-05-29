/**
 * Welcome dialog (L-DLG-01).
 *
 * Shown on launch when no project file is open. Offers four entry points:
 *
 *   - New blank project
 *   - Open an existing `.dtw` from disk (via `electronAPI.openProject`)
 *   - Pick from the Recent list (pulled from `electronAPI.listRecentFiles`)
 *   - Start from a template (Portfolio, Blank — Landing and Resume are
 *     placeholders until their factories land)
 *
 * The dialog stays a passive surface — actual project loading is handled by
 * the menu bar's open / save flows, so it's enough for the buttons to call
 * the same callbacks. Errors and progress live in the toast/console.
 */

import * as Dialog from '@radix-ui/react-dialog'
import { FilePlus2, FolderOpen, LayoutTemplate, X } from 'lucide-react'
import { useEffect, useState, type JSX } from 'react'

import type { RecentFile } from '@shared/electronAPI'

import styles from './Welcome.module.css'

export type WelcomeTemplate = 'portfolio' | 'blank' | 'landing' | 'resume'

interface WelcomeProps {
  /** Whether the dialog is currently open. */
  readonly open: boolean
  /** Close the dialog without making a choice. */
  readonly onClose: () => void
  /** New blank project (resets the document). */
  readonly onNew: () => void
  /** Trigger the open-project flow. */
  readonly onOpen: () => void
  /** Open one of the bundled templates. */
  readonly onTemplate: (template: WelcomeTemplate) => void
  /** Open a recent project by file path. */
  readonly onRecent: (path: string) => void
}

interface TemplateOption {
  readonly id: WelcomeTemplate
  readonly label: string
  readonly description: string
  readonly disabled?: boolean
}

const TEMPLATES: ReadonlyArray<TemplateOption> = [
  { id: 'portfolio', label: 'Portfolio', description: 'Modern dark/light personal site.' },
  { id: 'blank', label: 'Blank', description: 'Single root container — start from scratch.' },
  { id: 'landing', label: 'Landing', description: 'Coming soon.', disabled: true },
  { id: 'resume', label: 'Resume', description: 'Coming soon.', disabled: true },
]

/** Pulls the persisted MRU list, gracefully no-ops when the IPC is missing. */
function useRecentFiles(open: boolean): readonly RecentFile[] {
  const [recents, setRecents] = useState<readonly RecentFile[]>([])
  useEffect(() => {
    if (!open) return
    const api = (globalThis as { electronAPI?: Window['electronAPI'] }).electronAPI
    if (!api?.listRecentFiles) return
    let cancelled = false
    void api.listRecentFiles().then((list) => {
      if (!cancelled) setRecents(list)
    })
    return () => {
      cancelled = true
    }
  }, [open])
  return recents
}

/** Welcome screen with New / Open / Recent / Templates entries. */
export function Welcome({
  open,
  onClose,
  onNew,
  onOpen,
  onTemplate,
  onRecent,
}: WelcomeProps): JSX.Element {
  const recents = useRecentFiles(open)

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <header className={styles.header}>
            <div>
              <Dialog.Title className={styles.title}>Welcome to Draw-to-Web</Dialog.Title>
              <Dialog.Description className={styles.subtitle}>
                Start a new project, open an existing one, or pick a template.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button type="button" className={styles.closeBtn} aria-label="Close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </header>

          <div className={styles.body}>
            <section className={styles.section} aria-label="Start">
              <h2 className={styles.sectionTitle}>Start</h2>
              <div className={styles.actions}>
                <button type="button" className={styles.actionBtn} onClick={onNew}>
                  <FilePlus2 size={16} aria-hidden />
                  New blank project
                  <span className={styles.actionMeta}>Ctrl+N</span>
                </button>
                <button type="button" className={styles.actionBtn} onClick={onOpen}>
                  <FolderOpen size={16} aria-hidden />
                  Open project…
                  <span className={styles.actionMeta}>Ctrl+O</span>
                </button>
              </div>

              <h2 className={styles.sectionTitle}>Recent</h2>
              <div className={styles.recents} aria-label="Recent projects">
                {recents.length === 0 ? (
                  <p className={styles.emptyHint}>No recent projects yet.</p>
                ) : (
                  recents.map((recent) => (
                    <button
                      key={recent.path}
                      type="button"
                      className={styles.recentBtn}
                      onClick={() => onRecent(recent.path)}
                      title={recent.path}
                    >
                      <span className={styles.recentName}>{recent.name}</span>
                      <span className={styles.recentPath}>{recent.path}</span>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className={styles.section} aria-label="Templates">
              <h2 className={styles.sectionTitle}>Templates</h2>
              <div className={styles.actions}>
                {TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => onTemplate(template.id)}
                    disabled={template.disabled}
                    title={template.description}
                  >
                    <LayoutTemplate size={16} aria-hidden />
                    {template.label}
                    <span className={styles.actionMeta}>{template.description}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
