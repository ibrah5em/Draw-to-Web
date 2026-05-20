/**
 * Export pipeline orchestrator (C12 / I-EXP-01).
 *
 * The C12 contract: `exportProject(document, options): Promise<ExportResult>`.
 * Walks an 8-stage pipeline, surfaces structured progress events, and
 * blocks on document-level + axe-core a11y violations before any bytes
 * are written to disk.
 *
 * Stages (matching `.claude/rules/code-generator.md`):
 *
 *   1. `validate`        — `validateDocument(doc)`. Errors block the export.
 *   2. `generate`        — `generate(doc)` → `{ html, css, js }` (prettier-formatted).
 *   3. `inject-seo`      — SEO meta + JSON-LD + landmark roles injected into the head.
 *   4. `optimize-images` — uses the sharp manifest from `document.assets` (passthrough
 *                          until I-ELE-05 lands the sharp pipeline).
 *   5. `minify`          — `lightningcss` + `html-minifier-terser` + `terser`. The
 *                          underlying packages are not yet installed; the stage is
 *                          present in the pipeline shape so I-EXP-03 can light it up
 *                          without restructuring.
 *   6. `sitemap-robots`  — `sitemap.xml` + `robots.txt`.
 *   7. `bundle`          — JSZip into one ArrayBuffer.
 *   8. `save`            — IPC → main process → `fs.writeFile`.
 *
 * The renderer-facing legacy helper `legacyExportProject(elements, seoConfig,
 * options)` is kept until the canvas migrates to `useDocumentStore`; it
 * adapts the v0.1.0 store shape and delegates to the new pipeline.
 */

import JSZip from 'jszip'
import { generate } from '../generator'
import { generateFullReport, injectSEO } from '../seo'
import { emitSitemap } from '../seo/sitemap'
import { emitRobots } from '../seo/robots'
import { validateDocument } from '../document/validation'
import type { Document } from '../document/types'
import type {
  CanvasElement,
  ExportResult,
  FullExportReport,
  SEOConfig as LegacySEOConfig,
} from '../shared/types'
import { canvasElementsToDocument } from './legacyAdapter'

/**
 * Named stages of the export pipeline. Surfaced on errors and progress
 * events. The 8 base stages match the C12 contract; `a11y-gate` is a
 * separate stage rather than being folded into `inject-seo` so axe-core
 * failures get a distinct, scriptable error path.
 */
export type ExportStage =
  | 'validate'
  | 'generate'
  | 'inject-seo'
  | 'a11y-gate'
  | 'optimize-images'
  | 'minify'
  | 'sitemap-robots'
  | 'bundle'
  | 'save'

/** Order in which the pipeline runs the stages. */
const STAGE_ORDER: ReadonlyArray<ExportStage> = [
  'validate',
  'generate',
  'inject-seo',
  'a11y-gate',
  'optimize-images',
  'minify',
  'sitemap-robots',
  'bundle',
  'save',
]

/** Options accepted by `exportProject`. */
export interface ExportOptions {
  /** Optional name for the produced zip (no extension). Falls back to "project". */
  projectName?: string
  /**
   * Whether to minify HTML/CSS/JS in the output bundle. The minifier
   * dependencies (`lightningcss`, `html-minifier-terser`, `terser`) land
   * with I-EXP-03; until then the option is accepted but ignored. The
   * stage still runs (as a no-op) so progress events stay consistent.
   */
  minify?: boolean
  /**
   * Inline the JS snippet bundle into a `<script>` block instead of
   * shipping it as a separate `scripts.js` file. Accepted but not yet
   * implemented (I-EXP-03).
   */
  inlineJS?: boolean
  /**
   * Self-host fonts referenced via Google Fonts CDN. Accepted but not
   * yet implemented (I-EXP-05).
   */
  selfHostFonts?: boolean
  /** Include source comments in the output bundle (debug aid). Default false. */
  includeSourceComments?: boolean
  /** Default theme attribute on the root element (`auto` = OS preference). */
  theme?: 'auto' | 'light' | 'dark'
  /**
   * Progress callback invoked once per stage just before it runs. `stage`
   * names the upcoming work; `index` / `total` make a percentage easy.
   */
  onProgress?: (event: { stage: ExportStage; index: number; total: number }) => void
}

/** Discriminated result returned from `exportProject`. */
export type ExportProjectResult =
  | { success: true; filePath: string; report: FullExportReport }
  | { success: false; stage: ExportStage; error: string; report?: FullExportReport }

const DEFAULT_PROJECT_NAME = 'project'

function sanitizeFilename(name: string): string {
  // Allowlist: alnum, dash, underscore. Path separators, dots, and shell metas are dropped.
  const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return cleaned.length > 0 ? cleaned : DEFAULT_PROJECT_NAME
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Derive the legacy `SEOConfig` shape `injectSEO` still consumes from
 * `document.seo`. The full I-SEO-01..05 rewrite is owed alongside this
 * pipeline — until then the export keeps the v0.1.0 head injector wired
 * by feeding it the equivalent fields from the document.
 */
function legacySeoFromDocument(doc: Document): LegacySEOConfig {
  return {
    title: doc.seo.title,
    description: doc.seo.description,
    ogImage: doc.seo.openGraph?.imageUrl,
    canonicalUrl: doc.seo.canonical,
    lang: doc.seo.lang,
  }
}

function emitProgress(opts: ExportOptions, stage: ExportStage): void {
  opts.onProgress?.({ stage, index: STAGE_ORDER.indexOf(stage), total: STAGE_ORDER.length })
}

/**
 * Orchestrate the 8-stage export pipeline for a `Document`. Each stage
 * is wrapped so the UI can pinpoint failure; the axe gate still produces
 * its report on failure so the renderer can surface the violation list.
 *
 * @param doc - The document to export. Should already be a valid
 *   Document (file load runs Zod), but `validateDocument` still gates on
 *   logical errors (single-h1, missing alt, broken token refs, dup ids).
 * @param options - Optional pipeline tuning + progress callback.
 */
export async function exportProject(
  doc: Document,
  options: ExportOptions = {}
): Promise<ExportProjectResult> {
  // 1. validate ──────────────────────────────────────────────────────
  emitProgress(options, 'validate')
  const validationReport = validateDocument(doc)
  if (validationReport.errors.length > 0) {
    return {
      success: false,
      stage: 'validate',
      error: `Document has ${validationReport.errors.length} validation error(s): ${validationReport.errors.map((e) => e.message).join('; ')}`,
    }
  }

  // 2. generate ──────────────────────────────────────────────────────
  emitProgress(options, 'generate')
  let generated
  try {
    generated = await generate(doc)
  } catch (err) {
    return { success: false, stage: 'generate', error: toMessage(err) }
  }

  // 3. inject-seo ────────────────────────────────────────────────────
  emitProgress(options, 'inject-seo')
  let enrichedHtml: string
  const legacySeo = legacySeoFromDocument(doc)
  try {
    enrichedHtml = injectSEO(generated.html, legacySeo)
  } catch (err) {
    return { success: false, stage: 'inject-seo', error: toMessage(err) }
  }

  // 4. a11y-gate ────────────────────────────────────────────────────
  // axe-core (I-EXP-02) runs on the SEO-enriched HTML so landmark-role
  // injection counts toward the report. Runs as its own stage so the
  // failure path is grep-able.
  emitProgress(options, 'a11y-gate')
  let report: FullExportReport
  try {
    report = await generateFullReport(enrichedHtml, legacySeo)
  } catch (err) {
    return { success: false, stage: 'a11y-gate', error: toMessage(err) }
  }
  if (!report.accessibility.passed) {
    return {
      success: false,
      stage: 'a11y-gate',
      error: 'Accessibility check failed — fix critical/serious violations before exporting',
      report,
    }
  }

  // 5. optimize-images ───────────────────────────────────────────────
  // The sharp manifest (`document.assets`) is already produced upstream
  // by the image upload IPC handler (I-ELE-05). This stage rewrites
  // <img> srcset references against the manifest. Passthrough until
  // I-ELE-05 lands; the asset map keys/values are wired so the stage
  // becomes a substitution when sharp output is available.
  emitProgress(options, 'optimize-images')
  // (no-op for now — generator already emits `src="assets/<id>.webp"`)

  // 6. minify ────────────────────────────────────────────────────────
  // lightningcss + html-minifier-terser + terser are dev deps that have
  // not been installed yet (I-EXP-03 territory). The stage is present
  // so the public progress contract is stable.
  emitProgress(options, 'minify')
  let finalHtml = enrichedHtml
  let finalCss = generated.css
  let finalJs = generated.js
  if (options.minify === true) {
    // TODO(I-EXP-03): wire lightningcss + html-minifier-terser + terser.
    // For now the option is a no-op so callers can light it up later
    // without changing their call sites.
    finalHtml = enrichedHtml
    finalCss = generated.css
    finalJs = generated.js
  }

  // 7. sitemap-robots ────────────────────────────────────────────────
  emitProgress(options, 'sitemap-robots')
  let sitemapXml: string
  let robotsTxt: string
  try {
    sitemapXml = emitSitemap(doc)
    robotsTxt = emitRobots(doc)
  } catch (err) {
    return { success: false, stage: 'sitemap-robots', error: toMessage(err), report }
  }

  // 8. bundle ────────────────────────────────────────────────────────
  emitProgress(options, 'bundle')
  let buffer: ArrayBuffer
  try {
    const zip = new JSZip()
    zip.file('index.html', finalHtml)
    zip.file('styles.css', finalCss)
    if (finalJs.length > 0) zip.file('scripts.js', finalJs)
    zip.file('sitemap.xml', sitemapXml)
    zip.file('robots.txt', robotsTxt)
    buffer = await zip.generateAsync({ type: 'arraybuffer' })
  } catch (err) {
    return { success: false, stage: 'bundle', error: toMessage(err), report }
  }

  // 9. save ──────────────────────────────────────────────────────────
  emitProgress(options, 'save')
  const filename = `${sanitizeFilename(options.projectName ?? doc.meta.name ?? DEFAULT_PROJECT_NAME)}.zip`
  const ipcResult: Awaited<ReturnType<typeof window.electronAPI.exportZip>> =
    await window.electronAPI.exportZip(buffer, filename)

  if (!ipcResult.success) {
    return {
      success: false,
      stage: 'save',
      error: ipcResult.error ?? 'Save was canceled',
      report,
    }
  }

  return { success: true, filePath: ipcResult.filePath ?? '', report }
}

/**
 * Legacy renderer-facing shim. The canvas still drives off
 * `useElementStore`; until it migrates to `useDocumentStore`, this
 * function converts the v0.1.0 element list + SEO config through
 * `canvasElementsToDocument` and delegates to `exportProject(doc, opts)`.
 *
 * Delete once the canvas migration lands.
 */
export async function legacyExportProject(
  elements: CanvasElement[],
  seoConfig: LegacySEOConfig,
  options: ExportOptions = {}
): Promise<ExportProjectResult> {
  let doc: Document
  try {
    doc = canvasElementsToDocument(elements, seoConfig)
  } catch (err) {
    return { success: false, stage: 'validate', error: toMessage(err) }
  }
  const projectName = options.projectName ?? seoConfig.title
  return exportProject(doc, { ...options, projectName })
}

/**
 * Live-preview helper. Runs only the renderer-pure stages (no IPC, no
 * axe gate) so the preview iframe can refresh on every store change
 * without paying the ZIP + dialog cost. Returns `null` if the generator
 * throws — the preview panel shows nothing rather than a stale render.
 *
 * Takes the legacy element list so the existing renderer keeps working.
 * The adapter promotes it to a Document, then the generator emits HTML
 * + CSS strings.
 */
export async function buildPreview(
  elements: CanvasElement[]
): Promise<{ html: string; css: string } | null> {
  try {
    const placeholderSeo: LegacySEOConfig = { title: 'Preview', description: '' }
    const doc = canvasElementsToDocument(elements, placeholderSeo)
    const { html, css } = await generate(doc)
    return { html, css }
  } catch {
    return null
  }
}

export type { ExportResult }
