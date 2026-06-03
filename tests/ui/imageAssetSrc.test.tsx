// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { AssetManifestEntry, Document, ImageNode } from '../../src/document/types'
import { createBlankDocument, useDocumentStore } from '@store/documentStore'
import { CanvasNode } from '@ui/canvas/CanvasNode'
import { useViewPrefs } from '@ui/state/viewPrefs'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

const asset: AssetManifestEntry = {
  id: 'a1',
  mimeType: 'image/webp',
  originalFilename: 'photo.png',
  width: 800,
  height: 600,
  srcset: { 400: 'assets/a1-400.webp', 800: 'assets/a1-800.webp' },
}

const imageNode: ImageNode = {
  id: 'img1',
  type: 'image',
  assetId: 'a1',
  alt: '',
  style: { base: {} },
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useViewPrefs.setState({ hiddenIds: new Set(), lockedIds: new Set() })
  const doc: Document = { ...createBlankDocument('img'), assets: { a1: asset }, tree: imageNode }
  useDocumentStore.setState({ document: doc, isDirty: false })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useDocumentStore.getState().reset()
})

function imgSrc(node: ImageNode): string | null {
  act(() => root.render(<CanvasNode node={node} />))
  return container.querySelector('img')?.getAttribute('src') ?? null
}

describe('canvas image preview from an uploaded asset', () => {
  it('renders an uploaded image through the dtw-asset scheme', () => {
    expect(imgSrc(imageNode)).toMatch(/^dtw-asset:\/\/local\/a1-\d+\.webp$/)
  })

  it('emits no source when the asset is missing from the manifest', () => {
    const src = imgSrc({ ...imageNode, assetId: 'gone' })
    // No usable source — and never the old broken "asset:<id>" placeholder.
    expect(src === null || src === '').toBe(true)
  })

  it('prefers an explicit external URL over the uploaded asset', () => {
    expect(imgSrc({ ...imageNode, externalUrl: 'https://example.com/y.png' })).toBe(
      'https://example.com/y.png'
    )
  })
})
