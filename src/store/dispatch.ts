/**
 * Operation dispatcher (Y-STR-03).
 *
 * Single entry point for mutating the document and the only legal driver
 * of `useHistoryStore.record`. The mutation flow is:
 *
 *   1. Read the current document from `useDocumentStore`.
 *   2. Run `produceWithPatches(doc, draft => applyOperation(draft, op))`
 *      against C3's operation handler. Immer rolls back automatically if
 *      the handler throws.
 *   3. If the op produced any patches, record `{ patches,
 *      inversePatches, label, timestamp }` to `useHistoryStore` and
 *      commit the new snapshot to `useDocumentStore` (which marks dirty —
 *      satisfies the dispatcher half of Y-PER-06).
 *
 * `undo()` / `redo()` pop the corresponding history entry, apply its
 * patches to the current document, and re-commit. They are exposed as
 * named functions rather than store actions so the topbar (L-TOP-04) and
 * keyboard layer (X-09 / `react-hotkeys-hook`) bind to a single import.
 *
 * The dispatcher knows nothing about UI state. Per-breakpoint and
 * per-state routing (Y-STR-06, Y-STR-07) and preset insertion (Y-STR-04)
 * compose on top by constructing the matching C3 op and handing it to
 * `dispatch`.
 *
 * Satisfies contract C5 (`dispatch` half of the surface).
 */

import { applyPatches, enablePatches, produceWithPatches, type Patch } from 'immer'

import { applyOperation } from '@document/operations'
import type { Operation } from '@document/operations'

import { useDocumentStore } from './documentStore'
import { useHistoryStore } from './historyStore'

// Immer's patch machinery is opted into here for parity with historyStore;
// duplicate calls are safe in immer v10.
enablePatches()

/**
 * Apply an operation to the current document and record the resulting
 * patches to history.
 *
 * Throws if `applyOperation` rejects the op (unknown element id, invalid
 * preset id, root-element delete attempt, etc.). Immer rolls back the
 * draft on throw, so no history entry is recorded and the document
 * stays exactly as it was.
 *
 * No-op writes (the recipe touches nothing immer can observe) are
 * silently dropped — empty patches would clutter the undo stack with
 * indistinguishable entries.
 */
export function dispatch(op: Operation): void {
  const docBefore = useDocumentStore.getState().document
  const [docAfter, patches, inversePatches] = produceWithPatches(docBefore, (draft) => {
    applyOperation(draft, op)
  })
  if (patches.length === 0) {
    return
  }
  useHistoryStore.getState().record({
    patches,
    inversePatches,
    label: labelFor(op),
    timestamp: Date.now(),
  })
  useDocumentStore.getState().commit(docAfter)
}

/**
 * Apply several operations as a SINGLE history entry.
 *
 * Every op runs in order against one `produceWithPatches` draft, so the
 * whole sequence undoes/redoes in one step — the same guarantee preset
 * insertion gives (Y-STR-04). Use this when one user action is only
 * expressible as multiple C3 ops (e.g. convert a parent to a grid *and*
 * insert the child it now holds, or replace a node = delete + re-insert).
 *
 * Behaves like {@link dispatch} otherwise: if any op throws, immer rolls
 * the draft back and nothing is recorded (atomic); an empty net-patch
 * batch is silently dropped. An empty `ops` array is a no-op.
 *
 * @param ops - Operations applied in order against one shared draft.
 * @param label - History label; defaults to each op's label joined by `+`.
 */
export function dispatchBatch(ops: ReadonlyArray<Operation>, label?: string): void {
  if (ops.length === 0) {
    return
  }
  const docBefore = useDocumentStore.getState().document
  const [docAfter, patches, inversePatches] = produceWithPatches(docBefore, (draft) => {
    for (const op of ops) {
      applyOperation(draft, op)
    }
  })
  if (patches.length === 0) {
    return
  }
  useHistoryStore.getState().record({
    patches,
    inversePatches,
    label: label ?? ops.map(labelFor).join(' + '),
    timestamp: Date.now(),
  })
  useDocumentStore.getState().commit(docAfter)
}

/**
 * Revert the most recent dispatched op. Returns `true` when an entry was
 * popped, `false` when the past stack was empty. Marks the document
 * dirty on success — undoing changes the in-memory document away from
 * whatever state was last saved, so the dirty flag must follow.
 */
export function undo(): boolean {
  const entry = useHistoryStore.getState().undo()
  if (entry === null) {
    return false
  }
  const docBefore = useDocumentStore.getState().document
  const docAfter = applyPatches(docBefore, entry.inversePatches as Patch[])
  useDocumentStore.getState().commit(docAfter)
  return true
}

/**
 * Re-apply the most recent undone op. Returns `true` when an entry was
 * popped from `future`, `false` when nothing was available. Marks the
 * document dirty on success.
 */
export function redo(): boolean {
  const entry = useHistoryStore.getState().redo()
  if (entry === null) {
    return false
  }
  const docBefore = useDocumentStore.getState().document
  const docAfter = applyPatches(docBefore, entry.patches as Patch[])
  useDocumentStore.getState().commit(docAfter)
  return true
}

/**
 * Human-readable label attached to each history entry. Two purposes:
 *
 *   - **Topbar (L-TOP-04):** surfaced on the undo/redo affordance ("Undo
 *     Insert preset hero-centered").
 *   - **Coalescer (Y-HST-02):** the historyStore merges sequential
 *     entries within 500 ms when their labels are exactly equal. Labels
 *     therefore embed enough specificity to keep unrelated edits apart
 *     (different element ids → different labels) while staying stable
 *     across continuous typing (same element + same path → same label →
 *     "hello" collapses to one undo).
 */
function labelFor(op: Operation): string {
  switch (op.kind) {
    case 'insertElement':
      return `Insert ${op.node.type}`
    case 'deleteElement':
      return `Delete element ${op.id}`
    case 'reorder':
      return `Reorder element ${op.id}`
    case 'updateNode':
      return `Update ${op.id}.${op.path.join('.')}`
    case 'updateNodeStyle':
      return `Update ${op.id}.style.${op.breakpoint}.${op.path.join('.')}`
    case 'updateNodeState':
      return `Update ${op.id}.states.${op.state}.${op.path.join('.')}`
    case 'wrapInGroup':
      return `Group ${op.ids.length} elements`
    case 'unwrapGroup':
      return `Ungroup ${op.id}`
    case 'addToken':
      return `Add token ${op.category}.${op.definition.id}`
    case 'updateToken':
      return `Update token ${op.category}.${op.id}`
    case 'deleteToken':
      return `Delete token ${op.category}.${op.id}`
    case 'renameToken':
      return `Rename token ${op.category}.${op.oldId} → ${op.newId}`
    case 'insertPreset':
      return `Insert preset ${op.presetId}`
  }
}
