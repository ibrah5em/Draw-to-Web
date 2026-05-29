import { describe, expect, it, beforeEach } from 'vitest'

import { presetsRegistry, defaultPresetContext } from '@document/presets'
import type { ContainerNode, Document, ElementNode } from '@document/types'
import { dispatch } from '@store/dispatch'
import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
import { buildInsertOp, containerDropId } from '@ui/sidebar/insertDrop'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

function findContainer(node: ElementNode, id: string): ContainerNode | null {
  if (node.id === id && node.type === 'container') return node
  if (node.type === 'container') {
    for (const child of node.children) {
      const found = findContainer(child, id)
      if (found) return found
    }
  }
  return null
}

function hydrateWithGrid(): { document: Document; gridId: string } {
  // Materialize a 3-column grid preset under the portfolio root so we have a
  // real container to drop into. Then hydrate the resulting document.
  const ctx = defaultPresetContext()
  const grid = presetsRegistry['cards-grid-3col']({}, ctx) as ContainerNode
  const rootClone: ContainerNode = {
    ...(PORTFOLIO_DOCUMENT.tree as ContainerNode),
    children: [...(PORTFOLIO_DOCUMENT.tree as ContainerNode).children, grid],
  }
  const document: Document = { ...PORTFOLIO_DOCUMENT, tree: rootClone }
  useDocumentStore.getState().hydrate(document)
  return { document, gridId: grid.id }
}

beforeEach(() => {
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
})

describe('Insert drop end-to-end (L-CAN-12)', () => {
  it('dropping a Card preset into a Grid lands under that grid', () => {
    const { gridId } = hydrateWithGrid()
    const before = findContainer(useDocumentStore.getState().document.tree, gridId)
    if (!before) throw new Error('grid not in tree')
    const initialChildCount = before.children.length

    const op = buildInsertOp('insert:preset:card-basic', containerDropId(gridId), () => 'fresh-id')
    expect(op).not.toBeNull()
    if (!op) return
    dispatch(op)

    const after = findContainer(useDocumentStore.getState().document.tree, gridId)
    if (!after) throw new Error('grid disappeared after drop')
    expect(after.children.length).toBe(initialChildCount + 1)
    const inserted = after.children[after.children.length - 1]
    expect(inserted.type).toBe('container')
    expect(inserted.name).toBe('Card')
  })

  it('dropping a text primitive into a container appends a text node', () => {
    const { gridId } = hydrateWithGrid()
    const op = buildInsertOp('insert:element:text', containerDropId(gridId), () => 'new-text-id')
    expect(op).not.toBeNull()
    if (!op) return
    dispatch(op)

    const after = findContainer(useDocumentStore.getState().document.tree, gridId)
    if (!after) throw new Error('grid disappeared after drop')
    const inserted = after.children[after.children.length - 1]
    expect(inserted.type).toBe('text')
    expect(inserted.id).toBe('new-text-id')
  })
})
