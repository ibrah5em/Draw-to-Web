/**
 * Portfolio Document fixture for generator + export tests.
 *
 * Small enough to read in one screen, but exercises every shape the
 * generator must handle: tokens (colour + spacing + font), semantic
 * roles, text headings, image, button/link, divider, list, container
 * nesting, per-breakpoint overrides, hover state slot (not yet
 * emitted), runtime flags.
 *
 * Deliberately deterministic: stable ids, no `Date.now()`, no nanoid
 * — the determinism test depends on identical bytes from identical
 * input.
 */

import type { Document } from '../../src/document/types'

export const PORTFOLIO_DOCUMENT: Document = {
  version: '0.2.0',
  meta: {
    name: 'Sample Portfolio',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  tokens: {
    color: [
      {
        id: 'bg',
        name: 'Background',
        value: { light: '#ffffff', dark: '#0b0b10' },
      },
      {
        id: 'text',
        name: 'Body text',
        value: { light: '#111111', dark: '#f5f5f5' },
      },
      {
        id: 'accent',
        name: 'Accent',
        value: { light: '#0066ff', dark: '#5599ff' },
      },
    ],
    spacing: [
      { id: 'sm', name: 'Small', value: '8px' },
      { id: 'md', name: 'Medium', value: '16px' },
      { id: 'lg', name: 'Large', value: '32px' },
    ],
    fontSize: [
      { id: 'body', name: 'Body', value: 'clamp(14px, 1rem + 0.2vw, 18px)' },
      { id: 'h1', name: 'H1', value: 'clamp(28px, 2rem + 2vw, 56px)' },
    ],
    fontFamily: [{ id: 'body', name: 'Body', value: 'system-ui, sans-serif' }],
    lineHeight: [],
    radius: [{ id: 'sm', name: 'Small', value: '4px' }],
    shadow: [],
  },
  tree: {
    id: 'root',
    type: 'container',
    semanticRole: 'main',
    name: 'Page',
    style: {
      base: {
        background: [{ kind: 'solid', color: 'color.bg' }],
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
    layout: {
      base: { mode: 'flex', direction: 'column', gap: 'spacing.lg' },
    },
    children: [
      {
        id: 'header',
        type: 'container',
        semanticRole: 'header',
        style: { base: {} },
        layout: {
          base: { mode: 'flex', direction: 'row', justify: 'space-between', align: 'center' },
        },
        children: [
          {
            id: 'title',
            type: 'text',
            tag: 'h1',
            content: 'Welcome, {{name}}',
            style: {
              base: {
                typography: {
                  fontFamily: 'fontFamily.body',
                  fontSize: 'fontSize.h1',
                  color: 'color.text',
                },
              },
            },
          },
          {
            id: 'cta',
            type: 'link',
            href: '#contact',
            content: 'Contact me',
            target: '_blank',
            style: {
              base: {
                padding: {
                  top: 'spacing.sm',
                  bottom: 'spacing.sm',
                  left: 'spacing.md',
                  right: 'spacing.md',
                },
                borderRadius: { all: 'radius.sm' },
                background: [{ kind: 'solid', color: 'color.accent' }],
                typography: { color: 'color.bg' },
              },
            },
            states: {
              hover: {
                opacity: 0.85,
              },
            },
          },
        ],
      },
      {
        id: 'hero',
        type: 'image',
        alt: 'A photo of the author at their desk',
        externalUrl: 'https://example.com/photo.jpg',
        style: {
          base: {
            width: '100%',
            maxWidth: '720px',
            borderRadius: { all: 'radius.sm' },
          },
        },
      },
      {
        id: 'divider',
        type: 'divider',
        orientation: 'horizontal',
        style: {
          base: { margin: { top: 'spacing.md', bottom: 'spacing.md' } },
        },
      },
      {
        id: 'skills',
        type: 'list',
        ordered: false,
        items: ['TypeScript', 'React', 'Electron'],
        style: {
          base: {
            typography: { fontFamily: 'fontFamily.body', color: 'color.text' },
          },
        },
      },
      {
        id: 'footer',
        type: 'container',
        semanticRole: 'footer',
        style: { base: {} },
        layout: { base: { mode: 'flex', direction: 'row', justify: 'center' } },
        children: [
          {
            id: 'footer-text',
            type: 'text',
            tag: 'p',
            content: '© 2026 {{name}}',
            style: { base: { typography: { color: 'color.text' } } },
          },
        ],
      },
    ],
  },
  seo: {
    title: 'Sample Portfolio',
    description: 'A small sample portfolio used by Draw-to-Web tests.',
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
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
  variables: {
    name: 'Ada Lovelace',
  },
  settings: {
    contrastTarget: 'AA',
    defaultTheme: 'auto',
    gridVisible: true,
  },
  assets: {},
}
