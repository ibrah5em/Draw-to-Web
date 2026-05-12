import { ipcMain, dialog, app } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { extname, join, normalize, isAbsolute } from 'path'

const MAX_ZIP_BYTES = 50 * 1024 * 1024 // 50 MB
const MAX_PROJECT_BYTES = 10 * 1024 * 1024 // 10 MB — well above expected element-tree size
const PROJECT_EXT = 'dtw'

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

  // Synchronous — called once at preload startup to stamp the version into the bridge.
  ipcMain.on('app:version', (event) => {
    event.returnValue = app.getVersion()
  })
}
