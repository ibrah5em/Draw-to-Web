import { beforeEach, describe, expect, it } from 'vitest'

import type {
  AddTokenOp,
  DeleteElementOp,
  DeleteTokenOp,
  InsertElementOp,
  InsertPresetOp,
  Operation,
  RenameTokenOp,
  ReorderOp,
  UnwrapGroupOp,
  UpdateNodeOp,
  UpdateNodeStateOp,
  UpdateNodeStyleOp,
  UpdateTokenOp,
  WrapInGroupOp,
} from '../../src/document/operations'
import type { ContainerNode, Document, ElementNode, TextNode } from '../../src/document/types'
import { dispatch, redo, undo } from '../../src/store/dispatch'
import { createBlankDocument, useDocumentStore } from '../../src/store/documentStore'
import { useHistoryStore } from '../../src/store/historyStore'

const ROOT_ID = 'root-id-'
const BOX_ID = 'box-id--'
const TEXT_HEADING_ID = 'text-h1-'
const TEXT_PARA_ID = 'text-p--'

/**
 * Build a deterministic fixture document with a known id layout so each
 * test can target ops without juggling generated nanoids.
 *
 *   root          (container)
 *   ├── box       (container)
 *   │   └── h1    (text, "Hello")
 *   └── p         (text, "World")
 */
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
  const base = createBlankDocument('Fixture')
  return { ...base, tree: root }
}

/**
 * Reset both stores to a deterministic state before every test.
 */
const resetStores = (doc: Document = buildFixtureDocument()): void => {
  useDocumentStore.setState({ document: doc, isDirty: false })
  useHistoryStore.setState({ past: [], future: [] })
}

const findInTree = (root: ElementNode, id: string): ElementNode | null => {
  if (root.id === id) return root
  if (root.type !== 'container') return null
  for (const child of root.children) {
    const hit = findInTree(child, id)
    if (hit) return hit
  }
  return null
}

const childIdsOf = (root: ElementNode, parentId: string): string[] => {
  const parent = findInTree(root, parentId)
  if (parent === null || parent.type !== 'container') return []
  return parent.children.map((c) => c.id)
}

describe('dispatch — non-mutation cases', () => {
  beforeEach(() => resetStores())

  it('records nothing and leaves the document untouched when the op produces no patches', () => {
    // renameToken with `oldId === newId` is the documented short-circuit
    // in operations.ts — it returns before any mutation, so immer emits
    // zero patches and the dispatcher must skip the history entry.
    dispatch({
      kind: 'addToken',
      category: 'color',
      definition: { id: 'accent', name: 'Accent', value: { light: '#000', dark: '#fff' } },
    } satisfies AddTokenOp)
    const docBefore = useDocumentStore.getState().document
    const historyDepth = useHistoryStore.getState().past.length

    dispatch({
      kind: 'renameToken',
      category: 'color',
      oldId: 'accent',
      newId: 'accent',
    } satisfies RenameTokenOp)

    expect(useDocumentStore.getState().document).toBe(docBefore)
    expect(useHistoryStore.getState().past).toHaveLength(historyDepth)
  })

  it('propagates errors from applyOperation without recording history or commiting', () => {
    const docBefore = useDocumentStore.getState().document
    expect(() =>
      dispatch({ kind: 'deleteElement', id: 'no-such-id' } satisfies DeleteElementOp)
    ).toThrow(/No element/)
    expect(useDocumentStore.getState().document).toBe(docBefore)
    expect(useHistoryStore.getState().past).toHaveLength(0)
    expect(useDocumentStore.getState().isDirty).toBe(false)
  })
})

describe('dispatch — round-trips for every Operation kind', () => {
  beforeEach(() => resetStores())

  const expectRoundTrip = (op: Operation, mutated: (doc: Document) => boolean): void => {
    const before = useDocumentStore.getState().document
    dispatch(op)
    const after = useDocumentStore.getState().document
    expect(after).not.toBe(before)
    expect(mutated(after)).toBe(true)
    expect(useDocumentStore.getState().isDirty).toBe(true)
    expect(useHistoryStore.getState().past).toHaveLength(1)

    expect(undo()).toBe(true)
    const undone = useDocumentStore.getState().document
    expect(undone).toEqual(before)
    expect(useHistoryStore.getState().past).toHaveLength(0)
    expect(useHistoryStore.getState().future).toHaveLength(1)

    expect(redo()).toBe(true)
    const redone = useDocumentStore.getState().document
    expect(redone).toEqual(after)
    expect(useHistoryStore.getState().past).toHaveLength(1)
    expect(useHistoryStore.getState().future).toHaveLength(0)
  }

  it('insertElement', () => {
    const newNode: ElementNode = {
      id: 'inserted-1',
      type: 'text',
      tag: 'span',
      content: 'New',
      style: { base: {} },
    }
    expectRoundTrip(
      { kind: 'insertElement', parentId: ROOT_ID, node: newNode } satisfies InsertElementOp,
      (doc) => childIdsOf(doc.tree, ROOT_ID).includes('inserted-1')
    )
  })

  it('deleteElement', () => {
    expectRoundTrip(
      { kind: 'deleteElement', id: TEXT_PARA_ID } satisfies DeleteElementOp,
      (doc) => findInTree(doc.tree, TEXT_PARA_ID) === null
    )
  })

  it('reorder (within parent)', () => {
    expectRoundTrip(
      { kind: 'reorder', id: TEXT_PARA_ID, toIndex: 0 } satisfies ReorderOp,
      (doc) => childIdsOf(doc.tree, ROOT_ID)[0] === TEXT_PARA_ID
    )
  })

  it('reorder (cross-parent)', () => {
    expectRoundTrip(
      {
        kind: 'reorder',
        id: TEXT_PARA_ID,
        toParentId: BOX_ID,
        toIndex: 0,
      } satisfies ReorderOp,
      (doc) => childIdsOf(doc.tree, BOX_ID).includes(TEXT_PARA_ID)
    )
  })

  it('updateNode', () => {
    expectRoundTrip(
      {
        kind: 'updateNode',
        id: TEXT_HEADING_ID,
        path: ['content'],
        value: 'Updated heading',
      } satisfies UpdateNodeOp,
      (doc) => {
        const n = findInTree(doc.tree, TEXT_HEADING_ID)
        return n !== null && n.type === 'text' && n.content === 'Updated heading'
      }
    )
  })

  it('updateNodeStyle (non-base breakpoint creates slot)', () => {
    expectRoundTrip(
      {
        kind: 'updateNodeStyle',
        id: TEXT_HEADING_ID,
        breakpoint: 'mobile',
        path: ['opacity'],
        value: 0.5,
      } satisfies UpdateNodeStyleOp,
      (doc) => {
        const n = findInTree(doc.tree, TEXT_HEADING_ID)
        return n !== null && n.style.mobile?.opacity === 0.5
      }
    )
  })

  it('updateNodeState', () => {
    expectRoundTrip(
      {
        kind: 'updateNodeState',
        id: TEXT_HEADING_ID,
        state: 'hover',
        path: ['opacity'],
        value: 0.8,
      } satisfies UpdateNodeStateOp,
      (doc) => {
        const n = findInTree(doc.tree, TEXT_HEADING_ID)
        return n !== null && n.states?.hover?.opacity === 0.8
      }
    )
  })

  it('wrapInGroup', () => {
    const wrapper: ContainerNode = {
      id: 'wrapper-1',
      type: 'container',
      style: { base: {} },
      layout: { base: { mode: 'flex', direction: 'column' } },
      children: [],
    }
    expectRoundTrip(
      {
        kind: 'wrapInGroup',
        ids: [BOX_ID, TEXT_PARA_ID],
        container: wrapper,
      } satisfies WrapInGroupOp,
      (doc) => childIdsOf(doc.tree, ROOT_ID).includes('wrapper-1')
    )
  })

  it('unwrapGroup', () => {
    expectRoundTrip(
      { kind: 'unwrapGroup', id: BOX_ID } satisfies UnwrapGroupOp,
      (doc) =>
        findInTree(doc.tree, BOX_ID) === null &&
        childIdsOf(doc.tree, ROOT_ID).includes(TEXT_HEADING_ID)
    )
  })

  it('addToken', () => {
    expectRoundTrip(
      {
        kind: 'addToken',
        category: 'color',
        definition: {
          id: 'accent',
          name: 'Accent',
          value: { light: '#3b82f6', dark: '#60a5fa' },
        },
      } satisfies AddTokenOp,
      (doc) => doc.tokens.color.some((t) => t.id === 'accent')
    )
  })

  it('updateToken', () => {
    // Seed: add the token first so we can update it.
    dispatch({
      kind: 'addToken',
      category: 'spacing',
      definition: { id: 'md', name: 'Medium', value: '12px' },
    } satisfies AddTokenOp)
    const before = useDocumentStore.getState().document
    dispatch({
      kind: 'updateToken',
      category: 'spacing',
      id: 'md',
      value: '16px',
    } satisfies UpdateTokenOp)
    const after = useDocumentStore.getState().document
    expect(after.tokens.spacing.find((t) => t.id === 'md')?.value).toBe('16px')
    expect(useHistoryStore.getState().past).toHaveLength(2)
    expect(undo()).toBe(true)
    expect(useDocumentStore.getState().document).toEqual(before)
    expect(redo()).toBe(true)
    expect(useDocumentStore.getState().document).toEqual(after)
  })

  it('deleteToken (with frozen ref rewrite)', () => {
    // Seed: add a color token and bind it on the heading's color.
    dispatch({
      kind: 'addToken',
      category: 'color',
      definition: {
        id: 'fg',
        name: 'Foreground',
        value: { light: '#111111', dark: '#eeeeee' },
      },
    } satisfies AddTokenOp)
    dispatch({
      kind: 'updateNodeStyle',
      id: TEXT_HEADING_ID,
      breakpoint: 'base',
      path: ['typography', 'color'],
      value: 'color.fg',
    } satisfies UpdateNodeStyleOp)
    const before = useDocumentStore.getState().document

    dispatch({ kind: 'deleteToken', category: 'color', id: 'fg' } satisfies DeleteTokenOp)
    const after = useDocumentStore.getState().document
    const heading = findInTree(after.tree, TEXT_HEADING_ID)
    expect(heading?.style.base?.typography?.color).toBe('#111111')
    expect(after.tokens.color.find((t) => t.id === 'fg')).toBeUndefined()

    // One history entry for the delete; undo restores the token and the ref.
    expect(undo()).toBe(true)
    expect(useDocumentStore.getState().document).toEqual(before)
  })

  it('renameToken rewrites bindings in one history entry', () => {
    dispatch({
      kind: 'addToken',
      category: 'color',
      definition: {
        id: 'old-name',
        name: 'Old',
        value: { light: '#000', dark: '#fff' },
      },
    } satisfies AddTokenOp)
    dispatch({
      kind: 'updateNodeStyle',
      id: TEXT_HEADING_ID,
      breakpoint: 'base',
      path: ['typography', 'color'],
      value: 'color.old-name',
    } satisfies UpdateNodeStyleOp)
    const historyDepthBefore = useHistoryStore.getState().past.length

    dispatch({
      kind: 'renameToken',
      category: 'color',
      oldId: 'old-name',
      newId: 'new-name',
    } satisfies RenameTokenOp)

    const after = useDocumentStore.getState().document
    const heading = findInTree(after.tree, TEXT_HEADING_ID)
    expect(heading?.style.base?.typography?.color).toBe('color.new-name')
    expect(after.tokens.color.find((t) => t.id === 'new-name')).toBeDefined()
    // Exactly one history entry was added for the rename + binding rewrite.
    expect(useHistoryStore.getState().past).toHaveLength(historyDepthBefore + 1)
  })

  it('insertPreset materializes a subtree as one history entry (Y-STR-04 boundary)', () => {
    const before = useDocumentStore.getState().document
    dispatch({
      kind: 'insertPreset',
      parentId: ROOT_ID,
      presetId: 'cta-banner',
    } satisfies InsertPresetOp)
    const after = useDocumentStore.getState().document
    // The preset is appended; new last child should be the freshly inserted subtree.
    const rootChildren = childIdsOf(after.tree, ROOT_ID)
    expect(rootChildren.length).toBe(childIdsOf(before.tree, ROOT_ID).length + 1)
    expect(useHistoryStore.getState().past).toHaveLength(1)
    // Undo wipes the entire subtree in one shot.
    expect(undo()).toBe(true)
    expect(useDocumentStore.getState().document).toEqual(before)
  })
})

describe('dispatch — dirty flag (Y-PER-06 boundary)', () => {
  beforeEach(() => resetStores())

  it('marks the document dirty after a successful dispatch', () => {
    expect(useDocumentStore.getState().isDirty).toBe(false)
    dispatch({
      kind: 'updateNode',
      id: TEXT_HEADING_ID,
      path: ['content'],
      value: 'Changed',
    } satisfies UpdateNodeOp)
    expect(useDocumentStore.getState().isDirty).toBe(true)
  })

  it('undo and redo each mark the document dirty', () => {
    dispatch({
      kind: 'updateNode',
      id: TEXT_HEADING_ID,
      path: ['content'],
      value: 'A',
    } satisfies UpdateNodeOp)
    useDocumentStore.getState().markClean()
    expect(useDocumentStore.getState().isDirty).toBe(false)

    expect(undo()).toBe(true)
    expect(useDocumentStore.getState().isDirty).toBe(true)

    useDocumentStore.getState().markClean()
    expect(redo()).toBe(true)
    expect(useDocumentStore.getState().isDirty).toBe(true)
  })

  it('undo / redo on an empty stack are no-ops', () => {
    expect(undo()).toBe(false)
    expect(redo()).toBe(false)
    expect(useDocumentStore.getState().isDirty).toBe(false)
  })
})

describe('dispatch — history coalescing (Y-HST-02 boundary)', () => {
  beforeEach(() => resetStores())

  it('continuous updates to the same path coalesce into one undo', () => {
    const target = { id: TEXT_HEADING_ID, path: ['content'] } as const
    for (const ch of ['H', 'He', 'Hel', 'Hell', 'Hello!']) {
      dispatch({
        kind: 'updateNode',
        id: target.id,
        path: target.path,
        value: ch,
      } satisfies UpdateNodeOp)
    }
    expect(useHistoryStore.getState().past).toHaveLength(1)
    const heading = findInTree(useDocumentStore.getState().document.tree, TEXT_HEADING_ID)
    expect(heading?.type === 'text' && heading.content).toBe('Hello!')
    expect(undo()).toBe(true)
    const after = findInTree(useDocumentStore.getState().document.tree, TEXT_HEADING_ID)
    expect(after?.type === 'text' && after.content).toBe('Hello')
  })

  it('edits to different elements never coalesce', () => {
    dispatch({
      kind: 'updateNode',
      id: TEXT_HEADING_ID,
      path: ['content'],
      value: 'A',
    } satisfies UpdateNodeOp)
    dispatch({
      kind: 'updateNode',
      id: TEXT_PARA_ID,
      path: ['content'],
      value: 'B',
    } satisfies UpdateNodeOp)
    expect(useHistoryStore.getState().past).toHaveLength(2)
  })
})
