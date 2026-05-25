/**
 * Autosave (Y-PER-03).
 *
 * Debounces 5 s after the last edit and writes the current document to a
 * `<project>.dtw.autosave` sidecar next to the saved `.dtw`. Pairs with
 * crash recovery (Y-PER-04): on next launch, if the sidecar is newer than
 * the `.dtw`, the user is offered a restore.
 *
 * Design:
 *
 *   - `radash.debounce({ delay: 5000 }, run)` coalesces a burst of edits
 *     into a single write 5 s after the user stops. At most 5 s of work is
 *     ever unwritten — the Y-PER-03 DoD ("killing the process loses ≤ 5 s").
 *   - The write is gated on `isDirty`: a debounced tick that fires after a
 *     manual save (which clears the flag) is a no-op. This is also why we
 *     never need to cancel the pending tick on save — the guard absorbs it.
 *   - No saved path → skip. A never-saved project has nowhere to put the
 *     sidecar; recovery for unsaved work is out of scope for Y-PER-03.
 *   - **IO is injectable** (same seam pattern as `persistence.ts`). The
 *     default resolver feature-detects `electronAPI.writeAutosave`; until
 *     the main-process silent-write handler lands (C4 / I-ELE-04 territory),
 *     it returns a structured "not wired" result so the renderer degrades
 *     gracefully instead of throwing.
 */

import { useEffect, useRef } from 'react'

import { debounce } from 'radash'

import type { Document } from '@document/types'

import { useDocumentStore } from './documentStore'
import { useSessionStore } from './sessionStore'

/** Debounce window: write 5 s after the last edit. */
export const AUTOSAVE_DELAY_MS = 5000

/** Sidecar suffix appended to the project path. */
export const AUTOSAVE_SUFFIX = '.autosave'

/**
 * Derive the autosave sidecar path for a `.dtw` project path:
 * `/foo/bar.dtw` → `/foo/bar.dtw.autosave`.
 *
 * @param projectPath - Absolute path of the saved `.dtw` file.
 */
export function autosavePathFor(projectPath: string): string {
  return `${projectPath}${AUTOSAVE_SUFFIX}`
}

/** Result of a silent autosave write. Mirrors the save-IPC result shape. */
export interface AutosaveWriteResult {
  readonly success: boolean
  readonly error?: string
}

/**
 * Minimal IO surface autosave needs: a silent (no-dialog) file write.
 * Structural by design, so test stubs stay tiny and store-level code does
 * not depend on the full `ElectronAPI`.
 */
export interface AutosaveIO {
  writeAutosave: (path: string, json: string) => Promise<AutosaveWriteResult>
}

/** Why an autosave tick did not write. Surfaced for tests and diagnostics. */
export type AutosaveSkipReason = 'clean' | 'no-path'

/** Outcome of a single autosave attempt. */
export type AutosaveOutcome =
  | { readonly status: 'written'; readonly path: string }
  | { readonly status: 'skipped'; readonly reason: AutosaveSkipReason }
  | { readonly status: 'failed'; readonly error: string }

/**
 * Default IO resolver. Feature-detects the silent-write handler on the
 * preload bridge and returns a no-op "not wired" writer until it lands, so
 * the renderer never throws on a missing method.
 */
function defaultIO(): AutosaveIO {
  const bridge = window.electronAPI as unknown as {
    writeAutosave?: (path: string, json: string) => Promise<AutosaveWriteResult>
  }
  if (typeof bridge.writeAutosave === 'function') {
    return { writeAutosave: bridge.writeAutosave.bind(window.electronAPI) }
  }
  return {
    writeAutosave: async () => ({ success: false, error: 'autosave IPC not wired' }),
  }
}

/** Config for `createAutosaveController`. Every seam is injectable for tests. */
export interface AutosaveConfig {
  /** Snapshot source — defaults to the live document store. */
  readonly getDocument?: () => Document
  /** Dirty-flag source — defaults to the live document store. */
  readonly getIsDirty?: () => boolean
  /** Target `.dtw` path source — defaults to the live session store. */
  readonly getProjectPath?: () => string | null
  /** Silent-write IO — defaults to the preload bridge. */
  readonly io?: AutosaveIO
  /** Debounce window in ms — defaults to `AUTOSAVE_DELAY_MS`. */
  readonly delayMs?: number
}

/** A live autosave controller. */
export interface AutosaveController {
  /** Schedule a debounced autosave. Call after every committed edit. */
  schedule: () => void
  /** Force an immediate write, bypassing the debounce. Returns the outcome. */
  flush: () => Promise<AutosaveOutcome>
  /** Tear down: cancel any pending tick. The controller is dead afterwards. */
  cancel: () => void
}

/**
 * Build an autosave controller. The controller debounces edits and writes a
 * `<project>.dtw.autosave` sidecar via the injected (or default) IO.
 *
 * @param config - Test seams; production callers pass nothing.
 */
export function createAutosaveController(config: AutosaveConfig = {}): AutosaveController {
  const getDocument = config.getDocument ?? ((): Document => useDocumentStore.getState().document)
  const getIsDirty = config.getIsDirty ?? ((): boolean => useDocumentStore.getState().isDirty)
  const getProjectPath =
    config.getProjectPath ?? ((): string | null => useSessionStore.getState().currentFilePath)
  const io = config.io ?? defaultIO()
  const delay = config.delayMs ?? AUTOSAVE_DELAY_MS

  /** Perform one write attempt. Guards on dirty + path before touching IO. */
  const run = async (): Promise<AutosaveOutcome> => {
    if (!getIsDirty()) {
      return { status: 'skipped', reason: 'clean' }
    }
    const projectPath = getProjectPath()
    if (projectPath === null || projectPath === '') {
      return { status: 'skipped', reason: 'no-path' }
    }
    const target = autosavePathFor(projectPath)
    const json = JSON.stringify(getDocument())
    const result = await io.writeAutosave(target, json)
    return result.success
      ? { status: 'written', path: target }
      : { status: 'failed', error: result.error ?? 'autosave write failed' }
  }

  // radash debounce coalesces a burst of `schedule()` calls into one `run`.
  // Note: radash's `cancel()` permanently disables debouncing, so we only
  // call it on teardown (the controller is discarded afterwards).
  const debounced = debounce({ delay }, () => {
    void run()
  })

  return {
    schedule: (): void => debounced(),
    flush: (): Promise<AutosaveOutcome> => run(),
    cancel: (): void => debounced.cancel(),
  }
}

/**
 * React hook that keeps a live autosave controller wired to the document
 * store for the lifetime of the mounting component. Mount it once near the
 * editor root: every committed document change schedules a debounced write,
 * and the controller is torn down on unmount.
 *
 * The dirty / path guards inside the controller decide whether a scheduled
 * tick actually writes, so subscribing to the whole store (rather than a
 * narrow slice) is intentional and cheap.
 *
 * @param config - Test seams; production callers pass nothing.
 */
export function useAutosave(config: AutosaveConfig = {}): void {
  const controllerRef = useRef<AutosaveController>()
  if (controllerRef.current === undefined) {
    controllerRef.current = createAutosaveController(config)
  }

  useEffect(() => {
    const controller = controllerRef.current
    if (controller === undefined) {
      return
    }
    const unsubscribe = useDocumentStore.subscribe(() => controller.schedule())
    return () => {
      unsubscribe()
      controller.cancel()
    }
    // Mount once: the effect closes only over a ref and a module-level store
    // import, so the empty dependency list is exhaustive.
  }, [])
}
