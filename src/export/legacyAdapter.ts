/**
 * Legacy adapter — v0.1.0 `CanvasElement[]` → v0.2.0 `Document`.
 *
 * Bridge code that lets the existing renderer (which still drives the
 * canvas off `useElementStore`) feed the new generator + export pipeline.
 * The renderer migration to `useDocumentStore` is Yousef's and LuF8y's
 * work; until it lands, every export and live preview routes through
 * this adapter.
 *
 * **Delete this file** once the canvas reads/writes `useDocumentStore`
 * directly — the generator and export pipeline already accept a
 * `Document`, so the adapter becomes dead code at that point.
 *
 * Conversion rules (kept deliberately narrow):
 *
 *   - Visible elements are flattened into a single root container with
 *     `semanticRole: 'main'`. The v0.1.0 grid layout (x/y/width/height)
 *     is discarded — we no longer position absolutely, and the canvas
 *     migration will route layout through `LayoutConfig` on each node.
 *   - `type: 'rectangle'` becomes an empty `container`.
 *   - The first `type: 'text'` element becomes an `<h1>` so the
 *     single-h1 validation rule passes; subsequent text becomes `<p>`.
 *   - Per-element `props` (background, color, padding, etc.) become
 *     literal style values on `style.base` — no token bindings, since
 *     the legacy store has no token concept.
 *   - Legacy SEO config feeds directly into `document.seo`.
 *
 * The output is always schema-valid; callers can pipe it straight into
 * `validateDocument` / `generate` without further massaging.
 */

import type { CanvasElement } from '../store/elementStore'
import type {
  ButtonNode,
  ContainerNode,
  Document,
  DocumentMeta,
  ElementNode,
  ImageNode,
  SEOConfig as DocSEOConfig,
  StyleBlock,
  TextNode,
} from '../document/types'
import type { SEOConfig as LegacySEOConfig } from '../shared/types'

const DOCUMENT_VERSION = '0.2.0' as const
const ROOT_ID = 'legacy-root'
const ADAPTER_TIMESTAMP = '2026-01-01T00:00:00.000Z'

const EMPTY_TOKENS = {
  color: [],
  spacing: [],
  fontSize: [],
  fontFamily: [],
  lineHeight: [],
  radius: [],
  shadow: [],
} as const

const DEFAULT_RUNTIME = {
  themeToggle: false,
  scrollSpy: false,
  smoothScroll: false,
  mobileNav: false,
  navOnScroll: false,
  reveals: false,
  animationGating: false,
  terminalTyping: false,
} as const

const DEFAULT_SETTINGS = {
  contrastTarget: 'AA',
  defaultTheme: 'auto',
  gridVisible: true,
} as const

function suffixPx(n: number | undefined): string | undefined {
  if (n === undefined) return undefined
  return `${n}px`
}

function styleForProps(props: CanvasElement['props']): StyleBlock {
  const block: Mutable<StyleBlock> = {}

  if (props.background !== undefined) {
    block.background = [{ kind: 'solid', color: props.background }]
  }

  const radius = suffixPx(props.borderRadius)
  if (radius !== undefined) block.borderRadius = { all: radius }

  const padding = suffixPx(props.padding)
  if (padding !== undefined) {
    block.padding = { top: padding, right: padding, bottom: padding, left: padding }
  }

  if (props.borderWidth !== undefined && props.borderColor !== undefined) {
    block.border = {
      width: `${props.borderWidth}px`,
      style: 'solid',
      color: props.borderColor,
    }
  }

  const typography: Record<string, string> = {}
  if (props.color !== undefined) typography.color = props.color
  if (props.fontFamily !== undefined) typography.fontFamily = props.fontFamily
  if (props.fontSize !== undefined) typography.fontSize = `${props.fontSize}px`
  if (Object.keys(typography).length > 0) {
    block.typography = typography as StyleBlock['typography']
  }

  return block
}

/** Mutable mirror of a `readonly` type — used when building drafts. */
type Mutable<T> = { -readonly [K in keyof T]: T[K] }

function convertElement(el: CanvasElement, textIndex: { value: number }): ElementNode | null {
  const baseStyle = styleForProps(el.props)
  const common = {
    id: el.id,
    style: { base: baseStyle },
  } as const

  switch (el.type) {
    case 'rectangle': {
      const node: ContainerNode = {
        ...common,
        type: 'container',
        layout: { base: { mode: 'flex', direction: 'column' } },
        children: [],
      }
      return node
    }
    case 'text': {
      // First text → h1 to satisfy the single-h1 validation rule;
      // everything else → p. The renderer will pick proper tags once it
      // owns `TextNode.tag` directly.
      const tag = textIndex.value === 0 ? 'h1' : 'p'
      textIndex.value += 1
      const node: TextNode = {
        ...common,
        type: 'text',
        tag,
        content: el.props.text ?? '',
      }
      return node
    }
    case 'image': {
      const node: ImageNode = {
        ...common,
        type: 'image',
        alt: el.props.alt ?? '',
        externalUrl: el.props.src,
      }
      return node
    }
    case 'button': {
      const node: ButtonNode = {
        ...common,
        type: 'button',
        content: el.props.text ?? '',
      }
      return node
    }
  }
}

function buildSeo(legacy: LegacySEOConfig): DocSEOConfig {
  return {
    title: legacy.title,
    description: legacy.description,
    lang: legacy.lang ?? 'en',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
    canonical: legacy.canonicalUrl,
    openGraph: legacy.ogImage
      ? {
          title: legacy.title,
          description: legacy.description,
          type: 'website',
          imageUrl: legacy.ogImage,
        }
      : undefined,
  }
}

/**
 * Convert the v0.1.0 element list + SEO config into a schema-valid
 * `Document`. Excluded (`visible === false`) elements are dropped before
 * conversion.
 */
export function canvasElementsToDocument(
  elements: ReadonlyArray<CanvasElement>,
  legacySeo: LegacySEOConfig
): Document {
  const visible = elements.filter((el) => el.visible !== false)
  const textIndex = { value: 0 }
  const children = visible
    .map((el) => convertElement(el, textIndex))
    .filter((n): n is ElementNode => n !== null)

  const tree: ContainerNode = {
    id: ROOT_ID,
    type: 'container',
    semanticRole: 'main',
    name: 'Page',
    style: { base: {} },
    layout: { base: { mode: 'flex', direction: 'column', gap: '1rem' } },
    children,
  }

  const meta: DocumentMeta = {
    name: legacySeo.title || 'Untitled',
    createdAt: ADAPTER_TIMESTAMP,
    updatedAt: ADAPTER_TIMESTAMP,
  }

  return {
    version: DOCUMENT_VERSION,
    meta,
    tokens: EMPTY_TOKENS,
    tree,
    seo: buildSeo(legacySeo),
    runtime: DEFAULT_RUNTIME,
    variables: {},
    settings: DEFAULT_SETTINGS,
    assets: {},
  }
}
