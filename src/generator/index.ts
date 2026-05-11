import type { SemanticElement } from '../engine'

export interface GeneratedOutput {
  html: string
  css: string
}

/**
 * Traverses the semantic element tree and emits HTML + CSS strings.
 * Generated HTML contains no JavaScript. Layout uses CSS Grid/Flexbox only.
 * @param elements - Semantic element tree from the inference engine
 */
export function generate(_elements: SemanticElement[]): GeneratedOutput {
  throw new Error('Not implemented')
}
