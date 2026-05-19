import { describe, it, expect } from 'vitest'
import { generate } from '@generator'
import { emitCss } from '../../src/generator/cssEmitter'
import { emitHtml } from '../../src/generator/htmlEmitter'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

describe('generator determinism', () => {
  it('produces byte-identical output across repeated runs (full generate)', async () => {
    const a = await generate(PORTFOLIO_DOCUMENT)
    const b = await generate(PORTFOLIO_DOCUMENT)
    expect(a.html).toBe(b.html)
    expect(a.css).toBe(b.css)
    expect(a.js).toBe(b.js)
  })

  it('emitCss is pure', () => {
    expect(emitCss(PORTFOLIO_DOCUMENT)).toBe(emitCss(PORTFOLIO_DOCUMENT))
  })

  it('emitHtml is pure', () => {
    expect(emitHtml(PORTFOLIO_DOCUMENT)).toBe(emitHtml(PORTFOLIO_DOCUMENT))
  })

  it('css output never contains position: absolute (Invariant 5.4 guard)', () => {
    const css = emitCss(PORTFOLIO_DOCUMENT)
    expect(css).not.toMatch(/position\s*:\s*absolute/)
  })
})
