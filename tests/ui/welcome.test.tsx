// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Welcome } from '@ui/dialogs/Welcome'

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
  // Tidy up any portalled dialog nodes Radix leaves on document.body.
  document.querySelectorAll('[role="dialog"]').forEach((el) => el.remove())
})

function renderWelcome(overrides: Partial<Parameters<typeof Welcome>[0]> = {}): {
  onNew: () => void
  onOpen: () => void
  onTemplate: ReturnType<typeof vi.fn>
  onRecent: ReturnType<typeof vi.fn>
  onClose: () => void
} {
  const onNew = vi.fn()
  const onOpen = vi.fn()
  const onTemplate = vi.fn()
  const onRecent = vi.fn()
  const onClose = vi.fn()
  act(() =>
    root.render(
      <Welcome
        open
        onClose={onClose}
        onNew={onNew}
        onOpen={onOpen}
        onTemplate={onTemplate}
        onRecent={onRecent}
        {...overrides}
      />
    )
  )
  return { onNew, onOpen, onTemplate, onRecent, onClose }
}

function btn(label: string): HTMLButtonElement {
  const found = [...document.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
    b.textContent?.includes(label)
  )
  if (!found) throw new Error(`no button containing "${label}"`)
  return found
}

describe('Welcome dialog (L-DLG-01)', () => {
  it('renders New, Open, and the four template options', () => {
    renderWelcome()
    expect(btn('New blank project')).toBeTruthy()
    expect(btn('Open project')).toBeTruthy()
    expect(btn('Portfolio')).toBeTruthy()
    expect(btn('Blank')).toBeTruthy()
    expect(btn('Landing')).toBeTruthy()
    expect(btn('Resume')).toBeTruthy()
  })

  it('marks unfinished templates as disabled', () => {
    renderWelcome()
    expect(btn('Landing').disabled).toBe(true)
    expect(btn('Resume').disabled).toBe(true)
  })

  it('clicking a template fires onTemplate with the id', () => {
    const { onTemplate } = renderWelcome()
    act(() => btn('Portfolio').click())
    expect(onTemplate).toHaveBeenCalledWith('portfolio')
  })

  it('clicking New fires onNew', () => {
    const handlers = renderWelcome()
    act(() => btn('New blank project').click())
    // onNew is a vi.fn; reuse handlers to verify it.
    expect(handlers.onNew).toHaveBeenCalled()
  })

  it('shows an empty hint when no recents are available', () => {
    renderWelcome()
    expect(document.body.textContent).toContain('No recent projects yet')
  })

  it('renders recents pulled from electronAPI.listRecentFiles', async () => {
    const recents = [
      { path: '/a/b/portfolio.dtw', name: 'portfolio.dtw', lastOpened: '2026-05-29T00:00:00Z' },
      { path: '/c/d/blog.dtw', name: 'blog.dtw', lastOpened: '2026-05-28T00:00:00Z' },
    ]
    ;(globalThis as { electronAPI?: Partial<Window['electronAPI']> }).electronAPI = {
      listRecentFiles: async () => recents,
    } as Partial<Window['electronAPI']> as Window['electronAPI']

    const { onRecent } = renderWelcome()
    // Flush the microtask the IPC promise sits behind.
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(document.body.textContent).toContain('portfolio.dtw')
    expect(document.body.textContent).toContain('blog.dtw')
    act(() => btn('blog.dtw').click())
    expect(onRecent).toHaveBeenCalledWith('/c/d/blog.dtw')

    delete (globalThis as { electronAPI?: unknown }).electronAPI
  })
})
