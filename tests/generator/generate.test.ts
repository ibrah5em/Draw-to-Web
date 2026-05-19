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
    // The I-RUN-* snippets are not implemented yet. Enabling a flag must
    // not crash and must not inject a link to a file we will never write.
    // The script tag only appears once a snippet contributes real code.
    const doc = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true },
    }
    const { html, js } = await generate(doc)
    expect(js).toBe('')
    expect(html).not.toContain('scripts.js')
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
})
