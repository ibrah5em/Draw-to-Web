import { ipcMain, dialog, app } from 'electron'
import { writeFile } from 'fs/promises'
import { join, normalize, isAbsolute } from 'path'

const MAX_ZIP_BYTES = 50 * 1024 * 1024 // 50 MB

/** Sanitizes a user-supplied save path to prevent traversal attacks. */
function sanitizePath(rawPath: string): string | null {
  const normalized = normalize(rawPath)
  // Reject non-absolute or traversal attempts
  if (!isAbsolute(normalized) || normalized.includes('..')) return null
  return normalized
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

  // Synchronous — called once at preload startup to stamp the version into the bridge.
  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion()
  })
}
