/**
 * Renderer-side wrapper around {@link exportProject}.
 *
 * Reads the current document from the store, runs the full export pipeline
 * (validate → generate → SEO → axe → minify → ZIP → save), and surfaces
 * the outcome to the user. The heavy lifting all lives in `src/export/` —
 * this is just a thin glue function for the menu / topbar to call.
 *
 * A future Export Options dialog (L-DLG-03) will replace the default
 * options bag with user-driven values.
 */

import { exportProject } from '@export/index'
import { useDocumentStore } from '@store/documentStore'

/** Run the export pipeline and return a user-presentable message. */
export async function runExport(): Promise<{ ok: boolean; message: string }> {
  const doc = useDocumentStore.getState().document
  try {
    const result = await exportProject(doc, { projectName: doc.meta.name })
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
