import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  exportZip: (zipBuffer: ArrayBuffer, filename: string) =>
    ipcRenderer.invoke('export:zip', zipBuffer, filename)
})
