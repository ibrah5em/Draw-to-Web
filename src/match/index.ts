/**
 * "Match my layout to a professional design" — public surface.
 *
 * Three isolated, pure pieces plus a thin reuse of the existing store
 * hydration path:
 *
 *   - `signature.ts` — `extractSignature(document)`: a pure, deterministic
 *     structural fingerprint of a document tree (never pixels).
 *   - `matcher.ts` — `matchLayout(userSignature, library)`: a pure, ranked
 *     best-first comparison with a debuggable per-dimension breakdown.
 *   - `library/` — bundled professional pages (ordinary documents) each
 *     shipping a build-time precomputed signature.
 *   - `adopt.ts` — the only store touch: hydrate a chosen page via the same
 *     entry point a `.dtw` load uses.
 *
 * The high-level flow: the user draws a rough layout (a document tree); call
 * {@link findLayoutMatches} to get the best match plus ranked alternatives;
 * the user picks one; `adoptLibraryPage` hydrates it as a normal document.
 */

import type { Document } from '../document/types'

import { librarySignatures } from './library'
import { matchLayout, type RankedMatch } from './matcher'
import { extractSignature } from './signature'

export type {
  ColumnProfile,
  LayoutSignature,
  RegionMap,
  RegionPosition,
  SectionKind,
  SectionSignature,
} from './signature'
export { extractSignature } from './signature'

export type { LibrarySignatureEntry, MatchBreakdown, MatchWeights, RankedMatch } from './matcher'
export { MATCH_WEIGHTS, matchLayout, scoreSignatures } from './matcher'

export type { LibraryPage } from './library'
export {
  buildLibraryDocumentById,
  getLibraryPage,
  librarySignatures,
  libraryPages,
} from './library'

export { adoptDocument, adoptLibraryPage } from './adopt'

/**
 * Rank the bundled design library against a user's drawn layout.
 *
 * Convenience wrapper: extracts the user document's signature and runs it
 * through {@link matchLayout} against the library's precomputed signatures.
 * Pure and deterministic; returns a best-first list so the UI can present
 * the top match plus alternatives.
 *
 * @param userDocument - The document (or anything with a `tree`) the user drew.
 * @returns A ranked, best-first list of {@link RankedMatch}.
 */
export function findLayoutMatches(userDocument: {
  readonly tree: Document['tree']
}): ReadonlyArray<RankedMatch> {
  return matchLayout(extractSignature(userDocument), librarySignatures)
}
