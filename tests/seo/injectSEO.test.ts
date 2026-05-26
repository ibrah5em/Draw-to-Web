import { describe, it, expect, beforeAll } from 'vitest'
import { injectSEO, generateSEOReport } from '@seo'
import { generate } from '@generator'
import { createBlankTemplate } from '../../src/templates/blank'
import type { SEOConfig } from '@seo'

/** Minimal valid document SEO surface — only the required fields. */
const MINIMAL: SEOConfig = {
  title: 'My Page',
  description: 'A test page description.',
  lang: 'en',
  viewport: 'width=device-width, initial-scale=1',
  charset: 'utf-8',
}

/** Fully-populated SEO surface exercising every emitter branch. */
const FULL: SEOConfig = {
  title: 'Full Page',
  description: 'Full description for testing.',
  keywords: ['alpha', 'beta'],
  author: 'Jane Dev',
  lang: 'en',
  viewport: 'width=device-width, initial-scale=1',
  charset: 'utf-8',
  canonical: 'https://example.com/page',
  themeColor: { light: '#ffffff', dark: '#0a0a10' },
  openGraph: {
    title: 'OG Title',
    description: 'OG Desc',
    type: 'profile',
    imageUrl: 'https://example.com/og.png',
    url: 'https://example.com/page',
    siteName: 'Example',
  },
  twitter: { card: 'summary_large_image', site: '@ex', creator: '@jane' },
  jsonLd: {
    kind: 'Person',
    name: 'Jane Dev',
    url: 'https://example.com',
    jobTitle: 'Engineer',
    sameAs: ['https://github.com/jane'],
  },
  preconnect: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
  robots: 'index, follow',
}

/** Minimal HTML shell for ARIA-role assertions (no generator needed). */
function shell(body: string): string {
  return `<!doctype html><html lang="en"><head></head><body>${body}</body></html>`
}

let BASE_HTML: string

beforeAll(async () => {
  // A real generated document: has <meta charset>, viewport, an <h1>, and a
  // <main> root — the same shape the export pipeline feeds injectSEO.
  BASE_HTML = (await generate(createBlankTemplate())).html
})

describe('injectSEO — head metadata (I-SEO-01)', () => {
  it('injects <title> and meta description', () => {
    const result = injectSEO(BASE_HTML, MINIMAL)
    expect(result).toContain('<title>My Page</title>')
    expect(result).toContain('<meta name="description" content="A test page description." />')
  })

  it('injects keywords + author only when present', () => {
    expect(injectSEO(BASE_HTML, FULL)).toContain('<meta name="keywords" content="alpha, beta" />')
    expect(injectSEO(BASE_HTML, FULL)).toContain('<meta name="author" content="Jane Dev" />')
    const minimal = injectSEO(BASE_HTML, MINIMAL)
    expect(minimal).not.toContain('name="keywords"')
    expect(minimal).not.toContain('name="author"')
  })

  it('emits theme-color per colour scheme', () => {
    const result = injectSEO(BASE_HTML, FULL)
    expect(result).toContain(
      '<meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />'
    )
    expect(result).toContain(
      '<meta name="theme-color" content="#0a0a10" media="(prefers-color-scheme: dark)" />'
    )
    expect(injectSEO(BASE_HTML, MINIMAL)).not.toContain('theme-color')
  })

  it('injects canonical + robots only when present', () => {
    const full = injectSEO(BASE_HTML, FULL)
    expect(full).toContain('<link rel="canonical" href="https://example.com/page" />')
    expect(full).toContain('<meta name="robots" content="index, follow" />')
    const minimal = injectSEO(BASE_HTML, MINIMAL)
    expect(minimal).not.toContain('rel="canonical"')
    expect(minimal).not.toContain('name="robots"')
  })

  it('injects tags before </head>', () => {
    const result = injectSEO(BASE_HTML, MINIMAL)
    const titleIdx = result.indexOf('<title>')
    const headCloseIdx = result.indexOf('</head>')
    expect(titleIdx).toBeGreaterThan(0)
    expect(titleIdx).toBeLessThan(headCloseIdx)
  })

  it('preserves the generator-emitted charset and viewport metas', () => {
    const result = injectSEO(BASE_HTML, MINIMAL)
    expect(result).toContain('<meta charset="utf-8" />')
    expect(result).toContain('<meta name="viewport"')
  })

  it('leaves the generator-set <html lang> untouched', () => {
    expect(injectSEO(BASE_HTML, MINIMAL)).toContain('<html lang="en">')
  })
})

describe('injectSEO — preconnect / dns-prefetch (I-SEO-05)', () => {
  it('emits preconnect + dns-prefetch for every origin', () => {
    const result = injectSEO(BASE_HTML, FULL)
    expect(result).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />')
    expect(result).toContain('<link rel="dns-prefetch" href="https://fonts.googleapis.com" />')
  })

  it('adds crossorigin to gstatic font preconnects', () => {
    const result = injectSEO(BASE_HTML, FULL)
    expect(result).toContain(
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />'
    )
    // googleapis is not a font-binary origin → no crossorigin
    expect(result).toContain('<link rel="preconnect" href="https://fonts.googleapis.com" />')
  })

  it('emits no preconnect tags when none configured', () => {
    expect(injectSEO(BASE_HTML, MINIMAL)).not.toContain('rel="preconnect"')
  })
})

describe('injectSEO — favicon (I-SEO-04)', () => {
  it('emits a dark/light-aware inline SVG favicon by default', () => {
    const result = injectSEO(BASE_HTML, MINIMAL)
    expect(result).toContain('<link rel="icon" href="data:image/svg+xml,')
    expect(result).toContain('prefers-color-scheme')
  })

  it('emits the author-supplied inline SVG when configured', () => {
    const result = injectSEO(BASE_HTML, {
      ...MINIMAL,
      favicon: { kind: 'svg-inline', svg: '<svg id="custom"></svg>' },
    })
    expect(result).toContain('data:image/svg+xml,')
    expect(result).toContain(encodeURIComponent('<svg id="custom">'))
  })
})

describe('injectSEO — Open Graph + Twitter (I-SEO-02)', () => {
  it('emits the full Open Graph block when configured', () => {
    const result = injectSEO(BASE_HTML, FULL)
    expect(result).toContain('<meta property="og:title" content="OG Title" />')
    expect(result).toContain('<meta property="og:description" content="OG Desc" />')
    expect(result).toContain('<meta property="og:type" content="profile" />')
    expect(result).toContain('<meta property="og:url" content="https://example.com/page" />')
    expect(result).toContain('<meta property="og:image" content="https://example.com/og.png" />')
    expect(result).toContain('<meta property="og:site_name" content="Example" />')
  })

  it('falls back to page title/description and default type', () => {
    const result = injectSEO(BASE_HTML, { ...MINIMAL, openGraph: {} })
    expect(result).toContain('<meta property="og:title" content="My Page" />')
    expect(result).toContain('<meta property="og:type" content="website" />')
  })

  it('emits the Twitter summary_large_image card', () => {
    const result = injectSEO(BASE_HTML, FULL)
    expect(result).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(result).toContain('<meta name="twitter:site" content="@ex" />')
    expect(result).toContain('<meta name="twitter:image" content="https://example.com/og.png" />')
  })

  it('emits neither block when not configured', () => {
    const result = injectSEO(BASE_HTML, MINIMAL)
    expect(result).not.toContain('property="og:')
    expect(result).not.toContain('name="twitter:')
  })
})

describe('injectSEO — JSON-LD (I-SEO-03)', () => {
  it('emits a parseable application/ld+json script', () => {
    const result = injectSEO(BASE_HTML, FULL)
    const match = result.match(/<script type="application\/ld\+json">\n([\s\S]*?)\n {4}<\/script>/)
    expect(match).not.toBeNull()
    const parsed = JSON.parse((match![1] ?? '').replace(/\\u003c/g, '<'))
    expect(parsed['@context']).toBe('https://schema.org')
    expect(parsed['@type']).toBe('Person')
    expect(parsed.name).toBe('Jane Dev')
    expect(parsed.jobTitle).toBe('Engineer')
    expect(parsed.sameAs).toEqual(['https://github.com/jane'])
  })

  it('emits no JSON-LD when not configured', () => {
    expect(injectSEO(BASE_HTML, MINIMAL)).not.toContain('application/ld+json')
  })
})

describe('injectSEO — ARIA landmark roles', () => {
  it('adds role="main" to <main>', () => {
    expect(injectSEO(BASE_HTML, MINIMAL)).toMatch(/<main\b[^>]*role="main"/)
  })

  it('adds banner / navigation / contentinfo roles', () => {
    const html = shell('<header>h</header><nav>n</nav><footer>f</footer>')
    const result = injectSEO(html, MINIMAL)
    expect(result).toMatch(/<header\b[^>]*role="banner"/)
    expect(result).toMatch(/<nav\b[^>]*role="navigation"/)
    expect(result).toMatch(/<footer\b[^>]*role="contentinfo"/)
  })

  it('does not duplicate a role that is already present', () => {
    const html = shell('<header role="banner">h</header>')
    const result = injectSEO(html, MINIMAL)
    expect((result.match(/role="banner"/g) ?? []).length).toBe(1)
  })
})

describe('injectSEO — HTML escaping', () => {
  it('escapes special characters in title', () => {
    const result = injectSEO(BASE_HTML, { ...MINIMAL, title: '<script>alert("xss")</script>' })
    expect(result).not.toContain('<script>alert')
    expect(result).toContain('&lt;script&gt;')
  })

  it('escapes special characters in description', () => {
    const result = injectSEO(BASE_HTML, { ...MINIMAL, description: 'A & B "quotes"' })
    expect(result).toContain('A &amp; B &quot;quotes&quot;')
  })

  it('escapes a </script> sequence inside JSON-LD', () => {
    const result = injectSEO(BASE_HTML, {
      ...MINIMAL,
      jsonLd: { kind: 'Organization', name: 'A</script>B' },
    })
    expect(result).not.toContain('A</script>B')
    expect(result).toContain('A\\u003c/script>B')
  })
})

describe('generateSEOReport', () => {
  it('reports title and description lengths', () => {
    const report = generateSEOReport(injectSEO(BASE_HTML, MINIMAL), MINIMAL)
    expect(report.titleLength).toBe(MINIMAL.title.length)
    expect(report.descriptionLength).toBe(MINIMAL.description.length)
  })

  it('reports hasOgImage / hasCanonical from document.seo', () => {
    const minimal = generateSEOReport(injectSEO(BASE_HTML, MINIMAL), MINIMAL)
    expect(minimal.hasOgImage).toBe(false)
    expect(minimal.hasCanonical).toBe(false)
    const full = generateSEOReport(injectSEO(BASE_HTML, FULL), FULL)
    expect(full.hasOgImage).toBe(true)
    expect(full.hasCanonical).toBe(true)
  })

  it('counts the single <h1> from the blank template', () => {
    const report = generateSEOReport(injectSEO(BASE_HTML, MINIMAL), MINIMAL)
    expect(report.h1Count).toBe(1)
  })

  it('flags images with empty alt as potentially decorative', () => {
    const withEmptyAlt = injectSEO(BASE_HTML, MINIMAL).replace(
      '</body>',
      '<img src="x.png" alt="" /></body>'
    )
    expect(generateSEOReport(withEmptyAlt, MINIMAL).imagesMissingAlt).toBe(1)
  })
})
