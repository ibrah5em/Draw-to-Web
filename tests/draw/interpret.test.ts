/**
 * Gesture interpreter (`interpretRectangle`) — deterministic shape→kind
 * guessing, ranked alternatives, confidence, hints, and threshold respect.
 */

import { describe, expect, it } from 'vitest'

import {
  DEFAULT_INTERPRET_THRESHOLDS,
  interpretRectangle,
  KIND_ORDER,
  type DrawnElementKind,
  type RectangleShape,
} from '@draw/interpret'

const shape = (
  aspectRatio: number,
  widthFraction: number,
  heightFraction: number
): RectangleShape => ({ aspectRatio, widthFraction, heightFraction })

describe('interpretRectangle — best guess', () => {
  it('reads a wide, short rectangle as a heading', () => {
    expect(interpretRectangle(shape(6, 0.6, 0.06)).best).toBe('heading')
  })

  it('reads a large full-width box as a section', () => {
    expect(interpretRectangle(shape(3, 0.95, 0.5)).best).toBe('section')
  })

  it('reads a roughly-square box as an image', () => {
    expect(interpretRectangle(shape(1, 0.4, 0.4)).best).toBe('image')
  })

  it('falls back to a text block for a small medium rectangle', () => {
    expect(interpretRectangle(shape(2, 0.4, 0.15)).best).toBe('text')
  })

  it('only ever guesses one of the four structural kinds', () => {
    const guesses = [
      interpretRectangle(shape(6, 0.6, 0.06)).best,
      interpretRectangle(shape(3, 0.95, 0.5)).best,
      interpretRectangle(shape(1, 0.4, 0.4)).best,
      interpretRectangle(shape(2, 0.4, 0.15)).best,
    ]
    for (const g of guesses) expect(['heading', 'section', 'image', 'text']).toContain(g)
  })
})

describe('interpretRectangle — alternatives', () => {
  it('offers every other kind as an alternative, best excluded', () => {
    const guess = interpretRectangle(shape(6, 0.6, 0.06))
    expect(guess.alternatives).not.toContain(guess.best)
    expect(new Set<DrawnElementKind>([guess.best, ...guess.alternatives])).toEqual(
      new Set(KIND_ORDER)
    )
  })

  it('keeps alternatives in the stable KIND_ORDER (minus the best)', () => {
    const guess = interpretRectangle(shape(6, 0.6, 0.06)) // best = heading
    expect(guess.alternatives).toEqual(KIND_ORDER.filter((k) => k !== 'heading'))
  })

  it('exposes the new container/leaf kinds (card, group, button, list, divider)', () => {
    const all = new Set(KIND_ORDER)
    for (const k of ['card', 'group', 'button', 'list', 'divider'] as DrawnElementKind[]) {
      expect(all.has(k)).toBe(true)
    }
  })
})

describe('interpretRectangle — confidence + hint', () => {
  it('keeps confidence within [0, 1]', () => {
    for (const s of [
      shape(6, 0.6, 0.06),
      shape(3, 0.95, 0.5),
      shape(1, 0.4, 0.4),
      shape(2, 0.4, 0.15),
    ]) {
      const c = interpretRectangle(s).confidence
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(1)
    }
  })

  it('is more confident about a clear heading than a borderline one', () => {
    const strong = interpretRectangle(shape(9, 0.6, 0.04)).confidence
    const weak = interpretRectangle(shape(2.6, 0.6, 0.17)).confidence
    expect(strong).toBeGreaterThan(weak)
  })

  it('scores a near-perfect square higher than an oblong image', () => {
    const square = interpretRectangle(shape(1, 0.3, 0.3)).confidence
    const oblong = interpretRectangle(shape(1.35, 0.3, 0.25)).confidence
    expect(square).toBeGreaterThan(oblong)
  })

  it('gives the text fallback a modest baseline confidence', () => {
    expect(interpretRectangle(shape(2, 0.4, 0.15)).confidence).toBeCloseTo(0.5, 5)
  })

  it('carries a non-empty explainer hint for the guess', () => {
    expect(interpretRectangle(shape(6, 0.6, 0.06)).hint).toMatch(/heading/i)
    expect(interpretRectangle(shape(1, 0.4, 0.4)).hint).toMatch(/image/i)
  })
})

describe('interpretRectangle — thresholds + determinism', () => {
  it('respects the heading aspect threshold from the named constant', () => {
    const t = DEFAULT_INTERPRET_THRESHOLDS
    expect(interpretRectangle(shape(t.headingMinAspect - 0.1, 0.6, 0.05)).best).not.toBe('heading')
    expect(
      interpretRectangle(shape(t.headingMinAspect, 0.6, t.headingMaxHeightFraction)).best
    ).toBe('heading')
  })

  it('honours overridden thresholds', () => {
    const guess = interpretRectangle(shape(2, 0.4, 0.2), {
      ...DEFAULT_INTERPRET_THRESHOLDS,
      imageMaxAspect: 2.5,
    })
    expect(guess.best).toBe('image')
  })

  it('is deterministic: identical shape yields an identical result', () => {
    const s = shape(1.1, 0.3, 0.25)
    expect(interpretRectangle(s)).toEqual(interpretRectangle(s))
  })
})
