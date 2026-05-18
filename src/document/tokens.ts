/**
 * Document Model — token resolver (C9).
 *
 * `resolveToken` is the single source of truth for turning a `TokenRef`
 * into a concrete CSS value at a given theme. Two consumers:
 *
 *   - Canvas live render (L-CAN-03 / L-TKN-03) — needs the resolved
 *     value to paint pixels accurately.
 *   - Generator helpers — `deleteToken` (operations.ts) freezes the
 *     resolved value into the tree before removing the definition.
 *
 * The HTML/CSS generator itself does *not* call this — output keeps the
 * `var(--name)` reference so themes can flip at runtime.
 *
 * Contract: C9 (see `docs/0.2.0v/plan.md` Section 6).
 */

import type { ColorTokenValue, TokenCategory, TokenId, TokenRef, Tokens } from './types'

/** Active theme when resolving a color token. */
export type ThemeKey = 'light' | 'dark'

const TOKEN_REF_RE =
  /^(color|spacing|fontSize|fontFamily|lineHeight|radius|shadow)\.[A-Za-z0-9_-]+$/

/** Type guard: `true` when `value` is a string of the form `${category}.${id}`. */
export function isTokenRef(value: unknown): value is TokenRef {
  return typeof value === 'string' && TOKEN_REF_RE.test(value)
}

/**
 * Decompose a well-formed `TokenRef` into its `{ category, id }` parts.
 * Callers must pass a value that has already passed `isTokenRef`.
 */
export function parseTokenRef(ref: TokenRef): { category: TokenCategory; id: TokenId } {
  const dot = ref.indexOf('.')
  return {
    category: ref.slice(0, dot) as TokenCategory,
    id: ref.slice(dot + 1),
  }
}

/**
 * Resolve a token reference to its concrete CSS value at the given
 * theme. Color tokens pick the theme variant; every other category is
 * theme-invariant and returns its raw string.
 *
 * Returns `null` when the reference is malformed or points at a missing
 * token — callers can render that as the default value or surface a
 * "broken ref" warning. `validateDocument` (C8) flags the same case.
 */
export function resolveToken(
  tokens: Tokens,
  ref: TokenRef | string,
  theme: ThemeKey
): string | null {
  if (!isTokenRef(ref)) return null
  const { category, id } = parseTokenRef(ref)
  const list = tokens[category]
  const def = list.find((t) => t.id === id)
  if (!def) return null
  if (category === 'color') {
    return (def.value as ColorTokenValue)[theme]
  }
  return def.value as string
}
