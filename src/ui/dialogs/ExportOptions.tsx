/**
 * Export Options dialog (L-DLG-03).
 *
 * Surfaces the I-EXP-03 option set — `minify`, `inlineJS`, `selfHostFonts`,
 * `includeSourceComments`, `theme` — plus the output filename, then hands a
 * fully-formed {@link ExportOptions} bag to its `onExport` callback. The
 * dialog owns no pipeline logic; the topbar Export button (L-TOP-04) runs
 * `exportProject` with whatever this returns.
 *
 * The option field names mirror `ExportOptions` exactly so the values pass
 * straight through to the pipeline with no remapping.
 */

import * as Dialog from '@radix-ui/react-dialog'
import * as Switch from '@radix-ui/react-switch'
import { Download, X } from 'lucide-react'
import { useEffect, useState, type JSX } from 'react'

import type { ExportOptions } from '@export/index'

import styles from './ExportOptions.module.css'

/** The subset of {@link ExportOptions} this dialog collects. */
export interface ExportOptionValues {
  readonly projectName: string
  readonly minify: boolean
  readonly inlineJS: boolean
  readonly selfHostFonts: boolean
  readonly includeSourceComments: boolean
  readonly theme: 'auto' | 'light' | 'dark'
}

interface ExportOptionsProps {
  readonly open: boolean
  readonly onClose: () => void
  /** Fired when the user confirms; receives the assembled options. */
  readonly onExport: (options: ExportOptionValues) => void
  /** Initial filename (no extension), usually the document name. */
  readonly defaultName: string
  /** Whether an export is currently running — disables the confirm button. */
  readonly busy?: boolean
}

const THEME_OPTIONS: ReadonlyArray<{ value: ExportOptionValues['theme']; label: string }> = [
  { value: 'auto', label: 'Auto (OS)' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

interface ToggleDef {
  readonly key: keyof Omit<ExportOptionValues, 'projectName' | 'theme'>
  readonly label: string
  readonly hint: string
}

const TOGGLES: ReadonlyArray<ToggleDef> = [
  { key: 'minify', label: 'Minify output', hint: 'Compress HTML, CSS, and JS for production.' },
  {
    key: 'inlineJS',
    label: 'Inline JavaScript',
    hint: 'Embed scripts in the page (one less request).',
  },
  {
    key: 'selfHostFonts',
    label: 'Self-host fonts',
    hint: 'Download Google Fonts into the bundle for offline use.',
  },
  {
    key: 'includeSourceComments',
    label: 'Source comments',
    hint: 'Keep a generator banner comment in each file.',
  },
]

const DEFAULTS: Omit<ExportOptionValues, 'projectName'> = {
  minify: true,
  inlineJS: false,
  selfHostFonts: false,
  includeSourceComments: false,
  theme: 'auto',
}

/** Export Options modal. Collects I-EXP-03 options and a filename. */
export function ExportOptions({
  open,
  onClose,
  onExport,
  defaultName,
  busy = false,
}: ExportOptionsProps): JSX.Element {
  const [values, setValues] = useState<ExportOptionValues>({
    ...DEFAULTS,
    projectName: defaultName,
  })

  // Re-seed the filename whenever the dialog (re)opens for a new document so
  // a renamed project surfaces its current name instead of a stale one.
  useEffect(() => {
    if (open) setValues((v) => ({ ...v, projectName: defaultName }))
  }, [open, defaultName])

  const setToggle = (key: ToggleDef['key'], next: boolean): void =>
    setValues((v) => ({ ...v, [key]: next }))

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.overlay} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>Export options</Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" className={styles.closeBtn} aria-label="Close">
                <X size={14} />
              </button>
            </Dialog.Close>
          </header>

          <div className={styles.body}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Output filename</span>
              <div className={styles.filenameRow}>
                <input
                  className={styles.input}
                  value={values.projectName}
                  onChange={(e) => setValues((v) => ({ ...v, projectName: e.target.value }))}
                  aria-label="Output filename"
                  spellCheck={false}
                />
                <span className={styles.ext}>.zip</span>
              </div>
            </label>

            <div className={styles.field}>
              <span className={styles.fieldLabel}>Default theme</span>
              <div className={styles.segmented} role="group" aria-label="Default theme">
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={option.value === values.theme ? styles.segActive : styles.seg}
                    aria-pressed={option.value === values.theme}
                    onClick={() => setValues((v) => ({ ...v, theme: option.value }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <ul className={styles.toggleList}>
              {TOGGLES.map((toggle) => (
                <li key={toggle.key} className={styles.toggleRow}>
                  <span className={styles.toggleText}>
                    <span className={styles.toggleLabel}>{toggle.label}</span>
                    <span className={styles.toggleHint}>{toggle.hint}</span>
                  </span>
                  <Switch.Root
                    className={styles.switch}
                    checked={values[toggle.key]}
                    onCheckedChange={(checked) => setToggle(toggle.key, checked)}
                    aria-label={toggle.label}
                  >
                    <Switch.Thumb className={styles.switchThumb} />
                  </Switch.Root>
                </li>
              ))}
            </ul>
          </div>

          <footer className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.exportBtn}
              onClick={() => onExport(values)}
              disabled={busy}
            >
              <Download size={14} />
              {busy ? 'Exporting…' : 'Export'}
            </button>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
