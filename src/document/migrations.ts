/**
 * Document Model — migrations walker (I-DOC-07).
 *
 * `.dtw` files carry a `version` field. When the loader sees a version
 * older than the current schema it runs the file through a chain of
 * migration steps, then validates the result with `documentSchema`.
 *
 * Steps are listed adjacent (no skip-paths). Adding a new schema version
 * means adding one entry to `MIGRATION_STEPS` between the previous head
 * and the new version; the walker auto-composes the chain.
 *
 * The 0.1.0 → 0.2.0 step is a no-op placeholder: the legacy v0.1.0 ship
 * shipped a wholly different on-disk shape, so we do not actually attempt
 * to upgrade those files. Real migration would replace the `apply` body.
 *
 * Errors are thrown with a descriptive message; callers (file load) can
 * surface them as a "this file's version isn't recognised" dialog.
 */

import { documentSchema } from './schemas'
import type { Document, DocumentVersion } from './types'

/** A single adjacent-version migration step. */
export interface MigrationStep {
  readonly from: DocumentVersion
  readonly to: DocumentVersion
  readonly apply: (doc: unknown) => unknown
}

/**
 * Registered migration steps. Ordering inside the array is not meaningful
 * — the planner looks each step up by its `from` version. There must be
 * exactly one step per `from` version, and the graph must be acyclic.
 */
export const MIGRATION_STEPS: ReadonlyArray<MigrationStep> = [
  // v0.1.0 → v0.2.0: the legacy shape is unrelated; we surface a clear
  // error if a 0.1.0 doc actually reaches the loader by relying on the
  // final `documentSchema.parse` to reject it.
  { from: '0.1.0', to: '0.2.0', apply: (doc) => doc },
  // v0.2.0 → v0.2.1: stub to prove the path. Replace `apply` when the
  // first real 0.2.x schema bump lands.
  { from: '0.2.0', to: '0.2.1', apply: (doc) => doc },
]

/**
 * Migrate `doc` from `fromVersion` to `toVersion` and return a fully
 * validated `Document`.
 *
 * - If the two versions match, the input is parsed as-is and returned.
 * - Otherwise the walker chains `MIGRATION_STEPS` from `fromVersion`
 *   onward until it reaches `toVersion`. Each step's `apply` is invoked
 *   in order; the final result is validated against `documentSchema`.
 *
 * Throws if no chain exists from `fromVersion` to `toVersion`, or if the
 * final result fails schema validation.
 */
export function migrate(
  doc: unknown,
  fromVersion: DocumentVersion,
  toVersion: DocumentVersion
): Document {
  if (fromVersion === toVersion) {
    return documentSchema.parse(doc)
  }
  const path = planPath(fromVersion, toVersion)
  let cursor: unknown = doc
  for (const step of path) {
    cursor = step.apply(cursor)
  }
  return documentSchema.parse(cursor)
}

/**
 * Plan a sequence of `MigrationStep`s from `from` to `to` by chaining
 * adjacent `from → to` edges. Throws a structured error if the chain
 * cannot be completed.
 */
function planPath(from: DocumentVersion, to: DocumentVersion): MigrationStep[] {
  const path: MigrationStep[] = []
  let cursor = from
  const known = new Set<DocumentVersion>([from])
  while (cursor !== to) {
    const step = MIGRATION_STEPS.find((s) => s.from === cursor)
    if (!step) {
      const reachable = [...new Set(MIGRATION_STEPS.flatMap((s) => [s.from, s.to]))]
      throw new Error(
        `No migration path from "${from}" to "${to}" (stuck at "${cursor}"). Known versions: ${reachable.join(', ')}.`
      )
    }
    if (known.has(step.to)) {
      throw new Error(`Migration cycle detected at "${cursor}" while planning "${from}" → "${to}".`)
    }
    path.push(step)
    cursor = step.to
    known.add(cursor)
  }
  return path
}
