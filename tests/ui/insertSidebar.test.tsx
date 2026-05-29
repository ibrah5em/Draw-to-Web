// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { presetsRegistry, type PresetId } from '@document/presets'
import { InsertSidebar } from '@ui/sidebar/InsertSidebar'
import { getPresetMeta } from '@ui/sidebar/presetMeta'

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
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

function render(): void {
  act(() => root.render(<InsertSidebar />))
}

function tabs(): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="tab"]'))
}

function cardIdsOn(tabValue: string): string[] {
  const panel = container.querySelector<HTMLElement>(`[role="tabpanel"][data-state="active"]`)
  if (!panel) return []
  void tabValue
  return Array.from(panel.querySelectorAll<HTMLButtonElement>('[data-insert-id]')).map(
    (b) => b.dataset.insertId ?? ''
  )
}

describe('InsertSidebar (L-SBR-01, L-SBR-02)', () => {
  it('renders Sections / Components / Elements tabs', () => {
    render()
    const labels = tabs().map((t) => t.textContent)
    expect(labels).toEqual(['Sections', 'Components', 'Elements'])
  })

  it('defaults to the Sections tab with cards visible', () => {
    render()
    const active = container.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
    expect(active?.textContent).toBe('Sections')
    const cards = container.querySelectorAll('[role="tabpanel"][data-state="active"] button')
    expect(cards.length).toBeGreaterThan(0)
  })

  it('tabs are keyboard-reachable with a tabindex assigned', () => {
    render()
    for (const tab of tabs()) {
      expect(tab.getAttribute('tabindex')).not.toBeNull()
    }
  })

  it('switches the active panel when a different tab is activated', () => {
    render()
    const [, second, third] = tabs()
    act(() => {
      second.focus()
      second.click()
    })
    let active = container.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
    expect(active?.textContent).toBe('Components')

    act(() => {
      third.focus()
      third.click()
    })
    active = container.querySelector<HTMLElement>('[role="tab"][data-state="active"]')
    expect(active?.textContent).toBe('Elements')
  })

  it('cards are driven by presetsRegistry — every registered preset surfaces (L-SBR-02)', () => {
    render()
    const sectionIds = cardIdsOn('sections')
    const [, second] = tabs()
    act(() => {
      second.focus()
      second.click()
    })
    const componentIds = cardIdsOn('components')
    const allIds = new Set<string>([...sectionIds, ...componentIds])
    for (const id of Object.keys(presetsRegistry) as PresetId[]) {
      expect(allIds.has(id)).toBe(true)
    }
  })

  it('every card carries a tooltip (title attr) sourced from preset meta', () => {
    render()
    const card = container.querySelector<HTMLButtonElement>('[data-insert-id="hero-centered"]')
    expect(card).not.toBeNull()
    expect(card?.title).toBe(getPresetMeta('hero-centered').description)
  })
})
