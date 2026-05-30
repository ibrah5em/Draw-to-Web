/**
 * UI-lane view preferences (L-TOP-03).
 *
 * Ephemeral editor-only toggles that must NOT live on the document (so they
 * never dirty the file or emit into output) and are not part of the session
 * store contract (C5, Yousef's lane). The canvas reads these to adjust how
 * it *renders* without ever mutating the tree — satisfying the L-TOP-03 DoD
 * ("toggling does not mutate the document").
 *
 * Currently just `hoverPreview`: when on, the canvas paints every element in
 * its `:hover` state so the author can review hover styling without hovering
 * each node. Grid-overlay visibility lives on `document.settings.gridVisible`
 * instead (L-CAN-10) because its DoD requires per-project persistence.
 */

import { create } from 'zustand'

interface ViewPrefsState {
  /** Render canvas elements in their hover state (L-TOP-03). */
  readonly hoverPreview: boolean
}

interface ViewPrefsActions {
  /** Toggle the hover-preview render mode. */
  toggleHoverPreview: () => void
  /** Set the hover-preview render mode explicitly. */
  setHoverPreview: (on: boolean) => void
}

export type ViewPrefsStore = ViewPrefsState & ViewPrefsActions

/** Editor view-preference store (UI lane, never serialized). */
export const useViewPrefs = create<ViewPrefsStore>()((set) => ({
  hoverPreview: false,
  toggleHoverPreview: () => set((s) => ({ hoverPreview: !s.hoverPreview })),
  setHoverPreview: (on) => set({ hoverPreview: on }),
}))
