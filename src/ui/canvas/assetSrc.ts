/**
 * Editor preview source for uploaded image assets.
 *
 * Uploaded images are processed in the main process and written to disk under
 * the app's user-data folder; their manifest (`document.assets`) records only
 * *export-relative* paths (e.g. `assets/<id>-800.webp`), which the editor
 * renderer cannot load directly. The main process registers a custom
 * `dtw-asset://` scheme (see `src/main/index.ts`) that serves those files by
 * basename, so the canvas can preview them. This module turns a manifest entry
 * into a `dtw-asset://` URL the `<img>` can load.
 */

import type { AssetManifestEntry } from '@document/types'

/** Custom scheme the main process serves uploaded asset files on. */
export const ASSET_SCHEME = 'dtw-asset'

/**
 * Build an editor-loadable preview URL for an uploaded image asset, or
 * `undefined` when the entry has no usable variant. Picks a mid-size variant
 * so the preview stays crisp without loading the largest file.
 *
 * @param entry - The asset manifest entry (`document.assets[id]`), if any.
 */
export function assetPreviewSrc(entry: AssetManifestEntry | undefined): string | undefined {
  if (!entry) return undefined
  const widths = Object.keys(entry.srcset)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b)
  if (widths.length === 0) return undefined
  const chosen = widths[Math.min(widths.length - 1, Math.floor(widths.length / 2))]!
  const relPath = entry.srcset[chosen]
  if (relPath === undefined) return undefined
  const base = relPath.split('/').pop()
  return base ? `${ASSET_SCHEME}://local/${base}` : undefined
}
