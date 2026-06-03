/**
 * Marquee selection helpers (L-CAN-06).
 *
 * Pure rect-intersection logic kept out of the React component so it
 * can be unit-tested without a DOM harness.
 */

/** Axis-aligned rectangle in viewport pixel coordinates. */
export interface Rect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Build a {@link Rect} from a `mousedown` start and current pointer position. */
export function rectFromPoints(startX: number, startY: number, endX: number, endY: number): Rect {
  const x = Math.min(startX, endX)
  const y = Math.min(startY, endY)
  const width = Math.abs(endX - startX)
  const height = Math.abs(endY - startY)
  return { x, y, width, height }
}

/** `true` when `a` and `b` overlap on both axes (touching counts as intersect). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y
  )
}

/** Minimum pointer travel (px) before the marquee actually begins drawing. */
export const MARQUEE_ACTIVATION_PX = 4

/**
 * From the set of elements whose box intersected the marquee, keep only the
 * topmost element in each stack: drop any matched element that contains
 * another matched element (its ancestor containers and the page root).
 * Returns the surviving elements' `data-dtw-id`s in the input order.
 *
 * A rubber-band over a region intersects the leaves *and* every container
 * that wraps them; without this filter the selection would include those
 * ancestors and `main`, so a group move would double-apply.
 */
export function topmostMatches(matched: readonly Element[]): string[] {
  const ids: string[] = []
  for (const el of matched) {
    const hasMatchedDescendant = matched.some((other) => other !== el && el.contains(other))
    if (hasMatchedDescendant) continue
    const id = el.getAttribute('data-dtw-id')
    if (id) ids.push(id)
  }
  return ids
}
