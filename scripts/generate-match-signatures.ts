/**
 * Generate precomputed layout signatures for the design library.
 *
 * Each library page ships with a signature computed at BUILD time so the
 * matcher is fast and fully offline at runtime — it never has to walk every
 * library tree on each match. This script is the single source of that
 * generated file: it materialises every page, extracts its signature, and
 * writes `src/match/library/signatures.generated.ts`.
 *
 * Determinism guarantee: `extractSignature` ignores element ids, names, and
 * copy, so re-running this script on unchanged page factories produces a
 * byte-identical file. A drift test (`tests/match/library.test.ts`)
 * re-extracts and asserts equality, so a structural change that is not
 * regenerated fails CI rather than shipping a stale signature.
 *
 * Run with `npm run generate:match-signatures`. The emitted file is then
 * prettier-formatted by the same `prepare`/lint pipeline as the rest of the
 * repo (the script also runs prettier on it directly).
 */

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { extractSignature } from '../src/match/signature'
import { libraryPages } from '../src/match/library/pages'
import type { LibrarySignatureEntry } from '../src/match/matcher'

const OUT_PATH = join(__dirname, '..', 'src', 'match', 'library', 'signatures.generated.ts')

/** Build the `{ pageId, signature }` entry for every registered library page. */
function buildEntries(): ReadonlyArray<LibrarySignatureEntry> {
  return libraryPages.map((page) => ({
    pageId: page.id,
    signature: extractSignature(page.create()),
  }))
}

/** Render the generated module source from the computed entries. */
function renderModule(entries: ReadonlyArray<LibrarySignatureEntry>): string {
  const body = JSON.stringify(entries, null, 2)
  return `/**
 * AUTO-GENERATED — do not edit by hand.
 *
 * Precomputed layout signatures for the design library, emitted by
 * \`scripts/generate-match-signatures.ts\`. Regenerate with
 * \`npm run generate:match-signatures\` whenever a library page's structure
 * changes; the drift test in \`tests/match/library.test.ts\` enforces it.
 */

import type { LibrarySignatureEntry } from '../matcher'

export const LIBRARY_SIGNATURES: ReadonlyArray<LibrarySignatureEntry> = ${body}
`
}

function main(): void {
  const entries = buildEntries()
  writeFileSync(OUT_PATH, renderModule(entries), 'utf8')
  // Format in place so the committed file matches the prettier config.
  execFileSync('npx', ['prettier', '--write', OUT_PATH], { stdio: 'inherit' })
  // eslint-disable-next-line no-console
  console.log(`Wrote ${entries.length} signatures → ${OUT_PATH}`)
}

main()
