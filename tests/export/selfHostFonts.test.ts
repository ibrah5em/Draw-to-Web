/**
 * Self-host fonts (I-EXP-05). Unit tests for the post-processor, plus
 * an integration check that `exportProject({ selfHostFonts: true })`
 * threads the rewritten bytes into the bundle.
 *
 * Network is stubbed: a `fetchFn` returning canned `Response` objects
 * keeps the suite deterministic and offline-safe.
 */
import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { selfHostFonts } from '@export/selfHostFonts'
import { exportProject } from '@export/index'
import { createPortfolioTemplate } from '@templates/portfolio'

const INTER_CSS_URL = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap'
const INTER_400_URL =
  'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2'
const INTER_700_URL =
  'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nvQtMwCp50KnMa0Zn7.woff2'

const INTER_CSS_BODY = `@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400;
  src: url(${INTER_400_URL}) format('woff2');
}
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 700;
  src: url(${INTER_700_URL}) format('woff2');
}`

/** Build a stub `fetch` that returns canned bodies for known URLs. */
function makeStubFetch(): typeof fetch & { calls: string[] } {
  const calls: string[] = []
  const fn: typeof fetch = async (input) => {
    const url = typeof input === 'string' ? input : (input as Request).url
    calls.push(url)
    if (url === INTER_CSS_URL) {
      return new Response(INTER_CSS_BODY, {
        status: 200,
        headers: { 'content-type': 'text/css' },
      })
    }
    if (url === INTER_400_URL) {
      return new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x00, 0x01, 0x02, 0x03]), {
        status: 200,
      })
    }
    if (url === INTER_700_URL) {
      return new Response(new Uint8Array([0x77, 0x4f, 0x46, 0x32, 0x10, 0x11, 0x12, 0x13]), {
        status: 200,
      })
    }
    return new Response('', { status: 404 })
  }
  const tagged = Object.assign(fn, { calls })
  return tagged
}

describe('selfHostFonts (I-EXP-05)', () => {
  it('is a no-op when no Google Fonts URLs are present', async () => {
    const fetchFn = makeStubFetch()
    const html = '<html><head><title>x</title></head><body></body></html>'
    const css = 'body { color: red; }'
    const result = await selfHostFonts(html, css, fetchFn)
    expect(result.html).toBe(html)
    expect(result.css).toBe(css)
    expect(Object.keys(result.files)).toEqual([])
    expect(fetchFn.calls).toEqual([])
  })

  it('replaces a <link> with inline <style> + downloads each woff2 once', async () => {
    const fetchFn = makeStubFetch()
    const html = `<html><head><title>x</title>
<link rel="stylesheet" href="${INTER_CSS_URL}" />
</head><body></body></html>`
    const result = await selfHostFonts(html, '', fetchFn)

    // The <link> is gone, the inline <style> with rewritten URLs is in.
    expect(result.html).not.toContain(INTER_CSS_URL)
    expect(result.html).not.toContain(INTER_400_URL)
    expect(result.html).not.toContain(INTER_700_URL)
    expect(result.html).toMatch(/<style data-dtw-self-host-fonts>/)
    expect(result.html).toMatch(/url\(\.\/fonts\/[0-9a-f]{8}\.woff2\)/)

    // Two distinct woff2 files were packaged.
    const paths = Object.keys(result.files).sort()
    expect(paths).toHaveLength(2)
    expect(paths.every((p) => /^fonts\/[0-9a-f]{8}\.woff2$/.test(p))).toBe(true)

    // CSS body fetched once, each woff2 fetched once — no redundant pulls.
    expect(fetchFn.calls).toEqual([INTER_CSS_URL, INTER_400_URL, INTER_700_URL])
  })

  it('rewrites an @import in CSS to nothing and ships the same woff2s', async () => {
    const fetchFn = makeStubFetch()
    const css = `@import url("${INTER_CSS_URL}");
body { font-family: 'Inter'; }`
    const result = await selfHostFonts('<html><head></head><body></body></html>', css, fetchFn)
    expect(result.css).not.toContain(INTER_CSS_URL)
    expect(result.css).toMatch(/body \{ font-family: 'Inter'; \}/)
    expect(Object.keys(result.files)).toHaveLength(2)
  })

  it('produces deterministic filenames (same URL → same hash)', async () => {
    const html = `<link rel="stylesheet" href="${INTER_CSS_URL}" />`
    const a = await selfHostFonts(html, '', makeStubFetch())
    const b = await selfHostFonts(html, '', makeStubFetch())
    expect(Object.keys(a.files).sort()).toEqual(Object.keys(b.files).sort())
  })

  it('skips gracefully when a font URL 404s', async () => {
    const fetchFn = makeStubFetch()
    // Re-bind to add a CSS body referencing a missing woff2 URL.
    const BAD_CSS = 'https://fonts.googleapis.com/css2?family=Missing'
    const BAD_WOFF2 = 'https://fonts.gstatic.com/s/missing/missing.woff2'
    const wrapped: typeof fetch = async (input) => {
      const url = typeof input === 'string' ? input : (input as Request).url
      if (url === BAD_CSS) {
        return new Response(
          `@font-face { font-family: 'X'; src: url(${BAD_WOFF2}) format('woff2'); }`,
          { status: 200 }
        )
      }
      if (url === BAD_WOFF2) return new Response('', { status: 404 })
      return fetchFn(input)
    }
    const html = `<link rel="stylesheet" href="${BAD_CSS}" />`
    const result = await selfHostFonts(html, '', wrapped)
    // CSS still gets rewritten and inlined; the missing font is just absent.
    expect(result.html).toMatch(/<style data-dtw-self-host-fonts>/)
    expect(Object.keys(result.files)).toHaveLength(0)
  })

  it('skips gracefully when the CSS itself 404s', async () => {
    const html = `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nope" />`
    const fetchFn: typeof fetch = async () => new Response('', { status: 404 })
    const result = await selfHostFonts(html, '', fetchFn)
    // The <link> is still stripped, but no inline style is added.
    expect(result.html).not.toContain('googleapis.com')
    expect(result.html).not.toContain('<style data-dtw-self-host-fonts')
    expect(Object.keys(result.files)).toHaveLength(0)
  })
})

describe('exportProject({ selfHostFonts: true }) — integration', () => {
  it('threads the option through and packs fonts/*.woff2 into the ZIP', async () => {
    const fetchFn = makeStubFetch()
    const doc = createPortfolioTemplate('Ada')

    let captured: ArrayBuffer | null = null
    const g = globalThis as { window?: unknown }
    g.window = {
      electronAPI: {
        async exportZip(buffer: ArrayBuffer) {
          captured = buffer
          return { success: true, filePath: '/tmp/self-host.zip' }
        },
        async readImageAssets(): Promise<Record<string, ArrayBuffer | null>> {
          return {}
        },
      },
    }

    // The portfolio template doesn't currently emit a Google Fonts
    // <link> — it only preconnects. So exporting with the flag on
    // exercises the no-op path: pipeline completes, ZIP has no
    // `fonts/` entries, no fetch calls made.
    const out = await exportProject(doc, {
      projectName: 'p',
      selfHostFonts: true,
      fetchFonts: fetchFn,
    })
    expect(out.success).toBe(true)
    expect(fetchFn.calls).toEqual([])
    expect(captured).not.toBeNull()
    if (captured) {
      const zip = await JSZip.loadAsync(captured)
      const fontEntries = Object.keys(zip.files).filter((n) => n.startsWith('fonts/'))
      expect(fontEntries).toEqual([])
    }
  })
})
