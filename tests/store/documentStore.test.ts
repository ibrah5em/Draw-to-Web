import { produce } from 'immer'
import { beforeEach, describe, expect, it } from 'vitest'

import { documentSchema } from '../../src/document/schemas'
import type { Document, Tokens } from '../../src/document/types'
import {
  CURRENT_DOCUMENT_VERSION,
  createBlankDocument,
  useDocumentStore,
} from '../../src/store/documentStore'

const reset = (): void => {
  useDocumentStore.setState({ document: createBlankDocument(), isDirty: false })
}

describe('createBlankDocument', () => {
  it('returns a document that passes documentSchema.parse', () => {
    const doc = createBlankDocument()
    expect(() => documentSchema.parse(doc)).not.toThrow()
  })

  it('seeds the version, runtime flags, settings, and a single root container', () => {
    const doc = createBlankDocument('Demo')
    expect(doc.version).toBe(CURRENT_DOCUMENT_VERSION)
    expect(doc.meta.name).toBe('Demo')
    expect(doc.tree.type).toBe('container')
    if (doc.tree.type === 'container') {
      expect(doc.tree.children).toEqual([])
    }
    expect(Object.values(doc.runtime).every((v) => v === false)).toBe(true)
    expect(doc.settings.contrastTarget).toBe('AA')
    expect(doc.seo.title).toBe('Demo')
  })

  it('generates a fresh id and timestamp per call', () => {
    const a = createBlankDocument()
    const b = createBlankDocument()
    expect(a.tree.id).not.toBe(b.tree.id)
  })
})

describe('documentStore', () => {
  beforeEach(reset)

  it('starts with a blank document and clean dirty flag', () => {
    const state = useDocumentStore.getState()
    expect(state.isDirty).toBe(false)
    expect(state.document.version).toBe(CURRENT_DOCUMENT_VERSION)
  })

  it('commit replaces the document and marks dirty', () => {
    const before = useDocumentStore.getState().document
    const next = produce(before, (draft) => {
      draft.meta.name = 'After commit'
    })
    useDocumentStore.getState().commit(next)
    const state = useDocumentStore.getState()
    expect(state.document.meta.name).toBe('After commit')
    expect(state.isDirty).toBe(true)
  })

  it('hydrate replaces the document and clears dirty', () => {
    useDocumentStore.getState().setDirty(true)
    const fresh = createBlankDocument('Loaded')
    useDocumentStore.getState().hydrate(fresh)
    const state = useDocumentStore.getState()
    expect(state.document.meta.name).toBe('Loaded')
    expect(state.isDirty).toBe(false)
  })

  it('setDocument leaves the dirty flag alone', () => {
    useDocumentStore.getState().setDirty(true)
    const fresh = createBlankDocument('Side load')
    useDocumentStore.getState().setDocument(fresh)
    expect(useDocumentStore.getState().isDirty).toBe(true)
    expect(useDocumentStore.getState().document.meta.name).toBe('Side load')
  })

  it('markDirty and markClean toggle the flag without touching the document', () => {
    const before = useDocumentStore.getState().document
    useDocumentStore.getState().markDirty()
    expect(useDocumentStore.getState().isDirty).toBe(true)
    expect(useDocumentStore.getState().document).toBe(before)
    useDocumentStore.getState().markClean()
    expect(useDocumentStore.getState().isDirty).toBe(false)
    expect(useDocumentStore.getState().document).toBe(before)
  })

  it('reset returns to a blank document and clears dirty', () => {
    useDocumentStore.getState().commit(
      produce(useDocumentStore.getState().document, (draft) => {
        draft.meta.name = 'About to be wiped'
      })
    )
    expect(useDocumentStore.getState().isDirty).toBe(true)
    useDocumentStore.getState().reset('Fresh')
    const state = useDocumentStore.getState()
    expect(state.document.meta.name).toBe('Fresh')
    expect(state.isDirty).toBe(false)
  })
})

describe('selector reactivity', () => {
  beforeEach(reset)

  /**
   * Subscribes to the store with the given selector and returns a getter
   * for the count of distinct slice values seen so far. Mirrors how the
   * React hook re-renders: `useSyncExternalStore` only notifies when the
   * selector's return value changes by `Object.is`.
   */
  const countSliceChanges = <T>(
    selector: (s: ReturnType<typeof useDocumentStore.getState>) => T
  ) => {
    let last = selector(useDocumentStore.getState())
    let changes = 0
    const unsubscribe = useDocumentStore.subscribe((state) => {
      const next = selector(state)
      if (!Object.is(next, last)) {
        changes += 1
        last = next
      }
    })
    return { changes: () => changes, unsubscribe }
  }

  it('a slice-level subscriber fires only when its slice changes', () => {
    const tokenWatcher = countSliceChanges((s) => s.document.tokens)
    const treeWatcher = countSliceChanges((s) => s.document.tree)

    const before = useDocumentStore.getState().document
    const treeEdit = produce(before, (draft) => {
      if (draft.tree.type === 'container') draft.tree.name = 'Edited tree'
    })
    useDocumentStore.getState().commit(treeEdit)

    expect(treeWatcher.changes()).toBe(1)
    expect(tokenWatcher.changes()).toBe(0)

    const after = useDocumentStore.getState().document
    const tokenEdit = produce(after, (draft) => {
      const tokens = draft.tokens as Tokens & {
        color: { id: string; name: string; value: { light: string; dark: string } }[]
      }
      tokens.color.push({
        id: 'accent',
        name: 'Accent',
        value: { light: '#3b82f6', dark: '#60a5fa' },
      })
    })
    useDocumentStore.getState().commit(tokenEdit)

    expect(treeWatcher.changes()).toBe(1)
    expect(tokenWatcher.changes()).toBe(1)

    tokenWatcher.unsubscribe()
    treeWatcher.unsubscribe()
  })

  it('a dirty-flag subscriber fires when only the flag changes', () => {
    const dirtyWatcher = countSliceChanges((s) => s.isDirty)
    useDocumentStore.getState().markDirty()
    expect(dirtyWatcher.changes()).toBe(1)
    useDocumentStore.getState().markDirty()
    expect(dirtyWatcher.changes()).toBe(1)
    useDocumentStore.getState().markClean()
    expect(dirtyWatcher.changes()).toBe(2)
    dirtyWatcher.unsubscribe()
  })

  it('editing the tree does not change the tokens reference', () => {
    const before = useDocumentStore.getState().document
    const tokensBefore = before.tokens
    const next = produce(before, (draft) => {
      if (draft.tree.type === 'container') {
        draft.tree.name = 'Renamed root'
      }
    })
    useDocumentStore.getState().commit(next)
    const after = useDocumentStore.getState().document
    expect(after.tokens).toBe(tokensBefore)
    expect(after.tree).not.toBe(before.tree)
  })

  it('editing the tokens does not change the tree reference', () => {
    const before = useDocumentStore.getState().document
    const treeBefore = before.tree
    const next = produce(before, (draft) => {
      const tokens = draft.tokens as Tokens & {
        color: { id: string; name: string; value: { light: string; dark: string } }[]
      }
      tokens.color.push({
        id: 'accent',
        name: 'Accent',
        value: { light: '#3b82f6', dark: '#60a5fa' },
      })
    })
    useDocumentStore.getState().commit(next)
    const after = useDocumentStore.getState().document
    expect(after.tree).toBe(treeBefore)
    expect(after.tokens).not.toBe(before.tokens)
  })

  it('settings, seo, runtime, variables, meta slices stay stable across an unrelated edit', () => {
    const before = useDocumentStore.getState().document
    const next: Document = produce(before, (draft) => {
      if (draft.tree.type === 'container') {
        draft.tree.name = 'Touched only the tree'
      }
    })
    useDocumentStore.getState().commit(next)
    const after = useDocumentStore.getState().document
    expect(after.settings).toBe(before.settings)
    expect(after.seo).toBe(before.seo)
    expect(after.runtime).toBe(before.runtime)
    expect(after.variables).toBe(before.variables)
    expect(after.meta).toBe(before.meta)
  })
})
