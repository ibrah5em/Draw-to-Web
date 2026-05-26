// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSessionStore } from '@store/sessionStore'
import { ThemeToggle } from '@ui/topbar/ThemeToggle'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useSessionStore.getState().setTheme('light')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useSessionStore.getState().setTheme('light')
})

function switchEl(): HTMLButtonElement {
  const el = container.querySelector('[role="switch"]')
  if (!el) throw new Error('no switch rendered')
  return el as HTMLButtonElement
}

describe('ThemeToggle (L-TOP-01)', () => {
  it('reflects the current session theme', () => {
    act(() => root.render(<ThemeToggle />))
    expect(switchEl().getAttribute('aria-checked')).toBe('false')
  })

  it('flips the session theme to dark when toggled on', () => {
    act(() => root.render(<ThemeToggle />))
    act(() => switchEl().click())
    expect(useSessionStore.getState().theme).toBe('dark')
  })

  it('flips back to light when toggled off', () => {
    useSessionStore.getState().setTheme('dark')
    act(() => root.render(<ThemeToggle />))
    act(() => switchEl().click())
    expect(useSessionStore.getState().theme).toBe('light')
  })
})
