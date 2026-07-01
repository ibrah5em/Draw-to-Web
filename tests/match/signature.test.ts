/**
 * Layout signature extractor (`extractSignature`) — determinism + known
 * trees → expected signatures.
 *
 * The signature must be a pure function of tree STRUCTURE only: identical
 * trees (and fresh-id rebuilds of the same template) must yield identical
 * signatures, and hand-built trees must produce the documented shape.
 */

import { describe, expect, it } from 'vitest'

import type { ContainerNode, ElementNode, TextNode } from '@document/types'
import { createLandingTemplate } from '@templates/landing'
import { createPortfolioTemplate } from '@templates/portfolio'
import { createResumeTemplate } from '@templates/resume'
import { extractSignature, type LayoutSignature } from '@match/signature'

// --- tiny tree builders (structure only; ids never read by the signature) ---

let idSeq = 0
const id = (): string => `n${(idSeq += 1)}`

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

describe('extractSignature — determinism', () => {
  it('is a pure function: same tree → identical signature', () => {
    const doc = createLandingTemplate('Acme')
    expect(extractSignature(doc)).toEqual(extractSignature(doc))
  })

  it('does not depend on element ids (fresh-id rebuilds match)', () => {
    // Each call mints fresh nanoid ids; the signature must ignore them.
    const a = extractSignature(createLandingTemplate('Acme'))
    const b = extractSignature(createLandingTemplate('Acme'))
    expect(a).toEqual(b)
  })

  it('does not depend on text content / names (only structure)', () => {
    const a = extractSignature(createLandingTemplate('Acme'))
    const b = extractSignature(createLandingTemplate('Globex Industries'))
    expect(a).toEqual(b)
  })

  it('produces stable signatures for every shipped template', () => {
    for (const make of [createLandingTemplate, createPortfolioTemplate, createResumeTemplate]) {
      expect(extractSignature(make())).toEqual(extractSignature(make()))
    }
  })
})

describe('extractSignature — known trees → expected signatures', () => {
  it('classifies nav / hero / grid-of-cards / footer in vertical order', () => {
    const tree = page([
      flexCol('nav', [text('span'), text('span')]),
      flexCol('section', [text('h1'), text('p')]), // hero (owns the h1)
      grid(3, [flexCol('article', [text('h3')]), flexCol('article', [text('h3')])]),
      flexCol('footer', [text('small')]),
    ])
    const sig = extractSignature(tree)
    expect(sig.sectionCount).toBe(4)
    expect(sig.order).toEqual(['nav', 'hero', 'grid-of-cards', 'footer'])
  })

  it('marks the section owning the <h1> as hero regardless of media', () => {
    // A split hero: heading + image. Media present, but the h1 wins.
    const tree = page([flexCol('section', [text('h1'), image()])])
    expect(extractSignature(tree).order).toEqual(['hero'])
  })

  it('classifies a media-dominated section without an h1 as media-heavy', () => {
    const tree = page([flexCol('section', [image(), image(), text('p')])])
    expect(extractSignature(tree).order).toEqual(['media-heavy'])
  })

  it('classifies a heading-only section as heading-heavy and prose as text-block', () => {
    const headingSig = extractSignature(page([flexCol('section', [text('h2'), text('p')])]))
    expect(headingSig.order).toEqual(['heading-heavy'])
    const proseSig = extractSignature(page([flexCol('section', [text('p'), text('p')])]))
    expect(proseSig.order).toEqual(['text-block'])
  })

  it('resolves grid columns per breakpoint (collapse to 1 on mobile)', () => {
    const tree = page([grid(3, [text('p'), text('p'), text('p')])])
    const sig = extractSignature(tree)
    expect(sig.columns).toEqual({ base: 3, tablet: 3, mobile: 1, small: 3 })
  })

  it('computes the text-to-media ratio over the whole tree', () => {
    // 3 text-bearing leaves (h1, p, button-less here → 2 text) + 2 media.
    const tree = page([flexCol('section', [text('h1'), text('p'), image(), image()])])
    const sig = extractSignature(tree)
    expect(sig.textCount).toBe(2)
    expect(sig.mediaCount).toBe(2)
    expect(sig.textToMediaRatio).toBeCloseTo(0.5, 10)
  })

  it('records normalised landmark positions (nav first, footer last)', () => {
    const tree = page([
      flexCol('nav', [text('span')]),
      flexCol('section', [text('h1')]),
      flexCol('footer', [text('small')]),
    ])
    const { regions } = extractSignature(tree)
    expect(regions.nav).toBe(0)
    expect(regions.hero).toBeCloseTo(0.5, 10)
    expect(regions.footer).toBe(1)
  })

  it('reports null landmark positions when a landmark is absent', () => {
    const tree = page([flexCol('section', [text('h1')]), flexCol('section', [text('p')])])
    const { regions } = extractSignature(tree)
    expect(regions.nav).toBeNull()
    expect(regions.footer).toBeNull()
    expect(regions.hero).toBe(0)
  })

  it('treats a non-container root as a single section', () => {
    const sig = extractSignature({ tree: text('h1') })
    expect(sig.sectionCount).toBe(1)
    expect(sig.order).toEqual(['hero'])
  })

  it('shipped templates expose a sane non-empty signature', () => {
    const sig: LayoutSignature = extractSignature(createLandingTemplate())
    expect(sig.sectionCount).toBeGreaterThan(0)
    expect(sig.order).toContain('hero')
    expect(sig.textCount).toBeGreaterThan(0)
  })
})
