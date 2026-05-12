/**
 * Placeholder semantic-inference implementation used by the export pipeline
 * and the live preview while `src/engine/index.ts` is still WIP.
 *
 * Owned by: Ibrahim — this is *not* Luf8y's engine. It is a deterministic
 * type → tag mapping derived from `docs/element-model.md`. Once Luf8y's
 * implementation lands, the fallback in `src/export/index.ts` stops firing
 * and this file can be deleted.
 *
 * Scope: covers the documented mappings minus features that require spatial
 * relationship analysis between elements (e.g. detecting "horizontal row of
 * links" → <nav>). Those degrade to <div>, which is correct but generic.
 */
import type { CanvasElement } from '../store/elementStore'
import type { SemanticElement, SemanticTag } from './index'

const HEADER_Y_THRESHOLD = 80
const FULL_WIDTH_THRESHOLD = 10 // grid columns
const H1_FONT_SIZE = 36
const H2_FONT_SIZE = 24
const H3_FONT_SIZE = 18

function numProp(props: Record<string, unknown>, key: string): number | undefined {
  const v = props[key]
  return typeof v === 'number' ? v : undefined
}

function inferTextTag(props: Record<string, unknown>): SemanticTag {
  const size = numProp(props, 'fontSize') ?? 16
  if (size >= H1_FONT_SIZE) return 'h1'
  if (size >= H2_FONT_SIZE) return 'h2'
  if (size >= H3_FONT_SIZE) return 'h3'
  return 'p'
}

/**
 * Picks the semantic tag for a rectangle based on position + size. The
 * "footer" decision needs to know which rectangle has the largest y, so it is
 * resolved at the array level — not here.
 */
function inferRectTag(el: CanvasElement, isBottom: boolean): SemanticTag {
  if (el.y < HEADER_Y_THRESHOLD && el.width >= FULL_WIDTH_THRESHOLD) return 'header'
  if (isBottom && el.width >= FULL_WIDTH_THRESHOLD) return 'footer'
  return 'div'
}

function annotate(el: CanvasElement, isBottom: boolean): SemanticElement {
  let semanticTag: SemanticTag
  switch (el.type) {
    case 'image':
      semanticTag = 'img'
      break
    case 'button':
      semanticTag = 'button'
      break
    case 'text':
      semanticTag = inferTextTag(el.props)
      break
    case 'rectangle':
      semanticTag = inferRectTag(el, isBottom)
      break
  }
  const result: SemanticElement = { ...el, semanticTag }
  // Containers default to no children — the stub does not perform nesting.
  if (semanticTag === 'header' || semanticTag === 'footer' || semanticTag === 'div') {
    result.children = []
  }
  return result
}

/**
 * Annotates each element with a semantic tag. Deterministic and order-stable:
 * the same input always produces the same output array in the same order.
 *
 * @param elements - Flat list of canvas elements from the store.
 */
export function stubInferSemantics(elements: CanvasElement[]): SemanticElement[] {
  if (elements.length === 0) return []

  // The footer candidate is the rectangle furthest down the page.
  let bottomIdx = -1
  let bottomY = -1
  for (let i = 0; i < elements.length; i += 1) {
    const el = elements[i]
    if (el.type !== 'rectangle') continue
    if (el.y > bottomY) {
      bottomY = el.y
      bottomIdx = i
    }
  }

  return elements.map((el, idx) => annotate(el, idx === bottomIdx))
}
