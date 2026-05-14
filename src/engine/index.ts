import type { CanvasElement } from '../store/elementStore'
import { buildContainmentTree, type ContainmentNode } from './buildTree'
import { classifyRectangle } from './classifyPosition'
import { classifyText } from './classifyText'

export type SemanticTag =
  | 'header'
  | 'nav'
  | 'main'
  | 'footer'
  | 'section'
  | 'aside'
  | 'div'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'p'
  | 'img'
  | 'button'

export interface SemanticElement extends CanvasElement {
  semanticTag: SemanticTag
  /** Always an array — empty for leaf nodes, never undefined. Ibrahim's generator relies on this. */
  children: SemanticElement[]
}

/**
 * Returns the id of the rectangle with the lowest bottom edge (y + height),
 * used to identify the footer candidate. Returns null if no rectangles exist.
 */
function findBottomMostRectangleId(elements: CanvasElement[]): string | null {
  let id: string | null = null
  let maxBottom = -Infinity
  for (const el of elements) {
    if (el.type !== 'rectangle') continue
    const bottom = el.y + el.height
    if (bottom > maxBottom) {
      maxBottom = bottom
      id = el.id
    }
  }
  return id
}

function classifyElement(
  el: CanvasElement,
  hasChildren: boolean,
  isBottomMost: boolean
): SemanticTag {
  switch (el.type) {
    case 'image':
      return 'img'
    case 'button':
      return 'button'
    case 'text':
      return classifyText(el.props)
    case 'rectangle':
      return classifyRectangle(el, hasChildren, isBottomMost)
  }
}

function annotateNode(node: ContainmentNode, bottomMostId: string | null): SemanticElement {
  const { element, children } = node
  const annotatedChildren = children.map((child) => annotateNode(child, bottomMostId))
  const semanticTag = classifyElement(element, children.length > 0, element.id === bottomMostId)
  return { ...element, semanticTag, children: annotatedChildren }
}

/**
 * Infers semantic HTML tags from element positions and spatial relationships.
 * Deterministic: identical input always produces identical output.
 *
 * Pipeline:
 *   1. Build containment tree (detects parent–child nesting)
 *   2. Classify each element's semantic tag (position + text heuristics)
 *   3. Return annotated tree in document order (top → bottom, left → right)
 *
 * @param elements - Flat list of canvas elements from the store.
 * @returns Root-level semantic elements with nested children.
 */
export function inferSemantics(elements: CanvasElement[]): SemanticElement[] {
  if (elements.length === 0) return []
  const roots = buildContainmentTree(elements)
  const bottomMostId = findBottomMostRectangleId(elements)
  return roots.map((node) => annotateNode(node, bottomMostId))
}
