import { afterEach, describe, expect, it } from 'vitest'

import { useViewPrefs } from '@ui/state/viewPrefs'

afterEach(() => {
  useViewPrefs.getState().setHoverPreview(false)
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
