/**
 * Generator orchestrator (C6 / I-GEN-01..16).
 *
 * `generate(doc)` walks `document.tree` and returns
 * `{ html, css, js }` — three deterministic strings, formatted with
 * `prettier` so they read like a human wrote them (I-GEN-16). Minification
 * is the export pipeline's job, never the generator's.
 *
 * The HTML envelope holds the minimum a browser needs to render the body:
 *
 *   - `<html lang>` driven by `document.seo.lang`.
 *   - `<meta charset>` and `<meta name="viewport">` driven by `document.seo`.
 *   - `<link rel="stylesheet" href="styles.css">` always.
 *   - `<script>scripts.js</script>` only when the JS emitter produced any
 *     runtime code (I-GEN-15 DoD: no `<script>` when all flags off).
 *   - The body content emitted by `emitHtml`.
 *
 * The full SEO surface (`<title>`, description, Open Graph, Twitter,
 * JSON-LD, theme-color, canonical, preconnect, favicon, ARIA landmark
 * roles) is layered on by the export pipeline via the I-SEO modules, not
 * by the generator. Keeping the generator narrow lets the pipeline
 * compose SEO without duplicate tags; it also keeps `generate()` pure of
 * cross-module concerns.
 *
 * Same document in → byte-identical output out. No timestamps, no random
 * ids, no `Date.now()` — guarded by `tests/generator/determinism.test.ts`.
 */

import { format as prettierFormat } from 'prettier'
import type { Document } from '../document/types'
import { emitHtml } from './htmlEmitter'
import { emitCss } from './cssEmitter'
import { emitJs } from './jsEmitter'

/** Output strings produced by `generate`. */
export interface GeneratedOutput {
  readonly html: string
  readonly css: string
  /** Empty string when no runtime flag is enabled (I-GEN-15 DoD). */
  readonly js: string
}

const PRETTIER_OPTIONS = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  trailingComma: 'es5' as const,
}

/** Escapes characters unsafe in HTML attribute values. */
function escapeAttr(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function composeHtml(doc: Document, body: string, hasJs: boolean): string {
  const lang = escapeAttr(doc.seo.lang)
  const charset = escapeAttr(doc.seo.charset)
  const viewport = escapeAttr(doc.seo.viewport)

  const headLines = [
    `    <meta charset="${charset}" />`,
    `    <meta name="viewport" content="${viewport}" />`,
    `    <link rel="stylesheet" href="styles.css" />`,
  ]
  if (hasJs) {
    headLines.push(`    <script src="scripts.js" defer></script>`)
  }

  const indentedBody = body
    .split('\n')
    .map((line) => (line.length === 0 ? line : `    ${line}`))
    .join('\n')

  return [
    `<!doctype html>`,
    `<html lang="${lang}">`,
    `  <head>`,
    ...headLines,
    `  </head>`,
    `  <body>`,
    indentedBody,
    `  </body>`,
    `</html>`,
    ``,
  ].join('\n')
}

async function formatHtml(src: string): Promise<string> {
  return prettierFormat(src, { ...PRETTIER_OPTIONS, parser: 'html' })
}

async function formatCss(src: string): Promise<string> {
  return prettierFormat(src, { ...PRETTIER_OPTIONS, parser: 'css' })
}

async function formatJs(src: string): Promise<string> {
  if (src.length === 0) return ''
  return prettierFormat(src, { ...PRETTIER_OPTIONS, parser: 'babel' })
}

/**
 * Walk `document.tree` and emit `{ html, css, js }`. Output is
 * `prettier`-formatted before returning so live preview and the export
 * pipeline both see the same human-readable shape.
 *
 * Returns a `Promise` because Prettier 3 is async — the synchronous v0.1.0
 * signature has been retired (contract C6 version bumped).
 *
 * @param doc - The document to render. Must already be valid per
 *   `validateDocument` (callers should gate on validation if they care
 *   about a11y or schema errors).
 */
export async function generate(doc: Document): Promise<GeneratedOutput> {
  const body = emitHtml(doc)
  const css = emitCss(doc)
  const js = emitJs(doc)
  const rawHtml = composeHtml(doc, body, js.length > 0)

  const [formattedHtml, formattedCss, formattedJs] = await Promise.all([
    formatHtml(rawHtml),
    formatCss(css),
    formatJs(js),
  ])

  return { html: formattedHtml, css: formattedCss, js: formattedJs }
}
