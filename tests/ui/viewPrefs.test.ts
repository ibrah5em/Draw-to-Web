import { afterEach, describe, expect, it } from 'vitest'

import { useViewPrefs } from '@ui/state/viewPrefs'

afterEach(() => {
  useViewPrefs.setState({ hoverPreview: false, hiddenIds: new Set(), lockedIds: new Set() })
})

describe('viewPrefs store (L-TOP-03)', () => {
  it('defaults hoverPreview off', () => {
    expect(useViewPrefs.getState().hoverPreview).toBe(false)
  })

  it('toggles and sets hoverPreview', () => {
    useViewPrefs.getState().toggleHoverPreview()
    expect(useViewPrefs.getState().hoverPreview).toBe(true)
    useViewPrefs.getState().toggleHoverPreview()
    expect(useViewPrefs.getState().hoverPreview).toBe(false)
    useViewPrefs.getState().setHoverPreview(true)
    expect(useViewPrefs.getState().hoverPreview).toBe(true)
  })
})

describe('viewPrefs store — hidden / locked flags (L-LYR-01)', () => {
  it('defaults both sets empty', () => {
    expect(useViewPrefs.getState().hiddenIds.size).toBe(0)
    expect(useViewPrefs.getState().lockedIds.size).toBe(0)
  })

  it('toggleHidden adds then removes an id', () => {
    useViewPrefs.getState().toggleHidden('el-1')
    expect(useViewPrefs.getState().hiddenIds.has('el-1')).toBe(true)
    useViewPrefs.getState().toggleHidden('el-1')
    expect(useViewPrefs.getState().hiddenIds.has('el-1')).toBe(false)
  })

  it('toggleLocked adds then removes an id, independent of hidden', () => {
    useViewPrefs.getState().toggleLocked('el-2')
    expect(useViewPrefs.getState().lockedIds.has('el-2')).toBe(true)
    expect(useViewPrefs.getState().hiddenIds.has('el-2')).toBe(false)
    useViewPrefs.getState().toggleLocked('el-2')
    expect(useViewPrefs.getState().lockedIds.has('el-2')).toBe(false)
  })

  it('produces a new Set reference on toggle (so selectors re-render)', () => {
    const before = useViewPrefs.getState().hiddenIds
    useViewPrefs.getState().toggleHidden('x')
    expect(useViewPrefs.getState().hiddenIds).not.toBe(before)
  })
})
