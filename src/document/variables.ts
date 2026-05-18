/**
 * Document Model — `{{variable}}` interpolation (I-DOC-08).
 *
 * Authors define `document.variables: Record<string, string>` and reach
 * them from text content and string attribute values via `{{name}}`
 * placeholders. The substitution is applied at generation time so an
 * edit to a variable updates every occurrence on the next emit.
 *
 * Rules:
 *   - Placeholders match `\{\{\s*[A-Za-z0-9_-]+\s*\}\}`.
 *   - Unknown names are left intact (the placeholder remains visible to
 *     the author until the variable is defined).
 *   - No recursive expansion — a value containing `{{x}}` is treated as
 *     a literal string, not interpolated further. This keeps the substitution
 *     terminating and predictable.
 */

import type { DocumentVariables } from './types'

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z0-9_-]+)\s*\}\}/g

/**
 * Substitute every `{{var}}` placeholder in `template` with the
 * corresponding value from `variables`. Unknown placeholders pass
 * through unchanged.
 */
export function interpolate(template: string, variables: DocumentVariables): string {
  return template.replace(PLACEHOLDER_RE, (match, name: string) => {
    const value = variables[name]
    return typeof value === 'string' ? value : match
  })
}

/**
 * Return the set of variable names referenced by `template`. Useful for
 * validation surfaces that want to flag undefined variables without
 * walking the regex twice.
 */
export function collectVariableNames(template: string): ReadonlySet<string> {
  const names = new Set<string>()
  const re = new RegExp(PLACEHOLDER_RE.source, 'g')
  let match: RegExpExecArray | null
  while ((match = re.exec(template)) !== null) {
    names.add(match[1]!)
  }
  return names
}
