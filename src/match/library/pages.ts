/**
 * Library page registry — the bundled professional designs.
 *
 * Each entry pairs a stable `id` with a pure factory that returns an
 * ordinary, schema-valid {@link Document}. Six genuinely distinct
 * archetypes so layout matching is meaningful (their section orders,
 * landmark placement, grid density, and text↔media mix all differ).
 *
 * This module is intentionally free of any signature import: the
 * build-time generation script (`scripts/generate-match-signatures.ts`)
 * imports it to compute `signatures.generated.ts`, so a dependency the
 * other way would be circular. `index.ts` joins the two.
 *
 * Pure data — no DOM, no React, no Zustand, no store.
 */

import type { Document } from '../../document/types'

import { createAgencyPage } from './agency'
import { createDocsArticlePage } from './docs-article'
import { createGalleryMediaPage } from './gallery-media'
import { createLandingSaasPage } from './landing-saas'
import { createPortfolioSplitPage } from './portfolio-split'
import { createResumeMinimalPage } from './resume-minimal'

/** One bundled professional design. */
export interface LibraryPage {
  /** Stable id used by the matcher and the adopt path. */
  readonly id: string
  /** Author-facing display name. */
  readonly name: string
  /** Coarse archetype label (for grouping / filtering in a future UI). */
  readonly archetype: string
  /** One-line description of the page's structure. */
  readonly description: string
  /** Pure factory returning a fresh, schema-valid document. */
  readonly create: () => Document
}

/**
 * The bundled library. Ordered by id for stable, deterministic iteration
 * (the generation script and tests rely on this order).
 */
export const libraryPages: ReadonlyArray<LibraryPage> = [
  {
    id: 'agency',
    name: 'Agency / business',
    archetype: 'business',
    description:
      'Nav → centered hero → services grid → CTA band → columned footer (five sections).',
    create: () => createAgencyPage(),
  },
  {
    id: 'docs-article',
    name: 'Docs / article',
    archetype: 'article',
    description: 'Nav → single-column long-form article (headings, prose, list) → simple footer.',
    create: () => createDocsArticlePage(),
  },
  {
    id: 'gallery-media',
    name: 'Media showcase',
    archetype: 'gallery',
    description: 'Nav → centered hero → media-led showcase band → simple footer.',
    create: () => createGalleryMediaPage(),
  },
  {
    id: 'landing-saas',
    name: 'SaaS landing',
    archetype: 'landing',
    description: 'Centered hero → 3-column feature grid → CTA band → simple footer (no nav).',
    create: () => createLandingSaasPage(),
  },
  {
    id: 'portfolio-split',
    name: 'Split-hero portfolio',
    archetype: 'portfolio',
    description: 'Nav → image-led split hero → 3-column project grid → columned footer.',
    create: () => createPortfolioSplitPage(),
  },
  {
    id: 'resume-minimal',
    name: 'Minimal résumé',
    archetype: 'resume',
    description: 'Header → stacked experience sections → simple footer (single column, text-led).',
    create: () => createResumeMinimalPage(),
  },
]

/**
 * Look up a library page by id.
 *
 * @param id - Stable page id.
 * @returns The {@link LibraryPage}, or `undefined` if no page has that id.
 */
export function getLibraryPage(id: string): LibraryPage | undefined {
  return libraryPages.find((p) => p.id === id)
}

/**
 * Build a fresh document for a library page by id.
 *
 * @param id - Stable page id.
 * @returns A fresh, schema-valid {@link Document}.
 * @throws If no page has the given id.
 */
export function buildLibraryDocumentById(id: string): Document {
  const page = getLibraryPage(id)
  if (!page) throw new Error(`Unknown library page: ${id}`)
  return page.create()
}
