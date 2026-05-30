/**
 * Live validation hook (L-VAL-01).
 *
 * Subscribes to the document and runs `validateDocument` (C8) against it.
 * Because every mutation flows through immer (the Y-STR-03 dispatcher
 * commits a fresh snapshot), `s.document` keeps referential identity until
 * the document actually changes — so `useMemo` recomputes the report only
 * on a real edit, never on unrelated session changes (selection, theme,
 * breakpoint). That is what keeps the console inside the L-VAL-01 budget
 * ("updates within 200 ms of any mutation") without manual throttling.
 */

import { useMemo } from 'react'

import { validateDocument, type ValidationReport } from '@document/validation'
import { useDocumentStore } from '@store/documentStore'

/** Subscribe to the current document's validation report. */
export function useValidationReport(): ValidationReport {
  const document = useDocumentStore((s) => s.document)
  return useMemo(() => validateDocument(document), [document])
}

/**
 * `true` when the document has at least one blocking validation error.
 * Drives the export-block indicator (L-VAL-03) and the export button's
 * disabled state (L-TOP-04). Recomputes on the same cadence as
 * {@link useValidationReport}.
 */
export function useHasValidationErrors(): boolean {
  return useValidationReport().errors.length > 0
}
