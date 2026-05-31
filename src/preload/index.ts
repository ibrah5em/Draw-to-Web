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

  openProjectByPath: (filePath: string) => ipcRenderer.invoke('project:open-path', filePath),

  getAppVersion: () => APP_VERSION,

  onMenuAction: (callback: (action: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) => callback(action)
    ipcRenderer.on('menu:action', handler)
    return () => ipcRenderer.removeListener('menu:action', handler)
  },

  runAxe: (html: string) => ipcRenderer.invoke('a11y:run-axe', html),

  openPreviewWindow: () => ipcRenderer.invoke('preview:open'),

  updatePreview: (html: string, css: string) => ipcRenderer.invoke('preview:update', html, css),

  onPreviewClosed: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('preview:closed', handler)
    return () => ipcRenderer.removeListener('preview:closed', handler)
  },

  uploadImage: (buffer: ArrayBuffer, filename: string) =>
    ipcRenderer.invoke('image:upload', buffer, filename),

  onFileChanged: (callback: (filePath: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, filePath: string) => callback(filePath)
    ipcRenderer.on('file:changed', handler)
    return () => ipcRenderer.removeListener('file:changed', handler)
  },

  listRecentFiles: () => ipcRenderer.invoke('recent:list'),

  addRecentFile: (filePath: string) => ipcRenderer.invoke('recent:add', filePath),

  readImageAssets: (paths: readonly string[]) => ipcRenderer.invoke('assets:read-images', paths),

  minifyHtml: (html: string) => ipcRenderer.invoke('minify:html', html),
  minifyCss: (css: string) => ipcRenderer.invoke('minify:css', css),
  minifyJs: (js: string) => ipcRenderer.invoke('minify:js', js),

  watchProject: (filePath: string) => ipcRenderer.invoke('watcher:start', filePath),
  unwatchProject: () => ipcRenderer.invoke('watcher:stop'),
})
