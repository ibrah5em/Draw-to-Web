/**
 * Parameterised selector hooks (Y-PRF-02).
 *
 * The base hooks in `documentStore.ts` read whole slices (`useTree`,
 * `useTokens`, …). This module adds derived selectors keyed by an
 * argument — element id, parent id, token category — that the canvas
 * and Layers tree need to subscribe to a single node or a single child
 * list without depending on the entire tree.
 *
 * Stability story:
 *
 *   - **Direct-reference selectors** (`useElementById`,
 *     `useTokensByCategory`) return the underlying object from the
 *     document tree. Because every mutation flows through immer,
 *     untouched subtrees keep their object identity, so the selector's
 *     return value stays `===` until the slice itself changes. Zustand's
 *     default `Object.is` comparator short-circuits the re-render in
 *     that case — no extra memoisation needed.
 *   - **Composite selectors** (`useChildIds`) build a new array on every
 *     read. We pair them with `useShallow` so the returned reference is
 *     diffed element-by-element; the array identity changes every read
 *     but the comparator sees the contents are equal and skips the
 *     re-render.
 *
 * Together these enable the Y-PRF-02 budget: "editing a token does not
 * re-render unbound elements". An element subscribed via
 * `useElementById('x')` reads only the tree slice; token edits never
 * touch the tree, so the returned `ElementNode` reference is unchanged
 * and React skips the leaf re-render.
 */

import { useShallow } from 'zustand/react/shallow'

import type { ElementId, ElementNode, TokenCategory, Tokens } from '@document/types'

import { useDocumentStore } from './documentStore'

/**
 * Depth-first walk that returns the `ElementNode` matching `id`, or
 * `null` if the tree has no such element.
 *
 * Pure and module-local on purpose: the returned reference is *the same*
 * `ElementNode` that lives in the document tree, so callers naturally
 * benefit from immer's structural sharing.
 */
export function findElementById(root: ElementNode, id: ElementId): ElementNode | null {
  if (root.id === id) return root
  if (root.type !== 'container') return null
  for (const child of root.children) {
    const hit = findElementById(child, id)
    if (hit !== null) return hit
  }
  return null
}

/**
 * Subscribe to a single `ElementNode` by id. Returns `null` until the
 * matching element appears in the tree (e.g. just after `dispatch`
 * inserts it), and reverts to `null` when the element is deleted.
 *
 * The hook re-renders only when the element's subtree or its own
 * properties change. Edits anywhere else in the tree, token writes,
 * SEO changes, and runtime-flag toggles all leave the returned
 * reference intact.
 */
export const useElementById = (id: ElementId): ElementNode | null =>
  useDocumentStore((s) => findElementById(s.document.tree, id))

/**
 * Subscribe to a derived value computed from a single element. The
 * caller picks the mapper, so the hook is useful for "just the
 * content" or "just the style at base" reads that should ignore
 * unrelated property changes.
 *
 * The mapper must be a *stable* reference across renders, otherwise
 * Zustand will treat each render as a new subscription and re-evaluate.
 * In practice the caller wraps it in `useCallback`:
 *
 * ```ts
 * const content = useElementSelector(
 *   id,
 *   useCallback((n) => (n?.type === 'text' ? n.content : null), [])
 * )
 * ```
 */
export function useElementSelector<T>(id: ElementId, mapper: (node: ElementNode | null) => T): T {
  return useDocumentStore((s) => mapper(findElementById(s.document.tree, id)))
}

/**
 * Subscribe to the ordered list of child element ids under `parentId`.
 * Returns an empty array when the parent is missing or is not a
 * container. The list is rebuilt on every read; `useShallow` compares
 * contents so the hook only triggers a re-render when the membership
 * or order actually changes — adding a sibling, removing a sibling,
 * or reordering children all fire, but edits to a child's properties
 * do not.
 *
 * Use this in the Layers tree (L-LYR-02) and Canvas container nodes
 * (L-CAN-02) to drive the children iteration without re-rendering on
 * unrelated mutations.
 */
export const useChildIds = (parentId: ElementId): ReadonlyArray<ElementId> =>
  useDocumentStore(
    useShallow((s) => {
      const parent = findElementById(s.document.tree, parentId)
      if (parent === null || parent.type !== 'container') return []
      return parent.children.map((c) => c.id)
    })
  )

/**
 * Subscribe to a single token category list. Reads the underlying
 * array directly, so the reference is stable until the category's
 * contents change.
 */
export function useTokensByCategory<C extends TokenCategory>(category: C): Tokens[C] {
  return useDocumentStore((s) => s.document.tokens[category])
}
