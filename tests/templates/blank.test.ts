/**
 * Blank starter template (I-TPL-05) — round-trip + validation tests.
 *
 * The blank starter is what the user lands on when they pick "Blank" in
 * the template gallery or click "New". It must be schema-valid, free of
 * validation errors, ship a token registry that covers every preset's
 * needs, and contain exactly one `<h1>` so the document already
 * satisfies the single-h1 rule (I-DOC-05).
 */

import { describe, expect, it } from 'vitest'

import type { ElementNode, TokenCategory } from '../../src/document/types'
import { documentSchema } from '../../src/document/schemas'
import { validateDocument } from '../../src/document/validation'
import { presetsRegistry, type PresetContext } from '../../src/document/presets'
import { createBlankTemplate } from '../../src/templates/blank'

function walk(node: ElementNode, visit: (n: ElementNode) => void): void {
  visit(node)
  if (node.type === 'container') node.children.forEach((c) => walk(c, visit))
}

function collectTokenRefs(node: ElementNode): ReadonlyArray<string> {
  const refs: string[] = []
  const REF_RE = /^(color|spacing|fontSize|fontFamily|lineHeight|radius|shadow)\.[A-Za-z0-9_-]+$/
  const scan = (value: unknown): void => {
    if (value === null) return
    if (typeof value === 'string') {
      if (REF_RE.test(value)) refs.push(value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach(scan)
      return
    }
    if (typeof value === 'object') {
      for (const v of Object.values(value as Record<string, unknown>)) scan(v)
    }
  }
  walk(node, (n) => scan(n))
  return refs
}

describe('createBlankTemplate (I-TPL-05)', () => {
  it('round-trips through documentSchema', () => {
    const doc = createBlankTemplate()
    const result = documentSchema.safeParse(doc)
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error(result.error.format())
    }
    expect(result.success).toBe(true)
  })

  it('produces zero validation errors', () => {
    const report = validateDocument(createBlankTemplate('My Site'))
    if (report.errors.length > 0) {
      // eslint-disable-next-line no-console
      console.error(report.errors)
    }
    expect(report.errors).toEqual([])
  })

  it('contains exactly one <h1>', () => {
    const doc = createBlankTemplate()
    let h1Count = 0
    walk(doc.tree, (n) => {
      if (n.type === 'text' && n.tag === 'h1') h1Count += 1
    })
    expect(h1Count).toBe(1)
  })

  it('emits a <main> root with a single hero child', () => {
    const { tree } = createBlankTemplate()
    expect(tree.type).toBe('container')
    expect(tree.semanticRole).toBe('main')
    if (tree.type !== 'container') throw new Error('unreachable')
    expect(tree.children.length).toBe(1)
    expect(tree.children[0].semanticRole).toBe('section')
  })

  it('every token ref in the tree resolves against the default token registry', () => {
    const doc = createBlankTemplate()
    const defined = new Set<string>()
    for (const category of Object.keys(doc.tokens) as TokenCategory[]) {
      for (const t of doc.tokens[category]) defined.add(`${category}.${t.id}`)
    }
    const refs = collectTokenRefs(doc.tree)
    expect(refs.length).toBeGreaterThan(0)
    for (const ref of refs) expect(defined.has(ref)).toBe(true)
  })

  it('default tokens cover every reference any registered preset can emit', () => {
    // Materialize every preset, harvest its token refs, then assert that the
    // blank-starter token set defines all of them. Guards against drift when
    // a new preset adds a token reference the starter does not ship.
    const doc = createBlankTemplate()
    const defined = new Set<string>()
    for (const category of Object.keys(doc.tokens) as TokenCategory[]) {
      for (const t of doc.tokens[category]) defined.add(`${category}.${t.id}`)
    }
    const stableCtx: PresetContext = (() => {
      let n = 0
      return { generateId: () => `n${++n}` }
    })()
    const missing: string[] = []
    for (const [name, factory] of Object.entries(presetsRegistry)) {
      const subtree = factory({}, stableCtx)
      for (const ref of collectTokenRefs(subtree)) {
        if (!defined.has(ref)) missing.push(`${name}: ${ref}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('produces fresh ids on each call', () => {
    const a = createBlankTemplate()
    const b = createBlankTemplate()
    const idsA: string[] = []
    const idsB: string[] = []
    walk(a.tree, (n) => idsA.push(n.id))
    walk(b.tree, (n) => idsB.push(n.id))
    const overlap = idsA.filter((id) => idsB.includes(id))
    expect(overlap).toEqual([])
  })

  it('mirrors the supplied name into meta + seo', () => {
    const doc = createBlankTemplate('My Portfolio')
    expect(doc.meta.name).toBe('My Portfolio')
    expect(doc.seo.title).toBe('My Portfolio')
  })
})
