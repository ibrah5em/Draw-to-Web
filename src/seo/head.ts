/**
 * Head metadata emitter (I-SEO-01, I-SEO-04, I-SEO-05).
 *
 * Builds the `<head>` tags that the generator does not already emit. The
 * generator's `composeHtml` owns `<html lang>`, `<meta charset>`, the CSP
 * meta, the FOUC guard, `<meta name="viewport">`, and the stylesheet/script
 * links; everything else describing the page for crawlers and browsers is
 * produced here from `document.seo`:
 *
 *   - `<title>`, description, keywords, author (I-SEO-01)
 *   - `<meta name="theme-color">` per colour scheme (I-SEO-01)
 *   - `<link rel="canonical">` and `<meta name="robots">` (I-SEO-01)
 *   - favicon — inline SVG data URI by default, dark/light aware (I-SEO-04)
 *   - `preconnect` + `dns-prefetch` for every external origin (I-SEO-05)
 *
 * Open Graph / Twitter (`og.ts`) and JSON-LD (`jsonld.ts`) are emitted by
 * their own builders; `injectSEO` concatenates all three.
 */

import type { AssetId, AssetManifestEntry, SEOConfig } from '../document/types'
import { escapeHtml } from './escape'

/**
 * Default favicon — a rounded-square monogram that inverts its fill with
 * the OS colour scheme via an inline `prefers-color-scheme` media query, so
 * the icon stays legible on both light and dark browser chrome. Used when
 * the author has not supplied `document.seo.favicon`.
 */
const DEFAULT_FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<style>rect{fill:#0a0a10}circle{fill:#f6f5f2}' +
  '@media(prefers-color-scheme:light){rect{fill:#f6f5f2}circle{fill:#0a0a10}}</style>' +
  '<rect width="32" height="32" rx="6"/><circle cx="16" cy="16" r="7"/></svg>'

/** Wraps an SVG source string in an unescaped `image/svg+xml` data URI. */
function svgDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

/**
 * Builds the `<link rel="icon">` tag (I-SEO-04). PNG favicons resolve to the
 * smallest variant in the asset manifest; if the asset is missing — or no
 * favicon was configured — the dark/light-aware default SVG is emitted.
 */
function buildFavicon(
  seo: SEOConfig,
  assets?: Readonly<Record<AssetId, AssetManifestEntry>>
): string {
  const favicon = seo.favicon
  if (favicon?.kind === 'svg-inline') {
    return `    <link rel="icon" href="${escapeHtml(svgDataUri(favicon.svg))}" />`
  }
  if (favicon?.kind === 'png') {
    const entry = assets?.[favicon.assetId]
    const widths = entry ? Object.keys(entry.srcset).map(Number) : []
    if (entry && widths.length > 0) {
      const smallest = Math.min(...widths)
      const path = entry.srcset[smallest]
      return `    <link rel="icon" type="image/png" href="${escapeHtml(path)}" />`
    }
    // Fall through to the default when the manifest has no matching asset.
  }
  return `    <link rel="icon" href="${escapeHtml(svgDataUri(DEFAULT_FAVICON_SVG))}" />`
}

/**
 * Builds the non-social `<head>` tags from `document.seo`. Returns an array
 * of already-indented lines (4 spaces) in document order; `injectSEO` joins
 * them and splices the block in before `</head>`.
 *
 * @param seo - The document's SEO configuration (`document.seo`).
 * @param assets - Optional asset manifest, used only to resolve a PNG favicon.
 */
export function buildHeadTags(
  seo: SEOConfig,
  assets?: Readonly<Record<AssetId, AssetManifestEntry>>
): string[] {
  const lines: string[] = [
    `    <title>${escapeHtml(seo.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(seo.description)}" />`,
  ]

  if (seo.keywords && seo.keywords.length > 0) {
    lines.push(`    <meta name="keywords" content="${escapeHtml(seo.keywords.join(', '))}" />`)
  }
  if (seo.author) {
    lines.push(`    <meta name="author" content="${escapeHtml(seo.author)}" />`)
  }

  // theme-color per scheme — each present key gets its own media-scoped meta
  // so the browser chrome matches the active theme.
  if (seo.themeColor?.light) {
    lines.push(
      `    <meta name="theme-color" content="${escapeHtml(seo.themeColor.light)}" media="(prefers-color-scheme: light)" />`
    )
  }
  if (seo.themeColor?.dark) {
    lines.push(
      `    <meta name="theme-color" content="${escapeHtml(seo.themeColor.dark)}" media="(prefers-color-scheme: dark)" />`
    )
  }

  if (seo.robots) {
    lines.push(`    <meta name="robots" content="${escapeHtml(seo.robots)}" />`)
  }
  if (seo.canonical) {
    lines.push(`    <link rel="canonical" href="${escapeHtml(seo.canonical)}" />`)
  }

  // preconnect + dns-prefetch for every external origin (I-SEO-05). The
  // dns-prefetch is the fallback for browsers that ignore preconnect; font
  // CDNs (gstatic) require crossorigin on the preconnect to be used for the
  // anonymous font fetch.
  for (const origin of seo.preconnect ?? []) {
    const crossorigin = /(^|\.)gstatic\.com/.test(origin) ? ' crossorigin' : ''
    lines.push(`    <link rel="preconnect" href="${escapeHtml(origin)}"${crossorigin} />`)
    lines.push(`    <link rel="dns-prefetch" href="${escapeHtml(origin)}" />`)
  }

  lines.push(buildFavicon(seo, assets))

  return lines
}
