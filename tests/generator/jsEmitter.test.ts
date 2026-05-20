import { describe, it, expect } from 'vitest'
import { emitJs } from '../../src/generator/jsEmitter'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

describe('emitJs(document)', () => {
  it('returns an empty string when every runtime flag is false', () => {
    expect(emitJs(PORTFOLIO_DOCUMENT)).toBe('')
  })

  it('returns an empty string when flags are enabled but the snippets have not yet been authored', () => {
    // The I-RUN-* snippets are not implemented yet; toggling a flag must
    // not crash and must not inject placeholder code.
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true, scrollSpy: true },
    }
    expect(emitJs(doc)).toBe('')
  })
})
