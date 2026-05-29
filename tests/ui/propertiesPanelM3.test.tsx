// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { ElementNode, ImageNode, TextNode } from '@document/types'
import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
import { findElementById } from '@store/selectors'
import { useSessionStore } from '@store/sessionStore'
import { PropertiesPanel } from '@ui/panels/properties/PropertiesPanel'

import { PORTFOLIO_DOCUMENT } from '../fixtures/portfolioDocument'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useDocumentStore.getState().hydrate(PORTFOLIO_DOCUMENT)
  useSessionStore.setState({ activeBreakpoint: 'base', activeState: 'default', theme: 'light' })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()
})

function selectAndRender(id: string): void {
  useSessionStore.getState().setSelectedIds([id])
  act(() => root.render(<PropertiesPanel />))
}

function node(id: string): ElementNode {
  const found = findElementById(useDocumentStore.getState().document.tree, id)
  if (!found) throw new Error(`no node ${id}`)
  return found
}

function typeInto(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  act(() => input.dispatchEvent(new Event('input', { bubbles: true })))
}

describe('Properties — State tabs (L-PRP-05)', () => {
  it('renders four state tabs', () => {
    selectAndRender('title')
    const labels = [...container.querySelectorAll('[role="tab"]')].map((t) => t.textContent)
    expect(labels).toEqual(['Default', 'Hover', 'Focus', 'Active'])
  })

  it('clicking a tab updates sessionStore.activeState', () => {
    selectAndRender('title')
    const hover = [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (t) => t.textContent === 'Hover'
    )
    act(() => {
      hover?.focus()
      hover?.click()
    })
    expect(useSessionStore.getState().activeState).toBe('hover')
  })
})

describe('Properties — Breakpoint banner + badge (L-PRP-09)', () => {
  it('shows no banner at base breakpoint', () => {
    selectAndRender('title')
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('shows the banner with the active breakpoint label', () => {
    useSessionStore.getState().setActiveBreakpoint('tablet')
    selectAndRender('title')
    const banner = container.querySelector('[role="status"]')
    expect(banner?.textContent).toContain('Tablet')
    expect(banner?.textContent).toContain('1024px')
  })
})

describe('Properties — Animation (L-PRP-06)', () => {
  it('selecting a keyframe writes node.animation.name', () => {
    selectAndRender('title')
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Animation keyframe"]')
    if (!select) throw new Error('keyframe select missing')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
      setter?.call(select, 'fadeUp')
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const n = node('title') as TextNode
    expect(n.animation?.name).toBe('fadeUp')
  })

  it('typing a duration writes node.animation.duration', () => {
    selectAndRender('title')
    const select = container.querySelector<HTMLSelectElement>('[aria-label="Animation keyframe"]')
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
      setter?.call(select, 'fadeUp')
      select?.dispatchEvent(new Event('change', { bubbles: true }))
    })
    const duration = container.querySelector<HTMLInputElement>('[aria-label="Animation duration"]')
    if (!duration) throw new Error('duration input missing')
    typeInto(duration, '600ms')
    expect((node('title') as TextNode).animation?.duration).toBe('600ms')
  })
})

describe('Properties — Runtime reveal switch (L-PRP-07)', () => {
  it('toggling on writes dataAttributes.reveal = "true"', () => {
    selectAndRender('title')
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Reveal on scroll"]')
    if (!toggle) throw new Error('reveal switch missing')
    act(() => toggle.click())
    expect(node('title').dataAttributes?.reveal).toBe('true')
  })

  it('toggling off removes the dataAttribute', () => {
    selectAndRender('title')
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="Reveal on scroll"]')
    if (!toggle) throw new Error('reveal switch missing')
    act(() => toggle.click())
    act(() => toggle.click())
    expect(node('title').dataAttributes?.reveal).toBeUndefined()
  })
})

describe('Properties — Image section (L-PRP-08)', () => {
  it('renders for image nodes', () => {
    selectAndRender('hero')
    const labelDrop = container.querySelector('[aria-label="Upload image"]')
    expect(labelDrop).not.toBeNull()
  })

  it('does not render for non-image nodes', () => {
    selectAndRender('title')
    expect(container.querySelector('[aria-label="Upload image"]')).toBeNull()
  })

  it('updating alt text dispatches updateNode', () => {
    selectAndRender('hero')
    const alt = container.querySelector<HTMLInputElement>('[aria-label="Image alt text"]')
    if (!alt) throw new Error('alt input missing')
    typeInto(alt, 'New caption')
    expect((node('hero') as ImageNode).alt).toBe('New caption')
  })

  it('surfaces a friendly error when the IPC is missing', async () => {
    // Default test env has no electronAPI.
    selectAndRender('hero')
    const input = container.querySelector<HTMLInputElement>('[aria-label="Upload image"]')
    if (!input) throw new Error('upload input missing')
    const file = new File([new Uint8Array([1, 2, 3])], 'pic.png', { type: 'image/png' })
    await act(async () => {
      Object.defineProperty(input, 'files', { value: [file] })
      input.dispatchEvent(new Event('change', { bubbles: true }))
      // microtask flush
      await Promise.resolve()
      await Promise.resolve()
    })
    const error = container.querySelector('[role="alert"]')
    // jsdom either trips on `file.arrayBuffer` (no API) or we hit the
    // "Upload not available" branch when electronAPI is absent — either
    // way the error UI must render so the user isn't left guessing.
    expect(error?.textContent ?? '').not.toBe('')
  })
})
