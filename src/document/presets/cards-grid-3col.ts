/**
 * Preset: `cards-grid-3col`.
 *
 * Three-column responsive grid of `card-basic` instances. Collapses to a
 * single column on mobile.
 *
 * Args: `cards` — optional array of `card-basic` args (length 3 default).
 */

import type { ElementNode } from '../types'

import { cardBasic } from './card-basic'
import type { PresetArgs, PresetContext, PresetFactory } from './index'

function asArgsArray(
  value: unknown,
  fallback: ReadonlyArray<PresetArgs>
): ReadonlyArray<PresetArgs> {
  if (Array.isArray(value)) {
    return value.filter((v): v is PresetArgs => typeof v === 'object' && v !== null)
  }
  return fallback
}

const defaultCards: ReadonlyArray<PresetArgs> = [
  { iconName: 'zap', title: 'Fast', body: 'Cold-start under three seconds.' },
  { iconName: 'shield', title: 'Accessible', body: 'axe-core blocks bad output at export.' },
  { iconName: 'palette', title: 'Themeable', body: 'Tokens drive light + dark out of the box.' },
]

export const cardsGrid3Col: PresetFactory = (args, ctx: PresetContext): ElementNode => {
  const cardArgs = asArgsArray(args['cards'], defaultCards)
  return {
    type: 'container',
    id: ctx.generateId(),
    name: 'Cards (3 columns)',
    semanticRole: 'section',
    layout: {
      base: {
        mode: 'grid',
        gap: 'spacing.lg',
        gridTemplateColumns: 'repeat(3, 1fr)',
      },
      mobile: { mode: 'flex', direction: 'column', gap: 'spacing.md' },
    },
    style: { base: { padding: { top: 'spacing.xl', bottom: 'spacing.xl' } } },
    children: cardArgs.map((a) => cardBasic(a, ctx)),
  }
}
