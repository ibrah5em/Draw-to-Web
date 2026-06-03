/**
 * Semantic-role inference adapter (C10, L-CAN-04).
 *
 * Walks an `ElementNode` tree and returns a structurally-identical tree with
 * `semanticRole` hints filled in on containers that don't already declare
 * one. Explicit roles (set by presets or the author) are always preserved,
 * so the function is idempotent and — because inference depends only on tree
 * structure and content, never on `id`s — a copy/pasted subtree resolves to
 * the same roles as its source.
 *
 * The generator (Ibrahim) consumes the annotated tree to choose the emitted
 * tag for each container; un-roled containers fall back to `<div>`.
 *
 * Contract: C10 (see `docs/0.2.0v/plan.md` Section 6).
 */

import type { ContainerNode, ElementNode, SemanticRole } from '@document/types'

/** Positional context handed to the inference heuristic for one node. */
interface InferContext {
  /** Distance from the root (root = 0). */
  readonly depth: number
  /** Index among the parent's children. */
  readonly index: number
  /** Number of siblings (including this node). */
  readonly siblingCount: number
}

function isContainer(node: ElementNode): node is ContainerNode {
  return node.type === 'container'
}

/** A text node rendered as a heading (`h1`–`h6`). */
function isHeading(node: ElementNode): boolean {
  return node.type === 'text' && /^h[1-6]$/.test(node.tag)
}

/** A container reads as navigation when it groups two or more links. */
function isNavLike(node: ContainerNode): boolean {
  return node.children.filter((child) => child.type === 'link').length >= 2
}

/** True when a direct child container is (or is explicitly) navigation. */
function containsNav(node: ContainerNode): boolean {
  return node.children.some(
    (child) => child.type === 'container' && (child.semanticRole === 'nav' || isNavLike(child))
  )
}

/** True when a direct child is a heading — the signal of page content, not a footer. */
function hasHeading(node: ContainerNode): boolean {
  return node.children.some(isHeading)
}

/** Mutable walk state: the single inferred-`nav` slot, claimed in document order. */
interface InferState {
  navClaimed: boolean
}

/**
 * Infer a landmark role for a container that has none. Returns `undefined`
 * for generic nested containers so the generator keeps its `<div>` default.
 *
 * Roles are gated on content signals rather than raw position so a hero-first
 * section isn't mislabelled `<header>` and a content section isn't mislabelled
 * `<footer>`. Navigation is inferred for only the first qualifying group in
 * document order — the generator emits the tag verbatim and adds no
 * disambiguating `aria-label`, so multiple inferred `<nav>` landmarks would be
 * an accessibility defect.
 */
function inferRole(
  node: ContainerNode,
  ctx: InferContext,
  state: InferState
): SemanticRole | undefined {
  if (ctx.depth === 0) return 'main'
  if (!state.navClaimed && isNavLike(node)) {
    state.navClaimed = true
    return 'nav'
  }
  if (ctx.depth === 1 && ctx.siblingCount > 1) {
    // A banner wraps navigation; a footer is the trailing region that has
    // content but no heading. Anything else at this level is a section.
    if (ctx.index === 0 && containsNav(node)) return 'header'
    if (ctx.index === ctx.siblingCount - 1 && node.children.length > 0 && !hasHeading(node)) {
      return 'footer'
    }
    return 'section'
  }
  return undefined
}

function annotate(node: ElementNode, ctx: InferContext, state: InferState): ElementNode {
  if (!isContainer(node)) return node
  // An explicit nav role also claims the single inferred-nav slot, so a later
  // nav-like group isn't auto-tagged as a second <nav>.
  if (node.semanticRole === 'nav') state.navClaimed = true
  const semanticRole = node.semanticRole ?? inferRole(node, ctx, state)
  const children = node.children.map((child, index) =>
    annotate(child, { depth: ctx.depth + 1, index, siblingCount: node.children.length }, state)
  )
  // Structural sharing (Y-PRF-01): when neither the role nor any child
  // reference changed, return the original node so the annotated tree keeps
  // immer's identity and memoised CanvasNodes skip the untouched subtree.
  const childrenUnchanged =
    children.length === node.children.length &&
    children.every((child, i) => child === node.children[i])
  if (semanticRole === node.semanticRole && childrenUnchanged) return node
  return { ...node, semanticRole, children }
}

/**
 * Annotate a document tree with inferred semantic-role hints.
 *
 * @param tree - The root element node.
 * @returns A new tree with `semanticRole` filled on containers; explicit
 *   roles are left untouched.
 */
export function inferSemantics(tree: ElementNode): ElementNode {
  return annotate(tree, { depth: 0, index: 0, siblingCount: 1 }, { navClaimed: false })
}
