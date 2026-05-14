import { describe, it, expect } from 'vitest'
import { inferSemantics } from '../../src/engine/index'
import type { CanvasElement } from '../../src/store/elementStore'

function el(
  id: string,
  type: CanvasElement['type'],
  overrides: Partial<CanvasElement> = {}
): CanvasElement {
  return { id, type, x: 0, y: 200, width: 4, height: 80, props: {}, ...overrides }
}

describe('inferSemantics', () => {
  it('returns an empty array for empty input', () => {
    expect(inferSemantics([])).toEqual([])
  })

  it('is deterministic: same input produces the same output', () => {
    const input = [
      el('h', 'rectangle', { y: 0, width: 12, height: 80 }),
      el('t', 'text', { props: { fontSize: 48 } }),
      el('b', 'button'),
    ]
    expect(inferSemantics(input)).toEqual(inferSemantics(input))
  })

  it('all returned elements have a children array (never undefined)', () => {
    const input = [el('a', 'text'), el('b', 'image'), el('c', 'button')]
    for (const node of inferSemantics(input)) {
      expect(Array.isArray(node.children)).toBe(true)
    }
  })

  describe('basic tag mapping', () => {
    it('maps image → img', () => {
      const [result] = inferSemantics([el('i', 'image')])
      expect(result.semanticTag).toBe('img')
    })

    it('maps button → button', () => {
      const [result] = inferSemantics([el('b', 'button')])
      expect(result.semanticTag).toBe('button')
    })

    it('maps large text → h1', () => {
      const [result] = inferSemantics([el('t', 'text', { props: { fontSize: 48 } })])
      expect(result.semanticTag).toBe('h1')
    })

    it('maps small text → p', () => {
      const [result] = inferSemantics([el('t', 'text', { props: { fontSize: 14 } })])
      expect(result.semanticTag).toBe('p')
    })

    it('maps wide top rectangle → header', () => {
      const [result] = inferSemantics([el('h', 'rectangle', { y: 0, width: 12, height: 80 })])
      expect(result.semanticTag).toBe('header')
    })

    it('maps bottommost wide rectangle → footer', () => {
      const out = inferSemantics([
        el('h', 'rectangle', { y: 0, width: 12, height: 80 }),
        el('f', 'rectangle', { y: 700, width: 12, height: 80 }),
      ])
      expect(out.find((e) => e.id === 'f')?.semanticTag).toBe('footer')
    })

    it('maps narrow tall left-edge rectangle → aside', () => {
      const [result] = inferSemantics([
        el('s', 'rectangle', { x: 0, y: 100, width: 3, height: 300 }),
      ])
      expect(result.semanticTag).toBe('aside')
    })

    it('maps rectangle containing another element → section', () => {
      // width=8 keeps it below FULL_WIDTH_THRESHOLD so footer rule doesn't fire
      const out = inferSemantics([
        el('parent', 'rectangle', { x: 2, y: 100, width: 8, height: 400 }),
        el('child', 'text', { x: 3, y: 150, width: 4, height: 40, props: { fontSize: 14 } }),
      ])
      expect(out.find((e) => e.id === 'parent')?.semanticTag).toBe('section')
    })

    it('maps plain mid-canvas rectangle → div', () => {
      const [result] = inferSemantics([
        el('d', 'rectangle', { x: 2, y: 200, width: 4, height: 80 }),
      ])
      expect(result.semanticTag).toBe('div')
    })
  })

  describe('containment tree', () => {
    it('nests children under their container', () => {
      const out = inferSemantics([
        el('parent', 'rectangle', { x: 2, y: 100, width: 8, height: 400 }),
        el('child', 'text', { x: 3, y: 150, width: 4, height: 40, props: { fontSize: 14 } }),
      ])
      const parent = out.find((e) => e.id === 'parent')
      expect(parent?.children).toHaveLength(1)
      expect(parent?.children[0].id).toBe('child')
      // child should not appear at root level
      expect(out.find((e) => e.id === 'child')).toBeUndefined()
    })

    it('returns root-level elements in document order (top → bottom, left → right)', () => {
      const out = inferSemantics([
        el('b', 'button', { x: 4, y: 100 }),
        el('a', 'image', { x: 0, y: 100 }),
        el('c', 'text', { x: 0, y: 300, props: { fontSize: 14 } }),
      ])
      expect(out.map((e) => e.id)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('typical page layout', () => {
    it('full page with header, content section, footer', () => {
      const input: CanvasElement[] = [
        { id: 'hdr', type: 'rectangle', x: 0, y: 0, width: 12, height: 80, props: {} },
        { id: 'title', type: 'text', x: 1, y: 90, width: 6, height: 50, props: { fontSize: 40 } },
        { id: 'body', type: 'text', x: 1, y: 160, width: 8, height: 30, props: { fontSize: 14 } },
        { id: 'ftr', type: 'rectangle', x: 0, y: 700, width: 12, height: 80, props: {} },
      ]
      const out = inferSemantics(input)
      expect(out.find((e) => e.id === 'hdr')?.semanticTag).toBe('header')
      expect(out.find((e) => e.id === 'title')?.semanticTag).toBe('h1')
      expect(out.find((e) => e.id === 'body')?.semanticTag).toBe('p')
      expect(out.find((e) => e.id === 'ftr')?.semanticTag).toBe('footer')
    })
  })
})
