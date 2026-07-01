/**
 * Library page: SaaS landing.
 *
 * Archetype: a short marketing page — centered hero → 3-column feature
 * grid → call-to-action band → simple footer. No nav, text-led hero.
 * Composed entirely from `presetsRegistry` (C7) primitives, so it is an
 * ordinary editable document once adopted.
 */

import { defaultPresetContext, presetsRegistry } from '../../document/presets'
import type { Document } from '../../document/types'

import { LIBRARY_RUNTIME_LIGHT, buildLibraryDocument, buildLibrarySeo } from './shared'

/**
 * Build the SaaS-landing library page.
 *
 * @param productName - Display name woven into copy + SEO. Defaults to `'Northwind'`.
 * @returns A schema-valid {@link Document}.
 */
export function createLandingSaasPage(productName: string = 'Northwind'): Document {
  const ctx = defaultPresetContext()

  const hero = presetsRegistry['hero-centered'](
    {
      title: 'Ship the page you sketched.',
      subtitle:
        'Compose modern, semantic, responsive pages on a canvas. Export production-ready HTML, CSS, and JS — no framework, no lock-in.',
      primaryLabel: 'Get started',
      secondaryLabel: 'See features',
    },
    ctx
  )

  const features = presetsRegistry['cards-grid-3col'](
    {
      cards: [
        {
          iconName: 'layers',
          title: 'Tokens, not hex codes',
          body: 'Bind every color, spacing, and font to a design token. Themes flip in one click.',
        },
        {
          iconName: 'sparkles',
          title: 'Semantic by default',
          body: 'Container roles map to header, nav, main, and footer. Skip-links and ARIA come standard.',
        },
        {
          iconName: 'shield',
          title: 'Gated for accessibility',
          body: 'axe-core blocks export on any critical or serious violation. Ship clean or do not ship.',
        },
      ],
    },
    ctx
  )

  const cta = presetsRegistry['cta-banner'](
    {
      title: 'Ready to ship?',
      subtitle:
        'Open the editor, drop in a template, and export your first page in under a minute.',
      ctaLabel: 'Open the editor',
    },
    ctx
  )

  const footer = presetsRegistry['footer-simple'](
    { copyright: '© {{year}} {{author}} — Crafted with Draw-to-Web.' },
    ctx
  )

  return buildLibraryDocument({
    name: `${productName} — Landing`,
    sections: [hero, features, cta, footer],
    runtime: LIBRARY_RUNTIME_LIGHT,
    variables: { author: productName, year: String(new Date().getUTCFullYear()) },
    seo: buildLibrarySeo({
      title: `${productName} — Ship the page you sketched`,
      description:
        'Compose modern, semantic, responsive pages on a canvas. Export production-ready HTML, CSS, and JS.',
      keywords: ['landing page', 'no-code', 'web builder', 'design tokens'],
      author: productName,
      themeColor: { light: '#ffffff', dark: '#0b0b10' },
      openGraph: {
        title: `${productName} — Ship the page you sketched`,
        description: 'Compose modern, semantic, responsive pages on a canvas.',
        type: 'website',
      },
      twitter: { card: 'summary_large_image' },
      jsonLd: { kind: 'WebSite', name: productName, url: 'https://example.com/' },
    }),
  })
}
