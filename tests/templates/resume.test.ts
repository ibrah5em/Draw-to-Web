/**
 * Resume template (I-TPL-04) — schema, validation, axe gate, and
 * single-page print contract. The print stylesheet that I-GEN-13
 * shipped takes care of the visual A4 fit; this suite asserts the
 * shape the print stylesheet relies on (root is `<main>`, no `<nav>`
 * or `<footer>` getting hidden, sections grouped under `<section>`s).
 */

import { describe, expect, it } from 'vitest'

import type { ElementNode } from '@document/types'
import { documentSchema } from '@document/schemas'
import { validateDocument } from '@document/validation'
import { generate } from '@generator/index'
import { runAxeGate } from '@seo/axeGate'
import { createResumeTemplate } from '@templates/resume'

function walk(node: ElementNode, visit: (n: ElementNode) => void): void {
  visit(node)
  if (node.type === 'container') node.children.forEach((c) => walk(c, visit))
}

describe('createResumeTemplate (I-TPL-04)', () => {
  it('round-trips through documentSchema', () => {
    const doc = createResumeTemplate('Test Author')
    const result = documentSchema.safeParse(doc)
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(result.error.format())
    }
    expect(result.success).toBe(true)
  })

  it('produces zero validation errors', () => {
    const report = validateDocument(createResumeTemplate())
    if (report.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(report.errors)
    }
    expect(report.errors).toEqual([])
  })

  it('contains exactly one <h1>', () => {
    let h1Count = 0
    walk(createResumeTemplate().tree, (n) => {
      if (n.type === 'text' && n.tag === 'h1') h1Count += 1
    })
    expect(h1Count).toBe(1)
  })

  it('roots the page on a <main> so the print stylesheet keeps it visible', () => {
    const { tree } = createResumeTemplate()
    // I-GEN-13 print sheet hides <nav> and <footer>; <main> survives.
    expect(tree.semanticRole).toBe('main')
  })

  it('groups content under semantic <section> landmarks', () => {
    const { tree } = createResumeTemplate()
    if (tree.type !== 'container') throw new Error('unreachable')
    const sectionRoles = tree.children
      .filter((c) => c.semanticRole === 'section')
      .map((c) => c.id)
    // header + summary + experience + education + skills sections.
    expect(sectionRoles).toEqual(
      expect.arrayContaining(['summary', 'experience', 'education', 'skills'])
    )
  })

  it('does not emit nav or footer landmarks (the print sheet hides those)', () => {
    let hasNav = false
    let hasFooter = false
    walk(createResumeTemplate().tree, (n) => {
      if (n.semanticRole === 'nav') hasNav = true
      if (n.semanticRole === 'footer') hasFooter = true
    })
    expect(hasNav).toBe(false)
    expect(hasFooter).toBe(false)
  })

  it('keeps the runtime JS-lean (print parity with screen render)', () => {
    const { runtime } = createResumeTemplate()
    expect(runtime.themeToggle).toBe(true)
    expect(runtime.scrollSpy).toBe(false)
    expect(runtime.smoothScroll).toBe(false)
    expect(runtime.mobileNav).toBe(false)
    expect(runtime.navOnScroll).toBe(false)
    expect(runtime.reveals).toBe(false)
    expect(runtime.animationGating).toBe(false)
    expect(runtime.terminalTyping).toBe(false)
  })

  it('populates the SEO surface the export pipeline needs', () => {
    const { seo } = createResumeTemplate('Ada Lovelace')
    expect(seo.title).toContain('Ada Lovelace')
    expect(seo.description.length).toBeGreaterThan(0)
    expect(seo.author).toBe('Ada Lovelace')
    expect(seo.jsonLd?.kind).toBe('Person')
  })

  it('exports without critical or serious axe violations', async () => {
    const doc = createResumeTemplate('Test Author')
    const { html } = await generate(doc)
    const htmlWithTitle = html.replace('</head>', `    <title>${doc.seo.title}</title>\n  </head>`)
    const report = await runAxeGate(htmlWithTitle)
    const blocking = report.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    if (blocking.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        'resume blocking axe violations:\n' +
          blocking.map((v) => `  - ${v.id} (${v.impact}): ${v.help} — ${v.helpUrl}`).join('\n')
      )
    }
    expect(blocking).toEqual([])
  }, 20_000)

  it('produces fresh element ids on each call', () => {
    const a = createResumeTemplate()
    const b = createResumeTemplate()
    const idsA: string[] = []
    const idsB: string[] = []
    walk(a.tree, (n) => idsA.push(n.id))
    walk(b.tree, (n) => idsB.push(n.id))
    const STATIC = new Set(['summary', 'experience', 'education', 'skills'])
    const dynA = idsA.filter((i) => !STATIC.has(i))
    const dynB = idsB.filter((i) => !STATIC.has(i))
    const overlap = dynA.filter((i) => dynB.includes(i))
    expect(overlap).toEqual([])
  })
})
