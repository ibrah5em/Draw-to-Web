/**
 * Library page: minimal résumé.
 *
 * Archetype: a single-column, text-led résumé — a header with the name and
 * tagline, then a stack of experience sections, then a simple footer. No
 * nav, no media, no grids: the highest text-to-media ratio in the library,
 * which makes it the clear match for a sketch that is mostly stacked text.
 *
 * The experience sections are hand-composed primitives (the preset library
 * is marketing-oriented), but the output is still an ordinary document tree
 * built from the same primitives the presets use.
 */

import { defaultPresetContext, presetsRegistry } from '../../document/presets'
import type { ContainerNode, ElementNode, TextNode } from '../../document/types'

import { LIBRARY_RUNTIME_LIGHT, buildLibraryDocument, buildLibrarySeo, freshId } from './shared'

/** Text primitive with an optional bound font-size token. */
function text(tag: TextNode['tag'], content: string, fontSize?: string): TextNode {
  return {
    id: freshId(),
    type: 'text',
    tag,
    content,
    style: { base: fontSize ? { typography: { fontSize: fontSize } } : {} },
  }
}

/** A stacked (flex column) section carrying a semantic role. */
function stack(role: ContainerNode['semanticRole'], children: ElementNode[]): ContainerNode {
  return {
    id: freshId(),
    type: 'container',
    semanticRole: role,
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.sm' } },
    style: { base: { padding: { top: 'spacing.md', bottom: 'spacing.md' } } },
    children,
  }
}

interface Role {
  readonly title: string
  readonly summary: string
  readonly detail: string
}

const DEFAULT_ROLES: ReadonlyArray<Role> = [
  {
    title: 'Senior Engineer — Northwind',
    summary: 'Led the design-system rewrite and the accessibility remediation program.',
    detail: 'Shipped a tokenised component library adopted by six product teams.',
  },
  {
    title: 'Engineer — Atlas Studio',
    summary: 'Built marketing sites and editorial tooling for agency clients.',
    detail: 'Owned the move to a deterministic static export with a perf budget.',
  },
  {
    title: 'Junior Engineer — Margins',
    summary: 'Maintained the reading experience and the typographic system.',
    detail: 'Cut layout shift to near zero across the article templates.',
  },
]

/**
 * Build the minimal résumé library page.
 *
 * @param name - Person name woven into the header + SEO. Defaults to `'Grace Hopper'`.
 * @returns A schema-valid {@link Document}.
 */
export function createResumeMinimalPage(name: string = 'Grace Hopper') {
  const ctx = defaultPresetContext()

  const header = stack('header', [
    text('h1', name, 'fontSize.display'),
    text('p', 'Software engineer — design systems & accessibility', 'fontSize.lg'),
    text('p', 'hello@example.com · example.com · City, Country', 'fontSize.sm'),
  ])

  const experience = DEFAULT_ROLES.map((role) =>
    stack('section', [
      text('h2', role.title, 'fontSize.xl'),
      text('p', role.summary),
      text('p', role.detail),
    ])
  )

  const footer = presetsRegistry['footer-simple']({ copyright: '© {{year}} {{author}}' }, ctx)

  return buildLibraryDocument({
    name: `${name} — Résumé`,
    sections: [header, ...experience, footer],
    runtime: LIBRARY_RUNTIME_LIGHT,
    variables: { author: name, year: String(new Date().getUTCFullYear()) },
    seo: buildLibrarySeo({
      title: `${name} — Résumé`,
      description: `Résumé of ${name}, software engineer specialising in design systems and accessibility.`,
      keywords: ['resume', 'cv', 'software engineer'],
      author: name,
      themeColor: { light: '#ffffff', dark: '#0b0b10' },
      jsonLd: { kind: 'Person', name, jobTitle: 'Software engineer' },
    }),
  })
}
