import { describe, it, expect } from 'vitest'
import { emitRobots } from '../../src/seo/robots'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'
import type { Document } from '../../src/document/types'

describe('emitRobots', () => {
  it('defaults to allow-all when no robots directive is set', () => {
    const out = emitRobots(PORTFOLIO_DOCUMENT)
    expect(out).toContain('User-agent: *')
    expect(out).toContain('Allow: /')
    expect(out).not.toContain('Disallow: /')
  })

  it('emits Disallow when robots directive starts with noindex', () => {
    const doc: Document = {
      ...PORTFOLIO_DOCUMENT,
      seo: { ...PORTFOLIO_DOCUMENT.seo, robots: 'noindex, nofollow' },
    }
    const out = emitRobots(doc)
    expect(out).toContain('Disallow: /')
    expect(out).not.toContain('Allow: /')
  })

  it('appends Sitemap: line when canonical is set, derived from the origin', () => {
    const doc: Document = {
      ...PORTFOLIO_DOCUMENT,
      seo: { ...PORTFOLIO_DOCUMENT.seo, canonical: 'https://example.com/page' },
    }
    const out = emitRobots(doc)
    expect(out).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('omits Sitemap: when canonical is unset', () => {
    const out = emitRobots(PORTFOLIO_DOCUMENT)
    expect(out).not.toContain('Sitemap:')
  })
})
