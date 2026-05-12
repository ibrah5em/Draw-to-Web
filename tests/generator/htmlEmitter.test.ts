import { describe, it, expect } from 'vitest'
import { emitHtml } from '@generator/htmlEmitter'
import {
  SIMPLE_PAGE,
  PAGE_WITH_NAV,
  PAGE_WITH_SPECIAL_CHARS,
  PAGE_DECORATIVE_IMAGE,
} from './fixtures'

describe('emitHtml', () => {
  it('emits scoped class names for every element', () => {
    const html = emitHtml(SIMPLE_PAGE)
    expect(html).toContain('class="dtw-el-header-1"')
    expect(html).toContain('class="dtw-el-h1-1"')
    expect(html).toContain('class="dtw-el-img-1"')
    expect(html).toContain('class="dtw-el-btn-1"')
    expect(html).toContain('class="dtw-el-footer-1"')
  })

  it('emits semantic container tags', () => {
    const html = emitHtml(SIMPLE_PAGE)
    expect(html).toMatch(/<header\s/)
    expect(html).toMatch(/<footer\s/)
  })

  it('emits text content in heading and paragraph tags', () => {
    const html = emitHtml(SIMPLE_PAGE)
    expect(html).toContain('<h1 class="dtw-el-h1-1">Hello World</h1>')
  })

  it('emits img with src and alt attributes', () => {
    const html = emitHtml(SIMPLE_PAGE)
    expect(html).toContain('src="hero.jpg"')
    expect(html).toContain('alt="Hero image"')
    expect(html).toMatch(/<img\b[^>]*\/>/)
  })

  it('emits button with type="button" to prevent form submission', () => {
    const html = emitHtml(SIMPLE_PAGE)
    expect(html).toContain('type="button"')
    expect(html).toContain('>Get started</button>')
  })

  it('emits empty alt attribute for decorative images (a11y requirement)', () => {
    const html = emitHtml(PAGE_DECORATIVE_IMAGE)
    expect(html).toContain('alt=""')
  })

  it('escapes HTML special characters in text props', () => {
    const html = emitHtml(PAGE_WITH_SPECIAL_CHARS)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;quotes&quot;')
  })

  it('nests child elements inside container tags', () => {
    const html = emitHtml(PAGE_WITH_NAV)
    expect(html).toContain('<nav class="dtw-el-nav-1">')
    expect(html).toContain('<p class="dtw-el-nav-link-1">Home</p>')
    expect(html).toContain('<p class="dtw-el-nav-link-2">About</p>')
    // nav must be inside header
    const headerIdx = html.indexOf('<header')
    const navIdx = html.indexOf('<nav')
    const headerClose = html.indexOf('</header>')
    expect(navIdx).toBeGreaterThan(headerIdx)
    expect(navIdx).toBeLessThan(headerClose)
  })

  it('produces deterministic output for the same input', () => {
    expect(emitHtml(SIMPLE_PAGE)).toBe(emitHtml(SIMPLE_PAGE))
  })

  it('matches snapshot', () => {
    expect(emitHtml(SIMPLE_PAGE)).toMatchSnapshot()
  })
})
