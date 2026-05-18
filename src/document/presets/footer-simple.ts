/**
 * Preset: `footer-simple`.
 *
 * Single-row footer: copyright text on the left, a small link list on
 * the right.
 *
 * Args: `copyright`, `links` — `links` is an array of `{ label, href }`.
 */

import type { ElementNode } from '../types'

import type { PresetArgs, PresetContext, PresetFactory } from './index'

interface FooterLink {
  readonly label: string
  readonly href: string
}

function str(args: PresetArgs, key: string, fallback: string): string {
  const v = args[key]
  return typeof v === 'string' ? v : fallback
}

function asLinks(value: unknown, fallback: ReadonlyArray<FooterLink>): ReadonlyArray<FooterLink> {
  if (!Array.isArray(value)) return fallback
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const obj = item as Record<string, unknown>
    const label = obj['label']
    const href = obj['href']
    if (typeof label !== 'string' || typeof href !== 'string') return []
    return [{ label, href }]
  })
}

const defaultLinks: ReadonlyArray<FooterLink> = [
  { label: 'Privacy', href: '#privacy' },
  { label: 'Terms', href: '#terms' },
]

export const footerSimple: PresetFactory = (args, ctx: PresetContext): ElementNode => {
  const links = asLinks(args['links'], defaultLinks)
  return {
    type: 'container',
    id: ctx.generateId(),
    name: 'Footer (simple)',
    semanticRole: 'footer',
    layout: {
      base: { mode: 'flex', direction: 'row', justify: 'space-between', align: 'center' },
      mobile: { mode: 'flex', direction: 'column', gap: 'spacing.sm', align: 'center' },
    },
    style: {
      base: {
        padding: { top: 'spacing.lg', bottom: 'spacing.lg' },
      },
    },
    children: [
      {
        type: 'text',
        id: ctx.generateId(),
        tag: 'small',
        content: str(args, 'copyright', '© {{year}} {{author}}'),
        style: { base: {} },
      },
      {
        type: 'container',
        id: ctx.generateId(),
        name: 'Footer links',
        semanticRole: 'nav',
        layout: { base: { mode: 'flex', direction: 'row', gap: 'spacing.md' } },
        style: { base: {} },
        children: links.map((l) => ({
          type: 'link',
          id: ctx.generateId(),
          content: l.label,
          href: l.href,
          style: { base: {} },
        })),
      },
    ],
  }
}
