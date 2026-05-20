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

  describe('state pseudo-class blocks (I-GEN-07)', () => {
    it('emits a :hover rule containing only the overridden properties', () => {
      // The portfolio CTA has `states.hover.opacity = 0.85` and nothing else.
      const hoverBlock = css.match(/\.dtw-el-cta:hover \{[\s\S]*?\}/)?.[0] ?? ''
      expect(hoverBlock).toContain('opacity: 0.85;')
      // Base-only declarations (e.g. typography.color from base) must NOT
      // appear in the state block — only overrides do.
      expect(hoverBlock).not.toContain('color:')
      expect(hoverBlock).not.toContain('background-color:')
      expect(hoverBlock).not.toContain('padding-')
    })

    it('places state blocks after base rules and before @media breakpoints', () => {
      const hoverIdx = css.indexOf('.dtw-el-cta:hover')
      const baseCtaIdx = css.indexOf('.dtw-el-cta {')
      const mediaIdx = css.indexOf('@media (max-width:')
      expect(hoverIdx).toBeGreaterThan(baseCtaIdx)
      expect(hoverIdx).toBeLessThan(mediaIdx)
    })

    it('emits each declared state in the LVHA order hover → focus-visible → active', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      const cta = findById(doc.tree, 'cta')
      expect(cta).not.toBeNull()
      // Author the states in scrambled order so we prove the emitter sorts
      // them, not just that JSON preserves declaration order.
      cta!.states = {
        active: { opacity: 0.7 },
        'focus-visible': { opacity: 0.8 },
        hover: { opacity: 0.9 },
      }

      const out = emitCss(doc)
      const hoverIdx = out.indexOf('.dtw-el-cta:hover')
      const focusIdx = out.indexOf('.dtw-el-cta:focus-visible')
      const activeIdx = out.indexOf('.dtw-el-cta:active')
      expect(hoverIdx).toBeGreaterThan(-1)
      expect(focusIdx).toBeGreaterThan(hoverIdx)
      expect(activeIdx).toBeGreaterThan(focusIdx)
    })

    it('omits state blocks when no element declares any states', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      stripStates(doc.tree)
      const out = emitCss(doc)
      expect(out).not.toMatch(/:hover\s*\{/)
      expect(out).not.toMatch(/:focus-visible\s*\{/)
      expect(out).not.toMatch(/:active\s*\{/)
    })

    it('uses the literal `:focus-visible` selector (not `:focus`)', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      const cta = findById(doc.tree, 'cta') as { states?: Record<string, unknown> } | null
      cta!.states = { 'focus-visible': { opacity: 0.5 } }
      const out = emitCss(doc)
      expect(out).toContain('.dtw-el-cta:focus-visible')
      // Must not silently downgrade to plain `:focus`.
      expect(out).not.toMatch(/\.dtw-el-cta:focus\s*\{/)
    })
  })
})

// ---------------------------------------------------------------------------
// Helpers — kept here so test cases stay self-documenting
// ---------------------------------------------------------------------------

interface MutableNode {
  id: string
  states?: unknown
  children?: MutableNode[]
}

function findById(root: unknown, id: string): MutableNode | null {
  const stack: MutableNode[] = [root as MutableNode]
  while (stack.length > 0) {
    const node = stack.pop()!
    if (node.id === id) return node
    if (Array.isArray(node.children)) stack.push(...node.children)
  }
  return null
}

function stripStates(root: unknown): void {
  const stack: MutableNode[] = [root as MutableNode]
  while (stack.length > 0) {
    const node = stack.pop()!
    delete node.states
    if (Array.isArray(node.children)) stack.push(...node.children)
  }
}
