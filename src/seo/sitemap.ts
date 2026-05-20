/**
 * `sitemap.xml` emitter (I-SEO-06).
 *
 * The v0.2.0 output is a single-page bundle, so the sitemap carries
 * exactly one `<url>` entry pointing at `document.seo.canonical` (or, if
 * unset, an empty `<urlset>` so the file structure is still emitted and
 * authors can populate it later).
 *
 * The structure is the standard sitemap protocol — multi-page support
 * drops in by accumulating `<url>` entries without changing the wrapper.
 */

import type { Document } from '../document/types'

function escapeXml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Build the `sitemap.xml` payload. Returns an XML string with a trailing
 * newline. Always produces a valid document, even with no canonical URL.
 *
 * @param doc - The document to emit a sitemap for.
 */
export function emitSitemap(doc: Document): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ]
  if (doc.seo.canonical && doc.seo.canonical.length > 0) {
    const lastmod = doc.meta.updatedAt.slice(0, 10)
    lines.push(
      `  <url>`,
      `    <loc>${escapeXml(doc.seo.canonical)}</loc>`,
      `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
      `  </url>`
    )
  }
  lines.push('</urlset>', '')
  return lines.join('\n')
}
