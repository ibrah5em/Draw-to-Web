/**
 * Session / document store — documents persist ACROSS tool calls.
 *
 * Documents live in memory keyed by a generated id; tools operate on them by
 * id. Disk persistence reuses the project's `.dtw` path exactly: save is
 * `JSON.stringify(document)` (the deterministic format `src/store/persistence`
 * defines), load is `JSON.parse → migrate(...)` (the same parse → migrate →
 * `documentSchema.parse` chain `openProject` runs). Writes go through
 * {@link mutate}, never the tree directly.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'

import { nanoid } from 'nanoid'

import type { Operation } from '../src/document/operations'
import { migrate } from '../src/document/migrations'
import type { Document, DocumentVersion, Tokens } from '../src/document/types'
import { createBlankDocument, CURRENT_DOCUMENT_VERSION } from '../src/store/documentStore'
import { createBlankTemplate } from '../src/templates/blank'

import type { Draft } from 'immer'

import { mutate, mutateRecipe, type MutationResult } from './mutate'

/**
 * The canonical default token registry (colors + spacing + type scale, etc.)
 * the blank template ships. `createBlankDocument` ships an EMPTY registry, but
 * the `createPrimitive` factory the insert tool reuses references tokens like
 * `spacing.sm` — so a new MCP document must carry these tokens or every
 * container insert would trip a broken-token-ref validation error. Taken from
 * the existing template (not forked); ids/copy are irrelevant here.
 */
const DEFAULT_TOKENS: Tokens = createBlankTemplate().tokens

/** Thrown for session-level lookup failures (unknown id, bad file). */
export class SessionError extends Error {}

/** Compact metadata for the document list resource. */
export interface DocumentInfo {
  readonly id: string
  readonly name: string
  readonly version: DocumentVersion
  readonly filePath?: string
}

/** Filesystem-safe filename from a document name. */
function sanitize(name: string): string {
  const cleaned = name
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 64)
  return cleaned.replace(/^-|-$/g, '') || 'document'
}

/**
 * In-memory document store with `.dtw` persistence. One instance per server
 * process; tests construct it with a temp `baseDir`.
 */
export class Workspace {
  private readonly docs = new Map<string, Document>()
  private readonly paths = new Map<string, string>()

  constructor(private readonly baseDir: string) {}

  /**
   * Create a fresh blank document (empty page, no `<h1>`) carrying the default
   * token registry so inserted primitives' token refs resolve. Returns its id.
   */
  create(name?: string): { id: string; document: Document } {
    const document: Document = {
      ...createBlankDocument(name?.trim() || 'Untitled'),
      tokens: DEFAULT_TOKENS,
    }
    const id = nanoid(10)
    this.docs.set(id, document)
    return { id, document }
  }

  /** Register an already-built document (e.g. a hydrated template) under a new id. */
  register(document: Document): { id: string; document: Document } {
    const id = nanoid(10)
    this.docs.set(id, document)
    return { id, document }
  }

  /** Whether a document with `id` exists in the session. */
  has(id: string): boolean {
    return this.docs.has(id)
  }

  /** Get a document by id, throwing {@link SessionError} when absent. */
  get(id: string): Document {
    const doc = this.docs.get(id)
    if (!doc) throw new SessionError(`No document with id "${id}". Create one or load a .dtw file.`)
    return doc
  }

  /** Every document currently held, for the list resource. */
  list(): DocumentInfo[] {
    return Array.from(this.docs.entries()).map(([id, doc]) => ({
      id,
      name: doc.meta.name,
      version: doc.version,
      filePath: this.paths.get(id),
    }))
  }

  /**
   * Apply an operation to a document via {@link mutate}. On success the new
   * document is committed to the session; on failure the session is unchanged
   * and the structured error is returned.
   */
  applyOperation(id: string, op: Operation): MutationResult {
    return this.applyOperations(id, [op])
  }

  /**
   * Apply several operations atomically: each runs through {@link mutate} on a
   * working copy; the session is committed only if ALL succeed, so a partial
   * multi-field edit can never leave the document half-changed.
   */
  applyOperations(id: string, ops: ReadonlyArray<Operation>): MutationResult {
    let working = this.get(id)
    for (const op of ops) {
      const result = mutate(working, op)
      if (!result.ok) return result
      working = result.document
    }
    this.docs.set(id, working)
    return { ok: true, document: working }
  }

  /**
   * Update non-tree document fields (SEO, runtime, settings) via an immer
   * recipe, committing only if validation still holds. Tree edits must use
   * {@link applyOperation}; this is for document-level fields the project has
   * no C3 operation for (it commits a new document, like the editor does).
   */
  update(id: string, recipe: (draft: Draft<Document>) => void): MutationResult {
    const result = mutateRecipe(this.get(id), recipe)
    if (result.ok) this.docs.set(id, result.document)
    return result
  }

  /**
   * Persist a document to a `.dtw` file (deterministic `JSON.stringify`).
   * Defaults to `<baseDir>/<name>.dtw`; an explicit path is honoured.
   *
   * @returns The absolute path written.
   */
  save(id: string, filePath?: string): string {
    const doc = this.get(id)
    const target =
      filePath !== undefined
        ? isAbsolute(filePath)
          ? filePath
          : join(this.baseDir, filePath)
        : (this.paths.get(id) ?? join(this.baseDir, `${sanitize(doc.meta.name)}.dtw`))
    mkdirSync(this.baseDir, { recursive: true })
    writeFileSync(target, JSON.stringify(doc), 'utf8')
    this.paths.set(id, target)
    return target
  }

  /**
   * Load a `.dtw` file into the session through the project's parse → migrate
   * → schema-validate path. Returns the new session id + document.
   *
   * @throws {SessionError} when the file is unreadable, malformed, or fails
   *   migration/schema validation.
   */
  load(filePath: string): { id: string; document: Document } {
    let raw: string
    try {
      raw = readFileSync(filePath, 'utf8')
    } catch (err) {
      throw new SessionError(
        `Cannot read "${filePath}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch (err) {
      throw new SessionError(
        `Malformed JSON in "${filePath}": ${err instanceof Error ? err.message : String(err)}`
      )
    }
    const fromVersion =
      parsed !== null &&
      typeof parsed === 'object' &&
      'version' in parsed &&
      typeof (parsed as { version: unknown }).version === 'string'
        ? ((parsed as { version: string }).version as DocumentVersion)
        : CURRENT_DOCUMENT_VERSION
    let document: Document
    try {
      document = migrate(parsed, fromVersion, CURRENT_DOCUMENT_VERSION)
    } catch (err) {
      throw new SessionError(
        `"${filePath}" failed validation: ${err instanceof Error ? err.message : String(err)}`
      )
    }
    const id = nanoid(10)
    this.docs.set(id, document)
    this.paths.set(id, filePath)
    return { id, document }
  }
}
