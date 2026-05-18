import { create } from 'zustand'

/**
 * Local mirrors of the breakpoint and state literals.
 *
 * These align with the eventual C1 types (`ResponsiveProperties` keys from
 * `I-DOC-01` and `StatesMap` keys from the same). When `src/document/types.ts`
 * lands, re-export those types from here and delete the local definitions —
 * the string set is stable per Section 4 of `docs/0.2.0v/plan.md`.
 */
export type Breakpoint = 'base' | 'tablet' | 'mobile' | 'small'
export type ElementState = 'default' | 'hover' | 'focus' | 'active'

/** Editor theme override applied to the canvas preview. */
export type ThemeMode = 'light' | 'dark'

/** Resizable panel sizes, in pixels. Persisted across sessions by the shell. */
export interface PanelSizes {
  /** Left sidebar (Insert + Layers). */
  readonly sidebar: number
  /** Right inspector (Properties + Tokens). */
  readonly inspector: number
  /** Bottom validation console. */
  readonly console: number
}

interface SessionState {
  /** Element IDs currently selected in the canvas / layers tree. Order is selection order. */
  readonly selectedIds: readonly string[]
  /** Active responsive breakpoint that property writes are routed to (Y-STR-07). */
  readonly activeBreakpoint: Breakpoint
  /** Active pseudo-state that property writes are routed to (Y-STR-06). */
  readonly activeState: ElementState
  /** Current resizable-pane sizes. */
  readonly panelSizes: PanelSizes
  /** Editor theme preview mode. Independent of the document's emitted theme. */
  readonly theme: ThemeMode
}

interface SessionActions {
  /** Replace the selection with the given IDs. Pass `[]` to clear. */
  setSelectedIds: (ids: readonly string[]) => void
  /** Toggle a single ID in the selection (add if absent, remove if present). */
  toggleSelected: (id: string) => void
  /** Clear the selection. Equivalent to `setSelectedIds([])`. */
  clearSelection: () => void
  /** Switch the active responsive breakpoint. */
  setActiveBreakpoint: (bp: Breakpoint) => void
  /** Switch the active pseudo-state. */
  setActiveState: (st: ElementState) => void
  /** Update the size of a single resizable pane. Other panes are left untouched. */
  setPanelSize: (panel: keyof PanelSizes, size: number) => void
  /** Set the editor preview theme explicitly. */
  setTheme: (theme: ThemeMode) => void
  /** Flip the editor preview theme between `light` and `dark`. */
  toggleTheme: () => void
}

export type SessionStore = SessionState & SessionActions

const DEFAULT_PANEL_SIZES: PanelSizes = {
  sidebar: 280,
  inspector: 320,
  console: 200,
}

/**
 * Editor session store — selection, active breakpoint/state, panel sizes, theme.
 *
 * **Never serialized.** This state is intentionally separate from the document
 * (see CLAUDE.local.md, Key Rules) so that selecting an element, switching
 * breakpoints, or resizing panels never marks the document dirty. The DoD for
 * Y-STR-02 explicitly requires this separation.
 *
 * Satisfies contract C5 (`useSessionStore` hook).
 */
export const useSessionStore = create<SessionStore>()((set) => ({
  selectedIds: [],
  activeBreakpoint: 'base',
  activeState: 'default',
  panelSizes: DEFAULT_PANEL_SIZES,
  theme: 'light',

  setSelectedIds: (ids) => set({ selectedIds: ids }),

  toggleSelected: (id) =>
    set((state) => {
      const idx = state.selectedIds.indexOf(id)
      if (idx === -1) return { selectedIds: [...state.selectedIds, id] }
      const next = state.selectedIds.slice()
      next.splice(idx, 1)
      return { selectedIds: next }
    }),

  clearSelection: () => set({ selectedIds: [] }),

  setActiveBreakpoint: (bp) => set({ activeBreakpoint: bp }),

  setActiveState: (st) => set({ activeState: st }),

  setPanelSize: (panel, size) =>
    set((state) => ({
      panelSizes: { ...state.panelSizes, [panel]: size },
    })),

  setTheme: (theme) => set({ theme }),

  toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
}))
