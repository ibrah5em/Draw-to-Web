/**
 * Crash recovery (Y-PER-04).
 *
 * Pairs with autosave (Y-PER-03). On launch, the editor checks the
 * `<project>.dtw.autosave` sidecar against the canonical `<project>.dtw`:
 *
 *   - **sidecar absent** → no recovery, no prompt.
 *   - **sidecar present but older than `.dtw`** → the user already saved
 *     past the autosave checkpoint; the sidecar is stale. Delete it
 *     silently so we don't keep tripping the probe on every launch.
 *   - **sidecar newer** → unsaved work survived a crash. Parse + migrate
 *     the payload through the same C2 pipeline as `openProject`, return
 *     `{ kind: 'available', document }`, and let the UI prompt the user.
 *
 * Decisions surfaced through two imperative entry points:
 *
 *   - `acceptCrashRecovery(document)` — hydrate the store and mark dirty
 *     so the next manual save writes the recovered work to the canonical
 *     `.dtw`. The sidecar is intentionally **not** deleted on accept: if
 *     the user crashes again before saving, the same checkpoint is still
 *     on disk.
 *   - `declineCrashRecovery(sidecarPath)` — delete the sidecar. The
 *     Y-PER-04 DoD pins this exact behaviour ("declining restore deletes
 *     the autosave file").
 *
 * Like autosave (Y-PER-03), the IO surface is structural and injectable.
 * The default resolver feature-detects three preload methods
 * (`probeAutosave`, `readAutosave`, `deleteAutosave`) and falls back to
 * structured "not wired" results until the main-process handlers land in
 * Ibrahim's lane. The renderer never throws on a missing bridge method.
 */

import { migrate } from '@document/migrations'
import type { Document, DocumentVersion } from '@document/types'

import { autosavePathFor } from './autosave'
import { CURRENT_DOCUMENT_VERSION, useDocumentStore } from './documentStore'
import { useHistoryStore } from './historyStore'
import { useSessionStore } from './sessionStore'

/**
 * Result of probing the `.dtw` / `.dtw.autosave` pair on disk.
 *
 *   - `exists: false` → no sidecar present (or the project path itself is
 *     missing). `isNewer` is meaningless and should be ignored.
 *   - `exists: true`, `isNewer: false` → sidecar present but the canonical
 *     `.dtw` has been saved more recently. The sidecar is stale.
 *   - `exists: true`, `isNewer: true` → sidecar present and represents
 *     work past the last `.dtw` save. A crash-recovery candidate.
 */
export interface AutosaveProbe {
  readonly exists: boolean
  readonly isNewer: boolean
}

/** Result of reading the sidecar's raw bytes. Mirrors `openProject`'s IPC shape. */
export interface ReadAutosaveResult {
  readonly success: boolean
  readonly json?: string
  readonly error?: string
}

/** Result of deleting the sidecar. `success: true` includes the "already absent" case. */
export interface DeleteAutosaveResult {
  readonly success: boolean
  readonly error?: string
}

/**
 * Minimal IO surface crash recovery needs. Structural by design so test
 * stubs stay tiny and the store does not depend on the full `ElectronAPI`.
 *
 * All three methods are silent (no dialog) and operate on absolute paths
 * derived from the session's `currentFilePath`. The main-process side is
 * Ibrahim's lane (see `src/main/ipc.ts`); until those handlers land the
 * default resolver returns structured "not wired" results.
 */
export interface RecoveryIO {
  /**
   * Compare the on-disk mtimes of the project file and its sidecar.
   * `exists` reflects only the sidecar — a missing project file with a
   * present sidecar is unusual but should still report `exists: true`
   * so the recovery flow can rescue the work.
   */
  probeAutosave: (projectPath: string) => Promise<AutosaveProbe>
  /** Read the sidecar's JSON payload. */
  readAutosave: (sidecarPath: string) => Promise<ReadAutosaveResult>
  /** Delete the sidecar. Idempotent — already-absent counts as success. */
  deleteAutosave: (sidecarPath: string) => Promise<DeleteAutosaveResult>
}

/**
 * Verdict returned by `checkForCrashRecovery`.
 *
 *   - `'none'` — no actionable sidecar (absent or stale; stale ones are
 *     deleted opportunistically before the verdict is returned).
 *   - `'available'` — a newer sidecar exists, parsed + migrated cleanly.
 *     The UI should prompt the user; `sidecarPath` is supplied so
 *     `declineCrashRecovery` can delete it on a no.
 *   - `'error'` — sidecar exists and is newer but couldn't be brought
 *     into a valid `Document`. `stage` identifies where it failed so the
 *     UI can pick the right messaging (and, optionally, offer to delete
 *     the corrupt sidecar).
 */
export type CrashRecoveryCheck =
  | { readonly kind: 'none' }
  | {
      readonly kind: 'available'
      readonly sidecarPath: string
      readonly document: Document
    }
  | {
      readonly kind: 'error'
      readonly sidecarPath: string
      readonly stage: 'probe' | 'read' | 'parse' | 'migrate'
      readonly message: string
    }

/** Default IO resolver — feature-detects the three preload methods at call time. */
function defaultIO(): RecoveryIO {
  const bridge = window.electronAPI as unknown as {
    probeAutosave?: (projectPath: string) => Promise<AutosaveProbe>
    readAutosave?: (sidecarPath: string) => Promise<ReadAutosaveResult>
    deleteAutosave?: (sidecarPath: string) => Promise<DeleteAutosaveResult>
  }
  return {
    probeAutosave:
      typeof bridge.probeAutosave === 'function'
        ? bridge.probeAutosave.bind(window.electronAPI)
        : async () => ({ exists: false, isNewer: false }),
    readAutosave:
      typeof bridge.readAutosave === 'function'
        ? bridge.readAutosave.bind(window.electronAPI)
        : async () => ({ success: false, error: 'crash-recovery IPC not wired' }),
    deleteAutosave:
      typeof bridge.deleteAutosave === 'function'
        ? bridge.deleteAutosave.bind(window.electronAPI)
        : async () => ({ success: false, error: 'crash-recovery IPC not wired' }),
  }
}

/**
 * Probe disk for a recoverable autosave sidecar next to the given project
 * path. Returns a discriminated verdict; stale sidecars are deleted as a
 * side effect of the `'none'` branch so the prompt does not fire next launch.
 *
 * @param projectPath - Absolute path of the `.dtw` whose sidecar to probe.
 * @param io - Test seam. Production callers omit this; the preload bridge is used.
 */
export async function checkForCrashRecovery(
  projectPath: string,
  io: RecoveryIO = defaultIO()
): Promise<CrashRecoveryCheck> {
  const sidecarPath = autosavePathFor(projectPath)

  let probe: AutosaveProbe
  try {
    probe = await io.probeAutosave(projectPath)
  } catch (err) {
    return {
      kind: 'error',
      sidecarPath,
      stage: 'probe',
      message: err instanceof Error ? err.message : 'Failed to probe autosave sidecar',
    }
  }

  if (!probe.exists) {
    return { kind: 'none' }
  }

  if (!probe.isNewer) {
    // Stale sidecar — the user saved past this checkpoint. Clean up
    // silently so we don't re-probe it on every subsequent launch. Any
    // delete failure here is non-fatal; the verdict is still 'none'.
    await io.deleteAutosave(sidecarPath).catch(() => {
      /* swallow — best-effort cleanup */
    })
    return { kind: 'none' }
  }

  const read = await io.readAutosave(sidecarPath)
  if (!read.success || typeof read.json !== 'string') {
    return {
      kind: 'error',
      sidecarPath,
      stage: 'read',
      message: read.error ?? 'Failed to read autosave sidecar',
    }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(read.json)
  } catch (err) {
    return {
      kind: 'error',
      sidecarPath,
      stage: 'parse',
      message: err instanceof Error ? err.message : 'Malformed autosave JSON',
    }
  }

  // Mirror `openProject`'s migrate-vs-current handling: if the version
  // field is missing or non-string, drop straight into the current-version
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
      sidecarPath,
      stage: 'migrate',
      message: err instanceof Error ? err.message : 'Autosave failed schema validation',
    }
  }

  return { kind: 'available', sidecarPath, document }
}

/**
 * Hydrate the editor stores with a recovered document. Marks the document
 * dirty (the sidecar's content has not been written to the canonical
 * `.dtw` yet) and binds the session to the project path so the next save
 * targets the right file.
 *
 * The sidecar is intentionally **not** deleted on accept: if the user
 * crashes again before saving, the same checkpoint is still on disk. The
 * next successful manual save will leave a fresher `.dtw` beside the now-
 * stale sidecar; the next launch's probe will clean it up as stale.
 *
 * @param document - The recovered document returned by `checkForCrashRecovery`.
 * @param projectPath - Absolute path of the canonical `.dtw` the session
 *   should track. Recorded against `sessionStore.currentFilePath`.
 */
export function acceptCrashRecovery(document: Document, projectPath: string): void {
  useDocumentStore.getState().hydrate(document)
  useDocumentStore.getState().markDirty()
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()
  useSessionStore.getState().setCurrentFilePath(projectPath)
}

/** Outcome of declining a crash recovery. */
export type DeclineCrashRecoveryOutcome =
  | { readonly kind: 'deleted' }
  | { readonly kind: 'error'; readonly message: string }

/**
 * Decline a crash recovery: delete the autosave sidecar so the prompt
 * does not fire again on the next launch. Satisfies the Y-PER-04 DoD
 * ("declining restore deletes the autosave file").
 *
 * @param sidecarPath - Absolute path of the sidecar to delete; obtained
 *   from a prior `checkForCrashRecovery` result.
 * @param io - Test seam. Production callers omit this; the preload
 *   bridge is used.
 */
export async function declineCrashRecovery(
  sidecarPath: string,
  io: RecoveryIO = defaultIO()
): Promise<DeclineCrashRecoveryOutcome> {
  const result = await io.deleteAutosave(sidecarPath)
  if (result.success) {
    return { kind: 'deleted' }
  }
  return { kind: 'error', message: result.error ?? 'Failed to delete autosave sidecar' }
}
