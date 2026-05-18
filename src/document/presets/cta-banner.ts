/**
 * Preset: `cta-banner`.
 *
 * Full-width call-to-action band: heading + supporting text + button.
 *
 * Args: `title`, `subtitle`, `ctaLabel`, `ctaHref`.
 */

import type { ElementNode } from '../types'

import type { PresetArgs, PresetContext, PresetFactory } from './index'

function str(args: PresetArgs, key: string, fallback: string): string {
  const v = args[key]
  return typeof v === 'string' ? v : fallback
}

export const ctaBanner: PresetFactory = (args, ctx: PresetContext): ElementNode => ({
  type: 'container',
  id: ctx.generateId(),
  name: 'CTA banner',
  semanticRole: 'section',
  layout: {
    base: { mode: 'flex', direction: 'column', align: 'center', gap: 'spacing.md' },
  },
  style: {
    base: {
      padding: { top: 'spacing.xl', bottom: 'spacing.xl' },
      background: [{ kind: 'solid', color: 'color.surface-accent' }],
      typography: { textAlign: 'center' },
      borderRadius: { all: 'radius.lg' },
    },
  },
  children: [
    {
      type: 'text',
      id: ctx.generateId(),
      tag: 'h2',
      content: str(args, 'title', 'Ready to ship?'),
      style: { base: { typography: { fontSize: 'fontSize.xl' } } },
    },
    {
      type: 'text',
      id: ctx.generateId(),
      tag: 'p',
      content: str(args, 'subtitle', 'Start your first project in under a minute.'),
      style: { base: {} },
    },
    {
      type: 'link',
      id: ctx.generateId(),
      content: str(args, 'ctaLabel', 'Get started'),
      href: str(args, 'ctaHref', '#'),
      style: { base: {} },
    },
  ],
})
