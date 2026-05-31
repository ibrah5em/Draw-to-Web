/**
 * File-change reload (Y-PER-05).
 *
 * Pairs with the L-DLG-04 conflict dialog. When the open `.dtw` is modified
 * outside the editor the main process fires `onFileChanged` (I-ELE-06); the
 * dialog prompts the author, and this controller carries out the verdict:
 *
 *   - **accept-reload** → re-read the canonical `.dtw` straight from its
 *     known path via `openProjectByPath` (no dialog), parse + migrate through
 *     the same C2 pipeline as `openProject`, and hydrate the stores. The
 *     undo/redo timeline is cleared because the reloaded document is a fresh
 *     baseline — the L-DLG-04 decision pins this ("history clears with
 *     explicit user ack").
 *   - **decline** → keep the in-memory document untouched and mark it dirty,
 *     so the divergence from disk is visible (L-TOP-05) and the next save
 *     overwrites the external edit. The Y-PER-05 DoD pins this ("decline
 *     keeps in-memory state").
 *
 * Reloading by path (rather than re-prompting with an open dialog) became
 * possible once `openProjectByPath` landed in the preload surface (I-ELE-07).
 * Like crash recovery (Y-PER-04) and persistence (Y-PER-01..02), the IO
 * surface is structural and injectable so test stubs stay tiny and the store
 * never imports the full `ElectronAPI`; the default resolver reads the
 * preload-injected bridge at call time and degrades to a structured
 * "not wired" error when the bridge is absent (web/test).
 */

import { migrate } from '@document/migrations'
import type { Document, DocumentVersion } from '@document/types'

import { CURRENT_DOCUMENT_VERSION, useDocumentStore } from './documentStore'
import { useHistoryStore } from './historyStore'
import { useSessionStore } from './sessionStore'

/**
 * Shape of the IPC result returned by the main-process `project:open-by-path`
 * handler (mirrors `openProjectByPath` in the preload surface). Re-declared
 * locally so test stubs and callers don't import the whole `electronAPI`.
 *
 *   - `success: true`, `json: string`, `filePath: string` → the file on disk
 *     was read successfully.
 *   - `success: false`, `error: string` → IPC, path, size, or filesystem
 *     failure (e.g. the file was deleted between the change event and the
 *     reload).
 */
export interface OpenByPathIpcResult {
  readonly success: boolean
  readonly filePath?: string
  readonly json?: string
  readonly error?: string
}

/**
 * Minimal IO surface `acceptFileReload` needs from `window.electronAPI`.
 * Structural by design — picking the single method keeps test stubs tiny
 * and avoids dragging the export / preview / a11y methods into store code.
 */
export interface FileReloadIO {
  openProjectByPath: (filePath: string) => Promise<OpenByPathIpcResult>
}

/** Default resolver — reads the preload-injected bridge at call time. */
function defaultIO(): FileReloadIO {
  const bridge = (
    globalThis as typeof globalThis & {
      electronAPI?: { openProjectByPath?: (filePath: string) => Promise<OpenByPathIpcResult> }
    }
  ).electronAPI
  return {
    openProjectByPath:
      typeof bridge?.openProjectByPath === 'function'
        ? bridge.openProjectByPath.bind(bridge)
        : async () => ({ success: false, error: 'file-reload IPC not wired' }),
  }
}

/**
 * Structured outcome of `acceptFileReload`. The discriminator lets the UI
 * react to each failure category without parsing free-text error messages.
 *
 *   - `kind: 'reloaded'` — disk version was read, validated, and hydrated.
 *   - `kind: 'error'` — failure at the named `stage`:
 *       - `'ipc'`     — main-process I/O / path / size rejection (e.g. the
 *                       file was moved or deleted before the reload ran).
 *       - `'parse'`   — JSON could not be parsed.
 *       - `'migrate'` — migration chain or schema validation rejected the
 *                       parsed payload (includes Zod errors).
 *
 * On any error the stores are left untouched, so the user keeps editing the
 * in-memory document exactly as if they had declined.
 */
export type FileReloadResult =
  | { readonly kind: 'reloaded'; readonly filePath: string; readonly document: Document }
  | {
      readonly kind: 'error'
      readonly stage: 'ipc' | 'parse' | 'migrate'
      readonly message: string
    }

/**
 * Accept an external file change: re-read the canonical `.dtw` from
 * `projectPath`, validate + migrate it, and replace the in-memory document.
 *
 * On success:
 *
 *   - `documentStore.hydrate(doc)` swaps in the disk version and clears the
 *     dirty flag (the in-memory state now matches the file again).
 *   - `historyStore.clear()` resets undo/redo — the reloaded document is a
 *     new baseline and must not be undoable back into the discarded edits.
 *   - `sessionStore.clearSelection()` drops `selectedIds` that may point at
 *     elements no longer in the reloaded tree. Panel sizes, breakpoint,
 *     state, and theme are editor preferences and are preserved.
 *   - `sessionStore.setCurrentFilePath(projectPath)` keeps the session bound
 *     to the same file so autosave (Y-PER-03) targets the right sidecar.
 *
 * @param projectPath - Absolute path of the `.dtw` that changed on disk,
 *   from the `onFileChanged` payload (C4).
 * @param io - Test seam. Production callers omit this; the preload bridge
 *   is used.
 */
export async function acceptFileReload(
  projectPath: string,
  io: FileReloadIO = defaultIO()
): Promise<FileReloadResult> {
  const ipcResult = await io.openProjectByPath(projectPath)
  if (!ipcResult.success || typeof ipcResult.json !== 'string') {
    return {
      kind: 'error',
      stage: 'ipc',
      message: ipcResult.error ?? 'Failed to read the changed file from disk',
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
  // A missing/non-string version drops straight into the current-version
  // schema parse so the Zod error reaches the caller verbatim.
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

  // Stage 3 — hydrate. Document first so subscribers that wake on
  // historyStore.clear() already see the reloaded tree.
  useDocumentStore.getState().hydrate(document)
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()
  useSessionStore.getState().setCurrentFilePath(projectPath)

  return { kind: 'reloaded', filePath: ipcResult.filePath ?? projectPath, document }
}

/**
 * Decline an external file change: keep the in-memory document and mark it
 * dirty so the divergence from disk is surfaced by the topbar indicator
 * (L-TOP-05) and the next save deliberately overwrites the external edit.
 *
 * No disk access and no history change — the timeline the author built is
 * preserved exactly. Satisfies the Y-PER-05 DoD ("decline keeps in-memory
 * state").
 */
export function declineFileReload(): void {
  useDocumentStore.getState().markDirty()
}
