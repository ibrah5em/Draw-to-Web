import { afterEach, describe, expect, it } from 'vitest'

import type { ContainerNode } from '@document/types'
import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
import { findElementById } from '@store/selectors'
import { useSessionStore } from '@store/sessionStore'
import { formatTranslate, nudgeSelection, parseTranslate } from '@ui/shortcuts/nudge'

function seedOne(): string {
  const base = useDocumentStore.getState().document
  const id = 'nudge-me'
  const tree: ContainerNode = {
    ...(base.tree as ContainerNode),
    type: 'container',
    children: [{ id, type: 'text', tag: 'p', content: 'x', style: { base: {} } }],
  }
  useDocumentStore.getState().hydrate({ ...base, tree })
  return id
}

afterEach(() => {
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()
})

describe('nudge helpers (L-DLG-05)', () => {
  it('parseTranslate reads an offset and defaults to origin', () => {
    expect(parseTranslate(undefined)).toEqual({ x: 0, y: 0 })
    expect(parseTranslate('none')).toEqual({ x: 0, y: 0 })
    expect(parseTranslate('translate(4px, -8px)')).toEqual({ x: 4, y: -8 })
  })

  it('formatTranslate collapses the origin to none', () => {
    expect(formatTranslate(0, 0)).toBe('none')
    expect(formatTranslate(3, 5)).toBe('translate(3px, 5px)')
  })

  it('nudgeSelection accumulates a transform on the selected element', () => {
    const id = seedOne()
    useSessionStore.getState().setSelectedIds([id])
    expect(nudgeSelection('x', 1)).toBe(1)
    expect(nudgeSelection('x', 10)).toBe(1)
    expect(nudgeSelection('y', -1)).toBe(1)
    const node = findElementById(useDocumentStore.getState().document.tree, id)
    expect(node?.style.base.transform).toBe('translate(11px, -1px)')
  })

  it('records one history entry per nudge (undoable)', () => {
    const id = seedOne()
    useSessionStore.getState().setSelectedIds([id])
    const before = useHistoryStore.getState().past.length
    nudgeSelection('y', 10)
    expect(useHistoryStore.getState().past.length).toBe(before + 1)
  })

  it('is a no-op with nothing selected', () => {
    seedOne()
    useSessionStore.getState().clearSelection()
    expect(nudgeSelection('x', 1)).toBe(0)
  })
})
