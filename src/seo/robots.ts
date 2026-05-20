/**
 * `robots.txt` emitter (I-SEO-07).
 *
 * Emits a permissive default (allow everything) unless `document.seo.robots`
 * is set to a directive starting with `noindex`, in which case crawling is
 * disallowed. When a canonical URL is present we add a `Sitemap:` line so
 * crawlers can find the sitemap.
 */

import type { Document } from '../document/types'

/**
 * Build the `robots.txt` payload. Returns a UTF-8 string with a trailing
 * newline. Always produces a valid file — never empty.
 *
 * @param doc - The document to emit robots directives for.
 */
export function emitRobots(doc: Document): string {
  const lines: string[] = ['User-agent: *']
  const directive = doc.seo.robots ?? 'index, follow'
  if (directive.toLowerCase().startsWith('noindex')) {
    lines.push('Disallow: /')
  } else {
    lines.push('Allow: /')
  }
  if (doc.seo.canonical && doc.seo.canonical.length > 0) {
    // Derive the sitemap URL from the canonical origin when possible —
    // falls back to appending `/sitemap.xml` to the canonical itself.
    const sitemapUrl = sitemapUrlFor(doc.seo.canonical)
    lines.push(`Sitemap: ${sitemapUrl}`)
  }
  return lines.join('\n') + '\n'
}

function sitemapUrlFor(canonical: string): string {
  try {
    const url = new URL(canonical)
    return `${url.origin}/sitemap.xml`
  } catch {
    const trimmed = canonical.replace(/\/+$/, '')
    return `${trimmed}/sitemap.xml`
  }
}
