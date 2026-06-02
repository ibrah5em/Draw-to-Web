/**
 * UI-lane view preferences (L-TOP-03).
 *
 * Ephemeral editor-only toggles that must NOT live on the document (so they
 * never dirty the file or emit into output) and are not part of the session
 * store contract (C5, Yousef's lane). The canvas reads these to adjust how
 * it *renders* without ever mutating the tree — satisfying the L-TOP-03 DoD
 * ("toggling does not mutate the document").
 *
 * `hoverPreview`: when on, the canvas paints every element in its `:hover`
 * state so the author can review hover styling without hovering each node.
 *
 * `hiddenIds` / `lockedIds` (L-LYR-01): editor-only per-element flags driven
 * by the Layers tree's eye / lock toggles. Hidden elements are not painted on
 * the canvas; locked elements ignore canvas selection, drag, and inline edit.
 * Both are ephemeral and never serialized, so they affect neither the document
 * nor the exported output — unlocking / unhiding is always reachable from the
 * Layers tree. Grid-overlay visibility lives on `document.settings.gridVisible`
 * instead (L-CAN-10) because its DoD requires per-project persistence.
 */

import { create } from 'zustand'

/** Add `id` if absent, remove it if present; returns a new set. */
function toggleInSet(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

interface ViewPrefsState {
  /** Render canvas elements in their hover state (L-TOP-03). */
  readonly hoverPreview: boolean
  /** Element ids hidden from the canvas (Layers eye toggle). */
  readonly hiddenIds: ReadonlySet<string>
  /** Element ids locked against canvas interaction (Layers lock toggle). */
  readonly lockedIds: ReadonlySet<string>
}

interface ViewPrefsActions {
  /** Toggle the hover-preview render mode. */
  toggleHoverPreview: () => void
  /** Set the hover-preview render mode explicitly. */
  setHoverPreview: (on: boolean) => void
  /** Toggle whether an element is hidden on the canvas. */
  toggleHidden: (id: string) => void
  /** Toggle whether an element is locked against canvas interaction. */
  toggleLocked: (id: string) => void
}

export type ViewPrefsStore = ViewPrefsState & ViewPrefsActions

/** Editor view-preference store (UI lane, never serialized). */
export const useViewPrefs = create<ViewPrefsStore>()((set) => ({
  hoverPreview: false,
  hiddenIds: new Set(),
  lockedIds: new Set(),
  toggleHoverPreview: () => set((s) => ({ hoverPreview: !s.hoverPreview })),
  setHoverPreview: (on) => set({ hoverPreview: on }),
  toggleHidden: (id) => set((s) => ({ hiddenIds: toggleInSet(s.hiddenIds, id) })),
  toggleLocked: (id) => set((s) => ({ lockedIds: toggleInSet(s.lockedIds, id) })),
}))
