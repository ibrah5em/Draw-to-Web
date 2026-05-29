import { describe, it, expect } from 'vitest'
import { emitJs } from '../../src/generator/jsEmitter'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

describe('emitJs(document)', () => {
  it('returns an empty string when every runtime flag is false', () => {
    expect(emitJs(PORTFOLIO_DOCUMENT)).toBe('')
  })

  it('emits every snippet, in stable order, with every runtime flag on', () => {
    // I-RUN-01..08 have all shipped, so the historical "unauthored
    // flags = empty output" guard no longer applies. The new contract:
    // every authored snippet appears, in the order declared by
    // FLAG_ORDER, when every flag is on.
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: {
        themeToggle: true,
        scrollSpy: true,
        smoothScroll: true,
        mobileNav: true,
        navOnScroll: true,
        reveals: true,
        animationGating: true,
        terminalTyping: true,
      },
    }
    const js = emitJs(doc)
    const labels = [
      '/* themeToggle */',
      '/* scrollSpy */',
      '/* smoothScroll */',
      '/* mobileNav */',
      '/* navOnScroll */',
      '/* reveals */',
      '/* animationGating */',
      '/* terminalTyping */',
    ]
    let cursor = 0
    for (const label of labels) {
      const idx = js.indexOf(label, cursor)
      expect(idx).toBeGreaterThanOrEqual(cursor)
      cursor = idx + label.length
    }
  })

  it('emits the theme toggle snippet wrapped in an outer IIFE when themeToggle is on', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true },
    }
    const js = emitJs(doc)
    expect(js).toMatch(/^\(function \(\) \{/)
    expect(js).toContain('/* themeToggle */')
    expect(js).toContain('data-dtw-theme-toggle')
    expect(js).toMatch(/["']dtw-theme["']/)
    expect(js).toMatch(/\}\)\(\);\s*$/)
  })

  it('emits the scroll-spy snippet when scrollSpy is on (I-RUN-02)', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, scrollSpy: true },
    }
    const js = emitJs(doc)
    expect(js).toContain('/* scrollSpy */')
    expect(js).toContain('nav a[href^="#"]')
    expect(js).toContain('IntersectionObserver')
    expect(js).toContain('is-active')
  })

  it('orders snippets deterministically: themeToggle before scrollSpy', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true, scrollSpy: true },
    }
    const js = emitJs(doc)
    expect(js.indexOf('/* themeToggle */')).toBeLessThan(js.indexOf('/* scrollSpy */'))
  })

  it('emits the smooth-scroll snippet when smoothScroll is on (I-RUN-03)', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, smoothScroll: true },
    }
    const js = emitJs(doc)
    expect(js).toContain('/* smoothScroll */')
    expect(js).toContain('--dtw-nav-pad')
    expect(js).toContain("document.querySelector('nav')")
    expect(js).toContain('ResizeObserver')
  })

  it('orders snippets deterministically: scrollSpy before smoothScroll', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, scrollSpy: true, smoothScroll: true },
    }
    const js = emitJs(doc)
    expect(js.indexOf('/* scrollSpy */')).toBeLessThan(js.indexOf('/* smoothScroll */'))
  })

  it('emits the mobile-nav snippet when mobileNav is on (I-RUN-04)', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, mobileNav: true },
    }
    const js = emitJs(doc)
    expect(js).toContain('/* mobileNav */')
    expect(js).toContain('data-dtw-mobile-nav-toggle')
    expect(js).toContain('data-dtw-mobile-nav-panel')
    expect(js).toContain('aria-expanded')
  })

  it('orders snippets deterministically: smoothScroll before mobileNav', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, smoothScroll: true, mobileNav: true },
    }
    const js = emitJs(doc)
    expect(js.indexOf('/* smoothScroll */')).toBeLessThan(js.indexOf('/* mobileNav */'))
  })

  it('emits the nav-on-scroll snippet when navOnScroll is on (I-RUN-05)', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, navOnScroll: true },
    }
    const js = emitJs(doc)
    expect(js).toContain('/* navOnScroll */')
    expect(js).toContain('IntersectionObserver')
    expect(js).toContain('data-dtw-scroll-sentinel')
    expect(js).toContain('scrolled')
  })

  it('orders snippets deterministically: mobileNav before navOnScroll', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, mobileNav: true, navOnScroll: true },
    }
    const js = emitJs(doc)
    expect(js.indexOf('/* mobileNav */')).toBeLessThan(js.indexOf('/* navOnScroll */'))
  })

  it('emits the reveals snippet when reveals is on (I-RUN-06)', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, reveals: true },
    }
    const js = emitJs(doc)
    expect(js).toContain('/* reveals */')
    expect(js).toContain('data-dtw-reveal')
    expect(js).toContain('IntersectionObserver')
    expect(js).toContain('prefers-reduced-motion')
    expect(js).toContain('visible')
  })

  it('orders snippets deterministically: navOnScroll before reveals', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, navOnScroll: true, reveals: true },
    }
    const js = emitJs(doc)
    expect(js.indexOf('/* navOnScroll */')).toBeLessThan(js.indexOf('/* reveals */'))
  })

  it('emits the animation-gating snippet when animationGating is on (I-RUN-07)', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, animationGating: true },
    }
    const js = emitJs(doc)
    expect(js).toContain('/* animationGating */')
    expect(js).toContain('data-dtw-gate-anim')
    expect(js).toContain('animationPlayState')
    expect(js).toContain('prefers-reduced-motion')
  })

  it('orders snippets deterministically: reveals before animationGating', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, reveals: true, animationGating: true },
    }
    const js = emitJs(doc)
    expect(js.indexOf('/* reveals */')).toBeLessThan(js.indexOf('/* animationGating */'))
  })

  it('emits the terminal-typing snippet when terminalTyping is on (I-RUN-08)', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, terminalTyping: true },
    }
    const js = emitJs(doc)
    expect(js).toContain('/* terminalTyping */')
    expect(js).toContain('data-dtw-terminal-type')
    expect(js).toContain('animationPlayState')
  })

  it('orders snippets deterministically: animationGating before terminalTyping', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, animationGating: true, terminalTyping: true },
    }
    const js = emitJs(doc)
    expect(js.indexOf('/* animationGating */')).toBeLessThan(js.indexOf('/* terminalTyping */'))
  })

  it('produces deterministic output across repeated calls', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true },
    }
    expect(emitJs(doc)).toBe(emitJs(doc))
  })
})
