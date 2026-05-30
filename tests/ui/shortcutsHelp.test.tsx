// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ShortcutsHelp } from '@ui/shortcuts/ShortcutsHelp'
import { SHORTCUT_GROUPS } from '@ui/shortcuts/shortcutList'

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
  document.querySelectorAll('[role="dialog"]').forEach((el) => el.remove())
})

describe('ShortcutsHelp (L-DLG-05)', () => {
  it('lists every catalogued shortcut and its keys', () => {
    act(() => root.render(<ShortcutsHelp open onClose={() => {}} />))
    const text = document.body.textContent ?? ''
    for (const group of SHORTCUT_GROUPS) {
      for (const entry of group.entries) {
        expect(text, entry.description).toContain(entry.description)
        expect(text, entry.keys).toContain(entry.keys)
      }
    }
  })

  it('covers the core L-DLG-05 shortcut set', () => {
    const all = SHORTCUT_GROUPS.flatMap((g) => g.entries.map((e) => e.keys))
    for (const key of ['Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+S', 'Ctrl+E', 'Ctrl+G', 'Ctrl+Shift+G']) {
      expect(all).toContain(key)
    }
  })
})
