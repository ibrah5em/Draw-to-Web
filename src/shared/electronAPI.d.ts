import type { AssetManifestEntry } from '../document/types'

interface SaveDialogOptions {
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

/**
 * Outcome of `uploadImage`. On success the renderer receives an
 * `AssetManifestEntry` (the same shape the document stores against
 * `document.assets`). On failure a structured error message is surfaced.
 */
export type ImageUploadResult =
  | { success: true; asset: AssetManifestEntry }
  | { success: false; error: string }

/**
 * Persisted recent-files entry. The renderer surfaces this list in the
 * File menu / Welcome dialog (L-TOP-* territory). MRU order.
 */
export interface RecentFile {
  path: string
  name: string
  /** ISO-8601 timestamp of the last open / save. */
  lastOpened: string
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
  /** Opens the live preview window, or focuses it if already open. */
  openPreviewWindow: () => Promise<void>
  /** Sends updated HTML+CSS to the live preview window for rendering. */
  updatePreview: (html: string, css: string) => Promise<void>
  /** Subscribes to the preview window closed event. Returns an unsubscribe function. */
  onPreviewClosed: (callback: () => void) => () => void
  /**
   * Uploads an image buffer to the main-process pipeline (C11). On success the
   * returned manifest entry carries the asset id, dimensions, and srcset of
   * WebP variants the generator can reference. The full pipeline lands with
   * I-ELE-05; until then the handler returns a structured "not installed"
   * error so callers can render a graceful fallback.
   */
  uploadImage: (buffer: ArrayBuffer, filename: string) => Promise<ImageUploadResult>
  /**
   * Subscribes to external file-change notifications for the currently open
   * `.dtw` project (I-ELE-06). Fires with the absolute file path that
   * changed. The chokidar watcher lands with I-ELE-06; until then the
   * subscription is wired but no events fire.
   */
  onFileChanged: (callback: (filePath: string) => void) => () => void
  /** Returns the persisted MRU list of recently opened projects. */
  listRecentFiles: () => Promise<readonly RecentFile[]>
  /**
   * Pushes a file path to the recent-files list (deduped, MRU-sorted, capped
   * at 10). Returns the updated list so callers can refresh the UI without a
   * second round-trip.
   */
  addRecentFile: (filePath: string) => Promise<readonly RecentFile[]>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
