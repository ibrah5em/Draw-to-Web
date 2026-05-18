/**
 * Document Model — validation (C8).
 *
 * Pure function: `validateDocument(doc) -> { errors, warnings, infos }`.
 * Rules implemented (per `docs/0.2.0v/plan.md` Section 10.2 / I-DOC-05):
 *
 *   error    — exactly one `<h1>` per page
 *   error    — every `ImageNode.alt` present (empty string allowed)
 *   error    — every `TokenRef` resolves
 *   error    — no duplicate element ids
 *   warning  — no heading-level skips (e.g. h2 → h4)
 *   warning  — color contrast below the document's WCAG target
 *   info     — tokens defined but never referenced in the tree
 *
 * Consumers:
 *   - Validation Console (L-VAL-01) surfaces every category.
 *   - Export pipeline (I-EXP-02) gates on `errors` only — `axe-core` is
 *     the canonical a11y gate.
 *
 * Contract: C8 (see `docs/0.2.0v/plan.md` Section 6).
 */

import chroma from 'chroma-js'

import type {
  ColorTokenValue,
  Document,
  ElementId,
  ElementNode,
  TextNode,
  TokenCategory,
  Tokens,
} from './types'

/** A single issue surfaced by validation. */
export interface ValidationIssue {
  readonly message: string
  readonly nodeId?: ElementId
  /** Short hint for the UI's "Fix it" affordance, e.g. "Set h2 instead of h4". */
  readonly fix?: string
}

/** Result of `validateDocument`. */
export interface ValidationReport {
  readonly errors: ReadonlyArray<ValidationIssue>
  readonly warnings: ReadonlyArray<ValidationIssue>
  readonly infos: ReadonlyArray<ValidationIssue>
}

const HEADING_LEVEL: Record<string, number> = {
  h1: 1,
  h2: 2,
  h3: 3,
  h4: 4,
  h5: 5,
  h6: 6,
}

const VALID_TOKEN_REF_RE =
  /^(color|spacing|fontSize|fontFamily|lineHeight|radius|shadow)\.[A-Za-z0-9_-]+$/

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Validate a document against every rule listed in this module. The
 * function is pure: it does not mutate the input and produces a fresh
 * report on every call.
 */
export function validateDocument(doc: Document): ValidationReport {
  const errors: ValidationIssue[] = []
  const warnings: ValidationIssue[] = []
  const infos: ValidationIssue[] = []

  checkHeadings(doc, errors, warnings)
  checkAltText(doc, errors)
  checkDuplicateIds(doc, errors)

  const usedRefs = collectUsedTokenRefs(doc.tree)
  checkTokenRefsResolve(doc.tokens, usedRefs, errors)
  checkUnusedTokens(doc.tokens, usedRefs, infos)

  checkContrast(doc, warnings)

  return { errors, warnings, infos }
}

// ---------------------------------------------------------------------------
// Tree walkers
// ---------------------------------------------------------------------------

function walk(
  node: ElementNode,
  visit: (node: ElementNode, ancestors: ReadonlyArray<ElementNode>) => void,
  ancestors: ElementNode[] = []
): void {
  visit(node, ancestors)
  if (node.type === 'container') {
    const next = ancestors.concat(node)
    for (const child of node.children) {
      walk(child, visit, next)
    }
  }
}

// ---------------------------------------------------------------------------
// Heading + alt + duplicate-id checks
// ---------------------------------------------------------------------------

function checkHeadings(
  doc: Document,
  errors: ValidationIssue[],
  warnings: ValidationIssue[]
): void {
  const headings: Array<{ node: TextNode; level: number }> = []
  walk(doc.tree, (node) => {
    if (node.type === 'text') {
      const level = HEADING_LEVEL[node.tag]
      if (level !== undefined) {
        headings.push({ node, level })
      }
    }
  })

  const h1s = headings.filter((h) => h.level === 1)
  if (h1s.length === 0) {
    errors.push({
      message: 'Document is missing an <h1>. Every page must have exactly one top-level heading.',
      fix: 'Promote one heading to h1.',
    })
  } else if (h1s.length > 1) {
    for (const extra of h1s.slice(1)) {
      errors.push({
        message: 'More than one <h1> in the document.',
        nodeId: extra.node.id,
        fix: 'Demote this heading to h2.',
      })
    }
  }

  let lastLevel = 0
  for (const h of headings) {
    if (lastLevel > 0 && h.level > lastLevel + 1) {
      warnings.push({
        message: `Heading level jumps from h${lastLevel} to h${h.level}. Skipping levels breaks screen-reader navigation.`,
        nodeId: h.node.id,
        fix: `Use h${lastLevel + 1} instead of h${h.level}.`,
      })
    }
    lastLevel = h.level
  }
}

function checkAltText(doc: Document, errors: ValidationIssue[]): void {
  walk(doc.tree, (node) => {
    if (node.type === 'image' && typeof node.alt !== 'string') {
      errors.push({
        message: 'Image is missing the alt attribute. Use "" for decorative images.',
        nodeId: node.id,
        fix: 'Add alt text describing the image.',
      })
    }
  })
}

function checkDuplicateIds(doc: Document, errors: ValidationIssue[]): void {
  const seen = new Set<ElementId>()
  walk(doc.tree, (node) => {
    if (seen.has(node.id)) {
      errors.push({
        message: `Duplicate element id "${node.id}".`,
        nodeId: node.id,
        fix: 'Regenerate one of the ids.',
      })
    } else {
      seen.add(node.id)
    }
  })
}

// ---------------------------------------------------------------------------
// Token reference checks
// ---------------------------------------------------------------------------

/**
 * Collect every `TokenRef`-shaped string reachable from the tree, paired
 * with the id of the nearest enclosing element so issues can be
 * pin-pointed.
 */
function collectUsedTokenRefs(tree: ElementNode): Map<string, Set<ElementId>> {
  const refs = new Map<string, Set<ElementId>>()
  const record = (ref: string, nodeId: ElementId): void => {
    let set = refs.get(ref)
    if (!set) {
      set = new Set()
      refs.set(ref, set)
    }
    set.add(nodeId)
  }
  walk(tree, (node) => {
    walkStrings(node, (value) => {
      if (VALID_TOKEN_REF_RE.test(value)) {
        record(value, node.id)
      }
    })
  })
  return refs
}

function walkStrings(value: unknown, visit: (value: string) => void): void {
  if (typeof value === 'string') {
    visit(value)
    return
  }
  if (Array.isArray(value)) {
    for (const item of value) walkStrings(item, visit)
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) walkStrings(v, visit)
  }
}

function checkTokenRefsResolve(
  tokens: Tokens,
  refs: Map<string, Set<ElementId>>,
  errors: ValidationIssue[]
): void {
  for (const [ref, nodeIds] of refs) {
    const [category, slug] = splitRef(ref)
    if (!category || !slug) continue
    const list = tokens[category]
    if (!list.some((t) => t.id === slug)) {
      for (const nodeId of nodeIds) {
        errors.push({
          message: `Unknown token reference "${ref}".`,
          nodeId,
          fix: `Define ${ref} in the Tokens panel or pick an existing token.`,
        })
      }
    }
  }
}

function checkUnusedTokens(
  tokens: Tokens,
  refs: Map<string, Set<ElementId>>,
  infos: ValidationIssue[]
): void {
  const used = new Set(refs.keys())
  ;(Object.keys(tokens) as TokenCategory[]).forEach((category) => {
    for (const tok of tokens[category]) {
      const ref = `${category}.${tok.id}`
      if (!used.has(ref)) {
        infos.push({
          message: `Token "${ref}" is defined but never referenced.`,
          fix: 'Bind a property to this token or delete it.',
        })
      }
    }
  })
}

function splitRef(ref: string): [TokenCategory | undefined, string | undefined] {
  const dot = ref.indexOf('.')
  if (dot === -1) return [undefined, undefined]
  const cat = ref.slice(0, dot)
  const slug = ref.slice(dot + 1)
  if (!isTokenCategory(cat)) return [undefined, undefined]
  return [cat, slug]
}

function isTokenCategory(s: string): s is TokenCategory {
  return (
    s === 'color' ||
    s === 'spacing' ||
    s === 'fontSize' ||
    s === 'fontFamily' ||
    s === 'lineHeight' ||
    s === 'radius' ||
    s === 'shadow'
  )
}

// ---------------------------------------------------------------------------
// Color contrast
// ---------------------------------------------------------------------------

const AA_RATIO = 4.5
const AAA_RATIO = 7

/**
 * Walks every text node and checks the resolved foreground colour
 * against the nearest ancestor's solid background. Skips text nodes
 * where either side cannot be resolved — there's no meaningful contrast
 * to report without both.
 */
function checkContrast(doc: Document, warnings: ValidationIssue[]): void {
  const target = doc.settings.contrastTarget === 'AAA' ? AAA_RATIO : AA_RATIO
  walk(doc.tree, (node, ancestors) => {
    if (node.type !== 'text') return
    const fg = resolveColorBinding(node.style.base.typography?.color, doc.tokens)
    if (!fg) return
    const bg = resolveAncestorSurface(ancestors, doc.tokens)
    if (!bg) return
    for (const theme of ['light', 'dark'] as const) {
      const ratio = safeContrast(fg[theme], bg[theme])
      if (ratio === null) continue
      if (ratio < target) {
        warnings.push({
          message: `Text contrast on the ${theme} theme is ${ratio.toFixed(2)}:1, below WCAG ${doc.settings.contrastTarget} (${target}:1).`,
          nodeId: node.id,
          fix: 'Pick a darker text colour or a lighter surface.',
        })
      }
    }
  })
}

interface ResolvedColor {
  readonly light: string
  readonly dark: string
}

/**
 * Resolve a possibly-token-bound colour value to a `{ light, dark }`
 * pair. Raw CSS strings produce identical light + dark values.
 */
function resolveColorBinding(value: string | undefined, tokens: Tokens): ResolvedColor | null {
  if (typeof value !== 'string') return null
  if (VALID_TOKEN_REF_RE.test(value)) {
    const [category, slug] = splitRef(value)
    if (category !== 'color' || !slug) return null
    const def = tokens.color.find((t) => t.id === slug)
    if (!def) return null
    return def.value as ColorTokenValue
  }
  return { light: value, dark: value }
}

/**
 * Resolve the nearest ancestor's solid background color. Returns `null`
 * if no ancestor has a resolvable solid background (gradients and image
 * layers are intentionally ignored — contrast against them is too
 * ambiguous for an automated warning).
 */
function resolveAncestorSurface(
  ancestors: ReadonlyArray<ElementNode>,
  tokens: Tokens
): ResolvedColor | null {
  for (let i = ancestors.length - 1; i >= 0; i -= 1) {
    const ancestor = ancestors[i]!
    const layers = ancestor.style.base.background
    if (!layers || layers.length === 0) continue
    for (const layer of layers) {
      if (layer.kind !== 'solid') continue
      const resolved = resolveColorBinding(layer.color, tokens)
      if (resolved) return resolved
    }
  }
  return null
}

function safeContrast(a: string, b: string): number | null {
  if (!chroma.valid(a) || !chroma.valid(b)) return null
  try {
    return chroma.contrast(a, b)
  } catch {
    return null
  }
}
