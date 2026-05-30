/**
 * Document-level settings writer (L-DLG-02 support).
 *
 * The C3 operation union (Ibrahim's lane) covers element + token edits but
 * has no op for the document-level blocks the Settings dialog touches —
 * `seo`, `runtime`, `settings`, `variables`, `meta`. Rather than reach into
 * `src/document/operations.ts` (a contract-change), this helper stays in the
 * UI lane and writes through the public `documentStore.commit` action, which
 * marks the document dirty (Y-PER-06) exactly like a dispatched op.
 *
 * **Round-trips through Zod (L-DLG-02 DoD):** the next document is parsed by
 * `documentSchema` before it is committed. A schema failure throws, the
 * store is left untouched, and the caller surfaces the message — so an
 * invalid settings write can never reach the store.
 *
 * Trade-off: these commits are *not* individually undoable (no history
 * entry, no inverse patches). That matches how document-level metadata is
 * typically edited — through a modal the user confirms — and avoids a
 * cross-lane contract change. A proper `updateDocument` C3 op is the
 * follow-up if undo coverage is wanted here.
 */

import { documentSchema } from '@document/schemas'
import type { Document } from '@document/types'
import { useDocumentStore } from '@store/documentStore'

/** A pure transform from the current document to its next state. */
export type DocumentPatch = (doc: Document) => Document

/**
 * Apply `patch` to the current document, validate the result against
 * `documentSchema`, and commit it. Throws (without mutating the store) when
 * the patched document fails validation.
 */
export function commitDocumentPatch(patch: DocumentPatch): void {
  const current = useDocumentStore.getState().document
  const next = patch(current)
  // Round-trip through Zod — the parsed value is structurally identical for
  // a valid document, and the parse throws for an invalid one.
  const validated = documentSchema.parse(next) as Document
  useDocumentStore.getState().commit(validated)
}
