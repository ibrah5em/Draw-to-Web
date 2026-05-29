/**
 * Self-host Google Fonts (I-EXP-05).
 *
 * Detects every `https://fonts.googleapis.com/css2?...` URL referenced
 * by the rendered HTML and CSS, fetches the corresponding @font-face
 * CSS, fetches each `https://fonts.gstatic.com/.../*.woff2` file the
 * CSS points at, and rewrites every URL to a local path under the
 * export's `fonts/` directory. The Google Fonts `<link>` tag (and any
 * `@import` of the same URL) is replaced with an inline `<style>` block
 * carrying the rewritten @font-face rules.
 *
 * Why ship this:
 *   1. The default CSP emitted by I-GEN-20 has `font-src 'self'` (and
 *      `style-src 'self' 'unsafe-inline'`). Loading Google Fonts via
 *      the CDN therefore fails CSP unless the author relaxes it. Self-
 *      hosting keeps the strict default working.
 *   2. Removes a network dependency from cold-load and a known
 *      privacy/tracking concern in some jurisdictions.
 *
 * The function is fetch-injectable so tests can run without network
 * access — pass a stub `fetchFn`; production callers omit it and the
 * global `fetch` is used (available in both Electron renderer and
 * Node 18+).
 */

/** Modern UA so Google Fonts serves woff2 instead of legacy fallbacks. */
const MODERN_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/** Matches any Google Fonts CSS URL — used to enumerate references. */
const GOOGLE_CSS_RE = /https:\/\/fonts\.googleapis\.com\/css2?\?[^\s'"<>)]+/g
/** Matches a `<link …>` tag whose href is a Google Fonts CSS URL. */
const LINK_TAG_RE =
  /<link\s+[^>]*href\s*=\s*["']?(https:\/\/fonts\.googleapis\.com\/css2?\?[^"'>\s]+)["']?[^>]*\/?>/gi
/** Matches an `@import` of a Google Fonts CSS URL (with or without `url()`). */
const IMPORT_RE =
  /@import\s+(?:url\()?["']?(https:\/\/fonts\.googleapis\.com\/css2?\?[^"')]+)["']?\)?\s*;?/g
/** Matches a `.woff2` URL on the gstatic CDN inside the fetched CSS body. */
const GSTATIC_WOFF2_RE = /https:\/\/fonts\.gstatic\.com\/[^\s'"()]+\.woff2/g

/**
 * Result of the self-host pass. `files` keys are export-relative paths
 * (e.g. `'fonts/abc12345.woff2'`) the bundle stage should package; the
 * `html` and `css` strings have every CDN URL replaced with the
 * matching local path.
 */
export interface SelfHostFontsResult {
  readonly html: string
  readonly css: string
  readonly files: Readonly<Record<string, ArrayBuffer>>
}

/**
 * Deterministic 8-char hash (FNV-1a 32-bit) of a string. Used to mint
 * stable filenames for self-hosted fonts so the same Google Fonts URL
 * always maps to the same local path across exports.
 */
function hash8(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Escape a string for safe use inside a regex literal. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Replace every occurrence of `needle` in `haystack` with `replacement`.
 * Avoids `String.replaceAll` (Node ≥ 15) churning on long strings — a
 * split/join is faster for the small payloads involved here.
 */
function replaceAll(haystack: string, needle: string, replacement: string): string {
  return haystack.split(needle).join(replacement)
}

/**
 * Run the self-host pass.
 *
 * @param html - HTML after `injectSEO` (so the `<link>` tags are
 *   already in the head).
 * @param css - The generator's emitted stylesheet (post-prettier,
 *   pre-minify).
 * @param fetchFn - Network adapter. Defaults to the global `fetch`.
 *   Tests pass a stub returning canned responses.
 *
 * Returns the mutated HTML / CSS plus a `files` map keyed by
 * export-relative path. If no Google Fonts references are found, the
 * input strings are returned unchanged and `files` is empty.
 */
export async function selfHostFonts(
  html: string,
  css: string,
  fetchFn: typeof fetch = fetch
): Promise<SelfHostFontsResult> {
  // 1. Enumerate every Google Fonts CSS URL referenced anywhere.
  const cssUrls = new Set<string>()
  for (const m of html.matchAll(GOOGLE_CSS_RE)) cssUrls.add(m[0])
  for (const m of css.matchAll(GOOGLE_CSS_RE)) cssUrls.add(m[0])
  if (cssUrls.size === 0) {
    return { html, css, files: {} }
  }

  // 2. For each, fetch the CSS body, harvest the woff2 URLs it points
  //    at, fetch the bytes, and produce a rewritten @font-face block.
  const woff2ToLocal = new Map<string, string>()
  const files: Record<string, ArrayBuffer> = {}
  const inlineBlocks: string[] = []

  for (const cssUrl of cssUrls) {
    const res = await fetchFn(cssUrl, { headers: { 'User-Agent': MODERN_UA } })
    if (!res.ok) continue
    let fontCss = await res.text()

    // Register every woff2 URL we have not seen.
    for (const m of fontCss.matchAll(GSTATIC_WOFF2_RE)) {
      const url = m[0]
      if (woff2ToLocal.has(url)) continue
      const localPath = `fonts/${hash8(url)}.woff2`
      woff2ToLocal.set(url, `./${localPath}`)
      const fontRes = await fetchFn(url)
      if (!fontRes.ok) continue
      files[localPath] = await fontRes.arrayBuffer()
    }

    // Rewrite the CSS body so all gstatic URLs point at the local copy.
    for (const [orig, local] of woff2ToLocal) {
      fontCss = replaceAll(fontCss, orig, local)
    }
    inlineBlocks.push(fontCss)
  }

  // 3. Strip every Google Fonts `<link>` from the HTML and append the
  //    rewritten @font-face rules in a single inline `<style>` block
  //    just before `</head>` so cold-load happens off the local files.
  let outHtml = html.replace(LINK_TAG_RE, '')
  if (inlineBlocks.length > 0) {
    const styleTag = `<style data-dtw-self-host-fonts>\n${inlineBlocks.join('\n')}\n</style>`
    if (outHtml.includes('</head>')) {
      outHtml = outHtml.replace('</head>', `${styleTag}\n</head>`)
    } else {
      // Defensive: no </head> means a non-standard document; append.
      outHtml = outHtml + styleTag
    }
  }

  // 4. Strip any matching `@import` from the document CSS as well.
  let outCss = css
  for (const cssUrl of cssUrls) {
    const importRe = new RegExp(
      `@import\\s+(?:url\\()?["']?${escapeRegex(cssUrl)}["']?\\)?\\s*;?`,
      'g'
    )
    outCss = outCss.replace(importRe, '')
  }
  // Catch-all sweep for any straggling references using the URL list.
  outCss = outCss.replace(IMPORT_RE, '')

  return { html: outHtml, css: outCss, files }
}
