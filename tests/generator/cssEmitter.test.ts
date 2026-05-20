import { describe, it, expect } from 'vitest'
import { emitCss } from '../../src/generator/cssEmitter'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'
import type { Document } from '../../src/document/types'

describe('emitCss(document)', () => {
  const css = emitCss(PORTFOLIO_DOCUMENT)

  it('includes a CSS reset at the top', () => {
    expect(css.startsWith('*')).toBe(true)
    expect(css).toContain('box-sizing: border-box')
  })

  it('emits a :root token block with custom properties for every token', () => {
    expect(css).toMatch(/:root \{[\s\S]*--color-bg: #ffffff;[\s\S]*\}/)
    expect(css).toContain('--space-md: 16px;')
    expect(css).toContain('--font-size-h1: clamp(28px, 2rem + 2vw, 56px);')
    expect(css).toContain('--radius-sm: 4px;')
  })

  it('emits a [data-theme="dark"] override block for colour tokens only (I-GEN-04, I-GEN-06)', () => {
    expect(css).toMatch(/:root\[data-theme="dark"\] \{[\s\S]*--color-bg: #0b0b10;[\s\S]*\}/)
    // Non-colour tokens (spacing, font sizes) do not vary by theme, so they
    // must not appear in the dark override.
    const darkBlock = css.match(/:root\[data-theme="dark"\] \{[\s\S]*?\}/)?.[0] ?? ''
    expect(darkBlock).toContain('--color-')
    expect(darkBlock).not.toContain('--space-')
    expect(darkBlock).not.toContain('--font-size-')
  })

  it('emits the prefers-color-scheme dark fallback so OS preference wins until toggled', () => {
    expect(css).toContain('@media (prefers-color-scheme: dark)')
    expect(css).toContain(':root:not([data-theme])')
  })

  it('references tokens via var() rather than the resolved value (I-GEN-05)', () => {
    // The CTA link has `typography.color = color.bg` — must come out as a var(), not the hex.
    const ctaBlock = css.match(/\.dtw-el-cta \{[\s\S]*?\}/)?.[0] ?? ''
    expect(ctaBlock).toContain('color: var(--color-bg);')
    expect(ctaBlock).toContain('background-color: var(--color-accent);')
    expect(ctaBlock).not.toContain('#ffffff')
  })

  it('emits per-breakpoint @media blocks for elements with responsive overrides (I-GEN-08)', () => {
    // The root has a `mobile` padding override — must surface inside the
    // 768px max-width block.
    expect(css).toContain('@media (max-width: 768px) {')
    const mobileBlock = css.match(/@media \(max-width: 768px\) \{[\s\S]*?\n\}/)?.[0] ?? ''
    expect(mobileBlock).toContain('.dtw-el-root')
    expect(mobileBlock).toContain('padding-top: var(--space-md);')
  })

  it('emits Flexbox + Grid for layout — never position: absolute', () => {
    expect(css).not.toMatch(/position\s*:\s*absolute/)
    expect(css).toContain('display: flex')
  })

  it('handles an empty-tokens document without crashing', () => {
    const doc: Document = {
      ...PORTFOLIO_DOCUMENT,
      tokens: {
        color: [],
        spacing: [],
        fontSize: [],
        fontFamily: [],
        lineHeight: [],
        radius: [],
        shadow: [],
      },
    }
    const out = emitCss(doc)
    expect(out).toContain('box-sizing: border-box')
    expect(out).not.toContain(':root {')
  })
})
