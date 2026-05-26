/**
 * Shared HTML-escaping helper for the SEO emitters. Generated head tags are
 * built from author-supplied `document.seo` strings, so every interpolated
 * value passes through here to neutralise `<`, `>`, `&`, and `"` before it
 * reaches the document.
 */

/**
 * Escapes characters unsafe in HTML attribute values and text nodes.
 *
 * @param raw - Untrusted string drawn from `document.seo`.
 * @returns The string with `&`, `<`, `>`, and `"` replaced by entities.
 */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
