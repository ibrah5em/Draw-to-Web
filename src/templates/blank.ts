/**
 * Template: blank starter (I-TPL-05).
 *
 * Default document users land on when they click "New" or pick the
 * blank tile in the template gallery. Two responsibilities:
 *
 *   1. Ship a token registry that already defines every reference any
 *      preset in `presetsRegistry` (C7) emits — so dragging in
 *      hero-centered, cards-grid, footer-columns, etc. never produces
 *      a dangling token-ref validation error.
 *   2. Place a single visible element on the page (centered hero) so
 *      the canvas is not empty and the document already satisfies the
 *      "exactly one <h1>" validation rule (I-DOC-05). Authors can
 *      delete it without consequence.
 *
 * Pure data factory — no DOM, no React, no Zustand. The renderer wraps
 * it (template gallery → reset store with this document) but the
 * function itself is importable from any process.
 */

import { nanoid } from 'nanoid'

import type {
  ContainerNode,
  Document,
  DocumentMeta,
  DocumentSettings,
  DocumentVersion,
  ElementNode,
  RuntimeFlags,
  SEOConfig,
  Tokens,
} from '../document/types'
import { defaultPresetContext, presetsRegistry } from '../document/presets'

/**
 * Document version emitted by every freshly-created blank template.
 * Kept aligned with `CURRENT_DOCUMENT_VERSION` in `documentStore.ts`;
 * bumping requires a matching migration in `src/document/migrations.ts`.
 */
const TEMPLATE_VERSION: DocumentVersion = '0.2.0'

/**
 * Sensible default token set bundled with the blank starter. The token
 * ids are the superset of every reference produced by any factory in
 * `presetsRegistry`, so authors can drop any preset onto the page
 * without dangling token-ref errors. Colour tokens carry both
 * light/dark values; the generator emits the light value in `:root`
 * and the dark value in `:root[data-theme="dark"]`.
 */
const DEFAULT_TOKENS: Tokens = {
  color: [
    { id: 'bg', name: 'Background', value: { light: '#ffffff', dark: '#0b0b10' } },
    { id: 'text', name: 'Body text', value: { light: '#111111', dark: '#f5f5f5' } },
    { id: 'accent', name: 'Accent', value: { light: '#0066ff', dark: '#5599ff' } },
    { id: 'surface', name: 'Surface', value: { light: '#f5f5f7', dark: '#15151c' } },
    {
      id: 'surface-accent',
      name: 'Surface (accent tint)',
      value: { light: '#e8f0ff', dark: '#1a2440' },
    },
    {
      id: 'surface-shadow',
      name: 'Surface shadow',
      value: { light: 'rgba(0, 0, 0, 0.08)', dark: 'rgba(0, 0, 0, 0.5)' },
    },
  ],
  spacing: [
    { id: 'sm', name: 'Small', value: '8px' },
    { id: 'md', name: 'Medium', value: '16px' },
    { id: 'lg', name: 'Large', value: '32px' },
    { id: 'xl', name: 'Extra large', value: '64px' },
  ],
  fontSize: [
    { id: 'md', name: 'Body', value: 'clamp(14px, 0.9rem + 0.2vw, 18px)' },
    { id: 'lg', name: 'Large', value: 'clamp(18px, 1rem + 0.6vw, 22px)' },
    { id: 'xl', name: 'Extra large', value: 'clamp(22px, 1.2rem + 1vw, 32px)' },
    { id: 'display', name: 'Display', value: 'clamp(32px, 2rem + 3vw, 64px)' },
  ],
  fontFamily: [
    {
      id: 'body',
      name: 'Body',
      value: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
  ],
  lineHeight: [
    { id: 'tight', name: 'Tight', value: '1.2' },
    { id: 'normal', name: 'Normal', value: '1.5' },
  ],
  radius: [
    { id: 'sm', name: 'Small', value: '4px' },
    { id: 'md', name: 'Medium', value: '8px' },
    { id: 'lg', name: 'Large', value: '16px' },
  ],
  shadow: [],
}

const DEFAULT_RUNTIME: RuntimeFlags = {
  themeToggle: false,
  scrollSpy: false,
  smoothScroll: false,
  mobileNav: false,
  navOnScroll: false,
  reveals: false,
  animationGating: false,
  terminalTyping: false,
}

const DEFAULT_SETTINGS: DocumentSettings = {
  contrastTarget: 'AA',
  defaultTheme: 'auto',
  gridVisible: true,
  baseUnit: 8,
}

/**
 * Build the root `<main>` container that wraps the hero placeholder.
 * Holds the page-level background and outer padding so the hero only
 * worries about its own composition.
 */
function buildRoot(rootId: string, hero: ElementNode): ContainerNode {
  return {
    id: rootId,
    type: 'container',
    name: 'Page',
    semanticRole: 'main',
    layout: {
      base: { mode: 'flex', direction: 'column', gap: 'spacing.lg' },
    },
    style: {
      base: {
        background: [{ kind: 'solid', color: 'color.bg' }],
        typography: { fontFamily: 'fontFamily.body', color: 'color.text' },
        padding: {
          top: 'spacing.lg',
          bottom: 'spacing.lg',
          left: 'spacing.md',
          right: 'spacing.md',
        },
      },
      mobile: {
        padding: {
          top: 'spacing.md',
          bottom: 'spacing.md',
          left: 'spacing.sm',
          right: 'spacing.sm',
        },
      },
    },
    children: [hero],
  }
}

/**
 * Build a fresh blank-starter `Document`.
 *
 * Returns a schema-valid document whose tree contains a single
 * hero-centered section under a `<main>` root, with the default
 * token registry pre-populated. IDs come from `nanoid` so successive
 * calls do not collide.
 *
 * @param name - Author-facing project name surfaced in the topbar and
 *   used as the default SEO title until the author edits it. Defaults
 *   to `'Untitled'`.
 */
export function createBlankTemplate(name: string = 'Untitled'): Document {
  const now = new Date().toISOString()
  const meta: DocumentMeta = { name, createdAt: now, updatedAt: now }

  const presetCtx = defaultPresetContext()
  const hero = presetsRegistry['hero-centered']({}, presetCtx)
  const root = buildRoot(nanoid(8), hero)

  const seo: SEOConfig = {
    title: name,
    description: '',
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
  }

  return {
    version: TEMPLATE_VERSION,
    meta,
    tokens: DEFAULT_TOKENS,
    tree: root,
    seo,
    runtime: DEFAULT_RUNTIME,
    variables: {},
    settings: DEFAULT_SETTINGS,
    assets: {},
  }
}
