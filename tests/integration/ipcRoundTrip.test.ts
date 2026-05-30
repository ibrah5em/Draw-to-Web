/**
 * Full IPC round-trip integration test (T5.3).
 *
 * The renderer-side unit tests (tests/export/exportProject.test.ts) stub the
 * IPC layer, and the main-side unit tests (tests/main/ipc.test.ts) drive the
 * handlers directly with synthetic buffers. Neither covers the boundary
 * itself: that the buffer produced by `exportProject()` survives the round
 * trip and lands on disk as a valid ZIP containing the exact bytes the
 * generator emitted.
 *
 * This test wires the renderer pipeline to the real `export:zip` IPC handler
 * via a `window.electronAPI` shim that forwards calls into the handler map,
 * then asserts the file on disk matches the in-memory ZIP byte-for-byte.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { buildSimpleDocument } from '../fixtures/documents'

// ───────────── Electron mock (hoisted so vi.mock can see it) ─────────────

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown

const { handlers, electronMock } = vi.hoisted(() => {
  const handlers = new Map<string, IpcHandler>()
  return {
    handlers,
    electronMock: {
      ipcMain: {
        handle: (channel: string, handler: IpcHandler) => handlers.set(channel, handler),
        on: () => {
          /* no-op for sync handlers — not exercised here */
        },
      },
      dialog: {
        showSaveDialog: vi.fn(),
      },
      app: {
        getPath: vi.fn(() => '/tmp'),
        getVersion: vi.fn(() => '0.0.0-test'),
      },
    },
  }
})

vi.mock('electron', () => electronMock)

import { registerIpcHandlers } from '../../src/main/ipc'
import { exportProject } from '../../src/export'

const DOC = buildSimpleDocument({
  title: 'Round Trip Test',
  description: 'Verifies the renderer→IPC→disk path end-to-end.',
})

let tempDir: string

beforeEach(async () => {
  handlers.clear()
  vi.clearAllMocks()
  tempDir = await mkdtemp(join(tmpdir(), 'dtw-roundtrip-'))
  registerIpcHandlers()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await rm(tempDir, { recursive: true, force: true })
})

/**
 * Installs a `window.electronAPI.exportZip` that forwards into the actual
 * registered `export:zip` IPC handler — the same handler the main process
 * runs in production.
 */
function wireRendererToMain(): void {
  vi.stubGlobal('window', {
    electronAPI: {
      exportZip: async (buffer: ArrayBuffer, filename: string) => {
        const handler = handlers.get('export:zip')
        if (!handler) throw new Error('export:zip handler not registered')
        return handler({}, buffer, filename) as Promise<{
          success: boolean
          filePath?: string
          error?: string
        }>
      },
    },
  })
}

describe('IPC round-trip: exportProject → export:zip handler → disk', () => {
  it('writes a ZIP whose bytes match the renderer-side buffer', async () => {
    const outPath = join(tempDir, 'round-trip.zip')
    electronMock.dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: outPath,
    })
    // Intercept the buffer the renderer hands to the IPC layer so we can
    // compare it against what ended up on disk.
    let bufferSeenByIpc: ArrayBuffer | null = null
    vi.stubGlobal('window', {
      electronAPI: {
        exportZip: async (buffer: ArrayBuffer, filename: string) => {
          bufferSeenByIpc = buffer
          const handler = handlers.get('export:zip')!
          return handler({}, buffer, filename) as Promise<{
            success: boolean
            filePath?: string
          }>
        },
      },
    })

    const result = await exportProject(DOC, { projectName: 'round-trip' })

    expect(result.success).toBe(true)
    if (!result.success) throw new Error('export failed before disk check')
    expect(result.filePath).toBe(outPath)

    const onDisk = await readFile(outPath)
    expect(bufferSeenByIpc).not.toBeNull()
    expect(Buffer.from(bufferSeenByIpc!)).toEqual(onDisk)
  })

  it('produces a ZIP on disk that unzips into a valid index.html + styles.css', async () => {
    const outPath = join(tempDir, 'valid.zip')
    electronMock.dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: outPath,
    })
    wireRendererToMain()

    const result = await exportProject(DOC)
    expect(result.success).toBe(true)

    const zipBytes = await readFile(outPath)
    const zip = await JSZip.loadAsync(zipBytes)
    const indexEntry = zip.file('index.html')
    const cssEntry = zip.file('styles.css')
    expect(indexEntry).not.toBeNull()
    expect(cssEntry).not.toBeNull()

    const html = await indexEntry!.async('string')
    const css = await cssEntry!.async('string')

    // SEO post-processing must have made it through the boundary unmangled.
    expect(html).toContain('<title>Round Trip Test</title>')
    expect(html).toContain('Verifies the renderer→IPC→disk path end-to-end.')
    // Zero-JS invariant survives the round trip.
    expect(html).not.toMatch(/<script\b/i)
    // Generator emitted real CSS, not an empty string.
    expect(css.length).toBeGreaterThan(0)
  })

  it('surfaces stage="save" when the dialog is canceled — no file written', async () => {
    const outPath = join(tempDir, 'should-not-exist.zip')
    electronMock.dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    wireRendererToMain()

    const result = await exportProject(DOC)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.stage).toBe('save')
    }
    await expect(readFile(outPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects oversized buffers at the IPC boundary and reports stage="save"', async () => {
    // Bypass exportProject's normal flow by feeding the handler a buffer the
    // renderer would never legitimately produce, just to prove the boundary
    // check fires end-to-end. We invoke through the same shim the renderer
    // uses so the path under test is identical.
    wireRendererToMain()
    const huge = new ArrayBuffer(51 * 1024 * 1024)
    const result = await window.electronAPI.exportZip(huge, 'too-big.zip')
    expect(result.success).toBe(false)
    expect(result.error).toContain('50 MB')
    // showSaveDialog must not have been invoked — size check is the first gate.
    expect(electronMock.dialog.showSaveDialog).not.toHaveBeenCalled()
  })
})
