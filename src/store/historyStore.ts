import type { Patch } from 'immer'
import { enablePatches } from 'immer'
import { create } from 'zustand'

// Immer's patch machinery must be opted into. In immer v10+ this is a no-op
// kept for backwards compatibility; calling it here is safe and future-proofs
// against any version bump that re-introduces the gate.
enablePatches()

/**
 * Maximum number of `past` entries retained. Recording a 201st entry evicts
 * the oldest. Section 10.18 (Y-HST-01) fixes this value at 200.
 */
export const HISTORY_CAP = 200

/**
 * Coalescing window for same-label edits (Y-HST-02). A new entry whose
 * `label` matches the top of `past` and whose `timestamp` is within this
 * many milliseconds of the top's `timestamp` is merged into the top entry
 * instead of being pushed as a new one. The window is rolling — it resets
 * to the most recent edit — so typing "hello" at <500 ms/key collapses to
 * a single undo regardless of total duration.
 */
export const COALESCE_WINDOW_MS = 500

/**
 * One undoable change in the document timeline.
 *
 * The `patches` and `inversePatches` arrays come from immer's
 * `produceWithPatches`. The dispatcher (Y-STR-03) is the only producer of
 * entries; consumers should treat instances as opaque and only feed them back
 * into `applyPatches` against the current document.
 */
export interface HistoryEntry {
  /** Forward patches — apply these against the previous state to redo the change. */
  readonly patches: readonly Patch[]
  /** Inverse patches — apply these against the current state to undo the change. */
  readonly inversePatches: readonly Patch[]
  /**
   * Short human-readable label, e.g. `"Update text"` or `"Insert preset hero"`.
   * Used by the Y-HST-02 coalescer to merge same-label edits within 500 ms and
   * by the topbar to surface undo/redo affordances.
   */
  readonly label: string
  /** `Date.now()` at the moment the entry was recorded. */
  readonly timestamp: number
}

interface HistoryState {
  /** Recorded entries, oldest first. The last element is the next candidate for `undo()`. */
  readonly past: readonly HistoryEntry[]
  /** Entries that were undone, oldest first. The last element is the next candidate for `redo()`. */
  readonly future: readonly HistoryEntry[]
}

interface HistoryActions {
  /**
   * Record a new entry on top of `past`. Always clears `future` — recording
   * after an `undo()` branches the timeline, discarding the redo stack.
   *
   * Coalescing (Y-HST-02): when the new entry's `label` matches the top of
   * `past` and its `timestamp` is within {@link COALESCE_WINDOW_MS} of the
   * top's `timestamp`, the two are merged into a single entry (forward
   * patches concatenated chronologically; inverse patches concatenated in
   * reverse so a single `undo` rewinds both edits in the correct order).
   * The merged entry keeps the original label and adopts the newer
   * timestamp so the window rolls with continued activity.
   *
   * When no coalescing applies and the addition would push `past.length`
   * past {@link HISTORY_CAP}, `past[0]` is evicted.
   */
  record: (entry: HistoryEntry) => void
  /**
   * Move the most recent past entry onto the future stack and return it.
   * Returns `null` when there is nothing to undo. The caller is responsible
   * for applying `entry.inversePatches` to the document; the historyStore is
   * intentionally decoupled from the documentStore.
   */
  undo: () => HistoryEntry | null
  /**
   * Move the most recent future entry back onto the past stack and return it.
   * Returns `null` when there is nothing to redo. The caller is responsible
   * for applying `entry.patches` to the document.
   */
  redo: () => HistoryEntry | null
  /** Clear both stacks. Called on `.dtw` load to start a fresh timeline. */
  clear: () => void
  /** True iff `past` is non-empty. */
  canUndo: () => boolean
  /** True iff `future` is non-empty. */
  canRedo: () => boolean
}

export type HistoryStore = HistoryState & HistoryActions

/**
 * Editor undo/redo history.
 *
 * Stores opaque immer-patch entries; does not own the document. Y-STR-03's
 * `dispatch(op)` is the sole producer (`record`), and the topbar undo/redo
 * buttons drive `undo` / `redo` — each callsite is expected to apply the
 * returned entry's patches against the document via immer's `applyPatches`.
 *
 * Satisfies contract C5 (one of three hooks).
 */
export const useHistoryStore = create<HistoryStore>()((set, get) => ({
  past: [],
  future: [],

  record: (entry) =>
    set((state) => {
      const top = state.past[state.past.length - 1]
      if (
        top !== undefined &&
        top.label === entry.label &&
        entry.timestamp - top.timestamp <= COALESCE_WINDOW_MS
      ) {
        // Merge: forward patches in chronological order, inverse patches
        // reversed so applying them rewinds new→old in one step.
        const merged: HistoryEntry = {
          label: top.label,
          timestamp: entry.timestamp,
          patches: [...top.patches, ...entry.patches],
          inversePatches: [...entry.inversePatches, ...top.inversePatches],
        }
        return {
          past: [...state.past.slice(0, -1), merged],
          future: [],
        }
      }
      // Cap the past stack. When adding a new entry would exceed the cap,
      // drop the oldest entry so the newest always lands on top.
      const next =
        state.past.length >= HISTORY_CAP
          ? [...state.past.slice(state.past.length - HISTORY_CAP + 1), entry]
          : [...state.past, entry]
      return { past: next, future: [] }
    }),

  undo: () => {
    const { past, future } = get()
    if (past.length === 0) return null
    const entry = past[past.length - 1]
    set({ past: past.slice(0, -1), future: [...future, entry] })
    return entry
  },

  redo: () => {
    const { past, future } = get()
    if (future.length === 0) return null
    const entry = future[future.length - 1]
    set({ past: [...past, entry], future: future.slice(0, -1) })
    return entry
  },

  clear: () => set({ past: [], future: [] }),

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}))
