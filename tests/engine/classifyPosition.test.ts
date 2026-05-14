import { describe, it, expect } from 'vitest'
import {
  classifyRectangle,
  HEADER_Y_THRESHOLD,
  FULL_WIDTH_THRESHOLD,
  ASIDE_WIDTH_MAX,
  ASIDE_HEIGHT_MIN,
} from '../../src/engine/classifyPosition'
import type { CanvasElement } from '../../src/store/elementStore'

function rect(overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: 'r',
    type: 'rectangle',
    x: 0,
    y: 200,
    width: 4,
    height: 80,
    props: {},
    ...overrides,
  }
}

describe('classifyRectangle — header', () => {
  it('returns header when y < threshold and width >= full-width threshold', () => {
    expect(classifyRectangle(rect({ y: 0, width: FULL_WIDTH_THRESHOLD }), false, false)).toBe(
      'header'
    )
  })

  it('returns header at y = threshold - 1', () => {
    expect(classifyRectangle(rect({ y: HEADER_Y_THRESHOLD - 1, width: 12 }), false, false)).toBe(
      'header'
    )
  })

  it('does not return header when y >= threshold', () => {
    expect(classifyRectangle(rect({ y: HEADER_Y_THRESHOLD, width: 12 }), false, false)).not.toBe(
      'header'
    )
  })

  it('does not return header when width < full-width threshold', () => {
    expect(
      classifyRectangle(rect({ y: 0, width: FULL_WIDTH_THRESHOLD - 1 }), false, false)
    ).not.toBe('header')
  })
})

describe('classifyRectangle — footer', () => {
  it('returns footer when isBottomMost and width >= full-width threshold', () => {
    expect(classifyRectangle(rect({ y: 800, width: 12 }), false, true)).toBe('footer')
  })

  it('does not return footer when width < full-width threshold', () => {
    expect(
      classifyRectangle(rect({ y: 800, width: FULL_WIDTH_THRESHOLD - 1 }), false, true)
    ).not.toBe('footer')
  })

  it('does not return footer when not bottomMost', () => {
    expect(classifyRectangle(rect({ y: 800, width: 12 }), false, false)).not.toBe('footer')
  })
})

describe('classifyRectangle — aside', () => {
  it('returns aside for a narrow tall element at the left edge', () => {
    expect(
      classifyRectangle(
        rect({ x: 0, width: ASIDE_WIDTH_MAX, height: ASIDE_HEIGHT_MIN }),
        false,
        false
      )
    ).toBe('aside')
  })

  it('returns aside for a narrow tall element at the right edge', () => {
    expect(
      classifyRectangle(
        rect({ x: 12 - ASIDE_WIDTH_MAX, width: ASIDE_WIDTH_MAX, height: ASIDE_HEIGHT_MIN }),
        false,
        false
      )
    ).toBe('aside')
  })

  it('does not return aside when width exceeds max', () => {
    expect(
      classifyRectangle(
        rect({ x: 0, width: ASIDE_WIDTH_MAX + 1, height: ASIDE_HEIGHT_MIN }),
        false,
        false
      )
    ).not.toBe('aside')
  })

  it('does not return aside when height is below minimum', () => {
    expect(
      classifyRectangle(
        rect({ x: 0, width: ASIDE_WIDTH_MAX, height: ASIDE_HEIGHT_MIN - 1 }),
        false,
        false
      )
    ).not.toBe('aside')
  })

  it('does not return aside for a narrow tall element in the middle of the grid', () => {
    expect(
      classifyRectangle(
        rect({ x: 4, width: ASIDE_WIDTH_MAX, height: ASIDE_HEIGHT_MIN }),
        false,
        false
      )
    ).not.toBe('aside')
  })
})

describe('classifyRectangle — section and div', () => {
  it('returns section when rectangle has children', () => {
    expect(classifyRectangle(rect({ y: 200 }), true, false)).toBe('section')
  })

  it('returns div when no special conditions apply', () => {
    expect(classifyRectangle(rect({ x: 3, y: 200, width: 4, height: 80 }), false, false)).toBe(
      'div'
    )
  })
})
