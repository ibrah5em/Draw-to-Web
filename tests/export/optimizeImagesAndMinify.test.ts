/**
 * Integration coverage for the two pipeline stages that ship in this PR:
 *
 *   - `optimize-images` — packs the on-disk sharp variants into the ZIP,
 *     using `readImageAssets` IPC to ferry bytes across the renderer ↔
 *     main boundary.
 *   - `minify` — runs html-minifier-terser / lightningcss / terser on the
 *     emitted bundle when `options.minify === true`.
 *
 * The pre-existing `exportProjectDocument.test.ts` covers the stage
 * ordering + structural contract; this file covers the output deltas.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import JSZip from 'jszip'
import { exportProject } from '../../src/export'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'
import type { Document, AssetManifestEntry } from '../../src/document/types'

interface MockIpcResult {
  success: boolean
  filePath?: string
  error?: string
}

interface StubOpts {
  zipResult: MockIpcResult
  assetBytes?: Record<string, ArrayBuffer | null>
}

function setupElectronAPI(opts: StubOpts): {
  capturedBuffer: ArrayBuffer | null
} {
  const captured = { capturedBuffer: null as ArrayBuffer | null }
  vi.stubGlobal('window', {
    electronAPI: {
      exportZip: vi.fn(async (buf: ArrayBuffer) => {
        captured.capturedBuffer = buf
        return opts.zipResult
      }),
      // Only stubbed when the test exercises an asset-bearing document.
      readImageAssets: opts.assetBytes
        ? vi.fn(async (paths: readonly string[]) => {
            const out: Record<string, ArrayBuffer | null> = {}
            for (const p of paths) out[p] = opts.assetBytes?.[p] ?? null
            return out
          })
        : undefined,
    },
  })
  return captured
}

function makeAsset(id: string): AssetManifestEntry {
  return {
    id,
    mimeType: 'image/webp',
    originalFilename: `${id}.png`,
    width: 1200,
    height: 800,
    srcset: {
      400: `assets/${id}-400.webp`,
      800: `assets/${id}-800.webp`,
      1200: `assets/${id}-1200.webp`,
    },
  }
}

function withAsset(doc: Document, asset: AssetManifestEntry): Document {
  return { ...doc, assets: { ...doc.assets, [asset.id]: asset } }
}

describe('optimize-images stage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('skips the IPC call entirely when the document has no assets', async () => {
    const stub = setupElectronAPI({ zipResult: { success: true, filePath: '/tmp/x.zip' } })
    expect((window.electronAPI as { readImageAssets?: unknown }).readImageAssets).toBeUndefined()
    const result = await exportProject(PORTFOLIO_DOCUMENT)
    expect(result.success).toBe(true)
    expect(stub.capturedBuffer).toBeInstanceOf(ArrayBuffer)
  })

  it('packs each variant byte payload into assets/ in the ZIP', async () => {
    const asset = makeAsset('hero')
    const doc = withAsset(PORTFOLIO_DOCUMENT, asset)
    const bytes400 = new TextEncoder().encode('webp-400-bytes').buffer
    const bytes800 = new TextEncoder().encode('webp-800-bytes').buffer
    const bytes1200 = new TextEncoder().encode('webp-1200-bytes').buffer
    const stub = setupElectronAPI({
      zipResult: { success: true, filePath: '/tmp/p.zip' },
      assetBytes: {
        'assets/hero-400.webp': bytes400,
        'assets/hero-800.webp': bytes800,
        'assets/hero-1200.webp': bytes1200,
      },
    })

    const result = await exportProject(doc)
    expect(result.success).toBe(true)

    const zip = await JSZip.loadAsync(stub.capturedBuffer!)
    expect(zip.file('assets/hero-400.webp')).not.toBeNull()
    expect(zip.file('assets/hero-800.webp')).not.toBeNull()
    expect(zip.file('assets/hero-1200.webp')).not.toBeNull()

    const packed = await zip.file('assets/hero-800.webp')!.async('string')
    expect(packed).toBe('webp-800-bytes')
  })

  it('skips paths whose bytes came back null (missing on disk)', async () => {
    const asset = makeAsset('broken')
    const doc = withAsset(PORTFOLIO_DOCUMENT, asset)
    const stub = setupElectronAPI({
      zipResult: { success: true, filePath: '/tmp/p.zip' },
      assetBytes: {
        'assets/broken-400.webp': new TextEncoder().encode('ok').buffer,
        'assets/broken-800.webp': null,
        'assets/broken-1200.webp': null,
      },
    })

    const result = await exportProject(doc)
    expect(result.success).toBe(true)
    const zip = await JSZip.loadAsync(stub.capturedBuffer!)
    expect(zip.file('assets/broken-400.webp')).not.toBeNull()
    expect(zip.file('assets/broken-800.webp')).toBeNull()
    expect(zip.file('assets/broken-1200.webp')).toBeNull()
  })

  it('surfaces stage="optimize-images" if the IPC call rejects', async () => {
    const asset = makeAsset('hero')
    const doc = withAsset(PORTFOLIO_DOCUMENT, asset)
    vi.stubGlobal('window', {
      electronAPI: {
        exportZip: vi.fn(),
        readImageAssets: vi.fn(async () => {
          throw new Error('disk read failed')
        }),
      },
    })

    const result = await exportProject(doc)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.stage).toBe('optimize-images')
      expect(result.error).toContain('disk read failed')
    }
  })

  it('dedupes shared variant paths across assets (single ZIP entry per file)', async () => {
    // Two assets pointing at the same on-disk variant — only one ZIP entry
    // should land, no IPC call duplicated.
    const a: AssetManifestEntry = {
      id: 'a',
      mimeType: 'image/webp',
      originalFilename: 'a.png',
      width: 800,
      height: 600,
      srcset: { 800: 'assets/shared-800.webp' },
    }
    const b: AssetManifestEntry = { ...a, id: 'b', originalFilename: 'b.png' }
    const doc = withAsset(withAsset(PORTFOLIO_DOCUMENT, a), b)
    const readSpy = vi.fn(async (paths: readonly string[]) => {
      const out: Record<string, ArrayBuffer> = {}
      for (const p of paths) out[p] = new TextEncoder().encode('bytes').buffer
      return out
    })
    vi.stubGlobal('window', {
      electronAPI: {
        exportZip: vi.fn(async () => ({ success: true, filePath: '/tmp/x.zip' })),
        readImageAssets: readSpy,
      },
    })

    await exportProject(doc)
    const calledWith = readSpy.mock.calls[0][0]
    expect(calledWith).toEqual(['assets/shared-800.webp'])
  })
})

describe('minify stage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('shrinks HTML and CSS payloads when options.minify is true', async () => {
    const stubPretty = setupElectronAPI({ zipResult: { success: true, filePath: '/tmp/a.zip' } })
    await exportProject(PORTFOLIO_DOCUMENT)
    const prettyZip = await JSZip.loadAsync(stubPretty.capturedBuffer!)
    const prettyHtml = await prettyZip.file('index.html')!.async('string')
    const prettyCss = await prettyZip.file('styles.css')!.async('string')

    vi.unstubAllGlobals()
    const stubMin = setupElectronAPI({ zipResult: { success: true, filePath: '/tmp/b.zip' } })
    await exportProject(PORTFOLIO_DOCUMENT, { minify: true })
    const minZip = await JSZip.loadAsync(stubMin.capturedBuffer!)
    const minHtml = await minZip.file('index.html')!.async('string')
    const minCss = await minZip.file('styles.css')!.async('string')

    expect(minHtml.length).toBeLessThan(prettyHtml.length)
    expect(minCss.length).toBeLessThan(prettyCss.length)
    // CSS minifier must keep the var() token references intact.
    expect(minCss).toContain('var(--')
  })

  it('emits "minify" progress event even when minify=false (stage is always present)', async () => {
    setupElectronAPI({ zipResult: { success: true, filePath: '/tmp/x.zip' } })
    const stages: string[] = []
    await exportProject(PORTFOLIO_DOCUMENT, { onProgress: (e) => stages.push(e.stage) })
    expect(stages).toContain('minify')
  })

  it('inlineJS=true splices JS into the HTML and drops scripts.js from the ZIP', async () => {
    // Flip themeToggle on so the JS emitter produces a non-empty bundle
    // and the generator emits the external `<script src="scripts.js">`
    // tag — the canary for the inline path.
    const docWithJs: Document = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true },
    }
    const stub = setupElectronAPI({ zipResult: { success: true, filePath: '/tmp/i.zip' } })
    await exportProject(docWithJs, { inlineJS: true })

    const zip = await JSZip.loadAsync(stub.capturedBuffer!)
    expect(zip.file('scripts.js')).toBeNull()
    const html = await zip.file('index.html')!.async('string')
    expect(html).not.toContain('src="scripts.js"')
    // The IIFE wrapper from jsEmitter should now live in the page itself.
    expect(html).toMatch(/<script>\s*\(function/)
  })

  it('inlineJS=true cooperates with minify=true (both flags on)', async () => {
    const docWithJs: Document = {
      ...PORTFOLIO_DOCUMENT,
      runtime: { ...PORTFOLIO_DOCUMENT.runtime, themeToggle: true },
    }
    const stub = setupElectronAPI({ zipResult: { success: true, filePath: '/tmp/m.zip' } })
    await exportProject(docWithJs, { inlineJS: true, minify: true })

    const zip = await JSZip.loadAsync(stub.capturedBuffer!)
    expect(zip.file('scripts.js')).toBeNull()
    const html = await zip.file('index.html')!.async('string')
    // Tolerant: post-minify the external tag's attributes may have been
    // re-ordered (`defer src=…`), but the inlining helper anchors on
    // `scripts.js` and survives.
    expect(html).not.toMatch(/src\s*=\s*["']?scripts\.js/i)
    expect(html).toContain('<script>')
  })

  it('inlineJS=true is a no-op when the document produces no JS', async () => {
    // Strip every runtime flag — jsEmitter returns '' and the generator
    // omits the external script tag entirely.
    const docNoJs: Document = {
      ...PORTFOLIO_DOCUMENT,
      runtime: {
        themeToggle: false,
        scrollSpy: false,
        smoothScroll: false,
        navOnScroll: false,
        mobileNav: false,
        reveals: false,
        animationGating: false,
        terminalTyping: false,
      },
    }
    const stub = setupElectronAPI({ zipResult: { success: true, filePath: '/tmp/n.zip' } })
    const result = await exportProject(docNoJs, { inlineJS: true })
    expect(result.success).toBe(true)
    const zip = await JSZip.loadAsync(stub.capturedBuffer!)
    expect(zip.file('scripts.js')).toBeNull()
  })

  it('surfaces stage="minify" if a minifier throws', async () => {
    vi.stubGlobal('window', {
      electronAPI: {
        exportZip: vi.fn(),
        minifyHtml: vi.fn(async () => {
          throw new Error('boom')
        }),
        minifyCss: vi.fn(async () => 'ok'),
        minifyJs: vi.fn(async () => 'ok'),
      },
    })
    const result = await exportProject(PORTFOLIO_DOCUMENT, { minify: true })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.stage).toBe('minify')
      expect(result.error).toBe('boom')
    }
  })
})
