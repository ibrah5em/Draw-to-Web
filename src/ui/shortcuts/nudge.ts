/**
 * Arrow-key nudge helper (L-DLG-05).
 *
 * The document model has no absolute positioning (invariant 5.4), so a
 * "nudge" is expressed as a CSS `transform: translate(x, y)` on the
 * element's base style — a valid `StyleBlock.transform` the generator
 * already emits. This module parses the current translate offset, applies a
 * delta, and dispatches an `updateNodeStyle` op so the move is one undoable
 * history entry.
 */

import type { ElementNode } from '@document/types'
import { dispatch } from '@store/dispatch'
import { useDocumentStore } from '@store/documentStore'
import { findElementById } from '@store/selectors'
import { useSessionStore } from '@store/sessionStore'

/** Parse `translate(<x>px, <y>px)` out of a transform string; defaults to 0,0. */
export function parseTranslate(transform: string | undefined): { x: number; y: number } {
  if (!transform) return { x: 0, y: 0 }
  const match = /translate\(\s*(-?\d+(?:\.\d+)?)px\s*,\s*(-?\d+(?:\.\d+)?)px\s*\)/.exec(transform)
  if (!match) return { x: 0, y: 0 }
  return { x: Number(match[1]), y: Number(match[2]) }
}

/** Build the transform string for a translate offset; `none` when at origin. */
export function formatTranslate(x: number, y: number): string {
  if (x === 0 && y === 0) return 'none'
  return `translate(${x}px, ${y}px)`
}

type Axis = 'x' | 'y'

/**
 * Nudge every selected (non-root) element by `amount` pixels along `axis`.
 * Negative amounts move up / left. Returns the number of elements moved.
 */
export function nudgeSelection(axis: Axis, amount: number): number {
  const session = useSessionStore.getState()
  const ids = session.selectedIds
  if (ids.length === 0) return 0
  const tree = useDocumentStore.getState().document.tree
  let moved = 0
  for (const id of ids) {
    if (id === tree.id) continue
    const node: ElementNode | null = findElementById(tree, id)
    if (!node) continue
    const current = parseTranslate(node.style.base.transform)
    const next =
      axis === 'x'
        ? { x: current.x + amount, y: current.y }
        : { x: current.x, y: current.y + amount }
    dispatch({
      kind: 'updateNodeStyle',
      id,
      breakpoint: 'base',
      path: ['transform'],
      value: formatTranslate(next.x, next.y),
    })
    moved += 1
  }
  return moved
}
