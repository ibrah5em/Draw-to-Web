import { describe, expect, it } from 'vitest'

import { collectVariableNames, interpolate } from '../../src/document/variables'

describe('interpolate (I-DOC-08)', () => {
  it('substitutes a single placeholder', () => {
    expect(interpolate('© {{year}}', { year: '2026' })).toBe('© 2026')
  })

  it('substitutes multiple placeholders in one pass', () => {
    expect(interpolate('{{greeting}}, {{name}}', { greeting: 'Hello', name: 'Ibrahim' })).toBe(
      'Hello, Ibrahim'
    )
  })

  it('leaves unknown placeholders intact so authors notice', () => {
    expect(interpolate('Contact {{email}}', {})).toBe('Contact {{email}}')
  })

  it('tolerates internal whitespace', () => {
    expect(interpolate('{{  year  }}', { year: '2026' })).toBe('2026')
  })

  it('does not recursively expand a value that itself contains a placeholder', () => {
    // `name` resolves to a literal string; we never re-scan the result.
    expect(interpolate('Hello {{name}}', { name: '{{year}}', year: '2026' })).toBe('Hello {{year}}')
  })

  it('returns the template unchanged when there are no placeholders', () => {
    expect(interpolate('plain text', { x: 'y' })).toBe('plain text')
  })
})

describe('collectVariableNames', () => {
  it('returns every referenced variable name', () => {
    const names = collectVariableNames('© {{year}} {{author}}')
    expect([...names].sort()).toEqual(['author', 'year'])
  })

  it('deduplicates repeated references', () => {
    const names = collectVariableNames('{{x}} and {{x}}')
    expect([...names]).toEqual(['x'])
  })

  it('returns an empty set when nothing matches', () => {
    expect([...collectVariableNames('no placeholders here')]).toEqual([])
  })
})
