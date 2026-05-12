interface SaveDialogOptions {
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

interface ElectronAPI {
  /** Packages HTML+CSS into a ZIP and triggers the native save dialog. */
  exportZip: (
    zipBuffer: ArrayBuffer,
    filename: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  /** Opens a native save dialog and returns the chosen path, or null if canceled. */
  showSaveDialog: (options: SaveDialogOptions) => Promise<string | null>
  /** Returns the application version string (synchronous, stamped at preload startup). */
  getAppVersion: () => string
  /** Subscribes to menu actions sent from the main process. Returns an unsubscribe function. */
  onMenuAction: (callback: (action: string) => void) => () => void
}

declare interface Window {
  electronAPI: ElectronAPI
}
