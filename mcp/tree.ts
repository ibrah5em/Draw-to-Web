/**
 * Read-only tree helpers shared by the MCP tools.
 *
 * These never mutate — they only inspect the document tree to resolve a
 * parent, look up grid geometry, or check the heading state before a write
 * is dispatched through `applyOperation`.
 */

import type { ContainerNode, ElementId, ElementNode } from '../src/document/types'
import { columnsFromTemplate } from '../src/draw'

/** Find a node by id, or `null` if absent. */
export function findNode(node: ElementNode, id: ElementId): ElementNode | null {
  if (node.id === id) return node
  if (node.type === 'container') {
    for (const child of node.children) {
      const found = findNode(child, id)
      if (found) return found
    }
  }
  return null
}

/** Find the container that directly holds `id`, or `null` (root has no parent). */
export function findParent(node: ElementNode, id: ElementId): ContainerNode | null {
  if (node.type !== 'container') return null
  for (const child of node.children) {
    if (child.id === id) return node
    const found = findParent(child, id)
    if (found) return found
  }
  return null
}

/** Whether the tree already contains an `<h1>` (drives heading-tag choice). */
export function treeHasH1(node: ElementNode): boolean {
  if (node.type === 'text' && node.tag === 'h1') return true
  if (node.type === 'container') return node.children.some(treeHasH1)
  return false
}

/**
 * The column count a container snaps to: its own grid template if gridded,
 * otherwise the 12-column page default. Mirrors the draw feature's geometry
 * so AI-placed and human-drawn elements use the same grid.
 */
export function containerColumns(node: ContainerNode): number {
  if (node.layout.base.mode === 'grid') {
    return columnsFromTemplate(node.layout.base.gridTemplateColumns) ?? 12
  }
  return 12
}
