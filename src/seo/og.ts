/**
 * Open Graph + Twitter Card emitter (I-SEO-02).
 *
 * Produces the social-preview `<meta>` tags from `document.seo`. Open Graph
 * fields fall back to the page title/description when the author leaves the
 * `openGraph` block partially filled; Twitter tags are emitted only when a
 * `twitter` card is configured, mirroring the OG title/description/image so
 * the card renders without duplicate author input.
 */

import type { SEOConfig } from '../document/types'
import { escapeHtml } from './escape'

/**
 * Builds the Open Graph + Twitter Card `<meta>` lines from `document.seo`.
 * Returns indented lines in document order; empty when neither `openGraph`
 * nor `twitter` is configured and no image is available.
 *
 * @param seo - The document's SEO configuration (`document.seo`).
 */
export function buildSocialTags(seo: SEOConfig): string[] {
  const og = seo.openGraph
  const twitter = seo.twitter
  const lines: string[] = []

  // Open Graph. Emitted whenever an openGraph block exists; title and
  // description fall back to the page-level values.
  if (og) {
    const ogTitle = og.title ?? seo.title
    const ogDescription = og.description ?? seo.description
    lines.push(
      `    <meta property="og:title" content="${escapeHtml(ogTitle)}" />`,
      `    <meta property="og:description" content="${escapeHtml(ogDescription)}" />`,
      `    <meta property="og:type" content="${escapeHtml(og.type ?? 'website')}" />`
    )
    if (og.url) lines.push(`    <meta property="og:url" content="${escapeHtml(og.url)}" />`)
    if (og.imageUrl) {
      lines.push(`    <meta property="og:image" content="${escapeHtml(og.imageUrl)}" />`)
    }
    if (og.siteName) {
      lines.push(`    <meta property="og:site_name" content="${escapeHtml(og.siteName)}" />`)
    }
  }

  // Twitter Card. Mirrors OG so the card has title/description/image without
  // a second set of author inputs.
  if (twitter) {
    lines.push(`    <meta name="twitter:card" content="${escapeHtml(twitter.card)}" />`)
    if (twitter.site) {
      lines.push(`    <meta name="twitter:site" content="${escapeHtml(twitter.site)}" />`)
    }
    if (twitter.creator) {
      lines.push(`    <meta name="twitter:creator" content="${escapeHtml(twitter.creator)}" />`)
    }
    lines.push(
      `    <meta name="twitter:title" content="${escapeHtml(og?.title ?? seo.title)}" />`,
      `    <meta name="twitter:description" content="${escapeHtml(og?.description ?? seo.description)}" />`
    )
    if (og?.imageUrl) {
      lines.push(`    <meta name="twitter:image" content="${escapeHtml(og.imageUrl)}" />`)
    }
  }

  return lines
}
