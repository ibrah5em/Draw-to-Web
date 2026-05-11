interface ElectronAPI {
  exportZip: (
    zipBuffer: ArrayBuffer,
    filename: string
  ) => Promise<{ success: boolean; filePath?: string }>
}

declare interface Window {
  electronAPI: ElectronAPI
}
