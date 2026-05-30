import { afterEach, describe, expect, it } from 'vitest'

import type { ContainerNode } from '@document/types'
import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
import { useSessionStore } from '@store/sessionStore'
import {
  cloneWithNewIds,
  copySelection,
  duplicateSelection,
  groupSelection,
  moveToEdge,
  moveZOrder,
  pasteClipboard,
  selectAllSiblings,
  ungroupSelection,
} from '@ui/canvas/clipboard'

/** Seed a root container with `n` text children and return their ids. */
function seedChildren(n: number): string[] {
  const base = useDocumentStore.getState().document
  const ids: string[] = []
  const children = Array.from({ length: n }, (_, i) => {
    const id = `child-${i}`
    ids.push(id)
    return { id, type: 'text' as const, tag: 'p' as const, content: `t${i}`, style: { base: {} } }
  })
  const tree: ContainerNode = { ...(base.tree as ContainerNode), type: 'container', children }
  useDocumentStore.getState().hydrate({ ...base, tree })
  return ids
}

function rootChildIds(): string[] {
  const tree = useDocumentStore.getState().document.tree
  return tree.type === 'container' ? tree.children.map((c) => c.id) : []
}

afterEach(() => {
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()
})

describe('clipboard helpers (L-DLG-05)', () => {
  it('cloneWithNewIds assigns fresh ids through the whole subtree', () => {
    const original: ContainerNode = {
      id: 'a',
      type: 'container',
      style: { base: {} },
      layout: { base: { mode: 'flex' } },
      children: [{ id: 'b', type: 'text', tag: 'p', content: 'x', style: { base: {} } }],
    }
    const clone = cloneWithNewIds(original) as ContainerNode
    expect(clone.id).not.toBe('a')
    expect(clone.children[0]!.id).not.toBe('b')
    expect(clone.children[0]!.type).toBe('text')
  })

  it('copy + paste inserts a fresh-id clone into the root', () => {
    const [first] = seedChildren(2)
    useSessionStore.getState().setSelectedIds([first!])
    expect(copySelection()).toBe(true)
    expect(pasteClipboard()).toBe(true)
    const ids = rootChildIds()
    expect(ids).toHaveLength(3)
    // The pasted id is new and is now selected.
    const selected = useSessionStore.getState().selectedIds
    expect(selected).toHaveLength(1)
    expect(ids).toContain(selected[0])
    expect(selected[0]).not.toBe(first)
  })

  it('duplicate places the clone right after the original', () => {
    const ids = seedChildren(2)
    useSessionStore.getState().setSelectedIds([ids[0]!])
    expect(duplicateSelection()).toBe(1)
    const after = rootChildIds()
    expect(after).toHaveLength(3)
    // original at index 0, clone at index 1
    expect(after[0]).toBe(ids[0])
    expect(after[1]).not.toBe(ids[1])
  })

  it('selectAllSiblings selects every child of the parent', () => {
    const ids = seedChildren(3)
    useSessionStore.getState().setSelectedIds([ids[1]!])
    selectAllSiblings()
    expect([...useSessionStore.getState().selectedIds].sort()).toEqual([...ids].sort())
  })

  it('moveZOrder reorders within the parent and clamps at the ends', () => {
    const ids = seedChildren(3)
    // Bring the first element forward → [1, 0, 2].
    useSessionStore.getState().setSelectedIds([ids[0]!])
    expect(moveZOrder(1)).toBe(true)
    expect(rootChildIds()).toEqual([ids[1], ids[0], ids[2]])
    // The element now at index 0 cannot move back further — clamped no-op.
    useSessionStore.getState().setSelectedIds([ids[1]!])
    expect(moveZOrder(-1)).toBe(false)
    // The element now last cannot move forward — clamped no-op.
    useSessionStore.getState().setSelectedIds([ids[2]!])
    expect(moveZOrder(1)).toBe(false)
  })

  it('group then ungroup round-trips the children', () => {
    const ids = seedChildren(2)
    useSessionStore.getState().setSelectedIds(ids)
    expect(groupSelection()).toBe(true)
    // Root now has a single container child (the group).
    const afterGroup = rootChildIds()
    expect(afterGroup).toHaveLength(1)
    const groupId = useSessionStore.getState().selectedIds[0]!
    expect(afterGroup[0]).toBe(groupId)
    // Ungroup splices the children back into the root.
    useSessionStore.getState().setSelectedIds([groupId])
    expect(ungroupSelection()).toBe(true)
    expect(rootChildIds()).toHaveLength(2)
  })

  it('moveToEdge sends to back and brings to front (L-CAN-08)', () => {
    const ids = seedChildren(3)
    // Bring the middle element to the front (last sibling).
    useSessionStore.getState().setSelectedIds([ids[1]!])
    expect(moveToEdge('front')).toBe(true)
    expect(rootChildIds()).toEqual([ids[0], ids[2], ids[1]])
    // Send it to the back (first sibling).
    expect(moveToEdge('back')).toBe(true)
    expect(rootChildIds()).toEqual([ids[1], ids[0], ids[2]])
    // Already at back → no-op.
    expect(moveToEdge('back')).toBe(false)
  })

  it('copy/paste with nothing selected does not change the tree', () => {
    seedChildren(1)
    useSessionStore.getState().clearSelection()
    const before = rootChildIds().length
    expect(copySelection()).toBe(false)
    expect(rootChildIds().length).toBe(before)
  })
})
