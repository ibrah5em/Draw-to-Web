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
      el({ id: 'aside', type: 'rectangle', y: 200, width: 2, height: 60 }),
      el({ id: 'f', type: 'rectangle', y: 600, width: 12, height: 80 }),
    ])
    expect(out.find((e) => e.id === 'f')?.semanticTag).toBe('footer')
    // 'mid' is the largest remaining rectangle, so it gets promoted to <main>;
    // 'aside' is the only one left as a plain <div>.
    expect(out.find((e) => e.id === 'mid')?.semanticTag).toBe('main')
    expect(out.find((e) => e.id === 'aside')?.semanticTag).toBe('div')
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

  it('upgrades a rectangle containing a horizontal row of buttons to <nav>', () => {
    const out = stubInferSemantics([
      el({ id: 'bar', type: 'rectangle', x: 0, y: 120, width: 12, height: 50 }),
      el({ id: 'b1', type: 'button', x: 1, y: 130, width: 2, height: 30 }),
      el({ id: 'b2', type: 'button', x: 4, y: 130, width: 2, height: 30 }),
      el({ id: 'b3', type: 'button', x: 7, y: 132, width: 2, height: 30 }),
      el({ id: 'f', type: 'rectangle', x: 0, y: 600, width: 12, height: 60 }),
    ])
    expect(out.find((e) => e.id === 'bar')?.semanticTag).toBe('nav')
    expect(out.find((e) => e.id === 'bar')?.children).toEqual([])
  })

  it('does not upgrade to <nav> when buttons are stacked vertically', () => {
    const out = stubInferSemantics([
      el({ id: 'col', type: 'rectangle', x: 0, y: 200, width: 4, height: 300 }),
      el({ id: 'b1', type: 'button', x: 1, y: 210, width: 2, height: 30 }),
      el({ id: 'b2', type: 'button', x: 1, y: 260, width: 2, height: 30 }),
    ])
    expect(out.find((e) => e.id === 'col')?.semanticTag).not.toBe('nav')
  })

  it('does not upgrade to <nav> when only one button is contained', () => {
    const out = stubInferSemantics([
      el({ id: 'r', type: 'rectangle', x: 0, y: 200, width: 6, height: 80 }),
      el({ id: 'b1', type: 'button', x: 1, y: 220, width: 2, height: 30 }),
    ])
    expect(out.find((e) => e.id === 'r')?.semanticTag).not.toBe('nav')
  })

  it('keeps <header> tag even when it contains a button row', () => {
    const out = stubInferSemantics([
      el({ id: 'h', type: 'rectangle', x: 0, y: 0, width: 12, height: 70 }),
      el({ id: 'b1', type: 'button', x: 6, y: 20, width: 2, height: 30 }),
      el({ id: 'b2', type: 'button', x: 9, y: 20, width: 2, height: 30 }),
    ])
    expect(out.find((e) => e.id === 'h')?.semanticTag).toBe('header')
  })

  it('promotes the largest remaining rectangle to <main>', () => {
    const out = stubInferSemantics([
      el({ id: 'h', type: 'rectangle', y: 0, width: 12, height: 80 }),
      el({ id: 'big', type: 'rectangle', y: 100, width: 10, height: 400 }),
      el({ id: 'small', type: 'rectangle', y: 100, width: 4, height: 80 }),
      el({ id: 'f', type: 'rectangle', y: 600, width: 12, height: 80 }),
    ])
    expect(out.find((e) => e.id === 'big')?.semanticTag).toBe('main')
    expect(out.find((e) => e.id === 'small')?.semanticTag).toBe('div')
  })

  it('promotes at most one rectangle to <main>', () => {
    const out = stubInferSemantics([
      el({ id: 'a', type: 'rectangle', y: 100, width: 4, height: 100 }),
      el({ id: 'b', type: 'rectangle', y: 250, width: 4, height: 100 }),
      el({ id: 'c', type: 'rectangle', y: 400, width: 4, height: 100 }),
    ])
    const mains = out.filter((e) => e.semanticTag === 'main')
    expect(mains).toHaveLength(1)
  })

  it('does not promote <nav> rectangles to <main>', () => {
    const out = stubInferSemantics([
      el({ id: 'navbar', type: 'rectangle', x: 0, y: 100, width: 12, height: 50 }),
      el({ id: 'b1', type: 'button', x: 1, y: 110, width: 2, height: 30 }),
      el({ id: 'b2', type: 'button', x: 4, y: 110, width: 2, height: 30 }),
      el({ id: 'body', type: 'rectangle', x: 0, y: 200, width: 10, height: 300 }),
      el({ id: 'f', type: 'rectangle', x: 0, y: 600, width: 12, height: 60 }),
    ])
    expect(out.find((e) => e.id === 'navbar')?.semanticTag).toBe('nav')
    expect(out.find((e) => e.id === 'body')?.semanticTag).toBe('main')
  })
})
