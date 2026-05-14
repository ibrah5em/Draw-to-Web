import type { CanvasElement } from '../store/elementStore'

/** Intermediate node used to represent the containment hierarchy before semantic tagging. */
export interface ContainmentNode {
  element: CanvasElement
  children: ContainmentNode[]
}

/**
 * Returns true if `parent` fully contains `child` in both axes.
 * Uses grid columns for X and pixels for Y — each axis is self-consistent.
 */
function contains(parent: CanvasElement, child: CanvasElement): boolean {
  if (parent.id === child.id) return false
  return (
    parent.x <= child.x &&
    parent.x + parent.width >= child.x + child.width &&
    parent.y <= child.y &&
    parent.y + parent.height >= child.y + child.height
  )
}

/** Sorts elements top-to-bottom, then left-to-right for document order. */
function byPosition(a: CanvasElement, b: CanvasElement): number {
  if (a.y !== b.y) return a.y - b.y
  return a.x - b.x
}

/**
 * Builds a containment tree from a flat list of canvas elements.
 *
 * Each element is assigned to the smallest (by area) container that fully
 * encloses it. Elements with no container are returned as root nodes.
 * Children within each node are sorted in document order (top → bottom, left → right).
 *
 * @param elements - Flat list of canvas elements from the store.
 * @returns Root-level containment nodes with nested children.
 */
export function buildContainmentTree(elements: CanvasElement[]): ContainmentNode[] {
  if (elements.length === 0) return []

  // For each element find its direct parent: the smallest container that encloses it.
  const directParentId = new Map<string, string | null>()

  for (const child of elements) {
    let bestParent: CanvasElement | null = null
    let bestArea = Infinity

    for (const candidate of elements) {
      if (!contains(candidate, child)) continue
      const area = candidate.width * candidate.height
      if (area < bestArea) {
        bestArea = area
        bestParent = candidate
      }
    }

    directParentId.set(child.id, bestParent?.id ?? null)
  }

  // Group children by parent id (null = root).
  const childrenOf = new Map<string | null, CanvasElement[]>()
  childrenOf.set(null, [])

  for (const el of elements) {
    const pid = directParentId.get(el.id) ?? null
    if (!childrenOf.has(pid)) childrenOf.set(pid, [])
    childrenOf.get(pid)!.push(el)
  }

  // Sort each group in document order.
  for (const group of childrenOf.values()) {
    group.sort(byPosition)
  }

  // Recursively build nodes.
  function buildNode(el: CanvasElement): ContainmentNode {
    const childEls = childrenOf.get(el.id) ?? []
    return { element: el, children: childEls.map(buildNode) }
  }

  return (childrenOf.get(null) ?? []).map(buildNode)
}
