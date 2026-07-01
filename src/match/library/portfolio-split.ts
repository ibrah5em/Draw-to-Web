/**
 * Library page: split-hero portfolio.
 *
 * Archetype: a personal portfolio — fixed nav → image-led split hero →
 * 3-column project grid → multi-column footer. Distinct from the SaaS
 * landing by its leading nav, its media-bearing hero, and its columned
 * footer.
 */

import { defaultPresetContext, presetsRegistry } from '../../document/presets'
import type { Document } from '../../document/types'

import { LIBRARY_RUNTIME_LIGHT, buildLibraryDocument, buildLibrarySeo } from './shared'

/**
 * Build the split-hero portfolio library page.
 *
 * @param author - Display name woven into copy + SEO. Defaults to `'Ada Lovelace'`.
 * @returns A schema-valid {@link Document}.
 */
export function createPortfolioSplitPage(author: string = 'Ada Lovelace'): Document {
  const ctx = defaultPresetContext()

  const nav = presetsRegistry['nav-fixed'](
    {
      brand: author,
      links: [
        { label: 'Work', href: '#work' },
        { label: 'About', href: '#about' },
        { label: 'Contact', href: '#contact' },
      ],
    },
    ctx
  )

  const hero = presetsRegistry['hero-split'](
    {
      title: 'Designer & front-end engineer.',
      subtitle:
        'I build accessible, fast, semantic interfaces. Here is a selection of recent work.',
      ctaLabel: 'View work',
      imageAlt: 'Portrait of the portfolio author at their workstation',
    },
    ctx
  )

  const projects = presetsRegistry['cards-grid-3col'](
    {
      cards: [
        {
          iconName: 'compass',
          title: 'Wayfinder',
          body: 'A transit app redesign focused on legibility and reduced cognitive load.',
        },
        {
          iconName: 'bar-chart',
          title: 'Ledger',
          body: 'A finance dashboard with an accessible, keyboard-first data grid.',
        },
        {
          iconName: 'book-open',
          title: 'Margins',
          body: 'A long-form reading experience with a typographic design system.',
        },
      ],
    },
    ctx
  )

  const footer = presetsRegistry['footer-columns'](
    {
      columns: [
        {
          title: 'Work',
          links: [
            { label: 'Case studies', href: '#work' },
            { label: 'Writing', href: '#writing' },
          ],
        },
        {
          title: 'Elsewhere',
          links: [
            { label: 'GitHub', href: '#github' },
            { label: 'Mastodon', href: '#mastodon' },
          ],
        },
        {
          title: 'Contact',
          links: [
            { label: 'Email', href: '#email' },
            { label: 'Résumé', href: '#resume' },
          ],
        },
      ],
    },
    ctx
  )

  return buildLibraryDocument({
    name: `${author} — Portfolio`,
    sections: [nav, hero, projects, footer],
    runtime: LIBRARY_RUNTIME_LIGHT,
    variables: { author },
    seo: buildLibrarySeo({
      title: `${author} — Portfolio`,
      description: 'Designer and front-end engineer. Accessible, fast, semantic interfaces.',
      keywords: ['portfolio', 'design', 'front-end', 'accessibility'],
      author,
      themeColor: { light: '#ffffff', dark: '#0b0b10' },
      jsonLd: { kind: 'Person', name: author, jobTitle: 'Front-end engineer' },
    }),
  })
}
