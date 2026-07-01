/**
 * Layout matcher — scores a user's drawn layout against the bundled
 * library of professional page designs.
 *
 * `matchLayout(userSignature, library)` is a **pure function**: it takes the
 * signature of the user's rough sketch and a list of precomputed library
 * signatures, and returns a ranked, best-first list. Each result exposes a
 * per-dimension `breakdown` so the ranking is debuggable and testable.
 *
 * Scoring blends three independent dimensions, each normalised to `[0, 1]`:
 *
 *   1. **sequence** — same section types in the same vertical order
 *      (longest-common-subsequence over the `order` arrays).
 *   2. **region**  — do nav / hero / footer sit in the same place.
 *   3. **content** — same content mix (text↔media ratio + grid density).
 *
 * The blend weights live in {@link MATCH_WEIGHTS}, a single exported
 * constant so they are easy to tune against fixtures. The final score is
 * the weighted mean, so two identical signatures always score exactly `1`.
 *
 * No store, no React, no DOM — importable from any process.
 */

import type { ColumnProfile, LayoutSignature } from './signature'

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

/** Per-dimension sub-scores, each in `[0, 1]`. Exposed for debuggability. */
export interface MatchBreakdown {
  /** Section types in the same vertical order. */
  readonly sequence: number
  /** Landmarks (nav / hero / footer) in the same place. */
  readonly region: number
  /** Same content mix (text↔media ratio + grid density). */
  readonly content: number
}

/** A single ranked match between the user layout and a library page. */
export interface RankedMatch {
  /** Stable id of the matched library page. */
  readonly pageId: string
  /** Blended score in `[0, 1]`; higher is a better match. */
  readonly score: number
  /** Per-dimension sub-scores behind `score`. */
  readonly breakdown: MatchBreakdown
}

/** One library entry the matcher scores against: a page id + its signature. */
export interface LibrarySignatureEntry {
  readonly pageId: string
  readonly signature: LayoutSignature
}

/** Relative weights for the three scoring dimensions. */
export interface MatchWeights {
  readonly sequence: number
  readonly region: number
  readonly content: number
}

/**
 * Blend weights for the three scoring dimensions. Tuned against the library
 * fixtures; the final score is the weight-normalised mean so the absolute
 * magnitudes here only matter relative to one another. Order is the
 * strongest signal of "the same kind of page", so it carries the most
 * weight; content mix is the softest, so it carries the least.
 */
export const MATCH_WEIGHTS: MatchWeights = {
  sequence: 0.5,
  region: 0.3,
  content: 0.2,
}

/** Weighting inside the content dimension (ratio vs. grid-column density). */
const CONTENT_RATIO_WEIGHT = 0.6
const CONTENT_COLUMN_WEIGHT = 0.4

const COLUMN_BREAKPOINTS: ReadonlyArray<keyof ColumnProfile> = ['base', 'tablet', 'mobile', 'small']

// ---------------------------------------------------------------------------
// Dimension scorers
// ---------------------------------------------------------------------------

/** Clamp a number into `[0, 1]`. */
function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/** Length of the longest common subsequence of two arrays (cell-equality). */
function longestCommonSubsequence<T>(a: ReadonlyArray<T>, b: ReadonlyArray<T>): number {
  const m = a.length
  const n = b.length
  // dp[i][j] = LCS length of a[0..i) and b[0..j).
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Sequence dimension — how much of the section order the two layouts share,
 * order-preserving. LCS normalised by the longer sequence: identical orders
 * score `1`, fully disjoint orders score `0`.
 */
function scoreSequence(a: LayoutSignature, b: LayoutSignature): number {
  const longest = Math.max(a.order.length, b.order.length)
  if (longest === 0) return 1
  return clamp01(longestCommonSubsequence(a.order, b.order) / longest)
}

/** Score a single landmark slot: both absent → 1, one absent → 0, else proximity. */
function scoreRegionSlot(a: number | null, b: number | null): number {
  if (a === null && b === null) return 1
  if (a === null || b === null) return 0
  return clamp01(1 - Math.abs(a - b))
}

/**
 * Region dimension — do nav / hero / footer sit in the same place. Mean of
 * the three landmark-slot scores; identical region maps score `1`.
 */
function scoreRegion(a: LayoutSignature, b: LayoutSignature): number {
  const nav = scoreRegionSlot(a.regions.nav, b.regions.nav)
  const hero = scoreRegionSlot(a.regions.hero, b.regions.hero)
  const footer = scoreRegionSlot(a.regions.footer, b.regions.footer)
  return (nav + hero + footer) / 3
}

/** Similarity of two grid-column counts: `1 - |Δ| / max(a, b, 1)`. */
function columnSimilarity(a: number, b: number): number {
  const denom = Math.max(a, b, 1)
  return clamp01(1 - Math.abs(a - b) / denom)
}

/**
 * Content dimension — same content mix. Blends closeness of the text↔media
 * ratio with per-breakpoint grid-column similarity; identical mixes score
 * `1`.
 */
function scoreContent(a: LayoutSignature, b: LayoutSignature): number {
  const ratio = clamp01(1 - Math.abs(a.textToMediaRatio - b.textToMediaRatio))
  const columns =
    COLUMN_BREAKPOINTS.reduce(
      (sum, bp) => sum + columnSimilarity(a.columns[bp], b.columns[bp]),
      0
    ) / COLUMN_BREAKPOINTS.length
  return clamp01(CONTENT_RATIO_WEIGHT * ratio + CONTENT_COLUMN_WEIGHT * columns)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Score one user signature against one library signature, returning the
 * blended score and the per-dimension breakdown. Exposed for testing the
 * scoring in isolation; `matchLayout` calls it for every library entry.
 *
 * @param user - Signature of the user's drawn layout.
 * @param candidate - Signature of a library page.
 * @param weights - Blend weights; defaults to {@link MATCH_WEIGHTS}.
 * @returns The blended `score` (weight-normalised mean, `[0, 1]`) and its
 *   `breakdown` sub-scores.
 */
export function scoreSignatures(
  user: LayoutSignature,
  candidate: LayoutSignature,
  weights: MatchWeights = MATCH_WEIGHTS
): { readonly score: number; readonly breakdown: MatchBreakdown } {
  const breakdown: MatchBreakdown = {
    sequence: scoreSequence(user, candidate),
    region: scoreRegion(user, candidate),
    content: scoreContent(user, candidate),
  }
  const weightSum = weights.sequence + weights.region + weights.content
  const weighted =
    weights.sequence * breakdown.sequence +
    weights.region * breakdown.region +
    weights.content * breakdown.content
  const score = weightSum === 0 ? 0 : clamp01(weighted / weightSum)
  return { score, breakdown }
}

/**
 * Rank a library of professional page designs against the user's drawn
 * layout, best-first.
 *
 * Pure and deterministic: for each library entry it computes the blended
 * {@link scoreSignatures} score, then sorts descending by score with a
 * stable `pageId` tie-break (so equal scores always rank in a fixed order).
 * A user layout whose signature equals a library page's signature scores
 * that page `1` and ranks it first.
 *
 * @param userSignature - Signature of the user's drawn layout.
 * @param librarySignatures - Library entries (id + precomputed signature).
 * @param weights - Blend weights; defaults to {@link MATCH_WEIGHTS}.
 * @returns A ranked, best-first list of {@link RankedMatch} — never a single
 *   answer, so the UI can show the best match plus alternatives.
 */
export function matchLayout(
  userSignature: LayoutSignature,
  librarySignatures: ReadonlyArray<LibrarySignatureEntry>,
  weights: MatchWeights = MATCH_WEIGHTS
): ReadonlyArray<RankedMatch> {
  return librarySignatures
    .map((entry): RankedMatch => {
      const { score, breakdown } = scoreSignatures(userSignature, entry.signature, weights)
      return { pageId: entry.pageId, score, breakdown }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.pageId < b.pageId ? -1 : a.pageId > b.pageId ? 1 : 0
    })
}
