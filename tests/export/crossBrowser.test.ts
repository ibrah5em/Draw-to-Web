import { describe, expect, test } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { generate } from '@generator'
import { injectSEO } from '@seo'
import { canvasElementsToDocument } from '../../src/export/legacyAdapter'
import { PAGE_WITH_NAV, SIMPLE_PAGE } from '../fixtures/legacyElements'

/**
 * Minimum browser versions where each CSS feature shipped unprefixed and stable.
 * Sourced from MDN / caniuse baselines; intentionally conservative.
 */
interface FeatureSupport {
  pattern: RegExp
  name: string
  chrome: number
  firefox: number
  safari: number
  edge: number
}

const CSS_FEATURES: FeatureSupport[] = [
  {
    pattern: /\bdisplay:\s*grid\b/i,
    name: 'CSS Grid',
    chrome: 57,
    firefox: 52,
    safari: 10.1,
    edge: 16,
  },
  {
    pattern: /\bdisplay:\s*flex\b/i,
    name: 'Flexbox',
    chrome: 29,
    firefox: 28,
    safari: 9,
    edge: 12,
  },
  {
    pattern: /\bdisplay:\s*inline-flex\b/i,
    name: 'inline-flex',
    chrome: 29,
    firefox: 28,
    safari: 9,
    edge: 12,
  },
  {
    pattern: /\bgrid-template-columns\b/i,
    name: 'grid-template-columns',
    chrome: 57,
    firefox: 52,
    safari: 10.1,
    edge: 16,
  },
  {
    pattern: /\bgrid-column\b/i,
    name: 'grid-column shorthand',
    chrome: 57,
    firefox: 52,
    safari: 10.1,
    edge: 16,
  },
  { pattern: /\brepeat\(/i, name: 'CSS repeat()', chrome: 57, firefox: 52, safari: 10.1, edge: 16 },
  { pattern: /\bclamp\(/i, name: 'clamp()', chrome: 79, firefox: 75, safari: 13.1, edge: 79 },
  { pattern: /\bgap:\s*\d/i, name: 'gap (flex)', chrome: 84, firefox: 63, safari: 14.1, edge: 84 },
  {
    pattern: /\bmargin-inline\b/i,
    name: 'margin-inline',
    chrome: 87,
    firefox: 66,
    safari: 14.5,
    edge: 87,
  },
  {
    pattern: /\bbox-sizing:\s*border-box\b/i,
    name: 'box-sizing',
    chrome: 10,
    firefox: 29,
    safari: 5.1,
    edge: 12,
  },
  {
    pattern: /\bmin-height:\s*100vh\b/i,
    name: 'viewport units (vh)',
    chrome: 26,
    firefox: 19,
    safari: 6.1,
    edge: 12,
  },
]

/** Modern-baseline targets (evergreen browsers, 2022+). Anything ≤ these is safe. */
const TARGETS = { chrome: 100, firefox: 100, safari: 15, edge: 100 }

/**
 * Patterns we explicitly forbid in generated CSS for cross-browser
 * hygiene. `position: fixed` is allowed because the skip-to-content
 * link (I-GEN-19) and decorative `body::before/::after` (I-GEN-09)
 * legitimately need it. `-webkit-print-color-adjust` is allowed
 * because Safari ≤ 15 still requires the prefixed property (the
 * standards-only `print-color-adjust` is also emitted alongside).
 */
const FORBIDDEN_CSS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bposition:\s*absolute\b/i, reason: 'absolute positioning is forbidden by design' },
  {
    // Match vendor prefixes other than the Safari-required
    // `-webkit-print-color-adjust` allowlist entry.
    pattern: /(?<!print-color-adjust)(-moz-|-ms-|-o-)/i,
    reason: 'vendor prefixes — output must be standards-only',
  },
  {
    // -webkit- is allowed only on the print-color-adjust legacy property.
    pattern: /-webkit-(?!print-color-adjust)/i,
    reason: '-webkit- vendor prefix outside the print-color-adjust allowlist',
  },
  { pattern: /@-webkit-|@-moz-/i, reason: 'vendor at-rules' },
  { pattern: /<script/i, reason: 'no JS in generated output' },
]

/** HTML hygiene: no inline event handlers, no script tags, no inline styles. */
const FORBIDDEN_HTML: { pattern: RegExp; reason: string }[] = [
  { pattern: /<script\b/i, reason: 'inline <script> in generated HTML' },
  { pattern: /\bon[a-z]+=/i, reason: 'inline event handler attribute' },
  { pattern: /\bstyle="/i, reason: 'inline style attribute — all styles should be in CSS file' },
  { pattern: /\bjavascript:/i, reason: 'javascript: URL' },
]

function runAudit(name: string, html: string, css: string) {
  console.log(`\n=== Cross-browser audit: ${name} ===`)

  // 1. Feature inventory
  const present = CSS_FEATURES.filter((f) => f.pattern.test(css))
  console.log(`\nCSS features detected (${present.length}):`)
  console.log('Feature                  | Chrome | Firefox | Safari | Edge   | OK?')
  console.log('-------------------------|--------|---------|--------|--------|-----')
  const unsupported: string[] = []
  for (const f of present) {
    const ok =
      f.chrome <= TARGETS.chrome &&
      f.firefox <= TARGETS.firefox &&
      f.safari <= TARGETS.safari &&
      f.edge <= TARGETS.edge
    if (!ok) unsupported.push(f.name)
    console.log(
      `${f.name.padEnd(24)} | ${String(f.chrome).padEnd(6)} | ${String(f.firefox).padEnd(7)} | ${String(f.safari).padEnd(6)} | ${String(f.edge).padEnd(6)} | ${ok ? 'yes' : 'NO'}`
    )
  }

  // 2. Forbidden patterns in CSS
  const cssViolations = FORBIDDEN_CSS.filter((f) => f.pattern.test(css))
  // 3. Forbidden patterns in HTML
  const htmlViolations = FORBIDDEN_HTML.filter((f) => f.pattern.test(html))

  console.log(`\nForbidden-pattern scan:`)
  console.log(
    `  CSS:  ${cssViolations.length === 0 ? 'clean' : cssViolations.map((v) => v.reason).join('; ')}`
  )
  console.log(
    `  HTML: ${htmlViolations.length === 0 ? 'clean' : htmlViolations.map((v) => v.reason).join('; ')}`
  )

  return { unsupported, cssViolations, htmlViolations }
}

async function buildAndAudit(name: string, elements: typeof SIMPLE_PAGE) {
  const seoConfig = {
    title: `Draw-to-Web Cross-browser Test — ${name}`,
    description: 'Generated output used for cross-browser validation.',
    canonicalUrl: 'https://example.com/',
  }
  const doc = canvasElementsToDocument(elements, seoConfig)
  const { html, css } = await generate(doc)
  const seoHtml = injectSEO(html, doc.seo)
  return { html: seoHtml, css, ...runAudit(name, seoHtml, css) }
}

describe('cross-browser validation', () => {
  test('PAGE_WITH_NAV uses only baseline-2022 web features', async () => {
    const r = await buildAndAudit('PAGE_WITH_NAV', PAGE_WITH_NAV)
    expect(r.unsupported, `unsupported features: ${r.unsupported.join(', ')}`).toEqual([])
    expect(r.cssViolations.map((v) => v.reason)).toEqual([])
    expect(r.htmlViolations.map((v) => v.reason)).toEqual([])
  })

  test('SIMPLE_PAGE uses only baseline-2022 web features', async () => {
    const r = await buildAndAudit('SIMPLE_PAGE', SIMPLE_PAGE)
    expect(r.unsupported, `unsupported features: ${r.unsupported.join(', ')}`).toEqual([])
    expect(r.cssViolations.map((v) => v.reason)).toEqual([])
    expect(r.htmlViolations.map((v) => v.reason)).toEqual([])
  })

  test('writes a sample export to cross-browser-out/ for manual browser testing', async () => {
    const r = await buildAndAudit('SIMPLE_PAGE (manual)', SIMPLE_PAGE)
    const outDir = resolve(__dirname, '../../cross-browser-out')
    mkdirSync(outDir, { recursive: true })
    writeFileSync(resolve(outDir, 'index.html'), r.html)
    writeFileSync(resolve(outDir, 'styles.css'), r.css)
    console.log(`\nSample export written to: ${outDir}`)
    console.log('Open index.html in Chrome / Firefox / Safari / Edge to verify visually.')
  })
})
