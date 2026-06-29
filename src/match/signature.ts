/**
 * Layout signature extractor — "Match my layout to a professional design".
 *
 * `extractSignature(document)` walks the **document tree** (never rendered
 * canvas pixels — Invariant: the Document Model is the only source of
 * truth) and distils its STRUCTURE into a compact, comparable feature
 * vector. The matcher (`matcher.ts`) scores two signatures against each
 * other; the library (`library/`) ships a precomputed signature per page.
 *
 * The function is **pure and deterministic**: same tree → byte-identical
 * signature. It depends only on structure (section order, region roles,
 * grid column counts per breakpoint, text-to-media mix) and never on
 * element ids, `nanoid` output, names, or copy — so a freshly-built
 * template (fresh ids every call) yields a stable signature, and a user's
 * rough sketch can be compared against the library offline.
 *
 * No store, no React, no DOM imports — importable from any process.
 */

import type {
  BreakpointKey,
  ContainerNode,
  ElementNode,
  LayoutConfig,
  ResponsiveProperties,
  SemanticRole,
} from '../document/types'

// ---------------------------------------------------------------------------
// Signature shape
// ---------------------------------------------------------------------------

/**
 * Coarse type classification for a top-level section. Drives the matcher's
 * "same sections in the same vertical order" dimension.
 *
 *   - `nav` / `footer` — structural landmarks, keyed off semantic role.
 *   - `hero` — the section carrying the page's single `<h1>`.
 *   - `grid-of-cards` — a multi-column grid of repeated child containers.
 *   - `media-heavy` — more image/icon leaves than text leaves.
 *   - `heading-heavy` — carries headings but is not media-dominated.
 *   - `text-block` — a plain block of running text.
 */
export type SectionKind =
  | 'nav'
  | 'hero'
  | 'grid-of-cards'
  | 'media-heavy'
  | 'heading-heavy'
  | 'text-block'
  | 'footer'

/** Grid column count resolved per breakpoint (1 when nothing grids). */
export interface ColumnProfile {
  readonly base: number
  readonly tablet: number
  readonly mobile: number
  readonly small: number
}

/** Per-section structural summary. */
export interface SectionSignature {
  /** Coarse type classification (see {@link SectionKind}). */
  readonly kind: SectionKind
  /** Resolved semantic role; defaults to `div` when the node carries none. */
  readonly role: SemanticRole
  /** Densest grid column count found in the section, per breakpoint. */
  readonly columns: ColumnProfile
  /** Count of text-bearing leaves (text / button / link / list). */
  readonly textCount: number
  /** Count of media leaves (image / icon). */
  readonly mediaCount: number
  /** Count of heading text nodes (`h1`–`h6`). */
  readonly headingCount: number
}

/** Normalised vertical position of a landmark, or `null` when absent. */
export type RegionPosition = number | null

/**
 * Where the structural landmarks sit, as a fraction in `[0, 1]` of the
 * section sequence (`0` = first section, `1` = last). `null` = absent.
 * Drives the matcher's "where do nav / hero / footer sit" dimension.
 */
export interface RegionMap {
  readonly nav: RegionPosition
  readonly hero: RegionPosition
  readonly footer: RegionPosition
}

/**
 * Compact, comparable structural fingerprint of a document tree. Produced
 * by {@link extractSignature}; consumed by `matchLayout`.
 */
export interface LayoutSignature {
  /** Number of top-level sections (direct children of the page root). */
  readonly sectionCount: number
  /** Section type classifications in vertical (top-to-bottom) order. */
  readonly order: ReadonlyArray<SectionKind>
  /** Per-section structural summaries, parallel to `order`. */
  readonly sections: ReadonlyArray<SectionSignature>
  /** Page-wide densest grid column count per breakpoint. */
  readonly columns: ColumnProfile
  /** Total text-bearing leaves across the whole tree. */
  readonly textCount: number
  /** Total media leaves across the whole tree. */
  readonly mediaCount: number
  /**
   * Text fraction of the content mix: `textCount / (textCount + mediaCount)`.
   * `1` = all text, `0` = all media, `0.5` = balanced. `0` when the page
   * has neither (degenerate empty tree).
   */
  readonly textToMediaRatio: number
  /** Normalised landmark positions (see {@link RegionMap}). */
  readonly regions: RegionMap
}

// ---------------------------------------------------------------------------
// Tree helpers
// ---------------------------------------------------------------------------

const HEADING_TAGS: ReadonlySet<string> = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])

/** Depth-first pre-order walk over the tree, visiting every node once. */
function walk(node: ElementNode, visit: (n: ElementNode) => void): void {
  visit(node)
  if (node.type === 'container') {
    for (const child of node.children) walk(child, visit)
  }
}

/**
 * Resolve the effective {@link LayoutConfig} at a breakpoint. `base` is the
 * full config; a narrower breakpoint slot, when present, overrides only the
 * fields it specifies (e.g. a grid that collapses to a flex column).
 */
function resolveLayout(
  layout: ResponsiveProperties<LayoutConfig>,
  bp: BreakpointKey
): LayoutConfig {
  if (bp === 'base') return layout.base
  const slot = layout[bp]
  return slot ? { ...layout.base, ...slot } : layout.base
}

/**
 * Parse a CSS `grid-template-columns` expression into an explicit track
 * count. Handles `repeat(N, …)` and space-separated track lists, the two
 * forms the presets emit. Returns `1` for unparseable / absent values.
 */
function parseGridColumns(template: string | undefined): number {
  if (!template) return 1
  const repeat = /repeat\(\s*(\d+)\s*,/.exec(template)
  if (repeat) {
    const n = Number.parseInt(repeat[1], 10)
    return Number.isFinite(n) && n > 0 ? n : 1
  }
  const tracks = template.trim().split(/\s+/).filter(Boolean)
  return tracks.length > 0 ? tracks.length : 1
}

/**
 * Column count contributed by a single container at a breakpoint. Only
 * grid containers carry meaningful column density; flex and leaves count
 * as a single column (they stack or flow rather than forming a grid).
 */
function containerColumns(container: ContainerNode, bp: BreakpointKey): number {
  const cfg = resolveLayout(container.layout, bp)
  if (cfg.mode === 'grid') return parseGridColumns(cfg.gridTemplateColumns)
  return 1
}

/** Densest grid column count anywhere in a subtree, at a breakpoint. */
function maxColumns(node: ElementNode, bp: BreakpointKey): number {
  let max = 1
  walk(node, (n) => {
    if (n.type === 'container') {
      const c = containerColumns(n, bp)
      if (c > max) max = c
    }
  })
  return max
}

/** Densest grid column count across all four breakpoints. */
function columnProfile(node: ElementNode): ColumnProfile {
  return {
    base: maxColumns(node, 'base'),
    tablet: maxColumns(node, 'tablet'),
    mobile: maxColumns(node, 'mobile'),
    small: maxColumns(node, 'small'),
  }
}

interface SubtreeCounts {
  readonly text: number
  readonly media: number
  readonly headings: number
  readonly h1: number
  /** True when some grid container holds ≥2 columns and ≥2 children. */
  readonly hasCardGrid: boolean
}

/** Tally text / media / heading leaves and detect a card grid in a subtree. */
function countSubtree(node: ElementNode): SubtreeCounts {
  let text = 0
  let media = 0
  let headings = 0
  let h1 = 0
  let hasCardGrid = false
  walk(node, (n) => {
    switch (n.type) {
      case 'text':
        text += 1
        if (HEADING_TAGS.has(n.tag)) headings += 1
        if (n.tag === 'h1') h1 += 1
        break
      case 'button':
      case 'link':
      case 'list':
        text += 1
        break
      case 'image':
      case 'icon':
        media += 1
        break
      case 'container': {
        const cfg = resolveLayout(n.layout, 'base')
        if (
          cfg.mode === 'grid' &&
          parseGridColumns(cfg.gridTemplateColumns) >= 2 &&
          n.children.length >= 2
        ) {
          hasCardGrid = true
        }
        break
      }
      default:
        break
    }
  })
  return { text, media, headings, h1, hasCardGrid }
}

/**
 * Classify a top-level section into a {@link SectionKind}. Precedence is
 * fixed (and therefore deterministic): structural landmarks first, then
 * the hero (the section owning the page `<h1>`), then content-shape
 * heuristics. The single-`<h1>` document invariant guarantees at most one
 * section is classified `hero`.
 */
function classifySection(section: ElementNode, counts: SubtreeCounts): SectionKind {
  const role = section.semanticRole
  if (role === 'nav') return 'nav'
  if (role === 'footer') return 'footer'
  if (counts.h1 > 0) return 'hero'
  if (counts.hasCardGrid) return 'grid-of-cards'
  if (counts.media > counts.text && counts.media > 0) return 'media-heavy'
  if (counts.headings >= 1) return 'heading-heavy'
  return 'text-block'
}

/** Top-level sections = direct children of a container root, else the root itself. */
function topLevelSections(root: ElementNode): ReadonlyArray<ElementNode> {
  if (root.type === 'container' && root.children.length > 0) return root.children
  return [root]
}

/** Normalise a section index into `[0, 1]` against the section count. */
function normalisePosition(index: number, count: number): number {
  if (index < 0) return -1
  if (count <= 1) return 0
  return index / (count - 1)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract a {@link LayoutSignature} from a document.
 *
 * Pure and deterministic — walks `document.tree` and returns a structural
 * fingerprint with no dependence on element ids, names, or text content.
 * The same tree always produces an identical signature, which is what lets
 * the library precompute signatures at build time and the matcher compare
 * offline.
 *
 * @param document - The document (or any object exposing a `tree`) to
 *   fingerprint. Only the structure of `tree` is read.
 * @returns A compact, comparable {@link LayoutSignature}.
 */
export function extractSignature(document: { readonly tree: ElementNode }): LayoutSignature {
  const sections = topLevelSections(document.tree)

  const sectionSignatures: SectionSignature[] = sections.map((section) => {
    const counts = countSubtree(section)
    return {
      kind: classifySection(section, counts),
      role: section.semanticRole ?? 'div',
      columns: columnProfile(section),
      textCount: counts.text,
      mediaCount: counts.media,
      headingCount: counts.headings,
    }
  })

  const order = sectionSignatures.map((s) => s.kind)

  const totals = countSubtree(document.tree)
  const contentTotal = totals.text + totals.media
  const textToMediaRatio = contentTotal === 0 ? 0 : totals.text / contentTotal

  const count = sectionSignatures.length
  const navIndex = order.indexOf('nav')
  const heroIndex = order.indexOf('hero')
  const footerIndex = order.indexOf('footer')
  const region = (i: number): RegionPosition => {
    const pos = normalisePosition(i, count)
    return pos < 0 ? null : pos
  }

  return {
    sectionCount: count,
    order,
    sections: sectionSignatures,
    columns: columnProfile(document.tree),
    textCount: totals.text,
    mediaCount: totals.media,
    textToMediaRatio,
    regions: {
      nav: region(navIndex),
      hero: region(heroIndex),
      footer: region(footerIndex),
    },
  }
}
