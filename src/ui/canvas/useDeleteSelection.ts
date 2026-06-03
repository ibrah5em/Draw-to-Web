/**
 * Delete / Backspace shortcut wiring (extracted from L-DLG-05 keyboard map).
 *
 * Removes every currently-selected element through the document-store
 * dispatcher so undo restores them in one history entry per element. The
 * root container is excluded — `applyDeleteElement` throws on it and we
 * never want to nuke the page itself by accident.
 */

import { useHotkeys } from 'react-hotkeys-hook'

import { dispatch } from '@store/dispatch'
import { useDocumentStore } from '@store/documentStore'
import { useSessionStore } from '@store/sessionStore'
import type { ElementNode } from '@document/types'

/**
 * Reduce a selection to its top-level members — drop any id whose ancestor is
 * also selected. Deleting the ancestor removes the descendant's subtree, so a
 * follow-up `deleteElement` for it would throw (the node is already gone).
 * Returns the survivors in document order.
 */
function topLevelSelection(tree: ElementNode, selected: ReadonlySet<string>): string[] {
  const out: string[] = []
  const walk = (node: ElementNode, ancestorSelected: boolean): void => {
    const isSelected = selected.has(node.id)
    if (isSelected && !ancestorSelected) out.push(node.id)
    if (node.type === 'container') {
      for (const child of node.children) walk(child, ancestorSelected || isSelected)
    }
  }
  walk(tree, false)
  return out
}

/**
 * Delete every currently-selected element. Ids nested inside another selected
 * element are skipped (the ancestor's deletion already removes them, and a
 * second delete would throw); the root container is skipped (the underlying op
 * throws on it). The selection is cleared after the dispatches so the
 * Properties / Layers panels don't show stale ids.
 *
 * Returns the number of nodes actually removed (handy for tests).
 */
export function deleteSelected(): number {
  const session = useSessionStore.getState()
  const ids = session.selectedIds
  if (ids.length === 0) return 0
  const tree = useDocumentStore.getState().document.tree
  const rootId = tree.id
  let removed = 0
  for (const id of topLevelSelection(tree, new Set(ids))) {
    if (id === rootId) continue
    dispatch({ kind: 'deleteElement', id })
    removed++
  }
  session.clearSelection()
  return removed
}

function shouldSkip(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  if (!target) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return true
  return target.isContentEditable === true
}

/**
 * Binds Delete and Backspace to {@link deleteSelected}. Intended to be
 * mounted once at the editor shell level.
 */
export function useDeleteSelection(): void {
  useHotkeys(
    'delete, backspace',
    (event) => {
      if (shouldSkip(event)) return
      event.preventDefault()
      deleteSelected()
    },
    { enableOnFormTags: false, enableOnContentEditable: false }
  )
}

/** Binds Ctrl+Shift+P to open the Live Preview window. */
export function useLivePreviewShortcut(open: () => void): void {
  useHotkeys(
    'ctrl+shift+p, meta+shift+p',
    (event) => {
      event.preventDefault()
      open()
    },
    { preventDefault: true }
  )
}
