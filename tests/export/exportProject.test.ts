import { describe, it, expect, beforeEach, vi } from 'vitest'
import JSZip from 'jszip'
import { exportProject } from '../../src/export'
import { buildSimpleDocument, buildDocumentWithBadButton } from '../fixtures/documents'

const BASE_SEO = {
  title: 'Test Page',
  description: 'A page used by the export pipeline tests.',
} as const

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

    const result = await exportProject(buildSimpleDocument(BASE_SEO), { projectName: 'my-site' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.filePath).toBe('/tmp/project.zip')
      expect(result.report.accessibility.passed).toBe(true)
      expect(result.report.seo.titleLength).toBe(BASE_SEO.title.length)
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

  it('blocks export with stage="a11y-gate" when a11y violations are serious', async () => {
    // An empty <button> triggers axe-core's button-name (serious) rule.
    const captured = setupElectronAPI({ success: true })

    const result = await exportProject(buildDocumentWithBadButton(BASE_SEO))

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

    const result = await exportProject(buildSimpleDocument(BASE_SEO))

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.stage).toBe('save')
      expect(result.error).toBe('Disk full')
      expect(result.report).toBeDefined()
    }
  })

  it('sanitizes the project name for the zip filename', async () => {
    const captured = setupElectronAPI({ success: true, filePath: '/tmp/x.zip' })

    await exportProject(buildSimpleDocument(BASE_SEO), {
      projectName: '../../etc/passwd',
    })

    expect(captured.capturedFilename).not.toContain('/')
    expect(captured.capturedFilename).not.toContain('..')
    expect(captured.capturedFilename).toMatch(/^.+\.zip$/)
  })

  it('falls back to "project.zip" when the project name is only invalid chars', async () => {
    const captured = setupElectronAPI({ success: true, filePath: '/tmp/x.zip' })

    await exportProject(buildSimpleDocument(BASE_SEO), { projectName: '///' })
    expect(captured.capturedFilename).toBe('project.zip')
  })
})
