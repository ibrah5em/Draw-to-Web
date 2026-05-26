import { describe, expect, it } from 'vitest'

import type { ColorTokenValue, TokenDefinition } from '@document/types'
import { contrastInfo, findSurfaceColor } from '@ui/panels/tokens/contrast'

function color(id: string, light: string, dark: string): TokenDefinition<ColorTokenValue> {
  return { id, name: id, value: { light, dark } }
}

describe('contrastInfo (L-TKN-03)', () => {
  it('black on white is ~21:1 and passes AA', () => {
    const info = contrastInfo('#000000', '#ffffff')
    expect(info?.ratio).toBeCloseTo(21, 0)
    expect(info?.passesAA).toBe(true)
  })

  it('returns null when a color is unparseable (mid-edit)', () => {
    expect(contrastInfo('#zz', '#ffffff')).toBeNull()
  })

  it('flags low contrast as failing AA', () => {
    expect(contrastInfo('#bbbbbb', '#ffffff')?.passesAA).toBe(false)
  })
})

describe('findSurfaceColor (L-TKN-03)', () => {
  it('prefers a conventionally-named background token', () => {
    const surface = findSurfaceColor(
      [color('accent', '#ff0000', '#ff0000'), color('bg', '#ffffff', '#000000')],
      'light'
    )
    expect(surface).toBe('#ffffff')
  })

  it('falls back to the first color for the active theme', () => {
    expect(findSurfaceColor([color('accent', '#ff0000', '#00ff00')], 'dark')).toBe('#00ff00')
  })

  it('returns null when there are no colors', () => {
    expect(findSurfaceColor([], 'light')).toBeNull()
  })
})
