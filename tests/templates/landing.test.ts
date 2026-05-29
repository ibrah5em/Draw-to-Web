/**
 * Landing template (I-TPL-03) — schema, validation, axe gate, and the
 * "lightweight runtime" contract that powers the Lighthouse Perf ≥ 95
 * DoD. Mirrors the portfolio suite where applicable.
 */

import { describe, expect, it } from 'vitest'

import type { ElementNode } from '@document/types'
import { documentSchema } from '@document/schemas'
import { validateDocument } from '@document/validation'
import { generate } from '@generator/index'
import { runAxeGate } from '@seo/axeGate'
import { createLandingTemplate } from '@templates/landing'

function walk(node: ElementNode, visit: (n: ElementNode) => void): void {
  visit(node)
  if (node.type === 'container') node.children.forEach((c) => walk(c, visit))
}

describe('createLandingTemplate (I-TPL-03)', () => {
  it('round-trips through documentSchema', () => {
    const doc = createLandingTemplate('Acme')
    const result = documentSchema.safeParse(doc)
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(result.error.format())
    }
    expect(result.success).toBe(true)
  })

  it('produces zero validation errors', () => {
    const report = validateDocument(createLandingTemplate())
    if (report.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(report.errors)
    }
    expect(report.errors).toEqual([])
  })

  it('contains exactly one <h1>', () => {
    let h1Count = 0
    walk(createLandingTemplate().tree, (n) => {
      if (n.type === 'text' && n.tag === 'h1') h1Count += 1
    })
    expect(h1Count).toBe(1)
  })

  it('roots the page on a <main> landmark', () => {
    const { tree } = createLandingTemplate()
    expect(tree.semanticRole).toBe('main')
  })

  it('keeps the runtime bundle minimal (perf budget)', () => {
    const { runtime } = createLandingTemplate()
    // Lighthouse Perf ≥ 95 is the I-TPL-03 DoD; only the lightest
    // snippets are allowed on by default.
    expect(runtime.themeToggle).toBe(true)
    expect(runtime.smoothScroll).toBe(true)
    expect(runtime.reveals).toBe(true)
    // Heavier observers stay off.
    expect(runtime.scrollSpy).toBe(false)
    expect(runtime.mobileNav).toBe(false)
    expect(runtime.navOnScroll).toBe(false)
    expect(runtime.animationGating).toBe(false)
    expect(runtime.terminalTyping).toBe(false)
  })

  it('populates the SEO surface the export pipeline needs', () => {
    const { seo } = createLandingTemplate('Acme')
    expect(seo.title).toContain('Acme')
    expect(seo.description.length).toBeGreaterThan(0)
    expect(seo.openGraph).toBeDefined()
    expect(seo.jsonLd?.kind).toBe('WebSite')
    expect(seo.themeColor?.light).toBeDefined()
    expect(seo.themeColor?.dark).toBeDefined()
  })

  it('exports without critical or serious axe violations', async () => {
    const doc = createLandingTemplate('Acme')
    const { html } = await generate(doc)
    // The generator envelope does not inject <title>; the SEO pipeline
    // does. Splice one in so axe-core does not flag document-title.
    const htmlWithTitle = html.replace('</head>', `    <title>${doc.seo.title}</title>\n  </head>`)
    const report = await runAxeGate(htmlWithTitle)
    const blocking = report.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    if (blocking.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        'landing blocking axe violations:\n' +
          blocking.map((v) => `  - ${v.id} (${v.impact}): ${v.help} — ${v.helpUrl}`).join('\n')
      )
    }
    expect(blocking).toEqual([])
  }, 20_000)

  it('produces fresh element ids on each call', () => {
    const a = createLandingTemplate()
    const b = createLandingTemplate()
    const idsA: string[] = []
    const idsB: string[] = []
    walk(a.tree, (n) => idsA.push(n.id))
    walk(b.tree, (n) => idsB.push(n.id))
    const overlap = idsA.filter((i) => idsB.includes(i))
    expect(overlap).toEqual([])
  })
})
