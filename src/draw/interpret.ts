/**
 * Gesture interpreter — "draw to create elements".
 *
 * `interpretRectangle(shape, thresholds)` is a **pure function**: given the
 * shape of a drawn rectangle, it guesses which kind of element the author
 * meant and returns a best guess, ranked alternatives, a confidence score,
 * and a one-line explainer hint for the correction UI.
 *
 * The input is shape only — aspect ratio and size as fractions of the target
 * box — never raw pixels tied to a screen position (Invariant: the gesture's
 * pixel coordinates never leave the UI). Recognition is fuzzy by nature: the
 * best guess only needs to be reasonable, because the user can switch to any
 * kind in one click.
 *
 * Rule-based, simple, deterministic. The heuristics live in named constants
 * ({@link DEFAULT_INTERPRET_THRESHOLDS}) so they are easy to tune against
 * fixtures. No store, no React, no DOM imports — importable from any process.
 */

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

/**
 * The element kinds the draw gesture can produce. The interpreter's best
 * guess is always one of the four structural kinds (`heading` / `section` /
 * `image` / `text`); the rest are offered as one-click alternatives. Each
 * maps onto an ordinary primitive in the wiring layer, so a guess never
 * becomes a bespoke node type.
 */
export type DrawnElementKind =
  | 'section'
  | 'group'
  | 'card'
  | 'heading'
  | 'text'
  | 'image'
  | 'button'
  | 'list'
  | 'divider'

/** The kinds the heuristics can pick as a best guess (shape is suggestive). */
export type GuessableKind = Extract<DrawnElementKind, 'heading' | 'section' | 'image' | 'text'>

/**
 * Stable presentation order for the picker. The best guess is pulled to the
 * front; the remainder follow in this order so the alternative list is
 * deterministic and sensible (structural kinds first, leaves last).
 */
export const KIND_ORDER: ReadonlyArray<DrawnElementKind> = [
  'section',
  'group',
  'card',
  'heading',
  'text',
  'image',
  'button',
  'list',
  'divider',
]

/**
 * Shape of a drawn rectangle, free of screen position. `aspectRatio` is
 * pixel width ÷ pixel height; `widthFraction` / `heightFraction` are the
 * extent as a fraction (`[0, 1]`) of the target box. These three numbers are
 * all the interpreter needs.
 */
export interface RectangleShape {
  readonly aspectRatio: number
  readonly widthFraction: number
  readonly heightFraction: number
}

/**
 * A best guess plus ranked alternatives, a confidence score, and a hint.
 * `best` is the interpreter's pick; `alternatives` are every other kind in
 * presentation order; `confidence` (`[0, 1]`) is how strongly the shape
 * matched; `hint` explains the guess in one line.
 */
export interface ElementTypeGuess {
  readonly best: GuessableKind
  readonly alternatives: ReadonlyArray<DrawnElementKind>
  readonly confidence: number
  readonly hint: string
}

/** Tunable thresholds behind the heuristics. */
export interface InterpretThresholds {
  /** A heading is wide: aspect ratio at or above this. */
  readonly headingMinAspect: number
  /** A heading is short: height fraction at or below this. */
  readonly headingMaxHeightFraction: number
  /** A section is full-width-ish: width fraction at or above this. */
  readonly sectionMinWidthFraction: number
  /** A section is large: height fraction at or above this. */
  readonly sectionMinHeightFraction: number
  /** An image is roughly square: aspect ratio within `[min, max]`. */
  readonly imageMinAspect: number
  readonly imageMaxAspect: number
}

/**
 * Default heuristics, tuned to be reasonable starting points (the gesture is
 * fuzzy; the picker corrects misses). Wide-and-short reads as a heading; a
 * big full-width box as a section; a roughly-square box as an image;
 * everything else as a text block.
 */
export const DEFAULT_INTERPRET_THRESHOLDS: InterpretThresholds = {
  headingMinAspect: 2.5,
  headingMaxHeightFraction: 0.18,
  sectionMinWidthFraction: 0.8,
  sectionMinHeightFraction: 0.3,
  imageMinAspect: 0.7,
  imageMaxAspect: 1.4,
}

/** One-line explainer per guessable kind, surfaced in the picker. */
const HINTS: Readonly<Record<GuessableKind, string>> = {
  heading: 'Wide and short — reads as a heading',
  section: 'Large and full-width — reads as a section',
  image: 'Roughly square — reads as an image',
  text: 'Medium block — defaulting to text',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp a number into `[0, 1]`. */
function clamp01(n: number): number {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

/** Round to two decimals so confidence is stable and display-friendly. */
function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Pick the best {@link GuessableKind} for a rectangle shape. Rules are checked
 * in priority order: heading (wide + short) → section (large + full-width) →
 * image (roughly square) → text (the catch-all).
 */
function bestGuess(shape: RectangleShape, t: InterpretThresholds): GuessableKind {
  if (
    shape.aspectRatio >= t.headingMinAspect &&
    shape.heightFraction <= t.headingMaxHeightFraction
  ) {
    return 'heading'
  }
  if (
    shape.widthFraction >= t.sectionMinWidthFraction &&
    shape.heightFraction >= t.sectionMinHeightFraction
  ) {
    return 'section'
  }
  if (shape.aspectRatio >= t.imageMinAspect && shape.aspectRatio <= t.imageMaxAspect) {
    return 'image'
  }
  return 'text'
}

/**
 * Confidence in `[0, 1]` for the chosen kind: how central the shape sits
 * inside its rule's region. Stronger aspect / size signals score higher; the
 * `text` fallback scores a deliberately modest baseline so the UI nudges the
 * user to confirm.
 */
function confidenceFor(best: GuessableKind, shape: RectangleShape, t: InterpretThresholds): number {
  switch (best) {
    case 'heading':
      return round2(clamp01(0.65 + 0.1 * Math.min(3, shape.aspectRatio - t.headingMinAspect)))
    case 'section':
      return round2(
        clamp01(
          0.6 +
            0.4 *
              ((shape.widthFraction - t.sectionMinWidthFraction) / (1 - t.sectionMinWidthFraction))
        )
      )
    case 'image':
      return round2(clamp01(0.9 - Math.abs(1 - shape.aspectRatio)))
    case 'text':
      return 0.5
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Interpret a drawn rectangle into a best element-kind guess, ranked
 * alternatives, a confidence score, and an explainer hint.
 *
 * Pure and deterministic: same shape (and thresholds) → identical result. The
 * guess is intentionally fuzzy — it only needs to be reasonable, since the
 * caller surfaces every other kind for one-click correction.
 *
 * @param shape - The drawn rectangle's shape (aspect ratio + size fractions).
 * @param thresholds - Heuristic thresholds; defaults to
 *   {@link DEFAULT_INTERPRET_THRESHOLDS}.
 * @returns The best {@link GuessableKind}, the remaining kinds in presentation
 *   order, a `confidence` in `[0, 1]`, and a one-line `hint`.
 */
export function interpretRectangle(
  shape: RectangleShape,
  thresholds: InterpretThresholds = DEFAULT_INTERPRET_THRESHOLDS
): ElementTypeGuess {
  const best = bestGuess(shape, thresholds)
  return {
    best,
    alternatives: KIND_ORDER.filter((k) => k !== best),
    confidence: confidenceFor(best, shape, thresholds),
    hint: HINTS[best],
  }
}
