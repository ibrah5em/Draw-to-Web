// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ViewToggles } from '@ui/topbar/ViewToggles'

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

function buttonByAria(label: string): HTMLButtonElement {
  const btn = container.querySelector(`button[aria-label="${label}"]`)
  if (!btn) throw new Error(`no button "${label}"`)
  return btn as HTMLButtonElement
}

describe('ViewToggles', () => {
  it('reflects visibility via aria-pressed and the Hide/Show label', () => {
    act(() =>
      root.render(
        <ViewToggles
          toggles={[
            { id: 'a', label: 'Layers panel', icon: 'L', visible: true, onToggle: () => {} },
            { id: 'b', label: 'Properties panel', icon: 'P', visible: false, onToggle: () => {} },
          ]}
        />
      )
    )
    const visible = buttonByAria('Hide Layers panel')
    const hidden = buttonByAria('Show Properties panel')
    expect(visible.getAttribute('aria-pressed')).toBe('true')
    expect(hidden.getAttribute('aria-pressed')).toBe('false')
  })

  it('invokes onToggle when clicked', () => {
    let count = 0
    act(() =>
      root.render(
        <ViewToggles
          toggles={[
            {
              id: 'tokens',
              label: 'Tokens panel',
              icon: 'T',
              visible: true,
              onToggle: () => {
                count += 1
              },
            },
          ]}
        />
      )
    )
    act(() => buttonByAria('Hide Tokens panel').click())
    expect(count).toBe(1)
  })
})
