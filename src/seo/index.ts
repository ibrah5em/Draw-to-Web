import type { AccessibilityReport, FullExportReport, SEOConfig, SEOReport } from '../shared/types'
import { formatViolation, runAxeGate } from './axeGate'

export type { SEOConfig }
export { runAxeGate } from './axeGate'

/** Escapes characters unsafe in HTML attribute values and text nodes. */
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** ARIA landmark roles for HTML5 sectioning elements. */
const LANDMARK_ROLES: Readonly<Record<string, string>> = {
  header: 'banner',
  nav: 'navigation',
  main: 'main',
  footer: 'contentinfo',
}

/**
 * Updates (or adds) the lang attribute on the <html> element.
 * The generator always emits lang="en", so this handles overrides.
 */
function updateLang(html: string, lang: string): string {
  if (html.includes(' lang="')) {
    return html.replace(/(<html\b[^>]*)\slang="[^"]*"/, `$1 lang="${lang}"`)
  }
  return html.replace(/(<html\b)/, `$1 lang="${lang}"`)
}

/**
 * Injects SEO meta tags, OG tags, and optional canonical link into <head>.
 * Inserts immediately before </head> to avoid displacing charset/viewport metas.
 */
function injectHeadTags(html: string, config: SEOConfig): string {
  const lines = [
    `    <title>${escapeHtml(config.title)}</title>`,
    `    <meta name="description" content="${escapeHtml(config.description)}" />`,
    `    <meta property="og:title" content="${escapeHtml(config.title)}" />`,
    `    <meta property="og:description" content="${escapeHtml(config.description)}" />`,
  ]

  if (config.ogImage) {
    lines.push(`    <meta property="og:image" content="${escapeHtml(config.ogImage)}" />`)
  }
  if (config.canonicalUrl) {
    lines.push(`    <link rel="canonical" href="${escapeHtml(config.canonicalUrl)}" />`)
  }

  return html.replace('</head>', `${lines.join('\n')}\n  </head>`)
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
 * Post-processes generated HTML with SEO meta tags, OG tags, ARIA landmark
 * roles, and a configurable lang attribute.
 * @param html - Raw HTML from the code generator
 * @param config - SEO metadata provided by the user
 */
export function injectSEO(html: string, config: SEOConfig): string {
  let result = html
  result = updateLang(result, config.lang ?? 'en')
  result = injectHeadTags(result, config)
  result = addAriaRoles(result)
  return result
}

/**
 * Analyses an enriched HTML document and returns an SEO/a11y summary report.
 * The report is informational; blocking violations are handled by the axe-core gate.
 * @param html - HTML after injectSEO has run
 * @param config - The SEO config used to produce this HTML
 */
export function generateSEOReport(html: string, config: SEOConfig): SEOReport {
  const h1Count = (html.match(/<h1\b/g) ?? []).length
  // Images with alt="" are decorative — flag them as potentially needing review
  const imgTags = html.match(/<img\b[^>]*/g) ?? []
  const imagesMissingAlt = imgTags.filter((tag) => /\balt=""/.test(tag)).length

  return {
    titleLength: config.title.length,
    descriptionLength: config.description.length,
    hasOgImage: !!config.ogImage,
    hasCanonical: !!config.canonicalUrl,
    h1Count,
    imagesMissingAlt,
  }
}

/** Soft thresholds matched against SEOConfigDialog warnings. */
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
 * @param html - HTML *after* injectSEO has run (so meta tags and ARIA roles are present).
 * @param config - The SEOConfig used to produce this HTML.
 */
export async function generateFullReport(
  html: string,
  config: SEOConfig
): Promise<FullExportReport> {
  const seo = generateSEOReport(html, config)
  const accessibility = await runAxeGate(html)
  const guidance = buildGuidance(seo, accessibility)
  return { seo, accessibility, guidance }
}
