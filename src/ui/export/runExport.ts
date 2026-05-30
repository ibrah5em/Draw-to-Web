/**
 * Renderer-side wrapper around {@link exportProject}.
 *
 * Reads the current document from the store, runs the full export pipeline
 * (validate → generate → SEO → axe → minify → ZIP → save), and surfaces
 * the outcome to the user. The heavy lifting all lives in `src/export/` —
 * this is just a thin glue function for the menu / topbar to call.
 *
 * The Export Options dialog (L-DLG-03) collects the user-driven option bag
 * and passes it here; callers that just want a one-shot export (the File
 * menu) omit it and get the pipeline defaults.
 */

import { exportProject, type ExportOptions } from '@export/index'
import { useDocumentStore } from '@store/documentStore'

/** Options accepted by {@link runExport}; a subset of the pipeline's bag. */
export type RunExportOptions = Omit<ExportOptions, 'dryRun' | 'fetchFonts'>

/**
 * Run the export pipeline and return a user-presentable message.
 *
 * @param options - Optional pipeline tuning (minify / inlineJS / theme /
 *   onProgress …). The project name defaults to the document name when the
 *   caller does not override it.
 */
export async function runExport(
  options: RunExportOptions = {}
): Promise<{ ok: boolean; message: string }> {
  const doc = useDocumentStore.getState().document
  try {
    const result = await exportProject(doc, {
      projectName: doc.meta.name,
      ...options,
    })
    if (result.success) {
      return {
        ok: true,
        message: result.filePath ? `Exported to ${result.filePath}` : 'Exported successfully.',
      }
    }
    return {
      ok: false,
      message: `Export failed at "${result.stage}": ${result.error}`,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { ok: false, message: `Export crashed: ${message}` }
  }
}
