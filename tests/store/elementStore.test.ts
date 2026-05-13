import { beforeEach, describe, expect, it } from 'vitest'
import { useElementStore, type CanvasElement } from '../../src/store/elementStore'

const sample = (overrides: Partial<Omit<CanvasElement, 'id'>> = {}): Omit<CanvasElement, 'id'> => ({
  type: 'rectangle',
  x: 0,
  y: 0,
  width: 4,
  height: 100,
  props: {},
  ...overrides,
})

const reset = () => {
  useElementStore.setState({ elements: [], selectedId: null })
  useElementStore.temporal.getState().clear()
}

describe('elementStore', () => {
  beforeEach(reset)

  it('adds elements with stable unique ids', () => {
    useElementStore.getState().addElement(sample())
    useElementStore.getState().addElement(sample({ type: 'text' }))
    const els = useElementStore.getState().elements
    expect(els).toHaveLength(2)
    expect(els[0].id).not.toBe(els[1].id)
    expect(els[0].id).toMatch(/[0-9a-f-]{36}/)
  })

  it('updates an element by id without mutating others', () => {
    const { addElement, updateElement } = useElementStore.getState()
    addElement(sample())
    addElement(sample({ type: 'text' }))
    const [a, b] = useElementStore.getState().elements
    updateElement(a.id, { x: 5, width: 6 })
    const after = useElementStore.getState().elements
    expect(after[0]).toMatchObject({ id: a.id, x: 5, width: 6 })
    expect(after[1]).toBe(b)
  })

  it('removes an element and clears selection if it was selected', () => {
    const { addElement, removeElement, setSelected } = useElementStore.getState()
    addElement(sample())
    const id = useElementStore.getState().elements[0].id
    setSelected(id)
    removeElement(id)
    expect(useElementStore.getState().elements).toHaveLength(0)
    expect(useElementStore.getState().selectedId).toBeNull()
  })

  it('reorderElement moves an element to a new z-index', () => {
    const { addElement, reorderElement } = useElementStore.getState()
    addElement(sample({ x: 0 }))
    addElement(sample({ x: 1 }))
    addElement(sample({ x: 2 }))
    const ids = useElementStore.getState().elements.map((e) => e.id)
    reorderElement(ids[0], 2)
    const reordered = useElementStore.getState().elements.map((e) => e.id)
    expect(reordered).toEqual([ids[1], ids[2], ids[0]])
  })

  it('reorderElement clamps out-of-range indexes', () => {
    const { addElement, reorderElement } = useElementStore.getState()
    addElement(sample())
    addElement(sample())
    const [first, second] = useElementStore.getState().elements
    reorderElement(first.id, 99)
    expect(useElementStore.getState().elements.map((e) => e.id)).toEqual([second.id, first.id])
  })

  it('replaceElements swaps the list and clears selection', () => {
    const { addElement, setSelected, replaceElements } = useElementStore.getState()
    addElement(sample())
    setSelected(useElementStore.getState().elements[0].id)
    const incoming: CanvasElement[] = [{ id: 'fixed-id', ...sample({ type: 'button' }) }]
    replaceElements(incoming)
    expect(useElementStore.getState().elements).toEqual(incoming)
    expect(useElementStore.getState().selectedId).toBeNull()
  })

  it('getElements returns the current snapshot', () => {
    useElementStore.getState().addElement(sample())
    expect(useElementStore.getState().getElements()).toBe(useElementStore.getState().elements)
  })

  it('state updates are immutable (new array reference)', () => {
    const { addElement } = useElementStore.getState()
    addElement(sample())
    const before = useElementStore.getState().elements
    addElement(sample())
    const after = useElementStore.getState().elements
    expect(after).not.toBe(before)
  })

  describe('undo/redo', () => {
    it('undo reverts the last document mutation', () => {
      const { addElement } = useElementStore.getState()
      addElement(sample())
      addElement(sample())
      expect(useElementStore.getState().elements).toHaveLength(2)
      useElementStore.temporal.getState().undo()
      expect(useElementStore.getState().elements).toHaveLength(1)
    })

    it('redo reapplies an undone change', () => {
      const { addElement } = useElementStore.getState()
      addElement(sample())
      useElementStore.temporal.getState().undo()
      expect(useElementStore.getState().elements).toHaveLength(0)
      useElementStore.temporal.getState().redo()
      expect(useElementStore.getState().elements).toHaveLength(1)
    })

    it('selection changes are not tracked in history (partialize)', () => {
      const { addElement, setSelected } = useElementStore.getState()
      addElement(sample())
      const id = useElementStore.getState().elements[0].id
      setSelected(id)
      setSelected(null)
      // Only the addElement should be in history — undo removes the element.
      useElementStore.temporal.getState().undo()
      expect(useElementStore.getState().elements).toHaveLength(0)
    })
  })
})
