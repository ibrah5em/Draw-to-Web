import { describe, expect, it } from 'vitest'

import type { ElementNode } from '@document/types'
import { nodeStyle } from '@ui/canvas/buildStyle'

const passthrough = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined

function makeNode(): ElementNode {
  return {
    id: 'sample',
    type: 'text',
    tag: 'p',
    content: 'hello',
    style: {
      base: { typography: { color: '#111111' } },
      tablet: { typography: { color: '#aa00aa' } },
    },
    states: {
      hover: { typography: { color: '#ff0000' } },
      'focus-visible': { typography: { color: '#00aaff' } },
      active: { typography: { color: '#00ff00' } },
    },
  }
}

describe('nodeStyle — active state + breakpoint layering (L-PRP-05/09)', () => {
  it('returns the base color when state=default and breakpoint=base', () => {
    const style = nodeStyle(makeNode(), passthrough, 'base', 'default')
    expect(style.color).toBe('#111111')
  })

  it('layers the active breakpoint over base', () => {
    const style = nodeStyle(makeNode(), passthrough, 'tablet', 'default')
    expect(style.color).toBe('#aa00aa')
  })

  it('layers the active state over base + breakpoint', () => {
    const style = nodeStyle(makeNode(), passthrough, 'base', 'hover')
    expect(style.color).toBe('#ff0000')
  })

  it('state overrides win over breakpoint when both apply', () => {
    const style = nodeStyle(makeNode(), passthrough, 'tablet', 'hover')
    expect(style.color).toBe('#ff0000')
  })

  it('falls back to base when no state override exists at the active state', () => {
    const node = makeNode()
    const trimmed: ElementNode = { ...node, states: undefined } as ElementNode
    const style = nodeStyle(trimmed, passthrough, 'base', 'hover')
    expect(style.color).toBe('#111111')
  })

  it('still paints each named state with its own colour', () => {
    const node = makeNode()
    expect(nodeStyle(node, passthrough, 'base', 'focus-visible').color).toBe('#00aaff')
    expect(nodeStyle(node, passthrough, 'base', 'active').color).toBe('#00ff00')
  })
})
