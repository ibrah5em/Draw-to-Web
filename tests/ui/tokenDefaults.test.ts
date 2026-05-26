import { describe, expect, it } from 'vitest'

import {
  colorDefault,
  isValidTokenId,
  nextTokenId,
  scalarDefault,
} from '@ui/panels/tokens/tokenDefaults'

describe('nextTokenId (L-TKN-04)', () => {
  it('returns token-1 for an empty category', () => {
    expect(nextTokenId([])).toBe('token-1')
  })

  it('skips ids already taken', () => {
    expect(nextTokenId([{ id: 'token-1' }, { id: 'token-2' }])).toBe('token-3')
  })

  it('reuses the lowest free number', () => {
    expect(nextTokenId([{ id: 'token-2' }])).toBe('token-1')
  })
})

describe('token defaults (L-TKN-04)', () => {
  it('colorDefault carries a light and dark value', () => {
    const def = colorDefault('brand')
    expect(def.id).toBe('brand')
    expect(def.value.light).toMatch(/^#/)
    expect(def.value.dark).toMatch(/^#/)
  })

  it('scalarDefault picks a category-appropriate value', () => {
    expect(scalarDefault('spacing', 's').value).toBe('16px')
    expect(scalarDefault('lineHeight', 'l').value).toBe('1.5')
  })
})

describe('isValidTokenId (L-TKN-04)', () => {
  it('accepts slug ids', () => {
    expect(isValidTokenId('accent-1')).toBe(true)
    expect(isValidTokenId('bg_primary')).toBe(true)
  })

  it('rejects dots, spaces, and empty strings', () => {
    expect(isValidTokenId('a.b')).toBe(false)
    expect(isValidTokenId('a b')).toBe(false)
    expect(isValidTokenId('')).toBe(false)
  })
})
