import { create } from 'zustand'

export type ElementType = 'rectangle' | 'text' | 'image' | 'button'

export interface CanvasElement {
  id: string
  type: ElementType
  /** Grid column index (0–11) */
  x: number
  /** Pixel Y offset from canvas top */
  y: number
  /** Grid column span */
  width: number
  /** Pixel height */
  height: number
  props: Record<string, unknown>
}

interface ElementState {
  elements: CanvasElement[]
  selectedId: string | null
}

interface ElementActions {
  addElement: (element: Omit<CanvasElement, 'id'>) => void
  updateElement: (id: string, patch: Partial<Omit<CanvasElement, 'id'>>) => void
  removeElement: (id: string) => void
  setSelected: (id: string | null) => void
}

export type ElementStore = ElementState & ElementActions

export const useElementStore = create<ElementStore>()((set) => ({
  elements: [],
  selectedId: null,

  addElement: (element) =>
    set((state) => ({
      elements: [...state.elements, { ...element, id: crypto.randomUUID() }],
    })),

  updateElement: (id, patch) =>
    set((state) => ({
      elements: state.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
    })),

  removeElement: (id) =>
    set((state) => ({
      elements: state.elements.filter((el) => el.id !== id),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  setSelected: (id) => set({ selectedId: id }),
}))
