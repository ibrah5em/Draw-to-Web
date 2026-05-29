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

  describe('decorative body::before/::after (I-GEN-09)', () => {
    it('emits no decorative pseudo-element rules when settings.decorativeBackdrop is absent', () => {
      // Portfolio fixture has no decorativeBackdrop. The print
      // stylesheet (I-GEN-13) does reference body::before/::after to
      // hide them, so we look for the backdrop's identifying
      // `content: ""` declaration rather than the selector alone.
      expect(css).not.toMatch(/body::before \{[\s\S]*?content: ""/)
      expect(css).not.toMatch(/body::after \{[\s\S]*?content: ""/)
    })

    it('emits a body::before rule when settings.decorativeBackdrop.before is set', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      ;(doc as { settings: Record<string, unknown> }).settings = {
        ...doc.settings,
        decorativeBackdrop: {
          before: {
            background: [
              {
                kind: 'radial-gradient',
                shape: 'circle',
                stops: [
                  { color: 'color.accent', position: '0%' },
                  { color: 'transparent', position: '60%' },
                ],
              },
            ],
            opacity: 0.15,
            mixBlendMode: 'screen',
          },
        },
      }
      const out = emitCss(doc)
      const block = out.match(/body::before \{[\s\S]*?\n\}/)?.[0] ?? ''
      // Required pseudo-element invariants.
      expect(block).toContain('content: "";')
      expect(block).toContain('position: fixed;')
      expect(block).toContain('inset: 0;')
      expect(block).toContain('pointer-events: none;')
      expect(block).toContain('z-index: -1;')
      // Author-supplied paint properties.
      expect(block).toContain('background: radial-gradient')
      expect(block).toContain('var(--color-accent)')
      expect(block).toContain('opacity: 0.15;')
      expect(block).toContain('mix-blend-mode: screen;')
    })

    it('emits a body::after rule when settings.decorativeBackdrop.after is set', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      ;(doc as { settings: Record<string, unknown> }).settings = {
        ...doc.settings,
        decorativeBackdrop: {
          after: {
            background: [
              {
                kind: 'image',
                imageUrl: 'data:image/svg+xml,noise',
                size: '256px 256px',
                repeat: 'repeat',
              },
            ],
            opacity: 0.06,
          },
        },
      }
      const out = emitCss(doc)
      const block = out.match(/body::after \{[\s\S]*?\n\}/)?.[0] ?? ''
      expect(block).toContain('content: "";')
      expect(block).toContain('background:')
      expect(block).toContain('opacity: 0.06;')
    })

    it('uses position: fixed (Invariant 5.4 — no position: absolute anywhere)', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      ;(doc as { settings: Record<string, unknown> }).settings = {
        ...doc.settings,
        decorativeBackdrop: {
          before: { background: [{ kind: 'solid', color: 'color.bg' }] },
          after: { background: [{ kind: 'solid', color: 'color.text' }] },
        },
      }
      const out = emitCss(doc)
      expect(out).not.toMatch(/position\s*:\s*absolute/)
    })

    it('places decorative pseudo-elements before per-element rules', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      ;(doc as { settings: Record<string, unknown> }).settings = {
        ...doc.settings,
        decorativeBackdrop: {
          before: { background: [{ kind: 'solid', color: 'color.bg' }] },
        },
      }
      const out = emitCss(doc)
      const beforeIdx = out.indexOf('body::before')
      const firstElIdx = out.indexOf('.dtw-el-root')
      expect(beforeIdx).toBeGreaterThan(-1)
      expect(beforeIdx).toBeLessThan(firstElIdx)
    })
  })

  describe('borders, radii, shadows (I-GEN-10)', () => {
    interface MutableStyleBlock {
      borderRadius?: Record<string, string>
      shadows?: Array<Record<string, string | boolean | undefined>>
    }
    interface MutableElement {
      id: string
      style: { base: MutableStyleBlock }
    }
    function withStyle(id: string, base: MutableStyleBlock): Document {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      const node = findById(doc.tree, id) as MutableElement | null
      node!.style.base = { ...node!.style.base, ...base } as MutableStyleBlock
      return doc
    }

    it('emits per-corner border-radius props when no `all` shortcut is set', () => {
      const doc = withStyle('cta', {
        borderRadius: { topLeft: '4px', topRight: '8px', bottomRight: '16px', bottomLeft: '0px' },
      })
      const out = emitCss(doc)
      const ctaRule = out.match(/\.dtw-el-cta \{[\s\S]*?\}/)?.[0] ?? ''
      expect(ctaRule).toContain('border-top-left-radius: 4px;')
      expect(ctaRule).toContain('border-top-right-radius: 8px;')
      expect(ctaRule).toContain('border-bottom-right-radius: 16px;')
      expect(ctaRule).toContain('border-bottom-left-radius: 0px;')
      // The shorthand must NOT appear when per-corner values are used.
      expect(ctaRule).not.toMatch(/border-radius:\s*[^;]*?,/)
    })

    it('collapses to `border-radius` shorthand when `all` is set', () => {
      const doc = withStyle('cta', { borderRadius: { all: 'radius.sm' } })
      const out = emitCss(doc)
      const ctaRule = out.match(/\.dtw-el-cta \{[\s\S]*?\}/)?.[0] ?? ''
      expect(ctaRule).toContain('border-radius: var(--radius-sm);')
    })

    it('composes multi-layer shadow into a single comma-joined `box-shadow`', () => {
      const doc = withStyle('cta', {
        shadows: [
          { offsetX: '0', offsetY: '1px', blur: '2px', color: 'rgba(0,0,0,0.1)' },
          { offsetX: '0', offsetY: '8px', blur: '24px', color: 'rgba(0,0,0,0.2)' },
        ],
      })
      const out = emitCss(doc)
      const ctaRule = out.match(/\.dtw-el-cta \{[\s\S]*?\}/)?.[0] ?? ''
      expect(ctaRule).toMatch(
        /box-shadow: 0 1px 2px 0 rgba\(0,0,0,0\.1\), 0 8px 24px 0 rgba\(0,0,0,0\.2\);/
      )
    })

    it('emits a token-bound shadow as a var() reference (accent glow path)', () => {
      // Canonical accent-glow recipe: a single shadow layer whose colour
      // is bound to `color.accent`, optionally augmented by the
      // `accent-glow` keyframe (I-GEN-11) for an animated pulse.
      const doc = withStyle('cta', {
        shadows: [{ offsetX: '0', offsetY: '0', blur: '24px', color: 'color.accent' }],
      })
      const out = emitCss(doc)
      const ctaRule = out.match(/\.dtw-el-cta \{[\s\S]*?\}/)?.[0] ?? ''
      expect(ctaRule).toContain('box-shadow: 0 0 24px 0 var(--color-accent);')
    })
  })

  describe('print stylesheet (I-GEN-13)', () => {
    it('emits an @media print block', () => {
      expect(css).toContain('@media print {')
    })

    it('sets @page margins', () => {
      const block = css.match(/@media print \{[\s\S]*?\n\}/)?.[0] ?? ''
      expect(block).toContain('@page')
      expect(block).toMatch(/margin:\s*\d+mm/)
    })

    it('forces print-color-adjust: exact so backgrounds print', () => {
      const block = css.match(/@media print \{[\s\S]*?\n\}/)?.[0] ?? ''
      expect(block).toContain('print-color-adjust: exact')
    })

    it('hides nav, footer, and the skip link from print output', () => {
      const block = css.match(/@media print \{[\s\S]*?\n\}/)?.[0] ?? ''
      expect(block).toContain('nav,')
      expect(block).toContain('footer,')
      expect(block).toContain('.dtw-skip-link')
      expect(block).toMatch(/display:\s*none\s*!important/)
    })

    it('appends link URLs after anchor text so paper is readable', () => {
      const block = css.match(/@media print \{[\s\S]*?\n\}/)?.[0] ?? ''
      expect(block).toContain('a[href]::after')
      expect(block).toContain('content: " (" attr(href) ")"')
    })

    it('prevents page breaks inside headings', () => {
      const block = css.match(/@media print \{[\s\S]*?\n\}/)?.[0] ?? ''
      expect(block).toMatch(/break-inside:\s*avoid/)
    })
  })

  describe('view transitions (I-GEN-14)', () => {
    it('emits ::view-transition-* rules when theme toggle runtime is enabled', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      ;(doc as { runtime: Record<string, boolean> }).runtime = {
        ...doc.runtime,
        themeToggle: true,
      }
      const out = emitCss(doc)
      expect(out).toContain('::view-transition-old(root)')
      expect(out).toContain('::view-transition-new(root)')
      expect(out).toContain('animation-duration: 200ms')
    })

    it('shortens the transition under prefers-reduced-motion', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      ;(doc as { runtime: Record<string, boolean> }).runtime = {
        ...doc.runtime,
        themeToggle: true,
      }
      const out = emitCss(doc)
      // Two reduced-motion blocks may exist (decorative anims +
      // view-transition); we just check the view-transition one.
      expect(out).toMatch(
        /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?::view-transition-old\(root\)/
      )
      expect(out).toMatch(/animation-duration:\s*1ms/)
    })

    it('omits view-transition rules when theme toggle is disabled', () => {
      // The portfolio fixture has themeToggle off out of the box.
      expect(css).not.toContain('::view-transition-old(root)')
    })
  })

  describe('smooth scroll (I-RUN-03)', () => {
    it('emits scroll-behavior + scroll-padding-top when smoothScroll runtime is on', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      ;(doc as { runtime: Record<string, boolean> }).runtime = {
        ...doc.runtime,
        smoothScroll: true,
      }
      const out = emitCss(doc)
      expect(out).toMatch(/html \{[^}]*scroll-behavior:\s*smooth/)
      expect(out).toMatch(/scroll-padding-top:\s*var\(--dtw-nav-pad,\s*0px\)/)
    })

    it('demotes scroll-behavior to auto under prefers-reduced-motion', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      ;(doc as { runtime: Record<string, boolean> }).runtime = {
        ...doc.runtime,
        smoothScroll: true,
      }
      const out = emitCss(doc)
      expect(out).toMatch(
        /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?html \{[\s\S]*?scroll-behavior:\s*auto/
      )
    })

    it('omits the smooth-scroll block entirely when the flag is off', () => {
      // Portfolio fixture has smoothScroll off out of the box.
      expect(css).not.toContain('scroll-behavior: smooth')
      expect(css).not.toContain('--dtw-nav-pad')
    })
  })

  describe('animations + prefers-reduced-motion (I-GEN-11)', () => {
    function withAnimation(animation: Record<string, unknown>, id = 'title'): Document {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      const node = findById(doc.tree, id) as { animation?: Record<string, unknown> } | null
      node!.animation = animation
      return doc
    }

    it('emits no @keyframes and no reduced-motion block when no element animates', () => {
      // The portfolio fixture is animation-free out of the box.
      expect(css).not.toMatch(/@keyframes\s+/)
      expect(css).not.toContain('prefers-reduced-motion')
    })

    it('emits @keyframes only for animations the document actually references', () => {
      const doc = withAnimation({ name: 'fadeUp' })
      const out = emitCss(doc)
      expect(out).toMatch(/@keyframes fadeUp \{/)
      expect(out).not.toMatch(/@keyframes pulse-dot/)
      expect(out).not.toMatch(/@keyframes shimmer/)
    })

    it('emits the animation shorthand on the element rule with sensible defaults', () => {
      const doc = withAnimation({ name: 'fadeUp' })
      const out = emitCss(doc)
      const titleRule = out.match(/\.dtw-el-title \{[\s\S]*?\}/)?.[0] ?? ''
      expect(titleRule).toMatch(/animation: fadeUp 600ms ease 0ms 1 normal both;/)
    })

    it('honours author-supplied duration, easing, delay, iteration, direction, fill', () => {
      const doc = withAnimation({
        name: 'pulse-dot',
        duration: '1.2s',
        easing: 'ease-in-out',
        delay: '300ms',
        iterationCount: 'infinite',
        direction: 'alternate',
        fillMode: 'forwards',
      })
      const out = emitCss(doc)
      const titleRule = out.match(/\.dtw-el-title \{[\s\S]*?\}/)?.[0] ?? ''
      expect(titleRule).toContain(
        'animation: pulse-dot 1.2s ease-in-out 300ms infinite alternate forwards;'
      )
    })

    it('adds animation-play-state: paused when gateOnView is set (I-RUN-07 hook)', () => {
      const doc = withAnimation({ name: 'fadeUp', gateOnView: true })
      const out = emitCss(doc)
      const titleRule = out.match(/\.dtw-el-title \{[\s\S]*?\}/)?.[0] ?? ''
      expect(titleRule).toContain('animation-play-state: paused;')
    })

    it('disables decorative animations under prefers-reduced-motion', () => {
      const doc = withAnimation({ name: 'fadeUp' }) // decorative defaults to true
      const out = emitCss(doc)
      expect(out).toContain('@media (prefers-reduced-motion: reduce)')
      const block = out.match(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/)?.[0] ?? ''
      expect(block).toContain('.dtw-el-title')
      expect(block).toContain('animation: none;')
    })

    it('keeps essential animations (decorative: false) under prefers-reduced-motion', () => {
      const doc = withAnimation({ name: 'fadeUp', decorative: false })
      const out = emitCss(doc)
      // The keyframes are still emitted...
      expect(out).toMatch(/@keyframes fadeUp/)
      // ...but no reduced-motion override exists because nothing is decorative.
      expect(out).not.toContain('prefers-reduced-motion')
    })

    it('ships the full keyframe library when every animation type is referenced', () => {
      // Hang one animation off each of six distinct elements.
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      const targets = ['title', 'cta', 'header', 'hero', 'divider', 'skills']
      const names = ['fadeUp', 'pulse-dot', 'blink-cursor', 'typing-line', 'shimmer', 'accent-glow']
      let n = 0
      for (const id of targets) {
        const node = findById(doc.tree, id) as { animation?: Record<string, unknown> } | null
        if (node && n < names.length) {
          node.animation = { name: names[n] }
          n += 1
        }
      }
      const out = emitCss(doc)
      for (let i = 0; i < n; i += 1) {
        expect(out).toMatch(new RegExp(`@keyframes ${escapeRegex(names[i])} \\{`))
      }
    })

    it('emits keyframes in stable library order regardless of which elements use them', () => {
      const doc: Document = JSON.parse(JSON.stringify(PORTFOLIO_DOCUMENT))
      const a = findById(doc.tree, 'title') as { animation?: Record<string, unknown> } | null
      const b = findById(doc.tree, 'cta') as { animation?: Record<string, unknown> } | null
      // Reference shimmer (5th in library) BEFORE fadeUp (1st) by tree order.
      a!.animation = { name: 'shimmer' }
      b!.animation = { name: 'fadeUp' }
      const out = emitCss(doc)
      const fadeUpIdx = out.indexOf('@keyframes fadeUp')
      const shimmerIdx = out.indexOf('@keyframes shimmer')
      expect(fadeUpIdx).toBeGreaterThan(-1)
      expect(shimmerIdx).toBeGreaterThan(fadeUpIdx)
    })

    it('places the reduced-motion override after the per-breakpoint @media blocks', () => {
      const doc = withAnimation({ name: 'fadeUp' })
      const out = emitCss(doc)
      const breakpointIdx = out.indexOf('@media (max-width:')
      const reducedIdx = out.indexOf('@media (prefers-reduced-motion: reduce)')
      expect(breakpointIdx).toBeGreaterThan(-1)
      expect(reducedIdx).toBeGreaterThan(breakpointIdx)
    })
  })
})

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

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
