/**
 * Adopt a matched design — the "edit half" of the feature.
 *
 * This is the ONLY place the match feature touches the editor stores, and
 * it does so through the SAME hydration entry point a `.dtw` load uses
 * (`src/store/persistence.ts` → `openProject`): replace the document, clear
 * the history timeline, drop the stale selection. There is deliberately no
 * content-transplant or remapping engine — a library page is already an
 * ordinary {@link Document}, so adopting it is just hydrating it. After
 * this call the page is a normal, fully-editable document.
 */

import type { Document } from '../document/types'
import { useDocumentStore } from '../store/documentStore'
import { useHistoryStore } from '../store/historyStore'
import { useSessionStore } from '../store/sessionStore'

import { buildLibraryDocumentById } from './library'

/**
 * Hydrate a document into the editor as the active project — the reused
 * store trio from the `.dtw` load path. `hydrate` replaces the document and
 * clears the dirty flag; `clear` resets undo/redo so the user cannot undo
 * back into the previous project; `clearSelection` drops selection ids that
 * pointed at the old tree. Panel sizes, breakpoint, state, and theme are
 * preserved (they are editor preferences, not document data).
 *
 * @param document - The document to load into the editor.
 */
export function adoptDocument(document: Document): void {
  useDocumentStore.getState().hydrate(document)
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()
}

/**
 * Build a fresh document for the chosen library page and adopt it into the
 * editor via {@link adoptDocument}. Returns the hydrated document so callers
 * can surface its name or seed an "unsaved" indicator.
 *
 * @param pageId - Stable id of the library page the user chose.
 * @returns The freshly built, now-active {@link Document}.
 * @throws If no library page has the given id.
 */
export function adoptLibraryPage(pageId: string): Document {
  const document = buildLibraryDocumentById(pageId)
  adoptDocument(document)
  return document
}
