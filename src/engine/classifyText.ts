import type { ElementProps } from '../store/elementStore'
import type { SemanticTag } from './index'

export const H1_FONT_SIZE_MIN = 36
export const H2_FONT_SIZE_MIN = 24
export const H3_FONT_SIZE_MIN = 18

/**
 * Maps a text element's font size to the appropriate heading or paragraph tag.
 * Thresholds match docs/element-model.md.
 */
export function classifyText(props: ElementProps): SemanticTag {
  const size = props.fontSize ?? 16
  if (size >= H1_FONT_SIZE_MIN) return 'h1'
  if (size >= H2_FONT_SIZE_MIN) return 'h2'
  if (size >= H3_FONT_SIZE_MIN) return 'h3'
  return 'p'
}
