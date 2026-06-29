/**
 * Layout matcher (`matchLayout` / `scoreSignatures`) — pure scoring,
 * ranking order, breakdown sanity, and weight-constant respect.
 */

import { describe, expect, it } from 'vitest'

import type { ContainerNode, ElementNode, TextNode } from '@document/types'
import { extractSignature, type LayoutSignature } from '@match/signature'
import {
  MATCH_WEIGHTS,
  matchLayout,
  scoreSignatures,
  type LibrarySignatureEntry,
} from '@match/matcher'

// --- tiny tree builders (shared shape with the signature suite) ---

let idSeq = 0
const id = (): string => `m${(idSeq += 1)}`

function text(tag: TextNode['tag']): TextNode {
  return { id: id(), type: 'text', tag, content: 'x', style: { base: {} } }
}
function image(): ElementNode {
  return { id: id(), type: 'image', alt: '', style: { base: {} } }
}
function flexCol(role: ContainerNode['semanticRole'], children: ElementNode[]): ContainerNode {
  return {
    id: id(),
    type: 'container',
    semanticRole: role,
    layout: { base: { mode: 'flex', direction: 'column' } },
    style: { base: {} },
    children,
  }
}
function grid(columns: number, children: ElementNode[]): ContainerNode {
  return {
    id: id(),
    type: 'container',
    semanticRole: 'section',
    layout: {
      base: { mode: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` },
      mobile: { mode: 'flex', direction: 'column' },
    },
    style: { base: {} },
    children,
  }
}
function page(sections: ElementNode[]): { tree: ContainerNode } {
  return { tree: flexCol('main', sections) }
}

// --- representative layouts ---

const navHeroCardsFooter = (): LayoutSignature =>
  extractSignature(
    page([
      flexCol('nav', [text('span'), text('span')]),
      flexCol('section', [text('h1'), text('p')]),
      grid(3, [flexCol('article', [text('h3')]), flexCol('article', [text('h3')])]),
      flexCol('footer', [text('small')]),
    ])
  )

const heroCardsFooter = (): LayoutSignature =>
  extractSignature(
    page([
      flexCol('section', [text('h1'), text('p')]),
      grid(3, [flexCol('article', [text('h3')]), flexCol('article', [text('h3')])]),
      flexCol('footer', [text('small')]),
    ])
  )

const proseResume = (): LayoutSignature =>
  extractSignature(
    page([
      flexCol('header', [text('h1'), text('p')]),
      flexCol('section', [text('h2'), text('p'), text('p')]),
      flexCol('section', [text('h2'), text('p'), text('p')]),
    ])
  )

const mediaGallery = (): LayoutSignature =>
  extractSignature(
    page([
      flexCol('nav', [text('span')]),
      flexCol('section', [image(), image(), image()]),
      flexCol('footer', [text('small')]),
    ])
  )

describe('scoreSignatures — pure scoring', () => {
  it('scores an identical signature 1 with every sub-score 1', () => {
    const sig = navHeroCardsFooter()
    const { score, breakdown } = scoreSignatures(sig, sig)
    expect(score).toBeCloseTo(1, 10)
    expect(breakdown.sequence).toBeCloseTo(1, 10)
    expect(breakdown.region).toBeCloseTo(1, 10)
    expect(breakdown.content).toBeCloseTo(1, 10)
  })

  it('keeps every sub-score within [0, 1]', () => {
    const { breakdown, score } = scoreSignatures(navHeroCardsFooter(), mediaGallery())
    for (const v of [score, breakdown.sequence, breakdown.region, breakdown.content]) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })

  it('scores a near-miss (dropped nav) below an exact match but well above zero', () => {
    const exact = scoreSignatures(navHeroCardsFooter(), navHeroCardsFooter()).score
    const nearMiss = scoreSignatures(heroCardsFooter(), navHeroCardsFooter()).score
    expect(nearMiss).toBeLessThan(exact)
    expect(nearMiss).toBeGreaterThan(0.5)
  })

  it('respects the weight constant: zeroing a dimension removes its contribution', () => {
    const user = heroCardsFooter() // same content/region family, shorter order
    const candidate = navHeroCardsFooter()
    const blended = scoreSignatures(user, candidate, MATCH_WEIGHTS)
    const sequenceOnly = scoreSignatures(user, candidate, {
      sequence: 1,
      region: 0,
      content: 0,
    })
    // Sequence-only must equal the raw sequence sub-score…
    expect(sequenceOnly.score).toBeCloseTo(blended.breakdown.sequence, 10)
    // …and differ from the blended score (the other dimensions move it).
    expect(sequenceOnly.score).not.toBeCloseTo(blended.score, 5)
  })

  it('is weight-normalised: uniform weights give the plain mean of sub-scores', () => {
    const user = heroCardsFooter()
    const candidate = navHeroCardsFooter()
    const { score, breakdown } = scoreSignatures(user, candidate, {
      sequence: 1,
      region: 1,
      content: 1,
    })
    const mean = (breakdown.sequence + breakdown.region + breakdown.content) / 3
    expect(score).toBeCloseTo(mean, 10)
  })
})

describe('matchLayout — ranking', () => {
  const library: ReadonlyArray<LibrarySignatureEntry> = [
    { pageId: 'nav-hero-cards-footer', signature: navHeroCardsFooter() },
    { pageId: 'hero-cards-footer', signature: heroCardsFooter() },
    { pageId: 'prose-resume', signature: proseResume() },
    { pageId: 'media-gallery', signature: mediaGallery() },
  ]

  it('ranks the page a layout IS first, with score 1', () => {
    const user = navHeroCardsFooter()
    const ranked = matchLayout(user, library)
    expect(ranked[0].pageId).toBe('nav-hero-cards-footer')
    expect(ranked[0].score).toBeCloseTo(1, 10)
  })

  it('returns a fully ranked list (best-first), not a single answer', () => {
    const ranked = matchLayout(proseResume(), library)
    expect(ranked).toHaveLength(library.length)
    for (let i = 1; i < ranked.length; i += 1) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score)
    }
    expect(ranked[0].pageId).toBe('prose-resume')
  })

  it('puts the structurally closest alternative second', () => {
    // A nav→hero→cards→footer sketch should rank the no-nav variant above
    // the prose resume and the media gallery.
    const ranked = matchLayout(navHeroCardsFooter(), library)
    expect(ranked[0].pageId).toBe('nav-hero-cards-footer')
    expect(ranked[1].pageId).toBe('hero-cards-footer')
    const proseRank = ranked.findIndex((r) => r.pageId === 'prose-resume')
    expect(proseRank).toBeGreaterThan(1)
  })

  it('breaks score ties deterministically by pageId', () => {
    const dup: ReadonlyArray<LibrarySignatureEntry> = [
      { pageId: 'zeta', signature: heroCardsFooter() },
      { pageId: 'alpha', signature: heroCardsFooter() },
    ]
    const ranked = matchLayout(heroCardsFooter(), dup)
    expect(ranked.map((r) => r.pageId)).toEqual(['alpha', 'zeta'])
    expect(ranked[0].score).toBeCloseTo(ranked[1].score, 12)
  })

  it('is deterministic: identical inputs produce an identical ranking', () => {
    const user = mediaGallery()
    expect(matchLayout(user, library)).toEqual(matchLayout(user, library))
  })

  it('every result carries a debuggable per-dimension breakdown', () => {
    const ranked = matchLayout(navHeroCardsFooter(), library)
    for (const r of ranked) {
      expect(r.breakdown).toHaveProperty('sequence')
      expect(r.breakdown).toHaveProperty('region')
      expect(r.breakdown).toHaveProperty('content')
    }
  })
})
