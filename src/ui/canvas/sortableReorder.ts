/**
 * Canvas sortable reorder helpers (L-CAN-13).
 *
 * Pairs with {@link buildInsertOp} (L-CAN-12) — both consume dnd-kit
 * `(active, over)` ids and return a document operation, kept pure for
 * easy unit testing. The dispatcher in `InsertDnd.tsx` decides which
 * helper to run based on the `active.id` shape (Insert cards start with
 * `insert:`; canvas sortable items use the raw element id).
 *
 * Scope: same-parent sibling reorder. Cross-container moves go through
 * the Layers tree (L-LYR-02) until the canvas grows multi-container
 * sortable contexts.
 */

import type { Operation, ReorderOp } from '@document/operations'
import type { ContainerNode, ElementId, ElementNode } from '@document/types'

interface SiblingLocation {
  readonly parent: ContainerNode
  readonly index: number
}

function locate(tree: ElementNode, id: ElementId): SiblingLocation | null {
  if (tree.type !== 'container') return null
  for (let i = 0; i < tree.children.length; i++) {
    if (tree.children[i].id === id) return { parent: tree, index: i }
    const child = tree.children[i]
    if (child.type === 'container') {
      const found = locate(child, id)
      if (found) return found
    }
  }
  return null
}

/**
 * Compute the `reorder` operation for a canvas sortable drag.
 *
 * @param activeId - dnd-kit `active.id` (the dragged element's id).
 * @param overId   - dnd-kit `over.id`   (the element being hovered, if any).
 * @param tree     - current document root used to resolve parents + indices.
 * @returns A reorder op for a same-parent move, or `null` when the drop
 *          should be ignored (no over, same element, different parents,
 *          or the element wasn't found).
 */
export function buildReorderOp(
  activeId: string | number | null | undefined,
  overId: string | number | null | undefined,
  tree: ElementNode
): Operation | null {
  if (typeof activeId !== 'string' || typeof overId !== 'string') return null
  if (activeId === overId) return null
  if (activeId.includes(':') || overId.includes(':')) return null

  const from = locate(tree, activeId)
  const to = locate(tree, overId)
  if (!from || !to) return null
  if (from.parent.id !== to.parent.id) return null

  // dnd-kit reports `over` as the element under the cursor, not the destination
  // slot. When moving forward we land *after* `over`, so its index is the target
  // slot once the active element is removed. When moving backward we land *at*
  // `over`'s index. `applyReorder` removes-then-inserts using the supplied
  // index, so the same calculation works for both directions.
  const targetIndex = to.index
  if (targetIndex === from.index) return null

  const op: ReorderOp = { kind: 'reorder', id: activeId, toIndex: targetIndex }
  return op
}
