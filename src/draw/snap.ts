/**
 * Grid snapper — "draw to create elements".
 *
 * `snapToGrid(bounds, gridConfig, breakpoint)` is a **pure function**: it
 * takes a normalised drawn rectangle and the current breakpoint's column
 * geometry, and returns the nearest valid {@link GridPlacement} — a column
 * start, a column span, and an insertion index among existing siblings.
 *
 * The rectangle is expressed in fractions of the page box (`[0, 1]`), never
 * raw pixels (Invariant: the Document Model never carries pixel coordinates
 * or absolute positions). The output is a grid placement the caller writes
 * into `StyleBlock.gridColumn` as `"<start> / span <span>"` and an `index`
 * for the existing `insertElement` operation — so a freehand gesture becomes
 * an ordinary tree mutation.
 *
 * Pure and deterministic: same input → byte-identical placement. No store,
 * no React, no DOM imports — importable from any process.
 */

import type { BreakpointKey } from '../document/types'

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

/**
 * A drawn rectangle, normalised to the page box. Every field is a fraction
 * in `[0, 1]`: `x`/`y` are the top-left corner, `width`/`height` the extent.
 * Holds no pixels and no screen position — only where, proportionally, the
 * gesture landed on the page.
 */
export interface NormalizedRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Column count per editor breakpoint — the grid geometry to snap against. */
export interface ResponsiveColumns {
  readonly base: number
  readonly tablet: number
  readonly mobile: number
  readonly small: number
}

/**
 * Snapping configuration. `columns` is the column count per breakpoint;
 * `siblingCenters` are the normalised (`[0, 1]`) vertical centres of the
 * target parent's existing children, top-to-bottom, used to resolve where
 * the new element slots in vertically. Empty means "first child".
 */
export interface GridConfig {
  readonly columns: ResponsiveColumns
  readonly siblingCenters: ReadonlyArray<number>
}

/**
 * A resolved grid placement. `columnStart` is a 1-based grid line;
 * `columnSpan` is the number of columns occupied; `insertionIndex` is the
 * position among the parent's children for the `insertElement` op.
 */
export interface GridPlacement {
  readonly columnStart: number
  readonly columnSpan: number
  readonly insertionIndex: number
}

/**
 * Default column geometry: 12 columns at every breakpoint, matching the
 * editor's `repeat(12, 1fr)` grid overlay (`Canvas.module.css`) so the live
 * snap preview lines up with what the author sees. Override per project if
 * the overlay column count ever varies by breakpoint.
 */
export const DEFAULT_GRID_COLUMNS: ResponsiveColumns = {
  base: 12,
  tablet: 12,
  mobile: 12,
  small: 12,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Clamp `n` into the inclusive integer range `[min, max]`. */
function clampInt(n: number, min: number, max: number): number {
  const rounded = Math.round(n)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Snap a normalised drawn rectangle to the nearest valid grid placement.
 *
 * Column math: the left and right edges (`x` and `x + width`) are scaled by
 * the breakpoint's column count and rounded to the nearest grid line, then
 * clamped so the span is at least one column and never overflows the grid.
 * Vertical order: the rectangle's centre is compared against the existing
 * siblings' centres, and the insertion index is the count of siblings that
 * sit above it.
 *
 * Fully deterministic and side-effect free.
 *
 * @param bounds - The drawn rectangle, normalised to the page box (`[0, 1]`).
 * @param gridConfig - Column count per breakpoint plus existing sibling centres.
 * @param breakpoint - The active breakpoint selecting the column geometry.
 * @returns The nearest valid {@link GridPlacement}.
 */
export function snapToGrid(
  bounds: NormalizedRect,
  gridConfig: GridConfig,
  breakpoint: BreakpointKey
): GridPlacement {
  const columns = Math.max(1, Math.trunc(gridConfig.columns[breakpoint]))

  // Edges → grid lines. Line indexes are 0-based here (0 = left page edge,
  // `columns` = right page edge); convert the start to a 1-based grid line
  // at the end.
  const startLine = clampInt(bounds.x * columns, 0, columns - 1)
  const endLine = clampInt((bounds.x + bounds.width) * columns, startLine + 1, columns)

  const columnStart = startLine + 1
  const columnSpan = endLine - startLine

  // Vertical order: how many existing siblings sit above the drawn centre.
  const center = bounds.y + bounds.height / 2
  let insertionIndex = 0
  for (const siblingCenter of gridConfig.siblingCenters) {
    if (siblingCenter < center) insertionIndex += 1
  }

  return { columnStart, columnSpan, insertionIndex }
}

/**
 * Format a {@link GridPlacement} as the CSS `grid-column` value the document
 * model stores in `StyleBlock.gridColumn` (e.g. `"3 / span 6"`). This is the
 * only representation that touches the tree — the pixel rectangle never does.
 *
 * @param placement - A resolved grid placement.
 * @returns The `grid-column` shorthand string.
 */
export function gridColumnValue(placement: GridPlacement): string {
  return `${placement.columnStart} / span ${placement.columnSpan}`
}

/**
 * Count the columns declared by a `grid-template-columns` value so the drawer
 * can snap to a container's OWN grid rather than the page default. Handles
 * `repeat(N, …)` and space-separated track lists; returns `null` when the
 * value is absent or unparseable so the caller can fall back to its default.
 *
 * @param template - A `grid-template-columns` string (e.g. `"repeat(3, 1fr)"`).
 * @returns The column count, or `null` when it cannot be determined.
 */
export function columnsFromTemplate(template: string | undefined): number | null {
  if (!template) return null
  const repeat = /repeat\(\s*(\d+)\s*,/.exec(template)
  if (repeat) {
    const n = Number.parseInt(repeat[1]!, 10)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  // A `repeat()` whose count we couldn't read (auto-fill / auto-fit / an
  // expression) has no fixed column count — let the caller use its default
  // rather than mis-counting the inner track tokens.
  if (/repeat\s*\(/.test(template)) return null
  // Space-separated track list: count the non-empty tokens (ignoring the
  // bracketed line-name syntax `[name]`).
  const tokens = template
    .replace(/\[[^\]]*\]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  return tokens.length > 0 ? tokens.length : null
}
