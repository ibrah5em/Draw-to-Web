/**
 * Design library — public surface.
 *
 * Joins the page registry (`pages.ts`) with the build-time precomputed
 * signatures (`signatures.generated.ts`) so the matcher can rank against
 * the library without walking any tree at runtime.
 */

import type { LibrarySignatureEntry } from '../matcher'

import { LIBRARY_SIGNATURES } from './signatures.generated'

export type { LibraryPage } from './pages'
export { libraryPages, getLibraryPage, buildLibraryDocumentById } from './pages'

/**
 * Precomputed `{ pageId, signature }` entries for every library page, in
 * registry order. This is exactly the shape `matchLayout` consumes, so the
 * matcher stays offline and fast.
 */
export const librarySignatures: ReadonlyArray<LibrarySignatureEntry> = LIBRARY_SIGNATURES
