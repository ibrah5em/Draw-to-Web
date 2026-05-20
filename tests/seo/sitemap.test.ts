import { describe, it, expect } from 'vitest'
import { emitSitemap } from '../../src/seo/sitemap'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'
import type { Document } from '../../src/document/types'

describe('emitSitemap', () => {
  it('emits a valid <urlset> with no entries when canonical is missing', () => {
    const out = emitSitemap(PORTFOLIO_DOCUMENT)
    expect(out).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(out).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(out).toContain('</urlset>')
    expect(out).not.toContain('<url>')
  })

  it('emits a single <url> entry with loc + lastmod when canonical is set', () => {
    const doc: Document = {
      ...PORTFOLIO_DOCUMENT,
      seo: { ...PORTFOLIO_DOCUMENT.seo, canonical: 'https://example.com/' },
    }
    const out = emitSitemap(doc)
    expect(out).toContain('<loc>https://example.com/</loc>')
    expect(out).toMatch(/<lastmod>2026-01-01<\/lastmod>/)
  })

  it('XML-escapes special characters in canonical URLs', () => {
    const doc: Document = {
      ...PORTFOLIO_DOCUMENT,
      seo: { ...PORTFOLIO_DOCUMENT.seo, canonical: 'https://example.com/?a=b&c=d' },
    }
    const out = emitSitemap(doc)
    expect(out).toContain('https://example.com/?a=b&amp;c=d')
    expect(out).not.toContain('&c=')
  })
})
