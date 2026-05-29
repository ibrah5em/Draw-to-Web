import { describe, it, expect, beforeEach, vi } from 'vitest'
import JSZip from 'jszip'
import { exportProject, type ExportStage } from '../../src/export'
import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'
import type { Document } from '../../src/document/types'

interface MockIpcResult {
  success: boolean
  filePath?: string
  error?: string
}

function setupElectronAPI(zipResult: MockIpcResult): {
  capturedBuffer: ArrayBuffer | null
  capturedFilename: string | null
} {
  const captured = {
    capturedBuffer: null as ArrayBuffer | null,
    capturedFilename: null as string | null,
  }
  vi.stubGlobal('window', {
    electronAPI: {
      exportZip: vi.fn(async (buf: ArrayBuffer, filename: string) => {
        captured.capturedBuffer = buf
        captured.capturedFilename = filename
        return zipResult
      }),
    },
  })
  return captured
}

describe('exportProject(doc, options) — C12 pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('runs all 9 stages in order and emits a structured progress event per stage', async () => {
    setupElectronAPI({ success: true, filePath: '/tmp/p.zip' })

    const events: ExportStage[] = []
    const result = await exportProject(PORTFOLIO_DOCUMENT, {
      onProgress: (e) => events.push(e.stage),
    })

    expect(result.success).toBe(true)
    expect(events).toEqual([
      'validate',
      'generate',
      'inject-seo',
      'a11y-gate',
      'optimize-images',
      'minify',
      'sitemap-robots',
      'bundle',
      'save',
    ])
  })

  it('progress events carry stable index/total values', async () => {
    setupElectronAPI({ success: true, filePath: '/tmp/p.zip' })

    const events: { stage: ExportStage; index: number; total: number }[] = []
    await exportProject(PORTFOLIO_DOCUMENT, { onProgress: (e) => events.push(e) })

    expect(events[0]).toEqual({ stage: 'validate', index: 0, total: 9 })
    expect(events[events.length - 1]).toEqual({ stage: 'save', index: 8, total: 9 })
  })

  it('blocks export at stage="validate" when the document has errors', async () => {
    // Introduce a duplicate id by inserting a second tree with the same root id.
    const broken: Document = {
      ...PORTFOLIO_DOCUMENT,
      tree: {
        ...PORTFOLIO_DOCUMENT.tree,
        type: 'container',
        layout: { base: { mode: 'flex' } },
        children: [
          // Duplicate of the existing header id.
          {
            id: 'header',
            type: 'text',
            tag: 'h1',
            content: 'Different element, same id',
            style: { base: {} },
          },
          ...(PORTFOLIO_DOCUMENT.tree.type === 'container' ? PORTFOLIO_DOCUMENT.tree.children : []),
        ],
      },
    }
    const captured = setupElectronAPI({ success: true })

    const result = await exportProject(broken)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.stage).toBe('validate')
      expect(result.error).toContain('validation error')
    }
    expect(captured.capturedBuffer).toBeNull()
  })

  it('produces a ZIP containing index.html, styles.css, sitemap.xml, and robots.txt', async () => {
    const captured = setupElectronAPI({ success: true, filePath: '/tmp/p.zip' })
    const docWithCanonical: Document = {
      ...PORTFOLIO_DOCUMENT,
      seo: { ...PORTFOLIO_DOCUMENT.seo, canonical: 'https://example.com/' },
    }

    const result = await exportProject(docWithCanonical, { projectName: 'portfolio' })

    expect(result.success).toBe(true)
    expect(captured.capturedFilename).toBe('portfolio.zip')
    expect(captured.capturedBuffer).toBeInstanceOf(ArrayBuffer)

    const zip = await JSZip.loadAsync(captured.capturedBuffer!)
    expect(zip.file('index.html')).not.toBeNull()
    expect(zip.file('styles.css')).not.toBeNull()
    expect(zip.file('sitemap.xml')).not.toBeNull()
    expect(zip.file('robots.txt')).not.toBeNull()

    const sitemap = await zip.file('sitemap.xml')!.async('string')
    expect(sitemap).toContain('<loc>https://example.com/</loc>')

    const robots = await zip.file('robots.txt')!.async('string')
    expect(robots).toContain('User-agent: *')
    expect(robots).toContain('Sitemap:')

    // No JS = no scripts.js (matches the I-GEN-15 contract through bundling).
    expect(zip.file('scripts.js')).toBeNull()
  })

  it('uses doc.meta.name as the default project name when options.projectName is absent', async () => {
    const captured = setupElectronAPI({ success: true, filePath: '/tmp/x.zip' })
    await exportProject(PORTFOLIO_DOCUMENT)
    expect(captured.capturedFilename).toBe('SamplePortfolio.zip')
  })

  it('sanitizes the project name against path traversal attempts', async () => {
    const captured = setupElectronAPI({ success: true, filePath: '/tmp/x.zip' })
    await exportProject(PORTFOLIO_DOCUMENT, { projectName: '../../etc/passwd' })
    expect(captured.capturedFilename).not.toContain('/')
    expect(captured.capturedFilename).not.toContain('..')
  })

  it('surfaces stage="save" when the IPC handler reports failure', async () => {
    setupElectronAPI({ success: false, error: 'Disk full' })
    const result = await exportProject(PORTFOLIO_DOCUMENT)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.stage).toBe('save')
      expect(result.error).toBe('Disk full')
      // The axe gate ran before save, so the report is still available.
      expect(result.report).toBeDefined()
    }
  })

  it('accepts the full ExportOptions surface and still produces a bundle', async () => {
    // `minify` runs for real (covered by optimizeImagesAndMinify.test);
    // `inlineJS` + `selfHostFonts` remain pass-throughs for now (I-EXP-05).
    const captured = setupElectronAPI({ success: true, filePath: '/tmp/x.zip' })
    await exportProject(PORTFOLIO_DOCUMENT, {
      minify: true,
      inlineJS: true,
      selfHostFonts: true,
      includeSourceComments: true,
      theme: 'dark',
    })
    expect(captured.capturedBuffer).toBeInstanceOf(ArrayBuffer)
  })
})
