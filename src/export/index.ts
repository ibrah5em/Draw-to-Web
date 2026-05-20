import JSZip from 'jszip'
import { generate } from '../generator'
import { generateFullReport, injectSEO } from '../seo'
import type { CanvasElement, ExportResult, FullExportReport, SEOConfig } from '../shared/types'
import { canvasElementsToDocument } from './legacyAdapter'

/** Stages of the export pipeline — surfaced on errors so the UI can pinpoint the failure. */
export type ExportStage = 'adapt' | 'generate' | 'inject-seo' | 'a11y-gate' | 'bundle' | 'save'

export interface ExportOptions {
  /** Optional name for the produced zip (no extension). Falls back to "project". */
  projectName?: string
}

/** Discriminated result variant returned from `exportProject`. */
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
 * Orchestrates the export pipeline. Public signature is preserved from
 * v0.1.0 — the renderer still drives canvas state through `useElementStore`
 * and hands `CanvasElement[]` + legacy `SEOConfig` in. Internally the
 * pipeline now:
 *
 *   1. `canvasElementsToDocument(elements, seoConfig)` → schema-valid `Document`
 *   2. `generate(doc)` → `{ html, css, js }` (prettier-formatted)
 *   3. `injectSEO(html, seoConfig)` → enriched HTML (existing SEO module)
 *   4. axe-core gate via `generateFullReport` — blocks on critical/serious
 *   5. Bundle `index.html` + `styles.css` (+ `scripts.js` when present) with JSZip
 *   6. Hand the ZIP buffer to the main process for the native save dialog
 *
 * The full C12 8-stage pipeline (validate → generate → SEO → image opt →
 * minify → sitemap/robots → ZIP → IPC) and the structured progress
 * events land with I-EXP-01 once the renderer migrates to `useDocumentStore`.
 */
export async function exportProject(
  elements: CanvasElement[],
  seoConfig: SEOConfig,
  options: ExportOptions = {}
): Promise<ExportProjectResult> {
  // 1. Adapter — v0.1.0 elements → v0.2.0 Document
  let doc
  try {
    doc = canvasElementsToDocument(elements, seoConfig)
  } catch (err) {
    return { success: false, stage: 'adapt', error: toMessage(err) }
  }

  // 2. Generator
  let generated
  try {
    generated = await generate(doc)
  } catch (err) {
    return { success: false, stage: 'generate', error: toMessage(err) }
  }

  // 3. SEO injection (still consumes the legacy SEOConfig shape —
  //    rewriting this against `document.seo` is PR 3 territory).
  let enrichedHtml: string
  try {
    enrichedHtml = injectSEO(generated.html, seoConfig)
  } catch (err) {
    return { success: false, stage: 'inject-seo', error: toMessage(err) }
  }

  // 4. Accessibility gate (also produces the user-facing report)
  let report: FullExportReport
  try {
    report = await generateFullReport(enrichedHtml, seoConfig)
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

  // 5. ZIP bundle
  let buffer: ArrayBuffer
  try {
    const zip = new JSZip()
    zip.file('index.html', enrichedHtml)
    zip.file('styles.css', generated.css)
    if (generated.js.length > 0) {
      zip.file('scripts.js', generated.js)
    }
    buffer = await zip.generateAsync({ type: 'arraybuffer' })
  } catch (err) {
    return { success: false, stage: 'bundle', error: toMessage(err), report }
  }

  // 6. Save via IPC
  const filename = `${sanitizeFilename(options.projectName ?? DEFAULT_PROJECT_NAME)}.zip`
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

  return {
    success: true,
    filePath: ipcResult.filePath ?? '',
    report,
  }
}

/**
 * Lightweight helper for the live-preview panel: runs the generator on
 * an adapter-built Document and returns the strings without going
 * through IPC or the axe gate. Returns `null` when the adapter or
 * generator throws — the preview panel shows nothing rather than a
 * stale render.
 */
export async function buildPreview(
  elements: CanvasElement[]
): Promise<{ html: string; css: string } | null> {
  try {
    const placeholderSeo: SEOConfig = { title: 'Preview', description: '' }
    const doc = canvasElementsToDocument(elements, placeholderSeo)
    const { html, css } = await generate(doc)
    return { html, css }
  } catch {
    return null
  }
}

export type { ExportResult }
