/**
 * Draw-to-create integration — a drawn rectangle becomes an ordinary tree
 * mutation through the EXISTING `insertElement` operation.
 *
 * This exercises the full gesture pipeline the canvas runs on pointer-release,
 * but with the pixel→fraction normalisation already done (that part is pure DOM
 * measurement in the UI): interpret the shape → snap to the grid → build the
 * node with the existing `createPrimitive` factory → apply the grid placement
 * → `dispatch` an `insertElement` op. It asserts the store ends up with a real,
 * grid-placed node at the right index — and that undo removes it in one step.
 *
 * It reuses the real store + operation path (`dispatch`, `useDocumentStore`,
 * `createBlankDocument`) and the real insert-node factory (`createPrimitive`),
 * never a parallel implementation.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import type { ContainerNode, Document, ElementNode, TextNode } from '../../src/document/types'
import type { InsertElementOp } from '../../src/document/operations'
import { dispatch, undo } from '../../src/store/dispatch'
import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import { useHistoryStore } from '../../src/store/historyStore'
import { createPrimitive } from '../../src/ui/sidebar/insertDrop'
import {
  drawnKindToElementType,
  headingTagFor,
  interpretRectangle,
  snapToGrid,
  withGridPlacement,
  type GridConfig,
  type NormalizedRect,
  type RectangleShape,
} from '../../src/draw'

const ROOT_ID = 'root-id-'

/** A two-section page so insertion indexes and sibling order are observable. */
function buildFixtureDocument(): Document {
  const heading: TextNode = {
    id: 'h1------',
    type: 'text',
    tag: 'h1',
    content: 'Hello',
    style: { base: {} },
  }
  const para: TextNode = {
    id: 'para----',
    type: 'text',
    tag: 'p',
    content: 'World',
    style: { base: {} },
  }
  const root: ContainerNode = {
    id: ROOT_ID,
    type: 'container',
    style: { base: {} },
    layout: { base: { mode: 'flex', direction: 'column' } },
    children: [heading, para],
  }
  return { ...createBlankDocument('Draw fixture'), tree: root }
}

beforeEach(() => {
  useDocumentStore.setState({ document: buildFixtureDocument(), isDirty: false })
  useHistoryStore.setState({ past: [], future: [] })
})

/** Whether the current document tree contains an `<h1>` (for heading-tag choice). */
function pageHasH1(node: ElementNode): boolean {
  if (node.type === 'text' && node.tag === 'h1') return true
  if (node.type === 'container') return node.children.some(pageHasH1)
  return false
}

/**
 * Run the canvas's on-release pipeline as a pure function: shape + bounds →
 * dispatched `insertElement`. Mirrors exactly what `Canvas` does, minus the
 * DOM measurement that produces `shape` / `bounds`.
 */
function drawAndInsert(
  shape: RectangleShape,
  bounds: NormalizedRect,
  gridConfig: GridConfig,
  id: string
): void {
  const { best } = interpretRectangle(shape)
  const placement = snapToGrid(bounds, gridConfig, 'base')

  let node = createPrimitive(drawnKindToElementType(best), id)
  if (best === 'heading' && node.type === 'text') {
    const hasH1 = pageHasH1(useDocumentStore.getState().document.tree)
    node = { ...node, tag: headingTagFor(hasH1) }
  }
  node = withGridPlacement(node, placement, 'base')

  const op: InsertElementOp = { kind: 'insertElement', parentId: ROOT_ID, node }
  // The op carries the snapped index; appended when omitted.
  dispatch({ ...op, index: placement.insertionIndex })
}

const root = (): ContainerNode => useDocumentStore.getState().document.tree as ContainerNode

describe('draw-to-create — tree mutation via insertElement', () => {
  it('inserts a real grid-placed image node at the snapped index', () => {
    // A roughly-square box drawn in the right half, between the two sections.
    drawAndInsert(
      { aspectRatio: 1, widthFraction: 0.5, heightFraction: 0.4 },
      { x: 0.5, y: 0.4, width: 0.5, height: 0.3 },
      { columns: { base: 12, tablet: 12, mobile: 12, small: 12 }, siblingCenters: [0.2, 0.8] },
      'drawn-01'
    )

    const children = root().children
    expect(children).toHaveLength(3)
    // centre 0.55 sits above sibling 0.8 only → index 1 (between the two).
    const inserted = children[1]!
    expect(inserted.id).toBe('drawn-01')
    expect(inserted.type).toBe('image')
    expect(inserted.style.base.gridColumn).toBe('7 / span 6')
  })

  it('places a drawn heading as <h2> because the page already has an <h1>', () => {
    drawAndInsert(
      { aspectRatio: 6, widthFraction: 0.6, heightFraction: 0.06 },
      { x: 0, y: 0, width: 0.6, height: 0.06 },
      { columns: { base: 12, tablet: 12, mobile: 12, small: 12 }, siblingCenters: [0.3, 0.7] },
      'drawn-h-'
    )

    const inserted = root().children[0]! // drawn at the very top → index 0
    expect(inserted.id).toBe('drawn-h-')
    expect(inserted.type).toBe('text')
    expect((inserted as TextNode).tag).toBe('h2')
    // Single-<h1> invariant preserved: still exactly one h1 in the tree.
    const headingCount = root().children.filter((c) => c.type === 'text' && c.tag === 'h1').length
    expect(headingCount).toBe(1)
  })

  it('records exactly one history entry and undo removes the drawn node', () => {
    drawAndInsert(
      { aspectRatio: 1, widthFraction: 0.5, heightFraction: 0.4 },
      { x: 0, y: 0.9, width: 0.5, height: 0.2 },
      { columns: { base: 12, tablet: 12, mobile: 12, small: 12 }, siblingCenters: [0.2, 0.5] },
      'drawn-02'
    )

    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(root().children).toHaveLength(3)

    expect(undo()).toBe(true)
    expect(root().children).toHaveLength(2)
    expect(root().children.some((c) => c.id === 'drawn-02')).toBe(false)
  })

  it('never writes a pixel coordinate into the model — only a grid-column string', () => {
    drawAndInsert(
      { aspectRatio: 1, widthFraction: 0.5, heightFraction: 0.4 },
      { x: 0.25, y: 0, width: 0.5, height: 0.3 },
      { columns: { base: 12, tablet: 12, mobile: 12, small: 12 }, siblingCenters: [] },
      'drawn-03'
    )
    const inserted = root().children.find((c) => c.id === 'drawn-03')!
    const serialized = JSON.stringify(inserted)
    // Placement is expressed as a grid-column shorthand, never absolute
    // positioning or x/y pixel offsets (dimensions like maxWidth may use px).
    expect(inserted.style.base.gridColumn).toMatch(/^\d+ \/ span \d+$/)
    expect(serialized).not.toMatch(/position.*absolute/)
    expect(serialized).not.toContain('"top"')
    expect(serialized).not.toContain('"left"')
    expect(serialized).not.toContain('"zIndex"')
  })
})
