/**
 * Template: landing (I-TPL-03).
 *
 * A short marketing page: hero → features (3-column) → CTA → footer.
 * Pure document factory — no DOM, no React, no Zustand. Reuses four
 * presets from `presetsRegistry` (C7) so the structure stays declarative
 * and any change to a preset propagates here for free:
 *
 *   1. `hero-centered`   — centered headline + subtitle + two CTAs
 *   2. `cards-grid-3col` — 3-column features grid (each card has an
 *                          icon, title, body, and a "Learn more" link)
 *   3. `cta-banner`      — full-width call-to-action band
 *   4. `footer-simple`   — single-row footer with link list + copyright
 *
 * Performance is the priority on this template (Lighthouse Perf ≥ 95 is
 * the DoD): short tree, no images by default, opt-in to the lightest
 * runtime snippets only — `themeToggle`, `smoothScroll`, `reveals`.
 * Heavier behaviours (scroll-spy, mobile nav, nav-on-scroll, animation
 * gating, terminal typing) stay off so the JS bundle is minimal.
 */

import { nanoid } from 'nanoid'

import type {
  ContainerNode,
  Document,
  DocumentMeta,
  DocumentSettings,
  DocumentVersion,
  RuntimeFlags,
  SEOConfig,
  Tokens,
} from '../document/types'
import { defaultPresetContext, presetsRegistry } from '../document/presets'

const TEMPLATE_VERSION: DocumentVersion = '0.2.0'

/**
 * Token registry shipped with the landing template. The id set is the
 * superset of every reference produced by the four presets this
 * template composes, so dropping additional presets onto the page from
 * the Insert sidebar will not produce dangling token-ref errors.
 */
const LANDING_TOKENS: Tokens = {
  color: [
    { id: 'bg', name: 'Background', value: { light: '#ffffff', dark: '#0b0b10' } },
    {
      id: 'bg-secondary',
      name: 'Background (secondary)',
      value: { light: '#f7f7f9', dark: '#101018' },
    },
    { id: 'surface', name: 'Surface (card)', value: { light: '#ffffff', dark: '#15151c' } },
    {
      id: 'surface-accent',
      name: 'Surface (accent tint)',
      value: { light: '#eef4ff', dark: '#16223d' },
    },
    {
      id: 'surface-shadow',
      name: 'Surface shadow',
      value: { light: 'rgba(15, 23, 42, 0.06)', dark: 'rgba(0, 0, 0, 0.4)' },
    },
    { id: 'text', name: 'Body text', value: { light: '#0f172a', dark: '#f1f5f9' } },
    {
      id: 'text-secondary',
      name: 'Text (secondary)',
      value: { light: '#475569', dark: '#9aa7bd' },
    },
    { id: 'text-dim', name: 'Text (dim)', value: { light: '#64748b', dark: '#6b7891' } },
    { id: 'accent', name: 'Accent', value: { light: '#1d4ed8', dark: '#7aa2ff' } },
    { id: 'accent-soft', name: 'Accent (soft)', value: { light: '#3b6dee', dark: '#9bb8ff' } },
    { id: 'border', name: 'Border', value: { light: '#e2e8f0', dark: '#1f2536' } },
  ],
  spacing: [
    { id: 'sm', name: 'Small', value: '8px' },
    { id: 'md', name: 'Medium', value: '16px' },
    { id: 'lg', name: 'Large', value: '32px' },
    { id: 'xl', name: 'Extra large', value: '64px' },
  ],
  fontSize: [
    { id: 'sm', name: 'Small', value: 'clamp(12px, 0.78rem, 14px)' },
    { id: 'md', name: 'Body', value: 'clamp(14px, 0.9rem + 0.2vw, 18px)' },
    { id: 'lg', name: 'Large', value: 'clamp(18px, 1rem + 0.6vw, 22px)' },
    { id: 'xl', name: 'Extra large', value: 'clamp(22px, 1.2rem + 1vw, 32px)' },
    { id: 'display', name: 'Display', value: 'clamp(40px, 2.5rem + 3vw, 72px)' },
  ],
  fontFamily: [
    {
      id: 'body',
      name: 'Body (sans)',
      value:
        '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
  ],
  lineHeight: [
    { id: 'tight', name: 'Tight', value: '1.15' },
    { id: 'normal', name: 'Normal', value: '1.55' },
    { id: 'loose', name: 'Loose', value: '1.8' },
  ],
  radius: [
    { id: 'sm', name: 'Small', value: '6px' },
    { id: 'md', name: 'Medium', value: '12px' },
    { id: 'lg', name: 'Large', value: '20px' },
  ],
  shadow: [],
}

/**
 * Opt-in to the lightest runtime snippets only. Heavier observers stay
 * off so the JS bundle is minimal — Lighthouse Performance ≥ 95 is the
 * I-TPL-03 DoD.
 */
const LANDING_RUNTIME: RuntimeFlags = {
  themeToggle: true,
  scrollSpy: false,
  smoothScroll: true,
  mobileNav: false,
  navOnScroll: false,
  reveals: true,
  animationGating: false,
  terminalTyping: false,
}

const LANDING_SETTINGS: DocumentSettings = {
  contrastTarget: 'AA',
  defaultTheme: 'auto',
  gridVisible: true,
  baseUnit: 8,
}

/** Build a fresh element id; isolated so tests can stub it. */
const id = (): string => nanoid(8)

/**
 * Compose the page tree. Each section is wrapped in a thin container
 * carrying the page-level padding + max-width so the presets stay
 * layout-agnostic and reusable elsewhere.
 */
function buildRoot(): ContainerNode {
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
          body: 'Container roles map to <header>, <nav>, <main>, <footer>. Skip-links and ARIA come standard.',
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
      subtitle: 'Open the editor, drop in a template, and export your first page in under a minute.',
      ctaLabel: 'Open the editor',
    },
    ctx
  )

  const footer = presetsRegistry['footer-simple'](
    {
      copyright: '© {{year}} {{author}} — Crafted with Draw-to-Web.',
    },
    ctx
  )

  return {
    type: 'container',
    id: id(),
    name: 'Page',
    semanticRole: 'main',
    layout: {
      base: { mode: 'flex', direction: 'column', gap: 'spacing.xl', align: 'center' },
    },
    style: {
      base: {
        background: [{ kind: 'solid', color: 'color.bg' }],
        typography: { fontFamily: 'fontFamily.body', color: 'color.text' },
        padding: {
          top: 'spacing.xl',
          bottom: 'spacing.xl',
        },
      },
    },
    children: [hero, features, cta, footer],
  }
}

/**
 * Build a fresh landing-page `Document`.
 *
 * Returns a schema-valid document modelled as hero → features (3-column)
 * → CTA → footer. The root is a `<main>`; the single `<h1>` lives in
 * the hero preset. IDs come from `nanoid` so successive calls do not
 * collide.
 *
 * @param productName - Display name interpolated into `{{author}}` text
 *   and SEO metadata. Defaults to `'Acme'`.
 */
export function createLandingTemplate(productName: string = 'Acme'): Document {
  const now = new Date().toISOString()
  const meta: DocumentMeta = { name: `${productName} — Landing`, createdAt: now, updatedAt: now }

  const seo: SEOConfig = {
    title: `${productName} — Ship the page you sketched`,
    description:
      'Compose modern, semantic, responsive pages on a canvas. Export production-ready HTML, CSS, and JS — no framework, no lock-in.',
    keywords: ['landing page', 'no-code', 'web builder', 'design tokens', 'accessibility'],
    author: productName,
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
    canonical: 'https://example.com/',
    themeColor: { light: '#ffffff', dark: '#0b0b10' },
    openGraph: {
      title: `${productName} — Ship the page you sketched`,
      description: 'Compose modern, semantic, responsive pages on a canvas. No framework, no lock-in.',
      type: 'website',
      url: 'https://example.com/',
    },
    twitter: { card: 'summary_large_image' },
    jsonLd: {
      kind: 'WebSite',
      name: productName,
      url: 'https://example.com/',
    },
    preconnect: ['https://fonts.googleapis.com', 'https://fonts.gstatic.com'],
    robots: 'index, follow',
  }

  return {
    version: TEMPLATE_VERSION,
    meta,
    tokens: LANDING_TOKENS,
    tree: buildRoot(),
    seo,
    runtime: LANDING_RUNTIME,
    variables: {
      author: productName,
      year: String(new Date(now).getUTCFullYear()),
    },
    settings: LANDING_SETTINGS,
    assets: {},
  }
}
