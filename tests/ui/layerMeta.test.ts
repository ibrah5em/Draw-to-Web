import { describe, expect, it } from 'vitest'

import type { ElementNode } from '@document/types'
import { LAYER_TYPE_LABEL, layerLabel } from '@ui/layers/layerMeta'

describe('layerLabel (L-LYR-01)', () => {
  it('uses the author-given name when present', () => {
    const node: ElementNode = {
      id: '1',
      type: 'container',
      name: 'Hero',
      style: { base: {} },
      layout: { base: { mode: 'flex' } },
      children: [],
    }
    expect(layerLabel(node)).toBe('Hero')
  })

  it('falls back to the type label when unnamed', () => {
    const node: ElementNode = { id: '2', type: 'text', tag: 'p', content: 'x', style: { base: {} } }
    expect(layerLabel(node)).toBe('Text')
  })

  it('falls back when the name is blank', () => {
    const node: ElementNode = {
      id: '3',
      type: 'image',
      alt: '',
      name: '   ',
      style: { base: {} },
    }
    expect(layerLabel(node)).toBe('Image')
  })

  it('has a label for every element type', () => {
    for (const label of Object.values(LAYER_TYPE_LABEL)) {
      expect(label.length).toBeGreaterThan(0)
    }
  })
})
