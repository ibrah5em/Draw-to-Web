/**
 * Shared scaffolding for the professional-design library.
 *
 * Every library page is — by design — just an ordinary {@link Document}:
 * the same shape a template or a `.dtw` file produces. That is the whole
 * point of the "Match my layout" feature: once a user adopts a page it is
 * hydrated into the store exactly like any other document and is freely
 * editable. There is no transplant or remapping engine — see
 * `src/match/adopt.ts`.
 *
 * This module supplies the parts every page shares so the individual page
 * files stay focused on STRUCTURE (which presets, in which order):
 *
 *   - {@link LIBRARY_TOKENS} — a token registry whose id set is a superset
 *     of every reference any preset in `presetsRegistry` (C7) emits, so any
 *     composition validates with no dangling token-ref.
 *   - {@link LIBRARY_SETTINGS} — author defaults (AA contrast, auto theme).
 *   - {@link buildLibraryDocument} — wraps a list of section subtrees in a
 *     `<main>` root and assembles a schema-valid document.
 *
 * Pure data factories — no DOM, no React, no Zustand.
 */

import { nanoid } from 'nanoid'

import type {
  ContainerNode,
  Document,
  DocumentMeta,
  DocumentSettings,
  DocumentVariables,
  DocumentVersion,
  ElementNode,
  RuntimeFlags,
  SEOConfig,
  Tokens,
} from '../../document/types'

/**
 * Document version emitted by every library page. Kept aligned with
 * `CURRENT_DOCUMENT_VERSION`; bumping requires a matching migration.
 */
export const LIBRARY_VERSION: DocumentVersion = '0.2.0'

/**
 * Token registry shared by every library page. The id set is the superset
 * of every reference produced by any factory in `presetsRegistry`, so a
 * page can compose any preset (and the user can later drop in more) without
 * a dangling token-ref validation error. Colour tokens carry light + dark
 * values; the generator emits the light value in `:root` and the dark value
 * in `:root[data-theme="dark"]`.
 */
export const LIBRARY_TOKENS: Tokens = {
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
      value: { light: '#334155', dark: '#9aa7bd' },
    },
    { id: 'text-dim', name: 'Text (dim)', value: { light: '#475569', dark: '#6b7891' } },
    { id: 'accent', name: 'Accent', value: { light: '#1d4ed8', dark: '#7aa2ff' } },
    { id: 'accent-soft', name: 'Accent (soft)', value: { light: '#1e40af', dark: '#9bb8ff' } },
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

/** Author defaults shared by every library page. */
export const LIBRARY_SETTINGS: DocumentSettings = {
  contrastTarget: 'AA',
  defaultTheme: 'auto',
  gridVisible: true,
  baseUnit: 8,
}

/** All runtime snippets off — the JS-free baseline. Pages opt in explicitly. */
export const LIBRARY_RUNTIME_OFF: RuntimeFlags = {
  themeToggle: false,
  scrollSpy: false,
  smoothScroll: false,
  mobileNav: false,
  navOnScroll: false,
  reveals: false,
  animationGating: false,
  terminalTyping: false,
}

/**
 * Lightweight runtime preset: the three cheapest snippets only
 * (`themeToggle`, `smoothScroll`, `reveals`). Matches the Tier-1 landing
 * template's runtime so library pages keep a minimal, axe-clean JS bundle.
 */
export const LIBRARY_RUNTIME_LIGHT: RuntimeFlags = {
  ...LIBRARY_RUNTIME_OFF,
  themeToggle: true,
  smoothScroll: true,
  reveals: true,
}

/** Build a fresh element id. Isolated so the structure stays id-agnostic. */
export const freshId = (): string => nanoid(8)

/**
 * Wrap a list of section subtrees in a `<main>` root carrying the page
 * background, body typography, and outer rhythm — mirroring how the Tier-1
 * templates compose their root so library pages and templates emit
 * structurally consistent output.
 *
 * @param sections - Ordered top-level section subtrees (nav, hero, …, footer).
 * @returns The root `<main>` {@link ContainerNode}.
 */
export function buildLibraryRoot(sections: ReadonlyArray<ElementNode>): ContainerNode {
  return {
    type: 'container',
    id: freshId(),
    name: 'Page',
    semanticRole: 'main',
    layout: {
      base: { mode: 'flex', direction: 'column', gap: 'spacing.xl' },
    },
    style: {
      base: {
        background: [{ kind: 'solid', color: 'color.bg' }],
        typography: { fontFamily: 'fontFamily.body', color: 'color.text' },
        padding: { top: 'spacing.xl', bottom: 'spacing.xl' },
      },
      mobile: {
        padding: { top: 'spacing.lg', bottom: 'spacing.lg' },
      },
    },
    children: [...sections],
  }
}

/**
 * Assemble a schema-valid library {@link Document} from a name, an ordered
 * list of section subtrees, and an SEO block. Fills in the shared token
 * registry, settings, and timestamps.
 *
 * @param opts.name - Author-facing project name (topbar + default meta).
 * @param opts.sections - Ordered top-level section subtrees.
 * @param opts.seo - Whole-page SEO configuration.
 * @param opts.runtime - Runtime-snippet flags; defaults to all-off (JS-free).
 * @param opts.variables - `{{variable}}` substitution map; defaults to `{}`.
 * @returns A complete, schema-valid {@link Document}.
 */
export function buildLibraryDocument(opts: {
  readonly name: string
  readonly sections: ReadonlyArray<ElementNode>
  readonly seo: SEOConfig
  readonly runtime?: RuntimeFlags
  readonly variables?: DocumentVariables
}): Document {
  const now = new Date().toISOString()
  const meta: DocumentMeta = { name: opts.name, createdAt: now, updatedAt: now }
  return {
    version: LIBRARY_VERSION,
    meta,
    tokens: LIBRARY_TOKENS,
    tree: buildLibraryRoot(opts.sections),
    seo: opts.seo,
    runtime: opts.runtime ?? LIBRARY_RUNTIME_OFF,
    variables: opts.variables ?? {},
    settings: LIBRARY_SETTINGS,
    assets: {},
  }
}

/**
 * Build a baseline {@link SEOConfig} with the browser-standard defaults the
 * export pipeline needs, merged with page-specific overrides.
 *
 * @param overrides - Page-specific SEO fields (at least `title`).
 * @returns A complete {@link SEOConfig}.
 */
export function buildLibrarySeo(
  overrides: Partial<SEOConfig> & { readonly title: string }
): SEOConfig {
  return {
    description: '',
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
    robots: 'index, follow',
    ...overrides,
  }
}
