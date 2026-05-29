import { describe, it, expect } from 'vitest'
import { minifyHtml, minifyCss, minifyJs } from '../../src/export/minify'

describe('minifyHtml', () => {
  it('collapses whitespace and strips comments', async () => {
    const input = `<!doctype html>
<html>
  <head>
    <!-- a comment -->
    <title>Hi</title>
  </head>
  <body>
    <p>   spaced     out   </p>
  </body>
</html>`
    const out = await minifyHtml(input)
    expect(out).not.toContain('<!-- a comment -->')
    expect(out.length).toBeLessThan(input.length)
    expect(out).toContain('<title>Hi</title>')
  })

  it('preserves doctype and structure', async () => {
    const out = await minifyHtml(
      '<!doctype html><html><head><title>T</title></head><body><p>x</p></body></html>'
    )
    expect(out.toLowerCase()).toContain('<!doctype html>')
    expect(out).toContain('<title>T</title>')
    expect(out).toContain('<p>x</p>')
  })
})

describe('minifyCss', () => {
  it('drops whitespace and preserves var() references (the token contract)', async () => {
    const input = `:root {
      --color-accent: #ff0000;
    }
    .x {
      color: var(--color-accent);
      padding:   10px 20px ;
    }`
    const out = await minifyCss(input)
    expect(out).toContain('var(--color-accent)')
    expect(out).toContain('--color-accent')
    expect(out.length).toBeLessThan(input.length)
    // No comment-only whitespace lines.
    expect(out).not.toMatch(/\n\s*\n/)
  })

  it('preserves @media query semantics', async () => {
    const input = `@media (max-width: 768px) { .x { color: red; } }`
    const out = await minifyCss(input)
    expect(out).toContain('@media')
    // lightningcss may rewrite `max-width: 768px` to the L4 range form
    // `width<=768px`; both are semantically identical for our targets.
    expect(out).toMatch(/max-width:\s*768px|width<=\s*768px/)
    expect(out).toContain('color:red')
  })
})

describe('minifyJs', () => {
  it('removes whitespace and renames locals', async () => {
    const input = `(function () {
      var counter = 0;
      function bump() { counter = counter + 1; return counter; }
      bump();
    })();`
    const out = await minifyJs(input)
    expect(out.length).toBeLessThan(input.length)
    // Locals get mangled away — the literal name should disappear.
    expect(out).not.toContain('counter')
    expect(out).not.toContain('bump')
  })

  it('survives the IIFE + empty-catch shape every runtime snippet uses', async () => {
    const input = `(function () {
      try {
        var x = window.localStorage.getItem('k');
        if (x) { document.documentElement.dataset.theme = x; }
      } catch (e) {}
    })();`
    const out = await minifyJs(input)
    expect(out).toContain('localStorage')
    expect(out).toContain('documentElement')
  })

  it('returns a string for an empty input', async () => {
    const out = await minifyJs('')
    expect(typeof out).toBe('string')
  })
})
