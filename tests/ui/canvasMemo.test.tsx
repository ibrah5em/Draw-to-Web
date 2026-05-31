import { beforeEach, describe, expect, it } from 'vitest'

import type { ContainerNode, Document, TextNode } from '../../src/document/types'
import { CanvasNode, CanvasNodeBoundary } from '../../src/ui/canvas/CanvasNode'
import { dispatch } from '../../src/store/dispatch'
import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import { useHistoryStore } from '../../src/store/historyStore'

const ROOT_ID = 'root----'
const A_ID = 'leaf-a--'
const B_ID = 'leaf-b--'

/** root → [ text A, text B ] — two leaf siblings under one container. */
function twoLeafDocument(): Document {
  const a: TextNode = { id: A_ID, type: 'text', tag: 'p', content: 'A', style: { base: {} } }
  const b: TextNode = { id: B_ID, type: 'text', tag: 'p', content: 'B', style: { base: {} } }
  const root: ContainerNode = {
    id: ROOT_ID,
    type: 'container',
    style: { base: {} },
    layout: { base: { mode: 'flex', direction: 'column' } },
    children: [a, b],
  }
  return { ...createBlankDocument('Memo'), tree: root }
}

const childById = (doc: Document, id: string): TextNode => {
  const root = doc.tree as ContainerNode
  const hit = root.children.find((c) => c.id === id)
  if (!hit || hit.type !== 'text') throw new Error(`missing ${id}`)
  return hit
}

const REACT_MEMO = Symbol.for('react.memo')

beforeEach(() => {
  useDocumentStore.setState({ document: twoLeafDocument(), isDirty: false })
  useHistoryStore.setState({ past: [], future: [] })
})

describe('Y-PRF-01 — canvas leaf nodes are memoised', () => {
  it('CanvasNode and CanvasNodeBoundary are React.memo components', () => {
    // A memo component carries the react.memo type tag; without the memo
    // wrapper a parent re-render walks every descendant unconditionally.
    expect((CanvasNode as unknown as { $$typeof: symbol }).$$typeof).toBe(REACT_MEMO)
    expect((CanvasNodeBoundary as unknown as { $$typeof: symbol }).$$typeof).toBe(REACT_MEMO)
  })

  it('editing one leaf leaves the sibling node reference identical (memo skips it)', () => {
    // memo short-circuits on a shallow `node` prop compare. immer's structural
    // sharing is what makes that effective: mutating leaf A must leave leaf B's
    // ElementNode reference untouched so memo bails out of B's subtree.
    const before = useDocumentStore.getState().document
    const bBefore = childById(before, B_ID)

    dispatch({ kind: 'updateNode', id: A_ID, path: ['content'], value: 'A-edited' })

    const after = useDocumentStore.getState().document
    expect(childById(after, B_ID)).toBe(bBefore) // sibling ref preserved → no re-render
    expect(childById(after, A_ID)).not.toBe(childById(before, A_ID)) // edited ref changed
    expect(childById(after, A_ID).content).toBe('A-edited')
  })
})
