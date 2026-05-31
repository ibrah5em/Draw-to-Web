/**
 * Preset: `nav-fixed`.
 *
 * Fixed top navigation bar: logo on the left, link list on the right.
 * The `nav-on-scroll` runtime snippet (I-RUN-05) can attach to it.
 *
 * Args: `brand`, `links` — `links` is an array of `{ label, href }`.
 */

import type { ElementNode } from '../types'

import type { PresetArgs, PresetContext, PresetFactory } from './index'

interface NavLink {
  readonly label: string
  readonly href: string
}

function str(args: PresetArgs, key: string, fallback: string): string {
  const v = args[key]
  return typeof v === 'string' ? v : fallback
}

function asLinks(value: unknown, fallback: ReadonlyArray<NavLink>): ReadonlyArray<NavLink> {
  if (!Array.isArray(value)) return fallback
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const obj = item as Record<string, unknown>
    const label = obj['label']
    const href = obj['href']
    return typeof label === 'string' && typeof href === 'string' ? [{ label, href }] : []
  })
}

const defaultLinks: ReadonlyArray<NavLink> = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'About', href: '#about' },
]

/**
 * Builds the `nav-fixed` preset subtree (see file header for composition).
 *
 * @param args - Per-preset argument bag; `links` is an optional array of
 *   `{ label, href }`.
 * @param ctx - Preset context supplying `generateId`.
 * @returns The root {@link ElementNode} of the preset subtree.
 */
export const navFixed: PresetFactory = (args, ctx: PresetContext): ElementNode => {
  const links = asLinks(args['links'], defaultLinks)
  return {
    type: 'container',
    id: ctx.generateId(),
    name: 'Nav (fixed)',
    semanticRole: 'nav',
    layout: {
      base: { mode: 'flex', direction: 'row', justify: 'space-between', align: 'center' },
    },
    style: {
      base: {
        padding: {
          top: 'spacing.md',
          right: 'spacing.lg',
          bottom: 'spacing.md',
          left: 'spacing.lg',
        },
        background: [{ kind: 'solid', color: 'color.surface' }],
      },
    },
    children: [
      {
        type: 'link',
        id: ctx.generateId(),
        content: str(args, 'brand', 'Draw-to-Web'),
        href: '#',
        ariaLabel: 'Home',
        style: { base: { typography: { fontSize: 'fontSize.lg' } } },
      },
      {
        type: 'container',
        id: ctx.generateId(),
        name: 'Nav links',
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
