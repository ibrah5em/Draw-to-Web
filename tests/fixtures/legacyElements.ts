/**
 * v0.1.0 `CanvasElement[]` fixtures.
 *
 * Used by the tests that exercise the export pipeline and SEO/axe modules
 * via the renderer-facing API. These will fall away once the renderer
 * migrates to `useDocumentStore` and tests can drive the new pipeline
 * with a `Document` directly.
 */

import type { CanvasElement } from '../../src/store/elementStore'

/** A minimal page: header rect, h1, image, button, footer rect. */
export const SIMPLE_PAGE: CanvasElement[] = [
  {
    id: 'header-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 12,
    height: 80,
    props: { background: '#1a1a2e' },
  },
  {
    id: 'h1-1',
    type: 'text',
    x: 1,
    y: 100,
    width: 10,
    height: 60,
    props: { text: 'Hello World', fontSize: 36, color: '#333333' },
  },
  {
    id: 'img-1',
    type: 'image',
    x: 0,
    y: 200,
    width: 6,
    height: 300,
    props: { src: 'hero.jpg', alt: 'Hero image' },
  },
  {
    id: 'btn-1',
    type: 'button',
    x: 1,
    y: 540,
    width: 2,
    height: 48,
    props: { text: 'Get started', background: '#0066ff', color: '#ffffff', borderRadius: 4 },
  },
  {
    id: 'footer-1',
    type: 'rectangle',
    x: 0,
    y: 620,
    width: 12,
    height: 80,
    props: { background: '#111111' },
  },
]

/** Page with a nav rect to verify nested layout flows through the adapter. */
export const PAGE_WITH_NAV: CanvasElement[] = [
  {
    id: 'header-nav',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 12,
    height: 64,
    props: { background: '#ffffff' },
  },
  {
    id: 'nav-link-1',
    type: 'text',
    x: 0,
    y: 0,
    width: 2,
    height: 24,
    props: { text: 'Home' },
  },
]
