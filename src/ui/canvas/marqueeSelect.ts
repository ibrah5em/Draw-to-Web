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
