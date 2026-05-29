/**
 * Minification stage for the export pipeline (I-EXP-03).
 *
 * Each exported function takes a source string and returns its minified
 * form. The plan requires `lightningcss` (CSS), `html-minifier-terser`
 * (HTML), and `terser` (JS); `lightningcss` is a native Rust addon so it
 * cannot run inside the sandboxed renderer. Following the `runAxeGate`
 * precedent we ship one file with two paths:
 *
 *   1. Renderer path — delegates to the main process via IPC.
 *   2. Node path — dynamic-imports the underlying minifier locally.
 *      Used by Vitest, by main-process callers, and by anyone running
 *      this module outside the sandboxed renderer.
 *
 * `@vite-ignore` markers on each dynamic import keep Vite from bundling
 * Node-only deps into the renderer chunk; the renderer always returns
 * through the IPC branch first so the dynamic imports below are never
 * reached at runtime in that build.
 */

import type { Targets } from 'lightningcss'

/**
 * Minify an HTML string. Strips comments, collapses whitespace inside
 * non-`<pre>` blocks, drops redundant attributes, and minifies inline
 * `<style>` / `<script>` blocks via the same CSS/JS minifiers.
 *
 * Delegates to `window.electronAPI.minifyHtml` when called from the
 * sandboxed renderer; otherwise loads `html-minifier-terser` locally.
 */
export async function minifyHtml(html: string): Promise<string> {
  if (typeof window !== 'undefined' && window.electronAPI?.minifyHtml) {
    return window.electronAPI.minifyHtml(html)
  }
  return minifyHtmlNode(html)
}

/**
 * Minify a CSS string via `lightningcss`. Targets modern evergreen
 * browsers (last 2 Chrome / Firefox / Safari / Edge), which matches the
 * v0.2.0 output baseline. `var()` references and custom properties pass
 * through unchanged so the token system keeps working.
 *
 * Delegates to `window.electronAPI.minifyCss` when called from the
 * sandboxed renderer; otherwise loads `lightningcss` locally.
 */
export async function minifyCss(css: string): Promise<string> {
  if (typeof window !== 'undefined' && window.electronAPI?.minifyCss) {
    return window.electronAPI.minifyCss(css)
  }
  return minifyCssNode(css)
}

/**
 * Minify a JS string via `terser`. Preserves runtime snippet semantics
 * (`catch {}`, top-level IIFE wrapping, ES2019 output) so passive
 * observers and focus traps still behave correctly post-minify.
 *
 * Delegates to `window.electronAPI.minifyJs` when called from the
 * sandboxed renderer; otherwise loads `terser` locally.
 */
export async function minifyJs(js: string): Promise<string> {
  if (typeof window !== 'undefined' && window.electronAPI?.minifyJs) {
    return window.electronAPI.minifyJs(js)
  }
  return minifyJsNode(js)
}

// ---------------------------------------------------------------------------
// Node-only implementations. Loaded via dynamic import so the renderer
// bundle never pulls in lightningcss / html-minifier-terser / terser.
// ---------------------------------------------------------------------------

/** Browser targets passed to lightningcss — evergreen, ES2019-class engines. */
let cachedTargets: Targets | null = null

async function getCssTargets(): Promise<Targets> {
  if (cachedTargets) return cachedTargets
  const lc = (await import(/* @vite-ignore */ 'lightningcss')) as typeof import('lightningcss')
  cachedTargets = lc.browserslistToTargets([
    'last 2 Chrome versions',
    'last 2 Firefox versions',
    'last 2 Safari versions',
    'last 2 Edge versions',
  ])
  return cachedTargets
}

async function minifyHtmlNode(html: string): Promise<string> {
  const mod = (await import(/* @vite-ignore */ 'html-minifier-terser')) as {
    minify: (src: string, opts: Record<string, unknown>) => Promise<string>
  }
  return mod.minify(html, {
    collapseWhitespace: true,
    conservativeCollapse: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
    decodeEntities: true,
    removeRedundantAttributes: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    useShortDoctype: true,
    sortAttributes: false,
    sortClassName: false,
    // Keep meaningful inter-element whitespace so inline-blocks don't collide
    // and so JSON-LD / CSP meta tags stay readable in `view-source:`.
    keepClosingSlash: true,
  })
}

async function minifyCssNode(css: string): Promise<string> {
  const lc = (await import(/* @vite-ignore */ 'lightningcss')) as typeof import('lightningcss')
  const targets = await getCssTargets()
  const { code } = lc.transform({
    filename: 'styles.css',
    code: Buffer.from(css),
    minify: true,
    targets,
  })
  return Buffer.from(code).toString('utf8')
}

async function minifyJsNode(js: string): Promise<string> {
  const mod = (await import(/* @vite-ignore */ 'terser')) as {
    minify: (
      src: string,
      opts: Record<string, unknown>
    ) => Promise<{ code?: string; error?: Error }>
  }
  const result = await mod.minify(js, {
    ecma: 2019,
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false },
  })
  if (result.error) throw result.error
  return result.code ?? js
}
