import { describe, expect, it } from 'vitest'

import { documentSchema, tokenRefSchema } from '../../src/document/schemas'
import type { Document } from '../../src/document/types'

/**
 * Minimal but representative `Document`. Exercises every contract surface
 * touched by the schemas: tokens, recursive tree (container + every leaf
 * type), responsive properties, states, SEO with a JSON-LD variant and a
 * favicon variant, runtime flags, variables, assets, and settings.
 */
const sampleDocument: Document = {
  version: '0.2.0',
  meta: {
    name: 'Sample',
    createdAt: '2026-05-19T00:00:00.000Z',
    updatedAt: '2026-05-19T00:00:00.000Z',
  },
  tokens: {
    color: [
      {
        id: 'accent',
        name: 'Accent',
        value: { light: '#3b82f6', dark: '#60a5fa' },
      },
    ],
    spacing: [{ id: 'md', name: 'Medium', value: '1rem' }],
    fontSize: [{ id: 'body', name: 'Body', value: 'clamp(1rem, 1.5vw, 1.125rem)' }],
    fontFamily: [{ id: 'sans', name: 'Sans', value: 'Inter, system-ui, sans-serif' }],
    lineHeight: [{ id: 'tight', name: 'Tight', value: '1.2' }],
    radius: [{ id: 'sm', name: 'Small', value: '4px' }],
    shadow: [{ id: 'card', name: 'Card', value: '0 1px 3px rgba(0,0,0,0.1)' }],
  },
  tree: {
    type: 'container',
    id: 'root',
    name: 'Root',
    semanticRole: 'main',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
    style: { base: { padding: { top: '2rem', bottom: '2rem' } } },
    children: [
      {
        type: 'text',
        id: 'title',
        tag: 'h1',
        content: 'Hello {{year}}',
        style: { base: { typography: { color: 'color.accent', fontSize: 'fontSize.body' } } },
      },
      {
        type: 'image',
        id: 'hero',
        alt: '',
        externalUrl: 'https://example.com/hero.webp',
        loading: 'lazy',
        decoding: 'async',
        style: { base: {} },
      },
      {
        type: 'button',
        id: 'cta',
        content: 'Click',
        ariaLabel: 'Call to action',
        style: { base: { cursor: 'pointer' } },
        states: { hover: { opacity: 0.8 } },
      },
      {
        type: 'link',
        id: 'home',
        href: 'https://example.com',
        target: '_blank',
        content: 'Home',
        style: { base: {} },
      },
      {
        type: 'icon',
        id: 'logo',
        name: 'star',
        inlineSvg: '<svg/>',
        decorative: true,
        style: { base: {} },
      },
      {
        type: 'list',
        id: 'items',
        ordered: false,
        items: ['One', 'Two'],
        style: { base: {} },
      },
      {
        type: 'divider',
        id: 'sep',
        orientation: 'horizontal',
        style: { base: {} },
      },
    ],
  },
  seo: {
    title: 'Sample',
    description: 'A sample document.',
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
    themeColor: { light: '#ffffff', dark: '#0f172a' },
    openGraph: { title: 'Sample', type: 'website' },
    twitter: { card: 'summary_large_image' },
    jsonLd: { kind: 'Person', name: 'Ibrahim', url: 'https://example.com' },
    favicon: { kind: 'svg-inline', svg: '<svg/>' },
    preconnect: ['https://fonts.googleapis.com'],
  },
  runtime: {
    themeToggle: false,
    scrollSpy: false,
    smoothScroll: false,
    mobileNav: false,
    navOnScroll: false,
    reveals: false,
    animationGating: false,
    terminalTyping: false,
  },
  variables: { year: '2026' },
  settings: {
    contrastTarget: 'AA',
    defaultTheme: 'auto',
    gridVisible: false,
  },
  assets: {
    'asset-1': {
      id: 'asset-1',
      mimeType: 'image/webp',
      originalFilename: 'hero.png',
      width: 1600,
      height: 900,
      srcset: { '400': 'assets/hero-400.webp', '800': 'assets/hero-800.webp' },
    },
  },
}

describe('documentSchema (C2)', () => {
  it('round-trips a representative document through parse', () => {
    const parsed = documentSchema.parse(sampleDocument)
    // Round-trip through JSON to confirm the schema accepts the on-disk shape.
    const reparsed = documentSchema.parse(JSON.parse(JSON.stringify(sampleDocument)))
    expect(parsed).toEqual(sampleDocument)
    expect(reparsed).toEqual(sampleDocument)
  })

  it('safeParse returns success: true on a valid document', () => {
    const result = documentSchema.safeParse(sampleDocument)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.version).toBe('0.2.0')
    }
  })

  it('rejects a malformed version string', () => {
    const bad = { ...sampleDocument, version: 'v1' }
    const result = documentSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('rejects an unknown element type', () => {
    const bad = {
      ...sampleDocument,
      tree: { ...sampleDocument.tree, type: 'mystery' },
    }
    const result = documentSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })

  it('tokenRefSchema accepts valid refs and rejects malformed ones', () => {
    expect(tokenRefSchema.safeParse('color.accent').success).toBe(true)
    expect(tokenRefSchema.safeParse('spacing.md').success).toBe(true)
    expect(tokenRefSchema.safeParse('bogus.md').success).toBe(false)
    expect(tokenRefSchema.safeParse('color').success).toBe(false)
    expect(tokenRefSchema.safeParse(42).success).toBe(false)
  })

  it('rejects a missing required field (alt on image)', () => {
    const bad = JSON.parse(JSON.stringify(sampleDocument)) as Record<string, unknown>
    const tree = bad.tree as { children: Array<Record<string, unknown>> }
    const image = tree.children.find((c) => c.type === 'image')!
    delete image.alt
    const result = documentSchema.safeParse(bad)
    expect(result.success).toBe(false)
  })
})
