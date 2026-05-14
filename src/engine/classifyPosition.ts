import type { CanvasElement } from '../store/elementStore'
import type { SemanticTag } from './index'

export const HEADER_Y_THRESHOLD = 80
export const FULL_WIDTH_THRESHOLD = 10
export const ASIDE_WIDTH_MAX = 3
export const ASIDE_HEIGHT_MIN = 150

/**
 * Maps a rectangle element to a semantic container tag.
 * Rules are evaluated in priority order — first match wins.
 *
 * @param el - The rectangle element to classify.
 * @param hasChildren - True if the element contains at least one other element.
 * @param isBottomMost - True if this is the lowest rectangle on the canvas (footer candidate).
 */
export function classifyRectangle(
  el: CanvasElement,
  hasChildren: boolean,
  isBottomMost: boolean
): SemanticTag {
  // Header: near the top of the page and spanning most of the width.
  if (el.y < HEADER_Y_THRESHOLD && el.width >= FULL_WIDTH_THRESHOLD) return 'header'

  // Footer: furthest down the canvas and spanning most of the width.
  if (isBottomMost && el.width >= FULL_WIDTH_THRESHOLD) return 'footer'

  // Aside: hugging a side edge, narrow, and tall enough to be a sidebar.
  const atLeftEdge = el.x === 0
  const atRightEdge = el.x + el.width >= 12
  if ((atLeftEdge || atRightEdge) && el.width <= ASIDE_WIDTH_MAX && el.height >= ASIDE_HEIGHT_MIN) {
    return 'aside'
  }

  // Section: any rectangle that contains child elements.
  if (hasChildren) return 'section'

  return 'div'
}
