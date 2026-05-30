/**
 * Topbar Export button (L-TOP-04) + export-block indicator (L-VAL-03).
 *
 * Opens the Export Options dialog (L-DLG-03), then runs the export pipeline
 * with the chosen options via {@link runExport} (C12). While the document
 * has blocking validation errors the button is disabled and its tooltip
 * explains why (L-VAL-03) — the same `validateDocument().errors` the
 * pipeline would reject at its `validate` stage, surfaced up-front so the
 * author never hits a dead-end dialog.
 *
 * Progress events from the pipeline drive the inline status label; the
 * final outcome is announced through `window.alert` (matching the existing
 * File-menu export until a toast system lands).
 */

import { Download } from 'lucide-react'
import { useState, type JSX } from 'react'

import type { ExportStage } from '@export/index'

import { ExportOptions, type ExportOptionValues } from '../dialogs/ExportOptions'
import { useHasValidationErrors } from '../panels/validation/useValidationReport'
import { runExport } from '../export/runExport'
import { useDocumentMeta } from '@store/documentStore'
import styles from './ExportButton.module.css'

/** Human-readable label per pipeline stage, for the progress chip. */
const STAGE_LABEL: Record<ExportStage, string> = {
  validate: 'Validating',
  generate: 'Generating',
  'inject-seo': 'Injecting SEO',
  'a11y-gate': 'Checking a11y',
  'optimize-images': 'Optimizing images',
  minify: 'Minifying',
  'sitemap-robots': 'Writing sitemap',
  bundle: 'Bundling',
  save: 'Saving',
}

const BLOCKED_TITLE = 'Fix the validation errors in the Problems panel before exporting.'

/** Export control for the topbar: gated trigger + options dialog + progress. */
export function ExportButton(): JSX.Element {
  const meta = useDocumentMeta()
  const hasErrors = useHasValidationErrors()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [stage, setStage] = useState<ExportStage | null>(null)

  const onExport = (options: ExportOptionValues): void => {
    setBusy(true)
    setStage('validate')
    void runExport({
      projectName: options.projectName,
      minify: options.minify,
      inlineJS: options.inlineJS,
      selfHostFonts: options.selfHostFonts,
      includeSourceComments: options.includeSourceComments,
      theme: options.theme,
      onProgress: (event) => setStage(event.stage),
    })
      .then((result) => {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(result.message)
        }
        setOpen(false)
      })
      .finally(() => {
        setBusy(false)
        setStage(null)
      })
  }

  return (
    <>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen(true)}
        disabled={hasErrors || busy}
        title={hasErrors ? BLOCKED_TITLE : 'Export the site as a ZIP'}
        aria-label="Export"
      >
        <Download size={14} aria-hidden />
        {busy && stage ? STAGE_LABEL[stage] : 'Export'}
      </button>

      <ExportOptions
        open={open}
        onClose={() => !busy && setOpen(false)}
        onExport={onExport}
        defaultName={meta.name}
        busy={busy}
      />
    </>
  )
}
