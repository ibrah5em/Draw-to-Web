// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useDocumentStore } from '@store/documentStore'
import { useHistoryStore } from '@store/historyStore'
import { useSessionStore } from '@store/sessionStore'
import { MenuBar } from '@ui/topbar/MenuBar'
import type { ViewToggle } from '@ui/topbar/ViewToggles'

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

function render(panels: ViewToggle[] = []): void {
  act(() => root.render(<MenuBar panels={panels} />))
}

function openMenu(label: string): void {
  const trigger = [...container.querySelectorAll('button')].find((b) => b.textContent === label)
  if (!trigger) throw new Error(`no menu "${label}"`)
  // Radix DropdownMenu opens on pointerdown (button 0), not click.
  act(() => {
    trigger.dispatchEvent(
      new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 })
    )
  })
}

function menuItem(text: string, role = 'menuitem'): HTMLElement {
  const item = [...document.body.querySelectorAll(`[role="${role}"]`)].find((el) =>
    el.textContent?.includes(text)
  )
  if (!item) throw new Error(`no item "${text}"`)
  return item as HTMLElement
}

describe('MenuBar', () => {
  it('renders File / Edit / View / Help / Settings triggers', () => {
    render()
    const labels = [...container.querySelectorAll('button')].map((b) => b.textContent)
    expect(labels).toEqual(['File', 'Edit', 'View', 'Help', 'Settings'])
  })

  it('Settings trigger invokes onOpenAppSettings', () => {
    let opened = 0
    act(() =>
      root.render(
        <MenuBar
          panels={[]}
          onOpenAppSettings={() => {
            opened += 1
          }}
        />
      )
    )
    const settings = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Settings'
    )
    act(() => settings?.click())
    expect(opened).toBe(1)
  })

  it('View menu exposes the Canvas Size submenu', () => {
    render()
    openMenu('View')
    expect(menuItem('Canvas Size')).toBeTruthy()
  })

  it('File → New resets to a blank document', () => {
    render()
    openMenu('File')
    act(() => menuItem('New').click())
    const doc = useDocumentStore.getState().document
    expect(doc.meta.name).toBe('Untitled')
    expect(doc.tree.type === 'container' && doc.tree.children).toHaveLength(0)
  })

  it('exposes Export as an enabled menu item', () => {
    render()
    openMenu('File')
    const item = menuItem('Export')
    expect(item.getAttribute('aria-disabled')).not.toBe('true')
  })

  it('View toggles invoke the panel handler', () => {
    let toggled = 0
    render([
      {
        id: 'sidebar',
        label: 'Layers panel',
        icon: 'L',
        visible: true,
        onToggle: () => {
          toggled += 1
        },
      },
    ])
    openMenu('View')
    act(() => menuItem('Layers panel', 'menuitemcheckbox').click())
    expect(toggled).toBe(1)
  })
})
