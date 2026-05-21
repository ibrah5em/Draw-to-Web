/**
 * Portfolio template (I-TPL-02) — schema, validation, and axe gate.
 *
 * The portfolio template is the demo path for M3; it must:
 *   - Round-trip through `documentSchema` (C2).
 *   - Produce zero `validateDocument` errors (I-DOC-05) — exactly one
 *     `<h1>`, no token-ref drift, no duplicate ids.
 *   - Generate HTML/CSS/JS and pass `runAxeGate` with no `critical` or
 *     `serious` violations (I-EXP-02).
 *   - Carry the semantic landmarks the visual target relies on
 *     (`nav`, `main`, `footer`).
 *   - Pre-wire every runtime flag the target visually depends on, so
 *     downstream snippets light up as they ship without document edits.
 */

import { describe, expect, it } from 'vitest'

import type { ElementNode } from '@document/types'
import { documentSchema } from '@document/schemas'
import { validateDocument } from '@document/validation'
import { generate } from '@generator/index'
import { runAxeGate } from '@seo/axeGate'
import { createPortfolioTemplate } from '@templates/portfolio'

function walk(node: ElementNode, visit: (n: ElementNode) => void): void {
  visit(node)
  if (node.type === 'container') node.children.forEach((c) => walk(c, visit))
}

describe('createPortfolioTemplate (I-TPL-02)', () => {
  it('round-trips through documentSchema', () => {
    const doc = createPortfolioTemplate('Test Author')
    const result = documentSchema.safeParse(doc)
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(result.error.format())
    }
    expect(result.success).toBe(true)
  })

  it('produces zero validation errors', () => {
    const report = validateDocument(createPortfolioTemplate())
    if (report.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(report.errors)
    }
    expect(report.errors).toEqual([])
  })

  it('contains exactly one <h1>', () => {
    let h1Count = 0
    walk(createPortfolioTemplate().tree, (n) => {
      if (n.type === 'text' && n.tag === 'h1') h1Count += 1
    })
    expect(h1Count).toBe(1)
  })

  it('carries nav, main, and footer landmarks as direct children of the root', () => {
    const { tree } = createPortfolioTemplate()
    expect(tree.type).toBe('container')
    if (tree.type !== 'container') throw new Error('unreachable')
    const directRoles = tree.children.map((c) => c.semanticRole)
    expect(directRoles).toEqual(['nav', 'main', 'footer'])
  })

  it('opts into every visually load-bearing runtime flag', () => {
    const { runtime } = createPortfolioTemplate()
    expect(runtime.themeToggle).toBe(true)
    expect(runtime.scrollSpy).toBe(true)
    expect(runtime.smoothScroll).toBe(true)
    expect(runtime.mobileNav).toBe(true)
    expect(runtime.navOnScroll).toBe(true)
    expect(runtime.reveals).toBe(true)
    expect(runtime.animationGating).toBe(true)
  })

  it('populates the SEO surface the export pipeline needs', () => {
    const { seo } = createPortfolioTemplate('Ada Lovelace')
    expect(seo.title).toContain('Ada Lovelace')
    expect(seo.description.length).toBeGreaterThan(0)
    expect(seo.author).toBe('Ada Lovelace')
    expect(seo.openGraph).toBeDefined()
    expect(seo.jsonLd?.kind).toBe('Person')
    expect(seo.themeColor?.light).toBeDefined()
    expect(seo.themeColor?.dark).toBeDefined()
    expect(seo.preconnect?.length ?? 0).toBeGreaterThan(0)
  })

  it('exports without critical or serious axe violations', async () => {
    const doc = createPortfolioTemplate('Test Author')
    const { html } = await generate(doc)
    // SEO module (I-SEO-01) will inject <title> in the real pipeline;
    // the generator envelope does not, so splice one in for axe.
    const htmlWithTitle = html.replace('</head>', `    <title>${doc.seo.title}</title>\n  </head>`)
    const report = await runAxeGate(htmlWithTitle)
    const blocking = report.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    if (blocking.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        'portfolio blocking axe violations:\n' +
          blocking.map((v) => `  - ${v.id} (${v.impact}): ${v.help} — ${v.helpUrl}`).join('\n')
      )
    }
    expect(blocking).toEqual([])
  }, 20_000)

  it('produces fresh element ids on each call', () => {
    const a = createPortfolioTemplate()
    const b = createPortfolioTemplate()
    const idsA: string[] = []
    const idsB: string[] = []
    walk(a.tree, (n) => idsA.push(n.id))
    walk(b.tree, (n) => idsB.push(n.id))
    // Static section ids (hero, about, projects, stack, connect) overlap
    // by design — only the nanoid-generated ids should diverge.
    const STATIC_IDS = new Set(['hero', 'about', 'projects', 'stack', 'connect'])
    const dynA = idsA.filter((i) => !STATIC_IDS.has(i))
    const dynB = idsB.filter((i) => !STATIC_IDS.has(i))
    const overlap = dynA.filter((i) => dynB.includes(i))
    expect(overlap).toEqual([])
  })
})
