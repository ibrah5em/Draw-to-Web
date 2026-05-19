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
function renderAttrs(bag: AttrBag, vars: DocumentVariables): string {
  const parts: string[] = []
  for (const [k, v] of Object.entries(bag)) {
    if (v === undefined) continue
    const interpolated = interpolate(v, vars)
    parts.push(` ${k}="${escapeAttr(interpolated)}"`)
  }
  return parts.join('')
}

function mergedAttrs(el: ElementNode, _vars: DocumentVariables): AttrBag {
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
// Per-node renderers
// ---------------------------------------------------------------------------

function renderContainer(el: ContainerNode, depth: number, vars: DocumentVariables): string {
  const tag = containerTag(el)
  const pad = INDENT.repeat(depth)
  const openAttrs = renderAttrs(mergedAttrs(el, vars), vars)
  if (el.children.length === 0) {
    return `${pad}<${tag}${openAttrs}></${tag}>`
  }
  const inner = el.children.map((child) => renderNode(child, depth + 1, vars)).join('\n')
  return `${pad}<${tag}${openAttrs}>\n${inner}\n${pad}</${tag}>`
}

function renderText(el: TextNode, depth: number, vars: DocumentVariables): string {
  const pad = INDENT.repeat(depth)
  const attrs = renderAttrs(mergedAttrs(el, vars), vars)
  const content = escapeHtml(interpolate(el.content, vars))
  return `${pad}<${el.tag}${attrs}>${content}</${el.tag}>`
}

function renderImage(el: ImageNode, depth: number, vars: DocumentVariables): string {
  const pad = INDENT.repeat(depth)
  // `src` is resolved from either the local asset id (preferred) or the
  // external URL escape hatch. I-GEN-12 (srcset / sizes / width / height
  // from the asset manifest) lands once the sharp pipeline produces it;
  // for now we emit a single `src` attribute.
  const src = el.assetId ? `assets/${el.assetId}.webp` : (el.externalUrl ?? '')
  const attrs: AttrBag = {
    ...mergedAttrs(el, vars),
    src,
    alt: el.alt,
    loading: el.loading ?? 'lazy',
    decoding: el.decoding ?? 'async',
  }
  return `${pad}<img${renderAttrs(attrs, vars)} />`
}

function renderButton(el: ButtonNode, depth: number, vars: DocumentVariables): string {
  const pad = INDENT.repeat(depth)
  const attrs: AttrBag = {
    ...mergedAttrs(el, vars),
    type: el.buttonType ?? 'button',
    'aria-label': el.ariaLabel,
  }
  const text = escapeHtml(interpolate(el.content, vars))
  return `${pad}<button${renderAttrs(attrs, vars)}>${text}</button>`
}

function renderLink(el: LinkNode, depth: number, vars: DocumentVariables): string {
  const pad = INDENT.repeat(depth)
  // I-GEN-17 — auto-add `rel="noopener noreferrer"` for `target="_blank"`.
  const targetIsBlank = el.target === '_blank'
  const computedRel = targetIsBlank ? mergeRel(el.rel, 'noopener', 'noreferrer') : el.rel
  const attrs: AttrBag = {
    ...mergedAttrs(el, vars),
    href: el.href,
    target: el.target,
    rel: computedRel,
    'aria-label': el.ariaLabel,
  }
  const text = escapeHtml(interpolate(el.content, vars))
  return `${pad}<a${renderAttrs(attrs, vars)}>${text}</a>`
}

function mergeRel(existing: string | undefined, ...required: string[]): string {
  const set = new Set<string>((existing ?? '').split(/\s+/).filter(Boolean))
  for (const token of required) set.add(token)
  return [...set].join(' ')
}

function renderIcon(el: IconNode, depth: number, vars: DocumentVariables): string {
  const pad = INDENT.repeat(depth)
  if (el.inlineSvg !== undefined && el.inlineSvg.length > 0) {
    // Inline SVG: trust the author-supplied markup but wrap it in a span
    // that carries the scoped class so the CSS emitter can reach it.
    const attrs = renderAttrs(mergedAttrs(el, vars), vars)
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
    ...mergedAttrs(el, vars),
    'data-icon': el.name,
    'aria-hidden': el.decorative ? 'true' : undefined,
    'aria-label': el.decorative ? undefined : el.ariaLabel,
    role: el.decorative ? undefined : 'img',
  }
  return `${pad}<span${renderAttrs(attrs, vars)}></span>`
}

function renderList(el: ListNode, depth: number, vars: DocumentVariables): string {
  const pad = INDENT.repeat(depth)
  const tag = el.ordered ? 'ol' : 'ul'
  const attrs = renderAttrs(mergedAttrs(el, vars), vars)
  if (el.items.length === 0) {
    return `${pad}<${tag}${attrs}></${tag}>`
  }
  const itemPad = INDENT.repeat(depth + 1)
  const items = el.items
    .map((item) => `${itemPad}<li>${escapeHtml(interpolate(item, vars))}</li>`)
    .join('\n')
  return `${pad}<${tag}${attrs}>\n${items}\n${pad}</${tag}>`
}

function renderDivider(el: DividerNode, depth: number, vars: DocumentVariables): string {
  const pad = INDENT.repeat(depth)
  const attrs = renderAttrs(mergedAttrs(el, vars), vars)
  if (el.orientation === 'horizontal') {
    return `${pad}<hr${attrs} />`
  }
  // Vertical: <div role="separator" aria-orientation="vertical">
  return `${pad}<div${attrs} role="separator" aria-orientation="vertical"></div>`
}

function renderNode(el: ElementNode, depth: number, vars: DocumentVariables): string {
  switch (el.type) {
    case 'container':
      return renderContainer(el, depth, vars)
    case 'text':
      return renderText(el, depth, vars)
    case 'image':
      return renderImage(el, depth, vars)
    case 'button':
      return renderButton(el, depth, vars)
    case 'link':
      return renderLink(el, depth, vars)
    case 'icon':
      return renderIcon(el, depth, vars)
    case 'list':
      return renderList(el, depth, vars)
    case 'divider':
      return renderDivider(el, depth, vars)
  }
}

/**
 * Emit body HTML for a document. Caller composes the surrounding `<html>`
 * / `<head>` / `<body>` envelope; this function only renders the tree
 * itself, indented from depth 0.
 */
export function emitHtml(doc: Document): string {
  return renderNode(doc.tree, 0, doc.variables)
}

// Expose for tests that need to assert tag-selection behaviour without
// constructing a full document.
export const __internal__ = {
  VOID_TAGS,
  escapeHtml,
  escapeAttr,
  containerTag,
}
