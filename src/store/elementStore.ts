import { create } from 'zustand'
import { temporal } from 'zundo'
import type { TemporalState } from 'zundo'
import { useStore } from 'zustand'

export type ElementType = 'rectangle' | 'text' | 'image' | 'button'

/** Typed property bag for canvas elements. Consumed by the HTML/CSS emitters. */
export interface ElementProps {
  /** Text content for text and button elements. */
  text?: string
  /** Image source URL or data URI. */
  src?: string
  /** Image alt text — required by the axe-core gate for non-decorative images. */
  alt?: string
  fontSize?: number
  fontFamily?: string
  /** Foreground/text colour (CSS colour string). */
  color?: string
  /** Background colour (CSS colour string). */
  background?: string
  borderRadius?: number
  padding?: number
  borderWidth?: number
  borderColor?: string
}

export interface CanvasElement {
  id: string
  type: ElementType
  /** Grid column index (0–11) */
  x: number
  /** Pixel Y offset from canvas top */
  y: number
  /** Grid column span (1–12) */
  width: number
  /** Pixel height */
  height: number
  props: ElementProps
  /** When true the element is locked against accidental edits on the canvas. */
  locked?: boolean
  /** When false the element is hidden in the canvas and excluded from export. */
  visible?: boolean
  /** Display name shown in the layer panel. */
  layerName?: string
}

interface ElementState {
  elements: CanvasElement[]
  selectedId: string | null
}

interface ElementActions {
  addElement: (element: Omit<CanvasElement, 'id'>) => void
  updateElement: (id: string, patch: Partial<Omit<CanvasElement, 'id'>>) => void
  removeElement: (id: string) => void
  /** Move element to a new z-index position in the layer stack (0 = bottom). */
  reorderElement: (id: string, newIndex: number) => void
  setSelected: (id: string | null) => void
  /** Replaces the entire element list — used by project file load (.dtw). */
  replaceElements: (elements: CanvasElement[]) => void
  /** Returns the current elements snapshot — convenience for non-React consumers. */
  getElements: () => CanvasElement[]
}

export type ElementStore = ElementState & ElementActions

export const useElementStore = create<ElementStore>()(
  temporal(
    (set, get) => ({
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

      reorderElement: (id, newIndex) =>
        set((state) => {
          const currentIndex = state.elements.findIndex((el) => el.id === id)
          if (currentIndex === -1) return state
          const clamped = Math.max(0, Math.min(newIndex, state.elements.length - 1))
          if (clamped === currentIndex) return state
          const next = state.elements.slice()
          const [moved] = next.splice(currentIndex, 1)
          next.splice(clamped, 0, moved)
          return { elements: next }
        }),

      setSelected: (id) => set({ selectedId: id }),

      replaceElements: (elements) => set({ elements, selectedId: null }),

      getElements: () => get().elements,
    }),
    {
      // History tracks only the document, not transient selection state.
      partialize: (state) => ({ elements: state.elements }),
      limit: 100,
      equality: (a, b) => a.elements === b.elements,
    },
  ),
)

/** Hook into the temporal (undo/redo) store. Returns { undo, redo, pastStates, futureStates, clear }. */
export const useTemporalStore = <T,>(
  selector: (state: TemporalState<Pick<ElementStore, 'elements'>>) => T,
): T => useStore(useElementStore.temporal, selector)
