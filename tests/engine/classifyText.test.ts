import { describe, it, expect } from 'vitest'
import {
  classifyText,
  H1_FONT_SIZE_MIN,
  H2_FONT_SIZE_MIN,
  H3_FONT_SIZE_MIN,
} from '../../src/engine/classifyText'

describe('classifyText', () => {
  it('returns h1 at the H1 threshold', () => {
    expect(classifyText({ fontSize: H1_FONT_SIZE_MIN })).toBe('h1')
  })

  it('returns h1 above the H1 threshold', () => {
    expect(classifyText({ fontSize: 72 })).toBe('h1')
  })

  it('returns h2 at the H2 threshold', () => {
    expect(classifyText({ fontSize: H2_FONT_SIZE_MIN })).toBe('h2')
  })

  it('returns h2 just below the H1 threshold', () => {
    expect(classifyText({ fontSize: H1_FONT_SIZE_MIN - 1 })).toBe('h2')
  })

  it('returns h3 at the H3 threshold', () => {
    expect(classifyText({ fontSize: H3_FONT_SIZE_MIN })).toBe('h3')
  })

  it('returns h3 just below the H2 threshold', () => {
    expect(classifyText({ fontSize: H2_FONT_SIZE_MIN - 1 })).toBe('h3')
  })

  it('returns p just below the H3 threshold', () => {
    expect(classifyText({ fontSize: H3_FONT_SIZE_MIN - 1 })).toBe('p')
  })

  it('returns p for small body text', () => {
    expect(classifyText({ fontSize: 14 })).toBe('p')
  })

  it('returns p when fontSize is not set (defaults to 16)', () => {
    expect(classifyText({})).toBe('p')
  })
})
