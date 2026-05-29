import { describe, expect, it, beforeEach } from 'vitest'

import type { ContainerNode } from '@document/types'
import { dispatch } from '@store/dispatch'
import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
import { buildReorderOp } from '@ui/canvas/sortableReorder'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

function getRoot(): ContainerNode {
  const root = useDocumentStore.getState().document.tree
  if (root.type !== 'container') throw new Error('expected root container')
  return root
}

function getHeader(): ContainerNode {
  const header = getRoot().children.find((child) => child.id === 'header')
  if (!header || header.type !== 'container') throw new Error('expected header container')
  return header
}

beforeEach(() => {
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
  useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT)
})

describe('buildReorderOp (L-CAN-13)', () => {
  it('returns null when active and over are the same element', () => {
    const tree = useDocumentStore.getState().document.tree
    expect(buildReorderOp('title', 'title', tree)).toBeNull()
  })

  it('returns null when either id is not a plain element id', () => {
    const tree = useDocumentStore.getState().document.tree
    expect(buildReorderOp('insert:preset:hero-centered', 'title', tree)).toBeNull()
    expect(buildReorderOp('title', 'drop:container:header', tree)).toBeNull()
  })

  it('returns null when ids belong to different parents', () => {
    const tree = useDocumentStore.getState().document.tree
    expect(buildReorderOp('title', 'footer-text', tree)).toBeNull()
  })

  it('builds a reorder op for same-parent siblings', () => {
    const tree = useDocumentStore.getState().document.tree
    // Header children are [title, cta]; move title past cta.
    const op = buildReorderOp('title', 'cta', tree)
    expect(op).toEqual({ kind: 'reorder', id: 'title', toIndex: 1 })
  })

  it('reorder op dispatches as one history entry (undoable)', () => {
    const before = getHeader().children.map((c) => c.id)
    expect(before).toEqual(['title', 'cta'])

    const op = buildReorderOp('title', 'cta', useDocumentStore.getState().document.tree)
    if (!op) throw new Error('expected reorder op')
    const historyBefore = useHistoryStore.getState().past.length
    dispatch(op)
    const historyAfter = useHistoryStore.getState().past.length
    expect(historyAfter - historyBefore).toBe(1)

    const after = getHeader().children.map((c) => c.id)
    expect(after).toEqual(['cta', 'title'])
  })
})
