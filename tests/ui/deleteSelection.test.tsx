import { beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
import { findElementById } from '@store/selectors'
import { useSessionStore } from '@store/sessionStore'
import { deleteSelected } from '@ui/canvas/useDeleteSelection'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

beforeEach(() => {
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()
  useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT)
})

describe('deleteSelected()', () => {
  it('removes the selected element through dispatch', () => {
    useSessionStore.getState().setSelectedIds(['title'])
    expect(deleteSelected()).toBe(1)
    expect(findElementById(useDocumentStore.getState().document.tree, 'title')).toBeNull()
  })

  it('clears the selection after deleting', () => {
    useSessionStore.getState().setSelectedIds(['cta'])
    deleteSelected()
    expect(useSessionStore.getState().selectedIds).toEqual([])
  })

  it('does not delete the root element', () => {
    const rootId = useDocumentStore.getState().document.tree.id
    useSessionStore.getState().setSelectedIds([rootId])
    expect(deleteSelected()).toBe(0)
    expect(findElementById(useDocumentStore.getState().document.tree, rootId)).not.toBeNull()
  })

  it('records one history entry per deleted node', () => {
    const before = useHistoryStore.getState().past.length
    useSessionStore.getState().setSelectedIds(['title', 'cta'])
    deleteSelected()
    expect(useHistoryStore.getState().past.length).toBe(before + 2)
  })

  it('does nothing when nothing is selected', () => {
    const before = useHistoryStore.getState().past.length
    expect(deleteSelected()).toBe(0)
    expect(useHistoryStore.getState().past.length).toBe(before)
  })
})
