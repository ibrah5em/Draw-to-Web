/**
 * Drawn-gesture → document-node helpers.
 *
 * These pure functions bridge a {@link DrawnElementKind} guess and a
 * {@link GridPlacement} to the document model **without** ever introducing a
 * pixel coordinate: they pick the primitive type, the heading tag, decorate
 * containers (section / group / card), and write the grid placement into the
 * element's style slot. The node body is still built by the existing
 * `createPrimitive` factory in the wiring layer, so a drawn element is an
 * ordinary node the moment it is inserted.
 *
 * No store, no React, no DOM imports — importable from any process.
 */

import type { BreakpointKey, ElementNode, ElementType, TextTag } from '../document/types'

import type { DrawnElementKind } from './interpret'
import { gridColumnValue, type GridPlacement } from './snap'

/**
 * Map a drawn kind to the primitive `ElementType` the existing
 * `createPrimitive` factory understands. The three container-shaped kinds
 * (`section` / `group` / `card`) all become containers and are differentiated
 * by {@link decorateDrawnNode}.
 */
export function drawnKindToElementType(kind: DrawnElementKind): ElementType {
  switch (kind) {
    case 'section':
    case 'group':
    case 'card':
      return 'container'
    case 'image':
      return 'image'
    case 'button':
      return 'button'
    case 'list':
      return 'list'
    case 'divider':
      return 'divider'
    case 'heading':
    case 'text':
      return 'text'
  }
}

/**
 * Choose the heading tag for a drawn heading. Uses `<h1>` only when the page
 * has none yet; otherwise `<h2>`, so drawing never creates a second `<h1>` or
 * a heading-level skip — the same accessibility invariants validation and the
 * axe gate enforce (exactly one `<h1>`, no skips).
 *
 * @param pageHasH1 - Whether the document tree already contains an `<h1>`.
 * @returns `'h1'` when the page has no heading-1 yet, otherwise `'h2'`.
 */
export function headingTagFor(pageHasH1: boolean): TextTag {
  return pageHasH1 ? 'h2' : 'h1'
}

/**
 * Apply kind-specific defaults the bare `createPrimitive` factory does not
 * carry: a semantic role + label for sections, a label for groups, and light
 * card styling (raw values via the free-value escape hatch, so no token
 * dependency). All other kinds pass through unchanged. Headings are tagged
 * separately by the caller (it needs the tree to honour the single-`<h1>`
 * rule).
 *
 * @param node - A node built by `createPrimitive`.
 * @param kind - The drawn kind the node represents.
 * @returns A new node with the kind's defaults applied.
 */
export function decorateDrawnNode<T extends ElementNode>(node: T, kind: DrawnElementKind): T {
  if (node.type !== 'container') return node
  switch (kind) {
    case 'section':
      // Sections default to a 12-column grid so anything drawn inside them
      // lands in columns straight away (the layout is empty, so nothing moves).
      return {
        ...node,
        name: 'Section',
        semanticRole: 'section',
        layout: {
          ...node.layout,
          base: {
            ...node.layout.base,
            mode: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
          },
        },
      }
    case 'group':
      return { ...node, name: 'Group' }
    case 'card':
      return {
        ...node,
        name: 'Card',
        style: {
          ...node.style,
          base: {
            ...node.style.base,
            padding: { top: '16px', right: '16px', bottom: '16px', left: '16px' },
            border: { width: '1px', style: 'solid', color: 'rgba(0, 0, 0, 0.12)' },
            borderRadius: { all: '8px' },
          },
        },
      }
    default:
      return node
  }
}

/**
 * Return a copy of `node` with the grid placement written into the given
 * breakpoint's style slot as `StyleBlock.gridColumn`. The `base` slot is
 * always present; narrower breakpoints are created on demand and never
 * overwrite `base` (mirrors the store's per-breakpoint routing rule).
 *
 * This is the single point where a snapped placement becomes model data —
 * a CSS `grid-column` string, never a pixel position.
 *
 * @param node - The freshly built primitive node.
 * @param placement - The snapped grid placement.
 * @param breakpoint - The active breakpoint the placement applies to.
 * @returns A new node with `style[breakpoint].gridColumn` set.
 */
export function withGridPlacement<T extends ElementNode>(
  node: T,
  placement: GridPlacement,
  breakpoint: BreakpointKey
): T {
  const value = gridColumnValue(placement)
  if (breakpoint === 'base') {
    return { ...node, style: { ...node.style, base: { ...node.style.base, gridColumn: value } } }
  }
  return {
    ...node,
    style: {
      ...node.style,
      [breakpoint]: { ...(node.style[breakpoint] ?? {}), gridColumn: value },
    },
  }
}
