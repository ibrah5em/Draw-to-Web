/**
 * SEO injection + reporting (I-SEO-01..05).
 *
 * `injectSEO` post-processes the generator's HTML — the `inject-seo` stage of
 * the export pipeline (C12) — adding everything the generator does not emit
 * itself: head metadata (`head.ts`), Open Graph + Twitter (`og.ts`), JSON-LD
 * (`jsonld.ts`), and ARIA landmark roles. All of it is driven by
 * `document.seo`; the legacy v0.1.0 `SEOConfig` shape is no longer used.
 *
 * The generator already owns `<html lang>`, `<meta charset>`, the CSP meta,
 * the FOUC guard, viewport, and the stylesheet/script links, so this module
 * never touches them.
 */

import type { SEOConfig, AssetId, AssetManifestEntry } from '../document/types'
import type { AccessibilityReport, FullExportReport, SEOReport } from '../shared/types'
import { buildHeadTags } from './head'
import { buildSocialTags } from './og'
import { buildJsonLd } from './jsonld'
import { formatViolation, runAxeGate } from './axeGate'

export type { SEOConfig }
export { buildHeadTags } from './head'
export { buildSocialTags } from './og'
export { buildJsonLd } from './jsonld'
export { runAxeGate } from './axeGate'

/** ARIA landmark roles for HTML5 sectioning elements. */
const LANDMARK_ROLES: Readonly<Record<string, string>> = {
  header: 'banner',
  nav: 'navigation',
  main: 'main',
  footer: 'contentinfo',
}

/**
 * Adds ARIA landmark role attributes to semantic container elements.
 * Skips elements that already carry a role attribute.
 */
function addAriaRoles(html: string): string {
  let result = html
  for (const [tag, role] of Object.entries(LANDMARK_ROLES)) {
    // \b ensures we don't match tag names that start with these strings (e.g. <navigation>)
    result = result.replace(new RegExp(`<${tag}\\b([^>]*)>`, 'g'), (match, attrs: string) => {
      if (match.includes('role=')) return match
      return `<${tag}${attrs} role="${role}">`
    })
  }
  return result
}

/**
 * Post-processes generated HTML with the full SEO surface: head metadata,
 * Open Graph + Twitter Card, JSON-LD structured data, and ARIA landmark
 * roles. Tags are spliced in immediately before `</head>` so the
 * generator-emitted charset / CSP / viewport metas keep their position.
 *
 * @param html - Raw HTML from the code generator.
 * @param seo - The document's SEO configuration (`document.seo`).
 * @param assets - Optional asset manifest, used only to resolve a PNG favicon.
 */
export function injectSEO(
  html: string,
  seo: SEOConfig,
  assets?: Readonly<Record<AssetId, AssetManifestEntry>>
): string {
  const headLines = [...buildHeadTags(seo, assets), ...buildSocialTags(seo)]
  const jsonLd = buildJsonLd(seo)
  if (jsonLd) headLines.push(jsonLd)

  const withHead = html.replace('</head>', `${headLines.join('\n')}\n  </head>`)
  return addAriaRoles(withHead)
}

/**
 * Analyses an enriched HTML document and returns an SEO/a11y summary report.
 * The report is informational; blocking violations are handled by the axe-core gate.
 *
 * @param html - HTML after `injectSEO` has run.
 * @param seo - The `document.seo` used to produce this HTML.
 */
export function generateSEOReport(html: string, seo: SEOConfig): SEOReport {
  const h1Count = (html.match(/<h1\b/g) ?? []).length
  // Images with alt="" are decorative — flag them as potentially needing review
  const imgTags = html.match(/<img\b[^>]*/g) ?? []
  const imagesMissingAlt = imgTags.filter((tag) => /\balt=""/.test(tag)).length

  return {
    titleLength: seo.title.length,
    descriptionLength: seo.description.length,
    hasOgImage: !!seo.openGraph?.imageUrl,
    hasCanonical: !!seo.canonical,
    h1Count,
    imagesMissingAlt,
  }
}

/** Soft thresholds matched against the SEO config dialog warnings. */
const TITLE_MAX = 60
const DESC_MAX = 160

/**
 * Builds the user-facing guidance list shown in the pre-export report.
 * SEO items are informational ("⚠"); accessibility items are blocking ("✗")
 * when their impact is critical or serious.
 */
function buildGuidance(seo: SEOReport, a11y: AccessibilityReport): string[] {
  const lines: string[] = []

  if (seo.titleLength === 0) lines.push('⚠ Page title is empty')
  else if (seo.titleLength > TITLE_MAX)
    lines.push(`⚠ Title is ${seo.titleLength} chars — may be truncated above ${TITLE_MAX}`)

  if (seo.descriptionLength === 0) lines.push('⚠ Meta description is empty')
  else if (seo.descriptionLength > DESC_MAX)
    lines.push(
      `⚠ Description is ${seo.descriptionLength} chars — may be truncated above ${DESC_MAX}`
    )

  if (!seo.hasOgImage) lines.push('⚠ No Open Graph image — social-card previews will be plain')
  if (!seo.hasCanonical)
    lines.push('⚠ No canonical URL — set one if this page is reachable via multiple URLs')

  if (seo.h1Count === 0) lines.push('⚠ No <h1> on page — add a top-level heading')
  else if (seo.h1Count > 1) lines.push(`⚠ ${seo.h1Count} <h1> elements — keep exactly one per page`)

  if (seo.imagesMissingAlt > 0)
    lines.push(
      `⚠ ${seo.imagesMissingAlt} image(s) have empty alt — confirm they are decorative or add alt text`
    )

  for (const v of a11y.violations) {
    const marker = v.impact === 'critical' || v.impact === 'serious' ? '✗' : '⚠'
    lines.push(`${marker} ${formatViolation(v)}`)
  }

  return lines
}

/**
 * Produces the combined pre-export report: SEO summary + axe-core a11y result
 * + actionable guidance. The export pipeline blocks if `accessibility.passed`
 * is false. SEO findings are informational only.
 *
 * @param html - HTML *after* `injectSEO` has run (so meta tags and ARIA roles are present).
 * @param seo - The `document.seo` used to produce this HTML.
 */
export async function generateFullReport(html: string, seo: SEOConfig): Promise<FullExportReport> {
  const seoReport = generateSEOReport(html, seo)
  const accessibility = await runAxeGate(html)
  const guidance = buildGuidance(seoReport, accessibility)
  return { seo: seoReport, accessibility, guidance }
}
