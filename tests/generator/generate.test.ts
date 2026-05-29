import { describe, it, expect } from 'vitest'
import { generate } from '@generator'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

describe('generate(document)', () => {
  it('returns html, css, and js strings', async () => {
    const out = await generate(PORTFOLIO_DOCUMENT)
    expect(typeof out.html).toBe('string')
    expect(typeof out.css).toBe('string')
    expect(typeof out.js).toBe('string')
    expect(out.html.length).toBeGreaterThan(0)
    expect(out.css.length).toBeGreaterThan(0)
  })

  it('produces a valid HTML5 envelope', async () => {
    const { html } = await generate(PORTFOLIO_DOCUMENT)
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<meta charset="utf-8" />')
    expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1" />')
    expect(html).toContain('<link rel="stylesheet" href="styles.css" />')
    expect(html).toMatch(/<\/html>/)
  })

  it('omits the <script> tag when every runtime flag is false (I-GEN-15 DoD)', async () => {
    const { html, js } = await generate(PORTFOLIO_DOCUMENT)
    expect(js).toBe('')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('scripts.js')
  })

  it('does not inject <script> for enabled flags whose snippet is not yet authored', async () => {
    // I-RUN-01..05 (themeToggle, scrollSpy, smoothScroll, mobileNav,
    // navOnScroll) have shipped. Flipping only flags whose I-RUN-* task
    // has not landed must still produce no JS and no `<script>` tag.
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, reveals: true, animationGating: true },
    }
    const { html, js } = await generate(doc)
    expect(js).toBe('')
    expect(html).not.toContain('scripts.js')
  })

  describe('theme toggle (I-RUN-01)', () => {
    const docWithToggle = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true },
    }

    it('emits the FOUC guard inline <script> in <head> when themeToggle is on', async () => {
      const { html } = await generate(docWithToggle)
      const headSlice = html.split('</head>')[0]
      expect(headSlice).toContain('<script>')
      expect(headSlice).toMatch(/localStorage\.getItem\(["']dtw-theme["']\)/)
      expect(headSlice).toMatch(/setAttribute\(["']data-theme["']/)
    })

    it('orders the FOUC guard after charset and before the stylesheet link', async () => {
      const { html } = await generate(docWithToggle)
      const charsetIdx = html.indexOf('<meta charset=')
      const guardIdx = html.search(/localStorage\.getItem\(["']dtw-theme["']\)/)
      const stylesheetIdx = html.indexOf('<link rel="stylesheet"')
      expect(charsetIdx).toBeGreaterThan(-1)
      expect(guardIdx).toBeGreaterThan(charsetIdx)
      expect(guardIdx).toBeLessThan(stylesheetIdx)
    })

    it('emits the body snippet and a <script src="scripts.js"> tag when themeToggle is on', async () => {
      const { html, js } = await generate(docWithToggle)
      expect(js).toContain('data-dtw-theme-toggle')
      expect(js).toMatch(/["']dtw-theme["']/)
      expect(html).toContain('<script src="scripts.js" defer></script>')
    })

    it('omits the FOUC guard when themeToggle is false', async () => {
      const { html } = await generate(PORTFOLIO_DOCUMENT)
      expect(html).not.toMatch(/localStorage\.getItem\(["']dtw-theme["']\)/)
    })
  })

  it('drives container tags from element.semanticRole', async () => {
    const { html } = await generate(PORTFOLIO_DOCUMENT)
    expect(html).toContain('<main')
    expect(html).toContain('<header')
    expect(html).toContain('<footer')
  })

  it('emits each element under its scoped class', async () => {
    const { html, css } = await generate(PORTFOLIO_DOCUMENT)
    for (const id of ['root', 'header', 'title', 'cta', 'hero', 'divider', 'skills', 'footer']) {
      expect(html).toContain(`dtw-el-${id}`)
      expect(css).toContain(`.dtw-el-${id}`)
    }
  })

  it('interpolates {{variable}} placeholders against document.variables', async () => {
    const { html } = await generate(PORTFOLIO_DOCUMENT)
    expect(html).toContain('Welcome, Ada Lovelace')
    expect(html).toContain('© 2026 Ada Lovelace')
    expect(html).not.toContain('{{name}}')
  })

  it('emits no `position: absolute` anywhere (Invariant 5.4)', async () => {
    const { html, css } = await generate(PORTFOLIO_DOCUMENT)
    expect(css).not.toMatch(/position\s*:\s*absolute/)
    expect(html).not.toMatch(/position\s*:\s*absolute/)
  })

  it('emits no inline JS handlers in HTML', async () => {
    const { html } = await generate(PORTFOLIO_DOCUMENT)
    expect(html).not.toMatch(/\son[a-z]+\s*=/i)
    expect(html).not.toContain('javascript:')
  })

  it('auto-adds rel="noopener noreferrer" to target="_blank" links (I-GEN-17)', async () => {
    const { html } = await generate(PORTFOLIO_DOCUMENT)
    // The CTA link in the fixture has target="_blank" with no explicit rel.
    expect(html).toMatch(/<a\b[^>]*target="_blank"[^>]*rel="noopener noreferrer"/)
  })

  it('produces deterministic output for identical input', async () => {
    const first = await generate(PORTFOLIO_DOCUMENT)
    const second = await generate(PORTFOLIO_DOCUMENT)
    expect(first.html).toBe(second.html)
    expect(first.css).toBe(second.css)
    expect(first.js).toBe(second.js)
  })

  it('matches the snapshot (catches accidental output drift)', async () => {
    const out = await generate(PORTFOLIO_DOCUMENT)
    expect(out).toMatchSnapshot()
  })

  describe('CSP meta tag (I-GEN-20)', () => {
    it('emits a default CSP meta tag right after the charset', async () => {
      const { html } = await generate(PORTFOLIO_DOCUMENT)
      // Prettier may wrap long `<meta>` tags across lines; match the
      // policy attribute rather than the literal tag opening.
      expect(html).toContain('http-equiv="Content-Security-Policy"')
      const charsetIdx = html.indexOf('<meta charset=')
      const cspIdx = html.indexOf('Content-Security-Policy')
      expect(cspIdx).toBeGreaterThan(charsetIdx)
    })

    it("uses script-src 'self' only when no inline scripts are emitted", async () => {
      const { html } = await generate(PORTFOLIO_DOCUMENT)
      const cspLine = html.match(/Content-Security-Policy"\s+content="([^"]+)"/)?.[1] ?? ''
      expect(cspLine).toContain("script-src 'self'")
      expect(cspLine).not.toContain("script-src 'self' 'unsafe-inline'")
    })

    it('relaxes script-src to allow inline when the FOUC guard runs', async () => {
      const doc = {
        ...PORTFOLIO_DOCUMENT,
        runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true },
      }
      const { html } = await generate(doc)
      const cspLine = html.match(/Content-Security-Policy"\s+content="([^"]+)"/)?.[1] ?? ''
      expect(cspLine).toContain("script-src 'self' 'unsafe-inline'")
    })

    it('honours an author-supplied csp string verbatim', async () => {
      const doc = {
        ...PORTFOLIO_DOCUMENT,
        seo: { ...PORTFOLIO_DOCUMENT.seo, csp: "default-src 'none'" },
      }
      const { html } = await generate(doc)
      expect(html).toContain(`content="default-src 'none'"`)
    })

    it('omits the CSP meta tag when doc.seo.csp is explicitly false', async () => {
      const doc = {
        ...PORTFOLIO_DOCUMENT,
        seo: { ...PORTFOLIO_DOCUMENT.seo, csp: false as const },
      }
      const { html } = await generate(doc)
      expect(html).not.toContain('Content-Security-Policy')
    })
  })
})
