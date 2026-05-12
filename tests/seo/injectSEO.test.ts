import { describe, it, expect } from 'vitest'
import { injectSEO, generateSEOReport } from '@seo'
import { generate } from '@generator'
import { SIMPLE_PAGE, PAGE_WITH_NAV } from '../generator/fixtures'
import type { SEOConfig } from '@seo'

const BASE_CONFIG: SEOConfig = {
  title: 'My Page',
  description: 'A test page description.',
}

const FULL_CONFIG: SEOConfig = {
  title: 'Full Page',
  description: 'Full description for testing.',
  ogImage: 'https://example.com/og.png',
  canonicalUrl: 'https://example.com/page',
  lang: 'fr',
}

const BASE_HTML = generate(SIMPLE_PAGE).html
const NAV_HTML = generate(PAGE_WITH_NAV).html

describe('injectSEO', () => {
  describe('head tag injection', () => {
    it('injects <title>', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      expect(result).toContain('<title>My Page</title>')
    })

    it('injects meta description', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      expect(result).toContain('<meta name="description" content="A test page description." />')
    })

    it('injects OG title and description', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      expect(result).toContain('<meta property="og:title" content="My Page" />')
      expect(result).toContain(
        '<meta property="og:description" content="A test page description." />'
      )
    })

    it('injects OG image when provided', () => {
      const result = injectSEO(BASE_HTML, FULL_CONFIG)
      expect(result).toContain('<meta property="og:image" content="https://example.com/og.png" />')
    })

    it('omits OG image when not provided', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      expect(result).not.toContain('og:image')
    })

    it('injects canonical link when provided', () => {
      const result = injectSEO(BASE_HTML, FULL_CONFIG)
      expect(result).toContain('<link rel="canonical" href="https://example.com/page" />')
    })

    it('omits canonical link when not provided', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      expect(result).not.toContain('rel="canonical"')
    })

    it('injects tags before </head>', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      const titleIdx = result.indexOf('<title>')
      const headCloseIdx = result.indexOf('</head>')
      expect(titleIdx).toBeGreaterThan(0)
      expect(titleIdx).toBeLessThan(headCloseIdx)
    })

    it('preserves existing charset and viewport metas', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      expect(result).toContain('<meta charset="UTF-8" />')
      expect(result).toContain('<meta name="viewport"')
    })
  })

  describe('lang attribute', () => {
    it('keeps lang="en" when config.lang is not set', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      expect(result).toContain('<html lang="en">')
    })

    it('updates lang when config.lang is provided', () => {
      const result = injectSEO(BASE_HTML, FULL_CONFIG)
      expect(result).toContain('<html lang="fr">')
      expect(result).not.toContain('lang="en"')
    })
  })

  describe('ARIA landmark roles', () => {
    it('adds role="banner" to <header>', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      expect(result).toContain('role="banner"')
      expect(result).toMatch(/<header\b[^>]*role="banner"/)
    })

    it('adds role="contentinfo" to <footer>', () => {
      const result = injectSEO(BASE_HTML, BASE_CONFIG)
      expect(result).toContain('role="contentinfo"')
    })

    it('adds role="navigation" to <nav>', () => {
      const result = injectSEO(NAV_HTML, BASE_CONFIG)
      expect(result).toContain('role="navigation"')
    })

    it('does not duplicate role if already present', () => {
      const htmlWithRole = BASE_HTML.replace(
        '<header class="dtw-el-header-1">',
        '<header class="dtw-el-header-1" role="banner">'
      )
      const result = injectSEO(htmlWithRole, BASE_CONFIG)
      const roleCount = (result.match(/role="banner"/g) ?? []).length
      expect(roleCount).toBe(1)
    })
  })

  describe('HTML escaping in config values', () => {
    it('escapes special characters in title', () => {
      const config: SEOConfig = { title: '<script>alert("xss")</script>', description: 'safe' }
      const result = injectSEO(BASE_HTML, config)
      expect(result).not.toContain('<script>alert')
      expect(result).toContain('&lt;script&gt;')
    })

    it('escapes special characters in description', () => {
      const config: SEOConfig = { title: 'Safe', description: 'A & B "quotes"' }
      const result = injectSEO(BASE_HTML, config)
      expect(result).toContain('A &amp; B &quot;quotes&quot;')
    })
  })
})

describe('generateSEOReport', () => {
  it('reports correct title and description lengths', () => {
    const html = injectSEO(BASE_HTML, BASE_CONFIG)
    const report = generateSEOReport(html, BASE_CONFIG)
    expect(report.titleLength).toBe(BASE_CONFIG.title.length)
    expect(report.descriptionLength).toBe(BASE_CONFIG.description.length)
  })

  it('reports hasOgImage: false when not configured', () => {
    const html = injectSEO(BASE_HTML, BASE_CONFIG)
    const report = generateSEOReport(html, BASE_CONFIG)
    expect(report.hasOgImage).toBe(false)
    expect(report.hasCanonical).toBe(false)
  })

  it('reports hasOgImage: true and hasCanonical: true for full config', () => {
    const html = injectSEO(BASE_HTML, FULL_CONFIG)
    const report = generateSEOReport(html, FULL_CONFIG)
    expect(report.hasOgImage).toBe(true)
    expect(report.hasCanonical).toBe(true)
  })

  it('counts h1 elements correctly — simple page has one h1', () => {
    const html = injectSEO(BASE_HTML, BASE_CONFIG)
    const report = generateSEOReport(html, BASE_CONFIG)
    expect(report.h1Count).toBe(1)
  })

  it('reports imagesMissingAlt: 0 when all images have descriptive alt', () => {
    // SIMPLE_PAGE has one image with alt="Hero image" (non-empty)
    const html = injectSEO(BASE_HTML, BASE_CONFIG)
    const report = generateSEOReport(html, BASE_CONFIG)
    // Hero image has alt text, so count should be 0
    expect(report.imagesMissingAlt).toBe(0)
  })

  it('flags images with empty alt as potentially decorative', () => {
    // Inject a known empty-alt image into the HTML
    const htmlWithEmptyAlt = BASE_HTML.replace('alt="Hero image"', 'alt=""')
    const report = generateSEOReport(htmlWithEmptyAlt, BASE_CONFIG)
    expect(report.imagesMissingAlt).toBe(1)
  })
})
