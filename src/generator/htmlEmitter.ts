/**
 * HTML emitter (I-GEN-01, I-GEN-02).
 *
 * Walks `document.tree` and emits body HTML. Tag selection is **driven by
 * the document**, not by spatial heuristics:
 *
 *   - Container nodes pick their tag from `element.semanticRole`
 *     (`<header>` / `<nav>` / `<main>` / `<section>` / `<article>` /
 *     `<aside>` / `<footer>` / `<figure>` / `<figcaption>`). Without a
 *     role, containers fall back to `<div>`.
 *   - Text nodes use `element.tag` (`h1`–`h6`, `p`, `span`, `em`, etc.).
 *   - The other primitives map 1:1: image → `<img>`, button → `<button>`,
 *     link → `<a>`, icon → inline `<svg>` (or named placeholder), list →
 *     `<ul>`/`<ol>` with `<li>` children, divider → `<hr>` or styled
 *     `<div>`.
 *
 * Every element receives a stable `.dtw-el-{id}` class so the CSS emitter
 * can target it without a global selector. Author-supplied classes,
 * attributes, and `data-*` keys are merged in.
 *
 * `{{variable}}` placeholders in text content and string attribute values
 * are interpolated against `document.variables` (I-DOC-08).
 */

import type {
  AssetId,
  AssetManifestEntry,
  ButtonNode,
  ContainerNode,
  DividerNode,
  Document,
  DocumentVariables,
  ElementNode,
  IconNode,
  ImageNode,
  LinkNode,
  ListNode,
  TextNode,
} from '../document/types'
import { interpolate } from '../document/variables'

/**
 * Per-document render context threaded through every node renderer.
 * Keeps the function signatures stable as we add document-derived
 * lookups (e.g. asset manifest for `<img srcset>` in I-GEN-12) without
 * touching every call site.
 */
interface RenderContext {
  readonly vars: DocumentVariables
  readonly assets: Readonly<Record<AssetId, AssetManifestEntry>>
}

const INDENT = '  '

/**
 * HTML void elements — emitted as self-closing tags without a separate
 * close tag. Limited to the ones the document can actually produce.
 */
const VOID_TAGS: ReadonlySet<string> = new Set(['img', 'hr', 'br', 'input'])

/** Escapes characters unsafe in HTML text content. */
function escapeHtml(raw: string): string {
  return raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Escapes characters unsafe in double-quoted HTML attribute values. */
function escapeAttr(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function classListFor(el: ElementNode): string {
  const extras = el.classes ?? []
  return [`dtw-el-${el.id}`, ...extras].join(' ')
}

interface AttrBag {
  readonly [key: string]: string | undefined
}

/** Formats an attribute bag into the ` k="v"` string segment for a tag. */
function renderAttrs(bag: AttrBag, ctx: RenderContext): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(bag)) {
    if (v === undefined) continue
    const interpolated = interpolate(v, ctx.vars)
    parts.push(` ${k}="${escapeAttr(interpolated)}"`)
  }
  return parts.join('')
}

function mergedAttrs(el: ElementNode, _ctx: RenderContext): AttrBag {
  const merged: Record<string, string> = { class: classListFor(el) }
  if (el.attributes) {
    for (const [k, v] of Object.entries(el.attributes)) {
      if (k === 'class' || k === 'style') continue
      merged[k] = v
    }
  }
  if (el.dataAttributes) {
    for (const [k, v] of Object.entries(el.dataAttributes)) {
      merged[`data-${k}`] = v
    }
  }
  return merged
}

// ---------------------------------------------------------------------------
// Tag selection
// ---------------------------------------------------------------------------

function containerTag(el: ContainerNode): string {
  return el.semanticRole ?? 'div'
}

// ---------------------------------------------------------------------------
// Image manifest resolution (I-GEN-12)
// ---------------------------------------------------------------------------

interface ImageDescriptor {
  readonly src: string
  readonly srcset?: string
  readonly width?: string
  readonly height?: string
}

/**
 * Resolve the `<img>` attributes (`src`, optional `srcset`, intrinsic
 * `width`/`height`) for an image element. When `assetId` resolves
 * against `document.assets`, emit the full responsive set so the
 * browser can pick the right WebP variant and reserve space to avoid
 * CLS. When only `externalUrl` is set, emit a single `src` — the
 * author has opted out of the pipeline.
 *
 * Empty / unknown assetIds fall through to a `src=""` so the markup
 * stays well-formed; the document validator will already have flagged
 * the missing asset.
 */
function resolveImageDescriptor(
  el: ImageNode,
  assets: Readonly<Record<AssetId, AssetManifestEntry>>
): ImageDescriptor {
  if (el.assetId) {
    const entry = assets[el.assetId]
    if (entry) {
      const widths = Object.keys(entry.srcset)
        .map((k) => Number(k))
        .filter((n) => Number.isFinite(n))
        .sort((a, b) => a - b)
      if (widths.length > 0) {
        const srcset = widths.map((w) => `${entry.srcset[w]} ${w}w`).join(', ')
        const largestWidth = widths[widths.length - 1]
        const src = entry.srcset[largestWidth]
        return {
          src,
          srcset,
          width: String(entry.width),
          height: String(entry.height),
        }
      }
      // Manifest entry exists but carries no variants — still emit
      // intrinsic dimensions so reserve-space wins, fall back to a
      // best-guess single src.
      return {
        src: `assets/${el.assetId}.webp`,
        width: String(entry.width),
        height: String(entry.height),
      }
    }
    // Unknown assetId: emit a deterministic placeholder src; validator
    // surfaces the integrity issue separately.
    return { src: `assets/${el.assetId}.webp` }
  }
  return { src: el.externalUrl ?? '' }
}

/**
 * Default `sizes` value when the author has not provided a `sizesHint`.
 * Targets the common single-column-on-mobile / half-column-on-desktop
 * layout so the browser usually picks the right variant without the
 * author having to think about it.
 */
const DEFAULT_SIZES = '(max-width: 768px) 100vw, 50vw'

// ---------------------------------------------------------------------------
// Per-node renderers
// ---------------------------------------------------------------------------

function renderContainer(el: ContainerNode, depth: number, ctx: RenderContext): string {
  const tag = containerTag(el)
  const pad = INDENT.repeat(depth)
  const merged = mergedAttrs(el, ctx)
  // Root container carries its document id as a DOM `id` so the
  // skip-to-content link (I-GEN-19) has a stable anchor. Author-
  // supplied `attributes.id` always wins.
  const attrs: AttrBag = depth === 0 && merged.id === undefined ? { ...merged, id: el.id } : merged
  const openAttrs = renderAttrs(attrs, ctx)
  if (el.children.length === 0) {
    return `${pad}<${tag}${openAttrs}></${tag}>`
  }
  const inner = el.children.map((child) => renderNode(child, depth + 1, ctx)).join('\n')
  return `${pad}<${tag}${openAttrs}>\n${inner}\n${pad}</${tag}>`
}

function renderText(el: TextNode, depth: number, ctx: RenderContext): string {
  const pad = INDENT.repeat(depth)
  const attrs = renderAttrs(mergedAttrs(el, ctx), ctx)
  const content = escapeHtml(interpolate(el.content, ctx.vars))
  return `${pad}<${el.tag}${attrs}>${content}</${el.tag}>`
}

function renderImage(el: ImageNode, depth: number, ctx: RenderContext): string {
  const pad = INDENT.repeat(depth)
  const desc = resolveImageDescriptor(el, ctx.assets)
  // `sizes` is only meaningful alongside `srcset`; emit it whenever we
  // have variants, defaulting to a sensible breakpoint if the author
  // has not supplied a hint.
  const sizes = desc.srcset ? (el.sizesHint ?? DEFAULT_SIZES) : undefined
  const attrs: AttrBag = {
    ...mergedAttrs(el, ctx),
    src: desc.src,
    srcset: desc.srcset,
    sizes,
    width: desc.width,
    height: desc.height,
    alt: el.alt,
    loading: el.loading ?? 'lazy',
    decoding: el.decoding ?? 'async',
  }
  return `${pad}<img${renderAttrs(attrs, ctx)} />`
}

function renderButton(el: ButtonNode, depth: number, ctx: RenderContext): string {
  const pad = INDENT.repeat(depth)
  const attrs: AttrBag = {
    ...mergedAttrs(el, ctx),
    type: el.buttonType ?? 'button',
    'aria-label': el.ariaLabel,
  }
  const text = escapeHtml(interpolate(el.content, ctx.vars))
  return `${pad}<button${renderAttrs(attrs, ctx)}>${text}</button>`
}

function renderLink(el: LinkNode, depth: number, ctx: RenderContext): string {
  const pad = INDENT.repeat(depth)
  // I-GEN-17 — auto-add `rel="noopener noreferrer"` for `target="_blank"`.
  const targetIsBlank = el.target === '_blank'
  const computedRel = targetIsBlank ? mergeRel(el.rel, 'noopener', 'noreferrer') : el.rel
  // I-GEN-18 — auto URL-encode mailto subject/body params authored in
  // plain text. Leaves other schemes untouched.
  const href = encodeMailtoHref(el.href)
  const attrs: AttrBag = {
    ...mergedAttrs(el, ctx),
    href,
    target: el.target,
    rel: computedRel,
    'aria-label': el.ariaLabel,
  }
  const text = escapeHtml(interpolate(el.content, ctx.vars))
  return `${pad}<a${renderAttrs(attrs, ctx)}>${text}</a>`
}

function mergeRel(existing: string | undefined, ...required: string[]): string {
  const set = new Set<string>((existing ?? '').split(/\s+/).filter(Boolean))
  for (const token of required) set.add(token)
  return [...set].join(' ')
}

/**
 * Normalize a `mailto:` href so subject / body / cc / bcc parameter
 * values are RFC-3986 percent-encoded (I-GEN-18). Authors can write
 * the parameters in plain text and trust the emitter to encode them.
 *
 * Already-encoded values round-trip cleanly because `decodeURIComponent`
 * recognises the percent sequences; if decoding fails (malformed
 * percent escape) we leave that param value verbatim rather than
 * mangle it.
 *
 * Non-mailto hrefs are returned unchanged.
 */
function encodeMailtoHref(href: string): string {
  if (!href.startsWith('mailto:')) return href
  const qIdx = href.indexOf('?')
  if (qIdx === -1) return href
  const recipient = href.slice('mailto:'.length, qIdx)
  const query = href.slice(qIdx + 1)
  if (query.length === 0) return href
  const params = query
    .split('&')
    .map((pair) => {
      const eq = pair.indexOf('=')
      if (eq === -1) return pair
      const key = pair.slice(0, eq)
      const value = pair.slice(eq + 1)
      let decoded: string
      try {
        decoded = decodeURIComponent(value)
      } catch {
        return pair
      }
      return `${key}=${encodeURIComponent(decoded)}`
    })
    .join('&')
  return `mailto:${recipient}?${params}`
}

function renderIcon(el: IconNode, depth: number, ctx: RenderContext): string {
  const pad = INDENT.repeat(depth)
  if (el.inlineSvg !== undefined && el.inlineSvg.length > 0) {
    // Inline SVG: trust the author-supplied markup but wrap it in a span
    // that carries the scoped class so the CSS emitter can reach it.
    const attrs = renderAttrs(mergedAttrs(el, ctx), ctx)
    const ariaProps = el.decorative
      ? ' aria-hidden="true"'
      : el.ariaLabel
        ? ` role="img" aria-label="${escapeAttr(el.ariaLabel)}"`
        : ' role="img"'
    return `${pad}<span${attrs}${ariaProps}>${el.inlineSvg}</span>`
  }
  // No inline SVG yet — emit a labelled placeholder span. When the icon
  // library (Tier-2) lands this becomes the real <svg> tag.
  const attrs: AttrBag = {
    ...mergedAttrs(el, ctx),
    'data-icon': el.name,
    'aria-hidden': el.decorative ? 'true' : undefined,
    'aria-label': el.decorative ? undefined : el.ariaLabel,
    role: el.decorative ? undefined : 'img',
  }
  return `${pad}<span${renderAttrs(attrs, ctx)}></span>`
}

function renderList(el: ListNode, depth: number, ctx: RenderContext): string {
  const pad = INDENT.repeat(depth)
  const tag = el.ordered ? 'ol' : 'ul'
  const attrs = renderAttrs(mergedAttrs(el, ctx), ctx)
  if (el.items.length === 0) {
    return `${pad}<${tag}${attrs}></${tag}>`
  }
  const itemPad = INDENT.repeat(depth + 1)
  const items = el.items
    .map((item) => `${itemPad}<li>${escapeHtml(interpolate(item, ctx.vars))}</li>`)
    .join('\n')
  return `${pad}<${tag}${attrs}>\n${items}\n${pad}</${tag}>`
}

function renderDivider(el: DividerNode, depth: number, ctx: RenderContext): string {
  const pad = INDENT.repeat(depth)
  const attrs = renderAttrs(mergedAttrs(el, ctx), ctx)
  if (el.orientation === 'horizontal') {
    return `${pad}<hr${attrs} />`
  }
  // Vertical: <div role="separator" aria-orientation="vertical">
  return `${pad}<div${attrs} role="separator" aria-orientation="vertical"></div>`
}

function renderNode(el: ElementNode, depth: number, ctx: RenderContext): string {
  switch (el.type) {
    case 'container':
      return renderContainer(el, depth, ctx)
    case 'text':
      return renderText(el, depth, ctx)
    case 'image':
      return renderImage(el, depth, ctx)
    case 'button':
      return renderButton(el, depth, ctx)
    case 'link':
      return renderLink(el, depth, ctx)
    case 'icon':
      return renderIcon(el, depth, ctx)
    case 'list':
      return renderList(el, depth, ctx)
    case 'divider':
      return renderDivider(el, depth, ctx)
  }
}

/**
 * Emit body HTML for a document. Caller composes the surrounding `<html>`
 * / `<head>` / `<body>` envelope; this function only renders the tree
 * itself, indented from depth 0.
 */
export function emitHtml(doc: Document): string {
  const ctx: RenderContext = { vars: doc.variables, assets: doc.assets }
  const body = renderNode(doc.tree, 0, ctx)
  // I-GEN-19 — skip-to-content link is the first child of <body>. The
  // target id is the root tree node, which the HTML envelope wraps
  // inside <body>. CSS hides the link off-screen until focused
  // (handled in the reset/utility CSS that the CSS emitter ships).
  const skipLink = `<a class="dtw-skip-link" href="#${escapeAttr(doc.tree.id)}">Skip to content</a>`
  return `${skipLink}\n${body}`
}

// Expose for tests that need to assert tag-selection behaviour without
// constructing a full document.
export const __internal__ = {
  VOID_TAGS,
  escapeHtml,
  escapeAttr,
  containerTag,
  encodeMailtoHref,
  resolveImageDescriptor,
}
