/**
 * Document-model fixtures for the export + SEO pipeline tests.
 *
 * Replaces the v0.1.0 `CanvasElement[]` fixtures (`legacyElements.ts`)
 * now that the legacy adapter is gone. These build real `Document` trees
 * off the blank starter template so the pipeline tests drive the same
 * shape the live app produces — no canvas-element translation layer.
 */

import { createBlankTemplate } from '../../src/templates/blank'
import type { ButtonNode, ContainerNode, Document, SEOConfig } from '../../src/document/types'

/**
 * A schema-valid, axe-clean `Document` for pipeline tests. Starts from
 * the blank starter (single `<h1>` hero, full default token registry)
 * and shallow-merges any SEO overrides onto `document.seo`.
 *
 * @param seo - Partial SEO config merged over the template defaults.
 *   `title` also seeds the template name; defaults to `'Test Page'`.
 */
export function buildSimpleDocument(seo: Partial<SEOConfig> = {}): Document {
  const base = createBlankTemplate(seo.title ?? 'Test Page')
  return { ...base, seo: { ...base.seo, ...seo } }
}

/**
 * Same as `buildSimpleDocument` but with an extra empty-content
 * `<button>` appended to the root. axe-core flags it as a `button-name`
 * (serious) violation — used to assert the a11y gate blocks export.
 *
 * @param seo - Partial SEO config merged over the template defaults.
 */
export function buildDocumentWithBadButton(seo: Partial<SEOConfig> = {}): Document {
  const base = buildSimpleDocument(seo)
  const root = base.tree as ContainerNode
  const badButton: ButtonNode = {
    id: 'empty-btn',
    type: 'button',
    content: '',
    style: { base: {} },
  }
  return { ...base, tree: { ...root, children: [...root.children, badButton] } }
}
