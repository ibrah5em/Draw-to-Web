/**
 * Library page: docs / long-form article.
 *
 * Archetype: a documentation or blog article — fixed nav → a single
 * single-column article (title, intro, headed prose sections, a list) →
 * simple footer. Text-led like the résumé, but distinguished by its
 * leading nav and its short three-section order.
 */

import { defaultPresetContext, presetsRegistry } from '../../document/presets'
import type { ContainerNode, ElementNode, ListNode, TextNode } from '../../document/types'

import { LIBRARY_RUNTIME_LIGHT, buildLibraryDocument, buildLibrarySeo, freshId } from './shared'

function text(tag: TextNode['tag'], content: string, fontSize?: string): TextNode {
  return {
    id: freshId(),
    type: 'text',
    tag,
    content,
    style: { base: fontSize ? { typography: { fontSize: fontSize } } : {} },
  }
}

function list(items: ReadonlyArray<string>): ListNode {
  return { id: freshId(), type: 'list', ordered: false, items: [...items], style: { base: {} } }
}

/** A single-column article container. */
function article(children: ElementNode[]): ContainerNode {
  return {
    id: freshId(),
    type: 'container',
    semanticRole: 'article',
    layout: { base: { mode: 'flex', direction: 'column', gap: 'spacing.md' } },
    style: {
      base: {
        maxWidth: '72ch',
        padding: { top: 'spacing.lg', bottom: 'spacing.lg' },
      },
    },
    children,
  }
}

/**
 * Build the docs/article library page.
 *
 * @param projectName - Display name woven into the nav + SEO. Defaults to `'Draw-to-Web'`.
 * @returns A schema-valid {@link Document}.
 */
export function createDocsArticlePage(projectName: string = 'Draw-to-Web') {
  const ctx = defaultPresetContext()

  const nav = presetsRegistry['nav-fixed'](
    {
      brand: `${projectName} Docs`,
      links: [
        { label: 'Guide', href: '#guide' },
        { label: 'API', href: '#api' },
        { label: 'Changelog', href: '#changelog' },
      ],
    },
    ctx
  )

  const body = article([
    text('h1', 'Getting started', 'fontSize.display'),
    text(
      'p',
      'This guide walks through installing the toolkit, creating your first page, and exporting a production bundle. Every step is deterministic — the same input always produces the same output.'
    ),
    text('h2', 'Installation', 'fontSize.xl'),
    text(
      'p',
      'Install the package, then run the development server. The editor opens on the blank starter so the canvas is never empty.'
    ),
    text('h2', 'Core concepts', 'fontSize.xl'),
    text('p', 'A handful of ideas carry the whole authoring model:'),
    list([
      'The document tree is the single source of truth.',
      'Styles reference design tokens, never raw hex.',
      'Every visual property can vary per breakpoint.',
      'Accessibility is a hard gate, not an afterthought.',
    ]),
    text('h2', 'Next steps', 'fontSize.xl'),
    text(
      'p',
      'Open a template, edit it on the canvas, and export. The output is portable HTML and CSS with opt-in JavaScript.'
    ),
  ])

  const footer = presetsRegistry['footer-simple'](
    { copyright: '© {{year}} {{author}} — Documentation' },
    ctx
  )

  return buildLibraryDocument({
    name: `${projectName} — Docs`,
    sections: [nav, body, footer],
    runtime: LIBRARY_RUNTIME_LIGHT,
    variables: { author: projectName, year: String(new Date().getUTCFullYear()) },
    seo: buildLibrarySeo({
      title: `${projectName} — Getting started`,
      description: 'Install the toolkit, create your first page, and export a production bundle.',
      keywords: ['documentation', 'guide', 'getting started'],
      author: projectName,
      themeColor: { light: '#ffffff', dark: '#0b0b10' },
      jsonLd: { kind: 'WebSite', name: `${projectName} Docs`, url: 'https://example.com/docs' },
    }),
  })
}
