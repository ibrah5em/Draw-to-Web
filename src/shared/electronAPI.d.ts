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
  /** Serializes the project (JSON string) and prompts for a save location. */
  saveProject: (
    json: string,
    suggestedName: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  /** Prompts for a .dtw file and returns its JSON content. */
  openProject: () => Promise<{
    success: boolean
    filePath?: string
    json?: string
    error?: string
  }>
  /** Returns the application version string (synchronous, stamped at preload startup). */
  getAppVersion: () => string
  /** Subscribes to menu actions sent from the main process. Returns an unsubscribe function. */
  onMenuAction: (callback: (action: string) => void) => () => void
  /** Runs axe-core against an HTML string in the main process and returns the accessibility report. */
  runAxe: (html: string) => Promise<import('./types').AccessibilityReport>
}

declare interface Window {
  electronAPI: ElectronAPI
}
