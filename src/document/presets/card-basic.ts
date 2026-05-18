/**
 * Preset: `card-basic`.
 *
 * Single content card: icon + heading + paragraph + link. Composed of
 * primitives only; reused by `cards-grid-3col`.
 *
 * Args: `iconName`, `title`, `body`, `linkLabel`, `linkHref`.
 */

import type { ElementNode } from '../types'

import type { PresetArgs, PresetContext, PresetFactory } from './index'

function str(args: PresetArgs, key: string, fallback: string): string {
  const v = args[key]
  return typeof v === 'string' ? v : fallback
}

export const cardBasic: PresetFactory = (args, ctx: PresetContext): ElementNode => ({
  type: 'container',
  id: ctx.generateId(),
  name: 'Card',
  semanticRole: 'article',
  layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.sm' } },
  style: {
    base: {
      padding: { top: 'spacing.lg', right: 'spacing.lg', bottom: 'spacing.lg', left: 'spacing.lg' },
      borderRadius: { all: 'radius.lg' },
      shadows: [
        {
          offsetX: '0',
          offsetY: '1px',
          blur: '3px',
          color: 'color.surface-shadow',
        },
      ],
    },
  },
  children: [
    {
      type: 'icon',
      id: ctx.generateId(),
      name: str(args, 'iconName', 'sparkles'),
      decorative: true,
      style: { base: { width: '24px', height: '24px' } },
    },
    {
      type: 'text',
      id: ctx.generateId(),
      tag: 'h3',
      content: str(args, 'title', 'Feature'),
      style: { base: { typography: { fontSize: 'fontSize.lg' } } },
    },
    {
      type: 'text',
      id: ctx.generateId(),
      tag: 'p',
      content: str(args, 'body', 'A concise description of this feature.'),
      style: { base: {} },
    },
    {
      type: 'link',
      id: ctx.generateId(),
      content: str(args, 'linkLabel', 'Learn more'),
      href: str(args, 'linkHref', '#'),
      style: { base: { typography: { color: 'color.accent' } } },
    },
  ],
})
