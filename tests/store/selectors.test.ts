import { beforeEach, describe, expect, it } from 'vitest'

import type { AddTokenOp, UpdateNodeOp } from '../../src/document/operations'
import type { ContainerNode, Document, TextNode } from '../../src/document/types'
import { dispatch } from '../../src/store/dispatch'
import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import { useHistoryStore } from '../../src/store/historyStore'
import { findElementById } from '../../src/store/selectors'

const ROOT_ID = 'root-id-'
const BOX_ID = 'box-id--'
const TEXT_HEADING_ID = 'text-h1-'
const TEXT_PARA_ID = 'text-p--'

/** Same shape as the Y-STR-03 fixture so the round-trip tests share a topology. */
function buildFixtureDocument(): Document {
  const heading: TextNode = {
    id: TEXT_HEADING_ID,
    type: 'text',
    tag: 'h1',
    content: 'Hello',
    style: { base: {} },
  }
  const box: ContainerNode = {
    id: BOX_ID,
    type: 'container',
    style: { base: {} },
    layout: { base: { mode: 'flex', direction: 'column' } },
    children: [heading],
  }
  const para: TextNode = {
    id: TEXT_PARA_ID,
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
    children: [box, para],
  }
  const base = createBlankDocument('Selectors fixture')
  return { ...base, tree: root }
}

const reset = (): void => {
  useDocumentStore.setState({ document: buildFixtureDocument(), isDirty: false })
  useHistoryStore.setState({ past: [], future: [] })
}

/**
 * Count how many times a selector emits a NEW value as the store
 * updates. Mirrors how the React hook re-renders: a re-render only
 * fires when the selector's returned reference differs by `Object.is`
 * (or `useShallow`, which the test for composite selectors threads in
 * manually).
 */
function countSelectorChanges<T>(
  selector: (state: ReturnType<typeof useDocumentStore.getState>) => T,
  equal: (a: T, b: T) => boolean = Object.is
): { changes: () => number; current: () => T; unsubscribe: () => void } {
  let last = selector(useDocumentStore.getState())
  let changes = 0
  const unsubscribe = useDocumentStore.subscribe((state) => {
    const next = selector(state)
    if (!equal(next, last)) {
      changes += 1
      last = next
    }
  })
  return { changes: () => changes, current: () => last, unsubscribe }
}

const shallowArrayEqual = <T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): boolean => {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (!Object.is(a[i], b[i])) return false
  }
  return true
}

describe('findElementById', () => {
  beforeEach(reset)

  it('returns the root when id matches', () => {
    const doc = useDocumentStore.getState().document
    expect(findElementById(doc.tree, ROOT_ID)).toBe(doc.tree)
  })

  it('returns a nested element', () => {
    const doc = useDocumentStore.getState().document
    expect(findElementById(doc.tree, TEXT_HEADING_ID)?.id).toBe(TEXT_HEADING_ID)
  })

  it('returns null for an unknown id', () => {
    const doc = useDocumentStore.getState().document
    expect(findElementById(doc.tree, 'nope')).toBeNull()
  })
})

describe('selector stability — Y-PRF-02 DoD', () => {
  beforeEach(reset)

  it('useElementById keeps a stable reference when an unrelated element is edited', () => {
    const heading = countSelectorChanges((s) => findElementById(s.document.tree, TEXT_HEADING_ID))

    // Edit the paragraph; the heading must not move.
    dispatch({
      kind: 'updateNode',
      id: TEXT_PARA_ID,
      path: ['content'],
      value: 'World!',
    } satisfies UpdateNodeOp)

    expect(heading.changes()).toBe(0)
    heading.unsubscribe()
  })

  it('useElementById keeps a stable reference when a token is added (the DoD case)', () => {
    const heading = countSelectorChanges((s) => findElementById(s.document.tree, TEXT_HEADING_ID))
    const para = countSelectorChanges((s) => findElementById(s.document.tree, TEXT_PARA_ID))

    dispatch({
      kind: 'addToken',
      category: 'color',
      definition: {
        id: 'accent',
        name: 'Accent',
        value: { light: '#3b82f6', dark: '#60a5fa' },
      },
    } satisfies AddTokenOp)

    // Neither element references the token, so neither subscriber fires.
    expect(heading.changes()).toBe(0)
    expect(para.changes()).toBe(0)

    heading.unsubscribe()
    para.unsubscribe()
  })

  it('useElementById fires exactly once when THAT element is edited', () => {
    const heading = countSelectorChanges((s) => findElementById(s.document.tree, TEXT_HEADING_ID))

    dispatch({
      kind: 'updateNode',
      id: TEXT_HEADING_ID,
      path: ['content'],
      value: 'Updated',
    } satisfies UpdateNodeOp)

    expect(heading.changes()).toBe(1)
    heading.unsubscribe()
  })

  it('useChildIds (shallow) stays stable when only a child PROPERTY changes', () => {
    const rootChildIds = countSelectorChanges((s) => {
      const parent = findElementById(s.document.tree, ROOT_ID)
      return parent !== null && parent.type === 'container' ? parent.children.map((c) => c.id) : []
    }, shallowArrayEqual)

    // Edit a grandchild's content — root's child ids list is unchanged.
    dispatch({
      kind: 'updateNode',
      id: TEXT_HEADING_ID,
      path: ['content'],
      value: 'Different content',
    } satisfies UpdateNodeOp)

    expect(rootChildIds.changes()).toBe(0)
    rootChildIds.unsubscribe()
  })

  it('useChildIds (shallow) fires when a sibling is reordered', () => {
    const rootChildIds = countSelectorChanges((s) => {
      const parent = findElementById(s.document.tree, ROOT_ID)
      return parent !== null && parent.type === 'container' ? parent.children.map((c) => c.id) : []
    }, shallowArrayEqual)

    dispatch({
      kind: 'reorder',
      id: TEXT_PARA_ID,
      toIndex: 0,
    })

    expect(rootChildIds.changes()).toBe(1)
    expect(rootChildIds.current()).toEqual([TEXT_PARA_ID, BOX_ID])
    rootChildIds.unsubscribe()
  })

  it('useTokensByCategory stays stable when an unrelated category is edited', () => {
    const colors = countSelectorChanges((s) => s.document.tokens.color)

    dispatch({
      kind: 'addToken',
      category: 'spacing',
      definition: { id: 'md', name: 'Medium', value: '12px' },
    } satisfies AddTokenOp)

    expect(colors.changes()).toBe(0)
    colors.unsubscribe()
  })

  it('useTokensByCategory fires when its own category is edited', () => {
    const colors = countSelectorChanges((s) => s.document.tokens.color)

    dispatch({
      kind: 'addToken',
      category: 'color',
      definition: {
        id: 'fg',
        name: 'Foreground',
        value: { light: '#000', dark: '#fff' },
      },
    } satisfies AddTokenOp)

    expect(colors.changes()).toBe(1)
    colors.unsubscribe()
  })
})
