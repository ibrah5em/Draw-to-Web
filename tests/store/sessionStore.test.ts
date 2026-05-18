import { beforeEach, describe, expect, it } from 'vitest'
import { useSessionStore } from '../../src/store/sessionStore'

const reset = () => {
  useSessionStore.setState({
    selectedIds: [],
    activeBreakpoint: 'base',
    activeState: 'default',
    panelSizes: { sidebar: 280, inspector: 320, console: 200 },
    theme: 'light',
  })
}

describe('sessionStore', () => {
  beforeEach(reset)

  it('starts with the documented defaults', () => {
    const s = useSessionStore.getState()
    expect(s.selectedIds).toEqual([])
    expect(s.activeBreakpoint).toBe('base')
    expect(s.activeState).toBe('default')
    expect(s.theme).toBe('light')
    expect(s.panelSizes).toEqual({ sidebar: 280, inspector: 320, console: 200 })
  })

  describe('selection', () => {
    it('setSelectedIds replaces the selection', () => {
      useSessionStore.getState().setSelectedIds(['a', 'b'])
      expect(useSessionStore.getState().selectedIds).toEqual(['a', 'b'])
      useSessionStore.getState().setSelectedIds(['c'])
      expect(useSessionStore.getState().selectedIds).toEqual(['c'])
    })

    it('toggleSelected adds an absent id and removes a present id', () => {
      const { toggleSelected } = useSessionStore.getState()
      toggleSelected('a')
      expect(useSessionStore.getState().selectedIds).toEqual(['a'])
      toggleSelected('b')
      expect(useSessionStore.getState().selectedIds).toEqual(['a', 'b'])
      toggleSelected('a')
      expect(useSessionStore.getState().selectedIds).toEqual(['b'])
    })

    it('clearSelection empties the selection', () => {
      useSessionStore.getState().setSelectedIds(['a', 'b'])
      useSessionStore.getState().clearSelection()
      expect(useSessionStore.getState().selectedIds).toEqual([])
    })

    it('does not retain references to caller-owned arrays after a toggle', () => {
      const ids = ['a']
      useSessionStore.getState().setSelectedIds(ids)
      useSessionStore.getState().toggleSelected('b')
      expect(useSessionStore.getState().selectedIds).toEqual(['a', 'b'])
      expect(ids).toEqual(['a'])
    })
  })

  describe('routing flags', () => {
    it('setActiveBreakpoint switches the active breakpoint', () => {
      useSessionStore.getState().setActiveBreakpoint('mobile')
      expect(useSessionStore.getState().activeBreakpoint).toBe('mobile')
    })

    it('setActiveState switches the active pseudo-state', () => {
      useSessionStore.getState().setActiveState('hover')
      expect(useSessionStore.getState().activeState).toBe('hover')
    })
  })

  describe('panel sizes', () => {
    it('setPanelSize updates one pane and leaves the others untouched', () => {
      const before = useSessionStore.getState().panelSizes
      useSessionStore.getState().setPanelSize('sidebar', 400)
      const after = useSessionStore.getState().panelSizes
      expect(after.sidebar).toBe(400)
      expect(after.inspector).toBe(before.inspector)
      expect(after.console).toBe(before.console)
    })

    it('produces a new panelSizes object reference on write', () => {
      const before = useSessionStore.getState().panelSizes
      useSessionStore.getState().setPanelSize('console', 300)
      expect(useSessionStore.getState().panelSizes).not.toBe(before)
    })
  })

  describe('theme', () => {
    it('setTheme sets the theme explicitly', () => {
      useSessionStore.getState().setTheme('dark')
      expect(useSessionStore.getState().theme).toBe('dark')
    })

    it('toggleTheme flips between light and dark', () => {
      useSessionStore.getState().toggleTheme()
      expect(useSessionStore.getState().theme).toBe('dark')
      useSessionStore.getState().toggleTheme()
      expect(useSessionStore.getState().theme).toBe('light')
    })
  })

  it('selection writes do not touch the document — sessionStore is independent', () => {
    // Y-STR-02 DoD: "Selecting element does not mark document dirty."
    // The sessionStore has no document reference and no isDirty flag; structural
    // proof here is that the store keys are exactly the documented session fields.
    const keys = Object.keys(useSessionStore.getState()).sort()
    expect(keys).toEqual(
      [
        'activeBreakpoint',
        'activeState',
        'clearSelection',
        'panelSizes',
        'selectedIds',
        'setActiveBreakpoint',
        'setActiveState',
        'setPanelSize',
        'setSelectedIds',
        'setTheme',
        'theme',
        'toggleSelected',
        'toggleTheme',
      ].sort()
    )
    expect(keys).not.toContain('document')
    expect(keys).not.toContain('isDirty')
  })
})
