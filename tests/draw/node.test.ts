/**
 * Drawn-node helpers — kind→type mapping, container decoration, heading-tag
 * selection, and grid-placement application. Pure; no store, no DOM.
 */

import { describe, expect, it } from 'vitest'

import {
  decorateDrawnNode,
  drawnKindToElementType,
  headingTagFor,
  withGridPlacement,
} from '@draw/node'
import type { DrawnElementKind } from '@draw/interpret'
import type { ContainerNode, ElementType, ImageNode } from '@document/types'

const container = (): ContainerNode => ({
  id: 'c1',
  type: 'container',
  layout: { base: { mode: 'flex', direction: 'column' } },
  style: { base: {} },
  children: [],
})

describe('drawnKindToElementType', () => {
  it('maps every drawn kind to a primitive element type', () => {
    const expected: Record<DrawnElementKind, ElementType> = {
      section: 'container',
      group: 'container',
      card: 'container',
      heading: 'text',
      text: 'text',
      image: 'image',
      button: 'button',
      list: 'list',
      divider: 'divider',
    }
    for (const [kind, type] of Object.entries(expected)) {
      expect(drawnKindToElementType(kind as DrawnElementKind)).toBe(type)
    }
  })
})

describe('decorateDrawnNode', () => {
  it('tags a section with its semantic role and label', () => {
    const node = decorateDrawnNode(container(), 'section')
    expect(node.semanticRole).toBe('section')
    expect(node.name).toBe('Section')
  })

  it('labels a group without forcing a semantic role', () => {
    const node = decorateDrawnNode(container(), 'group')
    expect(node.name).toBe('Group')
    expect(node.semanticRole).toBeUndefined()
  })

  it('gives a card raw-value styling (no token dependency)', () => {
    const node = decorateDrawnNode(container(), 'card')
    expect(node.name).toBe('Card')
    expect(node.style.base.border?.style).toBe('solid')
    expect(node.style.base.borderRadius?.all).toBe('8px')
    expect(node.style.base.padding?.top).toBe('16px')
  })

  it('leaves non-container nodes untouched', () => {
    const img: ImageNode = { id: 'i1', type: 'image', alt: '', style: { base: {} } }
    expect(decorateDrawnNode(img, 'image')).toBe(img)
  })
})

describe('headingTagFor', () => {
  it('uses h1 only when the page has none, else h2', () => {
    expect(headingTagFor(false)).toBe('h1')
    expect(headingTagFor(true)).toBe('h2')
  })
})

describe('withGridPlacement', () => {
  it('writes the grid-column shorthand into the base slot', () => {
    const node = withGridPlacement(
      container(),
      { columnStart: 3, columnSpan: 4, insertionIndex: 0 },
      'base'
    )
    expect(node.style.base.gridColumn).toBe('3 / span 4')
  })

  it('routes a non-base breakpoint into its own slot without touching base', () => {
    const node = withGridPlacement(
      container(),
      { columnStart: 1, columnSpan: 2, insertionIndex: 0 },
      'mobile'
    )
    expect(node.style.mobile?.gridColumn).toBe('1 / span 2')
    expect(node.style.base.gridColumn).toBeUndefined()
  })
})
