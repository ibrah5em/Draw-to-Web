import { describe, expect, it } from 'vitest'

import { isTokenRef, parseTokenRef, resolveToken } from '../../src/document/tokens'
import type { Tokens } from '../../src/document/types'

const tokens: Tokens = {
  color: [
    { id: 'accent', name: 'Accent', value: { light: '#3b82f6', dark: '#60a5fa' } },
    { id: 'fg', name: 'Foreground', value: { light: '#0a0a0a', dark: '#f5f5f5' } },
  ],
  spacing: [{ id: 'md', name: 'Medium', value: '1rem' }],
  fontSize: [{ id: 'body', name: 'Body', value: 'clamp(1rem, 1.5vw, 1.125rem)' }],
  fontFamily: [],
  lineHeight: [],
  radius: [],
  shadow: [],
}

describe('isTokenRef', () => {
  it.each(['color.accent', 'spacing.md', 'fontSize.body'])('accepts %s', (ref) => {
    expect(isTokenRef(ref)).toBe(true)
  })

  it.each(['color', 'color.', '.accent', 'bogus.x', 42, null, undefined, '#3b82f6'])(
    'rejects %p',
    (value) => {
      expect(isTokenRef(value)).toBe(false)
    }
  )
})

describe('parseTokenRef', () => {
  it('splits category and id', () => {
    expect(parseTokenRef('color.accent')).toEqual({ category: 'color', id: 'accent' })
    expect(parseTokenRef('spacing.md')).toEqual({ category: 'spacing', id: 'md' })
  })
})

describe('resolveToken (C9)', () => {
  it('returns the light variant for color tokens in light theme', () => {
    expect(resolveToken(tokens, 'color.accent', 'light')).toBe('#3b82f6')
  })

  it('returns the dark variant for color tokens in dark theme', () => {
    expect(resolveToken(tokens, 'color.accent', 'dark')).toBe('#60a5fa')
  })

  it('returns the raw string for non-color categories regardless of theme', () => {
    expect(resolveToken(tokens, 'spacing.md', 'light')).toBe('1rem')
    expect(resolveToken(tokens, 'spacing.md', 'dark')).toBe('1rem')
    expect(resolveToken(tokens, 'fontSize.body', 'light')).toBe('clamp(1rem, 1.5vw, 1.125rem)')
  })

  it('returns null for an unknown token id', () => {
    expect(resolveToken(tokens, 'color.missing', 'light')).toBeNull()
  })

  it('returns null for a malformed reference', () => {
    expect(resolveToken(tokens, 'not-a-token', 'light')).toBeNull()
    expect(resolveToken(tokens, '#3b82f6', 'light')).toBeNull()
  })
})
