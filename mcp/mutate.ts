/**
 * Validated mutation wrapper — the ONE place MCP tools turn an operation into
 * a new document.
 *
 * It reuses the project's existing operation layer (`applyOperation`, C3) and
 * validation (`validateDocument`, C8) exactly as the UI store does, but adds
 * the recoverability the agent needs:
 *
 *   - The operation runs inside `immer.produce` (same as the store's
 *     `produceWithPatches`), so the tree is never mutated in place.
 *   - If `applyOperation` throws (unknown id, index out of range, …) the error
 *     is captured as a structured `operation` failure rather than propagating.
 *   - The candidate document is validated; any error the op *introduced*
 *     (e.g. a second `<h1>`, a duplicate id) is reported as a `validation`
 *     failure and the candidate is discarded. Pre-existing errors (an empty
 *     page legitimately missing its `<h1>`) are not held against the op.
 *
 * No tree is poked directly; no validation is reimplemented.
 */

import { produce, type Draft } from 'immer'

import { applyOperation, type Operation } from '../src/document/operations'
import { validateDocument } from '../src/document/validation'
import type { Document } from '../src/document/types'

/** A single actionable validation/operation problem surfaced to the agent. */
export interface MutationIssue {
  readonly message: string
  readonly nodeId?: string
  readonly fix?: string
}

/** Outcome of a validated mutation. */
export type MutationResult =
  | { readonly ok: true; readonly document: Document }
  | {
      readonly ok: false
      readonly kind: 'operation' | 'validation'
      readonly errors: ReadonlyArray<MutationIssue>
    }

/** Compare two issues for "is this the same error" (dedupe by message + node). */
function sameIssue(a: MutationIssue, b: { message: string; nodeId?: string }): boolean {
  return a.message === b.message && a.nodeId === b.nodeId
}

/**
 * Validate a document transition: accept it unless it INTRODUCED a validation
 * error that wasn't already present (so a legitimately-empty page missing its
 * `<h1>` isn't blamed on an unrelated edit).
 */
function checkTransition(before: Document, after: Document): MutationResult {
  const beforeErrors = validateDocument(before).errors
  const afterErrors = validateDocument(after).errors
  const introduced = afterErrors.filter((a) => !beforeErrors.some((b) => sameIssue(a, b)))
  if (introduced.length > 0) {
    return {
      ok: false,
      kind: 'validation',
      errors: introduced.map((e) => ({ message: e.message, nodeId: e.nodeId, fix: e.fix })),
    }
  }
  return { ok: true, document: after }
}

/**
 * Apply one operation to `doc`, returning the new document or a structured
 * error. Pure: `doc` is never mutated.
 *
 * @param doc - The current document.
 * @param op - An existing C3 operation to apply via `applyOperation`.
 * @returns `{ ok: true, document }` on success, else a structured failure
 *   naming what was rejected and how validation says to fix it.
 */
export function mutate(doc: Document, op: Operation): MutationResult {
  let next: Document
  try {
    next = produce(doc, (draft) => {
      applyOperation(draft, op)
    })
  } catch (err) {
    return {
      ok: false,
      kind: 'operation',
      errors: [{ message: err instanceof Error ? err.message : String(err) }],
    }
  }
  return checkTransition(doc, next)
}

/**
 * Apply a recipe to non-tree document fields (SEO, runtime flags, settings)
 * that the project has NO C3 operation for — the editor edits these by
 * committing a new `Document`, so this mirrors that commit pattern (produce a
 * new document, then validate the transition). The tree is never edited here;
 * tree writes always go through {@link mutate}/`applyOperation`.
 *
 * @param doc - The current document.
 * @param recipe - An immer recipe mutating the draft's non-tree fields.
 */
export function mutateRecipe(
  doc: Document,
  recipe: (draft: Draft<Document>) => void
): MutationResult {
  let next: Document
  try {
    next = produce(doc, recipe)
  } catch (err) {
    return {
      ok: false,
      kind: 'operation',
      errors: [{ message: err instanceof Error ? err.message : String(err) }],
    }
  }
  return checkTransition(doc, next)
}
