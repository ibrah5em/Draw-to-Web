/**
 * Defaults + id generation for adding tokens (L-TKN-04).
 *
 * Pure helpers so the "Add" affordance has a sensible starting point and a
 * collision-free id within its category. No React — unit-testable directly.
 */

import type { ColorTokenValue, TokenCategory, TokenDefinition } from '@document/types'

type ScalarCategory = Exclude<TokenCategory, 'color'>

const SCALAR_DEFAULT_VALUE: Record<ScalarCategory, string> = {
  spacing: '16px',
  fontSize: '16px',
  fontFamily: 'system-ui, sans-serif',
  lineHeight: '1.5',
  radius: '4px',
  shadow: '0 1px 2px rgba(0, 0, 0, 0.15)',
}

const SCALAR_LABEL: Record<ScalarCategory, string> = {
  spacing: 'spacing',
  fontSize: 'font size',
  fontFamily: 'font family',
  lineHeight: 'line height',
  radius: 'radius',
  shadow: 'shadow',
}

/** A slug-valid id unique within a category's existing definitions. */
export function nextTokenId(existing: ReadonlyArray<{ readonly id: string }>): string {
  const taken = new Set(existing.map((t) => t.id))
  let n = 1
  while (taken.has(`token-${n}`)) n += 1
  return `token-${n}`
}

/** A fresh color token definition (light/dark) with the given id. */
export function colorDefault(id: string): TokenDefinition<ColorTokenValue> {
  return { id, name: 'New color', value: { light: '#3b82f6', dark: '#60a5fa' } }
}

/** A fresh scalar token definition with a category-appropriate default value. */
export function scalarDefault(category: ScalarCategory, id: string): TokenDefinition<string> {
  return { id, name: `New ${SCALAR_LABEL[category]}`, value: SCALAR_DEFAULT_VALUE[category] }
}

/** True when `id` is a valid token slug (matches the `TokenRef` grammar). */
export function isValidTokenId(id: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(id)
}
