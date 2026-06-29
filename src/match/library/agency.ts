/**
 * Library page: agency / business.
 *
 * Archetype: a longer business page — fixed nav → centered hero →
 * 3-column services grid → call-to-action band → multi-column footer.
 * Five sections; the longest order in the library, which distinguishes it
 * from the shorter landing and portfolio pages.
 */

import { defaultPresetContext, presetsRegistry } from '../../document/presets'
import type { Document } from '../../document/types'

import { LIBRARY_RUNTIME_LIGHT, buildLibraryDocument, buildLibrarySeo } from './shared'

/**
 * Build the agency/business library page.
 *
 * @param companyName - Display name woven into copy + SEO. Defaults to `'Atlas Studio'`.
 * @returns A schema-valid {@link Document}.
 */
export function createAgencyPage(companyName: string = 'Atlas Studio'): Document {
  const ctx = defaultPresetContext()

  const nav = presetsRegistry['nav-fixed'](
    {
      brand: companyName,
      links: [
        { label: 'Services', href: '#services' },
        { label: 'Work', href: '#work' },
        { label: 'Contact', href: '#contact' },
      ],
    },
    ctx
  )

  const hero = presetsRegistry['hero-centered'](
    {
      title: 'We design and build digital products.',
      subtitle:
        'Strategy, design, and engineering for teams that care about craft, performance, and accessibility.',
      primaryLabel: 'Start a project',
      secondaryLabel: 'Our work',
    },
    ctx
  )

  const services = presetsRegistry['cards-grid-3col'](
    {
      cards: [
        {
          iconName: 'pen-tool',
          title: 'Product design',
          body: 'Research, prototyping, and design systems built to scale.',
        },
        {
          iconName: 'code',
          title: 'Engineering',
          body: 'Semantic, accessible front-ends with a deterministic build.',
        },
        {
          iconName: 'gauge',
          title: 'Performance',
          body: 'Budgets, audits, and Core Web Vitals tuned to the green.',
        },
      ],
    },
    ctx
  )

  const cta = presetsRegistry['cta-banner'](
    {
      title: 'Have a project in mind?',
      subtitle: 'Tell us what you are building and we will get back within a day.',
      ctaLabel: 'Get in touch',
    },
    ctx
  )

  const footer = presetsRegistry['footer-columns'](
    {
      columns: [
        {
          title: 'Services',
          links: [
            { label: 'Design', href: '#design' },
            { label: 'Engineering', href: '#engineering' },
          ],
        },
        {
          title: 'Company',
          links: [
            { label: 'About', href: '#about' },
            { label: 'Careers', href: '#careers' },
          ],
        },
        {
          title: 'Legal',
          links: [
            { label: 'Privacy', href: '#privacy' },
            { label: 'Terms', href: '#terms' },
          ],
        },
      ],
    },
    ctx
  )

  return buildLibraryDocument({
    name: `${companyName} — Agency`,
    sections: [nav, hero, services, cta, footer],
    runtime: LIBRARY_RUNTIME_LIGHT,
    variables: { author: companyName },
    seo: buildLibrarySeo({
      title: `${companyName} — Design & engineering studio`,
      description: 'Strategy, design, and engineering for teams that care about craft.',
      keywords: ['agency', 'design studio', 'engineering', 'product'],
      author: companyName,
      themeColor: { light: '#ffffff', dark: '#0b0b10' },
      jsonLd: { kind: 'Organization', name: companyName, url: 'https://example.com/' },
    }),
  })
}
