/**
 * Generator determinism guard.
 *
 * The "Deterministic output" invariant from CLAUDE.local.md ("same input tree
 * must always produce identical HTML/CSS — no random IDs, no timestamps") is
 * currently asserted by a single two-call comparison in generate.test.ts. That
 * is too weak: any future use of `Math.random()`, `Date.now()`, `crypto.randomUUID()`,
 * Set/Map iteration on unordered keys, or floating-point timing would slip
 * through. This file fingerprints the output across many runs and across all
 * fixtures, and also asserts the generator does not mutate its input.
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { generate } from '../../src/generator'
import {
  SIMPLE_PAGE,
  PAGE_WITH_NAV,
  PAGE_WITH_SPECIAL_CHARS,
  PAGE_DECORATIVE_IMAGE,
} from './fixtures'

const ITERATIONS = 50

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

describe('generator determinism', () => {
  it.each([
    ['SIMPLE_PAGE', SIMPLE_PAGE],
    ['PAGE_WITH_NAV', PAGE_WITH_NAV],
    ['PAGE_WITH_SPECIAL_CHARS', PAGE_WITH_SPECIAL_CHARS],
    ['PAGE_DECORATIVE_IMAGE', PAGE_DECORATIVE_IMAGE],
  ])('produces a single HTML+CSS hash across %i runs for %s', (_name, fixture) => {
    const htmlHashes = new Set<string>()
    const cssHashes = new Set<string>()
    for (let i = 0; i < ITERATIONS; i += 1) {
      const { html, css } = generate(fixture)
      htmlHashes.add(sha256(html))
      cssHashes.add(sha256(css))
    }
    expect(htmlHashes.size).toBe(1)
    expect(cssHashes.size).toBe(1)
  })

  it('does not mutate its input tree', () => {
    // Deep snapshot via JSON round-trip — fixtures contain only JSON-safe values.
    const before = JSON.parse(JSON.stringify(SIMPLE_PAGE))
    generate(SIMPLE_PAGE)
    expect(SIMPLE_PAGE).toEqual(before)
  })

  it('produces identical output for a structurally identical but distinct input tree', () => {
    // Catches identity-based caching or WeakMap-keyed memoization that would
    // diverge between two trees that look the same but aren't the same object.
    const cloneA = JSON.parse(JSON.stringify(SIMPLE_PAGE))
    const cloneB = JSON.parse(JSON.stringify(SIMPLE_PAGE))
    const a = generate(cloneA)
    const b = generate(cloneB)
    expect(a.html).toBe(b.html)
    expect(a.css).toBe(b.css)
  })
})
