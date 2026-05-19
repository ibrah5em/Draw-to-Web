/**
 * Document persistence — `.dtw` save (Y-PER-01).
 *
 * `saveProject()` is the renderer-facing entry point for serialising the
 * current document to disk. It reads `useDocumentStore`, stringifies the
 * document, hands the JSON to `electronAPI.saveProject` (C4), and clears
 * the dirty flag once the IPC handler reports success (closes the
 * save-side of Y-PER-06).
 *
 * Behavioural contract:
 *
 *   - **Round-trip preserves the document byte-for-byte.** `JSON.stringify`
 *     is deterministic for our shape (no `undefined` values inside arrays,
 *     no `Date` objects — timestamps are ISO strings); `JSON.parse` of the
 *     result re-hydrates an identical structure. The Y-PER-02 loader is
 *     the matching reader.
 *   - **Dirty flag tracks save success only.** A user-cancelled dialog
 *     (`success: false`, no error) leaves the document dirty; an IPC
 *     error (`success: false`, `error: "..."`) leaves it dirty too. Only
 *     `success: true` calls `markClean`.
 *   - **IO is injectable** for tests. Renderer callers omit the argument
 *     and the default resolves `window.electronAPI` at call time.
 *
 * The save dialog and path sanitisation live in `src/main/ipc.ts` — this
 * module is intentionally a thin renderer-side wrapper so the
 * pre-save / post-save coordination happens against the store, not in
 * the main process.
 */

import { useDocumentStore } from './documentStore'

/**
 * Shape of the IPC result returned by the main-process `project:save`
 * handler. Re-declared here as a named type so test stubs and renderer
 * callers don't have to import the entire `electronAPI` surface.
 *
 *   - `success: true`  → the user picked a path and the file was written.
 *   - `success: false`, no `error` → the user cancelled the save dialog.
 *   - `success: false`, `error: string` → IPC or filesystem failure.
 */
export interface SaveProjectResult {
  readonly success: boolean
  readonly filePath?: string
  readonly error?: string
}

/**
 * Minimal IO surface `saveProject` needs from `window.electronAPI`.
 * Picking a structural shape (rather than the full `ElectronAPI`) keeps
 * test stubs tiny and avoids dragging the preview / export / a11y
 * methods into store-level code.
 */
export interface ProjectSaveIO {
  saveProject: (json: string, suggestedName: string) => Promise<SaveProjectResult>
}

/** Default resolver — reads the preload-injected bridge at call time. */
function defaultIO(): ProjectSaveIO {
  return window.electronAPI
}

/**
 * Serialise the current document and prompt the user for a save path.
 *
 * On success the dirty flag is cleared; on cancel or error the flag is
 * preserved so the topbar dirty indicator (L-TOP-05) stays accurate.
 * Returns the raw IPC result so callers can surface the path or the
 * error message in toast UI.
 *
 * @param io - Test seam. Production callers omit this and the
 *   preload-injected `window.electronAPI` is used.
 */
export async function saveProject(io: ProjectSaveIO = defaultIO()): Promise<SaveProjectResult> {
  const { document } = useDocumentStore.getState()
  const json = JSON.stringify(document)
  const result = await io.saveProject(json, document.meta.name)
  if (result.success) {
    useDocumentStore.getState().markClean()
  }
  return result
}
