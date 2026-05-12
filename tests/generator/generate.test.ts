import { describe, it, expect } from 'vitest'
import { generate } from '@generator'
import { SIMPLE_PAGE, PAGE_WITH_NAV } from './fixtures'

describe('generate', () => {
  it('returns both html and css strings', () => {
    const output = generate(SIMPLE_PAGE)
    expect(typeof output.html).toBe('string')
    expect(typeof output.css).toBe('string')
    expect(output.html.length).toBeGreaterThan(0)
    expect(output.css.length).toBeGreaterThan(0)
  })

  it('produces a valid HTML5 document structure', () => {
    const { html } = generate(SIMPLE_PAGE)
    expect(html).toContain('<!doctype html>')
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<head>')
    expect(html).toContain('<meta charset="UTF-8" />')
    expect(html).toContain('<meta name="viewport"')
    expect(html).toContain('</head>')
    expect(html).toContain('<body>')
    expect(html).toContain('</body>')
    expect(html).toContain('</html>')
  })

  it('links the stylesheet as styles.css', () => {
    const { html } = generate(SIMPLE_PAGE)
    expect(html).toContain('<link rel="stylesheet" href="styles.css" />')
  })

  it('wraps body content in the root canvas container', () => {
    const { html } = generate(SIMPLE_PAGE)
    expect(html).toContain('<div class="dtw-canvas">')
    expect(html).toContain('</div>')
  })

  it('contains no JavaScript in the generated HTML', () => {
    const { html } = generate(SIMPLE_PAGE)
    expect(html).not.toContain('<script')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onload')
  })

  it('contains no JavaScript in the generated CSS', () => {
    const { css } = generate(SIMPLE_PAGE)
    expect(css).not.toContain('javascript:')
    expect(css).not.toContain('expression(')
  })

  it('places element HTML inside the canvas container', () => {
    const { html } = generate(SIMPLE_PAGE)
    const canvasStart = html.indexOf('<div class="dtw-canvas">')
    const headerStart = html.indexOf('<header')
    const canvasEnd = html.indexOf('</div>', canvasStart)
    expect(headerStart).toBeGreaterThan(canvasStart)
    expect(headerStart).toBeLessThan(canvasEnd)
  })

  it('handles nested elements (nav with children)', () => {
    const { html, css } = generate(PAGE_WITH_NAV)
    expect(html).toContain('<nav class="dtw-el-nav-1">')
    expect(css).toContain('.dtw-el-nav-link-1')
  })

  it('produces deterministic output for identical input', () => {
    const first = generate(SIMPLE_PAGE)
    const second = generate(SIMPLE_PAGE)
    expect(first.html).toBe(second.html)
    expect(first.css).toBe(second.css)
  })

  it('matches snapshot', () => {
    expect(generate(SIMPLE_PAGE)).toMatchSnapshot()
  })
})
