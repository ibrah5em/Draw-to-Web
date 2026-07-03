import { describe, expect, it } from 'vitest'

import { BREAKPOINT_OPTIONS, BREAKPOINT_WIDTH_PX } from '@ui/topbar/breakpoints'

// The topbar BreakpointSwitcher was relocated into the View ▸ Canvas Size menu
// (MenuBar). Its shared metadata now lives in `breakpoints.ts`; this covers the
// contract that mattered — the four ordered breakpoints and the pixel widths
// that must match the generator's media-query thresholds.
describe('breakpoint metadata (L-TOP-02)', () => {
  it('widths match the generator thresholds', () => {
    expect(BREAKPOINT_WIDTH_PX).toEqual({ base: 1280, tablet: 1024, mobile: 768, small: 480 })
  })

  it('exposes four ordered options with labels and icon factories', () => {
    expect(BREAKPOINT_OPTIONS.map((o) => o.value)).toEqual(['base', 'tablet', 'mobile', 'small'])
    expect(BREAKPOINT_OPTIONS.map((o) => o.label)).toEqual(['Desktop', 'Tablet', 'Mobile', 'Small'])
    for (const option of BREAKPOINT_OPTIONS) {
      expect(typeof option.icon).toBe('function')
      expect(option.icon(14)).toBeTruthy()
    }
  })
})
