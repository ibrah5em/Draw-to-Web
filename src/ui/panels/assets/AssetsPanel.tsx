/**
 * Assets panel (L-DLG-06).
 *
 * Browsable list of the images registered in `document.assets` (the sharp
 * manifest from C11 / I-ELE-05): a thumbnail, the original filename,
 * dimensions, and how many elements reference each asset. Deleting an asset
 * surfaces a warning when it is still referenced by an `<image>` node (the
 * DoD), since removing it would orphan those references.
 *
 * Deviation from the task line: the manifest entry (`AssetManifestEntry`) has
 * no `alt` field — alt text lives on each `ImageNode` and is edited in the
 * Properties panel (L-PRP-08). The asset panel therefore shows reference
 * counts instead of an alt editor; alt stays where the model puts it.
 *
 * Deletion writes through {@link commitDocumentPatch} (Zod-validated). Reads
 * are live from the store, so uploads/removals reflect immediately.
 */

import { ImageOff, Trash2 } from 'lucide-react'
import type { JSX } from 'react'

import type { AssetId, AssetManifestEntry, ElementNode } from '@document/types'
import { useDocumentStore } from '@store/documentStore'

import { commitDocumentPatch } from '../document-settings/applySettings'
import styles from './AssetsPanel.module.css'

/** Count how many image nodes in the tree point at `assetId`. */
function countReferences(node: ElementNode, assetId: AssetId): number {
  let total = node.type === 'image' && node.assetId === assetId ? 1 : 0
  if (node.type === 'container') {
    for (const child of node.children) total += countReferences(child, assetId)
  }
  return total
}

/** First (smallest) srcset path for a thumbnail preview. */
function thumbPath(asset: AssetManifestEntry): string | undefined {
  const widths = Object.keys(asset.srcset)
    .map(Number)
    .sort((a, b) => a - b)
  const smallest = widths[0]
  return smallest !== undefined ? asset.srcset[smallest] : undefined
}

function AssetRow({ asset }: { asset: AssetManifestEntry }): JSX.Element {
  const tree = useDocumentStore((s) => s.document.tree)
  const refs = countReferences(tree, asset.id)
  const thumb = thumbPath(asset)

  const remove = (): void => {
    if (refs > 0) {
      const ok =
        typeof window === 'undefined' ||
        typeof window.confirm !== 'function' ||
        window.confirm(
          `"${asset.originalFilename}" is used by ${refs} element${refs === 1 ? '' : 's'}. Delete it anyway? Those images will break.`
        )
      if (!ok) return
    }
    commitDocumentPatch((doc) => {
      const next = { ...doc.assets }
      delete next[asset.id]
      return { ...doc, assets: next }
    })
  }

  return (
    <li className={styles.row}>
      <span className={styles.thumb}>
        {thumb ? <img src={thumb} alt="" className={styles.thumbImg} /> : <ImageOff size={16} />}
      </span>
      <span className={styles.meta}>
        <span className={styles.name} title={asset.originalFilename}>
          {asset.originalFilename}
        </span>
        <span className={styles.dims}>
          {asset.width}×{asset.height}
          {refs > 0 ? ` · used ${refs}×` : ' · unused'}
        </span>
      </span>
      <button
        className={styles.deleteBtn}
        onClick={remove}
        aria-label={`Delete ${asset.originalFilename}`}
        title="Delete asset"
      >
        <Trash2 size={14} />
      </button>
    </li>
  )
}

/** The Assets panel body: a list of uploaded image manifest entries. */
export function AssetsPanel(): JSX.Element {
  const assets = useDocumentStore((s) => s.document.assets)
  const entries = Object.values(assets)

  return (
    <div className={styles.panel}>
      {entries.length === 0 ? (
        <p className={styles.empty}>
          No assets yet. Upload images from an element&apos;s Properties panel.
        </p>
      ) : (
        <ul className={styles.list}>
          {entries.map((asset) => (
            <AssetRow key={asset.id} asset={asset} />
          ))}
        </ul>
      )}
    </div>
  )
}
