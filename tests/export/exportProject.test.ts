import { describe, it, expect, beforeEach, vi } from 'vitest'
import JSZip from 'jszip'
import { SIMPLE_PAGE } from '../fixtures/legacyElements'
import type { CanvasElement } from '../../src/store/elementStore'
import type { SEOConfig } from '../../src/shared/types'
import { exportProject, buildPreview } from '../../src/export'

const BASE_CONFIG: SEOConfig = {
  title: 'Test Page',
  description: 'A page used by the export pipeline tests.',
}

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

describe('exportProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('runs the full pipeline and writes a valid ZIP on success', async () => {
    const captured = setupElectronAPI({ success: true, filePath: '/tmp/project.zip' })

    const result = await exportProject(SIMPLE_PAGE, BASE_CONFIG, { projectName: 'my-site' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.filePath).toBe('/tmp/project.zip')
      expect(result.report.accessibility.passed).toBe(true)
      expect(result.report.seo.titleLength).toBe(BASE_CONFIG.title.length)
    }

    expect(captured.capturedFilename).toBe('my-site.zip')
    expect(captured.capturedBuffer).toBeInstanceOf(ArrayBuffer)

    // Validate the ZIP actually contains index.html and styles.css with injected SEO
    const zip = await JSZip.loadAsync(captured.capturedBuffer!)
    expect(zip.file('index.html')).not.toBeNull()
    expect(zip.file('styles.css')).not.toBeNull()
    const html = await zip.file('index.html')!.async('string')
    expect(html).toContain('<title>Test Page</title>')
  })

  it('blocks export with stage="a11y-gate" when a11y violations are critical', async () => {
    // Add a button with no text to the input — axe-core flags button-name (serious).
    const elementsWithBadButton: CanvasElement[] = [
      ...SIMPLE_PAGE,
      {
        id: 'empty-btn',
        type: 'button',
        x: 0,
        y: 0,
        width: 4,
        height: 40,
        props: {}, // no text
      },
    ]
    const captured = setupElectronAPI({ success: true })

    const result = await exportProject(elementsWithBadButton, BASE_CONFIG)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.stage).toBe('a11y-gate')
      expect(result.report).toBeDefined()
      expect(result.report?.accessibility.passed).toBe(false)
    }
    // IPC must not be called when the gate blocks
    expect(captured.capturedBuffer).toBeNull()
  })

  it('returns stage="save" when the IPC handler reports failure', async () => {
    setupElectronAPI({ success: false, error: 'Disk full' })

    const result = await exportProject(SIMPLE_PAGE, BASE_CONFIG)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.stage).toBe('save')
      expect(result.error).toBe('Disk full')
      expect(result.report).toBeDefined()
    }
  })

  it('sanitizes the project name for the zip filename', async () => {
    const captured = setupElectronAPI({ success: true, filePath: '/tmp/x.zip' })

    await exportProject(SIMPLE_PAGE, BASE_CONFIG, {
      projectName: '../../etc/passwd',
    })

    expect(captured.capturedFilename).not.toContain('/')
    expect(captured.capturedFilename).not.toContain('..')
    expect(captured.capturedFilename).toMatch(/^.+\.zip$/)
  })

  it('falls back to "project.zip" when the project name is only invalid chars', async () => {
    const captured = setupElectronAPI({ success: true, filePath: '/tmp/x.zip' })

    await exportProject(SIMPLE_PAGE, BASE_CONFIG, { projectName: '///' })
    expect(captured.capturedFilename).toBe('project.zip')
  })
})

describe('buildPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns html+css for a valid element list', async () => {
    const preview = await buildPreview(SIMPLE_PAGE)
    expect(preview).not.toBeNull()
    expect(preview?.html).toContain('<!doctype html>')
    expect(preview?.css.length).toBeGreaterThan(0)
  })

  it('returns html+css even for an empty element list', async () => {
    const preview = await buildPreview([])
    expect(preview).not.toBeNull()
    expect(preview?.html).toContain('<!doctype html>')
  })
})
