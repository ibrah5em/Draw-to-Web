import { describe, expect, it } from 'vitest'

import type { AssetManifestEntry } from '../../src/document/types'
import { ASSET_SCHEME, assetPreviewSrc } from '@ui/canvas/assetSrc'

const entry = (srcset: Record<number, string>): AssetManifestEntry => ({
  id: 'abc',
  mimeType: 'image/webp',
  originalFilename: 'photo.png',
  width: 1600,
  height: 900,
  srcset,
})

describe('assetPreviewSrc', () => {
  it('returns undefined when there is no entry', () => {
    expect(assetPreviewSrc(undefined)).toBeUndefined()
  })

  it('returns undefined when the srcset is empty', () => {
    expect(assetPreviewSrc(entry({}))).toBeUndefined()
  })

  it('builds a dtw-asset URL from a mid-size variant basename', () => {
    const url = assetPreviewSrc(
      entry({
        400: 'assets/abc-400.webp',
        800: 'assets/abc-800.webp',
        1200: 'assets/abc-1200.webp',
      })
    )
    expect(url).toBe(`${ASSET_SCHEME}://local/abc-800.webp`)
  })

  it('handles a single SVG variant', () => {
    expect(assetPreviewSrc(entry({ 512: 'assets/abc.svg' }))).toBe(
      `${ASSET_SCHEME}://local/abc.svg`
    )
  })

  it('only ever emits a bare filename (no directory traversal)', () => {
    const url = assetPreviewSrc(entry({ 400: 'assets/abc-400.webp' }))
    expect(url).toBe(`${ASSET_SCHEME}://local/abc-400.webp`)
    expect(url).not.toContain('assets/')
  })
})
