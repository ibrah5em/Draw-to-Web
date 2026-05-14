import JSZip from 'jszip'
import { inferSemantics, type SemanticElement } from '../engine'
import { generate } from '../generator'
import { generateFullReport, injectSEO } from '../seo'
import type { CanvasElement, ExportResult, FullExportReport, SEOConfig } from '../shared/types'

/** Stages of the export pipeline — surfaced on errors so the UI can pinpoint the failure. */
export type ExportStage = 'infer' | 'generate' | 'inject-seo' | 'a11y-gate' | 'bundle' | 'save'

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
 * Orchestrates the full export pipeline:
 *   1. `inferSemantics(elements)` → SemanticElement tree
 *   2. `generate(tree)` → { html, css }
 *   3. `injectSEO(html, config)` → enriched HTML
 *   4. axe-core gate via `generateFullReport` → block on critical/serious violations
 *   5. Bundle index.html + styles.css with JSZip
 *   6. Hand the ZIP buffer to the main process for the native save dialog
 *
 * Each stage is wrapped so the UI can show *which* stage failed. The a11y gate
 * still returns its report on failure so the renderer can render the violation
 * list — the export is blocked but the diagnostics are not.
 */
export async function exportProject(
  elements: CanvasElement[],
  seoConfig: SEOConfig,
  options: ExportOptions = {}
): Promise<ExportProjectResult> {
  // 1. Engine
  let semanticTree: SemanticElement[]
  try {
    semanticTree = inferSemantics(elements)
  } catch (err) {
    return { success: false, stage: 'infer', error: toMessage(err) }
  }

  // 2. Generator
  let generated
  try {
    generated = generate(semanticTree)
  } catch (err) {
    return { success: false, stage: 'generate', error: toMessage(err) }
  }

  // 3. SEO injection
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
 * Lightweight helper for the live-preview panel: runs only the renderer-pure
 * stages (no IPC, no axe gate). Returns `null` if the engine or generator
 * throws — the preview panel should show nothing rather than a stale render.
 */
export function buildPreview(elements: CanvasElement[]): { html: string; css: string } | null {
  try {
    const tree = inferSemantics(elements)
    return generate(tree)
  } catch {
    return null
  }
}

export type { ExportResult }
