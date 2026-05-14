import { contextBridge, ipcRenderer } from 'electron'

// Stamped synchronously at preload startup — avoids an async round-trip for a static value.
const APP_VERSION = ipcRenderer.sendSync('app:version') as string

contextBridge.exposeInMainWorld('electronAPI', {
  exportZip: (zipBuffer: ArrayBuffer, filename: string) =>
    ipcRenderer.invoke('export:zip', zipBuffer, filename),

  showSaveDialog: (options: {
    defaultPath?: string
    filters?: Array<{ name: string; extensions: string[] }>
  }) => ipcRenderer.invoke('dialog:save', options),

  saveProject: (json: string, suggestedName: string) =>
    ipcRenderer.invoke('project:save', json, suggestedName),

  openProject: () => ipcRenderer.invoke('project:open'),

  getAppVersion: () => APP_VERSION,

  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  },

  runAxe: (html: string) => ipcRenderer.invoke('a11y:run-axe', html),
})
