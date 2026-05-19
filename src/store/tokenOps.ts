/**
 * Token-management helpers (Y-STR-05).
 *
 * The C3 dispatcher already accepts `addToken` / `updateToken` /
 * `deleteToken` / `renameToken` ops directly — see `src/document/
 * operations.ts`. This module exists so the Tokens panel
 * (L-TKN-*) and any feature wanting to mutate the token registry has
 * a single, cleanly-typed entry point instead of constructing raw
 * `kind`-tagged op objects.
 *
 * Each helper is a one-line forward to `dispatch(op)`, which means:
 *
 *   - Every call records exactly one history entry (Y-STR-05 DoD).
 *   - `renameToken` rewrites every `TokenRef` binding in the tree in
 *     a single immer draft (the C3 handler walks the tree once);
 *     undo therefore reverts the rename and every binding rewrite in
 *     one step.
 *   - `deleteToken` freezes the resolved value into bindings before
 *     dropping the definition (color tokens flatten to the light
 *     variant — keeping the dark variant requires keeping the
 *     token). The C3 handler does the freeze; this helper just
 *     dispatches.
 *
 * `previewDeleteToken` is the pure-read companion: it returns the
 * binding count and the value that *would* be frozen if the caller
 * proceeded with the delete. The Tokens panel uses it to render a
 * confirmation prompt ("Delete `color.accent` — 7 bindings will be
 * replaced with `#3b82f6`"), satisfying the "surfaces a validation
 * warning" half of the Y-STR-05 description.
 */

import type {
  ColorTokenValue,
  ElementNode,
  TokenCategory,
  TokenDefinition,
  TokenId,
  TokenRef,
  Tokens,
} from '@document/types'

import { dispatch } from './dispatch'
import { useDocumentStore } from './documentStore'

/** Convenience alias: every category except `'color'`. */
type NonColorCategory = Exclude<TokenCategory, 'color'>

/** Partial-update payload accepted by `updateToken`. */
export interface UpdateTokenPatch<TValue> {
  readonly value?: TValue
  readonly name?: string
  readonly description?: string
}

/**
 * Add a new color token definition. Throws (via the dispatcher) when
 * a token with the same id already exists in the `color` category.
 */
export function addToken(category: 'color', definition: TokenDefinition<ColorTokenValue>): void
/**
 * Add a new non-color token definition. Throws when the id is
 * already taken inside its category.
 */
export function addToken(category: NonColorCategory, definition: TokenDefinition<string>): void
export function addToken(
  category: TokenCategory,
  definition: TokenDefinition<ColorTokenValue> | TokenDefinition<string>
): void {
  if (category === 'color') {
    dispatch({
      kind: 'addToken',
      category,
      definition: definition as TokenDefinition<ColorTokenValue>,
    })
    return
  }
  dispatch({
    kind: 'addToken',
    category,
    definition: definition as TokenDefinition<string>,
  })
}

/**
 * Update an existing color token. Any subset of `value`, `name`, and
 * `description` may be supplied; absent fields are left untouched.
 * Throws when the token is not found.
 */
export function updateToken(
  category: 'color',
  id: TokenId,
  patch: UpdateTokenPatch<ColorTokenValue>
): void
/**
 * Update an existing non-color token. Same partial semantics as the
 * color variant.
 */
export function updateToken(
  category: NonColorCategory,
  id: TokenId,
  patch: UpdateTokenPatch<string>
): void
export function updateToken(
  category: TokenCategory,
  id: TokenId,
  patch: UpdateTokenPatch<ColorTokenValue> | UpdateTokenPatch<string>
): void {
  if (category === 'color') {
    dispatch({
      kind: 'updateToken',
      category,
      id,
      ...(patch as UpdateTokenPatch<ColorTokenValue>),
    })
    return
  }
  dispatch({
    kind: 'updateToken',
    category,
    id,
    ...(patch as UpdateTokenPatch<string>),
  })
}

/**
 * Delete a token. The dispatcher rewrites every binding in the tree
 * to the frozen resolved value before the definition is dropped, so
 * the resulting document is renderable without broken refs. The
 * whole thing is one history entry.
 *
 * Callers that want to confirm the delete first should call
 * `previewDeleteToken(category, id)` to see how many bindings will
 * be affected and what value they'll be frozen to.
 */
export function deleteToken(category: TokenCategory, id: TokenId): void {
  dispatch({ kind: 'deleteToken', category, id })
}

/**
 * Rename a token id. Walks every `TokenRef` in the tree rewriting
 * matches in a single draft — undo reverses the rename and every
 * binding rewrite in one step. Throws when the source token is
 * missing or the target id is already in use.
 *
 * Renaming a token to its current id is a no-op and produces no
 * history entry (the dispatcher drops empty-patch writes).
 */
export function renameToken(category: TokenCategory, oldId: TokenId, newId: TokenId): void {
  dispatch({ kind: 'renameToken', category, oldId, newId })
}

/**
 * What `deleteToken(category, id)` *would* do, without mutating
 * anything. Returns:
 *
 *   - `bindingCount`: how many `TokenRef` strings in the tree
 *     reference the named token. Each one will be rewritten to
 *     `frozenValue` when the delete actually fires.
 *   - `frozenValue`: the value the bindings will be replaced with.
 *     For color tokens, this is the **light**-theme variant — the
 *     dark variant is intentionally dropped, which is the warning
 *     the UI should surface. `null` when the token does not exist.
 *
 * Pure: reads `useDocumentStore.getState()` once and does not
 * subscribe.
 */
export function previewDeleteToken(
  category: TokenCategory,
  id: TokenId
): { bindingCount: number; frozenValue: string | null } {
  const document = useDocumentStore.getState().document
  const def = findTokenDefinition(document.tokens, category, id)
  if (def === null) {
    return { bindingCount: 0, frozenValue: null }
  }
  const frozenValue =
    category === 'color' ? (def.value as ColorTokenValue).light : (def.value as string)
  const ref: TokenRef = `${category}.${id}`
  const bindingCount = countTokenRefs(document.tree, ref)
  return { bindingCount, frozenValue }
}

/**
 * Locate a single token definition by `(category, id)`. Returns
 * `null` when not found. Pure helper exported for tests; production
 * callers should prefer `useTokensByCategory` from `selectors.ts`
 * for reactive reads.
 */
export function findTokenDefinition(
  tokens: Tokens,
  category: TokenCategory,
  id: TokenId
): TokenDefinition<ColorTokenValue> | TokenDefinition<string> | null {
  const list = tokens[category]
  for (const def of list) {
    if (def.id === id) return def
  }
  return null
}

/**
 * Count occurrences of a specific `TokenRef` string anywhere in the
 * tree. Used by `previewDeleteToken` to size the confirmation prompt.
 * Returns the *total* string-equality matches across every property
 * of every node, since references can appear in style blocks,
 * attributes, content, etc.
 */
function countTokenRefs(node: ElementNode, ref: string): number {
  return countStringMatches(node, ref)
}

function countStringMatches(value: unknown, target: string): number {
  if (value === target) return 1
  if (Array.isArray(value)) {
    let total = 0
    for (const item of value) total += countStringMatches(item, target)
    return total
  }
  if (value !== null && typeof value === 'object') {
    let total = 0
    for (const key of Object.keys(value)) {
      total += countStringMatches((value as Record<string, unknown>)[key], target)
    }
    return total
  }
  return 0
}
