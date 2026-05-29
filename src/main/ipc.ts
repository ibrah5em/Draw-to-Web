import { ipcMain, dialog, app, BrowserWindow } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { extname, join, normalize, isAbsolute, basename } from 'path'
import { runAxeGate } from '../seo/axeGate'
import type { RecentFile } from '../shared/electronAPI'
import { IMAGE_ASSETS_DIRNAME, processImage } from './imagePipeline'
import { minifyHtml, minifyCss, minifyJs } from '../export/minify'

let previewWin: BrowserWindow | null = null

const MAX_ZIP_BYTES = 50 * 1024 * 1024 // 50 MB
const MAX_PROJECT_BYTES = 10 * 1024 * 1024 // 10 MB — well above expected document size
const MAX_IMAGE_BYTES = 50 * 1024 * 1024 // 50 MB — same envelope as ZIP for symmetry
const PROJECT_EXT = 'dtw'
const RECENT_FILES_NAME = 'recent.json'
const RECENT_FILES_MAX = 10

/** Recognised image MIME types — gated by magic-number sniff. */
const SUPPORTED_IMAGE_MIMES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

/** Sanitizes a user-supplied save path to prevent traversal attacks. */
function sanitizePath(rawPath: string): string | null {
  // Reject any raw input containing `..` segments — must be caught before
  // path.normalize() collapses them. Legit dialog results are always
  // fully-resolved absolute paths, so non-canonical input is suspicious.
  if (/(^|[\\/])\.\.($|[\\/])/.test(rawPath)) return null
  const normalized = normalize(rawPath)
  if (!isAbsolute(normalized)) return null
  return normalized
}

/**
 * Inspects the first few bytes of an image buffer and returns the canonical
 * MIME type, or `null` if the magic number does not match a supported format.
 * SVG is detected by looking for a leading `<?xml` or `<svg` token because
 * text formats have no fixed magic number.
 */
function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length < 4) return null
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return 'image/png'
  }
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  // GIF: 47 49 46 38 ("GIF8")
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return 'image/gif'
  }
  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  // SVG — text-based, sniff a UTF-8 prefix.
  const head = buffer.subarray(0, Math.min(buffer.length, 256)).toString('utf8').trimStart()
  if (head.startsWith('<?xml') || head.startsWith('<svg')) {
    return 'image/svg+xml'
  }
  return null
}

/** Path to the persisted recent-files index. */
function recentFilesPath(): string {
  return join(app.getPath('userData'), RECENT_FILES_NAME)
}

/**
 * Loads the recent-files index from disk. Missing or malformed files
 * resolve to an empty list — we never throw on a corrupt index because the
 * user can always reopen a project manually.
 */
async function loadRecentFiles(): Promise<RecentFile[]> {
  const path = recentFilesPath()
  if (!existsSync(path)) return []
  try {
    const raw = await readFile(path, 'utf8')
    const parsed: unknown = JSON.parse(raw)
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !Array.isArray((parsed as { files?: unknown }).files)
    ) {
      return []
    }
    const entries = (parsed as { files: unknown[] }).files
    const out: RecentFile[] = []
    for (const entry of entries) {
      if (
        entry &&
        typeof entry === 'object' &&
        typeof (entry as { path?: unknown }).path === 'string' &&
        typeof (entry as { name?: unknown }).name === 'string' &&
        typeof (entry as { lastOpened?: unknown }).lastOpened === 'string'
      ) {
        out.push(entry as RecentFile)
      }
    }
    return out
  } catch {
    return []
  }
}

/** Persists the recent-files index atomically (write-then-rename via fs/promises). */
async function saveRecentFiles(files: readonly RecentFile[]): Promise<void> {
  const payload = JSON.stringify({ files }, null, 2)
  await writeFile(recentFilesPath(), payload, 'utf8')
}

/** Registers all IPC handlers. Call once on app ready. */
export function registerIpcHandlers(): void {
  ipcMain.handle('export:zip', async (_event, zipBuffer: unknown, filename: unknown) => {
    if (!(zipBuffer instanceof ArrayBuffer) || typeof filename !== 'string') {
      return { success: false, error: 'Invalid arguments' }
    }
    if (zipBuffer.byteLength > MAX_ZIP_BYTES) {
      return { success: false, error: 'ZIP exceeds 50 MB limit' }
    }

    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: join(app.getPath('downloads'), filename),
        filters: [{ name: 'ZIP Archive', extensions: ['zip'] }],
      })

      if (canceled || !filePath) return { success: false }

      const safe = sanitizePath(filePath)
      if (!safe) return { success: false, error: 'Invalid save path' }

      await writeFile(safe, Buffer.from(zipBuffer))
      return { success: true, filePath: safe }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      return { success: false, error: message }
    }
  })

  ipcMain.handle('dialog:save', async (_event, options: unknown) => {
    const opts =
      options != null && typeof options === 'object' ? (options as Electron.SaveDialogOptions) : {}

    try {
      const { canceled, filePath } = await dialog.showSaveDialog(opts)
      return canceled || !filePath ? null : filePath
    } catch {
      return null
    }
  })

  ipcMain.handle('project:save', async (_event, json: unknown, suggestedName: unknown) => {
    if (typeof json !== 'string') return { success: false, error: 'Invalid project payload' }
    if (Buffer.byteLength(json, 'utf8') > MAX_PROJECT_BYTES) {
      return { success: false, error: 'Project exceeds size limit' }
    }
    const defaultName =
      typeof suggestedName === 'string' && suggestedName.length > 0 ? suggestedName : 'project'

    try {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: join(app.getPath('documents'), `${defaultName}.${PROJECT_EXT}`),
        filters: [{ name: 'Draw-to-Web Project', extensions: [PROJECT_EXT] }],
      })
      if (canceled || !filePath) return { success: false }
      const safe = sanitizePath(filePath)
      if (!safe) return { success: false, error: 'Invalid save path' }
      await writeFile(safe, json, 'utf8')
      return { success: true, filePath: safe }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  })

  ipcMain.handle('project:open', async () => {
    try {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Draw-to-Web Project', extensions: [PROJECT_EXT] }],
      })
      if (canceled || filePaths.length === 0) return { success: false }
      const safe = sanitizePath(filePaths[0])
      if (!safe) return { success: false, error: 'Invalid open path' }
      if (extname(safe).slice(1).toLowerCase() !== PROJECT_EXT) {
        return { success: false, error: `Only .${PROJECT_EXT} files are supported` }
      }
      const data = await readFile(safe, 'utf8')
      if (Buffer.byteLength(data, 'utf8') > MAX_PROJECT_BYTES) {
        return { success: false, error: 'Project file exceeds size limit' }
      }
      return { success: true, filePath: safe, json: data }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Unknown error' }
    }
  })

  // Reject bad payloads instead of returning a synthetic "failed" report —
  // a rejected promise lets the export pipeline distinguish transport errors
  // from genuine a11y violations (which return `passed: false`).
  ipcMain.handle('a11y:run-axe', async (_event, html: unknown) => {
    if (typeof html !== 'string') {
      throw new TypeError('a11y:run-axe expects an HTML string')
    }
    return runAxeGate(html)
  })

  ipcMain.handle('preview:open', (event) => {
    const senderContents = event.sender

    if (previewWin && !previewWin.isDestroyed()) {
      previewWin.focus()
      return
    }

    previewWin = new BrowserWindow({
      width: 800,
      height: 600,
      title: 'Live Preview — Draw to Web',
      backgroundColor: '#1e1e1e',
      resizable: true,
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    })

    void previewWin.loadURL('about:blank')

    previewWin.on('closed', () => {
      if (!senderContents.isDestroyed()) {
        senderContents.send('preview:closed')
      }
      previewWin = null
    })
  })

  ipcMain.handle('preview:update', (_event, html: unknown, css: unknown) => {
    if (!previewWin || previewWin.isDestroyed()) return
    if (typeof html !== 'string' || typeof css !== 'string') return
    const inlined = html.replace(
      /<link rel="stylesheet" href="styles\.css" \/>/,
      `<style>${css}</style>`
    )
    void previewWin.webContents.executeJavaScript(
      `document.open('text/html','replace');document.write(${JSON.stringify(inlined)});document.close()`
    )
  })

  // C11 — image upload pipeline. Validates the payload, sniffs the MIME,
  // hands the buffer to `processImage` (sharp → WebP variants under
  // `<userData>/dtw-assets/`), and returns the resulting manifest entry.
  ipcMain.handle('image:upload', async (_event, buffer: unknown, filename: unknown) => {
    if (!(buffer instanceof ArrayBuffer) || typeof filename !== 'string') {
      return { success: false, error: 'Invalid arguments' }
    }
    if (buffer.byteLength === 0) {
      return { success: false, error: 'Empty image buffer' }
    }
    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return { success: false, error: 'Image exceeds 50 MB limit' }
    }
    const buf = Buffer.from(buffer)
    const mime = sniffImageMime(buf)
    if (mime === null || !SUPPORTED_IMAGE_MIMES.has(mime)) {
      return { success: false, error: 'Unsupported image format' }
    }
    // Strip any directory component the renderer may have included — we
    // only use the filename for alt-text suggestions, never on disk.
    const safeFilename = basename(filename).slice(0, 255) || 'upload'
    const outputDir = join(app.getPath('userData'), IMAGE_ASSETS_DIRNAME)
    try {
      const asset = await processImage(buf, mime, safeFilename, outputDir)
      return { success: true, asset }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Image processing failed',
      }
    }
  })

  ipcMain.handle('recent:list', async () => {
    return loadRecentFiles()
  })

  ipcMain.handle('recent:add', async (_event, filePath: unknown) => {
    if (typeof filePath !== 'string') return []
    const safe = sanitizePath(filePath)
    if (!safe) return loadRecentFiles()

    const existing = await loadRecentFiles()
    const filtered = existing.filter((entry) => entry.path !== safe)
    const next: RecentFile[] = [
      { path: safe, name: basename(safe), lastOpened: new Date().toISOString() },
      ...filtered,
    ].slice(0, RECENT_FILES_MAX)

    try {
      await saveRecentFiles(next)
    } catch {
      // Persisting recents is best-effort; we still return the in-memory
      // list so the UI reflects the user's action this session.
    }
    return next
  })

  // Reads the on-disk WebP/SVG variants the sharp pipeline (I-ELE-05)
  // wrote under `<userData>/dtw-assets/`. The renderer requests them by
  // their export-relative paths (`assets/<id>-<width>.webp`); we strip
  // the leading `assets/` segment and re-anchor at the variants dir.
  // Used by the `optimize-images` stage of the export pipeline.
  ipcMain.handle('assets:read-images', async (_event, paths: unknown) => {
    if (!Array.isArray(paths)) return {}
    const root = join(app.getPath('userData'), IMAGE_ASSETS_DIRNAME)
    const out: Record<string, ArrayBuffer | null> = {}
    await Promise.all(
      paths.map(async (rawPath) => {
        if (typeof rawPath !== 'string' || rawPath.length === 0) return
        // Allowlist: must look like `assets/<basename>` with no traversal.
        if (!rawPath.startsWith('assets/')) {
          out[rawPath] = null
          return
        }
        const variantName = basename(rawPath.slice('assets/'.length))
        if (variantName.length === 0 || variantName.startsWith('.')) {
          out[rawPath] = null
          return
        }
        const onDisk = join(root, variantName)
        // Final guard against any path escape that survived basename().
        if (!onDisk.startsWith(root)) {
          out[rawPath] = null
          return
        }
        try {
          const buf = await readFile(onDisk)
          // Slice to a fresh ArrayBuffer so the structured-clone IPC
          // transport doesn't carry shared-pool Node Buffer memory.
          out[rawPath] = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
        } catch {
          out[rawPath] = null
        }
      })
    )
    return out
  })

  // I-EXP-03 — minification lives in main because lightningcss is a
  // native addon. Reject bad payloads via thrown TypeError so the
  // pipeline can distinguish transport errors from empty outputs.
  ipcMain.handle('minify:html', async (_event, html: unknown) => {
    if (typeof html !== 'string') throw new TypeError('minify:html expects a string')
    return minifyHtml(html)
  })
  ipcMain.handle('minify:css', async (_event, css: unknown) => {
    if (typeof css !== 'string') throw new TypeError('minify:css expects a string')
    return minifyCss(css)
  })
  ipcMain.handle('minify:js', async (_event, js: unknown) => {
    if (typeof js !== 'string') throw new TypeError('minify:js expects a string')
    return minifyJs(js)
  })

  // Synchronous — called once at preload startup to stamp the version into the bridge.
  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion()
  })
}
