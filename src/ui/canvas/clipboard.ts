/**
 * Canvas clipboard + structural edits for the keyboard layer (L-DLG-05).
 *
 * Copy / paste / duplicate / group / ungroup / select-all / z-order, each
 * expressed as document operations dispatched through the C3 dispatcher so
 * every action is one undoable history entry. The clipboard itself is a
 * module-level buffer (not the OS clipboard) holding a deep clone of the
 * copied subtree; paste re-clones with fresh ids so repeated pastes never
 * collide (the duplicate-id validation rule, I-DOC-05).
 *
 * All helpers are pure with respect to React — they read the stores via
 * `getState()` and dispatch — so the hook in `useEditorShortcuts` is a thin
 * binding layer and these stay unit-testable without a DOM.
 */

import { nanoid } from 'nanoid'

import type { ContainerNode, ElementId, ElementNode } from '@document/types'
import { dispatch } from '@store/dispatch'
import { useDocumentStore } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'

/** Module-level copy buffer; holds the last copied subtree (already id-stripped on use). */
let buffer: ElementNode | null = null

/**
 * Deep-clone a node, assigning a fresh `nanoid` to every element in the
 * subtree. Used on both copy-out and paste-in so the buffered node and each
 * pasted instance carry independent ids.
 */
export function cloneWithNewIds(node: ElementNode): ElementNode {
  const next: ElementNode = { ...node, id: nanoid(8) }
  if (next.type === 'container') {
    return {
      ...next,
      children: (node as ContainerNode).children.map(cloneWithNewIds),
    }
  }
  return next
}

/** Depth-first search for a node and its parent container. */
function locate(
  root: ElementNode,
  id: ElementId,
  parent: ContainerNode | null = null
): { node: ElementNode; parent: ContainerNode | null; index: number } | null {
  if (root.id === id) return { node: root, parent, index: -1 }
  if (root.type !== 'container') return null
  for (let i = 0; i < root.children.length; i += 1) {
    const child = root.children[i]!
    if (child.id === id) return { node: child, parent: root, index: i }
    const deeper = locate(child, id, root)
    if (deeper) return deeper
  }
  return null
}

/** The first selected node's location, or `null` when nothing is selected. */
function firstSelectedLocation(): {
  node: ElementNode
  parent: ContainerNode | null
  index: number
} | null {
  const ids = useSessionStore.getState().selectedIds
  if (ids.length === 0) return null
  const tree = useDocumentStore.getState().document.tree
  return locate(tree, ids[0]!)
}

/** Copy the first selected element's subtree into the buffer. No-op if nothing is selected. */
export function copySelection(): boolean {
  const found = firstSelectedLocation()
  if (!found) return false
  buffer = cloneWithNewIds(found.node)
  return true
}

/**
 * Paste the buffered subtree. The destination is the selected container if
 * one is selected, otherwise the parent of the current selection, otherwise
 * the root. A fresh clone is inserted so repeat pastes stay id-unique, and
 * the new element becomes the selection.
 */
export function pasteClipboard(): boolean {
  if (buffer === null) return false
  const tree = useDocumentStore.getState().document.tree
  const selected = firstSelectedLocation()

  let parentId: ElementId
  if (selected && selected.node.type === 'container') {
    parentId = selected.node.id
  } else if (selected && selected.parent) {
    parentId = selected.parent.id
  } else {
    parentId = tree.id
  }

  const clone = cloneWithNewIds(buffer)
  dispatch({ kind: 'insertElement', parentId, node: clone })
  useSessionStore.getState().setSelectedIds([clone.id])
  return true
}

/**
 * Duplicate every selected element in place — each clone is appended to its
 * own parent and the clones become the new selection. One history entry per
 * element (matching the existing multi-delete behaviour). The root is
 * skipped (it has no parent to receive a sibling).
 */
export function duplicateSelection(): number {
  const ids = useSessionStore.getState().selectedIds
  if (ids.length === 0) return 0
  const tree = useDocumentStore.getState().document.tree
  const clones: ElementId[] = []
  for (const id of ids) {
    const found = locate(tree, id)
    if (!found || found.parent === null) continue
    const clone = cloneWithNewIds(found.node)
    dispatch({
      kind: 'insertElement',
      parentId: found.parent.id,
      node: clone,
      index: found.index + 1,
    })
    clones.push(clone.id)
  }
  if (clones.length > 0) useSessionStore.getState().setSelectedIds(clones)
  return clones.length
}

/**
 * Select every sibling in the current selection's parent ("select all in
 * current section", L-DLG-05). With nothing selected, selects the root's
 * direct children.
 */
export function selectAllSiblings(): void {
  const tree = useDocumentStore.getState().document.tree
  const selected = firstSelectedLocation()
  const container =
    selected && selected.parent ? selected.parent : tree.type === 'container' ? tree : null
  if (!container) return
  useSessionStore.getState().setSelectedIds(container.children.map((c) => c.id))
}

/**
 * Wrap the selected elements (which must share a parent) in a new container
 * — Ctrl+G. The C3 `wrapInGroup` op enforces the shared-parent rule and
 * records a single history entry.
 */
export function groupSelection(): boolean {
  const ids = useSessionStore.getState().selectedIds
  if (ids.length < 1) return false
  const container: ContainerNode = {
    id: nanoid(8),
    type: 'container',
    name: 'Group',
    style: { base: {} },
    layout: { base: { mode: 'flex', direction: 'column' } },
    children: [],
  }
  try {
    dispatch({ kind: 'wrapInGroup', ids, container })
    useSessionStore.getState().setSelectedIds([container.id])
    return true
  } catch {
    // Mixed parents / root in selection — wrapInGroup rejects it. Leave the
    // selection untouched so the user can fix it.
    return false
  }
}

/** Ungroup the selected container — Ctrl+Shift+G. No-op unless exactly one container is selected. */
export function ungroupSelection(): boolean {
  const ids = useSessionStore.getState().selectedIds
  if (ids.length !== 1) return false
  const found = locate(useDocumentStore.getState().document.tree, ids[0]!)
  if (!found || found.node.type !== 'container' || found.parent === null) return false
  try {
    dispatch({ kind: 'unwrapGroup', id: ids[0]! })
    useSessionStore.getState().clearSelection()
    return true
  } catch {
    return false
  }
}

/**
 * Shift the first selected element within its parent: `+1` brings it
 * forward (later in source order), `-1` sends it back. Maps the `]` / `[`
 * shortcuts to a `reorder` op. No-op at the ends of the list or on the root.
 */
export function moveZOrder(delta: 1 | -1): boolean {
  const found = firstSelectedLocation()
  if (!found || found.parent === null) return false
  const target = found.index + delta
  if (target < 0 || target >= found.parent.children.length) return false
  dispatch({ kind: 'reorder', id: found.node.id, toIndex: target })
  return true
}
