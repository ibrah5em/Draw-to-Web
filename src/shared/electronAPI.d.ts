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
  /**
   * Opens a `.dtw` project by absolute path without a dialog — backs the
   * Recent-files list (I-ELE-07). Runs the same validation as `openProject`
   * (sanitize → `.dtw` extension → existence → 10 MB cap) and refreshes the
   * MRU entry on success. A stale path (file moved / deleted) resolves to
   * `{ success: false }` and is pruned from the recent list.
   */
  openProjectByPath: (filePath: string) => Promise<{
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
   * changed when the active watcher (see `watchProject`) detects a
   * `change` or `unlink` event.
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
  /**
   * Reads on-disk image-variant bytes for the export-relative paths produced
   * by the sharp pipeline (I-ELE-05). Each path looks like
   * `assets/<assetId>-<width>.webp` (or `.svg`). The handler strips the
   * leading `assets/` prefix and reads from `<userData>/dtw-assets/`.
   * Missing or unreadable entries map to `null` so the renderer can decide
   * how to surface the gap (broken asset vs. transport error). Used by the
   * `optimize-images` stage of the export pipeline.
   */
  readImageAssets: (paths: readonly string[]) => Promise<Record<string, ArrayBuffer | null>>
  /**
   * Minifies an HTML string in the main process (I-EXP-03). Native bindings
   * (`html-minifier-terser` is pure JS but is wired alongside lightningcss
   * for symmetry) live outside the sandboxed renderer.
   */
  minifyHtml: (html: string) => Promise<string>
  /** Minifies a CSS string via `lightningcss` in the main process. */
  minifyCss: (css: string) => Promise<string>
  /** Minifies a JS string via `terser` in the main process. */
  minifyJs: (js: string) => Promise<string>
  /**
   * Begin watching a `.dtw` project file for external changes (I-ELE-06).
   * Tears down any previous watcher first — only one project is open at
   * a time. While the watcher is active, edits made outside the editor
   * fire the `onFileChanged` subscription so the renderer can prompt the
   * user to reload. Returns `{ success: true, filePath }` once the
   * watcher is armed, or `{ success: false, error }` on a bad path.
   */
  watchProject: (
    filePath: string
  ) => Promise<{ success: boolean; filePath?: string; error?: string }>
  /**
   * Stop the active project watcher (I-ELE-06). Idempotent — calling
   * with no watcher running succeeds and returns `filePath: null`.
   */
  unwatchProject: () => Promise<{ success: boolean; filePath?: string | null }>
  /**
   * Host OS platform (`process.platform`). Surfaced so the custom title bar
   * (Task 3) can adapt per-platform — macOS keeps native traffic lights and
   * hides the custom window controls.
   */
  platform:
    | 'aix'
    | 'android'
    | 'darwin'
    | 'freebsd'
    | 'haiku'
    | 'linux'
    | 'openbsd'
    | 'sunos'
    | 'win32'
    | 'cygwin'
    | 'netbsd'
  /** Minimizes the host window (custom title-bar control). */
  minimizeWindow: () => void
  /** Toggles maximize/restore on the host window (custom title-bar control). */
  maximizeWindow: () => void
  /** Closes the host window (custom title-bar control). */
  closeWindow: () => void
  /** Resolves to whether the host window is currently maximized. */
  isWindowMaximized: () => Promise<boolean>
  /**
   * Subscribes to host-window maximize/unmaximize transitions so the custom
   * title bar's maximize icon stays in sync with OS-driven changes. Returns an
   * unsubscribe function.
   */
  onWindowMaximizedChange: (callback: (maximized: boolean) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

export {}
