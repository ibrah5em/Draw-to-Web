/**
 * Editor document store (Y-STR-01, contract C5).
 *
 * Single source of truth for the in-memory `Document` and its dirty flag.
 * Downstream consumers:
 *
 *   - The Y-STR-03 dispatcher commits new document snapshots after running
 *     `produceWithPatches` against the C3 operation handler.
 *   - The Y-PER-02 loader hydrates a freshly-parsed document after Zod +
 *     migration; the Y-PER-01 saver reads the current document and calls
 *     `markClean` once `electronAPI.saveProject` resolves.
 *   - The UI subscribes through the focused selector hooks at the bottom
 *     of this file (`useTree`, `useTokens`, `useSettings`, …). Each
 *     selector reads one slice; because document mutations go through
 *     `immer`, untouched sub-objects keep their reference and React skips
 *     unrelated re-renders. That is what makes the Y-PRF-02 budget
 *     ("editing token does not re-render unbound elements") achievable
 *     without bespoke memoisation.
 *
 * The store knows nothing about operations, history, or persistence. It
 * is intentionally a thin holder so the Y-STR-03 dispatcher can sit on
 * top without circular ownership.
 */

import { nanoid } from 'nanoid'
import { create } from 'zustand'

import type {
  Document,
  DocumentMeta,
  DocumentSettings,
  DocumentVariables,
  DocumentVersion,
  ElementNode,
  RuntimeFlags,
  SEOConfig,
  Tokens,
} from '@document/types'

/**
 * Schema version emitted by every freshly-created document. Bumping this
 * requires a matching migration step in `src/document/migrations.ts`.
 */
export const CURRENT_DOCUMENT_VERSION: DocumentVersion = '0.2.0'

const EMPTY_TOKENS: Tokens = {
  color: [],
  spacing: [],
  fontSize: [],
  fontFamily: [],
  lineHeight: [],
  radius: [],
  shadow: [],
}

const DEFAULT_RUNTIME: RuntimeFlags = {
  themeToggle: false,
  scrollSpy: false,
  smoothScroll: false,
  mobileNav: false,
  navOnScroll: false,
  reveals: false,
  animationGating: false,
  terminalTyping: false,
}

const DEFAULT_SETTINGS: DocumentSettings = {
  contrastTarget: 'AA',
  defaultTheme: 'auto',
  gridVisible: true,
}

/**
 * Build a minimal, schema-valid blank document.
 *
 * The tree is a single empty root container so the canvas always has a
 * drop target and the recursive renderer never has to special-case "no
 * tree". SEO is filled with browser-standard defaults so `documentSchema`
 * accepts the result without manual setup. Validation may still report
 * issues (no `<h1>` yet, no tokens referenced) — those are deliberately
 * out of scope for the store and are surfaced by `validateDocument` at
 * the validation console and export gate.
 *
 * @param name - Author-facing project name surfaced in the topbar; also
 *   used as the default SEO title until the author edits it.
 */
export function createBlankDocument(name: string = 'Untitled'): Document {
  const now = new Date().toISOString()
  const rootId = nanoid(8)
  const meta: DocumentMeta = { name, createdAt: now, updatedAt: now }
  const tree: ElementNode = {
    id: rootId,
    type: 'container',
    name: 'Page',
    style: { base: {} },
    layout: { base: { mode: 'flex', direction: 'column' } },
    children: [],
  }
  const seo: SEOConfig = {
    title: name,
    description: '',
    lang: 'en',
    viewport: 'width=device-width, initial-scale=1',
    charset: 'utf-8',
  }
  return {
    version: CURRENT_DOCUMENT_VERSION,
    meta,
    tokens: EMPTY_TOKENS,
    tree,
    seo,
    runtime: DEFAULT_RUNTIME,
    variables: {},
    settings: DEFAULT_SETTINGS,
    assets: {},
  }
}

interface DocumentState {
  /** The in-memory document. Always schema-valid; never `null`. */
  readonly document: Document
  /**
   * `true` after any committed mutation, `false` after `hydrate` / `reset`
   * / explicit `markClean`. Drives the topbar dirty indicator (L-TOP-05)
   * and is the gate for autosave (Y-PER-03).
   */
  readonly isDirty: boolean
}

interface DocumentActions {
  /**
   * Replace the current document **without** changing the dirty flag.
   * Low-level primitive; prefer `commit` (post-op) or `hydrate` (post-load).
   */
  setDocument: (next: Document) => void
  /**
   * Set the dirty flag explicitly. The Y-STR-03 dispatcher calls
   * `setDirty(true)` after each op; Y-PER-06 calls `setDirty(false)`
   * once `saveProject` resolves.
   */
  setDirty: (dirty: boolean) => void
  /**
   * Replace the document and mark dirty in a single `set`. Used by the
   * Y-STR-03 dispatcher to publish the post-operation snapshot.
   */
  commit: (next: Document) => void
  /**
   * Replace the document and clear the dirty flag in a single `set`.
   * Used by Y-PER-02 after a `.dtw` load completes.
   */
  hydrate: (next: Document) => void
  /** Convenience: clear the dirty flag without touching the document. */
  markClean: () => void
  /** Convenience: set the dirty flag without touching the document. */
  markDirty: () => void
  /**
   * Replace the document with a fresh blank one and clear dirty. The
   * caller is expected to clear `useHistoryStore` separately so the new
   * timeline starts clean.
   */
  reset: (name?: string) => void
}

export type DocumentStore = DocumentState & DocumentActions

/**
 * Zustand store backing the editor document.
 *
 * The store is intentionally `set`-based rather than `useImmer`-wrapped.
 * Y-STR-03's dispatcher runs `produceWithPatches` against the C3
 * operation handler outside the store and hands the resulting snapshot
 * back through `commit`. Keeping `produceWithPatches` outside lets us
 * capture the patches in one place (the dispatcher) so the history
 * recording remains atomic with the document update.
 *
 * Satisfies contract C5 — `useDocumentStore` half of the surface.
 */
export const useDocumentStore = create<DocumentStore>()((set) => ({
  document: createBlankDocument(),
  isDirty: false,

  setDocument: (next) => set({ document: next }),
  setDirty: (dirty) => set({ isDirty: dirty }),

  commit: (next) => set({ document: next, isDirty: true }),
  hydrate: (next) => set({ document: next, isDirty: false }),

  markClean: () => set({ isDirty: false }),
  markDirty: () => set({ isDirty: true }),

  reset: (name) => set({ document: createBlankDocument(name), isDirty: false }),
}))

// ---------------------------------------------------------------------------
// Focused selector hooks
//
// Each hook reads one slice of the document. Because mutations flow through
// `immer`, slices that do not change keep referential equality across
// updates and the React component subscribed to that slice does not
// re-render. The Y-PRF-02 budget ("editing a token does not re-render
// unbound elements") relies on this — do not collapse these into wider
// selectors that return composite objects, since that would produce a new
// reference on every state change.
// ---------------------------------------------------------------------------

/** Subscribe to the root element tree. */
export const useTree = (): ElementNode => useDocumentStore((s) => s.document.tree)

/** Subscribe to the categorised token registry. */
export const useTokens = (): Tokens => useDocumentStore((s) => s.document.tokens)

/** Subscribe to author-facing document settings (contrast target, theme, grid). */
export const useDocumentSettings = (): DocumentSettings =>
  useDocumentStore((s) => s.document.settings)

/** Subscribe to the SEO config block. */
export const useSEO = (): SEOConfig => useDocumentStore((s) => s.document.seo)

/** Subscribe to the runtime-snippet feature flags. */
export const useRuntimeFlags = (): RuntimeFlags => useDocumentStore((s) => s.document.runtime)

/** Subscribe to the `{{variable}}` substitution map. */
export const useDocumentVariables = (): DocumentVariables =>
  useDocumentStore((s) => s.document.variables)

/** Subscribe to document-level metadata (name, timestamps). */
export const useDocumentMeta = (): DocumentMeta => useDocumentStore((s) => s.document.meta)

/** Subscribe to the dirty flag. */
export const useIsDirty = (): boolean => useDocumentStore((s) => s.isDirty)
