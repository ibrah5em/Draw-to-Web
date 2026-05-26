/**
 * JSON-LD structured-data emitter (I-SEO-03).
 *
 * Maps the editor-facing `JsonLdConfig` union (`Person` / `Organization` /
 * `WebSite`) onto a Schema.org object and serialises it with `JSON.stringify`
 * — never string concatenation — inside a `<script type="application/ld+json">`
 * block. The serialised payload has `<` escaped to `<` so a stray
 * `</script>` in author data cannot break out of the script element.
 */

import type { JsonLdConfig, SEOConfig } from '../document/types'

const SCHEMA_CONTEXT = 'https://schema.org'

/** Builds the Schema.org object for one `JsonLdConfig` variant. */
function toSchemaObject(jsonLd: JsonLdConfig): Record<string, unknown> {
  switch (jsonLd.kind) {
    case 'Person':
      return {
        '@context': SCHEMA_CONTEXT,
        '@type': 'Person',
        name: jsonLd.name,
        ...(jsonLd.url ? { url: jsonLd.url } : {}),
        ...(jsonLd.jobTitle ? { jobTitle: jsonLd.jobTitle } : {}),
        ...(jsonLd.email ? { email: jsonLd.email } : {}),
        ...(jsonLd.sameAs && jsonLd.sameAs.length > 0 ? { sameAs: jsonLd.sameAs } : {}),
      }
    case 'Organization':
      return {
        '@context': SCHEMA_CONTEXT,
        '@type': 'Organization',
        name: jsonLd.name,
        ...(jsonLd.url ? { url: jsonLd.url } : {}),
        ...(jsonLd.logoUrl ? { logo: jsonLd.logoUrl } : {}),
        ...(jsonLd.sameAs && jsonLd.sameAs.length > 0 ? { sameAs: jsonLd.sameAs } : {}),
      }
    case 'WebSite':
      return {
        '@context': SCHEMA_CONTEXT,
        '@type': 'WebSite',
        name: jsonLd.name,
        url: jsonLd.url,
        ...(jsonLd.description ? { description: jsonLd.description } : {}),
      }
  }
}

/**
 * Builds the JSON-LD `<script>` block from `document.seo`, or `null` when no
 * `jsonLd` is configured. The result is a single indented line containing the
 * script element; the JSON payload is `JSON.stringify`'d (2-space indent) and
 * `<`-escaped for safe inlining.
 *
 * @param seo - The document's SEO configuration (`document.seo`).
 */
export function buildJsonLd(seo: SEOConfig): string | null {
  if (!seo.jsonLd) return null
  const payload = JSON.stringify(toSchemaObject(seo.jsonLd), null, 2).replace(/</g, '\\u003c')
  return `    <script type="application/ld+json">\n${payload}\n    </script>`
}
