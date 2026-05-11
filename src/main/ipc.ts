import { ipcMain, dialog, app } from 'electron'
import { writeFile } from 'fs/promises'
import { join } from 'path'

/** Registers all IPC handlers. Call once on app ready. */
export function registerIpcHandlers(): void {
  ipcMain.handle('export:zip', async (_event, zipBuffer: ArrayBuffer, filename: string) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: join(app.getPath('downloads'), filename),
      filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
    })

    if (canceled || !filePath) return { success: false }

    await writeFile(filePath, Buffer.from(zipBuffer))
    return { success: true, filePath }
  })
}
