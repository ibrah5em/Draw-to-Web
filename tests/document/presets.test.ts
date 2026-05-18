import { describe, expect, it } from 'vitest'

import { presetsRegistry, type PresetContext } from '../../src/document/presets'
import { elementNodeSchema } from '../../src/document/schemas'

/**
 * Deterministic id generator so subtree shapes are stable across test
 * runs. Each preset gets a fresh counter via `makeCtx()`.
 */
function makeCtx(): PresetContext {
  let n = 0
  return {
    generateId: () => `n${++n}`,
  }
}

describe('presetsRegistry (C7)', () => {
  it('registers exactly the 8 documented presets', () => {
    expect(Object.keys(presetsRegistry).sort()).toEqual(
      [
        'card-basic',
        'cards-grid-3col',
        'cta-banner',
        'footer-columns',
        'footer-simple',
        'hero-centered',
        'hero-split',
        'nav-fixed',
      ].sort()
    )
  })

  it.each(Object.entries(presetsRegistry))(
    'preset "%s" produces a tree that round-trips through elementNodeSchema',
    (_name, factory) => {
      const node = factory({}, makeCtx())
      const result = elementNodeSchema.safeParse(node)
      if (!result.success) {
        // Surface the issue for fast debugging.
        // eslint-disable-next-line no-console
        console.error(result.error.format())
      }
      expect(result.success).toBe(true)
    }
  )

  it('factories generate distinct ids within a single subtree', () => {
    for (const factory of Object.values(presetsRegistry)) {
      const node = factory({}, makeCtx())
      const ids: string[] = []
      const visit = (n: typeof node): void => {
        ids.push(n.id)
        if (n.type === 'container') n.children.forEach(visit)
      }
      visit(node)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })

  it('hero-centered respects args overrides', () => {
    const node = presetsRegistry['hero-centered']!(
      { title: 'Custom title', primaryLabel: 'Go' },
      makeCtx()
    )
    if (node.type !== 'container') throw new Error('expected container')
    const heading = node.children.find((c) => c.type === 'text' && c.tag === 'h1')
    expect(heading && heading.type === 'text' ? heading.content : null).toBe('Custom title')
  })
})
