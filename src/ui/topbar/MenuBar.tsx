/**
 * Custom in-app menu bar (File / Edit / View).
 *
 * Replaces the OS-drawn application menu (hidden in the main process) with a
 * dark, themeable menu using Radix DropdownMenu. Wires the actions that exist
 * today — New / Open / Save (Y-PER), Undo / Redo (C5 dispatcher), panel
 * visibility, and theme. Export is stubbed until L-TOP-04.
 */

import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Check } from 'lucide-react'
import { useState, type JSX } from 'react'

import { useDocumentStore } from '@store/documentStore'
import { redo, undo } from '@store/dispatch'
import { useHistoryStore } from '@store/historyStore'
import { openProject, saveProject } from '@store/persistence'
import { useSessionStore } from '@store/sessionStore'

import { deleteSelected } from '../canvas/useDeleteSelection'
import { runExport } from '../export/runExport'
import { openLivePreview } from '../preview/livePreview'
import { ShortcutsHelp } from '../shortcuts/ShortcutsHelp'

import type { ViewToggle } from './ViewToggles'
import styles from './MenuBar.module.css'

/** Reset to a fresh blank project and clear history + selection. */
function newDocument(): void {
  useDocumentStore.getState().reset()
  useHistoryStore.getState().clear()
  useSessionStore.getState().clearSelection()
}

function MenuItem({
  label,
  shortcut,
  disabled,
  onSelect,
}: {
  label: string
  shortcut?: string
  disabled?: boolean
  onSelect?: () => void
}): JSX.Element {
  return (
    <DropdownMenu.Item className={styles.item} disabled={disabled} onSelect={() => onSelect?.()}>
      <span>{label}</span>
      {shortcut ? <span className={styles.shortcut}>{shortcut}</span> : null}
    </DropdownMenu.Item>
  )
}

function Menu({ label, children }: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={styles.trigger}>{label}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className={styles.content} align="start" sideOffset={2}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** The File / Edit / View / Help menu bar. */
export function MenuBar({
  panels,
  onOpenSettings,
}: {
  panels: ReadonlyArray<ViewToggle>
  /** Open the Document Settings dialog (L-DLG-02), owned by the shell. */
  onOpenSettings?: () => void
}): JSX.Element {
  const theme = useSessionStore((s) => s.theme)
  const toggleTheme = useSessionStore((s) => s.toggleTheme)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  return (
    <nav className={styles.bar} aria-label="Main menu">
      <Menu label="File">
        <>
          <MenuItem label="New" shortcut="Ctrl+N" onSelect={newDocument} />
          <MenuItem label="Open…" shortcut="Ctrl+O" onSelect={() => void openProject()} />
          <MenuItem label="Save" shortcut="Ctrl+S" onSelect={() => void saveProject()} />
          <DropdownMenu.Separator className={styles.separator} />
          <MenuItem label="Document settings…" onSelect={() => onOpenSettings?.()} />
          <DropdownMenu.Separator className={styles.separator} />
          <MenuItem
            label="Export…"
            shortcut="Ctrl+E"
            onSelect={() => {
              void runExport().then((result) => {
                // eslint-disable-next-line no-console
                console[result.ok ? 'log' : 'error'](`[export] ${result.message}`)
                if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                  window.alert(result.message)
                }
              })
            }}
          />
        </>
      </Menu>

      <Menu label="Edit">
        <>
          <MenuItem label="Undo" shortcut="Ctrl+Z" onSelect={() => undo()} />
          <MenuItem label="Redo" shortcut="Ctrl+Shift+Z" onSelect={() => redo()} />
          <DropdownMenu.Separator className={styles.separator} />
          <MenuItem
            label="Delete selection"
            shortcut="Del"
            onSelect={() => void deleteSelected()}
          />
        </>
      </Menu>

      <Menu label="View">
        <>
          <MenuItem
            label="Live Preview…"
            shortcut="Ctrl+Shift+P"
            onSelect={() => void openLivePreview()}
          />
          <DropdownMenu.Separator className={styles.separator} />
          {panels.map((panel) => (
            <DropdownMenu.CheckboxItem
              key={panel.id}
              className={styles.checkboxItem}
              checked={panel.visible}
              onCheckedChange={() => panel.onToggle()}
            >
              <DropdownMenu.ItemIndicator className={styles.indicator}>
                <Check size={12} />
              </DropdownMenu.ItemIndicator>
              {panel.label}
            </DropdownMenu.CheckboxItem>
          ))}
          <DropdownMenu.Separator className={styles.separator} />
          <DropdownMenu.CheckboxItem
            className={styles.checkboxItem}
            checked={theme === 'dark'}
            onCheckedChange={() => toggleTheme()}
          >
            <DropdownMenu.ItemIndicator className={styles.indicator}>
              <Check size={12} />
            </DropdownMenu.ItemIndicator>
            Dark theme
          </DropdownMenu.CheckboxItem>
        </>
      </Menu>

      <Menu label="Help">
        <>
          <MenuItem label="Keyboard shortcuts…" onSelect={() => setShortcutsOpen(true)} />
        </>
      </Menu>

      <ShortcutsHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </nav>
  )
}
