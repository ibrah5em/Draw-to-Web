/**
 * Build an `ElementNode` from MCP tool input by REUSING the existing factory
 * and helpers — `createPrimitive` (the same factory the toolbar and the draw
 * feature use), plus `@draw`'s `decorateDrawnNode` / `headingTagFor` /
 * `withGridPlacement`. The MCP server never hand-rolls a node shape.
 *
 * Grid placement is expressed only as a `grid-column` string via
 * `withGridPlacement`; no pixel coordinates ever enter the node.
 */

import { nanoid } from 'nanoid'

import {
  decorateDrawnNode,
  drawnKindToElementType,
  headingTagFor,
  withGridPlacement,
  type DrawnElementKind,
} from '../src/draw'
import { createPrimitive } from '../src/ui/sidebar/insertDrop'
import type { BreakpointKey, ElementNode, ElementType, TextTag } from '../src/document/types'

import type { McpElementType } from './vocabulary'

/** The MCP element types that route through the `@draw` decorations. */
const DRAWN_KINDS: ReadonlySet<string> = new Set<DrawnElementKind>([
  'section',
  'group',
  'card',
  'heading',
  'text',
  'image',
  'button',
  'list',
  'divider',
])

/** Optional content/props an agent can set when creating an element. */
export interface NodeProps {
  readonly text?: string
  readonly tag?: TextTag
  readonly alt?: string
  readonly href?: string
  readonly iconName?: string
  readonly items?: ReadonlyArray<string>
  readonly name?: string
  readonly gridColumnStart?: number
  readonly gridColumnSpan?: number
}

/** A resolved grid placement problem, ready to surface as a structured error. */
export interface GridError {
  readonly message: string
  readonly fix: string
}

/**
 * Validate a 1-based grid placement against a container's column count.
 * Returns `null` when the placement fits (or none was requested).
 *
 * @param start - 1-based column start line.
 * @param span - Number of columns to occupy.
 * @param columns - The target container's column count.
 */
export function validateGridPlacement(
  start: number | undefined,
  span: number | undefined,
  columns: number
): GridError | null {
  if (start === undefined && span === undefined) return null
  const s = start ?? 1
  const sp = span ?? 1
  if (!Number.isInteger(s) || !Number.isInteger(sp) || s < 1 || sp < 1) {
    return {
      message: `Invalid grid placement (start ${s}, span ${sp}).`,
      fix: `Use integer start ≥ 1 and span ≥ 1 within a ${columns}-column grid.`,
    }
  }
  if (s + sp - 1 > columns) {
    return {
      message: `Grid span does not fit: column ${s} + span ${sp} exceeds the ${columns}-column grid.`,
      fix: `Reduce the span to ≤ ${columns - s + 1}, or start at an earlier column.`,
    }
  }
  return null
}

/** Resolve the MCP type to a document `ElementType`. */
function resolveElementType(type: McpElementType): ElementType {
  if (DRAWN_KINDS.has(type)) return drawnKindToElementType(type as DrawnElementKind)
  return type as ElementType // 'container' | 'link' | 'icon'
}

/** Apply content/props to a freshly created primitive, with type narrowing. */
function applyProps(
  node: ElementNode,
  type: McpElementType,
  props: NodeProps,
  pageHasH1: boolean
): ElementNode {
  let next: ElementNode = node
  switch (next.type) {
    case 'text':
      next = {
        ...next,
        content: props.text ?? next.content,
        tag: type === 'heading' ? (props.tag ?? headingTagFor(pageHasH1)) : (props.tag ?? next.tag),
      }
      break
    case 'button':
      next = { ...next, content: props.text ?? next.content }
      break
    case 'link':
      next = { ...next, content: props.text ?? next.content, href: props.href ?? next.href }
      break
    case 'image':
      next = { ...next, alt: props.alt ?? next.alt }
      break
    case 'icon':
      next = { ...next, name: props.iconName ?? next.name }
      break
    case 'list':
      next = { ...next, items: props.items ? [...props.items] : next.items }
      break
    case 'container':
      break
  }
  if (props.name !== undefined) next = { ...next, name: props.name }
  return next
}

/**
 * Build the node an `insertElement` op will carry. Reuses `createPrimitive`
 * for the base shape, `decorateDrawnNode` for section/group/card defaults,
 * and `withGridPlacement` for the grid-column string.
 *
 * @param type - MCP element type.
 * @param props - Optional content + grid placement.
 * @param ctx - Page heading state + active breakpoint for placement routing.
 * @returns The constructed `ElementNode` (with a fresh id).
 */
export function buildNode(
  type: McpElementType,
  props: NodeProps,
  ctx: { readonly pageHasH1: boolean; readonly breakpoint: BreakpointKey }
): ElementNode {
  const elementType = resolveElementType(type)
  let node = createPrimitive(elementType, nanoid(8))

  // Section / group / card decorations (semantic role, grid layout, styling).
  if (type === 'section' || type === 'group' || type === 'card') {
    node = decorateDrawnNode(node, type)
  }

  node = applyProps(node, type, props, ctx.pageHasH1)

  if (props.gridColumnStart !== undefined || props.gridColumnSpan !== undefined) {
    node = withGridPlacement(
      node,
      {
        columnStart: props.gridColumnStart ?? 1,
        columnSpan: props.gridColumnSpan ?? 1,
        insertionIndex: 0,
      },
      ctx.breakpoint
    )
  }

  return node
}
