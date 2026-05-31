/**
 * Preset: `hero-centered`.
 *
 * Centred hero block. Composed of a vertical container with a heading, a
 * subtitle paragraph, and a primary-action button row.
 *
 * Args: `title`, `subtitle`, `primaryLabel`, `secondaryLabel` — all
 * strings, all optional.
 */

import type { ElementNode } from '../types'

import type { PresetArgs, PresetContext, PresetFactory } from './index'

function str(args: PresetArgs, key: string, fallback: string): string {
  const v = args[key]
  return typeof v === 'string' ? v : fallback
}

/**
 * Builds the `hero-centered` preset subtree (see file header for composition).
 *
 * @param args - Per-preset argument bag (all optional).
 * @param ctx - Preset context supplying `generateId`.
 * @returns The root {@link ElementNode} of the preset subtree.
 */
export const heroCentered: PresetFactory = (args, ctx: PresetContext): ElementNode => ({
  type: 'container',
  id: ctx.generateId(),
  name: 'Hero (centered)',
  semanticRole: 'section',
  layout: {
    base: {
      mode: 'flex',
      direction: 'column',
      align: 'center',
      justify: 'center',
      gap: 'spacing.lg',
    },
  },
  style: {
    base: {
      padding: { top: 'spacing.xl', bottom: 'spacing.xl' },
      typography: { textAlign: 'center' },
    },
  },
  children: [
    {
      type: 'text',
      id: ctx.generateId(),
      tag: 'h1',
      content: str(args, 'title', 'Build the web you imagine'),
      style: { base: { typography: { fontSize: 'fontSize.display' } } },
    },
    {
      type: 'text',
      id: ctx.generateId(),
      tag: 'p',
      content: str(args, 'subtitle', 'Draw it. Ship it. No code required.'),
      style: { base: { typography: { fontSize: 'fontSize.lg' } } },
    },
    {
      type: 'container',
      id: ctx.generateId(),
      name: 'Actions',
      layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.md', justify: 'center' } },
      style: { base: {} },
      children: [
        {
          type: 'button',
          id: ctx.generateId(),
          content: str(args, 'primaryLabel', 'Get started'),
          ariaLabel: str(args, 'primaryLabel', 'Get started'),
          style: { base: {} },
        },
        {
          type: 'button',
          id: ctx.generateId(),
          content: str(args, 'secondaryLabel', 'Learn more'),
          ariaLabel: str(args, 'secondaryLabel', 'Learn more'),
          style: { base: {} },
        },
      ],
    },
  ],
})
