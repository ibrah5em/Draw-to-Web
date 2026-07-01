/**
 * Headless Electron save-seam shim.
 *
 * The export pipeline (`src/export/index.ts`) is fully headless EXCEPT its
 * final `save` stage, which calls `window.electronAPI.exportZip(buffer,
 * filename)` to hand the ZIP bytes to the main process. Running the pipeline
 * from a plain Node process (this MCP server) means there is no `window`.
 *
 * Rather than fork the pipeline, we install a minimal `globalThis.window`
 * exposing ONLY `exportZip`, which writes the buffer to disk via `fs`. Every
 * other `window` branch in the pipeline degrades correctly with just this key
 * present:
 *
 *   - `runAxeGate` checks `window.electronAPI?.runAxe` → undefined → runs the
 *     Node/jsdom path (axe executes inside jsdom's own window, not this one).
 *   - `minify*` check `window.electronAPI?.minify*` → undefined → Node path.
 *   - `readImageAssets` checks `window.electronAPI?.readImageAssets` →
 *     undefined → returns `{}` (AI-built documents carry no image assets).
 *
 * So the entire real pipeline — including the axe-core a11y gate — runs
 * unchanged; only the save IO is swapped from IPC to `fs`.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'

/** Result shape the export pipeline expects back from `exportZip`. */
interface ExportZipResult {
  readonly success: boolean
  readonly filePath?: string
  readonly error?: string
}

/**
 * Install the headless `window.electronAPI.exportZip` seam. Idempotent: a
 * second call replaces the resolver. Buffers are written under `outDir`
 * (created on demand); an absolute `filename` is honoured as-is.
 *
 * @param outDir - Directory ZIP bundles are written into.
 */
export function installExportShim(outDir: string): void {
  const exportZip = async (buffer: ArrayBuffer, filename: string): Promise<ExportZipResult> => {
    try {
      const filePath = isAbsolute(filename) ? filename : join(outDir, filename)
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, Buffer.from(buffer))
      return { success: true, filePath }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  const target = globalThis as unknown as { window?: { electronAPI?: unknown } }
  target.window = { ...(target.window ?? {}), electronAPI: { exportZip } }
}
