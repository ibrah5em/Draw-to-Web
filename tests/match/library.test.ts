/**
 * Design library — every bundled page must be a first-class document:
 * schema-valid, error-free, single-`<h1>`, axe-clean, generator-stable, and
 * carrying a precomputed signature that has not drifted from its source.
 *
 * Mirrors the round-trip + axe-gate patterns in `tests/templates/*` — a
 * library page is held to exactly the same bar as a template, with no
 * special-casing of the export pipeline.
 */

import { describe, expect, it } from 'vitest'

import type { ElementNode } from '@document/types'
import { documentSchema } from '@document/schemas'
import { validateDocument } from '@document/validation'
import { generate } from '@generator/index'
import { runAxeGate } from '@seo/axeGate'
import {
  adoptLibraryPage,
  extractSignature,
  findLayoutMatches,
  libraryPages,
  librarySignatures,
} from '@match/index'
import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'

function walk(node: ElementNode, visit: (n: ElementNode) => void): void {
  visit(node)
  if (node.type === 'container') node.children.forEach((c) => walk(c, visit))
}

function countH1(node: ElementNode): number {
  let n = 0
  walk(node, (el) => {
    if (el.type === 'text' && el.tag === 'h1') n += 1
  })
  return n
}

function collectIds(node: ElementNode): string[] {
  const ids: string[] = []
  walk(node, (el) => ids.push(el.id))
  return ids
}

describe('design library — registry', () => {
  it('registers at least four distinct archetypes', () => {
    expect(libraryPages.length).toBeGreaterThanOrEqual(4)
    const archetypes = new Set(libraryPages.map((p) => p.archetype))
    expect(archetypes.size).toBe(libraryPages.length)
  })

  it('uses unique, stable page ids', () => {
    const ids = libraryPages.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ships one precomputed signature per page, keyed by id', () => {
    expect(librarySignatures.map((s) => s.pageId).sort()).toEqual(
      libraryPages.map((p) => p.id).sort()
    )
  })
})

describe.each(libraryPages)('library page: $id', (page) => {
  it('round-trips through documentSchema', () => {
    const result = documentSchema.safeParse(page.create())
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(page.id, result.error.format())
    }
    expect(result.success).toBe(true)
  })

  it('produces zero validation errors', () => {
    const report = validateDocument(page.create())
    if (report.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(page.id, report.errors)
    }
    expect(report.errors).toEqual([])
  })

  it('roots the page on a <main> landmark with exactly one <h1>', () => {
    const doc = page.create()
    expect(doc.tree.semanticRole).toBe('main')
    expect(countH1(doc.tree)).toBe(1)
  })

  it('produces fresh element ids on each call', () => {
    const a = collectIds(page.create().tree)
    const b = collectIds(page.create().tree)
    expect(a.filter((id) => b.includes(id))).toEqual([])
  })

  it('generates deterministically (same document → byte-equal output)', async () => {
    const doc = page.create()
    const first = await generate(doc)
    const second = await generate(doc)
    expect(first.html).toBe(second.html)
    expect(first.css).toBe(second.css)
    expect(first.js).toBe(second.js)
  })

  it('exports without critical or serious axe violations', async () => {
    const doc = page.create()
    const { html } = await generate(doc)
    const htmlWithTitle = html.replace('</head>', `    <title>${doc.seo.title}</title>\n  </head>`)
    const report = await runAxeGate(htmlWithTitle)
    const blocking = report.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious'
    )
    if (blocking.length > 0) {
      // eslint-disable-next-line no-console
      console.error(
        `${page.id} blocking axe violations:\n` +
          blocking.map((v) => `  - ${v.id} (${v.impact}): ${v.help}`).join('\n')
      )
    }
    expect(blocking).toEqual([])
  }, 20_000)

  it('signature matches the committed precomputed signature (no drift)', () => {
    const committed = librarySignatures.find((s) => s.pageId === page.id)
    expect(committed).toBeDefined()
    expect(extractSignature(page.create())).toEqual(committed?.signature)
  })

  it('ranks itself #1 with score 1 when matched against the library', () => {
    const ranked = findLayoutMatches(page.create())
    expect(ranked[0].pageId).toBe(page.id)
    expect(ranked[0].score).toBeCloseTo(1, 10)
  })
})

describe('adopt — reuses the store hydration path', () => {
  it('hydrates a chosen page as the active, clean document with a fresh timeline', () => {
    useHistoryStore.getState().clear()
    const target = libraryPages[0]
    const adopted = adoptLibraryPage(target.id)

    const state = useDocumentStore.getState()
    // The adopted document is now the active document, byte-for-byte.
    expect(state.document).toBe(adopted)
    // Loading a design is not an unsaved edit — the dirty flag is clear.
    expect(state.isDirty).toBe(false)
    // The undo timeline is reset so the user cannot undo into the old project.
    const history = useHistoryStore.getState()
    expect(history.past).toEqual([])
    expect(history.future).toEqual([])
  })

  it('throws on an unknown page id', () => {
    expect(() => adoptLibraryPage('does-not-exist')).toThrow(/Unknown library page/)
  })
})
