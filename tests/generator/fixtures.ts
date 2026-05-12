import type { SemanticElement } from '@engine'

/** A minimal page: header, h1, image, button, footer. */
export const SIMPLE_PAGE: SemanticElement[] = [
  {
    id: 'header-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 12,
    height: 80,
    semanticTag: 'header',
    props: { background: '#1a1a2e' },
    children: [],
  },
  {
    id: 'h1-1',
    type: 'text',
    x: 1,
    y: 100,
    width: 10,
    height: 60,
    semanticTag: 'h1',
    props: { text: 'Hello World', fontSize: 36, color: '#333333' },
  },
  {
    id: 'img-1',
    type: 'image',
    x: 0,
    y: 200,
    width: 6,
    height: 300,
    semanticTag: 'img',
    props: { src: 'hero.jpg', alt: 'Hero image' },
  },
  {
    id: 'btn-1',
    type: 'button',
    x: 1,
    y: 540,
    width: 2,
    height: 48,
    semanticTag: 'button',
    props: { text: 'Get started', background: '#0066ff', color: '#ffffff', borderRadius: 4 },
  },
  {
    id: 'footer-1',
    type: 'rectangle',
    x: 0,
    y: 620,
    width: 12,
    height: 80,
    semanticTag: 'footer',
    props: { background: '#111111' },
    children: [],
  },
]

/** Page with a nav containing child elements to verify nested grid/flex layout. */
export const PAGE_WITH_NAV: SemanticElement[] = [
  {
    id: 'header-nav',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 12,
    height: 64,
    semanticTag: 'header',
    props: { background: '#ffffff' },
    children: [
      {
        id: 'nav-1',
        type: 'rectangle',
        x: 0,
        y: 0,
        width: 12,
        height: 64,
        semanticTag: 'nav',
        props: {},
        children: [
          {
            id: 'nav-link-1',
            type: 'text',
            x: 0,
            y: 0,
            width: 2,
            height: 24,
            semanticTag: 'p',
            props: { text: 'Home' },
          },
          {
            id: 'nav-link-2',
            type: 'text',
            x: 2,
            y: 0,
            width: 2,
            height: 24,
            semanticTag: 'p',
            props: { text: 'About' },
          },
        ],
      },
    ],
  },
]

/** Page with HTML-special characters to verify escaping. */
export const PAGE_WITH_SPECIAL_CHARS: SemanticElement[] = [
  {
    id: 'text-special',
    type: 'text',
    x: 0,
    y: 0,
    width: 12,
    height: 40,
    semanticTag: 'p',
    props: { text: '<script>alert("xss")</script> & "quotes"' },
  },
]

/** Single image with no alt text — to verify empty alt is emitted (decorative). */
export const PAGE_DECORATIVE_IMAGE: SemanticElement[] = [
  {
    id: 'deco-img',
    type: 'image',
    x: 0,
    y: 0,
    width: 12,
    height: 200,
    semanticTag: 'img',
    props: { src: 'bg.png' },
  },
]
