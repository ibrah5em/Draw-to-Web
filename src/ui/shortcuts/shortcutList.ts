/**
 * Canonical keyboard-shortcut catalogue (L-DLG-05).
 *
 * Single source of truth for both the binding hook (`useEditorShortcuts`)
 * and the Help panel (`ShortcutsHelp`), so a shortcut can never be live
 * without being documented — the L-DLG-05 DoD ("every shortcut listed in a
 * Help panel and tested"). The `keys` strings are display labels; the hook
 * owns the matching `react-hotkeys-hook` patterns.
 */

export interface ShortcutEntry {
  readonly keys: string
  readonly description: string
}

export interface ShortcutGroup {
  readonly title: string
  readonly entries: ReadonlyArray<ShortcutEntry>
}

export const SHORTCUT_GROUPS: ReadonlyArray<ShortcutGroup> = [
  {
    title: 'History',
    entries: [
      { keys: 'Ctrl+Z', description: 'Undo' },
      { keys: 'Ctrl+Shift+Z', description: 'Redo' },
    ],
  },
  {
    title: 'File',
    entries: [
      { keys: 'Ctrl+S', description: 'Save' },
      { keys: 'Ctrl+Shift+S', description: 'Save as' },
      { keys: 'Ctrl+E', description: 'Export' },
    ],
  },
  {
    title: 'Edit',
    entries: [
      { keys: 'Ctrl+C', description: 'Copy' },
      { keys: 'Ctrl+V', description: 'Paste' },
      { keys: 'Ctrl+D', description: 'Duplicate' },
      { keys: 'Delete / Backspace', description: 'Delete selection' },
      { keys: 'Ctrl+A', description: 'Select all in current section' },
      { keys: 'Ctrl+G', description: 'Group selection' },
      { keys: 'Ctrl+Shift+G', description: 'Ungroup' },
    ],
  },
  {
    title: 'Arrange',
    entries: [
      { keys: 'Arrow keys', description: 'Nudge 1 px' },
      { keys: 'Shift+Arrow', description: 'Nudge 10 px' },
      { keys: ']', description: 'Bring forward' },
      { keys: '[', description: 'Send back' },
    ],
  },
]
