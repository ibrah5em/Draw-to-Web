import { describe, it, expect } from 'vitest'
import { emitCss } from '@generator/cssEmitter'
import { SIMPLE_PAGE, PAGE_WITH_NAV } from './fixtures'

describe('emitCss', () => {
  it('includes a CSS reset', () => {
    const css = emitCss(SIMPLE_PAGE)
    expect(css).toContain('box-sizing: border-box')
    expect(css).toContain('margin: 0')
    expect(css).toContain('padding: 0')
  })

  it('includes the root 12-column grid', () => {
    const css = emitCss(SIMPLE_PAGE)
    expect(css).toContain('.dtw-canvas')
    expect(css).toContain('grid-template-columns: repeat(12, 1fr)')
  })

  it('emits scoped selectors for every element', () => {
    const css = emitCss(SIMPLE_PAGE)
    expect(css).toContain('.dtw-el-header-1')
    expect(css).toContain('.dtw-el-h1-1')
    expect(css).toContain('.dtw-el-img-1')
    expect(css).toContain('.dtw-el-btn-1')
    expect(css).toContain('.dtw-el-footer-1')
  })

  it('maps x and width to grid-column placement', () => {
    const css = emitCss(SIMPLE_PAGE)
    // header: x=0, width=12 → grid-column: 1 / span 12
    expect(css).toContain('.dtw-el-header-1')
    expect(css).toMatch(/\.dtw-el-header-1 \{[^}]*grid-column: 1 \/ span 12/)
    // h1: x=1, width=10 → grid-column: 2 / span 10
    expect(css).toMatch(/\.dtw-el-h1-1 \{[^}]*grid-column: 2 \/ span 10/)
  })

  it('emits min-height from element height', () => {
    const css = emitCss(SIMPLE_PAGE)
    expect(css).toMatch(/\.dtw-el-header-1 \{[^}]*min-height: 80px/)
  })

  it('emits margin-top for non-zero y positions', () => {
    const css = emitCss(SIMPLE_PAGE)
    // h1 has y=100, should have margin-top
    expect(css).toMatch(/\.dtw-el-h1-1 \{[^}]*margin-top: 100px/)
    // header has y=0, should NOT have margin-top
    const headerBlock = css.match(/\.dtw-el-header-1 \{[^}]*\}/s)?.[0] ?? ''
    expect(headerBlock).not.toContain('margin-top')
  })

  it('emits background-color from props', () => {
    const css = emitCss(SIMPLE_PAGE)
    expect(css).toContain('background-color: #1a1a2e')
    expect(css).toContain('background-color: #111111')
  })

  it('emits font-size as clamp() for responsive sizing', () => {
    const css = emitCss(SIMPLE_PAGE)
    // h1 has fontSize: 36
    expect(css).toMatch(/\.dtw-el-h1-1 \{[^}]*font-size: clamp\(/)
  })

  it('emits border-radius from props', () => {
    const css = emitCss(SIMPLE_PAGE)
    expect(css).toMatch(/\.dtw-el-btn-1 \{[^}]*border-radius: 4px/)
  })

  it('emits flexbox for nav containers', () => {
    const css = emitCss(PAGE_WITH_NAV)
    expect(css).toMatch(/\.dtw-el-nav-1 \{[^}]*display: flex/)
    expect(css).toMatch(/\.dtw-el-nav-1 \{[^}]*align-items: center/)
    expect(css).toMatch(/\.dtw-el-nav-1 \{[^}]*gap: 1rem/)
  })

  it('emits nested child selectors in the stylesheet', () => {
    const css = emitCss(PAGE_WITH_NAV)
    expect(css).toContain('.dtw-el-nav-link-1')
    expect(css).toContain('.dtw-el-nav-link-2')
  })

  it('produces deterministic output for the same input', () => {
    expect(emitCss(SIMPLE_PAGE)).toBe(emitCss(SIMPLE_PAGE))
  })

  it('matches snapshot', () => {
    expect(emitCss(SIMPLE_PAGE)).toMatchSnapshot()
  })
})
