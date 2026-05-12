import { describe, it, expect } from 'vitest'
import { stubInferSemantics } from '../../src/engine/stubInfer'
import type { CanvasElement } from '../../src/store/elementStore'

function el(overrides: Partial<CanvasElement> & Pick<CanvasElement, 'type'>): CanvasElement {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    type: overrides.type,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    width: overrides.width ?? 4,
    height: overrides.height ?? 40,
    props: overrides.props ?? {},
  }
}

describe('stubInferSemantics', () => {
  it('returns an empty array for an empty input', () => {
    expect(stubInferSemantics([])).toEqual([])
  })

  it('maps wide top-of-canvas rectangles to <header>', () => {
    const [result] = stubInferSemantics([el({ type: 'rectangle', y: 0, width: 12, height: 80 })])
    expect(result.semanticTag).toBe('header')
  })

  it('maps the bottom-most full-width rectangle to <footer>', () => {
    const out = stubInferSemantics([
      el({ id: 'h', type: 'rectangle', y: 0, width: 12, height: 80 }),
      el({ id: 'mid', type: 'rectangle', y: 200, width: 8, height: 100 }),
      el({ id: 'f', type: 'rectangle', y: 600, width: 12, height: 80 }),
    ])
    expect(out.find((e) => e.id === 'f')?.semanticTag).toBe('footer')
    expect(out.find((e) => e.id === 'mid')?.semanticTag).toBe('div')
  })

  it('maps text elements by font size: ≥36 → h1, ≥24 → h2, ≥18 → h3, else p', () => {
    const out = stubInferSemantics([
      el({ id: 'a', type: 'text', props: { fontSize: 48 } }),
      el({ id: 'b', type: 'text', props: { fontSize: 28 } }),
      el({ id: 'c', type: 'text', props: { fontSize: 20 } }),
      el({ id: 'd', type: 'text', props: { fontSize: 14 } }),
      el({ id: 'e', type: 'text', props: {} }),
    ])
    expect(out.map((e) => e.semanticTag)).toEqual(['h1', 'h2', 'h3', 'p', 'p'])
  })

  it('always maps images to <img> and buttons to <button>', () => {
    const out = stubInferSemantics([el({ type: 'image' }), el({ type: 'button' })])
    expect(out.map((e) => e.semanticTag)).toEqual(['img', 'button'])
  })

  it('is order-stable: the output array matches the input order', () => {
    const input = [
      el({ id: '1', type: 'text', props: { fontSize: 14 } }),
      el({ id: '2', type: 'button' }),
      el({ id: '3', type: 'image' }),
    ]
    const out = stubInferSemantics(input)
    expect(out.map((e) => e.id)).toEqual(['1', '2', '3'])
  })

  it('attaches empty children arrays to container tags', () => {
    const out = stubInferSemantics([
      el({ id: 'h', type: 'rectangle', y: 0, width: 12, height: 80 }),
      el({ id: 'd', type: 'rectangle', y: 200, width: 4, height: 40 }),
    ])
    expect(out[0].children).toEqual([])
    expect(out[1].children).toEqual([])
  })
})
