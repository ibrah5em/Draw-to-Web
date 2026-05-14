/**
 * Placeholder semantic-inference implementation used by the export pipeline
 * and the live preview while `src/engine/index.ts` is still WIP.
 *
 * Owned by: Ibrahim — this is *not* Yousef's engine. It is a deterministic
 * type → tag mapping derived from `docs/element-model.md`. Once Yousef's
 * implementation lands, the fallback in `src/export/index.ts` stops firing
 * and this file can be deleted.
 *
 * Scope: covers the documented mappings including light spatial analysis for
 * `<nav>` (rectangle containing a horizontal row of buttons) and `<main>`
 * (largest remaining rectangle after header/footer/nav are claimed). True
 * tree nesting still lives in Yousef's engine — the stub returns a flat list.
 */
import type { CanvasElement, ElementProps } from '../store/elementStore'
import type { SemanticElement, SemanticTag } from './index'

const HEADER_Y_THRESHOLD = 80
const FULL_WIDTH_THRESHOLD = 10 // grid columns
const H1_FONT_SIZE = 36
const H2_FONT_SIZE = 24
const H3_FONT_SIZE = 18
const NAV_MIN_BUTTONS = 2
const NAV_ROW_Y_TOLERANCE = 20 // pixels — buttons within this Y range count as a row

function inferTextTag(props: ElementProps): SemanticTag {
  const size = props.fontSize ?? 16
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
  // children is always present (required by SemanticElement contract).
  return { ...el, semanticTag, children: [] }
}

/** Grid-and-pixel containment: child sits fully inside parent's bounding box. */
function rectContains(parent: CanvasElement, child: CanvasElement): boolean {
  return (
    child.x >= parent.x &&
    child.x + child.width <= parent.x + parent.width &&
    child.y >= parent.y &&
    child.y + child.height <= parent.y + parent.height
  )
}

/**
 * True when the rectangle spatially contains ≥2 buttons aligned horizontally
 * (similar Y, distinct X). Mirrors the docs' "children are a horizontal link
 * row" condition without requiring real parent/child nesting.
 */
function containsButtonRow(rect: CanvasElement, all: CanvasElement[]): boolean {
  const buttons = all.filter((e) => e.type === 'button' && rectContains(rect, e))
  if (buttons.length < NAV_MIN_BUTTONS) return false
  const ys = buttons.map((b) => b.y)
  if (Math.max(...ys) - Math.min(...ys) > NAV_ROW_Y_TOLERANCE) return false
  const xs = new Set(buttons.map((b) => b.x))
  return xs.size === buttons.length
}

function area(el: CanvasElement): number {
  return el.width * el.height
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

  const annotated = elements.map((el, idx) => annotate(el, idx === bottomIdx))

  // Second pass: upgrade <div> rectangles to <nav> if they contain a button row.
  // Header/footer keep their tag — the docs treat them as separate categories.
  for (let i = 0; i < annotated.length; i += 1) {
    if (annotated[i].semanticTag !== 'div') continue
    if (containsButtonRow(annotated[i], elements)) {
      annotated[i] = { ...annotated[i], semanticTag: 'nav', children: [] }
    }
  }

  // Third pass: the largest remaining <div> by area becomes <main>. HTML5
  // permits at most one <main>, so we promote a single element. Ties resolve
  // by input order via the strict `>` comparison.
  let mainIdx = -1
  let mainArea = -1
  for (let i = 0; i < annotated.length; i += 1) {
    if (annotated[i].semanticTag !== 'div') continue
    const a = area(annotated[i])
    if (a > mainArea) {
      mainArea = a
      mainIdx = i
    }
  }
  if (mainIdx !== -1) {
    annotated[mainIdx] = { ...annotated[mainIdx], semanticTag: 'main', children: [] }
  }

  return annotated
}
