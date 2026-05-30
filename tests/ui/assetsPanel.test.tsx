// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { AssetManifestEntry } from '@document/types'
import { useDocumentStore } from '@store/documentStore'
import { AssetsPanel } from '@ui/panels/assets/AssetsPanel'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

const ASSET: AssetManifestEntry = {
  id: 'asset1',
  mimeType: 'image/webp',
  originalFilename: 'hero.png',
  width: 1600,
  height: 900,
  srcset: { 400: 'assets/asset1-400.webp', 800: 'assets/asset1-800.webp' },
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useDocumentStore.getState().reset()
  vi.restoreAllMocks()
})

function seedAsset(referenced: boolean): void {
  const base = useDocumentStore.getState().document
  const children = referenced
    ? [
        {
          id: 'img1',
          type: 'image' as const,
          alt: '',
          assetId: ASSET.id,
          style: { base: {} },
        },
      ]
    : []
  useDocumentStore.getState().hydrate({
    ...base,
    assets: { [ASSET.id]: ASSET },
    tree: { ...base.tree, type: 'container' as const, children },
  })
}

describe('AssetsPanel (L-DLG-06)', () => {
  it('shows an empty hint with no assets', () => {
    act(() => root.render(<AssetsPanel />))
    expect(container.textContent).toContain('No assets yet')
  })

  it('lists assets with filename and dimensions', () => {
    seedAsset(false)
    act(() => root.render(<AssetsPanel />))
    expect(container.textContent).toContain('hero.png')
    expect(container.textContent).toContain('1600×900')
  })

  it('deletes an unreferenced asset without confirmation', () => {
    seedAsset(false)
    act(() => root.render(<AssetsPanel />))
    const del = [...container.querySelectorAll('button')].find((b) =>
      b.getAttribute('aria-label')?.startsWith('Delete')
    )
    act(() => del!.click())
    expect(useDocumentStore.getState().document.assets).toEqual({})
  })

  it('warns before deleting a referenced asset (L-DLG-06 DoD)', () => {
    seedAsset(true)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    act(() => root.render(<AssetsPanel />))
    expect(container.textContent).toContain('used 1×')
    const del = [...container.querySelectorAll('button')].find((b) =>
      b.getAttribute('aria-label')?.startsWith('Delete')
    )
    act(() => del!.click())
    // Confirm was shown and (declined) → asset stays.
    expect(confirm).toHaveBeenCalled()
    expect(useDocumentStore.getState().document.assets[ASSET.id]).toBeTruthy()
  })
})
