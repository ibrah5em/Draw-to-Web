// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@store/sessionStore'
import { BREAKPOINT_WIDTH_PX, BreakpointSwitcher } from '@ui/topbar/BreakpointSwitcher'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  useSessionStore.getState().setActiveBreakpoint('base')
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useSessionStore.getState().setActiveBreakpoint('base')
})

function render(): void {
  act(() => root.render(<BreakpointSwitcher />))
}

function buttons(): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll<HTMLButtonElement>('[data-breakpoint]'))
}

describe('BreakpointSwitcher (L-TOP-02)', () => {
  it('renders four buttons whose widths match the generator thresholds', () => {
    render()
    const breakpoints = buttons().map((b) => b.dataset.breakpoint)
    expect(breakpoints).toEqual(['base', 'tablet', 'mobile', 'small'])
    expect(BREAKPOINT_WIDTH_PX).toEqual({ base: 1280, tablet: 1024, mobile: 768, small: 480 })
  })

  it('marks the active breakpoint with aria-pressed + data-active', () => {
    useSessionStore.getState().setActiveBreakpoint('tablet')
    render()
    const tablet = buttons().find((b) => b.dataset.breakpoint === 'tablet')
    expect(tablet?.getAttribute('aria-pressed')).toBe('true')
    expect(tablet?.dataset.active).toBe('true')
    const base = buttons().find((b) => b.dataset.breakpoint === 'base')
    expect(base?.getAttribute('aria-pressed')).toBe('false')
  })

  it('clicking a button updates sessionStore.activeBreakpoint', () => {
    render()
    const mobile = buttons().find((b) => b.dataset.breakpoint === 'mobile')
    act(() => mobile?.click())
    expect(useSessionStore.getState().activeBreakpoint).toBe('mobile')
  })

  it('every button exposes the width in its tooltip and aria-label', () => {
    render()
    for (const b of buttons()) {
      const bp = b.dataset.breakpoint as keyof typeof BREAKPOINT_WIDTH_PX
      const width = BREAKPOINT_WIDTH_PX[bp]
      expect(b.title).toContain(`${width}px`)
      expect(b.getAttribute('aria-label')).toContain(`${width}px`)
    }
  })
})
