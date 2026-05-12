import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

// ───────────── Electron mock ─────────────
// vi.mock() is hoisted above imports, so the mock factory cannot close over
// module-scope variables. We use vi.hoisted() to lift our handler maps and
// dialog/app stubs into the same hoisted phase, then reference them from both
// the factory and the tests.

type IpcHandler = (event: unknown, ...args: unknown[]) => unknown

const { handlers, syncHandlers, electronMock } = vi.hoisted(() => {
  const handlers = new Map<string, IpcHandler>()
  const syncHandlers = new Map<string, (event: { returnValue?: unknown }) => void>()
  return {
    handlers,
    syncHandlers,
    electronMock: {
      ipcMain: {
        handle: (channel: string, handler: IpcHandler) => handlers.set(channel, handler),
        on: (channel: string, handler: (event: { returnValue?: unknown }) => void) =>
          syncHandlers.set(channel, handler),
      },
      dialog: {
        showSaveDialog: vi.fn(),
        showOpenDialog: vi.fn(),
      },
      app: {
        getPath: vi.fn((_name: string) => '/tmp'),
        getVersion: vi.fn(() => '0.1.0-test'),
      },
    },
  }
})

vi.mock('electron', () => electronMock)

// Import only after the mock is registered so the handlers wire into our stub.
import { registerIpcHandlers } from '../../src/main/ipc'

let tempDir: string

beforeEach(async () => {
  handlers.clear()
  syncHandlers.clear()
  vi.clearAllMocks()
  tempDir = await mkdtemp(join(tmpdir(), 'dtw-ipc-'))
  registerIpcHandlers()
})

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true })
})

function invoke<T = unknown>(channel: string, ...args: unknown[]): Promise<T> {
  const handler = handlers.get(channel)
  if (!handler) throw new Error(`No handler registered for ${channel}`)
  return Promise.resolve(handler({}, ...args) as T)
}

// ───────────── export:zip ─────────────

describe('export:zip IPC handler', () => {
  it('writes the zip buffer to the chosen path', async () => {
    const filePath = join(tempDir, 'out.zip')
    electronMock.dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath })

    const payload = new Uint8Array([0x50, 0x4b, 0x03, 0x04]).buffer // ZIP magic
    const result = await invoke<{ success: boolean; filePath?: string }>(
      'export:zip',
      payload,
      'project.zip'
    )

    expect(result.success).toBe(true)
    expect(result.filePath).toBe(filePath)
    const written = await readFile(filePath)
    expect(written.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
  })

  it('returns success: false (no error) when the user cancels', async () => {
    electronMock.dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    const result = await invoke<{ success: boolean; error?: string }>(
      'export:zip',
      new ArrayBuffer(8),
      'p.zip'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBeUndefined()
  })

  it('rejects non-ArrayBuffer payloads', async () => {
    const result = await invoke<{ success: boolean; error?: string }>(
      'export:zip',
      'not-a-buffer',
      'p.zip'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid arguments')
    expect(electronMock.dialog.showSaveDialog).not.toHaveBeenCalled()
  })

  it('rejects payloads larger than 50 MB', async () => {
    const tooBig = new ArrayBuffer(51 * 1024 * 1024)
    const result = await invoke<{ success: boolean; error?: string }>('export:zip', tooBig, 'p.zip')
    expect(result.success).toBe(false)
    expect(result.error).toContain('50 MB')
  })

  it('rejects path-traversal attempts in the chosen filePath', async () => {
    electronMock.dialog.showSaveDialog.mockResolvedValueOnce({
      canceled: false,
      filePath: '/tmp/../etc/passwd',
    })
    const result = await invoke<{ success: boolean; error?: string }>(
      'export:zip',
      new ArrayBuffer(4),
      'p.zip'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid save path')
  })
})

// ───────────── project:save + project:open round-trip ─────────────

describe('project:save and project:open round-trip', () => {
  it('writes JSON then reads it back identically', async () => {
    const filePath = join(tempDir, 'demo.dtw')
    electronMock.dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath })

    const projectJson = JSON.stringify({ version: 1, elements: [{ id: 'a' }] })
    const saveResult = await invoke<{ success: boolean; filePath?: string }>(
      'project:save',
      projectJson,
      'demo'
    )

    expect(saveResult.success).toBe(true)
    expect(saveResult.filePath).toBe(filePath)
    expect(await readFile(filePath, 'utf8')).toBe(projectJson)

    electronMock.dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [filePath],
    })
    const openResult = await invoke<{ success: boolean; json?: string; filePath?: string }>(
      'project:open'
    )

    expect(openResult.success).toBe(true)
    expect(openResult.json).toBe(projectJson)
    expect(openResult.filePath).toBe(filePath)
  })

  it('project:save rejects non-string payloads', async () => {
    const result = await invoke<{ success: boolean; error?: string }>(
      'project:save',
      { not: 'a string' },
      'x'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid project payload')
  })

  it('project:save enforces the 10 MB cap', async () => {
    const huge = 'x'.repeat(11 * 1024 * 1024)
    const result = await invoke<{ success: boolean; error?: string }>('project:save', huge, 'x')
    expect(result.success).toBe(false)
    expect(result.error).toContain('size limit')
  })

  it('project:open rejects files without the .dtw extension', async () => {
    const filePath = join(tempDir, 'malicious.txt')
    await writeFile(filePath, '{}', 'utf8')
    electronMock.dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [filePath],
    })

    const result = await invoke<{ success: boolean; error?: string }>('project:open')
    expect(result.success).toBe(false)
    expect(result.error).toContain('.dtw')
  })

  it('project:open returns success: false (no error) when the user cancels', async () => {
    electronMock.dialog.showOpenDialog.mockResolvedValueOnce({ canceled: true, filePaths: [] })
    const result = await invoke<{ success: boolean; error?: string }>('project:open')
    expect(result.success).toBe(false)
    expect(result.error).toBeUndefined()
  })
})

// ───────────── app:version (sync) ─────────────

describe('app:version sync IPC', () => {
  it('stamps the app version into event.returnValue', () => {
    const event = {} as { returnValue?: string }
    syncHandlers.get('app:version')!(event)
    expect(event.returnValue).toBe('0.1.0-test')
  })
})
