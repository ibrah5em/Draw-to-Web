/**
 * Token registry import / export (L-TKN-05).
 *
 * Round-trips `document.tokens` through JSON so design systems can be shared
 * across projects. The pure core (`serializeTokens` / `parseTokens`) is
 * separated from the browser side effects (`downloadTokens` / `importTokensFromFile`)
 * so the serialization + Zod-validation contract is unit-testable without a
 * DOM, satisfying the "round-trips through the file system" DoD via a
 * serialize → parse assertion.
 *
 * Import replaces the whole registry through {@link commitDocumentPatch},
 * which re-validates the resulting document against `documentSchema` before
 * committing — so a malformed or hand-edited file can never corrupt the store.
 */

import { tokensSchema } from '@document/schemas'
import type { Tokens } from '@document/types'

import { commitDocumentPatch } from '../document-settings/applySettings'

/** Pretty-printed JSON of a token registry (stable 2-space indent). */
export function serializeTokens(tokens: Tokens): string {
  return JSON.stringify(tokens, null, 2)
}

/**
 * Parse + Zod-validate a token-registry JSON string. Throws a descriptive
 * error when the JSON is malformed or fails the schema, so callers can
 * surface the message verbatim.
 */
export function parseTokens(json: string): Tokens {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    throw new Error('Token file is not valid JSON.')
  }
  return tokensSchema.parse(raw) as Tokens
}

/** Replace the document's token registry with a validated import. */
export function applyImportedTokens(tokens: Tokens): void {
  commitDocumentPatch((doc) => ({ ...doc, tokens }))
}

/**
 * Trigger a browser download of the current token registry as
 * `<name>.tokens.json`. No-op outside a DOM (guards `URL.createObjectURL`).
 */
export function downloadTokens(tokens: Tokens, projectName: string): void {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return
  const blob = new Blob([serializeTokens(tokens)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${projectName || 'tokens'}.tokens.json`
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

/**
 * Read a `File` (from an `<input type="file">`), validate it, and apply it.
 * Resolves on success; rejects with a descriptive error the UI can show.
 */
export async function importTokensFromFile(file: File): Promise<void> {
  const text = await file.text()
  const tokens = parseTokens(text)
  applyImportedTokens(tokens)
}
