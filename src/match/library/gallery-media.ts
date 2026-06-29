/**
 * Library page: media showcase / gallery.
 *
 * Archetype: a visual showcase — fixed nav → centered hero → a media-led
 * showcase band (several images, minimal text) → simple footer. The only
 * library page whose body is media-dominated, giving it the lowest
 * text-to-media ratio — the natural match for an image-heavy sketch.
 */

import { defaultPresetContext, presetsRegistry } from '../../document/presets'
import type { ContainerNode, ImageNode } from '../../document/types'

import { LIBRARY_RUNTIME_LIGHT, buildLibraryDocument, buildLibrarySeo, freshId } from './shared'

/** A media tile bound to a rounded, full-width image. */
function tile(seed: string, alt: string): ImageNode {
  return {
    id: freshId(),
    type: 'image',
    alt,
    externalUrl: `https://picsum.photos/seed/${seed}/600/400`,
    loading: 'lazy',
    decoding: 'async',
    style: { base: { width: '100%', borderRadius: { all: 'radius.md' } } },
  }
}

/** Media-led showcase band: a wrapping row of image tiles + a short caption. */
function showcase(): ContainerNode {
  return {
    id: freshId(),
    type: 'container',
    semanticRole: 'section',
    layout: {
      base: { mode: 'flex', direction: 'row', wrap: 'wrap', gap: 'spacing.md', justify: 'center' },
      mobile: { mode: 'flex', direction: 'column', gap: 'spacing.md' },
    },
    style: { base: { padding: { top: 'spacing.xl', bottom: 'spacing.xl' } } },
    children: [
      tile('gallery-1', 'Wide landscape at golden hour'),
      tile('gallery-2', 'Close-up of layered textures'),
      tile('gallery-3', 'Architectural facade in soft light'),
      tile('gallery-4', 'Abstract study in colour and form'),
      {
        id: freshId(),
        type: 'text',
        tag: 'p',
        content: 'Selected frames — full series available on request.',
        style: { base: { typography: { fontSize: 'fontSize.sm', color: 'color.text-dim' } } },
      },
    ],
  }
}

/**
 * Build the media-showcase library page.
 *
 * @param studioName - Display name woven into copy + SEO. Defaults to `'Aperture'`.
 * @returns A schema-valid {@link Document}.
 */
export function createGalleryMediaPage(studioName: string = 'Aperture') {
  const ctx = defaultPresetContext()

  const nav = presetsRegistry['nav-fixed'](
    {
      brand: studioName,
      links: [
        { label: 'Series', href: '#series' },
        { label: 'Prints', href: '#prints' },
        { label: 'Contact', href: '#contact' },
      ],
    },
    ctx
  )

  const hero = presetsRegistry['hero-centered'](
    {
      title: 'Light, framed.',
      subtitle: 'A photographic studio working in landscape, architecture, and abstract series.',
      primaryLabel: 'View series',
      secondaryLabel: 'Order prints',
    },
    ctx
  )

  const footer = presetsRegistry['footer-simple'](
    { copyright: '© {{year}} {{author}} Studio' },
    ctx
  )

  return buildLibraryDocument({
    name: `${studioName} — Gallery`,
    sections: [nav, hero, showcase(), footer],
    runtime: LIBRARY_RUNTIME_LIGHT,
    variables: { author: studioName, year: String(new Date().getUTCFullYear()) },
    seo: buildLibrarySeo({
      title: `${studioName} — Photographic studio`,
      description: 'A photographic studio working in landscape, architecture, and abstract series.',
      keywords: ['photography', 'gallery', 'studio', 'prints'],
      author: studioName,
      themeColor: { light: '#ffffff', dark: '#0b0b10' },
      jsonLd: { kind: 'Organization', name: studioName, url: 'https://example.com/' },
    }),
  })
}
