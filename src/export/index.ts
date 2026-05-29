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
import { minifyHtml, minifyCss, minifyJs } from './minify'
import { selfHostFonts } from './selfHostFonts'
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
   * Skip the bundle + save stages and return the formatted HTML / CSS /
   * JS strings as a `DryRunResult`. Powers the Code Preview panel
   * (L-DLG-07). Budget <500 ms on the portfolio template — the a11y
   * gate is skipped because the preview should show what the author
   * currently has, not block on violations.
   */
  dryRun?: boolean
  /**
   * Whether to minify HTML/CSS/JS in the output bundle. Powered by
   * `html-minifier-terser`, `lightningcss`, and `terser` respectively
   * (see `./minify.ts`). When `false` (the default) the stage emits a
   * progress event and returns the prettier-formatted bytes unchanged
   * so the public progress contract stays stable.
   */
  minify?: boolean
  /**
   * Inline the JS snippet bundle into a `<script>` block instead of
   * shipping it as a separate `scripts.js` file. Saves one HTTP request
   * for single-page exports. When `true`, the generator's external
   * `<script src="scripts.js" defer>` tag is swapped for an inline
   * `<script>` carrying the (optionally minified) bytes, and no
   * `scripts.js` entry lands in the ZIP.
   */
  inlineJS?: boolean
  /**
   * Self-host fonts referenced via Google Fonts CDN. When `true`,
   * `selfHostFonts` (I-EXP-05) runs after `inject-seo`: every
   * `https://fonts.googleapis.com/css2?…` reference is fetched, the
   * woff2 files it points at are written to `fonts/` inside the bundle,
   * and the `<link>` tag is replaced with an inline `<style>` carrying
   * the rewritten @font-face rules. No-op when no Google Fonts URLs are
   * present in the rendered HTML or CSS.
   */
  selfHostFonts?: boolean
  /**
   * Network adapter used by the self-host stage. Defaults to the global
   * `fetch`. Tests inject a stub returning canned responses so the
   * pipeline can run offline.
   */
  fetchFonts?: typeof fetch
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

/**
 * Result returned by the dry-run path (I-EXP-04). Carries the bytes the
 * bundle would have packaged, plus the validation report so the preview
 * can surface findings without blocking the render.
 */
export interface DryRunResult {
  readonly html: string
  readonly css: string
  readonly js: string
  readonly validation: ReturnType<typeof validateDocument>
}

const DEFAULT_PROJECT_NAME = 'project'

/**
 * Returns every export-relative asset path referenced by the document's
 * sharp manifest, deduped and sorted for deterministic ZIP output. The
 * generator already emits `<img src|srcset>` against these same paths
 * (I-GEN-12), so packaging them under their stated names is enough —
 * no HTML rewriting required.
 */
function collectAssetPaths(doc: Document): string[] {
  const paths = new Set<string>()
  for (const entry of Object.values(doc.assets)) {
    for (const path of Object.values(entry.srcset)) {
      paths.add(path)
    }
  }
  return Array.from(paths).sort()
}

/**
 * Renderer path delegates to main via `electronAPI.readImageAssets`;
 * Node path (tests, main process) returns an empty map. This shape
 * matches the IPC contract: `Record<path, ArrayBuffer | null>` where
 * `null` flags a missing-on-disk variant.
 */
async function readImageAssets(
  paths: readonly string[]
): Promise<Record<string, ArrayBuffer | null>> {
  if (typeof window !== 'undefined' && window.electronAPI?.readImageAssets) {
    return window.electronAPI.readImageAssets(paths)
  }
  // No-IPC environment — tests can stub `window.electronAPI`, anyone
  // else gets an empty map (bundle stage will skip the missing files).
  return {}
}

/**
 * Tolerant regex matching the `<script src="scripts.js" …></script>` tag
 * emitted by the generator (`src/generator/index.ts`). Allows both
 * attribute orders, optional quoting, and post-minify whitespace
 * collapse. We anchor on `scripts.js` rather than the full tag to stay
 * robust if the minifier reorders `defer` / `src`.
 */
const SCRIPTS_JS_TAG_RE = /<script\b[^>]*\bsrc\s*=\s*["']?scripts\.js["']?[^>]*>\s*<\/script>/i

function inlineScriptsJsTag(html: string, js: string): string {
  // Escape `</script>` sequences inside the JS payload so they don't
  // terminate the wrapping tag (XSS-equivalent in a single-page bundle).
  const safe = js.replace(/<\/script/gi, '<\\/script')
  return html.replace(SCRIPTS_JS_TAG_RE, `<script>${safe}</script>`)
}

/**
 * Matches the generator's `<html lang="...">` open tag (post-prettier the
 * `lang` attr always quotes its value with double quotes). Anchored so
 * a stray `<html` inside a string literal in the body can't be hit.
 */
const HTML_OPEN_TAG_RE = /<html(\s[^>]*)?>/i

/**
 * Stamps a `data-theme="light|dark"` attribute on the document's `<html>`
 * tag. `auto` is a no-op — the FOUC guard (I-RUN-01) + the
 * `prefers-color-scheme` media query (I-GEN-06) jointly decide the
 * effective theme. If the tag already carries a `data-theme` (e.g.
 * author-injected), it's left alone.
 */
function stampThemeAttr(html: string, theme: 'auto' | 'light' | 'dark'): string {
  if (theme === 'auto') return html
  return html.replace(HTML_OPEN_TAG_RE, (match, attrs: string | undefined) => {
    const existing = attrs ?? ''
    if (/\bdata-theme\s*=/.test(existing)) return match
    return `<html${existing} data-theme="${theme}">`
  })
}

/**
 * Banner comment prepended to each output file when
 * `options.includeSourceComments === true`. Single line so it survives
 * a downstream `head -1` and stays out of the way of `view-source:`.
 */
function bannerLine(): string {
  return `Generated by Draw-to-Web — do not edit; regenerate from the source document`
}

function prependBanner(
  html: string,
  css: string,
  js: string
): { html: string; css: string; js: string } {
  const line = bannerLine()
  // HTML banner is placed after the doctype so the doctype stays on
  // line 1 (required by the parser). The regex tolerates post-minify
  // whitespace collapse around the doctype.
  const htmlOut = html.replace(/(<!doctype[^>]*>)/i, `$1\n<!-- ${line} -->`)
  const cssOut = `/* ${line} */\n${css}`
  const jsOut = js.length > 0 ? `/* ${line} */\n${js}` : js
  return { html: htmlOut, css: cssOut, js: jsOut }
}

function sanitizeFilename(name: string): string {
  // Allowlist: alnum, dash, underscore. Path separators, dots, and shell metas are dropped.
  const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return cleaned.length > 0 ? cleaned : DEFAULT_PROJECT_NAME
}

function toMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
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
 * @param options - Optional pipeline tuning + progress callback. When
 *   `options.dryRun === true`, the bundle + save stages are skipped and
 *   the function returns a `DryRunResult` carrying the formatted HTML
 *   / CSS / JS strings (I-EXP-04).
 */
export async function exportProject(
  doc: Document,
  options: ExportOptions & { dryRun: true }
): Promise<DryRunResult>
export async function exportProject(
  doc: Document,
  options?: ExportOptions
): Promise<ExportProjectResult>
export async function exportProject(
  doc: Document,
  options: ExportOptions = {}
): Promise<ExportProjectResult | DryRunResult> {
  // 1. validate ──────────────────────────────────────────────────────
  emitProgress(options, 'validate')
  const validationReport = validateDocument(doc)
  if (validationReport.errors.length > 0 && options.dryRun !== true) {
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
    if (options.dryRun === true) throw err
    return { success: false, stage: 'generate', error: toMessage(err) }
  }

  // 3. inject-seo ────────────────────────────────────────────────────
  emitProgress(options, 'inject-seo')
  let enrichedHtml: string
  try {
    enrichedHtml = injectSEO(generated.html, doc.seo, doc.assets)
  } catch (err) {
    if (options.dryRun === true) throw err
    return { success: false, stage: 'inject-seo', error: toMessage(err) }
  }

  // Theme attribute (I-EXP-03). Stamp `<html data-theme="...">` when
  // the author has pinned a default; `auto` defers to the FOUC guard +
  // prefers-color-scheme. Done before the a11y gate so axe sees the
  // same effective DOM the browser will.
  if (options.theme === 'light' || options.theme === 'dark') {
    enrichedHtml = stampThemeAttr(enrichedHtml, options.theme)
  }

  // 3b. self-host fonts (I-EXP-05) — folded into the inject-seo stage
  // so we don't bloat the canonical 9-stage progress order. Mutates
  // enrichedHtml + generated.css and produces a bag of `fonts/*.woff2`
  // files the bundle stage will pack alongside the document.
  let fontFiles: Record<string, ArrayBuffer> = {}
  let mutatedCss = generated.css
  if (options.selfHostFonts === true) {
    try {
      const result = await selfHostFonts(enrichedHtml, generated.css, options.fetchFonts)
      enrichedHtml = result.html
      mutatedCss = result.css
      fontFiles = { ...result.files }
    } catch (err) {
      if (options.dryRun === true) throw err
      return { success: false, stage: 'inject-seo', error: toMessage(err) }
    }
  }

  // Dry-run short-circuit (I-EXP-04). Honors minify + inlineJS if the
  // caller asked for them so the preview reflects the real bytes. Skips
  // a11y-gate, optimize-images, sitemap, bundle, save — the preview
  // panel should render what the author has, not block on violations.
  if (options.dryRun === true) {
    let html = enrichedHtml
    let css = mutatedCss
    let js = generated.js
    if (options.minify === true) {
      const [mHtml, mCss, mJs] = await Promise.all([
        minifyHtml(html),
        minifyCss(css),
        js.length > 0 ? minifyJs(js) : Promise.resolve(''),
      ])
      html = mHtml
      css = mCss
      js = mJs
    }
    if (options.inlineJS === true && js.length > 0) {
      html = inlineScriptsJsTag(html, js)
      js = ''
    }
    if (options.includeSourceComments === true) {
      const banner = prependBanner(html, css, js)
      html = banner.html
      css = banner.css
      js = banner.js
    }
    return { html, css, js, validation: validationReport }
  }

  // 4. a11y-gate ────────────────────────────────────────────────────
  // axe-core (I-EXP-02) runs on the SEO-enriched HTML so landmark-role
  // injection counts toward the report. Runs as its own stage so the
  // failure path is grep-able.
  emitProgress(options, 'a11y-gate')
  let report: FullExportReport
  try {
    report = await generateFullReport(enrichedHtml, doc.seo)
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
  // The sharp pipeline (I-ELE-05) wrote each WebP/SVG variant to
  // `<userData>/dtw-assets/`. Here we collect every export-relative
  // path the document references, batch-read the bytes via IPC, and
  // hand the map off to the bundle stage. The HTML emitter (I-GEN-12)
  // already wired `<img srcset>` against these same paths, so no
  // rewriting is needed — only packaging.
  emitProgress(options, 'optimize-images')
  const assetPaths = collectAssetPaths(doc)
  let assetBytes: Record<string, ArrayBuffer | null> = {}
  if (assetPaths.length > 0) {
    try {
      assetBytes = await readImageAssets(assetPaths)
    } catch (err) {
      return { success: false, stage: 'optimize-images', error: toMessage(err), report }
    }
  }

  // 6. minify ────────────────────────────────────────────────────────
  // Real minification (I-EXP-03) — html-minifier-terser, lightningcss,
  // terser. In the sandboxed renderer each call delegates to the main
  // process via IPC; in Node (tests, main process) it runs in-process.
  emitProgress(options, 'minify')
  let finalHtml = enrichedHtml
  let finalCss = mutatedCss
  let finalJs = generated.js
  if (options.minify === true) {
    try {
      const [mHtml, mCss, mJs] = await Promise.all([
        minifyHtml(enrichedHtml),
        minifyCss(mutatedCss),
        generated.js.length > 0 ? minifyJs(generated.js) : Promise.resolve(''),
      ])
      finalHtml = mHtml
      finalCss = mCss
      finalJs = mJs
    } catch (err) {
      return { success: false, stage: 'minify', error: toMessage(err), report }
    }
  }

  // 6b. inlineJS ─────────────────────────────────────────────────────
  // When the author opts in, swap the external `<script src="scripts.js">`
  // for an inline `<script>` carrying the same bytes. Saves one HTTP
  // round-trip for single-page exports at the cost of cacheability.
  // Tolerant of post-minify attribute reorder (`defer src=…` etc.).
  if (options.inlineJS === true && finalJs.length > 0) {
    finalHtml = inlineScriptsJsTag(finalHtml, finalJs)
    finalJs = ''
  }

  // 6c. source comment banner (I-EXP-03). Applied after minify so the
  // banner survives — html-minifier-terser / lightningcss strip
  // comments by default. Single line per file, debug aid only.
  if (options.includeSourceComments === true) {
    const banner = prependBanner(finalHtml, finalCss, finalJs)
    finalHtml = banner.html
    finalCss = banner.css
    finalJs = banner.js
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
    for (const path of assetPaths) {
      const bytes = assetBytes[path]
      if (bytes) zip.file(path, bytes)
    }
    for (const [path, bytes] of Object.entries(fontFiles)) {
      zip.file(path, bytes)
    }
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
