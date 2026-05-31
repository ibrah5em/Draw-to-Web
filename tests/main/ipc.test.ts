import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import sharp from 'sharp'

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

// ───────────── image:upload (C11 / I-ELE-05) ─────────────

describe('image:upload IPC handler — validation', () => {
  it('rejects non-ArrayBuffer payloads', async () => {
    const result = await invoke<{ success: boolean; error?: string }>(
      'image:upload',
      'not-a-buffer',
      'photo.png'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid arguments')
  })

  it('rejects empty buffers', async () => {
    const result = await invoke<{ success: boolean; error?: string }>(
      'image:upload',
      new ArrayBuffer(0),
      'photo.png'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('Empty image buffer')
  })

  it('rejects buffers larger than 50 MB', async () => {
    // Allocate a buffer that *starts* with a valid PNG magic, so we exercise
    // the size check rather than the MIME sniff.
    const tooBig = new Uint8Array(51 * 1024 * 1024)
    tooBig.set([0x89, 0x50, 0x4e, 0x47])
    const result = await invoke<{ success: boolean; error?: string }>(
      'image:upload',
      tooBig.buffer,
      'photo.png'
    )
    expect(result.success).toBe(false)
    expect(result.error).toContain('50 MB')
  })

  it('rejects unsupported magic numbers (e.g. a PDF header)', async () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]) // "%PDF-"
    const result = await invoke<{ success: boolean; error?: string }>(
      'image:upload',
      pdf.buffer,
      'doc.pdf'
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('Unsupported image format')
  })
})

describe('image:upload IPC handler — pipeline', () => {
  beforeEach(() => {
    electronMock.app.getPath.mockImplementation((name: string) =>
      name === 'userData' ? tempDir : '/tmp'
    )
  })

  it('writes WebP variants and returns a populated manifest entry', async () => {
    const png = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: { r: 10, g: 60, b: 120 } },
    })
      .png()
      .toBuffer()

    const result = await invoke<{
      success: boolean
      asset?: {
        id: string
        mimeType: string
        originalFilename: string
        width: number
        height: number
        srcset: Record<number, string>
      }
      error?: string
    }>(
      'image:upload',
      png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      'hero.png'
    )

    expect(result.success).toBe(true)
    expect(result.asset).toBeDefined()
    const asset = result.asset!
    expect(asset.mimeType).toBe('image/png')
    expect(asset.originalFilename).toBe('hero.png')
    expect(asset.width).toBe(1600)
    expect(asset.height).toBe(900)
    expect(
      Object.keys(asset.srcset)
        .map(Number)
        .sort((a, b) => a - b)
    ).toEqual([400, 800, 1200, 1600])

    const dtwAssetsDir = join(tempDir, 'dtw-assets')
    const onDisk = (await readdir(dtwAssetsDir)).sort()
    expect(onDisk).toEqual([400, 800, 1200, 1600].map((w) => `${asset.id}-${w}.webp`).sort())
  })

  it('strips path components from the supplied filename', async () => {
    const png = await sharp({
      create: { width: 400, height: 400, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer()

    const result = await invoke<{ success: boolean; asset?: { originalFilename: string } }>(
      'image:upload',
      png.buffer.slice(png.byteOffset, png.byteOffset + png.byteLength),
      '../../etc/passwd.png'
    )

    expect(result.success).toBe(true)
    expect(result.asset?.originalFilename).toBe('passwd.png')
  })

  it('passes SVG bytes through unchanged', async () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><circle cx="24" cy="24" r="20"/></svg>'
    )

    const result = await invoke<{
      success: boolean
      asset?: { mimeType: string; width: number; srcset: Record<number, string>; id: string }
    }>('image:upload', svg.buffer, 'icon.svg')

    expect(result.success).toBe(true)
    expect(result.asset?.mimeType).toBe('image/svg+xml')
    expect(result.asset?.width).toBe(48)
    expect(result.asset?.srcset[48]).toBe(`assets/${result.asset!.id}.svg`)
    const written = await readFile(join(tempDir, 'dtw-assets', `${result.asset!.id}.svg`))
    expect(written.toString('utf8')).toContain('<svg')
  })

  it('returns a structured error when sharp cannot decode the input', async () => {
    // A buffer that passes the PNG magic sniff but has no valid IHDR chunk
    // — sharp will reject it during metadata extraction.
    const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
    const result = await invoke<{ success: boolean; error?: string }>(
      'image:upload',
      fakePng.buffer,
      'broken.png'
    )
    expect(result.success).toBe(false)
    expect(typeof result.error).toBe('string')
    expect(result.error?.length).toBeGreaterThan(0)
  })
})

// ───────────── recent:list / recent:add ─────────────

describe('recent files IPC', () => {
  beforeEach(() => {
    // Redirect userData to the per-test tempDir so recent.json lands somewhere
    // we can assert against and clean up.
    electronMock.app.getPath.mockImplementation((name: string) =>
      name === 'userData' ? tempDir : '/tmp'
    )
  })

  it('returns an empty list when no recent.json exists', async () => {
    const list = await invoke<readonly { path: string }[]>('recent:list')
    expect(list).toEqual([])
  })

  it('adds a file, MRU-sorts it, and persists it to disk', async () => {
    const projectPath = join(tempDir, 'demo.dtw')
    await writeFile(projectPath, '{}', 'utf8')

    const list = await invoke<readonly { path: string; name: string }[]>('recent:add', projectPath)
    expect(list).toHaveLength(1)
    expect(list[0].path).toBe(projectPath)
    expect(list[0].name).toBe('demo.dtw')

    // The follow-up `recent:list` reads the file from disk.
    const reloaded = await invoke<readonly { path: string }[]>('recent:list')
    expect(reloaded).toHaveLength(1)
    expect(reloaded[0].path).toBe(projectPath)
  })

  it('dedupes by path and keeps the MRU entry on top', async () => {
    const a = join(tempDir, 'a.dtw')
    const b = join(tempDir, 'b.dtw')
    await invoke('recent:add', a)
    await invoke('recent:add', b)
    const list = await invoke<readonly { path: string }[]>('recent:add', a)
    expect(list.map((e) => e.path)).toEqual([a, b])
  })

  it('caps the list at 10 entries', async () => {
    for (let i = 0; i < 12; i += 1) {
      await invoke('recent:add', join(tempDir, `p${i}.dtw`))
    }
    const list = await invoke<readonly { path: string }[]>('recent:list')
    expect(list).toHaveLength(10)
    // Most recent insert is at the front.
    expect(list[0].path).toBe(join(tempDir, 'p11.dtw'))
  })

  it('rejects non-string filePath arguments without throwing', async () => {
    const list = await invoke<readonly unknown[]>('recent:add', 42)
    expect(list).toEqual([])
  })

  it('survives a malformed recent.json on disk', async () => {
    await writeFile(join(tempDir, 'recent.json'), 'not-json', 'utf8')
    const list = await invoke<readonly unknown[]>('recent:list')
    expect(list).toEqual([])
  })
})

// ───────────── recent-files auto-population + open-by-path (I-ELE-07) ─────────────

describe('recent files auto-population on save / open', () => {
  beforeEach(() => {
    electronMock.app.getPath.mockImplementation((name: string) =>
      name === 'userData' ? tempDir : '/tmp'
    )
  })

  it('project:save pushes the saved path onto the recent list', async () => {
    const filePath = join(tempDir, 'saved.dtw')
    electronMock.dialog.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath })

    await invoke('project:save', JSON.stringify({ version: 1 }), 'saved')

    const list = await invoke<readonly { path: string }[]>('recent:list')
    expect(list.map((e) => e.path)).toEqual([filePath])
  })

  it('project:open pushes the opened path onto the recent list', async () => {
    const filePath = join(tempDir, 'opened.dtw')
    await writeFile(filePath, '{}', 'utf8')
    electronMock.dialog.showOpenDialog.mockResolvedValueOnce({
      canceled: false,
      filePaths: [filePath],
    })

    await invoke('project:open')

    const list = await invoke<readonly { path: string }[]>('recent:list')
    expect(list.map((e) => e.path)).toEqual([filePath])
  })

  it('a canceled save leaves the recent list untouched', async () => {
    electronMock.dialog.showSaveDialog.mockResolvedValueOnce({ canceled: true })
    await invoke('project:save', '{}', 'x')
    const list = await invoke<readonly unknown[]>('recent:list')
    expect(list).toEqual([])
  })
})

describe('project:open-path IPC handler', () => {
  beforeEach(() => {
    electronMock.app.getPath.mockImplementation((name: string) =>
      name === 'userData' ? tempDir : '/tmp'
    )
  })

  it('reads a .dtw file by absolute path and bumps it in recents', async () => {
    const filePath = join(tempDir, 'byPath.dtw')
    const json = JSON.stringify({ version: 1, elements: [] })
    await writeFile(filePath, json, 'utf8')

    const result = await invoke<{ success: boolean; json?: string; filePath?: string }>(
      'project:open-path',
      filePath
    )
    expect(result.success).toBe(true)
    expect(result.json).toBe(json)
    expect(result.filePath).toBe(filePath)

    const list = await invoke<readonly { path: string }[]>('recent:list')
    expect(list.map((e) => e.path)).toEqual([filePath])
  })

  it('rejects a non-string path without throwing', async () => {
    const result = await invoke<{ success: boolean; error?: string }>('project:open-path', 42)
    expect(result.success).toBe(false)
    expect(result.error).toBe('Invalid path')
  })

  it('rejects files without the .dtw extension', async () => {
    const filePath = join(tempDir, 'note.txt')
    await writeFile(filePath, '{}', 'utf8')
    const result = await invoke<{ success: boolean; error?: string }>('project:open-path', filePath)
    expect(result.success).toBe(false)
    expect(result.error).toContain('.dtw')
  })

  it('prunes a stale entry and fails when the file no longer exists', async () => {
    const ghost = join(tempDir, 'ghost.dtw')
    // Seed it into recents, then open by path while it is absent on disk.
    await invoke('recent:add', ghost)
    expect(await invoke<readonly unknown[]>('recent:list')).toHaveLength(1)

    const result = await invoke<{ success: boolean; error?: string }>('project:open-path', ghost)
    expect(result.success).toBe(false)
    expect(result.error).toContain('no longer exists')

    const list = await invoke<readonly unknown[]>('recent:list')
    expect(list).toEqual([])
  })
})

// ───────────── watcher:start / watcher:stop (I-ELE-06) ─────────────

describe('watcher IPC handlers', () => {
  /** Build a minimal `event` carrying a `sender.send` spy + `isDestroyed`. */
  function fakeSender() {
    const send = vi.fn()
    return { send, event: { sender: { send, isDestroyed: () => false } } }
  }

  /** Drive the handler with a custom event (the default helper supplies `{}`). */
  async function invokeWithSender<T>(
    channel: string,
    event: unknown,
    ...args: unknown[]
  ): Promise<T> {
    const handler = handlers.get(channel)
    if (!handler) throw new Error(`No handler registered for ${channel}`)
    return Promise.resolve(handler(event, ...args) as T)
  }

  /** Spin until the predicate is true or the timeout elapses. */
  async function waitFor(pred: () => boolean, timeoutMs = 4000): Promise<void> {
    const start = Date.now()
    while (!pred()) {
      if (Date.now() - start > timeoutMs) throw new Error('waitFor timeout')
      await new Promise((r) => setTimeout(r, 25))
    }
  }

  afterEach(async () => {
    // Tear down whatever watcher the test left behind so subsequent tests
    // don't share state (the handler keeps a module-level watcher).
    try {
      await invoke('watcher:stop')
    } catch {
      // ignore
    }
  })

  it('rejects non-string paths', async () => {
    const { event } = fakeSender()
    const result = await invokeWithSender<{ success: boolean; error?: string }>(
      'watcher:start',
      event,
      42
    )
    expect(result.success).toBe(false)
  })

  it('rejects extensions other than .dtw', async () => {
    const wrong = join(tempDir, 'project.txt')
    await writeFile(wrong, '{}', 'utf8')
    const { event } = fakeSender()
    const result = await invokeWithSender<{ success: boolean; error?: string }>(
      'watcher:start',
      event,
      wrong
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/dtw/i)
  })

  it('rejects missing files', async () => {
    const { event } = fakeSender()
    const result = await invokeWithSender<{ success: boolean; error?: string }>(
      'watcher:start',
      event,
      join(tempDir, 'nope.dtw')
    )
    expect(result.success).toBe(false)
    expect(result.error).toMatch(/exist/i)
  })

  it('fires file:changed when the watched file is written externally', async () => {
    const projectPath = join(tempDir, 'live.dtw')
    await writeFile(projectPath, '{"version":"0.2.0"}', 'utf8')

    const { send, event } = fakeSender()
    const result = await invokeWithSender<{ success: boolean }>('watcher:start', event, projectPath)
    expect(result.success).toBe(true)

    // Chokidar needs a tick to attach its fs.watch handle before the
    // first event will be observed.
    await new Promise((r) => setTimeout(r, 200))
    await writeFile(projectPath, '{"version":"0.2.0","ping":1}', 'utf8')

    await waitFor(() => send.mock.calls.length > 0)
    const [channel, firedPath] = send.mock.calls[0]
    expect(channel).toBe('file:changed')
    expect(firedPath).toBe(projectPath)
  }, 10_000)

  it('watcher:stop tears down the watcher and is idempotent', async () => {
    // First call without an active watcher still succeeds.
    const idle = await invoke<{ success: boolean; filePath?: string | null }>('watcher:stop')
    expect(idle.success).toBe(true)

    const projectPath = join(tempDir, 'closeable.dtw')
    await writeFile(projectPath, '{}', 'utf8')
    const { event } = fakeSender()
    await invokeWithSender('watcher:start', event, projectPath)

    const stopped = await invoke<{ success: boolean; filePath?: string | null }>('watcher:stop')
    expect(stopped.success).toBe(true)
    expect(stopped.filePath).toBe(projectPath)
  }, 10_000)

  it('starting a new watcher tears down the previous one', async () => {
    const first = join(tempDir, 'first.dtw')
    const second = join(tempDir, 'second.dtw')
    await writeFile(first, '{}', 'utf8')
    await writeFile(second, '{}', 'utf8')

    const a = fakeSender()
    const b = fakeSender()
    await invokeWithSender('watcher:start', a.event, first)
    await invokeWithSender('watcher:start', b.event, second)

    await new Promise((r) => setTimeout(r, 200))
    // Modifying `first` should now be silent (its watcher was closed); a
    // modification to `second` should fire on the second sender.
    await writeFile(first, '{"x":1}', 'utf8')
    await writeFile(second, '{"y":1}', 'utf8')
    await waitFor(() => b.send.mock.calls.length > 0)
    expect(a.send).not.toHaveBeenCalled()
    expect(b.send.mock.calls[0][0]).toBe('file:changed')
    expect(b.send.mock.calls[0][1]).toBe(second)
  }, 10_000)
})
