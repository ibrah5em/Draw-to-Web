/**
 * Preset registry (I-TPL-01) — Zod round-trip + axe gate per preset.
 *
 * For every entry in `presetsRegistry` (C7) we:
 *   1. Materialize the preset against a deterministic id generator.
 *   2. Wrap it in a schema-valid `Document` whose tree carries exactly
 *      one `<h1>` — synthesised when the preset itself does not supply
 *      a heading (nav, footer, cards-grid, etc.).
 *   3. Assert `documentSchema.safeParse` succeeds.
 *   4. Run the generator and feed the HTML through `runAxeGate`,
 *      asserting zero `critical` / `serious` violations. A `<title>`
 *      is spliced into `<head>` before the gate runs because the
 *      generator envelope does not emit one — the SEO module
 *      (I-SEO-01) does that in the real export pipeline.
 *
 * This catches:
 *   - Schema drift in any factory (C1/C2 lockstep).
 *   - Generator-level a11y regressions surfaced by the export gate
 *     (I-EXP-02) before a release-blocking template export hits them.
 */

import { describe, expect, it } from 'vitest'

import type { Document, ElementNode } from '@document/types'
import { documentSchema } from '@document/schemas'
import { presetsRegistry, type PresetContext, type PresetId } from '@document/presets'
import { generate } from '@generator/index'
import { runAxeGate } from '@seo/axeGate'
import { createBlankTemplate } from '@templates/blank'

function walk(node: ElementNode, visit: (n: ElementNode) => void): void {
  visit(node)
  if (node.type === 'container') node.children.forEach((c) => walk(c, visit))
}

function hasH1(node: ElementNode): boolean {
  let found = false
  walk(node, (n) => {
    if (n.type === 'text' && n.tag === 'h1') found = true
  })
  return found
}

function stableContext(prefix: string): PresetContext {
  let n = 0
  return { generateId: () => `${prefix}-${++n}` }
}

function buildPresetDocument(presetId: PresetId): Document {
  const base = createBlankTemplate(`Preset: ${presetId}`)
  const subtree = presetsRegistry[presetId]({}, stableContext(presetId))

  const children: ElementNode[] = hasH1(subtree)
    ? [subtree]
    : [
        {
          type: 'text',
          id: `${presetId}-synthetic-h1`,
          tag: 'h1',
          content: presetId,
          style: { base: {} },
        },
        subtree,
      ]

  const root: ElementNode = {
    type: 'container',
    id: `${presetId}-root`,
    name: 'Page',
    semanticRole: 'main',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.lg' } },
    style: {
      base: {
        padding: {
          top: 'spacing.lg',
          right: 'spacing.md',
          bottom: 'spacing.lg',
          left: 'spacing.md',
        },
      },
    },
    children,
  }

  return { ...base, tree: root }
}

const presetIds = Object.keys(presetsRegistry) as PresetId[]

describe('preset registry (I-TPL-01)', () => {
  it('registers exactly the 8 presets named in I-DOC-04', () => {
    expect(presetIds.sort()).toEqual(
      [
        'card-basic',
        'cards-grid-3col',
        'cta-banner',
        'footer-columns',
        'footer-simple',
        'hero-centered',
        'hero-split',
        'nav-fixed',
      ].sort()
    )
  })

  describe.each(presetIds)('preset %s', (presetId) => {
    it('round-trips through documentSchema', () => {
      const doc = buildPresetDocument(presetId)
      const result = documentSchema.safeParse(doc)
      if (!result.success) {
        // eslint-disable-next-line no-console
        console.error(`[${presetId}] schema errors:`, result.error.format())
      }
      expect(result.success).toBe(true)
    })

    it('exports without critical or serious axe violations', async () => {
      const doc = buildPresetDocument(presetId)
      const { html } = await generate(doc)
      const htmlWithTitle = html.replace('</head>', `    <title>${presetId}</title>\n  </head>`)
      const report = await runAxeGate(htmlWithTitle)
      const blocking = report.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious'
      )
      if (blocking.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
          `[${presetId}] blocking axe violations:\n` +
            blocking.map((v) => `  - ${v.id} (${v.impact}): ${v.help} — ${v.helpUrl}`).join('\n')
        )
      }
      expect(blocking).toEqual([])
    }, 15_000)
  })
})
