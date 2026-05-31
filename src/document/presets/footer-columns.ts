/**
 * Preset: `footer-columns`.
 *
 * Multi-column footer: each column has a title and a list of links.
 * Collapses to stacked sections on mobile.
 *
 * Args: `columns` — array of `{ title, links: { label, href }[] }`.
 */

import type { ElementNode } from '../types'

import type { PresetContext, PresetFactory } from './index'

interface FooterLink {
  readonly label: string
  readonly href: string
}

interface FooterColumn {
  readonly title: string
  readonly links: ReadonlyArray<FooterLink>
}

function asColumns(
  value: unknown,
  fallback: ReadonlyArray<FooterColumn>
): ReadonlyArray<FooterColumn> {
  if (!Array.isArray(value)) return fallback
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null) return []
    const obj = item as Record<string, unknown>
    const title = obj['title']
    const links = Array.isArray(obj['links'])
      ? (obj['links'] as Array<Record<string, unknown>>)
      : []
    if (typeof title !== 'string') return []
    const parsedLinks: FooterLink[] = links.flatMap((l) => {
      if (typeof l !== 'object' || l === null) return []
      const label = (l as Record<string, unknown>)['label']
      const href = (l as Record<string, unknown>)['href']
      return typeof label === 'string' && typeof href === 'string' ? [{ label, href }] : []
    })
    return [{ title, links: parsedLinks }]
  })
}

const defaultColumns: ReadonlyArray<FooterColumn> = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#about' },
      { label: 'Blog', href: '#blog' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '#privacy' },
      { label: 'Terms', href: '#terms' },
    ],
  },
]

/**
 * Builds the `footer-columns` preset subtree (see file header for composition).
 *
 * @param args - Per-preset argument bag; `columns` is an optional array of
 *   `{ title, links: { label, href }[] }`.
 * @param ctx - Preset context supplying `generateId`.
 * @returns The root {@link ElementNode} of the preset subtree.
 */
export const footerColumns: PresetFactory = (args, ctx: PresetContext): ElementNode => {
  const columns = asColumns(args['columns'], defaultColumns)
  return {
    type: 'container',
    id: ctx.generateId(),
    name: 'Footer (columns)',
    semanticRole: 'footer',
    layout: {
      base: {
        mode: 'grid',
        gap: 'spacing.lg',
        gridTemplateColumns: `repeat(${columns.length || 1}, 1fr)`,
      },
      mobile: { mode: 'flex', direction: 'column', gap: 'spacing.md' },
    },
    style: { base: { padding: { top: 'spacing.xl', bottom: 'spacing.xl' } } },
    children: columns.map((col) => ({
      type: 'container',
      id: ctx.generateId(),
      name: col.title,
      layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.sm' } },
      style: { base: {} },
      children: [
        {
          type: 'text',
          id: ctx.generateId(),
          tag: 'h4',
          content: col.title,
          style: { base: { typography: { fontSize: 'fontSize.md' } } },
        },
        ...col.links.map(
          (l): ElementNode => ({
            type: 'link',
            id: ctx.generateId(),
            content: l.label,
            href: l.href,
            style: { base: {} },
          })
        ),
      ],
    })),
  }
}
