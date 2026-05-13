/**
 * Determinism guard for `stubInferSemantics`.
 *
 * The stub's docstring promises "Deterministic and order-stable: the same
 * input always produces the same output array in the same order." The
 * existing test only checks order-stability for a 3-element list, which is
 * too weak — Set/Map iteration, Math.random fallbacks, or unstable sort keys
 * could slip past it on richer inputs. This file fingerprints the output
 * across many runs and across two distinct but structurally identical input
 * trees, and asserts the stub does not mutate its input.
 */
import { describe, it, expect } from 'vitest'
import { createHash } from 'crypto'
import { stubInferSemantics } from '../../src/engine/stubInfer'
import type { CanvasElement } from '../../src/store/elementStore'

const ITERATIONS = 50

/** A scene that exercises every code path: header, footer, nav, main, text, image, button. */
const RICH_SCENE: CanvasElement[] = [
  // Header (y < 80, full width)
  { id: 'h', type: 'rectangle', x: 0, y: 0, width: 12, height: 70, props: {} },
  // Nav bar with a horizontal row of buttons
  { id: 'navbar', type: 'rectangle', x: 0, y: 100, width: 12, height: 50, props: {} },
  { id: 'nav-b1', type: 'button', x: 1, y: 110, width: 2, height: 30, props: { text: 'Home' } },
  { id: 'nav-b2', type: 'button', x: 4, y: 110, width: 2, height: 30, props: { text: 'About' } },
  { id: 'nav-b3', type: 'button', x: 7, y: 110, width: 2, height: 30, props: { text: 'Contact' } },
  // Headings and body text at varying font sizes
  {
    id: 't-h1',
    type: 'text',
    x: 1,
    y: 200,
    width: 10,
    height: 60,
    props: { text: 'Title', fontSize: 48 },
  },
  {
    id: 't-h2',
    type: 'text',
    x: 1,
    y: 270,
    width: 10,
    height: 40,
    props: { text: 'Sub', fontSize: 28 },
  },
  {
    id: 't-p',
    type: 'text',
    x: 1,
    y: 320,
    width: 10,
    height: 30,
    props: { text: 'Body', fontSize: 14 },
  },
  // Main body content (largest remaining rectangle)
  { id: 'body', type: 'rectangle', x: 0, y: 360, width: 10, height: 400, props: {} },
  // Aside (small div, not promoted to main)
  { id: 'aside', type: 'rectangle', x: 10, y: 360, width: 2, height: 200, props: {} },
  // Image and a standalone button outside any nav
  { id: 'img', type: 'image', x: 1, y: 380, width: 4, height: 200, props: { alt: 'Hero' } },
  { id: 'cta', type: 'button', x: 5, y: 600, width: 3, height: 40, props: { text: 'Sign up' } },
  // Footer (bottom-most full width)
  { id: 'f', type: 'rectangle', x: 0, y: 800, width: 12, height: 60, props: {} },
]

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}

function fingerprint(elements: CanvasElement[]): string {
  // Hash a stable serialization of the output so any ordering, tag, or
  // children-array change shows up as a different digest.
  return sha256(JSON.stringify(stubInferSemantics(elements)))
}

describe('stubInferSemantics determinism', () => {
  it('produces a single output fingerprint across many runs on the rich scene', () => {
    const hashes = new Set<string>()
    for (let i = 0; i < ITERATIONS; i += 1) {
      hashes.add(fingerprint(RICH_SCENE))
    }
    expect(hashes.size).toBe(1)
  })

  it('does not mutate its input', () => {
    const before = JSON.parse(JSON.stringify(RICH_SCENE))
    stubInferSemantics(RICH_SCENE)
    expect(RICH_SCENE).toEqual(before)
  })

  it('produces identical output for two structurally identical but distinct trees', () => {
    // Defends against identity-based memoization (WeakMap, Map keyed by ref)
    // that would diverge for trees that look the same but aren't the same
    // object.
    const cloneA = JSON.parse(JSON.stringify(RICH_SCENE)) as CanvasElement[]
    const cloneB = JSON.parse(JSON.stringify(RICH_SCENE)) as CanvasElement[]
    expect(fingerprint(cloneA)).toBe(fingerprint(cloneB))
  })

  it('produces a single fingerprint for an empty input across many runs', () => {
    // The early-return path should also be deterministic — guards against
    // someone adding logging or timestamps to the empty branch later.
    const hashes = new Set<string>()
    for (let i = 0; i < ITERATIONS; i += 1) {
      hashes.add(fingerprint([]))
    }
    expect(hashes.size).toBe(1)
  })
})
