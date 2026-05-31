/**
 * Preset: `hero-split`.
 *
 * Two-column hero: a text block on the left (heading + paragraph + CTA)
 * and an image on the right. Stacks vertically on mobile.
 *
 * Args: `title`, `subtitle`, `ctaLabel`, `imageUrl`, `imageAlt`.
 */

import type { ElementNode } from '../types'

import type { PresetArgs, PresetContext, PresetFactory } from './index'

function str(args: PresetArgs, key: string, fallback: string): string {
  const v = args[key]
  return typeof v === 'string' ? v : fallback
}

/**
 * Builds the `hero-split` preset subtree (see file header for composition).
 *
 * @param args - Per-preset argument bag (all optional).
 * @param ctx - Preset context supplying `generateId`.
 * @returns The root {@link ElementNode} of the preset subtree.
 */
export const heroSplit: PresetFactory = (args, ctx: PresetContext): ElementNode => ({
  type: 'container',
  id: ctx.generateId(),
  name: 'Hero (split)',
  semanticRole: 'section',
  layout: {
    base: { mode: 'grid', gap: 'spacing.xl', gridTemplateColumns: '1fr 1fr' },
    mobile: { mode: 'flex', direction: 'column', gap: 'spacing.lg' },
  },
  style: { base: { padding: { top: 'spacing.xl', bottom: 'spacing.xl' } } },
  children: [
    {
      type: 'container',
      id: ctx.generateId(),
      name: 'Copy',
      layout: {
        base: { mode: 'flex', direction: 'column', justify: 'center', gap: 'spacing.md' },
      },
      style: { base: {} },
      children: [
        {
          type: 'text',
          id: ctx.generateId(),
          tag: 'h1',
          content: str(args, 'title', 'Design fast. Ship faster.'),
          style: { base: { typography: { fontSize: 'fontSize.display' } } },
        },
        {
          type: 'text',
          id: ctx.generateId(),
          tag: 'p',
          content: str(
            args,
            'subtitle',
            'Compose semantic, responsive pages on a canvas. Export clean HTML and CSS.'
          ),
          style: { base: {} },
        },
        {
          type: 'button',
          id: ctx.generateId(),
          content: str(args, 'ctaLabel', 'Try it'),
          ariaLabel: str(args, 'ctaLabel', 'Try it'),
          style: { base: {} },
        },
      ],
    },
    {
      type: 'image',
      id: ctx.generateId(),
      alt: str(args, 'imageAlt', ''),
      externalUrl: str(args, 'imageUrl', 'https://picsum.photos/seed/dtw/800/600'),
      loading: 'lazy',
      decoding: 'async',
      style: { base: { width: '100%', borderRadius: { all: 'radius.lg' } } },
    },
  ],
})
