/**
 * Application Settings dialog (Task 4).
 *
 * Global, cross-project preferences persisted to localStorage via
 * {@link useAppSettings} — distinct from the per-document Document Settings
 * dialog. Modeled on the Export Options / Document Settings modals (Radix
 * Dialog + Switch, tokens.css) so it shares the app's visual language.
 *
 * Changes apply live and persist immediately; there is no separate save step.
 * Theme and hover-preview write through the live editor stores (the
 * {@link useAppSettingsSync} bridge mirrors those changes into the persisted
 * store), while export defaults write straight to {@link useAppSettings}.
 */

import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { X } from 'lucide-react'
import type { JSX } from 'react'

import { useSessionStore } from '@store/sessionStore'

import { useAppSettings, type ExportDefaults } from '../state/appSettings'
import { useViewPrefs } from '../state/viewPrefs'
import styles from './AppSettings.module.css'

interface AppSettingsProps {
  readonly open: boolean
  readonly onClose: () => void
}

const THEME_OPTIONS: ReadonlyArray<{ value: 'light' | 'dark'; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

const EXPORT_THEME_OPTIONS: ReadonlyArray<{ value: ExportDefaults['theme']; label: string }> = [
  { value: 'auto', label: 'Auto (OS)' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

interface ExportToggleDef {
  readonly key: keyof Omit<ExportDefaults, 'theme'>
  readonly label: string
  readonly hint: string
}

const EXPORT_TOGGLES: ReadonlyArray<ExportToggleDef> = [
  { key: 'minify', label: 'Minify output', hint: 'Compress HTML, CSS, and JS for production.' },
  { key: 'inlineJS', label: 'Inline JavaScript', hint: 'Embed scripts in the page.' },
  {
    key: 'selfHostFonts',
    label: 'Self-host fonts',
    hint: 'Download Google Fonts into the bundle.',
  },
  {
    key: 'includeSourceComments',
    label: 'Source comments',
    hint: 'Keep a generator banner comment in each file.',
  },
]

/** Global application settings modal. */
export function AppSettings({ open, onClose }: AppSettingsProps): JSX.Element {
  const theme = useSessionStore((s) => s.theme)
  const setTheme = useSessionStore((s) => s.setTheme)
  const hoverPreview = useViewPrefs((s) => s.hoverPreview)
  const setHoverPreview = useViewPrefs((s) => s.setHoverPreview)
  const exportDefaults = useAppSettings((s) => s.exportDefaults)
  const setExportDefault = useAppSettings((s) => s.setExportDefault)

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>Settings</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className={styles.closeBtn} aria-label="Close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </header>

          <div className={styles.body}>
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Appearance</h3>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Editor theme</span>
                <div className={styles.segmented} role="group" aria-label="Editor theme">
                  {THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={option.value === theme ? styles.segActive : styles.seg}
                      aria-pressed={option.value === theme}
                      onClick={() => setTheme(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Editor</h3>
              <div className={styles.toggleRow}>
                <span className={styles.toggleText}>
                  <span className={styles.toggleLabel}>Hover preview</span>
                  <span className={styles.toggleHint}>
                    Render elements in their hover state by default.
                  </span>
                </span>
                <Switch.Root
                  className={styles.switch}
                  checked={hoverPreview}
                  onCheckedChange={(checked) => setHoverPreview(checked)}
                  aria-label="Hover preview"
                >
                  <Switch.Thumb className={styles.switchThumb} />
                </Switch.Root>
              </div>
            </section>

            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Export defaults</h3>
              <div className={styles.field}>
                <span className={styles.fieldLabel}>Default theme</span>
                <div className={styles.segmented} role="group" aria-label="Default export theme">
                  {EXPORT_THEME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={
                        option.value === exportDefaults.theme ? styles.segActive : styles.seg
                      }
                      aria-pressed={option.value === exportDefaults.theme}
                      onClick={() => setExportDefault('theme', option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              <ul className={styles.toggleList}>
                {EXPORT_TOGGLES.map((toggle) => (
                  <li key={toggle.key} className={styles.toggleRow}>
                    <span className={styles.toggleText}>
                      <span className={styles.toggleLabel}>{toggle.label}</span>
                      <span className={styles.toggleHint}>{toggle.hint}</span>
                    </span>
                    <Switch.Root
                      className={styles.switch}
                      checked={exportDefaults[toggle.key]}
                      onCheckedChange={(checked) => setExportDefault(toggle.key, checked)}
                      aria-label={toggle.label}
                    >
                      <Switch.Thumb className={styles.switchThumb} />
                    </Switch.Root>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <footer className={styles.footer}>
            <button type="button" className={styles.doneBtn} onClick={onClose}>
              Done
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
