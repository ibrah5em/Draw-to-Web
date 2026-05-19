import { describe, it, expect } from 'vitest'
import { inferSemantics } from '../../src/ui/canvas/inferSemantics'
import type { CanvasElement } from '../../src/store/elementStore'

function el(
  id: string,
  type: CanvasElement['type'],
  overrides: Partial<CanvasElement> = {}
): CanvasElement {
  return { id, type, x: 0, y: 200, width: 4, height: 80, props: {}, ...overrides }
}

describe('inferSemantics (C10 adapter)', () => {
  it('re-exports the engine inferSemantics with the correct signature', () => {
    expect(typeof inferSemantics).toBe('function')
    expect(inferSemantics([])).toEqual([])
  })

  describe('Hero preset semantic role', () => {
    // Hero preset: full-width rectangle at the top of the canvas
    // → classifyRectangle sees y≈0, width≥FULL_WIDTH_THRESHOLD → 'header'
    // ARIA mapping: semanticTag 'header' → role="banner" in the canvas renderer
    it('wide top rectangle gets semanticTag "header" (role="banner")', () => {
      const heroContainer = el('hero', 'rectangle', { y: 0, width: 12, height: 400 })
      const [result] = inferSemantics([heroContainer])
      expect(result.semanticTag).toBe('header')
    })

    it('hero semanticTag survives copy-paste (same element reproduced with a new id)', () => {
      const original = el('hero', 'rectangle', { y: 0, width: 12, height: 400 })
      const copy = { ...original, id: 'hero-copy' }
      const [result] = inferSemantics([copy])
      expect(result.semanticTag).toBe('header')
    })

    it('hero children are nested and preserve their own tags', () => {
      const hero = el('hero', 'rectangle', { y: 0, width: 12, height: 400 })
      const title = el('title', 'text', {
        x: 1,
        y: 50,
        width: 8,
        height: 60,
        props: { fontSize: 48 },
      })
      const sub = el('sub', 'text', { x: 1, y: 120, width: 8, height: 30, props: { fontSize: 16 } })
      const out = inferSemantics([hero, title, sub])
      const heroOut = out.find((e) => e.id === 'hero')
      expect(heroOut?.semanticTag).toBe('header')
      expect(heroOut?.children).toHaveLength(2)
      expect(heroOut?.children.find((c) => c.id === 'title')?.semanticTag).toBe('h1')
    })
  })
})
