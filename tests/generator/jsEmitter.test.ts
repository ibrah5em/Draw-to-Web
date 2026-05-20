import { describe, it, expect } from 'vitest'
import { emitJs } from '../../src/generator/jsEmitter'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

describe('emitJs(document)', () => {
  it('returns an empty string when every runtime flag is false', () => {
    expect(emitJs(PORTFOLIO_DOCUMENT)).toBe('')
  })

  it('returns an empty string when only unauthored flags are enabled', () => {
    // Only `themeToggle` has shipped a snippet (I-RUN-01). Enabling
    // I-RUN-02..08 flags must still produce no JS until those tasks land.
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, scrollSpy: true, mobileNav: true },
    }
    expect(emitJs(doc)).toBe('')
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

  it('produces deterministic output across repeated calls', () => {
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true },
    }
    expect(emitJs(doc)).toBe(emitJs(doc))
  })
})
