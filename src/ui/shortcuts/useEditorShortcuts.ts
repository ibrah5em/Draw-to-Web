/**
 * Editor keyboard-shortcut layer (L-DLG-05).
 *
 * Binds the full shortcut map (catalogued in `shortcutList.ts`) to document
 * operations via `react-hotkeys-hook`. Each binding is a thin call into an
 * already-tested action helper (dispatcher, clipboard, nudge, persistence,
 * export), so the actions stay unit-testable without a DOM and this hook is
 * pure wiring.
 *
 * Delete / Backspace already live in `useDeleteSelection` and Ctrl+Shift+P
 * (Live Preview) in `useLivePreviewShortcut`; both are mounted by the shell
 * alongside this hook and are intentionally not duplicated here.
 *
 * Form-field guard: bindings that collide with normal text editing
 * (copy/paste/duplicate/select-all/nudge) are disabled while focus is in an
 * input, textarea, or contentEditable so inline text editing (L-CAN-07) and
 * the panel inputs keep their native behaviour.
 */

import { useHotkeys } from 'react-hotkeys-hook'

import { redo, undo } from '@store/dispatch'
import { saveProject } from '@store/persistence'

import {
  copySelection,
  duplicateSelection,
  groupSelection,
  moveZOrder,
  pasteClipboard,
  selectAllSiblings,
  ungroupSelection,
} from '../canvas/clipboard'
import { runExport } from '../export/runExport'
import { nudgeSelection } from './nudge'

/** Options for bindings that must yield to native text editing. */
const NOT_IN_FIELDS = { enableOnFormTags: false, enableOnContentEditable: false } as const
/** Options for global bindings that should fire even from a focused field. */
const ALWAYS = { enableOnFormTags: true, enableOnContentEditable: true } as const

/**
 * Mount the editor's global keyboard shortcuts. Call once at the shell
 * level. Returns nothing; every binding has a side effect on the stores.
 */
export function useEditorShortcuts(): void {
  // History — allowed everywhere; undo while typing is expected.
  useHotkeys(
    'ctrl+z, meta+z',
    (e) => {
      e.preventDefault()
      undo()
    },
    ALWAYS
  )
  useHotkeys(
    'ctrl+shift+z, meta+shift+z, ctrl+y',
    (e) => {
      e.preventDefault()
      redo()
    },
    ALWAYS
  )

  // File.
  useHotkeys(
    'ctrl+s, meta+s',
    (e) => {
      e.preventDefault()
      void saveProject()
    },
    { ...ALWAYS, preventDefault: true }
  )
  useHotkeys(
    'ctrl+shift+s, meta+shift+s',
    (e) => {
      e.preventDefault()
      void saveProject()
    },
    { ...ALWAYS, preventDefault: true }
  )
  useHotkeys(
    'ctrl+e, meta+e',
    (e) => {
      e.preventDefault()
      void runExport()
    },
    { ...ALWAYS, preventDefault: true }
  )

  // Edit — guarded so they don't hijack text fields.
  useHotkeys(
    'ctrl+c, meta+c',
    () => {
      copySelection()
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    'ctrl+v, meta+v',
    () => {
      pasteClipboard()
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    'ctrl+d, meta+d',
    (e) => {
      e.preventDefault()
      duplicateSelection()
    },
    { ...NOT_IN_FIELDS, preventDefault: true }
  )
  useHotkeys(
    'ctrl+a, meta+a',
    (e) => {
      e.preventDefault()
      selectAllSiblings()
    },
    { ...NOT_IN_FIELDS, preventDefault: true }
  )
  useHotkeys(
    'ctrl+g, meta+g',
    (e) => {
      e.preventDefault()
      groupSelection()
    },
    { ...NOT_IN_FIELDS, preventDefault: true }
  )
  useHotkeys(
    'ctrl+shift+g, meta+shift+g',
    (e) => {
      e.preventDefault()
      ungroupSelection()
    },
    { ...NOT_IN_FIELDS, preventDefault: true }
  )

  // Arrange — z-order.
  useHotkeys(
    ']',
    () => {
      moveZOrder(1)
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    '[',
    () => {
      moveZOrder(-1)
    },
    NOT_IN_FIELDS
  )

  // Arrange — nudge. Shift = 10 px (react-hotkeys-hook treats `shift+up`
  // and `up` as distinct patterns, so bind both explicitly).
  useHotkeys(
    'up',
    (e) => {
      e.preventDefault()
      nudgeSelection('y', -1)
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    'down',
    (e) => {
      e.preventDefault()
      nudgeSelection('y', 1)
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    'left',
    (e) => {
      e.preventDefault()
      nudgeSelection('x', -1)
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    'right',
    (e) => {
      e.preventDefault()
      nudgeSelection('x', 1)
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    'shift+up',
    (e) => {
      e.preventDefault()
      nudgeSelection('y', -10)
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    'shift+down',
    (e) => {
      e.preventDefault()
      nudgeSelection('y', 10)
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    'shift+left',
    (e) => {
      e.preventDefault()
      nudgeSelection('x', -10)
    },
    NOT_IN_FIELDS
  )
  useHotkeys(
    'shift+right',
    (e) => {
      e.preventDefault()
      nudgeSelection('x', 10)
    },
    NOT_IN_FIELDS
  )
}
