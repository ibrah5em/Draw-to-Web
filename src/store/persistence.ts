/**
 * Document persistence — `.dtw` save + load (Y-PER-01, Y-PER-02).
 *
 * Two renderer-facing entry points:
 *
 *   - `saveProject()` reads `useDocumentStore`, stringifies the document,
 *     hands the JSON to `electronAPI.saveProject` (C4), and clears the
 *     dirty flag once the IPC handler reports success (closes the
 *     save-side of Y-PER-06).
 *   - `openProject()` invokes `electronAPI.openProject`, JSON-parses the
 *     payload, runs it through `migrate()` (which ends in
 *     `documentSchema.parse`, so it doubles as Zod validation), hydrates
 *     the document store, and clears the history + session-selection
 *     stores so the freshly loaded project starts on a clean timeline.
 *     Consumes contract C2.
 *
 * Behavioural contract:
 *
 *   - **Round-trip preserves the document byte-for-byte.** `JSON.stringify`
 *     is deterministic for our shape (no `undefined` values inside arrays,
 *     no `Date` objects — timestamps are ISO strings); `JSON.parse` of the
 *     result re-hydrates an identical structure.
 *   - **Dirty flag tracks save success only.** A user-cancelled dialog
 *     (`success: false`, no error) leaves the document dirty; an IPC
 *     error (`success: false`, `error: "..."`) leaves it dirty too. Only
 *     `success: true` calls `markClean`.
 *   - **Errors on load are structured, never thrown.** `openProject`
 *     returns a discriminated union so the UI can surface the failure
 *     stage (`ipc` | `parse` | `migrate`) without try/catch at the call
 *     site. Y-PER-02 DoD calls for a "structured error on parse fail".
 *   - **IO is injectable** for tests. Renderer callers omit the argument
 *     and the default resolves `window.electronAPI` at call time.
 *
 * The save / open dialogs and path sanitisation live in
 * `src/main/ipc.ts` — this module is intentionally a thin renderer-side
 * wrapper so the pre/post-IO coordination happens against the stores,
 * not in the main process.
 */

import { migrate } from '@document/migrations'
import type { Document, DocumentVersion } from '@document/types'

import { CURRENT_DOCUMENT_VERSION, useDocumentStore } from './documentStore'
import { useHistoryStore } from './historyStore'
import { useSessionStore } from './sessionStore'

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
 * Shape of the IPC result returned by the main-process `project:open`
 * handler. Re-declared locally so test stubs and renderer callers don't
 * have to import the whole `electronAPI` surface.
 *
 *   - `success: true`, `json: string`, `filePath: string` → the user
 *     picked a file and it was read successfully.
 *   - `success: false`, no `error` → the user cancelled the open dialog.
 *   - `success: false`, `error: string` → IPC, path, or filesystem
 *     failure (e.g. file too large, not a `.dtw`).
 */
export interface OpenProjectIpcResult {
  readonly success: boolean
  readonly filePath?: string
  readonly json?: string
  readonly error?: string
}

/**
 * Minimal IO surface `saveProject` / `openProject` need from
 * `window.electronAPI`. Picking a structural shape (rather than the full
 * `ElectronAPI`) keeps test stubs tiny and avoids dragging the preview /
 * export / a11y methods into store-level code.
 */
export interface ProjectSaveIO {
  saveProject: (json: string, suggestedName: string) => Promise<SaveProjectResult>
}

export interface ProjectOpenIO {
  openProject: () => Promise<OpenProjectIpcResult>
}

/** Default resolver — reads the preload-injected bridge at call time. */
function defaultSaveIO(): ProjectSaveIO {
  return window.electronAPI
}

function defaultOpenIO(): ProjectOpenIO {
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
export async function saveProject(io: ProjectSaveIO = defaultSaveIO()): Promise<SaveProjectResult> {
  const { document } = useDocumentStore.getState()
  const json = JSON.stringify(document)
  const result = await io.saveProject(json, document.meta.name)
  if (result.success) {
    useDocumentStore.getState().markClean()
  }
  return result
}

/**
 * Structured outcome of `openProject`. The discriminator lets the UI
 * react to each failure category — toast vs dialog vs silent (for
 * cancel) — without parsing free-text error messages.
 *
 *   - `kind: 'success'` — document was loaded, validated, and hydrated.
 *   - `kind: 'cancelled'` — user dismissed the open dialog. No error.
 *   - `kind: 'error'` — failure at the named `stage`:
 *       - `'ipc'`     — main-process I/O / path / size rejection.
 *       - `'parse'`   — JSON could not be parsed.
 *       - `'migrate'` — migration chain or schema validation rejected
 *                       the parsed payload (includes Zod errors and
 *                       "no migration path" errors).
 */
export type OpenProjectResult =
  | { readonly kind: 'success'; readonly filePath: string; readonly document: Document }
  | { readonly kind: 'cancelled' }
  | {
      readonly kind: 'error'
      readonly stage: 'ipc' | 'parse' | 'migrate'
      readonly message: string
    }

/**
 * Prompt the user for a `.dtw` file, parse + migrate + validate the
 * payload, and hydrate the editor stores. Satisfies the C2 consumer
 * side of the document schema contract (every cross-process boundary
 * runs through `documentSchema`; `migrate()` ends in
 * `documentSchema.parse` so the final result is always a valid
 * `Document`).
 *
 * On success:
 *
 *   - `documentStore.hydrate(doc)` replaces the in-memory document and
 *     clears the dirty flag.
 *   - `historyStore.clear()` resets the undo/redo timeline so the user
 *     cannot undo back into a previously-edited document.
 *   - `sessionStore.clearSelection()` drops any `selectedIds` that
 *     pointed at elements in the previous tree. Panel sizes,
 *     `activeBreakpoint`, `activeState`, and theme are preserved —
 *     those are user-tunable editor preferences, not data-bound.
 *
 * On any error the stores are left untouched so the user keeps editing
 * their previous document.
 *
 * @param io - Test seam. Production callers omit this and the
 *   preload-injected `window.electronAPI` is used.
 */
export async function openProject(io: ProjectOpenIO = defaultOpenIO()): Promise<OpenProjectResult> {
  const ipcResult = await io.openProject()
  if (!ipcResult.success) {
    if (ipcResult.error !== undefined) {
      return { kind: 'error', stage: 'ipc', message: ipcResult.error }
    }
    return { kind: 'cancelled' }
  }
  if (typeof ipcResult.json !== 'string' || typeof ipcResult.filePath !== 'string') {
    return {
      kind: 'error',
      stage: 'ipc',
      message: 'Open succeeded but the main process returned no payload',
    }
  }

  // Stage 1 — raw JSON parse.
  let parsed: unknown
  try {
    parsed = JSON.parse(ipcResult.json)
  } catch (err) {
    return {
      kind: 'error',
      stage: 'parse',
      message: err instanceof Error ? err.message : 'Malformed JSON',
    }
  }

  // Stage 2 — migrate + Zod validate (migrate ends in documentSchema.parse).
  // When `version` is missing or not a string we still hand the value off
  // to migrate(); it will short-circuit to the schema parse and surface a
  // structured Zod error, which the UI can render verbatim.
  const fromVersion =
    parsed !== null &&
    typeof parsed === 'object' &&
    'version' in parsed &&
    typeof (parsed as { version: unknown }).version === 'string'
      ? ((parsed as { version: string }).version as DocumentVersion)
      : CURRENT_DOCUMENT_VERSION

  let document: Document
  try {
    document = migrate(parsed, fromVersion, CURRENT_DOCUMENT_VERSION)
  } catch (err) {
    return {
      kind: 'error',
      stage: 'migrate',
      message: err instanceof Error ? err.message : 'Validation or migration failed',
    }
  }

  // Stage 3 — hydrate. Order matters: document first so any subscribers
  // that wake on the historyStore.clear() see the new document.
  useDocumentStore.getState().hydrate(document)
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()

  return { kind: 'success', filePath: ipcResult.filePath, document }
}
