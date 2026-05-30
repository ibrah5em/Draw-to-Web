/**
 * Quick-fix resolver for validation issues (L-VAL-04).
 *
 * Maps the subset of {@link ValidationIssue}s that have a *mechanical* fix to
 * a C3 {@link Operation} the dispatcher can apply in one undoable step. The
 * mapping is intentionally conservative — only issues whose remedy is
 * unambiguous get a button:
 *
 *   - **Missing `alt`** → set `alt` to `''` (decorative). The author can type
 *     real alt text afterward; the empty string clears the blocking error.
 *   - **More than one `<h1>`** → demote the offending node's `tag` to `h2`.
 *   - **Heading-level skip** → retag to the level the validator suggests.
 *
 * Duplicate-id, broken-token-ref, and contrast issues have no safe automatic
 * fix (they need author intent), so they return `null` and render without a
 * button — the message + hint still guide a manual fix.
 *
 * Pure: takes an issue, returns an op or `null`. No store access, so it is
 * unit-testable in isolation and the console owns the dispatch.
 */

import type { Operation } from '@document/operations'
import type { ValidationIssue } from '@document/validation'

/** Pull the target heading level out of a "Use hN instead of hM." fix hint. */
function headingLevelFromFix(fix: string | undefined): number | null {
  if (!fix) return null
  const match = /Use h([1-6]) instead/.exec(fix)
  return match ? Number(match[1]) : null
}

/**
 * The operation that resolves `issue`, or `null` when there is no safe
 * automatic fix. Only issues carrying a `nodeId` are fixable (the op needs a
 * target element).
 */
export function quickFixFor(issue: ValidationIssue): Operation | null {
  if (issue.nodeId === undefined) return null

  // Missing alt → mark decorative (empty string clears the error).
  if (issue.message.includes('missing the alt attribute')) {
    return { kind: 'updateNode', id: issue.nodeId, path: ['alt'], value: '' }
  }

  // Extra <h1> → demote to h2.
  if (issue.message.includes('More than one <h1>')) {
    return { kind: 'updateNode', id: issue.nodeId, path: ['tag'], value: 'h2' }
  }

  // Heading-level skip → retag to the suggested level.
  const level = headingLevelFromFix(issue.fix)
  if (level !== null && issue.message.includes('Heading level jumps')) {
    return { kind: 'updateNode', id: issue.nodeId, path: ['tag'], value: `h${level}` }
  }

  return null
}

/** True when {@link quickFixFor} would return an op for `issue`. */
export function hasQuickFix(issue: ValidationIssue): boolean {
  return quickFixFor(issue) !== null
}
